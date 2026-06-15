"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveAuth, AuthUser } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
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
    <>
      <div className="grid-bg" />
      <div className="glow" />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="animate-fadeUp">
          <span className="badge mb-8">Institut Teknologi Bandung</span>
          <h1 className="display gradient-text text-[clamp(3rem,8vw,5.5rem)] leading-none">
            SIHADIR
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[1.05rem] font-light text-muted">
            Sistem absensi cerdas berbasis pengenalan wajah. Akurat, real-time, dan
            bebas titip absen.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-primary">
              Daftar Sekarang
            </Link>
            <button className="btn-ghost" onClick={() => setOpen(true)}>
              Masuk
            </button>
          </div>
        </div>
      </main>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm animate-fadeUp rounded-xl border border-border bg-surface p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-4 top-4 text-xl text-muted hover:text-text"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2 className="display text-2xl">Masuk</h2>
            <p className="mb-6 mt-1 text-[0.9rem] text-muted">Gunakan email institusi kamu</p>
            <div className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@itb.ac.id"
                  onKeyDown={(e) => e.key === "Enter" && doLogin()}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && doLogin()}
                />
              </div>
              {error && <p className="msg-error">{error}</p>}
              <button className="btn-primary btn-full" onClick={doLogin} disabled={busy}>
                {busy ? "Memproses…" : "Masuk"}
              </button>
              <p className="text-center text-[0.85rem] text-muted">
                Belum punya akun?{" "}
                <Link href="/register" className="font-medium text-accent">
                  Daftar
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
