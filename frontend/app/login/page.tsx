"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveAuth, AuthUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
        email,
        password,
      });
      saveAuth(res.token, res.user);
      router.push(res.user.role === "lecturer" ? "/dashboard" : "/student");
    } catch (e: any) {
      setError(e?.error ?? "Gagal masuk");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm animate-fadeUp rounded-xl border border-border bg-surface p-8">
        <Link href="/" className="text-[0.85rem] text-muted hover:text-accent">
          ← Kembali
        </Link>
        <h1 className="display mt-4 text-2xl">Masuk</h1>
        <p className="mb-6 mt-1 text-[0.9rem] text-muted">Gunakan email institusi kamu</p>
        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@itb.ac.id" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="msg-error">{error}</p>}
          <button className="btn-primary btn-full" disabled={busy}>
            {busy ? "Memproses…" : "Masuk"}
          </button>
          <p className="text-center text-[0.85rem] text-muted">
            Belum punya akun?{" "}
            <Link href="/register" className="font-medium text-accent">
              Daftar
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
