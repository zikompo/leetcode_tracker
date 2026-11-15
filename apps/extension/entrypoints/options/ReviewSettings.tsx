import { useEffect, useState } from "react";
import type { CustomList, Settings } from "@leettrack/core";
import { LISTS } from "@leettrack/seed";
import { call } from "@/lib/messaging";

const RETENTION: Array<[number, string]> = [
  [0.8, "80%: fewer reviews"],
  [0.85, "85%"],
  [0.9, "90% (recommended)"],
  [0.95, "95%: many more reviews"],
];

/** Scheduler and queue settings (spec 4.7). */
export function ReviewSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange(s: Settings): void;
}) {
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  useEffect(() => {
    void call("getCustomLists")
      .then(setCustomLists)
      .catch(() => {});
  }, []);
  const allLists = [...LISTS, ...customLists.map((l) => ({ id: l.id, name: l.name }))];
  const save = async (patch: Partial<Omit<Settings, "updatedAt">>) => {
    onChange({ ...settings, ...patch }); // show it at once; the saved copy follows
    onChange(await call("setSettings", patch));
  };
  const limit = (key: "dailyNewLimit" | "dailyReviewLimit", max: number) => (
    <input
      type="number"
      min={0}
      max={max}
      value={settings[key]}
      onChange={(e) => {
        const n = Math.round(Number(e.target.value));
        if (Number.isFinite(n) && n >= 0 && n <= max) void save({ [key]: n });
      }}
    />
  );
  const toggleList = (id: string, on: boolean) =>
    void save({
      // Keep the canonical order so priority is predictable.
      activeLists: allLists
        .map((l) => l.id)
        .filter((l) => (l === id ? on : settings.activeLists.includes(l))),
    });

  return (
    <section className="card" aria-labelledby="review-heading">
      <h2 id="review-heading">Daily review</h2>
      <div className="grid-2">
        <label className="field">
          <span>New problems per day</span>
          {limit("dailyNewLimit", 50)}
        </label>
        <label className="field">
          <span>Reviews per day</span>
          {limit("dailyReviewLimit", 500)}
        </label>
      </div>
      <label className="field">
        <span>Target recall</span>
        <select
          value={settings.desiredRetention}
          onChange={(e) => void save({ desiredRetention: Number(e.target.value) })}
        >
          {RETENTION.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">
        How likely you should be to remember a problem when it comes up for review. Higher means
        shorter gaps and more reviews.
      </p>

      <fieldset className="field">
        <span>New problems come from</span>
        {allLists.map((l) => (
          <label key={l.id} className="check">
            <input
              type="checkbox"
              checked={settings.activeLists.includes(l.id)}
              onChange={(e) => toggleList(l.id, e.target.checked)}
            />
            {l.name}
          </label>
        ))}
      </fieldset>

      <label className="check">
        <input
          type="checkbox"
          checked={settings.hideTopicsWhileSolving}
          onChange={(e) => void save({ hideTopicsWhileSolving: e.target.checked })}
        />
        Hide LeetCode's topic tags while the timer runs
      </label>
    </section>
  );
}
