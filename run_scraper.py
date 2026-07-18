import os
import re
import csv
import sys
import time
import json
from patchright.sync_api import sync_playwright
import process_data
import random

# Monkeypatch time.sleep to automatically add random delays (stealth)
_original_sleep = time.sleep
def _stealth_sleep(seconds):
    _original_sleep(seconds * random.uniform(0.8, 1.5))
time.sleep = _stealth_sleep

def load_emails(file_path):
    if not os.path.exists(file_path):
        print(f"Error: Email list file '{file_path}' not found.")
        sys.exit(1)
    with open(file_path, "r", encoding="utf-8") as f:
        emails = [line.strip() for line in f if line.strip()]
    return emails

def wait_for_table_load(page, searched_text=None, previous_first_row_text=None, timeout=45000):
    start_time = time.time()
    
    # 1. Wait a brief moment for actions to register and loading states to trigger
    page.wait_for_timeout(500)
    
    # 2. Wait for loader spinners to disappear (if they appear)
    try:
        loaders = page.locator("svg.tabler-icon-loader, svg.tabler-icon-loader-2")
        if loaders.count() > 0:
            loaders.first.wait_for(state="hidden", timeout=timeout)
    except Exception:
        pass

    # 3. Dynamic verification loop
    while time.time() - start_time < (timeout / 1000.0):
        rows = page.locator("table tbody tr")
        row_count = rows.count()
        
        if row_count > 0:
            first_row_text = rows.first.text_content()
            first_row_text_lower = first_row_text.lower()
            
            # Check for "No data" placeholder
            is_no_data = "tidak ada data" in first_row_text_lower or "empty" in first_row_text_lower or "no data" in first_row_text_lower
            
            # Condition A: Waiting for new page content (first row text should differ from old page)
            if previous_first_row_text is not None:
                if first_row_text != previous_first_row_text:
                    break
            
            # Condition B: Waiting for search results matching a term
            elif searched_text is not None:
                if is_no_data:
                    break
                
                # Check if the search term exists within the table body text
                tbody_text = page.locator("table tbody").text_content().lower()
                if searched_text.lower() in tbody_text:
                    break
            
            # Default: If no conditions specified, just wait for any row to be present
            else:
                break
        
        # Sleep and retry if table hasn't updated/loaded yet
        time.sleep(0.5)
        
    # 4. Extra safety buffer for UI/React state settling
    time.sleep(1.0)

def scrape_page(page, searched_email, csv_writer):
    # Find all data rows in the table body
    rows_locator = page.locator("table tbody tr")
    row_count = rows_locator.count()
    
    if row_count == 0:
        print(f"  No rows found in table.")
        return 0
        
    # Check if first row is a placeholder message (like 'Tidak ada data')
    first_row_text = rows_locator.first.text_content().lower()
    if "tidak ada data" in first_row_text or "empty" in first_row_text or "no data" in first_row_text:
        print(f"  No data matching search.")
        return 0
        
    scraped_count = 0
    for i in range(row_count):
        cols = rows_locator.nth(i).locator("td").all_text_contents()
        
        # Based on our analysis, the table has 17 columns:
        # Col 0: Checkbox
        # Col 1: Kode Identitas
        # Col 2: Nama Keluarga/Bangunan/Usaha
        # Col 3: Alamat Prelist
        # Col 4: Nomor Urut Bangunan / IDSBR
        # Col 5: NIB
        # Col 6: Email
        # Col 7: Skala Usaha / Jenis Prelist
        # Col 8: Jumlah Usaha
        # Col 9: Kode Pos
        # Col 10: Perubahan SLS
        # Col 11: Status
        # Col 12: Mode
        # Col 13: Petugas Saat Ini
        # Col 14: Keterangan
        # Col 15: Action Button
        
        if len(cols) >= 15:
            # Clean text values (strip whitespace)
            cleaned_cols = [c.strip() for c in cols]
            
            # Write row to CSV: searched email + table columns (excluding checkbox at index 0 and action at index 15)
            csv_writer.writerow([searched_email] + cleaned_cols[1:15])
            scraped_count += 1
            
    print(f"  Scraped {scraped_count} rows from current page.")
    return scraped_count

