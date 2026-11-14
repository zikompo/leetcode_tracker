# LeetTrack

Chrome extension (MV3) and companion site for tracking LeetCode attempts, spaced-repetition reviews, and pattern mastery.

Status: **M0 (scaffolding) and M1 (local extension MVP) are done.** The extension works fully offline; no account needed.

## Layout

```
packages/core       Pure TS domain logic: types, status rules, rating suggestion, merge, export schema
packages/seed       Pattern taxonomy (lists and suggested patterns arrive in M3)
apps/extension      WXT + React MV3 extension
  adapters/leetcode   The only code that knows LeetCode URLs and payload shapes
  lib/                Background service (IndexedDB), messaging, shared types
  entrypoints/        background, page-world interceptor, content script + panel, popup, options
  e2e/                Playwright tests against a mock leetcode.com
apps/web            Next.js site (placeholder until M4)
```

## Setup

Requires Node 24 (`nvm use`) and pnpm (`corepack enable`).

```bash
pnpm install
pnpm test          # unit tests (core + extension)
pnpm typecheck
```

## Extension

```bash
pnpm --filter @leettrack/extension dev     # opens Chrome with the extension loaded, hot reload
pnpm --filter @leettrack/extension build   # unpacked build in apps/extension/.output/chrome-mv3
pnpm --filter @leettrack/extension e2e     # build + Playwright (first run: npx playwright install chromium)
```

To load the build manually: `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/.output/chrome-mv3`.

In dev mode the page-world interceptor logs raw submit/check payloads as `[leettrack:record]` in the page
console, so real LeetCode responses can be saved as fixtures (see `adapters/leetcode/__fixtures__/README.md`).

## Website

```bash
pnpm --filter @leettrack/web dev
```
