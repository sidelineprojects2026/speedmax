/**
 * Status registry — the single source of truth for every lifecycle in §21.
 *
 * The blueprint defines nine object lifecycles with ~50 statuses between them.
 * Each status is declared once here with its label, semantic tone, and the set
 * of statuses reachable from it. Components read this registry; they never
 * hard-code a colour, a label, or a transition rule.
 *
 * Reference: blueprint §7.3 (Shipping Order), §12.2 (Claims), §21 (full catalog).
 */

export type StatusTone =
  | "neutral"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "danger";

export interface StatusDef<S extends string> {
  /** Human label shown in the UI. */
  readonly label: string;
  /** Semantic tone — drives colour via the --color-tone-* tokens. */
  readonly tone: StatusTone;
  /** Statuses legally reachable from this one. Empty means terminal. */
  readonly next: readonly S[];
  /** Requires a logged reason to enter (§17.2). */
  readonly requiresReason?: boolean;
  /** May be shown on customer-facing surfaces. */
  readonly customerVisible?: boolean;
}

export interface Lifecycle<S extends string> {
  readonly name: string;
  readonly initial: S;
  readonly states: Readonly<Record<S, StatusDef<S>>>;
}

function lifecycle<S extends string>(
  name: string,
  initial: S,
  states: Readonly<Record<S, StatusDef<S>>>,
): Lifecycle<S> {
  return { name, initial, states };
}

/* -------------------------------------------------------------------------- */
/* Shipping Order — §7.3                                                      */
/* -------------------------------------------------------------------------- */

export type ShippingOrderStatus =
  | "draft"
  | "submitted"
  | "information_required"
  | "accepted_for_quotation"
  | "on_hold"
  | "rejected"
  | "cancelled"
  | "converted";

