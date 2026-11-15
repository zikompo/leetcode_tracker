"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ProblemStatus } from "@leettrack/core";
import type { ListProgress } from "@leettrack/insights";
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
    <div className="stack">
      {result && (
        <p className={result.ok ? "ok small" : "bad small"} role="status">
          {result.message}
        </p>
      )}
      <div className="grid">
        {lists.map((l) => {
          const started = l.total - l.byStatus.unseen;
          return (
            <section key={l.id} className="card stack" aria-label={l.name}>
              <div className="row spread">
                <h3>{l.name}</h3>
                <label className="check small">
                  <input
                    type="checkbox"
                    checked={l.active}
                    disabled={pending}
                    onChange={(e) => toggle(l.id, e.target.checked)}
                  />
                  Active
                </label>
              </div>
              <span className="muted small">
                {started} of {l.total} started · {l.byStatus.fully_solved + l.byStatus.mastered}{" "}
                fully solved
              </span>
              <div className="bar" aria-label={`${l.name} progress`}>
                {SEGMENTS.map((s) =>
                  l.total ? (
                    <span
                      key={s}
                      className={`seg-${s}`}
                      style={{ width: `${(l.byStatus[s] / l.total) * 100}%` }}
                      title={`${LABEL[s]}: ${l.byStatus[s]}`}
                    />
                  ) : null,
                )}
              </div>
              {l.kind === "custom" && (
                <>
                  {l.items.length > 0 && (
                    <ul className="list">
                      {l.items.map((p) => (
                        <li key={p.slug}>
                          <Link href={`/problems/${p.slug}`}>{p.title}</Link>
                          <span className="row">
                            <span className={`status status-${p.status}`}>{p.statusLabel}</span>
                            <button
                              className="btn small"
                              disabled={pending}
                              aria-label={`Remove ${p.title}`}
                              onClick={() => run(() => removeFromList(l.id, p.slug))}
                            >
                              ×
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        () => addToList(l.id, adding[l.id] ?? ""),
                        () => setAdding((a) => ({ ...a, [l.id]: "" })),
                      );
                    }}
                  >
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="LeetCode URL or slug"
                      value={adding[l.id] ?? ""}
                      onChange={(e) => setAdding((a) => ({ ...a, [l.id]: e.target.value }))}
                      aria-label={`Add a problem to ${l.name}`}
                    />
                    <button className="btn" type="submit" disabled={pending}>
                      Add
                    </button>
                  </form>
                  <button
                    className="btn btn-danger small"
                    style={{ alignSelf: "flex-start" }}
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Delete the list “${l.name}”? Your attempts stay.`))
                        run(() => deleteList(l.id));
                    }}
                  >
                    Delete list
                  </button>
                </>
              )}
            </section>
          );
        })}
      </div>
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createList(newName),
            () => setNewName(""),
          );
        }}
      >
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="New list name, e.g. Graphs to revisit"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="New list name"
        />
        <button className="btn btn-primary" type="submit" disabled={pending}>
          Create list
        </button>
      </form>
    </div>
  );
}
