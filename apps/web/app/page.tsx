import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@leettrack/ui/components/button";
import { Notice } from "@leettrack/ui/components/panel";
import { Logo } from "@/components/Logo";
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
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <div className="flex items-center gap-3">
        <Logo className="size-10" />
        <h1 className="text-3xl font-semibold tracking-tight">LeetTrack</h1>
      </div>
      <p className="text-muted-foreground">
        The companion site for the LeetTrack Chrome extension. Everything you log on LeetCode, with
        your reviews, pattern mastery and progress through Blind 75 and NeetCode.
      </p>
      <ul className="flex flex-col gap-2">
        {[
          "Today's reviews, your streak and where you're weakest.",
          "Every attempt with notes, and a diff of your code between attempts.",
          "Mastery per pattern: retention, cold-solve rate and coverage.",
          "A plan toward each interview date, with a pace chart.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      {deleted && <Notice ok>Your account and all of its data were deleted.</Notice>}
      {error && <Notice ok={false}>{error}</Notice>}
      {DEMO ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link
              href="/dashboard"
              className="text-primary-foreground no-underline hover:no-underline"
            >
              Open the demo
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">Sample data; nothing is saved.</span>
        </div>
      ) : SUPABASE_CONFIGURED ? (
        <form action={signInWithGitHub}>
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <Button size="lg" type="submit">
            Sign in with GitHub
          </Button>
        </form>
      ) : (
        <p className="text-xs text-bad" data-slot="setup-needed">
          Sign-in isn&apos;t set up yet: add your Supabase project to{" "}
          <code>apps/web/.env.local</code> (see <code>docs/supabase-setup.md</code>), or run with{" "}
          <code>LEETTRACK_DEMO=1</code>.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        <Link href="/privacy">Privacy policy</Link>
      </p>
    </main>
  );
}
