# 📋 Panduan Langkah-demi-Langkah — Absensi.face

Panduan ini menuntun kamu dari **nol sampai sistem berjalan**, baik untuk uji
coba di laptop (lokal) maupun deploy ke **AWS Academy Sandbox**. Ikuti urut dari
atas ke bawah. Setiap langkah ada perintah yang bisa langsung di-copy.

> 🎯 Target akhir: mahasiswa bisa absen lewat HP dengan wajah + kedip, dosen
> melihat dashboard real-time.

---

## 🗺️ Peta Besar (baca dulu 1 menit)

Sistem ini punya 3 bagian:

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  FRONTEND   │ ───► │     BACKEND      │ ───► │  DATABASE   │
│  Next.js    │ HTTP │  Express API     │ SQL  │  MySQL      │
│  (browser)  │      │  (EC2)           │      │  (RDS)      │
│  + kamera   │      │  + Caddy HTTPS   │      │             │
│  + face-api │      │  + S3 (foto)     │      │             │
└─────────────┘      └──────────────────┘      └─────────────┘
   di Vercel             di AWS EC2               di AWS RDS
```

Ada **2 jalur** yang bisa kamu tempuh:

| Jalur | Untuk apa | Waktu | Butuh AWS? |
|---|---|---|---|
| **A. Lokal** | Belajar, ngoding, demo cepat di 1 laptop | ~15 mnt | ❌ Tidak |
| **B. AWS Sandbox** | Demo "cloud" sesungguhnya (nilai rubrik) | ~20 mnt | ✅ Ya |

👉 **Saran:** coba **Jalur A dulu** sampai paham alurnya, baru lanjut **Jalur B**.

---

## ✅ Persiapan Awal (wajib untuk kedua jalur)

### 0.1 Software yang harus terpasang di laptop

| Software | Cek versi | Link unduh |
|---|---|---|
| Node.js ≥ 18 | `node -v` | https://nodejs.org |
| Git | `git --version` | https://git-scm.com |
| MySQL (untuk Jalur A) | `mysql --version` | https://dev.mysql.com/downloads/installer/ |

> Jika `node -v` memunculkan angka (mis. `v20.x`), berarti sudah siap.

### 0.2 Unduh bobot model face-api.js (WAJIB, sekali saja)

Tanpa file ini, kamera tidak bisa mengenali wajah.

1. Buka folder: `frontend/public/models/`
2. Jalankan PowerShell **di dalam folder itu**:

```powershell
cd "frontend\public\models"
$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$files = @(
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2"
)
foreach ($f in $files) { Invoke-WebRequest "$base/$f" -OutFile $f }
```

3. Pastikan ada **7 file** di folder itu (selain `README.md` dan `.gitkeep`):

```powershell
dir
```

✔️ Kalau 7 file sudah ada, lanjut.

---

# 🅰️ JALUR A — Menjalankan di Laptop (Lokal)

## A1. Siapkan Database MySQL

1. Pastikan MySQL service berjalan.
2. Buat database kosong bernama `absensi`:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS absensi CHARACTER SET utf8mb4;"
```

(Masukkan password root MySQL kamu saat diminta.)

## A2. Jalankan Backend

1. Masuk folder backend & buat file `.env`:

```powershell
cd backend
copy .env.example .env
```

2. Buka `backend\.env` dengan editor, **isi 2 baris ini**:

```env
DB_PASS=password_mysql_root_kamu
JWT_SECRET=tulis_apa_saja_yang_panjang_dan_acak_123456
```

> Biarkan `DB_HOST=localhost`, `DB_USER=root` *(ganti jika user MySQL-mu bukan root)*,
> `DB_NAME=absensi`. `S3_BUCKET` boleh dikosongkan saat lokal (foto enroll
> di-skip otomatis, tidak error).

3. Install, migrasi tabel, isi data awal, lalu jalankan:

```powershell
npm install
npm run migrate
npm run seed
npm run dev
```

✔️ Kalau muncul `API listening on :4000`, backend **sukses**. Biarkan jendela ini terbuka.

4. (Opsional) Tes cepat di browser/terminal lain:

```powershell
curl http://localhost:4000/health
```

Harus muncul: `{"status":"ok","db":"up"}`

## A3. Jalankan Frontend

Buka terminal **baru** (jangan tutup terminal backend):

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

> `.env.local` defaultnya sudah `NEXT_PUBLIC_API_URL=http://localhost:4000` — pas untuk lokal.

✔️ Buka browser ke **http://localhost:3000**

> 📷 Kamera berfungsi di `localhost` walau HTTP (browser menganggapnya aman).

