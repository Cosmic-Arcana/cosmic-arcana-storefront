import { NextResponse } from "next/server";

import { auth0 } from "../../../../lib/auth0";
import { historyBaseUrl } from "../../../../lib/history";
import { resolveSpreadUserId } from "../../../../lib/spread-user";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spreadId: string }> },
) {
  const { spreadId } = await params;
  const base = historyBaseUrl();
  if (!base) {
    return NextResponse.json({ error: "history unconfigured" }, { status: 503 });
  }
  const session = await auth0.getSession();
  const userId = resolveSpreadUserId(session?.user?.sub);
  if (!userId) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const headers: Record<string, string> = {};
  const internal = process.env.INTERNAL_SERVICE_TOKEN;
  if (internal) {
    headers["x-internal-token"] = internal;
  }
  const response = await fetch(`${base}/users/${userId}/spread-history/${spreadId}`, {
    method: "DELETE",
    headers,
  });
  if (response.status === 404) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: `history ${response.status}` }, { status: 502 });
  }
  return NextResponse.json({ deleted: true });
}
