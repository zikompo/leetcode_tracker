import Link from "next/link";
import { dateKey } from "@leettrack/core";
import { Panel } from "@leettrack/ui/components/panel";
import { PageHead } from "@/components/PageHead";
import { loadSnapshot } from "@/lib/data";
import { MockForm, MockList } from "./MockForms";

export const metadata = { title: "Mock interviews" };

/** A log of mock interviews (spec 7.1, page 9): date, problem, how it went, notes. */
export default async function MocksPage() {
  const { snap } = await loadSnapshot();
  const mocks = snap.mocks.map((m) => {
    const info = m.problem ? snap.info(m.problem) : {};
    return {
      ...m,
      // A LeetCode problem gets its title and a link; anything else shows as written.
      ...(info.title ? { problemTitle: info.title, problemSlug: m.problem } : {}),
    };
  });
  const lastFour = snap.mocks.filter(
    (m) => m.date >= dateKey(new Date(snap.now.getTime() - 28 * 86_400_000)),
  );

  return (
    <>
      <PageHead title="Mock interviews">
        {snap.mocks.length === 0
          ? "None logged yet"
          : `${snap.mocks.length} logged · ${lastFour.length} in the last four weeks`}
      </PageHead>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel
          title="Log a mock"
          description="Out loud, with a 45-minute timer. A problem's URL or slug links it."
        >
          <MockForm today={dateKey(snap.now)} />
        </Panel>
        <Panel title="History" className="lg:col-span-2">
          {mocks.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing yet. Aim for one a week; your notes here become a list of what to fix.
              Interview dates live on the <Link href="/plan">Plan</Link> page.
            </p>
          ) : (
            <MockList mocks={mocks} today={dateKey(snap.now)} />
          )}
        </Panel>
      </div>
    </>
  );
}
