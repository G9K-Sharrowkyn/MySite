from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    console_logs = []
    page.on("console", lambda msg: console_logs.append(msg.text))

    page.goto("http://localhost:3000")

    # Wait for a bit to ensure all console messages are captured
    page.wait_for_timeout(5000)

    page.screenshot(path="jules-scratch/verification/homepage_with_console.png")

    print("Console logs:")
    for log in console_logs:
        print(log)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
