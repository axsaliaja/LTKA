# 📋 Panduan Langkah-demi-Langkah — SIHADIR

Panduan dari **nol sampai sistem berjalan**, untuk uji coba di laptop (lokal)
maupun deploy ke **AWS Academy Sandbox**. Ikuti urut dari atas ke bawah.

> 🎯 **SIHADIR** = Smart Attendance System. Dosen membuat kelas (dengan kode
> join), mahasiswa join lalu absen pakai wajah. Tema gelap.

---

## 🗺️ Peta Besar (baca dulu 1 menit)

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

**Konsep utama (model Google Classroom):**
1. **Dosen** daftar → buat **kelas** → dapat **kode 6 karakter** → buka **sesi absensi**.
2. **Mahasiswa** daftar (+ enroll wajah) → **join kelas** pakai kode → **absen** (ambil foto wajah) saat sesi aktif.
3. **Dosen** lihat **rekap** kehadiran (nama, NIM, jarak match, waktu, **foto wajah**) + export CSV.

Ada **2 jalur**:

| Jalur | Untuk apa | Waktu | Butuh AWS? |
|---|---|---|---|
| **A. Lokal** | Belajar / ngoding / demo cepat di 1 laptop | ~15 mnt | ❌ Tidak |
| **B. AWS Sandbox** | Demo "cloud" sesungguhnya (nilai rubrik) | ~20 mnt | ✅ Ya |

👉 Coba **Jalur A** dulu sampai paham, baru **Jalur B**.

---

## ✅ Persiapan Awal (wajib untuk kedua jalur)

### 0.1 Software

| Software | Cek versi | Link |
|---|---|---|
| Node.js ≥ 18 | `node -v` | https://nodejs.org |
| Git | `git --version` | https://git-scm.com |
| MySQL (untuk Jalur A) | `mysql --version` | https://dev.mysql.com/downloads/installer/ |

### 0.2 Unduh bobot model face-api.js

> ✅ **Sudah ada di repo!** File model sudah di-commit ke
> `frontend/public/models/`, jadi **tidak perlu unduh manual** lagi. Lewati
> langkah ini. (Hanya jika folder kosong, jalankan skrip di
> `frontend/public/models/README.md`.)

### 0.3 Aturan email (penting!)

Backend membatasi domain email:
- **Dosen** → harus berakhiran `@itb.ac.id`
- **Mahasiswa** → harus berakhiran `@mahasiswa.itb.ac.id`

> 💡 Email **tidak harus inbox asli** — sistem hanya cek akhirannya. Jadi saat
> daftar/demo kamu bebas pakai mis. `test@mahasiswa.itb.ac.id`.
> Mau pakai email bebas (gmail dll.)? Lihat **§Troubleshooting → "tidak bisa daftar"**.

---

# 🅰️ JALUR A — Menjalankan di Laptop (Lokal)

## A1. Database MySQL

Pastikan MySQL jalan, lalu buat database:
```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS absensi CHARACTER SET utf8mb4;"
```

## A2. Backend

```powershell
cd backend
copy .env.example .env
```
Buka `backend\.env`, isi minimal:
```env
DB_USER=root
DB_PASS=password_mysql_root_kamu
JWT_SECRET=tulis_acak_panjang_12345
```
> `DB_HOST=localhost`, `DB_NAME=absensi` biarkan. `S3_BUCKET` boleh kosong saat
> lokal (foto enroll/absensi di-skip otomatis, tidak error). Domain email default
> ITB; untuk bebas, kosongkan `LECTURER_EMAIL_DOMAIN=` & `STUDENT_EMAIL_DOMAIN=`.

Jalankan:
```powershell
npm install
npm run migrate
npm run seed
npm run dev          # API di http://localhost:4000
```
✔️ Muncul `API listening on :4000`. Biarkan terbuka. Tes: `curl http://localhost:4000/health`

## A3. Frontend

Terminal **baru**:
```powershell
cd frontend
copy .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                        # http://localhost:3000
```
> 📷 Kamera berfungsi di `localhost` walau HTTP (browser menganggapnya aman).

## A4. Coba Alurnya 🎬

