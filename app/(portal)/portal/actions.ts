"use server";

import { revalidatePath } from "next/cache";

import {
  appendAudit,
  newId,
  nextControlNumber,
  saveUpload,
  withStore,
} from "@/lib/store/db";
import { getSession } from "@/lib/portal/session";
import {
  ActionError,
  attempt,
  bool,
  decimalOrNull,
  nowIso,
  ok,
  requireAmount,
  requireFound,
  requirePermission,
  requireReason,
  requireText,
  requireTransition,
  str,
  type ActionResult,
} from "@/lib/actions/result";
import type { CargoItem, CargoPackage, ShippingOrder } from "@/lib/store/schema";
import { OPERATING_CURRENCY } from "@/lib/store/currency";

/**
 * Customer portal mutations.
 *
 * Each one runs the same guards before touching the store: permission, legal
 * status transition, and a recorded reason where §17.2 demands one. Ownership
 * is re-checked on the server for every record — a route parameter is a request,
 * not a fact.
 */

/** Refuse anything that is not this customer's own record. */
function assertOwn(orgId: string, recordOrgId: string, label: string): void {
  if (orgId !== recordOrgId) {
    throw new ActionError(`${label} does not belong to your organisation.`);
  }
}

function revalidatePortal(...extra: string[]): void {
  for (const p of ["/portal", ...extra]) revalidatePath(p);
  // Operations sees the same records from the other side.
  revalidatePath("/ops");
}

/* -------------------------------------------------------------------------- */
/* Shipping orders                                                            */
/* -------------------------------------------------------------------------- */

function readCargoLines(form: FormData): {
  items: CargoItem[];
  packages: CargoPackage[];
} {
  const items: CargoItem[] = [];
  const packages: CargoPackage[] = [];

  // Lines arrive as parallel arrays, one entry per row the client rendered.
  const descriptions = form.getAll("line_description").map(String);
  const hsCodes = form.getAll("line_hs_code").map(String);
  const origins = form.getAll("line_origin").map(String);
  const quantities = form.getAll("line_quantity").map(String);
  const uoms = form.getAll("line_uom").map(String);
  const unitValues = form.getAll("line_unit_value").map(String);
  const flags = form.getAll("line_flags").map(String);

  descriptions.forEach((description, i) => {
    if (!description.trim()) return;
    const lineNo = items.length + 1;
    const qty = Number(quantities[i] ?? "0");
    const unit = Number(unitValues[i] ?? "0");
    const flagSet = new Set((flags[i] ?? "").split(",").filter(Boolean));

    items.push({
      id: newId(),
      lineNo,
      description: description.trim(),
      category: flagSet.has("hazardous")
        ? "Dangerous goods"
        : flagSet.has("high_value")
          ? "High value"
          : "General cargo",
      hsCode: hsCodes[i]?.trim() || null,
      originCountry: origins[i]?.trim().toUpperCase() || null,
      quantity: Number.isFinite(qty) ? qty.toFixed(3) : "0.000",
      uom: uoms[i]?.trim() || "CTN",
      unitValue: Number.isFinite(unit) && unit > 0 ? unit.toFixed(4) : null,
      totalValue:
        Number.isFinite(qty) && Number.isFinite(unit) && qty > 0 && unit > 0
          ? (qty * unit).toFixed(2)
          : null,
      currency: OPERATING_CURRENCY,
      isFragile: flagSet.has("fragile"),
      isHazardous: flagSet.has("hazardous"),
      isOversized: flagSet.has("oversized"),
      isHighValue: flagSet.has("high_value"),
      isControlled: flagSet.has("controlled"),
      temperatureMinC: null,
      temperatureMaxC: null,
    });
  });

  const grossWeight = decimalOrNull(form, "gross_weight_kg", 3);
  const volume = decimalOrNull(form, "volume_cbm", 4);
  const packageCount = Number(str(form, "package_count") || "0");

  if (grossWeight || volume || packageCount > 0) {
    packages.push({
      id: newId(),
      lineNo: 1,
      packagingType: str(form, "packaging_type") || "CARTON",
      packageCount: Number.isFinite(packageCount) ? packageCount : 0,
      grossWeightKg: grossWeight,
      netWeightKg: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      volumeCbm: volume,
      marksAndNumbers: str(form, "marks") || null,
    });
  }

  return { items, packages };
}

