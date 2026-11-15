import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  DEFAULT_SETTINGS,
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
import { buildSnapshot, type DataSet, type Snapshot } from "@leettrack/insights";
import type { z } from "zod";
import { demoData } from "./demo";
import { DEMO, SUPABASE_CONFIGURED } from "./env";
import { supabaseServer } from "./supabase/server";

export interface Viewer {
  id: string;
  name: string;
  avatarUrl?: string;
  demo: boolean;
}

const DEMO_VIEWER: Viewer = { id: "demo", name: "Demo account", demo: true };

export async function getViewer(): Promise<Viewer | null> {
  // Always per request: due dates and "today" depend on the current time.
  await connection();
  if (DEMO) return DEMO_VIEWER;
  if (!SUPABASE_CONFIGURED) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const meta = user.user_metadata as Record<string, string | undefined>;
  const avatarUrl = meta.avatar_url;
  return {
    id: user.id,
    name: meta.user_name ?? meta.full_name ?? user.email ?? "You",
    ...(avatarUrl ? { avatarUrl } : {}),
    demo: false,
  };
}

const PAGE = 1000; // PostgREST returns at most this many rows per request

/** Every row's `data` from one table, page by page, keeping only rows that validate. */
async function selectAll<S extends z.ZodType>(table: string, schema: S): Promise<z.infer<S>[]> {
  const supabase = await supabaseServer();
  const out: z.infer<S>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("data")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Loading ${table}: ${error.message}`);
    for (const row of data as Array<{ data: unknown }>) {
      const parsed = schema.safeParse(row.data);
      if (parsed.success) out.push(parsed.data);
    }
    if (data.length < PAGE) return out;
  }
}

export async function loadDataSet(): Promise<DataSet> {
  if (DEMO) return demoData();
  const [problems, attempts, settings, customLists, mocks] = await Promise.all([
    selectAll("user_problems", problemSchema),
    selectAll("attempts", attemptSchema),
    selectAll("settings", settingsSchema),
    selectAll("custom_lists", customListSchema),
    selectAll("mock_interviews", mockInterviewSchema),
  ]);
  return {
    problems: problems as Problem[],
    attempts: attempts as Attempt[],
    settings: (settings[0] as Settings | undefined) ?? DEFAULT_SETTINGS,
    customLists: customLists as CustomList[],
    mocks: mocks as MockInterview[],
  };
}

/** The signed-in viewer and their data, ready for the insights views. Redirects if signed out. */
export async function loadSnapshot(): Promise<{ viewer: Viewer; snap: Snapshot; data: DataSet }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const data = await loadDataSet();
  return { viewer, snap: buildSnapshot(data, new Date()), data };
}
