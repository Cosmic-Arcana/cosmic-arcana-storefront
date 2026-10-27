import { randomUUID } from "node:crypto";

import Link from "next/link";

import { SoftDeleteButton } from "../../../components/SoftDeleteButton";
import { auth0 } from "../../../lib/auth0";
import { recordPageFailure } from "../../../lib/bff";
import { cardLabel, positionLabel } from "../../../lib/card-label";
import { formatReadingDate } from "../../../lib/format-date";
import { fetchHistoryItem, historyBaseUrl, resolveReadingDetail } from "../../../lib/history";
import { resolveSpreadUserId } from "../../../lib/spread-user";
import { fetchSpread } from "../../../lib/tarot";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reading",
  robots: { index: false, follow: false },
};

export default async function ReadingDetailPage({
  params,
}: {
  params: Promise<{ spreadId: string }>;
}) {
  const { spreadId } = await params;
  const session = await auth0.getSession().catch(() => null);
  const userId = resolveSpreadUserId(session?.user?.sub);
  const correlationId = randomUUID();

  const view = await resolveReadingDetail({
    userId,
    spreadId,
    configured: Boolean(historyBaseUrl()),
    loadItem: () => fetchHistoryItem(userId ?? "", spreadId, correlationId),
    loadFromWriteSide: () => fetchSpread(spreadId, correlationId),
    onError: (cause) => {
      recordPageFailure(correlationId, "/readings/[spreadId]", cause);
    },
  });

  if (view.kind === "signed-out") {
    return (
      <main id="main" className="mx-auto max-w-xl p-10">
        <p className="text-sm">Sign in to open a saved reading.</p>
      </main>
    );
  }

  if (view.kind === "unconfigured") {
    return (
      <main id="main" className="p-10 text-sm">
        History is not configured.
      </main>
    );
  }

  if (view.kind === "error") {
    return (
      <main id="main" className="mx-auto max-w-xl p-10">
        <p data-testid="reading-error" className="text-sm text-rose-300" role="alert">
          {view.message}
        </p>
        <Link className="mt-4 inline-block text-sm text-amber-100 underline" href="/readings">
          Back to list
        </Link>
      </main>
    );
  }

  if (view.kind === "missing") {
    return (
      <main id="main" className="mx-auto max-w-xl p-10">
        <p data-testid="reading-missing" className="text-sm text-[#e4e4e7]">
          This reading is not in your history.
        </p>
        <Link className="mt-4 inline-block text-sm text-amber-100 underline" href="/readings">
          Back to list
        </Link>
      </main>
    );
  }

  const { item } = view;

  return (
    <main id="main" className="mx-auto max-w-xl space-y-4 p-10">
      <h1 className="text-2xl font-semibold">Saved reading</h1>
      <p data-testid="reading-date" className="text-xs text-[#d4d4d8]">
        <time dateTime={item.createdAt}>{formatReadingDate(item.createdAt)}</time>
      </p>
      <blockquote
        data-testid="reading-question"
        className="border-l-2 border-violet-400 pl-3 text-sm text-amber-100"
      >
        {item.question}
      </blockquote>
      <ol data-testid="reading-cards" className="space-y-1 text-sm text-[#e4e4e7]">
        {item.cards.map((card) => (
          <li key={`${card.positionKey}-${card.cardId}`}>
            <span className="text-[#d4d4d8]">{positionLabel(card.positionKey)}:</span>{" "}
            {cardLabel(card.cardId)}
            {card.reversed ? " (reversed)" : ""}
          </li>
        ))}
      </ol>
      <p data-testid="reading-prediction" className="whitespace-pre-line text-sm text-[#e4e4e7]">
        {item.prediction}
      </p>
      <p className="text-xs text-[#d4d4d8]">
        AI-generated when interpretation is wired. Entertainment, not advice.
      </p>
      <Link className="text-sm text-amber-100 underline" href="/readings">
        Back to list
      </Link>
      <SoftDeleteButton spreadId={item.spreadId} />
    </main>
  );
}
