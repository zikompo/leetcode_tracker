import { writeFileSync } from "node:fs";
import { replayCard, type Attempt } from "@leettrack/core";
import type { BrowserContext, Page } from "@playwright/test";
import type { browser } from "wxt/browser";
import { expect, test } from "./fixtures";

const DAY = 86_400_000;

function makeAttempt(slug: string, endedAt: string, over: Partial<Attempt> = {}): Attempt {
  return {
    id: `${slug}-${endedAt}`,
    problemSlug: slug,
    startedAt: endedAt,
    endedAt,
    activeSeconds: 600,
    isCold: false,
    kind: "full",
    outcome: "solved_independently",
    helpLevel: "none",
    viewedSolutionDetected: false,
    optimality: "optimal",
    suggestedRating: 3,
    rating: 3,
    submissions: [],
    createdAt: endedAt,
    updatedAt: endedAt,
    ...over,
  };
}

/** Good reviews, each on its due date, until the card is mature; shifted so it fell due yesterday. */
function matureHistory(slug: string): Attempt[] {
  const times: number[] = [];
  let t = Date.UTC(2025, 0, 1, 12);
  let due = t;
  for (let i = 0; i < 12; i++) {
    times.push(t);
    const card = replayCard(
      slug,
      times.map((x) => ({ endedAt: new Date(x).toISOString(), createdAt: "", rating: 3 })),
    )!;
    due = Date.parse(card.due);
    if (card.stability >= 25) break;
    t = due;
  }
  const shift = Date.now() - DAY - due;
  return times.map((x) => makeAttempt(slug, new Date(x + shift).toISOString()));
}

/** Import an export file through the settings page, as a user would. */
async function importAttempts(
  context: BrowserContext,
  extensionId: string,
  attempts: Attempt[],
  file: string,
) {
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
  await expect(options.getByText(/Imported: \d+ new attempts/)).toBeVisible();
  return options;
}

async function badgeText(context: BrowserContext) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  return worker.evaluate(() =>
    (globalThis as unknown as { chrome: typeof browser }).chrome.action.getBadgeText({}),
  );
}

const reviewHistory = () => [
  ...matureHistory("two-sum"),
  makeAttempt("contains-duplicate", new Date(Date.now() - 10 * DAY).toISOString(), {
    outcome: "not_solved",
    rating: 1,
    suggestedRating: 1,
    isCold: true,
  }),
];

