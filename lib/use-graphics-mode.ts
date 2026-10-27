"use client";

import { useSyncExternalStore } from "react";

import type { GraphicsCapability, GraphicsMode } from "./graphics-capability";
import {
  getGraphicsState,
  getServerGraphicsState,
  setGraphicsMode,
  subscribeGraphicsState,
} from "./graphics-mode-store";

export function useGraphicsMode(): {
  mode: GraphicsMode;
  setMode: (mode: GraphicsMode) => void;
  capability: GraphicsCapability | null;
} {
  const state = useSyncExternalStore(
    subscribeGraphicsState,
    getGraphicsState,
    getServerGraphicsState,
  );

  return { mode: state.mode, setMode: setGraphicsMode, capability: state.capability };
}
