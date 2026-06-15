"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/Chrome";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface ClassItem {
  id: number;
  name: string;
  mata_kuliah: string;
  kode_kelas: string;
  member_count?: number;
}
interface SessionItem {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
  closed_at: string | null;
}
interface RecapRow {
  id: number;
  name: string;
  student_id: string | null;
  checkin_time: string;
  match_distance: string | null;
  photo_url: string | null;
}

type View = "classes" | "create" | "detail" | "recap";

export default function DashboardPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("classes");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [currentClass, setCurrentClass] = useState<ClassItem | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [recapSession, setRecapSession] = useState<SessionItem | null>(null);
  const [recap, setRecap] = useState<RecapRow[]>([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ name: "", mata_kuliah: "" });
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) return router.replace("/");
    if (u.role !== "lecturer") return router.replace("/student");
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadClasses = async () => {
    try {
      setClasses(await api.get<ClassItem[]>("/classes/mine"));
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat kelas.");
    }
  };

  const createClass = async () => {
    setCreateMsg(null);
    if (!form.name || !form.mata_kuliah) return setCreateMsg({ text: "Semua field wajib diisi", ok: false });
    try {
      const res = await api.post<{ kode_kelas: string }>("/classes", form);
      setCreateMsg({ text: `Kelas dibuat! Kode: ${res.kode_kelas}`, ok: true });
      setForm({ name: "", mata_kuliah: "" });
      loadClasses();
    } catch (e: any) {
      setCreateMsg({ text: e?.error ?? "Gagal membuat kelas", ok: false });
    }
  };

  const openClass = async (c: ClassItem) => {
    setCurrentClass(c);
    setView("detail");
    await loadSessions(c.id);
  };

  const loadSessions = async (classId: number) => {
    try {
      setSessions(await api.get<SessionItem[]>(`/sessions/class/${classId}`));
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat sesi.");
    }
  };

  const openSession = async () => {
    if (!currentClass) return;
    const name = prompt("Nama sesi (mis. Pertemuan 1):");
    if (!name) return;
    await api.post("/sessions", { class_id: currentClass.id, name });
    loadSessions(currentClass.id);
  };

  const closeSession = async (id: number) => {
    if (!confirm("Tutup sesi ini?")) return;
    await api.patch(`/sessions/${id}/close`);
    if (currentClass) loadSessions(currentClass.id);
  };

  const viewRecap = useCallback(async (s: SessionItem) => {
    setRecapSession(s);
    setView("recap");
    try {
      setRecap(await api.get<RecapRow[]>(`/attendance/session/${s.id}`));
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat rekap.");
    }
  }, []);

  // Auto-refresh recap every 5s while viewing it.
  useEffect(() => {
    if (view !== "recap" || !recapSession) return;
    const t = setInterval(async () => {
      try {
        setRecap(await api.get<RecapRow[]>(`/attendance/session/${recapSession.id}`));
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [view, recapSession]);

  const exportCsv = () => {
    if (!recapSession) return;
    const header = "nama,nim,match_distance,waktu\n";
    const rows = recap
      .map((r) => `"${r.name}",${r.student_id ?? "-"},${r.match_distance ?? "-"},${r.checkin_time}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap_${recapSession.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-content px-6 py-8">
        {error && <p className="msg-error mb-4">{error}</p>}

        {/* CLASSES */}
        {view === "classes" && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h1 className="display text-2xl">Kelas Saya</h1>
              <button className="btn-primary" onClick={() => setView("create")}>
                + Buat Kelas
              </button>
            </div>
            {classes.length === 0 ? (
              <div className="card text-center text-[0.9rem] text-muted">
                Belum ada kelas. Buat kelas pertamamu.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openClass(c)}
                    className="rounded-lg border border-border bg-surface p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent"
                  >
                    <h3 className="display text-base">{c.name}</h3>
                    <p className="mt-1 text-[0.82rem] text-muted">{c.mata_kuliah}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="kode-badge">{c.kode_kelas}</span>
                      <span className="text-[0.78rem] text-muted">{c.member_count ?? 0} mhs</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* CREATE CLASS */}
        {view === "create" && (
          <div className="max-w-md">
            <button className="mb-4 text-[0.85rem] text-muted hover:text-accent" onClick={() => setView("classes")}>
              ← Kelas Saya
            </button>
            <div className="card">
              <h2 className="display mb-4 text-lg">Buat Kelas Baru</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Nama Kelas</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Komputasi Awan 2026" />
                </div>
                <div>
                  <label className="label">Mata Kuliah</label>
                  <input className="input" value={form.mata_kuliah} onChange={(e) => setForm({ ...form, mata_kuliah: e.target.value })} placeholder="ET3204" />
                </div>
                {createMsg && <p className={createMsg.ok ? "msg-success" : "msg-error"}>{createMsg.text}</p>}
                <button className="btn-primary" onClick={createClass}>
                  Buat Kelas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CLASS DETAIL */}
        {view === "detail" && currentClass && (
          <>
            <button className="mb-2 text-[0.85rem] text-muted hover:text-accent" onClick={() => setView("classes")}>
              ← Kelas Saya
            </button>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="display text-2xl">{currentClass.name}</h1>
                <p className="text-[0.85rem] text-muted">
                  {currentClass.mata_kuliah} · Kode <span className="kode-badge">{currentClass.kode_kelas}</span>
                </p>
              </div>
              <button className="btn-primary btn-sm" onClick={openSession}>
                ▶ Buka Sesi Absensi
              </button>
            </div>

            <div className="card overflow-x-auto">
              <h3 className="display mb-4 text-base">Sesi Absensi</h3>
              <table className="w-full text-[0.88rem]">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-2 font-medium">Nama Sesi</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Dibuat</th>
                    <th className="py-2 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted">Belum ada sesi</td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-3">{s.name}</td>
                        <td className="py-3">
                          <span className={s.is_active ? "text-success" : "text-muted"}>
                            {s.is_active ? "● Aktif" : "○ Selesai"}
                          </span>
                        </td>
                        <td className="py-3 text-[0.82rem] text-muted">
                          {new Date(s.created_at.replace(" ", "T") + "Z").toLocaleString("id-ID")}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            {!!s.is_active && (
                              <button className="btn-danger btn-sm" onClick={() => closeSession(s.id)}>
                                Tutup
                              </button>
                            )}
                            <button className="btn-ghost btn-sm" onClick={() => viewRecap(s)}>
                              Rekap
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* RECAP */}
        {view === "recap" && recapSession && (
          <>
            <button className="mb-2 text-[0.85rem] text-muted hover:text-accent" onClick={() => setView("detail")}>
              ← {currentClass?.name}
            </button>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="display text-2xl">Rekap Kehadiran</h1>
                <p className="text-[0.85rem] text-muted">{recapSession.name} · auto-refresh 5s</p>
              </div>
              <button className="btn-ghost btn-sm" onClick={exportCsv}>
                Export CSV
              </button>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-[0.88rem]">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-2 font-medium">Foto</th>
                    <th className="py-2 font-medium">Nama</th>
                    <th className="py-2 font-medium">NIM</th>
                    <th className="py-2 font-medium">Jarak</th>
                    <th className="py-2 font-medium">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted">Belum ada yang absen</td>
                    </tr>
                  ) : (
                    recap.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2">
                          {r.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.photo_url} alt="foto" className="h-12 w-12 rounded-md border border-border object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-surface2 text-[0.65rem] text-muted">
                              No foto
                            </div>
                          )}
                        </td>
                        <td className="py-2">{r.name}</td>
                        <td className="py-2 font-mono text-muted">{r.student_id ?? "-"}</td>
                        <td className="py-2 text-success">{r.match_distance ?? "-"}</td>
                        <td className="py-2 text-[0.82rem] text-muted">
                          {new Date(r.checkin_time.replace(" ", "T") + "Z").toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
