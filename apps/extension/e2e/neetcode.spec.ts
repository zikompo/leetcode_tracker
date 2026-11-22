import type { BrowserContext, Page } from "@playwright/test";
import type { browser } from "wxt/browser";
import { expect, test } from "./fixtures";

// E2E builds are granted neetcode.io at install (see wxt.config.ts): in the store build it's an
// optional permission the user grants from Settings.
const NEETCODE_TWO_SUM = "https://neetcode.io/problems/two-integer-sum/question";

const extensionReady = (page: Page) =>
  page.getByRole("button", { name: "Open LeetTrack log panel" }).waitFor({ state: "attached" });

/** The background registers NeetCode's scripts at start-up; wait for that before visiting. */
async function neetcodeScriptsRegistered(context: BrowserContext) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  await expect
    .poll(() =>
      worker.evaluate(async () =>
        (
          await (
            globalThis as unknown as { chrome: typeof browser }
          ).chrome.scripting.getRegisteredContentScripts()
        )
          .map((s) => s.id)
          .sort(),
      ),
    )
    .toEqual(["leettrack-neetcode", "leettrack-neetcode-interceptor"]);
}

test("on NeetCode, an Accepted is logged against the same LeetCode problem", async ({
  context,
  extensionId,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByLabel("Track problems I solve on neetcode.io")).toBeChecked();

  await neetcodeScriptsRegistered(context);
  const page = await context.newPage();
  await page.goto(NEETCODE_TWO_SUM);
  await extensionReady(page);

  // Run isn't a submission, and a wrong answer doesn't open the panel.
  await page.click("#run");
  await expect(page.locator("#result")).toHaveText("Ran: Accepted");
  await page.click("#submit-wa");
  await expect(page.locator("#result")).toHaveText("Wrong Answer");
  await page.waitForTimeout(500);
  await expect(page.getByRole("region", { name: "LeetTrack" })).toHaveCount(0);

  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel).toBeVisible();
  // NeetCode's two-integer-sum is LeetCode's 1. Two Sum.
  await expect(panel.getByText("1. Two Sum")).toBeVisible();
  await expect(panel.locator(".lt-result")).toHaveText("Accepted");
  await expect(panel.locator(".lt-solution")).toContainText("Accepted at");
  await panel.getByRole("button", { name: "Save attempt" }).click();
  await expect(panel.getByText("Attempt saved.")).toBeVisible();

  // The same problem on LeetCode shows the attempt made on NeetCode.
  const leetcode = await context.newPage();
  await leetcode.goto("https://leetcode.com/problems/two-sum/description/");
  await extensionReady(leetcode);
  await leetcode.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  await expect(
    leetcode.getByRole("region", { name: "LeetTrack" }).getByRole("tab", { name: "History (1)" }),
  ).toBeVisible();
});

test("opening NeetCode's Solution tab counts as help", async ({ context }) => {
  await neetcodeScriptsRegistered(context);
  const page = await context.newPage();
  await page.goto(NEETCODE_TWO_SUM);
  await extensionReady(page);
  await page.click("#solution-tab");
  await page.click("#submit-ac");
  const summary = page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("region", { name: "Attempt summary" });
  await expect(summary).toContainText("With help");
});
