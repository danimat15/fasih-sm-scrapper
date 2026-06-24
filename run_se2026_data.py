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

def load_env(env_path=".env"):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip()
                        if val.startswith('"') and val.endswith('"'):
                            val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"):
                            val = val[1:-1]
                        env_vars[key] = val
    return env_vars

def load_emails(file_path):
    if not os.path.exists(file_path):
        print(f"Error: Email list file '{file_path}' not found.")
        sys.exit(1)
    with open(file_path, "r", encoding="utf-8") as f:
        emails = [line.strip() for line in f if line.strip()]
    return emails

def wait_for_table_load(page, searched_text=None, previous_first_row_text=None, timeout=45000):
    start_time = time.time()
    page.wait_for_timeout(500)
    
    try:
        loaders = page.locator("svg.tabler-icon-loader, svg.tabler-icon-loader-2")
        if loaders.count() > 0:
            loaders.first.wait_for(state="hidden", timeout=timeout)
    except Exception:
        pass

    while time.time() - start_time < (timeout / 1000.0):
        rows = page.locator("table tbody tr")
        row_count = rows.count()
        
        if row_count > 0:
            first_row_text = rows.first.text_content()
            first_row_text_lower = first_row_text.lower()
            is_no_data = "tidak ada data" in first_row_text_lower or "empty" in first_row_text_lower or "no data" in first_row_text_lower
            
            if previous_first_row_text is not None:
                if first_row_text != previous_first_row_text:
                    break
            elif searched_text is not None:
                if is_no_data:
                    break
                tbody_text = page.locator("table tbody").text_content().lower()
                if searched_text.lower() in tbody_text:
                    break
            else:
                break
        time.sleep(0.5)
    time.sleep(1.0)

def scrape_page(page, searched_email, csv_writer):
    rows_locator = page.locator("table tbody tr")
    row_count = rows_locator.count()
    
    if row_count == 0:
        print(f"  No rows found in table.")
        return 0
        
    first_row_text = rows_locator.first.text_content().lower()
    if "tidak ada data" in first_row_text or "empty" in first_row_text or "no data" in first_row_text:
        print(f"  No data matching search.")
        return 0
        
    scraped_count = 0
    for i in range(row_count):
        cols = rows_locator.nth(i).locator("td").all_text_contents()
        if len(cols) >= 16:
            cleaned_cols = [c.strip() for c in cols]
            csv_writer.writerow([searched_email] + cleaned_cols[1:16])
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

