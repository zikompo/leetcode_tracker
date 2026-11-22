import { browser } from "wxt/browser";
import { NEETCODE_MATCHES } from "@/adapters/neetcode/url";

/**
 * NeetCode is opt-in. Access to neetcode.io is an optional permission the user grants from
 * Settings, so installing or updating LeetTrack never asks for it. Once it's granted, the
 * background registers the NeetCode scripts; if it's taken away (in Settings or in Chrome's
 * extension details), it unregisters them.
 */

const SCRIPTS = [
  {
    id: "leettrack-neetcode-interceptor",
    matches: NEETCODE_MATCHES,
    js: ["content-scripts/neetcode-interceptor.js"],
    world: "MAIN" as const,
    runAt: "document_start" as const,
  },
  {
    id: "leettrack-neetcode",
    matches: NEETCODE_MATCHES,
    js: ["content-scripts/neetcode.js"],
    runAt: "document_idle" as const,
  },
];

export const hasNeetcodeAccess = () => browser.permissions.contains({ origins: NEETCODE_MATCHES });

/** Ask Chrome for access to neetcode.io. Must run from a click in an extension page. */
export const requestNeetcodeAccess = () =>
  browser.permissions.request({ origins: NEETCODE_MATCHES });

export const removeNeetcodeAccess = () => browser.permissions.remove({ origins: NEETCODE_MATCHES });

/** Background: register the NeetCode scripts exactly when access to neetcode.io is granted. */
export async function syncNeetcodeScripts() {
  const granted = await hasNeetcodeAccess();
  const registered = new Set(
    (await browser.scripting.getRegisteredContentScripts({ ids: SCRIPTS.map((s) => s.id) })).map(
      (s) => s.id,
    ),
  );
  if (granted) {
    const missing = SCRIPTS.filter((s) => !registered.has(s.id));
    if (missing.length) await browser.scripting.registerContentScripts(missing);
  } else if (registered.size) {
    await browser.scripting.unregisterContentScripts({ ids: [...registered] });
  }
}
