import os
import csv
import shutil
import re
import sys
from datetime import datetime, timezone, timedelta
import process_data

# WITA is UTC+8
wita_tz = timezone(timedelta(hours=8))

STATUS_COLUMNS = [
    'OPEN',
    'APPROVED BY Pengawas',
    'SUBMITTED BY Pencacah',
    'DRAFT',
    'REJECTED BY Pengawas',
    'REJECTED BY Admin Kabupaten',
    'REVOKED BY Pengawas',
    'SUBMITTED RESPONDENT',
    'COMPLETED BY Admin Kabupaten',
    'EDITED BY Admin Kabupaten'
]

STATUS_NORMALIZE = {
    'REVOKED BY ADMIN KABUPATEN': 'REVOKED BY Pengawas',
    'REVOKED BY PENGAWAS': 'REVOKED BY Pengawas',
    'APPROVED BY PENGAWAS': 'APPROVED BY Pengawas',
    'SUBMITTED BY PENCACAH': 'SUBMITTED BY Pencacah',
    'REJECTED BY PENGAWAS': 'REJECTED BY Pengawas',
    'REJECTED BY ADMIN KABUPATEN': 'REJECTED BY Admin Kabupaten',
    'COMPLETED BY ADMIN KABUPATEN': 'COMPLETED BY Admin Kabupaten',
    'EDITED BY ADMIN KABUPATEN': 'EDITED BY Admin Kabupaten',
    'SUBMITTED RESPONDENT': 'SUBMITTED RESPONDENT',
    'OPEN': 'OPEN',
    'DRAFT': 'DRAFT'
}

def get_wita_timestamp():
    now = datetime.now(wita_tz)
    months = {
        1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
        7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
    }
    return f"{now.day} {months[now.month]} {now.year} pukul {now.strftime('%H.%M')} WITA"

def format_custom_timestamp(raw_input: str) -> str:
    if not raw_input or not raw_input.strip():
        return get_wita_timestamp()
    
    raw = raw_input.strip()
    
    # If already in full format e.g. "22 Juli 2026 pukul 09.35 WITA"
    if "pukul" in raw and "WITA" in raw:
        return raw
    
    # If time pattern e.g. "09.35", "9.35", "09:35", "09.35 WITA"
    time_match = re.search(r'(\d{1,2})[:.](\d{2})', raw)
    if time_match:
        h, m = time_match.group(1).zfill(2), time_match.group(2)
        now = datetime.now(wita_tz)
        months = {
            1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
            7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
        }
        return f"{now.day} {months[now.month]} {now.year} pukul {h}.{m} WITA"
        
    return raw

def load_priority_sls():
    priority_file = os.path.join("data", "kdsls_prioritas.txt")
    if not os.path.exists(priority_file):
        print(f"Warning: Priority SLS file '{priority_file}' not found.")
        return set()
    try:
        with open(priority_file, "r", encoding="utf-8") as f:
            codes = {line.strip() for line in f if line.strip()}
        print(f"Loaded {len(codes)} priority SLS codes.")
        return codes
    except Exception as e:
        print(f"Error loading priority SLS codes: {e}")
        return set()

