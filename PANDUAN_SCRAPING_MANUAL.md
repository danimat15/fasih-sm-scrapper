# Panduan Pemrosesan Data Scraping Manual FASIH & Auto-Push GitHub

Panduan ini digunakan ketika Anda melakukan scraping manual data FASIH dan ingin langsung memperbarui data dashboard serta melakukan **otomatis push ke GitHub**.

---

## Langkah 1: Tempelkan Data Hasil Scraping Manual

1. Buka file `data_manual_dashboard.md`.
2. Hapus/replace isi lamanya dengan data teks/markdown hasil scraping manual terbaru dari web FASIH.
3. Simpan file `data_manual_dashboard.md`.

---

## Langkah 2: Jalankan Script Pemrosesan Data

Buka Terminal / Command Prompt di folder project `scraper-fasih-sm`, lalu jalankan perintah berikut:

### Opsi A: Menggunakan Format Singkat Jam (Paling Praktis)
Cukup masukkan jamnya saja (misal `09.35` atau `09:35`), script akan otomatis membentuk format tanggal dan jam hari ini:

```bash
python parse_manual_dashboard.py "09.35"
```

---

### Opsi B: Menggunakan Format Lengkap Tanggal & Jam
Jika ingin menentukan tanggal lengkap secara spesifik:

```bash
python parse_manual_dashboard.py "22 Juli 2026 pukul 09.35 WITA"
```

---

### Opsi C: Tanpa Argumen (Menggunakan Jam WITA Saat Ini)
Jika dijalankan tanpa argumen, script akan menggunakan jam saat ini secara otomatis:

```bash
python parse_manual_dashboard.py
```

---

## Apa yang Terjadi Secara Otomatis?

Ketika perintah di atas dijalankan:
1. **Konversi Data**: Teks dari `data_manual_dashboard.md` diekstrak menjadi `dashboard_scraped_data.csv` lengkap dengan nama petugas, jabatan, kecamatan, Koseka, dan flag prioritas.
2. **Update Dashboard Public**: Berkas CSV, snapshot pagi/sore, dan `last_updated.txt` diperbarui di folder `dashboard/public/`.
3. **Auto-Push ke GitHub**: Script secara otomatis melakukan `git add`, `git commit -m "Update data: <waktu>"`, `git pull --rebase`, dan **`git push` ke GitHub (`origin/main`)**.
4. **Dashboard Deployed Live**: Dashboard live (misal di Vercel/Server) akan otomatis ter-update mengikuti repository GitHub.
