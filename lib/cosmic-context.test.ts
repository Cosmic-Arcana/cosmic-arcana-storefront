import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { illustrateCards } from "./cosmic-context.ts";

const cards = [
  { positionKey: "past", cardId: "stub-aaaa", reversed: false },
  { positionKey: "present", cardId: "stub-bbbb", reversed: true },
  { positionKey: "future", cardId: "stub-cccc", reversed: false },
];

describe("illustrateCards", () => {
  it("does not change the draw and never claims NASA proof", () => {
    const art = illustrateCards(cards);
    assert.equal(art.length, 3);
    assert.deepEqual(
      art.map((row) => row.positionKey),
      ["past", "present", "future"],
    );
    assert.ok(art.every((row) => row.influencedDraw === false && row.source === "fixture"));
    assert.deepEqual(
      cards.map((card) => card.cardId),
      ["stub-aaaa", "stub-bbbb", "stub-cccc"],
    );
  });

  it("is empty when there are no cards", () => {
    assert.deepEqual(illustrateCards([]), []);
  });
});
