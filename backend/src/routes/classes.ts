import { Router } from "express";
import { z } from "zod";
import { query, execute } from "../lib/db";
import { authRequired, requireRole } from "../middleware/auth";

export const classesRouter = Router();

/** Generate a 6-char uppercase join code (no ambiguous chars). */
function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  mata_kuliah: z.string().min(1).max(255),
});

/** POST /classes  (lecturer) — create a class with a unique join code. */
classesRouter.post("/", authRequired, requireRole("lecturer"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Input tidak valid" });
    return;
  }
  // Ensure the code is unique.
  let kode = genCode();
  for (let i = 0; i < 5; i++) {
    const exists = await query("SELECT id FROM classes WHERE kode_kelas = ? LIMIT 1", [kode]);
    if (exists.length === 0) break;
    kode = genCode();
  }

  const result = await execute(
    "INSERT INTO classes (name, mata_kuliah, kode_kelas, lecturer_id) VALUES (?, ?, ?, ?)",
    [parsed.data.name, parsed.data.mata_kuliah, kode, req.user!.sub]
  );
  res.status(201).json({
    id: result.insertId,
    name: parsed.data.name,
    mata_kuliah: parsed.data.mata_kuliah,
    kode_kelas: kode,
  });
});

/** GET /classes/mine — classes owned (lecturer) or joined (student). */
classesRouter.get("/mine", authRequired, async (req, res) => {
  if (req.user!.role === "lecturer") {
    const rows = await query(
      `SELECT c.id, c.name, c.mata_kuliah, c.kode_kelas, c.created_at,
              (SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id) AS member_count
         FROM classes c
        WHERE c.lecturer_id = ?
        ORDER BY c.created_at DESC`,
      [req.user!.sub]
    );
    res.json(rows);
  } else {
    const rows = await query(
      `SELECT c.id, c.name, c.mata_kuliah, c.kode_kelas, u.name AS lecturer_name, cm.joined_at
         FROM class_members cm
         JOIN classes c ON c.id = cm.class_id
         JOIN users u ON u.id = c.lecturer_id
        WHERE cm.student_id = ?
        ORDER BY cm.joined_at DESC`,
      [req.user!.sub]
    );
    res.json(rows);
  }
});

const joinSchema = z.object({ kode_kelas: z.string().min(1).max(8) });

/** POST /classes/join  (student) — join a class by code. */
classesRouter.post("/join", authRequired, requireRole("student"), async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Kode kelas tidak valid" });
    return;
  }
  // Must have enrolled a face first (matches SIHADIR rule).
  const me = await query<{ is_face_registered: number }>(
    "SELECT is_face_registered FROM users WHERE id = ?",
    [req.user!.sub]
  );
  if (!me[0]?.is_face_registered) {
    res.status(400).json({ error: "Daftarkan wajah terlebih dahulu sebelum join kelas" });
    return;
  }

  const cls = await query<{ id: number; name: string }>(
    "SELECT id, name FROM classes WHERE kode_kelas = ? LIMIT 1",
    [parsed.data.kode_kelas.toUpperCase()]
  );
  if (!cls[0]) {
    res.status(404).json({ error: "Kode kelas tidak ditemukan" });
    return;
  }

  try {
    await execute("INSERT INTO class_members (class_id, student_id) VALUES (?, ?)", [
      cls[0].id,
      req.user!.sub,
    ]);
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Kamu sudah terdaftar di kelas ini" });
      return;
    }
    throw e;
  }
  res.status(201).json({ message: `Berhasil join kelas ${cls[0].name}`, class_id: cls[0].id });
});
