import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { askFailureMessage } from "./ask-failure.ts";
import { USER_MESSAGES } from "./user-messages.ts";

describe("what the visitor reads when asking fails", () => {
  it("tells them to check their connection when the server could not be reached at all", () => {
    assert.equal(askFailureMessage(null), USER_MESSAGES.networkDown);
  });

  it("shows the sentence the server chose, so one place owns the wording", () => {
    assert.equal(askFailureMessage({ status: 503, body: { error: "Cards are resting." } }), "Cards are resting.");
    assert.equal(askFailureMessage({ status: 429, body: { error: USER_MESSAGES.rateLimited } }), USER_MESSAGES.rateLimited);
  });

  it("asks for a sign-in on 401 whatever the body says", () => {
    assert.equal(askFailureMessage({ status: 401, body: { error: "sign in required" } }), USER_MESSAGES.signInRequired);
  });

  it("falls back to the status when the answer is not JSON, as when a proxy replies with a page", () => {
    assert.equal(askFailureMessage({ status: 429, body: null }), USER_MESSAGES.rateLimited);
    assert.equal(askFailureMessage({ status: 502, body: null }), USER_MESSAGES.cardsUnavailable);
    assert.equal(askFailureMessage({ status: 504, body: null }), USER_MESSAGES.cardsUnavailable);
    assert.equal(askFailureMessage({ status: 418, body: null }), USER_MESSAGES.somethingWrong);
  });

  it("never prints a body that is not a plain sentence", () => {
    assert.equal(askFailureMessage({ status: 500, body: { error: { nested: "object" } } }), USER_MESSAGES.cardsUnavailable);
    assert.equal(askFailureMessage({ status: 418, body: { error: 42 } }), USER_MESSAGES.somethingWrong);
    assert.equal(askFailureMessage({ status: 400, body: "text" }), USER_MESSAGES.somethingWrong);
  });
});
