import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Ship,
  CheckSquare,
  Wallet,
} from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
import { Money } from "@/components/ui/data";
import { AssignmentCard } from "@/components/agent/AssignmentCard";
import { getAgentSession } from "@/lib/agent/session";
import {
  expenseTotals,
  listAgentActions,
  listAssignments,
  listTasks,
} from "@/lib/agent/queries";

export const metadata: Metadata = { title: "My Assignments" };

const urgencyStyles = {
  high: "border-l-tone-danger-br bg-tone-danger-bg/40",
  medium: "border-l-tone-warning-br bg-tone-warning-bg/30",
  low: "border-l-slate-300 bg-white",
} as const;

export default async function AgentDashboard() {
  const session = await getAgentSession();
  const [actions, active, upcoming, tasks, totals] = await Promise.all([
    listAgentActions(),
    listAssignments("active"),
    listAssignments("upcoming"),
    listTasks(),
    expenseTotals(session.currency),
  ]);

  const overdueTasks = tasks.filter((t) => t.isOverdue).length;
  const firstName = session.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description={
          actions.length > 0
            ? `${actions.length} item${actions.length === 1 ? "" : "s"} need your attention across ${active.length + upcoming.length} live assignment${active.length + upcoming.length === 1 ? "" : "s"}.`
            : "Nothing is waiting on you right now."
        }
      />

      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            icon={Ship}
            label="Active assignments"
            value={String(active.length)}
            href="/agent/shipments"
          />
          <Figure
            icon={ClipboardList}
            label="Upcoming"
            value={String(upcoming.length)}
            href="/agent/upcoming"
          />
          <Figure
            icon={CheckSquare}
            label="Open tasks"
            value={String(tasks.length)}
            href="/agent/tasks"
            tone={overdueTasks > 0 ? "danger" : "neutral"}
            note={overdueTasks > 0 ? `${overdueTasks} overdue` : undefined}
          />
          <Figure
            icon={Wallet}
            label="Awaiting settlement"
            value={
              <Money
                amount={totals.awaitingSettlement}
                currency={totals.currency}
              />
            }
            href="/agent/expenses"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Panel
            title="Needs your attention"
            description="Sorted by risk, then by deadline."
            padded={false}
          >
            {actions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing outstanding"
                description="Every assignment is acknowledged, no tasks are due within three days, and no documents have been returned."
              />
            ) : (
              <ul className="divide-y divide-slate-150">
                {actions.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`flex items-start gap-4 border-l-4 px-5 py-4 transition-colors hover:bg-ice-50 ${
                        urgencyStyles[item.urgency]
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {item.detail}
                        </p>
                        {item.dueLabel && (
                          <p className="mt-1.5 text-xs font-medium text-slate-500">
                            {item.dueLabel}
                          </p>
                        )}
                      </div>
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Active assignments"
            actions={
              <Link
                href="/agent/shipments"
                className="text-sm font-medium text-steel-600 hover:text-navy-900"
              >
                View all
              </Link>
            }
            padded={false}
          >
            {active.length === 0 ? (
              <EmptyState
                icon={Ship}
                title="No active assignments"
                description="Assignments appear here once the shipment reaches your side of the movement."
              />
            ) : (
              <ul className="divide-y divide-slate-150">
                {active.map((assignment) => (
                  <li key={assignment.id} className="p-4">
                    <AssignmentCard
                      assignment={assignment}
                      timezone={session.timezone}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  href,
  tone = "neutral",
  note,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: React.ReactNode;
  href: string;
  tone?: "neutral" | "danger";
  note?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-sm border border-slate-200 bg-white p-5 transition-colors hover:border-steel-300"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
          {label}
        </p>
        <Icon
          className={`size-4 ${tone === "danger" ? "text-tone-danger-fg" : "text-steel-500"}`}
          aria-hidden={true}
        />
      </div>
      <p className="tnum mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {note && (
        <p className="mt-1 text-xs font-medium text-tone-danger-fg">{note}</p>
      )}
    </Link>
  );
}
