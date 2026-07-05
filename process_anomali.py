import os
import json
import re
import pandas as pd

def parse_value(val):
    if pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, str):
        val_clean = val.strip()
        if not val_clean:
            return None
        # If it looks like a number with a comma as decimal, e.g. 0,24
        if ',' in val_clean and val_clean.replace(',', '').replace('-', '').replace('.', '').isdigit():
            try:
                return float(val_clean.replace(',', '.'))
            except ValueError:
                pass
        try:
            if val_clean.isdigit():
                return int(val_clean)
            return float(val_clean)
        except ValueError:
            return val_clean
    return val

def parse_txt_definitions(file_path):
    definitions = []
    if not os.path.exists(file_path):
        print(f"Warning: File {file_path} does not exist.")
        return definitions
        
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find all pattern like #1. Title \n Description
    pattern = re.compile(r'#(\d+)\.\s*(.*?)\n(.*?)(?=\n#\d+\.|\Z)', re.DOTALL)
    matches = pattern.findall(content)
    
    for match in matches:
        anomaly_id = int(match[0])
        title = match[1].strip()
        description = match[2].strip()
        definitions.append({
            "id": anomaly_id,
            "title": title,
            "description": description
        })
    return definitions

def process_aggregate_excel(file_path):
    if not os.path.exists(file_path):
        print(f"Warning: File {file_path} does not exist.")
        return None
        
    df = pd.read_excel(file_path, header=None)
    
    # 1. Update time is in Row 2 (index 1)
    time_cell = df.iloc[1, 0]
    last_updated = ""
    if isinstance(time_cell, str):
        match = re.search(r'Dicetak:\s*(.*)', time_cell)
        if match:
            last_updated = match.group(1).strip()
        else:
            last_updated = time_cell.strip()
            
    # 2. Column names are in Row 4 (index 3)
    columns = [str(x).strip() for x in df.iloc[3]]
    
    # 3. Data starts at Row 8 (index 7)
    # We want to filter Kecamatan (code length 7) and TOTAL row (no code, name TOTAL)
    data_rows = []
    total_row = None
    
    for idx in range(7, len(df)):
        row_val = df.iloc[idx]
        kode = row_val[0]
        kec = row_val[1]
        
        if pd.isna(kode) and pd.isna(kec):
            continue
            
        row_dict = {}
        for col_idx, col_name in enumerate(columns):
            row_dict[col_name] = parse_value(row_val[col_idx])
            
        if pd.isna(kode):
            if str(kec).strip().upper() == 'TOTAL':
                total_row = row_dict
        else:
            # Clean code representation
            kode_str = str(int(kode)) if isinstance(kode, (int, float)) else str(kode).strip()
            if len(kode_str) == 7: # Kecamatan level
                data_rows.append(row_dict)
                
    return {
        "last_updated": last_updated,
        "columns": columns,
        "data": data_rows,
        "total": total_row
    }

def process_detail_excel(file_path):
    if not os.path.exists(file_path):
        print(f"Warning: File {file_path} does not exist.")
        return None
        
    df = pd.read_excel(file_path, header=None)
    
    # 1. Update time is in Row 2 (index 1)
    time_cell = df.iloc[1, 0]
    last_updated = ""
    if isinstance(time_cell, str):
        match = re.search(r'Dicetak:\s*(.*)', time_cell)
        if match:
            last_updated = match.group(1).strip()
        else:
            last_updated = time_cell.strip()
            
    # 2. Column names are in Row 4 (index 3)
    columns = [str(x).strip() for x in df.iloc[3]]
    
    # 3. Data starts at Row 6 (index 5)
    data_rows = []
    for idx in range(5, len(df)):
        row_val = df.iloc[idx]
        if pd.isna(row_val[0]) and pd.isna(row_val[1]):
            continue
            
        row_dict = {}
        for col_idx, col_name in enumerate(columns):
            val = row_val[col_idx]
            if pd.isna(val):
                row_dict[col_name] = None
            else:
                # Convert specific types if necessary (like No)
                if col_name == 'No' and isinstance(val, (int, float)):
                    row_dict[col_name] = int(val)
                else:
                    row_dict[col_name] = val
        data_rows.append(row_dict)
        
    return {
        "last_updated": last_updated,
        "columns": columns,
        "data": data_rows
    }

