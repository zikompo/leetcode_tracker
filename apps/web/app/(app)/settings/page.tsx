import { loadSnapshot } from "@/lib/data";
import { SettingsForms } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { viewer, snap } = await loadSnapshot();
  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <span className="muted small">
          Shared with the extension: changes here reach it on its next sync.
        </span>
      </div>
      <section className="card" aria-labelledby="account">
        <h2 id="account">Account</h2>
        <p style={{ margin: 0 }}>
          {viewer.demo ? (
            "Demo account (no sign-in)."
          ) : (
            <>
              Signed in with GitHub as <strong>{viewer.name}</strong>.
            </>
          )}
        </p>
        <p className="muted small">
          To connect the extension, open its settings and click Sign in. GitHub repository sync
          arrives in a later version.
        </p>
      </section>
      <SettingsForms settings={snap.settings} />
    </>
  );
}
