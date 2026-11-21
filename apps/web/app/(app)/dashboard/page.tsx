import { Term } from "@leettrack/ui/components/term";
import Link from "next/link";
import {
  activity,
  confidenceGauge,
  countdowns,
  dashboardFrom,
  patternName,
  queueFrom,
  statsFrom,
} from "@leettrack/insights";
import { Badge } from "@leettrack/ui/components/badge";
import { ConfidenceGauge } from "@leettrack/ui/components/confidence-gauge";
import { Heatmap } from "@leettrack/ui/components/heatmap";
import { Panel, Stat } from "@leettrack/ui/components/panel";
import { cn } from "@leettrack/ui/lib/utils";
import { PageHead } from "@/components/PageHead";
import { QueueList } from "@/components/QueueList";
import { loadSnapshot } from "@/lib/data";
import { formatDate, pct } from "@/lib/util";

export const metadata = { title: "Dashboard" };

const MOCK_OUTCOME = { passed: "went well", mixed: "mixed", struggled: "struggled" } as const;

/** Reviews listed before the rest fold away, so Today stays about as tall as the side column. */
const SHOWN_REVIEWS = 10;
/** Rows in Today from which the pattern cards move to the side column. */
const HEAVY_TODAY_ROWS = 7;

export default async function DashboardPage() {
  const { snap } = await loadSnapshot();
  const queue = queueFrom(snap);
  const stats = statsFrom(snap);
  const dash = dashboardFrom(snap);
  const gauge = confidenceGauge(snap);
  const act = activity(snap.attempts, snap.now);
  const name = (id: string) => patternName(id, snap.settings);
  const reviews = queue.items.filter((i) => i.kind === "review");
  const fresh = queue.items.filter((i) => i.kind === "new");
  const upcoming = countdowns(snap);
  const latestMock = snap.mocks[0];

  // The pattern cards sit under Today on a light day, and move to the side column on a heavy
  // one, so the two columns come out about the same height.
  const shownRows = Math.min(reviews.length, SHOWN_REVIEWS) + fresh.length;
  const heavyToday = shownRows >= HEAVY_TODAY_ROWS;
  const weakest = (
    <Panel title="Weakest patterns">
      {dash.insights.weakest.length === 0 ? (
        <p className="text-muted-foreground">Log some attempts to see where you&apos;re weakest.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {dash.insights.weakest.map((m) => (
            <li key={m.pattern} className="flex items-center justify-between gap-2">
              <Link href={`/patterns/${m.pattern}`}>{name(m.pattern)}</Link>
              <span className="text-xs text-muted-foreground">mastery {pct(m.mastery)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
  const coldGap = (
    <Panel title={<Term k="coldGap">Can re-solve, hard to spot fresh</Term>} id="panel-cold-gap">
      {dash.insights.retentionColdGap.length === 0 ? (
        <p className="text-muted-foreground">
          No patterns where you remember solutions but miss them cold.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {dash.insights.retentionColdGap.map((m) => (
            <li key={m.pattern} className="flex items-center justify-between gap-2">
              <Link href={`/patterns/${m.pattern}`}>{name(m.pattern)}</Link>
              <span className="text-xs text-muted-foreground">
                retention {pct(m.retention)} · cold {pct(m.coldSolve)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  return (
    <>
      <PageHead title="Dashboard">
        {snap.now.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </PageHead>

      {snap.attempts.length === 0 && (
        <Panel title="Get started" description="Nothing logged on this account yet.">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>Install the LeetTrack extension in Chrome.</li>
            <li>
              In its settings, click <strong>Sign in with GitHub</strong> to connect it to this
              account.
            </li>
            <li>
              Solve a problem on LeetCode. After an Accepted, the log panel saves it in one tap.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Have history already? Import a LeetTrack export or your prep-tracker file on the{" "}
            <Link href="/settings">Settings</Link> page.
          </p>
        </Panel>
      )}

      {/*
        Two rows. In each, the cards share a height and the last card of each column grows to
        fill it, so every edge lines up. Below lg the columns dissolve (contents) and the cards
        flow in reading order, small ones in pairs.
      */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Panel
          className="max-lg:order-1 md:col-span-2 lg:col-span-2"
          title="To do today"
          bodyClassName="flex-1 justify-center"
        >
          <ConfidenceGauge
            {...gauge}
            className="max-sm:flex-col max-sm:items-stretch max-sm:[&>div:first-child]:self-center"
          />
        </Panel>
        <div className="flex flex-col gap-4 max-lg:contents">
          {(upcoming.length > 0 || latestMock) && (
            <Panel className="max-lg:order-2" title="Interviews">
              {upcoming.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {upcoming.map((c) => (
                    <li key={c.id}>
                      <Link
                        href="/plan"
                        className="-mx-2 flex items-baseline gap-3 rounded-md px-2 py-1 text-foreground no-underline transition-colors hover:bg-accent hover:no-underline"
                      >
                        <strong className="w-10 text-right text-xl font-semibold text-primary tabular-nums">
                          {c.daysLeft === 0 ? "Today" : c.daysLeft}
                        </strong>{" "}
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {c.daysLeft === 0 ? "" : `day${c.daysLeft === 1 ? "" : "s"} to `}
                          {c.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {latestMock && (
                <Link
                  href="/mocks"
                  className="-mx-2 flex flex-col rounded-md px-2 py-1 text-foreground no-underline transition-colors hover:bg-accent hover:no-underline"
                >
                  <span className="text-xs text-muted-foreground">
                    Latest mock · {formatDate(latestMock.date)}
                    {latestMock.outcome ? ` · ${MOCK_OUTCOME[latestMock.outcome]}` : ""}
                  </span>
                  <span className="line-clamp-2 text-sm">
                    {latestMock.notes || latestMock.problem}
                  </span>
                </Link>
              )}
            </Panel>
          )}
          <Panel
            className={cn(
              "flex-1 max-lg:order-3",
              upcoming.length === 0 && !latestMock && "md:col-span-2",
            )}
            title="Summary"
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat value={reviews.length} label="reviews due today" />
              <Stat value={act.streak} label={<Term k="streak">day streak</Term>} />
              <Stat value={stats.problemsAttempted} label="problems attempted" />
              <Stat value={stats.fullySolved} label="fully solved" />
              <Stat value={stats.attempts} label="attempts logged" />
              <Stat value={stats.leeches} label={<Term k="leech">leeches</Term>} />
            </div>
          </Panel>
        </div>
      </div>

      {/*
        Light day: Today beside Activity, and the pattern cards beside Leeches, each pair sharing
        a row. Heavy day: Today spans the side column, which takes the pattern cards too.
      */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Panel
          className={cn("max-lg:order-1 md:col-span-2", heavyToday && "lg:row-span-4")}
          title="Today"
          action={
            <Link href="/review" className="text-xs">
              Review queue →
            </Link>
          }
        >
          {reviews.length === 0 && fresh.length === 0 ? (
            <p className="text-muted-foreground">
              {queue.noNewFor
                ? `Nothing due. No new problems before ${queue.noNewFor.label}: rest up.`
                : "Nothing due, and no new problems queued."}
            </p>
          ) : (
            <>
              {reviews.length > 0 && <QueueList items={reviews.slice(0, SHOWN_REVIEWS)} />}
              {reviews.length > SHOWN_REVIEWS && (
                <details>
                  <summary className="cursor-pointer text-xs text-link">
                    Show {reviews.length - SHOWN_REVIEWS} more due today
                  </summary>
                  <div className="mt-2">
                    <QueueList items={reviews.slice(SHOWN_REVIEWS)} />
                  </div>
                </details>
              )}
              {queue.reviewsDue > reviews.length && (
                <p className="text-xs text-muted-foreground">
                  {queue.reviewsDue - reviews.length} more due, held back by your daily limit.
                </p>
              )}
              {queue.noNewFor && (
                <p className="text-xs text-muted-foreground">
                  No new problems today: {queue.noNewFor.label} is close, so it&apos;s reviews only.
                </p>
              )}
              {fresh.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">
                    {upcoming.length > 0 ? "New, from your plan" : "New from your active lists"}
                  </span>
                  <QueueList items={fresh} />
                </>
              )}
            </>
          )}
        </Panel>
        <Panel className="max-lg:order-2" title="Activity">
          <Heatmap activity={act} />
          <p className="text-xs text-muted-foreground">
            {act.total} attempts on {act.activeDays} day{act.activeDays === 1 ? "" : "s"} in the
            last six months.
          </p>
        </Panel>
        {heavyToday ? (
          <>
            <div className="grid max-lg:order-4">{weakest}</div>
            <div className="grid max-lg:order-4">{coldGap}</div>
          </>
        ) : (
          <div className="grid gap-4 max-lg:order-4 md:col-span-2 md:grid-cols-2">
            {weakest}
            {coldGap}
          </div>
        )}
        <Panel className="max-lg:order-3" title={<Term k="leech">Leeches</Term>} id="panel-leeches">
          {dash.leeches.length === 0 ? (
            <p className="text-muted-foreground">None. A problem becomes one after three Agains.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {dash.leeches.map((l) => (
                <li key={l.slug} className="flex flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <Link href={`/problems/${l.slug}`}>{l.title}</Link>
                    <Badge variant="destructive">Again ×{l.againCount}</Badge>
                  </span>
                  {l.stuckNotes.at(-1) && (
                    <span className="text-xs text-muted-foreground">
                      Last stuck on: {l.stuckNotes.at(-1)!.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
