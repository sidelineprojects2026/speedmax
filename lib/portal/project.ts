/**
 * Customer projection.
 *
 * Turns store records into the customer-facing shapes. Two rules are enforced
 * here and nowhere else, matching the RLS policies in
 * supabase/migrations/0004_orders_quotations.sql:
 *
 *  1. **Organisation scope.** Only records belonging to the caller's
 *     organisation are returned. Nothing is fetched broadly and narrowed later.
 *  2. **No internal cost.** `costAmount` is dropped when charges are mapped, so
 *     a customer-facing component has no cost field to leak (BR-008).
 *
 * These functions are pure — store data in, portal types out — so the boundary
 * can be asserted in tests rather than inspected in the UI (§24.1 #16).
 */

import type {
  Claim,
  CompanyProfile,
  DocumentRecord,
  ExceptionRecord,
  Invoice,
  MessageThread,
  Payment,
  Quotation,
  Shipment,
  ShippingOrder,
} from "./types";

import type {
  Claim as StoreClaim,
  ExceptionRecord as StoreException,
  Invoice as StoreInvoice,
  MessageThread as StoreThread,
  Payment as StorePayment,
  Quotation as StoreQuotation,
  Shipment as StoreShipment,
  ShippingOrder as StoreOrder,
  StoreData,
  StoredDocument,
} from "@/lib/store/schema";

import { invoiceTotals } from "@/lib/store/derive";

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export function projectOrder(data: StoreData, order: StoreOrder): ShippingOrder {
  const quotation = data.quotations.find((q) => q.orderId === order.id);
  const shipmentIds = data.shipments
    .filter((s) => s.orderIds.includes(order.id))
    .map((s) => s.id);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerReference: order.customerReference,
    requestDate: order.requestDate,
    mode: order.mode,
    serviceType: order.serviceType,
    priority: order.priority,
    requestedPickupDate: order.requestedPickupDate,
    requestedDeliveryDate: order.requestedDeliveryDate,
    insuranceRequested: order.insuranceRequested,
    supplierName: order.supplierName,
    originLabel: order.originLabel,
    destinationLabel: order.destinationLabel,
    incoterm: order.incoterm,
    incotermNamedPlace: order.incotermNamedPlace,
    declaredValue: order.declaredValue,
    declaredCurrency: order.declaredCurrency,
    specialInstructions: order.specialInstructions,
    requiresReview: order.requiresReview,
    reviewReason: order.reviewReason,
    statusReason: order.statusReason,
    submittedAt: order.submittedAt,
    createdAt: order.createdAt,
    items: order.items,
    packages: order.packages,
    quotationId: quotation?.id ?? null,
    shipmentIds,
  };
}

/* -------------------------------------------------------------------------- */
/* Quotations — the cost boundary                                             */
/* -------------------------------------------------------------------------- */

/**
 * Quotation statuses a customer may see. A draft or in-approval version is
 * internal work in progress and must not leak before release.
 */
const CUSTOMER_VISIBLE_QUOTE_STATUS = [
  "released",
  "accepted",
  "declined",
  "expired",
  "revision_requested",
];

export function isQuotationVisibleToCustomer(q: StoreQuotation): boolean {
  return CUSTOMER_VISIBLE_QUOTE_STATUS.includes(q.status);
}

