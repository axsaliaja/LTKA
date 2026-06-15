"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, AuthUser } from "@/lib/auth";

/** Top navigation bar (DESIGN.md `top-nav`). */
export function NavBar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <header className="sticky top-0 z-10 h-16 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-full max-w-content items-center justify-between px-lg">
        <Link href="/" className="text-title-md font-semibold tracking-[-0.3px] text-ink">
          Absensi<span className="text-brand-accent">.face</span>
        </Link>
        <nav className="flex items-center gap-sm text-body-sm">
          {user ? (
            <>
              {user.role === "lecturer" && (
                <Link href="/dashboard" className="px-sm text-muted hover:text-ink">
                  Dashboard
                </Link>
              )}
              <Link href="/checkin" className="px-sm text-muted hover:text-ink">
                Check-in
              </Link>
              <span className="hidden px-sm text-muted-soft sm:inline">{user.name}</span>
              <button
                className="btn-secondary"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="px-sm font-semibold text-ink">
                Masuk
              </Link>
              <Link href="/register" className="btn-primary">
                Daftar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Dark footer that closes every page (DESIGN.md `footer`). */
export function Footer() {
  return (
    <footer className="mt-section bg-surface-dark px-lg py-16 text-on-dark-soft">
      <div className="mx-auto max-w-content">
        <div className="text-title-md font-semibold text-on-dark">Absensi.face</div>
        <p className="mt-sm max-w-md text-body-sm">
          Absensi kuliah berbasis pengenalan wajah dengan liveness detection.
          Proyek UAS LTKA 2026 · AWS Academy Cloud Foundations.
        </p>
        <p className="mt-lg text-caption text-on-dark-soft">
          EC2 · RDS MySQL · S3 · CloudFormation · face-api.js
        </p>
      </div>
    </footer>
  );
}

/** Centered content container. */
export function Container({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-content px-lg py-xxl">{children}</main>;
}
