import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config.json");

function ensureConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("Missing config.json. Copy config.example.json to config.json and fill in the season settings before running this pipeline.");
    process.exit(1);
  }
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptName], {
      cwd: __dirname,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });

    child.on("error", reject);
  });
}

async function main() {
  ensureConfig();
  console.log("Starting current-season Yahoo scrape pipeline...");

  await runScript("scrape-current-week.mjs");
  await runScript("normalize-current-week.mjs");

  console.log("Current-season pipeline finished.");
}

main().catch((error) => {
  console.error("Pipeline failed:", error);
  process.exit(1);
});
