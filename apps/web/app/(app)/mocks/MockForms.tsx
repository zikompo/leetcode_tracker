"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import type { MockInterview, MockOutcome } from "@leettrack/core";
import { Badge } from "@leettrack/ui/components/badge";
import { Button } from "@leettrack/ui/components/button";
import { Input } from "@leettrack/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@leettrack/ui/components/native-select";
import { Notice } from "@leettrack/ui/components/panel";
import { Textarea } from "@leettrack/ui/components/textarea";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field } from "@/components/Field";
import { deleteMock, saveMock, type ActionResult } from "@/lib/actions";
import { formatDate } from "@/lib/util";

const OUTCOMES: Array<[MockOutcome, string]> = [
  ["passed", "Went well"],
  ["mixed", "Mixed"],
  ["struggled", "Struggled"],
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES) as Record<MockOutcome, string>;
const OUTCOME_TONE: Record<MockOutcome, string> = {
  passed: "bg-ok/15 text-ok",
  mixed: "bg-warn/15 text-warn",
  struggled: "bg-bad/15 text-bad",
};

export type MockView = MockInterview & { problemTitle?: string; problemSlug?: string };

/** Log a new mock, or edit one (with `mock`). */
export function MockForm({
  mock,
  today,
  onDone,
}: {
  mock?: MockView;
  today: string;
  onDone?(): void;
}) {
  const id = useId();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [form, setForm] = useState({
    date: mock?.date ?? today,
    problem: mock?.problem ?? "",
    outcome: (mock?.outcome ?? "") as MockOutcome | "",
    notes: mock?.notes ?? "",
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={mock ? "Edit mock" : "Log a mock"}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveMock({ ...(mock ? { id: mock.id } : {}), ...form });
          setResult(r);
          if (r.ok) {
            if (!mock) setForm({ date: today, problem: "", outcome: "", notes: "" });
            onDone?.();
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" htmlFor={`${id}-date`}>
          <Input
            id={`${id}-date`}
            type="date"
            max={today}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="How it went" htmlFor={`${id}-outcome`}>
          <NativeSelect
            id={`${id}-outcome`}
            className="w-full"
            value={form.outcome}
            onChange={(e) => setForm({ ...form, outcome: e.target.value as MockOutcome | "" })}
          >
            <NativeSelectOption value="">Not sure</NativeSelectOption>
            {OUTCOMES.map(([v, l]) => (
              <NativeSelectOption key={v} value={v}>
                {l}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Problem" htmlFor={`${id}-problem`}>
        <Input
          id={`${id}-problem`}
          placeholder="LeetCode URL or slug, or a few words"
          value={form.problem}
          onChange={(e) => setForm({ ...form, problem: e.target.value })}
        />
      </Field>
      <Field label="Notes" htmlFor={`${id}-notes`}>
        <Textarea
          id={`${id}-notes`}
          rows={4}
          placeholder="How it went, and what to fix next time"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {mock ? "Save" : "Log mock"}
        </Button>
        {mock && onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      {result && <Notice ok={result.ok}>{result.message}</Notice>}
    </form>
  );
}

function MockItem({ mock, today }: { mock: MockView; today: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (editing) return <MockForm mock={mock} today={today} onDone={() => setEditing(false)} />;
  return (
    <article className="flex flex-col gap-2" aria-label={`Mock on ${formatDate(mock.date)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="font-medium">{formatDate(mock.date)}</strong>
          {mock.outcome && (
            <Badge className={OUTCOME_TONE[mock.outcome]}>{OUTCOME_LABEL[mock.outcome]}</Badge>
          )}
          {mock.problemSlug ? (
            <Link href={`/problems/${mock.problemSlug}`}>{mock.problemTitle}</Link>
          ) : (
            mock.problem && <span className="text-muted-foreground">{mock.problem}</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <ConfirmButton
            disabled={pending}
            title="Delete this mock?"
            description="It's removed here and from the extension on its next sync."
            confirm="Delete"
            onConfirm={() => start(async () => setResult(await deleteMock(mock.id)))}
          >
            Delete
          </ConfirmButton>
        </div>
      </div>
      {mock.notes && <p className="whitespace-pre-wrap text-sm">{mock.notes}</p>}
      {result && <Notice ok={result.ok}>{result.message}</Notice>}
    </article>
  );
}

export function MockList({ mocks, today }: { mocks: MockView[]; today: string }) {
  return (
    <ul className="flex flex-col divide-y">
      {mocks.map((m) => (
        <li key={m.id} className="py-3 first:pt-0 last:pb-0">
          <MockItem mock={m} today={today} />
        </li>
      ))}
    </ul>
  );
}
