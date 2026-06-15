"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar, Footer, Container } from "@/components/Chrome";
import CameraCapture, { CaptureResult } from "@/components/CameraCapture";
import { api } from "@/lib/api";
import { saveAuth, AuthUser } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    role: "student" as "student" | "lecturer",
  });
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError("");
    if (!capture) {
      setError("Tangkap wajah terlebih dahulu.");
      return;
    }
    if (!form.id || !form.name || !form.email || form.password.length < 6) {
      setError("Lengkapi semua field. Password minimal 6 karakter.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>("/auth/register", {
        ...form,
        descriptor: capture.descriptor,
        photo: capture.photo,
      });
      saveAuth(res.token, res.user);
      router.push(res.user.role === "lecturer" ? "/dashboard" : "/checkin");
    } catch (e: any) {
      setError(e?.error ?? "Registrasi gagal.");
      setBusy(false);
    }
  };

  return (
    <>
      <NavBar />
      <Container>
        <div className="mx-auto max-w-content">
          <h1 className="display-md">Daftar & Enroll Wajah</h1>
          <p className="mt-sm text-body-md text-body">
            Isi data, lalu tangkap wajahmu langsung dari kamera. Tidak ada opsi
            unggah file.
          </p>

          <div className="mt-xl grid gap-xl md:grid-cols-2">
            {/* Form */}
            <div className="card space-y-md">
              <Field label="NIM / ID">
                <input className="input" value={form.id} onChange={set("id")} placeholder="10120001" />
              </Field>
              <Field label="Nama lengkap">
                <input className="input" value={form.name} onChange={set("name")} placeholder="Nama" />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="nama@kampus.ac.id" />
              </Field>
              <Field label="Password">
                <input className="input" type="password" value={form.password} onChange={set("password")} placeholder="Min. 6 karakter" />
              </Field>
              <Field label="Peran">
                <select className="input" value={form.role} onChange={set("role")}>
                  <option value="student">Mahasiswa</option>
                  <option value="lecturer">Dosen</option>
                </select>
              </Field>

              {capture && (
                <p className="text-body-sm text-success">✓ Wajah tertangkap. Siap mendaftar.</p>
              )}
              {error && <p className="text-body-sm text-error">{error}</p>}

              <button className="btn-primary w-full" onClick={submit} disabled={busy || !capture}>
                {busy ? "Mendaftarkan…" : "Daftar"}
              </button>
            </div>

            {/* Camera */}
            <div className="card-outline">
              <h2 className="mb-md text-title-md text-ink">Tangkap Wajah</h2>
              <CameraCapture
                requiredBlinks={0}
                captureLabel={capture ? "Tangkap Ulang" : "Ambil Wajah"}
                onResult={(r) => {
                  setCapture(r);
                  setError("");
                }}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      </Container>
      <Footer />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
