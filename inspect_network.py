import sys
import os
import json
from patchright.sync_api import sync_playwright

def main():
    auth_file = "auth_state.json"
    target_url = "https://fasih-sm.bps.go.id/app/surveys/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24"
    
    if not os.path.exists(auth_file):
        print(f"Auth file '{auth_file}' not found. Please log in first.")
        sys.exit(1)
        
    with sync_playwright() as p:
        print("Launching stealth browser...")
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        context = browser.new_context(storage_state=auth_file)
        page = context.new_page()
        
        api_responses = []
        
        # Intercept network responses
        def handle_response(response):
            url = response.url
            content_type = response.header_value("content-type") or ""
            # Capture JSON responses
            if "json" in content_type or "application/json" in content_type or "api/" in url:
                try:
                    data = response.json()
                    api_responses.append((url, data))
                    print(f"\n[API Intercepted] URL: {url}")
                    # Print a small preview of the data keys or structure
                    if isinstance(data, dict):
                        print(f"  Keys: {list(data.keys())}")
                    elif isinstance(data, list):
                        print(f"  List of len {len(data)}, first element keys: {list(data[0].keys()) if len(data) > 0 and isinstance(data[0], dict) else 'none'}")
                    else:
                        print(f"  Data type: {type(data)}")
                except Exception as e:
                    # Not JSON or failed to read
                    pass

        page.on("response", handle_response)
        
        print(f"Navigating to {target_url}...")
        page.goto(target_url, timeout=60000)
        page.wait_for_timeout(5000)
        
        print("Clicking 'Rekap Petugas'...")
        page.locator("button:has-text('Rekap Petugas')").click()
        page.wait_for_timeout(3000)
        
        print("Clicking 'Pengawas'...")
        page.locator("button:has-text('Pengawas')").click()
        page.wait_for_timeout(5000)
        
        print("Clicking 'Pencacah'...")
        page.locator("button:has-text('Pencacah')").click()
        page.wait_for_timeout(5000)
        
        # Save intercepted JSONs to a file for analysis
        with open("intercepted_apis.json", "w", encoding="utf-8") as f:
            json.dump(api_responses, f, indent=2)
        print(f"\nSaved {len(api_responses)} API responses to 'intercepted_apis.json'")
        
        browser.close()

if __name__ == "__main__":
    main()
