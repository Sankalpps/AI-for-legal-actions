import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "screenshots"))
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def run_tour():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        
        print("\n--- 1. Testing Home Page ---")
        page.goto("http://localhost:3000/")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_home.png"))
        print("Captured Home page screenshot")
        
        print("\n--- 2. Testing Simplify Page ---")
        page.goto("http://localhost:3000/simplify")
        page.wait_for_selector("button:has-text('NDA')")
        page.click("button:has-text('NDA')")
        time.sleep(1)
        page.click("button:has-text('Simplify Document')")
        print("Waiting for Simplify response...")
        page.wait_for_selector("text=Document Overview", timeout=60000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_simplify.png"))
        print("Simplify completed successfully!")

        print("\n--- 3. Testing Risk Analysis Page ---")
        page.goto("http://localhost:3000/risks")
        page.wait_for_selector("button:has-text('Contractor')")
        page.click("button:has-text('Contractor')")
        time.sleep(1)
        page.click("button:has-text('Analyze Risks')")
        print("Waiting for Risk Analysis response...")
        page.wait_for_selector("text=Overall Risk Assessment", timeout=60000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03_risks.png"))
        print("Risk analysis completed successfully!")

        print("\n--- 4. Testing Contract Comparison Page ---")
        page.goto("http://localhost:3000/compare")
        page.wait_for_selector("textarea")
        # Load sample NDA and Lease to compare
        textareas = page.query_selector_all("textarea")
        if len(textareas) >= 2:
            # Click NDA on first doc
            buttons_nda = page.query_selector_all("button:has-text('NDA')")
            if buttons_nda:
                buttons_nda[0].click()
            buttons_lease = page.query_selector_all("button:has-text('Lease')")
            if len(buttons_lease) >= 2:
                buttons_lease[1].click()
            time.sleep(1)
            page.click("button:has-text('Compare Documents')")
            print("Waiting for Compare response...")
            page.wait_for_selector("text=Comparison Summary", timeout=60000)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "04_compare.png"))
            print("Comparison completed successfully!")

        print("\n--- 5. Testing Legal Q&A Page ---")
        page.goto("http://localhost:3000/qna")
        page.wait_for_selector("button:has-text('Lease')")
        page.click("button:has-text('Lease')")
        time.sleep(1)
        # Ask question
        page.fill("textarea[placeholder*='e.g. What is the notice period']", "What happens if rent is paid late, and what is the fee amount?")
        page.click("button.btn-primary")
        print("Waiting for Q&A response...")
        page.wait_for_selector("text=Answer", timeout=60000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "05_qna.png"))
        print("Q&A completed successfully!")

        print("\n--- 6. Testing Next Steps Page ---")
        page.goto("http://localhost:3000/next-steps")
        page.wait_for_selector("textarea")
        page.fill("textarea[placeholder*='Describe Your Situation']", "My landlord kept my $4,400 security deposit after I moved out on time with 30 days notice. The apartment was left clean and undamaged, but they refuse to provide an itemized repair deduction statement after 45 days.")
        page.fill("input[placeholder*='California, USA']", "Illinois, USA")
        page.click("button:has-text('Get Next Steps')")
        print("Waiting for Next Steps response...")
        page.wait_for_selector("text=Your Legal Options", timeout=60000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "06_next_steps.png"))
        print("Next Steps completed successfully!")

        print("\n--- 7. Testing Summary & Checklist Page ---")
        page.goto("http://localhost:3000/summary")
        page.wait_for_selector("button:has-text('Contractor')")
        page.click("button:has-text('Contractor')")
        time.sleep(1)
        page.click("button:has-text('Generate Summary')")
        print("Waiting for Summary & Checklist response...")
        page.wait_for_selector("text=Executive Summary", timeout=60000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "07_summary.png"))
        print("Summary completed successfully!")

        print("\n--- 8. Testing Lawyer Prep Page ---")
        page.goto("http://localhost:3000/lawyer-prep")
        page.wait_for_selector("textarea")
        page.fill("textarea[placeholder*='Describe your legal situation in detail']", "I signed an independent contractor agreement with CloudScale Systems. They terminated my contract without notice and are demanding $250,000 in liquidated damages alleging I breached confidentiality, even though I did not disclose any trade secrets.")
        page.click("button:has-text('Generate Prep Guide')")
        print("Waiting for Lawyer Prep response...")
        page.wait_for_selector("text=What to tell your lawyer", timeout=60000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "08_lawyer_prep.png"))
        print("Lawyer Prep completed successfully!")

        browser.close()
        print("\n=== All 7 features thoroughly tested and screens captured! ===")

if __name__ == "__main__":
    run_tour()
