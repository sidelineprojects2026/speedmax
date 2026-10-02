import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  TriangleAlert,
  Upload,
  Plus,
  Mail,
} from "lucide-react";
import { PageBody, PageHeader, Panel, buttonStyles } from "@/components/ui/layout";
import {
  DateText,
  Definition,
  DefinitionList,
  Money,
  Ref,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Value,
} from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MilestoneBoard } from "@/components/agent/MilestoneBoard";
import { roleLabels } from "@/components/agent/AssignmentCard";
import { getAgentSession } from "@/lib/agent/session";
import {
  getAssignment,
  listDocumentsForShipment,
  listExpensesForShipment,
} from "@/lib/agent/queries";
import { milestoneLabel } from "@/lib/domain/milestones";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const a = await getAssignment(id);
  return { title: a ? a.shipmentNumber : "Assignment" };
}

const modeLabels: Record<string, string> = {
  air: "Air",
  sea: "Ocean",
  road: "Road",
  rail: "Rail",
  courier: "Courier",
  warehouse_transfer: "Warehouse transfer",
  other: "Other",
};

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAgentSession();
  const assignment = await getAssignment(id);
  if (!assignment) notFound();

  const [documents, expenses] = await Promise.all([
    listDocumentsForShipment(assignment.shipmentId),
    listExpensesForShipment(assignment.shipmentId),
  ]);

  // Milestone code → earliest posted time, for the board's done-state.
  const posted: Record<string, string> = {};
  for (const event of assignment.events) {
    if (event.isSuperseded) continue;
    const existing = posted[event.milestoneCode];
    if (!existing || event.eventTime < existing) {
      posted[event.milestoneCode] = event.eventTime;
    }
  }

  const openExceptions = assignment.exceptions.filter(
    (e) => e.status !== "resolved" && e.status !== "closed",
  );
  const openTasks = assignment.tasks.filter((t) => !t.completedAt);
  const doneTasks = assignment.tasks.filter((t) => t.completedAt);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "My Assignments", href: "/agent" },
          { label: assignment.shipmentNumber },
        ]}
        title={<Ref>{assignment.shipmentNumber}</Ref>}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-sm bg-ice-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {roleLabels[assignment.role] ?? assignment.role}
            </span>
            <StatusBadge lifecycle="shipment" status={assignment.status} />
            <span className="text-sm text-slate-500">
              {assignment.customerName} · {assignment.originLabel} →{" "}
              {assignment.destinationLabel} ·{" "}
              {modeLabels[assignment.mode] ?? assignment.mode}
            </span>
          </div>
        }
        actions={
          <>
            <button type="button" className={buttonStyles.secondary}>
              <Upload className="size-4" aria-hidden="true" />
              Upload document
            </button>
            <a
              href={`mailto:${assignment.coordinatorEmail}`}
              className={buttonStyles.secondary}
            >
              <Mail className="size-4" aria-hidden="true" />
              Message coordinator
            </a>
          </>
        }
      />

      <PageBody>
        {/* ---- Acknowledgement gate --------------------------------------- */}
        {!assignment.acknowledgedAt && (
          <div className="mb-6 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-5">
            <div className="flex gap-3">
              <CircleAlert
                className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-tone-danger-fg">
                  This assignment has not been acknowledged
                </h2>
                <p className="mt-1 text-sm text-tone-danger-fg/90">
                  Acknowledging confirms you accept the scope, deliverables, due
                  dates and fee below as issued. Until you do, Speedmax treats
                  the assignment as unconfirmed.
                </p>
                <button
                  type="button"
                  disabled
                  className={`${buttonStyles.accent} mt-4`}
                  title="Disabled until the database is connected"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Acknowledge assignment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- Open exceptions -------------------------------------------- */}
        {openExceptions.map((exc) => (
          <div
            key={exc.id}
            className="mb-6 flex gap-3 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4"
          >
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Ref className="font-semibold text-tone-danger-fg">
                  {exc.exceptionNumber}
                </Ref>
                <StatusBadge
                  lifecycle="exception"
                  status={exc.status}
                  size="sm"
                />
                <span className="text-xs text-tone-danger-fg/80 capitalize">
                  {exc.type} · {exc.severity} severity
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-tone-danger-fg/90">
                {exc.instruction}
              </p>
              {exc.targetResolutionAt && (
                <p className="mt-1.5 text-xs font-medium text-tone-danger-fg">
                  Target resolution:{" "}
                  <DateText
                    value={exc.targetResolutionAt}
                    timeZone={session.timezone}
                    withTime
                  />
                </p>
              )}
            </div>
          </div>
        ))}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            {/* ---- Milestone board ------------------------------------------ */}
            <Panel
              title="Post milestones"
              description={`Scoped to your role as ${(roleLabels[assignment.role] ?? assignment.role).toLowerCase()}.`}
            >
              <MilestoneBoard
                role={assignment.role}
                posted={posted}
                timezone={session.timezone}
                locale={session.locale}
              />
            </Panel>

            {/* ---- Tasks ---------------------------------------------------- */}
            <Panel
              title="Deliverables"
              description={`${openTasks.length} open, ${doneTasks.length} complete`}
              padded={false}
            >
              <ul className="divide-y divide-slate-150">
                {assignment.tasks.map((task) => (
                  <li key={task.id} className="flex gap-3.5 px-5 py-4">
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        task.completedAt
                          ? "border-transparent bg-tone-success-fg text-white"
                          : "border-slate-300"
                      }`}
                      aria-hidden="true"
                    >
                      {task.completedAt && (
                        <CheckCircle2 className="size-3" strokeWidth={3} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium ${
                          task.completedAt
                            ? "text-slate-500 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.detail && (
                        <p className="mt-1 text-sm text-slate-600">
                          {task.detail}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {task.dueAt && (
                          <span>
                            Due{" "}
                            <DateText
                              value={task.dueAt}
                              timeZone={session.timezone}
                              withTime
                            />
                          </span>
                        )}
                        {task.completedAt && (
                          <span className="text-tone-success-fg">
                            Completed{" "}
                            <DateText
                              value={task.completedAt}
                              timeZone={session.timezone}
                              withTime
                            />
                          </span>
                        )}
                        {task.milestoneCode && (
                          <span>
                            Posts:{" "}
                            <span className="font-medium">
                              {milestoneLabel(task.milestoneCode)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* ---- Event history -------------------------------------------- */}
            <Panel
              title="Event history"
              description="Append-only. Corrections supersede rather than overwrite (§9.4)."
              padded={false}
            >
              {assignment.events.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No events posted yet.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TH>Milestone</TH>
                    <TH>When</TH>
                    <TH>Location</TH>
                    <TH>Source</TH>
                    <TH>Posted by</TH>
                  </THead>
                  <TBody>
                    {[...assignment.events]
                      .sort((a, b) => (a.eventTime < b.eventTime ? 1 : -1))
                      .map((event) => (
                        <TR key={event.id}>
                          <TD>
                            <p className="font-medium text-slate-900">
                              {milestoneLabel(event.milestoneCode)}
                            </p>
                            {event.notes && (
                              <p className="mt-1 max-w-md text-xs text-slate-500">
                                {event.notes}
                              </p>
                            )}
                          </TD>
                          <TD>
                            <DateText
                              value={event.eventTime}
                              timeZone={session.timezone}
                              withTime
                            />
                          </TD>
                          <TD>
                            <Value>{event.locationText}</Value>
                          </TD>
                          <TD className="text-slate-500 capitalize">
                            {event.source.replace(/_/g, " ")}
                          </TD>
                          <TD>{event.postedByName}</TD>
                        </TR>
                      ))}
                  </TBody>
                </Table>
              )}
            </Panel>

            {/* ---- Expenses ------------------------------------------------- */}
            <Panel
              title="Expenses on this shipment"
              actions={
                <Link href="/agent/expenses" className={buttonStyles.quiet}>
                  <Plus className="size-4" aria-hidden="true" />
                  Record
                </Link>
              }
              padded={false}
            >
              {expenses.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No expenses recorded against this shipment.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TH>Reference</TH>
                    <TH>Description</TH>
                    <TH>Status</TH>
                    <TH align="right">Amount</TH>
                  </THead>
                  <TBody>
                    {expenses.map((expense) => (
                      <TR key={expense.id}>
                        <TD>
                          <Ref className="text-slate-800">
                            {expense.reference}
                          </Ref>
                        </TD>
                        <TD>{expense.description}</TD>
                        <TD>
                          <StatusBadge
                            lifecycle="vendor_bill"
                            status={expense.status}
                            size="sm"
                          />
                        </TD>
                        <TD align="right">
                          <Money
                            amount={expense.amount}
                            currency={expense.currency}
                            className={
                              expense.status === "reversed"
                                ? "text-slate-400 line-through"
                                : ""
                            }
                          />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Panel>
          </div>

          {/* ---- Sidebar ---------------------------------------------------- */}
          <div className="space-y-6">
            <Panel title="Your assignment">
              <DefinitionList columns={1}>
                <Definition label="Scope">
                  <p className="leading-relaxed">{assignment.instructions}</p>
                </Definition>
                <Definition label="Deliverables">
                  <ul className="space-y-1.5">
                    {assignment.deliverables.map((d) => (
                      <li key={d} className="flex gap-2 text-sm">
                        <span
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-steel-400"
                          aria-hidden="true"
                        />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </Definition>
                <Definition label="Your deadline">
                  <DateText
                    value={assignment.dueAt}
                    timeZone={session.timezone}
                    withTime
                  />
                </Definition>
                <Definition label="Your fee">
                  <Money
                    amount={assignment.agentFeeAmount}
                    currency={assignment.agentFeeCurrency ?? session.currency}
                    emphasis
                  />
                </Definition>
                <Definition label="Acknowledged">
                  {assignment.acknowledgedAt ? (
                    <DateText
                      value={assignment.acknowledgedAt}
                      timeZone={session.timezone}
                      withTime
                    />
                  ) : (
                    <span className="text-tone-danger-fg">Not yet</span>
                  )}
                </Definition>
                <Definition label="Speedmax coordinator">
                  {assignment.coordinatorName}
                  <a
                    href={`mailto:${assignment.coordinatorEmail}`}
                    className="mt-0.5 block text-sm text-steel-600 underline underline-offset-4"
                  >
                    {assignment.coordinatorEmail}
                  </a>
                </Definition>
              </DefinitionList>
            </Panel>

            <Panel title="Cargo and references">
              <DefinitionList columns={1}>
                <Definition label="Cargo">{assignment.cargoSummary}</Definition>
                {assignment.handlingFlags.length > 0 && (
                  <Definition label="Handling">
                    <ul className="flex flex-wrap gap-1.5">
                      {assignment.handlingFlags.map((flag) => (
                        <li
                          key={flag}
                          className="rounded-sm bg-tone-warning-bg px-2 py-0.5 text-xs font-medium text-tone-warning-fg"
                        >
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </Definition>
                )}
                <Definition label="Packages">
                  <span className="tnum">{assignment.packageCount}</span>
                </Definition>
                <Definition label="Gross weight">
                  <span className="tnum">
                    <Value>
                      {assignment.grossWeightKg
                        ? `${assignment.grossWeightKg} kg`
                        : null}
                    </Value>
                  </span>
                </Definition>
                <Definition label="Volume">
                  <span className="tnum">
                    <Value>
                      {assignment.volumeCbm ? `${assignment.volumeCbm} m³` : null}
                    </Value>
                  </span>
                </Definition>
                {assignment.vesselOrFlight && (
                  <Definition label="Vessel / flight">
                    <Ref>{assignment.vesselOrFlight}</Ref>
                  </Definition>
                )}
                {assignment.containerNumber && (
                  <Definition label="Container">
                    <Ref>{assignment.containerNumber}</Ref>
                  </Definition>
                )}
                {assignment.sealNumber && (
                  <Definition label="Seal">
                    <Ref>{assignment.sealNumber}</Ref>
                  </Definition>
                )}
                {assignment.houseBill && (
                  <Definition label="House bill">
                    <Ref>{assignment.houseBill}</Ref>
                  </Definition>
                )}
                {assignment.masterBill && (
                  <Definition label="Master bill">
                    <Ref>{assignment.masterBill}</Ref>
                  </Definition>
                )}
              </DefinitionList>
            </Panel>

            <Panel
              title="Documents"
              description={`${documents.length} on this shipment`}
              padded={false}
            >
              {documents.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  Nothing uploaded yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-150">
                  {documents.map((doc) => (
                    <li key={doc.id} className="px-5 py-3">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {doc.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          lifecycle="document"
                          status={doc.status}
                          size="sm"
                        />
                        <span className="text-xs text-slate-500">
                          {doc.typeName}
                        </span>
                      </div>
                      {doc.rejectionReason && (
                        <p className="mt-1.5 text-xs text-tone-danger-fg">
                          {doc.rejectionReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
