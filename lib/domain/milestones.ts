/**
 * Milestone catalog — §9.2 internal milestones and the §9.3 customer timeline.
 *
 * The blueprint keeps two views of the same journey deliberately separate:
 * operations sees 25 granular milestones including holds and internal handoffs,
 * while the customer sees a simplified 10-step timeline (BR-020).
 *
 * They are not two lists. There is one catalog, and each internal milestone
 * declares which customer step it advances — or null if it is internal detail
 * the customer never sees. Deriving the customer timeline from posted events
 * is therefore a pure function over this mapping, which is what stops the two
 * views drifting apart as milestones are added.
 */

/** Operational grouping, used to section the ops milestone board. */
export type MilestonePhase = "origin" | "transit" | "destination" | "delivery";

/** §9.3 — the ten steps a customer sees. */
export type CustomerStep =
  | "order_submitted"
  | "quotation_approved"
  | "booking_confirmed"
  | "cargo_collected"
  | "departed_origin"
  | "in_transit"
  | "arrived_destination"
  | "customs_processing"
  | "out_for_delivery"
  | "delivered";

export const customerSteps: readonly {
  readonly step: CustomerStep;
  readonly seq: number;
  readonly label: string;
}[] = [
  { step: "order_submitted", seq: 1, label: "Order Submitted" },
  { step: "quotation_approved", seq: 2, label: "Quotation Approved" },
  { step: "booking_confirmed", seq: 3, label: "Booking Confirmed" },
  { step: "cargo_collected", seq: 4, label: "Cargo Collected" },
  { step: "departed_origin", seq: 5, label: "Departed Origin" },
  { step: "in_transit", seq: 6, label: "In Transit" },
  { step: "arrived_destination", seq: 7, label: "Arrived at Destination" },
  { step: "customs_processing", seq: 8, label: "Customs Processing" },
  { step: "out_for_delivery", seq: 9, label: "Out for Delivery" },
  { step: "delivered", seq: 10, label: "Delivered" },
] as const;

export function customerStepLabel(step: CustomerStep): string {
  return customerSteps.find((s) => s.step === step)?.label ?? step;
}

export function customerStepSeq(step: CustomerStep): number {
  return customerSteps.find((s) => s.step === step)?.seq ?? 0;
}

/* -------------------------------------------------------------------------- */
/* §9.2 — Internal milestone catalog                                          */
/* -------------------------------------------------------------------------- */

export interface MilestoneDef {
  /** Stable code stored on tracking_events. Never renamed. */
  readonly code: string;
  /** §9.2 ordinal. Ordering aid only — real order comes from event_time. */
  readonly seq: number;
  readonly label: string;
  readonly phase: MilestonePhase;
  /** Customer step this advances, or null if internal-only. */
  readonly customerStep: CustomerStep | null;
  /**
   * Default visibility when an event is posted. §9.4 requires visibility to be
   * explicit rather than inferred from status, so this is only a default that
   * the posting user can override.
   */
  readonly defaultVisibility: "customer" | "internal" | "restricted";
  /** Represents a blocking condition — surfaces on dashboards (§19.1). */
  readonly isHold?: boolean;
}

