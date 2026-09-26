import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // 1. Read raw body as text for exact byte signature verification
    const rawBody = await req.text();

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("GITHUB_WEBHOOK_SECRET is not configured.");
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
    const eventType = req.headers.get("x-github-event");
    if (eventType === "ping") {
      return NextResponse.json(
        { message: "Ping received successfully" },
        { status: 200 }
      );
    }

    // 4. Read X-GitHub-Delivery header as idempotency key
    const deliveryId = req.headers.get("x-github-delivery");
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
    });

    if (!connectedRepo) {
      return NextResponse.json(
        { message: "Event ignored: Repository is not connected in database" },
        { status: 200 }
      );
    }

    // 6. Insert GithubEvent row with received status
    const action = typeof payload.action === "string" ? payload.action : null;

    const githubEvent = await db.githubEvent.create({
      data: {
        connectedRepoId: connectedRepo.id,
        deliveryId,
        eventType: eventType || "unknown",
        action,
        payload: payload as object,
        status: "received",
      },
    });

    // 7. Return 200 OK
    return NextResponse.json(
      {
        success: true,
        eventId: githubEvent.id,
        deliveryId: githubEvent.deliveryId,
        status: githubEvent.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unhandled error processing GitHub webhook:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
