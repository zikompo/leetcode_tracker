import { test } from "./fixtures";

// Not part of the suite: run with SCREENSHOT_DIR set to capture the panel for visual review.
test.skip(!process.env.SCREENSHOT_DIR, "visual capture only");

test("capture panel", async ({ context }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-wa");
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await panel.getByRole("button", { name: "Keep optimizing" }).click();
  await page.waitForTimeout(2200);
  await page.click("#submit-ac");
  await panel.locator(".lt-solution").nth(1).waitFor();
  await panel.getByRole("radio", { name: "With help" }).click();
  await panel.getByRole("radio", { name: "Hint or topic tags" }).click();
  await panel.getByRole("radio", { name: "Suboptimal" }).click();
  await panel.getByLabel("Add a pattern tag").fill("hash");
  await panel.getByLabel("Add a pattern tag").press("Enter");
  const cx = (name: string) => panel.getByRole("radiogroup", { name });
  await cx("Solution 1 time complexity").getByRole("radio", { name: "O(n²)" }).click();
  await cx("Solution 2 time complexity").getByRole("radio", { name: "O(n log n)" }).click();
  await cx("Solution 2 space complexity").getByRole("radio", { name: "O(n)", exact: true }).click();
  await panel.locator(".lt-body").evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/panel-top.png` });
  await panel.locator(".lt-body").evaluate((el) => (el.scrollTop = 420));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/panel-light.png` });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.evaluate(() => (document.body.style.background = "#1a1a1a"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/panel-dark.png` });
});
