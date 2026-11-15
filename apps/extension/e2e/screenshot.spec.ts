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

test("capture side panel", async ({ context, extensionId }) => {
  const dir = process.env.SCREENSHOT_DIR!;
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page
    .getByRole("button", { name: "Open LeetTrack log panel" })
    .waitFor({ state: "attached" });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const tabId = await worker.evaluate(async () => {
    const chrome = (globalThis as unknown as { chrome: typeof browser }).chrome;
    const [tab] = await chrome.tabs.query({ url: "https://leetcode.com/problems/*" });
    return tab!.id!;
  });
  const side = await context.newPage();
  await side.emulateMedia({ colorScheme: "dark" });
  await side.setViewportSize({ width: 400, height: 860 });
  await side.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}`);
  await page.click("#submit-ac");
  await side.getByRole("button", { name: "Save attempt" }).waitFor();
  await side.waitForTimeout(300);
  await side.screenshot({ path: `${dir}/sidepanel-dark.png` });
});

test("capture store assets", async ({ context, extensionId }, testInfo) => {
  const dir = process.env.SCREENSHOT_DIR!;
  // Some history, so the dashboard has something to show.
  const DAY = 86_400_000;
  const slugs = [
    "two-sum",
    "valid-anagram",
    "contains-duplicate",
    "group-anagrams",
    "3sum",
    "valid-parentheses",
    "binary-search",
    "climbing-stairs",
  ];
  const attempts = slugs.flatMap((slug, i) =>
    [30, 12, 3].slice(0, 1 + (i % 3)).map((daysAgo, k) => {
      const at = new Date(Date.now() - (daysAgo + i) * DAY).toISOString();
      return {
        id: `${slug}-${k}`,
        problemSlug: slug,
        startedAt: at,
        endedAt: at,
        activeSeconds: 900 + i * 60,
        isCold: k === 0,
        kind: "full",
        outcome: i % 4 === 0 ? "solved_with_help" : "solved_independently",
        helpLevel: i % 4 === 0 ? "hint" : "none",
        viewedSolutionDetected: false,
        optimality: "optimal",
        suggestedRating: ((i + k) % 4) + 1,
        rating: ((i + k) % 4) + 1,
        submissions: [],
        createdAt: at,
        updatedAt: at,
      };
    }),
  );
  const file = testInfo.outputPath("store.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    file,
    JSON.stringify({
      app: "leettrack",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      problems: [],
      attempts,
    }),
  );
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('input[type="file"]').setInputFiles(file);
  await options.getByText(/Imported:/).waitFor();

  const shot = async (url: string, name: string) => {
    const p = await context.newPage();
    await p.emulateMedia({ colorScheme: "dark" });
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.goto(url);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${dir}/${name}.png` });
    await p.close();
  };
  await shot(`chrome-extension://${extensionId}/dashboard.html`, "screenshot-dashboard");
  await shot(`chrome-extension://${extensionId}/onboarding.html`, "screenshot-onboarding");

  const tile = await context.newPage();
  await tile.setViewportSize({ width: 440, height: 280 });
  const { readFileSync } = await import("node:fs");
  const icon = `data:image/png;base64,${readFileSync("public/icon/128.png").toString("base64")}`;
  await tile.setContent(`<html><body style="margin:0;width:440px;height:280px;display:flex;flex-direction:column;justify-content:center;gap:14px;padding:0 36px;box-sizing:border-box;background:#1a1a1a;color:#eff1f6;font-family:-apple-system,'Segoe UI',sans-serif">
    <div style="display:flex;align-items:center;gap:14px"><img src="${icon}" width="56" height="56"><span style="font-size:34px;font-weight:700">LeetTrack</span></div>
    <div style="font-size:19px;line-height:1.35;color:#c9ccd3">Log every LeetCode attempt.<br>Review before you forget.<br>Spot the pattern cold.</div>
  </body></html>`);
  await tile.waitForTimeout(300);
  await tile.screenshot({ path: `${dir}/promo-tile-440x280.png` });
});