def load_pml_ppl_map():
    pml_ppl_file = os.path.join("data", "pml_ppl.csv")
    pml_ppl_map = {}
    if not os.path.exists(pml_ppl_file):
        print(f"Warning: '{pml_ppl_file}' not found.")
        return pml_ppl_map
    try:
        with open(pml_ppl_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                em = row.get('email', '').strip().lower()
                if em:
                    jabatan = row.get('jabatan_petugas', '').strip()
                    cat = 'Pengawas' if jabatan.upper() == 'PML' else 'Pencacah'
                    pml_ppl_map[em] = {
                        'nama_petugas': row.get('nama_petugas', '').strip(),
                        'jabatan_petugas': jabatan,
                        'category': cat
                    }
        print(f"Loaded {len(pml_ppl_map)} officer mappings from '{pml_ppl_file}'.")
    except Exception as e:
        print(f"Error reading pml_ppl file: {e}")
    return pml_ppl_map

def load_koseka_map():
    koseka_file = os.path.join("data", "koseka.csv")
    koseka_map = {}
    if not os.path.exists(koseka_file):
        print(f"Warning: '{koseka_file}' not found.")
        return koseka_map
    try:
        with open(koseka_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                kd_kec = row.get('kd_kec', '').strip()
                if kd_kec:
                    koseka_map[kd_kec] = {
                        'nama_kec': row.get('nama_kec', '').strip(),
                        'koseka': row.get('koseka', '').strip()
                    }
        print(f"Loaded {len(koseka_map)} subdistrict mappings from '{koseka_file}'.")
    except Exception as e:
        print(f"Error reading koseka file: {e}")
    return koseka_map

def parse_manual_markdown(md_path="data_manual_dashboard.md"):
    if not os.path.exists(md_path):
        print(f"Error: Manual markdown file '{md_path}' not found.")
        return {}

    with open(md_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f]

    pml_ppl_map = load_pml_ppl_map()
    records = {}

    current_email = ""
    current_sls = ""

    idx = 0
    while idx < len(lines):
        line = lines[idx].strip()
        if not line:
            idx += 1
            continue

        # Detect email line
        if '@' in line:
            current_email = line.lower()
            idx += 1
            continue

        # Skip header metadata lines
        if line == "Total Assignment":
            idx += 2
            continue

        # Detect 16-digit SLS Code
        if len(line) == 16 and line.isdigit():
            current_sls = line
            idx += 1
            continue

        # Detect status and count pair
        if current_email and current_sls:
            line_upper = line.upper()
            status_normalized = STATUS_NORMALIZE.get(line_upper, "")
            if status_normalized and idx + 1 < len(lines) and lines[idx + 1].isdigit():
                count = int(lines[idx + 1])
                idx += 2

                cat = pml_ppl_map.get(current_email, {}).get('category', 'Pencacah')
                key = (cat, current_email, current_sls)
                if key not in records:
                    records[key] = {col: 0 for col in STATUS_COLUMNS}
                records[key][status_normalized] += count
                continue

        idx += 1

    print(f"Parsed {len(records)} SLS records from '{md_path}'.")
    return records

def process_manual_data(md_path="data_manual_dashboard.md", output_csv="dashboard_scraped_data.csv", timestamp_input=None, auto_push=True):
    timestamp_str = format_custom_timestamp(timestamp_input)

    print("\n" + "=" * 60)
    print(f"PARSING MANUAL DASHBOARD DATA: '{md_path}' -> '{output_csv}'")
    print(f"Timestamp: {timestamp_str}")
    print("=" * 60)

    records = parse_manual_markdown(md_path)
    if not records:
        print("No valid records extracted.")
        return False

    pml_ppl_map = load_pml_ppl_map()
    koseka_map = load_koseka_map()
    priority_sls = load_priority_sls()

    headers = (
        ['Category', 'Email', 'SLS Code']
        + STATUS_COLUMNS
        + ['nama_petugas', 'jabatan_petugas', 'nama_kec', 'koseka', 'is_prioritas']
    )

    rows = []
    for (cat, email, sls), counts in records.items():
        nama_petugas = pml_ppl_map.get(email, {}).get('nama_petugas', '')
        jabatan_petugas = pml_ppl_map.get(email, {}).get('jabatan_petugas', '')

        digits_only = "".join([c for c in sls if c.isdigit()])
        kd_kec_7 = digits_only[:7]
        nama_kec = koseka_map.get(kd_kec_7, {}).get('nama_kec', '')
        koseka = koseka_map.get(kd_kec_7, {}).get('koseka', '')

        sls_14 = digits_only[:14]
        is_prioritas = "Ya" if sls_14 in priority_sls else "Tidak"

        row = (
            [cat, email, sls]
            + [counts.get(col, 0) for col in STATUS_COLUMNS]
            + [nama_petugas, jabatan_petugas, nama_kec, koseka, is_prioritas]
        )
        rows.append(row)

    # Write output CSV
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    print(f"Successfully generated '{output_csv}' with {len(rows)} rows.")

    # Copy to dashboard/public folder & update snapshots & timestamp
    public_dir = os.path.join("dashboard", "public")
    if os.path.exists(public_dir):
        dest_csv = os.path.join(public_dir, "dashboard_scraped_data.csv")
        shutil.copy2(output_csv, dest_csv)
        print(f"Copied '{output_csv}' to '{dest_csv}'.")

        # Handle snapshots based on cutoff time (13.00)
        process_data.save_snapshots_if_needed(public_dir)

        # Update last_updated.txt
        timestamp_file = os.path.join(public_dir, "last_updated.txt")
        with open(timestamp_file, "w", encoding="utf-8") as tf:
            tf.write(timestamp_str)
        print(f"Wrote timestamp '{timestamp_str}' to '{timestamp_file}'.")

        # Regenerate monitoring reports & Excel summary spreadsheets
        try:
            import generate_reports
            print("\nRegenerating monitoring reports and summary spreadsheets...")
            generate_reports.main()
        except Exception as report_err:
            print(f"Warning: Could not generate monitoring reports: {report_err}")

    # Automatically commit and push to GitHub
    if auto_push:
        process_data.run_git_commands(timestamp_str)

    return True

if __name__ == "__main__":
    time_arg = None
    if len(sys.argv) > 1:
        time_arg = " ".join(sys.argv[1:])
    elif sys.stdin.isatty():
        try:
            inp = input("Masukkan jam/waktu pengambilan data (misal: '09.35' atau '22 Juli 2026 pukul 09.35 WITA') [Default WITA sekarang]: ")
            time_arg = inp.strip() if inp.strip() else None
        except Exception:
            time_arg = None

    process_manual_data(timestamp_input=time_arg)
