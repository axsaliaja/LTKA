"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar, Footer, Container } from "@/components/Chrome";
import CameraCapture, { CaptureResult } from "@/components/CameraCapture";
import { api } from "@/lib/api";
import { isAuthed } from "@/lib/auth";

interface Session {
  id: string;
  course_name: string;
  lecturer_name: string;
  start_time: string;
  end_time: string;
  late_threshold_minutes: number;
}

interface CheckinResult {
  status: "present" | "late";
  distance: number;
  threshold: number;
  checkin_time: string;
}

const REASONS: Record<string, string> = {
  liveness: "Liveness gagal — wajah hidup tidak terdeteksi.",
  no_match: "Wajah tidak cocok dengan identitas terdaftar.",
  time_window: "Di luar rentang waktu sesi.",
  closed: "Sesi sudah ditutup.",
  duplicate: "Kamu sudah check-in untuk sesi ini.",
  not_enrolled: "Wajah belum di-enroll. Silakan daftar dahulu.",
  session: "Sesi tidak ditemukan.",
};

export default function CheckinPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthed()) {
      router.replace("/login");
      return;
    }
    api
      .get<Session[]>("/sessions")
      .then(setSessions)
      .catch((e) => setError(e?.error ?? "Gagal memuat sesi."))
      .finally(() => setLoading(false));
  }, [router]);

  const onCapture = async (r: CaptureResult) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post<CheckinResult>("/attendance/checkin", {
        session_id: selected.id,
        descriptor: r.descriptor,
        liveness_passed: r.livenessPassed,
      });
      setResult(res);
    } catch (e: any) {
      const reason = e?.reason ? REASONS[e.reason] ?? e.error : e?.error;
      setError(reason ?? "Check-in ditolak.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSelected(null);
    setResult(null);
    setError("");
  };

  return (
    <>
      <NavBar />
      <Container>
        <h1 className="display-md">Check-in Absensi</h1>

        {/* Result screen */}
        {result ? (
          <div className="mx-auto mt-xl max-w-md card text-center">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-pill text-2xl ${
                result.status === "present"
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              }`}
            >
              ✓
            </div>
            <h2 className="mt-md text-display-sm font-display text-ink">
              {result.status === "present" ? "Hadir" : "Telat"}
            </h2>
            <p className="mt-sm text-body-sm text-muted">
              Match distance {result.distance} (threshold {result.threshold})
            </p>
            <p className="text-body-sm text-muted">
              {new Date(result.checkin_time).toLocaleString("id-ID")}
            </p>
            <button className="btn-secondary mt-lg" onClick={reset}>
              Check-in Lagi
            </button>
          </div>
        ) : selected ? (
          /* Camera + liveness */
          <div className="mx-auto mt-xl max-w-md">
            <div className="card-outline">
              <div className="mb-md flex items-center justify-between">
                <div>
                  <p className="text-title-md text-ink">{selected.course_name}</p>
                  <p className="text-body-sm text-muted">{selected.lecturer_name}</p>
                </div>
                <button className="text-body-sm font-semibold text-ink" onClick={reset}>
                  Ganti
                </button>
              </div>
              <CameraCapture requiredBlinks={2} onResult={onCapture} disabled={busy} />
              {busy && <p className="mt-md text-center text-body-sm text-muted">Memverifikasi…</p>}
              {error && (
                <div className="mt-md rounded-md bg-error/10 p-sm text-center text-body-sm text-error">
                  Ditolak: {error}
                  <button className="ml-sm font-semibold underline" onClick={reset}>
                    Coba lagi
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Session picker */
          <div className="mt-xl">
            {loading ? (
              <p className="text-body-md text-muted">Memuat sesi…</p>
            ) : error ? (
              <p className="text-body-md text-error">{error}</p>
            ) : sessions.length === 0 ? (
              <div className="card">
                <p className="text-body-md text-body">Belum ada sesi terbuka saat ini.</p>
              </div>
            ) : (
              <div className="grid gap-md md:grid-cols-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="card-outline text-left hover:border-ink"
                  >
                    <p className="text-title-md text-ink">{s.course_name}</p>
                    <p className="mt-xxs text-body-sm text-muted">Dosen: {s.lecturer_name}</p>
                    <p className="mt-xs text-body-sm text-muted">
                      {new Date(s.start_time.replace(" ", "T") + "Z").toLocaleString("id-ID")} —{" "}
                      {new Date(s.end_time.replace(" ", "T") + "Z").toLocaleTimeString("id-ID")}
                    </p>
                    <span className="mt-sm inline-block rounded-pill bg-surface-card px-sm py-xxs text-caption text-ink">
                      Telat &gt; {s.late_threshold_minutes} mnt
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Container>
      <Footer />
    </>
  );
}