## A4. Coba Alurnya 🎬

Ikuti urutan ini untuk membuktikan semua fitur jalan:

```
┌──────────────────────────────────────────────────────────────┐
│ ALUR DEMO                                                       │
└──────────────────────────────────────────────────────────────┘

1. DAFTAR (sebagai mahasiswa)
   /register → isi NIM, nama, email, password
            → izinkan kamera → "Ambil Wajah" → "Daftar"
            → otomatis masuk ke /checkin

2. BUAT SESI (sebagai dosen)
   Logout → /login pakai akun dosen seed:
            email: dosen@kampus.ac.id  |  password: Passw0rd!
            → masuk /dashboard → "Buat Sesi" (isi MK, waktu mulai/selesai)
   * Catatan: sudah ada "Sesi Demo" terbuka 24 jam dari seed.

3. CHECK-IN (sebagai mahasiswa)
   Logout → /login pakai akun yang tadi kamu daftarkan
          → /checkin → pilih sesi → kamera nyala
          → KEDIPKAN MATA 2× → otomatis capture
          → muncul hasil: HADIR / TELAT / DITOLAK + alasan

4. PANTAU (sebagai dosen)
   /login dosen → /dashboard → klik sesi
          → lihat tabel hadir (auto-refresh 5 detik)
          → grafik Hadir/Telat/Absen → tombol "Export CSV"
```

> ⚠️ **Penting soal akun seed:** akun `10120001` dst. punya descriptor wajah
> **placeholder** (acak), jadi mereka **tidak bisa** check-in dengan wajah asli.
> Untuk demo check-in beneran, pakai akun yang **kamu daftarkan sendiri** di
> langkah 1 (wajahmu tersimpan asli).

🎉 **Jalur A selesai!**

---

# 🅱️ JALUR B — Deploy ke AWS Academy Sandbox

> Karena sandbox menghapus semua resource tiap ~4 jam, langkah B2–B6 **diulang
> setiap mulai sesi baru**. Tapi B1 (GitHub + Vercel) cukup **sekali**.

## B1. Persiapan Sekali di Awal

### B1a. Push kode ke GitHub

1. Buat repo baru di https://github.com (set **Public** agar EC2 bisa clone tanpa login).
2. Dari folder proyek ini:

```powershell
git init
git add .
git commit -m "Sistem absensi face recognition"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

> Ganti `USERNAME/REPO` dengan milikmu. File `node_modules`, `.env`, dan bobot
> model **tidak** ikut ter-push (sudah diatur `.gitignore`) — itu normal.

### B1b. Import Frontend ke Vercel

1. Login https://vercel.com pakai akun GitHub.
2. **Add New → Project** → pilih repo kamu.
3. **Root Directory**: pilih `frontend`.
4. Klik **Deploy** (boleh gagal/aneh dulu karena `NEXT_PUBLIC_API_URL` belum ada — akan diisi di B5).

---

## B2. Mulai Sesi Sandbox & Buka CloudShell

1. Buka **AWS Academy** → **Start Lab** (tunggu titik jadi hijau 🟢).
2. Klik **AWS** untuk buka Console. Pastikan region di kanan atas = **N. Virginia (us-east-1)**.
3. Klik ikon **CloudShell** (terminal) di pojok kanan atas Console.

## B3. Deploy Infrastruktur dengan CloudFormation

Di CloudShell, jalankan (ganti `USERNAME/REPO` dan password):

```bash
git clone https://github.com/USERNAME/REPO.git
cd REPO

aws cloudformation deploy \
  --template-file infra/template.yaml \
  --stack-name absensi \
  --region us-east-1 \
  --parameter-overrides \
     DBPassword='Ganti_Password_Kuat_123' \
     RepoUrl='https://github.com/USERNAME/REPO.git'
```

> ⏳ Proses ini **10–12 menit** (paling lama menunggu RDS dibuat). Sabar sampai
> muncul tulisan sukses. Tidak perlu `--capabilities` karena template tidak
> membuat IAM baru.

Apa yang dibuat otomatis:
- 🔒 Security Group (EC2 & RDS)
- 🪣 S3 bucket (foto enroll, privat)
- 🗄️ RDS MySQL `db.t3.micro`
- 🖥️ EC2 `t3.small` → otomatis install Node+Caddy, clone repo, migrate+seed, start API, HTTPS

## B4. Ambil Output (URL API)

```bash
aws cloudformation describe-stacks --stack-name absensi \
  --region us-east-1 \
  --query "Stacks[0].Outputs" --output table
