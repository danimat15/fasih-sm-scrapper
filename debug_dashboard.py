import sys
import os
import time
from patchright.sync_api import sync_playwright

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

def main():
    auth_file = "auth_state.json"
    target_url = "https://fasih-sm.bps.go.id/app/surveys/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24"
    
    env = load_env()
    username = env.get("USERNAME")
    password = env.get("PASSWORD")
    
    with sync_playwright() as p:
        print("Launching Chromium...")
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        if os.path.exists(auth_file):
            print(f"Loading session from '{auth_file}'...")
            context = browser.new_context(storage_state=auth_file)
        else:
            context = browser.new_context()
            
        page = context.new_page()
        
        # Intercept network requests and log URLs
        def handle_request(request):
            url = request.url
            if "api/" in url or "graphql" in url:
                print(f"  [REQ] {request.method} {url}")
                
        def handle_response(response):
            url = response.url
            if "api/" in url or "graphql" in url:
                print(f"  [RESP] {response.status} {url}")

        page.on("request", handle_request)
        page.on("response", handle_response)
        
        print(f"Navigating to: {target_url}")
        page.goto(target_url, timeout=60000)
        page.wait_for_timeout(5000)
        page.screenshot(path="step1_initial.png")
        print("Screenshot saved to 'step1_initial.png'")
        
        # SSO Check
        if "sso" in page.url or page.locator("#username").count() > 0:
            print("SSO Login detected. Performing login...")
            page.locator("#username").fill(username)
            page.locator("#password").fill(password)
            page.screenshot(path="step2_login_filled.png")
            page.locator("#kc-login").click()
            page.wait_for_timeout(10000)
            page.screenshot(path="step3_after_login.png")
            print("Screenshot saved to 'step3_after_login.png'")
            
            # Save storage state
            context.storage_state(path=auth_file)
            print("Saved new authentication state.")
            
        # Check current URL after potential login
        print(f"Current URL: {page.url}")
        
        # Wait for page load
        page.wait_for_timeout(5000)
        page.screenshot(path="step4_dashboard_loaded.png")
        print("Screenshot saved to 'step4_dashboard_loaded.png'")
        
        # Try to find and click PENDATAAN
        pendataan = page.locator("text=PENDATAAN").first
        if pendataan.count() > 0:
            print("Found PENDATAAN. Clicking it...")
            pendataan.click()
            page.wait_for_timeout(5000)
            page.screenshot(path="step5_after_pendataan.png")
            print("Screenshot saved to 'step5_after_pendataan.png'")
        else:
            print("PENDATAAN button not found.")
            
        # Try to find Rekap Petugas
        rekap = page.locator("button:has-text('Rekap Petugas')").first
        if rekap.count() > 0:
            print("Found Rekap Petugas. Clicking it...")
            rekap.click()
            page.wait_for_timeout(5000)
            page.screenshot(path="step6_rekap_petugas.png")
            print("Screenshot saved to 'step6_rekap_petugas.png'")
            
            # Click Pengawas
            pengawas = page.locator("button:has-text('Pengawas')").first
            if pengawas.count() > 0:
                print("Clicking Pengawas...")
                pengawas.click()
                page.wait_for_timeout(3000)
                page.screenshot(path="step7_pengawas.png")
                
                # Expand first card
                cards = page.locator("button:has(div.f\\:m-0.f\\:truncate.f\\:font-semibold.f\\:text-sm)")
                if cards.count() > 0:
                    print("Expanding first Pengawas card...")
                    cards.first.click()
                    page.wait_for_timeout(3000)
                    page.screenshot(path="step8_pengawas_card_expanded.png")
        else:
            print("Rekap Petugas tab not found.")
            
        browser.close()
        print("Done.")

if __name__ == "__main__":
    main()
