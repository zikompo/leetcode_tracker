import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Privacy policy",
  description: "What LeetTrack stores, where, and who can see it.",
};

const UPDATED = "15 November 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/** Public: linked from the Chrome Web Store listing, the extension and the site. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 font-semibold text-foreground no-underline"
        >
          <Logo /> LeetTrack
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="text-xs text-muted-foreground">Last updated {UPDATED}</p>
      </div>

      <p className="text-sm leading-relaxed">
        LeetTrack is a Chrome extension and companion website for keeping track of your LeetCode
        practice. This page says what it stores, where, and who can see it. In short: your data is
        yours, it stays in your browser unless you choose to sign in, and it is never sold or used
        for advertising.
      </p>

      <Section title="What the extension stores">
        <p>
          On leetcode.com problem pages (and on neetcode.io, if you turn that on in the
          extension&apos;s settings), the extension records your <strong>attempts</strong>: the
          problem&apos;s name and number, when you started and finished, time spent, your
          submissions&apos; results, the language and code of your solutions, and what you enter in
          the log panel (outcome, help used, complexity, patterns, ratings, notes). It also keeps
          your settings, lists, interview dates and mock-interview notes.
        </p>
        <p>
          It never stores <strong>problem statements</strong> or other LeetCode or NeetCode content
          beyond a problem&apos;s title, number, difficulty and topic tags. It reads nothing on
          other sites.
        </p>
        <p>
          All of this is kept <strong>locally in your browser</strong> (the extension&apos;s own
          storage) and works without an account.
        </p>
      </Section>

      <Section title="If you sign in">
        <p>
          Signing in with GitHub is optional. If you do, your records are synced to the LeetTrack
          database (hosted on Supabase) so you can see them on this website and on other devices.
          Each record is tied to your account and protected so that only you can read or change it.
          From GitHub sign-in we receive your GitHub username, name, avatar and email address, used
          only to show who is signed in.
        </p>
      </Section>

      <Section title="Optional features that send data elsewhere">
        <p>
          These are off until you turn them on, and each sends data only to a service you choose:
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <strong>GitHub commits:</strong> your Accepted solutions and a summary of your attempts
            are committed to a repository you pick, through a GitHub App you install. The sign-in
            for it stays in your browser.
          </li>
          <li>
            <strong>AI suggestions:</strong> to estimate a solution&apos;s complexity, its code and
            the problem&apos;s name go to the AI provider you configure, with your own API key,
            which stays in your browser. To draft &ldquo;what if&rdquo; twists, only the
            problem&apos;s name is sent.
          </li>
        </ul>
      </Section>

      <Section title="What we don't do">
        <p>
          No analytics, tracking, ads, or selling or sharing of data. Your data is used only to
          provide LeetTrack&apos;s features to you.
        </p>
      </Section>

      <Section title="Your control">
        <p>
          Export everything as a JSON file at any time, from the extension&apos;s settings or the
          website&apos;s settings. Signing out stops syncing. Deleting your account on the
          website&apos;s settings page permanently removes your account and everything synced to it;
          data in the extension stays in your browser until you remove the extension.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, the date at the top changes too, and anything significant is noted
          in the extension&apos;s release notes.
        </p>
      </Section>
    </main>
  );
}
