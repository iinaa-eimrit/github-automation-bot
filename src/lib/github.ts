import { Octokit } from "@octokit/rest";

export function getOctokit(accessToken: string) {
  return new Octokit({
    auth: accessToken,
  });
}

export function getResolvedWebhookUrl(): string {
  const rawUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!rawUrl) {
    throw new Error("PUBLIC_APP_URL is not set in environment variables.");
  }

  // Smee.io channels only receive events at the exact channel URL (e.g. https://smee.io/xyz).
  // Standard deployment URLs (e.g. Vercel, ngrok) forward to the API route at /api/webhooks/github.
  return rawUrl.includes("smee.io")
    ? rawUrl
    : `${rawUrl}/api/webhooks/github`;
}

export async function createRepoWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  existingWebhookId?: number | null
): Promise<number> {
  const octokit = getOctokit(accessToken);
  const webhookUrl = getResolvedWebhookUrl();
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("GITHUB_WEBHOOK_SECRET is not set in environment variables.");
  }

  // If a webhook was already created on GitHub, update it instead of creating a duplicate
  if (existingWebhookId) {
    try {
      const { data } = await octokit.rest.repos.updateWebhook({
        owner,
        repo,
        hook_id: existingWebhookId,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: webhookSecret,
        },
        events: ["issues", "pull_request"],
        active: true,
      });
      return data.id;
    } catch (err) {
      console.warn("Could not update existing webhook, creating new one:", err);
    }
  }

  const { data } = await octokit.rest.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret: webhookSecret,
    },
    events: ["issues", "pull_request"],
    active: true,
  });

  return data.id;
}
