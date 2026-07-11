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
        print("Launching browser in headed mode...")
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(storage_state=auth_file)
        page = context.new_page()
        
        print("Navigating to FASIH root...")
        page.goto("https://fasih-sm.bps.go.id/", timeout=120000)
        
        # Wait for the loading screen to disappear and redirect to complete
        print("Waiting for page load / redirection...")
        page.wait_for_timeout(10000)
        
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
        try:
            search_input = page.locator('input[placeholder="Cari survei..."]')
            search_input.wait_for(state="visible", timeout=30000)
            search_input.fill("SENSUS EKONOMI 2026")
            search_input.press("Enter")
            page.wait_for_timeout(3000)
        except Exception as e:
            print(f"Error finding search input: {e}")
            print("Listing all input placeholders:")
            for idx in range(page.locator("input").count()):
                inp = page.locator("input").nth(idx)
                print(f"Input {idx}: placeholder='{inp.get_attribute('placeholder')}', id='{inp.get_attribute('id')}', class='{inp.get_attribute('class')}'")
            browser.close()
            return
            
        print("Clicking survey item...")
        try:
            survey_item = page.locator("text=SENSUS EKONOMI 2026").first
            survey_item.wait_for(state="visible", timeout=15000)
            survey_item.click()
            page.wait_for_timeout(3000)
        except Exception as e:
            print(f"Error clicking survey: {e}")
            browser.close()
            return
        
        print("Navigating to PENDATAAN...")
        try:
            pendataan_btn = page.locator("text=PENDATAAN").first
            pendataan_btn.wait_for(state="visible", timeout=15000)
            pendataan_btn.click()
            page.wait_for_timeout(5000)
        except Exception as e:
            print(f"Error clicking PENDATAAN: {e}")
            browser.close()
            return
        
        print("Clicking Rekap Petugas...")
        try:
            rekap_btn = page.locator("button:has-text('Rekap Petugas')").first
            rekap_btn.wait_for(state="visible", timeout=15000)
            rekap_btn.click()
            page.wait_for_timeout(5000)
        except Exception as e:
            print(f"Error clicking Rekap Petugas: {e}")
            browser.close()
            return
        
        # Find cards
        cards = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)")
        try:
            cards.first.wait_for(state="visible", timeout=30000)
        except Exception:
            pass
            
        card_count = cards.count()
        print(f"Found {card_count} cards on the page.")
        if card_count > 0:
            first_card = cards.first
            print("--- First Card Attributes ---")
            print(f"aria-controls: {first_card.get_attribute('aria-controls')}")
            print(f"data-state: {first_card.get_attribute('data-state')}")
            print(f"aria-expanded: {first_card.get_attribute('aria-expanded')}")
            print(f"id: {first_card.get_attribute('id')}")
            print(f"tag name: {first_card.evaluate('el => el.tagName')}")
            print("--- First Card Inner HTML ---")
            print(first_card.inner_html())
            
            # Let's also print the outer HTML of the parent to see if aria-controls is on parent
            print("--- First Card Parent HTML ---")
            print(first_card.locator("xpath=..").evaluate("el => el.outerHTML")[:1000])
            
        browser.close()

if __name__ == "__main__":
    inspect()
