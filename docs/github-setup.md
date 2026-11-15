# Setting up GitHub sync

LeetTrack can commit each Accepted solution to a GitHub repo, with a README of your attempts for every problem. It uses a small **GitHub App** that you create and install on just that one repo.

- **Narrow access:** the extension can write only to repos the App is installed on, and only their contents.
- **No secret:** the extension signs in with a one-time code (GitHub's device flow), so no client secret or private key is involved anywhere. The sign-in stays in your browser.

## 1. Make a repo for your solutions

Create a repo, for example `leetcode`. It can be private and empty; LeetTrack adds a first README if it is.

## 2. Create the GitHub App

On GitHub, open **Settings → Developer settings → GitHub Apps → New GitHub App** and fill in:

| Field                                                  | Value                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| GitHub App name                                        | Anything unique, e.g. `LeetTrack for <your username>`           |
| Homepage URL                                           | `http://localhost:3000`                                         |
| Callback URL                                           | Leave empty                                                     |
| Expire user authorization tokens                       | Leave **on** (LeetTrack refreshes them itself)                  |
| Request user authorization (OAuth) during installation | Off                                                             |
| **Enable Device Flow**                                 | **On**                                                          |
| Webhook → Active                                       | **Off**                                                         |
| Repository permissions → **Contents**                  | **Read and write** (Metadata: read-only is added automatically) |
| Where can this GitHub App be installed?                | Only on this account                                            |

Then click **Create GitHub App**.

On the App's page, note two things:

- the **Client ID**, e.g. `Iv23liAbCdEfGh123456`. Copy it exactly; don't add anything before it;
- the App's **public link**, `https://github.com/apps/<slug>`. You need the `<slug>` part.

You don't need a client secret or a private key: don't generate either.

## 3. Install it on your repo

On the App's page, click **Install App**, choose your account, select **Only select repositories**, pick your solutions repo, and install.

## 4. Point the extension at your App

Add to `apps/extension/.env.local`:

```bash
WXT_GITHUB_CLIENT_ID=Iv23liAbCdEfGh123456   # your App's Client ID, exactly as shown
WXT_GITHUB_APP_SLUG=your-app-slug
```

Rebuild the extension:

```bash
pnpm --filter @leettrack/extension build
```

Then reload LeetTrack in `chrome://extensions`.

## 5. Connect

1. In LeetTrack's **Settings**, open **GitHub** and click **Connect GitHub**. Allow access when Chrome asks.
2. LeetTrack shows a code. Click **Open GitHub**, enter the code and approve.
3. Back in LeetTrack, choose your repo.
4. From then on, every Accepted solution you save is committed in the background. Commits look like `0001-two-sum: attempt 2, solved independently, optimal (14 min)`. **Commit past solutions** catches up on everything you logged before.

Each problem gets a folder:

```
problems/0001-two-sum/
  README.md                     # link, difficulty, patterns, every attempt, your notes
  solution.py                   # latest Accepted solution
  attempts/2026-11-14-attempt-1.py
```

To keep your notes out of the repo, turn off **Include my notes in each problem's README**.

If GitHub is unreachable, commits wait and retry, and saving an attempt never waits for GitHub. To revoke access, uninstall the App or click **Disconnect**.
