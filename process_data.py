import os
import csv
import shutil
import subprocess
from datetime import datetime, timezone, timedelta

# Capture execution start time (WITA is UTC+8)
wita_tz = timezone(timedelta(hours=8))
START_TIME = datetime.now(wita_tz)

def get_wita_timestamp():
    # Central Indonesian Time (WITA) is UTC+8
    now = START_TIME
    
    months = {
        1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
        7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
    }
    
    day = now.day
    month_name = months[now.month]
    year = now.year
    hour_minute = now.strftime("%H.%M")
    
    return f"{day} {month_name} {year} pukul {hour_minute} WITA"

def normalize_scale(scale_str):
    if not scale_str:
        return "Keluarga"
    
    s = scale_str.strip().upper()
    if not s or s == "-" or s == "TIDAK TERIDENTIFIKASI":
        return "Keluarga"
        
    if "DUMMY" in s:
        return "UMKM/Dummy"
        
    if "BANGUNAN_LAIN" in s or "BANGUNAN LAIN" in s:
        return "UMKM Bangunan Lain"
        
    if "KELUARGA" in s:
        if "UMKM" in s:
            return "UMKM/Keluarga"
        return "Keluarga"
        
    if "UMK" in s:
        return "UMK"
        
    if s == "UM":
        return "UM"
        
    if s == "UB":
        return "UB"
        
    if "UMKM" in s:
        return "UMKM/Keluarga"
        
    return "Keluarga"

def run_git_commands(timestamp_str):
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print("Running in GitHub Actions. Skipping local git commands.")
        return
    print("Starting automatic Git push...")
    try:
        # Check if we are inside a git repository
        git_check = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], capture_output=True, text=True)
        if git_check.returncode != 0:
            print("Warning: Not a Git repository or Git is not installed. Skipping push.")
            return

        # Add files to git
        files_to_add = [
            "scraped_data.csv",
            "update_data.csv",
            "dashboard_scraped_data.csv",
            "dashboard_scraped_data_morning.csv",
            "dashboard_scraped_data_morning_prev.csv",
            "dashboard_scraped_data_evening.csv",
            os.path.join("data", "pml_ppl.csv"),
            os.path.join("data", "ringkasan_Assign.csv"),
            os.path.join("data", "ringkasan_Progres.csv"),
            os.path.join("dashboard", "public", "update_data.csv"),
            os.path.join("dashboard", "public", "dashboard_scraped_data.csv"),
            os.path.join("dashboard", "public", "dashboard_scraped_data_morning.csv"),
            os.path.join("dashboard", "public", "dashboard_scraped_data_morning_prev.csv"),
            os.path.join("dashboard", "public", "dashboard_scraped_data_evening.csv"),
            os.path.join("dashboard", "public", "pml_ppl.csv"),
            os.path.join("dashboard", "public", "koseka.csv"),
            os.path.join("dashboard", "public", "ringkasan_Assign.csv"),
            os.path.join("dashboard", "public", "ringkasan_Progres.csv"),
            os.path.join("dashboard", "public", "last_updated.txt")
        ]
        
        import glob
        json_files = glob.glob(os.path.join("dashboard", "public", "data_mikro", "*.json"))
        files_to_add.extend(json_files)
        
        # Add all public reports, spreadsheets, and JSON files
        public_xlsx = glob.glob(os.path.join("dashboard", "public", "*.xlsx"))
        public_json = glob.glob(os.path.join("dashboard", "public", "*.json"))
        files_to_add.extend(public_xlsx)
        files_to_add.extend(public_json)
        
        # Check which files exist and add them
        existing_files = [f for f in files_to_add if os.path.exists(f)]
        if not existing_files:
            print("No output files found to commit.")
            return
            
        subprocess.run(["git", "add"] + existing_files, check=True)
        
        # Check if there are changes staged for commit
        status_check = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if status_check.returncode == 0:
            print("No changes detected in data files. Skipping git commit/push.")
            return
            
        commit_msg = f"Update data: {timestamp_str}"
        print(f"Committing changes with message: '{commit_msg}'...")
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)
        
        print("Pushing to GitHub...")
        subprocess.run(["git", "push"], check=True)
        print("Git push completed successfully!")
    except Exception as e:
        print(f"Warning: Failed to execute Git commands: {e}")

