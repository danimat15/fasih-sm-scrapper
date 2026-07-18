import os
import pandas as pd
import re

# Paths
base_dir = os.path.dirname(os.path.abspath(__file__))
update_data_path = os.path.normpath(os.path.join(base_dir, "../../update_data.csv"))
koseka_path = os.path.normpath(os.path.join(base_dir, "../../data/koseka.csv"))

# Output dirs
dir_ketat = os.path.join(base_dir, "aturan_ketat")
dir_biasa = os.path.join(base_dir, "aturan_biasa")

os.makedirs(dir_ketat, exist_ok=True)
os.makedirs(dir_biasa, exist_ok=True)

# Load data
print(f"Membaca data dari: {update_data_path}")
df = pd.read_csv(update_data_path)
koseka_df = pd.read_csv(koseka_path, sep=';')
koseka_map = dict(zip(koseka_df['kd_kec'].astype(str), koseka_df['nama_kec']))

# Preprocessing
df['kode_wilayah'] = df['Kode Identitas'].astype(str).str.extract(r'^(\d{16})')[0].fillna('')
df['kd_kec'] = df['Kode Identitas'].astype(str).str.extract(r'^(\d{7})')[0].fillna('')
df['nama_kec_ref'] = df['kd_kec'].map(koseka_map)
df['nama_kec'] = df['nama_kec_ref'].fillna(df['nama_kec'])

output_cols = [
    'Searched Email', 'Kode Identitas', 'kode_wilayah', 'Nama Keluarga/Bangunan/Usaha', 
    'Alamat Prelist', 'Nomor Urut Bangunan / IDSBR', 'NIB', 'Email', 
    'Skala Usaha / Jenis Prelist', 'Jumlah Usaha', 'Kode Pos', 'Perubahan SLS', 
    'Status', 'Mode', 'Petugas Saat Ini', 'Keterangan', 'sumber data', 
    'nama_kec', 'koseka', 'is_prioritas'
]

# Ensure fillna for filtering
df['sumber data'] = df['sumber data'].fillna('')
df['Nomor Urut Bangunan / IDSBR'] = df['Nomor Urut Bangunan / IDSBR'].fillna('').astype(str).str.strip()

def process_and_save(cond_common, cond_kel_extra, cond_us_extra, out_dir):
    # Filter Keluarga
    cond_kel = cond_common & cond_kel_extra
    df_kel = df[cond_kel][output_cols]
    
    # Filter Usaha
    cond_us = cond_common & cond_us_extra
    df_us = df[cond_us][output_cols]
    
    # Save details
    df_kel.to_csv(os.path.join(out_dir, "tidak_ditemukan_keluarga.csv"), index=False)
    df_us.to_csv(os.path.join(out_dir, "tidak_ditemukan_usaha.csv"), index=False)
    
    # Aggregates
    base_kec = pd.DataFrame({'nama_kec': koseka_df['nama_kec'].unique()})
    
    agg_kel = df_kel.groupby('nama_kec').size().reset_index(name='keluarga_tidak_ditemukan')
    agg_kel_full = pd.merge(base_kec, agg_kel, on='nama_kec', how='left').fillna(0)
    agg_kel_full['keluarga_tidak_ditemukan'] = agg_kel_full['keluarga_tidak_ditemukan'].astype(int)
    agg_kel_full.to_csv(os.path.join(out_dir, "agregat_tidak_ditemukan_keluarga.csv"), index=False)
    
    agg_us = df_us.groupby('nama_kec').size().reset_index(name='usaha_tidak_ditemukan')
    agg_us_full = pd.merge(base_kec, agg_us, on='nama_kec', how='left').fillna(0)
    agg_us_full['usaha_tidak_ditemukan'] = agg_us_full['usaha_tidak_ditemukan'].astype(int)
    agg_us_full.to_csv(os.path.join(out_dir, "agregat_tidak_ditemukan_usaha.csv"), index=False)
    
    agg_gab = pd.merge(agg_kel_full, agg_us_full, on='nama_kec', how='outer').fillna(0)
    agg_gab['keluarga_tidak_ditemukan'] = agg_gab['keluarga_tidak_ditemukan'].astype(int)
    agg_gab['usaha_tidak_ditemukan'] = agg_gab['usaha_tidak_ditemukan'].astype(int)
    agg_gab['total_tidak_ditemukan'] = agg_gab['keluarga_tidak_ditemukan'] + agg_gab['usaha_tidak_ditemukan']
    agg_gab = agg_gab.sort_values(by='nama_kec')
    agg_gab.to_csv(os.path.join(out_dir, "agregat_tidak_ditemukan_gabungan.csv"), index=False)
    
    return len(df_kel), len(df_us)

# 1. Aturan Ketat
cond_common_ketat = (
    (~df['sumber data'].str.contains('kosong', case=False)) &
    (df['Status'].str.contains('approve', case=False, na=False)) &
    (df['Jumlah Usaha'].fillna('-').isin([0, '0', '-'])) &
    (df['Nomor Urut Bangunan / IDSBR'].str.contains(r'^-$|^\d{8}$|^-\s*/\s*\d{8}$', regex=True))
)
cond_kel_ketat = df['Skala Usaha / Jenis Prelist'].str.contains('keluarga', case=False, na=False)
cond_us_ketat = ~cond_kel_ketat

kel_ketat, us_ketat = process_and_save(cond_common_ketat, cond_kel_ketat, cond_us_ketat, dir_ketat)

# 2. Aturan Biasa (Excel)
cond_common_biasa = (
    (~df['sumber data'].str.contains('kosong', case=False)) &
    (df['Status'].str.contains('approve', case=False, na=False)) &
    (df['Jumlah Usaha'].fillna('-').isin([0, '0', '-'])) &
    (df['Nomor Urut Bangunan / IDSBR'].str.startswith('-'))
)
cond_kel_biasa = df['Skala Usaha / Jenis Prelist'].str.contains('keluarga', case=False, na=False)
cond_us_biasa = ~cond_kel_biasa

kel_biasa, us_biasa = process_and_save(cond_common_biasa, cond_kel_biasa, cond_us_biasa, dir_biasa)

print(f"PROCESSED SUCCESSFULLY!")
print(f"ATURAN KETAT -> Keluarga: {kel_ketat}, Usaha: {us_ketat}, Total: {kel_ketat + us_ketat}")
print(f"ATURAN BIASA -> Keluarga: {kel_biasa}, Usaha: {us_biasa}, Total: {kel_biasa + us_biasa}")
