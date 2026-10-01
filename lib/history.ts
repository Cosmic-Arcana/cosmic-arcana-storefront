import type {
  SpreadCardV1,
  SpreadDetailsV1,
  SpreadHistoryItemV1,
  SpreadHistoryPageV1,
} from "@cosmic-arcana/sdk";

import { CORRELATION_HEADER } from "./bff.ts";
import { UpstreamError, readUpstreamJson, upstreamFetch } from "./upstream.ts";
import { USER_MESSAGES } from "./user-messages.ts";

export const historyBaseUrl = (): string =>
  (process.env.HISTORY_BASE_URL ?? "").replace(/\/$/, "");

const parseItem = (value: unknown): SpreadHistoryItemV1 => {
  if (!value || typeof value !== "object") {
    throw new Error("history item invalid");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.spreadId !== "string" || typeof row.prediction !== "string") {
    throw new Error("history item fields missing");
  }
  return {
    spreadId: row.spreadId,
    question: typeof row.question === "string" ? row.question : "",
    cards: Array.isArray(row.cards) ? (row.cards as SpreadCardV1[]) : [],
    prediction: row.prediction,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
  };
};

export const parseHistoryPage = (body: unknown): SpreadHistoryPageV1 => {
  if (!body || typeof body !== "object") {
    throw new Error("history page is not an object");
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    throw new Error("history items missing");
  }
  return {
    items: record.items.map(parseItem),
    nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null,
  };
};

export type ReadingsView =
  | { kind: "empty" }
  | { kind: "list"; items: SpreadHistoryItemV1[] }
  | { kind: "error"; message: string };

export const readingsView = (
  page: SpreadHistoryPageV1 | null,
  error: string | null,
): ReadingsView => {
  if (error) {
    return { kind: "error", message: error };
  }
  if (!page || page.items.length === 0) {
    return { kind: "empty" };
  }
  return { kind: "list", items: page.items };
};

const requestHeaders = (correlationId: string): Record<string, string> => {
  const headers: Record<string, string> = {
    accept: "application/json",
    [CORRELATION_HEADER]: correlationId,
  };
  const internal = process.env.INTERNAL_SERVICE_TOKEN;
  if (internal) {
    headers["x-internal-token"] = internal;
  }
  return headers;
};

const requireBaseUrl = (): string => {
  const base = historyBaseUrl();
  if (!base) {
    throw new Error("HISTORY_BASE_URL is not set");
  }
  return base;
};

export const fetchHistoryPage = async (
  userId: string,
  { cursor = null, correlationId }: { cursor?: string | null; correlationId: string },
): Promise<SpreadHistoryPageV1> => {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await upstreamFetch(
    "history",
    `${requireBaseUrl()}/users/${userId}/spread-history${query}`,
    { headers: requestHeaders(correlationId), cache: "no-store" },
  );
  if (!response.ok) {
    throw new UpstreamError("history", "bad-status", response.status);
  }
  const body = await readUpstreamJson("history", response);
  try {
    return parseHistoryPage(body);
  } catch {
    throw new UpstreamError("history", "bad-body");
  }
};

const HISTORY_NOT_FOUND = "spread not found";

/**
 * A 404 only means "history has not seen this reading" when it is history's own answer. The same
 * status comes back from a proxy, or from an older history that has no such route at all, and
 * treating those as "unknown" would send the lookup to the write side — which knows nothing of
 * removal and would bring back a reading the visitor deleted.
 */
const isHistoryNotFound = async (response: Response): Promise<boolean> => {
  try {
    const body: unknown = await response.json();
    return (
      typeof body === "object" && body !== null && (body as { message?: unknown }).message === HISTORY_NOT_FOUND
    );
  } catch {
    return false;
  }
};

const failWith = (error: UpstreamError): never => {
  throw error;
};

/** "removed" and "unknown" are different answers: only one of them may be looked up elsewhere. */
export type HistoryItemLookup =
  | { kind: "found"; item: SpreadHistoryItemV1 }
  | { kind: "removed" }
  | { kind: "unknown" };

export const fetchHistoryItem = async (
  userId: string,
  spreadId: string,
  correlationId: string,
): Promise<HistoryItemLookup> => {
  const response = await upstreamFetch(
    "history",
    `${requireBaseUrl()}/users/${userId}/spread-history/${spreadId}`,
    { headers: requestHeaders(correlationId), cache: "no-store" },
  );
  if (response.status === 404) {
    return (await isHistoryNotFound(response))
      ? { kind: "unknown" }
      : failWith(new UpstreamError("history", "bad-status", 404));
  }
  if (response.status === 410) {
    return { kind: "removed" };
  }
  if (!response.ok) {
    throw new UpstreamError("history", "bad-status", response.status);
  }
  const body = await readUpstreamJson("history", response);
  try {
    return { kind: "found", item: parseItem(body) };
  } catch {
    throw new UpstreamError("history", "bad-body");
  }
};

export type ReadingDetailView =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; item: SpreadHistoryItemV1 };

const SPREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id travels into an upstream url path, so it is checked before it is ever interpolated. */
export const isSpreadId = (value: string): boolean => SPREAD_ID.test(value);

const itemFromSpread = (spread: SpreadDetailsV1): SpreadHistoryItemV1 => ({
  spreadId: spread.spreadId,
  question: spread.question,
  cards: spread.cards,
  prediction: spread.prediction,
  createdAt: spread.createdAt,
});

/**
 * Decides what a reading page shows before any JSX exists, so the page never builds elements
 * inside a try/catch — React cannot catch render errors that way.
 *
 * History is a read model that trails the write side by a moment. A reading it has not seen yet
 * is looked up where it was written, so the reading a visitor just made opens at once, but only
 * for its owner and never once the visitor has removed it.
 */
export const resolveReadingDetail = async ({
  userId,
  spreadId,
  configured,
  loadItem,
  loadFromWriteSide,
  onError,
}: {
  userId: string | null;
  spreadId: string;
  configured: boolean;
  loadItem: () => Promise<HistoryItemLookup>;
  loadFromWriteSide: () => Promise<SpreadDetailsV1 | null>;
  onError?: (cause: unknown) => void;
}): Promise<ReadingDetailView> => {
  if (!userId) {
    return { kind: "signed-out" };
  }
  if (!configured) {
    return { kind: "unconfigured" };
  }
  if (!isSpreadId(spreadId)) {
    return { kind: "missing" };
  }

  try {
    const found = await loadItem();
    if (found.kind === "found") {
      return { kind: "ready", item: found.item };
    }
    if (found.kind === "removed") {
      return { kind: "missing" };
    }
    const written = await loadFromWriteSide();
    return written && written.userId === userId
      ? { kind: "ready", item: itemFromSpread(written) }
      : { kind: "missing" };
  } catch (cause) {
    onError?.(cause);
    return {
      kind: "error",
      message:
        cause instanceof UpstreamError ? USER_MESSAGES.savedUnavailable : USER_MESSAGES.somethingWrong,
    };
  }
};

export type DeleteOutcome = {
  status: number;
  body: { deleted: true } | { error: string };
};

export const deleteOutcome = (upstreamStatus: number): DeleteOutcome => {
  if (upstreamStatus === 404 || upstreamStatus === 410) {
    return { status: 404, body: { error: USER_MESSAGES.readingAlreadyRemoved } };
  }
  if (upstreamStatus >= 200 && upstreamStatus < 300) {
    return { status: 200, body: { deleted: true } };
  }
  return { status: 502, body: { error: USER_MESSAGES.removeFailed } };
};