def ensure_100_rows_per_page(page):
    try:
        # 1. Try URL parameters first
        current_url = page.url
        if "perPage=100" not in current_url:
            print("  Forcing 100 items per page by updating URL query parameters...")
            if "?" in current_url:
                if "perPage=" in current_url:
                    target_url = re.sub(r"perPage=\d+", "perPage=100", current_url)
                else:
                    target_url = current_url + "&perPage=100"
            else:
                target_url = current_url + "?perPage=100"
            page.goto(target_url)
            page.wait_for_timeout(3000)
            
        # 2. Try native select dropdown if exists
        selects_locator = page.locator("select")
        select_count = selects_locator.count()
        for idx in range(select_count):
            sel = selects_locator.nth(idx)
            if sel.is_visible():
                options = sel.locator("option").all_text_contents()
                if "100" in options or any("100" in opt for opt in options):
                    sel.select_option("100")
                    page.wait_for_timeout(2000)
                    print("  Set page size to 100 via select dropdown.")
                    return
                    
        # 3. Try custom Shadcn/Radix select dropdown button if exists
        btn_10 = page.locator("button:has-text('10'), button:has-text('Tampilkan 10'), button:has-text('10 / page')").first
        if btn_10.count() > 0 and btn_10.is_visible():
            btn_10.click()
            page.wait_for_timeout(1000)
            opt_100 = page.locator("div[role='option']:has-text('100'), button[role='option']:has-text('100'), a:has-text('100')").first
            if opt_100.count() > 0 and opt_100.is_visible():
                opt_100.click()
                page.wait_for_timeout(2000)
                print("  Set page size to 100 via custom dropdown button.")
                return
            page.keyboard.press("Escape")
    except Exception as e:
        print(f"  Warning setting 100 rows per page: {e}")

