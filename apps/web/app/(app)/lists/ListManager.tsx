"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ProblemStatus } from "@leettrack/core";
import type { ListProgress } from "@leettrack/insights";
import { X } from "lucide-react";
import { Button } from "@leettrack/ui/components/button";
import { Input } from "@leettrack/ui/components/input";
import { Notice } from "@leettrack/ui/components/panel";
import { Switch } from "@leettrack/ui/components/switch";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatusLabel } from "@/components/StatusLabel";
import {
  addToList,
  createList,
  deleteList,
  removeFromList,
  updateSettings,
  type ActionResult,
} from "@/lib/actions";

export interface ListView extends ListProgress {
  items: Array<{ slug: string; title: string; status: ProblemStatus; statusLabel: string }>;
}

const SEGMENTS: ProblemStatus[] = ["mastered", "fully_solved", "solved_with_help", "in_progress"];
const SEGMENT_COLOR: Record<ProblemStatus, string> = {
  mastered: "bg-primary",
  fully_solved: "bg-ok",
  solved_with_help: "bg-medium",
  in_progress: "bg-muted-foreground",
  unseen: "bg-muted",
};
const LABEL: Record<ProblemStatus, string> = {
  mastered: "Mastered",
  fully_solved: "Fully solved",
  solved_with_help: "With help",
  in_progress: "In progress",
  unseen: "Unseen",
};

export function ListManager({ lists, activeLists }: { lists: ListView[]; activeLists: string[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) after?.();
    });
  const toggle = (id: string, on: boolean) =>
    run(() =>
      updateSettings({
        // Keep display order, which is also queue priority.
        activeLists: lists
          .map((l) => l.id)
          .filter((l) => (l === id ? on : activeLists.includes(l))),
      }),
    );

  return (
    <div className="flex flex-col gap-4">
      {result && <Notice ok={result.ok}>{result.message}</Notice>}
      <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((l) => {
          const started = l.total - l.byStatus.unseen;
          const switchId = `active-${l.id}`;
          return (
            <section
              key={l.id}
              className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              aria-label={l.name}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{l.name}</h3>
                <label
                  htmlFor={switchId}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  Active
                  <Switch
                    id={switchId}
                    checked={l.active}
                    disabled={pending}
                    onCheckedChange={(on) => toggle(l.id, on)}
                  />
                </label>
              </div>
              <span className="text-xs text-muted-foreground">
                {started} of {l.total} started · {l.byStatus.fully_solved + l.byStatus.mastered}{" "}
                fully solved
              </span>
              <div
                className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${l.name} progress: ${SEGMENTS.map((s) => `${LABEL[s]} ${l.byStatus[s]}`).join(", ")}`}
              >
                {SEGMENTS.map((s) =>
                  l.total && l.byStatus[s] ? (
                    <span
                      key={s}
                      className={SEGMENT_COLOR[s]}
                      style={{ width: `${(l.byStatus[s] / l.total) * 100}%` }}
                      title={`${LABEL[s]}: ${l.byStatus[s]}`}
                    />
                  ) : null,
                )}
              </div>
              <ul
                className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
                aria-hidden
              >
                {SEGMENTS.filter((s) => l.byStatus[s] > 0).map((s) => (
                  <li key={s} className="flex items-center gap-1">
                    <span className={`size-2 rounded-full ${SEGMENT_COLOR[s]}`} />
                    {LABEL[s]} {l.byStatus[s]}
                  </li>
                ))}
              </ul>
              {l.kind === "custom" && (
                <>
                  {l.items.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {l.items.map((p) => (
                        <li key={p.slug} className="flex items-center justify-between gap-2">
                          <Link
                            href={`/problems/${p.slug}`}
                            className="min-w-0 truncate text-foreground"
                          >
                            {p.title}
                          </Link>
                          <span className="flex items-center gap-1">
                            <StatusLabel status={p.status} label={p.statusLabel} />
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={pending}
                              aria-label={`Remove ${p.title}`}
                              onClick={() => run(() => removeFromList(l.id, p.slug))}
                            >
                              <X />
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        () => addToList(l.id, adding[l.id] ?? ""),
                        () => setAdding((a) => ({ ...a, [l.id]: "" })),
                      );
                    }}
                  >
                    <Input
                      placeholder="LeetCode URL or slug"
                      value={adding[l.id] ?? ""}
                      onChange={(e) => setAdding((a) => ({ ...a, [l.id]: e.target.value }))}
                      aria-label={`Add a problem to ${l.name}`}
                    />
                    <Button variant="secondary" type="submit" disabled={pending}>
                      Add
                    </Button>
                  </form>
                  <div>
                    <ConfirmButton
                      variant="destructive"
                      disabled={pending}
                      title={`Delete “${l.name}”?`}
                      description="The list goes; your attempts on its problems stay."
                      confirm="Delete list"
                      onConfirm={() => run(() => deleteList(l.id))}
                    >
                      Delete list
                    </ConfirmButton>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
      <form
        className="flex flex-wrap gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createList(newName),
            () => setNewName(""),
          );
        }}
      >
        <Input
          className="min-w-0 flex-1"
          placeholder="New list name, e.g. Graphs to revisit"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="New list name"
        />
        <Button type="submit" disabled={pending}>
          Create list
        </Button>
      </form>
    </div>
  );
}
