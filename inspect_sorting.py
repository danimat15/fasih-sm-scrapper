import pandas as pd
import os

def main():
    excel_path = os.path.join("research", "fasih-dashboard-se2026", "Monev Pendataan SE2026 13 Juli 2026.xlsx")
    if not os.path.exists(excel_path):
        print("Monev file not found!")
        return

    df = pd.read_excel(excel_path, sheet_name="Status Muatan")
    # Columns in sheet:
    # A: No. (which has original row index)
    # B: Nama Petugas
    # We want to print columns from index 14 onwards (Status Muatan columns) for first 15 rows
    print("Row 0 and 1 represent headers. Here are rows 3 to 18:")
    for idx in range(3, 18):
        row = df.iloc[idx]
        print(f"Index {idx}: Name: {row.iloc[1]}, OrigIdx: {row.iloc[0]}, Kel_TidakDidata: {row.iloc[14]}, Kel_Baru: {row.iloc[15]}, Kel_Selisih: {row.iloc[16]}, Ush_TidakDidata: {row.iloc[17]}, Ush_Baru: {row.iloc[18]}, Ush_Selisih: {row.iloc[19]}, Total_Selisih: {row.iloc[22]}")

if __name__ == "__main__":
    main()
