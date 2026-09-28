export class SlackNetworkError extends Error {
  constructor(cause: unknown) {
    super("Slack webhook request failed due to a network error.", { cause });
    this.name = "SlackNetworkError";
  }
}

export class SlackResponseError extends Error {
  constructor(
    readonly status: number,
    responseBody: string
  ) {
    super(`Slack webhook failed (${status}): ${responseBody}`);
    this.name = "SlackResponseError";
  }
}

export function isRetryableSlackError(error: unknown): boolean {
  if (error instanceof SlackNetworkError) return true;
  if (error instanceof SlackResponseError) {
    return error.status === 429 || error.status >= 500;
  }
  return false;
}

export async function sendSlackNotification(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is not set in environment variables.");
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    throw new SlackNetworkError(error);
  }

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "(response body unavailable)";
    }
    throw new SlackResponseError(response.status, body);
  }
}