def run_scraper(use_test_emails=False):
    email_file = os.path.join("data", "email_mitra_test.txt" if use_test_emails else "email_mitra.txt")
    auth_file = "auth_state.json"
    output_csv = "scraped_data.csv"
    checkpoint_file = "checkpoint.json"
    
    emails = load_emails(email_file)
    
    # Check for order argument in command line or prompt user
    reverse_order = False
    if "--bottom" in sys.argv or "--reverse" in sys.argv:
        reverse_order = True
        print("Scraping order set via CLI: BOTTOM TO TOP (Reversed).")
    elif "--top" in sys.argv:
        reverse_order = False
        print("Scraping order set via CLI: TOP TO BOTTOM (Normal).")
    else:
        # Interactive prompt if no CLI argument for order is specified
        print("\nPilih urutan scraping email:")
        print("  1. Dari Atas ke Bawah (Normal - default)")
        print("  2. Dari Bawah ke Atas (Terbalik/Reverse)")
        try:
            choice = input("Masukkan pilihan (1/2) [1]: ").strip()
            if choice == "2":
                reverse_order = True
                print("Order: BOTTOM TO TOP (Reversed).")
            else:
                print("Order: TOP TO BOTTOM (Normal).")
        except (KeyboardInterrupt, SystemExit):
            print("\nExiting script.")
            sys.exit(0)
        except Exception:
            print("Invalid input, defaulting to: TOP TO BOTTOM (Normal).")
            
    # Reverse emails if reverse_order is True
    if reverse_order:
        emails.reverse()
        
    print(f"Loaded {len(emails)} emails from '{email_file}' to scrape.")
    print("Scraping queue preview:")
    if len(emails) <= 6:
        for i, email in enumerate(emails):
            print(f"  {i+1}. {email}")
    else:
        for i in range(3):
            print(f"  {i+1}. {emails[i]}")
        print("  ...")
        for i in range(len(emails) - 3, len(emails)):
            print(f"  {i+1}. {emails[i]}")
            
    # Check if we should start fresh
    use_fresh = "--fresh" in sys.argv
    completed_emails = []
    failed_emails = []
    
    if not use_fresh and os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file, "r") as f:
                cp = json.load(f)
                completed_emails = cp.get("completed_emails", [])
                failed_emails = cp.get("failed_emails", [])
                cp_reverse = cp.get("reverse_order", None)
                
                # Check if the checkpoint's order is different from the current run's order
                if cp_reverse is not None and cp_reverse != reverse_order:
                    print(f"\n[!] PERINGATAN: Urutan checkpoint ({'Bawah ke Atas' if cp_reverse else 'Atas ke Bawah'}) "
                          f"berbeda dengan urutan jalankan saat ini ({'Bawah ke Atas' if reverse_order else 'Atas ke Bawah'}).")
                    print("Melanjutkan dengan arah berbeda dapat menyebabkan email terlewat atau terduplikat.")
                    try:
                        choice = input("Mulai baru dari awal (fresh)? (y/n) [y]: ").strip().lower()
                        if choice == "n":
                            print("Melanjutkan dari email terakhir...")
                        else:
                            use_fresh = True
                            completed_emails = []
                            failed_emails = []
                    except Exception:
                        use_fresh = True
                        completed_emails = []
                        failed_emails = []
                
                if not use_fresh:
                    # Backward compatibility for old checkpoint format
                    if not completed_emails and "last_email" in cp:
                        last_email = cp.get("last_email")
                        if last_email and last_email in emails:
                            last_idx = emails.index(last_email)
                            completed_emails = emails[:last_idx + 1]
                            print(f"Imported legacy checkpoint: starting after '{last_email}'")
                    
                    if completed_emails:
                        print(f"Loaded checkpoint: {len(completed_emails)} emails already completed, {len(failed_emails)} previously failed.")
        except Exception as cp_err:
            print(f"Warning: Could not read checkpoint file: {cp_err}. Starting fresh.")
            
    # Prepare CSV file
    csv_headers = [
        "Searched Email", "Kode Identitas", "Nama Keluarga/Bangunan/Usaha", "Alamat Prelist",
        "Nomor Urut Bangunan / IDSBR", "NIB", "Email", "Skala Usaha / Jenis Prelist",
        "Jumlah Usaha", "Kode Pos", "Perubahan SLS",
        "Status", "Mode", "Petugas Saat Ini", "Keterangan"
    ]
    
    use_append = os.path.exists(output_csv) and (len(completed_emails) > 0)
    if use_append:
        print(f"Appending new results to existing '{output_csv}'...")
        csv_file = open(output_csv, "a", newline="", encoding="utf-8")
        csv_writer = csv.writer(csv_file)
    else:
        print(f"Overwriting/initializing '{output_csv}' with headers...")
        csv_file = open(output_csv, "w", newline="", encoding="utf-8")
        csv_writer = csv.writer(csv_file)
        csv_writer.writerow(csv_headers)
        csv_file.flush()
        
    print(f"Output will be saved/appended to '{output_csv}'")
    
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        # Load saved session if it exists
        if os.path.exists(auth_file):
            print(f"Loading session from '{auth_file}'...")
            context = browser.new_context(storage_state=auth_file)
        else:
            print("No saved session found. Launching a fresh browser context.")
            context = browser.new_context()
            
        page = context.new_page()
        # Monkeypatch page.wait_for_timeout to automatically add random delays (stealth)
        _original_wait = page.wait_for_timeout
        page.wait_for_timeout = lambda timeout: _original_wait(timeout * random.uniform(0.8, 1.5))
        
        # Open BPS FASIH
        print("Navigating to BPS FASIH website...")
        page.goto("https://fasih-sm.bps.go.id/")
        
        # Regex pattern for survey data page URL
        # Format: https://fasih-sm.bps.go.id/app/surveys/<survey-id>/<period-id>/data
        target_pattern = re.compile(r"/app/surveys/[^/]+/[^/]+/data")
        
        print("\n" + "="*70)
        print("WAITING FOR TARGET PAGE:")
        print("Please log in (if not already logged in) and click/navigate to the survey data table.")
        print("The script will automatically detect when you reach the page and start scraping.")
        print("="*70 + "\n")
        
        # Wait indefinitely until URL matches the target pattern
        try:
            page.wait_for_url(target_pattern, timeout=0)
        except Exception as e:
            print(f"Error waiting for target page: {e}")
            browser.close()
            return
            
        # We are on the target page!
        current_url = page.url
        print(f"\nTarget survey page detected: {current_url}")
        
        # Save session immediately so user doesn't have to log in next time
        context.storage_state(path=auth_file)
        print(f"Session state saved to '{auth_file}'")
        
        # Ensure we display 100 items per page (force URL parameter and UI select)
        ensure_100_rows_per_page(page)
            
        # Wait for table to load
        print("Waiting for table to load...")
        try:
            page.wait_for_selector("table", timeout=45000)
            print("Table loaded successfully. Starting scraper loop...")
        except Exception:
            print("Error: Table not found on target page. Aborting.")
            browser.close()
            csv_file.close()
            return
            
        # Start search looping
        for index in range(len(emails)):
            email = emails[index]
            if email in completed_emails:
                continue
            print(f"[{index + 1}/{len(emails)}] Searching for: {email}")
            
            attempts = 5
            total_scraped = 0
            success = False
            
            for attempt in range(1, attempts + 1):
                if attempt > 1:
                    print(f"  [Retry] Melakukan percobaan ulang ke-{attempt} untuk {email}...")
                try:
                    # Find search input
                    search_input = page.locator('input[placeholder="Cari..."]')
                    if search_input.count() == 0:
                        print("  Search input not found! Reloading survey page...")
                        page.goto(page.url)
                        page.wait_for_selector("table", timeout=45000)
                        ensure_100_rows_per_page(page)
                        search_input = page.locator('input[placeholder="Cari..."]')
                        
                    # Fill search box and press Enter
                    search_input.click()
                    search_input.fill("") # Clear input first
                    search_input.fill(email)
                    search_input.press("Enter")
                    
                    # Wait for search results containing the searched email
                    wait_for_table_load(page, searched_text=email)
                    
                    # Scrape pages
                    page_num = 1
                    current_scraped = 0
                    
                    while True:
                        print(f"  Scraping page {page_num}...")
                        scraped_in_page = scrape_page(page, email, csv_writer)
                        current_scraped += scraped_in_page
                        csv_file.flush() # Flush to disk
                        
                        # Check next page button
                        next_button = page.locator('button[aria-label="Go to next page"]')
                        if next_button.count() > 0 and next_button.is_visible() and not next_button.is_disabled():
                            print(f"  Navigating to next page...")
                            # Capture current first row content to detect page transition
                            prev_row_text = page.locator("table tbody tr").first.text_content() if page.locator("table tbody tr").count() > 0 else None
                            
                            next_button.click()
                            page_num += 1
                            wait_for_table_load(page, previous_first_row_text=prev_row_text)
                        else:
                            break
                            
                    total_scraped = current_scraped
                    
                    if total_scraped > 0:
                        print(f"  Finished search for {email}. Total scraped: {total_scraped} rows.")
                        success = True
                        break
                    else:
                        print(f"  Peringatan: Total baris yang terambil adalah 0 untuk {email}.")
                        # Check if first row is "Tidak ada data" placeholder to see if it's genuinely 0
                        first_row_text = page.locator("table tbody tr").first.text_content().lower() if page.locator("table tbody tr").count() > 0 else ""
                        is_genuine_no_data = "tidak ada data" in first_row_text or "empty" in first_row_text or "no data" in first_row_text
                        
                        if is_genuine_no_data:
                            print(f"  Tabel menunjukkan secara valid bahwa tidak ada data untuk {email}.")
                            success = True
                            break
                        
                        if attempt < attempts:
                            print(f"  Mencoba kembali 1 kali lagi untuk memastikan...")
                            # Reload the page to ensure fresh state before retry
                            try:
                                page.goto(page.url)
                                page.wait_for_selector("table", timeout=45000)
                                ensure_100_rows_per_page(page)
                            except Exception:
                                pass
                        else:
                            print(f"  Selesai mencari untuk {email} setelah {attempts} percobaan. Total scraped: {total_scraped} rows.")
                            success = False
                            
                except Exception as e:
                    print(f"  Error processing email {email} (Percobaan {attempt}/{attempts}): {e}")
                    if attempt < attempts:
                        print(f"  Mencoba kembali karena terjadi error...")
                        try:
                            page.goto(page.url)
                            page.wait_for_selector("table", timeout=45000)
                            ensure_100_rows_per_page(page)
                        except Exception:
                            pass
                    else:
                        print(f"  Gagal memproses email {email} setelah {attempts} percobaan.")
                        success = False
            
            # Save checkpoint
            if success:
                completed_emails.append(email)
                if email in failed_emails:
                    failed_emails.remove(email)
            else:
                if email not in failed_emails:
                    failed_emails.append(email)
                    
            try:
                with open(checkpoint_file, "w") as f:
                    json.dump({
                        "completed_emails": completed_emails,
                        "failed_emails": failed_emails,
                        "reverse_order": reverse_order
                    }, f)
            except Exception as e:
                print(f"Warning saving checkpoint: {e}")

        # Cleanup
        csv_file.close()
        browser.close()
        
        # Remove checkpoint on successful completion of all emails
        if len(failed_emails) == 0:
            if os.path.exists(checkpoint_file):
                try:
                    os.remove(checkpoint_file)
                    print("Scraping completed successfully. Checkpoint file removed.")
                except Exception as rm_err:
                    print(f"Warning: Could not remove checkpoint file: {rm_err}")
        else:
            print(f"Scraping completed with {len(failed_emails)} failed emails. Checkpoint retained.")
                
        print(f"\nAll scraping completed successfully! Data saved in '{output_csv}'")
        
        # Run the data processing pipeline (which maps subdistricts, copies to dashboard, writes timestamp, and pushes to Git)
        try:
            import process_data
            process_data.process_data(completed_emails=completed_emails)
        except Exception as proc_err:
            print(f"Warning: Error during post-scrape data processing: {proc_err}")

if __name__ == "__main__":
    # Check if user passed --test flag to use email_mitra_test.txt
    use_test = "--test" in sys.argv
    run_scraper(use_test_emails=use_test)
