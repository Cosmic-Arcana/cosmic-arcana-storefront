import { askOnHome, openHome } from "./support/ask";
import { uniqueQuestion } from "./support/stack";
import { expect, test } from "./support/test";

const PUBLIC_ROUTES = ["/", "/readings", "/privacy", "/terms", "/login", "/watch", "/agent"];

test.describe("Feature: the app works on a phone", () => {
  test("Given a phone screen, When the home page loads, Then the question box and the Ask button are on the first screen", async ({
    page,
  }) => {
    await openHome(page);

    await expect(page.getByLabel("Your question")).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId("ask-button")).toBeInViewport({ ratio: 1 });
  });

  for (const route of PUBLIC_ROUTES) {
    test(`Given a phone screen, When ${route} loads, Then nothing forces sideways scrolling`, async ({
      page,
    }) => {
      await page.goto(route);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("Given a phone screen, When the user asks, Then the cards and the prediction fit without sideways scrolling", async ({
    page,
  }) => {
    await askOnHome(page, uniqueQuestion("on a phone"));

    await expect(page.locator("[data-card-id]")).toHaveCount(3);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("Given a phone screen, When the user looks at the main controls, Then each is large enough to tap", async ({
    page,
  }) => {
    await openHome(page);

    const ask = await page.getByTestId("ask-button").boundingBox();
    const box = await page.getByLabel("Your question").boundingBox();

    expect(ask?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("Given a phone screen, When the navigation is shown, Then every link is visible", async ({
    page,
  }) => {
    await openHome(page);

    for (const name of ["Reading", "Saved", "Under the hood", "Watch preview", "Agent activity", "Privacy", "Sign in"]) {
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name })).toBeVisible();
    }
  });
});
