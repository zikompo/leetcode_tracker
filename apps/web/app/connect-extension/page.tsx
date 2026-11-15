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
    <main className="landing">
      <h1>Connect the extension</h1>
      {DEMO ? (
        <p className="muted">The demo has no accounts, so there&apos;s nothing to connect.</p>
      ) : !/^[a-p]{32}$/.test(ext) || !allowed ? (
        <p className="bad">
          Open this page from the LeetTrack extension&apos;s settings (Sign in), so it knows which
          extension to connect.
        </p>
      ) : !viewer ? (
        <>
          <p className="muted">Sign in first; then this page connects the extension.</p>
          <form action={signInWithGitHub}>
            <input type="hidden" name="next" value={`/connect-extension?ext=${ext}`} />
            <button className="btn btn-primary" type="submit">
              Sign in with GitHub
            </button>
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