def save_snapshots_if_needed(public_dir=None):
    if not public_dir:
        public_dir = os.path.join("dashboard", "public")
    
    dashboard_scraped_src = "dashboard_scraped_data.csv"
    if os.path.exists(dashboard_scraped_src):
        morning_dest = "dashboard_scraped_data_morning.csv"
        morning_prev_dest = "dashboard_scraped_data_morning_prev.csv"
        evening_dest = "dashboard_scraped_data_evening.csv"
        
        # Ensure destination folder in dashboard/public exists
        os.makedirs(public_dir, exist_ok=True)
        
        # WITA is UTC+8
        now = datetime.now(wita_tz)
        hour = now.hour
        
        # Cutoff is 13:00 (1 PM WITA)
        if hour < 13:
            # If current morning snapshot exists, only copy it to morning_prev if its modification date is not today
            if os.path.exists(morning_dest):
                import datetime as dt
                mtime = os.path.getmtime(morning_dest)
                mtime_dt = dt.datetime.fromtimestamp(mtime, wita_tz)
                if mtime_dt.date() != now.date():
                    shutil.copy2(morning_dest, morning_prev_dest)
                    shutil.copy2(morning_dest, os.path.join(public_dir, "dashboard_scraped_data_morning_prev.csv"))
                    print("Rotated morning snapshot (from previous day) to morning_prev.")
                else:
                    print("Morning snapshot already exists for today. Skipping rotation to morning_prev to avoid overwriting yesterday's data.")
                
            shutil.copy2(dashboard_scraped_src, morning_dest)
            shutil.copy2(dashboard_scraped_src, os.path.join(public_dir, "dashboard_scraped_data_morning.csv"))
            print(f"Updated morning snapshot '{morning_dest}' (hour {hour})")
        else:
            shutil.copy2(dashboard_scraped_src, evening_dest)
            shutil.copy2(dashboard_scraped_src, os.path.join(public_dir, "dashboard_scraped_data_evening.csv"))
            print(f"Updated evening snapshot '{evening_dest}' (hour {hour})")
            
        # Fallback initialization: if either file doesn't exist yet, populate it to avoid UI errors
        if not os.path.exists(morning_dest):
            shutil.copy2(dashboard_scraped_src, morning_dest)
            shutil.copy2(dashboard_scraped_src, os.path.join(public_dir, "dashboard_scraped_data_morning.csv"))
            print(f"Initialized morning snapshot fallback")
        if not os.path.exists(morning_prev_dest):
            shutil.copy2(dashboard_scraped_src, morning_prev_dest)
            shutil.copy2(dashboard_scraped_src, os.path.join(public_dir, "dashboard_scraped_data_morning_prev.csv"))
            print(f"Initialized morning_prev snapshot fallback")
        if not os.path.exists(evening_dest):
            shutil.copy2(dashboard_scraped_src, evening_dest)
            shutil.copy2(dashboard_scraped_src, os.path.join(public_dir, "dashboard_scraped_data_evening.csv"))
            print(f"Initialized evening snapshot fallback")

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

