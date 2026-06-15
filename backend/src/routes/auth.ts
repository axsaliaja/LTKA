import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../lib/db";
import { signToken } from "../lib/jwt";
import { isValidDescriptor } from "../lib/euclidean";
import { uploadEnrollmentPhoto } from "../lib/s3";

export const authRouter = Router();

const registerSchema = z.object({
  id: z.string().min(1).max(64), // NIM
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  role: z.enum(["student", "lecturer"]).default("student"),
  descriptor: z.array(z.number()).length(128),
  // Data-URL JPEG captured live in the browser (optional but recommended).
  photo: z.string().optional(),
});

/**
 * POST /auth/register
 * Create an account, store the face descriptor and (optionally) upload the live
 * enrollment photo to private S3.
 */
authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { id, name, email, password, role, descriptor, photo } = parsed.data;

  if (!isValidDescriptor(descriptor)) {
    res.status(400).json({ error: "Invalid face descriptor" });
    return;
  }

  // Reject duplicates up-front for a clearer error than a raw SQL failure.
  const existing = await query(
    "SELECT id FROM students WHERE id = ? OR email = ? LIMIT 1",
    [id, email]
  );
  if (existing.length > 0) {
    res.status(409).json({ error: "NIM or email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let photoKey: string | null = null;
  if (photo) {
    try {
      photoKey = await uploadEnrollmentPhoto(id, photo);
    } catch (e) {
      // Photo is audit-only; don't fail registration if S3 is unavailable.
      console.error("S3 upload failed:", e);
    }
  }

  await query(
    `INSERT INTO students (id, name, email, password_hash, role, face_descriptor, photo_s3_key)
     VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
    [id, name, email, passwordHash, role, JSON.stringify(descriptor), photoKey]
  );

  const token = signToken({ sub: id, role, name });
  res.status(201).json({ token, user: { id, name, email, role } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/login -> JWT
 */
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;

  const rows = await query<{
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: "student" | "lecturer";
  }>("SELECT id, name, email, password_hash, role FROM students WHERE email = ? LIMIT 1", [
    email,
  ]);

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ sub: user.id, role: user.role, name: user.name });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});
