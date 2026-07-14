import os
from patchright.sync_api import sync_playwright

def main():
    auth_file = "auth_state.json"
    target_url = "https://fasih-sm.bps.go.id/app/surveys/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24/data"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        context = browser.new_context(storage_state=auth_file)
        page = context.new_page()
        
        print(f"Navigating to {target_url}...")
        page.goto(target_url, timeout=60000)
        page.wait_for_timeout(5000)
        
        print(f"Current URL: {page.url}")
        
        # Check if CAPTCHA or search input is visible
        has_captcha = page.locator("text=perilaku yang tidak wajar, text=bukan bot").count() > 0 or page.locator("input[type='submit']").count() > 0
        has_search = page.locator('input[placeholder="Cari..."]').count() > 0
        
        print(f"Is CAPTCHA visible? {has_captcha}")
        print(f"Is search input visible? {has_search}")
        
        # Take a screenshot to inspect
        os.makedirs("research/get_data_mikro", exist_ok=True)
        page.screenshot(path="research/get_data_mikro/captcha_status.png")
        print("Screenshot saved to research/get_data_mikro/captcha_status.png")
        
        browser.close()

if __name__ == "__main__":
    main()
