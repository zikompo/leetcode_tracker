"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { Difficulty, ProblemStatus } from "@leettrack/core";
import { Badge } from "@leettrack/ui/components/badge";
import { Input } from "@leettrack/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@leettrack/ui/components/native-select";
import { Difficulty as DifficultyLabel } from "@leettrack/ui/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@leettrack/ui/components/table";
import { StatusLabel } from "@/components/StatusLabel";

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
    <TableHead
      className={className}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
      >
        {label}
        {sort.key === key ? (
          sort.dir === 1 ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Search title or number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search problems"
          />
        </div>
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
        >
          <NativeSelectOption value="">Any status</NativeSelectOption>
          {(Object.keys(STATUS_ORDER) as ProblemStatus[]).map((s) => (
            <NativeSelectOption key={s} value={s}>
              {rows.find((r) => r.status === s)?.statusLabel ?? s.replace(/_/g, " ")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          aria-label="Difficulty"
        >
          <NativeSelectOption value="">Any difficulty</NativeSelectOption>
          <NativeSelectOption>Easy</NativeSelectOption>
          <NativeSelectOption>Medium</NativeSelectOption>
          <NativeSelectOption>Hard</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          aria-label="Pattern"
        >
          <NativeSelectOption value="">Any pattern</NativeSelectOption>
          {patterns.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect value={list} onChange={(e) => setList(e.target.value)} aria-label="List">
          <NativeSelectOption value="">Any list</NativeSelectOption>
          {lists.map((l) => (
            <NativeSelectOption key={l.id} value={l.id}>
              {l.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">{shown.length} problems</span>
      </div>
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {header("number", "#", "hidden w-12 md:table-cell")}
              {header("title", "Problem")}
              {header("difficulty", "Difficulty")}
              {header("status", "Status")}
              <TableHead className="hidden font-medium text-muted-foreground lg:table-cell">
                Patterns
              </TableHead>
              {header("lastAttempted", "Last attempted", "hidden md:table-cell")}
              {header("nextDue", "Next review")}
              {header("attempts", "Attempts", "hidden md:table-cell")}
              <TableHead className="hidden font-medium text-muted-foreground lg:table-cell">
                Best
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.slug} className="even:bg-muted/30">
                <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                  {r.number ?? ""}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  <Link href={`/problems/${r.slug}`} className="text-foreground">
                    {r.title}
                  </Link>
                  {r.isLeech && (
                    <Badge variant="destructive" className="ml-1.5">
                      leech
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{r.difficulty && <DifficultyLabel value={r.difficulty} />}</TableCell>
                <TableCell>
                  <StatusLabel status={r.status} label={r.statusLabel} />
                </TableCell>
                <TableCell className="hidden max-w-56 text-xs whitespace-normal text-muted-foreground lg:table-cell">
                  {r.patterns.map((p) => p.name).join(", ")}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {r.lastAttemptedLabel}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.nextDueLabel}</TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">
                  {r.attempts || ""}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {r.best}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
