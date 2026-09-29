import { agentActivityUrl, resolveViewer } from '../../../../lib/agent-activity';

export const dynamic = 'force-dynamic';

/** Passes the service's server-sent events straight through, with the viewer resolved here. */
export async function GET(request: Request): Promise<Response> {
  const userId = await resolveViewer();
  if (!userId) {
    return Response.json({ error: 'not signed in' }, { status: 401 });
  }

  const upstream = await fetch(agentActivityUrl('/stream'), {
    headers: { 'x-user-id': userId, accept: 'text/event-stream' },
    signal: request.signal,
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: `mcp-service-api answered ${upstream.status}` }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
