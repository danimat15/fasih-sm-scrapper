import pandas as pd
import os
import sys

def inspect_more():
    excel_path = os.path.join("research", "fasih-dashboard-se2026", "Monev Pendataan SE2026 13 Juli 2026.xlsx")
    out_path = "inspect_output_utf8.txt"
    
    with open(out_path, "w", encoding="utf-8") as f:
        sys.stdout = f
        if os.path.exists(excel_path):
            xls = pd.ExcelFile(excel_path)
            for sheet_name in xls.sheet_names:
                print("="*60)
                print(f"SHEET: {sheet_name}")
                print("="*60)
                df = pd.read_excel(excel_path, sheet_name=sheet_name)
                print("Shape:", df.shape)
                # Print columns and first 10 rows
                print(df.head(15).to_string())
                print("\n")
        else:
            print("Monev file not found!")
            
    # Restore stdout
    sys.stdout = sys.__stdout__
    print("Done writing inspect_output_utf8.txt")

if __name__ == "__main__":
    inspect_more()
