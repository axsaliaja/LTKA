import { Router } from "express";
import { query } from "../lib/db";
import { authRequired, requireRole } from "../middleware/auth";

export const analyticsRouter = Router();

/**
 * GET /analytics/session/:sessionId  (lecturer)
 * Present / late / absent counts + percentages for a session.
 *
 * "Absent" is derived as: all enrolled students with role='student' who have
 * NO attendance row for this session.
 */
analyticsRouter.get(
  "/session/:sessionId",
  authRequired,
  requireRole("lecturer"),
  async (req, res) => {
    const { sessionId } = req.params;

    const sessions = await query<{ id: string; course_name: string }>(
      "SELECT id, course_name FROM class_sessions WHERE id = ? LIMIT 1",
      [sessionId]
    );
    if (!sessions[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const statusRows = await query<{ status: string; cnt: number }>(
      "SELECT status, COUNT(*) AS cnt FROM attendance WHERE session_id = ? GROUP BY status",
      [sessionId]
    );

    let present = 0;
    let late = 0;
    for (const r of statusRows) {
      if (r.status === "present") present = Number(r.cnt);
      if (r.status === "late") late = Number(r.cnt);
    }

    const totalStudentsRows = await query<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM students WHERE role = 'student'"
    );
    const totalStudents = Number(totalStudentsRows[0]?.cnt ?? 0);

    const checkedIn = present + late;
    const absent = Math.max(0, totalStudents - checkedIn);

    const pct = (n: number) =>
      totalStudents > 0 ? Number(((n / totalStudents) * 100).toFixed(1)) : 0;

    res.json({
      session_id: sessionId,
      course_name: sessions[0].course_name,
      total_students: totalStudents,
      present,
      late,
      absent,
      checked_in: checkedIn,
      percentages: {
        present: pct(present),
        late: pct(late),
        absent: pct(absent),
      },
    });
  }
);
