import {
  HISTORY_PROXY,
  TAROT_PROXY,
  injectFault,
  lastForwarded,
  uniqueQuestion,
} from "./support/stack";
import { expect, test } from "./support/test";

const CORRELATION_ID = /^[A-Za-z0-9_-]{8,128}$/;

test.describe("Feature: one visitor action can be followed through the system", () => {
  test("Given a question is asked, When the BFF answers, Then its correlation id is in the response and was sent on to tarot", async ({
    request,
  }) => {
    const response = await request.post("/api/spreads", {
      data: { question: uniqueQuestion("trace me"), consent: true },
    });

    expect(response.status()).toBe(200);
    const correlationId = response.headers()["x-correlation-id"];
    expect(correlationId).toMatch(CORRELATION_ID);
    expect((await lastForwarded(TAROT_PROXY)).headers["x-correlation-id"]).toBe(correlationId);
  });

  test("Given two questions, When both are answered, Then each has an id of its own", async ({
    request,
  }) => {
    const first = await request.post("/api/spreads", {
      data: { question: uniqueQuestion("one"), consent: true },
    });
    const second = await request.post("/api/spreads", {
      data: { question: uniqueQuestion("two"), consent: true },
    });

    expect(first.headers()["x-correlation-id"]).not.toBe(second.headers()["x-correlation-id"]);
  });

  test("Given a browser that sends its own correlation id, When it asks, Then the id is ignored and the BFF's own is used throughout", async ({
    request,
  }) => {
    const response = await request.post("/api/spreads", {
      headers: { "x-correlation-id": "forged-by-the-browser" },
      data: { question: uniqueQuestion("forged"), consent: true },
    });

    const used = response.headers()["x-correlation-id"];
    expect(used).not.toBe("forged-by-the-browser");
    expect((await lastForwarded(TAROT_PROXY)).headers["x-correlation-id"]).toBe(used);
  });

  test("Given a request that is refused, When the BFF answers, Then even the refusal carries an id", async ({
    request,
  }) => {
    const response = await request.post("/api/spreads", { data: {} });

    expect(response.status()).toBe(400);
    expect(response.headers()["x-correlation-id"]).toMatch(CORRELATION_ID);
  });

  test("Given tarot is down, When the BFF answers 503, Then the answer still carries the id support would search for", async ({
    request,
  }) => {
    await injectFault(TAROT_PROXY, { kind: "down" });

    const response = await request.post("/api/spreads", {
      data: { question: uniqueQuestion("down"), consent: true },
    });

    expect(response.status()).toBe(503);
    expect(response.headers()["x-correlation-id"]).toMatch(CORRELATION_ID);
  });

  test("Given the saved list is asked for, When the BFF calls history, Then the same id is sent on", async ({
    request,
  }) => {
    const response = await request.get("/api/readings");

    expect(response.status()).toBe(200);
    const correlationId = response.headers()["x-correlation-id"];
    expect((await lastForwarded(HISTORY_PROXY)).headers["x-correlation-id"]).toBe(correlationId);
  });
});
