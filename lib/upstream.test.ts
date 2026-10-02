import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { USER_MESSAGES } from "./user-messages.ts";
import {
  UpstreamError,
  readUpstreamJson,
  upstreamFetch,
  upstreamTimeoutMs,
  upstreamUserMessage,
} from "./upstream.ts";

afterEach(() => mock.restoreAll());

describe("upstreamFetch", () => {
  it("returns the response untouched when the service answers", async () => {
    mock.method(globalThis, "fetch", async () => new Response("{}", { status: 200 }));

    const response = await upstreamFetch("tarot", "http://tarot.test/spreads");

    assert.equal(response.status, 200);
  });

  it("reports a refused or reset connection as unreachable", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed");
    });

    await assert.rejects(upstreamFetch("history", "http://history.test/x"), (error: unknown) => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.upstream, "history");
      assert.equal(error.failure, "unreachable");
      assert.equal(error.httpStatus, 503);
      return true;
    });
  });

  it("gives up on a service that never answers and says it timed out", async () => {
    mock.method(globalThis, "fetch", (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
    );

    // AbortSignal.timeout does not keep the event loop alive, and in a bare test nothing else does.
    const keepAlive = setTimeout(() => undefined, 2_000);
    const startedAt = Date.now();
    await assert.rejects(upstreamFetch("tarot", "http://tarot.test/x", {}, 60), (error: unknown) => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.failure, "timeout");
      assert.equal(error.httpStatus, 504);
      return true;
    });
    clearTimeout(keepAlive);
    assert.ok(Date.now() - startedAt < 1_000);
  });

  it("never puts the failure's own text, which can hold hosts and ports, into the error message", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError("connect ECONNREFUSED 10.1.2.3:3004");
    });

    await assert.rejects(upstreamFetch("tarot", "http://tarot.test/x"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /10\.1\.2\.3|ECONNREFUSED/);
      return true;
    });
  });
});

describe("readUpstreamJson", () => {
  it("returns the parsed body", async () => {
    assert.deepEqual(await readUpstreamJson("tarot", new Response('{"a":1}')), { a: 1 });
  });

  it("treats a body that is not JSON as a bad answer from the service", async () => {
    await assert.rejects(readUpstreamJson("history", new Response("<html>oops</html>")), (error: unknown) => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.failure, "bad-body");
      assert.equal(error.httpStatus, 502);
      return true;
    });
  });
});

describe("upstream failures as the visitor sees them", () => {
  it("maps each failure to the status that describes it", () => {
    assert.equal(new UpstreamError("tarot", "unreachable").httpStatus, 503);
    assert.equal(new UpstreamError("tarot", "timeout").httpStatus, 504);
    assert.equal(new UpstreamError("tarot", "bad-status", 500).httpStatus, 502);
    assert.equal(new UpstreamError("tarot", "bad-body").httpStatus, 502);
  });

  it("says the cards are unavailable for tarot and the saved readings for history, never a code", () => {
    assert.equal(upstreamUserMessage(new UpstreamError("tarot", "bad-status", 500)), USER_MESSAGES.cardsUnavailable);
    assert.equal(upstreamUserMessage(new UpstreamError("history", "timeout")), USER_MESSAGES.savedUnavailable);
  });
});

describe("upstreamTimeoutMs", () => {
  it("defaults generously for tarot, which may wait on an AI, and tightly for history", () => {
    assert.equal(upstreamTimeoutMs("tarot", {}), 30_000);
    assert.equal(upstreamTimeoutMs("history", {}), 5_000);
  });

  it("can be set per service from the environment and ignores nonsense", () => {
    assert.equal(upstreamTimeoutMs("tarot", { TAROT_TIMEOUT_MS: "1500" }), 1_500);
    assert.equal(upstreamTimeoutMs("tarot", { TAROT_TIMEOUT_MS: "soon" }), 30_000);
    assert.equal(upstreamTimeoutMs("history", { HISTORY_TIMEOUT_MS: "-5" }), 5_000);
  });
});
