import type { SpreadCardV1 } from "@cosmic-arcana/sdk";

const MOTIFS = ["aurora", "quiet moon", "dust trail", "station light", "comet tail"] as const;

export type CosmicIllustration = {
  positionKey: string;
  cardId: string;
  motif: (typeof MOTIFS)[number];
  source: "fixture";
  influencedDraw: false;
};

/** Illustration only. Input is already-drawn cards; this must not change them. */
export const illustrateCards = (cards: SpreadCardV1[]): CosmicIllustration[] =>
  cards.map((card) => {
    const index = card.cardId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % MOTIFS.length;
    return {
      positionKey: card.positionKey,
      cardId: card.cardId,
      motif: MOTIFS[index] ?? "aurora",
      source: "fixture",
      influencedDraw: false,
    };
  });
