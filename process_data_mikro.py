import os
import pandas as pd
import json
import glob

def clean_dataframe(df):
    # Convert all columns to standard types and replace NaN with appropriate values
    df_clean = df.copy()
    # Replace NaN with 0 for numeric columns, and empty string for text columns
    for col in df_clean.columns:
        if pd.api.types.is_numeric_dtype(df_clean[col]):
            df_clean[col] = df_clean[col].fillna(0)
            # Convert float to int if they are integers (e.g. counts)
            if (df_clean[col] % 1 == 0).all():
                df_clean[col] = df_clean[col].astype(int)
        else:
            df_clean[col] = df_clean[col].fillna("").astype(str).str.strip()
            # Clean up potential string representation of NaNs
            df_clean[col] = df_clean[col].replace({"nan": "", "NaN": "", "None": ""})
    return df_clean

def convert_excel_to_json():
    src_dir = os.path.join("research", "fasih-dashboard-se2026", "data_mikro_sls")
    dest_dir = os.path.join("dashboard", "public", "data_mikro")
    os.makedirs(dest_dir, exist_ok=True)
    
    print(f"Mengonversi file Excel dari: {src_dir}")
    print(f"Menyimpan file JSON ke: {dest_dir}")
    
    # List of aggregations we want to export
    aggregations = [
        # Skala Usaha
        {"file": "Agregat_Kecamatan_SKALA USAHA.xlsx", "out": "kecamatan_skala_usaha.json"},
        {"file": "Agregat_Petugas_SKALA USAHA.xlsx", "out": "petugas_skala_usaha.json"},
        
        # Usaha Perusahaan & Keluarga (Keberadaan Usaha)
        {"file": "Agregat_Kecamatan_USAHA PERUSAHAAN.xlsx", "out": "kecamatan_usaha_perusahaan.json"},
        {"file": "Agregat_Petugas_USAHA PERUSAHAAN.xlsx", "out": "petugas_usaha_perusahaan.json"},
        {"file": "Agregat_Kecamatan_USAHA KELUARGA.xlsx", "out": "kecamatan_usaha_keluarga.json"},
        {"file": "Agregat_Petugas_USAHA KELUARGA.xlsx", "out": "petugas_usaha_keluarga.json"},
        {"file": "Agregat_Kecamatan_JARINGAN USAHA.xlsx", "out": "kecamatan_jaringan_usaha.json"},
        {"file": "Agregat_Petugas_JARINGAN USAHA.xlsx", "out": "petugas_jaringan_usaha.json"},
        
        # Sektor Pertanian vs Non-Pertanian
        {"file": "Agregat_Kecamatan_PROPORSI PERTANIAN NON PERTANIA.xlsx", "out": "kecamatan_sektor_usaha.json"},
        {"file": "Agregat_Petugas_PROPORSI PERTANIAN NON PERTANIA.xlsx", "out": "petugas_sektor_usaha.json"},
        
        # Keluarga & Anggota Keluarga
        {"file": "Agregat_Kecamatan_KELUARGA.xlsx", "out": "kecamatan_keluarga.json"},
        {"file": "Agregat_Petugas_KELUARGA.xlsx", "out": "petugas_keluarga.json"},
        {"file": "Agregat_Kecamatan_ANGGOTA KELUARGA.xlsx", "out": "kecamatan_anggota_keluarga.json"},
        {"file": "Agregat_Petugas_ANGGOTA KELUARGA.xlsx", "out": "petugas_anggota_keluarga.json"},
        
        # Progres umum
        {"file": "Agregat_Kecamatan_PROGRES PENDATAAN.xlsx", "out": "kecamatan_progres_pendataan.json"},
        {"file": "Agregat_Petugas_PROGRES PENDATAAN.xlsx", "out": "petugas_progres_pendataan.json"},
    ]
    
    success_count = 0
    for agg in aggregations:
        file_path = os.path.join(src_dir, agg["file"])
        out_path = os.path.join(dest_dir, agg["out"])
        
        if not os.path.exists(file_path):
            print(f"Peringatan: Berkas {agg['file']} tidak ditemukan. Dilewati.")
            continue
            
        try:
            # Read excel
            df = pd.read_excel(file_path)
            
            # Clean dataframe
            df_clean = clean_dataframe(df)
            
            # Convert to dict and save as JSON
            records = df_clean.to_dict(orient="records")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
                
            print(f"Berhasil mengonversi: {agg['file']} -> {agg['out']} ({len(records)} baris)")
            success_count += 1
        except Exception as e:
            print(f"Error saat mengonversi {agg['file']}: {e}")
            
    print(f"\nSelesai! Berhasil mengonversi {success_count} dari {len(aggregations)} file.")

if __name__ == "__main__":
    convert_excel_to_json()
