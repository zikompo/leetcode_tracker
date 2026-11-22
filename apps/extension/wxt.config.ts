import { existsSync, readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

/** WXT_* settings from the environment, then .env.local and .env (environment wins). */
function readEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith(`${name}=`));
    if (line)
      return line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
  }
  return undefined;
}

/**
 * The public key that pins the extension's ID (manifest "key"), so the sign-in redirect
 * (https://<id>.chromiumapp.org/) stays the same across reinstalls. WXT_EXTENSION_KEY wins (set it to
 * the Web Store's key once the item exists); otherwise the committed development key. Store
 * packages leave it out: the first upload must not carry one.
 */
function extensionKey(): string | undefined {
  if (readEnv("WXT_STORE_BUILD") === "1") return undefined;
  const fromEnv = readEnv("WXT_EXTENSION_KEY");
  if (fromEnv) return fromEnv;
  return existsSync("key.pub.txt") ? readFileSync("key.pub.txt", "utf8").trim() : undefined;
}
const key = extensionKey();

/** Opt-in sites: their scripts are registered at runtime once the user grants access. */
const OPT_IN_HOSTS = ["https://neetcode.io/*"];

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  hooks: {
    // WXT lists runtime-registered content scripts' matches as required host permissions.
    // NeetCode access is optional (granted from Settings), so installing or updating never
    // asks for it; "https://*/*" in optional_host_permissions covers it.
    "build:manifestGenerated": (_wxt, manifest) => {
      // E2E builds keep it: Playwright can't click Chrome's permission prompt.
      if (readEnv("WXT_E2E") === "1") return;
      manifest.host_permissions = manifest.host_permissions?.filter(
        (h: string) => !OPT_IN_HOSTS.includes(h),
      );
    },
  },
  manifest: {
    name: "LeetTrack",
    description: "Log every LeetCode attempt, with notes and history, without leaving the page.",
    // alarms: recount the review badge hourly and at midnight, and sync every 15 minutes.
    // sidePanel: the log panel can live in Chrome's side panel instead of on the page.
    // identity: signing in with GitHub through Chrome's own sign-in window.
    // scripting: the NeetCode scripts are registered only once the user turns NeetCode on.
    permissions: ["storage", "alarms", "sidePanel", "identity", "scripting"],
    host_permissions: ["https://leetcode.com/*"],
    // Requested one origin at a time, only when the user sets up a complexity-suggestion
    // provider in settings (any HTTPS API, or a local server), or turns on NeetCode.
    optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
    ...(key ? { key } : {}),
  },
});
