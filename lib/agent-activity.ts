import type { AgentActivityFeedV1 } from '@cosmic-arcana/sdk';

import { auth0 } from './auth0';

const MCP_SERVICE_URL = process.env.MCP_SERVICE_URL ?? 'http://127.0.0.1:3003';

/**
 * The dashboard only ever shows the signed-in user their own agent's activity, so the user id is
 * resolved here from the session and never accepted from the browser.
 *
 * DEV_USER exists so the dashboard can be opened without an Auth0 tenant; it is ignored in
 * production.
 */
export const resolveViewer = async (): Promise<string | null> => {
  const session = await auth0.getSession();
  if (session?.user?.sub) {
    return session.user.sub;
  }
  if (process.env.NODE_ENV !== 'production' && process.env.AGENT_DASHBOARD_DEV_USER) {
    return process.env.AGENT_DASHBOARD_DEV_USER;
  }
  return null;
};

export const agentActivityUrl = (path: string): string => `${MCP_SERVICE_URL}/agent-activity${path}`;

export const fetchFeed = async (userId: string): Promise<AgentActivityFeedV1> => {
  const response = await fetch(agentActivityUrl(''), {
    headers: { 'x-user-id': userId },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`mcp-service-api answered ${response.status}`);
  }
  return (await response.json()) as AgentActivityFeedV1;
};
