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

def get_active_pagination(page):
    pag_locators = page.locator("div:has-text('Menampilkan')")
    pag_count = pag_locators.count()
    for idx in range(pag_count):
        loc = pag_locators.nth(idx)
        if loc.is_visible():
            return loc
    return page.locator("div:has-text('Menampilkan')").last

def run_dashboard_scraper():
    auth_file = "auth_state.json"
    dashboard_csv = "dashboard_scraped_data.csv"
    
    # Load configuration
    env = load_env()
    username = env.get("USERNAME")
    password = env.get("PASSWORD")
    
    if not username or not password:
        print("Error: USERNAME or PASSWORD not set in .env file.")
        sys.exit(1)
        
    # Check headless mode (headless=True by default for Task Scheduler)
    headless_mode = True
    if "--headed" in sys.argv:
        headless_mode = False
        print("Running in HEADED mode.")
    else:
        print("Running in HEADLESS mode (default for Task Scheduler).")

    # Status columns in the output CSV for dashboard
    status_columns = [
        "OPEN", 
        "DRAFT", 
        "SUBMITTED BY Pencacah", 
        "REJECTED BY Pengawas", 
        "APPROVED BY Pengawas",
        "REVOKED BY Pengawas"
    ]
    dashboard_headers = ["Category", "Email", "SLS Code"] + status_columns
    scraped_data_dict = {}

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
                        print("Silakan jalankan ulang script dengan menambahkan argumen --headed (contoh: python run_se2026_dashboard.py --headed) agar browser terbuka,")
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
        
        # Scrape Dashboard Rekap Data
        print("\n--- Phase 1: Downloading Ringkasan CSVs ---")
        page.locator("button:has-text('Ringkasan')").first.click()
        page.wait_for_timeout(1500)
        
        csv_buttons = page.locator("button:has(svg.tabler-icon-csv)")
        csv_count = csv_buttons.count()
        print(f"Found {csv_count} CSV buttons under Ringkasan tab.")
        
        for i in range(csv_count):
            label = "Assign" if i == 0 else "Progres"
            filename = f"ringkasan_{label}.csv"
            save_path = os.path.join("data", filename)
            print(f"  Downloading CSV #{i+1} ({label}) -> {save_path}...")
            try:
                with page.expect_download(timeout=15000) as download_info:
                    csv_buttons.nth(i).click()
                download = download_info.value
                download.save_as(save_path)
                print(f"  Saved to {save_path}")
            except Exception as e:
                print(f"  Failed to download CSV #{i+1}: {e}")
                
        print("\n--- Phase 2: Scraping Rekap Petugas ---")
        page.locator("button:has-text('Rekap Petugas')").click()
        page.wait_for_timeout(2000)
        
        status_mapping = {
            "OPEN": "OPEN",
            "DRAFT": "DRAFT",
            "SUBMITTED BY PENCACAH": "SUBMITTED BY Pencacah",
            "REJECTED BY PENGAWAS": "REJECTED BY Pengawas",
            "APPROVED BY PENGAWAS": "APPROVED BY Pengawas",
            "REVOKED BY PENGAWAS": "REVOKED BY Pengawas",
        }
        
        last_first_email = None
        last_pag_text = None
        
        for category in ["Pengawas", "Pencacah"]:
            print(f"\nScraping Category: {category}")
            page.locator(f"button:has-text('{category}')").click()
            
            if last_first_email is not None or last_pag_text is not None:
                print(f"  Waiting for tab transition from previous category...")
                start_transition = time.time()
                transitioned = False
                while time.time() - start_transition < 30.0:
                    page.wait_for_timeout(500)
                    cur_first_el = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)").first
                    cur_first = cur_first_el.locator("div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm").text_content().strip() if cur_first_el.count() > 0 else ""
                    
                    cur_pag_el = get_active_pagination(page)
                    cur_pag = cur_pag_el.text_content().strip() if cur_pag_el and cur_pag_el.count() > 0 else ""
                    
                    if (cur_first != last_first_email or cur_pag != last_pag_text) and cur_first != "" and cur_pag != "":
                        transitioned = True
                        break
                if transitioned:
                    print("  Tab transition complete.")
                else:
                    print("  Warning: Tab transition timeout or no data.")
            else:
                print("  Waiting for initial cards to load...")
                try:
                    page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)").first.wait_for(state="visible", timeout=60000)
                except Exception:
                    print("  Warning: Timeout waiting for initial cards to load.")
                    
            page.wait_for_timeout(1000)
            
            page_one_btn = page.locator("a, button").filter(has_text=re.compile(r"^1$")).first
            if page_one_btn.count() > 0 and page_one_btn.is_visible():
                print("  Found Page 1 button, clicking to reset pagination...")
                page_one_btn.click()
                page.wait_for_timeout(2000)
                
            page_num = 1
            while True:
                first_email_el = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)").first
                prev_first_email = None
                if first_email_el.count() > 0:
                    prev_first_email = first_email_el.locator("div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm").text_content().strip()
                
                prev_pag_el = get_active_pagination(page)
                prev_pag_text = prev_pag_el.text_content().strip() if prev_pag_el and prev_pag_el.count() > 0 else ""
                
                cards_locator = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)")
                card_count = cards_locator.count()
                print(f"  [Page {page_num}] Found {card_count} cards on current page.")
                
                for i in range(card_count):
                    card = cards_locator.nth(i)
                    email = card.locator("div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm").text_content().strip()
                    print(f"    [{i+1}/{card_count}] Scraped user: {email}")
                    
                    controls_id = card.get_attribute("aria-controls")
                    if not controls_id:
                        print("      Error: aria-controls attribute not found!")
                        continue
                        
                    content_panel = page.locator(f"#{controls_id}")
                    state = card.get_attribute("data-state")
                    if state != "open":
                        card.click()
                        
                    content_panel.wait_for(state="visible", timeout=10000)
                    
                    try:
                        first_row = content_panel.locator("div.f\\:group.f\\:flex.f\\:flex-col.f\\:gap-3").first
                        first_row.wait_for(state="visible", timeout=10000)
                    except Exception:
                        print("      Timeout waiting for SLS rows.")
                        continue
                        
                    sls_rows = content_panel.locator("div.f\\:group.f\\:flex.f\\:flex-col.f\\:gap-3")
                    rows_count = sls_rows.count()
                    print(f"      Found {rows_count} SLS rows.")
                    
                    for j in range(rows_count):
                        row = sls_rows.nth(j)
                        sls_code = row.locator("div.f\\:font-semibold.f\\:text-foreground.f\\:text-sm").text_content().strip()
                        tags = row.locator("div.f\\:flex.f\\:flex-wrap.f\\:items-center.f\\:gap-2 > div")
                        tags_count = tags.count()
                        
                        key = (category, email, sls_code)
                        if key not in scraped_data_dict:
                            scraped_data_dict[key] = {col: 0 for col in status_columns}
                            
                        for k in range(tags_count):
                            tag = tags.nth(k)
                            spans = tag.locator("span")
                            if spans.count() >= 2:
                                status_name = spans.nth(0).text_content().strip().upper()
                                count = spans.nth(1).text_content().strip()
                                if status_name in status_mapping:
                                    scraped_data_dict[key][status_mapping[status_name]] = int(count)
                                    
                    card.click()
                    try:
                        content_panel.wait_for(state="hidden", timeout=5000)
                    except Exception:
                        pass
                        
                pagination_container = get_active_pagination(page)
                next_btn = None
                if pagination_container:
                    next_btn = pagination_container.locator("a:has-text('Next'), button:has-text('Next')").first
                
                is_disabled = False
                if next_btn and next_btn.count() > 0:
                    btn_class = next_btn.get_attribute("class") or ""
                    btn_disabled = next_btn.get_attribute("disabled")
                    aria_disabled = next_btn.get_attribute("aria-disabled")
                    data_disabled = next_btn.get_attribute("data-disabled")
                    classes = btn_class.split()
                    is_pointer_events_none = False
                    is_opacity_50 = False
                    has_disabled_class = False
                    for cls in classes:
                        if 'pointer-events-none' in cls and 'disabled:' not in cls:
                            is_pointer_events_none = True
                        if 'opacity-50' in cls and 'disabled:' not in cls:
                            is_opacity_50 = True
                        if cls == 'disabled' or cls == 'f:disabled' or 'btn-disabled' in cls:
                            has_disabled_class = True
                    
                    if (is_pointer_events_none or is_opacity_50 or has_disabled_class or 
                        aria_disabled == 'true' or data_disabled == 'true' or data_disabled == '' or 
                        btn_disabled is not None):
                        is_disabled = True
                        
                if next_btn and next_btn.count() > 0 and next_btn.is_visible() and not is_disabled and prev_first_email:
                    clicked_ok = False
                    for attempt in range(3):
                        if attempt > 0:
                            print(f"  Retrying next page click (attempt {attempt+1}/3)...")
                            page.wait_for_timeout(2000)
                        
                        try:
                            # Re-locate the pagination container and next button to avoid stale element reference
                            pagination_container = get_active_pagination(page)
                            if pagination_container:
                                current_next_btn = pagination_container.locator("a:has-text('Next'), button:has-text('Next')").first
                                if current_next_btn.count() > 0 and current_next_btn.is_visible():
                                    current_next_btn.click(timeout=20000)
                                else:
                                    print("  Next button no longer found or not visible.")
                            else:
                                print("  Pagination container not found.")
                        except Exception as e:
                            print(f"  Click Next button failed or timed out: {e}")
                            # Continue to next retry instead of breaking, giving it a chance to try again
                            continue
                        
                        start_time = time.time()
                        page_changed = False
                        while time.time() - start_time < 45.0:
                            page.wait_for_timeout(500)
                            current_first_email_el = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)").first
                            current_first_email = ""
                            if current_first_email_el.count() > 0:
                                current_first_email = current_first_email_el.locator("div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm").text_content().strip()
                                
                            cur_pag_el = get_active_pagination(page)
                            current_pag_text = cur_pag_el.text_content().strip() if cur_pag_el and cur_pag_el.count() > 0 else ""
                            
                            if (current_first_email != prev_first_email and current_first_email != "") or (current_pag_text != prev_pag_text and current_pag_text != ""):
                                page_changed = True
                                break
                                
                        if page_changed:
                            clicked_ok = True
                            break
                            
                    if not clicked_ok:
                        print("  Warning: Pagination transition timeout. Breaking loop.")
                        break
                        
                    page_num += 1
                    page.wait_for_timeout(1000)
                else:
                    print("  Reached last page of category.")
                    break
            
            last_first_el = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)").first
            last_first_email = last_first_el.locator("div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm").text_content().strip() if last_first_el.count() > 0 else ""
            last_pag_el = get_active_pagination(page)
            last_pag_text = last_pag_el.text_content().strip() if last_pag_el and last_pag_el.count() > 0 else ""
 
        # Export dashboard CSV
        print(f"\nWriting dashboard data to '{dashboard_csv}'...")
        try:
            merged_data = {}
            if os.path.exists(dashboard_csv):
                print(f"Loading existing data from '{dashboard_csv}' for merging...")
                try:
                    with open(dashboard_csv, "r", encoding="utf-8") as f:
                        reader = csv.reader(f)
                        header = next(reader, None)
                        if header:
                            try:
                                cat_idx = header.index("Category")
                                email_idx = header.index("Email")
                                sls_idx = header.index("SLS Code")
                            except ValueError:
                                cat_idx, email_idx, sls_idx = 0, 1, 2
                            
                            for row in reader:
                                if not row or len(row) < 3:
                                    continue
                                category = row[cat_idx].strip()
                                email = row[email_idx].strip().lower()
                                sls_code = row[sls_idx].strip()
                                
                                status_counts = {}
                                for col in status_columns:
                                    try:
                                        col_idx = header.index(col)
                                        val = int(row[col_idx])
                                    except (ValueError, IndexError):
                                        val = 0
                                    status_counts[col] = val
                                
                                merged_data[(category, email, sls_code)] = status_counts
                    print(f"Loaded {len(merged_data)} existing SLS status records.")
                except Exception as e:
                    print(f"Warning: Could not read existing dashboard CSV: {e}")

            new_count = 0
            updated_count = 0
            for key, val in scraped_data_dict.items():
                norm_key = (key[0], key[1].lower(), key[2])
                if norm_key in merged_data:
                    updated_count += 1
                else:
                    new_count += 1
                merged_data[norm_key] = val
            
            print(f"Merging results: {updated_count} records updated, {new_count} new records added.")

            with open(dashboard_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(dashboard_headers)
                for key, val in merged_data.items():
                    row = list(key) + [val[col] for col in status_columns]
                    writer.writerow(row)
            print(f"Successfully merged and written {len(merged_data)} SLS status rows to '{dashboard_csv}'!")
        except Exception as csv_err:
            print(f"Error writing dashboard CSV: {csv_err}")
 
        # Intermediate processing and Git push
        print("\nProcessing intermediate dashboard data...")
        try:
            process_data.process_dashboard_scraped_data()
            
            # Copy dashboard_scraped_data.csv to public folder
            public_dir = os.path.join("dashboard", "public")
            if os.path.exists(public_dir):
                import shutil
                shutil.copy2(dashboard_csv, os.path.join(public_dir, "dashboard_scraped_data.csv"))
                
                # Copy other files
                pml_ppl_src = os.path.join("data", "pml_ppl.csv")
                if os.path.exists(pml_ppl_src):
                    shutil.copy2(pml_ppl_src, os.path.join(public_dir, "pml_ppl.csv"))
                
                koseka_src = os.path.join("data", "koseka.csv")
                if os.path.exists(koseka_src):
                    shutil.copy2(koseka_src, os.path.join(public_dir, "koseka.csv"))
                
                assign_src = os.path.join("data", "ringkasan_Assign.csv")
                if os.path.exists(assign_src):
                    shutil.copy2(assign_src, os.path.join(public_dir, "ringkasan_Assign.csv"))
                
                progres_src = os.path.join("data", "ringkasan_Progres.csv")
                if os.path.exists(progres_src):
                    shutil.copy2(progres_src, os.path.join(public_dir, "ringkasan_Progres.csv"))
                
                # Write timestamp
                timestamp = process_data.get_wita_timestamp()
                with open(os.path.join(public_dir, "last_updated.txt"), "w", encoding="utf-8") as tf:
                    tf.write(timestamp)
                
                # Commit & push
                print("Staging and pushing dashboard changes to GitHub...")
                process_data.run_git_commands(timestamp)
        except Exception as proc_err:
            print(f"Warning during intermediate processing: {proc_err}")

        browser.close()

        print("\n" + "="*50)
        print("DASHBOARD SCRAPING COMPLETED")
        print("="*50)

if __name__ == "__main__":
    run_dashboard_scraper()
