/**
 * Agent portal data shapes.
 *
 * These mirror the same tables as the customer portal, but project a different
 * slice of them. Two differences are structural rather than cosmetic:
 *
 *   1. Scope is by ASSIGNMENT, not by owning organisation. An agent works
 *      across many customers and sees only the shipments assigned to them —
 *      §13, "only assigned shipments and permitted fields".
 *
 *   2. There is no customer pricing anywhere in these types. §13 restricts the
 *      agent role to "no customer billing or margin". The agent sees their own
 *      fee and their own recorded expenses; what Speedmax charged the customer
 *      is not theirs to know, and leaving the field out of the type means no
 *      component can render it by accident.
 */

import type {
  ShipmentStatus,
  DocumentStatus,
  ExceptionStatus,
} from "@/lib/domain/status";
import type { AssignmentRole } from "@/lib/domain/milestones";
import type { TransportMode } from "@/lib/portal/types";

export type { AssignmentRole };

/** Where an assignment sits in the agent's own work queue. */
export type AssignmentStage = "upcoming" | "active" | "completed";

export interface AssignmentTask {
  readonly id: string;
  readonly title: string;
  readonly detail: string | null;
  readonly dueAt: string | null;
  readonly completedAt: string | null;
  /** Milestone this task expects to be posted, if any. */
  readonly milestoneCode: string | null;
}

export interface AgentDocument {
  readonly id: string;
  readonly name: string;
  readonly typeName: string;
  readonly status: DocumentStatus;
  readonly versionNo: number;
  readonly sizeBytes: number;
  readonly uploadedByName: string;
  readonly uploadedAt: string;
  readonly shipmentId: string;
  readonly shipmentNumber: string;
  /** Set when Speedmax rejected the document and a replacement is needed. */
  readonly rejectionReason: string | null;
}

export interface AgentExpense {
  readonly id: string;
  readonly reference: string;
  readonly shipmentId: string;
  readonly shipmentNumber: string;
  readonly description: string;
  readonly chargeCode: string;
  readonly incurredOn: string;
  readonly amount: string;
  readonly currency: string;
  /** Vendor bill lifecycle — the agent's cost, never the customer's price. */
  readonly status:
    | "draft"
    | "verified"
    | "approved"
    | "partially_paid"
    | "paid"
    | "closed"
    | "reversed";
  readonly evidenceName: string | null;
  readonly submittedAt: string | null;
  readonly settledAt: string | null;
  readonly rejectionReason: string | null;
}

export interface AgentEvent {
  readonly id: string;
  readonly milestoneCode: string;
  readonly eventTime: string;
  readonly locationText: string | null;
  readonly notes: string | null;
  readonly postedByName: string;
  readonly source: "manual" | "partner" | "carrier_api" | "gps_iot" | "email_ingestion" | "batch_import";
  readonly isSuperseded: boolean;
}

export interface AgentException {
  readonly id: string;
  readonly exceptionNumber: string;
  readonly status: ExceptionStatus;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly type: string;
  readonly detectedAt: string;
  readonly targetResolutionAt: string | null;
  /** What the agent is being asked to do — internal, not the customer wording. */
  readonly instruction: string;
}

/**
 * One shipment as the assigned agent sees it.
 *
 * Note what is absent: no declared customer value, no quotation, no invoice, no
 * margin. The customer is named because an agent must know whose cargo they are
 * handling, but their commercial relationship with Speedmax is not exposed.
 */
export interface AgentAssignment {
  readonly id: string;
  readonly shipmentId: string;
  readonly shipmentNumber: string;
  readonly customerName: string;
  readonly role: AssignmentRole;
  readonly isPrimary: boolean;
  readonly stage: AssignmentStage;

  readonly status: ShipmentStatus;
  readonly mode: TransportMode;
  readonly originLabel: string;
  readonly destinationLabel: string;

  readonly etaAt: string | null;
  readonly ataAt: string | null;
  readonly etdAt: string | null;
  readonly atdAt: string | null;

  readonly hasActiveHold: boolean;
  readonly coordinatorName: string;
  readonly coordinatorEmail: string;

  /** Scope, deliverables and terms issued with the assignment (BR-014). */
  readonly instructions: string;
  readonly deliverables: readonly string[];
  readonly dueAt: string | null;
  readonly agentFeeAmount: string | null;
  readonly agentFeeCurrency: string | null;
  readonly acknowledgedAt: string | null;

  /** Cargo summary — enough to handle it, not the commercial detail. */
  readonly cargoSummary: string;
  readonly packageCount: number;
  readonly grossWeightKg: string | null;
  readonly volumeCbm: string | null;
  readonly handlingFlags: readonly string[];

  readonly containerNumber: string | null;
  readonly sealNumber: string | null;
  readonly houseBill: string | null;
  readonly masterBill: string | null;
  readonly vesselOrFlight: string | null;

  readonly tasks: readonly AssignmentTask[];
  readonly events: readonly AgentEvent[];
  readonly exceptions: readonly AgentException[];
}

/* -------------------------------------------------------------------------- */
/* Session                                                                    */
/* -------------------------------------------------------------------------- */

export type AgentUserRole = "agent_operator" | "agent_manager";
