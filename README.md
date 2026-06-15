# SIHADIR — Smart Attendance System with Face Recognition

Sistem absensi kuliah berbasis **pengenalan wajah** dengan model **Google
Classroom** (dosen buat kelas + kode join, mahasiswa join lalu absen). Pengenalan
wajah berjalan **di browser** (face-api.js); backend menyimpan & membandingkan
descriptor. Dibangun untuk **AWS Academy Cloud Foundations – Sandbox** (resource
dihapus tiap ~4 jam), sehingga seluruh infrastruktur dapat dibangun ulang dengan
satu perintah CloudFormation + bootstrap + seed otomatis.

> Proyek UAS LTKA / ET3204 · Tema Cloud Computing · Tema visual: SIHADIR (gelap).

---

## Arsitektur

```
Browser (Vercel, HTTPS)                EC2 t3.small (us-east-1)
  Next.js + face-api.js   ──HTTPS──►   Caddy (auto-TLS via <ip>.nip.io)
  • kamera live                              │ reverse_proxy :4000
  • descriptor 128-d                         ▼
  • model Classroom                    Node.js + Express API ──► RDS MySQL (db.t3.micro)
                                                            └──► S3 (foto enroll + absensi)
```

- **Pengenalan wajah berjalan di browser.** Backend hanya menyimpan & membandingkan
  descriptor (array 128 float) via **jarak Euclidean**. Tidak ada Rekognition.
- **Tidak ada upload file** di seluruh alur wajah — hanya `getUserMedia`.
- **Match & keanggotaan kelas divalidasi ulang di server** (`POST /attendance/checkin`).
- **Foto snapshot** disimpan tiap absensi → tampil di rekap dosen (presigned URL).

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

Alur uji: **/register** (akun + enroll wajah) → **/dashboard** (dosen: buat kelas
→ bagikan kode → buka sesi → rekap+foto+CSV) → **/student** (mahasiswa: join kelas
pakai kode → pilih sesi aktif → ambil foto → absen).

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

| Nama | Email | Password | Role |
|---|---|---|---|
| Dr. Budi Santoso | dosen@itb.ac.id | `Passw0rd!` | lecturer |
| Raqinnaja Axsali | axsali@mahasiswa.itb.ac.id | `Passw0rd!` | student |
| Daffa Naufal | daffa@mahasiswa.itb.ac.id | `Passw0rd!` | student |
| Ridho Radifa Al-Haq | ridho@mahasiswa.itb.ac.id | `Passw0rd!` | student |

Plus satu **kelas demo** (`Komputasi Awan 2026`, kode join **`DEMO01`**) dengan
3 mahasiswa sudah ter-join dan **1 sesi aktif** (`Pertemuan 1 (Demo)`).

> **Penting soal descriptor seed:** descriptor pada seed adalah **placeholder**
> (vektor acak deterministik) — akun ada, tapi **tidak akan cocok dengan wajah
> asli** saat absensi. Untuk demo absensi sungguhan, **enroll ulang live** lewat
> `/register`, atau tempel descriptor asli ke `DESCRIPTORS` di
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
| POST | `/auth/register` | publik | Daftar akun (validasi domain email per role) → JWT |
| POST | `/auth/register-face` | auth (mhs) | Simpan descriptor wajah + foto enrollment ke S3 |
| POST | `/auth/login` | publik | Login → JWT |
| POST | `/classes` | dosen | Buat kelas (kode join 6 karakter) |
| GET | `/classes/mine` | auth | Kelas yang dimiliki (dosen) / di-join (mahasiswa) |
| POST | `/classes/join` | mhs | Join kelas pakai kode |
| POST | `/sessions` | dosen | Buka sesi absensi pada kelas |
| PATCH | `/sessions/:id/close` | dosen | Tutup sesi |
| GET | `/sessions/class/:classId` | auth | List sesi sebuah kelas |
| POST | `/attendance/checkin` | mhs | Validasi keanggotaan + match wajah → catat + foto |
| GET | `/attendance/session/:id` | dosen | Rekap kehadiran (+ presigned URL foto) |
| GET | `/attendance/mine` | mhs | Riwayat kehadiran mahasiswa |
| GET | `/health` | publik | Health check (dipakai rebuild) |

**Logika `/attendance/checkin` (otoritatif di server):** validasi JWT → sesi
`is_active` → mahasiswa anggota kelas → ambil descriptor tersimpan → hitung
Euclidean distance descriptor masuk vs tersimpan, tolak bila > `MATCH_THRESHOLD`
(default 0.5) → simpan foto snapshot ke S3 → INSERT (UNIQUE cegah double absen).

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
| `LECTURER_EMAIL_DOMAIN` | Domain email dosen (default `itb.ac.id`; kosongkan untuk nonaktif) |
| `STUDENT_EMAIL_DOMAIN` | Domain email mahasiswa (default `mahasiswa.itb.ac.id`) |

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