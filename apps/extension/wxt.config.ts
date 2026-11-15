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

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "LeetTrack",
    description: "Log every LeetCode attempt, with notes and history, without leaving the page.",
    // alarms: recount the review badge hourly and at midnight, and sync every 15 minutes.
    permissions: ["storage", "alarms"],
    host_permissions: ["https://leetcode.com/*"],
    // Requested one origin at a time, only when the user sets up a complexity-suggestion
    // provider in settings (any HTTPS API, or a local server).
    optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
    // Only the LeetTrack website may hand this extension a sign-in session (spec 10.3).
    externally_connectable: { matches: [`${website.origin}/*`] },
  },
});
