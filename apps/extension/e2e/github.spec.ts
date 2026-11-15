import { expect, test } from "./fixtures";
import { fakeGitHubServer } from "./fake-github-server";

test.describe.configure({ mode: "serial" });

const github = fakeGitHubServer();
test.beforeAll(() => github.start());
test.afterAll(() => github.stop());
test.beforeEach(() => github.reset());

test("connect GitHub with a code, pick the repo, and an Accepted solution is committed", async ({
  context,
  extensionId,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const section = options.getByRole("region", { name: "GitHub" });
  await section.getByRole("button", { name: "Connect GitHub" }).click();
  await expect(section.getByLabel("GitHub code")).toHaveText("WDJB-MJHT");
  await expect(section.getByRole("link", { name: "Open GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/login/device",
  );
  // The fake approves on the second poll; the App is on one repo, so it's picked for you.
  await expect(section).toContainText(
    "Committing Accepted solutions to octocat/leetcode (main) as octocat",
    { timeout: 15_000 },
  );

  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-ac");
  await page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("button", { name: "Save attempt" })
    .click();

  await expect
    .poll(() => "problems/0001-two-sum/solution.py" in github.gh.files(), { timeout: 15_000 })
    .toBe(true);
  const paths = Object.keys(github.gh.files()).sort();
  expect(paths).toHaveLength(4);
  expect(paths).toEqual(expect.arrayContaining(["README.md", "problems/0001-two-sum/README.md"]));
  expect(paths).toContainEqual(
    expect.stringMatching(/^problems\/0001-two-sum\/attempts\/\d{4}-\d{2}-\d{2}-attempt-1\.py$/),
  );
  expect(github.gh.log()[0]).toMatch(/^0001-two-sum: attempt 1, solved independently \(\d+ min\)$/);
  expect(github.gh.files()["problems/0001-two-sum/solution.py"]).toContain("# ac solution");
  await options.reload();
  await expect(options.getByRole("region", { name: "GitHub" })).toContainText(
    "Last commit just now",
  );
});

test("past solutions can be committed in one go", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto("https://leetcode.com/problems/two-sum/description/");
  await page.click("#submit-ac");
  await page
    .getByRole("region", { name: "LeetTrack" })
    .getByRole("button", { name: "Save attempt" })
    .click();
  await expect(page.getByText("Attempt saved.")).toBeVisible();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const section = options.getByRole("region", { name: "GitHub" });
  await section.getByRole("button", { name: "Connect GitHub" }).click();
  await expect(section).toContainText("Committing Accepted solutions to octocat/leetcode", {
    timeout: 15_000,
  });
  await section.getByRole("button", { name: "Commit past solutions (1)" }).click();
  await expect.poll(() => github.gh.log().length, { timeout: 15_000 }).toBe(2);
});
