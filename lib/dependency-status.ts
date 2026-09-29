export type OfficialIndicator = "none" | "minor" | "major" | "critical";
export type FeatureState = "up" | "degraded" | "down";

export type FeatureStatus = {
  state: FeatureState;
  message: string;
  incidentId: string | null;
  since: string | null;
};

export type DependenciesStatus = {
  aiInterpretation: FeatureStatus;
  cosmicContext: FeatureStatus;
};

export function mergeAiInterpretation(input: {
  officialIndicator: OfficialIndicator;
  breakerOpen: boolean;
  fallbackAvailable: boolean;
}): FeatureState {
  if (input.fallbackAvailable && input.breakerOpen) {
    return "up";
  }
  if (input.breakerOpen) {
    return "down";
  }
  if (input.officialIndicator === "major" || input.officialIndicator === "critical") {
    return "down";
  }
  if (input.officialIndicator === "minor") {
    return "degraded";
  }
  return "up";
}

export class SlidingCircuitBreaker {
  private readonly windowMs: number;
  private readonly minSamples: number;
  private readonly failRatio: number;
  private events: { at: number; fail: boolean }[] = [];
  private openUntil = 0;

  constructor(opts?: { windowMs?: number; minSamples?: number; failRatio?: number }) {
    this.windowMs = opts?.windowMs ?? 60_000;
    this.minSamples = opts?.minSamples ?? 10;
    this.failRatio = opts?.failRatio ?? 0.5;
  }

  record(fail: boolean, now = Date.now()): void {
    this.events.push({ at: now, fail });
    const cut = now - this.windowMs;
    this.events = this.events.filter((event) => event.at >= cut);
    if (now < this.openUntil) {
      return;
    }
    if (this.events.length < this.minSamples) {
      return;
    }
    const fails = this.events.filter((event) => event.fail).length;
    if (fails / this.events.length >= this.failRatio) {
      this.openUntil = now + 30_000;
    }
  }

  isOpen(now = Date.now()): boolean {
    return now < this.openUntil;
  }

  /** Test helper: 8 fails + 2 ok in window without waiting. */
  seedFailures(failCount: number, okCount: number, now = Date.now()): void {
    this.events = [];
    for (let i = 0; i < failCount; i += 1) {
      this.record(true, now);
    }
    for (let i = 0; i < okCount; i += 1) {
      this.record(false, now);
    }
  }
}

export const interpretationBreaker = new SlidingCircuitBreaker();

export function parseStatuspageIndicator(value: unknown): OfficialIndicator {
  if (value === "minor" || value === "major" || value === "critical" || value === "none") {
    return value;
  }
  return "none";
}
