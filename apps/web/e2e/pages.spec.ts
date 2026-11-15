import { expect, test, type Page } from "@playwright/test";
import { demoData } from "../lib/demo";

/** A demo problem whose first and latest attempts have different code. */
const DIFF_SLUG = (() => {
  const by = new Map<string, string[]>();
  for (const a of demoData().attempts)
    by.set(a.problemSlug, [...(by.get(a.problemSlug) ?? []), a.code ?? ""]);
  return [...by].find(([, codes]) => codes.length >= 2 && codes[0] !== codes.at(-1))![0];
})();

/** No sideways scrolling of the page itself (tables scroll inside their own box). */
async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("the landing page offers the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LeetTrack" })).toBeVisible();
  await page.getByRole("link", { name: "Open the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("dashboard: today's queue, streak, activity, weak spots and leeches", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("status")).toContainText("Demo mode");
  await expect(page.getByRole("region", { name: "Summary" })).toContainText("reviews due today");
  const today = page.getByRole("region", { name: "Today" });
  await expect(today.getByRole("link").first()).toBeVisible();
  await expect(page.locator(".heatmap rect")).toHaveCount(26 * 7 - 6 + new Date().getDay());
  await expect(
    page.getByRole("region", { name: "Weakest patterns" }).getByRole("link"),
  ).not.toHaveCount(0);
  await expect(page.getByRole("region", { name: "Leeches" })).toContainText("Again ×");
  await expectNoPageOverflow(page);
});

test("problems: filter, sort and open one", async ({ page }) => {
  await page.goto("/problems");
  const rows = page.locator("tbody tr");
  const total = await rows.count();
  expect(total).toBeGreaterThan(100); // attempted problems plus NeetCode 150
  await page.getByLabel("Status").selectOption("fully_solved");
  const solved = await rows.count();
  expect(solved).toBeGreaterThan(0);
  expect(solved).toBeLessThan(total);
  await expect(page.locator("tbody .status").first()).toHaveText("Fully solved");
  await page.getByLabel("Status").selectOption("");
  await page.getByLabel("Search problems").fill("two sum");
  await expect(rows).not.toHaveCount(0);
  await page.getByRole("link", { name: "Two Sum", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Two Sum/ })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("problem detail: timeline, code diff and manual status", async ({ page }) => {
  await page.goto(`/problems/${DIFF_SLUG}`);
  await expect(page.getByRole("heading", { name: /^Attempts \(\d+\)$/ })).toBeVisible();
  await expect(page.locator(".timeline > li")).not.toHaveCount(0);
  const diff = page.getByLabel("Code diff");
  await expect(diff).toBeVisible();
  await expect(page.getByText(/\d+ lines changed/)).toBeVisible();
  await expect(diff.locator(".add, .del").first()).toBeVisible();
  await page.getByRole("button", { name: "Set" }).click();
  await expect(page.getByText("Demo mode: changes aren't saved.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on LeetCode/ })).toHaveAttribute(
    "href",
    /^https:\/\/leetcode\.com\/problems\//,
  );
  await expectNoPageOverflow(page);
});

test("patterns: level and the parts of the score", async ({ page }) => {
  await page.goto("/patterns");
  const first = page.locator("section.card[id]").first();
  await expect(first).toContainText("Retention");
  await expect(first).toContainText("Cold-solve");
  await expect(first).toContainText("Coverage");
  const notStarted = page.getByRole("region", { name: "Not started" });
  await expect(notStarted.locator(".chip-link").first()).toBeVisible();
  await expect(notStarted.getByRole("link")).toHaveCount(0); // no spoilers
  await expectNoPageOverflow(page);
});

test("lists: seed and custom lists with progress", async ({ page }) => {
  await page.goto("/lists");
  await expect(page.getByRole("region", { name: "NeetCode 150" })).toContainText("of 150 started");
  const mine = page.getByRole("region", { name: "Graphs to revisit" });
  await expect(mine.getByRole("link")).toHaveCount(4);
  await mine
    .getByLabel("Add a problem to Graphs to revisit")
    .fill("https://leetcode.com/problems/clone-graph/");
  await mine.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Demo mode: changes aren't saved.")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("settings: review options, data and account deletion", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByLabel("Reviews per day")).toHaveValue("20");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Demo mode: changes aren't saved.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeDisabled();
  await expectNoPageOverflow(page);
});

test("export downloads a LeetTrack file", async ({ request }) => {
  const res = await request.get("/export");
  expect(res.headers()["content-disposition"]).toContain("leettrack-export");
  const body = (await res.json()) as { app: string; attempts: unknown[] };
  expect(body.app).toBe("leettrack");
  expect(body.attempts.length).toBeGreaterThan(30);
});

test("dark mode follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dashboard");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(23, 24, 27)");
});

test("connecting the extension isn't offered in the demo", async ({ page }) => {
  await page.goto("/connect-extension?ext=abcdefghijklmnopabcdefghijklmnop");
  await expect(page.getByText("The demo has no accounts")).toBeVisible();
});
