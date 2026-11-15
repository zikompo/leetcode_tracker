import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Attempt, type Settings } from "@leettrack/core";
import { memoryRepo } from "../repo";
import { createGitHubApi } from "./api";
import { fakeGitHub } from "./fake-github";
import { createGitHub, memoryGitHubStore } from "./service";

const at = (d: number) => new Date(2026, 10, d, 12).toISOString();
const attempt = (id: string, d: number, over: Partial<Attempt> = {}): Attempt => ({
  id,
  problemSlug: "two-sum",
  startedAt: at(d),
  endedAt: at(d),
  activeSeconds: 600,
  isCold: true,
  kind: "full",
  outcome: "solved_independently",
  helpLevel: "none",
  viewedSolutionDetected: false,
  optimality: "optimal",
  suggestedRating: 3,
  rating: 3,
  submissions: [{ at: at(d), status: "Accepted" }],
  language: "python3",
  code: `class Solution: pass  # ${id}`,
  createdAt: at(d),
  updatedAt: at(d),
  ...over,
});

function setup() {
  const gh = fakeGitHub();
  const clock = { now: new Date(2026, 10, 14, 12) };
  const repo = memoryRepo();
  let settings: Settings = { ...DEFAULT_SETTINGS };
  const api = createGitHubApi({
    clientId: "Iv1.test",
    endpoints: { web: "https://github.test", api: "https://api.github.test" },
    fetch: gh.fetch,
    clock: () => clock.now,
    sleep: async () => {},
  });
  const service = createGitHub({
    repo,
    store: memoryGitHubStore(),
    api,
    appSlug: "leettrack-test",
    getSettings: async () => settings,
    setSettings: async (patch) => (settings = { ...settings, ...patch }),
    clock: () => clock.now,
  });
  return { gh, clock, repo, service, settings: () => settings };
}

async function connect(s: ReturnType<typeof setup>) {
  const started = await s.service.startConnect();
  expect(started.deviceCode?.userCode).toBe("WDJB-MJHT");
  expect((await s.service.pollConnect()).connected).toBe(false); // still waiting for approval
  const done = await s.service.pollConnect();
  expect(done).toMatchObject({ connected: true, login: "octocat" });
  const [repo] = await s.service.listRepos();
  await s.service.selectRepo({ owner: repo!.owner, repo: repo!.repo, branch: repo!.defaultBranch });
}

