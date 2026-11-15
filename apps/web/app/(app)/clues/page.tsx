import Link from "next/link";
import { clueJournal } from "@leettrack/insights";
import { Panel } from "@leettrack/ui/components/panel";
import { PageHead } from "@/components/PageHead";
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
      <PageHead title="Clue Journal">
        {count === 0 ? "No clues yet" : `${count} clue${count === 1 ? "" : "s"}`}
      </PageHead>

      {groups.length === 0 ? (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-muted-foreground">
            When you log an attempt, add a <strong className="text-foreground">pattern clue</strong>
            : what in the problem told you which pattern to use. They collect here, by pattern, as
            your own cheat sheet for spotting patterns in new problems.
          </p>
        </div>
      ) : (
        <>
          <nav aria-label="Patterns">
            <ul className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <li key={g.patternId}>
                  <a
                    className="flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm text-foreground no-underline ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:no-underline"
                    href={`#${anchor(g.patternId)}`}
                  >
                    {g.name}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {g.entries.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid items-start gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <Panel
                key={g.patternId}
                id={anchor(g.patternId)}
                className="[&_h2]:scroll-mt-20"
                title={
                  g.patternId ? <Link href={`/patterns#${g.patternId}`}>{g.name}</Link> : g.name
                }
              >
                <ul className="flex flex-col gap-3">
                  {g.entries.map((e) => (
                    <li key={e.attemptId} className="flex flex-col gap-1">
                      <blockquote className="border-l-2 border-primary/60 pl-3">
                        {e.clue}
                      </blockquote>
                      <span className="pl-3.5 text-xs text-muted-foreground">
                        <Link href={`/problems/${e.slug}`}>
                          {e.frontendId ? `${e.frontendId}. ` : ""}
                          {e.title}
                        </Link>{" "}
                        · {formatDate(e.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        </>
      )}
    </>
  );
}
