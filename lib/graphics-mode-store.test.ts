import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GraphicsCapability } from "./graphics-capability.ts";
import { resolveGraphicsState } from "./graphics-mode-store.ts";

const capability = (maxMode: GraphicsCapability["maxMode"]): GraphicsCapability =>
  ({ maxMode }) as GraphicsCapability;

describe("resolveGraphicsState", () => {
  it("keeps a stored mode the device can render", () => {
    const state = resolveGraphicsState("heavy", capability("heavy"));
    assert.equal(state.mode, "heavy");
  });

  it("clamps a stored mode the device cannot render", () => {
    const state = resolveGraphicsState("heavy", capability("light"));
    assert.equal(state.mode, "light");
  });

  it("falls back to the device ceiling when nothing is stored", () => {
    assert.equal(resolveGraphicsState(null, capability("medium")).mode, "medium");
    assert.equal(resolveGraphicsState("nonsense", capability("light")).mode, "light");
  });

  it("carries the capability so callers can explain the clamp", () => {
    const cap = capability("light");
    assert.equal(resolveGraphicsState("heavy", cap).capability, cap);
  });
});
