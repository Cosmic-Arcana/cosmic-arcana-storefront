import { request, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";

import { E2E_AUTH0_SECRET, uniqueClientIp } from "./stack";

const COOKIE_NAME = "__session";

/**
 * A real Auth0 SDK session, encrypted the way the app decrypts it, so a test can be signed in as
 * any `sub` without a tenant. The token's expiry is far ahead so the SDK never tries to refresh it.
 */
export const mintSession = async (sub: string): Promise<string> =>
  generateSessionCookie(
    {
      user: { sub },
      tokenSet: {
        accessToken: "e2e-access-token",
        expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    },
    { secret: E2E_AUTH0_SECRET },
  );

export const signedInContext = async (
  browser: Browser,
  baseURL: string,
  sub: string,
): Promise<BrowserContext> => {
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
  });
  await context.addCookies([{ name: COOKIE_NAME, value: await mintSession(sub), url: baseURL }]);
  return context;
};

export const signedInRequest = async (baseURL: string, sub: string): Promise<APIRequestContext> =>
  request.newContext({
    baseURL,
    extraHTTPHeaders: {
      "x-forwarded-for": uniqueClientIp(),
      cookie: `${COOKIE_NAME}=${await mintSession(sub)}`,
    },
  });
