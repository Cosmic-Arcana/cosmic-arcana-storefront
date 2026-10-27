import { request as newRequest, type Page } from "@playwright/test";

import { fillQuestion, openHome } from "./support/ask";
import { signedInContext, signedInRequest } from "./support/session";
import {
  AGENT_USER,
  DEMO_USER_ID,
  HISTORY_PROXY,
  TAROT_PROXY,
  callMcpTool,
  clearHistory,
  createReading,
  forwardedCount,
  uniqueQuestion,
  waitForHistory,
} from "./support/stack";
import { expect, test } from "./support/test";

// These run against `next build` + `next start`, where the development conveniences are gone:
// there is no demo user, no dev shortcut for the agent dashboard, and no React eval.
const SIGN_IN_SENTENCE = /sign in/i;
const A_SUB = "auth0|e2e-user-a";
const B_SUB = "auth0|e2e-user-b";

const PUBLIC_PAGES = ["/", "/watch", "/privacy", "/terms", "/login", "/readings", "/agent"];

const collectProblems = (page: Page): { console: string[]; csp: () => Promise<string[]> } => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      messages.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => messages.push(`exception: ${error.message}`));
  void page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  return {
    console: messages,
    csp: () => page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []),
  };
};

test.describe("Feature: a visitor who is not signed in, on the production build", () => {
  test("Given no session, When a question is posted, Then it is refused with 401 and tarot is never asked", async ({
    request,
  }) => {
    const before = await forwardedCount(TAROT_PROXY);

    const response = await request.post("/api/spreads", {
      data: { question: uniqueQuestion("anonymous"), consent: true },
    });

    expect(response.status()).toBe(401);
    expect((await response.json()).error).toMatch(SIGN_IN_SENTENCE);
    expect(await forwardedCount(TAROT_PROXY)).toBe(before);
  });

  test("Given no session, When the visitor asks in the page, Then they are told to sign in in words and can keep typing", async ({
    page,
  }) => {
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("not signed in"));

    await page.getByTestId("ask-button").click();

    await expect(page.getByTestId("ask-error")).toContainText(SIGN_IN_SENTENCE);
    await expect(page.getByTestId("ask-error")).not.toContainText(/401|unauthori[sz]ed/i);
    await expect(page.locator("[data-spread-id]")).toHaveCount(0);
    await expect(page.getByTestId("ask-button")).toBeEnabled();
  });

  test("Given someone else's readings exist, When a signed-out visitor opens Saved, Then they are asked to sign in and see none of them", async ({
    page,
  }) => {
    const secret = uniqueQuestion("a reading that belongs to the demo user");
    await createReading(secret, DEMO_USER_ID);
    const before = await forwardedCount(HISTORY_PROXY);

    await page.goto("/readings");

    await expect(page.getByText("Sign in to see readings")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).last()).toHaveAttribute("href", "/login");
    expect(await page.content()).not.toContain(secret);
    expect(await forwardedCount(HISTORY_PROXY)).toBe(before);
  });

  test("Given a reading exists, When a signed-out visitor opens its address, Then they are asked to sign in and history is not asked", async ({
    page,
  }) => {
    const reading = await createReading(uniqueQuestion("private"), DEMO_USER_ID);
    await waitForHistory([reading.spreadId]);
    const before = await forwardedCount(HISTORY_PROXY);

    await page.goto(`/readings/${reading.spreadId}`);

    await expect(page.getByText("Sign in to open a saved reading")).toBeVisible();
    expect(await page.content()).not.toContain(reading.question);
    expect(await forwardedCount(HISTORY_PROXY)).toBe(before);
  });

  test("Given no session, When the readings api is called, Then listing and removing are refused and history is not asked", async ({
    request,
  }) => {
    const before = await forwardedCount(HISTORY_PROXY);

    const list = await request.get("/api/readings");
    const remove = await request.delete(`/api/readings/${DEMO_USER_ID.replace(/0$/, "9")}`);

    expect(list.status()).toBe(401);
    expect(remove.status()).toBe(401);
    expect(await forwardedCount(HISTORY_PROXY)).toBe(before);
  });

  test("Given the dev shortcut for the agent dashboard is configured on the server, When nobody is signed in, Then it is still refused", async ({
    page,
    request,
  }) => {
    expect((await request.get("/api/agent-activity")).status()).toBe(401);
    expect((await request.get("/api/agent-activity/stream")).status()).toBe(401);

    await page.goto("/agent");

    await expect(page.getByText("Sign in to watch what an agent does")).toBeVisible();
  });

  test("Given an agent has acted for a user, When a signed-out visitor loads the under-the-hood data, Then none of it is included", async ({
    request,
  }) => {
    await callMcpTool("agent-for-someone", "get_previous_readings", { limit: 1 });

    const hood = await (await request.get("/api/under-the-hood")).json();

    expect(hood.viewer).toBeNull();
    expect(hood.agent).toEqual({ sessions: [], events: [] });
  });
});

