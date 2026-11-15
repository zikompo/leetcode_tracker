import { useRef, useState } from "react";
import type { Stats } from "@/lib/types";
import type { ImportSummary } from "@/lib/types";
import { call } from "@/lib/messaging";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** What an import brought in, in words. */
export function importMessage(r: ImportSummary): string {
  if (r.fromTracker) {
    const parts = [
      plural(r.attemptsAdded, "attempt"),
      r.problemsMerged ? plural(r.problemsMerged, "solved-before problem") : "",
      r.mocksMerged ? plural(r.mocksMerged, "mock interview") : "",
      r.interviewsAdded ? plural(r.interviewsAdded, "interview date") : "",
    ].filter(Boolean);
    return `Imported from your prep tracker: ${parts.join(", ")}. Redo dates are estimated from the tracker's schedule.`;
  }
  return `Imported: ${r.attemptsAdded} new attempts, ${r.attemptsUpdated} updated, ${r.problemsMerged} problems merged${r.mocksMerged ? `, ${plural(r.mocksMerged, "mock interview")}` : ""}.`;
}

/** Export everything, or import a LeetTrack export or a prep-tracker file. */
export function DataSettings({
  stats,
  onImported,
  title = "Your data",
  exportable = true,
}: {
  stats: Stats | null;
  onImported(): void;
  title?: string;
  exportable?: boolean;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const json = await call("exportData");
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leettrack-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const r = await call("importData", await file.text());
      setMessage({ kind: "ok", text: importMessage(r) });
      onImported();
    } catch (e) {
      setMessage({ kind: "bad", text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="card" aria-labelledby="data-heading">
      <h2 id="data-heading">{title}</h2>
      <p className="muted">
        Everything is stored locally in this browser.
        {stats && ` ${stats.attempts} attempts across ${stats.problemsAttempted} problems.`}
      </p>
      <div className="row">
        {exportable && (
          <button className="btn btn-primary" onClick={() => void exportData()}>
            Export JSON
          </button>
        )}
        <button
          className={exportable ? "btn" : "btn btn-primary"}
          onClick={() => fileRef.current?.click()}
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
          }}
        />
      </div>
      <p className="muted small">
        Importing merges with what is here: nothing is deleted, newer edits win. A prep-tracker
        export works too.
      </p>
      {message && <p className={message.kind}>{message.text}</p>}
    </section>
  );
}
