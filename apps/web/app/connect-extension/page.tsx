import { Button } from "@leettrack/ui/components/button";
import { Logo } from "@/components/Logo";
import { signInWithGitHub } from "@/lib/actions";
import { getViewer } from "@/lib/data";
import { DEMO, EXTENSION_IDS } from "@/lib/env";
import { ConnectExtension } from "./ConnectExtension";

export const metadata = { title: "Connect the extension" };

/**
 * The extension opens this page with its id (?ext=…). After GitHub sign-in, the page hands
 * the session to that extension, which then syncs in the background (spec 10.3).
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ ext?: string }>;
}) {
  const { ext = "" } = await searchParams;
  const viewer = await getViewer();
  const allowed = EXTENSION_IDS.length === 0 || EXTENSION_IDS.includes(ext);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4 py-16">
      <div className="flex items-center gap-3">
        <Logo className="size-8" />
        <h1 className="text-2xl font-semibold tracking-tight">Connect the extension</h1>
      </div>
      {DEMO ? (
        <p className="text-muted-foreground">
          The demo has no accounts, so there&apos;s nothing to connect.
        </p>
      ) : !/^[a-p]{32}$/.test(ext) || !allowed ? (
        <p className="text-bad">
          Open this page from the LeetTrack extension&apos;s settings (Sign in), so it knows which
          extension to connect.
        </p>
      ) : !viewer ? (
        <>
          <p className="text-muted-foreground">
            Sign in first; then this page connects the extension.
          </p>
          <form action={signInWithGitHub}>
            <input type="hidden" name="next" value={`/connect-extension?ext=${ext}`} />
            <Button type="submit">Sign in with GitHub</Button>
          </form>
        </>
      ) : (
        <ConnectExtension
          extensionId={ext}
          viewerName={viewer.name}
          confirmId={EXTENSION_IDS.length === 0}
        />
      )}
    </main>
  );
}
