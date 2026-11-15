import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

const PROBLEM = "https://leetcode.com/problems/two-sum/description/";

test("Accepted opens the panel pre-filled, and the saved attempt shows after reopening", async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(PROBLEM);

  const launcher = page.getByRole("button", { name: "Open LeetTrack log panel" });
  await expect(launcher).toBeVisible();

  // A wrong answer is recorded but (in the default "on Accepted" mode) does not open the panel.
  await page.click("#submit-wa");
  await expect(page.locator('#result [data-e2e-locator="submission-result"]')).toHaveText(
    "Wrong Answer",
  );
  await page.waitForTimeout(500);
  await expect(page.getByRole("region", { name: "LeetTrack" })).toHaveCount(0);

  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("1. Two Sum")).toBeVisible();
  // Only the verdict is shown; runtime and percentiles are not.
  await expect(panel.locator(".lt-result")).toHaveText("Accepted");

  // Accepted stops the timer automatically.
  await expect(panel.getByText("stopped at Accepted")).toBeVisible();
  const solveTime = panel.getByLabel("Solve time");
  const frozen = await solveTime.textContent();
  await page.waitForTimeout(1500);
  await expect(solveTime).toHaveText(frozen!);
  await expect(panel.getByLabel(/Minutes until/)).toHaveCount(0);
  await expect(panel.locator(".lt-solution")).toHaveCount(1);
  await expect(panel.locator(".lt-solution")).toContainText("Accepted at");

  // Keep optimizing: the clock resumes (no reset) and the next Accepted is a second checkpoint.
  await panel.getByRole("button", { name: "Keep optimizing" }).click();
  await expect(panel.getByText("timing")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.click("#submit-ac");
  await expect(panel.locator(".lt-solution")).toHaveCount(2);
  await expect(panel.getByText("stopped at Accepted")).toBeVisible();
  await expect(panel.locator(".lt-solution").nth(1)).toContainText("Solution 2");
  await expect(panel.locator(".lt-solution-delta")).toHaveText(/^\+\d+s$/);
  // After Accepted: a one-tap summary with the likely answers filled in.
  const summary = panel.getByRole("region", { name: "Attempt summary" });
  await expect(summary).toContainText("Solved alone");
  await expect(summary).toContainText("Arrays & hashing"); // Two Sum's suggested pattern
  await panel.getByRole("button", { name: "Edit details" }).click();

  await expect(panel.locator(".lt-observed")).toContainText("3 (2 AC)");
  await expect(panel.locator(".lt-observed")).toContainText("python3");
  await expect(panel.locator(".lt-observed")).toContainText("Solution viewedNo");
  await expect(panel.getByRole("radio", { name: /^Solved alone/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await panel.getByRole("radio", { name: "Optimal", exact: true }).click();
  await expect(panel.getByRole("radio", { name: /Good/ })).toHaveAttribute("aria-checked", "true");
  // Complexity is picked from chips, one set per solution; "Other" takes free text.
  const cx = (name: string) => panel.getByRole("radiogroup", { name });
  await cx("Solution 1 time complexity").getByRole("radio", { name: "O(n²)" }).click();
  await cx("Solution 1 space complexity").getByRole("radio", { name: "O(1)" }).click();
  await cx("Solution 2 time complexity").getByRole("radio", { name: "O(n)", exact: true }).click();
  await cx("Solution 2 space complexity").getByRole("button", { name: "Other…" }).click();
  await panel.getByLabel("Solution 2 space complexity, other").fill("O(n)");
  await panel.getByLabel("Solution 2 space complexity, other").press("Enter"); // must not submit
  await expect(panel.getByRole("button", { name: "Save attempt" })).toBeVisible();
  await expect(
    cx("Solution 2 time complexity").getByRole("radio", { name: "O(n)", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  // Tags start from the problem's suggested patterns. Enter adds the best match, a click picks
  // from the list, and new names become custom tags.
  await expect(panel.locator(".lt-chip-selected")).toHaveText(["Arrays & hashing×"]);
  const tagInput = panel.getByLabel("Add a pattern tag");
  await tagInput.fill("two p");
  await tagInput.press("Enter");
  await tagInput.fill("Matrix walk");
  await expect(panel.getByRole("button", { name: "+ Create “Matrix walk”" })).toBeVisible();
  await tagInput.press("Enter");
  await expect(panel.locator(".lt-chip-selected")).toHaveText([
    "Arrays & hashing×",
    "Two pointers×",
    "Matrix walk×",
  ]);
  await tagInput.press("Backspace");
  await expect(panel.locator(".lt-chip-selected")).toHaveCount(2);
  await tagInput.fill("matrix");
  await tagInput.press("Enter"); // the custom tag now exists, so it is offered like any other
  await expect(panel.locator(".lt-chip-selected")).toHaveCount(3);
  await panel.getByLabel(/Notes/).fill("Use a hash map of value → index.");
  await panel.getByRole("button", { name: "Show captured code" }).click();
  await expect(panel.locator("textarea.lt-code")).toHaveValue(/# ac solution/);
  await panel.getByRole("button", { name: "Save attempt" }).click();

  await expect(panel.getByText("Attempt saved.")).toBeVisible();
  await expect(panel.getByText("Fully solved · optimal")).toBeVisible();

  // Reopen the problem: the attempt is in the history.
  await page.goto(PROBLEM);
  await page.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  const panel2 = page.getByRole("region", { name: "LeetTrack" });
  await panel2.getByRole("tab", { name: "History (1)" }).click();
  await expect(panel2.locator(".lt-attempt")).toHaveCount(1);
  await expect(panel2.locator(".lt-attempt")).toContainText("Solved alone");
  await expect(panel2.locator(".lt-attempt")).toContainText("3 submissions");
  await expect(panel2.locator(".lt-attempt")).toContainText("2 solutions, final at");
  // Reopening starts a new attempt, so earlier notes, complexity and tags stay hidden (spec 5.6).
  await expect(panel2.getByText(/hidden until you log this one/)).toBeVisible();
  await expect(panel2.locator(".lt-attempt")).not.toContainText("O(n) time");
  await expect(panel2.getByText("Notes and code")).toHaveCount(0);
  await expect(panel2.locator(".lt-chips-static")).toHaveCount(0);
  await panel2.getByRole("button", { name: "Show my notes anyway" }).click();
  await expect(panel2.locator(".lt-attempt")).toContainText("O(n) time, O(n) space");
  // The schedule: a first clean solve comes back in a few days.
  await expect(panel2.locator(".lt-card-info")).toContainText("Next review");
  await expect(panel2.locator(".lt-attempt")).toContainText("cold");
  await panel2.getByText("Notes and code").click();
  await expect(panel2.getByText("Use a hash map of value → index.")).toBeVisible();
  await expect(panel2.locator(".lt-checkpoints li")).toHaveCount(2);
  await expect(panel2.locator(".lt-checkpoints li").first()).toContainText(
    "O(n²) time, O(1) space",
  );
  await expect(panel2.locator(".lt-chips-static .lt-chip")).toHaveText([
    "Arrays & hashing",
    "Two pointers",
    "Matrix walk",
  ]);

  // Export, then re-import the same file: nothing new is added.
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByText("1 attempts across 1 problems")).toBeVisible();
  const [download] = await Promise.all([
    options.waitForEvent("download"),
    options.getByRole("button", { name: "Export JSON" }).click(),
  ]);
  const file = await download.path();
  const exported = JSON.parse(readFileSync(file, "utf8")) as {
    attempts: Array<{ notes: string; rating: number; checkpoints: unknown[] }>;
  };
  expect(exported.attempts).toHaveLength(1);
  expect(exported.attempts[0]!.checkpoints).toHaveLength(2);
  expect(exported.attempts[0]).toMatchObject({
    notes: "Use a hash map of value → index.",
    rating: 3,
  });
  await options.locator('input[type="file"]').setInputFiles(file);
  await expect(
    options.getByText("Imported: 0 new attempts, 0 updated, 0 problems merged."),
  ).toBeVisible();
});

test("opening the Editorial marks the solution as viewed and pre-selects help", async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/contains-duplicate/description/");
  await page.click("#editorial");
  await page.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.getByText("217. Contains Duplicate")).toBeVisible();
  await expect(panel.locator(".lt-observed")).toContainText("Solution viewedYes");
  await panel.getByRole("radio", { name: "With help" }).click();
  await expect(panel.getByRole("radio", { name: "Read the key idea" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // Spec 5.2: solved with the key idea → suggested rating Hard.
  await expect(panel.getByRole("radio", { name: /Hard/ })).toHaveAttribute("aria-checked", "true");
  await panel.getByRole("radio", { name: "Full solution" }).click();
  await expect(panel.getByRole("radio", { name: /Again/ })).toHaveAttribute("aria-checked", "true");
});

test("Run results are never logged as submissions", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(PROBLEM);
  // A Run poll uses the same check URL but an id that never came from a Submit.
  await page.evaluate(() => fetch("/submissions/detail/999/check/"));
  await page.evaluate(() => fetch("/submissions/detail/999/check/"));
  await page.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  await expect(page.locator(".lt-observed").first()).toContainText("Submissions0");
});

test("the timer can be stopped and resumed by hand", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(PROBLEM);
  await page.getByRole("button", { name: "Open LeetTrack log panel" }).click();
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.getByText("timing")).toBeVisible();
  await panel.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(panel.getByText("stopped", { exact: true })).toBeVisible();
  const frozen = await panel.getByLabel("Solve time").textContent();
  await page.waitForTimeout(1500);
  await expect(panel.getByLabel("Solve time")).toHaveText(frozen!);
  await panel.getByRole("button", { name: "Resume" }).click();
  await expect(panel.getByText("timing")).toBeVisible();
  await expect(panel.getByLabel("Solve time")).not.toHaveText(frozen!, { timeout: 3000 });
});

test("re-submitting without new work adds no checkpoint, and a checkpoint can be removed", async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(PROBLEM);
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.locator(".lt-solution")).toHaveCount(1);
  // The clock is stopped, so the same solution submitted again is not a new checkpoint.
  await page.click("#submit-ac");
  await panel.getByRole("button", { name: "Edit details" }).click();
  await expect(panel.locator(".lt-observed")).toContainText("2 (2 AC)");
  await expect(panel.locator(".lt-solution")).toHaveCount(1);

  await panel.getByRole("button", { name: "Keep optimizing" }).click();
  await page.waitForTimeout(1500);
  await page.click("#submit-ac");
  await expect(panel.locator(".lt-solution")).toHaveCount(2);
  await panel.getByRole("button", { name: "Remove solution 2" }).click();
  await expect(panel.locator(".lt-solution")).toHaveCount(1);
  await expect(panel.locator(".lt-solution")).toContainText("Accepted at");
});

test("one tap saves an Accepted solution with the suggested answers", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(PROBLEM);
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  const summary = panel.getByRole("region", { name: "Attempt summary" });
  await expect(summary).toContainText("Solved alone");
  await expect(summary).toContainText("Unsure");
  await expect(summary).toContainText("Good");
  await expect(summary).toContainText("Arrays & hashing");
  await expect(panel.getByRole("radio", { name: /^Not solved/ })).toHaveCount(0); // form folded away
  await panel.getByRole("button", { name: "Save attempt" }).click();
  await expect(panel.getByText("Attempt saved.")).toBeVisible();
  await panel.getByRole("tab", { name: "History (1)" }).click();
  await expect(panel.locator(".lt-attempt")).toContainText("Solved alone");
  await expect(panel.locator(".lt-chips-static .lt-chip")).toHaveText(["Arrays & hashing"]);
});

test("after opening the Editorial, the summary says solved with help", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(PROBLEM);
  await page.click("#editorial");
  await page.click("#submit-ac");
  const summary = page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("region", { name: "Attempt summary" });
  await expect(summary).toContainText("With help · Read the key idea");
  await expect(summary).toContainText("Hard"); // light help suggests Hard
});
