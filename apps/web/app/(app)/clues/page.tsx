import Link from "next/link";
import { clueJournal } from "@leettrack/insights";
import { loadSnapshot } from "@/lib/data";
import { formatDate } from "@/lib/util";

export const metadata = { title: "Clue Journal" };

/** Every "what told you the pattern" note, by pattern: a cheat sheet for spotting them (spec 7.1). */
export default async function CluesPage() {
  const { snap } = await loadSnapshot();
  const groups = clueJournal(snap);
  const count = new Set(groups.flatMap((g) => g.entries.map((e) => e.attemptId))).size;
  const anchor = (id: string) => `clues-${id || "none"}`;

  return (
    <>
      <div className="page-head">
        <h1>Clue Journal</h1>
        <span className="muted small">
          {count === 0 ? "No clues yet" : `${count} clue${count === 1 ? "" : "s"}`}
        </span>
      </div>

      {groups.length === 0 ? (
        <section className="card">
          <p className="muted">
            When you log an attempt, add a <strong>pattern clue</strong>: what in the problem told
            you which pattern to use. They collect here, by pattern, as your own cheat sheet for
            spotting patterns in new problems.
          </p>
        </section>
      ) : (
        <>
          <nav aria-label="Patterns">
            <ul className="chip-grid">
              {groups.map((g) => (
                <li key={g.patternId}>
                  <a className="chip-link" href={`#${anchor(g.patternId)}`}>
                    {g.name}
                    <span className="chip-count">{g.entries.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="clue-groups">
            {groups.map((g) => (
              <section
                key={g.patternId}
                id={anchor(g.patternId)}
                className="card"
                aria-labelledby={`${anchor(g.patternId)}-h`}
              >
                <h2 id={`${anchor(g.patternId)}-h`}>
                  {g.patternId ? <Link href={`/patterns#${g.patternId}`}>{g.name}</Link> : g.name}
                </h2>
                <ul className="list clue-list">
                  {g.entries.map((e) => (
                    <li key={e.attemptId}>
                      <blockquote className="clue">{e.clue}</blockquote>
                      <span className="muted small">
                        <Link href={`/problems/${e.slug}`}>
                          {e.frontendId ? `${e.frontendId}. ` : ""}
                          {e.title}
                        </Link>{" "}
                        · {formatDate(e.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
