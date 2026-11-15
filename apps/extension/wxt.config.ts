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

const website = new URL(readEnv("WXT_WEBSITE_URL") || "http://localhost:3000");
/** Local development site, also allowed to connect when the build points at production. */
const LOCAL_SITE = "http://localhost:3000";

/**
 * The public key that pins the extension's ID (manifest "key"), so the website can recognise
 * it and sign-in hand-off keeps working across reinstalls. WXT_EXTENSION_KEY wins (set it to
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

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "LeetTrack",
    description: "Log every LeetCode attempt, with notes and history, without leaving the page.",
    // alarms: recount the review badge hourly and at midnight, and sync every 15 minutes.
    // sidePanel: the log panel can live in Chrome's side panel instead of on the page.
    permissions: ["storage", "alarms", "sidePanel"],
    host_permissions: ["https://leetcode.com/*"],
    // Requested one origin at a time, only when the user sets up a complexity-suggestion
    // provider in settings (any HTTPS API, or a local server).
    optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
    ...(key ? { key } : {}),
    // Only the LeetTrack website may hand this extension a sign-in session (spec 10.3).
    externally_connectable: {
      matches: [...new Set([`${website.origin}/*`, `${LOCAL_SITE}/*`])],
    },
  },
});
