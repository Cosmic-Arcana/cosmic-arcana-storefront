import type { AgentActivityFeedV1 } from '@cosmic-arcana/sdk';

import { fetchFeed, resolveViewer } from '../../lib/agent-activity';
import { AgentActivityDashboard } from './AgentActivityDashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Agent activity · Cosmic Arcana',
  description: 'What the AI agent does on your behalf through MCP.',
};

export default async function AgentActivityPage() {
  const userId = await resolveViewer();

  if (!userId) {
    return (
      <main className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Agent activity</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Sign in to watch what an agent does on your behalf.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Sign in
        </a>
      </main>
    );
  }

  let feed: AgentActivityFeedV1 = { sessions: [], events: [] };
  let unreachable: string | null = null;
  try {
    feed = await fetchFeed(userId);
  } catch (error) {
    // The dashboard is a view of another service; it degrades instead of failing the page.
    unreachable = (error as Error).message;
  }

  return (
    <main>
      {unreachable && (
        <p className="mx-auto max-w-6xl px-6 pt-6 text-sm text-amber-300">
          mcp-service-api is not reachable ({unreachable}). The feed will fill in once it answers.
        </p>
      )}
      <AgentActivityDashboard initialFeed={feed} />
    </main>
  );
}
