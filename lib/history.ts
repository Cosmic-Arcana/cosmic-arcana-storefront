import type { SpreadHistoryItemV1, SpreadHistoryPageV1 } from "@cosmic-arcana/sdk";

export const historyBaseUrl = (): string =>
  (process.env.HISTORY_BASE_URL ?? "").replace(/\/$/, "");

export const parseHistoryPage = (body: unknown): SpreadHistoryPageV1 => {
  if (!body || typeof body !== "object") {
    throw new Error("history page is not an object");
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    throw new Error("history items missing");
  }
  const items = record.items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("history item invalid");
    }
    const row = item as Record<string, unknown>;
    if (typeof row.spreadId !== "string" || typeof row.prediction !== "string") {
      throw new Error("history item fields missing");
    }
    return {
      spreadId: row.spreadId,
      question: typeof row.question === "string" ? row.question : "",
      cards: Array.isArray(row.cards) ? (row.cards as SpreadHistoryItemV1["cards"]) : [],
      prediction: row.prediction,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    };
  });
  return {
    items,
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

export const fetchHistoryPage = async (userId: string): Promise<SpreadHistoryPageV1> => {
  const base = historyBaseUrl();
  if (!base) {
    throw new Error("HISTORY_BASE_URL is not set");
  }
  const headers: Record<string, string> = { accept: "application/json" };
  const internal = process.env.INTERNAL_SERVICE_TOKEN;
  if (internal) {
    headers["x-internal-token"] = internal;
  }
  const response = await fetch(`${base}/users/${userId}/spread-history`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`history ${response.status}`);
  }
  return parseHistoryPage(await response.json());
};

export const itemBySpreadId = (
  page: SpreadHistoryPageV1,
  spreadId: string,
): SpreadHistoryItemV1 | null =>
  page.items.find((item) => item.spreadId === spreadId) ?? null;

export type ReadingDetailView =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; item: SpreadHistoryItemV1 };

/**
 * Decides what a reading page shows before any JSX exists, so the page never builds elements
 * inside a try/catch — React cannot catch render errors that way.
 */
export const resolveReadingDetail = async ({
  userId,
  spreadId,
  configured,
  loadPage,
}: {
  userId: string | null;
  spreadId: string;
  configured: boolean;
  loadPage: (userId: string) => Promise<SpreadHistoryPageV1>;
}): Promise<ReadingDetailView> => {
  if (!userId) {
    return { kind: "signed-out" };
  }
  if (!configured) {
    return { kind: "unconfigured" };
  }
  try {
    const page = await loadPage(userId);
    const item = itemBySpreadId(page, spreadId);
    return item ? { kind: "ready", item } : { kind: "missing" };
  } catch (cause) {
    return { kind: "error", message: cause instanceof Error ? cause.message : "history failed" };
  }
};
