# Panduan Pemrosesan Data Scraping Manual FASIH

Panduan ini digunakan ketika Anda melakukan scraping manual data FASIH dan ingin meng-update dashboard secara cepat.

---

## Langkah 1: Tempelkan Data Hasil Scraping Manual

1. Buka file `data_manual_dashboard.md`.
2. Hapus/replace isi lamanya dengan data teks/markdown hasil scraping manual terbaru dari web FASIH.
3. Simpan file `data_manual_dashboard.md`.

---

## Langkah 2: Jalankan Script Pemrosesan Data

Buka Terminal / Command Prompt di folder project `scraper-fasih-sm`, lalu jalankan salah satu perintah berikut:

### Opsi A: Menggunakan Script Khusus (Disarankan)

Gunakan perintah ini untuk memproses data manual dan menyertakan jam/waktu pengambilan data secara spesifik:

```bash
python parse_manual_dashboard.py "22 Juli 2026 pukul 09.35 WITA"
```

> **Catatan:** Ganti `"22 Juli 2026 pukul 09.35 WITA"` sesuai dengan tanggal dan jam saat Anda mengambil data manual tersebut.

---

### Opsi B: Menggunakan Pipeline Utama `process_data.py`

Jika Anda ingin menjalankan seluruh pipeline data sekaligus (termasuk pemrosesan data mikro, mapping, dan git sync jika diaktifkan):

```bash
python process_data.py
```

*Script `process_data.py` akan secara otomatis mendeteksi keberadaan file `data_manual_dashboard.md` dan memprosesnya ke dashboard.*

---

## Apa yang Terjadi Setelah Script Dijalankan?

Script akan secara otomatis melakukan:
1. Mengekstrak seluruh record SLS dan status dari `data_manual_dashboard.md`.
2. Melengkapi nama petugas, jabatan (PPL/PML), kecamatan, Koseka, dan status prioritas SLS.
3. Memperbarui file `dashboard_scraped_data.csv` dan menyalinnya ke folder `dashboard/public/dashboard_scraped_data.csv`.
4. Memperbarui snapshot pagi (`dashboard_scraped_data_morning.csv`) atau sore sesuai jam pengesetan.
5. Memperbarui catatan waktu terakhir update pada file `dashboard/public/last_updated.txt`.
6. Dashboard Next.js akan langsung menampilkan data terbaru tanpa perlu restart server.