export const milestoneCatalog: readonly MilestoneDef[] = [
  // ---- Origin -------------------------------------------------------------
  { code: "SUPPLIER_CONTACTED", seq: 1, label: "Supplier Contacted", phase: "origin", customerStep: null, defaultVisibility: "internal" },
  { code: "CARGO_READY_CONFIRMED", seq: 2, label: "Cargo Ready Confirmed", phase: "origin", customerStep: null, defaultVisibility: "internal" },
  { code: "PICKUP_SCHEDULED", seq: 3, label: "Pickup Scheduled", phase: "origin", customerStep: null, defaultVisibility: "customer" },
  { code: "CARGO_PICKED_UP", seq: 4, label: "Cargo Picked Up", phase: "origin", customerStep: "cargo_collected", defaultVisibility: "customer" },
  { code: "RECEIVED_ORIGIN_WAREHOUSE", seq: 5, label: "Received at Origin Warehouse", phase: "origin", customerStep: "cargo_collected", defaultVisibility: "customer" },
  { code: "CARGO_INSPECTED", seq: 6, label: "Cargo Inspected", phase: "origin", customerStep: null, defaultVisibility: "internal" },
  { code: "EXPORT_DOCS_COMPLETE", seq: 7, label: "Export Documents Complete", phase: "origin", customerStep: null, defaultVisibility: "internal" },
  { code: "EXPORT_CLEARANCE_SUBMITTED", seq: 8, label: "Export Clearance Submitted", phase: "origin", customerStep: null, defaultVisibility: "internal" },
  { code: "EXPORT_CLEARED", seq: 9, label: "Export Cleared", phase: "origin", customerStep: null, defaultVisibility: "customer" },
  { code: "DELIVERED_TO_CARRIER", seq: 10, label: "Delivered to Carrier", phase: "origin", customerStep: null, defaultVisibility: "internal" },

  // ---- Transit ------------------------------------------------------------
  { code: "LOADED", seq: 11, label: "Loaded", phase: "transit", customerStep: null, defaultVisibility: "internal" },
  { code: "DEPARTED_ORIGIN", seq: 12, label: "Departed Origin", phase: "transit", customerStep: "departed_origin", defaultVisibility: "customer" },
  { code: "TRANSSHIPMENT_ARRIVED", seq: 13, label: "Transshipment Arrived", phase: "transit", customerStep: "in_transit", defaultVisibility: "customer" },
  { code: "TRANSSHIPMENT_DEPARTED", seq: 14, label: "Transshipment Departed", phase: "transit", customerStep: "in_transit", defaultVisibility: "customer" },

  // ---- Destination --------------------------------------------------------
  // Arrival is the destination agent's first milestone, so it is grouped here
  // rather than with transit — otherwise an origin agent would be offered it.
  { code: "ARRIVED_DESTINATION", seq: 15, label: "Arrived Destination", phase: "destination", customerStep: "arrived_destination", defaultVisibility: "customer" },
  { code: "IMPORT_CLEARANCE_SUBMITTED", seq: 16, label: "Import Clearance Submitted", phase: "destination", customerStep: "customs_processing", defaultVisibility: "customer" },
  { code: "CUSTOMS_HOLD", seq: 17, label: "Customs Hold", phase: "destination", customerStep: "customs_processing", defaultVisibility: "customer", isHold: true },
  { code: "DUTIES_ASSESSED", seq: 18, label: "Duties Assessed", phase: "destination", customerStep: "customs_processing", defaultVisibility: "customer" },
  { code: "IMPORT_CLEARED", seq: 19, label: "Import Cleared", phase: "destination", customerStep: "customs_processing", defaultVisibility: "customer" },
  { code: "CARGO_RELEASED", seq: 20, label: "Cargo Released", phase: "destination", customerStep: "customs_processing", defaultVisibility: "customer" },
  { code: "RECEIVED_DESTINATION_WAREHOUSE", seq: 21, label: "Received at Destination Warehouse", phase: "destination", customerStep: null, defaultVisibility: "internal" },

  // ---- Delivery -----------------------------------------------------------
  { code: "DELIVERY_SCHEDULED", seq: 22, label: "Delivery Scheduled", phase: "delivery", customerStep: null, defaultVisibility: "customer" },
  { code: "OUT_FOR_DELIVERY", seq: 23, label: "Out for Delivery", phase: "delivery", customerStep: "out_for_delivery", defaultVisibility: "customer" },
  { code: "DELIVERED", seq: 24, label: "Delivered", phase: "delivery", customerStep: "delivered", defaultVisibility: "customer" },
  { code: "POD_ACCEPTED", seq: 25, label: "POD Accepted", phase: "delivery", customerStep: "delivered", defaultVisibility: "customer" },
] as const;

const byCode = new Map(milestoneCatalog.map((m) => [m.code, m]));

export function getMilestone(code: string): MilestoneDef | undefined {
  return byCode.get(code);
}

export function milestoneLabel(code: string): string {
  return byCode.get(code)?.label ?? code;
}

export function milestonesInPhase(phase: MilestonePhase): readonly MilestoneDef[] {
  return milestoneCatalog.filter((m) => m.phase === phase);
}

/* -------------------------------------------------------------------------- */
/* Deriving the customer timeline                                             */
/* -------------------------------------------------------------------------- */

/** Minimal shape needed to derive a timeline — matches tracking_events. */
export interface PostedEvent {
  readonly milestoneCode: string;
  readonly eventTime: string | Date;
  readonly visibility: "customer" | "internal" | "restricted";
}

/**
 * The first three customer steps come from the order, quotation and booking —
 * not from shipment milestones — so they are supplied separately.
 */
export interface CommercialTimestamps {
  readonly orderSubmittedAt?: string | Date | null;
  readonly quotationAcceptedAt?: string | Date | null;
  readonly bookingConfirmedAt?: string | Date | null;
}

export type StepState = "complete" | "current" | "pending";

