import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeAiInterpretation, SlidingCircuitBreaker } from "./dependency-status.ts";

describe("mergeAiInterpretation", () => {
  it("goes down when the breaker is open even if the official page is quiet", () => {
    const breaker = new SlidingCircuitBreaker({ minSamples: 10, failRatio: 0.5 });
    breaker.seedFailures(8, 2);
    assert.equal(breaker.isOpen(), true);
    assert.equal(
      mergeAiInterpretation({
        officialIndicator: "none",
        breakerOpen: breaker.isOpen(),
        fallbackAvailable: false,
      }),
      "down",
    );
  });

  it("stays up when a fallback provider is configured", () => {
    assert.equal(
      mergeAiInterpretation({
        officialIndicator: "critical",
        breakerOpen: true,
        fallbackAvailable: true,
      }),
      "up",
    );
  });
});
