import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "LeetTrack",
    description: "Log every LeetCode attempt, with notes and history, without leaving the page.",
    // alarms: recount the review badge hourly and at midnight.
    permissions: ["storage", "alarms"],
    host_permissions: ["https://leetcode.com/*"],
    // Requested one origin at a time, only when the user sets up a complexity-suggestion
    // provider in settings (any HTTPS API, or a local server).
    optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
  },
});
