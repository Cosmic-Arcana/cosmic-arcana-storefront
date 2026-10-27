import { fetchFeed, resolveViewer } from '../../../lib/agent-activity';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const userId = await resolveViewer();
  if (!userId) {
    return Response.json({ error: 'not signed in' }, { status: 401 });
  }

  try {
    return Response.json(await fetchFeed(userId));
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
