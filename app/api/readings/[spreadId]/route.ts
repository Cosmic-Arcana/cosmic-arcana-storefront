import { NextResponse } from "next/server";

import { auth0 } from "../../../../lib/auth0";
import { deleteOutcome, historyBaseUrl, isSpreadId } from "../../../../lib/history";
import { resolveSpreadUserId } from "../../../../lib/spread-user";

const UPSTREAM_TIMEOUT_MS = 5_000;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spreadId: string }> },
) {
  const { spreadId } = await params;
  const base = historyBaseUrl();
  if (!base) {
    return NextResponse.json({ error: "history unconfigured" }, { status: 503 });
  }
  if (!isSpreadId(spreadId)) {
    return NextResponse.json({ error: "invalid reading id" }, { status: 400 });
  }

  const session = await auth0.getSession().catch(() => null);
  const userId = resolveSpreadUserId(session?.user?.sub);
  if (!userId) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const headers: Record<string, string> = {};
  const internal = process.env.INTERNAL_SERVICE_TOKEN;
  if (internal) {
    headers["x-internal-token"] = internal;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/users/${userId}/spread-history/${spreadId}`, {
      method: "DELETE",
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // A history service that is down must not surface as a 500 from our own api.
    return NextResponse.json({ error: "history unreachable" }, { status: 502 });
  }

  const outcome = deleteOutcome(upstream.status);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
