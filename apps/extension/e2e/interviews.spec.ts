import { writeFileSync } from "node:fs";
import { expect, test } from "./fixtures";

const localDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

test("an interview date shows a countdown and makes the last days reviews only", async ({
  context,
  extensionId,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const section = options.getByRole("region", { name: "Interview dates" });
  const form = section.getByRole("form", { name: "Add an interview" });
  await form.getByLabel("Interview").fill("Phone screen");
  await form.getByLabel("Date").fill(localDate(1));
  await form.getByRole("button", { name: "Add interview" }).click();
  await expect(section).toContainText("Phone screen");
  await expect(section).toContainText("in 1 day");

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole("list", { name: "Interviews" })).toContainText("1d Phone screen");
  // Tomorrow is inside the default two reviews-only days: no new problems today.
  await expect(popup.getByRole("region", { name: "New problems" })).toContainText(
    "None today: Phone screen is close",
  );

  await section.getByRole("button", { name: "Remove Phone screen" }).click();
  await expect(section).not.toContainText("Phone screen");
  await popup.reload();
  await expect(popup.getByRole("list", { name: "Interviews" })).toHaveCount(0);
  await expect(
    popup.getByRole("region", { name: "New problems" }).locator(".queue-row"),
  ).toHaveCount(3);
});

test("the extension's pages and the log panel use Geist", async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const pageFont = await popup.evaluate(async () => {
    await document.fonts.load('14px "Geist Variable"');
    return {
      family: getComputedStyle(document.body).fontFamily,
      loaded: document.fonts.check('14px "Geist Variable"'),
    };
  });
  expect(pageFont.family).toMatch(/^"?Geist Variable/);
  expect(pageFont.loaded).toBe(true);

  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.getByRole("button", { name: "Save attempt" })).toBeVisible();
  const panelFont = await panel.evaluate((el) => ({
    family: getComputedStyle(el).fontFamily,
    loaded: document.fonts.check('13px "LeetTrack Geist"'),
  }));
  expect(panelFont.family).toMatch(/^"?LeetTrack Geist/);
  expect(panelFont.loaded).toBe(true);
});

test("a prep-tracker export imports attempts, mocks and the interview date", async ({
  context,
  extensionId,
}, testInfo) => {
  const file = testInfo.outputPath("prep-tracker.json");
  writeFileSync(
    file,
    JSON.stringify({
      v: 1,
      interview: localDate(30),
      interview2: localDate(30),
      updatedAt: Date.now(),
      log: {},
      probs: {
        "binary-search": { status: "solved", countedOn: localDate(-10), redo: null },
        "3sum": { status: "help", countedOn: localDate(-12), redo: null, clean: true },
      },
      mocks: [{ id: "m1", date: localDate(-5), notes: "Two pointers, slow" }],
    }),
  );
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('input[type="file"]').setInputFiles(file);
  await expect(
    options.getByText(
      "Imported from your prep tracker: 4 attempts, 1 mock interview, 1 interview date.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(options.getByRole("region", { name: "Interview dates" })).toContainText(
    "in 30 days",
  );
  // Importing again changes nothing.
  await options.locator('input[type="file"]').setInputFiles(file);
  await expect(options.getByText("Imported from your prep tracker: 0 attempts")).toBeVisible();
});

test("first install opens onboarding, and its choices are saved", async ({
  context,
  extensionId,
}) => {
  const url = `chrome-extension://${extensionId}/onboarding.html`;
  await expect
    .poll(() => context.pages().some((p) => p.url() === url), { timeout: 10_000 })
    .toBe(true);
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  await page.getByLabel("Blind 75").check();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("region", { name: "Interview dates" })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("radio", { name: /In Chrome's side panel/ }).click();
  await expect(page.getByRole("radio", { name: /In Chrome's side panel/ })).toBeChecked();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("button", { name: "Import JSON" })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("button", { name: "Start solving" })).toBeVisible();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(
    options.getByRole("region", { name: "Daily review" }).getByLabel("Blind 75"),
  ).toBeChecked();
  await expect(options.getByRole("radio", { name: /In Chrome's side panel/ })).toBeChecked();
});
