import { NextResponse } from "next/server";

import { auth0 } from "../../../lib/auth0";
import { fetchHistoryPage, historyBaseUrl } from "../../../lib/history";
import { resolveSpreadUserId } from "../../../lib/spread-user";

export async function GET() {
  if (!historyBaseUrl()) {
    return NextResponse.json({ error: "history unconfigured" }, { status: 503 });
  }
  const session = await auth0.getSession().catch(() => null);
  const userId = resolveSpreadUserId(session?.user?.sub);
  if (!userId) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  try {
    return NextResponse.json(await fetchHistoryPage(userId));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "history failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
