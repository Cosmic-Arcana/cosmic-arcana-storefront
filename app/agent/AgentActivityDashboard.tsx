'use client';

import type {
  AgentActivityEventV1,
  AgentActivityFeedV1,
  AgentSessionV1,
} from '@cosmic-arcana/sdk';
import { useEffect, useMemo, useState } from 'react';

type Connection = 'connecting' | 'live' | 'reconnecting';

const KIND_STYLE: Record<string, string> = {
  'session.opened': 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  'session.closed': 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
  'tool.called': 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  'tool.completed': 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  'tool.failed': 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  'resource.read': 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour12: false, timeStyle: 'medium' });

const applyEvent = (feed: AgentActivityFeedV1, event: AgentActivityEventV1): AgentActivityFeedV1 => {
  const sessions = new Map(feed.sessions.map((session) => [session.sessionId, session]));
  const current: AgentSessionV1 = sessions.get(event.sessionId) ?? {
    sessionId: event.sessionId,
    actor: event.actor,
    startedAt: event.occurredAt,
    lastSeenAt: event.occurredAt,
    open: true,
    toolCalls: 0,
    errors: 0,
  };

  sessions.set(event.sessionId, {
    ...current,
    actor: event.actor,
    lastSeenAt: event.occurredAt,
    open: event.kind === 'session.closed' ? false : current.open,
    toolCalls: current.toolCalls + (event.kind === 'tool.called' ? 1 : 0),
    errors: current.errors + (event.kind === 'tool.failed' ? 1 : 0),
  });

  return {
    sessions: [...sessions.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)),
    events: [...feed.events, event].slice(-200),
  };
};

export function AgentActivityDashboard({ initialFeed }: { initialFeed: AgentActivityFeedV1 }) {
  const [feed, setFeed] = useState(initialFeed);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/agent-activity/stream');

    source.onopen = () => setConnection('live');
    source.onerror = () => setConnection('reconnecting');
    source.onmessage = (message: MessageEvent<string>) => {
      const payload: unknown = JSON.parse(message.data);
      // The stream also carries heartbeats, which exist only to keep proxies from closing it.
      if (payload && typeof payload === 'object' && 'version' in payload) {
        setFeed((current) => applyEvent(current, payload as AgentActivityEventV1));
      }
    };

    return () => source.close();
  }, []);

  const events = useMemo(
    () =>
      [...feed.events]
        .filter((event) => !selectedSession || event.sessionId === selectedSession)
        .reverse(),
    [feed.events, selectedSession],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent activity</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Everything an AI agent does on your behalf through the MCP server: the tools it calls,
            what it asked for and what it got back. The agent acts under a delegated token — it can
            only see what you can see.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-800/60 px-3 py-1 text-xs text-zinc-300 ring-1 ring-zinc-700">
          <span
            className={`size-2 rounded-full ${connection === 'live' ? 'bg-emerald-400' : 'bg-amber-400'}`}
          />
          {connection}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Sessions</h2>
          {feed.sessions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
              No agent has connected on your behalf yet.
            </p>
          ) : (
            feed.sessions.map((session) => {
              const active = selectedSession === session.sessionId;
              return (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => setSelectedSession(active ? null : session.sessionId)}
                  className={`rounded-lg border p-3 text-left transition ${
                    active
                      ? 'border-violet-500/60 bg-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {session.actor.agent ?? 'unknown agent'}
                    </span>
                    <span
                      className={`size-2 shrink-0 rounded-full ${session.open ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                    />
                  </span>
                  <span className="mt-1 block truncate font-mono text-xs text-zinc-500">
                    {session.sessionId}
                  </span>
                  <span className="mt-2 block text-xs text-zinc-400">
                    {session.toolCalls} tool calls
                    {session.errors > 0 ? ` · ${session.errors} failed` : ''} · {time(session.lastSeenAt)}
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {selectedSession ? 'Session activity' : 'All activity'}
          </h2>
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">
              Nothing recorded yet. Point an MCP client at <code>/mcp</code> with your delegated
              token and its calls will appear here as they happen.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {events.map((event) => (
                <li
                  key={event.eventId}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-zinc-500">{time(event.occurredAt)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ring-1 ${KIND_STYLE[event.kind] ?? 'bg-zinc-700/40 text-zinc-300 ring-zinc-600'}`}
                    >
                      {event.kind}
                    </span>
                    {event.target && <span className="font-medium">{event.target}</span>}
                    {event.durationMs !== null && (
                      <span className="text-xs text-zinc-500">{event.durationMs.toFixed(1)} ms</span>
                    )}
                    {event.error && (
                      <span className="text-xs text-rose-300">
                        {event.error.name}: {event.error.message}
                      </span>
                    )}
                  </div>

                  {(event.request !== null || event.response !== null) && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                        request and response
                      </summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <Payload label="request" value={event.request} />
                        <Payload label="response" value={event.response} />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  if (value === null) {
    return null;
  }
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-md bg-black/40 p-2 text-xs text-zinc-300">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
