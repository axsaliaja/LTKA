import { Router } from "express";
import { z } from "zod";
import { query, execute } from "../lib/db";
import { authRequired, requireRole } from "../middleware/auth";
import { euclideanDistance, isValidDescriptor } from "../lib/euclidean";
import { config } from "../config";

export const attendanceRouter = Router();

const checkinSchema = z.object({
  session_id: z.string().min(1),
  descriptor: z.array(z.number()).length(128),
  liveness_passed: z.boolean(),
});

/**
 * POST /attendance/checkin  (authoritative, server-side validation)
 *
 * 1. Validate JWT (middleware).
 * 2. Load session; reject if closed or outside [start_time, end_time].
 * 3. Reject if liveness_passed !== true.
 * 4. Compute Euclidean distance between submitted descriptor and the stored
 *    enrollment descriptor; reject if > MATCH_THRESHOLD.
 * 5. status = "late" if now > start_time + late_threshold, else "present".
 * 6. INSERT into attendance (UNIQUE(session_id, student_id) blocks duplicates).
 *
 * The client is never trusted: liveness and match are both re-checked here.
 */
attendanceRouter.post("/checkin", authRequired, async (req, res) => {
  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { session_id, descriptor, liveness_passed } = parsed.data;
  const studentId = req.user!.sub;

  // (3) Liveness gate — refuse a still photo / spoof.
  if (liveness_passed !== true) {
    res.status(400).json({ error: "Liveness check failed", reason: "liveness" });
    return;
  }
  if (!isValidDescriptor(descriptor)) {
    res.status(400).json({ error: "Invalid face descriptor", reason: "descriptor" });
    return;
  }

  // (2) Session must exist, be open, and within its time window.
  const sessions = await query<{
    id: string;
    start_time: string;
    end_time: string;
    late_threshold_minutes: number;
    is_open: number;
  }>(
    "SELECT id, start_time, end_time, late_threshold_minutes, is_open FROM class_sessions WHERE id = ? LIMIT 1",
    [session_id]
  );
  const session = sessions[0];
  if (!session) {
    res.status(404).json({ error: "Session not found", reason: "session" });
    return;
  }
  if (!session.is_open) {
    res.status(403).json({ error: "Session is closed", reason: "closed" });
    return;
  }

  const now = new Date();
  // DB stores naive datetimes (dateStrings:true). Interpret as UTC.
  const start = new Date(session.start_time.replace(" ", "T") + "Z");
  const end = new Date(session.end_time.replace(" ", "T") + "Z");
  if (now < start || now > end) {
    res.status(403).json({ error: "Outside session time window", reason: "time_window" });
    return;
  }

  // (4) Face match against stored enrollment descriptor.
  const students = await query<{ face_descriptor: number[] }>(
    "SELECT face_descriptor FROM students WHERE id = ? LIMIT 1",
    [studentId]
  );
  const student = students[0];
  if (!student) {
    res.status(404).json({ error: "Student not enrolled", reason: "not_enrolled" });
    return;
  }
  // mysql2 returns JSON columns already parsed; guard for string just in case.
  const stored =
    typeof student.face_descriptor === "string"
      ? JSON.parse(student.face_descriptor)
      : student.face_descriptor;

  const distance = euclideanDistance(descriptor, stored);
  if (distance > config.matchThreshold) {
    res.status(403).json({
      error: "Face does not match enrolled identity",
      reason: "no_match",
      distance: Number(distance.toFixed(4)),
      threshold: config.matchThreshold,
    });
    return;
  }

  // (5) Determine present vs late.
  const lateCutoff = new Date(start.getTime() + session.late_threshold_minutes * 60_000);
  const status: "present" | "late" = now > lateCutoff ? "late" : "present";

  // (6) Insert; UNIQUE constraint prevents double check-in.
  try {
    await execute(
      `INSERT INTO attendance
         (session_id, student_id, status, match_distance, liveness_passed)
       VALUES (?, ?, ?, ?, ?)`,
      [session_id, studentId, status, Number(distance.toFixed(4)), 1]
    );
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Already checked in for this session", reason: "duplicate" });
      return;
    }
    throw e;
  }

  res.status(201).json({
    status,
    distance: Number(distance.toFixed(4)),
    threshold: config.matchThreshold,
    checkin_time: now.toISOString(),
  });
});

/**
 * GET /attendance/session/:sessionId  (lecturer)
 * Roster of who checked in for a session.
 */
attendanceRouter.get(
  "/session/:sessionId",
  authRequired,
  requireRole("lecturer"),
  async (req, res) => {
    const rows = await query(
      `SELECT a.id, a.student_id, st.name AS student_name, a.checkin_time,
              a.status, a.match_distance, a.liveness_passed
         FROM attendance a
         JOIN students st ON st.id = a.student_id
        WHERE a.session_id = ?
        ORDER BY a.checkin_time ASC`,
      [req.params.sessionId]
    );
    res.json(rows);
  }
);

/**
 * GET /attendance/student/:studentId
 * Attendance history for a student. Students may only see their own.
 */
attendanceRouter.get("/student/:studentId", authRequired, async (req, res) => {
  if (req.user!.role !== "lecturer" && req.user!.sub !== req.params.studentId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await query(
    `SELECT a.id, a.session_id, s.course_name, a.checkin_time, a.status, a.match_distance
       FROM attendance a
       JOIN class_sessions s ON s.id = a.session_id
      WHERE a.student_id = ?
      ORDER BY a.checkin_time DESC`,
    [req.params.studentId]
  );
  res.json(rows);
});