```
┌──────────────────────────────────────────────────────────────┐
│ ALUR DEMO SIHADIR                                              │
└──────────────────────────────────────────────────────────────┘

1. DOSEN — daftar & buat kelas
   /register → tab "Dosen" → email @itb.ac.id → Daftar
            → masuk /dashboard → "+ Buat Kelas" (nama + mata kuliah)
            → dapat KODE KELAS (mis. ABC123) → catat
            → klik kelas → "Buka Sesi Absensi" → nama sesi (mis. Pertemuan 1)

2. MAHASISWA — daftar + enroll wajah + join
   Keluar → /register → tab "Mahasiswa" → email @mahasiswa.itb.ac.id + NIM
          → "Lanjut → Foto Wajah" → izinkan kamera → "Ambil & Daftarkan Wajah"
          → otomatis ke /student
          → tab "Join Kelas" → masukkan KODE dari dosen → Join

3. MAHASISWA — absen
   tab "Absensi" → pilih kelas → pilih sesi aktif
          → kamera nyala → "Ambil Foto & Absen"
          → muncul "Absensi berhasil ✓"

4. DOSEN — pantau rekap
   /dashboard → klik kelas → baris sesi → "Rekap"
          → tabel: foto wajah, nama, NIM, jarak match, waktu (auto-refresh 5s)
          → "Export CSV"
```

> ⚠️ **Akun seed tidak bisa absen pakai wajah** (descriptor placeholder). Untuk
> demo absensi sungguhan, pakai akun mahasiswa yang **kamu daftarkan sendiri**
> di langkah 2 (wajahmu tersimpan asli).

🎉 **Jalur A selesai!**

---

# 🅱️ JALUR B — Deploy ke AWS Academy Sandbox

> Sandbox menghapus semua resource tiap ~4 jam. Langkah **B2–B6 diulang setiap
> mulai sesi**. B1 (GitHub + Vercel) cukup **sekali**.

## B1. Persiapan Sekali di Awal

**B1a. Repo GitHub** — sudah ada di `https://github.com/axsaliaja/LTKA` (public).
Kalau ada perubahan kode di laptop, push dulu: `git add -A && git commit -m "..." && git push`.

**B1b. Vercel** — import repo, **Root Directory = `frontend`**, lalu Deploy.

## B2. Mulai Sesi & Buka CloudShell

1. **Start Lab** (tunggu 🟢) → buka **AWS Console** → region **us-east-1**.
2. Buka **CloudShell** (ikon terminal kanan atas).

## B3. Deploy CloudFormation

```bash
git clone https://github.com/axsaliaja/LTKA.git   # (atau: cd ~/LTKA && git pull)
cd LTKA
aws cloudformation deploy \
  --template-file infra/template.yaml \
  --stack-name absensi \
  --region us-east-1 \
  --parameter-overrides \
     DBPassword='Absensi123!' \
     RepoUrl='https://github.com/axsaliaja/LTKA.git'
```
⏳ **10–12 menit** (paling lama menunggu RDS). EC2 otomatis: install Node+Caddy,
clone repo, `npm install`, `migrate` + `seed`, start API, HTTPS via nip.io.

## B4. Ambil ApiUrl

```bash
aws cloudformation describe-stacks --stack-name absensi --region us-east-1 \
  --query "Stacks[0].Outputs" --output table
```
Catat **`ApiUrl`** (mis. `https://54-91-12-34.nip.io`).

## B5. Hubungkan Frontend ke Backend

1. Vercel → projek → **Settings → Environment Variables**
   (UI baru: **Settings → Environments → klik "Production"** → bagian Environment Variables).
2. Set / ubah:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `ApiUrl` dari B4 (tanpa garis miring di akhir)
3. **Deployments → ⋯ → Redeploy.**

> 🔁 **IP EC2 BERUBAH tiap rebuild stack.** Jadi tiap selesai B3, **WAJIB** ulang
> B5 (update value + Redeploy). Ini penyebab #1 error "stuck memproses /
> connection timed out".

## B6. Verifikasi

Tunggu ±3–5 menit setelah CFN selesai (EC2 bootstrap), lalu:
```bash
curl -m 10 https://<ip>.nip.io/health        # {"status":"ok","db":"up"}
```
Buka URL Vercel → jalankan **Alur Demo (A4)** dari HP. 📱

## B7. Membersihkan / Re-deploy (baca §Troubleshooting bila gagal)

```bash
aws cloudformation delete-stack --stack-name absensi --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name absensi --region us-east-1
```

---

## 🔁 Ringkasan Rebuild Tiap Sesi Baru

```
1. Start Lab → CloudShell (us-east-1)
2. cd ~/LTKA && git pull           (ambil kode terbaru)
3. aws cloudformation deploy ...   (B3)
4. ambil ApiUrl                    (B4)
5. update NEXT_PUBLIC_API_URL di Vercel + REDEPLOY   (B5)  ← jangan lupa!
6. curl .../health → buka URL Vercel                 (B6)
```

## 🔄 Kalau hanya KODE yang berubah (stack masih hidup)

