import pandas as pd
import os

def main():
    csv_path = os.path.join("dashboard", "public", "dashboard_scraped_data.csv")
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        print("Columns in csv:", df.columns.tolist())
        
        target_names = ["Regina Mahoro", "Dince Lahaube", "Ratna Sari Tumuwe"]
        for name in target_names:
            print(f"\n--- Data for {name} ---")
            officer_df = df[df["nama_petugas"].str.contains(name, case=False, na=False)]
            if not officer_df.empty:
                # Sum numeric columns
                numeric_cols = [c for c in df.columns if c not in ["Category", "Email", "SLS Code", "nama_petugas", "jabatan_petugas", "nama_kec", "koseka", "is_prioritas"]]
                sums = officer_df[numeric_cols].sum()
                for col, val in sums.items():
                    print(f"  {col}: {val}")
                
                # Calculate target and realisasi
                # We can print sum of these
                total_prelist = officer_df[numeric_cols].sum().sum()
                print(f"  Total Sum (all status): {total_prelist}")
            else:
                print("Not found!")
    else:
        print("CSV not found!")

if __name__ == "__main__":
    main()
