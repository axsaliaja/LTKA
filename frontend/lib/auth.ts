"use client";

/** Minimal client-side auth/session storage (localStorage-backed). */

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "student" | "lecturer";
  student_id?: string | null;
  is_face_registered?: boolean;
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function patchUser(patch: Partial<AuthUser>) {
  const u = getUser();
  if (u) localStorage.setItem("user", JSON.stringify({ ...u, ...patch }));
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function isAuthed(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem("token");
}
