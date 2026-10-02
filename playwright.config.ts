import { defineConfig, devices } from "@playwright/test";

import { AGENT_USER, E2E_AUTH0_SECRET, HISTORY_PROXY, TAROT_PROXY } from "./e2e/support/stack";

const port = Number(process.env.E2E_PORT ?? 3100);
// localhost, not 127.0.0.1: the Next dev server refuses its own /_next chunks to any other host,
// and without them the page never hydrates.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
// Locally, E2E_BROWSER_CHANNEL=chrome reuses the installed Chrome instead of downloading Chromium.
const channel = process.env.E2E_BROWSER_CHANNEL || undefined;
const externalServer = Boolean(process.env.E2E_BASE_URL);

const proxyPort = (url: string) => new URL(url).port;

// `E2E_PRODUCTION=1` runs only the production-build project, against `next build` + `next start`.
// The development project and the production project are separate runs because each starts its
// own server, and a production build is slow enough that it should not be paid for on every run.
const production = process.env.E2E_PRODUCTION === "1";
const prodPort = Number(process.env.E2E_PROD_PORT ?? 3101);
const prodBaseURL = `http://localhost:${prodPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  // Every test shares one demo user, so tests run one at a time and each owns its own data.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: production
    ? [
        {
          name: "production",
          testMatch: /production\.spec\.ts/,
          use: { ...devices["Desktop Chrome"], channel, baseURL: prodBaseURL },
        },
      ]
    : [
        {
          name: "desktop",
          testIgnore: /(mobile|production)\.spec\.ts/,
          use: { ...devices["Desktop Chrome"], channel },
        },
        {
          name: "mobile",
          testMatch: /mobile\.spec\.ts/,
          use: { ...devices["Pixel 7"], channel },
        },
      ],
  webServer: externalServer
    ? undefined
    : [
        {
          command: `node e2e/support/fault-proxy.mjs --listen=${proxyPort(TAROT_PROXY)} --target=3004`,
          url: `${TAROT_PROXY}/__fault`,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `node e2e/support/fault-proxy.mjs --listen=${proxyPort(HISTORY_PROXY)} --target=3005`,
          url: `${HISTORY_PROXY}/__fault`,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: production
            ? `npm run build && npm run start -- --port ${prodPort}`
            : `npm run dev -- --port ${port}`,
          url: production ? prodBaseURL : baseURL,
          reuseExistingServer: !process.env.CI,
          // A production build comes before the server can answer.
          timeout: production ? 420_000 : 180_000,
          env: {
            NEXT_TELEMETRY_DISABLED: "1",
            APP_BASE_URL: production ? prodBaseURL : baseURL,
            TAROT_BASE_URL: TAROT_PROXY,
            HISTORY_BASE_URL: HISTORY_PROXY,
            MCP_SERVICE_URL: process.env.E2E_MCP_URL ?? "http://127.0.0.1:3003",
            // Read at build time, so it must be set for `next build` as well.
            NEXT_PUBLIC_TAROT_WS_URL: "ws://127.0.0.1:3004/live",
            // Set on the production server on purpose: the tests prove it is ignored there.
            AGENT_DASHBOARD_DEV_USER: AGENT_USER,
            // Short on purpose: the hanging-dependency tests wait for exactly this long.
            TAROT_TIMEOUT_MS: "1500",
            HISTORY_TIMEOUT_MS: "1500",
            // Dummy values replace whatever .env.local holds, so a test never reaches a real tenant.
            AUTH0_DOMAIN: "e2e.invalid",
            AUTH0_CLIENT_ID: "e2e-client",
            AUTH0_CLIENT_SECRET: "e2e-secret",
            AUTH0_SECRET: E2E_AUTH0_SECRET,
          },
        },
      ],
});
