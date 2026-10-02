import Link from "next/link";
import { TriangleAlert, ArrowRight, CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DateText, Money, Ref } from "@/components/ui/data";
import type { AgentAssignment } from "@/lib/agent/types";

const modeLabels: Record<string, string> = {
  air: "Air",
  sea: "Ocean",
  road: "Road",
  rail: "Rail",
  courier: "Courier",
  warehouse_transfer: "Warehouse transfer",
  other: "Other",
};

export const roleLabels: Record<string, string> = {
  origin_agent: "Origin agent",
  destination_agent: "Destination agent",
  carrier: "Carrier",
  broker: "Broker",
  transporter: "Transporter",
  warehouse: "Warehouse",
  coordinator: "Coordinator",
};

/**
 * One assignment in a list.
 *
 * Leads with the shipment reference and the agent's own role, because a partner
 * handling both origin and destination work needs to know which hat they are
 * wearing before anything else on the card makes sense.
 */
export function AssignmentCard({
  assignment,
  timezone,
}: {
  assignment: AgentAssignment;
  timezone: string;
}) {
  const openTasks = assignment.tasks.filter((t) => !t.completedAt).length;
  const openExceptions = assignment.exceptions.filter(
    (e) => e.status !== "resolved" && e.status !== "closed",
  ).length;

  return (
    <Link
      href={`/agent/assignments/${assignment.id}`}
      className="group block rounded-sm border border-slate-200 bg-white p-5 transition-colors hover:border-steel-300"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Ref className="font-medium text-slate-900">
              {assignment.shipmentNumber}
            </Ref>
            <span className="rounded-sm bg-ice-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {roleLabels[assignment.role] ?? assignment.role}
            </span>
            <StatusBadge
              lifecycle="shipment"
              status={assignment.status}
              size="sm"
            />
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            {assignment.customerName}
          </p>
        </div>
        <ArrowRight
          className="mt-1 size-4 shrink-0 text-slate-300 transition-colors group-hover:text-steel-500"
          aria-hidden="true"
        />
      </div>

      <p className="mt-3 text-sm text-slate-700">
        {assignment.originLabel}
        <span className="mx-1.5 text-slate-400">→</span>
        {assignment.destinationLabel}
        <span className="ml-2 text-slate-500">
          · {modeLabels[assignment.mode] ?? assignment.mode}
        </span>
      </p>

      <p className="mt-1 text-sm text-slate-500">{assignment.cargoSummary}</p>

      {(assignment.hasActiveHold ||
        openExceptions > 0 ||
        !assignment.acknowledgedAt) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!assignment.acknowledgedAt && (
            <span className="flex items-center gap-1.5 rounded-sm bg-tone-danger-bg px-2 py-0.5 text-xs font-medium text-tone-danger-fg">
              <CircleAlert className="size-3" aria-hidden="true" />
              Not acknowledged
            </span>
          )}
          {assignment.hasActiveHold && (
            <span className="flex items-center gap-1.5 rounded-sm bg-tone-danger-bg px-2 py-0.5 text-xs font-medium text-tone-danger-fg">
              <TriangleAlert className="size-3" aria-hidden="true" />
              On hold
            </span>
          )}
          {openExceptions > 0 && (
            <span className="rounded-sm bg-tone-warning-bg px-2 py-0.5 text-xs font-medium text-tone-warning-fg">
              {openExceptions} open exception{openExceptions === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-150 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">
            {assignment.role === "origin_agent" ? "Departure" : "Arrival"}
          </dt>
          <dd className="mt-0.5 text-slate-800">
            <DateText
              value={
                assignment.role === "origin_agent"
                  ? (assignment.atdAt ?? assignment.etdAt)
                  : (assignment.ataAt ?? assignment.etaAt)
              }
              timeZone={timezone}
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Your deadline</dt>
          <dd className="mt-0.5 text-slate-800">
            <DateText value={assignment.dueAt} timeZone={timezone} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Open tasks</dt>
          <dd className="tnum mt-0.5 text-slate-800">{openTasks}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Your fee</dt>
          <dd className="mt-0.5 text-slate-800">
            <Money
              amount={assignment.agentFeeAmount}
              currency={assignment.agentFeeCurrency ?? "PHP"}
            />
          </dd>
        </div>
      </dl>
    </Link>
  );
}
