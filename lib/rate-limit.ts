const WINDOW_MS = 60_000;
const MAX = 10;
// Clients are keyed by a header the browser can set, so the number of distinct keys is not ours to
// control. Without these two bounds every new key would stay in memory for the life of the process.
const MAX_TRACKED_CLIENTS = 10_000;
const SWEEP_EVERY_MS = 10_000;

// A Map iterates in insertion order, and a client is re-inserted on each request, so the first
// key is always the one that has been quiet the longest.
const hits = new Map<string, number[]>();
let lastSweepAt = 0;

export const resetRateLimit = (): void => {
  hits.clear();
  lastSweepAt = 0;
};

export const trackedClients = (): number => hits.size;

const sweep = (now: number): void => {
  lastSweepAt = now;
  for (const [key, times] of hits) {
    if (now - (times.at(-1) ?? 0) >= WINDOW_MS) {
      hits.delete(key);
    }
  }
};

export const allowRequest = (key: string, now = Date.now()): boolean => {
  if (now - lastSweepAt >= SWEEP_EVERY_MS) {
    sweep(now);
  }

  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.delete(key);
  hits.set(key, recent);

  while (hits.size > MAX_TRACKED_CLIENTS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    hits.delete(oldest);
  }
  return true;
};

export const MAX_QUESTION_CHARS = 1000;
