import { useState } from "react";
import type { Settings } from "@leettrack/core";
import { call } from "@/lib/messaging";
import { allPatterns, patternName } from "@/lib/patterns";

/** Rename or merge pattern tags (spec 6): applies everywhere, and syncs. */
export function PatternSettings({ settings, onDone }: { settings: Settings; onDone(): void }) {
  const patterns = allPatterns(settings);
  const [renameId, setRenameId] = useState(patterns[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [from, setFrom] = useState("");
  const [into, setInto] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, text: string) => {
    try {
      await fn();
      setMessage({ kind: "ok", text });
      onDone();
    } catch (e) {
      setMessage({ kind: "bad", text: e instanceof Error ? e.message : String(e) });
    }
  };
  const select = (value: string, set: (v: string) => void, label: string) => (
    <select value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      <option value="">Choose…</option>
      {patterns.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
  return (
    <section className="card" aria-labelledby="patterns-heading">
      <h2 id="patterns-heading">Pattern tags</h2>
      <p className="muted small">
        Rename a pattern, or merge one into another; problems tagged with it follow along.
      </p>
      <div className="field">
        <span>Rename</span>
        <div className="row">
          {select(renameId, setRenameId, "Pattern to rename")}
          <input
            placeholder="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="New name"
          />
          <button
            className="btn"
            disabled={!renameId || !newName.trim()}
            onClick={() =>
              void run(
                () => call("renamePattern", { id: renameId, name: newName }),
                "Renamed.",
              ).then(() => setNewName(""))
            }
          >
            Rename
          </button>
        </div>
      </div>
      <div className="field">
        <span>Merge</span>
        <div className="row">
          {select(from, setFrom, "Pattern to merge")}
          <span className="muted small">into</span>
          {select(into, setInto, "Pattern to keep")}
          <button
            className="btn"
            disabled={!from || !into}
            onClick={() =>
              void run(
                () => call("mergePattern", { from, into }),
                `Merged. Problems tagged ${patternName(from, settings)} are now ${patternName(into, settings)}.`,
              )
            }
          >
            Merge
          </button>
        </div>
      </div>
      {message && <p className={message.kind}>{message.text}</p>}
    </section>
  );
}
