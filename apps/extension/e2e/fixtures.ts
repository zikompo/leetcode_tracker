import { test as base, chromium, type BrowserContext, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(here, "../.output/chrome-mv3");
const fixture = (name: string) =>
  JSON.parse(
    readFileSync(path.resolve(here, "../adapters/leetcode/__fixtures__", name), "utf8"),
  ) as Record<string, unknown>;
const mockPage = readFileSync(path.resolve(here, "mock-problem.html"), "utf8");

const QUESTIONS: Record<string, { id: string; title: string; difficulty: string }> = {
  "two-sum": { id: "1", title: "Two Sum", difficulty: "Easy" },
  "contains-duplicate": { id: "217", title: "Contains Duplicate", difficulty: "Easy" },
};

/** Serves a fake leetcode.com: problem pages, GraphQL metadata, submit and check endpoints. */
async function mockLeetCode(route: Route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (body: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

  if (url.pathname.startsWith("/graphql")) {
    const { variables } = req.postDataJSON() as { variables: { titleSlug: string } };
    const q = QUESTIONS[variables.titleSlug];
    return json({
      data: {
        question: q && {
          questionFrontendId: q.id,
          title: q.title,
          titleSlug: variables.titleSlug,
          difficulty: q.difficulty,
          isPaidOnly: false,
          topicTags: [{ name: "Array", slug: "array" }],
        },
      },
    });
  }
  if (/^\/problems\/[^/]+\/submit\/$/.test(url.pathname)) {
    mockLeetCode.counter += 1;
    return json({ submission_id: 5000 + mockLeetCode.counter });
  }
  const check = /^\/submissions\/detail\/(\d+)\/(?:v2\/)?check\/$/.exec(url.pathname);
  if (check) {
    const polls = (mockLeetCode.polls[check[1]!] ?? 0) + 1;
    mockLeetCode.polls[check[1]!] = polls;
    if (polls === 1) return json(fixture("check-pending.json"));
    const body = fixture(
      url.searchParams.get("o") === "wa" ? "check-wrong-answer.json" : "check-accepted.json",
    );
    return json({ ...body, submission_id: check[1] });
  }
  if (url.pathname.startsWith("/problems/")) {
    return route.fulfill({ status: 200, contentType: "text/html", body: mockPage });
  }
  return route.fulfill({ status: 404, body: "" });
}
mockLeetCode.counter = 0;
mockLeetCode.polls = {} as Record<string, number>;

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await context.route("https://leetcode.com/**", mockLeetCode);
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await use(new URL(worker.url()).host);
  },
});

export { expect } from "@playwright/test";
