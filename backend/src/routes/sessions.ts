import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { query, execute } from "../lib/db";
import { authRequired, requireRole } from "../middleware/auth";

export const sessionsRouter = Router();

/**
 * GET /sessions
 * List currently-open sessions (for the check-in picker).
 * Pass ?all=1 (lecturer) to include closed ones.
 */
sessionsRouter.get("/", authRequired, async (req, res) => {
  const all = req.query.all === "1" && req.user?.role === "lecturer";
  const rows = await query(
    `SELECT s.id, s.course_name, s.lecturer_id, st.name AS lecturer_name,
            s.start_time, s.end_time, s.late_threshold_minutes, s.is_open, s.created_at
       FROM class_sessions s
       JOIN students st ON st.id = s.lecturer_id
      ${all ? "" : "WHERE s.is_open = 1"}
      ORDER BY s.start_time DESC`
  );
  res.json(rows);
});

const createSchema = z.object({
  course_name: z.string().min(1).max(255),
  start_time: z.string().min(1), // ISO-8601 string
  end_time: z.string().min(1),
  late_threshold_minutes: z.number().int().min(0).max(240).default(15),
});

/**
 * POST /sessions  (lecturer only)
 * Create a class session.
 */
sessionsRouter.post("/", authRequired, requireRole("lecturer"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { course_name, start_time, end_time, late_threshold_minutes } = parsed.data;

  const start = new Date(start_time);
  const end = new Date(end_time);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    res.status(400).json({ error: "Invalid start/end time range" });
    return;
  }

  const id = uuidv4();
  const toSql = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

  await query(
    `INSERT INTO class_sessions
       (id, course_name, lecturer_id, start_time, end_time, late_threshold_minutes, is_open)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, course_name, req.user!.sub, toSql(start), toSql(end), late_threshold_minutes]
  );

  res.status(201).json({ id, course_name, start_time, end_time, late_threshold_minutes, is_open: true });
});

/**
 * PATCH /sessions/:id/close  (lecturer only, must own the session)
 */
sessionsRouter.patch("/:id/close", authRequired, requireRole("lecturer"), async (req, res) => {
  const result = await execute(
    "UPDATE class_sessions SET is_open = 0 WHERE id = ? AND lecturer_id = ?",
    [req.params.id, req.user!.sub]
  );
  if (!result.affectedRows) {
    res.status(404).json({ error: "Session not found or not owned by you" });
    return;
  }
  res.json({ id: req.params.id, is_open: false });
});
