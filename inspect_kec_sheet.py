import pandas as pd
import os

def main():
    excel_path = os.path.join("research", "fasih-dashboard-se2026", "Monev Pendataan SE2026 13 Juli 2026.xlsx")
    if os.path.exists(excel_path):
        df = pd.read_excel(excel_path, sheet_name="Kecamatan")
        print("Columns in Kecamatan sheet:")
        for idx, col in enumerate(df.columns):
            print(f"Col {idx}: {col}")
        
        print("\nRows in Kecamatan sheet:")
        for i, row in df.iterrows():
            print(f"Row {i}: {row.tolist()[:10]}") # Print first 10 values of each row
    else:
        print("Monev file not found!")

if __name__ == "__main__":
    main()
