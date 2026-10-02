import "server-only";

/**
 * Agent portal data access.
 *
 * Scoped by assignment throughout: every read starts from the assignments this
 * partner organisation holds, so there is no path to a shipment they were not
 * given. When RLS takes over, the policy joins `assignments` in exactly the
 * same way.
 */

import { readStore } from "@/lib/store/db";
import type { StoreData } from "@/lib/store/schema";

import { getAgentSession } from "./session";
import {
  assignedShipmentIds,
  projectAgentDocument,
  projectAgentExpense,
  projectAssignment,
} from "./project";

import type {
  AgentAssignment,
  AgentDocument,
  AgentExpense,
  AssignmentStage,
  AssignmentTask,
} from "./types";

import { add, parseMoney, toDecimalString, zero } from "@/lib/domain/money";

async function scope(): Promise<{ data: StoreData; orgId: string }> {
  const [data, session] = await Promise.all([readStore(), getAgentSession()]);
  return { data, orgId: session.organizationId };
}

function byDateAsc<T>(pick: (item: T) => string | null) {
  return (a: T, b: T) => {
    const av = pick(a);
    const bv = pick(b);
    if (av === bv) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return av < bv ? -1 : 1;
  };
}

function byDateDesc<T>(pick: (item: T) => string | null) {
  return (a: T, b: T) => -byDateAsc(pick)(a, b);
}

/* -------------------------------------------------------------------------- */
/* Assignments                                                                */
/* -------------------------------------------------------------------------- */

export async function listAssignments(
  stage?: AssignmentStage,
): Promise<AgentAssignment[]> {
  const { data, orgId } = await scope();

  const projected = data.assignments
    .filter((a) => a.organizationId === orgId)
    .map((a) => projectAssignment(data, a))
    .filter((a): a is AgentAssignment => a !== null);

  const filtered = stage ? projected.filter((a) => a.stage === stage) : projected;
  // Soonest deadline first — an agent's queue is driven by what is due next.
  return filtered.sort(byDateAsc((a) => a.dueAt));
}

