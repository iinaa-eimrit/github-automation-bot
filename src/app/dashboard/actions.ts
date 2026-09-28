"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOctokit, createRepoWebhook } from "@/lib/github";
import { revalidatePath } from "next/cache";

export interface ConnectableRepo {
  id: number;
  full_name: string;
  private: boolean;
}

export interface EventLogEntry {
  id: string;
  receivedAt: string;
  eventType: string;
  action: string | null;
  status: string;
  payload: unknown;
  connectedRepo: { fullName: string };
  botActions: Array<{
    id: string;
    type: string;
    detail: unknown;
    success: boolean;
    error: string | null;
    createdAt: string;
  }>;
}

export async function getEventLog(): Promise<EventLogEntry[]> {
  const session = await auth();
  const githubId = session?.user?.githubId;
  if (!githubId) return [];

  const user = await db.user.findUnique({
    where: { githubId },
    select: { id: true },
  });
  if (!user) return [];

  const events = await db.githubEvent.findMany({
    where: { connectedRepo: { userId: user.id } },
    orderBy: { receivedAt: "desc" },
    take: 50,
    include: {
      connectedRepo: { select: { fullName: true } },
      botActions: { orderBy: { createdAt: "asc" } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    receivedAt: event.receivedAt.toISOString(),
    eventType: event.eventType,
    action: event.action,
    status: event.status,
    payload: event.payload,
    connectedRepo: event.connectedRepo,
    botActions: event.botActions.map((botAction) => ({
      id: botAction.id,
      type: botAction.type,
      detail: botAction.detail,
      success: botAction.success,
      error: botAction.error,
      createdAt: botAction.createdAt.toISOString(),
    })),
  }));
}

export async function getConnectableRepos(): Promise<ConnectableRepo[]> {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Unauthorized: Access token missing.");
  }

  const octokit = getOctokit(session.accessToken);

  try {
    const repos = await octokit.paginate(
      octokit.rest.repos.listForAuthenticatedUser,
      {
        per_page: 100,
        sort: "updated",
        direction: "desc",
      }
    );

    return repos
      .filter((repo) => Boolean(repo.permissions?.admin))
      .map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        private: repo.private,
      }));
  } catch (error) {
    console.error("Failed to fetch repositories from GitHub:", error);
    throw new Error("Failed to load GitHub repositories.");
  }
}

export async function connectRepo(githubRepoId: number, fullName: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  let user = null;

  if (session.user.githubId) {
    user = await db.user.findUnique({
      where: { githubId: session.user.githubId },
    });
  }

  // Fallback: If session was issued before githubId was in JWT callback, fetch directly from GitHub
  if (!user && session.accessToken) {
    const octokit = getOctokit(session.accessToken);
    const { data: ghUser } = await octokit.rest.users.getAuthenticated();

    user = await db.user.upsert({
      where: { githubId: String(ghUser.id) },
      update: {
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
      },
      create: {
        githubId: String(ghUser.id),
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
      },
    });
  }

  if (!user) {
    throw new Error("Could not determine user record in database.");
  }

  const connectedRepo = await db.connectedRepo.upsert({
    where: { githubRepoId },
    update: {
      userId: user.id,
      fullName,
    },
    create: {
      userId: user.id,
      githubRepoId,
      fullName,
    },
  });

  revalidatePath("/dashboard");
  return { success: true, connectedRepo };
}

export async function enableWebhook(connectedRepoId: string) {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Unauthorized: Access token missing.");
  }

  let connectedRepo = await db.connectedRepo.findUnique({
    where: { id: connectedRepoId },
  });

  // Fallback if numeric string was passed
  if (!connectedRepo && !isNaN(Number(connectedRepoId))) {
    connectedRepo = await db.connectedRepo.findUnique({
      where: { githubRepoId: Number(connectedRepoId) },
    });
  }

  if (!connectedRepo) {
    throw new Error("Connected repository not found.");
  }

  const [owner, repo] = connectedRepo.fullName.split("/");

  if (!owner || !repo) {
    throw new Error("Invalid repository name format.");
  }

  const webhookId = await createRepoWebhook(
    session.accessToken,
    owner,
    repo,
    connectedRepo.webhookId
  );

  const updated = await db.connectedRepo.update({
    where: { id: connectedRepo.id },
    data: { webhookId },
  });

  revalidatePath("/dashboard");
  return { success: true, webhookId: updated.webhookId };
}