/** BR-003 — special cargo is routed for qualified review before pricing. */
function reviewReasonFor(items: CargoItem[]): string | null {
  const reasons: string[] = [];
  if (items.some((i) => i.isHazardous)) reasons.push("dangerous goods");
  if (items.some((i) => i.isControlled)) reasons.push("controlled goods");
  if (items.some((i) => i.isHighValue)) reasons.push("high-value cargo");
  if (items.some((i) => i.isOversized)) reasons.push("oversized cargo");
  if (reasons.length === 0) return null;
  return `Flagged for qualified review before pricing: ${reasons.join(", ")} (BR-003).`;
}

export async function createOrder(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "shipping_order.create");

    const submitNow = str(form, "intent") === "submit";
    const { items, packages } = readCargoLines(form);

    if (submitNow) {
      requirePermission(session.role, "shipping_order.submit");
      requireText(str(form, "origin"), "Origin", "origin");
      requireText(str(form, "destination"), "Destination", "destination");
      if (items.length === 0) {
        throw new ActionError(
          "Add at least one cargo line before submitting.",
          "line_description",
        );
      }
    }

    const review = reviewReasonFor(items);

    const created = await withStore((data) => {
      const orderNumber = nextControlNumber(data, "order", "SO");
      const id = newId();
      const now = nowIso();

      const order: ShippingOrder = {
        id,
        orderNumber,
        status: submitNow ? "submitted" : "draft",
        customerOrgId: session.organizationId,
        requestorId: session.userId,
        customerReference: str(form, "customer_reference") || null,
        requestDate: now.slice(0, 10),
        mode: (str(form, "mode") || null) as ShippingOrder["mode"],
        serviceType: str(form, "service_type") || null,
        priority: (str(form, "priority") || "standard") as ShippingOrder["priority"],
        requestedPickupDate: str(form, "pickup_date") || null,
        requestedDeliveryDate: str(form, "delivery_date") || null,
        insuranceRequested: bool(form, "insurance"),
        supplierName: str(form, "supplier") || null,
        originLabel: str(form, "origin") || null,
        destinationLabel: str(form, "destination") || null,
        incoterm: str(form, "incoterm") || null,
        incotermNamedPlace: str(form, "incoterm_place") || null,
        declaredValue:
          items.reduce((sum, i) => sum + Number(i.totalValue ?? 0), 0).toFixed(2) ||
          null,
        declaredCurrency: "PHP",
        specialInstructions: str(form, "instructions") || null,
        requiresReview: review !== null,
        reviewReason: review,
        statusReason: null,
        submittedAt: submitNow ? now : null,
        reviewedById: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
        items,
        packages,
        sourceEnquiryId: null,
      };

      data.orders.unshift(order);

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: submitNow ? "shipping_order.submit" : "shipping_order.create",
        entityType: "shipping_order",
        entityId: id,
        entityLabel: orderNumber,
        after: { status: order.status },
      });

      return { id, orderNumber };
    });

    revalidatePortal("/portal/orders");
    // Deliberately not calling redirect() here: it signals by throwing, and the
    // surrounding attempt() would catch that and report a spurious failure.
    // The client navigates on success instead.
    return ok(
      submitNow
        ? `${created.orderNumber} submitted. Speedmax will review it and come back to you.`
        : `${created.orderNumber} saved as a draft.`,
      { id: created.id, reference: created.orderNumber },
    );
  });
}

