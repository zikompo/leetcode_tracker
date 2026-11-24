import type { SubmissionResult, SubmissionStarted } from "../page/events";

// Pure parsers for LeetCode's submit/check payloads.
// Shapes verified against leetcode.com's client bundle on 2026-11-14:
//   POST /problems/{slug}/submit/            body {lang, question_id, typed_code, ...} → {submission_id}
//   GET  /submissions/detail/{id}/check/     (also used by "Run", with ids like "runcode_…")
//   GET  /submissions/detail/{id}/v2/check/  newer variant, same result fields
// Result: {state: PENDING|STARTED|…|SUCCESS|FAILURE, status_code, status_msg, status_runtime ("3 ms"),
//          memory (bytes), status_memory ("17.5 MB"), runtime_percentile, memory_percentile, compare_result, lang}

const SUBMIT_RE = /^\/problems\/([a-z0-9-]+)\/submit\/?$/;
const CHECK_RE = /^\/submissions\/detail\/([^/]+)\/(?:v2\/)?check\/?$/;

export const STATUS_CODES: Record<number, string> = {
  10: "Accepted",
  11: "Wrong Answer",
  12: "Memory Limit Exceeded",
  13: "Output Limit Exceeded",
  14: "Time Limit Exceeded",
  15: "Runtime Error",
  16: "Internal Error",
  20: "Compile Error",
  30: "Timeout",
};

const IN_FLIGHT_STATES = new Set(["PENDING", "STARTED", "PREPARING", "COMPILING", "RUNNING_TESTS"]);

function pathOf(url: string): string | null {
  try {
    return new URL(url, "https://leetcode.com").pathname;
  } catch {
    return null;
  }
}

export function matchSubmitUrl(url: string): string | null {
  const path = pathOf(url);
  return path ? (SUBMIT_RE.exec(path)?.[1] ?? null) : null;
}

export function matchCheckUrl(url: string): string | null {
  const path = pathOf(url);
  return path ? (CHECK_RE.exec(path)?.[1] ?? null) : null;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

export function parseSubmitRequestBody(body: unknown): { lang?: string; code?: string } {
  let obj: unknown = body;
  if (typeof body === "string") {
    try {
      obj = JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (!isObj(obj)) return {};
  return {
    lang: str(obj.lang),
    code: typeof obj.typed_code === "string" ? obj.typed_code : undefined,
  };
}

export function parseSubmitResponse(
  slug: string,
  response: unknown,
  request: { lang?: string; code?: string },
  at: string,
): SubmissionStarted | null {
  if (!isObj(response)) return null;
  const id = response.submission_id;
  if (typeof id !== "number" && typeof id !== "string") return null;
  return { type: "submission-started", slug, submissionId: String(id), at, ...request };
}

/** Megabytes from `memory` (bytes) or `status_memory` ("17.5 MB"). */
function memoryMb(r: Json): number | undefined {
  const bytes = num(r.memory);
  if (bytes !== undefined && bytes > 10_000) return Math.round((bytes / 1_000_000) * 100) / 100;
  const s = str(r.status_memory);
  return s ? num(s) : undefined;
}

/**
 * Parse a check-poll response. Returns null while judging is still in progress or the
 * payload is not a final result.
 */
export function parseCheckResponse(
  submissionId: string,
  response: unknown,
  at: string,
): SubmissionResult | null {
  if (!isObj(response)) return null;
  const state = str(response.state);
  if (!state || IN_FLIGHT_STATES.has(state)) return null;
  if (state === "FAILURE" || state === "REVOKED") {
    return {
      type: "submission-result",
      submissionId,
      at,
      status: "Internal Error",
      accepted: false,
      source: "network",
    };
  }
  if (state !== "SUCCESS") return null;

  let code = num(response.status_code);
  const compare = str(response.compare_result) ?? "";
  // Mirrors LeetCode's own client: "Accepted" with a failing testcase bit is really WA.
  if (code === 10 && compare.includes("0")) code = 11;
  const status =
    (code !== undefined ? STATUS_CODES[code] : undefined) ?? str(response.status_msg) ?? "Unknown";
  const accepted = status === "Accepted";

  const result: SubmissionResult = {
    type: "submission-result",
    submissionId,
    at,
    status,
    accepted,
    source: "network",
  };
  const lang = str(response.lang) ?? str(response.pretty_lang);
  if (lang) result.lang = lang;
  if (accepted) {
    const runtimeMs = num(response.status_runtime);
    const mem = memoryMb(response);
    const rp = num(response.runtime_percentile);
    const mp = num(response.memory_percentile);
    if (runtimeMs !== undefined) result.runtimeMs = runtimeMs;
    if (mem !== undefined) result.memoryMb = mem;
    if (rp !== undefined) result.runtimePercentile = Math.round(rp * 100) / 100;
    if (mp !== undefined) result.memoryPercentile = Math.round(mp * 100) / 100;
  }
  return result;
}

/** Known result banner texts, used by the DOM fallback. */
export const RESULT_TEXTS = [...Object.values(STATUS_CODES)];
