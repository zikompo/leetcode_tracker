"use client";

import { useState, useTransition } from "react";
import type { Settings, TargetDate } from "@leettrack/core";
import { deleteTarget, saveTarget, updateSettings, type ActionResult } from "@/lib/actions";

function Result({ r }: { r: ActionResult | null }) {
  return r ? (
    <p className={r.ok ? "ok small" : "bad small"} role="status">
      {r.message}
    </p>
  ) : null;
}

/** Add an interview date, or edit one (with `target`). */
export function TargetForm({
  target,
  lists,
  today,
  onDone,
}: {
  target?: TargetDate;
  lists: { id: string; name: string }[];
  /** YYYY-MM-DD, the earliest date allowed. */
  today: string;
  onDone?(): void;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [label, setLabel] = useState(target?.label ?? "");
  const [date, setDate] = useState(target?.date ?? "");
  const [listIds, setListIds] = useState<string[]>(target?.listIds ?? []);
  const toggle = (id: string, on: boolean) =>
    setListIds(lists.map((l) => l.id).filter((l) => (l === id ? on : listIds.includes(l))));

  return (
    <form
      className="stack"
      aria-label={target ? `Edit ${target.label}` : "Add an interview"}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveTarget({ id: target?.id, label, date, listIds });
          setResult(r);
          if (r.ok) {
            if (!target) {
              setLabel("");
              setDate("");
              setListIds([]);
            }
            onDone?.();
          }
        });
      }}
    >
      <div className="row">
        <label className="field grow">
          <span>Interview</span>
          <input
            className="input"
            placeholder="e.g. Onsite at Acme"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Date</span>
          <input
            className="input"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <fieldset className="plain">
        <legend className="small muted">
          Lists to finish by then (none ticked: your active lists)
        </legend>
        <div className="row">
          {lists.map((l) => (
            <label key={l.id} className="check small">
              <input
                type="checkbox"
                checked={listIds.includes(l.id)}
                onChange={(e) => toggle(l.id, e.target.checked)}
              />
              {l.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row">
        <button className="btn btn-primary" disabled={pending}>
          {target ? "Save" : "Add interview"}
        </button>
        {onDone && target && (
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
      <Result r={result} />
    </form>
  );
}

/** Edit and Remove for one interview. */
export function TargetActions({
  target,
  lists,
  today,
}: {
  target: TargetDate;
  lists: { id: string; name: string }[];
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (editing)
    return (
      <TargetForm target={target} lists={lists} today={today} onDone={() => setEditing(false)} />
    );
  return (
    <div className="stack">
      <div className="row">
        <button className="btn" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove “${target.label}”?`)) return;
            start(async () => setResult(await deleteTarget(target.id)));
          }}
        >
          Remove
        </button>
      </div>
      <Result r={result} />
    </div>
  );
}

const RECALL: Array<[number, string]> = [
  [0.9, "90%"],
  [0.95, "95% (recommended)"],
  [0.97, "97%: more extra reviews"],
];

/** How interview dates change the schedule. */
export function PlanOptions({ settings }: { settings: Settings }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [form, setForm] = useState({
    targetBufferDays: settings.targetBufferDays,
    targetNoNewDays: settings.targetNoNewDays,
    targetRetention: settings.targetRetention,
  });
  return (
    <form
      className="stack"
      aria-label="Interview options"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await updateSettings(form)));
      }}
    >
      <div className="row">
        <label className="field">
          <span>Extra review, days before</span>
          <input
            className="input"
            type="number"
            min={0}
            max={14}
            value={form.targetBufferDays}
            onChange={(e) => setForm({ ...form, targetBufferDays: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Reviews only, last days</span>
          <input
            className="input"
            type="number"
            min={0}
            max={14}
            value={form.targetNoNewDays}
            onChange={(e) => setForm({ ...form, targetNoNewDays: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Recall wanted on the day</span>
          <select
            className="input"
            value={form.targetRetention}
            onChange={(e) => setForm({ ...form, targetRetention: Number(e.target.value) })}
          >
            {RECALL.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        A solved problem that would be shaky on the day comes back for one more review this many
        days before. In the last days you get reviews only, no new problems.
      </p>
      <div className="row">
        <button className="btn btn-primary" disabled={pending}>
          Save
        </button>
      </div>
      <Result r={result} />
    </form>
  );
}
