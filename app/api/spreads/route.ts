import { NextResponse } from "next/server";

import { auth0 } from "../../../lib/auth0";
import { allowRequest, MAX_QUESTION_CHARS } from "../../../lib/rate-limit";
import { resolveSpreadUserId } from "../../../lib/spread-user";
import { createSpread, tarotBaseUrl } from "../../../lib/tarot";

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

export async function POST(request: Request) {
  if (!allowRequest(clientKey(request))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  if (!tarotBaseUrl()) {
    return NextResponse.json({ error: "tarot unconfigured" }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const record =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const question = record.question;
  const consent = record.consent === true;

  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: "question too long" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "consent required to store the question" }, { status: 400 });
  }

  const session = await auth0.getSession();
  const userId = resolveSpreadUserId(session?.user?.sub);
  if (!userId) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  try {
    const spread = await createSpread(question, userId);
    return NextResponse.json(spread);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "spread failed";
    const status = message.startsWith("tarot ") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
