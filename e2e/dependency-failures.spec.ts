import { fillQuestion, openHome } from "./support/ask";
import {
  HISTORY_PROXY,
  TAROT_PROXY,
  clearHistory,
  clearFaults,
  createReading,
  injectFault,
  uniqueQuestion,
  waitForHistory,
} from "./support/stack";
import { expect, test } from "./support/test";

// What a user must never be shown: status codes, env var names, or the runtime's own error text.
const TECHNICAL = /tarot \d{3}|history \d{3}|delete \d{3}|fetch failed|_BASE_URL|ECONN|ENOTFOUND|undici/i;
const FRIENDLY = /unavailable|try again|couldn.t|not available/i;

test.describe("Feature: asking while tarot is unavailable", () => {
  test("Given tarot cannot be reached, When the user asks, Then the answer is 503 and the page says the cards are unavailable", async ({
    page,
  }) => {
    await injectFault(TAROT_PROXY, { kind: "down" });
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("tarot down"));

    const [response] = await Promise.all([
      page.waitForResponse("**/api/spreads"),
      page.getByTestId("ask-button").click(),
    ]);

    expect(response.status()).toBe(503);
    await expect(page.getByTestId("ask-error")).toContainText(FRIENDLY);
    await expect(page.getByTestId("ask-error")).not.toContainText(TECHNICAL);
    await expect(page.getByTestId("ask-button")).toBeEnabled();
    await expect(page.locator("[data-card-id]")).toHaveCount(0);
  });

  for (const status of [500, 502, 503]) {
    test(`Given tarot answers ${status}, When the user asks, Then the answer is 502 and the page stays friendly`, async ({
      page,
    }) => {
      await injectFault(TAROT_PROXY, { kind: "status", status });
      await openHome(page);
      await fillQuestion(page, uniqueQuestion(`tarot ${status}`));

      const [response] = await Promise.all([
        page.waitForResponse("**/api/spreads"),
        page.getByTestId("ask-button").click(),
      ]);

      expect(response.status()).toBe(502);
      await expect(page.getByTestId("ask-error")).toContainText(FRIENDLY);
      await expect(page.getByTestId("ask-error")).not.toContainText(TECHNICAL);
    });
  }

  test("Given tarot answers with something that is not a reading, When the user asks, Then the answer is 502 and the page stays friendly", async ({
    request,
  }) => {
    await injectFault(TAROT_PROXY, { kind: "garbage" });

    const response = await request.post("/api/spreads", {
      data: { question: uniqueQuestion("garbage"), consent: true },
    });

    expect(response.status()).toBe(502);
    expect((await response.json()).error).toMatch(FRIENDLY);
  });

  test("Given tarot never answers, When the user asks, Then the app gives up in time with 504 instead of hanging", async ({
    request,
  }) => {
    await injectFault(TAROT_PROXY, { kind: "hang" });
    const startedAt = Date.now();

    const response = await request.post("/api/spreads", {
      data: { question: uniqueQuestion("hang"), consent: true },
      timeout: 12_000,
    });

    expect(response.status()).toBe(504);
    expect(Date.now() - startedAt).toBeLessThan(8_000);
    expect((await response.json()).error).toMatch(FRIENDLY);
  });

  test("Given tarot was down, When it comes back, Then the same page can ask again without a reload", async ({
    page,
  }) => {
    await injectFault(TAROT_PROXY, { kind: "down" });
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("retry"));
    await page.getByTestId("ask-button").click();
    await expect(page.getByTestId("ask-error")).toBeVisible();

    await clearFaults();
    await page.getByTestId("ask-button").click();

    await expect(page.locator("[data-spread-id]")).toBeVisible();
    await expect(page.getByTestId("ask-error")).toHaveCount(0);
  });

  test("Given a reading on screen, When the next ask fails, Then the old reading is not left up as if it were the answer", async ({
    page,
  }) => {
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("first"));
    await page.getByTestId("ask-button").click();
    await expect(page.locator("[data-spread-id]")).toBeVisible();

    await injectFault(TAROT_PROXY, { kind: "down" });
    await page.getByTestId("ask-button").click();

    await expect(page.getByTestId("ask-error")).toBeVisible();
    await expect(page.locator("[data-spread-id]")).toHaveCount(0);
  });
});

