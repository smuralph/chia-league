// One-time (or occasional, when the session expires) manual login.
// Opens a real, visible browser window. You log into Yahoo yourself.
// The authenticated session is saved to storageState.json (gitignored,
// never sent anywhere) so scrape.mjs can reuse it without logging in again.
//
// No terminal interaction required: this polls for successful login
// (Yahoo redirects away from login.yahoo.com once you're signed in) and
// saves automatically, since there's no interactive stdin available when
// this is launched by an automated tool rather than a hands-on terminal.

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = path.join(__dirname, "storageState.json");
const POLL_MS = 2000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes to complete login, incl. 2FA

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://login.yahoo.com/");
  console.log("\nBrowser window opened. Log into Yahoo there.");
  console.log("This will detect completion automatically once you're signed in.");

  const deadline = Date.now() + TIMEOUT_MS;
  let loggedIn = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(POLL_MS);
    const url = page.url();
    if (!url.includes("login.yahoo.com")) {
      loggedIn = true;
      break;
    }
  }

  if (!loggedIn) {
    console.error("Timed out waiting for login. Run `npm run login` again.");
    await browser.close();
    process.exit(1);
  }

  // Give the post-login redirect a moment to fully settle before snapshotting.
  await page.waitForTimeout(2000);
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Logged in. Session saved to ${STORAGE_STATE_PATH}`);

  await browser.close();
}

main();
