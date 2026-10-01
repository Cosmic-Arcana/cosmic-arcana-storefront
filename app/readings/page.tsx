import { randomUUID } from "node:crypto";

import Link from "next/link";
import { redirect } from "next/navigation";
import type { SpreadHistoryPageV1 } from "@cosmic-arcana/sdk";

import { auth0 } from "../../lib/auth0";
import { recordPageFailure } from "../../lib/bff";
import { cardLabel } from "../../lib/card-label";
import { formatReadingDate } from "../../lib/format-date";
import { fetchHistoryPage, historyBaseUrl, readingsView } from "../../lib/history";
import { resolveSpreadUserId } from "../../lib/spread-user";
import { UpstreamError } from "../../lib/upstream";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved readings",
  robots: { index: false, follow: false },
};

const MAX_CURSOR_CHARS = 512;

export default async function ReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { cursor: rawCursor } = await searchParams;
  const cursor =
    typeof rawCursor === "string" && rawCursor.length > 0 && rawCursor.length <= MAX_CURSOR_CHARS
      ? rawCursor
      : null;

  const session = await auth0.getSession().catch(() => null);
  const userId = resolveSpreadUserId(session?.user?.sub);

  if (!userId) {
    return (
      <main id="main" className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl font-semibold">Saved readings</h1>
        <p className="mt-3 text-sm text-[#e4e4e7]">Sign in to see readings stored for your account.</p>
        <Link className="mt-6 inline-block rounded-md bg-violet-600 px-4 py-2 text-sm" href="/login">
          Sign in
        </Link>
      </main>
    );
  }

  if (!historyBaseUrl()) {
    return (
      <main id="main" className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl font-semibold">Saved readings</h1>
        <p className="mt-3 text-sm text-[#e4e4e7]" data-testid="readings-unconfigured">
          HISTORY_BASE_URL is not set. No list is invented.
        </p>
      </main>
    );
  }

  const correlationId = randomUUID();
  let page: SpreadHistoryPageV1 | null = null;
  let failure: string | null = null;
  try {
    page = await fetchHistoryPage(userId, { cursor, correlationId });
  } catch (cause) {
    // A cursor that history refuses is a stale or tampered link: start again from the newest.
    if (cursor && cause instanceof UpstreamError && cause.upstreamStatus === 400) {
      redirect("/readings");
    }
    failure = recordPageFailure(correlationId, "/readings", cause);
  }
  const view = readingsView(page, failure);

  return (
    <main id="main" className="mx-auto max-w-xl space-y-4 p-10">
      <h1 className="text-2xl font-semibold">Saved readings</h1>
      {view.kind === "empty" ? (
        <p data-testid="readings-empty" className="text-sm text-[#e4e4e7]">
          No saved readings yet.{" "}
          <Link href="/" className="text-amber-100 underline underline-offset-4">
            Ask your first question
          </Link>
          .
        </p>
      ) : null}
      {view.kind === "error" ? (
        <p data-testid="readings-error" className="text-sm text-rose-300" role="alert">
          {view.message}
        </p>
      ) : null}
      {view.kind === "list" ? (
        <ul data-testid="readings-list" className="space-y-3">
          {view.items.map((item) => (
            <li key={item.spreadId}>
              <Link
                href={`/readings/${item.spreadId}`}
                className="block rounded-lg border border-violet-500/30 p-4 hover:border-violet-400"
              >
                <span className="block text-xs text-[#d4d4d8]">{formatReadingDate(item.createdAt)}</span>
                <span className="mt-1 line-clamp-2 block text-sm text-amber-100">{item.question}</span>
                <span className="mt-2 block text-xs text-[#d4d4d8]">
                  {item.cards
                    .map((card) => `${cardLabel(card.cardId)}${card.reversed ? " (reversed)" : ""}`)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <nav aria-label="Pages of readings" className="flex gap-6 text-sm">
        {cursor ? (
          <Link className="text-amber-100 underline underline-offset-4" href="/readings">
            Newest readings
          </Link>
        ) : null}
        {page?.nextCursor ? (
          <Link
            className="text-amber-100 underline underline-offset-4"
            href={`/readings?cursor=${encodeURIComponent(page.nextCursor)}`}
          >
            Older readings
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
