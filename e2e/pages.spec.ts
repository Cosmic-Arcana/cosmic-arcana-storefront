import AxeBuilder from "@axe-core/playwright";

import { openHome } from "./support/ask";
import { expect, test } from "./support/test";

const PAGES: { route: string; title: RegExp }[] = [
  { route: "/", title: /Cosmic Arcana/ },
  { route: "/readings", title: /Saved readings/ },
  { route: "/agent", title: /Agent activity/ },
  { route: "/watch", title: /Watch preview/ },
  { route: "/privacy", title: /Privacy/ },
  { route: "/terms", title: /Terms/ },
  { route: "/login", title: /Sign in/ },
];

test.describe("Feature: every page loads cleanly", () => {
  for (const { route } of PAGES) {
    test(`Given ${route}, When it loads, Then it answers 200 with a single h1 and no browser errors`, async ({
      page,
    }) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          problems.push(`console: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => problems.push(`exception: ${error.message}`));

      const response = await page.goto(route);
      await page.waitForLoadState("load");
      // Hydration errors surface a moment after load.
      await page.waitForTimeout(800);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});

test.describe("Feature: every page says what it is", () => {
  for (const { route, title } of PAGES) {
    test(`Given ${route}, When it loads, Then the tab title names the page`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveTitle(title);
    });
  }

  test("Given the privacy and terms pages, When they load, Then their titles differ from each other and from the home page", async ({
    page,
  }) => {
    const titles: string[] = [];
    for (const route of ["/", "/privacy", "/terms"]) {
      await page.goto(route);
      titles.push(await page.title());
    }

    expect(new Set(titles).size).toBe(3);
  });
});

test.describe("Feature: orchestrators can ask whether the storefront is alive", () => {
  for (const route of ["/health/live", "/health/ready"]) {
    test(`Given ${route}, When it is asked, Then it answers 200 with a tiny body that reveals nothing and is never cached`, async ({
      request,
    }) => {
      const response = await request.get(route);

      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
      expect(response.headers()["cache-control"]).toMatch(/no-store/);
    });
  }
});

test.describe("Feature: pages that do not exist", () => {
  test("Given an unknown address, When it is opened, Then the answer is 404 and the navigation is still there", async ({
    page,
  }) => {
    const response = await page.goto("/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
    const header = page.getByTestId("site-header");
    await expect(header.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Reading", exact: true })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

test.describe("Feature: keyboard and crawlers", () => {
  test("Given the home page, When the user presses Tab once, Then the skip link is focused, visible, and jumps to the content", async ({
    page,
  }) => {
    await openHome(page);

    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: "Skip to reading" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("Given only a keyboard, When the user types a question and tabs on, Then consent and Ask follow in order and Enter asks", async ({
    page,
  }) => {
    await openHome(page);
    await page.getByLabel("Your question").focus();
    await page.keyboard.type("Can I do this without a mouse?");

    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/I consent to storing/)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByLabel(/I consent to storing/)).toBeChecked();

    await page.keyboard.press("Tab");
    await expect(page.getByTestId("ask-button")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator("[data-spread-id]")).toBeVisible();
  });

  test("Given the site, When a crawler asks, Then robots.txt keeps private areas out and points at the sitemap", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();

    expect(robots).toMatch(/Disallow: \/readings/);
    expect(robots).toMatch(/Disallow: \/agent/);
    expect(robots).toMatch(/Disallow: \/api\//);
    expect(robots).toMatch(/Sitemap: .+\/sitemap\.xml/);
  });

  test("Given the site, When a crawler reads the sitemap, Then it lists public pages and none of the private ones", async ({
    request,
  }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();

    expect(sitemap).toContain("/privacy");
    expect(sitemap).toContain("/terms");
    expect(sitemap).not.toContain("/readings");
    expect(sitemap).not.toContain("/agent");
  });

  test("Given private pages, When they load, Then they tell search engines not to index them", async ({
    page,
  }) => {
    await page.goto("/readings");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("Feature: the browser is told how to treat the site", () => {
  test("Given any page, When it is served, Then it carries the security headers", async ({
    request,
  }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
  });
});

test.describe("Feature: pages are usable with assistive technology", () => {
  for (const { route } of PAGES) {
    test(`Given ${route}, When it is scanned, Then it has no serious or critical accessibility violations`, async ({
      page,
    }) => {
      if (route === "/") {
        await openHome(page);
      } else {
        await page.goto(route);
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("nextjs-portal")
        .analyze();

      const serious = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}, ${violation.nodes.length} nodes): ${violation.help}\n` +
            violation.nodes
              .slice(0, 3)
              .map((node) => `    ${node.target.join(" ")}`)
              .join("\n"),
        );
      expect(serious, serious.join("\n")).toEqual([]);
    });
  }

  test("Given a reading was drawn, When it appears, Then it is announced to screen readers", async ({
    page,
  }) => {
    await openHome(page);
    await page.getByLabel("Your question").fill("Will this be announced?");
    await page.getByLabel(/I consent to storing/).check();
    await page.getByTestId("ask-button").click();
    await expect(page.locator("[data-spread-id]")).toBeVisible();

    const live = page.locator("[data-spread-id]").locator("xpath=ancestor-or-self::*[@aria-live or @role='status']");
    await expect(live.first()).toBeAttached();
  });
});

test.describe("Feature: graphics can be turned down", () => {
  test("Given the home page, When the user picks light graphics, Then the scene switches to light mode", async ({
    page,
  }) => {
    await openHome(page);

    await page.getByRole("radio", { name: "light" }).check();

    await expect(page.locator("[data-graphics-mode]")).toHaveAttribute("data-graphics-mode", "light");
  });
});