/** Submit or resubmit an existing order. */
export async function submitOrder(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "shipping_order.submit");
    const orderId = requireText(str(form, "order_id"), "Order");

    const label = await withStore((data) => {
      const order = requireFound(
        data.orders.find((o) => o.id === orderId),
        "Order",
      );
      assertOwn(session.organizationId, order.customerOrgId, "This order");
      requireTransition("shipping_order", order.status, "submitted");

      if (order.items.length === 0) {
        throw new ActionError("Add at least one cargo line before submitting.");
      }
      if (!order.originLabel || !order.destinationLabel) {
        throw new ActionError("Origin and destination are required to submit.");
      }

      const before = order.status;
      order.status = "submitted";
      order.submittedAt = nowIso();
      order.statusReason = null;
      order.updatedAt = nowIso();

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "shipping_order.submit",
        entityType: "shipping_order",
        entityId: order.id,
        entityLabel: order.orderNumber,
        before: { status: before },
        after: { status: order.status },
      });

      return order.orderNumber;
    });

    revalidatePortal("/portal/orders", `/portal/orders/${orderId}`);
    return ok(`${label} submitted. Speedmax will review it and come back to you.`);
  });
}

export async function cancelOrder(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "shipping_order.cancel");
    const orderId = requireText(str(form, "order_id"), "Order");
    const reason = requireReason(str(form, "reason"));

    const label = await withStore((data) => {
      const order = requireFound(
        data.orders.find((o) => o.id === orderId),
        "Order",
      );
      assertOwn(session.organizationId, order.customerOrgId, "This order");
      requireTransition("shipping_order", order.status, "cancelled");

      const before = order.status;
      order.status = "cancelled";
      order.statusReason = reason;
      order.updatedAt = nowIso();

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "shipping_order.cancel",
        entityType: "shipping_order",
        entityId: order.id,
        entityLabel: order.orderNumber,
        reason,
        before: { status: before },
        after: { status: "cancelled" },
      });

      return order.orderNumber;
    });

    revalidatePortal("/portal/orders", `/portal/orders/${orderId}`);
    return ok(`${label} cancelled.`);
  });
}

/* -------------------------------------------------------------------------- */
/* Quotation acceptance — §8.2                                                */
/* -------------------------------------------------------------------------- */

/**
 * Accept a released quotation.
 *
 * Records identity, timestamp, accepted version and terms (§8.2), converts the
 * order, and creates the shipment with a booking that is *not* yet released —
 * §8.3 requires the six conditions to be confirmed first, which is operations'
 * job. Acceptance moves the work forward; it does not skip the gate.
 */
