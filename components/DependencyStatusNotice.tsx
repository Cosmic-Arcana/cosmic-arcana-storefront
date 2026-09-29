"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { DependenciesStatus } from "../lib/dependency-status";

const seenKey = (incidentId: string) => `ca-incident-${incidentId}`;

export function DependencyStatusNotice() {
  const titleId = useId();
  const [status, setStatus] = useState<DependenciesStatus | null>(null);
  const [dialog, setDialog] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/dependencies/status", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as DependenciesStatus;
      setStatus(body);
      const id = body.aiInterpretation.incidentId;
      if (body.aiInterpretation.state === "down" && id && !sessionStorage.getItem(seenKey(id))) {
        sessionStorage.setItem(seenKey(id), "1");
        if (!shown.current) {
          shown.current = true;
          setDialog(true);
        }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dialog) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDialog(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const down = status?.aiInterpretation.state === "down";
  const banner = down && !dialog;

  return (
    <>
      {banner ? (
        <p className="bg-amber-900/80 px-4 py-2 text-center text-sm text-amber-50" role="status">
          {status?.aiInterpretation.message}
        </p>
      ) : null}
      {dialog ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
        >
          <div className="max-w-md rounded-xl border border-amber-200 bg-[#160f24] p-6 text-[#f5f3ff]">
            <h2 id={titleId} className="text-lg font-semibold">
              Interpretations temporarily unavailable
            </h2>
            <p className="mt-3 text-sm leading-6">
              Cards can still be drawn. Interpretation may arrive later. This is not a live claim
              about provider names in the UI.
            </p>
            <button
              type="button"
              className="mt-6 rounded-md bg-amber-200 px-4 py-2 text-sm font-semibold text-[#0b0714]"
              onClick={() => setDialog(false)}
            >
              Keep the cards
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
