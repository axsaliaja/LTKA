import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIHADIR — Smart Attendance System",
  description:
    "Sistem absensi cerdas berbasis pengenalan wajah. Akurat, real-time, dan bebas titip absen.",
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
