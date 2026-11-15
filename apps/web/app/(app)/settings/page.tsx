import { Panel } from "@leettrack/ui/components/panel";
import { PageHead } from "@/components/PageHead";
import { loadSnapshot } from "@/lib/data";
import { SettingsForms } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { viewer, snap } = await loadSnapshot();
  return (
    <>
      <PageHead title="Settings">
        Shared with the extension: changes here reach it on its next sync.
      </PageHead>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Panel title="Account">
          <p>
            {viewer.demo ? (
              "Demo account (no sign-in)."
            ) : (
              <>
                Signed in with GitHub as <strong>{viewer.name}</strong>.
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            To connect the extension, open its settings and click Sign in.
          </p>
        </Panel>
        <Panel title="GitHub">
          {snap.settings.github ? (
            <p>
              The extension commits your Accepted solutions to{" "}
              <a
                href={`https://github.com/${snap.settings.github.owner}/${snap.settings.github.repo}`}
                target="_blank"
                rel="noreferrer"
              >
                {snap.settings.github.owner}/{snap.settings.github.repo}
              </a>{" "}
              ({snap.settings.github.branch}), with notes{" "}
              {snap.settings.github.includeNotes ? "included" : "left out"}.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Not set up. To commit each Accepted solution to a repo of yours, connect GitHub in the
              extension&apos;s settings.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The GitHub sign-in stays in the extension; this site never sees it.
          </p>
        </Panel>
      </div>
      <SettingsForms settings={snap.settings} />
    </>
  );
}
