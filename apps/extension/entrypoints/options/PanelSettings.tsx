import type { PanelAutoOpen, Settings } from "@leettrack/core";
import { call } from "@/lib/messaging";

const PANEL_STYLES: Array<["floating" | "side", string, string]> = [
  ["floating", "On the LeetCode page", "A small panel you can drag around, over the problem."],
  [
    "side",
    "In Chrome's side panel",
    "Beside the page, out of the way. The toolbar icon opens it; after a result the page offers a button to open it.",
  ],
];

const AUTO_OPEN: Array<[PanelAutoOpen, string, string]> = [
  ["accepted", "On Accepted", "Open the log panel when a submission is accepted."],
  ["every_submission", "On every submission", "Open it after any result, including Wrong Answer."],
  ["manual", "Only manually", "Open it yourself from the floating button or the toolbar."],
];

/** Where the log panel lives, and when it opens. */
export function PanelSettings({
  settings,
  onChange,
}: {
  settings: Settings | null;
  onChange(s: Settings): void;
}) {
  return (
    <>
      <section className="card" aria-labelledby="panel-style-heading">
        <h2 id="panel-style-heading">Where should the log panel be?</h2>
        <div className="radios" role="radiogroup" aria-labelledby="panel-style-heading">
          {PANEL_STYLES.map(([value, label, hint]) => (
            <label key={value} className="radio">
              <input
                type="radio"
                name="panelStyle"
                checked={(settings?.panelStyle ?? "floating") === value}
                onChange={async () => onChange(await call("setSettings", { panelStyle: value }))}
              />
              <span>
                <strong className="font-medium">{label}</strong>
                <span className="muted small">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="auto-open-heading">
        <h2 id="auto-open-heading">When should the log panel open?</h2>
        <div className="radios" role="radiogroup" aria-labelledby="auto-open-heading">
          {AUTO_OPEN.map(([value, label, hint]) => (
            <label key={value} className="radio">
              <input
                type="radio"
                name="autoOpen"
                checked={settings?.panelAutoOpen === value}
                onChange={async () => onChange(await call("setSettings", { panelAutoOpen: value }))}
              />
              <span>
                <strong className="font-medium">{label}</strong>
                <span className="muted small">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </>
  );
}
