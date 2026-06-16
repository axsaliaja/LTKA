"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, Loading } from "@/components/Chrome";
import CameraCapture, { CaptureResult } from "@/components/CameraCapture";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface ClassItem {
  id: number;
  name: string;
  mata_kuliah: string;
  kode_kelas: string;
  lecturer_name?: string;
}
interface SessionItem {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
}
interface HistoryRow {
  id: number;
  session_name: string;
  class_name: string;
  mata_kuliah: string;
  checkin_time: string;
  match_distance: string | null;
}

const REASONS: Record<string, string> = {
  no_match: "Wajah tidak cocok dengan identitas terdaftar.",
  closed: "Sesi sudah ditutup.",
  duplicate: "Kamu sudah absen di sesi ini.",
  not_member: "Kamu tidak terdaftar di kelas ini.",
  not_enrolled: "Wajah belum di-enroll.",
  session: "Sesi tidak ditemukan.",
};

type Tab = "attend" | "classes" | "riwayat" | "join";

export default function StudentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("attend");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) return router.replace("/");
    if (u.role !== "student") return router.replace("/dashboard");
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      setClasses(await api.get<ClassItem[]>("/classes/mine"));
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat kelas.");
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      setHistory(await api.get<HistoryRow[]>("/attendance/mine"));
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat riwayat.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const openClass = async (c: ClassItem) => {
    setSelectedClass(c);
    setActiveSession(null);
    setResult("");
    setError("");
    try {
      setSessions(await api.get<SessionItem[]>(`/sessions/class/${c.id}`));
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat sesi.");
    }
  };

  const onCapture = useCallback(
    async (r: CaptureResult) => {
      if (!activeSession) return;
      setBusy(true);
      setError("");
      try {
        await api.post("/attendance/checkin", {
          session_id: activeSession.id,
          descriptor: r.descriptor,
          photo: r.photo,
        });
        setResult(`Absensi berhasil untuk ${activeSession.name} ✓`);
        setActiveSession(null);
      } catch (e: any) {
        const msg = e?.reason ? REASONS[e.reason] ?? e.error : e?.error;
        setError(msg ?? "Absensi ditolak.");
      } finally {
        setBusy(false);
      }
    },
    [activeSession]
  );

  const joinClass = async () => {
    setJoinMsg(null);
    if (!joinCode.trim()) return setJoinMsg({ text: "Masukkan kode kelas", ok: false });
    try {
      const res = await api.post<{ message: string }>("/classes/join", {
        kode_kelas: joinCode.trim().toUpperCase(),
      });
      setJoinMsg({ text: res.message, ok: true });
      setJoinCode("");
      loadClasses();
    } catch (e: any) {
      setJoinMsg({ text: e?.error ?? "Gagal join", ok: false });
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "attend", label: "Absensi" },
    { id: "classes", label: "Kelas Saya" },
    { id: "riwayat", label: "Riwayat" },
    { id: "join", label: "Join Kelas" },
  ];

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-8 flex gap-1 rounded-md border border-border bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setSelectedClass(null);
                setActiveSession(null);
                setResult("");
                setError("");
                if (t.id === "riwayat") loadHistory();
              }}
              className={`flex-1 rounded-sm py-2 text-[0.88rem] font-medium transition-colors ${
                tab === t.id ? "bg-bg text-text shadow-[0_0_0_1px_#222230]" : "text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ABSENSI */}
        {tab === "attend" && (
          <div className="space-y-4">
            {result && <p className="msg-success">{result}</p>}
            {error && <p className="msg-error">{error}</p>}

            {activeSession ? (
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{activeSession.name}</p>
                    <p className="text-[0.82rem] text-muted">{selectedClass?.mata_kuliah}</p>
                  </div>
                  <button className="text-[0.85rem] font-medium text-accent" onClick={() => setActiveSession(null)}>
                    Batal
                  </button>
                </div>
                <CameraCapture captureLabel="Ambil Foto & Absen" onResult={onCapture} disabled={busy} />
                {busy && <p className="mt-3 text-center text-[0.85rem] text-muted">Memverifikasi…</p>}
              </div>
            ) : selectedClass ? (
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-medium">{selectedClass.name}</p>
                  <button className="text-[0.85rem] font-medium text-accent" onClick={() => setSelectedClass(null)}>
                    ← Kelas lain
                  </button>
                </div>
                {sessions.filter((s) => s.is_active).length === 0 ? (
                  <p className="py-6 text-center text-[0.9rem] text-muted">Tidak ada sesi aktif.</p>
                ) : (
                  <div className="space-y-2">
                    {sessions
                      .filter((s) => s.is_active)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setActiveSession(s)}
                          className="flex w-full items-center justify-between rounded-md border border-border p-4 text-left transition-colors hover:border-accent"
                        >
                          <span>{s.name}</span>
                          <span className="text-[0.8rem] text-success">● Aktif</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ) : loadingClasses ? (
              <Loading label="Memuat kelas…" />
            ) : classes.length === 0 ? (
              <div className="card text-center text-[0.9rem] text-muted">
                Belum join kelas. Buka tab <b className="text-text">Join Kelas</b>.
              </div>
            ) : (
              <div className="space-y-2">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openClass(c)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
                  >
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-[0.82rem] text-muted">
                        {c.mata_kuliah}
                        {c.lecturer_name ? ` · ${c.lecturer_name}` : ""}
                      </p>
                    </div>
                    <span className="kode-badge">{c.kode_kelas}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KELAS SAYA */}
        {tab === "classes" && (
          <div className="space-y-2">
            {loadingClasses ? (
              <Loading label="Memuat kelas…" />
            ) : classes.length === 0 ? (
              <div className="card text-center text-[0.9rem] text-muted">Belum ada kelas.</div>
            ) : (
              classes.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[0.82rem] text-muted">
                      {c.mata_kuliah}
                      {c.lecturer_name ? ` · ${c.lecturer_name}` : ""}
                    </p>
                  </div>
                  <span className="kode-badge">{c.kode_kelas}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* RIWAYAT ABSENSI */}
        {tab === "riwayat" && (
          <div className="space-y-2">
            {loadingHistory ? (
              <Loading label="Memuat riwayat…" />
            ) : history.length === 0 ? (
              <div className="card text-center text-[0.9rem] text-muted">Belum ada riwayat absensi.</div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                  <div>
                    <p className="font-medium">{h.class_name}</p>
                    <p className="text-[0.82rem] text-muted">
                      {h.mata_kuliah} · {h.session_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-pill bg-success/15 px-2 py-0.5 text-[0.75rem] text-success">Hadir</span>
                    <p className="mt-1 text-[0.78rem] text-muted">
                      {new Date(h.checkin_time.replace(" ", "T") + "Z").toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* JOIN KELAS */}
        {tab === "join" && (
          <div className="card">
            <h3 className="display mb-4 text-lg">Masukkan Kode Kelas</h3>
            <label className="label">Kode Kelas</label>
            <input
              className="input tracking-widest"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="DEMO01"
              maxLength={8}
            />
            {joinMsg && <p className={`mt-3 ${joinMsg.ok ? "msg-success" : "msg-error"}`}>{joinMsg.text}</p>}
            <button className="btn-primary mt-4" onClick={joinClass}>
              Join Kelas
            </button>
          </div>
        )}
      </main>
    </>
  );
}
