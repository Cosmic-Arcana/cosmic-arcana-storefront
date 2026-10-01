import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { removeFailureMessage } from "./remove-failure.ts";
import { USER_MESSAGES } from "./user-messages.ts";

describe("what the visitor reads when removing a reading fails", () => {
  it("says so plainly when the server could not be reached", () => {
    assert.equal(removeFailureMessage(null), USER_MESSAGES.networkDown);
  });

  it("uses the sentence the server chose, such as that the reading was already removed", () => {
    assert.equal(
      removeFailureMessage({ status: 404, body: { error: USER_MESSAGES.readingAlreadyRemoved } }),
      USER_MESSAGES.readingAlreadyRemoved,
    );
  });

  it("falls back to a generic sentence, never a status code or a body that is not text", () => {
    assert.equal(removeFailureMessage({ status: 502, body: null }), USER_MESSAGES.removeFailed);
    assert.equal(removeFailureMessage({ status: 500, body: { error: { nested: true } } }), USER_MESSAGES.removeFailed);
  });
});
