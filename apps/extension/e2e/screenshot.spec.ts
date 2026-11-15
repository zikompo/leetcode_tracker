import { test } from "./fixtures";

// Not part of the suite: run with SCREENSHOT_DIR set to capture the panel and the extension's
// pages for visual review.
test.skip(!process.env.SCREENSHOT_DIR, "visual capture only");

test("capture extension pages", async ({ context, extensionId }) => {
  const dir = process.env.SCREENSHOT_DIR!;
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-ac");
  await page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("button", { name: "Save attempt" })
    .click();
  await page.getByText("Attempt saved.").waitFor();
  for (const scheme of ["dark", "light"] as const) {
    const p = await context.newPage();
    await p.emulateMedia({ colorScheme: scheme });
    await p.setViewportSize({ width: 380, height: 640 });
    await p.goto(`chrome-extension://${extensionId}/popup.html`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${dir}/ext-popup-${scheme}.png` });
    await p.setViewportSize({ width: 1200, height: 800 });
    await p.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${dir}/ext-dashboard-${scheme}.png` });
    await p.goto(`chrome-extension://${extensionId}/options.html`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${dir}/ext-options-${scheme}.png`, fullPage: true });
    await p.close();
  }
});

test("capture panel after Accepted", async ({ context }) => {
  const dir = process.env.SCREENSHOT_DIR!;
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-ac");
  await page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("button", { name: "Save attempt" })
    .waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/panel-quick-light.png` });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.evaluate(() => (document.body.style.background = "#1a1a1a"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/panel-quick-dark.png` });
  await page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("button", { name: "Edit details" })
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/panel-detail-dark.png` });
});
