"use client";

import { useRef, useState, useTransition } from "react";
import type { Settings } from "@leettrack/core";
import { deleteAccount, importJson, updateSettings, type ActionResult } from "@/lib/actions";

const RETENTION: Array<[number, string]> = [
  [0.8, "80%: fewer reviews"],
  [0.85, "85%"],
  [0.9, "90% (recommended)"],
  [0.95, "95%: many more reviews"],
];

function Result({ r }: { r: ActionResult | null }) {
  return r ? (
    <p className={r.ok ? "ok small" : "bad small"} role="status">
      {r.message}
    </p>
  ) : null;
}

export function SettingsForms({ settings }: { settings: Settings }) {
  const [pending, start] = useTransition();
  const [review, setReview] = useState<ActionResult | null>(null);
  const [data, setData] = useState<ActionResult | null>(null);
  const [danger, setDanger] = useState<ActionResult | null>(null);
  const [form, setForm] = useState({
    dailyNewLimit: settings.dailyNewLimit,
    dailyReviewLimit: settings.dailyReviewLimit,
    desiredRetention: settings.desiredRetention,
    hideTopicsWhileSolving: settings.hideTopicsWhileSolving,
  });
  const [confirm, setConfirm] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <section className="card stack" aria-labelledby="review">
        <h2 id="review">Daily review</h2>
        <div className="row">
          <label className="field">
            <span>New problems per day</span>
            <input
              className="input"
              type="number"
              min={0}
              max={50}
              value={form.dailyNewLimit}
              onChange={(e) => setForm({ ...form, dailyNewLimit: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Reviews per day</span>
            <input
              className="input"
              type="number"
              min={0}
              max={500}
              value={form.dailyReviewLimit}
              onChange={(e) => setForm({ ...form, dailyReviewLimit: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Target recall</span>
            <select
              className="input"
              value={form.desiredRetention}
              onChange={(e) => setForm({ ...form, desiredRetention: Number(e.target.value) })}
            >
              {RETENTION.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={form.hideTopicsWhileSolving}
            onChange={(e) => setForm({ ...form, hideTopicsWhileSolving: e.target.checked })}
          />
          Hide LeetCode&apos;s topic tags while the extension&apos;s timer runs
        </label>
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() => start(async () => setReview(await updateSettings(form)))}
          >
            Save
          </button>
        </div>
        <Result r={review} />
      </section>

      <section className="card stack" aria-labelledby="data">
        <h2 id="data">Your data</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Download everything as JSON, or import a file exported from the extension. Importing
          merges: nothing is deleted, and newer edits win.
        </p>
        <div className="row">
          <a className="btn" href="/export">
            Export JSON
          </a>
          <button className="btn" disabled={pending} onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Import file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              start(async () => setData(await importJson(await file.text())));
              e.target.value = "";
            }}
          />
        </div>
        <Result r={data} />
      </section>

      <section className="card stack" aria-labelledby="danger">
        <h2 id="danger">Delete account</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Permanently deletes your account and everything synced to it. Data still in the extension
          on your computer stays there until you remove it.
        </p>
        <div className="row">
          <input
            className="input"
            placeholder='Type "delete"'
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-label="Type delete to confirm"
          />
          <button
            className="btn btn-danger"
            disabled={pending || confirm.trim().toLowerCase() !== "delete"}
            onClick={() => start(async () => setDanger(await deleteAccount(confirm)))}
          >
            Delete my account
          </button>
        </div>
        <Result r={danger} />
      </section>
    </>
  );
}
