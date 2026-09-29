import { parseSpreadDetailsV1, type SpreadDetailsV1 } from "@cosmic-arcana/sdk";

import { newIdempotencyKey } from "./spread-user";

export const tarotBaseUrl = (): string =>
  (process.env.TAROT_BASE_URL ?? "").replace(/\/$/, "");

export const createSpread = async (
  question: string,
  userId: string,
): Promise<SpreadDetailsV1> => {
  const base = tarotBaseUrl();
  if (!base) {
    throw new Error("TAROT_BASE_URL is not set");
  }

  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("question is empty");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "idempotency-key": newIdempotencyKey(),
  };
  const internal = process.env.INTERNAL_SERVICE_TOKEN;
  if (internal) {
    headers["x-internal-token"] = internal;
  }

  const response = await fetch(`${base}/spreads`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, question: trimmed }),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`tarot ${response.status}`);
  }

  return parseSpreadDetailsV1(body);
};
