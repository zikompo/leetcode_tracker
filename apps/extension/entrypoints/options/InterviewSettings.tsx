import { useEffect, useState } from "react";
import {
  daysUntil,
  dateKey,
  type CustomList,
  type Settings,
  type TargetDate,
} from "@leettrack/core";
import { LISTS } from "@leettrack/seed";
import { ACCOUNT_CONFIGURED, ACCOUNT_ENV } from "@/lib/account";
import { call } from "@/lib/messaging";

/** Interview dates (spec 5.5): extra reviews before each, and reviews only at the end. */
export function InterviewSettings({
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
  const lists = [...LISTS, ...customLists.map((l) => ({ id: l.id, name: l.name }))];
  const listName = (id: string) => lists.find((l) => l.id === id)?.name;
  const today = dateKey(new Date());
  const targets = [...(settings.targetDates ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Partial<Omit<Settings, "updatedAt">>) => {
    onChange({ ...settings, ...patch });
    onChange(await call("setSettings", patch));
  };
  const add = () => {
    const name = label.trim();
    if (!name) return setError("Give the interview a name.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Pick a date.");
    setError(null);
    const target: TargetDate = {
      id: crypto.randomUUID(),
      label: name.slice(0, 80),
      date,
      listIds,
      createdAt: new Date().toISOString(),
    };
    void save({ targetDates: [...(settings.targetDates ?? []), target] });
    setLabel("");
    setDate("");
    setListIds([]);
  };
  const days = (key: "targetBufferDays" | "targetNoNewDays") => (
    <input
      type="number"
      min={0}
      max={14}
      value={settings[key]}
      onChange={(e) => {
        const n = Math.round(Number(e.target.value));
        if (Number.isFinite(n) && n >= 0 && n <= 14) void save({ [key]: n });
      }}
    />
  );

  return (
    <section className="card" aria-labelledby="interviews-heading">
      <h2 id="interviews-heading">Interview dates</h2>
      <p className="muted small">
        Before an interview, problems you&apos;d be shaky on get one more review, new problems come
        from its lists first, and the last days are reviews only.
        {ACCOUNT_CONFIGURED && (
          <>
            {" "}
            <a href={`${ACCOUNT_ENV.websiteUrl}/plan`} target="_blank" rel="noreferrer">
              See the day-by-day plan
            </a>
            .
          </>
        )}
      </p>

      {targets.length > 0 && (
        <ul className="target-list">
          {targets.map((t) => {
            const left = daysUntil(t.date, new Date());
            return (
              <li key={t.id}>
                <span>
                  <strong>{t.label}</strong>{" "}
                  <span className="muted small">
                    {t.date} ·{" "}
                    {left < 0
                      ? "past"
                      : left === 0
                        ? "today"
                        : `in ${left} day${left === 1 ? "" : "s"}`}{" "}
                    · {t.listIds.map(listName).filter(Boolean).join(", ") || "active lists"}
                  </span>
                </span>
                <button
                  className="btn"
                  aria-label={`Remove ${t.label}`}
                  onClick={() =>
                    void save({
                      targetDates: (settings.targetDates ?? []).filter((x) => x.id !== t.id),
                    })
                  }
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="stack"
        aria-label="Add an interview"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="grid-2">
          <label className="field">
            <span>Interview</span>
            <input
              placeholder="e.g. Onsite at Acme"
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <fieldset className="field">
          <span>Lists to finish by then (none ticked: your active lists)</span>
          {lists.map((l) => (
            <label key={l.id} className="check">
              <input
                type="checkbox"
                checked={listIds.includes(l.id)}
                onChange={(e) =>
                  setListIds(
                    lists
                      .map((x) => x.id)
                      .filter((x) => (x === l.id ? e.target.checked : listIds.includes(x))),
                  )
                }
              />
              {l.name}
            </label>
          ))}
        </fieldset>
        <div className="row">
          <button className="btn btn-primary">Add interview</button>
        </div>
        {error && <p className="bad small">{error}</p>}
      </form>

      <div className="grid-2">
        <label className="field">
          <span>Extra review, days before</span>
          {days("targetBufferDays")}
        </label>
        <label className="field">
          <span>Reviews only, last days</span>
          {days("targetNoNewDays")}
        </label>
      </div>
    </section>
  );
}
