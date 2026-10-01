import { askOnHome, fillQuestion, openHome } from "./support/ask";
import { TAROT_PROXY, injectFault, uniqueQuestion } from "./support/stack";
import { expect, test } from "./support/test";

test.describe("Feature: ask a question and get a reading", () => {
  test("Given a question and consent, When the user asks, Then three cards are drawn and a prediction is shown", async ({
    page,
  }) => {
    const question = uniqueQuestion("Should I change jobs this year?");

    const spreadId = await askOnHome(page, question);

    expect(spreadId).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    await expect(page.locator("[data-spread-id]")).toContainText(question);
    await expect(page.locator("[data-card-id]")).toHaveCount(3);
    for (const position of ["past", "present", "future"]) {
      await expect(page.locator(`[data-card-id][data-position="${position}"]`)).toHaveCount(1);
    }
  });

  test("Given a reading, When it is shown, Then the sky motifs say they are symbolic and not a real NASA call", async ({
    page,
  }) => {
    await askOnHome(page, uniqueQuestion("What does the sky say?"));

    await expect(page.getByTestId("cosmic-context")).toContainText("not a live NASA call");
    await expect(page.getByTestId("cosmic-context")).toContainText("did not choose these cards");
  });

  test("Given the fiction notice, When the page loads, Then it is visible before any question is asked", async ({
    page,
  }) => {
    await openHome(page);

    await expect(page.getByText("Readings are fiction and entertainment")).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  });

  test("Given a drawn reading, When the user asks a second question, Then the new reading replaces the old one", async ({
    page,
  }) => {
    const first = await askOnHome(page, uniqueQuestion("first"));
    const secondQuestion = uniqueQuestion("second");

    await page.getByLabel("Your question").fill(secondQuestion);
    await page.getByTestId("ask-button").click();

    await expect(page.locator("[data-spread-id]")).toContainText(secondQuestion);
    const second = await page.locator("[data-spread-id]").getAttribute("data-spread-id");
    expect(second).not.toBe(first);
    await expect(page.locator("[data-card-id]")).toHaveCount(3);
  });

  test("Given a slow tarot service, When the user asks, Then the button shows progress and the form is locked until the reading arrives", async ({
    page,
  }) => {
    await injectFault(TAROT_PROXY, { kind: "delay", delayMs: 1_200 });
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("slow"));

    await page.getByTestId("ask-button").click();

    await expect(page.getByTestId("ask-button")).toHaveText("Drawing…");
    await expect(page.getByTestId("ask-button")).toBeDisabled();
    await expect(page.getByLabel("Your question")).toBeDisabled();
    await expect(page.locator("[data-spread-id]")).toBeVisible();
    await expect(page.getByTestId("ask-button")).toHaveText("Ask");
  });

  test("Given a reading was drawn, When it is shown, Then the prediction keeps its line breaks", async ({
    page,
  }) => {
    await askOnHome(page, uniqueQuestion("line breaks"));

    const prediction = page.locator("[data-spread-id] [data-testid='prediction']");
    await expect(prediction).toBeVisible();
    await expect(prediction).toHaveCSS("white-space", /pre-line|pre-wrap|pre/);
  });
});
