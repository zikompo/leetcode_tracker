import { createServer, type IncomingMessage, type Server } from "node:http";

/** The port the extension is built against for E2E (see the e2e script). */
export const FAKE_SUPABASE_PORT = 54329;

export const FAKE_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "octo@example.com",
  app_metadata: { provider: "github" },
  user_metadata: { user_name: "octocat" },
  created_at: "2026-01-01T00:00:00Z",
};

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** A token shaped like Supabase's (supabase-js only decodes it; this server doesn't verify). */
export function fakeAccessToken() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: FAKE_USER.id, exp, aud: "authenticated", role: "authenticated" })}.sig`;
}

type Row = { data: { updatedAt: string } & Record<string, unknown>; server_updated_at: string };

/**
 * Just enough of Supabase for the extension: /auth/v1/user, logout, table reads with the
 * filters supabase-js sends, and the sync_push function with its newer-wins rule.
 */
export function fakeSupabase() {
  const tables: Record<
    "attempts" | "user_problems" | "settings" | "custom_lists" | "mock_interviews",
    Map<string, Row>
  > = {
    attempts: new Map(),
    user_problems: new Map(),
    settings: new Map(),
    custom_lists: new Map(),
    mock_interviews: new Map(),
  };
  let tick = 0;
  const stamp = () => new Date(Date.now() + ++tick).toISOString();
  type Table = keyof typeof tables;
  const isTable = (t: string | undefined): t is Table => !!t && t in tables;
  const upsert = (table: Table, key: string, data: Row["data"]) => {
    const cur = tables[table].get(key);
    if (cur && cur.data.updatedAt >= data.updatedAt) return 0;
    tables[table].set(key, { data, server_updated_at: stamp() });
    return 1;
  };
  const body = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let s = "";
      req.on("data", (c: Buffer) => (s += c.toString()));
      req.on("end", () => resolve(s));
    });

  const server: Server = createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("access-control-expose-headers", "content-range");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    // GitHub sign-in (PKCE): "GitHub" approves at once and sends a one-time code back.
    if (url.pathname === "/auth/v1/authorize") {
      const back = new URL(url.searchParams.get("redirect_to") ?? "");
      back.searchParams.set("code", "fake-auth-code");
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    if (url.pathname === "/auth/v1/token" && req.method === "POST") {
      const { auth_code } = JSON.parse(await body(req)) as { auth_code?: string };
      if (url.searchParams.get("grant_type") === "pkce" && auth_code !== "fake-auth-code")
        return json(400, { error: "invalid_grant", error_description: "Bad code" });
      return json(200, {
        access_token: fakeAccessToken(),
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `refresh-${Date.now()}`,
        user: FAKE_USER,
      });
    }
    if (url.pathname === "/auth/v1/user") return json(200, FAKE_USER);
    if (url.pathname === "/auth/v1/logout") return res.writeHead(204).end();

    if (url.pathname === "/rest/v1/rpc/sync_push" && req.method === "POST") {
      const p = JSON.parse(await body(req)) as Record<
        string,
        Array<Row["data"]> | Row["data"] | null
      >;
      const n = {
        attempts: (p.p_attempts as Array<Row["data"]>).reduce(
          (k, a) => k + upsert("attempts", String(a.id), a),
          0,
        ),
        problems: (p.p_problems as Array<Row["data"]>).reduce(
          (k, x) => k + upsert("user_problems", String(x.slug), x),
          0,
        ),
        settings: p.p_settings ? upsert("settings", "me", p.p_settings as Row["data"]) : 0,
        lists: (p.p_lists as Array<Row["data"]>).reduce(
          (k, l) => k + upsert("custom_lists", String(l.id), l),
          0,
        ),
        mocks: ((p.p_mocks ?? []) as Array<Row["data"]>).reduce(
          (k, m) => k + upsert("mock_interviews", String(m.id), m),
          0,
        ),
      };
      return json(200, n);
    }

    const table = /^\/rest\/v1\/(\w+)$/.exec(url.pathname)?.[1];
    if (isTable(table) && req.method === "GET") {
      const gt = url.searchParams.get("server_updated_at")?.replace(/^gt\./, "");
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      const rows = [...tables[table].values()]
        .filter((r) => !gt || r.server_updated_at > gt)
        .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
        .slice(offset, offset + limit);
      return json(200, rows);
    }
    return json(404, { message: `fake supabase: no route for ${req.method} ${url.pathname}` });
  });

  return {
    tables,
    /** Put a row on the server as if another device had synced it. */
    seed(table: keyof typeof tables, key: string, data: Row["data"]) {
      upsert(table, key, data);
    },
    start: () => new Promise<void>((r) => server.listen(FAKE_SUPABASE_PORT, "127.0.0.1", r)),
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}
