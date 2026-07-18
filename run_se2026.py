import os
import re
import csv
import sys
import time
import json
from patchright.sync_api import sync_playwright
import process_data
import random
import shutil

STEALTH_SPEED_UP = "--fast" in sys.argv
if STEALTH_SPEED_UP:
    print("Running in FAST mode (minimal delays).")

SURVEY_ID = "a0429e96-51a5-477b-a415-485f9c153004"


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


def get_active_pagination(page):
    pag_locators = page.locator("div:has-text('Menampilkan')")
    pag_count = pag_locators.count()
    for idx in range(pag_count):
        loc = pag_locators.nth(idx)
        if loc.is_visible():
            return loc
    return page.locator("div:has-text('Menampilkan')").last


def get_first_email(page):
    el = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)").first
    if el.count() > 0:
        try:
            inner = el.locator("div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm")
            if inner.count() > 0:
                return inner.text_content().strip()
        except Exception:
            pass
    return ""


def has_page_error(page):
    """Detect the 'There's some error' overlay caused by expired session / JSON parse failure."""
    try:
        el = page.locator("text=There's some error")
        return el.count() > 0 and el.first.is_visible()
    except Exception:
        return False


def wait_for_content_change(page, old_email, old_pag="", timeout=20.0):
    """Poll until the first card email or pagination text changes. Returns True on change."""
    start = time.time()
    while time.time() - start < timeout:
        page.wait_for_timeout(300)
        if has_page_error(page):
            return False
        cur_email = get_first_email(page)
        if cur_email and cur_email != old_email:
            wait_for_network_idle(page)
            return True
        if old_pag:
            cur_pag_el = get_active_pagination(page)
            cur_pag = cur_pag_el.text_content().strip() if cur_pag_el and cur_pag_el.count() > 0 else ""
            if cur_pag and cur_pag != old_pag:
                wait_for_network_idle(page)
                return True
    return False


def is_next_disabled(next_btn):
    if not next_btn or next_btn.count() == 0:
        return True
    btn_class = next_btn.get_attribute("class") or ""
    for cls in btn_class.split():
        if "pointer-events-none" in cls and "disabled:" not in cls:
            return True
        if "opacity-50" in cls and "disabled:" not in cls:
            return True
    if next_btn.get_attribute("aria-disabled") == "true":
        return True
    data_disabled = next_btn.get_attribute("data-disabled")
    if data_disabled == "true" or data_disabled == "":
        return True
    if next_btn.get_attribute("disabled") is not None:
        return True
    return False


def _delay(page, fast_ms, normal_ms_range):
    """Apply delay: fixed ms in fast mode, random range otherwise."""
    if STEALTH_SPEED_UP:
        page.wait_for_timeout(fast_ms)
    else:
        page.wait_for_timeout(random.randint(*normal_ms_range))


def wait_for_network_idle(page, timeout_ms=15000):
    """Wait until the page has no pending network requests."""
    try:
        page.wait_for_load_state("networkidle", timeout=timeout_ms)
    except Exception:
        pass  # Continue even if timeout — some pages have persistent connections


def health_check_dashboard(page):
    """Verify the dashboard page is in a healthy state before scraping."""
    if has_page_error(page):
        return False
    # Check that at least one card is visible
    cards = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)")
    if cards.count() > 0:
        return True
    return False


def exponential_backoff(page, attempt, base_ms=2000, max_ms=15000):
    """Apply exponential backoff delay based on attempt number."""
    delay = min(base_ms * (2 ** attempt), max_ms)
    jitter = random.randint(0, delay // 4)
    total = delay + jitter
    print(f"  Backoff: waiting {total}ms (attempt {attempt + 1})...")
    page.wait_for_timeout(total)


def get_current_page_from_pagination(page):
    try:
        pag_el = get_active_pagination(page)
        if not pag_el or pag_el.count() == 0:
            return 1
        text = pag_el.text_content().strip()
        numbers = [int(s) for s in re.findall(r'\d+', text)]
        if len(numbers) >= 2:
            start_idx = numbers[0]
            end_idx = numbers[1]
            if start_idx == 1:
                limit = end_idx
            else:
                diff = end_idx - start_idx + 1
                if diff > 50:
                    limit = 100
                elif diff > 25:
                    limit = 50
                elif diff > 10:
                    limit = 25
                else:
                    limit = 10
            if limit <= 0:
                limit = 10
            return (start_idx - 1) // limit + 1
    except Exception as e:
        print(f"  Warning parsing pagination text: {e}")
    return 1


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
            page.wait_for_timeout(3000)

        selects_locator = page.locator("select")
        for idx in range(selects_locator.count()):
            sel = selects_locator.nth(idx)
            if sel.is_visible():
                options = sel.locator("option").all_text_contents()
                if "100" in options or any("100" in opt for opt in options):
                    sel.select_option("100")
                    page.wait_for_timeout(2000)
                    print("  Set page size to 100 via select dropdown.")
                    return

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


def navigate_to_dashboard_page(page, target_page):
    """Navigate to target page by always starting from page 1 and clicking Next sequentially."""
    print(f"  Navigating to page {target_page} (will click Next {target_page - 1} times)...")

    # Wait for cards to be visible first
    try:
        page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)").first.wait_for(state="visible", timeout=30000)
    except Exception:
        pass

    if target_page <= 1:
        print(f"  Target is page 1, no navigation needed.")
        return True

    # Always start from page 1 for reliable sequential navigation
    page_one_btn = page.locator("a, button").filter(has_text=re.compile(r"^1$")).first
    if page_one_btn.count() > 0 and page_one_btn.is_visible():
        prev_email = get_first_email(page)
        page_one_btn.click()
        wait_for_content_change(page, prev_email, timeout=30.0)
        wait_for_network_idle(page)
        _delay(page, 800, (1200, 2000))
        print(f"  Reset to page 1.")

    # Click Next (target_page - 1) times to reach target
    for step in range(1, target_page):
        pagination_container = get_active_pagination(page)
        if not pagination_container or pagination_container.count() == 0:
            print(f"  Error: Pagination container not found at step {step}.")
            return False

        next_btn = pagination_container.locator("a:has-text('Next'), button:has-text('Next')").first
        if next_btn.count() == 0 or not next_btn.is_visible():
            print(f"  Error: Next button not found at step {step}.")
            return False

        if is_next_disabled(next_btn):
            print(f"  Next button is disabled at step {step}. Reached last page (page {step}).")
            return False

        prev_email = get_first_email(page)
        print(f"  Clicking Next: step {step}/{target_page - 1} (page {step} -> {step + 1})...")
        next_btn.click()

        changed = wait_for_content_change(page, prev_email, timeout=30.0)
        if not changed:
            if has_page_error(page):
                print(f"  Error overlay at step {step}.")
                return False
            print(f"  Warning: Content didn't change at step {step}, continuing...")

        wait_for_network_idle(page)
        _delay(page, 800, (1200, 2000))

    print(f"  Successfully navigated to page {target_page}.")
    return True


