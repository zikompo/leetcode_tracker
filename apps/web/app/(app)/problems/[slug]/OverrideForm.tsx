"use client";

import { useState, useTransition } from "react";
import type { Optimality, ProblemStatus } from "@leettrack/core";
import { Button } from "@leettrack/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@leettrack/ui/components/native-select";
import { Notice } from "@leettrack/ui/components/panel";
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value as ProblemStatus)}
          aria-label="Manual status"
        >
          {OPTIONS.map(([v, l]) => (
            <NativeSelectOption key={v} value={v}>
              {l}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {status === "fully_solved" && (
          <NativeSelect
            value={optimality}
            onChange={(e) => setOptimality(e.target.value as Optimality)}
            aria-label="Optimality"
          >
            <NativeSelectOption value="optimal">Optimal</NativeSelectOption>
            <NativeSelectOption value="suboptimal">Suboptimal</NativeSelectOption>
          </NativeSelect>
        )}
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run({ status, ...(status === "fully_solved" ? { optimality } : {}) })}
        >
          Set
        </Button>
        {current && (
          <Button variant="ghost" disabled={pending} onClick={() => run(null)}>
            Clear
          </Button>
        )}
      </div>
      {result && <Notice ok={result.ok}>{result.message}</Notice>}
    </div>
  );
}
