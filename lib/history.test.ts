import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import {
  deleteOutcome,
  fetchHistoryItem,
  fetchHistoryPage,
  isSpreadId,
  parseHistoryPage,
  readingsView,
  resolveReadingDetail,
} from "./history.ts";
import { USER_MESSAGES } from "./user-messages.ts";
import { UpstreamError } from "./upstream.ts";

afterEach(() => mock.restoreAll());

const sample = {
  items: [
    {
      spreadId: "11111111-1111-4111-8111-111111111111",
      question: "should i stay",
      cards: [{ positionKey: "now", cardId: "the-fool", reversed: false }],
      prediction: "stub",
      createdAt: "2026-09-29T00:00:00.000Z",
    },
  ],
  nextCursor: null,
};

describe("parseHistoryPage", () => {
  it("accepts a valid page", () => {
    const page = parseHistoryPage(sample);
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.spreadId, sample.items[0]?.spreadId);
  });

  it("rejects a missing items array", () => {
    assert.throws(() => parseHistoryPage({}), /items missing/);
  });
});

describe("readingsView", () => {
  it("is empty when there are no items", () => {
    assert.deepEqual(readingsView({ items: [], nextCursor: null }, null), { kind: "empty" });
  });

  it("lists items on the happy path", () => {
    const view = readingsView(parseHistoryPage(sample), null);
    assert.equal(view.kind, "list");
    if (view.kind === "list") {
      assert.equal(view.items[0]?.prediction, "stub");
    }
  });

  it("shows the error instead of inventing a reading", () => {
    assert.deepEqual(readingsView(parseHistoryPage(sample), USER_MESSAGES.savedUnavailable), {
      kind: "error",
      message: USER_MESSAGES.savedUnavailable,
    });
  });
});

describe("fetchHistoryPage", () => {
  const call = async (options: { cursor?: string | null } = {}) =>
    fetchHistoryPage("user-1", { correlationId: "corr-12345678", ...options });

  const stubFetch = (response: Response) => {
    const fetchMock = mock.method(globalThis, "fetch", async () => response);
    process.env.HISTORY_BASE_URL = "http://history.test";
    return fetchMock;
  };

  it("asks for the user's page, carrying the correlation id", async () => {
    const fetchMock = stubFetch(Response.json(sample));

    const page = await call();

    assert.equal(page.items.length, 1);
    const [url, init] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
    assert.equal(url, "http://history.test/users/user-1/spread-history");
    assert.equal((init.headers as Record<string, string>)["x-correlation-id"], "corr-12345678");
  });

  it("passes the cursor on, encoded, to reach older readings", async () => {
    const fetchMock = stubFetch(Response.json(sample));

    await call({ cursor: "a b+c/d=" });

    const [url] = fetchMock.mock.calls[0]!.arguments as [string];
    assert.equal(url, "http://history.test/users/user-1/spread-history?cursor=a%20b%2Bc%2Fd%3D");
  });

  it("reports a refusal as a bad status, keeping the code for the log and out of the sentence", async () => {
    stubFetch(new Response("nope", { status: 503 }));

    await assert.rejects(call(), (error: unknown) => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.failure, "bad-status");
      assert.equal(error.upstreamStatus, 503);
      return true;
    });
  });

  it("reports a page of the wrong shape as a bad answer", async () => {
    stubFetch(Response.json({ nothing: "here" }));

    await assert.rejects(call(), (error: unknown) => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.failure, "bad-body");
      return true;
    });
  });
});

describe("fetchHistoryItem", () => {
  const item = sample.items[0]!;
  const lookup = () => fetchHistoryItem("user-1", item.spreadId, "corr-12345678");
  const stubFetch = (response: Response) => {
    mock.method(globalThis, "fetch", async () => response);
    process.env.HISTORY_BASE_URL = "http://history.test";
  };

  it("returns the reading when history has it", async () => {
    stubFetch(Response.json(item));

    const result = await lookup();

    assert.equal(result.kind, "found");
    assert.equal(result.kind === "found" ? result.item.question : "", "should i stay");
  });

  it("tells unknown (404) from removed (410)", async () => {
    stubFetch(Response.json({ statusCode: 404, message: "spread not found" }, { status: 404 }));
    assert.deepEqual(await lookup(), { kind: "unknown" });

    stubFetch(new Response("{}", { status: 410 }));
    assert.deepEqual(await lookup(), { kind: "removed" });
  });

  it("fails safe when a 404 is not history's own answer, as from an older history without this route", async () => {
    // Reading that as "unknown" would send the lookup to the write side, which has no notion of
    // removal and would bring back a reading the visitor deleted.
    stubFetch(
      Response.json({ statusCode: 404, error: "Not Found", message: "Cannot GET /users/u/spread-history/s" }, { status: 404 }),
    );
    await assert.rejects(lookup(), (error: unknown) => {
      assert.ok(error instanceof UpstreamError);
      assert.equal(error.upstreamStatus, 404);
      return true;
    });

    stubFetch(new Response("<html>nginx 404</html>", { status: 404 }));
    await assert.rejects(lookup(), (error: unknown) => error instanceof UpstreamError);
  });

  it("treats any other status as a failure of history", async () => {
    stubFetch(new Response("{}", { status: 500 }));

    await assert.rejects(lookup(), (error: unknown) => error instanceof UpstreamError);
  });
});

