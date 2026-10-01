import { parseSpreadDetailsV1, type SpreadDetailsV1 } from "@cosmic-arcana/sdk";

import { CORRELATION_HEADER } from "./bff.ts";
import { newIdempotencyKey } from "./spread-user";
import { UpstreamError, readUpstreamJson, upstreamFetch } from "./upstream.ts";

export const tarotBaseUrl = (): string =>
  (process.env.TAROT_BASE_URL ?? "").replace(/\/$/, "");

const headersFor = (correlationId: string): Record<string, string> => {
  const headers: Record<string, string> = { [CORRELATION_HEADER]: correlationId };
  const internal = process.env.INTERNAL_SERVICE_TOKEN;
  if (internal) {
    headers["x-internal-token"] = internal;
  }
  return headers;
};

const parseSpread = (body: unknown): SpreadDetailsV1 => {
  try {
    return parseSpreadDetailsV1(body);
  } catch {
    throw new UpstreamError("tarot", "bad-body");
  }
};

export const createSpread = async (
  question: string,
  userId: string,
  correlationId: string,
): Promise<SpreadDetailsV1> => {
  const base = tarotBaseUrl();
  if (!base) {
    throw new Error("TAROT_BASE_URL is not set");
  }

  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("question is empty");
  }

  const response = await upstreamFetch("tarot", `${base}/spreads`, {
    method: "POST",
    headers: {
      ...headersFor(correlationId),
      "content-type": "application/json",
      "idempotency-key": newIdempotencyKey(),
    },
    body: JSON.stringify({ userId, question: trimmed }),
  });

  if (!response.ok) {
    throw new UpstreamError("tarot", "bad-status", response.status);
  }
  return parseSpread(await readUpstreamJson("tarot", response));
};