test("due reviews drive the badge and the popup's Today list, most overdue first", async ({
  context,
  extensionId,
}, testInfo) => {
  await importAttempts(context, extensionId, reviewHistory(), testInfo.outputPath("export.json"));
  await expect.poll(() => badgeText(context)).toBe("2");

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole("tab", { name: "Today (2)" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const reviews = popup.getByRole("region", { name: "Reviews" }).locator(".queue-row");
  await expect(reviews).toHaveCount(2);
  await expect(reviews.nth(0)).toContainText("217. Contains Duplicate");
  await expect(reviews.nth(0)).toContainText("overdue 9d");
  await expect(reviews.nth(1)).toContainText("1. Two Sum");
  await expect(reviews.nth(1)).toContainText("quick"); // mature card
  // New problems from NeetCode 150, skipping ones already started.
  const fresh = popup.getByRole("region", { name: "New problems" }).locator(".queue-row");
  await expect(fresh).toHaveCount(3);
  await expect(fresh.nth(0)).not.toContainText("Contains Duplicate");

  // Snoozing a review takes it off today's list.
  await popup.getByRole("button", { name: "Snooze Contains Duplicate" }).click();
  await popup.getByRole("menuitem", { name: "Snooze until tomorrow" }).click();
  await expect(reviews).toHaveCount(1);
  await expect(reviews.nth(0)).toContainText("1. Two Sum");
});

test("a quick review recalls, reveals, rates, and reschedules", async ({
  context,
  extensionId,
}, testInfo) => {
  await importAttempts(context, extensionId, reviewHistory(), testInfo.outputPath("export.json"));
  const page: Page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await panel.getByRole("radio", { name: /^Quick review/ }).click();

  await panel.getByLabel("Your approach, in a sentence or two").fill("Hash map of value to index.");
  await panel
    .getByRole("radiogroup", { name: "Expected time complexity" })
    .getByRole("radio", { name: "O(n)", exact: true })
    .click();
  await expect(panel.getByRole("button", { name: "Save quick review" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Reveal my notes" }).click();
  await panel
    .getByRole("radiogroup", { name: "Recall" })
    .getByRole("radio", { name: /^Good/ })
    .click();
  await panel.getByRole("button", { name: "Save quick review" }).click();

  await expect(panel.getByText("Attempt saved.")).toBeVisible();
  await expect(panel.getByText(/^Next review/)).toBeVisible();
  await expect.poll(() => badgeText(context)).toBe("1");
  await panel.getByRole("tab", { name: /^History/ }).click();
  await expect(panel.locator(".lt-attempt").first()).toContainText("quick review");
});

test("suggested patterns stay hidden until an outcome is chosen", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/contains-duplicate/description/");
  await page.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.getByRole("radio", { name: "Not solved" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Show suggested patterns" })).toHaveCount(0);

  await panel.getByRole("radio", { name: "Not solved" }).click();
  await panel.getByRole("button", { name: "Show suggested patterns" }).click();
  await panel.getByRole("button", { name: "+ Arrays & hashing" }).click();
  await expect(panel.locator(".lt-chip-selected")).toHaveText(["Arrays & hashing×"]);
});

test("LeetCode's topic tags hide while the timer runs, when enabled", async ({
  context,
  extensionId,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel("Hide LeetCode's topic tags while the timer runs").check();
  await expect(options.getByLabel("Hide LeetCode's topic tags while the timer runs")).toBeChecked();

  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await expect(page.locator("#topic-array")).toBeHidden();
  await page.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  await page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("button", { name: "Stop", exact: true })
    .click();
  await expect(page.locator("#topic-array")).toBeVisible();
});

test("the dashboard shows pattern mastery, list progress and leeches", async ({
  context,
  extensionId,
}, testInfo) => {
  const leech = ["2026-01-01", "2026-01-03", "2026-01-06"].map((d) =>
    makeAttempt("valid-anagram", `${d}T12:00:00.000Z`, {
      outcome: "not_solved",
      rating: 1,
      stuckNote: `stuck ${d}`,
    }),
  );
  await importAttempts(
    context,
    extensionId,
    [...reviewHistory(), ...leech],
    testInfo.outputPath("export.json"),
  );
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  const row = dash.locator("tr", { hasText: "Arrays & hashing" });
  await expect(row).toBeVisible();
  await expect(row.locator(".level")).not.toHaveText("Not started");
  await expect(row).toContainText("3/");
  await row.getByRole("button", { name: "Arrays & hashing" }).click();
  await expect(dash.getByText(/^Attempted \(\d+\)$/)).toBeVisible();
  await expect(dash.getByText(/^Not started in your lists \(\d+\)$/)).toBeVisible();

  await dash.getByRole("tab", { name: "Lists" }).click();
  await expect(dash.locator(".list-card", { hasText: "NeetCode 150" })).toContainText(
    "3 of 150 started",
  );

  await dash.getByRole("tab", { name: "Leeches (1)" }).click();
  await expect(dash.getByText("Valid Anagram")).toBeVisible();
  await expect(dash.locator(".stuck li")).toHaveCount(3);
});

test("a twist prompt follows a review of a problem you know well", async ({
  context,
  extensionId,
}, testInfo) => {
  await importAttempts(context, extensionId, reviewHistory(), testInfo.outputPath("export.json"));
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  const twist = panel.getByRole("region", { name: "Twist" });
  // No AI set up, so you write the first ones yourself.
  await twist.getByRole("button", { name: "Write twists" }).click();
  await twist.getByLabel("Twists, one per line").fill("What if the array were sorted?");
  await twist.getByRole("button", { name: "Save twists" }).click();
  await expect(twist).toContainText("What if the array were sorted?");
  await twist.getByLabel("Twist answer").fill("Two pointers instead of a hash map");
  await panel.getByRole("button", { name: "Save attempt" }).click();
  await expect(page.getByText("Attempt saved.")).toBeVisible();
});

test("past the timebox, the panel offers one hint and the help is logged", async ({
  context,
  extensionId,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel("Timebox (minutes; 0 turns it off)").fill("1");
  await expect(options.getByLabel("Timebox (minutes; 0 turns it off)")).toHaveValue("1");
  // An attempt already 58 seconds in, so the one-minute timebox runs out right away.
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const now = new Date().toISOString();
  await worker.evaluate(
    (session) =>
      (globalThis as unknown as { chrome: typeof browser }).chrome.storage.session.set({
        "session:two-sum": session,
      }),
    {
      slug: "two-sum",
      startedAt: now,
      lastActiveAt: now,
      activeSeconds: 58,
      submissions: [],
      submissionIds: [],
      viewedSolutionDetected: false,
    },
  );
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  const nudge = panel.getByRole("status", { name: "Timebox" });
  await expect(nudge).toContainText("Try one hint", { timeout: 10_000 });
  await nudge.getByRole("button", { name: "I used this" }).click();
  await expect(nudge).toHaveCount(0);
  await page.click("#submit-ac");
  await expect(panel.getByRole("region", { name: "Attempt summary" })).toContainText(
    "With help · Hint or topic tags",
  );
});
