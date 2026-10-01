import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { beginRequest, describeFailure, recordPageFailure, CORRELATION_HEADER } from "./bff.ts";
import { setLogSink } from "./log.ts";
import { USER_MESSAGES } from "./user-messages.ts";
import { UpstreamError } from "./upstream.ts";

let lines: Record<string, unknown>[] = [];

beforeEach(() => {
  lines = [];
  setLogSink((line) => lines.push(JSON.parse(line) as Record<string, unknown>));
});
afterEach(() => setLogSink(null));

const request = () => new Request("http://app.test/api/spreads", { method: "POST" });

describe("a bff request", () => {
  it("gets a fresh correlation id that comes back in the response header", async () => {
    const first = beginRequest(request(), "/api/spreads");
    const second = beginRequest(request(), "/api/spreads");

    const response = first.respond(200, { ok: true }, "created");

    assert.match(first.correlationId, /^[A-Za-z0-9_-]{8,128}$/);
    assert.notEqual(first.correlationId, second.correlationId);
    assert.equal(response.headers.get(CORRELATION_HEADER), first.correlationId);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("does not trust a correlation id sent by the browser", () => {
    const hostile = new Request("http://app.test/x", {
      method: "POST",
      headers: { [CORRELATION_HEADER]: "forged-id-from-the-internet" },
    });

    assert.notEqual(beginRequest(hostile, "/x").correlationId, "forged-id-from-the-internet");
  });

  it("logs one single-line json entry with every required field", () => {
    const started = beginRequest(request(), "/api/spreads");

    started.respond(200, {}, "created");

    assert.equal(lines.length, 1);
    const line = lines[0];
    assert.equal(line.level, "log");
    assert.equal(line.service, "cosmic-arcana-storefront");
    assert.equal(line.correlationId, started.correlationId);
    assert.equal(line.context, "BffRoute");
    assert.equal(line.message, "inbound handled");
    assert.equal(line.method, "POST");
    assert.equal(line.route, "/api/spreads");
    assert.equal(line.statusCode, 200);
    assert.equal(line.outcome, "created");
    assert.equal(typeof line.durationMs, "number");
    assert.match(String(line.timestamp), /^\d{4}-\d{2}-\d{2}T/);
  });

  it("logs a dependency outage as a warning and a bug as an error", () => {
    beginRequest(request(), "/a").respond(503, {}, "error");
    beginRequest(request(), "/b").respond(500, {}, "error");
    beginRequest(request(), "/c").respond(429, {}, "rate-limited");

    assert.deepEqual(
      lines.map((line) => line.level),
      ["warn", "error", "log"],
    );
  });

  it("never lets a visitor's text into the log", () => {
    const started = beginRequest(request(), "/api/spreads");

    started.respond(200, { question: "my secret worry" }, "created");

    assert.doesNotMatch(JSON.stringify(lines), /secret worry/);
  });
});

describe("describeFailure", () => {
  it("turns a dependency failure into its status, a friendly sentence and log fields", () => {
    const failure = describeFailure(new UpstreamError("tarot", "bad-status", 500));

    assert.equal(failure.status, 502);
    assert.equal(failure.message, USER_MESSAGES.cardsUnavailable);
    assert.deepEqual(failure.fields, {
      outcome: "error",
      errorName: "UpstreamError",
      upstream: "tarot",
      failure: "bad-status",
      upstreamStatus: 500,
    });
  });

  it("answers an unexpected error with 500 and a generic sentence that leaks nothing", () => {
    const failure = describeFailure(new TypeError("Cannot read properties of undefined"));

    assert.equal(failure.status, 500);
    assert.equal(failure.message, USER_MESSAGES.somethingWrong);
    assert.equal(failure.fields.errorName, "TypeError");
  });
});

describe("recordPageFailure", () => {
  it("writes one warning for a dependency outage and returns the sentence for the page", () => {
    const message = recordPageFailure("corr-12345678", "/readings", new UpstreamError("history", "timeout"));

    assert.equal(message, USER_MESSAGES.savedUnavailable);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].level, "warn");
    assert.equal(lines[0].correlationId, "corr-12345678");
    assert.equal(lines[0].route, "/readings");
    assert.equal(lines[0].failure, "timeout");
    assert.equal(lines[0].statusCode, 504);
  });

  it("writes an error for something unexpected", () => {
    recordPageFailure("corr-12345678", "/readings", new RangeError("boom"));

    assert.equal(lines[0].level, "error");
    assert.equal(lines[0].errorName, "RangeError");
  });
});
