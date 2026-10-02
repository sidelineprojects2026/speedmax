"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Public tracking lookup (§9.3).
 *
 * Accepts a Speedmax shipment number, a house/master bill, or an AWB — a
 * customer typically has whichever reference the carrier or supplier gave them,
 * not necessarily ours, so the lookup resolves across all of them rather than
 * demanding one format.
 */
export function TrackForm({
  variant = "light",
  autoFocus = false,
}: {
  variant?: "light" | "dark";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [reference, setReference] = useState("");

  const dark = variant === "dark";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reference.trim();
    if (!trimmed) return;
    router.push(`/track?ref=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <label
        htmlFor="tracking-reference"
        className={`block text-xs font-semibold tracking-[0.14em] uppercase ${
          dark ? "text-steel-300" : "text-slate-500"
        }`}
      >
        Track a shipment
      </label>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className={`pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 ${
              dark ? "text-steel-400" : "text-slate-400"
            }`}
            aria-hidden="true"
          />
          <input
            id="tracking-reference"
            name="ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            autoFocus={autoFocus}
            placeholder="Shipment no., B/L, or AWB"
            aria-describedby="tracking-hint"
            className={`ref w-full rounded-sm border py-3 pr-4 pl-10 text-sm placeholder:font-sans ${
              dark
                ? "border-white/15 bg-white/5 text-white placeholder:text-steel-400"
                : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            }`}
          />
        </div>
        <button
          type="submit"
          className="rounded-sm bg-beacon-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-beacon-600"
        >
          Track
        </button>
      </div>

      <p
        id="tracking-hint"
        className={`mt-2.5 text-xs ${dark ? "text-steel-400" : "text-slate-500"}`}
      >
        Milestone visibility follows the shipment&rsquo;s customer timeline. Sign
        in to the portal for documents, invoices and full detail.
      </p>
    </form>
  );
}