export async function getAssignment(id: string): Promise<AgentAssignment | null> {
  const { data, orgId } = await scope();
  const assignment = data.assignments.find(
    (a) => a.id === id && a.organizationId === orgId,
  );
  return assignment ? projectAssignment(data, assignment) : null;
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export interface FlatTask extends AssignmentTask {
  readonly assignmentId: string;
  readonly shipmentNumber: string;
  readonly customerName: string;
  readonly isOverdue: boolean;
}

/**
 * Open tasks across live assignments, soonest first. Completed assignments are
 * excluded: their tasks are history, and mixing them into a work queue makes
 * the queue useless.
 */
export async function listTasks(
  includeCompleted = false,
  now = new Date(),
): Promise<FlatTask[]> {
  const assignments = await listAssignments();
  const flat: FlatTask[] = [];

  for (const assignment of assignments) {
    if (assignment.stage === "completed" && !includeCompleted) continue;
    for (const task of assignment.tasks) {
      if (task.completedAt && !includeCompleted) continue;
      flat.push({
        ...task,
        assignmentId: assignment.id,
        shipmentNumber: assignment.shipmentNumber,
        customerName: assignment.customerName,
        isOverdue:
          !task.completedAt &&
          task.dueAt !== null &&
          new Date(task.dueAt).getTime() < now.getTime(),
      });
    }
  }

  return flat.sort(byDateAsc((t) => t.dueAt));
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

export async function listAgentDocuments(): Promise<AgentDocument[]> {
  const { data, orgId } = await scope();
  const assigned = assignedShipmentIds(data, orgId);

  return data.documents
    .filter((d) => d.linkedType === "shipment" && assigned.has(d.linkedId))
    .map((d) => projectAgentDocument(data, d))
    .sort(byDateDesc((d) => d.uploadedAt));
}

export async function listDocumentsForShipment(
  shipmentId: string,
): Promise<AgentDocument[]> {
  const all = await listAgentDocuments();
  return all.filter((d) => d.shipmentId === shipmentId);
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export async function listExpenses(): Promise<AgentExpense[]> {
  const { data, orgId } = await scope();
  return data.expenses
    .filter((e) => e.organizationId === orgId)
    .map((e) => projectAgentExpense(data, e))
    .sort(byDateDesc((e) => e.incurredOn));
}

export async function listExpensesForShipment(
  shipmentId: string,
): Promise<AgentExpense[]> {
  const all = await listExpenses();
  return all.filter((e) => e.shipmentId === shipmentId);
}

export interface ExpenseTotals {
  readonly draft: string;
  readonly awaitingSettlement: string;
  readonly settled: string;
  readonly currency: string;
}

/**
 * Expense position by stage.
 *
 * Reversed expenses are excluded from every bucket rather than netted off: a
 * reversal is a correction, and folding it into "settled" would misstate both
 * what the agent is owed and what they have been paid.
 */
export async function expenseTotals(currency: string): Promise<ExpenseTotals> {
  const list = await listExpenses();

  const sumWhere = (pred: (e: AgentExpense) => boolean) =>
    toDecimalString(
      list
        .filter(
          (e) => e.currency === currency && e.status !== "reversed" && pred(e),
        )
        .reduce((acc, e) => add(acc, parseMoney(e.amount, currency)), zero(currency)),
    );

  return {
    draft: sumWhere((e) => e.status === "draft"),
    awaitingSettlement: sumWhere((e) =>
      ["verified", "approved", "partially_paid"].includes(e.status),
    ),
    settled: sumWhere((e) => ["paid", "closed"].includes(e.status)),
    currency,
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface AgentActionItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly urgency: "high" | "medium" | "low";
  readonly dueLabel: string | null;
}

/**
 * §19.1 — what the agent must act on, ordered by risk then deadline. Covers the
 * four things that actually stall partner work: an unacknowledged assignment,
 * an exception needing action, an imminent or overdue task, and a document
 * Speedmax has returned.
 */
export async function listAgentActions(
  now = new Date(),
): Promise<AgentActionItem[]> {
  const items: AgentActionItem[] = [];
  const assignments = await listAssignments();
  const documents = await listAgentDocuments();

  const dayDiff = (iso: string) =>
    Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);

  for (const assignment of assignments) {
    if (assignment.stage === "completed") continue;

    if (!assignment.acknowledgedAt) {
      items.push({
        id: `ack-${assignment.id}`,
        title: `Assignment ${assignment.shipmentNumber} not acknowledged`,
        detail: `${assignment.customerName} · ${assignment.originLabel} → ${assignment.destinationLabel}. Confirm scope, fee and due dates.`,
        href: `/agent/assignments/${assignment.id}`,
        urgency: "high",
        dueLabel: assignment.dueAt ? `Due ${assignment.dueAt.slice(0, 10)}` : null,
      });
    }

    for (const exc of assignment.exceptions) {
      if (exc.status === "resolved" || exc.status === "closed") continue;
      items.push({
        id: `exc-${exc.id}`,
        title: `${exc.exceptionNumber} — ${exc.type.toLowerCase()} exception needs action`,
        detail: exc.instruction,
        href: `/agent/assignments/${assignment.id}`,
        urgency:
          exc.severity === "critical" || exc.severity === "high" ? "high" : "medium",
        dueLabel: exc.targetResolutionAt
          ? `Target ${exc.targetResolutionAt.slice(0, 10)}`
          : null,
      });
    }

    for (const task of assignment.tasks) {
      if (task.completedAt || !task.dueAt) continue;
      const days = dayDiff(task.dueAt);
      if (days > 3) continue; // Not yet pressing.
      items.push({
        id: `task-${task.id}`,
        title: task.title,
        detail: `${assignment.shipmentNumber} · ${assignment.customerName}${
          task.detail ? ` — ${task.detail}` : ""
        }`,
        href: `/agent/assignments/${assignment.id}`,
        urgency: days < 0 ? "high" : "medium",
        dueLabel:
          days < 0
            ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
            : days === 0
              ? "Due today"
              : `Due in ${days} day${days === 1 ? "" : "s"}`,
      });
    }
  }

  for (const doc of documents) {
    if (doc.status !== "rejected") continue;
    items.push({
      id: `doc-${doc.id}`,
      title: `${doc.name} was rejected`,
      detail: doc.rejectionReason ?? "A replacement document is required.",
      href: "/agent/documents",
      urgency: "medium",
      dueLabel: null,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return items.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}
