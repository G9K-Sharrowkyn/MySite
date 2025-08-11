from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    console_logs = []
    page.on("console", lambda msg: console_logs.append(msg.text))

    page.goto("http://localhost:3000/login")

    page.wait_for_load_state("networkidle")

    page.fill('input[name="email"]', "moderator@site.local")
    page.fill('input[name="password"]', "mod1234")

    # Click the input with type="submit"
    page.click('input[type="submit"]')

    page.wait_for_url("http://localhost:3000/feed")

    page.screenshot(path="jules-scratch/verification/login_page.png")

    print("Console logs:")
    for log in console_logs:
        print(log)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
