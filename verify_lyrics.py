import sys
from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Ensure our dev server from earlier is running and port is correct
        page.goto("http://localhost:5173/")

        # Snae Player initializes... Let's see if we can open the app and reach the player lyrics
        page.wait_for_timeout(2000)

        page.screenshot(path="verification_home.png")
        print("Captured verification_home.png")

        browser.close()

if __name__ == "__main__":
    verify()
