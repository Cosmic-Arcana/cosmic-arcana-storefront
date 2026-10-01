import { USER_MESSAGES } from "./user-messages.ts";

export type AskOutcome = { status: number; body: unknown };

/** The sentence our own BFF chose for the visitor, when the body is one of ours. */
export const serverSentence = (body: unknown): string | null => {
  if (body && typeof body === "object" && "error" in body) {
    const { error } = body as { error: unknown };
    return typeof error === "string" && error.length > 0 ? error : null;
  }
  return null;
};

/** `null` means the browser could not reach the server at all. */
export const askFailureMessage = (outcome: AskOutcome | null): string => {
  if (outcome === null) {
    return USER_MESSAGES.networkDown;
  }
  if (outcome.status === 401) {
    return USER_MESSAGES.signInRequired;
  }
  const sentence = serverSentence(outcome.body);
  if (sentence) {
    return sentence;
  }
  if (outcome.status === 429) {
    return USER_MESSAGES.rateLimited;
  }
  return outcome.status >= 500 ? USER_MESSAGES.cardsUnavailable : USER_MESSAGES.somethingWrong;
};
