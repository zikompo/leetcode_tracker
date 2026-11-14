import {
  DEFAULT_SETTINGS,
  buildAttempt,
  buildQuickAttempt,
  solveSeconds,
  suggestRating,
  type AttemptDraft,
  type Settings,
  type StatusOverride,
  type Submission,
} from "@leettrack/core";
import {
  createSubmissionDetector,
  fetchProblemMetadata,
  isSolutionTab,
  parseProblemUrl,
  requestEditorCode,
  type ProblemLocation,
  type SubmissionResult,
  type SubmissionStarted,
} from "@/adapters/leetcode";
import type { AiStatus } from "@/lib/ai";
import { call } from "@/lib/messaging";
import { mergeSessions } from "@/lib/session";
import type { AttemptSession, ProblemState, SessionCheckpoint } from "@/lib/types";
import type { QuickReviewInput } from "./QuickReview";

const HIDE_TOPICS_ID = "leettrack-hide-topics";

/** A session idle this long is treated as abandoned; the next visit starts a fresh attempt. */
const STALE_SESSION_MS = 6 * 60 * 60 * 1000;
const FLUSH_EVERY_TICKS = 10;
/** Re-fetch LeetCode metadata when the cached copy is older than this. */
const METADATA_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PageState {
  loc: ProblemLocation | null;
  problem: ProblemState | null;
  session: AttemptSession | null;
  settings: Settings;
  /** Whether a model is set up to suggest complexities. */
  ai: AiStatus;
  /** Checkpoints (by `at`) waiting on a complexity suggestion. */
  analyzing: string[];
  panelOpen: boolean;
  lastResult: SubmissionResult | null;
  /** Bumped whenever the log form should reset (new problem, attempt saved). */
  formKey: number;
  saving: boolean;
  error: string | null;
}

export function newSession(slug: string, now = new Date()): AttemptSession {
  const iso = now.toISOString();
  return {
    slug,
    startedAt: iso,
    lastActiveAt: iso,
    activeSeconds: 0,
    submissions: [],
    submissionIds: [],
    viewedSolutionDetected: false,
  };
}

/** A stopped session holds a finished-but-unlogged attempt, so it never goes stale. */
export const isStale = (s: AttemptSession, now = Date.now()) =>
  !s.stoppedAt && now - Date.parse(s.lastActiveAt) > STALE_SESSION_MS;

