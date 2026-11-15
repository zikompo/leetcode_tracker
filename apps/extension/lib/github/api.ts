import type { RepoFile } from "./render";

type FetchLike = typeof fetch;

/** First wait before retrying a refused ref update; doubles each time (0.5, 1, 2, 4 s). */
const RETRY_BASE_MS = 500;

export interface GitHubEndpoints {
  /** https://github.com (device and token endpoints) */
  web: string;
  /** https://api.github.com */
  api: string;
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** Seconds between polls (GitHub may raise it with slow_down). */
  interval: number;
  expiresAt: string;
}

export interface GitHubToken {
  accessToken: string;
  /** Absent when the app doesn't expire tokens. */
  expiresAt?: string;
  refreshToken?: string;
}

export interface RepoChoice {
  owner: string;
  repo: string;
  defaultBranch: string;
  private: boolean;
}

/** An error worth showing; `auth` means the token is gone or revoked: connect again. */
export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly auth = false,
  ) {
    super(message);
  }
}

const seconds = (s: number | undefined, now: Date) =>
  s ? new Date(now.getTime() + s * 1000).toISOString() : undefined;

function toToken(body: Record<string, unknown>, now: Date): GitHubToken {
  const expiresAt = seconds(body.expires_in as number | undefined, now);
  return {
    accessToken: String(body.access_token),
    ...(expiresAt ? { expiresAt } : {}),
    ...(body.refresh_token ? { refreshToken: String(body.refresh_token) } : {}),
  };
}

/**
 * The GitHub calls LeetTrack needs: device-flow sign-in for a GitHub App (no client secret
 * anywhere), token refresh, the repos the App is installed on, and writing files as one commit.
 */