Tidak perlu rebuild stack. Refresh EC2 via SSH (IP tetap, Vercel tak perlu diubah):
```bash
ssh -i labsuser.pem ec2-user@<IP-EC2>
cd /opt/absensi && sudo git pull
cd backend && sudo npm install && sudo npm run build && sudo npm run migrate && sudo npm run seed
sudo systemctl restart absensi-api
```

---

## 🆘 Troubleshooting

### "Stuck memproses…" / Console: `net::ERR_CONNECTION_TIMED_OUT`
Frontend menembak IP backend yang **basi/mati**. Penyebab #1: IP EC2 berubah
setelah rebuild tapi Vercel belum di-update.
**Fix:** ambil ApiUrl terbaru (B4) → samakan `NEXT_PUBLIC_API_URL` di Vercel →
**Redeploy** (B5). Pastikan `curl -m 10 https://<ip>/health` dari CloudShell OK.

### "Tidak bisa daftar" — ditolak soal email
Email harus sesuai domain: dosen `@itb.ac.id`, mahasiswa `@mahasiswa.itb.ac.id`
(akhiran saja, tak harus inbox asli). **Mau bebas pakai email apa pun?** Di EC2
edit `/opt/absensi/backend/.env`, set kosong:
```
LECTURER_EMAIL_DOMAIN=
STUDENT_EMAIL_DOMAIN=
```
lalu `sudo systemctl restart absensi-api`. (Lokal: ubah di `backend/.env`.)

### Deploy gagal → stack `ROLLBACK_COMPLETE`
Stack gagal tidak bisa di-deploy ulang. Hapus dulu:
```bash
aws cloudformation delete-stack --stack-name absensi --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name absensi --region us-east-1
```
Lihat alasan gagal:
```bash
aws cloudformation describe-stack-events --stack-name absensi --region us-east-1 \
  --query "StackEvents[?contains(ResourceStatus,'FAILED')].[LogicalResourceId,ResourceStatusReason]" \
  --output table
```

### Hapus stack gagal → `DELETE_FAILED` (S3 bucket tidak kosong)
CloudFormation tak bisa hapus bucket berisi foto. Kosongkan dulu:
```bash
BUCKET=$(aws cloudformation describe-stack-resources --stack-name absensi --region us-east-1 \
  --query "StackResources[?LogicalResourceId=='PhotoBucket'].PhysicalResourceId" --output text)
aws s3 rm "s3://$BUCKET" --recursive
aws cloudformation delete-stack --stack-name absensi --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name absensi --region us-east-1
```
Alternatif cepat (tinggalkan bucket yatim, dibersihkan sandbox):
```bash
aws cloudformation delete-stack --stack-name absensi --region us-east-1 --retain-resources PhotoBucket
```

### Kamera tidak muncul / "Gagal mengakses kamera"
Izinkan kamera di browser (ikon 🔒 address bar), pastikan halaman **HTTPS**
(produksi) atau **localhost** (lokal). Jika 404 `/models/...` → folder model
kosong (lihat §0.2).

### Absen "Wajah tidak cocok"
Wajar untuk akun **seed** (descriptor placeholder). Pakai akun yang kamu daftar
sendiri. Atau longgarkan: `MATCH_THRESHOLD=0.6` di `.env` (lebih besar = longgar).

### Endpoint baru 404 (mis. `/classes/mine`)
Backend EC2 masih versi lama. Lakukan **§Refresh EC2 via SSH** atau rebuild stack.

---

## 🔑 Akun Seed (default)

Semua password: **`Passw0rd!`** · Kelas demo: **`Komputasi Awan 2026`** kode **`DEMO01`** (3 mhs sudah join, 1 sesi aktif).

| Peran | Email | Absen wajah? |
|---|---|---|
| Dosen | dosen@itb.ac.id | — |
| Mahasiswa | axsali@mahasiswa.itb.ac.id | ❌ (descriptor placeholder) |
| Mahasiswa | daffa@mahasiswa.itb.ac.id | ❌ |
| Mahasiswa | ridho@mahasiswa.itb.ac.id | ❌ |

> Untuk absensi wajah sungguhan → **daftar akun mahasiswa baru** lewat `/register`.

---

## 📌 Checklist "Isi Manual"

- [ ] `backend/.env`: isi `DB_PASS` & `JWT_SECRET` *(Jalur A)*
- [ ] `DBPassword` saat `aws cloudformation deploy` *(B3)*
- [ ] `RepoUrl` = URL GitHub-mu *(B3)*
- [ ] `NEXT_PUBLIC_API_URL` di Vercel = `ApiUrl`, lalu **Redeploy** *(B5, tiap rebuild!)*
- [ ] (opsional) Kosongkan domain email kalau mau daftar pakai email bebas
```
