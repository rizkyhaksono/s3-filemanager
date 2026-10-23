# S3 File Manager

File manager berbasis web untuk storage S3 milik sendiri — AWS S3, Cloudflare R2, MinIO,
DigitalOcean Spaces, Wasabi, Backblaze B2, IDCloudHost, atau layanan S3-compatible lainnya.
Dibangun dengan Next.js 16 dan SQLite.

## Fitur

- **Banyak koneksi S3** — tambah, edit, hapus, dan tes koneksi. Ada preset endpoint per provider.
- **Kredensial terenkripsi** — Secret Access Key disimpan di SQLite dengan AES-256-GCM dan tidak pernah dikirim ke browser.
- **Bucket** — lihat daftar bucket, buat, dan hapus bucket kosong (atau kunci koneksi ke satu bucket default).
- **Jelajah file** — navigasi folder, breadcrumb, sortir (nama/ukuran/tanggal), cari di folder, "muat lebih banyak" untuk folder besar.
- **Upload** — beberapa file sekaligus, upload folder, drag & drop (termasuk folder), progress per file, bisa dibatalkan.
  File besar dikirim otomatis sebagai multipart upload, dan bucket **tidak perlu konfigurasi CORS**.
- **Kelola** — buat folder, ganti nama, pindahkan (file & folder, rekursif), hapus (multi-pilih, folder rekursif).
- **Pratinjau** — gambar, video, audio, PDF, dan file teks/kode (navigasi ← →).
- **Bagikan** — presigned link dengan masa berlaku 1 jam / 1 hari / 7 hari, download, salin path `s3://`.
- **Info objek** — ukuran, content-type, ETag, storage class, metadata.
- **Login opsional** dengan password lewat environment variable.
- Shortcut: `Ctrl+A` pilih semua, `Delete` hapus, `Backspace` naik folder, `Esc` batal pilih.

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Butuh Node.js 20+. Database dibuat otomatis di `data/app.db` saat pertama jalan.

## Konfigurasi

Salin `.env.example` ke `.env.local` bila perlu:

| Variabel         | Keterangan                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `ADMIN_PASSWORD` | Password login. **Isi ini kalau aplikasi bisa diakses orang lain** — tanpa ini semua orang bisa membuka app. |
| `APP_SECRET`     | Kunci untuk mengenkripsi kredensial & menandatangani sesi. Jika kosong, dibuat otomatis di `data/.secret`.   |
| `DATABASE_PATH`  | Lokasi file SQLite (default `./data/app.db`).                                                                |

> Backup folder `data/` bersama-sama: tanpa `data/.secret` (atau `APP_SECRET` yang sama),
> kredensial yang tersimpan tidak bisa didekripsi.

## Catatan per provider

- **AWS S3** — kosongkan endpoint, isi region sesuai lokasi bucket.
- **Cloudflare R2** — endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`, path-style aktif.
  Token R2 yang dibatasi ke satu bucket tidak bisa list bucket — isi "Bucket default".
- **MinIO** — aktifkan path-style.
- Jika key hanya punya akses ke satu bucket, isi **Bucket default** supaya app tidak memanggil `ListBuckets`.

## Struktur

```
src/
  app/
    (app)/page.tsx            Daftar koneksi
    (app)/c/[id]/page.tsx     File manager
    login/                    Halaman login
    api/connections/...       CRUD + tes koneksi (SQLite)
    api/s3/[id]/...           buckets, objects, upload, folder, rename, delete, url, object, head
  components/                 UI (FileManager, ConnectionForm, PreviewModal, uploads, ...)
  lib/
    db.ts                     Koneksi SQLite (better-sqlite3)
    connections.ts            Query & validasi koneksi
    secret.ts                 Enkripsi AES-256-GCM
    s3.ts                     S3 client & helper
    auth.ts, api.ts           Sesi login & wrapper route handler
```
