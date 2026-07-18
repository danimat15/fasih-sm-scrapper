import pandas as pd
import os

def main():
    tabulasi_path = os.path.join("research", "fasih-dashboard-se2026", "data_mikro_sls", "tabulasi_agregat_petugas.xlsx")
    if not os.path.exists(tabulasi_path):
        print("Tabulasi file not found!")
        return

    df_kel = pd.read_excel(tabulasi_path, sheet_name="KELUARGA")
    df_ush = pd.read_excel(tabulasi_path, sheet_name="USAHA PERUSAHAAN")
    
    print("Unique nama_kec in KELUARGA:")
    print(df_kel["nama_kec"].unique().tolist())
    
    print("\nUnique nama_kec in USAHA PERUSAHAAN:")
    print(df_ush["nama_kec"].unique().tolist())

if __name__ == "__main__":
    main()
