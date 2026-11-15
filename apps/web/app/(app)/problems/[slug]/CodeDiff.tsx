"use client";

import { diffLines } from "diff";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@leettrack/ui/components/native-select";

export interface CodeVersion {
  id: string;
  label: string;
  code: string;
}

/** Line diff between any two attempts' code (spec 7.1). */
export function CodeDiff({ versions }: { versions: CodeVersion[] }) {
  // First attempt to latest by default: how the solution evolved.
  const [from, setFrom] = useState(versions[0]?.id ?? "");
  const [to, setTo] = useState(versions.at(-1)?.id ?? "");
  const a = versions.find((v) => v.id === from);
  const b = versions.find((v) => v.id === to);
  const parts = useMemo(() => (a && b ? diffLines(a.code, b.code) : []), [a, b]);
  const changed = parts.filter((p) => p.added || p.removed).reduce((n, p) => n + (p.count ?? 0), 0);

  const picker = (value: string, set: (v: string) => void, label: string) => (
    <NativeSelect value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      {versions.map((v) => (
        <NativeSelectOption key={v.id} value={v.id}>
          {v.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {picker(from, setFrom, "Compare from")}
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        {picker(to, setTo, "Compare to")}
        <span className="text-xs text-muted-foreground">
          {a === b ? "Same attempt" : `${changed} lines changed`}
        </span>
      </div>
      <pre
        className="overflow-x-auto rounded-lg bg-muted py-3 text-xs leading-relaxed"
        aria-label="Code diff"
      >
        {parts.map((p, i) => {
          const lines = p.value.replace(/\n$/, "").split("\n");
          const mark = p.added ? "+ " : p.removed ? "- " : "  ";
          return (
            <span
              key={i}
              data-change={p.added ? "add" : p.removed ? "del" : undefined}
              className={
                p.added
                  ? "block bg-ok/15 px-3 text-ok"
                  : p.removed
                    ? "block bg-bad/15 px-3 text-bad"
                    : "block px-3"
              }
            >
              {lines.map((l) => `${mark}${l}`).join("\n")}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
