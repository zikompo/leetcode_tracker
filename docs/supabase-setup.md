# Setting up Supabase for LeetTrack

LeetTrack works without an account. Sign-in and sync need a Supabase project. Setup takes about 10 minutes and the free tier is enough.

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com) and create a new project. Any name and region will do; keep the database password somewhere safe.
2. When it's ready, open **Project Settings → API** and note two values:
   - **Project URL**, like `https://abcd1234.supabase.co`;
   - the **publishable** key (older projects call it the **anon public** key).

   Never use the `service_role` or secret key anywhere in LeetTrack.

## 2. Create the tables

1. Open **SQL Editor → New query**.
2. Paste the whole of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and run it. Then do the same with [`0002_mocks.sql`](../supabase/migrations/0002_mocks.sql).
3. **Table Editor** should now list `attempts`, `user_problems`, `settings`, `custom_lists` and `mock_interviews`, each marked as protected by row-level security.

## 3. Turn on GitHub sign-in

1. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App** and fill in:
   - **Application name:** LeetTrack (dev)
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `https://<your-project-ref>.supabase.co/auth/v1/callback`, with your Project URL's host in place of `<your-project-ref>.supabase.co`.
2. Click **Register application**, then **Generate a new client secret**. Copy the **Client ID** and the secret.
3. In Supabase, open **Authentication → Sign In / Providers → GitHub**, turn it on, paste the client ID and secret, and save.
4. In Supabase, open **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** add `http://localhost:3000/auth/callback`

## 4. Point the apps at your project

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable or anon key>
```

Create `apps/extension/.env.local`:

```bash
WXT_SUPABASE_URL=https://<your-project-ref>.supabase.co
WXT_SUPABASE_ANON_KEY=<publishable or anon key>
WXT_WEBSITE_URL=http://localhost:3000
```

Both files are git-ignored. The publishable/anon key is designed to be public: row-level security is what keeps each person's data private.

## 5. Try it

Start the website:

```bash
pnpm --filter @leettrack/web dev
```

Then build the extension:

```bash
pnpm --filter @leettrack/extension build
```

1. Reload LeetTrack in `chrome://extensions`.
2. Open its settings and click **Sign in**. This opens the website.
3. Sign in with GitHub. The page hands your session to the extension.
4. The extension pushes everything you've already logged, and from then on syncs in the background.

## 6. Deploy the website (Vercel)

The repo deploys as one Vercel project whose **Root Directory** is `apps/web` (settings are in `apps/web/vercel.json`; `.vercelignore` keeps `.local/`, env files and build output out of uploads).

1. Create the project with Root Directory `apps/web`, then link it from the repo root with `vercel link`.
2. Add the production environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the same as in `apps/web/.env.local`;
   - `NEXT_PUBLIC_EXTENSION_IDS`: the extension's ID, `bpjaccjmefnfblponnmbnpkdmiegpcfo`, plus the Chrome Web Store ID once published.
3. Deploy from the repo root:

   ```bash
   vercel deploy --prod
   ```

4. In Supabase, open **Authentication → URL Configuration**:
   - set the **Site URL** to the production address;
   - add `https://<your-domain>/auth/callback` to the **Redirect URLs**, keeping the localhost entry for development.
5. Set `WXT_WEBSITE_URL` in `apps/extension/.env.local` to the production address and rebuild the extension. It accepts sign-ins from both the production site and `localhost:3000`.

The GitHub OAuth app needs no change: its callback is Supabase's, not the website's.

**Note on the extension ID:** builds now pin the extension's ID with a manifest key. If you loaded the unpacked extension before that, Chrome sees the pinned build as a new extension with empty local storage. Sign in again to pull your synced data back down, then reconnect GitHub and re-enter any AI key. Export your data first if anything wasn't synced.
