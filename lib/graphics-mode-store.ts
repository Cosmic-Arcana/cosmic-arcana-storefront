import {
  assessGraphics,
  clampMode,
  parseStoredMode,
  type GraphicsCapability,
  type GraphicsMode,
} from "./graphics-capability.ts";

const STORAGE_KEY = "cosmic-arcana-graphics-mode";

export type GraphicsState = {
  mode: GraphicsMode;
  capability: GraphicsCapability | null;
};

/** The device ceiling always wins: a stored preference can only lower the mode, never raise it. */
export const resolveGraphicsState = (
  stored: string | null,
  capability: GraphicsCapability,
): GraphicsState => ({
  mode: clampMode(parseStoredMode(stored), capability.maxMode),
  capability,
});

/**
 * A module-level store rather than state set from an effect: the mode depends on the device, which
 * the server cannot know, and React must be handed one stable snapshot per change.
 */
const SERVER_STATE: GraphicsState = { mode: "medium", capability: null };

let clientState: GraphicsState | null = null;
const listeners = new Set<() => void>();

const readStoredMode = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const emit = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const subscribeGraphicsState = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getGraphicsState = (): GraphicsState => {
  clientState ??= resolveGraphicsState(readStoredMode(), assessGraphics());
  return clientState;
};

export const getServerGraphicsState = (): GraphicsState => SERVER_STATE;

export const setGraphicsMode = (next: GraphicsMode): void => {
  const current = getGraphicsState();
  const capability = current.capability ?? assessGraphics();
  const mode = clampMode(next, capability.maxMode);
  if (mode === current.mode && capability === current.capability) {
    return;
  }
  clientState = { mode, capability };
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // A blocked storage API only costs the preference, never the render.
  }
  emit();
};
