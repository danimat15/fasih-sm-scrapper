import os
import sys
import time
from patchright.sync_api import sync_playwright

def inspect():
    auth_file = "auth_state.json"
    if not os.path.exists(auth_file):
        print("Error: auth_state.json not found!")
        return

    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=auth_file)
        page = context.new_page()
        
        print("Navigating to FASIH root...")
        page.goto("https://fasih-sm.bps.go.id/", timeout=60000)
        page.wait_for_timeout(7000)
        
        print(f"Current URL: {page.url}")
        os.makedirs("research", exist_ok=True)
        screenshot_path = os.path.join("research", "debug_inspect.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        
        # Check if login SSO BPS button is present (meaning session expired)
        if "sso.bps.go.id" in page.url or page.locator("text=Login SSO BPS").count() > 0 or page.locator("input#username").count() > 0:
            print("Session expired or login required. Cannot inspect automatically without credentials.")
            browser.close()
            return
            
        print("Searching for 'SENSUS EKONOMI 2026'...")
        search_input = page.locator('input[placeholder="Cari survei..."]')
        if search_input.count() == 0:
            print("Search input 'Cari survei...' not found. Listing all input placeholders:")
            for idx in range(page.locator("input").count()):
                inp = page.locator("input").nth(idx)
                print(f"Input {idx}: placeholder='{inp.get_attribute('placeholder')}', id='{inp.get_attribute('id')}', class='{inp.get_attribute('class')}'")
            browser.close()
            return
            
        search_input.fill("SENSUS EKONOMI 2026")
        search_input.press("Enter")
        page.wait_for_timeout(3000)
        
        print("Clicking survey item...")
        survey_item = page.locator("text=SENSUS EKONOMI 2026").first
        survey_item.wait_for(state="visible", timeout=15000)
        survey_item.click()
        page.wait_for_timeout(3000)
        
        print("Navigating to PENDATAAN...")
        pendataan_btn = page.locator("text=PENDATAAN").first
        pendataan_btn.wait_for(state="visible", timeout=15000)
        pendataan_btn.click()
        page.wait_for_timeout(5000)
        
        print("Clicking Rekap Petugas...")
        page.locator("button:has-text('Rekap Petugas')").click()
        page.wait_for_timeout(3000)
        
        # Find cards
        cards = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)")
        card_count = cards.count()
        print(f"Found {card_count} cards on the page.")
        if card_count > 0:
            first_card = cards.first
            print("--- First Card Inner Text ---")
            print(first_card.inner_text())
            print("--- First Card Inner HTML ---")
            print(first_card.inner_html())
            
        browser.close()

if __name__ == "__main__":
    inspect()
