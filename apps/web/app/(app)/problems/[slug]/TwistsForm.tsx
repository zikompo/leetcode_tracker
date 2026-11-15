"use client";

import { useState, useTransition } from "react";
import { Button } from "@leettrack/ui/components/button";
import { Notice } from "@leettrack/ui/components/panel";
import { Textarea } from "@leettrack/ui/components/textarea";
import { setTwists, type ActionResult } from "@/lib/actions";

/** "What if" prompts asked after a review of this problem; edit them one per line. */
export function TwistsForm({ slug, twists }: { slug: string; twists: string[] }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(twists.join("\n"));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {editing ? (
        <form
          className="flex flex-col gap-2"
          aria-label="Edit twists"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setTwists(slug, text.split("\n"));
              setResult(r);
              if (r.ok) setEditing(false);
            });
          }}
        >
          <Textarea
            rows={4}
            aria-label="Twists, one per line"
            placeholder="What if the input were a stream?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Save twists
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {twists.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None yet. After a review of a problem you know well, the extension asks one; with an
              AI provider set up it drafts them for you.
            </p>
          ) : (
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {twists.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {twists.length ? "Edit twists" : "Write twists"}
            </Button>
          </div>
        </>
      )}
      {result && <Notice ok={result.ok}>{result.message}</Notice>}
    </div>
  );
}
