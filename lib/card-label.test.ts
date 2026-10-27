import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cardLabel, positionLabel } from "./card-label.ts";

describe("card labels", () => {
  it("turns a card id into the name people say", () => {
    assert.equal(cardLabel("queen-of-swords"), "Queen of Swords");
    assert.equal(cardLabel("ace-of-wands"), "Ace of Wands");
    assert.equal(cardLabel("wheel-of-fortune"), "Wheel of Fortune");
  });

  it("capitalises a leading article but keeps 'of' small", () => {
    assert.equal(cardLabel("the-fool"), "The Fool");
    assert.equal(cardLabel("the-wheel-of-fortune"), "The Wheel of Fortune");
  });

  it("copes with an id that is not a card name rather than throwing", () => {
    assert.equal(cardLabel("stub-0a1b2c3d"), "Stub 0a1b2c3d");
    assert.equal(cardLabel(""), "");
    assert.equal(cardLabel("--"), "");
  });

  it("names a spread position", () => {
    assert.equal(positionLabel("past"), "Past");
    assert.equal(positionLabel("near-future"), "Near future");
  });
});
