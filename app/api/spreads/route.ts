import { NextResponse } from "next/server";

import { decideAsk } from "../../../lib/ask";
import { auth0 } from "../../../lib/auth0";
import { allowRequest } from "../../../lib/rate-limit";
import { resolveSpreadUserId } from "../../../lib/spread-user";
import { createSpread, tarotBaseUrl } from "../../../lib/tarot";

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const allowed = allowRequest(clientKey(request));
  const configured = Boolean(tarotBaseUrl());
  // Only read the body once the request has earned it; a flood never reaches the parser.
  const payload = allowed && configured ? await readJson(request) : null;
  const session = await auth0.getSession().catch(() => null);

  const decision = decideAsk({
    payload,
    allowed,
    configured,
    userId: resolveSpreadUserId(session?.user?.sub),
  });

  switch (decision.kind) {
    case "rate-limited":
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    case "unconfigured":
      return NextResponse.json({ error: "tarot unconfigured" }, { status: 503 });
    case "invalid":
      return NextResponse.json({ error: decision.reason }, { status: 400 });
    case "signed-out":
      return NextResponse.json({ error: "sign in required" }, { status: 401 });
    default:
      break;
  }

  try {
    const spread = await createSpread(decision.question, decision.userId);
    return NextResponse.json(spread);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "spread failed";
    const status = message.startsWith("tarot ") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
