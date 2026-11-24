import type { SubmissionResult } from "../page/events";

// Pure parsers for neetcode.io's Submit. Read from neetcode.io's client bundle on 2026-11-21:
//   POST /api/executeCodeFunctionHttp   body {data: {problemId, rawCode, lang}}
//   → {data: {status: {description: "Accepted" | ...}, time, memory, stdout, stderr, date, ...}}
// "Run" goes to /api/runCodeFunctionHttp instead, so it's never mistaken for a submission.
// The units of `time` and `memory` aren't visible in the bundle: `time` looks like Judge0's
// seconds ("0.051"), and `memory` like its kilobytes. Check them against a real submission.

const SUBMIT_PATH = "/api/executeCodeFunctionHttp";

export function isSubmitUrl(url: string): boolean {
  try {
    return new URL(url, "https://neetcode.io").pathname === SUBMIT_PATH;
  } catch {
    return false;
  }
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

/** Callable functions wrap their payload in `data` (or `result`, Firebase's own name for it). */
const unwrap = (v: unknown): Json | undefined => {
  if (!isObj(v)) return undefined;
  const inner = v.data ?? v.result;
  return isObj(inner) ? inner : undefined;
};

export interface NeetcodeSubmitRequest {
  neetcodeSlug: string;
  code?: string;
  lang?: string;
}

export function parseSubmitRequest(body: unknown): NeetcodeSubmitRequest | null {
  let obj: unknown = body;
  if (typeof body === "string") {
    try {
      obj = JSON.parse(body);
    } catch {
      return null;
    }
  }
  const data = unwrap(obj);
  const neetcodeSlug = str(data?.problemId);
  if (!data || !neetcodeSlug) return null;
  return {
    neetcodeSlug,
    ...(typeof data.rawCode === "string" ? { code: data.rawCode } : {}),
    ...(str(data.lang) ? { lang: str(data.lang) } : {}),
  };
}

/** Milliseconds from "0.051" (seconds) or "51 ms". */
function runtimeMs(v: unknown): number | undefined {
  const n = num(v);
  if (n === undefined) return undefined;
  if (typeof v === "string" && /ms\s*$/i.test(v)) return n;
  return Math.round(n * 1000);
}

/** Megabytes from kilobytes (a number) or "17.5 MB". */
function memoryMb(v: unknown): number | undefined {
  const n = num(v);
  if (n === undefined || n <= 0) return undefined;
  if (typeof v === "string" && /mb\s*$/i.test(v)) return n;
  return Math.round((n / 1024) * 100) / 100;
}

/** The verdict of a Submit, or null when the response isn't one (an error, a sign-in prompt). */
export function parseSubmitResponse(
  response: unknown,
  at: string,
): Omit<SubmissionResult, "slug" | "submissionId"> | null {
  const data = unwrap(response);
  const status = isObj(data?.status) ? data.status : undefined;
  const description = str(status?.description)?.trim();
  if (!data || !description) return null;
  // Judge0's id for Accepted is 3.
  const accepted = description.toLowerCase() === "accepted" || num(status?.id) === 3;
  const result: Omit<SubmissionResult, "slug" | "submissionId"> = {
    type: "submission-result",
    at,
    status: accepted ? "Accepted" : description,
    accepted,
    source: "network",
  };
  if (accepted) {
    const ms = runtimeMs(data.time);
    const mb = memoryMb(data.memory);
    if (ms !== undefined) result.runtimeMs = ms;
    if (mb !== undefined) result.memoryMb = mb;
  }
  return result;
}
