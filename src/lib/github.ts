import { Octokit } from "@octokit/rest";
import { log } from "@/lib/logger";

export function isRetryableGitHubError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return true;
  return status === 429 || status >= 500;
}

export function getOctokit(accessToken: string) {
  return new Octokit({
    auth: accessToken,
  });
}

export async function addLabelToIssue(
  accessToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
  label: string
): Promise<void> {
  const octokit = getOctokit(accessToken);
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [label],
  });
}

export function getWebhookUrl(): string {
  const webhookUrl = process.env.GITHUB_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error("GITHUB_WEBHOOK_URL is not set in environment variables.");
  }
  return webhookUrl;
}

export async function createRepoWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  existingWebhookId?: number | null
): Promise<number> {
  const octokit = getOctokit(accessToken);
  const webhookUrl = getWebhookUrl();
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
      log("warn", "Could not update existing GitHub webhook; creating a new one", {
        owner,
        repo,
        error: err instanceof Error ? err.message : String(err),
      });
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