export interface TimelineEntry {
  readonly step: CustomerStep;
  readonly seq: number;
  readonly label: string;
  readonly state: StepState;
  /** Earliest time this step was reached, if it has been. */
  readonly reachedAt: Date | null;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Build the ten-step customer timeline from posted events plus the commercial
 * timestamps.
 *
 * Rules, all from §9.3 and §9.4:
 *  - Only customer-visible events count. An internal or restricted event never
 *    advances the customer view, even if its milestone maps to a step.
 *  - A step is `complete` if reached; the furthest reached step is `current`
 *    unless it is the final step, in which case it is complete.
 *  - Earlier steps are backfilled as complete once a later one is reached —
 *    a shipment that has departed has necessarily been collected, and the
 *    customer should not see gaps caused by an unposted intermediate event.
 *  - `reachedAt` takes the earliest matching event time, so re-posting a
 *    milestone does not move a step later.
 */
export function deriveCustomerTimeline(
  events: readonly PostedEvent[],
  commercial: CommercialTimestamps = {},
): TimelineEntry[] {
  const reached = new Map<CustomerStep, Date>();

  const record = (step: CustomerStep, at: Date | null) => {
    if (!at) return;
    const existing = reached.get(step);
    if (!existing || at < existing) reached.set(step, at);
  };

  record("order_submitted", toDate(commercial.orderSubmittedAt));
  record("quotation_approved", toDate(commercial.quotationAcceptedAt));
  record("booking_confirmed", toDate(commercial.bookingConfirmedAt));

  for (const ev of events) {
    if (ev.visibility !== "customer") continue;
    const def = byCode.get(ev.milestoneCode);
    if (!def?.customerStep) continue;
    record(def.customerStep, toDate(ev.eventTime));
  }

  // Furthest step actually reached.
  let furthest = 0;
  for (const step of reached.keys()) {
    furthest = Math.max(furthest, customerStepSeq(step));
  }

  return customerSteps.map(({ step, seq, label }) => {
    const reachedAt = reached.get(step) ?? null;
    const isFinal = seq === customerSteps.length;

    // Backfill: everything before the furthest reached step is complete, so an
    // unposted intermediate milestone does not leave a gap in the customer view.
    let state: StepState = "pending";
    if (furthest > 0) {
      if (seq < furthest) state = "complete";
      else if (seq === furthest) state = isFinal ? "complete" : "current";
    }

    return { step, seq, label, state, reachedAt };
  });
}

/** The step a shipment is currently at, or null before anything is posted. */
export function currentCustomerStep(
  timeline: readonly TimelineEntry[],
): TimelineEntry | null {
  const current = timeline.find((t) => t.state === "current");
  if (current) return current;
  const completed = [...timeline].reverse().find((t) => t.state === "complete");
  return completed ?? null;
}

/* -------------------------------------------------------------------------- */
/* Assignment scope — which milestones a partner may post                     */
/* -------------------------------------------------------------------------- */

/** §13 / BR-013 — the operational roles a shipment assignment can carry. */
export type AssignmentRole =
  | "origin_agent"
  | "destination_agent"
  | "carrier"
  | "broker"
  | "transporter"
  | "warehouse"
  | "coordinator";

/**
 * Milestone phases each assignment role is responsible for.
 *
 * §3: the origin agent coordinates supplier, pickup, export handoff and
 * departure; the destination agent coordinates arrival, release, delivery and
 * POD. A destination agent has no business posting "Cargo Picked Up" at origin,
 * and the portal should not offer it — an agent posting outside their scope is
 * how milestone history stops being trustworthy.
 *
 * The Speedmax coordinator is deliberately unrestricted: they own the shipment
 * end to end and must be able to correct anything.
 */
const rolePhases: Record<AssignmentRole, readonly MilestonePhase[]> = {
  origin_agent: ["origin", "transit"],
  destination_agent: ["destination", "delivery"],
  carrier: ["transit"],
  broker: ["origin", "destination"],
  transporter: ["origin", "delivery"],
  warehouse: ["origin", "destination"],
  coordinator: ["origin", "transit", "destination", "delivery"],
};

/** Milestones a holder of `role` may post, in catalog order. */
export function milestonesForRole(role: AssignmentRole): readonly MilestoneDef[] {
  const phases = rolePhases[role] ?? [];
  return milestoneCatalog.filter((m) => phases.includes(m.phase));
}

/** Whether `role` may post `code`. Unknown codes fail closed. */
export function roleCanPostMilestone(
  role: AssignmentRole,
  code: string,
): boolean {
  const def = byCode.get(code);
  if (!def) return false;
  return (rolePhases[role] ?? []).includes(def.phase);
}

/**
 * Milestones that release a hold. A customs hold followed by clearance or
 * release is resolved, not active.
 */
const holdClearingCodes = new Set(["IMPORT_CLEARED", "CARGO_RELEASED"]);

/**
 * Whether the shipment is currently held (§19.1 dashboards).
 *
 * A hold is active only if no clearing milestone has been posted after it —
 * checking merely for the presence of a hold event would leave every shipment
 * that was ever held looking permanently stuck.
 */
export function hasActiveHold(events: readonly PostedEvent[]): boolean {
  let latestHold: number | null = null;
  let latestClear: number | null = null;

  for (const ev of events) {
    const at = toDate(ev.eventTime)?.getTime();
    if (at === undefined) continue;

    if (byCode.get(ev.milestoneCode)?.isHold) {
      latestHold = latestHold === null ? at : Math.max(latestHold, at);
    } else if (holdClearingCodes.has(ev.milestoneCode)) {
      latestClear = latestClear === null ? at : Math.max(latestClear, at);
    }
  }

  if (latestHold === null) return false;
  return latestClear === null || latestClear < latestHold;
}
