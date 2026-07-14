import os
import re
import csv
import sys
import time
import json
import argparse
import random
from patchright.sync_api import sync_playwright

STEALTH_SPEED_UP = "--fast" in sys.argv
if STEALTH_SPEED_UP:
    print("Running in FAST mode (minimal delays).")

SURVEY_ID = "a0429e96-51a5-477b-a415-485f9c153004"

# Monkeypatch time.sleep to automatically add random delays (stealth)
_original_sleep = time.sleep
def _stealth_sleep(seconds):
    _original_sleep(seconds * random.uniform(0.8, 1.5))
time.sleep = _stealth_sleep

def _delay(page, fast_ms, normal_ms_range):
    """Apply delay: fixed ms in fast mode, random range otherwise."""
    if STEALTH_SPEED_UP:
        page.wait_for_timeout(fast_ms)
    else:
        page.wait_for_timeout(random.randint(*normal_ms_range))

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

def wait_for_table_load(page, previous_first_row_text=None, timeout=45000):
    print("  Waiting for datatable to load...")
    # First, wait 2.5 seconds to let the table clear/start loading
    page.wait_for_timeout(2500)
    
    # Wait for any loader spinner to be hidden
    try:
        loaders = page.locator("ngx-spinner, .ngx-spinner, svg.tabler-icon-loader, svg.tabler-icon-loader-2, .animate-spin")
        count = loaders.count()
        for idx in range(count):
            try:
                loaders.nth(idx).wait_for(state="hidden", timeout=5000)
            except Exception:
                pass
    except Exception:
        pass
        
    # Wait until table rows are present
    start_time = time.time()
    while time.time() - start_time < (timeout / 1000.0):
        rows = page.locator("table tbody tr")
        row_count = rows.count()
        if row_count > 0:
            first_row_text = rows.first.text_content().strip()
            # If previous first row was provided, wait until the row text changes (i.e. table actually updated)
            if previous_first_row_text is not None:
                if first_row_text != previous_first_row_text:
                    print(f"  Table loaded. First row text updated: '{first_row_text[:60]}...'")
                    break
            else:
                # No previous row provided, table is populated, check if it's not a loading placeholder
                if "loading" not in first_row_text.lower():
                    print(f"  Table loaded. First row: '{first_row_text[:60]}...'")
                    break
        page.wait_for_timeout(500)
    page.wait_for_timeout(1000)

def scrape_page(page, filter_metadata, csv_writer):
    rows_locator = page.locator("table tbody tr")
    row_count = rows_locator.count()
    
    if row_count == 0:
        print("  No rows found in table.")
        return 0
        
    first_row_text = rows_locator.first.text_content().lower()
    if "tidak ada data" in first_row_text or "empty" in first_row_text or "no data" in first_row_text:
        print("  No data matching filters/search.")
        return 0
        
    scraped_count = 0
    for i in range(row_count):
        cols = rows_locator.nth(i).locator("td").all_text_contents()
        if len(cols) >= 15:
            cleaned_cols = [c.strip() for c in cols]
            csv_writer.writerow(filter_metadata + cleaned_cols[1:15])
            scraped_count += 1
            
    print(f"  Scraped {scraped_count} rows from current page.")
    return scraped_count

def ensure_100_rows_per_page(page):
    try:
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
            _delay(page, 2000, (3000, 5000))
            dismiss_overlays(page)
            
        selects_locator = page.locator("select")
        select_count = selects_locator.count()
        for idx in range(select_count):
            sel = selects_locator.nth(idx)
            if sel.is_visible():
                options = sel.locator("option").all_text_contents()
                if "100" in options or any("100" in opt for opt in options):
                    sel.select_option("100")
                    _delay(page, 1500, (2000, 4000))
                    print("  Set page size to 100 via select dropdown.")
                    return
    except Exception as e:
        print(f"  Warning setting 100 rows per page: {e}")

