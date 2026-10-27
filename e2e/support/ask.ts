import { expect, type Page } from "@playwright/test";

/**
 * The page is server-rendered first, so typing before React hydrates would be wiped when it does.
 * The graphics note only exists once the client has taken over, which makes it a reliable signal.
 */
export const openHome = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page.locator("[data-graphics-reason]")).toBeVisible();
};

export const fillQuestion = async (page: Page, question: string, consent = true): Promise<void> => {
  await page.getByLabel("Your question").fill(question);
  if (consent) {
    await page.getByLabel(/I consent to storing/).check();
  }
};

/** Asks through the real UI and returns the id of the reading that came back. */
export const askOnHome = async (page: Page, question: string): Promise<string> => {
  await openHome(page);
  await fillQuestion(page, question);
  await page.getByTestId("ask-button").click();

  const result = page.locator("[data-spread-id]");
  await expect(result).toBeVisible();
  const spreadId = await result.getAttribute("data-spread-id");
  if (!spreadId) {
    throw new Error("the reading carries no spread id");
  }
  return spreadId;
};
