# GitHub App setup — Weekly review agent

The weekly review agent's customer-facing delivery is a draft pull
request opened on a repo the customer has connected via the
ContentRX GitHub App. This doc walks through registering the App,
populating Vercel env, and verifying the wiring end-to-end.

## What lands in code (already shipped)

- `src/lib/agent/github-app.ts` — env loader, install URL builder,
  signature verifier, installation-token-minting Octokit factory.
- `src/lib/agent/open-pr.ts` — branch + draft-PR creation.
- `/api/agent/github/install` — Connect-flow initiation.
- `/api/agent/github/callback` — post-install handler.
- `/api/agent/github/webhook` — installation event receiver.
- `/dashboard/agent` — Connect button + connection status.
- `/api/cron/agent-run` — opens a draft PR after persisting each run
  for teams with a connected installation.

The code is gated by `isGithubAppConfigured()`, so until the env vars
are set the surface renders "registration in progress" and no GitHub
calls go out.

## Setup — Robert's checklist

### 1. Register the App

Go to <https://github.com/settings/apps/new>. Fill in:

| Field | Value |
|---|---|
| GitHub App name | `ContentRX Agent` (or similar; the slug derives from this) |
| Homepage URL | `https://contentrx.io/dashboard/agent` |
| Callback URL | `https://contentrx.io/api/agent/github/callback` |
| Setup URL (post-install redirect) | `https://contentrx.io/api/agent/github/callback` |
| Webhook URL | `https://contentrx.io/api/agent/github/webhook` |
| Webhook secret | Generate a strong random string, save it for step 3 |

**Repository permissions:**

| Permission | Access | Why |
|---|---|---|
| Pull requests | Read & write | Open the draft PR |
| Contents | Read & write | Create the marker branch + commit the digest file |
| Metadata | Read | Required by GitHub for any App; can't be turned off |

**Account permissions:** none.

**Subscribe to events:**

- `Installation` — fires when a customer installs/uninstalls the App
- `Installation repositories` — fires when a customer adds/removes repos from an existing install

**Where can this App be installed?** Any account.

Click **Create GitHub App**.

### 2. Generate the App's private key

On the App's settings page, scroll to **Private keys** → **Generate
a private key**. GitHub downloads a `.pem` file. Save it somewhere
you can find again (Robert's password manager is the right place).

The key needs to land in Vercel env in one of two formats:

- **Recommended:** base64-encoded — `cat the-key.pem | base64 |
  pbcopy`. Paste-safe in Vercel env's single-line input.
- **Alternative:** literal PEM with escaped newlines — `awk 1 ORS='\\n'
  the-key.pem`. Works but more error-prone.

The env loader in `src/lib/agent/github-app.ts` handles both.

### 3. Set Vercel env vars

In the Vercel dashboard for the `content-rx` project, **Settings →
Environment Variables**, add (Production scope):

```
GITHUB_APP_ID                = <App ID from the settings page>
GITHUB_APP_CLIENT_ID         = <Client ID from the settings page>
GITHUB_APP_CLIENT_SECRET     = <Client secret — generated separately>
GITHUB_APP_PRIVATE_KEY       = <base64 of the .pem from step 2>
GITHUB_APP_WEBHOOK_SECRET    = <the random string from step 1>
GITHUB_APP_SLUG              = <App name slug, e.g. "contentrx-agent">
```

The Client secret has its own **Generate a new client secret** button
on the App's settings page; generate one + copy the value before
saving (it's shown once).

### 4. Apply the DB migration

After this PR merges (and ONLY after — see the schema-drift footgun
warning further down), run:

```bash
node scripts/apply-agent-github-installations-migration.mjs
```

Idempotent. Creates `agent_github_installations` table with two
unique indexes + the FK to `users.id`.

Or run `npm run db:push` interactively after the merge — drizzle-kit
will diff prod against the merged `schema.ts` and prompt to apply.

### 5. Trigger a redeploy

After saving env vars, run `vercel --prod` from a clean working tree
or push an empty commit to main. The deploy picks up the new env;
the dashboard's `isGithubAppConfigured()` flips to true.

### 6. Verify end-to-end

1. Sign in to <https://contentrx.io/dashboard/agent>. The "Connect
   GitHub" button should be live (not the "registration in progress"
   callout).
2. Click **Connect GitHub →**. GitHub redirects to the install page.
3. Pick a test repo (a private one is fine; the App has no UI in
   the GitHub web product). Click **Install**.
4. GitHub redirects back to `/dashboard/agent?installed=1`. The page
   should show "Connected." and the repo coordinates.
5. Hit `POST /api/cron/agent-run` with the cron secret to fire a
   manual run:

   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     https://contentrx.io/api/cron/agent-run
   ```

   Response includes `prsOpened: 1` if the run produced a draft PR.
6. Check the test repo for a new branch named
   `contentrx-agent/run-<timestamp>` and a draft PR titled
   `ContentRX weekly review · <timestamp>`.

### Schema-drift footgun

Same gotcha that bit us during the agent_runs table setup: if you
run `npm run db:push` from `main` BEFORE this PR merges,
drizzle-kit will see `agent_github_installations` in prod (after I
applied the migration) but NOT in `main`'s `schema.ts`, and propose
to drop the table.

Mitigation: don't apply the migration until after merge. Or apply
the migration and then merge immediately, before any other db:push
fires.

## Tier B follow-ups (not in this PR)

Things V1 deliberately punts:

- **Repo selection UI.** V1 takes the first repo the App was
  installed on. V2 lets the team pick.
- **Branch selection UI.** V1 hardcodes `main`. V2 reads default
  branch dynamically + lets the team override.
- **Disconnect button.** V1 relies on the customer uninstalling the
  App from GitHub directly; the webhook then drops the row.
- **Draft-fix PRs (Agent V2).** Per the roadmap: "Re-evaluate after
  V1 has run for 30+ days on at least 5 paying Team-tier customers,
  with override-volume data on the V1 recommendations."
