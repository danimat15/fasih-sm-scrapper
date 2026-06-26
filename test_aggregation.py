import csv
import os
import re

def main():
    detail_file = "scraped_data.csv"
    dashboard_file = "dashboard_scraped_data.csv"
    
    if not os.path.exists(detail_file) or not os.path.exists(dashboard_file):
        print("Files not found.")
        return
        
    status_columns = [
        "OPEN", 
        "DRAFT", 
        "SUBMITTED BY Pencacah", 
        "REJECTED BY Pengawas", 
        "APPROVED BY Pengawas",
        "REVOKED BY Pengawas"
    ]
    
    # Let's aggregate from detail_file
    aggregated = {}
    
    status_mapping = {
        "open": "OPEN",
        "draft": "DRAFT",
        "submitted by pencacah": "SUBMITTED BY Pencacah",
        "rejected by pengawas": "REJECTED BY Pengawas",
        "approved by pengawas": "APPROVED BY Pengawas",
        "revoked by pengawas": "REVOKED BY Pengawas",
    }
    
    with open(detail_file, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        
        id_idx = header.index("Kode Identitas")
        status_idx = header.index("Status")
        petugas_idx = header.index("Petugas Saat Ini")
        searched_email_idx = header.index("Searched Email")
        
        for idx, row in enumerate(reader):
            if not row or len(row) <= max(id_idx, status_idx, petugas_idx, searched_email_idx):
                continue
                
            id_code = row[id_idx].strip()
            # Extract 16-digit SLS code
            match_sls = re.match(r"^(\d{16})", id_code)
            if not match_sls:
                continue
            sls_code = match_sls.group(1)
            
            status = row[status_idx].strip().lower()
            mapped_status = status_mapping.get(status)
            if not mapped_status:
                continue
                
            petugas_raw = row[petugas_idx].strip()
            
            # Determine category and email
            if petugas_raw.endswith("Pencacah"):
                category = "Pencacah"
                email = petugas_raw[:-8].lower()
            elif petugas_raw.endswith("Pengawas"):
                category = "Pengawas"
                email = petugas_raw[:-8].lower()
            else:
                # fallback
                category = "Pencacah"
                email = row[searched_email_idx].strip().lower()
                
            key = (category, email, sls_code)
            if key not in aggregated:
                aggregated[key] = {col: 0 for col in status_columns}
            aggregated[key][mapped_status] += 1

    print(f"Aggregated {len(aggregated)} unique records from detail CSV.")
    
    # Load dashboard file to compare
    original_dash = {}
    with open(dashboard_file, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if not row or len(row) < 9:
                continue
            cat = row[0].strip()
            email = row[1].strip().lower()
            sls = row[2].strip()
            
            key = (cat, email, sls)
            original_dash[key] = {
                "OPEN": int(row[3]),
                "DRAFT": int(row[4]),
                "SUBMITTED BY Pencacah": int(row[5]),
                "REJECTED BY Pengawas": int(row[6]),
                "APPROVED BY Pengawas": int(row[7]),
                "REVOKED BY Pengawas": int(row[8])
            }
            
    print(f"Loaded {len(original_dash)} records from existing dashboard CSV.")
    
    # Compare common keys
    matches = 0
    mismatches = 0
    common_keys = set(aggregated.keys()) & set(original_dash.keys())
    print(f"Intersection of keys: {len(common_keys)}")
    
    for key in list(common_keys)[:10]:
        print(f"\nKey: {key}")
        print(f"  Aggregated: {aggregated[key]}")
        print(f"  Original  : {original_dash[key]}")
        
    for key in common_keys:
        if aggregated[key] == original_dash[key]:
            matches += 1
        else:
            mismatches += 1
            
    print(f"\nMatches: {matches}, Mismatches: {mismatches}")

if __name__ == "__main__":
    main()
