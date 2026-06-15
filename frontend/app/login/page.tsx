"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar, Footer, Container } from "@/components/Chrome";
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
      router.push(res.user.role === "lecturer" ? "/dashboard" : "/checkin");
    } catch (e: any) {
      setError(e?.error ?? "Login gagal.");
      setBusy(false);
    }
  };

  return (
    <>
      <NavBar />
      <Container>
        <div className="mx-auto max-w-sm">
          <h1 className="display-md">Masuk</h1>
          <form onSubmit={submit} className="card mt-lg space-y-md">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@kampus.ac.id"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-body-sm text-error">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Memproses…" : "Masuk"}
            </button>
            <p className="text-center text-body-sm text-muted">
              Belum punya akun?{" "}
              <Link href="/register" className="font-semibold text-ink">
                Daftar
              </Link>
            </p>
          </form>
        </div>
      </Container>
      <Footer />
    </>
  );
}
