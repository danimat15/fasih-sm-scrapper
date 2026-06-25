import os
import csv
import time
import re
from patchright.sync_api import sync_playwright
import random


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
        page.wait_for_timeout(200)
        if has_page_error(page):
            return False
        cur_email = get_first_email(page)
        if cur_email and cur_email != old_email:
            return True
        if old_pag:
            cur_pag_el = get_active_pagination(page)
            cur_pag = cur_pag_el.text_content().strip() if cur_pag_el and cur_pag_el.count() > 0 else ""
            if cur_pag and cur_pag != old_pag:
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


def wait_for_dashboard(page, target_url, context, auth_file):
    """Wait until the dashboard tabs are visible. Handles login redirect."""
    start = time.time()
    while time.time() - start < 30.0:
        url = page.url
        if "sso" in url or "login" in url or "cas" in url:
            print(f"\n  Session expired / redirected. Please log in.")
            print(f"  Then navigate to: {target_url}")
            try:
                page.wait_for_url(target_url, timeout=0)
                context.storage_state(path=auth_file)
                print("  Re-authenticated and session saved.")
            except KeyboardInterrupt:
                return False
        if page.locator("button:has-text('Ringkasan')").count() > 0:
            return True
        page.wait_for_timeout(500)
    return False


def recover_and_navigate(page, context, auth_file, target_url, category, target_page):
    """
    Reload page after an error, re-navigate to Rekap Petugas > category > target_page.
    Returns True on success, False if recovery fails.
    """
    print(f"\n  !! ERROR DETECTED — Recovering to {category} page {target_page}...")
    try:
        page.reload(timeout=30000, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
    except Exception as e:
        print(f"  Reload failed: {e}")
        return False

    if not wait_for_dashboard(page, target_url, context, auth_file):
        print("  Could not reach dashboard after recovery.")
        return False

    # Navigate to Rekap Petugas
    page.locator("button:has-text('Rekap Petugas')").click()
    page.wait_for_timeout(600)

    # Switch to the correct category
    before = get_first_email(page)
    page.locator(f"button:has-text('{category}')").click()
    if before:
        wait_for_content_change(page, before, timeout=20.0)
    else:
        try:
            page.locator(
                "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
            ).first.wait_for(state="visible", timeout=30000)
        except Exception:
            pass
    page.wait_for_timeout(300)

    # Navigate forward to target_page by clicking Next
    for pg in range(1, target_page):
        pagination_container = get_active_pagination(page)
        if not pagination_container:
            print(f"  Recovery: reached page {pg}, pagination gone.")
            return pg == target_page
        btn = pagination_container.locator("a:has-text('Next'), button:has-text('Next')").first
        if btn.count() == 0 or is_next_disabled(btn):
            print(f"  Recovery: reached page {pg}, no more pages.")
            return pg == target_page
        cur_email = get_first_email(page)
        try:
            btn.click(timeout=15000)
        except Exception:
            return False
        wait_for_content_change(page, cur_email, timeout=20.0)
        page.wait_for_timeout(random.randint(600, 1000))

    print(f"  Recovery complete — on {category} page {target_page}.")
    return True


def main():
    auth_file = "auth_state.json"
    target_url = "https://fasih-sm.bps.go.id/app/surveys/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24"
    output_csv = "dashboard_scraped_data.csv"

    status_columns = [
        "OPEN",
        "DRAFT",
        "SUBMITTED BY Pencacah",
        "REJECTED BY Pengawas",
        "APPROVED BY Pengawas",
        "REVOKED BY Pengawas",
    ]

    headers = ["Category", "Email", "SLS Code"] + status_columns
    scraped_data_dict = {}

    print("=" * 70)
    print("FASIH DASHBOARD SCRAPER")
    print("=" * 70)

    with sync_playwright() as p:
        print("Launching Chromium browser in headed mode...")
        browser = p.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )

        if os.path.exists(auth_file):
            print(f"Loading session from '{auth_file}'...")
            context = browser.new_context(storage_state=auth_file)
        else:
            print("No saved session found. Creating new context.")
            context = browser.new_context()

        page = context.new_page()

        print(f"Navigating to dashboard: {target_url}")
        page.goto(target_url)

        print("Waiting for page load and checking authentication...")
        start_time = time.time()
        authenticated = False
        while time.time() - start_time < 30.0:
            current_url = page.url
            if (
                "sso" in current_url
                or "login" in current_url
                or "cas" in current_url
                or current_url.split("?")[0] != target_url.split("?")[0]
            ):
                print("\n" + "=" * 80)
                print(f"REDIRECT DETECTED. Current URL: {current_url}")
                print(f"Please log in and navigate to: {target_url}")
                print("The scraper will proceed once you reach the target page.")
                print("=" * 80 + "\n")
                try:
                    page.wait_for_url(target_url, timeout=0)
                    print("Successfully reached the target page!")
                    context.storage_state(path=auth_file)
                    print(f"Session saved to '{auth_file}'")
                    authenticated = True
                    break
                except KeyboardInterrupt:
                    print("Scraper aborted.")
                    browser.close()
                    return

            if page.locator("button:has-text('Ringkasan')").count() > 0:
                print("Dashboard loaded successfully.")
                authenticated = True
                break

            page.wait_for_timeout(500)

        if not authenticated:
            print("Error: Could not load dashboard. Aborting.")
            browser.close()
            return

        # ---------------------------------------------------------------
        # Phase 1: Download Ringkasan CSVs
        # ---------------------------------------------------------------
        print("\n--- Phase 1: Downloading Ringkasan CSVs ---")
        page.locator("button:has-text('Ringkasan')").first.click()
        page.wait_for_timeout(1500)

        csv_buttons = page.locator("button:has(svg.tabler-icon-csv)")
        csv_count = csv_buttons.count()
        print(f"Found {csv_count} CSV buttons.")

        for i in range(csv_count):
            label = "Assign" if i == 0 else "Progres"
            save_path = os.path.join("data", f"ringkasan_{label}.csv")
            print(f"  Downloading CSV #{i+1} ({label}) -> {save_path}...")
            try:
                with page.expect_download(timeout=15000) as dl:
                    csv_buttons.nth(i).click()
                dl.value.save_as(save_path)
                print(f"  Saved to {save_path}")
            except Exception as e:
                print(f"  Failed to download CSV #{i+1}: {e}")

        # ---------------------------------------------------------------
        # Phase 2: Scrape Rekap Petugas (Pengawas & Pencacah)
        # ---------------------------------------------------------------
        print("\n--- Phase 2: Scraping Rekap Petugas ---")
        page.locator("button:has-text('Rekap Petugas')").click()
        page.wait_for_timeout(random.randint(1200, 2000))

        status_mapping = {
            "OPEN": "OPEN",
            "DRAFT": "DRAFT",
            "SUBMITTED BY PENCACAH": "SUBMITTED BY Pencacah",
            "REJECTED BY PENGAWAS": "REJECTED BY Pengawas",
            "APPROVED BY PENGAWAS": "APPROVED BY Pengawas",
            "REVOKED BY PENGAWAS": "REVOKED BY Pengawas",
        }

        for category in ["Pengawas", "Pencacah"]:
            print(f"\nScraping Category: {category}")

            before_email = get_first_email(page)
            page.locator(f"button:has-text('{category}')").click()

            # Wait for tab content to load
            if before_email:
                changed = wait_for_content_change(page, before_email, timeout=20.0)
                if not changed:
                    if has_page_error(page):
                        ok = recover_and_navigate(page, context, auth_file, target_url, category, 1)
                        if not ok:
                            print(f"  Recovery failed for {category}. Skipping.")
                            continue
                    else:
                        print("  Warning: Tab transition timeout.")
            else:
                try:
                    page.locator(
                        "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
                    ).first.wait_for(state="visible", timeout=30000)
                except Exception:
                    if has_page_error(page):
                        ok = recover_and_navigate(page, context, auth_file, target_url, category, 1)
                        if not ok:
                            print(f"  Recovery failed for {category}. Skipping.")
                            continue
                    else:
                        print("  Warning: Timeout waiting for initial cards.")

            page.wait_for_timeout(random.randint(600, 1000))

            # Reset to page 1
            page_one_btn = page.locator("a, button").filter(has_text=re.compile(r"^1$")).first
            if page_one_btn.count() > 0 and page_one_btn.is_visible():
                print("  Resetting to page 1...")
                page_one_btn.click()
                page.wait_for_timeout(random.randint(800, 1200))

            page_num = 1
            while True:
                # Wait for cards to be visible
                try:
                    page.locator(
                        "button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)"
                    ).first.wait_for(state="visible", timeout=15000)
                except Exception:
                    if has_page_error(page):
                        ok = recover_and_navigate(
                            page, context, auth_file, target_url, category, page_num
                        )
                        if not ok:
                            print("  Recovery failed. Stopping this category.")
                            break
                        continue
                    print("  No cards visible. Breaking pagination.")
                    break

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

                    controls_id = card.get_attribute("aria-controls")
                    if not controls_id:
                        print("      Skipped: no aria-controls.")
                        continue

                    content_panel = page.locator(f"#{controls_id}")

                    if card.get_attribute("data-state") != "open":
                        card.click()

                    # Check for error immediately after expanding
                    page.wait_for_timeout(random.randint(300, 500))
                    if has_page_error(page):
                        print("      Error overlay after card expand. Recovering...")
                        ok = recover_and_navigate(
                            page, context, auth_file, target_url, category, page_num
                        )
                        if not ok:
                            page_error = True
                        break

                    # Wait for SLS rows
                    try:
                        content_panel.locator(
                            "div.f\\:group.f\\:flex.f\\:flex-col.f\\:gap-3"
                        ).first.wait_for(state="visible", timeout=8000)
                    except Exception:
                        if has_page_error(page):
                            print("      Error overlay while loading SLS rows. Recovering...")
                            ok = recover_and_navigate(
                                page, context, auth_file, target_url, category, page_num
                            )
                            if not ok:
                                page_error = True
                            break
                        print("      Timeout waiting for SLS rows.")
                        continue

                    sls_rows = content_panel.locator(
                        "div.f\\:group.f\\:flex.f\\:flex-col.f\\:gap-3"
                    )
                    rows_count = sls_rows.count()
                    print(f"      {rows_count} SLS rows.")

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
                        if key not in scraped_data_dict:
                            scraped_data_dict[key] = {col: 0 for col in status_columns}

                        for k in range(tags_count):
                            tag = tags.nth(k)
                            spans = tag.locator("span")
                            if spans.count() >= 2:
                                status_name = spans.nth(0).text_content().strip().upper()
                                count_str = spans.nth(1).text_content().strip()
                                if status_name in status_mapping:
                                    try:
                                        scraped_data_dict[key][status_mapping[status_name]] = int(count_str)
                                    except ValueError:
                                        pass

                    # Tutup card setelah data diambil
                    if card.get_attribute("data-state") == "open":
                        card.click()
                        try:
                            content_panel.wait_for(state="hidden", timeout=2000)
                        except Exception:
                            pass
                    page.wait_for_timeout(random.randint(300, 600))

                if page_error:
                    break

                # ---- Pagination ----
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
                    clicked_ok = False
                    for attempt in range(3):
                        if attempt > 0:
                            print(f"  Retrying next page (attempt {attempt+1}/3)...")
                            page.wait_for_timeout(500)

                        try:
                            pagination_container = get_active_pagination(page)
                            if pagination_container:
                                btn = pagination_container.locator(
                                    "a:has-text('Next'), button:has-text('Next')"
                                ).first
                                if btn.count() > 0 and btn.is_visible():
                                    btn.click(timeout=15000)
                                else:
                                    print("  Next button gone.")
                                    break
                            else:
                                print("  Pagination gone.")
                                break
                        except Exception as e:
                            print(f"  Click Next failed: {e}")
                            continue

                        changed = wait_for_content_change(page, prev_email, prev_pag_text, timeout=20.0)
                        if changed:
                            clicked_ok = True
                            break
                        # wait_for_content_change returns False on error overlay too
                        if has_page_error(page):
                            print("  Error overlay after pagination. Recovering...")
                            ok = recover_and_navigate(
                                page, context, auth_file, target_url, category, page_num + 1
                            )
                            if ok:
                                page_num += 1
                                clicked_ok = True
                            break

                    if not clicked_ok:
                        print("  Warning: Pagination transition timeout. Breaking.")
                        break

                    page_num += 1
                    page.wait_for_timeout(random.randint(800, 1500))
                else:
                    print("  Reached the last page.")
                    break

        # ---------------------------------------------------------------
        # Phase 3: Export to CSV
        # ---------------------------------------------------------------
        print(f"\n--- Phase 3: Exporting data to '{output_csv}' ---")
        try:
            merged_data = {}
            if os.path.exists(output_csv):
                print(f"Loading existing data from '{output_csv}' for merging...")
                try:
                    with open(output_csv, "r", encoding="utf-8") as f:
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
                                cat = row[cat_idx].strip()
                                em = row[email_idx].strip().lower()
                                sls = row[sls_idx].strip()
                                counts = {}
                                for col in status_columns:
                                    try:
                                        counts[col] = int(row[header.index(col)])
                                    except (ValueError, IndexError):
                                        counts[col] = 0
                                merged_data[(cat, em, sls)] = counts
                    print(f"Loaded {len(merged_data)} existing records.")
                except Exception as e:
                    print(f"Warning: Could not read existing CSV: {e}")

            new_count = updated_count = 0
            for key, val in scraped_data_dict.items():
                norm_key = (key[0], key[1].lower(), key[2])
                if norm_key in merged_data:
                    updated_count += 1
                else:
                    new_count += 1
                merged_data[norm_key] = val

            print(f"Merge: {updated_count} updated, {new_count} new.")

            with open(output_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(headers)
                for key, val in merged_data.items():
                    writer.writerow(list(key) + [val[col] for col in status_columns])

            print(f"Written {len(merged_data)} rows to '{output_csv}'.")
        except Exception as e:
            print(f"Error writing CSV: {e}")

        browser.close()


if __name__ == "__main__":
    main()
