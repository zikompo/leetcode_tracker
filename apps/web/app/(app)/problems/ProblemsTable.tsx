"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Difficulty, ProblemStatus } from "@leettrack/core";

export interface Row {
  slug: string;
  title: string;
  number: number | null;
  difficulty: Difficulty | null;
  status: ProblemStatus;
  statusLabel: string;
  patterns: Array<{ id: string; name: string }>;
  lists: Array<{ id: string; name: string }>;
  attempts: number;
  lastAttempted: string | null;
  lastAttemptedLabel: string;
  nextDue: string | null;
  nextDueLabel: string;
  best: string;
  isLeech: boolean;
}

type SortKey =
  "number" | "title" | "difficulty" | "status" | "attempts" | "lastAttempted" | "nextDue";
const DIFF_ORDER: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };
const STATUS_ORDER: Record<ProblemStatus, number> = {
  unseen: 0,
  in_progress: 1,
  solved_with_help: 2,
  fully_solved: 3,
  mastered: 4,
};

function compare(a: Row, b: Row, key: SortKey): number {
  const nil = (x: unknown) => x === null || x === "";
  const pick = (r: Row) =>
    key === "difficulty"
      ? r.difficulty && DIFF_ORDER[r.difficulty]
      : key === "status"
        ? STATUS_ORDER[r.status]
        : r[key];
  const x = pick(a);
  const y = pick(b);
  if (nil(x) && nil(y)) return 0;
  if (nil(x)) return 1; // empty values last, whichever way
  if (nil(y)) return -1;
  return typeof x === "string" ? x.localeCompare(String(y)) : Number(x) - Number(y);
}

export function ProblemsTable({
  rows,
  initialPattern = "",
}: {
  rows: Row[];
  initialPattern?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [pattern, setPattern] = useState(initialPattern);
  const [list, setList] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "lastAttempted",
    dir: -1,
  });

  const patterns = useMemo(
    () =>
      [...new Map(rows.flatMap((r) => r.patterns).map((p) => [p.id, p])).values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [rows],
  );
  const lists = useMemo(
    () => [...new Map(rows.flatMap((r) => r.lists).map((l) => [l.id, l])).values()],
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (!q || r.title.toLowerCase().includes(q) || String(r.number ?? "") === q) &&
          (!status || r.status === status) &&
          (!difficulty || r.difficulty === difficulty) &&
          (!pattern || r.patterns.some((p) => p.id === pattern)) &&
          (!list || r.lists.some((l) => l.id === list)),
      )
      .sort((a, b) => {
        const c = compare(a, b, sort.key);
        return c === 0
          ? a.title.localeCompare(b.title)
          : a[sort.key] === null || b[sort.key] === null
            ? c
            : c * sort.dir;
      });
  }, [rows, query, status, difficulty, pattern, list, sort]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th
      className={className}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="stack">
      <div className="row" role="search">
        <input
          className="input"
          placeholder="Search title or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search problems"
        />
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="">Any status</option>
          {(Object.keys(STATUS_ORDER) as ProblemStatus[]).map((s) => (
            <option key={s} value={s}>
              {rows.find((r) => r.status === s)?.statusLabel ?? s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          aria-label="Difficulty"
        >
          <option value="">Any difficulty</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <select
          className="input"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          aria-label="Pattern"
        >
          <option value="">Any pattern</option>
          {patterns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={list}
          onChange={(e) => setList(e.target.value)}
          aria-label="List"
        >
          <option value="">Any list</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <span className="muted small">{shown.length} problems</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {header("number", "#", "hide-sm")}
              {header("title", "Problem")}
              {header("difficulty", "Difficulty")}
              {header("status", "Status")}
              <th className="hide-sm">Patterns</th>
              {header("lastAttempted", "Last attempted", "hide-sm")}
              {header("nextDue", "Next review")}
              {header("attempts", "Attempts", "hide-sm")}
              <th className="hide-sm">Best</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.slug}>
                <td className="hide-sm muted">{r.number ?? ""}</td>
                <td className="wrap">
                  <Link href={`/problems/${r.slug}`}>{r.title}</Link>
                  {r.isLeech && (
                    <span className="pill pill-bad" style={{ marginLeft: 6 }}>
                      leech
                    </span>
                  )}
                </td>
                <td className={r.difficulty ? `diff-${r.difficulty}` : ""}>{r.difficulty ?? ""}</td>
                <td>
                  <span className={`status status-${r.status}`}>{r.statusLabel}</span>
                </td>
                <td className="hide-sm wrap small">{r.patterns.map((p) => p.name).join(", ")}</td>
                <td className="hide-sm">{r.lastAttemptedLabel}</td>
                <td>{r.nextDueLabel}</td>
                <td className="hide-sm">{r.attempts || ""}</td>
                <td className="hide-sm">{r.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
