export const GRAPHICS_MODES = ["light", "medium", "heavy"] as const;
export type GraphicsMode = (typeof GRAPHICS_MODES)[number];

export type GraphicsCapability = {
  webgl: boolean;
  webgl2: boolean;
  cores: number | null;
  memoryGiB: number | null;
  reducedMotion: boolean;
  allow3d: boolean;
  maxMode: GraphicsMode;
  reason: string;
};

const isGraphicsMode = (value: string): value is GraphicsMode =>
  GRAPHICS_MODES.includes(value as GraphicsMode);

const parseIosMajor = (ua: string): number | null => {
  const match = ua.match(/OS (\d+)[._]/);
  return match ? Number(match[1]) : null;
};

const parseAndroidMajor = (ua: string): number | null => {
  const match = ua.match(/Android (\d+)/);
  return match ? Number(match[1]) : null;
};

export const assessGraphics = (): GraphicsCapability => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : null;
  const memoryGiB =
    typeof navigator !== "undefined" && "deviceMemory" in navigator
      ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
      : null;
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let webgl = false;
  let webgl2 = false;
  try {
    const canvas = document.createElement("canvas");
    webgl2 = Boolean(canvas.getContext("webgl2"));
    webgl = webgl2 || Boolean(canvas.getContext("webgl"));
  } catch {
    webgl = false;
  }

  const ios = parseIosMajor(ua);
  const android = parseAndroidMajor(ua);
  const ancientBrowser =
    /MSIE |Trident\/|Opera Mini|Android 4\.|Android 5\./.test(ua) ||
    (ios !== null && ios < 13) ||
    (android !== null && android < 8);

  if (!webgl || ancientBrowser) {
    return {
      webgl,
      webgl2,
      cores,
      memoryGiB,
      reducedMotion,
      allow3d: false,
      maxMode: "light",
      reason: !webgl
        ? "This browser did not create a WebGL context, so 3D is off."
        : "This browser or OS version is treated as too old for the 3D deck.",
    };
  }

  if (reducedMotion) {
    return {
      webgl,
      webgl2,
      cores,
      memoryGiB,
      reducedMotion,
      allow3d: false,
      maxMode: "light",
      reason: "Reduced motion is on, so animated 3D is off.",
    };
  }

  const lowPower = (cores !== null && cores <= 2) || (memoryGiB !== null && memoryGiB <= 2);
  const midPower = (cores !== null && cores <= 4) || (memoryGiB !== null && memoryGiB <= 4);

  if (lowPower) {
    return {
      webgl,
      webgl2,
      cores,
      memoryGiB,
      reducedMotion,
      allow3d: true,
      maxMode: "light",
      reason: "CPU or memory looks limited, so only the light deck is allowed.",
    };
  }

  if (midPower) {
    return {
      webgl,
      webgl2,
      cores,
      memoryGiB,
      reducedMotion,
      allow3d: true,
      maxMode: "medium",
      reason: "This device should handle medium motion. Heavy is blocked.",
    };
  }

  return {
    webgl,
    webgl2,
    cores,
    memoryGiB,
    reducedMotion,
    allow3d: true,
    maxMode: "heavy",
    reason: "WebGL looks available; light, medium, and heavy are allowed.",
  };
};

export const clampMode = (wanted: GraphicsMode, maxMode: GraphicsMode): GraphicsMode => {
  const rank = { light: 0, medium: 1, heavy: 2 };
  return rank[wanted] > rank[maxMode] ? maxMode : wanted;
};

export const parseStoredMode = (value: string | null): GraphicsMode =>
  value && isGraphicsMode(value) ? value : "medium";
