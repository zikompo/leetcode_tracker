import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(path.resolve(here, "../migrations/0001_init.sql"), "utf8");

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";

/** The parts of Supabase the migration relies on: auth.users, auth.uid() and the roles. */
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role authenticated nologin;
  create role anon nologin;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  insert into auth.users values ('${ALICE}'), ('${BOB}');
`;

let db: PGlite;

/** Run SQL as a signed-in user (row-level security applies), then return to the superuser. */
async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${user ? "authenticated" : "anon"};`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? ""]);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

const attempt = (id: string, updatedAt: string, notes = "") => ({
  id,
  problemSlug: "two-sum",
  updatedAt,
  notes,
});
const push = (
  user: string,
  args: { attempts?: unknown[]; problems?: unknown[]; settings?: unknown; lists?: unknown[] },
) =>
  as<{ r: Record<string, number> }>(
    user,
    "select public.sync_push($1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb) as r",
    [
      JSON.stringify(args.attempts ?? []),
      JSON.stringify(args.problems ?? []),
      args.settings === undefined ? null : JSON.stringify(args.settings),
      JSON.stringify(args.lists ?? []),
    ],
  ).then((rows) => rows[0]!.r);

beforeEach(async () => {
  db = await PGlite.create();
  await db.exec(SUPABASE_STUB);
  await db.exec(migration);
});

describe("sync_push", () => {
  it("writes each kind of record for the caller", async () => {
    const r = await push(ALICE, {
      attempts: [attempt("a1", "2026-01-01T00:00:00Z")],
      problems: [{ slug: "two-sum", updatedAt: "2026-01-01T00:00:00Z", patterns: [] }],
      settings: { panelAutoOpen: "accepted", updatedAt: "2026-01-01T00:00:00Z" },
      lists: [{ id: "l1", name: "Mine", slugs: [], updatedAt: "2026-01-01T00:00:00Z" }],
    });
    expect(r).toEqual({ attempts: 1, problems: 1, settings: 1, lists: 1 });
    const rows = await as<{ user_id: string; problem_slug: string }>(
      ALICE,
      "select user_id, problem_slug from public.attempts",
    );
    expect(rows).toEqual([{ user_id: ALICE, problem_slug: "two-sum" }]);
  });

  it("keeps the newer version, whatever order pushes arrive in", async () => {
    await push(ALICE, { attempts: [attempt("a1", "2026-01-02T00:00:00Z", "newer")] });
    const stale = await push(ALICE, { attempts: [attempt("a1", "2026-01-01T00:00:00Z", "older")] });
    expect(stale.attempts).toBe(0);
    const fresher = await push(ALICE, {
      attempts: [attempt("a1", "2026-01-03T00:00:00Z", "newest")],
    });
    expect(fresher.attempts).toBe(1);
    const [row] = await as<{ notes: string }>(
      ALICE,
      "select data->>'notes' as notes from public.attempts",
    );
    expect(row!.notes).toBe("newest");
  });

  it("records list deletes as tombstones", async () => {
    await push(ALICE, {
      lists: [{ id: "l1", name: "Mine", slugs: [], updatedAt: "2026-01-01T00:00:00Z" }],
    });
    await push(ALICE, {
      lists: [
        { id: "l1", name: "Mine", slugs: [], deleted: true, updatedAt: "2026-01-02T00:00:00Z" },
      ],
    });
    const [row] = await as<{ deleted: boolean }>(ALICE, "select deleted from public.custom_lists");
    expect(row!.deleted).toBe(true);
  });

  it("refuses callers who aren't signed in", async () => {
    await expect(as(null, "select public.sync_push()")).rejects.toThrow();
  });
});

describe("row-level security", () => {
  it("keeps each person's rows to themselves", async () => {
    await push(ALICE, { attempts: [attempt("same-id", "2026-01-01T00:00:00Z", "alice")] });
    await push(BOB, { attempts: [attempt("same-id", "2026-01-01T00:00:00Z", "bob")] });
    const alice = await as<{ notes: string }>(
      ALICE,
      "select data->>'notes' as notes from public.attempts",
    );
    expect(alice).toEqual([{ notes: "alice" }]);
    expect(await as(null, "select * from public.attempts").catch(() => [])).toEqual([]);
  });

  it("stops writing rows as someone else", async () => {
    await expect(
      as(
        ALICE,
        `insert into public.attempts (user_id, id, problem_slug, updated_at, data)
         values ($1, 'x', 's', now(), '{}')`,
        [BOB],
      ),
    ).rejects.toThrow(/row-level security/);
    await push(BOB, { attempts: [attempt("b1", "2026-01-01T00:00:00Z")] });
    await as(ALICE, "delete from public.attempts");
    const [{ count }] = await db
      .query<{ count: number }>("select count(*)::int as count from public.attempts")
      .then((r) => r.rows as [{ count: number }]);
    expect(count).toBe(1);
  });
});

describe("server timestamps", () => {
  it("advance on every write, so pulls see changes", async () => {
    await push(ALICE, { attempts: [attempt("a1", "2026-01-01T00:00:00Z")] });
    const [first] = await as<{ t: string }>(
      ALICE,
      "select server_updated_at::text as t from public.attempts",
    );
    await push(ALICE, { attempts: [attempt("a1", "2026-01-02T00:00:00Z")] });
    const [second] = await as<{ t: string }>(
      ALICE,
      "select server_updated_at::text as t from public.attempts",
    );
    expect(second!.t > first!.t).toBe(true);
  });
});

describe("delete_my_account", () => {
  it("removes the account and all of its data, and nobody else's", async () => {
    await push(ALICE, {
      attempts: [attempt("a1", "2026-01-01T00:00:00Z")],
      settings: { updatedAt: "2026-01-01T00:00:00Z" },
    });
    await push(BOB, { attempts: [attempt("b1", "2026-01-01T00:00:00Z")] });
    await as(ALICE, "select public.delete_my_account()");
    const users = await db.query<{ id: string }>("select id from auth.users");
    expect(users.rows.map((u) => u.id)).toEqual([BOB]);
    const left = await db.query<{ user_id: string }>(
      "select user_id from public.attempts union all select user_id from public.settings",
    );
    expect(left.rows).toEqual([{ user_id: BOB }]);
  });
});
