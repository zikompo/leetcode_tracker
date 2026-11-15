import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGitHub } from "@/lib/actions";
import { getViewer } from "@/lib/data";
import { DEMO, SUPABASE_CONFIGURED } from "@/lib/env";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; deleted?: string }>;
}) {
  const { next, error, deleted } = await searchParams;
  const viewer = await getViewer();
  if (viewer && !DEMO) redirect(next ?? "/dashboard");

  return (
    <main className="landing">
      <h1>LeetTrack</h1>
      <p className="muted">
        The companion site for the LeetTrack Chrome extension. Everything you log on LeetCode, with
        your reviews, pattern mastery and progress through Blind 75 and NeetCode.
      </p>
      <ul>
        <li>Today&apos;s reviews, your streak and where you&apos;re weakest.</li>
        <li>Every attempt with notes, and a diff of your code between attempts.</li>
        <li>Mastery per pattern: retention, cold-solve rate and coverage.</li>
      </ul>
      {deleted && <p className="ok">Your account and all of its data were deleted.</p>}
      {error && <p className="bad">{error}</p>}
      {DEMO ? (
        <div className="row">
          <Link className="btn btn-primary" href="/dashboard">
            Open the demo
          </Link>
          <span className="muted small">Sample data; nothing is saved.</span>
        </div>
      ) : SUPABASE_CONFIGURED ? (
        <form action={signInWithGitHub}>
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <button className="btn btn-primary" type="submit">
            Sign in with GitHub
          </button>
        </form>
      ) : (
        <p className="bad small">
          Sign-in isn&apos;t set up yet: add your Supabase project to{" "}
          <code>apps/web/.env.local</code> (see <code>docs/supabase-setup.md</code>), or run with{" "}
          <code>LEETTRACK_DEMO=1</code>.
        </p>
      )}
    </main>
  );
}
