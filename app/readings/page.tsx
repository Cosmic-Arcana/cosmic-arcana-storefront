import { auth0 } from "../../lib/auth0";
import { fetchHistoryPage, historyBaseUrl, readingsView } from "../../lib/history";
import { resolveSpreadUserId } from "../../lib/spread-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved readings",
  robots: { index: false, follow: false },
};

export default async function ReadingsPage() {
  const session = await auth0.getSession().catch(() => null);
  const userId = resolveSpreadUserId(session?.user?.sub);

  if (!userId) {
    return (
      <main id="main" className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl font-semibold">Saved readings</h1>
        <p className="mt-3 text-sm text-[#e4e4e7]">Sign in to see readings stored for your account.</p>
        <a className="mt-6 inline-block rounded-md bg-violet-600 px-4 py-2 text-sm" href="/login">
          Sign in
        </a>
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

  let view;
  try {
    view = readingsView(await fetchHistoryPage(userId), null);
  } catch (cause) {
    view = readingsView(null, cause instanceof Error ? cause.message : "history failed");
  }

  return (
    <main id="main" className="mx-auto max-w-xl space-y-4 p-10">
      <h1 className="text-2xl font-semibold">Saved readings</h1>
      {view.kind === "empty" ? (
        <p data-testid="readings-empty" className="text-sm text-[#e4e4e7]">
          No saved readings yet. Ask on the reading page first.
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
              <a
                href={`/readings/${item.spreadId}`}
                className="block rounded-lg border border-violet-500/30 p-3 text-sm text-amber-100 underline-offset-4 hover:underline"
              >
                {item.createdAt || item.spreadId}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
