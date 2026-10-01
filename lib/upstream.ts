import { USER_MESSAGES } from "./user-messages.ts";

export type UpstreamName = "tarot" | "history";
export type UpstreamFailure = "unreachable" | "timeout" | "bad-status" | "bad-body";

/**
 * A dependency let us down. The class carries what to *do* about it (which status to answer with,
 * what to tell the visitor) and deliberately nothing about what the runtime said: those messages
 * name hosts and ports.
 */
export class UpstreamError extends Error {
  readonly upstream: UpstreamName;
  readonly failure: UpstreamFailure;
  readonly upstreamStatus: number | null;

  constructor(upstream: UpstreamName, failure: UpstreamFailure, upstreamStatus: number | null = null) {
    super(`${upstream} ${failure}`);
    this.name = "UpstreamError";
    this.upstream = upstream;
    this.failure = failure;
    this.upstreamStatus = upstreamStatus;
  }

  /** 503 when we could not reach it, 504 when it took too long, 502 when it answered badly. */
  get httpStatus(): 502 | 503 | 504 {
    if (this.failure === "unreachable") {
      return 503;
    }
    return this.failure === "timeout" ? 504 : 502;
  }
}

// Tarot may wait on a language model; history only reads a table.
const DEFAULT_TIMEOUT_MS: Record<UpstreamName, number> = { tarot: 30_000, history: 5_000 };

export const upstreamTimeoutMs = (
  name: UpstreamName,
  env: Record<string, string | undefined> = process.env,
): number => {
  const configured = Number(env[`${name.toUpperCase()}_TIMEOUT_MS`]);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS[name];
};

export const upstreamFetch = async (
  name: UpstreamName,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = upstreamTimeoutMs(name),
): Promise<Response> => {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    throw new UpstreamError(name, timedOut ? "timeout" : "unreachable");
  }
};

export const readUpstreamJson = async (name: UpstreamName, response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new UpstreamError(name, "bad-body");
  }
};

export const upstreamUserMessage = (error: UpstreamError): string =>
  error.upstream === "tarot" ? USER_MESSAGES.cardsUnavailable : USER_MESSAGES.savedUnavailable;
