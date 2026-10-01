"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { parseSpreadDetailsV1, type SpreadDetailsV1 } from "@cosmic-arcana/sdk";

import type { SceneCard } from "./ArcanaScene";
import { cardLabel, positionLabel } from "../lib/card-label";
import { illustrateCards } from "../lib/cosmic-context";
import { GRAPHICS_MODES } from "../lib/graphics-capability";
import { liveWsUrl, useLiveSpreads } from "../lib/use-live-spreads";
import { useGraphicsMode } from "../lib/use-graphics-mode";

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
  const [consent, setConsent] = useState(false);
  const { live, connected } = useLiveSpreads(joinLive);
  const { mode, setMode, capability } = useGraphicsMode();

  const cards: SceneCard[] = spread?.cards ?? [];
  const cosmic = illustrateCards(cards);
  const liveCards: SceneCard[] = live.flatMap((item) => item.cards);

  const onAsk = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/spreads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, consent: true }),
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
        className={compact ? "relative h-full min-h-0 flex-1" : "relative h-[34svh] min-h-[220px] lg:h-[70vh] lg:min-h-[420px]"}
        aria-label="Three-dimensional tarot deck. Move the pointer to tilt the cards."
        data-testid="tarot-scene"
      >
        <div
          className="absolute inset-0"
          role="img"
          aria-label="Animated tarot cards"
          data-graphics-mode={mode}
          data-graphics={capability?.allow3d ? "3d" : "disabled"}
        >
          <ArcanaScene
            cards={cards}
            liveCards={liveCards}
            compact={compact}
            mode={mode}
            capability={capability}
          />
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
              {positionLabel(card.positionKey)} · {cardLabel(card.cardId)}
              {card.reversed ? " · reversed" : ""}
            </span>
          ))}
        </div>
      </section>
      {compact ? null : (
        <aside className="order-first flex flex-col gap-4 border-b border-violet-500/20 bg-[#0b0714] p-6 lg:order-none lg:border-b-0 lg:border-l">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Cosmic Arcana</p>
          <h1 className="text-2xl font-semibold text-[#f5f3ff]">Fictional reading</h1>
          <p className="text-sm leading-6 text-[#e4e4e7]">
            Readings are fiction and entertainment. They are not advice and not a factual claim
            about the future. Interpretations, when present, are <strong>AI-generated</strong>.
          </p>
          <p className="text-sm leading-6 text-[#e4e4e7]">
            <a className="underline" href="/privacy">
              Privacy
            </a>{" "}
            ·{" "}
            <a className="underline" href="/terms">
              Terms
            </a>
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
            rows={3}
            placeholder="Ask a question"
            aria-describedby="question-help"
            className="resize-none rounded-xl border border-violet-400 bg-[#160f24] p-3 text-sm text-[#f5f3ff] outline-none focus:border-amber-200 lg:h-32"
            disabled={busy}
          />
          <p id="question-help" className="text-xs text-[#d4d4d8]">
            Sent to tarot-service-api. The question is not written to application logs. Special
            category topics (health, sex, religion) need this explicit consent.
          </p>
          <label className="flex items-start gap-2 text-sm text-[#e4e4e7]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1"
            />
            I consent to storing this question to produce a fictional reading.
          </label>
          <button
            type="button"
            onClick={() => void onAsk()}
            disabled={busy || question.trim().length === 0 || !consent}
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
          <div aria-live="polite" data-testid="reading-live-region">
            {spread ? (
              <div className="space-y-2 text-sm text-[#e4e4e7]" data-spread-id={spread.spreadId}>
                <p className="text-xs uppercase tracking-wide text-[#d4d4d8]">
                  Stub from tarot-service-api · AI-generated if interpretation is wired later
                </p>
                <p className="font-mono text-[11px] text-[#d4d4d8]">{spread.spreadId}</p>
                <a className="text-sm text-amber-100 underline" href={`/readings/${spread.spreadId}`}>
                  Open saved reading
                </a>
                <p data-testid="prediction" className="whitespace-pre-line">
                  {spread.prediction}
                </p>
                <div data-testid="cosmic-context" className="space-y-1 text-xs text-[#d4d4d8]">
                  <p>Symbolic sky (fixture, not a live NASA call). It did not choose these cards.</p>
                  {cosmic.map((row) => (
                    <p key={`${row.positionKey}-${row.cardId}`}>
                      {row.positionKey}: {row.motif}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#d4d4d8]">
                Ask a question to draw cards. Until then the deck is decoration, not a reading.
              </p>
            )}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-amber-100">Graphics</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Graphics mode">
              {GRAPHICS_MODES.map((option) => {
                const blocked = Boolean(
                  capability &&
                    GRAPHICS_MODES.indexOf(option) > GRAPHICS_MODES.indexOf(capability.maxMode),
                );
                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-400 px-3 py-2 text-sm text-[#f5f3ff]"
                  >
                    <input
                      type="radio"
                      name="graphics-mode"
                      value={option}
                      checked={mode === option}
                      disabled={blocked}
                      onChange={() => setMode(option)}
                    />
                    {option}
                  </label>
                );
              })}
            </div>
            {capability ? (
              <p className="text-xs text-[#d4d4d8]" data-graphics-reason="">
                {capability.reason}
              </p>
            ) : null}
          </fieldset>
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