def run_data_scraper():
    use_test = "--test" in sys.argv
    email_file = os.path.join("data", "email_mitra_test.txt" if use_test else "email_mitra.txt")
    auth_file = "auth_state.json"
    output_csv = "scraped_data.csv"
    checkpoint_file = "checkpoint.json"
    
    # Load configuration and emails
    env = load_env()
    username = env.get("USERNAME")
    password = env.get("PASSWORD")
    
    if not username or not password:
        print("Error: USERNAME or PASSWORD not set in .env file.")
        sys.exit(1)
        
    emails = load_emails(email_file)
    
    # Default order: TOP TO BOTTOM (Normal - no prompting)
    reverse_order = False
    print("Scraping order: TOP TO BOTTOM (Normal - default for Task Scheduler).")
    
    # Check headless mode (headless=True by default for Task Scheduler)
    headless_mode = True
    if "--headed" in sys.argv:
        headless_mode = False
        print("Running in HEADED mode.")
    else:
        print("Running in HEADLESS mode (default for Task Scheduler).")

    # Check checkpoint for detail scraping
    use_fresh = "--fresh" in sys.argv
    completed_emails = []
    failed_emails = []
    if not use_fresh and os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file, "r") as f:
                cp = json.load(f)
                completed_emails = cp.get("completed_emails", [])
                failed_emails = cp.get("failed_emails", [])
                
                # Backward compatibility for old checkpoint format
                if not completed_emails and "last_email" in cp:
                    last_email = cp.get("last_email")
                    if last_email and last_email in emails:
                        last_idx = emails.index(last_email)
                        completed_emails = emails[:last_idx + 1]
                        print(f"Imported legacy checkpoint: starting after '{last_email}'")
                
                if completed_emails:
                    print(f"Loaded checkpoint: {len(completed_emails)} emails already completed, {len(failed_emails)} previously failed.")
        except Exception as e:
            print(f"Warning reading checkpoint: {e}. Starting fresh.")

    with sync_playwright() as p:
        print("Launching Chromium browser...")
        browser = p.chromium.launch(
            headless=headless_mode,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        # Load saved session state if exists
        if os.path.exists(auth_file):
            print(f"Loading session from '{auth_file}'...")
            context = browser.new_context(storage_state=auth_file)
        else:
            print("No saved session state found. Creating new context.")
            context = browser.new_context()
            
        page = context.new_page()
        # Monkeypatch page.wait_for_timeout to automatically add random delays (stealth)
        _original_wait = page.wait_for_timeout
        page.wait_for_timeout = lambda timeout: _original_wait(timeout * random.uniform(0.8, 1.5))
        
        # Automated Login via SSO
        max_attempts = 5
        for attempt in range(1, max_attempts + 1):
            try:
                print(f"Navigating to BPS FASIH website (Attempt {attempt}/{max_attempts})...")
                page.goto("https://fasih-sm.bps.go.id/", timeout=120000)
                break
            except Exception as e:
                print(f"Error navigating to BPS FASIH website: {e}")
                if attempt == max_attempts:
                    raise
                wait_sec = attempt * 10
                print(f"Waiting {wait_sec} seconds before retrying...")
                page.wait_for_timeout(wait_sec * 1000)
        page.wait_for_timeout(3000)
        
        # Check if we need to log in
        if "sso.bps.go.id" in page.url or page.locator("#username").count() > 0 or page.locator("text=Login SSO BPS").count() > 0:
            print("Login SSO required.")
            if page.locator("text=Login SSO BPS").count() > 0:
                print("Clicking 'Login SSO BPS'...")
                page.locator("text=Login SSO BPS").first.click()
                page.wait_for_timeout(3000)
                
            if page.locator("#username").count() > 0:
                print(f"Filling credentials for user: {username}...")
                page.locator("#username").fill(username)
                page.locator("#password").fill(password)
                page.locator("#kc-login").click()
                
                # Wait to see if we get redirected to app or if an OTP page is displayed
                print("Waiting for login response...")
                is_otp_page = False
                for _ in range(15):
                    page.wait_for_timeout(1000)
                    if "/app" in page.url:
                        break
                    # Check if OTP inputs or OTP terms exist
                    for sel in ["input#otp", "input#code", "input#totp", "input[name='otp']", "input[name='code']"]:
                        if page.locator(sel).count() > 0:
                            is_otp_page = True
                            break
                    if is_otp_page:
                        break
                    
                    try:
                        body_text = page.locator("body").text_content().lower()
                        if "otp" in body_text or "authenticator" in body_text or "kode verifikasi" in body_text or "verification code" in body_text:
                            is_otp_page = True
                            break
                    except Exception:
                        pass
                
                if is_otp_page:
                    if headless_mode:
                        print("\n" + "!"*80)
                        print("ERROR: OTP / Verifikasi login diperlukan oleh BPS SSO, tetapi script berjalan dalam mode HEADLESS.")
                        print("Silakan jalankan ulang script dengan menambahkan argumen --headed (contoh: python run_se2026_data.py --headed) agar browser terbuka,")
                        print("sehingga Anda dapat memasukkan OTP secara manual di jendela browser.")
                        print("!"*80 + "\n")
                        sys.exit(1)
                    else:
                        print("\n" + "="*80)
                        print("OTP / VERIFIKASI LOGIN TERDETEKSI!")
                        print("Silakan masukkan kode OTP / Verifikasi secara manual pada browser Chromium yang terbuka.")
                        print("Script akan otomatis melanjutkan setelah Anda berhasil masuk ke Dashboard FASIH.")
                        print("="*80 + "\n")
                        
                        # Wait loop until logged in (redirected to /app or sso domain left)
                        start_wait = time.time()
                        last_print = 0
                        while True:
                            if "/app" in page.url:
                                print("Successfully logged in via OTP!")
                                break
                            if "sso.bps.go.id" not in page.url and "/app" not in page.url:
                                page.wait_for_timeout(2000)
                                if "/app" in page.url:
                                    break
                                print("Warning: Left BPS SSO but did not reach app. Current URL: " + page.url)
                                break
                            elapsed = int(time.time() - start_wait)
                            if elapsed - last_print >= 10:
                                print(f"  [Waiting {elapsed}s] Menunggu input OTP manual di browser...")
                                last_print = elapsed
                            page.wait_for_timeout(1000)
                else:
                    page.wait_for_timeout(2000)
                
        # Wait for redirect to /app
        try:
            page.wait_for_url("**/app**", timeout=45000)
            print("Successfully reached the app workspace!")
        except Exception:
            print("Warning: Redirection timeout. Checking current URL: " + page.url)
            
        # Save session immediately
        context.storage_state(path=auth_file)
        print(f"Session state saved to '{auth_file}'")
        
        # Search and select survey
        print("Searching for 'SENSUS EKONOMI 2026'...")
        if not page.url.endswith("/app") and "/app/surveys" not in page.url:
            page.goto("https://fasih-sm.bps.go.id/app")
            page.wait_for_timeout(2000)
            
        search_input = page.locator('input[placeholder="Cari survei..."]')
        search_input.wait_for(state="visible", timeout=30000)
        search_input.fill("SENSUS EKONOMI 2026")
        search_input.press("Enter")
        page.wait_for_timeout(2500)
        
        # Click the row with exact text "SENSUS EKONOMI 2026"
        print("Finding exact match for 'SENSUS EKONOMI 2026'...")
        survey_items = page.locator("text=SENSUS EKONOMI 2026")
        survey_items.first.wait_for(state="visible", timeout=30000)
        
        survey_item = None
        count = survey_items.count()
        for idx in range(count):
            item = survey_items.nth(idx)
            txt = item.text_content().strip()
            if txt == "SENSUS EKONOMI 2026":
                survey_item = item
                break
                
        if survey_item is None:
            try:
                exact_loc = page.get_by_text("SENSUS EKONOMI 2026", exact=True).first
                if exact_loc.count() > 0:
                    survey_item = exact_loc
            except Exception:
                pass
                
        if survey_item is None:
            survey_item = page.locator("text=SENSUS EKONOMI 2026").first
            
        print(f"Clicking survey item: '{survey_item.text_content().strip()}'")
        survey_item.click()
        page.wait_for_timeout(3000)
        
        # Click the "PENDATAAN" card/button to enter dashboard
        print("Navigating to PENDATAAN period...")
        pendataan_btn = page.locator("text=PENDATAAN").first
        pendataan_btn.wait_for(state="visible", timeout=30000)
        pendataan_btn.click()
        page.wait_for_timeout(3000)
        
        # Transition to detail "Data" tab
        print("\n--- Phase 3: Transitioning to Detail Data Tab ---")
        
        data_menu = None
        selectors = [
            "a[href$='/data']",
            "a[href*='/data']",
            "a:has-text('Data')"
        ]
        
        for selector in selectors:
            loc = page.locator(selector)
            if loc.count() > 0:
                try:
                    loc.first.wait_for(state="visible", timeout=3000)
                    data_menu = loc.first
                    print(f"  Found Data tab using selector: '{selector}'")
                    break
                except Exception:
                    continue
                    
        if data_menu:
            data_menu.click()
            page.wait_for_timeout(3000)
            
        current_url = page.url
        base_url = current_url.split("?")[0]
        if not base_url.endswith("/data"):
            print("  Not on detail data page yet. Constructing target URL directly...")
            if base_url.endswith("/"):
                data_url = base_url + "data"
            else:
                data_url = base_url + "/data"
            print(f"  Direct navigation to: {data_url}")
            page.goto(data_url)
            page.wait_for_timeout(3000)
            
        # Ensure 100 items per page parameters
        ensure_100_rows_per_page(page)
            
        print("Waiting for detail data table to load...")
        try:
            page.wait_for_selector("table", timeout=45000)
            print("Table loaded successfully. Starting detail scraper...")
        except Exception:
            print("Error: Table not found on data page. Aborting.")
            browser.close()
            return

        # Prepare detail CSV headers & file
        detail_headers = [
            "Searched Email", "Kode Identitas", "Nama Keluarga/Bangunan/Usaha", "Alamat Prelist",
            "Nomor Urut Bangunan / IDSBR", "NIB", "Email", "Skala Usaha / Jenis Prelist",
            "Jumlah Usaha", "Kode Pos", "Perubahan SLS", "IDSBR UMKM SLS Sama",
            "Status", "Mode", "Petugas Saat Ini", "Keterangan"
        ]
        
        # Check if we should append or overwrite
        use_append = os.path.exists(output_csv) and (len(completed_emails) > 0)
        if use_append:
            print(f"Appending new detail results to existing '{output_csv}'...")
            csv_file = open(output_csv, "a", newline="", encoding="utf-8")
            csv_writer = csv.writer(csv_file)
        else:
            print(f"Overwriting/initializing '{output_csv}' with headers...")
            csv_file = open(output_csv, "w", newline="", encoding="utf-8")
            csv_writer = csv.writer(csv_file)
            csv_writer.writerow(detail_headers)
            csv_file.flush()

        # Scrape Detail Data Mitra
        print(f"Loaded {len(emails)} emails to scrape.")
        for index in range(len(emails)):
            email = emails[index]
            if email in completed_emails:
                continue
            print(f"[{index + 1}/{len(emails)}] Searching detail for: {email}")
            
            attempts = 5
            total_scraped = 0
            success = False
            
            for attempt in range(1, attempts + 1):
                if attempt > 1:
                    print(f"  [Retry] Retry attempt #{attempt} for {email}...")
                try:
                    search_input = page.locator('input[placeholder="Cari..."]')
                    if search_input.count() == 0:
                        print("  Search input not found! Reloading data page...")
                        page.goto(page.url)
                        page.wait_for_selector("table", timeout=45000)
                        ensure_100_rows_per_page(page)
                        search_input = page.locator('input[placeholder="Cari..."]')
                        
                    search_input.click()
                    search_input.fill("")
                    search_input.fill(email)
                    search_input.press("Enter")
                    
                    wait_for_table_load(page, searched_text=email)
                    
                    page_num = 1
                    current_scraped = 0
                    while True:
                        print(f"  Scraping detail page {page_num}...")
                        scraped_in_page = scrape_page(page, email, csv_writer)
                        current_scraped += scraped_in_page
                        csv_file.flush()
                        
                        next_button = page.locator('button[aria-label="Go to next page"]')
                        if next_button.count() > 0 and next_button.is_visible() and not next_button.is_disabled():
                            print(f"  Navigating to next page...")
                            prev_row_text = page.locator("table tbody tr").first.text_content() if page.locator("table tbody tr").count() > 0 else None
                            next_button.click()
                            page_num += 1
                            wait_for_table_load(page, previous_first_row_text=prev_row_text)
                        else:
                            break
                            
                    total_scraped = current_scraped
                    if total_scraped > 0:
                        print(f"  Finished search for {email}. Total: {total_scraped} rows.")
                        success = True
                        break
                    else:
                        print(f"  Warning: Scraped 0 rows for {email}.")
                        first_row = page.locator("table tbody tr").first
                        first_row_text = first_row.text_content().lower() if first_row.count() > 0 else ""
                        is_genuine_no_data = "tidak ada data" in first_row_text or "empty" in first_row_text or "no data" in first_row_text
                        if is_genuine_no_data:
                            print(f"  Confirmed: No data for {email}.")
                            success = True
                            break
                        
                        if attempt < attempts:
                            print(f"  Retrying to ensure fresh state...")
                            try:
                                page.goto(page.url)
                                page.wait_for_selector("table", timeout=45000)
                                ensure_100_rows_per_page(page)
                            except Exception:
                                pass
                        else:
                            print(f"  Finished after {attempts} attempts. Scraped: {total_scraped} rows.")
                            success = False
                except Exception as e:
                    print(f"  Error processing email {email} (Attempt {attempt}/{attempts}): {e}")
                    if attempt < attempts:
                        try:
                            page.goto(page.url)
                            page.wait_for_selector("table", timeout=45000)
                            ensure_100_rows_per_page(page)
                        except Exception:
                            pass
                    else:
                        print(f"  Failed to process {email} after {attempts} attempts.")
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

        # Cleanup detail csv and browser
        if 'csv_file' in locals() and not csv_file.closed:
            csv_file.close()
        
        # Remove checkpoint on successful completion of all emails
        if len(failed_emails) == 0:
            if os.path.exists(checkpoint_file):
                try:
                    os.remove(checkpoint_file)
                    print("All detail scraping completed successfully. Checkpoint removed.")
                except Exception as e:
                    print(f"Warning removing checkpoint: {e}")
        else:
            print(f"Detail scraping completed with {len(failed_emails)} failed emails. Checkpoint retained.")
                
        browser.close()
        
        # Run final data processing pipeline
        print("\nRunning final data processing pipeline...")
        try:
            process_data.process_data()
        except Exception as proc_err:
            print(f"Warning: Error during final data processing: {proc_err}")

        print("\n" + "="*50)
        print("DETAIL DATA SCRAPING COMPLETED")
        print("="*50)

if __name__ == "__main__":
    run_data_scraper()
