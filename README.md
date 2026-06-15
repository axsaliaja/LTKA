# Absensi.face — Sistem Absensi Kuliah berbasis Face Recognition

Self check-in absensi kuliah dari HP mahasiswa dengan **pengenalan wajah di
browser** (face-api.js) dan **liveness detection** (tantangan kedip) untuk
mencegah titip absen. Dibangun untuk **AWS Academy Cloud Foundations – Sandbox**
(resource dihapus tiap ~4 jam), sehingga seluruh infrastruktur dapat dibangun
ulang dengan satu perintah CloudFormation + bootstrap + seed otomatis.

> Proyek UAS LTKA 2026 · Tema Cloud Computing.

---

## Arsitektur

```
Browser (Vercel, HTTPS)                EC2 t3.small (us-east-1)
  Next.js + face-api.js   ──HTTPS──►   Caddy (auto-TLS via <ip>.nip.io)
  • kamera live                              │ reverse_proxy :4000
  • descriptor 128-d                         ▼
  • liveness (kedip/EAR)               Node.js + Express API ──► RDS MySQL (db.t3.micro)
                                                            └──► S3 (foto enroll, privat)
```

- **Pengenalan wajah berjalan di browser.** Backend hanya menyimpan & membandingkan
  descriptor (array 128 float) via **jarak Euclidean**. Tidak ada Rekognition.
- **Tidak ada upload file** di seluruh alur wajah — hanya `getUserMedia`.
- **Liveness & match divalidasi ulang di server** (`POST /attendance/checkin`).

### Batasan sandbox yang dipatuhi
- Region **us-east-1** saja · **tanpa DynamoDB / API Gateway / Rekognition**.
- **Tanpa IAM baru** — EC2 memakai `LabInstanceProfile`; CloudFormation hanya mereferensikannya.
- EC2 `t3.small`, key pair `vockey`, EBS gp2 20 GB.
- RDS MySQL `db.t3.micro`, Single-AZ, gp2, enhanced monitoring **off**.
- Geofencing tidak dipakai.

---

## Struktur proyek

```
/frontend            Next.js (App Router) + TS + Tailwind + face-api.js + Recharts
  /app  /register /login /checkin /dashboard
  /lib               faceapi, api client, liveness (EAR), euclidean, auth
  /components        CameraCapture (live + liveness), Chrome (nav/footer)
  /public/models     bobot face-api.js (download manual — lihat README di dalamnya)
  .env.example       NEXT_PUBLIC_API_URL
/backend             Express + TypeScript
  /src/routes        auth, sessions, attendance, analytics
  /src/lib           db, jwt, s3, euclidean
  /src/middleware    auth (JWT)
  /src/migrations    001_init.sql
  /src/scripts       migrate, seed, make-seed
  /seed/seed.sql     akun dosen + 3 mahasiswa + sesi demo (auto-generated)
  .env.example
/infra
  template.yaml      CloudFormation: SG, S3, RDS MySQL, EC2 (LabInstanceProfile)
  bootstrap.sh       user-data: Node + Caddy, clone, npm i, migrate+seed, start
README.md
```

---

## A. Menjalankan secara lokal (development)

### 1. Backend
```bash
cd backend
cp .env.example .env        # isi DB_PASS, JWT_SECRET, (opsional) S3_BUCKET
npm install
# Pastikan MySQL lokal jalan & DB "absensi" ada, lalu:
npm run migrate
npm run seed
npm run dev                 # API di http://localhost:4000
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
# Download bobot model face-api.js — lihat frontend/public/models/README.md
npm run dev                 # http://localhost:3000
```

> **Catatan HTTPS lokal:** `getUserMedia` diizinkan di `http://localhost`
> (origin yang dianggap aman), jadi kamera tetap berfungsi saat dev lokal.

Alur uji: **/register** (enroll wajah) → **/login** → **/checkin** (kedip 2× →
hasil Hadir/Telat/Ditolak) → **/dashboard** (dosen: buat/tutup sesi, tabel
real-time, grafik, export CSV).

---

## B. Rebuild di AWS sandbox setiap sesi (≈10–12 menit)

Sebagian besar waktu adalah menunggu RDS siap.

### Persiapan sekali di awal
1. Push seluruh repo ini ke **GitHub** (publik agar EC2 bisa `git clone` tanpa kredensial).
2. Import folder `frontend` ke **Vercel**.

### Tiap mulai sesi sandbox
1. **Start Lab** → buka **AWS CloudShell** (kredensial sudah ter-set), region `us-east-1`.
2. Clone repo lalu deploy CloudFormation:
   ```bash
   git clone https://github.com/USERNAME/REPO.git && cd REPO
   aws cloudformation deploy \
     --template-file infra/template.yaml \
     --stack-name absensi \
     --region us-east-1 \
     --parameter-overrides \
        DBPassword='GANTI_password_kuat' \
        RepoUrl='https://github.com/USERNAME/REPO.git'
   ```
   > Tidak perlu `--capabilities` karena template **tidak** membuat IAM baru.
3. Ambil output stack:
   ```bash
   aws cloudformation describe-stacks --stack-name absensi \
     --query "Stacks[0].Outputs" --output table
   ```
   Catat **ApiUrl** (`https://<ip>.nip.io`).
4. Di **Vercel**, set env `NEXT_PUBLIC_API_URL` = ApiUrl tersebut, lalu **redeploy**
   (IP EC2 berubah tiap sesi, jadi langkah ini wajib diulang).
5. Tunggu ±3–5 menit hingga EC2 selesai bootstrap, lalu cek:
   ```bash
   curl https://<ip>.nip.io/health      # {"status":"ok","db":"up"}
   ```

