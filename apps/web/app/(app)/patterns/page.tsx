import Link from "next/link";
import { MASTERY_LABELS, STATUS_LABELS, type PatternMastery } from "@leettrack/core";
import { masteryFrom, patternName, problemRows } from "@leettrack/insights";
import { loadSnapshot } from "@/lib/data";
import { pct } from "@/lib/util";

export const metadata = { title: "Patterns" };

const LEVEL_CLASS: Record<string, string> = {
  not_started: "status-unseen",
  learning: "status-in_progress",
  developing: "status-solved_with_help",
  proficient: "status-fully_solved",
  mastered: "status-mastered",
};

function Breakdown({ m }: { m: PatternMastery }) {
  return (
    <dl
      className="small"
      style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", margin: 0 }}
    >
      <dt className="muted">Retention</dt>
      <dd style={{ margin: 0 }}>
        {pct(m.retention)} · how well you&apos;d recall what you&apos;ve solved
      </dd>
      <dt className="muted">Cold-solve</dt>
      <dd style={{ margin: 0 }}>
        {pct(m.coldSolve)} · {m.coldSolved} of {m.coldAttempts} first attempts solved alone
      </dd>
      <dt className="muted">Coverage</dt>
      <dd style={{ margin: 0 }}>
        {m.coverage === undefined
          ? "not in your active lists"
          : `${pct(m.coverage)} of ${m.listTotal} list problems`}
      </dd>
    </dl>
  );
}

export default async function PatternsPage() {
  const { snap } = await loadSnapshot();
  const mastery = masteryFrom(snap);
  const rows = problemRows(snap);
  const name = (id: string) => patternName(id, snap.settings);
  const started = mastery.filter((m) => m.attempted > 0).sort((a, b) => b.mastery - a.mastery);
  const notStarted = mastery
    .filter((m) => m.attempted === 0)
    .sort((a, b) => name(a.pattern).localeCompare(name(b.pattern)));

  return (
    <>
      <div className="page-head">
        <h1>Patterns</h1>
        <span className="muted small">
          Mastery = 50% retention + 30% cold-solve + 20% coverage of your active lists.
        </span>
      </div>
      {started.length === 0 && <p className="muted">No attempts yet, so no pattern scores.</p>}
      <div className="grid">
        {started.map((m) => {
          const problems = rows.filter((r) => r.attempts > 0 && r.patterns.includes(m.pattern));
          return (
            <section
              key={m.pattern}
              id={m.pattern}
              className="card stack"
              aria-label={name(m.pattern)}
            >
              <div className="row spread">
                <h3>{name(m.pattern)}</h3>
                <span className={`status ${LEVEL_CLASS[m.level]}`}>{MASTERY_LABELS[m.level]}</span>
              </div>
              <div className="row">
                <div className="bar" style={{ flex: 1 }} aria-label={`Mastery ${pct(m.mastery)}`}>
                  <span className="seg-fully_solved" style={{ width: pct(m.mastery) }} />
                </div>
                <strong>{pct(m.mastery)}</strong>
              </div>
              <Breakdown m={m} />
              <details>
                <summary>
                  {problems.length} problem{problems.length === 1 ? "" : "s"} attempted
                </summary>
                <ul className="list" style={{ marginTop: 8 }}>
                  {problems.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/problems/${p.slug}`}>{p.title}</Link>
                      <span className={`status status-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          );
        })}
      </div>
      {notStarted.length > 0 && (
        <section className="card" aria-labelledby="not-started">
          <h2 id="not-started">Not started</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            Patterns in your active lists you haven&apos;t tried yet, with how many problems use
            each. Which problems isn&apos;t shown, so it doesn&apos;t give the approach away.
          </p>
          <ul className="chip-grid">
            {notStarted.map((m) => (
              <li key={m.pattern} className="chip-link">
                <span>{name(m.pattern)}</span>
                {m.listTotal > 0 && (
                  <span className="chip-count" title="Problems in your active lists">
                    {m.listTotal}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
