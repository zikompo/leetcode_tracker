# LeetTrack

Chrome extension (MV3) and companion site for tracking LeetCode attempts, spaced-repetition reviews, and pattern mastery.

Status: **M0–M7 are done.** The website runs at https://leetcode.zikorachinedu.com.

- **M0 and M1:** the extension logs every attempt.
- **M2:** spaced repetition (FSRS).
- **M3:** patterns and mastery, and the seed lists.
- **M4:** accounts, two-way sync, and the website.
- **M5:** commit Accepted solutions to a GitHub repo.
- **M6:** interview dates: extra reviews before each one, reviews-only last days, a day-by-day Plan with a pace chart, and the Clue Journal.
- **M7:**
  - prep-tracker import;
  - a mock interview log;
  - onboarding;
  - a privacy policy;
  - a Chrome Web Store listing ([docs/web-store.md](docs/web-store.md)).
- **Also:**
  - pattern pages with trends;
  - a review queue with bulk snooze;
  - the timebox and twist prompts;
  - the side panel;
  - a stable extension ID;
  - the Vercel deploy.

The extension still works fully offline; an account is optional.

## Layout

```
packages/core       Pure TS domain logic: types, status, rating, FSRS, queue, mastery, merge, export
packages/seed       Pattern taxonomy, Blind 75 / NeetCode 150 / NeetCode 250 with suggested patterns
packages/insights   Views shared by the extension and the website: queue, stats, dashboard, plans, clues
packages/ui         Shared UI: LeetCode-style theme (Tailwind v4), shadcn/ui components, gauge and charts
supabase            Database schema (migrations) and its tests (PGlite)
apps/extension      WXT + React MV3 extension
  adapters/leetcode   The only code that knows LeetCode URLs and payload shapes
  lib/                Background service (IndexedDB), sync, account, AI suggestions, messaging
  entrypoints/        background, page-world interceptor, content script + panel, side panel, popup, options, onboarding, dashboard
  e2e/                Playwright tests against a mock leetcode.com and a fake Supabase
apps/web            Next.js website: dashboard, review queue, problems, patterns, lists, plan, mocks, clues, settings, privacy
docs                Setup guides
```

## Setup

Requires Node 24 (`nvm use`) and pnpm (`corepack enable`).

```bash
pnpm install
pnpm test          # unit tests (all packages, including the database tests)
pnpm typecheck
```

To sign in and sync, create a Supabase project and follow [docs/supabase-setup.md](docs/supabase-setup.md). Without one, everything works locally and the website can run in demo mode. To commit solutions to GitHub, see [docs/github-setup.md](docs/github-setup.md).

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
pnpm --filter @leettrack/web dev                      # needs apps/web/.env.local (see docs)
LEETTRACK_DEMO=1 pnpm --filter @leettrack/web dev     # sample data, no account needed
pnpm --filter @leettrack/web e2e                      # demo-mode Playwright tests, desktop and phone
```
