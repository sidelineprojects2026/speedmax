"use client";

import { useState } from "react";
import { Check, Plus, X, Lock } from "lucide-react";
import { buttonStyles } from "@/components/ui/layout";
import {
  milestonesForRole,
  type AssignmentRole,
  type MilestoneDef,
} from "@/lib/domain/milestones";

/**
 * Milestone posting board, scoped to the agent's assignment role.
 *
 * Only milestones the role is responsible for are offered — a destination agent
 * is not shown "Cargo Picked Up", because posting outside your scope is how a
 * milestone history stops being trustworthy. The same rule is enforced in the
 * database by `roleCanPostMilestone`; this is the UI half of it, not the whole
 * of it.
 *
 * Milestones already posted are shown as done with their time, so the board
 * doubles as a checklist of what the agent still owes.
 */
export function MilestoneBoard({
  role,
  posted,
  timezone,
  locale = "en-US",
}: {
  role: AssignmentRole;
  /** milestoneCode → ISO time of the posted event. */
  posted: Record<string, string>;
  timezone: string;
  locale?: string;
}) {
  const [selected, setSelected] = useState<MilestoneDef | null>(null);
  const available = milestonesForRole(role);

  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

  const byPhase = available.reduce<Record<string, MilestoneDef[]>>((acc, m) => {
    (acc[m.phase] ??= []).push(m);
    return acc;
  }, {});

  const phaseLabels: Record<string, string> = {
    origin: "Origin",
    transit: "Transit",
    destination: "Destination",
    delivery: "Delivery",
  };

  return (
    <>
      <div className="space-y-6">
        {Object.entries(byPhase).map(([phase, milestones]) => (
          <div key={phase}>
            <h3 className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
              {phaseLabels[phase] ?? phase}
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {milestones.map((milestone) => {
                const at = posted[milestone.code];
                const done = Boolean(at);

                return (
                  <li key={milestone.code}>
                    <button
                      type="button"
                      onClick={() => !done && setSelected(milestone)}
                      disabled={done}
                      className={`flex w-full items-start gap-3 rounded-sm border px-3.5 py-3 text-left transition-colors ${
                        done
                          ? "cursor-default border-tone-success-br bg-tone-success-bg"
                          : "border-slate-200 bg-white hover:border-steel-400 hover:bg-ice-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          done
                            ? "border-transparent bg-tone-success-fg text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {done ? (
                          <Check
                            className="size-3"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        ) : (
                          <Plus
                            className="size-3 text-slate-400"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-medium ${
                            done ? "text-tone-success-fg" : "text-slate-800"
                          }`}
                        >
                          {milestone.label}
                        </span>
                        <span
                          className={`tnum mt-0.5 block text-xs ${
                            done ? "text-tone-success-fg/80" : "text-slate-500"
                          }`}
                        >
                          {done ? fmt.format(new Date(at)) : "Not posted"}
                        </span>
                        {milestone.isHold && !done && (
                          <span className="mt-1 block text-xs text-tone-warning-fg">
                            Raises a hold
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 flex items-start gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Only milestones for your assigned role are shown. Events are
          append-only: once posted, an event is corrected by a superseding entry
          with a reason, never edited or deleted.
        </span>
      </p>

      {/* ---- Post dialog ---------------------------------------------------- */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-milestone-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
        >
          <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2
                  id="post-milestone-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Post {selected.label}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  This becomes part of the shipment&rsquo;s permanent history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label
                  htmlFor="event-time"
                  className="block text-sm font-medium text-slate-800"
                >
                  When it happened
                </label>
                <input
                  id="event-time"
                  type="datetime-local"
                  className="tnum mt-1.5 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  The actual event time, not the time you are recording it. Both
                  are kept.
                </p>
              </div>

              <div>
                <label
                  htmlFor="event-location"
                  className="block text-sm font-medium text-slate-800"
                >
                  Location
                </label>
                <input
                  id="event-location"
                  placeholder="e.g. Bureau of Customs, NAIA"
                  className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="event-notes"
                  className="block text-sm font-medium text-slate-800"
                >
                  Notes
                </label>
                <textarea
                  id="event-notes"
                  rows={3}
                  placeholder="Anything the coordinator or customer needs to know."
                  className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="rounded-sm bg-ice-50 p-3 text-sm text-slate-600">
                Customer visibility:{" "}
                <span className="font-medium text-slate-800">
                  {selected.defaultVisibility === "customer"
                    ? "visible to the customer"
                    : "internal only"}
                </span>
                . This is the default for {selected.label.toLowerCase()} and can
                be overridden by the coordinator.
              </div>

              <p className="rounded-sm bg-tone-warning-bg p-3 text-sm text-tone-warning-fg">
                Posting is disabled in demo mode — no database is connected, so
                nothing would be recorded.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={buttonStyles.secondary}
              >
                Cancel
              </button>
              <button type="button" disabled className={buttonStyles.accent}>
                Post milestone
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
