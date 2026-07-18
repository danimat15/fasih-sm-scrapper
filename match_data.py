import pandas as pd
import os

def main():
    monev_path = os.path.join("research", "fasih-dashboard-se2026", "Monev Pendataan SE2026 13 Juli 2026.xlsx")
    tabulasi_path = os.path.join("research", "fasih-dashboard-se2026", "data_mikro_sls", "tabulasi_agregat_petugas.xlsx")
    
    if not os.path.exists(monev_path) or not os.path.exists(tabulasi_path):
        print("Files not found!")
        return

    # Read sheet "13 Juli" from Monev
    df_monev = pd.read_excel(monev_path, sheet_name="13 Juli")
    
    # Read sheet "KELUARGA" and "USAHA PERUSAHAAN" from Tabulasi
    df_kel = pd.read_excel(tabulasi_path, sheet_name="KELUARGA")
    df_ush = pd.read_excel(tabulasi_path, sheet_name="USAHA PERUSAHAAN")
    
    # Let's find "Aditya Christovel Hangau"
    print("Monev row for Aditya Christovel Hangau:")
    # Look up in column 1 (Nama Petugas)
    # Note: Row index 1 is header, actual data starts from row 2
    row_monev = df_monev[df_monev.iloc[:, 1] == "Aditya Christovel Hangau"]
    if not row_monev.empty:
        # Print column indices and values
        for idx, val in enumerate(row_monev.iloc[0]):
            print(f"Col {idx} (val): {val}")
    else:
        print("Aditya not found in Monev!")
        
    print("\n" + "="*50 + "\n")
    
    print("Tabulasi Keluarga row for Aditya Christovel Hangau:")
    row_kel = df_kel[df_kel["Nama Petugas"] == "Aditya Christovel Hangau"]
    if not row_kel.empty:
        for col in df_kel.columns:
            print(f"  {col}: {row_kel[col].values[0]}")
    else:
        print("Aditya not found in Tabulasi Keluarga!")
        
    print("\n" + "="*50 + "\n")
    
    print("Tabulasi Usaha row for Aditya Christovel Hangau:")
    row_ush = df_ush[df_ush["Nama Petugas"] == "Aditya Christovel Hangau"]
    if not row_ush.empty:
        for col in df_ush.columns:
            print(f"  {col}: {row_ush[col].values[0]}")
    else:
        print("Aditya not found in Tabulasi Usaha!")

if __name__ == "__main__":
    main()
