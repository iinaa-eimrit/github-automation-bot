import { Octokit } from "@octokit/rest";

export function getOctokit(accessToken: string) {
  return new Octokit({
    auth: accessToken,
  });
}

export async function createRepoWebhook(
  accessToken: string,
  owner: string,
  repo: string
): Promise<number> {
  const octokit = getOctokit(accessToken);
  const webhookUrl = `${process.env.PUBLIC_APP_URL}/api/webhooks/github`;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!process.env.PUBLIC_APP_URL) {
    throw new Error("PUBLIC_APP_URL is not set in environment variables.");
  }

  if (!webhookSecret) {
    throw new Error("GITHUB_WEBHOOK_SECRET is not set in environment variables.");
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