def save_dashboard_progress(dashboard_csv, dashboard_headers, status_columns, new_data, completed_emails=None):
    if not new_data:
        return

    merged_data = {}
    if os.path.exists(dashboard_csv):
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

                        # Do not skip loading old records to preserve them
                        pass

                        status_counts = {}
                        for col in status_columns:
                            try:
                                col_idx = header.index(col)
                                val = int(row[col_idx])
                            except (ValueError, IndexError):
                                val = 0
                            status_counts[col] = val

                        merged_data[(category, email, sls_code)] = status_counts
        except Exception as e:
            print(f"Warning: Could not read existing dashboard CSV for merging: {e}")

    for key, val in new_data.items():
        norm_key = (key[0], key[1].lower(), key[2])
        # Merge dictionaries safely, defaulting missing columns to 0
        if norm_key in merged_data:
            for col in status_columns:
                if col in val:
                    merged_data[norm_key][col] = val[col]
        else:
            merged_data[norm_key] = val

    try:
        with open(dashboard_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(dashboard_headers)
            for key, val in merged_data.items():
                row = list(key) + [val.get(col, 0) for col in status_columns]
                writer.writerow(row)
        print(f"  Successfully updated '{dashboard_csv}' with progress.")
    except Exception as csv_err:
        print(f"  Error writing dashboard CSV: {csv_err}")


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
        if len(cols) >= 15:
            cleaned_cols = [c.strip() for c in cols]
            csv_writer.writerow([searched_email] + cleaned_cols[1:15])
            scraped_count += 1

    print(f"  Scraped {scraped_count} rows from current page.")
    return scraped_count


def navigate_to_survey(page):
    """
    Navigate to the SE2026 survey and click PENDATAAN.
    Skips the survey search if already on the survey page (URL contains SURVEY_ID).
    """
    if SURVEY_ID in page.url:
        # Already inside the survey — only need to reach the PENDATAAN period
        # Check if PENDATAAN button is visible; if so we're done
        if page.locator("text=PENDATAAN").count() > 0:
            print("  Already on survey page. Clicking PENDATAAN...")
            pendataan_btn = page.locator("text=PENDATAAN").first
            pendataan_btn.wait_for(state="visible", timeout=15000)
            pendataan_btn.click()
            page.wait_for_timeout(2000)
            return
        # Otherwise the survey period page is already loaded (URL has both IDs)
        print("  Already on survey period page. Skipping survey search.")
        return

    # Not on survey page — go to /app and search
    if not page.url.endswith("/app"):
        page.goto("https://fasih-sm.bps.go.id/app")
        page.wait_for_timeout(2000)

    print("  Searching for 'SENSUS EKONOMI 2026'...")
    search_input = page.locator('input[placeholder="Cari survei..."]')
    search_input.wait_for(state="visible", timeout=30000)
    search_input.fill("SENSUS EKONOMI 2026")
    search_input.press("Enter")
    page.wait_for_timeout(2500)

    survey_items = page.locator("text=SENSUS EKONOMI 2026")
    survey_items.first.wait_for(state="visible", timeout=30000)
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
    survey_item.click()
    page.wait_for_timeout(3000)

    print("  Navigating to PENDATAAN period...")
    pendataan_btn = page.locator("text=PENDATAAN").first
    pendataan_btn.wait_for(state="visible", timeout=30000)
    pendataan_btn.click()
    page.wait_for_timeout(3000)


def navigate_to_rekap_petugas(page, env=None):
    print("\nRefreshing session and navigating to Rekap Petugas...")
    page.reload()
    page.wait_for_timeout(4000)

    if "sso.bps.go.id" in page.url or page.locator("#username").count() > 0 or page.locator("text=Login SSO BPS").count() > 0:
        print("Session expired on refresh. Re-logging in...")
        if env is None:
            env = load_env()
        username = env.get("USERNAME")
        password = env.get("PASSWORD")

        if page.locator("text=Login SSO BPS").count() > 0:
            page.locator("text=Login SSO BPS").first.click()
            page.wait_for_timeout(3000)

        if page.locator("#username").count() > 0:
            page.locator("#username").fill(username)
            page.locator("#password").fill(password)
            page.locator("#kc-login").click()
            page.wait_for_timeout(4000)

    try:
        page.wait_for_url("**/app**", timeout=45000)
    except Exception:
        pass

    navigate_to_survey(page)

    # Wait for Rekap Petugas button to appear
    rekap_btn = page.locator("button:has-text('Rekap Petugas')")
    try:
        rekap_btn.first.wait_for(state="visible", timeout=30000)
        rekap_btn.first.click()
        print("  Clicked 'Rekap Petugas'.")
    except Exception:
        print("  Warning: Tombol 'Rekap Petugas' tidak ditemukan! Mencoba reload...")
        page.reload()
        page.wait_for_timeout(5000)
        navigate_to_survey(page)
        try:
            rekap_btn = page.locator("button:has-text('Rekap Petugas')")
            rekap_btn.first.wait_for(state="visible", timeout=30000)
            rekap_btn.first.click()
            print("  Clicked 'Rekap Petugas' (retry).")
        except Exception as e2:
            print(f"  ERROR: Tombol 'Rekap Petugas' tetap tidak ditemukan: {e2}")
            return

    # Wait for network idle + sub-menu buttons to appear
    wait_for_network_idle(page)
    page.wait_for_timeout(1500)

    # Verify that Pengawas/Pencacah buttons are visible
    try:
        page.locator("button:has-text('Pengawas'), button:has-text('Pencacah')").first.wait_for(
            state="visible", timeout=15000
        )
        print("  Sub-menu Pengawas/Pencacah ready.")
    except Exception:
        print("  Warning: Sub-menu buttons belum muncul, tapi melanjutkan...")


def recover_to_category_page(page, context, auth_file, category, target_page, env, attempt=0):
    """
    Recover from error overlay: reload, re-login if needed, navigate back to
    the correct category and page number. Uses exponential backoff on retries.
    """
    print(f"\n  !! ERROR DETECTED — Recovering to {category} page {target_page}...")

    # Exponential backoff before recovery attempt
    if attempt > 0:
        exponential_backoff(page, attempt)

    navigate_to_rekap_petugas(page, env)
    wait_for_network_idle(page)

    try:
        context.storage_state(path=auth_file)
    except Exception:
        pass

    before = get_first_email(page)

    # Wait for category button to appear before clicking
    cat_btn = page.locator(f"button:has-text('{category}')")
    try:
        cat_btn.first.wait_for(state="visible", timeout=30000)
        cat_btn.first.click()
    except Exception as e:
        print(f"  Recovery: Category button '{category}' not found ({e}). Retrying navigation...")
        try:
            navigate_to_rekap_petugas(page, env)
            wait_for_network_idle(page)
            cat_btn = page.locator(f"button:has-text('{category}')")
            cat_btn.first.wait_for(state="visible", timeout=30000)
            cat_btn.first.click()
        except Exception as e2:
            print(f"  Recovery: Second attempt also failed: {e2}")
            return False

    if before:
        wait_for_content_change(page, before, timeout=30.0)
    else:
        try:
            page.locator(
                "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
            ).first.wait_for(state="visible", timeout=30000)
        except Exception:
            pass
    wait_for_network_idle(page)
    page.wait_for_timeout(800)

    if target_page > 1:
        ok = navigate_to_dashboard_page(page, target_page)
        if not ok:
            print(f"  Recovery: could not reach page {target_page}.")
            return False

    # Final health check
    if not health_check_dashboard(page):
        print(f"  Recovery health check failed.")
        return False

    print(f"  Recovery complete — on {category} page {target_page}.")
    return True


def normalize_status_name(status_raw: str) -> str:
    status_raw = status_raw.strip().upper()
    predefined = {
        "OPEN": "OPEN",
        "APPROVED BY PENGAWAS": "APPROVED BY Pengawas",
        "SUBMITTED BY PENCACAH": "SUBMITTED BY Pencacah",
        "DRAFT": "DRAFT",
        "REJECTED BY PENGAWAS": "REJECTED BY Pengawas",
        "REJECTED BY ADMIN KABUPATEN": "REJECTED BY Admin Kabupaten",
        "REVOKED BY PENGAWAS": "REVOKED BY Pengawas",
        "SUBMITTED RESPONDENT": "SUBMITTED RESPONDENT",
        "COMPLETED BY ADMIN KABUPATEN": "COMPLETED BY Admin Kabupaten",
        "EDITED BY ADMIN KABUPATEN": "EDITED BY Admin Kabupaten",
    }
    if status_raw in predefined:
        return predefined[status_raw]
    
    words = status_raw.split()
    formatted_words = []
    for w in words:
        if w in ["BY", "OF", "IN", "FOR", "AND", "OR", "TO"]:
            formatted_words.append(w.lower())
        elif w in ["PPL", "PML", "SLS", "SBR", "BPS"]:
            formatted_words.append(w)
        else:
            formatted_words.append(w.capitalize())
            
    if formatted_words:
        formatted_words[0] = formatted_words[0].capitalize()
        
    return " ".join(formatted_words)


def parse_card_target(card_text: str):
    if not card_text:
        return None
    # Remove email to avoid matching digits inside email
    text_no_email = re.sub(r'\S+@\S+', '', card_text)
    
    # 1. Check for progress slash / dari / of (e.g. 10/255 or 10 dari 255)
    progress_match = re.search(r'(?:/|dari|of)\s*(\d+)', text_no_email, re.IGNORECASE)
    if progress_match:
        try:
            return int(progress_match.group(1))
        except ValueError:
            pass
            
    # 2. Check for labeled numbers (e.g. Beban: 255, Target: 255, Total: 255)
    label_match = re.search(r'(?:beban|target|total|assignment|alokasi)\s*[:\-]?\s*(\d+)', text_no_email, re.IGNORECASE)
    if label_match:
        try:
            return int(label_match.group(1))
        except ValueError:
            pass
            
    # 3. Fallback: find all standalone numbers in the clean text and take the last/largest one
    numbers = re.findall(r'\b\d+\b', text_no_email)
    if numbers:
        filtered_numbers = [int(n) for n in numbers if int(n) != 2026]
        if filtered_numbers:
            return filtered_numbers[-1]
        return int(numbers[-1])
        
    return None


def run_unified_scraper():
    use_test = "--test" in sys.argv
    email_file = os.path.join("data", "email_mitra_test.txt" if use_test else "email_mitra.txt")
    auth_file = "auth_state.json"
    dashboard_csv = "dashboard_scraped_data.csv"
    output_csv = "scraped_data.csv"
    checkpoint_file = "checkpoint.json"

    env = load_env()
    username = env.get("USERNAME")
    password = env.get("PASSWORD")

    if not username or not password:
        print("Error: USERNAME or PASSWORD not set in .env file.")
        sys.exit(1)

    run_mode = "full"
    if "--dashboard" in sys.argv:
        run_mode = "dashboard"
        print("Run mode: DASHBOARD ONLY")
    elif "--data" in sys.argv or "--scrape" in sys.argv or "--ambil-data" in sys.argv:
        run_mode = "data"
        print("Run mode: AMBIL DATA ONLY")
    elif "--full" in sys.argv:
        run_mode = "full"
        print("Run mode: FULL (Dashboard + Ambil Data)")
    else:
        print("\nPilih mode eksekusi:")
        print("  1. Run Full (Dashboard & Ambil Data - default)")
        print("  2. Run Dashboard Saja")
        print("  3. Run Ambil Data Saja")
        try:
            choice = input("Masukkan pilihan (1/2/3) [1]: ").strip()
            if choice == "2":
                run_mode = "dashboard"
                print("Run mode: DASHBOARD ONLY")
            elif choice == "3":
                run_mode = "data"
                print("Run mode: AMBIL DATA ONLY")
            else:
                run_mode = "full"
                print("Run mode: FULL (Dashboard + Ambil Data)")
        except (KeyboardInterrupt, SystemExit):
            print("\nExiting script.")
            sys.exit(0)
        except Exception:
            print("Invalid input, defaulting to: FULL (Dashboard + Ambil Data).")
            run_mode = "full"

    emails = []
    reverse_order = False

    if run_mode in ["full", "data"]:
        emails = load_emails(email_file)

        if "--bottom" in sys.argv or "--reverse" in sys.argv:
            reverse_order = True
            print("Scraping order: BOTTOM TO TOP (Reversed).")
        elif "--top" in sys.argv:
            reverse_order = False
            print("Scraping order: TOP TO BOTTOM (Normal).")
        else:
            print("\nPilih urutan scraping detail email:")
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

        if reverse_order:
            emails.reverse()

        use_fresh = "--fresh" in sys.argv
        completed_emails = []
        failed_emails = []
        if not use_fresh and os.path.exists(checkpoint_file):
            try:
                with open(checkpoint_file, "r") as f:
                    cp = json.load(f)
                    completed_emails = cp.get("completed_emails", [])
                    failed_emails = cp.get("failed_emails", [])

                    if not completed_emails and "last_email" in cp:
                        last_email = cp.get("last_email")
                        if last_email and last_email in emails:
                            last_idx = emails.index(last_email)
                            completed_emails = emails[:last_idx + 1]
                            print(f"Imported legacy checkpoint: starting after '{last_email}'")

                    if completed_emails:
                        print(f"Loaded checkpoint: {len(completed_emails)} completed, {len(failed_emails)} previously failed.")
            except Exception as e:
                print(f"Warning reading checkpoint: {e}. Starting fresh.")

    # Status mapping table
    status_mapping = {
        "OPEN": "OPEN",
        "APPROVED BY PENGAWAS": "APPROVED BY Pengawas",
        "SUBMITTED BY PENCACAH": "SUBMITTED BY Pencacah",
        "DRAFT": "DRAFT",
        "REJECTED BY PENGAWAS": "REJECTED BY Pengawas",
        "REJECTED BY ADMIN KABUPATEN": "REJECTED BY Admin Kabupaten",
        "REVOKED BY PENGAWAS": "REVOKED BY Pengawas",
        "SUBMITTED RESPONDENT": "SUBMITTED RESPONDENT",
        "COMPLETED BY ADMIN KABUPATEN": "COMPLETED BY Admin Kabupaten",
        "EDITED BY ADMIN KABUPATEN": "EDITED BY Admin Kabupaten",
    }

    status_columns = list(status_mapping.values())
    dashboard_headers = ["Category", "Email", "SLS Code"] + status_columns
    scraped_data_dict = {}

    with sync_playwright() as p:
        print("Launching Chromium browser in headed mode...")
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-ipc-flooding-protection",
            ],
        )

        if os.path.exists(auth_file):
            print(f"Loading session from '{auth_file}'...")
            context = browser.new_context(storage_state=auth_file)
        else:
            print("No saved session state found. Creating new context.")
            context = browser.new_context()

        page = context.new_page()

        # 2. Automated Login via SSO
        max_attempts = 5
        for attempt in range(1, max_attempts + 1):
            try:
                print(f"Navigating to BPS FASIH website (Attempt {attempt}/{max_attempts})...")
                page.goto("https://fasih-sm.bps.go.id/", timeout=120000)
                break
            except Exception as e:
                print(f"Error navigating: {e}")
                if attempt == max_attempts:
                    raise
                wait_sec = attempt * 10
                print(f"Waiting {wait_sec}s before retrying...")
                page.wait_for_timeout(wait_sec * 1000)
        page.wait_for_timeout(3000)

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
                kc_login_btn = page.locator("#kc-login")
                if kc_login_btn.count() > 0:
                    kc_login_btn.click()
                else:
                    print("Warning: Tombol '#kc-login' tidak ditemukan! Mencoba submit via Enter...")
                    page.locator("#password").press("Enter")

                print("Waiting for login response...")
                is_otp_page = False
                for _ in range(15):
                    page.wait_for_timeout(1000)
                    if "/app" in page.url:
                        break
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
                    print("\n" + "=" * 80)
                    print("OTP / VERIFIKASI LOGIN TERDETEKSI!")
                    print("Silakan masukkan kode OTP / Verifikasi secara manual pada browser Chromium yang terbuka.")
                    print("Script akan otomatis melanjutkan setelah Anda berhasil masuk ke Dashboard FASIH.")
                    print("=" * 80 + "\n")

                    start_wait = time.time()
                    last_print = 0
                    MAX_OTP_WAIT = 600  # 10 menit
                    while True:
                        if time.time() - start_wait > MAX_OTP_WAIT:
                            print("\nOTP timeout (10 menit)! Silakan jalankan ulang script.")
                            sys.exit(1)
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

        try:
            page.wait_for_url("**/app**", timeout=45000)
            print("Successfully reached the app workspace!")
        except Exception:
            print("Warning: Redirection timeout. Checking current URL: " + page.url)

        context.storage_state(path=auth_file)
        print(f"Session state saved to '{auth_file}'")

        # 3. Navigate to survey PENDATAAN
        print("Navigating to SE2026 survey PENDATAAN...")
        navigate_to_survey(page)

        # ---------------------------------------------------------------
        if run_mode in ["full", "dashboard"]:
            # Phase 1: Download Ringkasan CSVs
            print("\n--- Phase 1: Downloading Ringkasan CSVs ---")
            page.locator("button:has-text('Ringkasan')").first.click()
            page.wait_for_timeout(1500)

            csv_buttons = page.locator("button:has(svg.tabler-icon-csv)")
            csv_count = csv_buttons.count()
            print(f"Found {csv_count} CSV buttons under Ringkasan tab.")

            for i in range(csv_count):
                label = "Assign" if i == 0 else "Progres"
                save_path = os.path.join("data", f"ringkasan_{label}.csv")
                print(f"  Downloading CSV #{i+1} ({label}) -> {save_path}...")
                try:
                    with page.expect_download(timeout=15000) as download_info:
                        csv_buttons.nth(i).click()
                    download_info.value.save_as(save_path)
                    print(f"  Saved to {save_path}")
                except Exception as e:
                    print(f"  Failed to download CSV #{i+1}: {e}")

            # Phase 2: Scrape Rekap Petugas (Pengawas & Pencacah)
            print("\n--- Phase 2: Scraping Rekap Petugas ---")
            page.locator("button:has-text('Rekap Petugas')").click()
            _delay(page, 1500, (2500, 4000))

            checkpoint_dashboard_file = "checkpoint_dashboard.json"
            resume_category = None
            resume_page = 1
            completed_dashboard_emails = set()

            use_fresh = "--fresh" in sys.argv
            if not use_fresh and os.path.exists(checkpoint_dashboard_file):
                try:
                    with open(checkpoint_dashboard_file, "r") as f:
                        cp = json.load(f)
                        resume_category = cp.get("category")
                        resume_page = cp.get("page_num", 1)
                        completed_list = cp.get("completed_emails", [])
                        completed_dashboard_emails = {tuple(x) for x in completed_list}
                        print(f"Resuming from checkpoint: Category '{resume_category}', Page {resume_page}")
                        print(f"Loaded {len(completed_dashboard_emails)} completed dashboard emails from checkpoint.")
                except Exception as e:
                    print(f"Warning reading dashboard checkpoint: {e}. Starting fresh.")

            for category in ["Pengawas", "Pencacah"]:
                if resume_category is not None:
                    if category != resume_category:
                        print(f"Skipping Category: {category} (resuming further ahead)")
                        continue
                    resume_category = None
                    start_page = resume_page
                else:
                    start_page = 1

                print(f"\nScraping Category: {category}")

                before_email = get_first_email(page)
                page.locator(f"button:has-text('{category}')").click()

                # Wait for tab content to change
                if before_email:
                    changed = wait_for_content_change(page, before_email, timeout=30.0)
                    if not changed:
                        if has_page_error(page):
                            ok = recover_to_category_page(page, context, auth_file, category, 1, env)
                            if not ok:
                                print(f"  Recovery failed for {category}. Skipping.")
                                continue
                        else:
                            try:
                                page.locator(
                                    "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
                                ).first.wait_for(state="visible", timeout=30000)
                            except Exception:
                                print("  Warning: Timeout waiting for initial cards.")
                else:
                    try:
                        page.locator(
                            "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
                        ).first.wait_for(state="visible", timeout=60000)
                    except Exception:
                        print("  Warning: Timeout waiting for initial cards.")

                _delay(page, 1000, (1500, 2500))

                if start_page > 1:
                    print(f"  Resuming at page {start_page}. Navigating...")
                    nav_ok = navigate_to_dashboard_page(page, start_page)
                    if not nav_ok:
                        print(f"  Failed to navigate to page {start_page}. Starting from current page.")
                    page_num = start_page
                else:
                    page_one_btn = page.locator("a, button").filter(has_text=re.compile(r"^1$")).first
                    if page_one_btn.count() > 0 and page_one_btn.is_visible():
                        print("  Resetting to page 1...")
                        page_one_btn.click()
                        _delay(page, 1000, (1500, 2500))
                    page_num = 1

                page_retry_count = 0
                MAX_PAGE_RETRIES = 5

                while True:
                    # Save checkpoint
                    try:
                        with open(checkpoint_dashboard_file, "w") as f:
                            json.dump({
                                "category": category,
                                "page_num": page_num,
                                "completed_emails": list(completed_dashboard_emails)
                            }, f)
                    except Exception as e:
                        print(f"Warning saving checkpoint: {e}")

                    # Wait for network idle before checking cards
                    wait_for_network_idle(page)

                    # Ensure cards are visible
                    try:
                        page.locator(
                            "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
                        ).first.wait_for(state="visible", timeout=30000)
                    except Exception:
                        if has_page_error(page):
                            page_retry_count += 1
                            if page_retry_count > MAX_PAGE_RETRIES:
                                print(f"  Recovery failed after {MAX_PAGE_RETRIES} retries. Stopping category.")
                                break
                            ok = recover_to_category_page(page, context, auth_file, category, page_num, env, attempt=page_retry_count)
                            if not ok:
                                print("  Recovery failed. Stopping this category.")
                                break
                            continue
                        print("  No cards visible. Breaking pagination.")
                        break

                    # Health check before scraping
                    if not health_check_dashboard(page):
                        page_retry_count += 1
                        if page_retry_count > MAX_PAGE_RETRIES:
                            print(f"  Health check failed after {MAX_PAGE_RETRIES} retries. Stopping category.")
                            break
                        print(f"  Health check failed. Retrying page {page_num} ({page_retry_count}/{MAX_PAGE_RETRIES})...")
                        ok = recover_to_category_page(page, context, auth_file, category, page_num, env, attempt=page_retry_count)
                        if not ok:
                            break
                        continue

                    cards_locator = page.locator(
                        "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
                    )
                    card_count = cards_locator.count()
                    print(f"  [Page {page_num}] Found {card_count} cards.")

                    prev_email = get_first_email(page)
                    prev_pag_el = get_active_pagination(page)
                    prev_pag_text = (
                        prev_pag_el.text_content().strip()
                        if prev_pag_el and prev_pag_el.count() > 0
                        else ""
                    )

                    page_error = False
                    for i in range(card_count):
                        card = cards_locator.nth(i)
                        try:
                            email = card.locator(
                                "div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm"
                            ).text_content().strip()
                        except Exception:
                            continue
                        print(f"    [{i+1}/{card_count}] {email}")
                        
                        officer_keys = []

                        controls_id = card.get_attribute("aria-controls")
                        if controls_id:
                            content_panel = page.locator(f"#{controls_id}")
                        else:
                            print("      No aria-controls attribute. Using sibling fallback.")
                            content_panel = card.locator("xpath=../following-sibling::div | following-sibling::div").first

                        if card.get_attribute("data-state") != "open":
                            card.click()
                            wait_for_network_idle(page)

                        # Check for error overlay after expanding
                        _delay(page, 600, (1000, 1800))
                        if has_page_error(page):
                            print("      Error overlay after card expand. Recovering...")
                            ok = recover_to_category_page(page, context, auth_file, category, page_num, env, attempt=page_retry_count)
                            if not ok:
                                page_error = True
                            break

                        # Wait for SLS rows
                        try:
                            content_panel.locator(
                                "div.f\\:group.f\\:flex.f\\:flex-col.f\\:gap-3"
                            ).first.wait_for(state="visible", timeout=20000)
                        except Exception:
                            if has_page_error(page):
                                print("      Error overlay while loading SLS rows. Recovering...")
                                ok = recover_to_category_page(page, context, auth_file, category, page_num, env, attempt=page_retry_count)
                                if not ok:
                                    page_error = True
                                break
                            print("      Timeout waiting for SLS rows.")
                            continue

                        # Wait for network idle after SLS rows are loaded
                        wait_for_network_idle(page)

                        sls_rows = content_panel.locator(
                            "div.f\\:group.f\\:flex.f\\:flex-col.f\\:gap-3"
                        )
                        rows_count = sls_rows.count()
                        print(f"      Found {rows_count} SLS rows.")

                        for j in range(rows_count):
                            row = sls_rows.nth(j)
                            sls_code = row.locator(
                                "div.f\\:font-semibold.f\\:text-foreground.f\\:text-sm"
                            ).text_content().strip()
                            tags = row.locator(
                                "div.f\\:flex.f\\:flex-wrap.f\\:items-center.f\\:gap-2 > div"
                            )
                            tags_count = tags.count()

                            key = (category, email, sls_code)
                            officer_keys.append(key)
                            if key not in scraped_data_dict:
                                scraped_data_dict[key] = {col: 0 for col in status_columns}

                            for k in range(tags_count):
                                tag = tags.nth(k)
                                spans = tag.locator("span")
                                if spans.count() >= 2:
                                    status_raw = spans.nth(0).text_content().strip()
                                    status_name = status_raw.upper()
                                    count_str = spans.nth(1).text_content().strip()
                                    
                                    # Dynamic status check & registration
                                    if status_name not in status_mapping:
                                        norm_name = normalize_status_name(status_raw)
                                        status_mapping[status_name] = norm_name
                                        if norm_name not in status_columns:
                                            status_columns.append(norm_name)
                                            dashboard_headers = ["Category", "Email", "SLS Code"] + status_columns
                                            print(f"  [DYNAMIC STATUS] Registered new status: '{norm_name}'")
                                            
                                    try:
                                        scraped_data_dict[key][status_mapping[status_name]] = int(count_str)
                                    except ValueError:
                                        pass

                        # Parse the true target from the card text and adjust to match it if there is a gap
                        try:
                            card_text = card.text_content()
                            true_target = parse_card_target(card_text)
                            if true_target is not None and officer_keys:
                                scraped_sum = 0
                                for k in officer_keys:
                                    scraped_sum += sum(scraped_data_dict[k].values())
                                print(f"      Parsed Target: {true_target} | Scraped Sum: {scraped_sum}")
                                if true_target > scraped_sum:
                                    diff = true_target - scraped_sum
                                    first_key = officer_keys[0]
                                    scraped_data_dict[first_key]["OPEN"] = scraped_data_dict[first_key].get("OPEN", 0) + diff
                                    print(f"      Adjusted target gap: added {diff} to OPEN count of SLS {first_key[2]}")
                        except Exception as e:
                            print(f"      Warning adjusting target gap: {e}")

                        # Mark email as successfully completed in dashboard scraping
                        completed_dashboard_emails.add((category, email.lower()))

                        # Tutup card setelah data diambil
                        if card.get_attribute("data-state") == "open":
                            card.click()
                            try:
                                content_panel.wait_for(state="hidden", timeout=5000)
                            except Exception:
                                pass
                        _delay(page, 600, (1000, 1800))

                    if page_error:
                        page_retry_count += 1
                        if page_retry_count > MAX_PAGE_RETRIES:
                            print(f"  Page {page_num} failed after {MAX_PAGE_RETRIES} retries. Stopping category.")
                            break
                        print(f"  Page {page_num} had errors. Retrying ({page_retry_count}/{MAX_PAGE_RETRIES})...")
                        exponential_backoff(page, page_retry_count)
                        ok = recover_to_category_page(page, context, auth_file, category, page_num, env, attempt=page_retry_count)
                        if not ok:
                            print("  Recovery failed. Stopping this category.")
                            break
                        continue

                    # Page scraped successfully — reset retry counter
                    page_retry_count = 0

                    # Save progress after finishing this page
                    print(f"  [Page {page_num}] Saving progress to CSV...")
                    save_dashboard_progress(dashboard_csv, dashboard_headers, status_columns, scraped_data_dict, completed_dashboard_emails)

                    # Pagination
                    pagination_container = get_active_pagination(page)
                    next_btn = None
                    if pagination_container:
                        next_btn = pagination_container.locator(
                            "a:has-text('Next'), button:has-text('Next')"
                        ).first

                    if (
                        next_btn
                        and next_btn.count() > 0
                        and next_btn.is_visible()
                        and not is_next_disabled(next_btn)
                        and prev_email
                    ):
                        MAX_PAGINATION_RETRIES = 8
                        clicked_ok = False
                        for attempt in range(MAX_PAGINATION_RETRIES):
                            if attempt > 0:
                                # Exponential backoff: 3s, 6s, 12s, 20s, 20s, ...
                                backoff_ms = min(3000 * (2 ** (attempt - 1)), 20000)
                                jitter_ms = random.randint(0, backoff_ms // 4)
                                wait_ms = backoff_ms + jitter_ms
                                print(f"  Retrying next page click (attempt {attempt+1}/{MAX_PAGINATION_RETRIES}, waiting {wait_ms}ms)...")
                                page.wait_for_timeout(wait_ms)

                            try:
                                pagination_container = get_active_pagination(page)
                                if pagination_container:
                                    btn = pagination_container.locator(
                                        "a:has-text('Next'), button:has-text('Next')"
                                    ).first
                                    if btn.count() > 0 and btn.is_visible() and not is_next_disabled(btn):
                                        btn.click(timeout=30000)
                                    else:
                                        print("  Next button gone or disabled.")
                                        break
                                else:
                                    print("  Pagination container not found.")
                                    break
                            except Exception as e:
                                print(f"  Click Next failed: {e}")
                                continue

                            # Wait for network idle after clicking Next
                            wait_for_network_idle(page, timeout_ms=30000)

                            changed = wait_for_content_change(page, prev_email, prev_pag_text, timeout=60.0)
                            if changed:
                                clicked_ok = True
                                break
                            if has_page_error(page):
                                print("  Error overlay after pagination. Recovering...")
                                ok = recover_to_category_page(page, context, auth_file, category, page_num + 1, env, attempt=page_retry_count)
                                if ok:
                                    page_num += 1
                                    clicked_ok = True
                                break

                            # If content didn't change and no error, try reloading the page on later attempts
                            if attempt >= 3:
                                print(f"  Content still unchanged after {attempt+1} attempts. Reloading page and recovering...")
                                try:
                                    ok = recover_to_category_page(page, context, auth_file, category, page_num + 1, env, attempt=attempt)
                                    if ok:
                                        page_num += 1
                                        clicked_ok = True
                                        break
                                except Exception as recover_err:
                                    print(f"  Recovery during pagination retry failed: {recover_err}")

                        if not clicked_ok:
                            print(f"  Warning: Pagination transition failed after {MAX_PAGINATION_RETRIES} attempts. Breaking loop.")
                            break

                        page_num += 1
                        _delay(page, 1200, (2000, 3500))
                    else:
                        print("  Reached last page of category.")
                        break

            # Remove checkpoint on successful completion
            if os.path.exists(checkpoint_dashboard_file):
                try:
                    os.remove(checkpoint_dashboard_file)
                    print("All dashboard scraping completed. Checkpoint removed.")
                except Exception as e:
                    print(f"Warning removing checkpoint: {e}")

            # Export final dashboard CSV
            print(f"\nWriting dashboard data to '{dashboard_csv}'...")
            try:
                merged_data = {}
                if os.path.exists(dashboard_csv):
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

                                    # Do not skip loading old records to preserve them
                                    pass

                                    status_counts = {}
                                    for col in status_columns:
                                        try:
                                            col_idx = header.index(col)
                                            val = int(row[col_idx])
                                        except (ValueError, IndexError):
                                            val = 0
                                        status_counts[col] = val

                                    merged_data[(category, email, sls_code)] = status_counts
                        print(f"Loaded {len(merged_data)} existing SLS records (after filtering).")
                    except Exception as e:
                        print(f"Warning: Could not read existing dashboard CSV: {e}")

                new_count = updated_count = 0
                for key, val in scraped_data_dict.items():
                    norm_key = (key[0], key[1].lower(), key[2])
                    if norm_key in merged_data:
                        updated_count += 1
                    else:
                        new_count += 1
                    merged_data[norm_key] = val

                print(f"Merging: {updated_count} updated, {new_count} new.")

                with open(dashboard_csv, "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(dashboard_headers)
                    for key, val in merged_data.items():
                        row = list(key) + [val.get(col, 0) for col in status_columns]
                        writer.writerow(row)
                print(f"Written {len(merged_data)} SLS rows to '{dashboard_csv}'.")
            except Exception as csv_err:
                print(f"Error writing dashboard CSV: {csv_err}")

            # Intermediate processing and Git push
            print("\nProcessing intermediate dashboard data...")
            try:
                process_data.process_dashboard_scraped_data()

                public_dir = os.path.join("dashboard", "public")
                if os.path.exists(public_dir):
                    shutil.copy2(dashboard_csv, os.path.join(public_dir, "dashboard_scraped_data.csv"))
                    process_data.save_snapshots_if_needed(public_dir)

                    for src_name, dst_name in [
                        (os.path.join("data", "pml_ppl.csv"), "pml_ppl.csv"),
                        (os.path.join("data", "koseka.csv"), "koseka.csv"),
                        (os.path.join("data", "ringkasan_Assign.csv"), "ringkasan_Assign.csv"),
                        (os.path.join("data", "ringkasan_Progres.csv"), "ringkasan_Progres.csv"),
                    ]:
                        if os.path.exists(src_name):
                            shutil.copy2(src_name, os.path.join(public_dir, dst_name))

                    timestamp = process_data.get_wita_timestamp()
                    with open(os.path.join(public_dir, "last_updated.txt"), "w", encoding="utf-8") as tf:
                        tf.write(timestamp)

                    print("Staging and pushing dashboard changes to GitHub...")
                    process_data.run_git_commands(timestamp)
            except Exception as proc_err:
                print(f"Warning during intermediate processing: {proc_err}")

        # ---------------------------------------------------------------
        if run_mode in ["full", "data"]:
            # Phase 3: Detail Data Tab
            print("\n--- Phase 3: Transitioning to Detail Data Tab ---")

            data_menu = None
            for selector in ["a[href$='/data']", "a[href*='/data']", "a:has-text('Data')"]:
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
                data_url = base_url.rstrip("/") + "/data"
                print(f"  Direct navigation to: {data_url}")
                page.goto(data_url)
                page.wait_for_timeout(3000)

            ensure_100_rows_per_page(page)

            print("Waiting for detail data table to load...")
            try:
                page.wait_for_selector("table", timeout=45000)
                print("Table loaded successfully. Starting detail scraper...")
            except Exception:
                print("Error: Table not found on data page. Aborting.")
                browser.close()
                return

            detail_headers = [
                "Searched Email", "Kode Identitas", "Nama Keluarga/Bangunan/Usaha", "Alamat Prelist",
                "Nomor Urut Bangunan / IDSBR", "NIB", "Email", "Skala Usaha / Jenis Prelist",
                "Jumlah Usaha", "Kode Pos", "Perubahan SLS",
                "Status", "Mode", "Petugas Saat Ini", "Keterangan",
            ]

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
                            "reverse_order": reverse_order,
                        }, f)
                except Exception as e:
                    print(f"Warning saving checkpoint: {e}")

        if run_mode in ["full", "data"]:
            if 'csv_file' in locals() and not csv_file.closed:
                csv_file.close()
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

        if run_mode in ["full", "data"]:
            print("\nRunning final data processing pipeline...")
            try:
                process_data.process_data(completed_emails=completed_emails)
            except Exception as proc_err:
                print(f"Warning: Error during final data processing: {proc_err}")

        print("\n" + "=" * 50)
        print("UNIFIED SCRAPING AND PROCESSING PIPELINE COMPLETED")
        print("=" * 50)


if __name__ == "__main__":
    run_unified_scraper()
