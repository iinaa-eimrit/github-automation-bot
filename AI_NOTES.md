# AI Notes

## Tools and collaboration

I used OpenAI Codex, powered by GPT-6, to implement and review the app in small pieces: GitHub sign-in and repository connection, webhook verification and persistence, issue actions and Slack notifications, the dashboard log, and retry handling. I chose the product scope and integrations, supplied the acceptance steps, and checked the results as each piece was completed. I also reviewed the assignment requirements against the repository before preparing the README and this note.

The repository instructions used were `AGENTS.md` and `CLAUDE.md`; the latter points to the former. There is no `.cursorrules` file. The Next.js instructions in `AGENTS.md` require consulting the installed Next.js documentation before changing framework code.

## Decisions

- I chose a GitHub OAuth App for the first version because it kept sign-in and write access straightforward. The app stores the OAuth access token on the user record so webhook requests can act without a browser session. A GitHub App with short-lived installation tokens would be safer and is a planned improvement.
- I chose PostgreSQL and Prisma so webhook deliveries and action results survive requests and can be inspected from the dashboard. GitHub delivery IDs are unique in the database to deduplicate redeliveries.
- I chose Slack Incoming Webhooks for notifications and five-second dashboard polling for the live log. Both keep the first version small; the current rule is hard-coded and is not editable in the UI.

## A wrong turn and its correction

The AI initially made the webhook URL helper inspect whether `PUBLIC_APP_URL` contained `smee.io`, then treated Smee and production URLs differently. That made a local forwarding tool a special case in general application code. I spotted the coupling while reviewing the deployment work and replaced it with an explicit `GITHUB_WEBHOOK_URL`: local development can set it to a Smee channel, and production can set it to the deployed route. The app no longer guesses behavior from the hostname.

## What I would improve next

I would move event processing to a durable job/outbox worker so an app restart after an event is stored cannot leave it in `received` without another processing attempt. I would migrate OAuth credentials to GitHub App installation tokens, add editable rule configuration, and deploy the app to a public host with production OAuth, database, webhook, and Slack settings. The repository is deployment-ready in configuration and documentation, but it does not yet have a production URL.
