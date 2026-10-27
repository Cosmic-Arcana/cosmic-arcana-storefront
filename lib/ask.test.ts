import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideAsk, MAX_QUESTION_CHARS } from "./ask.ts";

const ready = {
  payload: { question: "  should i take the job?  ", consent: true },
  allowed: true,
  configured: true,
  userId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
};

describe("decideAsk", () => {
  it("accepts a consented question from a signed-in visitor", () => {
    const decision = decideAsk(ready);
    assert.equal(decision.kind, "ready");
    assert.equal(decision.kind === "ready" ? decision.question : "", "should i take the job?");
    assert.equal(decision.kind === "ready" ? decision.userId : "", ready.userId);
  });

  it("refuses before anything else when the caller is over the rate limit", () => {
    // Order matters: a flood must not reach the tarot service, even with a perfect payload.
    const decision = decideAsk({ ...ready, allowed: false, configured: false, userId: null });
    assert.equal(decision.kind, "rate-limited");
  });

  it("reports an unconfigured tarot service before reading the body", () => {
    const decision = decideAsk({ ...ready, configured: false, payload: "not json at all" });
    assert.equal(decision.kind, "unconfigured");
  });

  it("rejects a body that is not an object", () => {
    const decision = decideAsk({ ...ready, payload: null });
    assert.equal(decision.kind, "invalid");
    assert.equal(decision.kind === "invalid" ? decision.reason : "", "question required");
  });

  it("rejects an empty or whitespace-only question", () => {
    for (const question of ["", "   ", 42]) {
      const decision = decideAsk({ ...ready, payload: { question, consent: true } });
      assert.equal(decision.kind, "invalid");
      assert.equal(decision.kind === "invalid" ? decision.reason : "", "question required");
    }
  });

  it("rejects a question longer than the advertised limit", () => {
    const decision = decideAsk({
      ...ready,
      payload: { question: "x".repeat(MAX_QUESTION_CHARS + 1), consent: true },
    });
    assert.equal(decision.kind, "invalid");
    assert.equal(decision.kind === "invalid" ? decision.reason : "", "question too long");
  });

  it("keeps a question exactly at the limit", () => {
    const decision = decideAsk({
      ...ready,
      payload: { question: "x".repeat(MAX_QUESTION_CHARS), consent: true },
    });
    assert.equal(decision.kind, "ready");
  });

  it("stores nothing without consent", () => {
    for (const consent of [false, undefined, "yes"]) {
      const decision = decideAsk({ ...ready, payload: { question: "will it rain?", consent } });
      assert.equal(decision.kind, "invalid");
      assert.equal(decision.kind === "invalid" ? decision.reason : "", "consent required");
    }
  });

  it("asks an anonymous visitor to sign in, after the payload is known good", () => {
    const decision = decideAsk({ ...ready, userId: null });
    assert.equal(decision.kind, "signed-out");
  });
});
