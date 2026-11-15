import { RATING_LABELS, formatDuration, solveSeconds, type Attempt } from "@leettrack/core";

/** File extension per LeetCode language id (spec open question 3: all of them). */
const EXTENSIONS: Record<string, string> = {
  python: "py",
  python3: "py",
  pythondata: "py",
  cpp: "cpp",
  c: "c",
  java: "java",
  csharp: "cs",
  javascript: "js",
  typescript: "ts",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  dart: "dart",
  golang: "go",
  go: "go",
  ruby: "rb",
  scala: "scala",
  rust: "rs",
  racket: "rkt",
  erlang: "erl",
  elixir: "ex",
  mysql: "sql",
  mssql: "sql",
  oraclesql: "sql",
  postgresql: "sql",
  bash: "sh",
};

export const extensionFor = (language: string | undefined) =>
  EXTENSIONS[(language ?? "").toLowerCase()] ?? "txt";

/** What the renderer needs to know about a problem. */
export interface RepoProblem {
  slug: string;
  frontendId?: string;
  title: string;
  difficulty?: string;
  patterns: string[];
}

/** Spec 8.2 commits Accepted attempts that have code. */
export const shouldCommit = (a: Attempt) =>
  !!a.code?.trim() && a.submissions.some((s) => s.status === "Accepted");

/** "problems/0001-two-sum" */
export function problemDir(p: Pick<RepoProblem, "slug" | "frontendId">): string {
  const id = p.frontendId && /^\d+$/.test(p.frontendId) ? `${p.frontendId.padStart(4, "0")}-` : "";
  return `problems/${id}${p.slug}`;
}

const day = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const OUTCOME: Record<Attempt["outcome"], string> = {
  solved_independently: "solved independently",
  solved_with_help: "solved with help",
  not_solved: "not solved",
};
const HELP: Record<Attempt["helpLevel"], string> = {
  none: "",
  hint: "hint",
  approach: "key idea",
  partial_code: "partial code",
  full_solution: "full solution",
};

const outcomeText = (a: Attempt) =>
  `${OUTCOME[a.outcome]}${a.helpLevel !== "none" ? ` (${HELP[a.helpLevel]})` : ""}`;

/** Attempts in the order they happened, numbered from 1. */
export function numbered(attempts: readonly Attempt[]): Array<{ n: number; attempt: Attempt }> {
  return [...attempts]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((attempt, i) => ({ n: i + 1, attempt }));
}

/** ", optimal" for solved attempts that know it; nothing otherwise. */
const optimalityText = (a: Attempt) =>
  a.outcome !== "not_solved" && a.optimality && a.optimality !== "unsure"
    ? `, ${a.optimality}`
    : "";

/** `0001-two-sum: attempt 2, solved independently, optimal (14 min)` (spec 8.2). */
export function commitMessage(p: RepoProblem, a: Attempt, n: number): string {
  const name = problemDir(p).slice("problems/".length);
  const minutes = Math.max(1, Math.round(solveSeconds(a) / 60));
  return `${name}: attempt ${n}, ${outcomeText(a)}${optimalityText(a)} (${minutes} min)`;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The problem's README: link, facts, an attempts table and (optionally) notes. No statement. */
export function renderReadme(
  p: RepoProblem,
  attempts: readonly Attempt[],
  opts: { includeNotes: boolean; patternName(id: string): string },
): string {
  const title = `${p.frontendId ? `${p.frontendId}. ` : ""}${p.title}`;
  const facts = [
    `[LeetCode](https://leetcode.com/problems/${p.slug}/)`,
    p.difficulty,
    p.patterns.length ? `Patterns: ${p.patterns.map(opts.patternName).join(", ")}` : undefined,
  ].filter(Boolean);
  const rows = numbered(attempts).map(({ n, attempt: a }) =>
    [
      String(n),
      day(a.endedAt),
      cell(`${outcomeText(a)}${optimalityText(a)}`),
      formatDuration(solveSeconds(a)),
      RATING_LABELS[a.rating],
      cell(a.complexityAchieved ?? ""),
      a.kind === "quick" ? "quick review" : (a.language ?? ""),
    ].join(" | "),
  );
  const out = [
    `# ${title}`,
    "",
    facts.join(" · "),
    "",
    "| # | Date | Outcome | Time | Rating | Complexity | Language |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r} |`),
  ];
  if (opts.includeNotes) {
    const notes = numbered(attempts).filter(
      ({ attempt: a }) => a.notes || a.patternClue || a.stuckNote,
    );
    if (notes.length) {
      out.push("", "## Notes");
      for (const { n, attempt: a } of notes) {
        out.push("", `### Attempt ${n} · ${day(a.endedAt)}`);
        if (a.patternClue) out.push("", `**Clue:** ${a.patternClue}`);
        if (a.stuckNote) out.push("", `**Stuck on:** ${a.stuckNote}`);
        if (a.notes) out.push("", a.notes);
      }
    }
  }
  out.push("", "<sub>Logged with LeetTrack.</sub>", "");
  return out.join("\n");
}

export interface RepoFile {
  path: string;
  content: string;
}

/**
 * Everything one attempt's commit writes (spec 8.2): the regenerated README, the latest
 * Accepted solution, and this attempt's own code.
 */
export function filesForAttempt(input: {
  problem: RepoProblem;
  attempts: readonly Attempt[];
  attempt: Attempt;
  includeNotes: boolean;
  patternName(id: string): string;
}): { message: string; files: RepoFile[] } {
  const dir = problemDir(input.problem);
  const all = numbered(input.attempts);
  const n = all.find((x) => x.attempt.id === input.attempt.id)?.n ?? all.length + 1;
  const files: RepoFile[] = [
    { path: `${dir}/README.md`, content: renderReadme(input.problem, input.attempts, input) },
  ];
  const latest = all
    .map((x) => x.attempt)
    .filter(shouldCommit)
    .at(-1);
  if (latest) {
    files.push({ path: `${dir}/solution.${extensionFor(latest.language)}`, content: latest.code! });
  }
  if (input.attempt.code) {
    files.push({
      path: `${dir}/attempts/${day(input.attempt.endedAt)}-attempt-${n}.${extensionFor(input.attempt.language)}`,
      content: input.attempt.code,
    });
  }
  return { message: commitMessage(input.problem, input.attempt, n), files };
}
