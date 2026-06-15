# Rancangan Sistem Absensi Kuliah berbasis Face Recognition

**Mata kuliah:** LTKA (UAS) 2026 · Tema: Cloud Computing
**Tim:** 3 orang
**Cloud:** AWS Academy **Cloud Foundations – Sandbox** (semua resource dihapus tiap sesi 4 jam)
**Frontend hosting:** Vercel · **Repo:** GitHub

---

## 1. Latar Belakang & Tujuan

Absensi kuliah konvensional (tanda tangan / titip absen) rawan kecurangan. Solusi kami: **web absensi mandiri (self check-in) berbasis pengenalan wajah** dari HP mahasiswa, dengan pengaman **liveness detection** (wajib wajah hidup, bukan foto/upload file).

Tujuan:
- Absen dalam < 10 detik lewat browser, tanpa instalasi aplikasi.
- Cegah titip absen: input wajah hanya dari kamera live + tantangan kedip; tidak ada opsi upload file.
- Dosen punya dashboard real-time + rekap analitik kehadiran yang bisa diekspor.
- **Menonjolkan pemanfaatan cloud AWS**: database dan API berjalan di layanan AWS (RDS + EC2 + S3).

## 2. Batasan AWS Academy Cloud Foundations Sandbox (penentu desain)

Berdasarkan aturan resmi sandbox:

| Aturan sandbox | Dampak ke desain |
|---|---|
| **Semua resource dihapus saat sesi berakhir (0:00)** | Tak ada yang persist. Kita siapkan **CloudFormation + bootstrap script** agar seluruh infrastruktur bisa dibangun ulang dalam satu perintah tiap sesi. Data (akun + wajah) di-seed ulang otomatis dari file di repo. |
| **Region hanya us-east-1** | Semua resource di `us-east-1`. |
| **DynamoDB & API Gateway TIDAK termasuk layanan yang diizinkan** | Tidak dipakai. Database pakai **RDS**; API di-host di **EC2**. |
| **EC2 tersedia** (`t2/t3 .nano–.medium`, maks 9 instance, EBS ≤35 GB gp2, key pair `vockey`) | Backend API (Node/Express) di EC2 `t3.small`. |
| **RDS tersedia** (Aurora/MySQL/PostgreSQL/MariaDB, instance nano–medium, gp2 ≤100 GB, single-AZ, no enhanced monitoring) | Database **MySQL** `db.t3.micro`, Single-AZ, enhanced monitoring **off**. |
| **S3 tersedia** | Simpan foto enrollment (bukti). |
| **IAM read-only**, tak bisa buat role; tersedia **`LabRole`** & **`LabInstanceProfile`** | EC2 pakai `LabInstanceProfile`; CloudFormation mereferensikan role yang sudah ada — tak membuat IAM baru. |
| **CloudFormation tersedia** | Dipakai sebagai Infrastructure-as-Code untuk rebuild cepat. |
| Rekognition **tidak tersedia** | Pengenalan wajah dijalankan **di browser** (face-api.js); backend menyimpan & membandingkan descriptor (array 128 angka). |

> Kunci strategi: karena environment di-reset tiap sesi, nilai utamanya bukan "selalu nyala" tapi **"bisa dibangun ulang cepat & andal"**. Itulah yang kita optimalkan dengan CloudFormation + seed otomatis.

## 3. Arsitektur Sistem

```
┌──────────────────────────────┐
│  Browser HP Mahasiswa         │
│  Next.js (Vercel, HTTPS)      │
│  • Kamera live (getUserMedia) │
│  • face-api.js → descriptor   │
│  • Liveness (deteksi kedip)   │
│  • UI mengikuti DESIGN.md      │
└───────────────┬──────────────┘
                │ HTTPS (JSON)
                ▼
   ┌───────────────────────────────┐
   │  EC2 (t3.small, us-east-1)      │
   │  LabInstanceProfile             │
   │  ┌───────────────────────────┐ │
   │  │ Caddy (auto-TLS via nip.io)│ │  ← sertifikat HTTPS valid tanpa beli domain
   │  └─────────────┬─────────────┘ │
   │                ▼               │
   │  ┌───────────────────────────┐ │
   │  │ Node.js + Express API      │ │
   │  │ • auth (JWT)               │ │
   │  │ • enroll / checkin (match) │ │
   │  │ • sessions / analytics     │ │
   │  └───┬──────────────────┬─────┘ │
   └──────┼──────────────────┼───────┘
          │                  │
          ▼                  ▼
   ┌─────────────┐    ┌──────────────┐
   │ RDS MySQL    │    │  S3 bucket    │
   │ db.t3.micro  │    │ (foto enroll) │
   └─────────────┘    └──────────────┘
```

