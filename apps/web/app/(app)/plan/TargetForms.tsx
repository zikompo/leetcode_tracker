"use client";

import { useId, useState, useTransition } from "react";
import type { Settings, TargetDate } from "@leettrack/core";
import { Button } from "@leettrack/ui/components/button";
import { Checkbox } from "@leettrack/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@leettrack/ui/components/dialog";
import { Input } from "@leettrack/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@leettrack/ui/components/native-select";
import { Notice } from "@leettrack/ui/components/panel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field } from "@/components/Field";
import { deleteTarget, saveTarget, updateSettings, type ActionResult } from "@/lib/actions";

function Result({ r }: { r: ActionResult | null }) {
  return r ? <Notice ok={r.ok}>{r.message}</Notice> : null;
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
  const id = useId();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [label, setLabel] = useState(target?.label ?? "");
  const [date, setDate] = useState(target?.date ?? "");
  const [listIds, setListIds] = useState<string[]>(target?.listIds ?? []);
  const toggle = (listId: string, on: boolean) =>
    setListIds(lists.map((l) => l.id).filter((l) => (l === listId ? on : listIds.includes(l))));

  return (
    <form
      className="flex flex-col gap-3"
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
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Interview" htmlFor={`${id}-label`}>
          <Input
            id={`${id}-label`}
            placeholder="e.g. Onsite at Acme"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="Date" htmlFor={`${id}-date`}>
          <Input
            id={`${id}-date`}
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-muted-foreground">
          Lists to finish by then (none ticked: your active lists)
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {lists.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={listIds.includes(l.id)}
                onCheckedChange={(on) => toggle(l.id, on === true)}
              />
              {l.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {target ? "Save" : "Add interview"}
        </Button>
        {onDone && target && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      <Result r={result} />
    </form>
  );
}

/** Edit (in a dialog) and Remove (after a confirmation) for one interview. */
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
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <ConfirmButton
          disabled={pending}
          title={`Remove “${target.label}”?`}
          description="Its plan and extra reviews go; your attempts stay."
          confirm="Remove"
          onConfirm={() => start(async () => setResult(await deleteTarget(target.id)))}
        >
          Remove
        </ConfirmButton>
      </div>
      <Result r={result} />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit interview</DialogTitle>
            <DialogDescription>Change the name, date or lists.</DialogDescription>
          </DialogHeader>
          <TargetForm
            target={target}
            lists={lists}
            today={today}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
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
  const id = useId();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [form, setForm] = useState({
    targetBufferDays: settings.targetBufferDays,
    targetNoNewDays: settings.targetNoNewDays,
    targetRetention: settings.targetRetention,
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Interview options"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await updateSettings(form)));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Extra review, days before" htmlFor={`${id}-buffer`}>
          <Input
            id={`${id}-buffer`}
            type="number"
            min={0}
            max={14}
            value={form.targetBufferDays}
            onChange={(e) => setForm({ ...form, targetBufferDays: Number(e.target.value) })}
          />
        </Field>
        <Field label="Reviews only, last days" htmlFor={`${id}-quiet`}>
          <Input
            id={`${id}-quiet`}
            type="number"
            min={0}
            max={14}
            value={form.targetNoNewDays}
            onChange={(e) => setForm({ ...form, targetNoNewDays: Number(e.target.value) })}
          />
        </Field>
        <Field label="Recall wanted on the day" htmlFor={`${id}-recall`}>
          <NativeSelect
            id={`${id}-recall`}
            className="w-full"
            value={form.targetRetention}
            onChange={(e) => setForm({ ...form, targetRetention: Number(e.target.value) })}
          >
            {RECALL.map(([v, l]) => (
              <NativeSelectOption key={v} value={v}>
                {l}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        A solved problem that would be shaky on the day comes back for one more review this many
        days before. In the last days you get reviews only, no new problems.
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </div>
      <Result r={result} />
    </form>
  );
}