### Membersihkan
```bash
aws cloudformation delete-stack --stack-name absensi --region us-east-1
```
(Atau biarkan sandbox menghapusnya saat sesi berakhir.)

---

## C. Seed otomatis (data ikut terhapus tiap sesi)

`bootstrap.sh` menjalankan `npm run migrate` lalu `npm run seed`, memuat
`backend/seed/seed.sql`. Isi default:

| Akun | Email | Password | Role |
|---|---|---|---|
| DOSEN001 | dosen@kampus.ac.id | `Passw0rd!` | lecturer |
| 10120001 | anggota1@kampus.ac.id | `Passw0rd!` | student |
| 10120002 | anggota2@kampus.ac.id | `Passw0rd!` | student |
| 10120003 | anggota3@kampus.ac.id | `Passw0rd!` | student |

Plus satu **sesi demo** (`Cloud Computing (Demo)`) yang terbuka 24 jam.

> **Penting soal descriptor seed:** descriptor pada seed adalah **placeholder**
> (vektor acak deterministik) — akun ada, tapi **tidak akan cocok dengan wajah
> asli** saat check-in. Untuk demo check-in yang sungguhan, **enroll ulang live**
> lewat `/register`, atau tempel descriptor asli ke `DESCRIPTORS` di
> `backend/src/scripts/make-seed.ts` lalu jalankan `npm run make-seed` dan commit
> ulang `seed.sql`.

---

## D. Mengapa Caddy + nip.io (masalah HTTPS)

Vercel menyajikan frontend lewat **HTTPS**, dan `getUserMedia` mewajibkan HTTPS.
EC2 publik default-nya HTTP → browser memblokir mixed content. Solusinya: EC2
menjalankan **Caddy** yang otomatis mendapatkan sertifikat **Let's Encrypt**
untuk hostname `<public-ip>.nip.io` (DNS wildcard gratis yang memetakan IP),
lalu mem-proxy ke Express di `localhost:4000`. Jadi `NEXT_PUBLIC_API_URL` =
`https://<ip>.nip.io` dan tidak perlu membeli domain.

---

## E. API Endpoint (Express)

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| POST | `/auth/register` | publik | Daftar + simpan descriptor + upload foto S3 |
| POST | `/auth/login` | publik | Login → JWT |
| GET | `/sessions` | auth | List sesi terbuka (`?all=1` dosen: semua) |
| POST | `/sessions` | dosen | Buat sesi |
| PATCH | `/sessions/:id/close` | dosen | Tutup sesi |
| POST | `/attendance/checkin` | auth | Validasi liveness + match + waktu → catat |
| GET | `/attendance/session/:id` | dosen | Daftar hadir |
| GET | `/attendance/student/:id` | auth | Riwayat mahasiswa |
| GET | `/analytics/session/:id` | dosen | Statistik hadir/telat/absen + % |
| GET | `/health` | publik | Health check (dipakai rebuild) |

**Logika `/attendance/checkin` (otoritatif di server):** validasi JWT → sesi
`is_open` & dalam rentang waktu → tolak bila `liveness_passed !== true` → hitung
Euclidean distance descriptor masuk vs `students.face_descriptor`, tolak bila
> `MATCH_THRESHOLD` (default 0.5) → `late` bila `now > start + late_threshold`
else `present` → INSERT (UNIQUE cegah duplikat).

---

## F. Variabel environment

### backend/.env (lihat `backend/.env.example`)
| Var | Keterangan |
|---|---|
| `PORT` | Port API (default 4000) |
| `DB_HOST` | Endpoint RDS (output CFN `DBEndpoint`) |
| `DB_PORT` `DB_USER` `DB_NAME` | Koneksi MySQL (admin / absensi) |
| `DB_PASS` | **Isi manual** — `DBPassword` saat deploy |
| `JWT_SECRET` | **Isi manual** — string acak panjang (bootstrap meng-generate otomatis) |
| `JWT_EXPIRES_IN` | Masa berlaku token (12h) |
| `AWS_REGION` | `us-east-1` |
| `S3_BUCKET` | Output CFN `PhotoBucketName` |
| `S3_PRESIGN_EXPIRES` | Umur presigned URL (detik) |
| `MATCH_THRESHOLD` | Ambang jarak match (default 0.5; lebih kecil = lebih ketat) |
| `CORS_ORIGIN` | Origin frontend (`*` untuk demo) |

### frontend/.env.local (lihat `frontend/.env.example`)
| Var | Keterangan |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL API = `https://<ip>.nip.io` (update di Vercel tiap rebuild) |

---

## G. Bagian yang HARUS diisi manual

- [ ] **`DBPassword`** saat `aws cloudformation deploy` (password kuat ≥8 karakter).
- [ ] **`RepoUrl`** = URL GitHub repo kamu (parameter CFN & `git clone` di CloudShell).
- [ ] **`NEXT_PUBLIC_API_URL`** di Vercel = `https://<ip>.nip.io` (output `ApiUrl`), **tiap sesi**.
- [ ] **Bobot model face-api.js** di `frontend/public/models/` — lihat README di folder itu.
- [ ] (Opsional) Descriptor wajah asli di `make-seed.ts` bila ingin seed yang bisa langsung check-in.
- [ ] (Lokal) `DB_PASS` & `JWT_SECRET` di `backend/.env`.

---

## H. Tech stack

Next.js · React · TypeScript · Tailwind (design system Cal.com, lihat `DESIGN.md`)
· face-api.js · Recharts · Node.js · Express · MySQL (mysql2) · JWT · bcryptjs ·
AWS SDK v3 (S3) · CloudFormation · Caddy · EC2 · RDS · S3.
#   L T K A  
 