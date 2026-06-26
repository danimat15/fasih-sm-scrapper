import sys
import os
import json
import random
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
        print("Launching Chromium in HEADED mode...")
        browser = p.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        if os.path.exists(auth_file):
            print(f"Loading session from '{auth_file}'...")
            context = browser.new_context(storage_state=auth_file)
        else:
            context = browser.new_context()
            
        page = context.new_page()
        
        api_responses = []
        
        def handle_response(response):
            url = response.url
            content_type = response.header_value("content-type") or ""
            if "json" in content_type or "application/json" in content_type or "api/" in url:
                try:
                    data = response.json()
                    api_responses.append({"url": url, "data": data})
                    print(f"\n[API Intercepted] {url}")
                    if isinstance(data, dict):
                        print(f"  Keys: {list(data.keys())}")
                        for k, v in data.items():
                            if isinstance(v, list) and len(v) > 0:
                                print(f"    Key '{k}' is a list of len {len(v)}")
                                if isinstance(v[0], dict):
                                    print(f"    First item keys: {list(v[0].keys())}")
                    elif isinstance(data, list):
                        print(f"  List of len {len(data)}")
                        if len(data) > 0 and isinstance(data[0], dict):
                            print(f"    First item keys: {list(data[0].keys())}")
                except Exception:
                    pass

        page.on("response", handle_response)
        
        print(f"Navigating to: {target_url}")
        print("Please solve the CAPTCHA and log in if prompted in the browser window.")
        page.goto(target_url, timeout=120000)
        
        print("\n" + "="*80)
        print("INSTRUCTIONS FOR USER:")
        print("1. Solve CAPTCHA / Log in if prompted in the open browser window.")
        print("2. Navigate to the 'Rekap Petugas' tab.")
        print("3. Click and switch between 'Pengawas' and 'Pencacah' tabs.")
        print("4. Expand 2-3 cards for each category.")
        print("5. Once you have done this, press ENTER in the terminal to save the API responses and exit.")
        print("="*80 + "\n")
        
        # Wait for user input in terminal
        input("Press Enter here when you are done capturing network logs...")
        
        with open("intercepted_apis_auth.json", "w", encoding="utf-8") as f:
            json.dump(api_responses, f, indent=2)
        print(f"\nSaved {len(api_responses)} API responses to 'intercepted_apis_auth.json'")
        
        browser.close()

if __name__ == "__main__":
    main()
