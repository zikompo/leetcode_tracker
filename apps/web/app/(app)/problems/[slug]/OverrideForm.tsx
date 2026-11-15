"use client";

import { useState, useTransition } from "react";
import type { Optimality, ProblemStatus } from "@leettrack/core";
import { setStatusOverride, type ActionResult } from "@/lib/actions";

const OPTIONS: Array<[ProblemStatus, string]> = [
  ["unseen", "Unseen"],
  ["in_progress", "In progress"],
  ["solved_with_help", "Solved with help"],
  ["fully_solved", "Fully solved"],
];

/** Manual status, e.g. for problems solved before using LeetTrack (spec 4.5). */
export function OverrideForm({
  slug,
  current,
}: {
  slug: string;
  current?: { status: ProblemStatus; optimality?: Optimality };
}) {
  const [status, setStatus] = useState<ProblemStatus>(current?.status ?? "fully_solved");
  const [optimality, setOptimality] = useState<Optimality>(current?.optimality ?? "optimal");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (o: Parameters<typeof setStatusOverride>[1]) =>
    start(async () => setResult(await setStatusOverride(slug, o)));

  return (
    <div className="stack">
      <div className="row">
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProblemStatus)}
          aria-label="Manual status"
        >
          {OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {status === "fully_solved" && (
          <select
            className="input"
            value={optimality}
            onChange={(e) => setOptimality(e.target.value as Optimality)}
            aria-label="Optimality"
          >
            <option value="optimal">Optimal</option>
            <option value="suboptimal">Suboptimal</option>
          </select>
        )}
        <button
          className="btn"
          disabled={pending}
          onClick={() => run({ status, ...(status === "fully_solved" ? { optimality } : {}) })}
        >
          Set
        </button>
        {current && (
          <button className="btn" disabled={pending} onClick={() => run(null)}>
            Clear
          </button>
        )}
      </div>
      {result && <p className={result.ok ? "ok small" : "bad small"}>{result.message}</p>}
    </div>
  );
}
