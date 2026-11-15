import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { browser } from "wxt/browser";
import { STATUS_LABELS, formatDuration } from "@leettrack/core";
import type { PanelController } from "./panel-controller";
import { LogForm } from "./LogForm";
import { History } from "./History";
import { QuickReview } from "./QuickReview";
import { formatDue } from "@/lib/format";

const POS_KEY = "panelPosition";
const PANEL_WIDTH = 384;

interface Pos {
  x: number;
  y: number;
}

function clamp(p: Pos): Pos {
  const maxX = Math.max(8, window.innerWidth - PANEL_WIDTH - 8);
  const maxY = Math.max(8, window.innerHeight - 60);
  return { x: Math.min(Math.max(8, p.x), maxX), y: Math.min(Math.max(8, p.y), maxY) };
}

/** Follow LeetCode's own light/dark mode (it toggles a `dark` class on <html>). */
function usePageTheme(): "light" | "dark" {
  const read = (): "light" | "dark" =>
    document.documentElement.classList.contains("dark") ? "dark" : "light";
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

/** Follow the system's light/dark setting (the side panel has no page to copy). */
function useSystemTheme(): "light" | "dark" {
  const query = "(prefers-color-scheme: light)";
  const [light, setLight] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setLight(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return light ? "light" : "dark";
}

/**
 * Asks the background to open the side panel for this tab. Called straight from a click so
 * the click still counts as the user's; if Chrome refuses, says how to open it instead.
 */
async function openSidePanel(): Promise<boolean> {
  try {
    const r = (await browser.runtime.sendMessage({ kind: "leettrack-open-side-panel" })) as
      { ok: boolean } | undefined;
    return Boolean(r?.ok);
  } catch {
    return false;
  }
}

export function App({
  controller,
  layout = "floating",
}: {
  controller: PanelController;
  /** "side": docked in Chrome's side panel, always open, full height. */
  layout?: "floating" | "side";
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const pageTheme = usePageTheme();
  const systemTheme = useSystemTheme();
  const theme = layout === "side" ? systemTheme : pageTheme;
  const side = layout === "side";
  const [sideHelp, setSideHelp] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"log" | "history">("log");
  const [reviewMode, setReviewMode] = useState<{ key: number; mode: "full" | "quick" }>();
  const [notesShownFor, setNotesShownFor] = useState<number>();
  const [pos, setPos] = useState<Pos>(() =>
    clamp({ x: window.innerWidth - PANEL_WIDTH - 24, y: 72 }),
  );
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    browser.storage.local
      .get(POS_KEY)
      .then((v) => {
        const saved = v[POS_KEY] as Pos | undefined;
        if (saved) setPos(clamp(saved));
      })
      .catch(() => {});
  }, []);

  // Back to the form whenever a new attempt starts. After saving, stay put: the Log tab then
  // shows "Attempt saved" with the next review date.
  useEffect(() => {
    if (state.session) setTab("log");
  }, [state.formKey, Boolean(state.session)]);

  if (!state.loc) return null;
  const { problem, session } = state;
  const meta = problem?.problem;
  const status = problem?.status;

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (drag.current)
      setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    void browser.storage.local.set({ [POS_KEY]: pos }).catch(() => {});
  };

  // Quick review (spec 5.4): offered for due, mature cards before any submission this visit.
  const quickOffered =
    !!problem?.card?.quickEligible && problem.card.isDue && session?.submissions.length === 0;
  const mode = quickOffered && reviewMode?.key === state.formKey ? reviewMode.mode : "full";
  // Retrieval first (spec 5.6): past notes stay hidden while an attempt is open.
  const notesHidden =
    !!session && (problem?.attempts.length ?? 0) > 0 && notesShownFor !== state.formKey;

  // The log lives in the side panel: on the page, only a nudge to open it after a result.
  if (!side && state.settings.panelStyle === "side") {
    if (!state.panelOpen) return null;
    return (
      <div className="lt-root" data-theme={theme}>
        <div className="lt-side-pill" role="status" aria-label="LeetTrack">
          <span>
            {state.lastResult ? `${state.lastResult.status}. ` : ""}
            {sideHelp
              ? "Click LeetTrack in the toolbar to open the side panel."
              : "Log it in LeetTrack's side panel."}
          </span>
          {!sideHelp && (
            <button
              type="button"
              className="lt-btn lt-btn-small"
              onClick={() =>
                void openSidePanel().then((ok) => {
                  if (ok) controller.setPanelOpen(false);
                  else setSideHelp(true);
                })
              }
            >
              Open side panel
            </button>
          )}
          <button
            type="button"
            className="lt-icon-btn"
            aria-label="Dismiss"
            onClick={() => controller.setPanelOpen(false)}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lt-root" data-theme={theme} data-layout={layout}>
      {!side && !state.panelOpen && (
        <button
          className="lt-launcher"
          onClick={() => controller.setPanelOpen(true)}
          title="Open LeetTrack"
          aria-label="Open LeetTrack log panel"
        >
          <span className="lt-launcher-mark">LT</span>
          {session && (
            <span
              className={`lt-launcher-time${session.stoppedAt ? " lt-launcher-time-stopped" : ""}`}
            >
              {formatDuration(session.activeSeconds)}
            </span>
          )}
        </button>
      )}

      {(side || state.panelOpen) && (
        <section
          className={side ? "lt-panel lt-panel-side" : "lt-panel"}
          {...(side ? {} : { style: { left: pos.x, top: pos.y, width: PANEL_WIDTH } })}
          aria-label="LeetTrack"
        >
          <header
            className="lt-header"
            {...(side ? {} : { onPointerDown, onPointerMove, onPointerUp })}
          >
            <div className="lt-title">
              <span className="lt-title-text">
                {meta?.frontendId ? `${meta.frontendId}. ` : ""}
                {meta?.title ?? state.loc.slug}
              </span>
              <span className="lt-title-meta">
                {meta?.frontendId && (
                  <span className={`lt-diff lt-diff-${meta.difficulty.toLowerCase()}`}>
                    {meta.difficulty}
                  </span>
                )}
                {status && (
                  <span className={`lt-status lt-status-${status.status}`}>
                    {STATUS_LABELS[status.status]}
                    {status.optimality && status.optimality !== "unsure"
                      ? ` · ${status.optimality}`
                      : ""}
                    {status.overridden ? " · manual" : ""}
                  </span>
                )}
              </span>
            </div>
            {!side && (
              <div className="lt-header-actions">
                <button
                  className="lt-icon-btn"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label={collapsed ? "Expand panel" : "Collapse panel"}
                  title={collapsed ? "Expand" : "Collapse"}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d={collapsed ? "M4 6l4 4 4-4" : "M4 10l4-4 4 4"}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className="lt-icon-btn"
                  onClick={() => controller.setPanelOpen(false)}
                  aria-label="Close panel"
                  title="Close"
                >
                  ×
                </button>
              </div>
            )}
          </header>

          {(side || !collapsed) && (
            <div className="lt-body">
              {state.error && (
                <div className="lt-alert" role="alert">
                  {state.error}
                </div>
              )}
              {state.lastResult && (
                <div
                  className={`lt-result ${state.lastResult.accepted ? "lt-result-ok" : "lt-result-bad"}`}
                >
                  {state.lastResult.status}
                </div>
              )}

              <nav className="lt-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === "log"}
                  className="lt-tab"
                  onClick={() => setTab("log")}
                >
                  Log attempt
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "history"}
                  className="lt-tab"
                  onClick={() => setTab("history")}
                >
                  History{problem ? ` (${problem.attempts.length})` : ""}
                </button>
              </nav>

              {tab === "log" && session && problem && quickOffered && (
                <div className="lt-seg" role="radiogroup" aria-label="Review type">
                  {(["full", "quick"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      className="lt-seg-btn"
                      onClick={() => setReviewMode({ key: state.formKey, mode: m })}
                    >
                      {m === "full" ? "Full review" : "Quick review"}
                      <span className="lt-suggested">
                        {m === "full" ? "re-solve it" : "recall and rate"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {tab === "log" &&
                (session && problem && mode === "quick" ? (
                  <QuickReview
                    key={state.formKey}
                    problem={problem}
                    saving={state.saving}
                    onSave={(input) => controller.saveQuickReview(input)}
                  />
                ) : session && problem ? (
                  <LogForm
                    key={state.formKey}
                    session={session}
                    problem={problem}
                    saving={state.saving}
                    patternPrefs={state.settings}
                    onSave={(draft) => controller.saveAttempt(draft)}
                    onTimerRunning={(running) => controller.setTimerRunning(running)}
                    onRestart={() => controller.startNewAttempt()}
                    onRemoveCheckpoint={(i) => controller.removeCheckpoint(i)}
                    ai={state.ai}
                    analyzing={state.analyzing}
                    onRetryAnalysis={(at) => void controller.analyzeCheckpoint(at)}
                    onCreatePattern={(name) => controller.addCustomPattern(name)}
                    timeboxMinutes={state.settings.timeboxMinutes}
                    onTakeHelp={(level) => controller.takeHelp(level)}
                    onDismissNudge={() => controller.dismissNudge()}
                    onGenerateTwists={() => controller.generateTwists()}
                    onSetTwists={(twists) => controller.setTwists(twists)}
                  />
                ) : (
                  <div className="lt-empty">
                    <p>Attempt saved.</p>
                    {problem?.card && (
                      <p className="lt-next-review">Next review {formatDue(problem.card.due)}</p>
                    )}
                    <button className="lt-btn" onClick={() => controller.startNewAttempt()}>
                      Start a new attempt
                    </button>
                  </div>
                ))}
              {tab === "history" && problem && (
                <History
                  problem={problem}
                  notesHidden={notesHidden}
                  onShowNotes={() => setNotesShownFor(state.formKey)}
                  patternPrefs={state.settings}
                  onOverride={(o) => controller.setStatusOverride(o)}
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
