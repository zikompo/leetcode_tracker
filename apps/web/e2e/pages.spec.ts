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
  await expect(page.locator("[data-slot=heatmap] rect")).toHaveCount(
    26 * 7 - 6 + new Date().getDay(),
  );
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
  await expect(page.locator("tbody [data-slot=status]").first()).toHaveText("Fully solved");
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
  await expect(page.locator("[data-slot=timeline] > li")).not.toHaveCount(0);
  const diff = page.getByLabel("Code diff");
  await expect(diff).toBeVisible();
  await expect(page.getByText(/\d+ lines changed/)).toBeVisible();
  await expect(diff.locator("[data-change]").first()).toBeVisible();
  await page.getByRole("button", { name: "Set" }).click();
  await expect(page.getByText("Demo mode: changes aren't saved.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on LeetCode/ })).toHaveAttribute(
    "href",
    /^https:\/\/leetcode\.com\/problems\//,
  );
  await expect(page.getByRole("link", { name: /Open on NeetCode/ })).toHaveAttribute(
    "href",
    /^https:\/\/neetcode\.io\/problems\/[a-z0-9-]+\/question$/,
  );
  await expectNoPageOverflow(page);
});

test("patterns: level and the parts of the score; a card opens its problems", async ({ page }) => {
  await page.goto("/patterns");
  const first = page.locator("[data-slot=pattern]").first();
  await expect(first).toContainText("Retention");
  await expect(first).toContainText("Cold-solve");
  await expect(first).toContainText("Coverage");
  const notStarted = page.getByRole("region", { name: "Not started" });
  await expect(notStarted.locator("[data-slot=chip]").first()).toBeVisible();

  const name = (await first.getByRole("heading").textContent())!.trim();
  await first.getByRole("link", { name }).click();
  await expect(page).toHaveURL(/\/patterns\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  const attempted = page.getByRole("region", { name: /^Problems you've attempted \(\d+\)$/ });
  await expect(attempted.getByRole("link").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /cold-solve rate by month/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Problems" })).toHaveAttribute(
    "href",
    /^\/problems\?pattern=/,
  );
  await expectNoPageOverflow(page);
});

test("pattern page keeps unstarted problems hidden until asked", async ({ page }) => {
  await page.goto("/patterns");
  const chip = page.getByRole("region", { name: "Not started" }).getByRole("link").first();
  await chip.click();
  const unstarted = page.getByRole("region", { name: /^Not started yet \(\d+\)$/ });
  await expect(unstarted.getByRole("link")).toHaveCount(0);
  await unstarted.getByText("Show unstarted problems").click();
  await expect(unstarted.getByRole("link", { name: /Solve/ }).first()).toBeVisible();
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

test("dashboard: the gauge shows today's work and problems by last rating", async ({ page }) => {
  await page.goto("/dashboard");
  const panel = page.getByRole("region", { name: "To do today" });
  await expect(
    panel.getByRole("img", { name: /problems? to do today: \d+ reviews?/ }),
  ).toBeVisible();
  const legend = panel.getByRole("list", { name: "Last ratings" });
  await expect(legend.getByRole("listitem")).toHaveCount(4);
  await expect(legend).toContainText("Again");
  await expect(legend).toContainText("Easy");
  // Hovering a rating shows its numbers in the middle.
  await legend.getByRole("listitem").filter({ hasText: "Good" }).hover();
  await expect(panel.getByText(/^\d+ due today$/)).toBeVisible();
  await expectNoPageOverflow(page);
});

test("dashboard: a countdown to each interview", async ({ page }) => {
  await page.goto("/dashboard");
  const countdowns = page.getByRole("region", { name: "Interviews" });
  await expect(countdowns.getByRole("link", { name: /days? to / })).toHaveCount(2);
  await expect(countdowns.getByRole("link", { name: /Latest mock/ })).toHaveAttribute(
    "href",
    "/mocks",
  );
  await expect(countdowns).toContainText("6 days to Phone screen");
  await countdowns.getByRole("link", { name: /Onsite interview/ }).click();
  await expect(page).toHaveURL(/\/plan$/);
});

test("plan: each interview with pace, a day-by-day plan and a form", async ({ page }) => {
  await page.goto("/plan");
  const phone = page.getByRole("region", { name: "Phone screen" });
  await expect(phone).toContainText("in 6 days");
  await expect(phone).toContainText("Graphs to revisit");
  await expect(phone.getByRole("img", { name: /Phone screen: \d+ of 4 started/ })).toBeVisible();
  const days = phone.locator("[data-slot=plan-day]");
  await expect(days.first()).toContainText("Today");
  await expect(days.last()).toContainText("Interview day");
  await expect(phone).toContainText("Reviews only");

  const onsite = page.getByRole("region", { name: "Onsite interview" });
  await expect(onsite).toContainText("Blind 75");
  // Its plan steers around the phone screen's reviews-only days.
  await onsite.getByText(/Show the other \d+ days/).click();
  await expect(onsite).toContainText("Reviews only: Phone screen is close.");

  const form = page.getByRole("form", { name: "Add an interview" });
  await form.getByLabel("Interview").fill("Final round");
  await form.getByLabel("Date").fill("2030-01-15");
  await form.getByRole("button", { name: "Add interview" }).click();
  await expect(form.getByRole("status")).toContainText("Demo mode");
  await expectNoPageOverflow(page);
});

test("clue journal: clues grouped by pattern", async ({ page }) => {
  await page.goto("/clues");
  const nav = page.getByRole("navigation", { name: "Patterns" });
  await expect(nav.getByRole("link")).not.toHaveCount(0);
  const first = nav.getByRole("link").first();
  const name = (await first.textContent())!.replace(/\d+$/, "").trim();
  await first.click();
  const group = page.getByRole("region", { name });
  await expect(group.locator("blockquote").first()).toBeVisible();
  await expect(group.getByRole("link").nth(1)).toHaveAttribute("href", /^\/problems\//);
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

test("the theme follows the system, and the toggle overrides it", async ({ page }) => {
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dashboard");
  expect(await bg()).toBe("rgb(26, 26, 26)");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  expect(await bg()).toBe("rgb(247, 248, 250)");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  expect(await bg()).toBe("rgb(26, 26, 26)");
  await page.reload(); // remembered
  expect(await bg()).toBe("rgb(26, 26, 26)");
});

test("text is set in Geist, code in Geist Mono", async ({ page }) => {
  await page.goto("/dashboard");
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const family = (el: Element) => getComputedStyle(el).fontFamily.split(",")[0]!.trim();
    const code = document.createElement("code");
    document.body.append(code);
    const sans = family(document.body);
    const mono = family(code);
    await Promise.all([document.fonts.load(`14px ${sans}`), document.fonts.load(`14px ${mono}`)]);
    return {
      sans,
      mono,
      sansLoaded: document.fonts.check(`14px ${sans}`),
      monoLoaded: document.fonts.check(`14px ${mono}`),
    };
  });
  expect(loaded.sans.toLowerCase()).toContain("geist");
  expect(loaded.mono.toLowerCase()).toContain("geist");
  expect(loaded.sansLoaded).toBe(true);
  expect(loaded.monoLoaded).toBe(true);
});

test("mocks: history with outcomes, and a form to log one", async ({ page }) => {
  await page.goto("/mocks");
  const history = page.getByRole("region", { name: "History" });
  await expect(history.getByRole("article")).toHaveCount(3);
  await expect(history).toContainText("Struggled");
  await expect(history.getByRole("link", { name: "Binary Tree Preorder Traversal" })).toBeVisible();
  const form = page.getByRole("form", { name: "Log a mock" });
  await form.getByLabel("Problem").fill("https://leetcode.com/problems/two-sum/");
  await form.getByLabel("Notes").fill("Clean, 20 minutes");
  await form.getByRole("button", { name: "Log mock" }).click();
  await expect(form.getByRole("status")).toContainText("Demo mode");
  await expectNoPageOverflow(page);
});

test("review queue: select reviews and snooze or move them", async ({ page }) => {
  await page.goto("/review");
  const rows = page.locator("tbody tr");
  await expect(rows).not.toHaveCount(0);
  await expect(page.locator("tbody").getByText("moved")).toBeVisible();
  // Terms explain themselves on hover, keyboard focus or a tap.
  await page.locator("tbody").getByText("moved").click();
  await expect(page.getByRole("tooltip")).toContainText("set by hand");
  const toolbar = page.getByRole("toolbar", { name: "Change selected reviews" });
  await expect(toolbar.getByRole("button", { name: "3 days" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Select all reviews" }).click();
  await expect(toolbar).toContainText(`${await rows.count()} selected`);
  await toolbar.getByRole("button", { name: "3 days" }).click();
  await expect(page.getByText("Demo mode: changes aren't saved.")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("the privacy policy is public and says what is stored", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
  await expect(page.getByText(/never stores problem statements/i)).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Privacy policy" })).toHaveAttribute(
    "href",
    "/privacy",
  );
  await expectNoPageOverflow(page);
});

test("connecting the extension isn't offered in the demo", async ({ page }) => {
  await page.goto("/connect-extension?ext=abcdefghijklmnopabcdefghijklmnop");
  await expect(page.getByText("The demo has no accounts")).toBeVisible();
});
