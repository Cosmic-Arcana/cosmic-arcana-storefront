import type { FullConfig } from "@playwright/test";

import { HISTORY_URL, MCP_URL, TAROT_URL, clearFaults, clearHistory } from "./support/stack";

const requireUp = async (name: string, url: string): Promise<void> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (response.ok) {
      return;
    }
    throw new Error(`answered ${response.status}`);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `${name} is not ready at ${url} (${reason}).\n` +
        "Start the application first, from cosmic-arcana-infrastructure:\n" +
        "  docker compose -f compose/application.yml -f compose/load.yml -f compose/e2e.yml up -d --wait",
    );
  }
};

// The dev server compiles a route on first use; doing that here keeps it out of the first test.
const WARM_UP = ["/", "/readings", "/agent", "/watch", "/privacy", "/terms", "/login"];

export default async function globalSetup(config: FullConfig): Promise<void> {
  await requireUp("tarot-service-api", `${TAROT_URL}/health/ready`);
  await requireUp("history-service-api", `${HISTORY_URL}/health/ready`);
  await requireUp("mcp-service-api", `${MCP_URL}/`);

  await clearFaults();
  await clearHistory();

  const baseURL = config.projects[0]?.use.baseURL;
  if (baseURL) {
    for (const path of WARM_UP) {
      await fetch(`${baseURL}${path}`, { signal: AbortSignal.timeout(120_000) }).catch(() => null);
    }
  }
}
