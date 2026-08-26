import { chromium } from "playwright";

const outDir = "C:/Users/smura/AppData/Local/Temp/claude/C--Users-smura/73be6d01-954b-4ab3-b2ac-42e00e815f5a/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000/seasons/2023", { waitUntil: "networkidle" });
await page.waitForSelector("text=League Story");
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/season-2023-story.png`, fullPage: true });

console.log("Console errors:", errors.length ? errors : "none");
await browser.close();
