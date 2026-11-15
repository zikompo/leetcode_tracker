"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEFAULT_SETTINGS,
  parseExport,
  problemSchema,
  settingsSchema,
  type CustomList,
  type Problem,
  type Settings,
  type StatusOverride,
} from "@leettrack/core";
import { SEED_BY_SLUG } from "@leettrack/seed";
import { DEMO } from "./env";
import { supabaseServer } from "./supabase/server";
import { parseProblemRef } from "./util";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const DEMO_RESULT: ActionResult = { ok: false, message: "Demo mode: changes aren't saved." };
const now = () => new Date().toISOString();

type Push = {
  attempts?: unknown[];
  problems?: unknown[];
  settings?: unknown;
  lists?: unknown[];
};

/** Write through the server's newer-wins function, the same path the extension syncs with. */
async function push(data: Push) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("sync_push", {
    p_attempts: data.attempts ?? [],
    p_problems: data.problems ?? [],
    p_settings: data.settings ?? null,
    p_lists: data.lists ?? [],
  });
  if (error) throw new Error(error.message);
}

async function currentSettings(): Promise<Settings> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("settings").select("data").maybeSingle();
  const parsed = settingsSchema.safeParse(data?.data);
  return parsed.success ? (parsed.data as Settings) : { ...DEFAULT_SETTINGS };
}

async function currentProblem(slug: string): Promise<Problem> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("user_problems")
    .select("data")
    .eq("slug", slug)
    .maybeSingle();
  const parsed = problemSchema.safeParse(data?.data);
  if (parsed.success) return parsed.data as Problem;
  const seed = SEED_BY_SLUG.get(slug);
  return {
    slug,
    frontendId: seed?.frontendId ?? "",
    title: seed?.title ?? slug,
    difficulty: seed?.difficulty ?? "Medium",
    url: `https://leetcode.com/problems/${slug}/`,
    leetcodeTopics: [],
    patterns: [],
    suggestedPatterns: seed?.suggestedPatterns ?? [],
    lists: seed?.lists ?? [],
    updatedAt: now(),
  };
}

async function currentLists(): Promise<CustomList[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("custom_lists").select("data");
  return ((data ?? []) as Array<{ data: CustomList }>).map((r) => r.data);
}

const fail = (err: unknown): ActionResult => ({
  ok: false,
  message: err instanceof Error ? err.message : String(err),
});

export async function signInWithGitHub(formData: FormData) {
  const supabase = await supabaseServer();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const next = String(formData.get("next") || "/dashboard");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url)
    redirect(`/?error=${encodeURIComponent(error?.message ?? "Sign-in failed")}`);
  redirect(data.url);
}

export async function signOut() {
  if (!DEMO) await (await supabaseServer()).auth.signOut();
  redirect("/");
}

export async function setStatusOverride(
  slug: string,
  override: Omit<StatusOverride, "at"> | null,
): Promise<ActionResult> {
  if (DEMO) return DEMO_RESULT;
  try {
    const problem = await currentProblem(slug);
    const next: Problem = { ...problem, updatedAt: now() };
    if (override) next.statusOverride = { ...override, at: now() };
    else delete next.statusOverride;
    await push({ problems: [next] });
    revalidatePath("/", "layout");
    return { ok: true, message: override ? "Status set." : "Manual status cleared." };
  } catch (err) {
    return fail(err);
  }
}

