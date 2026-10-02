import { serverSentence, type AskOutcome } from "./ask-failure.ts";
import { USER_MESSAGES } from "./user-messages.ts";

/** What the visitor reads when removing a reading did not work. `null`: the server was unreachable. */
export const removeFailureMessage = (outcome: AskOutcome | null): string => {
  if (outcome === null) {
    return USER_MESSAGES.networkDown;
  }
  return serverSentence(outcome.body) ?? USER_MESSAGES.removeFailed;
};