**Catatan mixed-content (penting):** Vercel = HTTPS, dan `getUserMedia` mewajibkan HTTPS. EC2 publik default-nya HTTP → akan diblokir browser. Solusi: **Caddy** di EC2 melayani HTTPS otomatis dengan hostname `<public-ip>.nip.io` (Let's Encrypt via HTTP-01). Jadi frontend HTTPS bisa memanggil backend HTTPS tanpa beli domain.

**Alur pengenalan wajah:** wajah → **descriptor (128 angka)** dihitung di browser oleh face-api.js. Backend menyimpan descriptor saat enrollment, lalu menghitung **jarak Euclidean** descriptor masuk vs tersimpan saat check-in (jarak kecil = orang sama). Tak ada AI berat di server.

## 4. Tech Stack

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript** | Deploy Vercel via GitHub |
| Styling | **Tailwind CSS, mengikuti `DESIGN.md`** | Gaya Cal.com: canvas putih `#ffffff`, CTA hitam `#111111`, kartu abu `#f5f5f5`, footer gelap `#101010`, font Inter (pengganti Cal Sans, weight 600 + letter-spacing negatif), radius tombol 8px / kartu 12px |
| Pengenalan wajah | **face-api.js** (TensorFlow.js) | Deteksi wajah + descriptor 128-d + landmark untuk liveness |
| API | **Node.js + Express (TypeScript)** di **EC2** | Di-reverse-proxy Caddy (HTTPS) |
| Database | **Amazon RDS for MySQL** `db.t3.micro` | Single-AZ, gp2, enhanced monitoring off |
| Object storage | **Amazon S3** | Foto enrollment (privat, presigned URL) |
| Auth | **JWT** (`jsonwebtoken`) + bcrypt | Cukup untuk demo |
| Charts | **Recharts** | Dashboard analitik |
| IaC | **AWS CloudFormation** + EC2 user-data bootstrap | Rebuild 1 perintah tiap sesi |

## 5. Skema Database (RDS MySQL)

```sql
CREATE TABLE students (
  id            VARCHAR(64) PRIMARY KEY,      -- NIM
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','lecturer') DEFAULT 'student',
  face_descriptor JSON NOT NULL,              -- array 128 float
  photo_s3_key  VARCHAR(512),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE class_sessions (
  id            VARCHAR(64) PRIMARY KEY,       -- UUID
  course_name   VARCHAR(255) NOT NULL,
  lecturer_id   VARCHAR(64) NOT NULL,
  start_time    DATETIME NOT NULL,
  end_time      DATETIME NOT NULL,
  late_threshold_minutes INT DEFAULT 15,
  is_open       BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lecturer_id) REFERENCES students(id)
);

CREATE TABLE attendance (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id    VARCHAR(64) NOT NULL,
  student_id    VARCHAR(64) NOT NULL,
  checkin_time  DATETIME DEFAULT CURRENT_TIMESTAMP,
  status        ENUM('present','late') NOT NULL,
  match_distance DECIMAL(6,4),
  liveness_passed BOOLEAN,
  UNIQUE KEY uniq_session_student (session_id, student_id),  -- cegah double check-in
  FOREIGN KEY (session_id) REFERENCES class_sessions(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);
```

> **Geofencing dihapus** dari skema & flow sesuai permintaan (bisa ditambah belakangan).

## 6. Penyimpanan S3

Bucket privat, key `enroll/{studentId}/{timestamp}.jpg`. Akses via presigned URL dari backend. Foto hanya bukti enrollment/audit — pencocokan tetap pakai descriptor.

## 7. Daftar Endpoint API (Express di EC2)

| Method | Path | Fungsi |
|---|---|---|
| POST | `/auth/register` | Daftar akun + simpan descriptor + upload foto ke S3 |
| POST | `/auth/login` | Login → JWT |
| GET | `/sessions` | List sesi terbuka |
| POST | `/sessions` | (dosen) buat sesi: MK, waktu mulai/selesai, threshold telat |
| PATCH | `/sessions/:id/close` | (dosen) tutup sesi |
| POST | `/attendance/checkin` | Validasi + catat kehadiran |
| GET | `/attendance/session/:sessionId` | (dosen) daftar hadir |
| GET | `/attendance/student/:studentId` | riwayat mahasiswa |
| GET | `/analytics/session/:sessionId` | statistik hadir/telat/absen + persentase |

### Logika `/attendance/checkin` (server-side, otoritatif)
1. Validasi JWT.
2. Ambil sesi; tolak bila `is_open=false` atau di luar `start_time..end_time`.
3. Tolak bila `liveness_passed !== true`.
4. **Match wajah:** hitung jarak Euclidean descriptor masuk vs `students.face_descriptor`; bila > threshold (default 0.5, jadikan env var) → tolak.
5. `status` = "late" bila now > `start_time + late_threshold_minutes`, else "present".
6. INSERT ke `attendance` (UNIQUE cegah duplikat). Kembalikan ringkasan.

## 8. Alur Fitur

### 8.1 Enrollment (sekali per mahasiswa per sesi infrastruktur)
Halaman daftar → isi NIM/nama/email/password → kamera live → tangkap frame + hitung descriptor → kirim ke `/auth/register`. Tanpa input file. (Karena RDS ikut terhapus tiap sesi, descriptor 3 anggota disimpan juga ke **file seed di repo** agar bisa di-restore otomatis — lihat §10.3.)

### 8.2 Check-in dengan Liveness (anti foto)
1. Pilih sesi terbuka.
2. Kamera live menyala (hanya `getUserMedia`, tanpa tombol upload).
3. **Tantangan liveness acak**, mis. "Kedipkan mata 2×": browser hitung *Eye Aspect Ratio* (EAR) dari landmark mata face-api.js (kedip = EAR turun lalu naik).
4. Begitu lolos, capture frame → hitung descriptor.
5. POST ke `/attendance/checkin` → server validasi (liveness flag + match + waktu) → tampilkan "Hadir / Telat / Ditolak + alasan".

Foto statis tak bisa berkedip dan upload file dimatikan → titip absen lewat foto gagal di langkah 3.

### 8.3 Dashboard Analitik (dosen)
Daftar hadir real-time per sesi (nama, jam, status), rekap total hadir/telat/absen + persentase, grafik Recharts, export CSV.

## 9. Keamanan
- HTTPS end-to-end (Vercel + Caddy/Let's Encrypt di EC2).
- JWT untuk endpoint sensitif; password bcrypt.
- S3 privat (presigned URL); RDS di security group yang hanya mengizinkan akses dari EC2.
- Validasi liveness & match diulang di server.
- Secret (DB password, JWT secret) sebagai env var di EC2 (atau SSM Parameter Store).

## 10. Deployment (rebuild cepat tiap sesi)

### 10.1 Sekali di awal
Push seluruh repo (frontend + backend + `infra/template.yaml` + `infra/bootstrap.sh` + `seed/`) ke GitHub. Import frontend ke Vercel.

### 10.2 Tiap mulai sesi sandbox (≈10–12 menit, sebagian besar nunggu RDS)
1. Start Lab → buka terminal/CloudShell (kredensial sudah ter-set). Region `us-east-1`.
2. Jalankan CloudFormation:
   ```bash
   aws cloudformation deploy \
     --template-file infra/template.yaml \
     --stack-name absensi \
     --parameter-overrides DBPassword=*** RepoUrl=https://github.com/<kamu>/<repo> \
     --capabilities CAPABILITY_NAMED_IAM
   ```
   Template membuat: Security Groups, S3 bucket, RDS MySQL, dan EC2 (dengan `LabInstanceProfile`). **EC2 user-data** otomatis: install Node + Caddy, `git clone` repo, `npm install`, jalankan migrasi + seed, start API, start Caddy dengan hostname `<public-ip>.nip.io`.
3. Ambil output stack: **API URL** (`https://<ip>.nip.io`).
4. Update env Vercel `NEXT_PUBLIC_API_URL` = API URL itu, lalu redeploy frontend (IP berubah tiap sesi).

### 10.3 Seed otomatis (atasi data terhapus)
Karena RDS ikut hilang, simpan file `seed/seed.sql` (akun dosen + 3 akun anggota lengkap dengan `face_descriptor` yang sudah di-enroll sebelumnya). Bootstrap menjalankan seed ini → tim langsung bisa check-in tanpa enroll ulang. (Saat demo, bisa juga enroll ulang live untuk menunjukkan fitur.)

### 10.4 Tips menghemat waktu rebuild
- Pertimbangkan **RDS snapshot**: setelah enroll, buat snapshot; rebuild dari snapshot lebih cepat daripada seed manual (catatan: snapshot juga terhapus saat sesi berakhir, jadi seed file di repo tetap jaring pengaman utama).
- Atau jalankan API + MySQL lokal di satu EC2 (MySQL on EC2) untuk demo super cepat — tapi versi RDS lebih kuat untuk poin "pemanfaatan cloud".

## 11. Pembagian Peran Tim (3 orang)

| Anggota | Role | Tanggung jawab |
|---|---|---|
| Anggota 1 | **Frontend & Face/Liveness** | Next.js UI sesuai `DESIGN.md`, integrasi face-api.js, flow kamera + liveness, deploy Vercel |
| Anggota 2 | **Cloud & Backend** | EC2 + Express API, RDS, S3, Caddy/HTTPS, CloudFormation + bootstrap, prosedur rebuild |
| Anggota 3 | **Database, Analitik & Dokumentasi** | Skema & migrasi MySQL, seed, dashboard + Recharts + export CSV, laporan mingguan, PPT, video demo |

## 12. Timeline 6–7 Minggu

| Minggu | Target |
|---|---|
| 1 | Finalisasi rancangan, setup repo + Vercel, scaffolding Next.js (styling DESIGN.md), uji start sandbox |
| 2 | CloudFormation dasar: VPC/SG, EC2, RDS, S3; API "hello" + Caddy HTTPS jalan |
| 3 | Auth (register/login + JWT) + skema MySQL + S3 upload |
| 4 | Enrollment wajah end-to-end (kamera → descriptor → simpan) |
| 5 | Check-in + matching + liveness (deteksi kedip) |
| 6 | Dashboard analitik + export CSV + polish UI sesuai DESIGN.md |
| 7 | Seed otomatis, uji rebuild penuh, rekam video demo, susun PPT, dokumentasi |

## 13. Pemetaan ke Rubrik Penilaian
- **Implementasi Teknis (30%):** EC2 + RDS + S3 + CloudFormation (pemanfaatan cloud nyata) + face-api.js.
- **Inovasi & Kompleksitas (15%):** liveness anti-spoof + matching descriptor + IaC rebuild otomatis.
- **Ide & Relevansi (15%):** masalah titip absen, solusi konkret.
- **Manajemen Tim (15%):** peran jelas + laporan mingguan.
- **Presentasi/Demo (15%) & Dokumentasi (10%):** video + dokumen ini.

## 14. Catatan Penggunaan AI (slide wajib)
- **Tools:** Claude (Opus 4.8) via Claude Code untuk generate kode; Claude (Cowork) untuk rancangan.
- **Untuk apa:** scaffolding Next.js, API Express, integrasi face-api.js, CloudFormation/bootstrap.
- **Bagian dibantu AI:** boilerplate & integrasi.
- **Validasi tim:** deploy ke AWS, uji end-to-end, tuning threshold match & liveness, penyesuaian UI dilakukan & diuji manual oleh tim.
