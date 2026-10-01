import { randomUUID } from "node:crypto";

import { AGENT_USER, callMcpTool } from "./support/stack";
import { expect, test } from "./support/test";

const agentName = () => `e2e-agent-${randomUUID().slice(0, 8)}`;

test.describe("Feature: the user can watch what an agent does on their behalf", () => {
  test("Given no agent has connected, When the user opens Agent activity, Then the page says so and the live connection is on", async ({
    page,
  }) => {
    await page.goto("/agent");

    await expect(page.getByRole("heading", { name: "Agent activity", level: 1 })).toBeVisible();
    await expect(page.getByText("live", { exact: true })).toBeVisible();
  });

  test("Given an agent called a tool for the user, When the user opens Agent activity, Then the call is listed under that agent with its request and response", async ({
    page,
  }) => {
    const agent = agentName();
    const response = await callMcpTool(agent, "get_previous_readings", { limit: 2 });
    expect(response.status).toBe(200);

    await page.goto("/agent");

    await expect(page.getByRole("button", { name: new RegExp(agent) })).toBeVisible();
    const called = page.locator('[data-event-kind="tool.called"]', { hasText: "get_previous_readings" });
    await expect(called.first()).toBeVisible();
    await expect(
      page.locator('[data-event-kind="tool.completed"]', { hasText: "get_previous_readings" }).first(),
    ).toBeVisible();

    await called.first().getByText("request and response").click();
    await expect(called.first()).toContainText('"limit"');
  });

  test("Given the page is open, When an agent calls a tool, Then the call appears without reloading", async ({
    page,
  }) => {
    const agent = agentName();
    await page.goto("/agent");
    await expect(page.getByText("live", { exact: true })).toBeVisible();

    const response = await callMcpTool(agent, "get_previous_readings", { limit: 1 });
    expect(response.status).toBe(200);

    await expect(page.getByRole("button", { name: new RegExp(agent) })).toBeVisible();
    await expect(
      page.locator('[data-event-kind="tool.called"]', { hasText: "get_previous_readings" }).first(),
    ).toBeVisible();
  });

  test("Given two agents, When the user selects one session, Then only that session's events are listed", async ({
    page,
    request,
  }) => {
    const first = agentName();
    const second = agentName();
    await callMcpTool(first, "get_previous_readings", { limit: 1 });
    await callMcpTool(second, "get_previous_readings", { limit: 3 });
    const feed = await (await request.get("/api/agent-activity")).json();
    const firstSession = feed.sessions.find(
      (session: { actor: { agent: string } }) => session.actor.agent === first,
    );
    const expected = feed.events.filter(
      (event: { sessionId: string }) => event.sessionId === firstSession.sessionId,
    ).length;
    await page.goto("/agent");

    await page.getByRole("button", { name: new RegExp(first) }).click();

    await expect(page.getByRole("heading", { name: "Session activity" })).toBeVisible();
    await expect(page.locator("[data-agent-event]")).toHaveCount(expected);
    await page.getByRole("button", { name: new RegExp(first) }).click();
    await expect(page.getByRole("heading", { name: "All activity" })).toBeVisible();
  });

  test("Given a call the server rejects, When the user looks at the feed, Then it is listed as failed with the reason, not silently dropped", async ({
    page,
  }) => {
    const agent = agentName();
    const response = await callMcpTool(agent, "get_previous_readings", { limit: 999 });
    expect(response.status).toBe(200);

    await page.goto("/agent");

    await expect(page.getByRole("button", { name: new RegExp(agent) })).toBeVisible();
    const failed = page.locator('[data-event-kind="tool.failed"]', {
      hasText: "get_previous_readings",
    });
    await expect(failed.first()).toBeVisible();
    await expect(failed.first()).toContainText(/limit/i);
  });

  test("Given the dashboard, When it loads, Then it only shows the signed-in viewer's own agent and never takes a user from the browser", async ({
    page,
    request,
  }) => {
    const response = await request.get(`/api/agent-activity?userId=someone-else&x-user-id=someone-else`);
    expect(response.ok()).toBe(true);
    const feed = await response.json();
    for (const session of feed.sessions) {
      expect(session.actor.userId).toBe(AGENT_USER);
    }

    await page.goto("/agent");
    await expect(page.getByRole("heading", { name: "Agent activity", level: 1 })).toBeVisible();
  });
});
