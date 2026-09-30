import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deleteOutcome,
  isSpreadId,
  itemBySpreadId,
  parseHistoryPage,
  readingsView,
  resolveReadingDetail,
} from "./history.ts";

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

  it("shows error instead of inventing a reading", () => {
    assert.deepEqual(readingsView(parseHistoryPage(sample), "history 503"), {
      kind: "error",
      message: "history 503",
    });
  });
});

describe("itemBySpreadId", () => {
  it("opens the stored spread and nothing else", () => {
    const page = parseHistoryPage(sample);
    const found = itemBySpreadId(page, sample.items[0]!.spreadId);
    assert.equal(found?.prediction, "stub");
    assert.equal(itemBySpreadId(page, "00000000-0000-4000-8000-000000000099"), null);
  });
});

describe("resolveReadingDetail", () => {
  const page = parseHistoryPage(sample);
  const spreadId = sample.items[0]!.spreadId;

  it("asks the visitor to sign in when there is no user", async () => {
    const view = await resolveReadingDetail({
      userId: null,
      spreadId,
      configured: true,
      loadPage: async () => page,
    });
    assert.equal(view.kind, "signed-out");
  });

  it("reports an unconfigured history service before calling it", async () => {
    let called = false;
    const view = await resolveReadingDetail({
      userId: "u",
      spreadId,
      configured: false,
      loadPage: async () => {
        called = true;
        return page;
      },
    });
    assert.equal(view.kind, "unconfigured");
    assert.equal(called, false);
  });

  it("returns the reading when the history holds it", async () => {
    const view = await resolveReadingDetail({
      userId: "u",
      spreadId,
      configured: true,
      loadPage: async () => page,
    });
    assert.equal(view.kind, "ready");
    assert.equal(view.kind === "ready" ? view.item.spreadId : null, spreadId);
  });

  it("separates a reading that is not in the history from a failure", async () => {
    const missing = await resolveReadingDetail({
      userId: "u",
      spreadId: "22222222-2222-4222-8222-222222222222",
      configured: true,
      loadPage: async () => page,
    });
    assert.equal(missing.kind, "missing");

    const failed = await resolveReadingDetail({
      userId: "u",
      spreadId,
      configured: true,
      loadPage: async () => {
        throw new Error("history 502");
      },
    });
    assert.equal(failed.kind, "error");
    assert.equal(failed.kind === "error" ? failed.message : "", "history 502");
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

  it("keeps a missing reading a 404, not a gateway error", () => {
    assert.deepEqual(deleteOutcome(404), { status: 404, body: { error: "not found" } });
  });

  it("reports anything else as an upstream failure", () => {
    assert.deepEqual(deleteOutcome(500), { status: 502, body: { error: "history 500" } });
    assert.deepEqual(deleteOutcome(403), { status: 502, body: { error: "history 403" } });
  });
});
