"use client";

import { useRef, useState, useTransition } from "react";
import type { Settings } from "@leettrack/core";
import { Button } from "@leettrack/ui/components/button";
import { Checkbox } from "@leettrack/ui/components/checkbox";
import { Input } from "@leettrack/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@leettrack/ui/components/native-select";
import { Notice, Panel } from "@leettrack/ui/components/panel";
import { Field } from "@/components/Field";
import { deleteAccount, importJson, updateSettings, type ActionResult } from "@/lib/actions";

const RETENTION: Array<[number, string]> = [
  [0.8, "80%: fewer reviews"],
  [0.85, "85%"],
  [0.9, "90% (recommended)"],
  [0.95, "95%: many more reviews"],
];

function Result({ r }: { r: ActionResult | null }) {
  return r ? <Notice ok={r.ok}>{r.message}</Notice> : null;
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
    timeboxMinutes: settings.timeboxMinutes,
  });
  const [confirm, setConfirm] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Panel title="Daily review">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="New problems per day" htmlFor="s-new">
            <Input
              id="s-new"
              type="number"
              min={0}
              max={50}
              value={form.dailyNewLimit}
              onChange={(e) => setForm({ ...form, dailyNewLimit: Number(e.target.value) })}
            />
          </Field>
          <Field label="Reviews per day" htmlFor="s-reviews">
            <Input
              id="s-reviews"
              type="number"
              min={0}
              max={500}
              value={form.dailyReviewLimit}
              onChange={(e) => setForm({ ...form, dailyReviewLimit: Number(e.target.value) })}
            />
          </Field>
          <Field label="Timebox (min, 0 = off)" htmlFor="s-timebox">
            <Input
              id="s-timebox"
              type="number"
              min={0}
              max={180}
              value={form.timeboxMinutes}
              onChange={(e) => setForm({ ...form, timeboxMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Target recall" htmlFor="s-recall">
            <NativeSelect
              id="s-recall"
              className="w-full"
              value={form.desiredRetention}
              onChange={(e) => setForm({ ...form, desiredRetention: Number(e.target.value) })}
            >
              {RETENTION.map(([v, l]) => (
                <NativeSelectOption key={v} value={v}>
                  {l}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={form.hideTopicsWhileSolving}
            onCheckedChange={(on) => setForm({ ...form, hideTopicsWhileSolving: on === true })}
          />
          Hide LeetCode&apos;s topic tags while the extension&apos;s timer runs
        </label>
        <div>
          <Button
            disabled={pending}
            onClick={() => start(async () => setReview(await updateSettings(form)))}
          >
            Save
          </Button>
        </div>
        <Result r={review} />
      </Panel>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Panel
          title="Your data"
          description="Download everything as JSON, or import a file exported from the extension, or a prep-tracker export. Importing merges: nothing is deleted, and newer edits win."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <a
                href="/export"
                className="text-secondary-foreground no-underline hover:no-underline"
              >
                Export JSON
              </a>
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => fileRef.current?.click()}>
              Import JSON
            </Button>
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
        </Panel>

        <Panel
          title="Delete account"
          description="Permanently deletes your account and everything synced to it. Data still in the extension on your computer stays there until you remove it."
        >
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-0 flex-1"
              placeholder='Type "delete"'
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-label="Type delete to confirm"
            />
            <Button
              variant="destructive"
              disabled={pending || confirm.trim().toLowerCase() !== "delete"}
              onClick={() => start(async () => setDanger(await deleteAccount(confirm)))}
            >
              Delete my account
            </Button>
          </div>
          <Result r={danger} />
        </Panel>
      </div>
    </>
  );
}
