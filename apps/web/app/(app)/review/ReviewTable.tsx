"use client";

import { Term } from "@leettrack/ui/components/term";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { ReviewRow } from "@leettrack/insights";
import { Badge } from "@leettrack/ui/components/badge";
import { Button } from "@leettrack/ui/components/button";
import { Checkbox } from "@leettrack/ui/components/checkbox";
import { Input } from "@leettrack/ui/components/input";
import { Difficulty, Notice } from "@leettrack/ui/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@leettrack/ui/components/table";
import { scheduleReviews, type ActionResult } from "@/lib/actions";
import { pct } from "@/lib/util";

type Row = ReviewRow & { dueLabel: string };

/** Local midnight `days` from today, as the user's browser sees it. */
const inDays = (days: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).toISOString();
};
const onDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toISOString();
};

export function ReviewTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const all = rows.length > 0 && selected.size === rows.length;
  const some = selected.size > 0 && !all;
  const slugs = useMemo(() => [...selected], [selected]);
  const run = (due: string | null) =>
    start(async () => {
      const r = await scheduleReviews(slugs, due);
      setResult(r);
      if (r.ok) setSelected(new Set());
    });
  const toggle = (slug: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-muted-foreground">Nothing due in the next two weeks.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
        role="toolbar"
        aria-label="Change selected reviews"
      >
        <span className="text-xs text-muted-foreground">
          {selected.size ? `${selected.size} selected` : "Select reviews to move them"}
        </span>
        <span className="text-xs text-muted-foreground">Snooze</span>
        {[1, 3, 7].map((d) => (
          <Button
            key={d}
            size="sm"
            variant="secondary"
            disabled={!selected.size || pending}
            onClick={() => run(inDays(d))}
          >
            {d === 1 ? "1 day" : `${d} days`}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">or move to</span>
        <Input
          type="date"
          className="h-7 w-36"
          aria-label="New due date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={!selected.size || !date || pending}
          onClick={() => run(onDate(date))}
        >
          Move
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!selected.size || pending}
          onClick={() => run(null)}
        >
          Back to schedule
        </Button>
      </div>
      {result && <Notice ok={result.ok}>{result.message}</Notice>}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all reviews"
                  checked={all ? true : some ? "indeterminate" : false}
                  onCheckedChange={(on) =>
                    setSelected(on === true ? new Set(rows.map((r) => r.slug)) : new Set())
                  }
                />
              </TableHead>
              <TableHead className="font-medium text-muted-foreground">Problem</TableHead>
              <TableHead className="font-medium text-muted-foreground">Due</TableHead>
              <TableHead className="hidden font-medium text-muted-foreground md:table-cell">
                <Term k="recall">Recall now</Term>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.slug}
                data-state={selected.has(r.slug) ? "selected" : undefined}
                className="even:bg-muted/30"
              >
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${r.title}`}
                    checked={selected.has(r.slug)}
                    onCheckedChange={(on) => toggle(r.slug, on === true)}
                  />
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={`/problems/${r.slug}`} className="text-foreground">
                      {r.frontendId ? `${r.frontendId}. ` : ""}
                      {r.title}
                    </Link>
                    {r.difficulty && <Difficulty value={r.difficulty} />}
                    {r.isLeech && (
                      <Badge variant="destructive">
                        <Term k="leech">leech</Term>
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={r.isDue ? "font-medium text-foreground" : "text-muted-foreground"}
                    >
                      {r.dueLabel}
                    </span>
                    {r.manual && (
                      <Badge variant="outline">
                        <Term k="moved">moved</Term>
                      </Badge>
                    )}
                    {r.forTarget && (
                      <Badge className="bg-warn/15 text-warn">before {r.forTarget}</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
                  {pct(r.retrievability)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
