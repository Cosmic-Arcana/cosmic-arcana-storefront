"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { parseSpreadDetailsV1, type SpreadDetailsV1 } from "@cosmic-arcana/sdk";

import type { SceneCard } from "./ArcanaScene";
import { liveWsUrl, useLiveSpreads } from "../lib/use-live-spreads";

const ArcanaScene = dynamic(
  () => import("./ArcanaScene").then((mod) => mod.ArcanaScene),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#05010d]" /> },
);

type ReadingStudioProps = {
  compact?: boolean;
  onSpreadChange?: (spread: SpreadDetailsV1 | null) => void;
};

export function ReadingStudio({ compact = false, onSpreadChange }: ReadingStudioProps) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spread, setSpread] = useState<SpreadDetailsV1 | null>(null);
  const [joinLive, setJoinLive] = useState(false);
  const { live, connected } = useLiveSpreads(joinLive);

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
      const parsed = parseSpreadDetailsV1(body);
      setSpread(parsed);
      onSpreadChange?.(parsed);
    } catch (cause) {
      setSpread(null);
      onSpreadChange?.(null);
      setError(cause instanceof Error ? cause.message : "request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={compact ? "flex h-full flex-col" : "grid min-h-[70vh] lg:grid-cols-[minmax(0,1fr)_22rem]"}
      data-testid="reading-studio"
      data-compact={compact ? "true" : "false"}
    >
      <section
        className={compact ? "relative h-full min-h-0 flex-1" : "relative h-[70vh] min-h-[420px]"}
        aria-label="Three-dimensional tarot deck. Move the pointer to tilt the cards."
        data-testid="tarot-scene"
      >
        <div className="absolute inset-0" role="img" aria-label="Animated tarot cards in 3D">
          <ArcanaScene cards={cards} liveCards={liveCards} compact={compact} />
        </div>
        {liveCards.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-wrap justify-center gap-2 px-3">
            {liveCards.slice(-6).map((card, index) => (
              <span
                key={`live-${card.positionKey}-${card.cardId}-${index}`}
                data-live-card={card.cardId}
                data-position={card.positionKey}
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
              data-card-id={card.cardId}
              data-position={card.positionKey}
              data-reversed={card.reversed ? "true" : "false"}
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
          <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Cosmic Arcana</p>
          <h1 className="text-2xl font-semibold text-[#f5f3ff]">Fictional reading</h1>
          <p className="text-sm leading-6 text-[#e4e4e7]">
            Readings are fiction and entertainment. They are not advice and not a factual claim
            about the future.
          </p>
          <label htmlFor="question" className="text-sm font-medium text-amber-100">
            Your question
          </label>
          <textarea
            id="question"
            name="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="Ask a question"
            aria-describedby="question-help"
            className="resize-none rounded-xl border border-violet-400 bg-[#160f24] p-3 text-sm text-[#f5f3ff] outline-none focus:border-amber-200"
            disabled={busy}
          />
          <p id="question-help" className="text-xs text-[#d4d4d8]">
            Sent to tarot-service-api. The question is not written to application logs.
          </p>
          <button
            type="button"
            onClick={() => void onAsk()}
            disabled={busy || question.trim().length === 0}
            data-testid="ask-button"
            aria-busy={busy}
            className="rounded-xl bg-amber-200 px-4 py-3 text-sm font-semibold text-[#0b0714] disabled:opacity-40"
          >
            {busy ? "Drawing…" : "Ask"}
          </button>
          {error ? (
            <p className="text-sm text-rose-300" role="alert" data-testid="ask-error">
              {error}
            </p>
          ) : null}
          {spread ? (
            <div className="space-y-2 text-sm text-[#e4e4e7]" data-spread-id={spread.spreadId}>
              <p className="text-xs uppercase tracking-wide text-[#d4d4d8]">Stub from tarot-service-api</p>
              <p className="font-mono text-[11px] text-[#d4d4d8]">{spread.spreadId}</p>
              <p>{spread.prediction}</p>
            </div>
          ) : (
            <p className="text-sm text-[#d4d4d8]">
              No cards until tarot-service-api answers. Set TAROT_BASE_URL. The empty deck is
              decoration, not a reading.
            </p>
          )}
          <p className="text-xs text-[#d4d4d8]" data-live={connected ? "on" : "off"}>
            {connected
              ? "Live feed on. Other real draws show as cyan cards."
              : "Live feed stays closed until you join, so a down tarot host does not log a browser error."}
          </p>
          {liveWsUrl() ? (
            <button
              type="button"
              data-testid="join-live"
              onClick={() => setJoinLive(true)}
              disabled={joinLive}
              className="rounded-xl border border-cyan-200 px-4 py-2 text-sm font-medium text-cyan-100 disabled:opacity-40"
            >
              {joinLive ? "Joining live draws…" : "Join live draws"}
            </button>
          ) : null}
        </aside>
      )}
    </div>
  );
}
