import { chromium } from "playwright";

const outDir = "C:/Users/smura/AppData/Local/Temp/claude/C--Users-smura/73be6d01-954b-4ab3-b2ac-42e00e815f5a/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

// 2024: should have real projection data
await page.goto("http://localhost:3000/seasons/2024", { waitUntil: "networkidle" });
await page.locator("text=Weekly Performance").scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.selectOption('label:has-text("View:") select', "projection");
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/projection-2024.png`, fullPage: false });

const bars = page.locator(".recharts-bar-rectangle");
console.log("2024 bar count:", await bars.count());
await bars.nth(3).hover();
await page.waitForTimeout(300);
const tooltip = await page.locator(".recharts-tooltip-wrapper").innerText().catch(() => "NO TOOLTIP");
console.log("2024 tooltip:\n", tooltip);
await page.screenshot({ path: `${outDir}/projection-2024-tooltip.png`, fullPage: false });

// 2019: pre-2022, should show graceful no-data message
await page.goto("http://localhost:3000/seasons/2019", { waitUntil: "networkidle" });
await page.locator("text=Weekly Performance").scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.selectOption('label:has-text("View:") select', "projection");
await page.waitForTimeout(300);
const noDataText = await page.locator("text=No projected-points data").innerText().catch(() => "MESSAGE NOT FOUND");
console.log("\n2019 no-data message:", noDataText);
await page.screenshot({ path: `${outDir}/projection-2019-nodata.png`, fullPage: false });

console.log("\nConsole errors:", errors.length ? errors : "none");
await browser.close();