test.describe("Feature: a signed-in visitor sees and changes only their own readings", () => {
  test("Given a signed-in visitor, When they ask, Then the reading is saved for the user derived from their account, never the demo user", async ({
    baseURL,
  }) => {
    const api = await signedInRequest(baseURL!, A_SUB);

    const response = await api.post("/api/spreads", {
      data: { question: uniqueQuestion("signed in"), consent: true },
    });

    expect(response.status()).toBe(200);
    const reading = await response.json();
    expect(reading.userId).not.toBe(DEMO_USER_ID);
    expect(reading.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const again = await signedInRequest(baseURL!, A_SUB);
    const second = await (
      await again.post("/api/spreads", { data: { question: uniqueQuestion("same account"), consent: true } })
    ).json();
    expect(second.userId).toBe(reading.userId);
    await api.dispose();
    await again.dispose();
  });

  test("Given two signed-in visitors, When each lists their readings, Then neither sees the other's", async ({
    baseURL,
  }) => {
    const alice = await signedInRequest(baseURL!, A_SUB);
    const bob = await signedInRequest(baseURL!, B_SUB);
    const aliceQuestion = uniqueQuestion("alice's private question");
    const bobQuestion = uniqueQuestion("bob's private question");
    const made = [
      await (await alice.post("/api/spreads", { data: { question: aliceQuestion, consent: true } })).json(),
      await (await bob.post("/api/spreads", { data: { question: bobQuestion, consent: true } })).json(),
    ];
    await Promise.all(made.map((reading) => waitForHistory([reading.spreadId], reading.userId)));

    const aliceList = JSON.stringify(await (await alice.get("/api/readings")).json());
    const bobList = JSON.stringify(await (await bob.get("/api/readings")).json());

    expect(aliceList).toContain(aliceQuestion);
    expect(aliceList).not.toContain(bobQuestion);
    expect(bobList).toContain(bobQuestion);
    expect(bobList).not.toContain(aliceQuestion);
    await alice.dispose();
    await bob.dispose();
  });

  test("Given another user's reading address, When a signed-in visitor opens it, Then it is reported as not in their history and nothing of it is shown", async ({
    browser,
    baseURL,
  }) => {
    const alice = await signedInRequest(baseURL!, A_SUB);
    const secret = uniqueQuestion("alice only");
    const reading = await (await alice.post("/api/spreads", { data: { question: secret, consent: true } })).json();
    await waitForHistory([reading.spreadId], reading.userId);
    const context = await signedInContext(browser, baseURL!, B_SUB);
    const page = await context.newPage();

    await page.goto(`/readings/${reading.spreadId}`);

    await expect(page.getByTestId("reading-missing")).toBeVisible();
    expect(await page.content()).not.toContain(secret);
    await context.close();
    await alice.dispose();
  });

  test("Given another user's reading, When a signed-in visitor tries to remove it, Then it is refused and the reading is still there", async ({
    baseURL,
  }) => {
    const alice = await signedInRequest(baseURL!, A_SUB);
    const bob = await signedInRequest(baseURL!, B_SUB);
    const reading = await (
      await alice.post("/api/spreads", { data: { question: uniqueQuestion("not bob's"), consent: true } })
    ).json();
    await waitForHistory([reading.spreadId], reading.userId);

    const attempt = await bob.delete(`/api/readings/${reading.spreadId}`);

    expect(attempt.status()).toBe(404);
    const stillThere = await (await alice.get("/api/readings")).json();
    expect(stillThere.items.map((item: { spreadId: string }) => item.spreadId)).toContain(reading.spreadId);
    await alice.dispose();
    await bob.dispose();
  });

  test("Given the demo user has readings, When a signed-in visitor lists theirs, Then the demo user's are not among them", async ({
    baseURL,
  }) => {
    await clearHistory();
    const demoQuestion = uniqueQuestion("belongs to the demo user");
    const demo = await createReading(demoQuestion, DEMO_USER_ID);
    await waitForHistory([demo.spreadId]);
    const alice = await signedInRequest(baseURL!, A_SUB);

    const list = JSON.stringify(await (await alice.get("/api/readings")).json());

    expect(list).not.toContain(demoQuestion);
    await alice.dispose();
  });

  test("Given a signed-in visitor, When they open Saved in the browser, Then their own reading is listed and opens", async ({
    browser,
    baseURL,
  }) => {
    const alice = await signedInRequest(baseURL!, A_SUB);
    const question = uniqueQuestion("listed in the page");
    const reading = await (await alice.post("/api/spreads", { data: { question, consent: true } })).json();
    await waitForHistory([reading.spreadId], reading.userId);
    const context = await signedInContext(browser, baseURL!, A_SUB);
    const page = await context.newPage();

    await page.goto("/readings");
    await page.getByRole("link", { name: new RegExp(question) }).click();

    await expect(page.getByTestId("reading-question")).toHaveText(question);
    await context.close();
    await alice.dispose();
  });

  test("Given a tampered session cookie, When the visitor asks, Then they are treated as signed out", async ({
    baseURL,
  }) => {
    const forged = await newRequest.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: "__session=not-a-session-this-app-issued", "x-forwarded-for": "10.99.1.1" },
    });

    const response = await forged.post("/api/spreads", {
      data: { question: uniqueQuestion("forged"), consent: true },
    });

    expect(response.status()).toBe(401);
    await forged.dispose();
  });
});