export async function updateSettings(
  patch: Partial<Omit<Settings, "updatedAt">>,
): Promise<ActionResult> {
  if (DEMO) return DEMO_RESULT;
  try {
    const next = settingsSchema.safeParse({
      ...(await currentSettings()),
      ...patch,
      updatedAt: now(),
    });
    if (!next.success) return { ok: false, message: "Some of those values are out of range." };
    await push({ settings: next.data });
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return fail(err);
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Add or change an interview date (spec 5.5). */
export async function saveTarget(input: {
  id?: string;
  label: string;
  date: string;
  listIds: string[];
}): Promise<ActionResult> {
  const label = input.label.trim();
  if (!label) return { ok: false, message: "Give the interview a name." };
  if (!DATE.test(input.date)) return { ok: false, message: "Pick a date." };
  if (DEMO) return DEMO_RESULT;
  try {
    const settings = await currentSettings();
    const targets = settings.targetDates ?? [];
    const existing = input.id ? targets.find((t) => t.id === input.id) : undefined;
    const target = {
      id: existing?.id ?? crypto.randomUUID(),
      label: label.slice(0, 80),
      date: input.date,
      listIds: input.listIds,
      createdAt: existing?.createdAt ?? now(),
    };
    const targetDates = existing
      ? targets.map((t) => (t.id === existing.id ? target : t))
      : [...targets, target];
    await push({ settings: { ...settings, targetDates, updatedAt: now() } });
    revalidatePath("/", "layout");
    return { ok: true, message: existing ? "Saved." : `Added “${target.label}”.` };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteTarget(id: string): Promise<ActionResult> {
  if (DEMO) return DEMO_RESULT;
  try {
    const settings = await currentSettings();
    const targetDates = (settings.targetDates ?? []).filter((t) => t.id !== id);
    await push({ settings: { ...settings, targetDates, updatedAt: now() } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Removed." };
  } catch (err) {
    return fail(err);
  }
}

export async function createList(name: string): Promise<ActionResult> {
  if (DEMO) return DEMO_RESULT;
  const clean = name.trim();
  if (!clean) return { ok: false, message: "Give the list a name." };
  try {
    await push({ lists: [{ id: crypto.randomUUID(), name: clean, slugs: [], updatedAt: now() }] });
    revalidatePath("/lists");
    return { ok: true, message: `Created “${clean}”.` };
  } catch (err) {
    return fail(err);
  }
}

async function changeList(
  id: string,
  change: (l: CustomList) => CustomList,
  message: string,
): Promise<ActionResult> {
  if (DEMO) return DEMO_RESULT;
  try {
    const list = (await currentLists()).find((l) => l.id === id && !l.deleted);
    if (!list) return { ok: false, message: "That list no longer exists." };
    await push({ lists: [{ ...change(list), updatedAt: now() }] });
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (err) {
    return fail(err);
  }
}

export async function addToList(id: string, ref: string): Promise<ActionResult> {
  const slug = parseProblemRef(ref);
  if (!slug)
    return { ok: false, message: "Paste a LeetCode problem URL or its slug, like two-sum." };
  return changeList(
    id,
    (l) => ({ ...l, slugs: l.slugs.includes(slug) ? l.slugs : [...l.slugs, slug] }),
    `Added ${SEED_BY_SLUG.get(slug)?.title ?? slug}.`,
  );
}

export async function removeFromList(id: string, slug: string): Promise<ActionResult> {
  return changeList(id, (l) => ({ ...l, slugs: l.slugs.filter((s) => s !== slug) }), "Removed.");
}

export async function deleteList(id: string): Promise<ActionResult> {
  return changeList(id, (l) => ({ ...l, deleted: true }), "List deleted.");
}

export async function importJson(json: string): Promise<ActionResult> {
  if (DEMO) return DEMO_RESULT;
  const parsed = parseExport(json);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  try {
    const { attempts, problems, settings, customLists } = parsed.data;
    // Batches keep each request a reasonable size.
    for (let i = 0; i < Math.max(attempts.length, problems.length, 1); i += 500) {
      await push({
        attempts: attempts.slice(i, i + 500),
        problems: problems.slice(i, i + 500),
        ...(i === 0 ? { settings, lists: customLists ?? [] } : {}),
      });
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Imported ${attempts.length} attempts and ${problems.length} problems. Anything older than what's here was skipped.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  if (DEMO) return DEMO_RESULT;
  if (confirmation.trim().toLowerCase() !== "delete") {
    return { ok: false, message: 'Type "delete" to confirm.' };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return fail(error);
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
