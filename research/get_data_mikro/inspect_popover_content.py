import os
import sys
import time
from patchright.sync_api import sync_playwright

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

def navigate_to_survey(page):
    if SURVEY_ID in page.url:
        if page.locator("text=PENDATAAN").count() > 0:
            print("  Already on survey page. Clicking PENDATAAN...")
            pendataan_btn = page.locator("text=PENDATAAN").first
            pendataan_btn.wait_for(state="visible", timeout=15000)
            pendataan_btn.click()
            page.wait_for_timeout(3000)
            return
        print("  Already on survey period page. Skipping survey search.")
        return

    if not page.url.endswith("/app"):
        page.goto("https://fasih-sm.bps.go.id/app")
        page.wait_for_timeout(3000)

    print("  Searching for 'SENSUS EKONOMI 2026'...")
    search_input = page.locator('input[placeholder="Cari survei..."]')
    search_input.wait_for(state="visible", timeout=30000)
    search_input.fill("SENSUS EKONOMI 2026")
    search_input.press("Enter")
    page.wait_for_timeout(3000)

    survey_items = page.locator("text=SENSUS EKONOMI 2026")
    survey_items.first.wait_for(state="visible", timeout=30000)
    survey_item = None
    for idx in range(survey_items.count()):
        item = survey_items.nth(idx)
        if item.text_content().strip() == "SENSUS EKONOMI 2026":
            survey_item = item
            break
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

def main():
    env = load_env()
    username = env.get("USERNAME")
    password = env.get("PASSWORD")
    
    auth_file = "auth_state.json"
    
    with sync_playwright() as p:
        print("Launching Chromium...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=auth_file)
        page = context.new_page()
        
        print("Navigating to BPS FASIH...")
        page.goto("https://fasih-sm.bps.go.id/", timeout=120000)
        page.wait_for_timeout(5000)
        
        # Handle SSO login if redirected
        if "sso.bps.go.id" in page.url or page.locator("#username").count() > 0 or page.locator("text=Login SSO BPS").count() > 0:
            print("Login SSO required.")
            if page.locator("text=Login SSO BPS").count() > 0:
                page.locator("text=Login SSO BPS").first.click()
                page.wait_for_timeout(3000)
            if page.locator("#username").count() > 0:
                page.locator("#username").fill(username)
                page.locator("#password").fill(password)
                page.locator("#kc-login").click()
                page.wait_for_url("**/app**", timeout=120000)
                page.wait_for_timeout(5000)
                context.storage_state(path=auth_file)
                
        navigate_to_survey(page)
        
        print("Transitioning to Detail Data Tab...")
        data_menu = page.locator("a[href$='/data'], a[href*='/data'], a:has-text('Data')").first
        data_menu.wait_for(state="visible", timeout=15000)
        data_menu.click()
        page.wait_for_timeout(5000)
        
        # Open filter drawer
        print("Opening filter drawer...")
        page.locator("button:has(svg.tabler-icon-filter)").first.click()
        page.wait_for_timeout(3000)
        
        # Click PROVINSI combobox
        label_name = "PROVINSI"
        label_locator = page.locator(f"label:has-text('{label_name}')")
        combobox = label_locator.locator("xpath=..//button[@role='combobox']")
        if combobox.count() == 0:
            combobox = page.locator(f"label:has-text('{label_name}') ~ button[role='combobox'], label:has-text('{label_name}') ~ div button[role='combobox']")
            
        print(f"Clicking combobox for {label_name}...")
        combobox.first.click()
        page.wait_for_timeout(3000)
        
        # Let's find all divs or elements in the body and write their HTML/properties
        all_elements = page.locator("body *").all()
        print(f"Total elements in body: {len(all_elements)}")
        
        with open("research/get_data_mikro/elements_dump.txt", "w", encoding="utf-8") as f:
            for idx, el in enumerate(all_elements):
                try:
                    if el.is_visible():
                        tag = el.evaluate('el => el.tagName')
                        role = el.get_attribute('role') or '-'
                        cls = el.get_attribute('class') or '-'
                        data_state = el.get_attribute('data-state') or '-'
                        text = el.text_content().strip()
                        # Output element hierarchy and info
                        f.write(f"Index: {idx} | Tag: {tag} | Role: {role} | Class: {cls} | DataState: {data_state} | Text: {text[:80]}\n")
                except Exception:
                    pass
                    
        print("Successfully written elements dump to research/get_data_mikro/elements_dump.txt")
        browser.close()

if __name__ == "__main__":
    main()
