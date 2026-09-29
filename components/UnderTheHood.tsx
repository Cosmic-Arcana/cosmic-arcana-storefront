"use client";

import { useEffect, useState } from "react";

type HoodPayload = {
  viewer: string | null;
  stars: Record<string, unknown>;
  tarot: Record<string, unknown>;
  agent: { sessions: unknown[]; events: unknown[] };
  agentError?: string;
};

export function UnderTheHood({ spreadJson }: { spreadJson: unknown }) {
  const [hood, setHood] = useState<HoodPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/under-the-hood")
      .then(async (response) => {
        const body = (await response.json()) as HoodPayload;
        if (!cancelled) {
          setHood(body);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHood(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const events = hood?.agent.events ?? [];

  return (
    <section
      id="under-the-hood"
      data-testid="under-the-hood"
      aria-labelledby="hood-heading"
      className="border-t border-violet-500/20 bg-[#0b0714] px-6 py-10"
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <h2 id="hood-heading" className="text-xl font-semibold text-[#f5f3ff]">
          Under the hood
        </h2>
        <p className="text-sm leading-6 text-[#e4e4e7]">
          Fiction is the reading. These JSON objects are what the UI actually received: the spread
          stub, how stars would be collected (not wired yet), and MCP agent events with the
          recorded request and response bodies. The agent does not invent a chain of thought here —
          only stored activity.
        </p>
        <details open data-testid="json-spread">
          <summary className="cursor-pointer text-sm font-medium text-amber-100">
            Spread JSON
          </summary>
          <pre
            data-json="spread"
            className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-[#e4e4e7]"
          >
            {JSON.stringify(spreadJson ?? { status: "no spread yet" }, null, 2)}
          </pre>
        </details>
        <details open data-testid="json-stars">
          <summary className="cursor-pointer text-sm font-medium text-amber-100">
            Stars / NASA collector
          </summary>
          <pre
            data-json="stars"
            className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-[#e4e4e7]"
          >
            {JSON.stringify(hood?.stars ?? { status: "loading" }, null, 2)}
          </pre>
        </details>
        <details open data-testid="json-agent">
          <summary className="cursor-pointer text-sm font-medium text-amber-100">
            Agent activity (reasoning = recorded request/response)
          </summary>
          {hood?.viewer ? null : (
            <p className="mt-2 text-sm text-[#e4e4e7]">
              Sign in to load your MCP feed. Empty events means nothing was recorded yet, not that
              stars were fetched.
            </p>
          )}
          {hood?.agentError ? (
            <p className="mt-2 text-sm text-rose-200" data-agent-error="">
              {hood.agentError}
            </p>
          ) : null}
          <pre
            data-json="agent"
            className="mt-2 max-h-80 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-[#e4e4e7]"
          >
            {JSON.stringify(hood?.agent ?? { status: "loading" }, null, 2)}
          </pre>
          <ol className="mt-3 space-y-2" data-testid="agent-event-list">
            {events.map((event) => {
              if (!event || typeof event !== "object") {
                return null;
              }
              const row = event as {
                eventId?: string;
                kind?: string;
                target?: string | null;
                request?: unknown;
                response?: unknown;
              };
              return (
                <li
                  key={row.eventId ?? JSON.stringify(row)}
                  data-agent-event={row.eventId}
                  data-event-kind={row.kind}
                  className="rounded-lg border border-violet-500/20 p-3 text-sm text-[#e4e4e7]"
                >
                  <p>
                    {row.kind}
                    {row.target ? ` · ${row.target}` : ""}
                  </p>
                  <pre className="mt-2 overflow-auto text-xs">
                    {JSON.stringify({ request: row.request, response: row.response }, null, 2)}
                  </pre>
                </li>
              );
            })}
          </ol>
        </details>
      </div>
    </section>
  );
}