test.describe("Feature: saved readings while history is unavailable", () => {
  test("Given history cannot be reached, When the user opens Saved, Then the page explains it and keeps its navigation", async ({
    page,
  }) => {
    await injectFault(HISTORY_PROXY, { kind: "down" });

    await page.goto("/readings");

    await expect(page.getByTestId("readings-error")).toContainText(FRIENDLY);
    await expect(page.getByTestId("readings-error")).not.toContainText(TECHNICAL);
    await expect(page.getByRole("heading", { name: "Saved readings" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  for (const status of [500, 503]) {
    test(`Given history answers ${status}, When the user opens Saved, Then the page stays friendly`, async ({
      page,
    }) => {
      await injectFault(HISTORY_PROXY, { kind: "status", status });

      await page.goto("/readings");

      await expect(page.getByTestId("readings-error")).toContainText(FRIENDLY);
      await expect(page.getByTestId("readings-error")).not.toContainText(TECHNICAL);
    });
  }

  test("Given history answers with garbage, When the user opens Saved, Then the page stays friendly", async ({
    page,
  }) => {
    await injectFault(HISTORY_PROXY, { kind: "garbage" });

    await page.goto("/readings");

    await expect(page.getByTestId("readings-error")).toContainText(FRIENDLY);
    await expect(page.getByTestId("readings-error")).not.toContainText(TECHNICAL);
  });

  test("Given history never answers, When the user opens Saved, Then the page gives up in time instead of hanging", async ({
    page,
  }) => {
    await injectFault(HISTORY_PROXY, { kind: "hang" });
    const startedAt = Date.now();

    await page.goto("/readings", { timeout: 12_000 });

    await expect(page.getByTestId("readings-error")).toContainText(FRIENDLY);
    expect(Date.now() - startedAt).toBeLessThan(9_000);
  });

  test("Given history is down, When a reading is opened, Then its page says history is unavailable rather than missing", async ({
    page,
  }) => {
    await clearHistory();
    const reading = await createReading(uniqueQuestion("detail while down"));
    await waitForHistory([reading.spreadId]);
    await injectFault(HISTORY_PROXY, { kind: "down" });

    await page.goto(`/readings/${reading.spreadId}`);

    await expect(page.getByTestId("reading-missing")).toHaveCount(0);
    await expect(page.getByTestId("reading-error")).toContainText(FRIENDLY);
    await expect(page.getByTestId("reading-error")).not.toContainText(TECHNICAL);
  });

  test("Given history is down, When the user confirms removing a reading, Then they are told it did not work and can try again", async ({
    page,
  }) => {
    await clearHistory();
    const reading = await createReading(uniqueQuestion("remove while down"));
    await waitForHistory([reading.spreadId]);
    await page.goto(`/readings/${reading.spreadId}`);
    await injectFault(HISTORY_PROXY, { kind: "down" });

    await page.getByRole("button", { name: "Remove from history" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(FRIENDLY);
    await expect(page.getByRole("main").getByRole("alert")).not.toContainText(TECHNICAL);
    await expect(page).toHaveURL(new RegExp(`/readings/${reading.spreadId}$`));
  });

  test("Given history was down, When it comes back, Then Saved works again on the next visit", async ({
    page,
  }) => {
    await clearHistory();
    const reading = await createReading(uniqueQuestion("recovers"));
    await waitForHistory([reading.spreadId]);
    await injectFault(HISTORY_PROXY, { kind: "down" });
    await page.goto("/readings");
    await expect(page.getByTestId("readings-error")).toBeVisible();

    await clearFaults();
    await page.goto("/readings");

    await expect(page.getByTestId("readings-error")).toHaveCount(0);
    await expect(page.getByTestId("readings-list")).toContainText(reading.question);
  });
});

test.describe("Feature: the readings api reports a dependency failure with the right status", () => {
  test("Given history cannot be reached, When the api is called, Then it answers 503 with a friendly message", async ({
    request,
  }) => {
    await injectFault(HISTORY_PROXY, { kind: "down" });

    const response = await request.get("/api/readings");

    expect(response.status()).toBe(503);
    expect((await response.json()).error).toMatch(FRIENDLY);
  });

  test("Given history answers 500, When the api is called, Then it answers 502", async ({
    request,
  }) => {
    await injectFault(HISTORY_PROXY, { kind: "status", status: 500 });

    const response = await request.get("/api/readings");

    expect(response.status()).toBe(502);
  });
});