export class PageController {
  private state: PageState = {
    loc: null,
    problem: null,
    session: null,
    settings: DEFAULT_SETTINGS,
    ai: { enabled: false },
    analyzing: [],
    panelOpen: false,
    lastResult: null,
    formKey: 0,
    saving: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private ticks = 0;
  private cleanups: Array<() => void> = [];

  constructor(private win: Window) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.state;

  private set(patch: Partial<PageState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private report(err: unknown) {
    console.warn("[leettrack]", err);
    this.set({ error: err instanceof Error ? err.message : String(err) });
  }

  async start() {
    this.cleanups.push(this.subscribe(() => this.syncTopicHiding()));
    const detector = createSubmissionDetector(this.win, {
      onStarted: (e) => void this.onStarted(e).catch((err) => this.report(err)),
      onResult: (e) => void this.onResult(e).catch((err) => this.report(err)),
    });
    const timer = this.win.setInterval(() => this.tick(), 1000);
    const onVisibility = () => {
      if (this.win.document.visibilityState === "hidden") void this.flush();
      else void this.refreshSettings();
    };
    const onPageHide = () => void this.flush();
    this.win.document.addEventListener("visibilitychange", onVisibility);
    this.win.addEventListener("pagehide", onPageHide);
    this.cleanups.push(
      detector,
      () => this.win.clearInterval(timer),
      () => {
        this.win.document.removeEventListener("visibilitychange", onVisibility);
        this.win.removeEventListener("pagehide", onPageHide);
      },
    );
    await this.refreshSettings();
    await this.onLocationChange(this.win.location.href);
  }

  stop() {
    void this.flush();
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
  }

  private async refreshSettings() {
    try {
      const [settings, ai] = await Promise.all([call("getSettings"), call("getAiStatus")]);
      this.set({ settings, ai });
    } catch (err) {
      this.report(err);
    }
  }

  async onLocationChange(href: string) {
    const loc = parseProblemUrl(href);
    const prevSlug = this.state.loc?.slug;
    if (loc?.slug !== prevSlug) {
      await this.flush();
      this.set({
        loc,
        problem: null,
        session: null,
        lastResult: null,
        error: null,
        formKey: this.state.formKey + 1,
      });
      if (loc) await this.loadProblem(loc.slug);
    } else {
      this.set({ loc });
    }
    if (loc && isSolutionTab(loc.tab)) this.markViewedSolution();
  }

  private async loadProblem(slug: string) {
    try {
      const [problem, existing] = await Promise.all([
        call("getProblemState", slug),
        call("getSession", slug),
      ]);
      if (this.state.loc?.slug !== slug) return;
      // A submission may have started a session in memory while these loaded: keep it.
      const live = this.state.session?.slug === slug ? this.state.session : null;
      const stored = existing && !isStale(existing) ? existing : null;
      const session = mergeSessions(stored, live) ?? newSession(slug);
      if (session !== existing) await call("putSession", session);
      this.set({ problem, session });
      // Suggestions that never arrived (page closed mid-request, or a different problem open).
      for (const c of session.checkpoints ?? []) {
        if (!c.suggestion && !c.suggestionError) void this.analyzeCheckpoint(c.at);
      }
      const cached = problem.problem;
      const fresh =
        cached && cached.frontendId && Date.now() - Date.parse(cached.updatedAt) < METADATA_TTL_MS;
      if (!fresh) {
        const meta = await fetchProblemMetadata(slug);
        if (meta && this.state.loc?.slug === slug)
          this.set({ problem: await call("upsertProblemMeta", meta) });
      }
    } catch (err) {
      this.report(err);
    }
  }

  private tick() {
    const { session } = this.state;
    if (!session || session.stoppedAt || this.win.document.visibilityState !== "visible") return;
    this.set({
      session: {
        ...session,
        activeSeconds: session.activeSeconds + 1,
        lastActiveAt: new Date().toISOString(),
      },
    });
    this.ticks += 1;
    if (this.ticks % FLUSH_EVERY_TICKS === 0) void this.flush();
  }

  private async flush() {
    const { session } = this.state;
    if (!session) return;
    try {
      await call("putSession", session);
    } catch {
      /* extension reloaded or context gone; nothing to do */
    }
  }

  private updateSession(patch: Partial<AttemptSession>) {
    const { session } = this.state;
    if (!session) return;
    this.set({ session: { ...session, ...patch } });
    void this.flush();
  }

  private markViewedSolution() {
    if (this.state.session && !this.state.session.viewedSolutionDetected) {
      this.updateSession({ viewedSolutionDetected: true });
    }
  }

  private ensureSession(slug: string): AttemptSession {
    if (!this.state.session) this.set({ session: newSession(slug) });
    return this.state.session!;
  }

  private async onStarted(e: SubmissionStarted) {
    if (e.slug !== this.state.loc?.slug) return;
    this.ensureSession(e.slug);
    this.updateSession({
      ...(e.lang ? { language: e.lang } : {}),
      ...(e.code !== undefined ? { code: e.code } : {}),
    });
  }

  private async onResult(r: SubmissionResult) {
    const slug = this.state.loc?.slug;
    if (!slug || (r.slug && r.slug !== slug)) return;
    const session = this.ensureSession(slug);
    if (r.submissionId && session.submissionIds.includes(r.submissionId)) return;

    // Runtime, memory and percentiles are deliberately not kept: only the verdict matters here.
    const submission: Submission = { at: r.at, status: r.status };

    const patch: Partial<AttemptSession> = {
      submissions: [...session.submissions, submission],
      submissionIds: r.submissionId
        ? [...session.submissionIds, r.submissionId]
        : session.submissionIds,
    };
    if (r.lang && !session.language) patch.language = r.lang;
    let newCheckpoint: string | undefined;
    if (r.accepted) {
      // Accepted marks a checkpoint and stops the clock right away, before anything async can
      // add another second. A re-submit with no time on the clock since the last checkpoint
      // is the same solution, not a new one.
      const now = new Date().toISOString();
      const checkpoints = session.checkpoints ?? [];
      const last = checkpoints.at(-1);
      if (!last || session.activeSeconds > last.activeSeconds) {
        newCheckpoint = now;
        const language = patch.language ?? session.language;
        patch.checkpoints = [
          ...checkpoints,
          {
            at: now,
            activeSeconds: session.activeSeconds,
            ...(session.code !== undefined ? { code: session.code } : {}),
            ...(language ? { language } : {}),
          },
        ];
      }
      if (!session.stoppedAt) patch.stoppedAt = now;
    }
    this.updateSession(patch);

    if (r.accepted && session.code === undefined) {
      const codePatch: Partial<AttemptSession> = {};
      const editor = await requestEditorCode(this.win);
      if (editor?.code) codePatch.code = editor.code;
      if (editor?.lang && !this.state.session?.language) codePatch.language = editor.lang;
      if (Object.keys(codePatch).length > 0) this.updateSession(codePatch);
    }
    if (newCheckpoint) {
      const code = this.state.session?.code;
      if (code !== undefined)
        this.patchCheckpoint(slug, newCheckpoint, (c) =>
          c.code !== undefined ? c : { ...c, code },
        );
      void this.analyzeCheckpoint(newCheckpoint);
    }

    const mode = this.state.settings.panelAutoOpen;
    const open = mode === "every_submission" || (mode === "accepted" && r.accepted);
    this.set({ lastResult: r, ...(open ? { panelOpen: true } : {}) });
  }

  setPanelOpen(open: boolean) {
    this.set({ panelOpen: open });
  }

  /** Stop or resume the attempt clock. Accepted stops it automatically. */
  setTimerRunning(running: boolean) {
    const { session } = this.state;
    if (!session) return;
    if (running) {
      const { stoppedAt: _stopped, ...rest } = session;
      this.set({ session: { ...rest, lastActiveAt: new Date().toISOString() } });
      void this.flush();
    } else if (!session.stoppedAt) {
      this.updateSession({ stoppedAt: new Date().toISOString() });
    }
  }

  private patchCheckpoint(
    slug: string,
    at: string,
    update: (c: SessionCheckpoint) => SessionCheckpoint,
  ) {
    const session = this.state.session;
    if (!session || session.slug !== slug) return;
    const checkpoints = session.checkpoints ?? [];
    if (!checkpoints.some((c) => c.at === at)) return;
    this.updateSession({ checkpoints: checkpoints.map((c) => (c.at === at ? update(c) : c)) });
  }

  /** Ask the configured model for this checkpoint's complexity. Sends its code to the provider. */
  async analyzeCheckpoint(at: string) {
    const { session, problem, ai, analyzing } = this.state;
    if (!ai.enabled || !session || analyzing.includes(at)) return;
    const checkpoint = session.checkpoints?.find((c) => c.at === at);
    if (!checkpoint?.code) return;
    const slug = session.slug;
    const meta = problem?.slug === slug ? problem.problem : undefined;
    const language = checkpoint.language ?? session.language;
    this.set({ analyzing: [...analyzing, at] });
    let result: Pick<SessionCheckpoint, "suggestion" | "suggestionError">;
    try {
      const suggestion = await call("analyzeComplexity", {
        slug,
        code: checkpoint.code,
        ...(language ? { language } : {}),
        ...(meta?.title ? { title: meta.title } : {}),
        ...(meta?.frontendId ? { frontendId: meta.frontendId } : {}),
      });
      result = { suggestion };
    } catch (err) {
      result = { suggestionError: err instanceof Error ? err.message : String(err) };
    } finally {
      this.set({ analyzing: this.state.analyzing.filter((a) => a !== at) });
    }
    this.patchCheckpoint(slug, at, (c) => {
      const { suggestion: _s, suggestionError: _e, ...rest } = c;
      return { ...rest, ...result };
    });
  }

  /** Drop a checkpoint that wasn't a new solution (e.g. the same code submitted again). */
  removeCheckpoint(index: number) {
    const checkpoints = this.state.session?.checkpoints;
    if (!checkpoints?.[index]) return;
    this.updateSession({ checkpoints: checkpoints.filter((_, i) => i !== index) });
  }

  async addCustomPattern(name: string): Promise<string | null> {
    try {
      const { id, settings } = await call("addCustomPattern", name);
      this.set({ settings });
      return id;
    } catch (err) {
      this.report(err);
      return null;
    }
  }

  startNewAttempt() {
    const slug = this.state.loc?.slug;
    if (!slug) return;
    this.set({ session: newSession(slug), formKey: this.state.formKey + 1, lastResult: null });
    void this.flush();
  }

  async saveAttempt(draft: AttemptDraft) {
    const { loc, problem, session } = this.state;
    if (!loc || !problem || !session) return;
    this.set({ saving: true, error: null });
    try {
      const suggested =
        suggestRating(draft, {
          solveSeconds: solveSeconds(session),
          medianSeconds: problem.medianSolveSeconds,
        }) ?? 1;
      const attempt = buildAttempt({
        slug: loc.slug,
        draft,
        session,
        suggestedRating: suggested,
        priorAttemptCount: problem.attempts.length,
      });
      const next = await call("saveAttempt", { attempt, patterns: draft.patterns });
      this.set({ problem: next, session: null, lastResult: null, formKey: this.state.formKey + 1 });
    } catch (err) {
      this.report(err);
    } finally {
      this.set({ saving: false });
    }
  }

  /** Save a quick review (spec 5.4) as an attempt; it schedules like any other. */
  async saveQuickReview(input: QuickReviewInput) {
    const { loc, session } = this.state;
    if (!loc || !session) return;
    this.set({ saving: true, error: null });
    try {
      const attempt = buildQuickAttempt({ slug: loc.slug, session, ...input });
      const next = await call("saveAttempt", { attempt, patterns: [] });
      this.set({ problem: next, session: null, lastResult: null, formKey: this.state.formKey + 1 });
    } catch (err) {
      this.report(err);
    } finally {
      this.set({ saving: false });
    }
  }

  /**
   * With the setting on, hide LeetCode's topic tags while the attempt clock runs, so they
   * don't give the approach away (spec 4.4). They come back when the clock stops.
   */
  private syncTopicHiding() {
    const { settings, session } = this.state;
    const hide = settings.hideTopicsWhileSolving && !!session && !session.stoppedAt;
    const doc = this.win.document;
    const existing = doc.getElementById(HIDE_TOPICS_ID);
    if (hide && !existing) {
      const style = doc.createElement("style");
      style.id = HIDE_TOPICS_ID;
      // LeetCode renders each topic as a link to /tag/<slug>/ in the "Topics" section.
      style.textContent = 'a[href^="/tag/"] { display: none !important; }';
      (doc.head ?? doc.documentElement).append(style);
    } else if (!hide && existing) {
      existing.remove();
    }
  }

  async setStatusOverride(override: StatusOverride | null) {
    const slug = this.state.loc?.slug;
    if (!slug) return;
    try {
      this.set({ problem: await call("setStatusOverride", { slug, override }) });
    } catch (err) {
      this.report(err);
    }
  }
}
