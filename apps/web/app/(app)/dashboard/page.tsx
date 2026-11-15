import Link from "next/link";
import { activity, dashboardFrom, patternName, queueFrom, statsFrom } from "@leettrack/insights";
import { Heatmap } from "@/components/Heatmap";
import { QueueList } from "@/components/QueueList";
import { loadSnapshot } from "@/lib/data";
import { pct } from "@/lib/util";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { snap } = await loadSnapshot();
  const queue = queueFrom(snap);
  const stats = statsFrom(snap);
  const dash = dashboardFrom(snap);
  const act = activity(snap.attempts, snap.now);
  const name = (id: string) => patternName(id, snap.settings);
  const reviews = queue.items.filter((i) => i.kind === "review");
  const fresh = queue.items.filter((i) => i.kind === "new");

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="muted small">
          {snap.now.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>

      <section className="stats" aria-label="Summary">
        <div className="card stat">
          <strong>{reviews.length}</strong>
          <span>reviews due today</span>
        </div>
        <div className="card stat">
          <strong>{act.streak}</strong>
          <span>day streak</span>
        </div>
        <div className="card stat">
          <strong>{stats.problemsAttempted}</strong>
          <span>problems attempted</span>
        </div>
        <div className="card stat">
          <strong>{stats.fullySolved}</strong>
          <span>fully solved</span>
        </div>
        <div className="card stat">
          <strong>{stats.leeches}</strong>
          <span>leeches</span>
        </div>
      </section>

      <div className="grid">
        <section className="card" aria-labelledby="today">
          <h2 id="today">Today</h2>
          {reviews.length === 0 && fresh.length === 0 ? (
            <p className="muted">Nothing due, and no new problems queued.</p>
          ) : (
            <div className="stack">
              {reviews.length > 0 && <QueueList items={reviews} />}
              {queue.reviewsDue > reviews.length && (
                <p className="muted small">
                  {queue.reviewsDue - reviews.length} more due, held back by your daily limit.
                </p>
              )}
              {fresh.length > 0 && (
                <>
                  <span className="muted small">New from your active lists</span>
                  <QueueList items={fresh} />
                </>
              )}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="activity">
          <h2 id="activity">Activity</h2>
          <Heatmap activity={act} />
          <p className="muted small">
            {act.total} attempts on {act.activeDays} days in the last six months.
          </p>
        </section>
      </div>

      <div className="grid">
        <section className="card" aria-labelledby="weakest">
          <h2 id="weakest">Weakest patterns</h2>
          {dash.insights.weakest.length === 0 ? (
            <p className="muted">Log some attempts to see where you&apos;re weakest.</p>
          ) : (
            <ul className="list">
              {dash.insights.weakest.map((m) => (
                <li key={m.pattern}>
                  <Link href={`/patterns#${m.pattern}`}>{name(m.pattern)}</Link>
                  <span className="muted small">mastery {pct(m.mastery)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="gap">
          <h2 id="gap">Can re-solve, hard to spot fresh</h2>
          {dash.insights.retentionColdGap.length === 0 ? (
            <p className="muted">No patterns where you remember solutions but miss them cold.</p>
          ) : (
            <ul className="list">
              {dash.insights.retentionColdGap.map((m) => (
                <li key={m.pattern}>
                  <Link href={`/patterns#${m.pattern}`}>{name(m.pattern)}</Link>
                  <span className="muted small">
                    retention {pct(m.retention)} · cold {pct(m.coldSolve)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="leeches">
          <h2 id="leeches">Leeches</h2>
          {dash.leeches.length === 0 ? (
            <p className="muted">None. A problem becomes one after three Agains.</p>
          ) : (
            <ul className="list">
              {dash.leeches.map((l) => (
                <li key={l.slug} className="stack" style={{ alignItems: "stretch", gap: 2 }}>
                  <span className="row spread">
                    <Link href={`/problems/${l.slug}`}>{l.title}</Link>
                    <span className="pill pill-bad">Again ×{l.againCount}</span>
                  </span>
                  {l.stuckNotes.at(-1) && (
                    <span className="muted small">Last stuck on: {l.stuckNotes.at(-1)!.note}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
