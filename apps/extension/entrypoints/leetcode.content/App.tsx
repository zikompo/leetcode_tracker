import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { browser } from "wxt/browser";
import { STATUS_LABELS, formatDuration } from "@leettrack/core";
import type { PageController } from "./controller";
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

export function App({ controller }: { controller: PageController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const theme = usePageTheme();
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

  return (
    <div className="lt-root" data-theme={theme}>
      {!state.panelOpen && (
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

      {state.panelOpen && (
        <section
          className="lt-panel"
          style={{ left: pos.x, top: pos.y, width: PANEL_WIDTH }}
          aria-label="LeetTrack"
        >
          <header
            className="lt-header"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
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
          </header>

          {!collapsed && (
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