def main():
    print("Processing Anomali data files...")
    
    # Output directory
    output_dir = os.path.join("dashboard", "public", "anomali")
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Process Text files
    print("Parsing text definitions...")
    jenis_keluarga = parse_txt_definitions(os.path.join("data", "anomali", "jenis_anomali_keluarga.txt"))
    jenis_usaha = parse_txt_definitions(os.path.join("data", "anomali", "jenis_anomali_usaha.txt"))
    
    with open(os.path.join(output_dir, "jenis_keluarga.json"), "w", encoding="utf-8") as f:
        json.dump(jenis_keluarga, f, indent=2, ensure_ascii=False)
        
    with open(os.path.join(output_dir, "jenis_usaha.json"), "w", encoding="utf-8") as f:
        json.dump(jenis_usaha, f, indent=2, ensure_ascii=False)
        
    # 2. Process Aggregate files
    print("Processing aggregate excel files...")
    agregat_keluarga = process_aggregate_excel(os.path.join("data", "anomali", "agregat_anomali_keluarga_per_kecamatan.xlsx"))
    agregat_usaha = process_aggregate_excel(os.path.join("data", "anomali", "agregat_anomali_usaha_per_kecamatan.xlsx"))
    
    if agregat_keluarga:
        with open(os.path.join(output_dir, "agregat_keluarga.json"), "w", encoding="utf-8") as f:
            json.dump(agregat_keluarga, f, indent=2, ensure_ascii=False)
            
    if agregat_usaha:
        with open(os.path.join(output_dir, "agregat_usaha.json"), "w", encoding="utf-8") as f:
            json.dump(agregat_usaha, f, indent=2, ensure_ascii=False)
            
    # 3. Process Detail files
    print("Processing detail excel files...")
    detail_keluarga = process_detail_excel(os.path.join("data", "anomali", "anomali_keluarga.xlsx"))
    detail_usaha = process_detail_excel(os.path.join("data", "anomali", "anomali_usaha.xlsx"))
    
    if detail_keluarga:
        with open(os.path.join(output_dir, "detail_keluarga.json"), "w", encoding="utf-8") as f:
            json.dump(detail_keluarga, f, indent=2, ensure_ascii=False)
            
    if detail_usaha:
        with open(os.path.join(output_dir, "detail_usaha.json"), "w", encoding="utf-8") as f:
            json.dump(detail_usaha, f, indent=2, ensure_ascii=False)
            
    print("Data processing finished successfully!")
    
    # Run automatic Git commands
    run_git_commands()

def run_git_commands():
    import subprocess
    from datetime import datetime, timezone, timedelta
    
    print("\n" + "="*50)
    print("STARTING AUTOMATIC GIT PUSH FOR ANOMALY DATA")
    print("="*50)
    
    try:
        # Check if inside a git repo
        git_check = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], capture_output=True, text=True)
        if git_check.returncode != 0:
            print("Warning: Not a Git repository or Git is not installed. Skipping push.")
            return

        # Files to add (both inputs in data/anomali and outputs in dashboard/public/anomali)
        files_to_add = [
            # Inputs
            os.path.join("data", "anomali", "agregat_anomali_keluarga_per_kecamatan.xlsx"),
            os.path.join("data", "anomali", "agregat_anomali_usaha_per_kecamatan.xlsx"),
            os.path.join("data", "anomali", "anomali_keluarga.xlsx"),
            os.path.join("data", "anomali", "anomali_usaha.xlsx"),
            os.path.join("data", "anomali", "jenis_anomali_keluarga.txt"),
            os.path.join("data", "anomali", "jenis_anomali_usaha.txt"),
            # Outputs
            os.path.join("dashboard", "public", "anomali", "jenis_keluarga.json"),
            os.path.join("dashboard", "public", "anomali", "jenis_usaha.json"),
            os.path.join("dashboard", "public", "anomali", "agregat_keluarga.json"),
            os.path.join("dashboard", "public", "anomali", "agregat_usaha.json"),
            os.path.join("dashboard", "public", "anomali", "detail_keluarga.json"),
            os.path.join("dashboard", "public", "anomali", "detail_usaha.json")
        ]
        
        # Check existing
        existing_files = [f for f in files_to_add if os.path.exists(f)]
        if not existing_files:
            print("No anomaly files found to commit.")
            return
            
        # Git add
        print(f"Staging {len(existing_files)} anomaly files to git...")
        subprocess.run(["git", "add"] + existing_files, check=True)
        
        # Check if there are changes
        status_check = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if status_check.returncode == 0:
            print("No changes detected in anomaly files. Skipping git commit/push.")
            return
            
        # Timestamp (WITA: UTC+8)
        wita_tz = timezone(timedelta(hours=8))
        now = datetime.now(wita_tz)
        months = {
            1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
            7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
        }
        timestamp_str = f"{now.day} {months[now.month]} {now.year} pukul {now.strftime('%H.%M')} WITA"
        
        commit_msg = f"Update data anomali: {timestamp_str}"
        print(f"Committing changes with message: '{commit_msg}'...")
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)
        
        print("Pushing to GitHub...")
        subprocess.run(["git", "push"], check=True)
        print("Git push completed successfully!")
    except Exception as e:
        print(f"Warning: Failed to execute Git commands: {e}")

if __name__ == "__main__":
    main()