describe("resolveReadingDetail", () => {
  const item = parseHistoryPage(sample).items[0]!;
  const spreadId = item.spreadId;
  const owner = "user-1";
  const calls: string[] = [];

  const base = {
    userId: owner,
    spreadId,
    configured: true,
    loadItem: async () => ({ kind: "found" as const, item }),
    loadFromWriteSide: async () => {
      calls.push("write-side");
      return null;
    },
  };

  const written = (userId: string) => ({ ...item, userId });

  it("asks the visitor to sign in when there is no user", async () => {
    const view = await resolveReadingDetail({ ...base, userId: null });
    assert.equal(view.kind, "signed-out");
  });

  it("reports an unconfigured history service before calling anything", async () => {
    let called = false;
    const view = await resolveReadingDetail({
      ...base,
      configured: false,
      loadItem: async () => {
        called = true;
        return { kind: "found" as const, item };
      },
    });
    assert.equal(view.kind, "unconfigured");
    assert.equal(called, false);
  });

  it("returns the reading when history holds it", async () => {
    const view = await resolveReadingDetail(base);
    assert.equal(view.kind, "ready");
    assert.equal(view.kind === "ready" ? view.item.spreadId : null, spreadId);
  });

  it("says missing for an id that is not even a uuid, without asking anyone", async () => {
    let called = false;
    const view = await resolveReadingDetail({
      ...base,
      spreadId: "../../etc/passwd",
      loadItem: async () => {
        called = true;
        return { kind: "found" as const, item };
      },
    });
    assert.equal(view.kind, "missing");
    assert.equal(called, false);
  });

  it("shows a reading history has not caught up with yet, straight from where it was written", async () => {
    const view = await resolveReadingDetail({
      ...base,
      loadItem: async () => ({ kind: "unknown" as const }),
      loadFromWriteSide: async () => written(owner),
    });

    assert.equal(view.kind, "ready");
    assert.equal(view.kind === "ready" ? view.item.question : "", "should i stay");
  });

  it("does not show someone else's reading just because the write side has it", async () => {
    const view = await resolveReadingDetail({
      ...base,
      loadItem: async () => ({ kind: "unknown" as const }),
      loadFromWriteSide: async () => written("another-user"),
    });

    assert.equal(view.kind, "missing");
  });

  it("says missing when neither side knows the reading", async () => {
    const view = await resolveReadingDetail({
      ...base,
      loadItem: async () => ({ kind: "unknown" as const }),
    });
    assert.equal(view.kind, "missing");
  });

  it("never brings a removed reading back from the write side", async () => {
    calls.length = 0;

    const view = await resolveReadingDetail({
      ...base,
      loadItem: async () => ({ kind: "removed" as const }),
      loadFromWriteSide: async () => {
        calls.push("write-side");
        return written(owner);
      },
    });

    assert.equal(view.kind, "missing");
    assert.deepEqual(calls, []);
  });

  it("separates a failure from a missing reading and never prints a code", async () => {
    const down = await resolveReadingDetail({
      ...base,
      loadItem: async () => {
        throw new UpstreamError("history", "unreachable");
      },
    });
    assert.deepEqual(down, { kind: "error", message: USER_MESSAGES.savedUnavailable });

    const odd = await resolveReadingDetail({
      ...base,
      loadItem: async () => {
        throw new TypeError("Cannot read properties of undefined");
      },
    });
    assert.deepEqual(odd, { kind: "error", message: USER_MESSAGES.somethingWrong });
  });

  it("reports a failure of the write side as unavailable rather than guessing the reading is missing", async () => {
    const view = await resolveReadingDetail({
      ...base,
      loadItem: async () => ({ kind: "unknown" as const }),
      loadFromWriteSide: async () => {
        throw new UpstreamError("tarot", "timeout");
      },
    });
    assert.deepEqual(view, { kind: "error", message: USER_MESSAGES.savedUnavailable });
  });
});

describe("isSpreadId", () => {
  it("accepts a uuid", () => {
    assert.equal(isSpreadId("11111111-1111-4111-8111-111111111111"), true);
  });

  it("rejects anything that could travel up a url path", () => {
    for (const value of ["", "../../secrets", "11111111", "not a uuid", "1/2"]) {
      assert.equal(isSpreadId(value), false);
    }
  });
});

describe("deleteOutcome", () => {
  it("passes a deletion through", () => {
    assert.deepEqual(deleteOutcome(200), { status: 200, body: { deleted: true } });
    assert.deepEqual(deleteOutcome(204), { status: 200, body: { deleted: true } });
  });

  it("keeps an already removed reading a 404 and says so in words", () => {
    assert.deepEqual(deleteOutcome(404), {
      status: 404,
      body: { error: USER_MESSAGES.readingAlreadyRemoved },
    });
    assert.deepEqual(deleteOutcome(410), {
      status: 404,
      body: { error: USER_MESSAGES.readingAlreadyRemoved },
    });
  });

  it("reports anything else as an upstream failure without a code in the sentence", () => {
    assert.deepEqual(deleteOutcome(500), { status: 502, body: { error: USER_MESSAGES.removeFailed } });
    assert.deepEqual(deleteOutcome(403), { status: 502, body: { error: USER_MESSAGES.removeFailed } });
  });
});
