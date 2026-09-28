import type { ConnectedRepo, GithubEvent } from "@prisma/client";
import { db } from "@/lib/db";
import { addLabelToIssue, isRetryableGitHubError } from "@/lib/github";
import { log } from "@/lib/logger";
import { matchRules, type MatchedAction } from "@/lib/rules";
import {
  isRetryableSlackError,
  sendSlackNotification,
} from "@/lib/slack";
import { withRetry } from "@/lib/retry";

type EventPayload = {
  issue?: { number?: unknown; title?: unknown; html_url?: unknown };
};

class PermanentActionError extends Error {
  readonly status = 400;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function processEvent(
  event: GithubEvent,
  connectedRepo: ConnectedRepo & { user: { accessToken: string | null } }
): Promise<void> {
  const actions = matchRules(event);
  if (actions.length === 0) {
    await db.githubEvent.update({
      where: { id: event.id },
      data: { status: "skipped", processedAt: new Date() },
    });
    return;
  }

  const payload = event.payload as EventPayload;
  const outcomes: boolean[] = [];
  for (const action of actions) {
    let success = false;
    let error: string | undefined;
    let attempts = 0;
    const startedAt = Date.now();
    const isRetryable = action.type === "add_label"
      ? isRetryableGitHubError
      : isRetryableSlackError;
    try {
      await withRetry(
        async () => {
          attempts += 1;
          await executeAction(action, payload, connectedRepo);
        },
        { maxAttempts: 3, isRetryable }
      );
      success = true;
      log("info", "Webhook action completed", {
        eventId: event.id,
        deliveryId: event.deliveryId,
        repo: connectedRepo.fullName,
        action: action.type,
        attempts,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      error = errorMessage(err);
      log("error", "Webhook action failed", {
        eventId: event.id,
        deliveryId: event.deliveryId,
        repo: connectedRepo.fullName,
        action: action.type,
        attempts,
        durationMs: Date.now() - startedAt,
        error,
      });
    }

    let recorded = false;
    try {
      await db.botAction.create({
        data: {
          githubEventId: event.id,
          type: action.type,
          detail: action as object,
          success,
          attempts,
          error,
        },
      });
      recorded = true;
    } catch (recordError) {
      log("error", "Could not save webhook action result", {
        eventId: event.id,
        deliveryId: event.deliveryId,
        action: action.type,
        attempts,
        error: errorMessage(recordError),
      });
    }
    outcomes.push(success && recorded);
  }

  await db.githubEvent.update({
    where: { id: event.id },
    data: {
      status: outcomes.every(Boolean) ? "processed" : "failed",
      processedAt: new Date(),
    },
  });
}

async function executeAction(
  action: MatchedAction,
  payload: EventPayload,
  connectedRepo: ConnectedRepo & { user: { accessToken: string | null } }
): Promise<void> {
  if (action.type === "add_label") {
    const issueNumber = payload.issue?.number;
    if (!Number.isInteger(issueNumber)) {
      throw new PermanentActionError("Issue number is missing or invalid in the webhook payload.");
    }
    const accessToken = connectedRepo.user.accessToken;
    if (!accessToken) {
      throw new PermanentActionError("Connected user's GitHub access token is missing. Sign in again.");
    }
    const [owner, repo] = connectedRepo.fullName.split("/");
    if (!owner || !repo) throw new PermanentActionError("Connected repository name is invalid.");
    await addLabelToIssue(accessToken, owner, repo, issueNumber as number, action.label);
    return;
  }

  const title = typeof payload.issue?.title === "string" ? payload.issue.title : "(untitled)";
  const issueUrl = typeof payload.issue?.html_url === "string" ? payload.issue.html_url : "";
  await sendSlackNotification(
    `🐛 New bug issue: ${title} in ${connectedRepo.fullName} — ${issueUrl}`
  );
}
