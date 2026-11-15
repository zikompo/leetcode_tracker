import {
  attemptSchema,
  customListSchema,
  mockInterviewSchema,
  problemSchema,
  settingsSchema,
  type Attempt,
  type CustomList,
  type MockInterview,
  type Problem,
  type Settings,
} from "@leettrack/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

/** Records travelling between this browser and the server. */
export interface SyncBatch {
  attempts: Attempt[];
  problems: Problem[];
  settings?: Settings;
  lists: CustomList[];
  mocks: MockInterview[];
}

export interface PullResult extends SyncBatch {
  /** Server time of the newest row seen; pass it to the next pull. */
  cursor: string | null;
}

/** The server, as the sync engine sees it. Supabase in production, a fake in tests. */
export interface Remote {
  push(batch: SyncBatch): Promise<void>;
  pull(since: string | null): Promise<PullResult>;
}

const PAGE = 1000;
/**
 * Pull a little before the cursor: a row written in a transaction that committed after a
 * later one could carry an earlier server time. Merging is idempotent, so re-reading is safe.
 */
const OVERLAP_MS = 60_000;

const later = (a: string | null, b: string | null) =>
  !a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a;

export function supabaseRemote(client: SupabaseClient): Remote {
  async function pullTable<S extends z.ZodType>(table: string, schema: S, since: string | null) {
    const out: z.infer<S>[] = [];
    let cursor: string | null = null;
    const after = since ? new Date(Date.parse(since) - OVERLAP_MS).toISOString() : null;
    for (let from = 0; ; from += PAGE) {
      let q = client
        .from(table)
        .select("data, server_updated_at")
        .order("server_updated_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (after) q = q.gt("server_updated_at", after);
      const { data, error } = await q;
      if (error) throw new Error(`Couldn't download ${table}: ${error.message}`);
      const rows = data as Array<{ data: unknown; server_updated_at: string }>;
      for (const row of rows) {
        cursor = later(cursor, row.server_updated_at);
        const parsed = schema.safeParse(row.data);
        if (parsed.success) out.push(parsed.data);
      }
      if (rows.length < PAGE) return { rows: out, cursor };
    }
  }

  return {
    async push(batch) {
      const { error } = await client.rpc("sync_push", {
        p_attempts: batch.attempts,
        p_problems: batch.problems,
        p_settings: batch.settings ?? null,
        p_lists: batch.lists,
        p_mocks: batch.mocks,
      });
      if (error) throw new Error(`Couldn't upload: ${error.message}`);
    },

    async pull(since) {
      const [attempts, problems, settings, lists, mocks] = await Promise.all([
        pullTable("attempts", attemptSchema, since),
        pullTable("user_problems", problemSchema, since),
        pullTable("settings", settingsSchema, since),
        pullTable("custom_lists", customListSchema, since),
        pullTable("mock_interviews", mockInterviewSchema, since),
      ]);
      const s = settings.rows[0] as Settings | undefined;
      return {
        attempts: attempts.rows as Attempt[],
        problems: problems.rows as Problem[],
        ...(s ? { settings: s } : {}),
        lists: lists.rows as CustomList[],
        mocks: mocks.rows as MockInterview[],
        cursor: [attempts, problems, settings, lists, mocks].reduce<string | null>(
          (c, t) => later(c, t.cursor),
          since,
        ),
      };
    },
  };
}
