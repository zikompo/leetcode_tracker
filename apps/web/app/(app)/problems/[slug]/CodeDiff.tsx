"use client";

import { diffLines } from "diff";
import { useMemo, useState } from "react";

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
    <select
      className="input"
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-label={label}
    >
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          {v.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="stack">
      <div className="row">
        {picker(from, setFrom, "Compare from")}
        <span className="muted">→</span>
        {picker(to, setTo, "Compare to")}
        <span className="muted small">{a === b ? "Same attempt" : `${changed} lines changed`}</span>
      </div>
      <pre className="diff" aria-label="Code diff">
        {parts.map((p, i) => {
          const lines = p.value.replace(/\n$/, "").split("\n");
          const mark = p.added ? "+ " : p.removed ? "- " : "  ";
          return (
            <span key={i} className={p.added ? "add" : p.removed ? "del" : undefined}>
              {lines.map((l) => `${mark}${l}`).join("\n")}
              {"\n"}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
