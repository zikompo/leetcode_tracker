import { DEFAULT_SETTINGS } from "@leettrack/core";
import type { BrowserContext } from "@playwright/test";
import { expect, test } from "./fixtures";
import { FAKE_USER, fakeAccessToken, fakeSupabase } from "./fake-supabase";

test.describe.configure({ mode: "serial" });

const server = fakeSupabase();
test.beforeAll(() => server.start());
test.afterAll(() => server.stop());
test.beforeEach(() => {
  for (const t of Object.values(server.tables)) t.clear();
});

/**
 * Stands in for the website's /connect-extension page after GitHub sign-in: it hands the
 * session to the extension exactly as the real page does.
 */
const HANDOFF_PAGE = `<!doctype html><html><body><p id="out">sending</p><script>
  const q = new URLSearchParams(location.search);
  chrome.runtime.sendMessage(q.get("ext"), {
    type: "leettrack-session", accessToken: q.get("token"), refreshToken: "refresh-1",
  }, (r) => { document.getElementById("out").textContent = r && r.ok ? "connected" : "failed: " + JSON.stringify(r); });
</script></body></html>`;

async function signIn(context: BrowserContext, extensionId: string) {
  await context.route("http://localhost:3000/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: HANDOFF_PAGE }),
  );
  const site = await context.newPage();
  await site.goto(
    `http://localhost:3000/connect-extension?ext=${extensionId}&token=${fakeAccessToken()}`,
  );
  await expect(site.locator("#out")).toHaveText("connected");
}

test("signing in on the website connects the extension and uploads what was logged offline", async ({
  context,
  extensionId,
}) => {
  // Log an attempt before having an account.
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await panel.getByRole("button", { name: "Save attempt" }).click(); // one tap
  await expect(panel.getByText("Attempt saved.")).toBeVisible();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();

  await signIn(context, extensionId);
  await expect(
    options.getByText(`Signed in as ${FAKE_USER.user_metadata.user_name}`),
  ).toBeVisible();
  await expect(options.getByText(/^Synced just now$/)).toBeVisible();
  expect(server.tables.attempts.size).toBe(1);
  expect([...server.tables.user_problems.keys()]).toEqual(["two-sum"]);
});

test("changes from another device come down, and local ones go up", async ({
  context,
  extensionId,
}) => {
  await signIn(context, extensionId);
  // Another device changed the daily limit after this one last synced.
  server.seed("settings", "me", {
    ...DEFAULT_SETTINGS,
    dailyNewLimit: 9,
    updatedAt: new Date(Date.now() - 1000).toISOString(),
  });
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByRole("button", { name: "Sync now" }).click();
  await expect(options.getByText(/^Synced just now$/)).toBeVisible();
  await options.reload();
  await expect(options.getByLabel("New problems per day")).toHaveValue("9");

  // And a local change goes up on the next sync.
  await options.getByLabel("Reviews per day").fill("35");
  await expect
    .poll(async () => {
      await options.getByRole("button", { name: "Sync now" }).click();
      return (server.tables.settings.get("me")?.data as { dailyReviewLimit?: number } | undefined)
        ?.dailyReviewLimit;
    })
    .toBe(35);
});

test("the popup shows sync status, and signing out stops syncing", async ({
  context,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText("Not syncing: sign in to back up your attempts")).toBeVisible();

  await signIn(context, extensionId);
  await popup.reload();
  await expect(popup.getByText(/^Synced .* as octocat$/)).toBeVisible();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByRole("button", { name: "Sign out" }).click();
  await expect(options.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
});
