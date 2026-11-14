// Renders the extension icon (assets/icon.svg) to the PNG sizes Chrome needs.
// Run: node scripts/generate-icons.mjs   (uses Playwright's Chromium)
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(path.join(root, "assets/icon.svg"), "utf8");
const outDir = path.join(root, "public/icon");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 96, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace("<svg", `<svg width="${size}" height="${size}"`)}</body></html>`,
  );
  await page.screenshot({ path: path.join(outDir, `${size}.png`), omitBackground: true });
}
await browser.close();
console.log("Wrote icons to", outDir);