def simulate_human_mouse(page):
    """Move mouse around the page to feed behavioral check of WAF."""
    try:
        print("  Simulating human-like mouse movement...")
        for _ in range(5):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            page.mouse.move(x, y, steps=10)
            page.wait_for_timeout(random.randint(150, 400))
    except Exception:
        pass

def select_filter_option(page, label_name, long_code, short_code, max_attempts=3):
    if not long_code:
        return True
        
    print(f"Applying filter '{label_name}' (codes: long={long_code}, short={short_code})...")
    
    # Map label to its combobox index in the sidebar
    # Order in sidebar: PROVINSI, KABUPATEN/KOTA, KECAMATAN, DESA, SLS, SUBSLS
    index_map = {
        "PROVINSI": 0,
        "KABUPATEN": 1,
        "KECAMATAN": 2,
        "DESA": 3,
        "SLS": 4,
        "SUBSLS": 5
    }
    
    combobox_idx = index_map.get(label_name)
    if combobox_idx is None:
        print(f"  Warning: Unknown filter label '{label_name}'")
        return False
        
    # Map label name to ngx-select tag
    selector_map = {
        "PROVINSI": "ngx-select[name='region1Id'], ngx-select[id='region1Id']",
        "KABUPATEN": "ngx-select[name='region2Id'], ngx-select[id='region2Id']",
        "KECAMATAN": "ngx-select[name='region3Id'], ngx-select[id='region3Id']",
        "DESA": "ngx-select[name='region4Id'], ngx-select[id='region4Id']",
        "SLS": "ngx-select[name='region5Id'], ngx-select[id='region5Id']",
        "SUBSLS": "ngx-select[name='region6Id'], ngx-select[id='region6Id']"
    }
    
    ngx_selector = selector_map.get(label_name)
    if not ngx_selector:
        print(f"  Warning: Selector not found for label '{label_name}'")
        return False

    for attempt in range(1, max_attempts + 1):
        try:
            # 1. Ensure filter sidebar is open and visible by checking if the PROVINSI select element is visible
            is_open = page.locator("ngx-select[name='region1Id'], ngx-select[id='region1Id']").first.is_visible()
                
            if not is_open:
                print(f"  [Attempt {attempt}/{max_attempts}] Opening filter sidebar slider...")
                dismiss_overlays(page)
                # Find the filter button by its icon class (tabler-icon-filter) or button container
                filter_btn = page.locator("button:has(svg.tabler-icon-filter), button:has-text('Filter')").first
                
                filter_btn.wait_for(state="visible", timeout=30000)
                try:
                    filter_btn.click(timeout=10000)
                except Exception as click_err:
                    print(f"  Clicking Filter button failed: {click_err}. Retrying with overlay dismiss...")
                    dismiss_overlays(page)
                    filter_btn.click(force=True)
                
                # Wait for sidebar sheet transition by waiting for the ngx-select inside it
                page.locator("ngx-select[name='region1Id'], ngx-select[id='region1Id']").first.wait_for(state="visible", timeout=20000)
                _delay(page, 1500, (2000, 3500))

            # 2. Locate the ngx-select component
            ngx_select = page.locator(ngx_selector).first
            ngx_select.wait_for(state="visible", timeout=20000)
            
            # Check if this option is already selected
            current_text = ngx_select.locator(".ngx-select__selected, .ngx-select__toggle, .ngx-select__selected-single").first.text_content().strip()
            if f"[{short_code}]" in current_text or f"[{long_code}]" in current_text:
                print(f"  Filter '{label_name}' already set to '{current_text}'. Skipping selection.")
                return True
                
            simulate_human_mouse(page)
            print(f"  Clicking combobox/toggle for '{label_name}'...")
            
            # Click the select toggle or search input to open dropdown
            toggle = ngx_select.locator(".ngx-select__toggle, .ngx-select__search").first
            try:
                toggle.click(timeout=10000)
            except Exception:
                dismiss_overlays(page)
                toggle.click(force=True)
            _delay(page, 1000, (1500, 2500))
            
            # 3. Wait for search input to be active inside the ngx-select
            search_input = ngx_select.locator("input.ngx-select__search").first
            search_input.wait_for(state="visible", timeout=15000)
            
            # Type code to filter the options
            print(f"  Filtering options with code: '{short_code}'...")
            search_input.fill(short_code)
            _delay(page, 1000, (1500, 2500))
            
            # 4. Wait for filtered options list to render
            option_locator = ngx_select.locator("ul.ngx-select__choices a.ngx-select__item")
            try:
                option_locator.first.wait_for(state="visible", timeout=10000)
            except Exception:
                pass
                
            options = option_locator.all()
            if not options:
                print(f"  No options found with short code '{short_code}'. Trying long code '{long_code}'...")
                search_input.fill(long_code)
                _delay(page, 1000, (1500, 2500))
                try:
                    option_locator.first.wait_for(state="visible", timeout=5000)
                except Exception:
                    pass
                options = option_locator.all()
                
            if not options:
                raise Exception(f"No option items visible after filtering for code: {short_code} / {long_code}")
                
            # Find the best match option
            target_option = None
            for opt in options:
                try:
                    if opt.is_visible():
                        opt_text = opt.text_content().strip()
                        if f"[{short_code}]" in opt_text or f"[{long_code}]" in opt_text or opt_text.startswith(short_code) or opt_text.startswith(long_code):
                            target_option = opt
                            break
                except Exception:
                    pass
                    
            if target_option is None:
                for opt in options:
                    if opt.is_visible():
                        target_option = opt
                        break
                        
            if target_option is None:
                raise Exception("No visible option available in the dropdown list.")
                
            print(f"  Clicking option: '{target_option.text_content().strip()}'")
            try:
                target_option.click(timeout=10000)
            except Exception:
                target_option.click(force=True)
            _delay(page, 1500, (2000, 3500))
            
            return True
            
        except Exception as e:
            print(f"  [Attempt {attempt}/{max_attempts}] Failed applying filter '{label_name}': {e}")
            page.keyboard.press("Escape")
            _delay(page, 1000, (1500, 3000))
            
            if attempt < max_attempts:
                print("  Reloading page and waiting for table reload to retry...")
                try:
                    page.reload()
                    page.wait_for_timeout(5000)
                    page.locator("table").first.wait_for(state="visible", timeout=45000)
                except Exception:
                    pass
                
    print(f"Error: Failed to apply filter '{label_name}' after {max_attempts} attempts.")
    return False

