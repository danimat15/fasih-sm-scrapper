import pandas as pd
import os

def main():
    tabulasi_path = os.path.join("research", "fasih-dashboard-se2026", "data_mikro_sls", "tabulasi_agregat_petugas.xlsx")
    if not os.path.exists(tabulasi_path):
        print("Tabulasi file not found!")
        return

    df_kel = pd.read_excel(tabulasi_path, sheet_name="KELUARGA")
    df_ush = pd.read_excel(tabulasi_path, sheet_name="USAHA PERUSAHAAN")
    
    row_kel = df_kel[df_kel["Nama Petugas"] == "Aditya Christovel Hangau"]
    row_ush = df_ush[df_ush["Nama Petugas"] == "Aditya Christovel Hangau"]
    
    print("=== TABULASI KELUARGA ROWS ===")
    if not row_kel.empty:
        for idx, col in enumerate(df_kel.columns):
            print(f"Col {idx} ({col}): {row_kel[col].values[0]}")
    else:
        print("Aditya not found in Keluarga!")

    print("\n=== TABULASI USAHA ROWS ===")
    if not row_ush.empty:
        for idx, col in enumerate(df_ush.columns):
            print(f"Col {idx} ({col}): {row_ush[col].values[0]}")
    else:
        print("Aditya not found in Usaha!")

if __name__ == "__main__":
    main()
