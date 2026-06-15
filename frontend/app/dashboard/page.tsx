"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { NavBar, Footer, Container } from "@/components/Chrome";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface Session {
  id: string;
  course_name: string;
  start_time: string;
  end_time: string;
  late_threshold_minutes: number;
  is_open: number | boolean;
}

interface AttendanceRow {
  id: number;
  student_id: string;
  student_name: string;
  checkin_time: string;
  status: "present" | "late";
  match_distance: number;
}

interface Analytics {
  course_name: string;
  total_students: number;
  present: number;
  late: number;
  absent: number;
  percentages: { present: number; late: number; absent: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [roster, setRoster] = useState<AttendanceRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  // New-session form.
  const [form, setForm] = useState({
    course_name: "",
    start_time: "",
    end_time: "",
    late_threshold_minutes: 15,
  });

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    if (u.role !== "lecturer") {
      router.replace("/checkin");
      return;
    }
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessions = async () => {
    try {
      const s = await api.get<Session[]>("/sessions?all=1");
      setSessions(s);
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat sesi.");
    }
  };

  const loadDetail = useCallback(async (session: Session) => {
    try {
      const [r, a] = await Promise.all([
        api.get<AttendanceRow[]>(`/attendance/session/${session.id}`),
        api.get<Analytics>(`/analytics/session/${session.id}`),
      ]);
      setRoster(r);
      setAnalytics(a);
    } catch (e: any) {
      setError(e?.error ?? "Gagal memuat detail.");
    }
  }, []);

  // Real-time refresh of the selected session's roster.
  useEffect(() => {
    if (!selected) return;
    loadDetail(selected);
    const t = setInterval(() => loadDetail(selected), 5000);
    return () => clearInterval(t);
  }, [selected, loadDetail]);

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      // datetime-local has no timezone; send as ISO so the server parses it.
      await api.post("/sessions", {
        course_name: form.course_name,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        late_threshold_minutes: Number(form.late_threshold_minutes),
      });
      setForm({ course_name: "", start_time: "", end_time: "", late_threshold_minutes: 15 });
      loadSessions();
    } catch (e: any) {
      setError(e?.error ?? "Gagal membuat sesi.");
    }
  };

  const closeSession = async (id: string) => {
    await api.patch(`/sessions/${id}/close`);
    loadSessions();
    if (selected?.id === id) setSelected({ ...selected, is_open: 0 });
  };

  const exportCsv = () => {
    if (!selected) return;
    const header = "student_id,student_name,status,checkin_time,match_distance\n";
    const rows = roster
      .map(
        (r) =>
          `${r.student_id},"${r.student_name}",${r.status},${r.checkin_time},${r.match_distance}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `absensi_${selected.course_name}_${selected.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = analytics
    ? [
        { name: "Hadir", value: analytics.present, color: "#10b981" },
        { name: "Telat", value: analytics.late, color: "#f59e0b" },
        { name: "Absen", value: analytics.absent, color: "#ef4444" },
      ]
    : [];

  return (
    <>
      <NavBar />
      <Container>
        <h1 className="display-md">Dashboard Dosen</h1>
        {error && <p className="mt-sm text-body-sm text-error">{error}</p>}

        <div className="mt-xl grid gap-xl lg:grid-cols-3">
          {/* Create session */}
          <form onSubmit={createSession} className="card space-y-md lg:col-span-1">
            <h2 className="text-title-md text-ink">Buat Sesi</h2>
            <div>
              <label className="label">Mata kuliah</label>
              <input
                className="input"
                value={form.course_name}
                onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Mulai</label>
              <input
                className="input"
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Selesai</label>
              <input
                className="input"
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Ambang telat (menit)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={form.late_threshold_minutes}
                onChange={(e) =>
                  setForm({ ...form, late_threshold_minutes: Number(e.target.value) })
                }
              />
            </div>
            <button className="btn-primary w-full">Buat Sesi</button>
          </form>

          {/* Session list */}
          <div className="lg:col-span-2">
            <h2 className="mb-md text-title-md text-ink">Sesi</h2>
            <div className="space-y-sm">
              {sessions.length === 0 && (
                <p className="text-body-md text-muted">Belum ada sesi.</p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`card-outline flex items-center justify-between ${
                    selected?.id === s.id ? "border-ink" : ""
                  }`}
                >
                  <button className="text-left" onClick={() => setSelected(s)}>
                    <p className="text-title-sm text-ink">{s.course_name}</p>
                    <p className="text-body-sm text-muted">
                      {new Date(s.start_time.replace(" ", "T") + "Z").toLocaleString("id-ID")}
                    </p>
                  </button>
                  <div className="flex items-center gap-sm">
                    <span
                      className={`rounded-pill px-sm py-xxs text-caption ${
                        s.is_open ? "bg-success/15 text-success" : "bg-surface-card text-muted"
                      }`}
                    >
                      {s.is_open ? "Terbuka" : "Ditutup"}
                    </span>
                    {!!s.is_open && (
                      <button
                        className="text-body-sm font-semibold text-error"
                        onClick={() => closeSession(s.id)}
                      >
                        Tutup
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail: analytics + roster */}
        {selected && analytics && (
          <section className="mt-section">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <h2 className="text-display-sm font-display text-ink">{analytics.course_name}</h2>
              <button className="btn-secondary" onClick={exportCsv}>
                Export CSV
              </button>
            </div>

            <div className="mt-lg grid gap-lg md:grid-cols-2">
              {/* Stat cards + chart */}
              <div className="card-outline">
                <div className="grid grid-cols-3 gap-sm text-center">
                  <Stat label="Hadir" value={analytics.present} pct={analytics.percentages.present} />
                  <Stat label="Telat" value={analytics.late} pct={analytics.percentages.late} />
                  <Stat label="Absen" value={analytics.absent} pct={analytics.percentages.absent} />
                </div>
                <div className="mt-lg h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                      <Tooltip cursor={{ fill: "#f5f5f5" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Roster */}
              <div className="card-outline">
                <div className="mb-sm flex items-center justify-between">
                  <h3 className="text-title-sm text-ink">Daftar Hadir</h3>
                  <span className="text-caption text-muted-soft">Auto-refresh 5s</span>
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-body-sm">
                    <thead>
                      <tr className="border-b border-hairline text-left text-muted">
                        <th className="py-xs font-medium">Nama</th>
                        <th className="py-xs font-medium">Jam</th>
                        <th className="py-xs font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-md text-center text-muted">
                            Belum ada yang check-in.
                          </td>
                        </tr>
                      )}
                      {roster.map((r) => (
                        <tr key={r.id} className="border-b border-hairline-soft">
                          <td className="py-xs text-ink">{r.student_name}</td>
                          <td className="py-xs text-muted">
                            {new Date(r.checkin_time.replace(" ", "T") + "Z").toLocaleTimeString(
                              "id-ID"
                            )}
                          </td>
                          <td className="py-xs">
                            <span
                              className={`rounded-pill px-sm py-xxs text-caption ${
                                r.status === "present"
                                  ? "bg-success/15 text-success"
                                  : "bg-warning/15 text-warning"
                              }`}
                            >
                              {r.status === "present" ? "Hadir" : "Telat"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}
      </Container>
      <Footer />
    </>
  );
}

function Stat({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <p className="text-display-sm font-display text-ink">{value}</p>
      <p className="text-body-sm text-muted">{label}</p>
      <p className="text-caption text-muted-soft">{pct}%</p>
    </div>
  );
}
