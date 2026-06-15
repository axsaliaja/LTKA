import { Router } from "express";
import { z } from "zod";
import { query, execute } from "../lib/db";
import { authRequired, requireRole } from "../middleware/auth";

export const sessionsRouter = Router();

const createSchema = z.object({
  class_id: z.number().int(),
  name: z.string().min(1).max(255),
});

/** POST /sessions  (lecturer, must own the class) — open an attendance session. */
sessionsRouter.post("/", authRequired, requireRole("lecturer"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Input tidak valid" });
    return;
  }
  const owns = await query("SELECT id FROM classes WHERE id = ? AND lecturer_id = ?", [
    parsed.data.class_id,
    req.user!.sub,
  ]);
  if (owns.length === 0) {
    res.status(403).json({ error: "Kelas tidak ditemukan atau bukan milikmu" });
    return;
  }
  const result = await execute("INSERT INTO sessions (class_id, name) VALUES (?, ?)", [
    parsed.data.class_id,
    parsed.data.name,
  ]);
  res.status(201).json({ id: result.insertId, name: parsed.data.name, is_active: true });
});

/** PATCH /sessions/:id/close  (lecturer owner) */
sessionsRouter.patch("/:id/close", authRequired, requireRole("lecturer"), async (req, res) => {
  const result = await execute(
    `UPDATE sessions s
       JOIN classes c ON c.id = s.class_id
        SET s.is_active = FALSE, s.closed_at = UTC_TIMESTAMP()
      WHERE s.id = ? AND c.lecturer_id = ?`,
    [req.params.id, req.user!.sub]
  );
  if (!result.affectedRows) {
    res.status(404).json({ error: "Sesi tidak ditemukan atau bukan milikmu" });
    return;
  }
  res.json({ id: Number(req.params.id), is_active: false });
});

/**
 * GET /sessions/class/:classId
 * List sessions of a class. Lecturer owner or a member student may view.
 */
sessionsRouter.get("/class/:classId", authRequired, async (req, res) => {
  const classId = Number(req.params.classId);

  // Authorize: owner lecturer OR member student.
  const allowed =
    req.user!.role === "lecturer"
      ? await query("SELECT id FROM classes WHERE id = ? AND lecturer_id = ?", [classId, req.user!.sub])
      : await query("SELECT id FROM class_members WHERE class_id = ? AND student_id = ?", [
          classId,
          req.user!.sub,
        ]);
  if (allowed.length === 0) {
    res.status(403).json({ error: "Tidak punya akses ke kelas ini" });
    return;
  }

  const rows = await query(
    `SELECT id, name, is_active, created_at, closed_at
       FROM sessions WHERE class_id = ? ORDER BY created_at DESC`,
    [classId]
  );
  res.json(rows);
});
