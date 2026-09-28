import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { processEvent } from "@/lib/process-event";

export async function POST(req: NextRequest) {
  const deliveryId = req.headers.get("x-github-delivery");
  const eventType = req.headers.get("x-github-event");
  log("info", "GitHub webhook request received", { deliveryId, eventType });

  try {
    // 1. Read raw body as text for exact byte signature verification
    const rawBody = await req.text();

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log("error", "GitHub webhook secret is not configured", { deliveryId, eventType });
      return NextResponse.json(
        { error: "Server misconfiguration: Webhook secret missing" },
        { status: 500 }
      );
    }

    // 2. Compute HMAC-SHA256 signature and verify timing-safe
    const signatureHeader = req.headers.get("x-hub-signature-256");
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return NextResponse.json(
        { error: "Missing or invalid signature header" },
        { status: 401 }
      );
    }

    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(rawBody);
    const expectedSignature = `sha256=${hmac.digest("hex")}`;

    const signatureBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 401 }
      );
    }

    // 3. Read X-GitHub-Event header; handle ping event immediately
    if (eventType === "ping") {
      return NextResponse.json(
        { message: "Ping received successfully" },
        { status: 200 }
      );
    }

    // 4. Read X-GitHub-Delivery header as idempotency key
    if (!deliveryId) {
      return NextResponse.json(
        { error: "Missing x-github-delivery header" },
        { status: 400 }
      );
    }

    // Idempotency deduplication check
    const existingEvent = await db.githubEvent.findUnique({
      where: { deliveryId },
    });

    if (existingEvent) {
      return NextResponse.json(
        { message: "Event already received (idempotent duplicate)", deliveryId },
        { status: 200 }
      );
    }

    // 5. Parse raw body as JSON and look up matching ConnectedRepo
    let payload: {
      action?: string;
      repository?: {
        id?: number;
      };
      [key: string]: unknown;
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse JSON payload" },
        { status: 400 }
      );
    }

    const githubRepoId = payload.repository?.id;
    if (!githubRepoId) {
      return NextResponse.json(
        { message: "Event ignored: No repository id found in payload" },
        { status: 200 }
      );
    }

    const connectedRepo = await db.connectedRepo.findUnique({
      where: { githubRepoId: Number(githubRepoId) },
      include: { user: { select: { accessToken: true } } },
    });

    if (!connectedRepo) {
      return NextResponse.json(
        { message: "Event ignored: Repository is not connected in database" },
        { status: 200 }
      );
    }

    // 6. Insert GithubEvent row with received status
    const action = typeof payload.action === "string" ? payload.action : null;

    let githubEvent;
    try {
      githubEvent = await db.githubEvent.create({
        data: {
          connectedRepoId: connectedRepo.id,
          deliveryId,
          eventType: eventType || "unknown",
          action,
          payload: payload as object,
          status: "received",
        },
      });
    } catch (error) {
      log("error", "Could not store GitHub webhook event", {
        deliveryId,
        eventType,
        repo: connectedRepo.fullName,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response("internal error", { status: 500 });
    }

    let finalStatus = githubEvent.status;
    try {
      await processEvent(githubEvent, connectedRepo);
      const finalEvent = await db.githubEvent.findUnique({
        where: { id: githubEvent.id },
        select: { status: true },
      });
      finalStatus = finalEvent?.status ?? finalStatus;
    } catch (error) {
      log("error", "GitHub event was stored but processing failed", {
        eventId: githubEvent.id,
        deliveryId,
        eventType,
        repo: connectedRepo.fullName,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 7. Return 200 OK
    return NextResponse.json(
      {
        success: true,
        eventId: githubEvent.id,
        deliveryId: githubEvent.deliveryId,
        status: finalStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    log("error", "GitHub webhook request failed before event storage", {
      deliveryId,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("internal error", { status: 500 });
  }
}
