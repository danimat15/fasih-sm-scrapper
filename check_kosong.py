import pandas as pd

# 1. Load data
df = pd.read_csv("update_data.csv", sep=",")

# 2. Filter data berdasarkan 'Nama Keluarga/Bangunan/Usaha' yang mengandung 'kosong'
# Menggunakan fillna('') untuk menghindari error jika ada baris kosong (NaN)
df['Nama Keluarga/Bangunan/Usaha'] = df['Nama Keluarga/Bangunan/Usaha'].fillna('').astype(str)

# Filter case-insensitive (mengabaikan huruf besar/kecil)
is_kosong = df['Nama Keluarga/Bangunan/Usaha'].str.contains('kosong', case=False)

df_kosong = df[is_kosong]
df_tidak_kosong = df[~is_kosong]

# 3. Print Ringkasan Hasil
print("==================================================")
print("ANALISIS BANGUNAN KOSONG")
print("==================================================")
print(f"Total Baris Data             : {len(df)}")
print(f"Jumlah Bangunan Kosong       : {len(df_kosong)}")
print(f"Jumlah Bangunan Tidak Kosong : {len(df_tidak_kosong)}")
print("==================================================")

# 4. Tampilkan 10 contoh teratas untuk masing-masing kategori
print("\n[CONTOH BANGUNAN KOSONG]")
print(df_kosong[['Kode Identitas', 'Nama Keluarga/Bangunan/Usaha']].head(10).to_string(index=False))

print("\n[CONTOH BANGUNAN TIDAK KOSONG]")
print(df_tidak_kosong[['Kode Identitas', 'Nama Keluarga/Bangunan/Usaha']].head(10).to_string(index=False))