test.describe("Feature: signing out only happens when the visitor chooses to", () => {
  test("Given a signed-in visitor, When pages load and links come into view, Then nothing requests the sign-out address by itself and they stay signed in", async ({
    browser,
    baseURL,
  }) => {
    const context = await signedInContext(browser, baseURL!, A_SUB);
    const page = await context.newPage();
    const signOutRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/auth/logout") {
        signOutRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    for (const route of ["/", "/readings", "/privacy"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      // Next prefetches links that scroll into view; give it the chance to do so.
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(600);
    }

    expect(signOutRequests, signOutRequests.join("\n")).toEqual([]);
    await expect(page.getByRole("link", { name: "Sign out" })).toBeVisible();
    await context.close();
  });
});

test.describe("Feature: an agent's activity is private to the user it acted for", () => {
  test("Given an agent acted for one user, When another signed-in user opens Agent activity, Then they see none of it", async ({
    browser,
    baseURL,
  }) => {
    const agent = `private-agent-${Date.now().toString(36)}`;
    await callMcpTool(agent, "get_previous_readings", { limit: 1 }, A_SUB);
    const owner = await signedInContext(browser, baseURL!, A_SUB);
    const stranger = await signedInContext(browser, baseURL!, B_SUB);
    const ownerPage = await owner.newPage();
    const strangerPage = await stranger.newPage();

    await ownerPage.goto("/agent");
    await strangerPage.goto("/agent");

    await expect(ownerPage.getByRole("button", { name: new RegExp(agent) })).toBeVisible();
    await expect(strangerPage.getByRole("heading", { name: "Agent activity", level: 1 })).toBeVisible();
    expect(await strangerPage.content()).not.toContain(agent);
    await owner.close();
    await stranger.close();
  });

  test("Given the dev shortcut user has agent activity, When a signed-in user opens the dashboard, Then the shortcut user's activity is not shown", async ({
    browser,
    baseURL,
  }) => {
    const agent = `shortcut-agent-${Date.now().toString(36)}`;
    await callMcpTool(agent, "get_previous_readings", { limit: 1 }, AGENT_USER);
    const context = await signedInContext(browser, baseURL!, B_SUB);
    const page = await context.newPage();

    await page.goto("/agent");

    expect(await page.content()).not.toContain(agent);
    await context.close();
  });
});

test.describe("Feature: the production build is served strictly", () => {
  test("Given any page, When it is served, Then the policy forbids eval and framing by others and the framework is not advertised", async ({
    request,
  }) => {
    const headers = (await request.get("/")).headers();
    const policy = headers["content-security-policy"] ?? "";

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*\*/);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  for (const route of PUBLIC_PAGES) {
    test(`Given ${route}, When it loads under the policy, Then nothing is blocked and the console stays clean`, async ({
      page,
    }) => {
      const problems = collectProblems(page);

      const response = await page.goto(route);
      await page.waitForLoadState("load");
      await page.waitForTimeout(800);

      expect(response?.status()).toBe(200);
      expect(await problems.csp(), "policy violations").toEqual([]);
      expect(problems.console, problems.console.join("\n")).toEqual([]);
    });
  }

  test("Given the home page under the policy, When it loads, Then it hydrates, so the form works", async ({
    page,
  }) => {
    await openHome(page);
    await fillQuestion(page, uniqueQuestion("hydrated"));

    await expect(page.getByTestId("ask-button")).toBeEnabled();
  });

  test("Given a signed-in visitor, When they ask and open the live feed, Then neither the reading nor the websocket is blocked by the policy", async ({
    browser,
    baseURL,
  }) => {
    const context = await signedInContext(browser, baseURL!, A_SUB);
    const page = await context.newPage();
    const problems = collectProblems(page);

    await openHome(page);
    await page.getByTestId("join-live").click();
    await expect(page.locator("[data-live]")).toHaveAttribute("data-live", "on");
    await fillQuestion(page, uniqueQuestion("under the policy"));
    await page.getByTestId("ask-button").click();
    await expect(page.locator("[data-spread-id]")).toBeVisible();

    expect(await problems.csp(), "policy violations").toEqual([]);
    expect(problems.console, problems.console.join("\n")).toEqual([]);
    await context.close();
  });

  test("Given an address that does not exist, When it is opened, Then the page leaks no stack, path or framework detail", async ({
    page,
  }) => {
    const response = await page.goto("/this-does-not-exist");
    const html = await page.content();

    expect(response?.status()).toBe(404);
    // A bundler's name in an asset file name is not a leak; a stack frame or a disk path is.
    expect(html).not.toMatch(/at \S+ \(|node_modules|\/Users\/|\/home\//);
  });
});