```

Catat baris **`ApiUrl`**, contohnya:

```
https://54-91-12-34.nip.io
```

## B5. Hubungkan Frontend (Vercel) ke API

1. Buka Vercel → projek kamu → **Settings → Environment Variables**.
2. Tambah variabel:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: URL `ApiUrl` dari B4 (mis. `https://54-91-12-34.nip.io`)
3. Buka tab **Deployments** → titik tiga di deploy terakhir → **Redeploy**.

> 🔁 **IP EC2 berubah tiap sesi sandbox**, jadi langkah B5 ini **wajib diulang**
> setiap kali kamu rebuild (B2–B4).

## B6. Verifikasi

1. Tunggu ±3–5 menit setelah CloudFormation selesai (EC2 perlu waktu bootstrap).
2. Cek kesehatan API (ganti dengan IP-mu):

```bash
curl https://54-91-12-34.nip.io/health
```

Harus muncul: `{"status":"ok","db":"up"}`

3. Buka URL Vercel kamu (mis. `https://repo-kamu.vercel.app`) → coba **Alur Demo**
   (lihat bagian A4) langsung dari **HP**.

🎉 **Jalur B selesai — sistem berjalan di cloud AWS!**

## B7. Membersihkan (Opsional)

Setelah selesai / sebelum sesi berakhir:

```bash
aws cloudformation delete-stack --stack-name absensi --region us-east-1
```

(Atau biarkan sandbox menghapusnya sendiri saat waktu habis.)

---

## 🔁 Ringkasan: Rebuild Cepat Tiap Sesi Baru

Setelah B1 selesai sekali, tiap mulai sesi cukup:

```
1. Start Lab → CloudShell (us-east-1)
2. git clone ... && cd REPO
3. aws cloudformation deploy ...        (B3)
4. ambil ApiUrl                          (B4)
5. update NEXT_PUBLIC_API_URL di Vercel + Redeploy   (B5)
6. curl .../health → buka URL Vercel     (B6)
```

---

## 🆘 Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| Kamera tidak muncul / "Gagal mengakses kamera" | Belum izinkan kamera, atau halaman bukan HTTPS. Lokal: pakai `localhost` (bukan `127.0.0.1`). Produksi: pastikan URL Vercel `https://`. |
| "Wajah tidak terdeteksi" terus | Bobot model belum diunduh (lihat 0.2), pencahayaan kurang, atau wajah terlalu jauh. |
| Check-in "Ditolak: Wajah tidak cocok" | Wajar untuk akun **seed** (descriptor placeholder). Pakai akun yang kamu daftar sendiri. Atau turunkan ketelitian: `MATCH_THRESHOLD=0.6` di `.env`. |
| Check-in "Liveness gagal" | Kedipan belum terbaca. Kedip tegas 2×, wajah menghadap kamera, cahaya cukup. |
| Backend error "Missing required env var" | `backend/.env` belum diisi (`DB_PASS`, `JWT_SECRET`). |
| `npm run migrate` error koneksi | MySQL belum jalan, atau `DB_HOST/DB_USER/DB_PASS` salah di `.env`. |
| `curl .../health` gagal di AWS | EC2 belum selesai bootstrap (tunggu beberapa menit) atau cek log di EC2: `sudo cat /var/log/absensi-bootstrap.log`. |
| Halaman Vercel error panggil API | `NEXT_PUBLIC_API_URL` salah/kosong, atau belum **Redeploy** setelah diubah. |

---

## 🔑 Akun Seed (default)

Semua password: **`Passw0rd!`**

| Peran | Email | Bisa check-in wajah? |
|---|---|---|
| Dosen | dosen@kampus.ac.id | — (dosen tidak check-in) |
| Mahasiswa | anggota1@kampus.ac.id | ❌ (descriptor placeholder) |
| Mahasiswa | anggota2@kampus.ac.id | ❌ |
| Mahasiswa | anggota3@kampus.ac.id | ❌ |

> Untuk check-in wajah sungguhan → **daftar akun baru** lewat `/register`.

---

## 📌 Checklist "Isi Manual" (jangan sampai terlewat)

- [ ] Unduh 7 file bobot model ke `frontend/public/models/` *(0.2)*
- [ ] `backend/.env`: isi `DB_PASS` & `JWT_SECRET` *(Jalur A)*
- [ ] `DBPassword` saat `aws cloudformation deploy` *(B3)*
- [ ] `RepoUrl` = URL GitHub-mu *(B3)*
- [ ] `NEXT_PUBLIC_API_URL` di Vercel = `ApiUrl`, lalu **Redeploy** *(B5, tiap sesi)*
```
