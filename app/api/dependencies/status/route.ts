import { NextResponse } from "next/server";

import {
  interpretationBreaker,
  mergeAiInterpretation,
  parseStatuspageIndicator,
  type DependenciesStatus,
  type FeatureStatus,
} from "../../../../lib/dependency-status";

const STATUS_URL = "https://status.claude.com/api/v2/summary.json";

let cache: { at: number; official: ReturnType<typeof parseStatuspageIndicator> } | null = null;

const feature = (state: FeatureStatus["state"], message: string, incidentId: string | null): FeatureStatus => ({
  state,
  message,
  incidentId,
  since: state === "up" ? null : new Date().toISOString(),
});

const officialIndicator = async (): Promise<ReturnType<typeof parseStatuspageIndicator>> => {
  const now = Date.now();
  if (cache && now - cache.at < 60_000) {
    return cache.official;
  }
  try {
    const response = await fetch(STATUS_URL, {
      headers: { "user-agent": "cosmic-arcana-status-poller/1" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const body = (await response.json()) as { status?: { indicator?: unknown } };
    const official = parseStatuspageIndicator(body.status?.indicator);
    cache = { at: now, official };
    return official;
  } catch {
    if (cache) {
      return cache.official;
    }
    return "none";
  }
};

export async function GET() {
  const official = await officialIndicator();
  const fallbackAvailable = process.env.FALLBACK_LLM_CONFIGURED === "true";
  const aiState = mergeAiInterpretation({
    officialIndicator: official,
    breakerOpen: interpretationBreaker.isOpen(),
    fallbackAvailable,
  });

  const body: DependenciesStatus = {
    aiInterpretation: feature(
      aiState,
      aiState === "up"
        ? "Interpretation path is available when the AI service is wired."
        : "Interpretations are delayed. Cards can still be drawn.",
      aiState === "up" ? null : `ai-${official}-${interpretationBreaker.isOpen() ? "open" : "closed"}`,
    ),
    cosmicContext: feature(
      "degraded",
      "NASA is symbolic only and is not fetched on the ask path. User questions are never sent to NASA.",
      null,
    ),
  };

  return NextResponse.json(body, {
    headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
