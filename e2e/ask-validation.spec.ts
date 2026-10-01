import { fillQuestion, openHome } from "./support/ask";
import { uniqueQuestion } from "./support/stack";
import { expect, test } from "./support/test";

test.describe("Feature: the form only sends a question that is valid and consented to", () => {
  test("Given an empty form, When the page loads, Then Ask is disabled", async ({ page }) => {
    await openHome(page);

    await expect(page.getByTestId("ask-button")).toBeDisabled();
  });

  test("Given a question without consent, When the user types, Then Ask stays disabled", async ({
    page,
  }) => {
    await openHome(page);

    await fillQuestion(page, uniqueQuestion("no consent"), false);

    await expect(page.getByTestId("ask-button")).toBeDisabled();
  });

  test("Given consent without a question, When the user ticks the box, Then Ask stays disabled", async ({
    page,
  }) => {
    await openHome(page);

    await page.getByLabel(/I consent to storing/).check();

    await expect(page.getByTestId("ask-button")).toBeDisabled();
  });

  test("Given a question made only of spaces, When consent is given, Then Ask stays disabled", async ({
    page,
  }) => {
    await openHome(page);

    await fillQuestion(page, "     ");

    await expect(page.getByTestId("ask-button")).toBeDisabled();
  });

  test("Given a question and consent, When both are present, Then Ask is enabled", async ({
    page,
  }) => {
    await openHome(page);

    await fillQuestion(page, uniqueQuestion("valid"));

    await expect(page.getByTestId("ask-button")).toBeEnabled();
  });

  test("Given a typed question, When consent is withdrawn, Then Ask is disabled again", async ({
    page,
  }) => {
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("withdraw"));
    await expect(page.getByTestId("ask-button")).toBeEnabled();

    await page.getByLabel(/I consent to storing/).uncheck();

    await expect(page.getByTestId("ask-button")).toBeDisabled();
  });

  test("Given a very long paste, When it is entered, Then the box keeps at most 1000 characters", async ({
    page,
  }) => {
    await openHome(page);

    await page.getByLabel("Your question").fill("a".repeat(1_200));

    await expect(page.getByLabel("Your question")).toHaveValue("a".repeat(1_000));
  });

  test("Given non-latin text and an emoji, When the user asks, Then the reading echoes it unchanged", async ({
    page,
  }) => {
    const question = uniqueQuestion("今年は転職すべきですか？ Що чекає на мене? ✨");
    await openHome(page);
    await fillQuestion(page, question);

    await page.getByTestId("ask-button").click();

    await expect(page.locator("[data-spread-id]")).toContainText(question);
  });

  test("Given markup in the question, When the reading is shown, Then it is text and never becomes elements", async ({
    page,
  }) => {
    const question = uniqueQuestion('<img src=x onerror="window.__pwned=1"> <b>bold</b>');
    await openHome(page);
    await fillQuestion(page, question);

    await page.getByTestId("ask-button").click();

    await expect(page.locator("[data-spread-id]")).toContainText("<b>bold</b>");
    await expect(page.locator("[data-spread-id] img, [data-spread-id] b")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });
});

test.describe("Feature: the ask endpoint refuses what the form would never send", () => {
  const rejected: { name: string; body: unknown; error: string }[] = [
    { name: "no question", body: {}, error: "question required" },
    { name: "a blank question", body: { question: "   ", consent: true }, error: "question required" },
    { name: "no consent", body: { question: "hello" }, error: "consent required" },
    { name: "consent that is not literally true", body: { question: "hello", consent: "yes" }, error: "consent required" },
    { name: "a question over 1000 characters", body: { question: "a".repeat(1_001), consent: true }, error: "question too long" },
  ];

  for (const { name, body, error } of rejected) {
    test(`Given ${name}, When it is posted, Then it is refused with 400 "${error}"`, async ({
      request,
    }) => {
      const response = await request.post("/api/spreads", { data: body });

      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error });
    });
  }

  test("Given a body that is not JSON, When it is posted, Then it is refused with 400", async ({
    request,
  }) => {
    const response = await request.post("/api/spreads", {
      headers: { "content-type": "application/json" },
      data: "this is not json",
    });

    expect(response.status()).toBe(400);
  });

  test("Given a question of exactly 1000 characters, When it is posted, Then it is accepted", async ({
    request,
  }) => {
    const response = await request.post("/api/spreads", {
      data: { question: "a".repeat(1_000), consent: true },
    });

    expect(response.status()).toBe(200);
  });
});

test.describe("Feature: one client cannot flood the ask endpoint", () => {
  test("Given ten requests in a minute from one client, When an eleventh arrives, Then it is refused with 429", async ({
    request,
  }) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request.post("/api/spreads", { data: {} });
      expect(response.status()).toBe(400);
    }

    const eleventh = await request.post("/api/spreads", { data: {} });

    expect(eleventh.status()).toBe(429);
  });

  test("Given the limit is reached, When the user asks in the page, Then the message tells them to wait and does not show a code", async ({
    page,
  }) => {
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "10.200.200.200" });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.request.post("/api/spreads", { data: {} });
    }
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("one too many"));

    await page.getByTestId("ask-button").click();

    await expect(page.getByTestId("ask-error")).toContainText(/too many|wait|slow down/i);
    await expect(page.getByTestId("ask-error")).not.toContainText(/rate limited|429/i);
  });
});
