import Link from "next/link";
import { NavBar, Footer, Container } from "@/components/Chrome";

export default function HomePage() {
  return (
    <>
      <NavBar />
      <Container>
        {/* Hero band */}
        <section className="grid items-center gap-xl py-section md:grid-cols-12">
          <div className="md:col-span-7">
            <span className="inline-block rounded-pill bg-surface-card px-sm py-xxs text-caption text-ink">
              Anti titip-absen
            </span>
            <h1 className="display-xl mt-md">
              Absen kuliah cukup<br />dengan wajahmu.
            </h1>
            <p className="mt-lg max-w-md text-body-md text-body">
              Self check-in dari HP dalam hitungan detik. Pengenalan wajah
              berjalan di browser, dilindungi liveness detection (tantangan
              kedip) — foto statis & titip absen tidak akan lolos.
            </p>
            <div className="mt-xl flex flex-wrap gap-sm">
              <Link href="/register" className="btn-primary">
                Daftar & Enroll Wajah
              </Link>
              <Link href="/checkin" className="btn-secondary">
                Mulai Check-in
              </Link>
            </div>
          </div>

          {/* Product fragment card */}
          <div className="md:col-span-5">
            <div className="rounded-xl border border-hairline bg-canvas p-lg shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-title-sm text-ink">Check-in</span>
                <span className="rounded-pill bg-badge-emerald/20 px-sm py-xxs text-caption text-ink">
                  Live
                </span>
              </div>
              <div className="mt-md flex h-44 items-center justify-center rounded-lg bg-surface-card text-body-sm text-muted">
                Kamera live · deteksi kedip
              </div>
              <div className="mt-md space-y-xs text-body-sm">
                <Row label="Liveness" value="Lolos ✓" />
                <Row label="Match distance" value="0.34 < 0.5" />
                <Row label="Status" value="Hadir" />
              </div>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-lg py-section md:grid-cols-3">
          <Feature
            title="Kamera live only"
            body="Input wajah hanya dari getUserMedia. Tidak ada opsi upload file di seluruh alur wajah."
          />
          <Feature
            title="Liveness detection"
            body="Tantangan kedip acak dihitung dari Eye Aspect Ratio landmark mata — capture hanya setelah kedip terdeteksi."
          />
          <Feature
            title="Validasi di server"
            body="Liveness & jarak Euclidean descriptor diverifikasi ulang di backend. Klien tidak dipercaya."
          />
        </section>
      </Container>
      <Footer />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline-soft pb-xxs">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <h3 className="text-title-md text-ink">{title}</h3>
      <p className="mt-sm text-body-md text-body">{body}</p>
    </div>
  );
}