def close_filter_drawer(page):
    print("Applying filters (clicking 'Filter Data')...")
    # Click the "Filter Data" button inside the sidebar to apply the filter
    filter_data_btn = page.locator("button:has-text('Filter Data')").first
    if filter_data_btn.count() > 0 and filter_data_btn.is_visible():
        try:
            filter_data_btn.click(timeout=10000)
        except Exception:
            filter_data_btn.click(force=True)
        _delay(page, 2000, (3000, 4500))
        
    # Close the sidebar slider by clicking the X button
    close_btn = page.locator("[role='dialog']:has-text('Filter Wilayah') button:has(svg.tabler-icon-x)").first
    if close_btn.count() > 0 and close_btn.is_visible():
        print("Closing filter sidebar...")
        try:
            close_btn.click(timeout=5000)
        except Exception as e:
            print(f"  Warning closing sidebar: {e}. Trying Escape key...")
            page.keyboard.press("Escape")
    else:
        print("  Warning: Close button not found. Using Escape key...")
        page.keyboard.press("Escape")
    _delay(page, 1000, (1500, 2500))


def dismiss_overlays(page):
    """Dismiss any modal dialogs (like Radix dialogs) that block clicks on the page,
    but DO NOT dismiss the region filter sidebar.
    """
    try:
        dialogs = page.locator("[role='dialog'], .modal, div[id^='radix-']")
        count = dialogs.count()
        if count > 0:
            for idx in range(count):
                try:
                    dialog = dialogs.nth(idx)
                    if dialog.is_visible():
                        text = dialog.text_content().lower()
                        # Skip if it is the filter sidebar
                        if "filter" in text and ("provinsi" in text or "wilayah" in text or "kabupaten" in text):
                            continue
                        print("  [Overlay] Detected active overlay/dialog. Dismissing...")
                        for _ in range(3):
                            page.keyboard.press("Escape")
                            page.wait_for_timeout(500)
                except Exception:
                    pass
    except Exception as e:
        print(f"  [Overlay] Warning dismissing overlays: {e}")

