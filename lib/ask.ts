import { MAX_QUESTION_CHARS } from "./rate-limit.ts";

export { MAX_QUESTION_CHARS };

export type AskRejection = "question required" | "question too long" | "consent required";

export type AskDecision =
  | { kind: "rate-limited" }
  | { kind: "unconfigured" }
  | { kind: "invalid"; reason: AskRejection }
  | { kind: "signed-out" }
  | { kind: "ready"; question: string; userId: string };

/**
 * Every rule the ask path applies, in the order it applies them, with no I/O. The order is part of
 * the contract: a flood is refused before the tarot service is consulted, and a question is only
 * attached to a person once it is known to be storable.
 */
export const decideAsk = ({
  payload,
  allowed,
  configured,
  userId,
}: {
  payload: unknown;
  allowed: boolean;
  configured: boolean;
  userId: string | null;
}): AskDecision => {
  if (!allowed) {
    return { kind: "rate-limited" };
  }
  if (!configured) {
    return { kind: "unconfigured" };
  }

  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const question = typeof record.question === "string" ? record.question.trim() : "";

  if (question.length === 0) {
    return { kind: "invalid", reason: "question required" };
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return { kind: "invalid", reason: "question too long" };
  }
  if (record.consent !== true) {
    return { kind: "invalid", reason: "consent required" };
  }
  if (!userId) {
    return { kind: "signed-out" };
  }

  return { kind: "ready", question, userId };
};
