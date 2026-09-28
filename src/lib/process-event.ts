import type { ConnectedRepo, GithubEvent } from "@prisma/client";
import { db } from "@/lib/db";
import { addLabelToIssue } from "@/lib/github";
import { matchRules, type MatchedAction } from "@/lib/rules";
import { sendSlackNotification } from "@/lib/slack";

type EventPayload = {
  issue?: { number?: unknown; title?: unknown; html_url?: unknown };
};

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
    try {
      await executeAction(action, payload, connectedRepo);
      success = true;
    } catch (err) {
      error = errorMessage(err);
      console.error(`GitHub event action ${action.type} failed:`, error);
    }

    await db.botAction.create({
      data: {
        githubEventId: event.id,
        type: action.type,
        detail: action as object,
        success,
        error,
      },
    });
    outcomes.push(success);
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
      throw new Error("Issue number is missing or invalid in the webhook payload.");
    }
    const accessToken = connectedRepo.user.accessToken;
    if (!accessToken) {
      throw new Error("Connected user's GitHub access token is missing. Sign in again.");
    }
    const [owner, repo] = connectedRepo.fullName.split("/");
    if (!owner || !repo) throw new Error("Connected repository name is invalid.");
    await addLabelToIssue(accessToken, owner, repo, issueNumber as number, action.label);
    return;
  }

  const title = typeof payload.issue?.title === "string" ? payload.issue.title : "(untitled)";
  const issueUrl = typeof payload.issue?.html_url === "string" ? payload.issue.html_url : "";
  await sendSlackNotification(
    `🐛 New bug issue: ${title} in ${connectedRepo.fullName} — ${issueUrl}`
  );
}
