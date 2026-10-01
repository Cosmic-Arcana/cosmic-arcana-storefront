import { askOnHome, openHome } from "./support/ask";
import { uniqueClientIp, uniqueQuestion } from "./support/stack";
import { expect, test } from "./support/test";

test.describe("Feature: the live feed of other people's draws", () => {
  test("Given the live feed is not joined, When the page loads, Then it stays closed and says why", async ({
    page,
  }) => {
    await openHome(page);

    await expect(page.locator("[data-live]")).toHaveAttribute("data-live", "off");
    await expect(page.getByTestId("join-live")).toBeEnabled();
  });

  test("Given a visitor joined the live feed, When someone else draws, Then their cards appear and their question never does", async ({
    page,
    browser,
  }) => {
    await openHome(page);
    await page.getByTestId("join-live").click();
    await expect(page.locator("[data-live]")).toHaveAttribute("data-live", "on");

    const stranger = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    const strangerPage = await stranger.newPage();
    const secret = uniqueQuestion("a private worry nobody should see");
    await askOnHome(strangerPage, secret);
    const drawn = await strangerPage.locator("[data-card-id]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-card-id")),
    );

    for (const cardId of drawn) {
      await expect(page.locator(`[data-live-card="${cardId}"]`).first()).toBeVisible();
    }
    await expect(page.getByText(secret)).toHaveCount(0);
    expect(await page.content()).not.toContain(secret);
    await stranger.close();
  });

  test("Given a visitor joined the live feed, When they draw themselves, Then the live chips are marked apart from their own cards", async ({
    page,
  }) => {
    await openHome(page);
    await page.getByTestId("join-live").click();
    await expect(page.locator("[data-live]")).toHaveAttribute("data-live", "on");

    await page.getByLabel("Your question").fill(uniqueQuestion("mine"));
    await page.getByLabel(/I consent to storing/).check();
    await page.getByTestId("ask-button").click();

    await expect(page.locator("[data-card-id]")).toHaveCount(3);
    await expect(page.locator("[data-live-card]").first()).toContainText("live ·");
  });
});
