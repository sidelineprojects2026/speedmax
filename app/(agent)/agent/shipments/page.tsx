import type { Metadata } from "next";
import { Ship } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
import { AssignmentCard } from "@/components/agent/AssignmentCard";
import { getAgentSession } from "@/lib/agent/session";
import { listAssignments } from "@/lib/agent/queries";

export const metadata: Metadata = { title: "Active Shipments" };

export default async function ActiveShipmentsPage() {
  const session = await getAgentSession();
  const active = await listAssignments("active");

  const held = active.filter((a) => a.hasActiveHold);

  return (
    <>
      <PageHeader
        title="Active Shipments"
        description="Cargo currently in your hands. Post milestones as work completes — Speedmax and the customer see progress from what you record here."
      />

      <PageBody>
        {held.length > 0 && (
          <div className="mb-6 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
            <h2 className="font-semibold text-tone-danger-fg">
              {held.length} shipment{held.length === 1 ? " is" : "s are"} on hold
            </h2>
            <ul className="mt-1.5 space-y-1 text-sm text-tone-danger-fg/90">
              {held.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.shipmentNumber}</span> —{" "}
                  {a.customerName}
                </li>
              ))}
            </ul>
          </div>
        )}

        {active.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={Ship}
              title="No active shipments"
              description="Assignments move here from Upcoming once the cargo reaches your side of the movement."
            />
          </Panel>
        ) : (
          <ul className="space-y-4">
            {active.map((assignment) => (
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
