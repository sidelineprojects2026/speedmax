import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, TriangleAlert } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
import { DateText, Ref } from "@/components/ui/data";
import { getAgentSession } from "@/lib/agent/session";
import { listTasks } from "@/lib/agent/queries";
import { milestoneLabel } from "@/lib/domain/milestones";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const session = await getAgentSession();
  const tasks = await listTasks();

  const overdue = tasks.filter((t) => t.isOverdue);
  const upcoming = tasks.filter((t) => !t.isOverdue);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Deliverables across all your live assignments, soonest first. Completing a task usually means posting the milestone it expects."
      />

      <PageBody>
        {tasks.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={CheckSquare}
              title="No open tasks"
              description="Everything issued with your current assignments is done."
            />
          </Panel>
        ) : (
          <div className="space-y-6">
            {overdue.length > 0 && (
              <Panel
                title={`Overdue (${overdue.length})`}
                description="Past their due date. These are the ones that hold a shipment up."
                padded={false}
              >
                <TaskList tasks={overdue} timezone={session.timezone} overdue />
              </Panel>
            )}

            <Panel
              title={`Open (${upcoming.length})`}
              padded={false}
            >
              {upcoming.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  Nothing else outstanding.
                </p>
              ) : (
                <TaskList tasks={upcoming} timezone={session.timezone} />
              )}
            </Panel>
          </div>
        )}
      </PageBody>
    </>
  );
}

function TaskList({
  tasks,
  timezone,
  overdue = false,
}: {
  tasks: Awaited<ReturnType<typeof listTasks>>;
  timezone: string;
  overdue?: boolean;
}) {
  return (
    <ul className="divide-y divide-slate-150">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={`px-5 py-4 ${overdue ? "border-l-4 border-l-tone-danger-br bg-tone-danger-bg/25" : ""}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="font-medium text-slate-900">{task.title}</p>
                {task.isOverdue && (
                  <span className="flex items-center gap-1 rounded-sm bg-tone-danger-bg px-2 py-0.5 text-xs font-medium text-tone-danger-fg">
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    Overdue
                  </span>
                )}
              </div>

              {task.detail && (
                <p className="mt-1 text-sm text-slate-600">{task.detail}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <Link
                  href={`/agent/assignments/${task.assignmentId}`}
                  className="text-steel-600 hover:text-navy-900"
                >
                  <Ref>{task.shipmentNumber}</Ref>
                </Link>
                <span>{task.customerName}</span>
                {task.milestoneCode && (
                  <span>
                    Posts milestone:{" "}
                    <span className="font-medium text-slate-600">
                      {milestoneLabel(task.milestoneCode)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xs text-slate-500">Due</p>
              <p className="mt-0.5 text-sm text-slate-800">
                <DateText value={task.dueAt} timeZone={timezone} withTime />
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