export const shippingOrderLifecycle = lifecycle<ShippingOrderStatus>(
  "Shipping Order",
  "draft",
  {
    draft: {
      label: "Draft",
      tone: "neutral",
      next: ["submitted", "cancelled"],
      customerVisible: true,
    },
    submitted: {
      label: "Submitted",
      tone: "info",
      next: [
        "information_required",
        "accepted_for_quotation",
        "rejected",
        "cancelled",
      ],
      customerVisible: true,
    },
    information_required: {
      label: "Information Required",
      tone: "warning",
      next: ["submitted", "cancelled"],
      requiresReason: true,
      customerVisible: true,
    },
    accepted_for_quotation: {
      label: "Accepted for Quotation",
      tone: "progress",
      next: ["on_hold", "converted", "cancelled"],
      customerVisible: true,
    },
    on_hold: {
      label: "On Hold",
      tone: "warning",
      next: ["accepted_for_quotation", "cancelled"],
      requiresReason: true,
      customerVisible: true,
    },
    rejected: {
      label: "Rejected",
      tone: "danger",
      next: [],
      requiresReason: true,
      customerVisible: true,
    },
    cancelled: {
      label: "Cancelled",
      tone: "neutral",
      next: [],
      requiresReason: true,
      customerVisible: true,
    },
    converted: {
      label: "Converted",
      tone: "success",
      next: [],
      customerVisible: true,
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Quotation — §21, §8.2                                                      */
/* -------------------------------------------------------------------------- */

export type QuotationStatus =
  | "draft"
  | "internal_approval"
  | "released"
  | "accepted"
  | "revision_requested"
  | "declined"
  | "expired"
  | "cancelled";

export const quotationLifecycle = lifecycle<QuotationStatus>(
  "Quotation",
  "draft",
  {
    draft: {
      label: "Draft",
      tone: "neutral",
      next: ["internal_approval", "cancelled"],
    },
    internal_approval: {
      label: "Internal Approval",
      tone: "progress",
      next: ["released", "draft", "cancelled"],
    },
    released: {
      label: "Released",
      tone: "info",
      next: ["accepted", "revision_requested", "declined", "expired", "cancelled"],
      customerVisible: true,
    },
    accepted: {
      label: "Accepted",
      tone: "success",
      next: [],
      customerVisible: true,
    },
    revision_requested: {
      label: "Revision Requested",
      tone: "warning",
      next: ["draft"],
      requiresReason: true,
      customerVisible: true,
    },
    declined: {
      label: "Declined",
      tone: "danger",
      next: [],
      requiresReason: true,
      customerVisible: true,
    },
    expired: {
      label: "Expired",
      tone: "neutral",
      next: [],
      customerVisible: true,
    },
    cancelled: {
      label: "Cancelled",
      tone: "neutral",
      next: [],
      requiresReason: true,
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Booking — §21, §8.3                                                        */
/* -------------------------------------------------------------------------- */

export type BookingStatus =
  | "awaiting_conditions"
  | "requested"
  | "confirmed"
  | "failed"
  | "rebooking_required"
  | "completed"
  | "cancelled";

export const bookingLifecycle = lifecycle<BookingStatus>(
  "Booking",
  "awaiting_conditions",
  {
    awaiting_conditions: {
      label: "Awaiting Conditions",
      tone: "neutral",
      next: ["requested", "cancelled"],
    },
    requested: {
      label: "Requested",
      tone: "progress",
      next: ["confirmed", "failed", "rebooking_required", "cancelled"],
    },
    confirmed: {
      label: "Confirmed",
      tone: "success",
      next: ["completed", "rebooking_required", "cancelled"],
      customerVisible: true,
    },
    failed: {
      label: "Failed",
      tone: "danger",
      next: ["rebooking_required", "cancelled"],
      requiresReason: true,
    },
    rebooking_required: {
      label: "Rebooking Required",
      tone: "warning",
      next: ["requested", "cancelled"],
      requiresReason: true,
    },
    completed: { label: "Completed", tone: "success", next: [] },
    cancelled: {
      label: "Cancelled",
      tone: "neutral",
      next: [],
      requiresReason: true,
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Shipment — §21                                                             */
/* -------------------------------------------------------------------------- */

export type ShipmentStatus =
  | "planned"
  | "booked"
  | "origin_processing"
  | "in_transit"
  | "destination_processing"
  | "out_for_delivery"
  | "delivery_failed"
  | "delivered"
  | "closed"
  | "cancelled";

export const shipmentLifecycle = lifecycle<ShipmentStatus>("Shipment", "planned", {
  planned: {
    label: "Planned",
    tone: "neutral",
    next: ["booked", "cancelled"],
    customerVisible: true,
  },
  booked: {
    label: "Booked",
    tone: "info",
    next: ["origin_processing", "cancelled"],
    customerVisible: true,
  },
  origin_processing: {
    label: "Origin Processing",
    tone: "progress",
    next: ["in_transit", "cancelled"],
    customerVisible: true,
  },
  in_transit: {
    label: "In Transit",
    tone: "progress",
    next: ["destination_processing"],
    customerVisible: true,
  },
  destination_processing: {
    label: "Destination Processing",
    tone: "progress",
    next: ["out_for_delivery"],
    customerVisible: true,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    tone: "progress",
    next: ["delivered", "delivery_failed"],
    customerVisible: true,
  },
  delivery_failed: {
    label: "Delivery Failed",
    tone: "danger",
    next: ["out_for_delivery", "delivered"],
    requiresReason: true,
    customerVisible: true,
  },
  delivered: {
    label: "Delivered",
    tone: "success",
    next: ["closed"],
    customerVisible: true,
  },
  closed: { label: "Closed", tone: "success", next: [], customerVisible: true },
  cancelled: {
    label: "Cancelled",
    tone: "neutral",
    next: [],
    requiresReason: true,
    customerVisible: true,
  },
});

/* -------------------------------------------------------------------------- */
/* Invoice — §21, §10.1                                                       */
/* -------------------------------------------------------------------------- */

export type InvoiceStatus =
  | "draft"
  | "for_approval"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "disputed"
  | "closed"
  | "reversed";

export const invoiceLifecycle = lifecycle<InvoiceStatus>("Invoice", "draft", {
  draft: { label: "Draft", tone: "neutral", next: ["for_approval"] },
  for_approval: {
    label: "For Approval",
    tone: "progress",
    next: ["issued", "draft"],
  },
  issued: {
    label: "Issued",
    tone: "info",
    next: ["partially_paid", "paid", "overdue", "disputed", "reversed"],
    customerVisible: true,
  },
  partially_paid: {
    label: "Partially Paid",
    tone: "progress",
    next: ["paid", "overdue", "disputed"],
    customerVisible: true,
  },
  paid: {
    label: "Paid",
    tone: "success",
    next: ["closed", "reversed"],
    customerVisible: true,
  },
  overdue: {
    label: "Overdue",
    tone: "danger",
    next: ["partially_paid", "paid", "disputed"],
    customerVisible: true,
  },
  disputed: {
    label: "Disputed",
    tone: "warning",
    next: ["issued", "partially_paid", "paid", "reversed"],
    requiresReason: true,
    customerVisible: true,
  },
  closed: { label: "Closed", tone: "success", next: [], customerVisible: true },
  reversed: {
    label: "Reversed",
    tone: "neutral",
    next: [],
    requiresReason: true,
    customerVisible: true,
  },
});

/* -------------------------------------------------------------------------- */
/* Vendor Bill — §21, §10.2                                                   */
/* -------------------------------------------------------------------------- */

export type VendorBillStatus =
  | "draft"
  | "verified"
  | "approved"
  | "partially_paid"
  | "paid"
  | "closed"
  | "reversed";

export const vendorBillLifecycle = lifecycle<VendorBillStatus>(
  "Vendor Bill",
  "draft",
  {
    draft: { label: "Draft", tone: "neutral", next: ["verified"] },
    verified: { label: "Verified", tone: "info", next: ["approved", "draft"] },
    approved: {
      label: "Approved",
      tone: "progress",
      next: ["partially_paid", "paid", "reversed"],
    },
    partially_paid: {
      label: "Partially Paid",
      tone: "progress",
      next: ["paid"],
    },
    paid: { label: "Paid", tone: "success", next: ["closed", "reversed"] },
    closed: { label: "Closed", tone: "success", next: [] },
    reversed: {
      label: "Reversed",
      tone: "neutral",
      next: [],
      requiresReason: true,
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Exception — §21, §12.1                                                     */
/* -------------------------------------------------------------------------- */

export type ExceptionStatus =
  | "open"
  | "assigned"
  | "investigating"
  | "action_required"
  | "resolved"
  | "closed"
  | "reopened";

export const exceptionLifecycle = lifecycle<ExceptionStatus>(
  "Exception",
  "open",
  {
    open: {
      label: "Open",
      tone: "danger",
      next: ["assigned", "closed"],
      customerVisible: true,
    },
    assigned: {
      label: "Assigned",
      tone: "warning",
      next: ["investigating", "action_required", "resolved"],
      customerVisible: true,
    },
    investigating: {
      label: "Investigating",
      tone: "progress",
      next: ["action_required", "resolved"],
      customerVisible: true,
    },
    action_required: {
      label: "Action Required",
      tone: "warning",
      next: ["investigating", "resolved"],
      customerVisible: true,
    },
    resolved: {
      label: "Resolved",
      tone: "success",
      next: ["closed", "reopened"],
      customerVisible: true,
    },
    closed: {
      label: "Closed",
      tone: "neutral",
      next: ["reopened"],
      customerVisible: true,
    },
    reopened: {
      label: "Reopened",
      tone: "warning",
      next: ["assigned", "investigating"],
      requiresReason: true,
      customerVisible: true,
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Claim — §12.2                                                              */
/* -------------------------------------------------------------------------- */

export type ClaimStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_info_required"
  | "negotiation"
  | "approved"
  | "rejected"
  | "settled"
  | "closed";

export const claimLifecycle = lifecycle<ClaimStatus>("Claim", "draft", {
  draft: {
    label: "Draft",
    tone: "neutral",
    next: ["submitted"],
    customerVisible: true,
  },
  submitted: {
    label: "Submitted",
    tone: "info",
    next: ["under_review"],
    customerVisible: true,
  },
  under_review: {
    label: "Under Review",
    tone: "progress",
    next: ["additional_info_required", "negotiation", "approved", "rejected"],
    customerVisible: true,
  },
  additional_info_required: {
    label: "Additional Information Required",
    tone: "warning",
    next: ["under_review"],
    customerVisible: true,
  },
  negotiation: {
    label: "Negotiation / Assessment",
    tone: "progress",
    next: ["approved", "rejected"],
    customerVisible: true,
  },
  approved: {
    label: "Approved",
    tone: "success",
    next: ["settled"],
    customerVisible: true,
  },
  rejected: {
    label: "Rejected",
    tone: "danger",
    next: ["closed"],
    requiresReason: true,
    customerVisible: true,
  },
  settled: {
    label: "Settled",
    tone: "success",
    next: ["closed"],
    customerVisible: true,
  },
  closed: {
    label: "Closed",
    tone: "neutral",
    next: [],
    customerVisible: true,
  },
});

/* -------------------------------------------------------------------------- */
/* Document — §21, §11.2                                                      */
/* -------------------------------------------------------------------------- */

export type DocumentStatus =
  | "uploaded"
  | "under_review"
  | "verified"
  | "rejected"
  | "expired"
  | "superseded";

export const documentLifecycle = lifecycle<DocumentStatus>(
  "Document",
  "uploaded",
  {
    uploaded: {
      label: "Uploaded",
      tone: "neutral",
      next: ["under_review"],
      customerVisible: true,
    },
    under_review: {
      label: "Under Review",
      tone: "progress",
      next: ["verified", "rejected"],
      customerVisible: true,
    },
    verified: {
      label: "Verified",
      tone: "success",
      next: ["expired", "superseded"],
      customerVisible: true,
    },
    rejected: {
      label: "Rejected",
      tone: "danger",
      next: ["uploaded"],
      requiresReason: true,
      customerVisible: true,
    },
    expired: {
      label: "Expired",
      tone: "warning",
      next: ["superseded"],
      customerVisible: true,
    },
    superseded: {
      label: "Superseded",
      tone: "neutral",
      next: [],
      customerVisible: true,
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Payment — §10.1                                                            */
/* Verification is separated from preparation by §13 segregation of duties.    */
/* -------------------------------------------------------------------------- */

export type PaymentStatus = "submitted" | "verified" | "rejected" | "reversed";

export const paymentLifecycle = lifecycle<PaymentStatus>("Payment", "submitted", {
  submitted: {
    label: "Submitted",
    tone: "progress",
    next: ["verified", "rejected"],
    customerVisible: true,
  },
  verified: {
    label: "Verified",
    tone: "success",
    next: ["reversed"],
    customerVisible: true,
  },
  rejected: {
    label: "Rejected",
    tone: "danger",
    next: ["submitted"],
    requiresReason: true,
    customerVisible: true,
  },
  reversed: {
    label: "Reversed",
    tone: "neutral",
    next: [],
    requiresReason: true,
    customerVisible: true,
  },
});

/* -------------------------------------------------------------------------- */
/* Registry + helpers                                                          */
/* -------------------------------------------------------------------------- */

export const lifecycles = {
  shipping_order: shippingOrderLifecycle,
  quotation: quotationLifecycle,
  booking: bookingLifecycle,
  shipment: shipmentLifecycle,
  invoice: invoiceLifecycle,
  vendor_bill: vendorBillLifecycle,
  exception: exceptionLifecycle,
  claim: claimLifecycle,
  document: documentLifecycle,
  payment: paymentLifecycle,
} as const;

export type LifecycleKey = keyof typeof lifecycles;

/** Look up a status definition. Returns undefined for unknown statuses. */
export function getStatus(
  key: LifecycleKey,
  status: string,
): StatusDef<string> | undefined {
  const states = lifecycles[key].states as Record<string, StatusDef<string>>;
  return states[status];
}

/** Label for a status, falling back to the raw value so the UI never blanks. */
export function statusLabel(key: LifecycleKey, status: string): string {
  return getStatus(key, status)?.label ?? status;
}

/** Tone for a status, defaulting to neutral. */
export function statusTone(key: LifecycleKey, status: string): StatusTone {
  return getStatus(key, status)?.tone ?? "neutral";
}

/**
 * Whether a transition is legal. Unknown statuses are never transitionable —
 * this is a guard, so it fails closed.
 */
export function canTransition(
  key: LifecycleKey,
  from: string,
  to: string,
): boolean {
  const def = getStatus(key, from);
  if (!def) return false;
  return (def.next as readonly string[]).includes(to);
}

/** Statuses reachable from `from`. Empty for terminal or unknown statuses. */
export function nextStatuses(key: LifecycleKey, from: string): readonly string[] {
  return getStatus(key, from)?.next ?? [];
}

/** Whether entering `to` requires a logged reason (§17.2). */
export function transitionRequiresReason(
  key: LifecycleKey,
  to: string,
): boolean {
  return getStatus(key, to)?.requiresReason === true;
}

/** Whether a status may be shown on customer-facing surfaces. */
export function isCustomerVisible(key: LifecycleKey, status: string): boolean {
  return getStatus(key, status)?.customerVisible === true;
}
