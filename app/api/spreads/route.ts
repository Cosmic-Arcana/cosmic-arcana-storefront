import { NextResponse } from "next/server";

import { createSpread, tarotBaseUrl } from "../../../lib/tarot";

export async function POST(request: Request) {
  if (!tarotBaseUrl()) {
    return NextResponse.json({ error: "tarot unconfigured" }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const question =
    payload && typeof payload === "object" && "question" in payload
      ? (payload as { question?: unknown }).question
      : undefined;

  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  try {
    const spread = await createSpread(question);
    return NextResponse.json(spread);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "spread failed";
    const status = message.startsWith("tarot ") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
