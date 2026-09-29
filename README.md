# GitHub Automation Bot

A Next.js app that connects GitHub repositories, records signed webhook deliveries, applies a simple issue rule, and posts matching alerts to Slack. The authenticated dashboard shows recent events, action results, and retry counts.

## Current behavior

- Sign in with a GitHub OAuth App and connect repositories where your account has admin access.
- Enable an `issues` and `pull_request` webhook for each connected repository.
- Store each supported delivery once using GitHub's delivery ID and verify its HMAC signature.
- When a newly opened issue title contains `bug` (case-insensitive), add the `bug` label and send a Slack notification.
- Retry transient GitHub and Slack failures up to three times; keep the result and attempt count in the dashboard log.
- Return a non-2xx response if the event cannot be stored, so GitHub can redeliver it.

Rules are currently hard-coded. The dashboard displays event history but does not yet provide rule editing. Pull-request deliveries are recorded; the current automation rule acts on bug-titled issues.

## Stack

- Next.js App Router, React, TypeScript, and Auth.js / NextAuth GitHub OAuth
- PostgreSQL through Prisma (the project has been developed with Neon)
- GitHub REST API and signed webhooks
- Slack Incoming Webhooks

## Run locally

Requirements: Node.js 20.9 or later, npm, and a reachable PostgreSQL database.

1. Install dependencies and copy the example environment file:

   ```powershell
   npm install
   Copy-Item .env.example .env.local
   ```

2. Fill in `.env.local` using the environment variable guide below. Create a GitHub OAuth App with this local callback URL:

   ```text
   http://localhost:3000/api/auth/callback/github
   ```

3. For local webhook forwarding, create a Smee channel, set `GITHUB_WEBHOOK_URL` to that channel URL, and run this in a second terminal:

   ```powershell
   npx smee-client --url https://smee.io/your-channel --target http://localhost:3000/api/webhooks/github
   ```

   The GitHub webhook URL is the channel URL in this setup; Smee forwards deliveries to the local route.

4. Apply the database migrations and start the app:

   ```powershell
   npx prisma migrate dev
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), sign in, connect a repository, and enable its webhook.

To inspect stored deliveries and actions, run `npx prisma studio`.

## Environment variables

Keep real values in `.env.local` or in your hosting provider's encrypted environment settings. Do not commit them. `.env.example` contains variable names only.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `GITHUB_CLIENT_ID` | Client ID for the GitHub OAuth App. |
| `GITHUB_CLIENT_SECRET` | Client secret for the GitHub OAuth App. |
| `GITHUB_WEBHOOK_SECRET` | HMAC secret used to create and verify repository webhooks. Use the same value when configuring the GitHub webhook. |
| `GITHUB_WEBHOOK_URL` | Exact destination GitHub should call. Use the Smee channel URL locally, or `https://your-domain/api/webhooks/github` in production. |
| `NEXTAUTH_SECRET` | Random secret used by Auth.js / NextAuth to sign and encrypt session data. |
| `NEXTAUTH_URL` | App origin, such as `http://localhost:3000` locally or the HTTPS production origin. |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL for notifications. |

No variable needs a `NEXT_PUBLIC_` prefix; these credentials are server-side only.

## Testing the workflow

Use a repository you own or administer. No shared test credentials are included.

1. Sign in, connect the repository, and enable its webhook.
2. Open an issue titled `Fix bug in login flow`. Confirm that the issue receives the `bug` label, Slack receives an alert, and the dashboard shows two successful actions.
3. Open an issue without `bug` in the title. Confirm its event is marked `skipped` and it has no actions.
4. To inspect transient retries, temporarily point `SLACK_WEBHOOK_URL` at a controlled endpoint that returns HTTP 500, restart the app, and open a matching issue. Restore the real Slack URL afterward. The action log should show three attempts and the label action should still run.
5. To check delivery recovery, stop or misconfigure the database connection, send a webhook, and verify GitHub receives a non-2xx response. Restore the connection and use **Redeliver** in the repository's webhook delivery history.

The database failure check changes delivery state in GitHub; run it only against a repository you control.

## Deployment

The app is designed for a Node-compatible Next.js host. Vercel can import the GitHub repository and detect the Next.js build settings automatically. Add all environment variables above to the production environment before enabling webhooks, and use a PostgreSQL database reachable by the deployed app.

For production:

1. Import this GitHub repository into the hosting provider and assign its production domain.
2. Set `NEXTAUTH_URL` to that HTTPS origin and `GITHUB_WEBHOOK_URL` to `<origin>/api/webhooks/github`.
3. Set the remaining server-side environment variables. Configure the GitHub OAuth App callback as `<origin>/api/auth/callback/github`.
4. Run `npx prisma migrate deploy` against the production `DATABASE_URL`.
5. Deploy, sign in, connect a repository, and enable its webhook. Confirm a test issue reaches the app and Slack.

**Production URL:** [https://github-automation-bot-rho.vercel.app/](https://github-automation-bot-rho.vercel.app/) (verified reachable with HTTP 200).

## Project instructions

The repository-level AI/context instructions used during development are [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md). See [`AI_NOTES.md`](AI_NOTES.md) for the development summary and known trade-offs.
