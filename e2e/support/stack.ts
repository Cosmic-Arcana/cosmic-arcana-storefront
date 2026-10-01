import { randomUUID } from "node:crypto";

export const TAROT_URL = process.env.E2E_TAROT_URL ?? "http://127.0.0.1:3004";
export const HISTORY_URL = process.env.E2E_HISTORY_URL ?? "http://127.0.0.1:3005";
export const MCP_URL = process.env.E2E_MCP_URL ?? "http://127.0.0.1:3003";

// The storefront under test talks to tarot and history through these proxies, so a test can make
// either dependency fail without touching the real services.
export const TAROT_PROXY = "http://127.0.0.1:4004";
export const HISTORY_PROXY = "http://127.0.0.1:4005";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const AGENT_USER = "e2e-agent-user";

export type Fault =
  | { kind: "pass" }
  | { kind: "down" }
  | { kind: "hang" }
  | { kind: "garbage" }
  | { kind: "status"; status: number }
  | { kind: "delay"; delayMs: number };

export type HistoryItem = {
  spreadId: string;
  question: string;
  cards: { cardId: string; reversed: boolean; positionKey: string }[];
  prediction: string;
  createdAt: string;
};

export const injectFault = async (proxy: string, fault: Fault): Promise<void> => {
  const response = await fetch(`${proxy}/__fault`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fault),
  });
  if (!response.ok) {
    throw new Error(`fault proxy ${proxy} answered ${response.status}`);
  }
};

export type ForwardedRequest = { method: string; url: string; headers: Record<string, string> };

/** The last request the app sent to a dependency through its proxy. */
export const lastForwarded = async (proxy: string): Promise<ForwardedRequest> => {
  const response = await fetch(`${proxy}/__last`);
  return (await response.json()) as ForwardedRequest;
};

export const clearFaults = async (): Promise<void> => {
  await Promise.all([
    injectFault(TAROT_PROXY, { kind: "pass" }),
    injectFault(HISTORY_PROXY, { kind: "pass" }),
  ]);
};

/** A question no other test can have asked, so assertions never match another test's reading. */
export const uniqueQuestion = (label: string): string => `${label} ${randomUUID().slice(0, 8)}`;

/** A client address no other test shares, so the BFF rate limiter never couples tests together. */
export const uniqueClientIp = (): string => {
  const byte = () => 1 + Math.floor(Math.random() * 253);
  return `10.${byte()}.${byte()}.${byte()}`;
};

/** Creates a reading straight in tarot-service-api, bypassing the storefront. */
export const createReading = async (question: string): Promise<HistoryItem> => {
  const response = await fetch(`${TAROT_URL}/spreads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `e2e-${randomUUID().replace(/-/g, "")}`,
    },
    body: JSON.stringify({ userId: DEMO_USER_ID, question }),
  });
  if (response.status !== 201) {
    throw new Error(`tarot answered ${response.status} while seeding a reading`);
  }
  return (await response.json()) as HistoryItem;
};

export const listHistory = async (): Promise<HistoryItem[]> => {
  const items: HistoryItem[] = [];
  let cursor: string | null = null;
  do {
    const query: string = `limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const response = await fetch(`${HISTORY_URL}/users/${DEMO_USER_ID}/spread-history?${query}`);
    if (!response.ok) {
      throw new Error(`history answered ${response.status}`);
    }
    const page = (await response.json()) as { items: HistoryItem[]; nextCursor: string | null };
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
};

/** The history read model is eventually consistent; wait until it has caught up with tarot. */
export const waitForHistory = async (spreadIds: string[], timeoutMs = 20_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const known = new Set((await listHistory()).map((item) => item.spreadId));
    if (spreadIds.every((id) => known.has(id))) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error("history did not project every seeded reading in time");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
};

export const clearHistory = async (): Promise<void> => {
  for (const item of await listHistory()) {
    await fetch(`${HISTORY_URL}/users/${DEMO_USER_ID}/spread-history/${item.spreadId}`, {
      method: "DELETE",
    });
  }
};

const unsignedToken = (claims: Record<string, unknown>): string => {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.`;
};

/** Calls the MCP tool the way an agent does: a bearer token whose `sub` is the user, `act` the agent. */
export const callMcpTool = async (
  agent: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Response> =>
  fetch(`${MCP_URL}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${unsignedToken({ sub: AGENT_USER, act: { sub: agent }, scope: "readings:read" })}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
