"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, AuthUser } from "@/lib/auth";

/** App header with logo + user chip (used on dashboard/student). */
export function AppHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="display gradient-text text-xl">SIHADIR</div>
      {user && (
        <button
          className="rounded-pill border border-border bg-surface px-4 py-1.5 text-[0.82rem] text-muted transition-colors hover:border-error hover:text-error"
          onClick={() => {
            logout();
            router.push("/");
          }}
        >
          {user.name} · Keluar
        </button>
      )}
    </header>
  );
}

/** Logo wordmark. */
export function Logo({ className = "" }: { className?: string }) {
  return <span className={`display gradient-text ${className}`}>SIHADIR</span>;
}

/** Inline loading state: spinner + optional label. */
export function Loading({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
      <span className="text-[0.9rem]">{label}</span>
    </div>
  );
}
