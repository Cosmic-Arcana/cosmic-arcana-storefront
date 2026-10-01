"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AskOutcome } from "../lib/ask-failure";
import { removeFailureMessage } from "../lib/remove-failure";

type Step = "idle" | "confirming" | "removing";

export function SoftDeleteButton({ spreadId }: { spreadId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  // A keyboard user who opens the question lands on the choice that destroys nothing.
  useEffect(() => {
    if (step === "confirming") {
      keepRef.current?.focus();
    }
  }, [step]);

  const onRemove = async () => {
    setStep("removing");
    setError(null);

    let outcome: AskOutcome | null;
    try {
      const response = await fetch(`/api/readings/${spreadId}`, { method: "DELETE" });
      outcome = { status: response.status, body: await response.json().catch(() => null) };
    } catch {
      outcome = null;
    }

    if (outcome && outcome.status >= 200 && outcome.status < 300) {
      router.push("/readings");
      router.refresh();
      return;
    }
    setStep("idle");
    setError(removeFailureMessage(outcome));
  };

  return (
    <div>
      {step === "idle" ? (
        <button
          type="button"
          data-testid="soft-delete"
          onClick={() => setStep("confirming")}
          className="rounded-md border border-rose-300 px-4 py-2 text-sm text-rose-200"
        >
          Remove from history
        </button>
      ) : (
        <div role="group" aria-label="Confirm removal" className="space-y-3">
          <p className="text-sm text-[#e4e4e7]">Remove this reading?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void onRemove()}
              disabled={step === "removing"}
              className="rounded-md border border-rose-300 px-4 py-2 text-sm text-rose-200 disabled:opacity-50"
            >
              {step === "removing" ? "Removing…" : "Yes, remove"}
            </button>
            <button
              ref={keepRef}
              type="button"
              onClick={() => setStep("idle")}
              disabled={step === "removing"}
              className="rounded-md border border-violet-400 px-4 py-2 text-sm text-[#f5f3ff] disabled:opacity-50"
            >
              Keep
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
