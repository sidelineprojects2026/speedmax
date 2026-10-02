/**
 * Agent projection.
 *
 * Scoped by ASSIGNMENT, not by organisation — a partner works across many
 * customers and sees only the shipments assigned to them (§13, "only assigned
 * shipments and permitted fields").
 *
 * No customer pricing appears in any of these shapes. The agent sees their own
 * fee and their own expenses; what Speedmax charged the customer is not theirs
 * to know, and the types have no field for it.
 */

import type {
  AgentAssignment,
  AgentDocument,
  AgentEvent,
  AgentException,
  AgentExpense,
  AssignmentStage,
} from "./types";

import type {
  Assignment,
  Expense as StoreExpense,
  Shipment,
  StoreData,
  StoredDocument,
} from "@/lib/store/schema";

import { hasUnresolvedHold } from "@/lib/portal/project";

/**
 * Where an assignment sits in the agent's queue.
 *
 * Derived from the shipment's progress against the agent's role rather than
 * stored, so it cannot fall out of step: an origin agent is done once the cargo
 * has departed, while a destination agent's work only begins around then.
 */
export function stageFor(
  assignment: Assignment,
  shipment: Shipment,
): AssignmentStage {
  const status = shipment.status;

  if (status === "cancelled") return "completed";

  if (assignment.role === "origin_agent") {
    if (["planned", "booked"].includes(status)) return "upcoming";
    if (status === "origin_processing") return "active";
    return "completed";
  }

  // Destination-side roles, including brokers and final-mile transporters.
  if (["delivered", "closed"].includes(status)) return "completed";
  if (["destination_processing", "out_for_delivery", "delivery_failed"].includes(status)) {
    return "active";
  }
  return "upcoming";
}

function projectEvents(shipment: Shipment): AgentEvent[] {
  // Agents see the full operational history, including internal events — they
  // are the ones posting most of them. Superseded rows are kept so a correction
  // remains visible as a correction (§9.4).
  return shipment.events.map((e) => ({
    id: e.id,
    milestoneCode: e.milestoneCode,
    eventTime: e.eventTime,
    locationText: e.locationText,
    notes: e.notes,
    postedByName: e.postedByName,
    source: e.source,
    isSuperseded: e.isSuperseded,
  }));
}

function projectExceptions(
  data: StoreData,
  shipmentId: string,
): AgentException[] {
  return data.exceptions
    .filter((e) => e.shipmentId === shipmentId)
    .map((e) => ({
      id: e.id,
      exceptionNumber: e.exceptionNumber,
      status: e.status,
      severity: e.severity,
      type: e.type.charAt(0).toUpperCase() + e.type.slice(1),
      detectedAt: e.detectedAt,
      targetResolutionAt: e.targetResolutionAt,
      // The agent gets the internal instruction, not the customer wording —
      // §12.1 keeps the two apart and they say different things.
      instruction: e.internalNotes,
    }));
}

export function projectAssignment(
  data: StoreData,
  assignment: Assignment,
): AgentAssignment | null {
  const shipment = data.shipments.find((s) => s.id === assignment.shipmentId);
  if (!shipment) return null;

  const customer = data.organizations.find((o) => o.id === shipment.customerOrgId);
  const coordinator = data.profiles.find((p) => p.id === shipment.coordinatorId);

  // The leg carrying the references the agent needs — the last one with a bill
  // or container against it.
  const referenceLeg =
    [...shipment.legs]
      .reverse()
      .find((l) => l.houseBill || l.containerNumber || l.vesselOrFlight) ??
    shipment.legs[0];

  return {
    id: assignment.id,
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    customerName: customer?.legalName ?? shipment.customerOrgId,
    role: assignment.role,
    isPrimary: assignment.isPrimary,
    stage: stageFor(assignment, shipment),

    status: shipment.status,
    mode: shipment.mode,
    originLabel: shipment.originLabel,
    destinationLabel: shipment.destinationLabel,
    etaAt: shipment.etaAt,
    ataAt: shipment.ataAt,
    etdAt: shipment.etdAt,
    atdAt: shipment.atdAt,

    hasActiveHold: hasUnresolvedHold(shipment),
    coordinatorName: coordinator?.fullName ?? "—",
    coordinatorEmail: coordinator?.email ?? "operations@speedmax.example",

    instructions: assignment.instructions,
    deliverables: assignment.deliverables,
    dueAt: assignment.dueAt,
    agentFeeAmount: assignment.feeAmount,
    agentFeeCurrency: assignment.feeCurrency,
    acknowledgedAt: assignment.acknowledgedAt,

    cargoSummary: shipment.cargoSummary,
    packageCount: shipment.packageCount,
    grossWeightKg: shipment.grossWeightKg,
    volumeCbm: shipment.volumeCbm,
    handlingFlags: shipment.handlingFlags,

    containerNumber: referenceLeg?.containerNumber ?? null,
    sealNumber: referenceLeg?.sealNumber ?? null,
    houseBill: referenceLeg?.houseBill ?? null,
    masterBill: referenceLeg?.masterBill ?? null,
    vesselOrFlight: referenceLeg?.vesselOrFlight ?? null,

    tasks: assignment.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      detail: t.detail,
      dueAt: t.dueAt,
      completedAt: t.completedAt,
      milestoneCode: t.milestoneCode,
    })),
    events: projectEvents(shipment),
    exceptions: projectExceptions(data, shipment.id),
  };
}

export function projectAgentDocument(
  data: StoreData,
  doc: StoredDocument,
): AgentDocument {
  const current = doc.versions[doc.versions.length - 1];
  const shipment = data.shipments.find((s) => s.id === doc.linkedId);

  return {
    id: doc.id,
    name: doc.name,
    typeName: doc.typeName,
    status: doc.status,
    versionNo: current?.versionNo ?? 1,
    sizeBytes: current?.sizeBytes ?? 0,
    uploadedByName: current?.uploadedByName ?? "—",
    uploadedAt: current?.uploadedAt ?? doc.createdAt,
    shipmentId: doc.linkedId,
    shipmentNumber: shipment?.shipmentNumber ?? doc.linkedId,
    rejectionReason: doc.rejectionReason,
  };
}

export function projectAgentExpense(
  data: StoreData,
  expense: StoreExpense,
): AgentExpense {
  const shipment = data.shipments.find((s) => s.id === expense.shipmentId);
  return {
    id: expense.id,
    reference: expense.reference,
    shipmentId: expense.shipmentId,
    shipmentNumber: shipment?.shipmentNumber ?? expense.shipmentId,
    description: expense.description,
    chargeCode: expense.chargeCode,
    incurredOn: expense.incurredOn,
    amount: expense.amount,
    currency: expense.currency,
    status: expense.status,
    evidenceName: expense.evidenceName,
    submittedAt: expense.submittedAt,
    settledAt: expense.settledAt,
    rejectionReason: expense.rejectionReason,
  };
}

/** Shipment ids this partner is assigned to — the agent's whole visible world. */
export function assignedShipmentIds(
  data: StoreData,
  organizationId: string,
): Set<string> {
  return new Set(
    data.assignments
      .filter((a) => a.organizationId === organizationId)
      .map((a) => a.shipmentId),
  );
}
