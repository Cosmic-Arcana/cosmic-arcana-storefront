const WINDOW_MS = 60_000;
const MAX = 10;
const hits = new Map<string, number[]>();

export const allowRequest = (key: string, now = Date.now()): boolean => {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
};

export const MAX_QUESTION_CHARS = 1000;
