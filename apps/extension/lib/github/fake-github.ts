// A small stand-in for github.com and api.github.com, for tests only (never bundled: nothing
// in entrypoints imports it). Covers device-flow sign-in, refresh, installations, and the
// Git Data API with real-enough refs, trees and commits.

export interface FakeCommit {
  sha: string;
  message: string;
  tree: string;
  parents: string[];
}

export function fakeGitHub(opts: { owner?: string; repo?: string; branch?: string } = {}) {
  const owner = opts.owner ?? "octocat";
  const repoName = opts.repo ?? "leetcode";
  const branch = opts.branch ?? "main";
  const trees = new Map<string, Record<string, string>>([["t0", {}]]);
  const commits = new Map<string, FakeCommit>();
  const s = {
    /** Polls answered "pending" before the user "approves". */
    pendingPolls: 1,
    polls: 0,
    tokens: new Set<string>(),
    refreshes: 0,
    head: null as string | null,
    /** Make the next ref update fail as if someone else pushed first. */
    conflictNext: false,
    /** Answer every API call with this status (e.g. 401 to simulate a revoked token). */
    failWith: 0,
    /** After each branch update, the next N reads of the branch return the previous head. */
    staleReads: 0,
    staleLeft: 0,
    previousHead: null as string | null,
    /** Branch reads that allowed caching (should stay 0). */
    cacheableReads: 0,
    n: 0,
  };
  const treeSha = (files: Record<string, string>) => {
    const sha = `t${JSON.stringify(Object.entries(files).sort()).length}-${Object.keys(files).length}-${hash(JSON.stringify(files))}`;
    trees.set(sha, files);
    return sha;
  };
  const commit = (message: string, tree: string, parents: string[]) => {
    const sha = `c${++s.n}`;
    commits.set(sha, { sha, message, tree, parents });
    return sha;
  };
  const issue = () => {
    const token = `ghu_${++s.n}`;
    s.tokens.add(token);
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 28800,
      refresh_token: `ghr_${s.n}`,
      refresh_token_expires_in: 15897600,
    };
  };

  function handle(
    method: string,
    url: URL,
    body: Record<string, unknown>,
    auth: string | null,
  ): { status: number; json?: unknown } {
    const p = url.pathname;
    if (method === "POST" && p === "/login/device/code") {
      return {
        status: 200,
        json: {
          device_code: "dev-1",
          user_code: "WDJB-MJHT",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 1,
        },
      };
    }
    if (method === "POST" && p === "/login/oauth/access_token") {
      if (body.grant_type === "refresh_token") {
        s.refreshes += 1;
        return { status: 200, json: issue() };
      }
      if (s.polls++ < s.pendingPolls)
        return { status: 200, json: { error: "authorization_pending" } };
      return { status: 200, json: issue() };
    }

    const token = auth?.replace(/^Bearer /, "") ?? "";
    if (s.failWith) return { status: s.failWith, json: { message: "fake failure" } };
    if (!s.tokens.has(token)) return { status: 401, json: { message: "Bad credentials" } };

    if (method === "GET" && p === "/user") return { status: 200, json: { login: owner } };
    if (method === "GET" && p === "/user/installations") {
      return { status: 200, json: { installations: [{ id: 7 }] } };
    }
    if (method === "GET" && p === "/user/installations/7/repositories") {
      return {
        status: 200,
        json: {
          repositories: [
            { name: repoName, owner: { login: owner }, default_branch: branch, private: true },
          ],
        },
      };
    }
    const base = `/repos/${owner}/${repoName}`;
    if (method === "GET" && p === `${base}/git/ref/heads/${branch}`) {
      if (s.staleLeft > 0 && s.previousHead) {
        s.staleLeft -= 1;
        return { status: 200, json: { object: { sha: s.previousHead } } };
      }
      return s.head
        ? { status: 200, json: { object: { sha: s.head } } }
        : { status: 409, json: { message: "Git Repository is empty." } };
    }
    if (method === "PUT" && p.startsWith(`${base}/contents/`)) {
      const path = decodeURIComponent(p.slice(`${base}/contents/`.length));
      const files = { ...(s.head ? trees.get(commits.get(s.head)!.tree)! : {}) };
      files[path] = atob(String(body.content));
      s.head = commit(String(body.message), treeSha(files), s.head ? [s.head] : []);
      return { status: 201, json: { commit: { sha: s.head } } };
    }
    const c = new RegExp(`^${base}/git/commits/(\\w+)$`).exec(p);
    if (method === "GET" && c) {
      const found = commits.get(c[1]!);
      return found
        ? { status: 200, json: { sha: found.sha, tree: { sha: found.tree } } }
        : { status: 404 };
    }
    if (method === "POST" && p === `${base}/git/trees`) {
      const files = { ...trees.get(String(body.base_tree))! };
      for (const e of body.tree as Array<{ path: string; content: string }>)
        files[e.path] = e.content;
      return { status: 201, json: { sha: treeSha(files) } };
    }
    if (method === "POST" && p === `${base}/git/commits`) {
      const sha = commit(String(body.message), String(body.tree), body.parents as string[]);
      return { status: 201, json: { sha } };
    }
    if (method === "PATCH" && p === `${base}/git/refs/heads/${branch}`) {
      const next = commits.get(String(body.sha))!;
      if (s.conflictNext) {
        s.conflictNext = false;
        // Someone else's commit lands first.
        const files = { ...trees.get(commits.get(s.head!)!.tree)!, "OTHER.md": "from elsewhere" };
        s.head = commit("someone else's change", treeSha(files), [s.head!]);
      }
      if (next.parents[0] !== s.head) {
        return { status: 422, json: { message: "Update is not a fast forward" } };
      }
      s.previousHead = s.head;
      s.staleLeft = s.staleReads;
      s.head = next.sha;
      return { status: 200, json: { object: { sha: s.head } } };
    }
    return { status: 404, json: { message: `fake github: no route ${method} ${p}` } };
  }

  return {
    state: s,
    owner,
    repo: repoName,
    branch,
    handle,
    /** Files at the branch head. */
    files: (): Record<string, string> => (s.head ? trees.get(commits.get(s.head)!.tree)! : {}),
    /** Commit messages, newest first. */
    log(): string[] {
      const out: string[] = [];
      for (let sha = s.head; sha; sha = commits.get(sha)!.parents[0] ?? null) {
        out.push(commits.get(sha)!.message);
      }
      return out;
    },
    /** A fetch() that answers from this fake (for unit tests). */
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      if (url.pathname.includes("/git/ref/") && init?.cache !== "no-store") s.cacheableReads += 1;
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      const r = handle(init?.method ?? "GET", url, body, headers.get("authorization"));
      return new Response(r.json === undefined ? null : JSON.stringify(r.json), {
        status: r.status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