export function createGitHubApi(opts: {
  clientId: string;
  endpoints: GitHubEndpoints;
  fetch?: FetchLike;
  clock?: () => Date;
  /** Wait before retrying a refused ref update (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
}) {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const doFetch: FetchLike = opts.fetch ?? ((...a) => fetch(...a));
  const clock = opts.clock ?? (() => new Date());
  const { web, api } = opts.endpoints;

  async function oauth(path: string, body: Record<string, string>) {
    const res = await doFetch(`${web}${path}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: opts.clientId, ...body }),
    }).catch(() => {
      throw new GitHubError("Couldn't reach GitHub.");
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 404) {
      throw new GitHubError(
        "GitHub doesn't recognise this build's Client ID. Check WXT_GITHUB_CLIENT_ID in apps/extension/.env.local matches your GitHub App, then rebuild.",
        404,
      );
    }
    if (!res.ok)
      throw new GitHubError(String(json.error_description ?? `HTTP ${res.status}`), res.status);
    return json;
  }

  async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${api}${path}`, {
      method,
      // GitHub marks API answers cacheable for 60 s; a cached branch head would make the next
      // commit build on an old one and be refused ("not a fast forward").
      cache: "no-store",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }).catch(() => {
      throw new GitHubError("Couldn't reach GitHub.");
    });
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      const auth = res.status === 401;
      const msg =
        res.status === 401
          ? "GitHub no longer accepts LeetTrack's sign-in. Connect again."
          : res.status === 403 || res.status === 404
            ? `GitHub refused access${json.message ? `: ${json.message}` : ""}. Is the LeetTrack app installed on this repo with write access?`
            : `GitHub error ${res.status}${json.message ? `: ${json.message}` : ""}`;
      throw new GitHubError(msg, res.status, auth);
    }
    return json as T;
  }

  return {
    async startDeviceFlow(): Promise<DeviceCode> {
      const b = await oauth("/login/device/code", {});
      if (!b.device_code)
        throw new GitHubError("GitHub didn't start sign-in. Is Device Flow enabled on the App?");
      return {
        deviceCode: String(b.device_code),
        userCode: String(b.user_code),
        verificationUri: String(b.verification_uri),
        interval: Number(b.interval ?? 5),
        expiresAt: seconds(Number(b.expires_in ?? 900), clock())!,
      };
    },

    /** One poll: a token once the user approved, "pending" until then. */
    async pollDeviceFlow(
      deviceCode: string,
    ): Promise<{ status: "pending"; interval?: number } | { status: "done"; token: GitHubToken }> {
      const b = await oauth("/login/oauth/access_token", {
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
      if (b.access_token) return { status: "done", token: toToken(b, clock()) };
      if (b.error === "authorization_pending") return { status: "pending" };
      if (b.error === "slow_down") return { status: "pending", interval: Number(b.interval ?? 10) };
      if (b.error === "expired_token") throw new GitHubError("The code expired. Start again.");
      if (b.error === "access_denied") throw new GitHubError("Sign-in was cancelled on GitHub.");
      throw new GitHubError(String(b.error_description ?? b.error ?? "Sign-in failed."));
    },

    /** Device-flow tokens refresh without a client secret. */
    async refresh(refreshToken: string): Promise<GitHubToken> {
      const b = await oauth("/login/oauth/access_token", {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      if (!b.access_token)
        throw new GitHubError("GitHub sign-in expired. Connect again.", 401, true);
      return toToken(b, clock());
    },

    login: (token: string) => call<{ login: string }>(token, "GET", "/user").then((u) => u.login),

    /** Repos the App is installed on that this user can see. */
    async listRepos(token: string): Promise<RepoChoice[]> {
      const { installations } = await call<{ installations: Array<{ id: number }> }>(
        token,
        "GET",
        "/user/installations?per_page=100",
      );
      const out: RepoChoice[] = [];
      for (const inst of installations) {
        const { repositories } = await call<{
          repositories: Array<{
            name: string;
            owner: { login: string };
            default_branch: string;
            private: boolean;
          }>;
        }>(token, "GET", `/user/installations/${inst.id}/repositories?per_page=100`);
        for (const r of repositories) {
          out.push({
            owner: r.owner.login,
            repo: r.name,
            defaultBranch: r.default_branch,
            private: r.private,
          });
        }
      }
      return out;
    },

    /**
     * Write files as one commit on `branch` (spec 8.2, via the Git Data API rather than one
     * commit per file). Returns the commit sha, or null if nothing changed. Retries if the
     * branch moved underneath, and starts an empty repo with a README.
     */
    async commitFiles(
      token: string,
      target: { owner: string; repo: string; branch: string },
      message: string,
      files: RepoFile[],
    ): Promise<string | null> {
      const repo = `/repos/${target.owner}/${target.repo}`;
      const ref = `heads/${encodeURIComponent(target.branch)}`;
      for (let tries = 0; ; tries++) {
        let head: string;
        try {
          head = (await call<{ object: { sha: string } }>(token, "GET", `${repo}/git/ref/${ref}`))
            .object.sha;
        } catch (err) {
          // An empty repo has no branch yet: the contents API can make the first commit.
          if (
            err instanceof GitHubError &&
            (err.status === 409 || err.status === 404) &&
            tries === 0
          ) {
            await call(token, "PUT", `${repo}/contents/README.md`, {
              message: "Start LeetCode solutions",
              content: btoa("# LeetCode solutions\n\nLogged with LeetTrack.\n"),
              branch: target.branch,
            });
            continue;
          }
          throw err;
        }
        const base = await call<{ tree: { sha: string } }>(
          token,
          "GET",
          `${repo}/git/commits/${head}`,
        );
        const tree = await call<{ sha: string }>(token, "POST", `${repo}/git/trees`, {
          base_tree: base.tree.sha,
          tree: files.map((f) => ({
            path: f.path,
            mode: "100644",
            type: "blob",
            content: f.content,
          })),
        });
        if (tree.sha === base.tree.sha) return null;
        const commit = await call<{ sha: string }>(token, "POST", `${repo}/git/commits`, {
          message,
          tree: tree.sha,
          parents: [head],
        });
        try {
          await call(token, "PATCH", `${repo}/git/refs/${ref}`, { sha: commit.sha, force: false });
          return commit.sha;
        } catch (err) {
          // The branch moved (someone else pushed, or GitHub briefly served an older head):
          // wait a little and rebuild on the current head.
          if (err instanceof GitHubError && err.status === 422 && tries < 4) {
            await sleep(RETRY_BASE_MS * 2 ** tries);
            continue;
          }
          throw err;
        }
      }
    },
  };
}

export type GitHubApi = ReturnType<typeof createGitHubApi>;
