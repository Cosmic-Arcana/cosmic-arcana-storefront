import { test as base } from "@playwright/test";

import { clearFaults, uniqueClientIp } from "./stack";

export { expect } from "@playwright/test";

// The callback is called `provide`, not `use`, so React's hooks lint rule does not mistake it for a hook.
export const test = base.extend<{ faultReset: void }>({
  // Each test is its own client, because the BFF rate limits by the forwarded address.
  context: async ({ context }, provide) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueClientIp() });
    await provide(context);
  },

  request: async ({ playwright, baseURL }, provide) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    await provide(request);
    await request.dispose();
  },

  // A failed test must never leave a dependency broken for the next one.
  faultReset: [
    // Playwright requires the first argument of a fixture to be a destructuring pattern.
    async ({}, provide) => {
      await provide();
      await clearFaults();
    },
    { auto: true },
  ],
});
