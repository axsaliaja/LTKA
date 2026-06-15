import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, execute } from "../lib/db";
import { signToken } from "../lib/jwt";
import { isValidDescriptor } from "../lib/euclidean";
import { uploadEnrollmentPhoto } from "../lib/s3";
import { authRequired } from "../middleware/auth";
import { config } from "../config";

export const authRouter = Router();

/** Returns an error string if the email is not allowed for the role, else null. */
function checkEmailDomain(email: string, role: "student" | "lecturer"): string | null {
  const domain = config.emailDomains[role];
  if (!domain) return null; // check disabled
  if (!email.toLowerCase().endsWith("@" + domain)) {
    return `Email ${role === "lecturer" ? "dosen" : "mahasiswa"} harus berakhiran @${domain}`;
  }
  return null;
}

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["student", "lecturer"]),
  student_id: z.string().max(64).optional(),
  jurusan: z.string().max(255).optional(),
  fakultas: z.string().max(255).optional(),
});

/**
 * POST /auth/register
 * Create an account (no face yet). Students enroll their face via
 * /auth/register-face afterwards. Returns a JWT so that step is authenticated.
 */
authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Input tidak valid", details: parsed.error.flatten() });
    return;
  }
  const { name, email, password, role, student_id, jurusan, fakultas } = parsed.data;

  const domainErr = checkEmailDomain(email, role);
  if (domainErr) {
    res.status(400).json({ error: domainErr });
    return;
  }
  if (role === "student" && !student_id) {
    res.status(400).json({ error: "NIM wajib diisi untuk mahasiswa" });
    return;
  }

  const dup = await query(
    "SELECT id FROM users WHERE email = ? OR (student_id IS NOT NULL AND student_id = ?) LIMIT 1",
    [email.toLowerCase(), student_id ?? null]
  );
  if (dup.length > 0) {
    res.status(409).json({ error: "Email atau NIM sudah terdaftar" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await execute(
    `INSERT INTO users (name, email, password_hash, role, student_id, jurusan, fakultas)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email.toLowerCase(),
      passwordHash,
      role,
      role === "student" ? student_id : null,
      jurusan ?? null,
      fakultas ?? null,
    ]
  );

  const id = result.insertId;
  const token = signToken({ sub: id, role, name });
  res.status(201).json({
    token,
    user: { id, name, email: email.toLowerCase(), role, student_id: student_id ?? null, is_face_registered: false },
  });
});

const faceSchema = z.object({
  descriptor: z.array(z.number()).length(128),
  photo: z.string().optional(),
});

/**
 * POST /auth/register-face  (authenticated)
 * Stores the logged-in student's face descriptor + (optional) live photo.
 */
authRouter.post("/register-face", authRequired, async (req, res) => {
  if (req.user!.role !== "student") {
    res.status(400).json({ error: "Hanya mahasiswa yang perlu registrasi wajah" });
    return;
  }
  const parsed = faceSchema.safeParse(req.body);
  if (!parsed.success || !isValidDescriptor(parsed.data.descriptor)) {
    res.status(400).json({ error: "Descriptor wajah tidak valid" });
    return;
  }
  const userId = req.user!.sub;

  let photoKey: string | null = null;
  if (parsed.data.photo) {
    try {
      photoKey = await uploadEnrollmentPhoto(String(userId), parsed.data.photo);
    } catch (e) {
      console.error("S3 enrollment upload failed:", e);
    }
  }

  await execute(
    `UPDATE users
        SET face_descriptor = CAST(? AS JSON), photo_s3_key = ?, is_face_registered = TRUE
      WHERE id = ?`,
    [JSON.stringify(parsed.data.descriptor), photoKey, userId]
  );

  res.json({ message: "Wajah berhasil didaftarkan", is_face_registered: true });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** POST /auth/login -> JWT */
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Input tidak valid" });
    return;
  }
  const { email, password } = parsed.data;

  const rows = await query<{
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: "student" | "lecturer";
    student_id: string | null;
    is_face_registered: number;
  }>(
    `SELECT id, name, email, password_hash, role, student_id, is_face_registered
       FROM users WHERE email = ? LIMIT 1`,
    [email.toLowerCase()]
  );

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: "Email atau password salah" });
    return;
  }

  const token = signToken({ sub: user.id, role: user.role, name: user.name });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      student_id: user.student_id,
      is_face_registered: !!user.is_face_registered,
    },
  });
});
