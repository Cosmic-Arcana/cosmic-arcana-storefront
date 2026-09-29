import { parseSpreadDetailsV1, type SpreadDetailsV1 } from "@cosmic-arcana/sdk";

import { DEMO_USER_ID, newIdempotencyKey } from "./demo-identity";

export const tarotBaseUrl = (): string =>
  (process.env.TAROT_BASE_URL ?? "").replace(/\/$/, "");

export const createSpread = async (question: string): Promise<SpreadDetailsV1> => {
  const base = tarotBaseUrl();
  if (!base) {
    throw new Error("TAROT_BASE_URL is not set");
  }

  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("question is empty");
  }

  const response = await fetch(`${base}/spreads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": newIdempotencyKey(),
    },
    body: JSON.stringify({ userId: DEMO_USER_ID, question: trimmed }),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`tarot ${response.status}`);
  }

  return parseSpreadDetailsV1(body);
};
