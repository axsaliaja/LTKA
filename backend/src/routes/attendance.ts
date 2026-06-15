import { Router } from "express";
import { z } from "zod";
import { query, execute } from "../lib/db";
import { authRequired, requireRole } from "../middleware/auth";
import { euclideanDistance, isValidDescriptor } from "../lib/euclidean";
import { uploadAttendancePhoto, getPhotoUrl } from "../lib/s3";
import { config } from "../config";

export const attendanceRouter = Router();

const checkinSchema = z.object({
  session_id: z.number().int(),
  descriptor: z.array(z.number()).length(128),
  photo: z.string().optional(), // data-URL JPEG snapshot
});

/**
 * POST /attendance/checkin  (student, authoritative server-side validation)
 *
 * 1. Session must exist and be active.
 * 2. Student must be a member of the session's class.
 * 3. Student must have an enrolled face descriptor.
 * 4. Euclidean distance(submitted, stored) <= MATCH_THRESHOLD, else reject.
 * 5. Store snapshot photo to S3; INSERT (UNIQUE blocks double check-in).
 */
attendanceRouter.post("/checkin", authRequired, requireRole("student"), async (req, res) => {
  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success || !isValidDescriptor(parsed.data.descriptor)) {
    res.status(400).json({ error: "Input tidak valid", reason: "input" });
    return;
  }
  const { session_id, descriptor, photo } = parsed.data;
  const userId = req.user!.sub;

  // (1) Active session + its class.
  const sessions = await query<{ id: number; class_id: number; is_active: number }>(
    "SELECT id, class_id, is_active FROM sessions WHERE id = ? LIMIT 1",
    [session_id]
  );
  const session = sessions[0];
  if (!session) {
    res.status(404).json({ error: "Sesi tidak ditemukan", reason: "session" });
    return;
  }
  if (!session.is_active) {
    res.status(403).json({ error: "Sesi sudah ditutup", reason: "closed" });
    return;
  }

  // (2) Membership.
  const member = await query("SELECT id FROM class_members WHERE class_id = ? AND student_id = ?", [
    session.class_id,
    userId,
  ]);
  if (member.length === 0) {
    res.status(403).json({ error: "Kamu tidak terdaftar di kelas ini", reason: "not_member" });
    return;
  }

  // (3) Enrolled face.
  const users = await query<{ face_descriptor: number[] | string | null }>(
    "SELECT face_descriptor FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const stored = users[0]?.face_descriptor;
  if (!stored) {
    res.status(400).json({ error: "Wajah belum di-enroll", reason: "not_enrolled" });
    return;
  }
  const storedArr = typeof stored === "string" ? JSON.parse(stored) : stored;

  // (4) Face match.
  const distance = euclideanDistance(descriptor, storedArr);
  if (distance > config.matchThreshold) {
    res.status(403).json({
      error: "Wajah tidak cocok dengan identitas terdaftar",
      reason: "no_match",
      distance: Number(distance.toFixed(4)),
      threshold: config.matchThreshold,
    });
    return;
  }

  // (5) Snapshot + insert.
  let photoKey: string | null = null;
  if (photo) {
    try {
      photoKey = await uploadAttendancePhoto(session_id, userId, photo);
    } catch (e) {
      console.error("S3 attendance upload failed:", e);
    }
  }

  try {
    await execute(
      `INSERT INTO attendances (session_id, user_id, match_distance, photo_s3_key)
       VALUES (?, ?, ?, ?)`,
      [session_id, userId, Number(distance.toFixed(4)), photoKey]
    );
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Kamu sudah absen di sesi ini", reason: "duplicate" });
      return;
    }
    throw e;
  }

  res.status(201).json({
    message: "Absensi berhasil",
    distance: Number(distance.toFixed(4)),
    threshold: config.matchThreshold,
    checkin_time: new Date().toISOString(),
  });
});

/**
 * GET /attendance/session/:sessionId  (lecturer owner)
 * Recap with presigned snapshot URLs.
 */
attendanceRouter.get(
  "/session/:sessionId",
  authRequired,
  requireRole("lecturer"),
  async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    // Authorize ownership.
    const owns = await query(
      `SELECT s.id FROM sessions s JOIN classes c ON c.id = s.class_id
        WHERE s.id = ? AND c.lecturer_id = ?`,
      [sessionId, req.user!.sub]
    );
    if (owns.length === 0) {
      res.status(403).json({ error: "Tidak punya akses ke sesi ini" });
      return;
    }

    const rows = await query<{
      id: number;
      name: string;
      student_id: string | null;
      checkin_time: string;
      match_distance: string | null;
      photo_s3_key: string | null;
    }>(
      `SELECT a.id, u.name, u.student_id, a.checkin_time, a.match_distance, a.photo_s3_key
         FROM attendances a JOIN users u ON u.id = a.user_id
        WHERE a.session_id = ? ORDER BY a.checkin_time ASC`,
      [sessionId]
    );

    const withUrls = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        name: r.name,
        student_id: r.student_id,
        checkin_time: r.checkin_time,
        match_distance: r.match_distance,
        photo_url: r.photo_s3_key ? await getPhotoUrl(r.photo_s3_key) : null,
      }))
    );
    res.json(withUrls);
  }
);

/** GET /attendance/mine  (student) — own attendance history. */
attendanceRouter.get("/mine", authRequired, requireRole("student"), async (req, res) => {
  const rows = await query(
    `SELECT a.id, s.name AS session_name, c.name AS class_name, c.mata_kuliah,
            a.checkin_time, a.match_distance
       FROM attendances a
       JOIN sessions s ON s.id = a.session_id
       JOIN classes c ON c.id = s.class_id
      WHERE a.user_id = ?
      ORDER BY a.checkin_time DESC`,
    [req.user!.sub]
  );
  res.json(rows);
});
