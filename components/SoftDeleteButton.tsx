"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SoftDeleteButton({ spreadId }: { spreadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/readings/${spreadId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`delete ${response.status}`);
      }
      router.push("/readings");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        data-testid="soft-delete"
        disabled={busy}
        onClick={() => void onDelete()}
        className="rounded-md border border-rose-300 px-4 py-2 text-sm text-rose-200"
      >
        {busy ? "Removing…" : "Remove from history"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