export async function acceptQuotation(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "quotation.accept");

    const quotationId = requireText(str(form, "quotation_id"), "Quotation");
    const routeOptionId = requireText(str(form, "route_option_id"), "Route option");
    if (!bool(form, "agreed")) {
      throw new ActionError(
        "Confirm you are authorised to accept on behalf of your company.",
        "agreed",
      );
    }

    const result = await withStore((data) => {
      const quotation = requireFound(
        data.quotations.find((q) => q.id === quotationId),
        "Quotation",
      );
      assertOwn(session.organizationId, quotation.customerOrgId, "This quotation");

      if (quotation.acceptance) {
        throw new ActionError("This quotation has already been accepted.");
      }
      requireTransition("quotation", quotation.status, "accepted");

      // §8.2 — an expired quotation cannot be accepted without revalidation.
      const today = nowIso().slice(0, 10);
      if (quotation.validUntil < today) {
        throw new ActionError(
          `This quotation expired on ${quotation.validUntil} and cannot be accepted without revalidation (§8.2).`,
        );
      }

      const option = requireFound(
        quotation.routeOptions.find((o) => o.id === routeOptionId),
        "Route option",
      );

      quotation.status = "accepted";
      quotation.updatedAt = nowIso();
      quotation.acceptance = {
        acceptedById: session.userId,
        acceptedByName: session.fullName,
        acceptedAt: nowIso(),
        routeOptionId,
        acceptedTerms: quotation.terms ?? "Speedmax standard trading conditions.",
        evidenceNote: null,
      };

      const order = requireFound(
        data.orders.find((o) => o.id === quotation.orderId),
        "Order",
      );
      order.status = "converted";
      order.updatedAt = nowIso();

      // Cost of the accepted option, kept for variance reporting later.
      const quotedCost = option.charges
        .reduce((sum, c) => sum + Number(c.costAmount), 0)
        .toFixed(2);

      const shipmentNumber = nextControlNumber(data, "shipment", "SHP");
      const shipmentId = newId();
      const packages = order.packages[0];

      data.shipments.unshift({
        id: shipmentId,
        shipmentNumber,
        status: "planned",
        customerOrgId: order.customerOrgId,
        mode: option.mode,
        originLabel: option.originLabel,
        destinationLabel: option.destinationLabel,
        etdAt: null,
        atdAt: null,
        etaAt: null,
        ataAt: null,
        coordinatorId: order.reviewedById,
        orderIds: [order.id],
        legs: [],
        events: [],
        pod: null,
        booking: {
          id: newId(),
          bookingRef: nextControlNumber(data, "booking", "BK"),
          status: "awaiting_conditions",
          carrierName: option.carrierName,
          carrierBookingNumber: null,
          cutoffAt: null,
          etdAt: null,
          etaAt: null,
          freeTimeDays: null,
          // Acceptance satisfies exactly one of the six §8.3 conditions.
          acceptanceConfirmed: true,
          paymentConditionMet: false,
          cargoReadyConfirmed: false,
          documentsReady: false,
          overrideById: null,
          overrideReason: null,
          rebookedFromId: null,
          failureReason: null,
          confirmedById: null,
          confirmedAt: null,
        },
        cargoSummary: order.items.map((i) => i.description).join("; ") || "—",
        packageCount: packages?.packageCount ?? 0,
        grossWeightKg: packages?.grossWeightKg ?? null,
        volumeCbm: packages?.volumeCbm ?? null,
        handlingFlags: [
          ...(order.items.some((i) => i.isHazardous) ? ["Dangerous goods"] : []),
          ...(order.items.some((i) => i.isHighValue) ? ["High value"] : []),
          ...(order.items.some((i) => i.isFragile) ? ["Fragile"] : []),
          ...(order.items.some((i) => i.isOversized) ? ["Oversized"] : []),
        ],
        quotedCost,
        internalDirectCost: "0.00",
        currency: quotation.currency,
        closedAt: null,
        closedById: null,
        statusReason: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "quotation.accept",
        entityType: "quotation",
        entityId: quotation.id,
        entityLabel: quotation.quoteNumber,
        after: {
          routeOption: option.label,
          version: quotation.versionNo,
          shipment: shipmentNumber,
        },
      });

      return { shipmentNumber, quoteNumber: quotation.quoteNumber };
    });

    revalidatePortal(
      "/portal/quotations",
      `/portal/quotations/${quotationId}`,
      "/portal/orders",
      "/portal/shipments",
    );
    revalidatePath("/ops/bookings");

    return ok(
      `${result.quoteNumber} accepted. Shipment ${result.shipmentNumber} created — Speedmax will confirm the booking once the remaining conditions are met.`,
      { reference: result.shipmentNumber },
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

export async function uploadDocument(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "document.upload");

    const linkedType = requireText(
      str(form, "linked_type"),
      "Linked record type",
    ) as "order" | "shipment" | "invoice" | "claim";
    const linkedId = requireText(str(form, "linked_id"), "Linked record");
    const typeCode = str(form, "type_code") || "OTHER";
    const typeName = str(form, "type_name") || "Document";

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ActionError("Choose a file to upload.", "file");
    }

    const stored = await saveUpload(file);

    const name = await withStore((data) => {
      // The linked record must belong to this customer.
      const owns =
        (linkedType === "order" &&
          data.orders.some(
            (o) => o.id === linkedId && o.customerOrgId === session.organizationId,
          )) ||
        (linkedType === "shipment" &&
          data.shipments.some(
            (s) => s.id === linkedId && s.customerOrgId === session.organizationId,
          )) ||
        (linkedType === "invoice" &&
          data.invoices.some(
            (i) => i.id === linkedId && i.customerOrgId === session.organizationId,
          )) ||
        (linkedType === "claim" &&
          data.claims.some(
            (c) => c.id === linkedId && c.customerOrgId === session.organizationId,
          ));
      if (!owns) {
        throw new ActionError("That record does not belong to your organisation.");
      }

      // §11.2 — replacing a document supersedes it rather than overwriting.
      const existing = data.documents.find(
        (d) =>
          d.linkedType === linkedType &&
          d.linkedId === linkedId &&
          d.typeCode === typeCode &&
          d.status !== "superseded",
      );

      const now = nowIso();

      if (existing) {
        existing.versions.push({
          versionNo: existing.versions.length + 1,
          fileName: stored.fileName,
          storedPath: stored.storedPath,
          sizeBytes: stored.sizeBytes,
          mimeType: stored.mimeType,
          uploadedById: session.userId,
          uploadedByName: session.fullName,
          uploadedAt: now,
        });
        existing.name = stored.fileName;
        existing.status = "under_review";
        existing.rejectionReason = null;
        existing.verifiedById = null;
        existing.verifiedAt = null;
        existing.updatedAt = now;

        appendAudit(data, {
          actorId: session.userId,
          actorName: session.fullName,
          action: "document.replace",
          entityType: "document",
          entityId: existing.id,
          entityLabel: existing.name,
          after: { version: existing.versions.length },
        });

        return existing.name;
      }

      const id = newId();
      data.documents.unshift({
        id,
        name: stored.fileName,
        typeCode,
        typeName,
        category: (str(form, "category") ||
          "commercial") as "commercial" | "transport" | "customs" | "cargo" | "finance" | "delivery" | "claim",
        status: "under_review",
        visibility: "customer",
        ownerOrgId: session.organizationId,
        linkedType,
        linkedId,
        issueDate: str(form, "issue_date") || now.slice(0, 10),
        expiryDate: str(form, "expiry_date") || null,
        rejectionReason: null,
        verifiedById: null,
        verifiedAt: null,
        createdAt: now,
        updatedAt: now,
        versions: [
          {
            versionNo: 1,
            fileName: stored.fileName,
            storedPath: stored.storedPath,
            sizeBytes: stored.sizeBytes,
            mimeType: stored.mimeType,
            uploadedById: session.userId,
            uploadedByName: session.fullName,
            uploadedAt: now,
          },
        ],
      });

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "document.upload",
        entityType: "document",
        entityId: id,
        entityLabel: stored.fileName,
      });

      return stored.fileName;
    });

    revalidatePortal("/portal/documents", `/portal/${linkedType}s/${linkedId}`);
    return ok(`${name} uploaded. Speedmax will verify it.`);
  });
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

