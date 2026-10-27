import { NextResponse } from "next/server";

import { fetchFeed, resolveViewer } from "../../../lib/agent-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  const stars = {
    collector: "nasa-service-api",
    wired: false,
    clientProxy: false,
    note: "scaffold only. the agent does not collect star catalogs yet. when wired, NASA payloads would appear as MCP tool response JSON and are symbolic context, not proof a prediction works.",
  };

  const tarot = {
    createSpread: "/api/spreads",
    liveWebSocketPath: "/live",
    questionLogged: false,
  };

  const userId = await resolveViewer();
  if (!userId) {
    return NextResponse.json({
      viewer: null,
      stars,
      tarot,
      agent: { sessions: [], events: [] },
    });
  }

  try {
    const agent = await fetchFeed(userId);
    return NextResponse.json({ viewer: userId, stars, tarot, agent });
  } catch (cause) {
    return NextResponse.json({
      viewer: userId,
      stars,
      tarot,
      agent: { sessions: [], events: [] },
      agentError: cause instanceof Error ? cause.message : "mcp unreachable",
    });
  }
}
