import { Check } from "lucide-react";
import type { TimelineEntry } from "@/lib/domain/milestones";

/**
 * The §9.3 customer tracking timeline.
 *
 * Renders whatever `deriveCustomerTimeline` produced — it makes no decisions
 * about which steps are reached, so the public track page and the signed-in
 * portal cannot disagree about a shipment's progress.
 */
export function Timeline({
  entries,
  locale = "en-US",
  timeZone,
}: {
  entries: readonly TimelineEntry[];
  locale?: string;
  timeZone?: string;
}) {
  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });

  return (
    <ol className="relative">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        const reached = entry.state !== "pending";

        return (
          <li key={entry.step} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Connector — drawn behind the marker, stopping at the last row. */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-px ${
                  entry.state === "complete" ? "bg-steel-400" : "bg-slate-200"
                }`}
              />
            )}

            <span
              className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                entry.state === "complete"
                  ? "border-steel-500 bg-steel-500 text-white"
                  : entry.state === "current"
                    ? "border-beacon-500 bg-white"
                    : "border-slate-200 bg-white"
              }`}
            >
              {entry.state === "complete" && (
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              )}
              {entry.state === "current" && (
                <span className="size-2 rounded-full bg-beacon-500" />
              )}
            </span>

            <div className="min-w-0 pt-0.5">
              <p
                className={`font-medium ${
                  reached ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {entry.label}
                {entry.state === "current" && (
                  <span className="ml-2 text-xs font-semibold tracking-wide text-beacon-600 uppercase">
                    Current
                  </span>
                )}
              </p>
              {/* The secondary line follows the step's state, not merely
                  whether a timestamp exists. A step reached by backfill — one
                  we know happened because a later milestone was posted, but
                  which has no event of its own — is complete, and labelling it
                  "Pending" under a tick would contradict the marker. */}
              {entry.reachedAt ? (
                <p className="tnum mt-1 text-sm text-slate-500">
                  {fmt.format(entry.reachedAt)}
                </p>
              ) : reached ? (
                <p className="mt-1 text-sm text-slate-400">
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">
                    Completed; no separate event recorded
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">Pending</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