export function projectQuotation(
  data: StoreData,
  quotation: StoreQuotation,
): Quotation {
  const order = data.orders.find((o) => o.id === quotation.orderId);

  return {
    id: quotation.id,
    quoteNumber: quotation.quoteNumber,
    status: quotation.status,
    versionNo: quotation.versionNo,
    orderId: quotation.orderId,
    orderNumber: order?.orderNumber ?? quotation.orderId,
    currency: quotation.currency,
    validFrom: quotation.validFrom,
    validUntil: quotation.validUntil,
    terms: quotation.terms,
    assumptions: quotation.assumptions,
    exclusions: quotation.exclusions,
    releasedAt: quotation.releasedAt,
    acceptance: quotation.acceptance
      ? {
          acceptedByName: quotation.acceptance.acceptedByName,
          acceptedAt: quotation.acceptance.acceptedAt,
          routeOptionId: quotation.acceptance.routeOptionId,
        }
      : null,
    routeOptions: quotation.routeOptions.map((option) => ({
      id: option.id,
      optionNo: option.optionNo,
      label: option.label,
      mode: option.mode,
      originLabel: option.originLabel,
      destinationLabel: option.destinationLabel,
      transitDaysMin: option.transitDaysMin,
      transitDaysMax: option.transitDaysMax,
      departureFrequency: option.departureFrequency,
      carrierName: option.carrierName,
      scheduleNote: option.scheduleNote,
      assumptions: option.assumptions,
      exclusions: option.exclusions,
      isRecommended: option.isRecommended,
      // BR-008 — cost is dropped here. The customer charge type has no field
      // for it, so this is the single narrowing point and a leak would be a
      // type error rather than a silent disclosure.
      charges: option.charges.map((c) => ({
        id: c.id,
        group: c.group,
        description: c.description,
        quantity: c.quantity,
        sellAmount: c.sellAmount,
        currency: c.currency,
        isTaxable: c.isTaxable,
        taxRatePct: c.taxRatePct,
      })),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Shipments                                                                  */
/* -------------------------------------------------------------------------- */

export function projectShipment(
  data: StoreData,
  shipment: StoreShipment,
): Shipment {
  const orderNumbers = shipment.orderIds
    .map((id) => data.orders.find((o) => o.id === id)?.orderNumber)
    .filter((n): n is string => Boolean(n));

  const coordinator = data.profiles.find((p) => p.id === shipment.coordinatorId);

  // Earliest submission and acceptance across the linked orders drive the first
  // three steps of the §9.3 timeline.
  const orderSubmittedAt = shipment.orderIds
    .map((id) => data.orders.find((o) => o.id === id)?.submittedAt)
    .filter((v): v is string => Boolean(v))
    .sort()[0] ?? null;

  const quotationAcceptedAt = shipment.orderIds
    .flatMap((id) => data.quotations.filter((q) => q.orderId === id))
    .map((q) => q.acceptance?.acceptedAt)
    .filter((v): v is string => Boolean(v))
    .sort()[0] ?? null;

  const activeHold = hasUnresolvedHold(shipment);

  return {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    status: shipment.status,
    mode: shipment.mode,
    originLabel: shipment.originLabel,
    destinationLabel: shipment.destinationLabel,
    etdAt: shipment.etdAt,
    atdAt: shipment.atdAt,
    etaAt: shipment.etaAt,
    ataAt: shipment.ataAt,
    hasActiveHold: activeHold,
    coordinatorName: coordinator?.fullName ?? null,
    orderNumbers,
    bookingNumber: shipment.booking?.carrierBookingNumber ?? null,
    bookingConfirmedAt: shipment.booking?.confirmedAt ?? null,
    orderSubmittedAt,
    quotationAcceptedAt,
    // Customer-visible legs only; an internal leg stays internal.
    legs: shipment.legs
      .filter((l) => l.visibility === "customer")
      .map((l) => ({
        id: l.id,
        sequenceNo: l.sequenceNo,
        mode: l.mode,
        originLabel: l.originLabel,
        destinationLabel: l.destinationLabel,
        providerName: l.providerName,
        plannedDeparture: l.plannedDeparture,
        actualDeparture: l.actualDeparture,
        plannedArrival: l.plannedArrival,
        actualArrival: l.actualArrival,
        vesselOrFlight: l.vesselOrFlight,
        voyageNumber: l.voyageNumber,
        containerNumber: l.containerNumber,
        sealNumber: l.sealNumber,
        houseBill: l.houseBill,
        masterBill: l.masterBill,
      })),
    // Customer-visible, non-superseded events only (§9.4).
    events: shipment.events
      .filter((e) => e.visibility === "customer" && !e.isSuperseded)
      .map((e) => ({
        id: e.id,
        milestoneCode: e.milestoneCode,
        eventTime: e.eventTime,
        locationText: e.locationText,
        visibility: e.visibility,
        notes: e.notes,
      })),
    pod: shipment.pod
      ? {
          receiverName: shipment.pod.receiverName,
          deliveredAt: shipment.pod.deliveredAt,
          locationText: shipment.pod.locationText,
          quantityReceived: shipment.pod.quantityReceived,
          conditionNote: shipment.pod.conditionNote,
          exceptionResult: shipment.pod.exceptionResult,
        }
      : null,
  };
}

/** A hold is active only if no clearing milestone followed it. */
export function hasUnresolvedHold(shipment: StoreShipment): boolean {
  const live = shipment.events.filter((e) => !e.isSuperseded);
  const holds = live.filter((e) => e.milestoneCode === "CUSTOMS_HOLD");
  if (holds.length === 0) return false;
  const latestHold = holds.map((e) => e.eventTime).sort().at(-1)!;
  const cleared = live
    .filter((e) => ["IMPORT_CLEARED", "CARGO_RELEASED"].includes(e.milestoneCode))
    .map((e) => e.eventTime)
    .sort()
    .at(-1);
  return !cleared || cleared < latestHold;
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

export function projectDocument(
  data: StoreData,
  doc: StoredDocument,
): DocumentRecord {
  const current = doc.versions[doc.versions.length - 1];
  return {
    id: doc.id,
    name: doc.name,
    typeCode: doc.typeCode,
    typeName: doc.typeName,
    category: doc.category,
    status: doc.status,
    versionNo: current?.versionNo ?? 1,
    sizeBytes: current?.sizeBytes ?? 0,
    mimeType: current?.mimeType ?? "application/octet-stream",
    issueDate: doc.issueDate,
    expiryDate: doc.expiryDate,
    uploadedByName: current?.uploadedByName ?? "—",
    uploadedAt: current?.uploadedAt ?? doc.createdAt,
    linkedType: doc.linkedType,
    linkedId: doc.linkedId,
    linkedLabel: linkedLabel(data, doc),
  };
}

export function linkedLabel(data: StoreData, doc: StoredDocument): string {
  switch (doc.linkedType) {
    case "order":
      return data.orders.find((o) => o.id === doc.linkedId)?.orderNumber ?? doc.linkedId;
    case "shipment":
      return (
        data.shipments.find((s) => s.id === doc.linkedId)?.shipmentNumber ??
        doc.linkedId
      );
    case "invoice":
      return (
        data.invoices.find((i) => i.id === doc.linkedId)?.invoiceNumber ??
        doc.linkedId
      );
    case "claim":
      return data.claims.find((c) => c.id === doc.linkedId)?.claimNumber ?? doc.linkedId;
  }
}

/** Which records belong to an organisation, for document scoping. */
export function orgOwnsDocument(
  data: StoreData,
  doc: StoredDocument,
  organizationId: string,
): boolean {
  switch (doc.linkedType) {
    case "order":
      return data.orders.some(
        (o) => o.id === doc.linkedId && o.customerOrgId === organizationId,
      );
    case "shipment":
      return data.shipments.some(
        (s) => s.id === doc.linkedId && s.customerOrgId === organizationId,
      );
    case "invoice":
      return data.invoices.some(
        (i) => i.id === doc.linkedId && i.customerOrgId === organizationId,
      );
    case "claim":
      return data.claims.some(
        (c) => c.id === doc.linkedId && c.customerOrgId === organizationId,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Finance                                                                    */
/* -------------------------------------------------------------------------- */

export function projectInvoice(data: StoreData, invoice: StoreInvoice): Invoice {
  const totals = invoiceTotals(invoice, data.payments);
  const shipment = data.shipments.find((s) => s.id === invoice.shipmentId);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    status: invoice.status,
    shipmentNumber: shipment?.shipmentNumber ?? null,
    issueDate: invoice.issueDate ?? invoice.dueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    amountPaid: totals.amountPaid,
    balance: totals.balance,
    lines: invoice.lines.map((l) => ({
      id: l.id,
      description: l.description,
      chargeGroup: l.chargeGroup,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      taxRatePct: l.taxRatePct,
    })),
  };
}

export function projectPayment(data: StoreData, payment: StorePayment): Payment {
  return {
    id: payment.id,
    reference: payment.reference,
    status: payment.status,
    method: payment.method,
    paidAt: payment.paidAt,
    submittedAt: payment.submittedAt,
    verifiedAt: payment.verifiedAt,
    amount: payment.amount,
    currency: payment.currency,
    bankReference: payment.bankReference,
    evidenceName: payment.evidenceName,
    rejectionReason: payment.rejectionReason,
    allocations: payment.allocations.map((a) => ({
      invoiceId: a.invoiceId,
      invoiceNumber:
        data.invoices.find((i) => i.id === a.invoiceId)?.invoiceNumber ?? a.invoiceId,
      amount: a.amount,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export function projectClaim(data: StoreData, claim: StoreClaim): Claim {
  const shipment = data.shipments.find((s) => s.id === claim.shipmentId);
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    status: claim.status,
    shipmentNumber: shipment?.shipmentNumber ?? claim.shipmentId,
    basis: claim.basis,
    description: claim.description,
    claimedAmount: claim.claimedAmount,
    settledAmount: claim.settledAmount,
    currency: claim.currency,
    incidentDate: claim.incidentDate,
    submittedAt: claim.submittedAt,
    decisionNote: claim.decisionNote,
    documentIds: claim.documentIds,
  };
}

/**
 * §12.1 keeps the customer-visible statement apart from internal notes, and the
 * customer type has no field for the latter. The agent and ops projections read
 * `internalNotes` instead; the two never appear on the same screen.
 */
export function projectException(
  data: StoreData,
  exception: StoreException,
): ExceptionRecord {
  const shipment = data.shipments.find((s) => s.id === exception.shipmentId);
  const owner = data.profiles.find((p) => p.id === exception.ownerId);

  return {
    id: exception.id,
    exceptionNumber: exception.exceptionNumber,
    status: exception.status,
    type: exception.type,
    severity: exception.severity,
    shipmentNumber: shipment?.shipmentNumber ?? null,
    detectedAt: exception.detectedAt,
    targetResolutionAt: exception.targetResolutionAt,
    customerStatement: exception.customerStatement,
    ownerName: owner?.fullName ?? null,
  };
}

export function projectThread(
  data: StoreData,
  thread: StoreThread,
  viewerId: string,
): MessageThread {
  return {
    id: thread.id,
    subject: thread.subject,
    linkedType: thread.linkedType,
    linkedLabel: thread.linkedLabel,
    lastMessageAt: thread.updatedAt,
    unreadCount: thread.messages.filter(
      (m) => m.authorId !== viewerId && !m.readBy.includes(viewerId),
    ).length,
    messages: thread.messages.map((m) => ({
      id: m.id,
      authorName: m.authorName,
      authorSide: m.authorSide === "customer" ? "customer" : "speedmax",
      body: m.body,
      sentAt: m.sentAt,
      attachmentNames: m.attachmentNames,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Company                                                                    */
/* -------------------------------------------------------------------------- */

export function projectCompany(
  data: StoreData,
  organizationId: string,
): CompanyProfile {
  const org = data.organizations.find((o) => o.id === organizationId);

  return {
    id: organizationId,
    legalName: org?.legalName ?? organizationId,
    tradingName: org?.tradingName ?? null,
    registrationNo: org?.registrationNo ?? null,
    taxId: org?.taxId ?? null,
    countryCode: org?.countryCode ?? "—",
    website: org?.website ?? null,
    paymentTerms: org?.paymentTerms ?? null,
    creditLimit: org?.creditLimit ?? null,
    creditCurrency: org?.creditCurrency ?? null,
    addresses: data.addresses
      .filter((a) => a.organizationId === organizationId)
      .map((a) => ({
        id: a.id,
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        stateRegion: a.stateRegion,
        postalCode: a.postalCode,
        countryCode: a.countryCode,
        isPickup: a.isPickup,
        isDelivery: a.isDelivery,
        isBilling: a.isBilling,
      })),
    contacts: data.profiles
      .filter((p) => p.organizationId === organizationId)
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        phone: p.phone,
        jobTitle: p.jobTitle,
        role: p.role as CompanyProfile["contacts"][number]["role"],
        isActive: p.isActive,
      })),
  };
}
