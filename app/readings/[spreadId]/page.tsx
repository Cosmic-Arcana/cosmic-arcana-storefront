import Link from "next/link";

import { SoftDeleteButton } from "../../../components/SoftDeleteButton";
import { auth0 } from "../../../lib/auth0";
import { fetchHistoryPage, historyBaseUrl, resolveReadingDetail } from "../../../lib/history";
import { resolveSpreadUserId } from "../../../lib/spread-user";

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

  const view = await resolveReadingDetail({
    userId: resolveSpreadUserId(session?.user?.sub),
    spreadId,
    configured: Boolean(historyBaseUrl()),
    loadPage: fetchHistoryPage,
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
      <main id="main" className="p-10">
        <p data-testid="reading-error" className="text-sm text-rose-300" role="alert">
          {view.message}
        </p>
      </main>
    );
  }

  if (view.kind === "missing") {
    return (
      <main id="main" className="mx-auto max-w-xl p-10">
        <p data-testid="reading-missing" className="text-sm text-[#e4e4e7]">
          This reading is not in your history.
        </p>
      </main>
    );
  }

  const { item } = view;

  return (
    <main id="main" className="mx-auto max-w-xl space-y-4 p-10">
      <h1 className="text-2xl font-semibold">Saved reading</h1>
      <p className="text-xs text-[#d4d4d8]">{item.spreadId}</p>
      <p className="text-sm text-[#e4e4e7]" data-testid="reading-prediction">
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
