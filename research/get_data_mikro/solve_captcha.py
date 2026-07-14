import os
import sys
from patchright.sync_api import sync_playwright

def main():
    if len(sys.argv) < 2:
        print("Usage: python solve_captcha.py <captcha_code>")
        sys.exit(1)
        
    captcha_code = sys.argv[1]
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
        page.wait_for_timeout(3000)
        
        # Find input next to the image
        text_input = page.locator("input[type='text']")
        if text_input.count() > 0:
            print(f"Entering captcha code: {captcha_code}...")
            text_input.fill(captcha_code)
            page.wait_for_timeout(1000)
            
            submit_btn = page.locator("input[type='submit'], button:has-text('submit')")
            if submit_btn.count() > 0:
                print("Clicking submit...")
                submit_btn.click()
                page.wait_for_timeout(5000)
                
                # Check if we bypassed it
                print(f"Current URL after submit: {page.url}")
                
                # Save session
                context.storage_state(path=auth_file)
                print(f"Session saved to {auth_file}")
            else:
                print("Submit button not found.")
        else:
            print("CAPTCHA input field not found. Maybe it's already bypassed?")
            
        os.makedirs("research/get_data_mikro", exist_ok=True)
        page.screenshot(path="research/get_data_mikro/after_captcha_solve.png")
        print("Screenshot saved to research/get_data_mikro/after_captcha_solve.png")
        
        browser.close()

if __name__ == "__main__":
    main()
