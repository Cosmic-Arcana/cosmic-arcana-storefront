"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { parseSpreadDetailsV1, type SpreadDetailsV1 } from "@cosmic-arcana/sdk";

import type { SceneCard } from "./ArcanaScene";
import { useLiveSpreads } from "../lib/use-live-spreads";

const ArcanaScene = dynamic(
  () => import("./ArcanaScene").then((mod) => mod.ArcanaScene),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#05010d]" /> },
);

type ReadingStudioProps = {
  compact?: boolean;
};

export function ReadingStudio({ compact = false }: ReadingStudioProps) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spread, setSpread] = useState<SpreadDetailsV1 | null>(null);
  const { live, connected } = useLiveSpreads();

  const cards: SceneCard[] = spread?.cards ?? [];
  const liveCards: SceneCard[] = live.flatMap((item) => item.cards);

  const onAsk = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/spreads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : `request ${response.status}`;
        throw new Error(message);
      }
      setSpread(parseSpreadDetailsV1(body));
    } catch (cause) {
      setSpread(null);
      setError(cause instanceof Error ? cause.message : "request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "flex h-full flex-col" : "grid min-h-screen lg:grid-cols-[minmax(0,1fr)_22rem]"}>
      <section className={compact ? "relative h-full min-h-0 flex-1" : "relative h-[70vh] min-h-[420px]"}>
        <div className="absolute inset-0">
          <ArcanaScene cards={cards} liveCards={liveCards} compact={compact} />
        </div>
        {liveCards.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-wrap justify-center gap-2 px-3">
            {liveCards.slice(-6).map((card, index) => (
              <span
                key={`live-${card.positionKey}-${card.cardId}-${index}`}
                className="rounded-full border border-cyan-300/40 bg-black/55 px-3 py-1 text-[11px] tracking-wide text-cyan-100"
              >
                live · {card.cardId}
              </span>
            ))}
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-wrap justify-center gap-2 px-3">
          {cards.map((card) => (
            <span
              key={`${card.positionKey}-${card.cardId}`}
              className="rounded-full border border-amber-300/40 bg-black/55 px-3 py-1 text-[11px] tracking-wide text-amber-100"
            >
              {card.positionKey} · {card.cardId}
              {card.reversed ? " · reversed" : ""}
            </span>
          ))}
        </div>
      </section>
      {compact ? null : (
        <aside className="flex flex-col gap-4 border-t border-violet-500/20 bg-[#0b0714] p-6 lg:border-l lg:border-t-0">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300">Cosmic Arcana</p>
          <h1 className="text-2xl font-semibold text-zinc-50">Fictional reading</h1>
          <p className="text-sm leading-6 text-zinc-400">
            Readings are fiction and entertainment. They are not advice and not a factual claim
            about the future.
          </p>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="Ask a question"
            className="resize-none rounded-xl border border-violet-500/30 bg-[#160f24] p-3 text-sm text-zinc-100 outline-none focus:border-amber-300/60"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => void onAsk()}
            disabled={busy || question.trim().length === 0}
            className="rounded-xl bg-amber-200 px-4 py-3 text-sm font-semibold text-[#0b0714] disabled:opacity-40"
          >
            {busy ? "Drawing…" : "Ask"}
          </button>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {spread ? (
            <div className="space-y-2 text-sm text-zinc-300">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Stub from tarot-service-api</p>
              <p className="font-mono text-[11px] text-zinc-500">{spread.spreadId}</p>
              <p>{spread.prediction}</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No cards until tarot-service-api answers. Set TAROT_BASE_URL. The empty deck is
              decoration, not a reading.
            </p>
          )}
          <p className="text-xs text-zinc-500">
            {connected
              ? "Live feed on. Other real draws show as cyan cards."
              : "Live feed off until NEXT_PUBLIC_TAROT_WS_URL reaches tarot /live."}
          </p>
          <nav className="mt-auto flex flex-col gap-2 text-sm text-violet-200">
            <Link href="/watch" className="hover:text-amber-200">
              Watch-sized preview
            </Link>
            <Link href="/agent" className="hover:text-amber-200">
              Agent activity
            </Link>
            <Link href="/login" className="hover:text-amber-200">
              Sign in
            </Link>
          </nav>
        </aside>
      )}
    </div>
  );
}
