import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Absensi.face — Absensi Wajah",
  description:
    "Self check-in absensi kuliah berbasis face recognition + liveness detection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
