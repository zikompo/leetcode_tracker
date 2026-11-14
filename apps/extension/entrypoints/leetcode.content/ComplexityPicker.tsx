import { useState } from "react";
import {
  SPACE_COMPLEXITIES as SPACE,
  TIME_COMPLEXITIES as TIME,
  type Complexity,
} from "@leettrack/core";

/** One row of Big-O chips. Tap to pick, tap again to clear; "Other" takes free text. */
function ChipRow({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  value: string | undefined;
  onChange(v: string | undefined): void;
}) {
  const custom = value !== undefined && !options.includes(value);
  const [typing, setTyping] = useState(false);
  return (
    <div className="lt-cx-row" role="radiogroup" aria-label={name}>
      <span className="lt-cx-label">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className="lt-chip lt-cx-chip"
          onClick={() => {
            setTyping(false);
            onChange(value === o ? undefined : o);
          }}
        >
          {o}
        </button>
      ))}
      {typing || custom ? (
        <input
          className="lt-input lt-cx-input"
          aria-label={`${name}, other`}
          placeholder="O(n·m)"
          autoFocus={typing && !custom}
          value={custom ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault(); // don't submit the form
          }}
        />
      ) : (
        <button
          type="button"
          className="lt-chip lt-cx-chip lt-cx-other"
          onClick={() => setTyping(true)}
        >
          Other…
        </button>
      )}
    </div>
  );
}

export function ComplexityPicker({
  name,
  value,
  onChange,
}: {
  /** Accessible name prefix, e.g. "Solution 1". */
  name: string;
  value: Complexity | undefined;
  onChange(v: Complexity): void;
}) {
  const set = (k: keyof Complexity, v: string | undefined) => {
    const next: Complexity = { ...value };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(next);
  };
  return (
    <div className="lt-cx">
      <ChipRow
        label="Time"
        name={`${name} time complexity`}
        options={TIME}
        value={value?.time}
        onChange={(v) => set("time", v)}
      />
      <ChipRow
        label="Space"
        name={`${name} space complexity`}
        options={SPACE}
        value={value?.space}
        onChange={(v) => set("space", v)}
      />
    </div>
  );
}
