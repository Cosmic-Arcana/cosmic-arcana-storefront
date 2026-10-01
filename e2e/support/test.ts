import { test as base } from "@playwright/test";

import { clearFaults, uniqueClientIp } from "./stack";

export { expect } from "@playwright/test";

export const test = base.extend<{ faultReset: void }>({
  // Each test is its own client, because the BFF rate limits by the forwarded address.
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueClientIp() });
    await use(context);
  },

  request: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    await use(request);
    await request.dispose();
  },

  // A failed test must never leave a dependency broken for the next one.
  faultReset: [
    // Playwright requires the first argument of a fixture to be a destructuring pattern.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use();
      await clearFaults();
    },
    { auto: true },
  ],
});
