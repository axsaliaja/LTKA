# Prompt untuk Claude Code (Opus 4.8 high)

> Cara pakai: taruh file `DESIGN.md` dan `RANCANGAN.md` di folder proyek, buka di Claude Code, lalu paste seluruh blok di bawah sebagai prompt pertama.

---

Kamu adalah senior full-stack & cloud engineer. Baca file `DESIGN.md` dan `RANCANGAN.md` di folder ini terlebih dahulu, lalu bangun **sistem absensi kuliah berbasis face recognition** secara lengkap dan siap-deploy. Patuhi SEMUA batasan & spesifikasi di bawah. Buat kode produksi yang rapi, ber-TypeScript, dengan README yang jelas.

## Konteks & Batasan (WAJIB)

Cloud: **AWS Academy Cloud Foundations – Sandbox**. Konsekuensi:
- **Semua resource AWS dihapus saat sesi berakhir (tiap ~4 jam).** Maka WAJIB sediakan **CloudFormation template + EC2 user-data bootstrap** agar seluruh infrastruktur bisa dibangun ulang dengan satu perintah, plus **seed otomatis** untuk mengisi ulang data.
- Region **us-east-1** saja.
- **DynamoDB dan API Gateway TIDAK boleh dipakai** (di luar layanan yang diizinkan). Database = **Amazon RDS for MySQL**; API = **Node.js + Express di EC2**.
- **Amazon Rekognition TIDAK tersedia** → pengenalan wajah berjalan **di browser** dengan `face-api.js`. Backend hanya menyimpan & membandingkan descriptor (array 128 angka) via jarak Euclidean.
- IAM read-only: **jangan buat role/user IAM baru**. EC2 pakai instance profile **`LabInstanceProfile`** yang sudah ada; CloudFormation mereferensikan `LabRole`/`LabInstanceProfile`, tidak mendefinisikan IAM baru.
- EC2 hanya tipe `t2/t3 .nano–.medium`, key pair `vockey`, EBS gp2 ≤35 GB. Pakai **`t3.small`**.
- RDS: MySQL, instance burstable nano–medium (pakai **`db.t3.micro`**), Single-AZ, gp2 ≤100 GB, **enhanced monitoring off**.
- **Geofencing TIDAK dipakai** (dihapus dari scope).

## Desain Visual (WAJIB ikuti `DESIGN.md`)
Terapkan design system Cal.com dari `DESIGN.md`: canvas putih `#ffffff`, teks/CTA primer hitam `#111111`, kartu konten abu `#f5f5f5` (radius 12px), tombol radius 8px (Inter 600), input tinggi 40px, footer gelap `#101010`, font **Inter** sebagai pengganti Cal Sans (weight 600 + letter-spacing negatif untuk heading). Gunakan token warna/spacing/radius dari DESIGN.md, jangan inline hex sembarangan.

## Tujuan Produk
Web self check-in absensi dari HP mahasiswa dengan anti-titip-absen:
1. **Input wajah hanya dari kamera live** (`getUserMedia`) — TIDAK ADA opsi/elemen upload file.
2. **Liveness detection**: tantangan acak "kedipkan mata 2×" dihitung dari Eye Aspect Ratio (EAR) landmark mata face-api.js; capture frame hanya setelah kedip terdeteksi.

## Tech Stack
- Frontend: **Next.js (App Router) + TypeScript + Tailwind CSS** (styling per DESIGN.md), **face-api.js**, **Recharts**. Bobot model face-api.js di `public/models/` (sertakan instruksi unduh di README).
- Backend: **Node.js + Express (TypeScript)** di EC2, di-reverse-proxy **Caddy** untuk HTTPS otomatis.
- Database: **RDS MySQL** (`mysql2` atau Prisma). Auth **JWT** + **bcrypt**.
- Object storage: **S3** (AWS SDK v3), foto enrollment privat via presigned URL.
- IaC: **CloudFormation** (`infra/template.yaml`) + `infra/bootstrap.sh` (user-data).

