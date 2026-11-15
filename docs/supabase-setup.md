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
2. Paste the whole of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and run it.
3. **Table Editor** should now list `attempts`, `user_problems`, `settings` and `custom_lists`, each marked as protected by row-level security.

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

When you later deploy the website to a real domain, add that domain to the Site URL, the redirect URLs and the GitHub OAuth app. Set `WXT_WEBSITE_URL` to it as well.
