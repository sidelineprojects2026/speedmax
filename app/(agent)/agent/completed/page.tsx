import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
import { AssignmentCard } from "@/components/agent/AssignmentCard";
import { getAgentSession } from "@/lib/agent/session";
import { listAssignments } from "@/lib/agent/queries";

export const metadata: Metadata = { title: "Completed" };

export default async function CompletedPage() {
  const session = await getAgentSession();
  const completed = await listAssignments("completed");

  return (
    <>
      <PageHeader
        title="Completed"
        description="Assignments you have finished. Records stay available for reference and settlement — nothing is deleted once a shipment closes."
      />

      <PageBody>
        {completed.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={Archive}
              title="Nothing completed yet"
              description="Assignments move here once delivery and proof of delivery are accepted."
            />
          </Panel>
        ) : (
          <ul className="space-y-4">
            {completed.map((assignment) => (
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