export async function submitPayment(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "payment.submit");

    const amount = requireAmount(str(form, "amount"), "Amount", "amount");
    const paidAt = requireText(str(form, "paid_at"), "Payment date", "paid_at");
    const invoiceId = str(form, "invoice_id");

    const file = form.get("evidence");
    let evidenceName: string | null = null;
    if (file instanceof File && file.size > 0) {
      evidenceName = (await saveUpload(file)).fileName;
    }

    const reference = await withStore((data) => {
      if (invoiceId) {
        const invoice = requireFound(
          data.invoices.find((i) => i.id === invoiceId),
          "Invoice",
        );
        assertOwn(session.organizationId, invoice.customerOrgId, "That invoice");
      }

      const ref = nextControlNumber(data, "payment", "PAY");
      const id = newId();

      data.payments.unshift({
        id,
        reference: ref,
        status: "submitted",
        customerOrgId: session.organizationId,
        method: (str(form, "method") || "bank_transfer") as
          | "bank_transfer" | "cheque" | "cash" | "card" | "online_gateway" | "offset" | "other",
        paidAt,
        submittedAt: nowIso(),
        amount,
        currency: str(form, "currency") || session.currency,
        bankReference: str(form, "bank_reference") || null,
        evidenceDocumentId: null,
        evidenceName,
        allocations: invoiceId ? [{ invoiceId, amount }] : [],
        recordedById: session.userId,
        recordedByName: session.fullName,
        verifiedById: null,
        verifiedAt: null,
        rejectionReason: null,
        fx: null,
      });

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "payment.submit",
        entityType: "payment",
        entityId: id,
        entityLabel: ref,
        after: { amount, invoiceId: invoiceId || null },
      });

      return ref;
    });

    revalidatePortal("/portal/payments", "/portal/invoices");
    revalidatePath("/finance/collections");

    return ok(
      `${reference} submitted. Speedmax finance will verify it against the bank record before it is applied.`,
      { reference },
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Claims                                                                     */
/* -------------------------------------------------------------------------- */

export async function fileClaim(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "claim.file");

    const shipmentId = requireText(str(form, "shipment_id"), "Shipment", "shipment_id");
    const basis = requireText(str(form, "basis"), "Claim basis", "basis");
    const description = requireText(
      str(form, "description"),
      "Description",
      "description",
    );
    const claimedAmount = requireAmount(
      str(form, "claimed_amount"),
      "Amount claimed",
      "claimed_amount",
    );
    const incidentDate = requireText(
      str(form, "incident_date"),
      "Incident date",
      "incident_date",
    );

    const claimNumber = await withStore((data) => {
      const shipment = requireFound(
        data.shipments.find((s) => s.id === shipmentId),
        "Shipment",
      );
      assertOwn(session.organizationId, shipment.customerOrgId, "That shipment");

      const number = nextControlNumber(data, "claim", "CLM");
      const id = newId();
      const now = nowIso();

      data.claims.unshift({
        id,
        claimNumber: number,
        status: "submitted",
        customerOrgId: session.organizationId,
        shipmentId,
        basis,
        description,
        claimedAmount,
        settledAmount: null,
        currency: str(form, "currency") || session.currency,
        incidentDate,
        submittedAt: now,
        decisionNote: null,
        documentIds: [],
        createdAt: now,
        updatedAt: now,
      });

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "claim.file",
        entityType: "claim",
        entityId: id,
        entityLabel: number,
        after: { shipment: shipment.shipmentNumber, claimedAmount },
      });

      return number;
    });

    revalidatePortal("/portal/claims");
    return ok(`${claimNumber} submitted. Speedmax claims will acknowledge it.`, {
      reference: claimNumber,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Messages — BR-006                                                          */
/* -------------------------------------------------------------------------- */

export async function sendMessage(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    requirePermission(session.role, "message.send");

    const threadId = requireText(str(form, "thread_id"), "Thread");
    const body = requireText(str(form, "body"), "Message", "body");

    await withStore((data) => {
      const thread = requireFound(
        data.threads.find((t) => t.id === threadId),
        "Conversation",
      );
      // BR-006 — a customer may only post into a customer-audience thread their
      // organisation participates in.
      if (
        thread.audience !== "customer" ||
        !thread.participantOrgIds.includes(session.organizationId)
      ) {
        throw new ActionError("You cannot post to this conversation.");
      }

      thread.messages.push({
        id: newId(),
        authorId: session.userId,
        authorName: session.fullName,
        authorSide: "customer",
        body,
        sentAt: nowIso(),
        attachmentNames: [],
        readBy: [session.userId],
      });
      thread.updatedAt = nowIso();

      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "message.send",
        entityType: "thread",
        entityId: thread.id,
        entityLabel: thread.subject,
      });
    });

    revalidatePortal("/portal/messages");
    return ok("Message sent.");
  });
}

/** Mark a conversation read, so the unread badge means something. */
export async function markThreadRead(threadId: string): Promise<void> {
  const session = await getSession();
  await withStore((data) => {
    const thread = data.threads.find((t) => t.id === threadId);
    if (!thread) return;
    if (!thread.participantOrgIds.includes(session.organizationId)) return;
    for (const message of thread.messages) {
      if (!message.readBy.includes(session.userId)) {
        message.readBy.push(session.userId);
      }
    }
  });
  revalidatePath("/portal/messages");
  revalidatePath("/portal");
}

export async function requestProfileChange(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return attempt(async () => {
    const session = await getSession();
    const detail = requireText(
      str(form, "detail"),
      "Describe the change you need",
      "detail",
    );

    await withStore((data) => {
      appendAudit(data, {
        actorId: session.userId,
        actorName: session.fullName,
        action: "company_profile.change_requested",
        entityType: "organization",
        entityId: session.organizationId,
        entityLabel: session.organizationName,
        after: { detail },
      });
    });

    revalidatePath("/portal/profile");
    return ok(
      "Change request sent to your account manager. Access changes are logged and actioned by Speedmax.",
    );
  });
}
