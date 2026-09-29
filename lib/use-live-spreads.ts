"use client";

import { useEffect, useState } from "react";

import type { SceneCard } from "../components/ArcanaScene";

export type LiveSpreadDrawn = {
  spreadId: string;
  cards: SceneCard[];
  createdAt: string;
};

const parseLive = (value: unknown): LiveSpreadDrawn | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.type !== "spread.drawn" || typeof record.spreadId !== "string") {
    return null;
  }
  if (!Array.isArray(record.cards)) {
    return null;
  }
  const cards: SceneCard[] = [];
  for (const item of record.cards) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const card = item as Record<string, unknown>;
    if (
      typeof card.positionKey !== "string" ||
      typeof card.cardId !== "string" ||
      typeof card.reversed !== "boolean"
    ) {
      return null;
    }
    cards.push({
      positionKey: card.positionKey,
      cardId: card.cardId,
      reversed: card.reversed,
    });
  }
  return {
    spreadId: record.spreadId,
    cards,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
  };
};

export const liveWsUrl = (): string =>
  (process.env.NEXT_PUBLIC_TAROT_WS_URL ?? "").replace(/\/$/, "");

export function useLiveSpreads(): { live: LiveSpreadDrawn[]; connected: boolean } {
  const [live, setLive] = useState<LiveSpreadDrawn[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const url = liveWsUrl();
    if (!url) {
      return;
    }
    const socket = new WebSocket(url);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      try {
        const parsed = parseLive(JSON.parse(String(event.data)));
        if (!parsed) {
          return;
        }
        setLive((current) => [...current, parsed].slice(-8));
      } catch {
        return;
      }
    };
    return () => socket.close();
  }, []);

  return { live, connected };
}