def navigate_to_survey(page):
    """Navigate to the SE2026 survey and enter the Data (collect) page.
    BPS new UI uses sidebar navigation instead of PENDATAAN period cards.
    """
    # If already inside the survey data page, skip
    if SURVEY_ID in page.url and (page.url.endswith("/data") or page.url.endswith("/data/") or "/collect/" in page.url):
        print("  Already on survey data page. Skipping navigation.")
        return

    # If already on the survey detail page (sidebar visible), click Data link
    if SURVEY_ID in page.url:
        print("  Already on survey detail page. Clicking Data sidebar link...")
        data_link = page.get_by_role("link", name="Data", exact=True).first
        if data_link.count() == 0:
            data_link = page.locator("a[href$='/data'], a[href*='/data']").first
        
        if data_link.count() > 0:
            try:
                data_link.click(timeout=10000)
            except Exception:
                dismiss_overlays(page)
                data_link.click(force=True)
            try:
                page.wait_for_url("**/data", timeout=20000)
                print("  Successfully navigated to survey data page.")
            except Exception as e:
                print(f"  Warning: wait_for_url to data page failed: {e}. Current URL: {page.url}")
            _delay(page, 2000, (3000, 4500))
            return

    # Navigate to app dashboard first if not already there
    if not page.url.endswith("/app") and not page.url.endswith("/app/"):
        print("  Navigating to app dashboard...")
        page.goto("https://fasih-sm.bps.go.id/app")
        _delay(page, 2000, (3000, 4500))

    # Dismiss any dialogs/modals on the dashboard
    dismiss_overlays(page)

    # Search for survey in the app dashboard
    print("  Searching for 'SENSUS EKONOMI 2026' on app dashboard...")
    search_input = page.locator("input[placeholder='Cari survei...'], input[aria-controls='Pencacahan'], #Pencacahan_filter input").first
    try:
        search_input.wait_for(state="visible", timeout=30000)
    except Exception:
        # Fallback to survey list page if not found on /app
        print("  Search input not found on /app dashboard. Navigating to survey list page...")
        page.goto("https://fasih-sm.bps.go.id/survey-collection/survey")
        _delay(page, 2000, (3000, 4500))
        search_input = page.locator("input[placeholder='Cari survei...'], input[aria-controls='Pencacahan'], #Pencacahan_filter input").first
        search_input.wait_for(state="visible", timeout=30000)

    # Dismiss overlays again right before typing/clicking search
    dismiss_overlays(page)

    search_input.fill("SENSUS EKONOMI 2026")
    search_input.press("Enter")
    _delay(page, 1500, (2000, 3000))

    survey_items = page.locator("text=SENSUS EKONOMI 2026")
    survey_items.first.wait_for(state="visible", timeout=30000)
    
    # Dismiss overlays right before selecting/clicking the survey item
    dismiss_overlays(page)

    survey_item = None
    for idx in range(survey_items.count()):
        item = survey_items.nth(idx)
        if item.text_content().strip() == "SENSUS EKONOMI 2026":
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

    print(f"  Clicking survey: '{survey_item.text_content().strip()}'")
    try:
        survey_item.click(timeout=10000)
    except Exception as click_err:
        print(f"  Clicking survey failed: {click_err}. Retrying with overlay dismiss...")
        dismiss_overlays(page)
        # Click with force to bypass any overlay blocking pointer events
        survey_item.click(force=True)
    _delay(page, 2000, (3000, 4500))

    # Click the PENDATAAN period if it is shown
    pendataan_btn = page.locator("text=PENDATAAN").first
    if pendataan_btn.count() > 0 and pendataan_btn.is_visible():
        print("  Navigating to PENDATAAN period...")
        try:
            pendataan_btn.click(timeout=10000)
        except Exception:
            dismiss_overlays(page)
            pendataan_btn.click(force=True)
        _delay(page, 2000, (3000, 4500))

    # Click the 'Data' sidebar link to navigate to /survey-collection/general/{id}/data
    print("  Clicking Data sidebar link...")
    data_link = page.get_by_role("link", name="Data", exact=True).first
    if data_link.count() == 0:
        data_link = page.locator("a[href$='/data'], a[href*='/data']").first
        
    data_link.wait_for(state="visible", timeout=30000)
    try:
        data_link.click(timeout=10000)
    except Exception:
        dismiss_overlays(page)
        data_link.click(force=True)
    try:
        page.wait_for_url("**/data", timeout=20000)
        print("  Successfully navigated to survey data page.")
    except Exception as e:
        print(f"  Warning: wait_for_url to data page failed: {e}. Current URL: {page.url}")
    _delay(page, 2000, (3000, 4500))

