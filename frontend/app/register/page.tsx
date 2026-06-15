"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CameraCapture, { CaptureResult } from "@/components/CameraCapture";
import { api } from "@/lib/api";
import { saveAuth, patchUser, AuthUser } from "@/lib/auth";

type Role = "student" | "lecturer";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    student_id: "",
    jurusan: "",
    fakultas: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submitStep1 = async () => {
    setError("");
    if (!form.name || !form.email || form.password.length < 8) {
      setError("Lengkapi data. Password minimal 8 karakter.");
      return;
    }
    if (role === "student" && !form.student_id) {
      setError("NIM wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role,
        ...(role === "student"
          ? { student_id: form.student_id, jurusan: form.jurusan, fakultas: form.fakultas }
          : {}),
      });
      saveAuth(res.token, res.user);
      if (role === "lecturer") {
        router.push("/dashboard");
      } else {
        setStep(2);
      }
    } catch (e: any) {
      setError(e?.error ?? "Registrasi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const submitFace = async (r: CaptureResult) => {
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/register-face", { descriptor: r.descriptor, photo: r.photo });
      patchUser({ is_face_registered: true });
      setSuccess("Registrasi lengkap! Mengarahkan…");
      setTimeout(() => router.push("/student"), 1200);
    } catch (e: any) {
      setError(e?.error ?? "Gagal mendaftarkan wajah.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fadeUp rounded-xl border border-border bg-surface p-8">
        <Link href="/" className="text-[0.85rem] text-muted hover:text-accent">
          ← Kembali
        </Link>

        {step === 1 ? (
          <>
            <h1 className="display mt-4 text-2xl">Daftar Akun</h1>
            <p className="mb-6 mt-1 text-[0.9rem] text-muted">Gunakan email institusi</p>

            {/* Role tabs */}
            <div className="mb-6 flex gap-1 rounded-md bg-bg p-1">
              {(["student", "lecturer"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-sm py-2 text-[0.88rem] font-medium transition-colors ${
                    role === r ? "bg-surface text-text shadow-[0_0_0_1px_#222230]" : "text-muted"
                  }`}
                >
                  {r === "student" ? "Mahasiswa" : "Dosen"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <Field label="Nama Lengkap">
                <input className="input" value={form.name} onChange={set("name")} placeholder="Nama lengkap" />
              </Field>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder={role === "student" ? "nama@mahasiswa.itb.ac.id" : "nama@itb.ac.id"}
                />
              </Field>
              {role === "student" && (
                <>
                  <Field label="NIM">
                    <input className="input" value={form.student_id} onChange={set("student_id")} placeholder="18123054" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Jurusan">
                      <input className="input" value={form.jurusan} onChange={set("jurusan")} placeholder="Telkom" />
                    </Field>
                    <Field label="Fakultas">
                      <input className="input" value={form.fakultas} onChange={set("fakultas")} placeholder="STEI" />
                    </Field>
                  </div>
                </>
              )}
              <Field label="Password">
                <input className="input" type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 karakter" />
              </Field>

              {error && <p className="msg-error">{error}</p>}

              <button className="btn-primary btn-full" onClick={submitStep1} disabled={busy}>
                {busy ? "Memproses…" : role === "student" ? "Lanjut → Foto Wajah" : "Daftar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="display mt-4 text-2xl">Foto Wajah</h1>
            <p className="mb-5 mt-1 text-[0.9rem] text-muted">
              Ambil foto wajahmu langsung dari kamera. Pastikan pencahayaan cukup. Tidak ada
              opsi unggah file.
            </p>
            <CameraCapture captureLabel="Ambil & Daftarkan Wajah" onResult={submitFace} disabled={busy} />
            {error && <p className="msg-error mt-4">{error}</p>}
            {success && <p className="msg-success mt-4">{success}</p>}
          </>
        )}
      </div>
    </div>
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
