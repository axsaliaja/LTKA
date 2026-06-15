/**
 * Thin fetch wrapper around the Express backend.
 * Base URL comes from NEXT_PUBLIC_API_URL (set per-session in Vercel).
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiError {
  error: string;
  reason?: string;
  [k: string]: unknown;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (data ?? { error: res.statusText }) as ApiError;
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};

export { BASE as API_BASE };
