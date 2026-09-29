"use client";

import { useEffect, useState } from "react";

import {
  assessGraphics,
  clampMode,
  parseStoredMode,
  type GraphicsCapability,
  type GraphicsMode,
} from "./graphics-capability";

const STORAGE_KEY = "cosmic-arcana-graphics-mode";

export function useGraphicsMode(): {
  mode: GraphicsMode;
  setMode: (mode: GraphicsMode) => void;
  capability: GraphicsCapability | null;
} {
  const [mode, setModeState] = useState<GraphicsMode>("medium");
  const [capability, setCapability] = useState<GraphicsCapability | null>(null);

  useEffect(() => {
    const cap = assessGraphics();
    setCapability(cap);
    const stored = parseStoredMode(window.localStorage.getItem(STORAGE_KEY));
    setModeState(clampMode(stored, cap.maxMode));
  }, []);

  const setMode = (next: GraphicsMode) => {
    const cap = capability ?? assessGraphics();
    const clamped = clampMode(next, cap.maxMode);
    setModeState(clamped);
    window.localStorage.setItem(STORAGE_KEY, clamped);
  };

  return { mode, setMode, capability };
}
