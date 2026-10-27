import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { MAX_QUESTION_CHARS, allowRequest, resetRateLimit, trackedClients } from "./rate-limit.ts";

const T0 = 1_000_000;

beforeEach(() => resetRateLimit());

describe("the ask rate limit", () => {
  it("lets one client ask ten times in a minute and refuses the eleventh", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(allowRequest("client", T0 + attempt), true);
    }
    assert.equal(allowRequest("client", T0 + 10), false);
  });

  it("does not let one client use up another's allowance", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      allowRequest("noisy", T0);
    }

    assert.equal(allowRequest("noisy", T0), false);
    assert.equal(allowRequest("quiet", T0), true);
  });

  it("lets a client back in once its minute has passed", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      allowRequest("client", T0);
    }

    assert.equal(allowRequest("client", T0 + 59_000), false);
    assert.equal(allowRequest("client", T0 + 60_001), true);
  });

  it("keeps the question length limit the form and the endpoint share", () => {
    assert.equal(MAX_QUESTION_CHARS, 1_000);
  });
});

describe("what the limiter remembers", () => {
  it("never tracks more clients than its cap, however many distinct addresses arrive", () => {
    for (let client = 0; client < 25_000; client += 1) {
      allowRequest(`10.0.${client}`, T0 + client);
    }

    assert.ok(trackedClients() <= 10_000, `tracked ${trackedClients()} clients`);
  });

  it("forgets clients that went quiet instead of holding them for ever", () => {
    for (let client = 0; client < 1_000; client += 1) {
      allowRequest(`quiet-${client}`, T0);
    }
    assert.equal(trackedClients(), 1_000);

    allowRequest("newcomer", T0 + 61_000);

    assert.equal(trackedClients(), 1);
  });

  it("still refuses a client that keeps asking while others come and go", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      allowRequest("persistent", T0);
    }
    for (let client = 0; client < 50; client += 1) {
      allowRequest(`passer-by-${client}`, T0 + 1);
    }

    assert.equal(allowRequest("persistent", T0 + 2), false);
  });
});
