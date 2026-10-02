import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
import { AssignmentCard } from "@/components/agent/AssignmentCard";
import { getAgentSession } from "@/lib/agent/session";
import { listAssignments } from "@/lib/agent/queries";

export const metadata: Metadata = { title: "Upcoming" };

export default async function UpcomingPage() {
  const session = await getAgentSession();
  const upcoming = await listAssignments("upcoming");

  const unacknowledged = upcoming.filter((a) => !a.acknowledgedAt).length;

  return (
    <>
      <PageHeader
        title="Upcoming"
        description="Assignments issued to you where the cargo has not yet reached your side of the movement. Acknowledge the scope now so nothing stalls on arrival."
      />

      <PageBody>
        {unacknowledged > 0 && (
          <div className="mb-6 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
            <h2 className="font-semibold text-tone-danger-fg">
              {unacknowledged} assignment{unacknowledged === 1 ? "" : "s"} not yet
              acknowledged
            </h2>
            <p className="mt-1 text-sm text-tone-danger-fg/90">
              Acknowledging confirms you accept the scope, deliverables, due
              dates and fee as issued. Speedmax treats an unacknowledged
              assignment as unconfirmed and may reassign it.
            </p>
          </div>
        )}

        {upcoming.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={CalendarClock}
              title="Nothing upcoming"
              description="New assignments will appear here as Speedmax issues them."
            />
          </Panel>
        ) : (
          <ul className="space-y-4">
            {upcoming.map((assignment) => (
              <li key={assignment.id}>
                <AssignmentCard
                  assignment={assignment}
                  timezone={session.timezone}
                />
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