## Masalah HTTPS (tangani eksplisit)
Vercel HTTPS + `getUserMedia` butuh HTTPS, tapi EC2 publik default HTTP (mixed content diblokir). Solusi: bootstrap memasang **Caddy** yang melayani HTTPS otomatis (Let's Encrypt) memakai hostname **`<public-ip>.nip.io`**, mem-proxy ke Express di port lokal. README harus menjelaskan ini dan bahwa `NEXT_PUBLIC_API_URL` = `https://<ip>.nip.io`.

## Skema Database (RDS MySQL)
Tabel `students(id PK=NIM, name, email UNIQUE, password_hash, role ENUM[student,lecturer], face_descriptor JSON[128 float], photo_s3_key, created_at)`; `class_sessions(id PK UUID, course_name, lecturer_id FK, start_time, end_time, late_threshold_minutes, is_open, created_at)`; `attendance(id PK auto, session_id FK, student_id FK, checkin_time, status ENUM[present,late], match_distance, liveness_passed, UNIQUE(session_id,student_id))`. Sertakan file migrasi + `seed/seed.sql`.

## Endpoint API (Express)
`POST /auth/register` (akun + descriptor + upload foto S3), `POST /auth/login` (→JWT), `GET /sessions`, `POST /sessions` (dosen), `PATCH /sessions/:id/close`, `POST /attendance/checkin`, `GET /attendance/session/:sessionId`, `GET /attendance/student/:studentId`, `GET /analytics/session/:sessionId`.

**Logika `/attendance/checkin` (otoritatif di server):** validasi JWT → cek sesi `is_open` & dalam rentang waktu → tolak bila `liveness_passed!==true` → hitung Euclidean distance descriptor masuk vs `students.face_descriptor`, tolak bila > threshold (env `MATCH_THRESHOLD` default 0.5) → status "late" bila now > start+late_threshold else "present" → INSERT (UNIQUE cegah duplikat). Jangan percaya klien; validasi ulang di server.

## Halaman Frontend
`/register` (form + kamera live capture descriptor, tanpa upload), `/login`, `/checkin` (pilih sesi → kamera live → tantangan liveness kedip → capture → submit → hasil Hadir/Telat/Ditolak+alasan), `/dashboard` dosen (buat/tutup sesi, tabel hadir real-time, grafik Recharts, export CSV). Komponen kamera: `getUserMedia` + `<video>` + loop face-api.js (`detectSingleFace().withFaceLandmarks().withFaceDescriptor()`) + util EAR untuk kedip + util `euclideanDistance`. JANGAN ada `<input type=file>` di flow wajah.

## Struktur Proyek
```
/frontend            # Next.js (Vercel) — styling per DESIGN.md
  /app  /register /login /checkin /dashboard
  /lib               # faceapi, api client, ear/liveness
  /public/models     # bobot face-api.js (+ instruksi unduh)
  .env.example       # NEXT_PUBLIC_API_URL=
/backend             # Express + TS
  /src/routes  /src/lib (db, jwt, s3, euclidean)  /src/migrations
  /seed/seed.sql
  .env.example       # DB_HOST, DB_USER, DB_PASS, JWT_SECRET, S3_BUCKET, MATCH_THRESHOLD
/infra
  template.yaml      # CloudFormation: SG, S3, RDS MySQL, EC2(LabInstanceProfile)
  bootstrap.sh       # user-data: install Node+Caddy, git clone, npm i, migrate+seed, start, Caddy nip.io
README.md            # langkah rebuild tiap sesi + Vercel + unduh model + isi manual
```

## Acceptance Criteria
- `npm run dev` di `/frontend` jalan; alur register → login → checkin → dashboard berfungsi terhadap API.
- `aws cloudformation deploy ...` membangun seluruh stack di sandbox memakai `LabInstanceProfile` tanpa membuat IAM baru; EC2 otomatis bootstrap (Node, Caddy HTTPS via nip.io, clone repo, migrate+seed, start API).
- Tidak ada elemen upload file pada flow wajah; hanya kamera live + liveness.
- Liveness & match divalidasi ulang di server.
- UI mengikuti DESIGN.md.
- README berisi langkah rebuild per sesi (CloudFormation), update `NEXT_PUBLIC_API_URL` di Vercel tiap IP berubah, cara unduh bobot model face-api.js, dan daftar bagian yang harus diisi manual (password DB, RepoUrl, dll).

## Cara kerja yang kuminta
1. Baca DESIGN.md + RANCANGAN.md, ringkas rencana & struktur folder.
2. Generate kode lengkap file per file (frontend, backend, infra, seed, README).
3. Sertakan `.env.example` di kedua sisi & dokumentasikan tiap env var.
4. Tandai jelas bagian yang harus diisi manual (kredensial, RepoUrl, IP/URL).

Bangun sekarang.