def main():
    parser = argparse.ArgumentParser(description="Scrape data mikro using 14-digit SLS code filters.")
    parser.add_argument("--code", type=str, default=None, help="14-digit SLS code (e.g. 71030400070002)")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode (default is visible/headed)")
    args = parser.parse_args()

    # Get the 14-digit code
    code_input = args.code
    if not code_input:
        try:
            code_input = input("Masukkan 14-digit kode SLS (contoh: 71030400070002): ").strip()
        except (KeyboardInterrupt, SystemExit):
            sys.exit(0)
            
    if not code_input or len(code_input) != 14 or not code_input.isdigit():
        print("Error: Kode SLS harus berupa 14-digit angka.")
        sys.exit(1)

    # Parse 14-digit code
    # format: 71 03 040 007 0002
    prov_short = code_input[0:2]     # 71
    kab_short = code_input[2:4]       # 03
    kec_short = code_input[4:7]       # 040
    desa_short = code_input[7:10]     # 007
    sls_short = code_input[10:14]     # 0002
    
    prov_long = prov_short
    kab_long = prov_short + kab_short
    kec_long = kab_long + kec_short
    desa_long = kec_long + desa_short
    sls_long = desa_long + sls_short
    
    print(f"\n--- Parsed SLS Code Configuration ---")
    print(f"PROVINSI       : {prov_short}")
    print(f"KABUPATEN      : {kab_long}  (short={kab_short})")
    print(f"KECAMATAN      : {kec_long} (short={kec_short})")
    print(f"DESA           : {desa_long} (short={desa_short})")
    print(f"SLS            : {sls_long} (short={sls_short})")
    print(f"--------------------------------------\n")

    env = load_env()
    username = env.get("USERNAME")
    password = env.get("PASSWORD")
    
    if not username or not password:
        print("Error: USERNAME or PASSWORD not set in .env file.")
        sys.exit(1)
        
    auth_file = "auth_state.json"
    output_csv = os.path.join("research", "get_data_mikro", "scraped_data_mikro.csv")
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    
    with sync_playwright() as p:
        print("Launching Chromium browser...")
        browser = p.chromium.launch(
            headless=args.headless,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding"
            ]
        )
        
        if os.path.exists(auth_file):
            print(f"Loading session from '{auth_file}'...")
            context = browser.new_context(storage_state=auth_file)
        else:
            context = browser.new_context()
            
        context.set_default_timeout(60000)
        context.set_default_navigation_timeout(60000)
        page = context.new_page()
        
        # Debugging listeners for API requests and errors
        page.on("console", lambda msg: print(f"Console [{msg.type}]: {msg.text}") if msg.type in ["error", "warning"] else None)
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))
        page.on("request", lambda req: print(f"API Request: {req.method} {req.url}") if "api" in req.url or "wilayah" in req.url else None)
        
        def log_response(res):
            if "api" in res.url or "wilayah" in res.url:
                print(f"API Response: {res.status} {res.url}")
                if "region" in res.url or "wilayah" in res.url or "datatable" in res.url:
                    try:
                        text = res.text()
                        print(f"  --> API Response Body: {text[:500]}")
                    except Exception as e:
                        print(f"  --> Error reading response body: {e}")
        page.on("response", log_response)
        
        # Dictionary to store real database UUIDs for region options (updated dynamically)
        real_ids = {
            "prov": prov_long,
            "kab": kab_long,
            "kec": kec_long,
            "desa": desa_long,
            "sls": sls_long
        }
        
        # Route interceptor to mock region API responses and bypass WAF
        def handle_region_route(route):
            url = route.request.url
            print(f"Intercepted Region API Call: {url}")
            
            # Construct mock response depending on the level in URL path
            if "/level1" in url:
                # Provinsi
                data = [{"id": real_ids["prov"], "fullCode": prov_long, "code": prov_short, "name": f"[{prov_short}] SULAWESI UTARA"}]
            elif "/level2" in url:
                # Kabupaten
                data = [{"id": real_ids["kab"], "fullCode": kab_long, "code": kab_short, "name": f"[{kab_short}] KEPULAUAN SANGIHE"}]
            elif "/level3" in url:
                # Kecamatan
                data = [{"id": real_ids["kec"], "fullCode": kec_long, "code": kec_short, "name": f"[{kec_short}] MANGANITU"}]
            elif "/level4" in url:
                # Desa
                data = [{"id": real_ids["desa"], "fullCode": desa_long, "code": desa_short, "name": f"[{desa_short}] DESA KAMPUNG"}]
            elif "/level5" in url or "/level6" in url or "/sls" in url:
                # SLS
                data = [{"id": real_ids["sls"], "fullCode": sls_long, "code": sls_short, "name": f"[{sls_short}] SLS KAMPUNG"}]
            else:
                route.continue_()
                return
                
            response_json = {
                "success": True,
                "message": "Successfully fetched region data.",
                "data": data
            }
            route.fulfill(
                status=200,
                headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
                body=json.dumps(response_json)
            )
            
        page.route("**/region/api/v1/region/level*", handle_region_route)
        
        # Navigate to BPS FASIH
        print("Navigating to BPS FASIH website...")
        max_attempts = 5
        for attempt in range(1, max_attempts + 1):
            try:
                page.goto("https://fasih-sm.bps.go.id/app", timeout=120000)
                break
            except Exception as e:
                print(f"Error navigating: {e}")
                if attempt == max_attempts:
                    raise
                wait_sec = attempt * 10
                print(f"Waiting {wait_sec}s before retrying...")
                _delay(page, wait_sec * 1000, (wait_sec * 800, wait_sec * 1200))
        _delay(page, 2000, (3000, 4500))
        
        # Handle SSO login if redirected
        if "sso.bps.go.id" in page.url or page.locator("#username").count() > 0 or page.locator("text=Login SSO BPS").count() > 0:
            print("Login SSO required.")
            if page.locator("text=Login SSO BPS").count() > 0:
                page.locator("text=Login SSO BPS").first.click()
                _delay(page, 2000, (3000, 4000))
            if page.locator("#username").count() > 0:
                print(f"Filling credentials for user: {username}...")
                page.locator("#username").fill(username)
                page.locator("#password").fill(password)
                page.locator("#kc-login").click()
                print("Waiting for redirection back to app...")
                page.wait_for_url(re.compile(r"/(app|survey)"), timeout=120000)
                _delay(page, 3000, (4000, 6000))
                # Save session
                context.storage_state(path=auth_file)
                print(f"Session saved to '{auth_file}'")
                
        # Navigate to Survey SENSUS EKONOMI 2026 PENDATAAN
        navigate_to_survey(page)
        
        # navigate_to_survey now takes us directly to the Data/collect page
        # No separate "Detail Data Tab" transition needed
            
        # Check for CAPTCHA or wait for page load
        print("Checking for WAF CAPTCHA or waiting for page load...")
        start_time = time.time()
        while time.time() - start_time < 300:  # Wait up to 5 minutes
            # Multiple signals that page has loaded successfully
            page_loaded = False
            
            # Signal 1: Search input (old UI)
            search_input = page.locator('input[placeholder="Cari..."]')
            if search_input.count() > 0 and search_input.is_visible():
                print("Page loaded successfully! Search input found.")
                page_loaded = True
            
            # Signal 2: Table element present (new UI /collect/ page)
            if not page_loaded:
                table = page.locator("table, .dataTables_wrapper, [class*='table']")
                if table.count() > 0 and table.first.is_visible():
                    print("Page loaded successfully! Table element found.")
                    page_loaded = True
            
            # Signal 3: Region filter dropdowns (select elements)
            if not page_loaded:
                selects = page.locator("select, [class*='select'], [role='combobox']")
                if selects.count() >= 2:
                    print("Page loaded successfully! Filter dropdowns found.")
                    page_loaded = True
                    
            # Signal 4: URL contains /collect/ and page has meaningful content
            if not page_loaded and "/collect/" in page.url:
                body_text = page.locator("body").text_content() or ""
                if len(body_text) > 500 and ("perilaku yang tidak wajar" not in body_text.lower()):
                    print("Page loaded successfully! Collect page with content detected.")
                    page_loaded = True
            
            if page_loaded:
                break
                
            # Check if CAPTCHA page
            is_captcha = False
            try:
                body_text = page.locator("body").text_content().lower()
                if "perilaku yang tidak wajar" in body_text or "bukan bot" in body_text or "support id" in body_text or page.locator("input[type='submit']").count() > 0:
                    is_captcha = True
            except Exception:
                pass
                
            if is_captcha:
                if args.headless:
                    print("\n" + "!"*80)
                    print("ERROR: BPS WAF CAPTCHA terdeteksi, tetapi script berjalan dalam mode HEADLESS.")
                    print("Silakan jalankan ulang script tanpa argumen --headless untuk menyelesaikannya secara manual.")
                    print("!"*80 + "\n")
                    sys.exit(1)
                else:
                    print("BPS WAF CAPTCHA terdeteksi! Silakan selesaikan CAPTCHA di browser Chromium yang terbuka.")
                    print("Script akan melanjutkan otomatis setelah CAPTCHA berhasil diselesaikan...")
                    time.sleep(5)
                    continue
            time.sleep(2)
        else:
            print("Error: Timeout waiting for page load or CAPTCHA resolution.")
            browser.close()
            sys.exit(1)
            
        # Fetch real UUIDs from custom-by-smallest-code-and-level API URL using browser fetch
        metadata_url = f"https://fasih-sm.bps.go.id/app/api/region/api/v1/region/custom-by-smallest-code-and-level?groupId=a45adac1-e711-4c15-b3f9-1f30fc151565&smallestLevelFullCode={sls_long}&level=5"
        print(f"\nFetching real region metadata from: {metadata_url}")
        try:
            region_info = page.evaluate(f"""
                async () => {{
                    const res = await fetch("{metadata_url}");
                    const json = await res.json();
                    return json.data;
                }}
            """)
            
            # Extract real IDs
            l1 = region_info.get("level1", {}) if region_info else {}
            l2 = l1.get("level2", {})
            l3 = l2.get("level3", {})
            l4 = l3.get("level4", {})
            l5 = l4.get("level5", {})
            
            real_ids["prov"] = l1.get("id", "71")
            real_ids["kab"] = l2.get("id", "7103")
            real_ids["kec"] = l3.get("id", "7103040")
            real_ids["desa"] = l4.get("id", "7103040007")
            real_ids["sls"] = l5.get("id", "71030400070002")
            
            print("Successfully retrieved real region UUIDs from database:")
            print(f"  PROVINSI  : {real_ids['prov']}")
            print(f"  KABUPATEN : {real_ids['kab']}")
            print(f"  KECAMATAN : {real_ids['kec']}")
            print(f"  DESA      : {real_ids['desa']}")
            print(f"  SLS       : {real_ids['sls']}")
            
        except Exception as e:
            print(f"Warning: Failed to fetch real region UUIDs: {e}. Falling back to defaults.")

        ensure_100_rows_per_page(page)
        
        print("Waiting 4 seconds for page hydration...")
        _delay(page, 3000, (4000, 6000))
        
        # Apply filters in order
        select_filter_option(page, "PROVINSI", prov_long, prov_short)
        select_filter_option(page, "KABUPATEN", kab_long, kab_short)
        select_filter_option(page, "KECAMATAN", kec_long, kec_short)
        select_filter_option(page, "DESA", desa_long, desa_short)
        select_filter_option(page, "SLS", sls_long, sls_short)
        
        close_filter_drawer(page)
        print("Filters applied. Waiting for table reload...")
        wait_for_table_load(page)
        
        # Take diagnostic screenshot of the table state
        try:
            table_screenshot_path = os.path.join("research", "get_data_mikro", "table_after_filter.png")
            page.screenshot(path=table_screenshot_path)
            print(f"  [Debug] Saved table state screenshot to '{table_screenshot_path}'")
        except Exception as se:
            print(f"  [Debug] Failed saving screenshot: {se}")
            
        # CSV Headers
        headers = [
            "Filter_Provinsi", "Filter_Kabupaten", "Filter_Kecamatan", "Filter_Desa", "Filter_SLS",
            "Kode Identitas", "Nama Keluarga/Bangunan/Usaha", "Alamat Prelist",
            "Nomor Urut Bangunan / IDSBR", "NIB", "Email", "Skala Usaha / Jenis Prelist",
            "Jumlah Usaha", "Kode Pos", "Perubahan SLS", "Status",
            "Petugas Saat Ini", "Mode", "Keterangan"
        ]
        
        filter_metadata = [prov_long, kab_long, kec_long, desa_long, sls_long]
        
        print(f"Initializing output CSV: '{output_csv}'")
        with open(output_csv, "w", newline="", encoding="utf-8") as csv_file:
            csv_writer = csv.writer(csv_file)
            csv_writer.writerow(headers)
            
            page_num = 1
            total_scraped = 0
            while True:
                print(f"Scraping page {page_num}...")
                scraped_in_page = scrape_page(page, filter_metadata, csv_writer)
                total_scraped += scraped_in_page
                csv_file.flush()
                
                next_button = page.locator('button[aria-label="Go to next page"]')
                if next_button.count() > 0 and next_button.is_visible() and not next_button.is_disabled():
                    print("Navigating to next page...")
                    prev_row_text = page.locator("table tbody tr").first.text_content() if page.locator("table tbody tr").count() > 0 else None
                    next_button.click()
                    page_num += 1
                    wait_for_table_load(page, previous_first_row_text=prev_row_text)
                else:
                    break
                    
            print(f"\nScraping complete. Total records scraped: {total_scraped}")
            
        browser.close()

if __name__ == "__main__":
    main()