describe("GitHub sync", () => {
  it("connects with a device code and picks a repo the App is installed on", async () => {
    const s = setup();
    await connect(s);
    expect(s.settings().github).toEqual({
      owner: "octocat",
      repo: "leetcode",
      branch: "main",
      includeNotes: true,
    });
    expect((await s.service.status()).installUrl).toBe(
      "https://github.com/apps/leettrack-test/installations/new",
    );
  });

  it("commits an Accepted attempt as one commit, starting an empty repo first", async () => {
    const s = setup();
    await connect(s);
    await s.repo.putAttempts([attempt("a1", 1, { notes: "hash map" })]);
    expect(await s.service.onAttemptSaved("a1")).toBe(true);
    expect(await s.service.process()).toBe(1);
    expect(s.gh.log()).toEqual([
      "0001-two-sum: attempt 1, solved independently, optimal (10 min)",
      "Start LeetCode solutions",
    ]);
    const files = s.gh.files();
    expect(Object.keys(files).sort()).toEqual([
      "README.md",
      "problems/0001-two-sum/README.md",
      "problems/0001-two-sum/attempts/2026-11-01-attempt-1.py",
      "problems/0001-two-sum/solution.py",
    ]);
    expect(files["problems/0001-two-sum/README.md"]).toContain("hash map");
    expect((await s.service.status()).pending).toBe(0);
    // Already committed: not queued again.
    expect(await s.service.onAttemptSaved("a1")).toBe(false);
  });

  it("commits a solution saved after connecting but before choosing a repo", async () => {
    const s = setup();
    await s.service.startConnect();
    await s.service.pollConnect();
    await s.service.pollConnect(); // connected, no repo yet
    await s.repo.putAttempts([attempt("early", 1)]);
    expect(await s.service.onAttemptSaved("early")).toBe(true);
    expect(await s.service.process()).toBe(0); // waits for a repo
    await s.service.selectRepo({ owner: "octocat", repo: "leetcode", branch: "main" });
    expect(await s.service.retryNow()).toBe(1);
  });

  it("only queues Accepted attempts with code, and backfills past ones", async () => {
    const s = setup();
    await connect(s);
    await s.repo.putAttempts([
      attempt("ok", 1),
      attempt("wa", 2, {
        outcome: "not_solved",
        submissions: [{ at: at(2), status: "Wrong Answer" }],
      }),
      attempt("quick", 3, { kind: "quick", code: undefined }),
    ]);
    expect(await s.service.onAttemptSaved("wa")).toBe(false);
    expect(await s.service.backfillCount()).toBe(1);
    expect(await s.service.backfill()).toBe(1);
    expect(await s.service.process()).toBe(1);
  });

  it("rebuilds on the new head when someone else pushed first", async () => {
    const s = setup();
    await connect(s);
    await s.repo.putAttempts([attempt("a1", 1), attempt("a2", 2)]);
    await s.service.backfill();
    await s.service.process();
    s.gh.state.conflictNext = true;
    await s.repo.putAttempts([attempt("a3", 3)]);
    await s.service.onAttemptSaved("a3");
    expect(await s.service.process()).toBe(1);
    expect(s.gh.log()[0]).toBe("0001-two-sum: attempt 3, solved independently, optimal (10 min)");
    expect(s.gh.log()[1]).toBe("someone else's change");
    expect(s.gh.files()["OTHER.md"]).toBe("from elsewhere");
  });

  it("commits several solutions back to back even when GitHub serves an old branch head", async () => {
    const s = setup();
    await connect(s);
    s.gh.state.staleReads = 1; // like a cached or lagging read right after each update
    await s.repo.putAttempts([attempt("a1", 1), attempt("a2", 2), attempt("a3", 3)]);
    await s.service.backfill();
    expect(await s.service.process()).toBe(3);
    expect(s.gh.log().slice(0, 3)).toEqual([
      "0001-two-sum: attempt 3, solved independently, optimal (10 min)",
      "0001-two-sum: attempt 2, solved independently, optimal (10 min)",
      "0001-two-sum: attempt 1, solved independently, optimal (10 min)",
    ]);
    expect((await s.service.status()).pending).toBe(0);
    expect(s.gh.state.cacheableReads).toBe(0); // every branch read bypassed the cache
  });

  it("refreshes an expiring token without a client secret", async () => {
    const s = setup();
    await connect(s);
    s.clock.now = new Date(s.clock.now.getTime() + 8 * 3_600_000); // the 8 h token is about done
    await s.repo.putAttempts([attempt("a1", 1)]);
    await s.service.onAttemptSaved("a1");
    expect(await s.service.process()).toBe(1);
    expect(s.gh.state.refreshes).toBe(1);
  });

  it("keeps failed commits queued with backoff, and asks to reconnect on a revoked token", async () => {
    const s = setup();
    await connect(s);
    await s.repo.putAttempts([attempt("a1", 1)]);
    await s.service.onAttemptSaved("a1");
    s.gh.state.failWith = 500;
    expect(await s.service.process()).toBe(0);
    let st = await s.service.status();
    expect(st).toMatchObject({ pending: 1, needsReconnect: false });
    expect(st.lastError).toMatch(/GitHub error 500/);
    expect(await s.service.process()).toBe(0); // backing off: not retried immediately

    s.gh.state.failWith = 401;
    st = await s.service.retryNow().then(() => s.service.status());
    expect(st).toMatchObject({ pending: 1, needsReconnect: true, connected: false });

    s.gh.state.failWith = 0;
    s.gh.state.polls = 0;
    await connect(s); // connecting again clears it, and the queue goes through
    expect(await s.service.retryNow()).toBe(1);
  });
});

describe("misconfiguration", () => {
  it("explains an unknown Client ID instead of showing a bare 404", async () => {
    const api = createGitHubApi({
      clientId: "Iv1.wrong",
      endpoints: { web: "https://github.test", api: "https://api.github.test" },
      fetch: (async () => new Response("Not Found", { status: 404 })) as typeof fetch,
    });
    await expect(api.startDeviceFlow()).rejects.toThrow(/doesn't recognise this build's Client ID/);
  });
});