def process_dashboard_scraped_data(priority_sls=None):
    if priority_sls is None:
        priority_sls = load_priority_sls()
    scraped_file = "dashboard_scraped_data.csv"
    koseka_file = os.path.join("data", "koseka.csv")
    pml_ppl_file = os.path.join("data", "pml_ppl.csv")
    
    print("\n" + "="*50)
    print("PROCESSING DASHBOARD SCRAPED DATA")
    print("="*50)
    
    if not os.path.exists(scraped_file):
        print(f"Error: Dashboard scraped file '{scraped_file}' not found. Cannot process.")
        return False
        
    if not os.path.exists(koseka_file):
        print(f"Error: Koseka mapping file '{koseka_file}' not found. Cannot process.")
        return False
        
    if not os.path.exists(pml_ppl_file):
        print(f"Error: PML PPL file '{pml_ppl_file}' not found. Cannot process.")
        return False

    # 1. Load subdistrict and Koseka mapping
    print(f"Loading subdistrict and Koseka mapping from '{koseka_file}'...")
    koseka_map = {}
    try:
        with open(koseka_file, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                kd_kec = row.get('kd_kec', '').strip()
                if kd_kec:
                    koseka_map[kd_kec] = {
                        'nama_kec': row.get('nama_kec', '').strip(),
                        'koseka': row.get('koseka', '').strip()
                    }
        print(f"Loaded {len(koseka_map)} subdistrict mappings.")
    except Exception as e:
        print(f"Error reading koseka file: {e}")
        return False

    # 2. Load PML PPL mapping
    print(f"Loading PML PPL mapping from '{pml_ppl_file}'...")
    pml_ppl_map = {}
    try:
        with open(pml_ppl_file, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                email = row.get('email', '').strip().lower()
                if email:
                    pml_ppl_map[email] = {
                        'nama_petugas': row.get('nama_petugas', '').strip(),
                        'jabatan_petugas': row.get('jabatan_petugas', '').strip()
                    }
        print(f"Loaded {len(pml_ppl_map)} PML PPL mappings.")
    except Exception as e:
        print(f"Error reading pml_ppl file: {e}")
        return False

    # 3. Read and process dashboard_scraped_data.csv
    print(f"Processing '{scraped_file}'...")
    processed_rows = []
    headers = []
    try:
        with open(scraped_file, mode='r', encoding='utf-8') as infile:
            reader = csv.reader(infile)
            try:
                headers = next(reader)
            except StopIteration:
                print("Error: dashboard_scraped_data.csv is empty.")
                return False
            
            # Determine base headers dynamically (Category, Email, SLS Code + Status columns)
            additional_headers = ['nama_petugas', 'jabatan_petugas', 'nama_kec', 'koseka', 'is_prioritas']
            if 'nama_petugas' in headers:
                base_len = headers.index('nama_petugas')
            else:
                base_len = 13  # Category, Email, SLS Code + 10 status columns
            base_headers = headers[:base_len]
            output_headers = base_headers + additional_headers
            
            email_idx = 1
            sls_idx = 2
            
            for row in reader:
                if not row or len(row) < 3:
                    continue
                
                base_row = row[:base_len]
                while len(base_row) < base_len:
                    base_row.append('0')
                
                email = base_row[email_idx].strip().lower()
                sls_code = base_row[sls_idx].strip()
                
                # Match email in PML PPL map
                nama_petugas = ""
                jabatan_petugas = ""
                if email in pml_ppl_map:
                    nama_petugas = pml_ppl_map[email]['nama_petugas']
                    jabatan_petugas = pml_ppl_map[email]['jabatan_petugas']
                
                # Match SLS Code in Koseka map
                digits_only = "".join([c for c in sls_code if c.isdigit()])
                kd_kec_7 = digits_only[:7]
                
                nama_kec = ""
                koseka = ""
                if kd_kec_7 in koseka_map:
                    nama_kec = koseka_map[kd_kec_7]['nama_kec']
                    koseka = koseka_map[kd_kec_7]['koseka']
                
                # Match SLS Code in priority set
                sls_14 = digits_only[:14]
                is_prioritas = "Ya" if sls_14 in priority_sls else "Tidak"
                
                new_row = base_row + [nama_petugas, jabatan_petugas, nama_kec, koseka, is_prioritas]
                processed_rows.append(new_row)
                
        # Write processed data back to dashboard_scraped_data.csv
        with open(scraped_file, mode='w', newline='', encoding='utf-8') as outfile:
            writer = csv.writer(outfile)
            writer.writerow(output_headers)
            writer.writerows(processed_rows)
            
        print(f"Successfully processed '{scraped_file}' with {len(processed_rows)} rows.")
        return True
    except Exception as e:
        print(f"Error processing dashboard scraped data: {e}")
        return False

def process_data(completed_emails=None, scraped_file="scraped_data.csv", output_file="update_data.csv"):
    koseka_file = os.path.join("data", "koseka.csv")
    
    print("\n" + "="*50)
    print("STARTING DATA PROCESSING PIPELINE")
    print("="*50)
    
    if not os.path.exists(scraped_file):
        print(f"Error: Scraped data file '{scraped_file}' not found. Cannot process.")
        return False
        
    if not os.path.exists(koseka_file):
        print(f"Error: Koseka mapping file '{koseka_file}' not found. Cannot process.")
        return False
        
    # Load priority SLS codes
    priority_sls = load_priority_sls()

    # Determine completed emails
    if completed_emails is None:
        checkpoint_file = "checkpoint.json"
        if os.path.exists(checkpoint_file):
            try:
                import json
                with open(checkpoint_file, "r") as f:
                    cp = json.load(f)
                    completed_emails = cp.get("completed_emails", [])
            except Exception as e:
                print(f"Warning loading checkpoint in process_data: {e}")
        
        if not completed_emails and os.path.exists(scraped_file):
            try:
                with open(scraped_file, "r", encoding="utf-8") as f:
                    reader = csv.reader(f)
                    header = next(reader, None)
                    if header and "Searched Email" in header:
                        email_idx = header.index("Searched Email")
                        unique_emails = set()
                        for row in reader:
                            if row and len(row) > email_idx:
                                email_val = row[email_idx].strip()
                                if email_val:
                                    unique_emails.add(email_val.lower())
                        completed_emails = list(unique_emails)
                        print(f"Detected {len(completed_emails)} unique completed emails from '{scraped_file}'.")
            except Exception as e:
                print(f"Warning scanning scraped_data.csv for emails: {e}")

    completed_emails_lower = {email.strip().lower() for email in completed_emails} if completed_emails else set()

    # 1. Load subdistrict and Koseka mapping
    print(f"Loading subdistrict and Koseka mapping from '{koseka_file}'...")
    koseka_map = {}
    try:
        with open(koseka_file, mode='r', encoding='utf-8') as f:
            # Semicolon delimited
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                kd_kec = row.get('kd_kec', '').strip()
                if kd_kec:
                    koseka_map[kd_kec] = {
                        'nama_kec': row.get('nama_kec', '').strip(),
                        'koseka': row.get('koseka', '').strip()
                    }
        print(f"Loaded {len(koseka_map)} subdistrict mappings.")
    except Exception as e:
        print(f"Error reading koseka file: {e}")
        return False

    # 2. Process scraped_data.csv and merge with existing output_file
    print(f"Processing, mapping, and merging '{scraped_file}'...")
    rows_written = 0
    try:
        # Load existing data from update_data.csv if it exists
        existing_data = {}
        headers = []
        id_code_idx = 1
        searched_email_idx = 0
        
        if os.path.exists(output_file):
            print(f"Found existing '{output_file}'. Loading data for merging...")
            try:
                with open(output_file, mode='r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    try:
                        headers = next(reader)
                        if 'Kode Identitas' in headers:
                            id_code_idx = headers.index('Kode Identitas')
                        if 'Searched Email' in headers:
                            searched_email_idx = headers.index('Searched Email')
                    except StopIteration:
                        headers = []
                    
                    for row in reader:
                        if not row or len(row) <= id_code_idx:
                            continue
                        id_code = row[id_code_idx].strip()
                        if id_code:
                            if len(row) > 7:
                                row[7] = normalize_scale(row[7])
                            existing_data[id_code] = row
                print(f"Loaded {len(existing_data)} existing records from '{output_file}'.")
            except Exception as e:
                print(f"Warning: Could not read existing output file for merging: {e}")
        
        # Overwrite-only mode: do not delete previous records for completed emails, just overwrite/update them.
        if completed_emails_lower:
            print(f"Overwrite-only mode: preserving all existing records. Previous records for {len(completed_emails_lower)} completed/scraped emails will be updated/overwritten if found in the new scraped data.")

        # Read new scraped data
        with open(scraped_file, mode='r', encoding='utf-8') as infile:
            reader = csv.reader(infile)
            try:
                new_headers = next(reader)
                headers = new_headers + ['sumber data', 'nama_kec', 'koseka', 'is_prioritas']
                if 'Kode Identitas' in new_headers:
                    new_id_code_idx = new_headers.index('Kode Identitas')
                else:
                    new_id_code_idx = 1
                
                new_email_idx = 0
                if 'Searched Email' in new_headers:
                    new_email_idx = new_headers.index('Searched Email')
            except StopIteration:
                print("Error: scraped_data.csv is empty.")
                return False
            
            new_rows_count = 0
            updated_rows_count = 0
            for row in reader:
                if not row or len(row) <= new_id_code_idx:
                    continue
                
                id_code = row[new_id_code_idx].strip()
                if not id_code:
                    continue  # Skip empty/invalid identity codes
                
                # Check if this row belongs to a completed email. If not, skip it!
                if completed_emails_lower:
                    row_email = row[new_email_idx].strip().lower()
                    if row_email not in completed_emails_lower:
                        continue
                
                if len(row) > 7:
                    row[7] = normalize_scale(row[7])
                
                # Extract digits to match with kd_kec
                digits_only = "".join([c for c in id_code if c.isdigit()])
                kd_kec_7 = digits_only[:7]
                
                nama_kec = ""
                koseka = ""
                if kd_kec_7 in koseka_map:
                    nama_kec = koseka_map[kd_kec_7]['nama_kec']
                    koseka = koseka_map[kd_kec_7]['koseka']
                
                # We will process is_prioritas when writing all rows
                mapped_row = row + [nama_kec, koseka]
                
                if id_code in existing_data:
                    updated_rows_count += 1
                else:
                    new_rows_count += 1
                
                existing_data[id_code] = mapped_row
                
        print(f"Scraped data processed: {updated_rows_count} records updated, {new_rows_count} new records added.")
        
        # Prepare list of rows to write and normalize columns to exactly 19 (15 base + 1 new base + 3 extra)
        rows_to_write = []
        for id_code, row in existing_data.items():
            base_row = row[:15]
            while len(base_row) < 15:
                base_row.append("")
                
            digits_only = "".join([c for c in id_code if c.isdigit()])
            kd_kec_7 = digits_only[:7]
            sls_14 = digits_only[:14]
            
            nama_kec = ""
            koseka = ""
            if kd_kec_7 in koseka_map:
                nama_kec = koseka_map[kd_kec_7]['nama_kec']
                koseka = koseka_map[kd_kec_7]['koseka']
                
            is_prioritas = "Ya" if sls_14 in priority_sls else "Tidak"
            
            # Extract sumber data from id_code (e.g. 7103090014000100 - DTSEN - 45 -> DTSEN)
            parts = id_code.split(" - ")
            sumber_data = parts[1].strip() if len(parts) > 1 else ""
            
            rows_to_write.append(base_row + [sumber_data, nama_kec, koseka, is_prioritas])
        
        # Write merged/updated records back to update_data.csv
        with open(output_file, mode='w', newline='', encoding='utf-8') as outfile:
            writer = csv.writer(outfile)
            writer.writerow(headers)
            writer.writerows(rows_to_write)
            
        rows_written = len(rows_to_write)
        print(f"Successfully merged and created '{output_file}' with {rows_written} rows.")
        
        # Also write the merged raw data back to scraped_data.csv (excluding the last four columns: sumber data, nama_kec, koseka, is_prioritas)
        raw_headers = headers[:-4] if len(headers) > 4 else headers
        raw_rows = [row[:-4] if len(row) > 4 else row for row in rows_to_write]
        
        with open(scraped_file, mode='w', newline='', encoding='utf-8') as sf:
            writer = csv.writer(sf)
            writer.writerow(raw_headers)
            writer.writerows(raw_rows)
        print(f"Successfully updated '{scraped_file}' with {len(raw_rows)} merged rows.")
        
    except Exception as e:
        print(f"Error mapping and merging scraped data: {e}")
        return False

    # 2b. Process dashboard scraped data
    process_dashboard_scraped_data(priority_sls)

    # 3. Copy to Next.js dashboard public folder & write timestamp
    public_dir = os.path.join("dashboard", "public")
    if os.path.exists(public_dir):
        print(f"Copying files to dashboard public directory...")
        try:
            # Copy CSV
            shutil.copy2(output_file, os.path.join(public_dir, "update_data.csv"))
            print(f"Copied '{output_file}' to dashboard public folder.")
            
            # Copy dashboard_scraped_data.csv & handle snapshots
            dashboard_scraped_src = "dashboard_scraped_data.csv"
            if os.path.exists(dashboard_scraped_src):
                shutil.copy2(dashboard_scraped_src, os.path.join(public_dir, "dashboard_scraped_data.csv"))
                print(f"Copied '{dashboard_scraped_src}' to dashboard public folder.")
                save_snapshots_if_needed(public_dir)
            
            # Copy PML PPL CSV
            pml_ppl_src = os.path.join("data", "pml_ppl.csv")
            if os.path.exists(pml_ppl_src):
                shutil.copy2(pml_ppl_src, os.path.join(public_dir, "pml_ppl.csv"))
                print(f"Copied '{pml_ppl_src}' to dashboard public folder.")
            
            # Copy Koseka CSV
            koseka_src = os.path.join("data", "koseka.csv")
            if os.path.exists(koseka_src):
                shutil.copy2(koseka_src, os.path.join(public_dir, "koseka.csv"))
                print(f"Copied '{koseka_src}' to dashboard public folder.")
            
            # Copy ringkasan_Assign.csv
            assign_src = os.path.join("data", "ringkasan_Assign.csv")
            if os.path.exists(assign_src):
                shutil.copy2(assign_src, os.path.join(public_dir, "ringkasan_Assign.csv"))
                print(f"Copied '{assign_src}' to dashboard public folder.")
            
            # Copy ringkasan_Progres.csv
            progres_src = os.path.join("data", "ringkasan_Progres.csv")
            if os.path.exists(progres_src):
                shutil.copy2(progres_src, os.path.join(public_dir, "ringkasan_Progres.csv"))
                print(f"Copied '{progres_src}' to dashboard public folder.")
            
            # Generate and write timestamp
            timestamp = get_wita_timestamp()
            timestamp_file = os.path.join(public_dir, "last_updated.txt")
            with open(timestamp_file, "w", encoding="utf-8") as tf:
                tf.write(timestamp)
            print(f"Wrote timestamp '{timestamp}' to '{timestamp_file}'.")
            
            # Convert Excel data mikro to JSON
            try:
                import process_data_mikro
                process_data_mikro.convert_excel_to_json()
            except Exception as json_err:
                print(f"Warning: Could not convert Excel data mikro to JSON: {json_err}")
                
            # Generate Excel and JSON reports
            try:
                import generate_reports
                generate_reports.main()
            except Exception as report_err:
                print(f"Warning: Could not generate reports: {report_err}")
                
            # Trigger Git automation
            run_git_commands(timestamp)
            
        except Exception as copy_err:
            print(f"Warning: Could not copy files to dashboard public folder or push to Git: {copy_err}")
    else:
        print(f"Warning: Dashboard public directory '{public_dir}' not found. Skipping copy and git push.")
        
    print("="*50 + "\n")
    return True

if __name__ == "__main__":
    process_data()
