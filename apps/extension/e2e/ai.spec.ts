import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { BrowserContext } from "@playwright/test";
import type { browser } from "wxt/browser";
import { expect, test } from "./fixtures";

const PROBLEM = "https://leetcode.com/problems/two-sum/description/";

/** A stand-in OpenAI-compatible chat API on localhost, with CORS so the extension can call it. */
function fakeModelServer() {
  const state = { status: 200, requests: [] as Array<{ auth?: string; body: string }> };
  const server: Server = createServer((req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization, content-type");
    res.setHeader("access-control-allow-methods", "POST");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString()));
    req.on("end", () => {
      state.requests.push({
        ...(req.headers.authorization ? { auth: req.headers.authorization } : {}),
        body,
      });
      res.setHeader("content-type", "application/json");
      if (state.status !== 200) {
        return res.writeHead(state.status).end(JSON.stringify({ error: { message: "bad key" } }));
      }
      const content = JSON.stringify({
        time: "O(N)",
        space: "O(N)",
        optimalTime: "O(n)",
        optimalSpace: "O(n)",
      });
      res
        .writeHead(200)
        .end(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }));
    });
  });
  return { server, state };
}

async function configure(context: BrowserContext, baseUrl: string) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  await worker.evaluate(
    // Runs in the extension's service worker, where `chrome` exists.
    (config) =>
      (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.set({
        "leettrack:ai": config,
      }),
    {
      preset: "custom",
      kind: "openai",
      baseUrl,
      model: "test-model",
      apiKey: "sk-test",
    },
  );
}

let fake: ReturnType<typeof fakeModelServer>;
let baseUrl: string;
test.beforeEach(async () => {
  fake = fakeModelServer();
  await new Promise<void>((r) => fake.server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}/v1`;
});
test.afterEach(() => new Promise<void>((r) => fake.server.close(() => r())));

test("an Accepted solution gets a complexity suggestion that pre-fills the form", async ({
  context,
}) => {
  await configure(context, baseUrl);
  const page = await context.newPage();
  await page.goto(PROBLEM);
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.getByText("Suggested by test-model. Tap to change.")).toBeVisible();

  // What was sent: the accepted code and the problem's name, with the user's key.
  expect(fake.state.requests).toHaveLength(1);
  const sent = JSON.parse(fake.state.requests[0]!.body) as {
    model: string;
    messages: Array<{ content: string }>;
  };
  expect(fake.state.requests[0]!.auth).toBe("Bearer sk-test");
  expect(sent.model).toBe("test-model");
  expect(sent.messages[1]!.content).toContain("Problem: 1. Two Sum (two-sum)");
  expect(sent.messages[1]!.content).toContain("# ac solution");

  const cx = (name: string) => panel.getByRole("radiogroup", { name });
  await expect(
    cx("Solution 1 time complexity").getByRole("radio", { name: "O(n)", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    cx("Solution 1 space complexity").getByRole("radio", { name: "O(n)", exact: true }),
  ).toHaveAttribute("aria-checked", "true");

  // Matches the best known complexity, so Optimal is pre-selected and marked as suggested.
  await panel.getByRole("radio", { name: "Solved alone" }).click();
  const optimal = panel.getByRole("radio", { name: /^Optimal/ });
  await expect(optimal).toHaveAttribute("aria-checked", "true");
  await expect(optimal).toContainText("suggested");

  // Changing a chip makes it the user's choice.
  await cx("Solution 1 space complexity").getByRole("radio", { name: "O(1)" }).click();
  await expect(panel.getByText("Edited by you")).toBeVisible();

  await panel.getByRole("button", { name: "Save attempt" }).click();
  await expect(panel.getByText("Attempt saved.")).toBeVisible();
  await panel.getByRole("tab", { name: "History (1)" }).click();
  await expect(panel.locator(".lt-attempt")).toContainText("O(n) time, O(1) space");
});

test("a failed suggestion explains why and can be retried", async ({ context }) => {
  fake.state.status = 401;
  await configure(context, baseUrl);
  const page = await context.newPage();
  await page.goto(PROBLEM);
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.getByText(/Couldn't estimate: The API key was rejected\./)).toBeVisible();

  fake.state.status = 200;
  await panel.getByRole("button", { name: "Retry" }).click();
  await expect(panel.getByText("Suggested by test-model. Tap to change.")).toBeVisible();
});

test("nothing is sent while suggestions are off", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(PROBLEM);
  await page.click("#submit-ac");
  const panel = page.getByRole("region", { name: "LeetTrack" });
  await expect(panel.locator(".lt-solution")).toHaveCount(1);
  await expect(panel.locator(".lt-cx-status")).toHaveCount(0);
  expect(fake.state.requests).toHaveLength(0);
});
