import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** Website tests run against demo mode: realistic sample data, no Supabase needed. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chromium" } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { LEETTRACK_DEMO: "1", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
