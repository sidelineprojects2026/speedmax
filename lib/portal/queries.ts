import "server-only";

/**
 * Customer portal data access.
 *
 * Every read goes through here, and every read is scoped to the caller's
 * organisation before anything is returned — the same boundary the RLS policies
 * describe. Nothing fetches broadly and narrows afterwards, so when Supabase
 * takes over the shape of the code already matches the policy.
 *
 * Signatures are unchanged from the fixture-backed version, which is why the
 * pages above did not have to move.
 */

import { readStore } from "@/lib/store/db";
import { isOpenInvoice } from "@/lib/store/derive";
import type { StoreData } from "@/lib/store/schema";

import { getSession } from "./session";
import {
  isQuotationVisibleToCustomer,
  orgOwnsDocument,
  projectClaim,
  projectCompany,
  projectDocument,
  projectException,
  projectInvoice,
  projectOrder,
  projectPayment,
  projectQuotation,
  projectShipment,
  projectThread,
} from "./project";

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

import { add, formatAmount, parseMoney, toDecimalString, zero } from "@/lib/domain/money";
import { deriveCustomerTimeline, type TimelineEntry } from "@/lib/domain/milestones";

/** Store plus the caller's organisation, resolved once per read. */
async function scope(): Promise<{ data: StoreData; orgId: string; userId: string }> {
  const [data, session] = await Promise.all([readStore(), getSession()]);
  return { data, orgId: session.organizationId, userId: session.userId };
}

/** Newest-first by an ISO date string, nulls last. */
function byDateDesc<T>(pick: (item: T) => string | null) {
  return (a: T, b: T) => {
    const av = pick(a);
    const bv = pick(b);
    if (av === bv) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return av < bv ? 1 : -1;
  };
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export async function listOrders(): Promise<ShippingOrder[]> {
  const { data, orgId } = await scope();
  return data.orders
    .filter((o) => o.customerOrgId === orgId)
    .map((o) => projectOrder(data, o))
    .sort(byDateDesc((o) => o.submittedAt ?? o.createdAt));
}

export async function getOrder(id: string): Promise<ShippingOrder | null> {
  const { data, orgId } = await scope();
  const order = data.orders.find((o) => o.id === id && o.customerOrgId === orgId);
  return order ? projectOrder(data, order) : null;
}

/* -------------------------------------------------------------------------- */
/* Quotations                                                                 */
/* -------------------------------------------------------------------------- */

export async function listQuotations(): Promise<Quotation[]> {
  const { data, orgId } = await scope();
  return data.quotations
    .filter((q) => q.customerOrgId === orgId && isQuotationVisibleToCustomer(q))
    .map((q) => projectQuotation(data, q))
    .sort(byDateDesc((q) => q.releasedAt));
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  const { data, orgId } = await scope();
  const q = data.quotations.find(
    (x) => x.id === id && x.customerOrgId === orgId && isQuotationVisibleToCustomer(x),
  );
  return q ? projectQuotation(data, q) : null;
}

/**
 * Quotations the customer must act on: released, not yet accepted, still valid.
 * Expired ones are excluded because §8.2 forbids accepting them without
 * revalidation — surfacing one as actionable would invite a dead end.
 */
export async function listActionableQuotations(
  today = new Date(),
): Promise<Quotation[]> {
  const iso = today.toISOString().slice(0, 10);
  const list = await listQuotations();
  return list.filter(
    (q) => q.status === "released" && !q.acceptance && q.validUntil >= iso,
  );
}

/** Sell-side total for a route option, taxes included. */
export function routeOptionTotal(
  option: Quotation["routeOptions"][number],
  currency: string,
): { subtotal: string; tax: string; total: string } {
  let subtotal = zero(currency);
  let tax = zero(currency);

  for (const charge of option.charges) {
    const amount = parseMoney(charge.sellAmount, currency);
    subtotal = add(subtotal, amount);
    if (charge.isTaxable) {
      const rate = Number(charge.taxRatePct) / 100;
      if (rate > 0) {
        tax = add(
          tax,
          parseMoney((Number(charge.sellAmount) * rate).toFixed(2), currency),
        );
      }
    }
  }

  return {
    subtotal: toDecimalString(subtotal),
    tax: toDecimalString(tax),
    total: toDecimalString(add(subtotal, tax)),
  };
}

/* -------------------------------------------------------------------------- */
/* Shipments                                                                  */
/* -------------------------------------------------------------------------- */

export async function listShipments(): Promise<Shipment[]> {
  const { data, orgId } = await scope();
  return data.shipments
    .filter((s) => s.customerOrgId === orgId)
    .map((s) => projectShipment(data, s))
    .sort(byDateDesc((s) => s.etdAt));
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const { data, orgId } = await scope();
  const s = data.shipments.find((x) => x.id === id && x.customerOrgId === orgId);
  return s ? projectShipment(data, s) : null;
}

/**
 * The §9.3 customer timeline for a shipment. The projection has already dropped
 * internal events, so this only has customer-visible ones to work from.
 */
export function shipmentTimeline(shipment: Shipment): TimelineEntry[] {
  return deriveCustomerTimeline(
    shipment.events.map((e) => ({
      milestoneCode: e.milestoneCode,
      eventTime: e.eventTime,
      visibility: e.visibility,
    })),
    {
      orderSubmittedAt: shipment.orderSubmittedAt,
      quotationAcceptedAt: shipment.quotationAcceptedAt,
      bookingConfirmedAt: shipment.bookingConfirmedAt,
    },
  );
}

export async function listActiveShipments(): Promise<Shipment[]> {
  const all = await listShipments();
  return all.filter((s) => s.status !== "closed" && s.status !== "cancelled");
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

export async function listDocuments(): Promise<DocumentRecord[]> {
  const { data, orgId } = await scope();
  return data.documents
    .filter(
      (d) => d.visibility === "customer" && orgOwnsDocument(data, d, orgId),
    )
    .map((d) => projectDocument(data, d))
    .sort(byDateDesc((d) => d.uploadedAt));
}

export async function listDocumentsFor(
  linkedType: DocumentRecord["linkedType"],
  linkedId: string,
): Promise<DocumentRecord[]> {
  const all = await listDocuments();
  return all.filter((d) => d.linkedType === linkedType && d.linkedId === linkedId);
}

/* -------------------------------------------------------------------------- */
/* Finance                                                                    */
/* -------------------------------------------------------------------------- */

/** Draft and pending-approval invoices are internal until issued. */
function isIssued(status: string): boolean {
  return status !== "draft" && status !== "for_approval";
}

export async function listInvoices(): Promise<Invoice[]> {
  const { data, orgId } = await scope();
  return data.invoices
    .filter((i) => i.customerOrgId === orgId && isIssued(i.status))
    .map((i) => projectInvoice(data, i))
    .sort(byDateDesc((i) => i.issueDate));
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, orgId } = await scope();
  const i = data.invoices.find(
    (x) => x.id === id && x.customerOrgId === orgId && isIssued(x.status),
  );
  return i ? projectInvoice(data, i) : null;
}

export async function listPayments(): Promise<Payment[]> {
  const { data, orgId } = await scope();
  return data.payments
    .filter((p) => p.customerOrgId === orgId)
    .map((p) => projectPayment(data, p))
    .sort(byDateDesc((p) => p.submittedAt));
}

/** Total outstanding across issued invoices, in the account currency. */
export async function outstandingBalance(currency: string): Promise<string> {
  const { data, orgId } = await scope();
  const total = data.invoices
    .filter(
      (i) =>
        i.customerOrgId === orgId && i.currency === currency && isOpenInvoice(i),
    )
    .map((i) => projectInvoice(data, i))
    .reduce((acc, i) => add(acc, parseMoney(i.balance, currency)), zero(currency));
  return toDecimalString(total);
}

export async function overdueBalance(currency: string): Promise<string> {
  const { data, orgId } = await scope();
  const total = data.invoices
    .filter(
      (i) =>
        i.customerOrgId === orgId &&
        i.currency === currency &&
        i.status === "overdue",
    )
    .map((i) => projectInvoice(data, i))
    .reduce((acc, i) => add(acc, parseMoney(i.balance, currency)), zero(currency));
  return toDecimalString(total);
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export async function listClaims(): Promise<Claim[]> {
  const { data, orgId } = await scope();
  return data.claims
    .filter((c) => c.customerOrgId === orgId)
    .map((c) => projectClaim(data, c))
    .sort(byDateDesc((c) => c.submittedAt));
}

export async function getClaim(id: string): Promise<Claim | null> {
  const { data, orgId } = await scope();
  const c = data.claims.find((x) => x.id === id && x.customerOrgId === orgId);
  return c ? projectClaim(data, c) : null;
}

export async function listExceptions(): Promise<ExceptionRecord[]> {
  const { data, orgId } = await scope();
  const ownShipments = new Set(
    data.shipments.filter((s) => s.customerOrgId === orgId).map((s) => s.id),
  );
  return data.exceptions
    .filter((e) => e.shipmentId !== null && ownShipments.has(e.shipmentId))
    .map((e) => projectException(data, e))
    .sort(byDateDesc((e) => e.detectedAt));
}

export async function listOpenExceptions(): Promise<ExceptionRecord[]> {
  const all = await listExceptions();
  return all.filter((e) => !["resolved", "closed"].includes(e.status));
}

export async function listThreads(): Promise<MessageThread[]> {
  const { data, orgId, userId } = await scope();
  return data.threads
    .filter(
      (t) => t.audience === "customer" && t.participantOrgIds.includes(orgId),
    )
    .map((t) => projectThread(data, t, userId))
    .sort(byDateDesc((t) => t.lastMessageAt));
}

export async function getThread(id: string): Promise<MessageThread | null> {
  const all = await listThreads();
  return all.find((t) => t.id === id) ?? null;
}

export async function unreadMessageCount(): Promise<number> {
  const list = await listThreads();
  return list.reduce((n, t) => n + t.unreadCount, 0);
}

/* -------------------------------------------------------------------------- */
/* Company                                                                    */
/* -------------------------------------------------------------------------- */

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const { data, orgId } = await scope();
  return projectCompany(data, orgId);
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface ActionItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly urgency: "high" | "medium" | "low";
  readonly dueLabel: string | null;
}

/**
 * §19.1 — items waiting on the current user, ordered by risk then due date.
 * Only things the customer can actually act on: a shipment merely in transit is
 * not an action item; a quotation about to expire is.
 */
export async function listActionItems(today = new Date()): Promise<ActionItem[]> {
  const items: ActionItem[] = [];

  const daysUntil = (iso: string) =>
    Math.ceil((new Date(iso).getTime() - today.getTime()) / 86_400_000);

  for (const q of await listActionableQuotations(today)) {
    const days = daysUntil(q.validUntil);
    items.push({
      id: `quote-${q.id}`,
      title: `Quotation ${q.quoteNumber} awaiting your acceptance`,
      detail: `${q.routeOptions.length} route option${
        q.routeOptions.length === 1 ? "" : "s"
      } for order ${q.orderNumber}.`,
      href: `/portal/quotations/${q.id}`,
      urgency: days <= 3 ? "high" : "medium",
      dueLabel:
        days <= 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`,
    });
  }

  for (const o of await listOrders()) {
    if (o.status === "information_required") {
      items.push({
        id: `order-${o.id}`,
        title: `Order ${o.orderNumber} needs more information`,
        detail:
          o.statusReason ?? "Speedmax has returned this order for additional detail.",
        href: `/portal/orders/${o.id}`,
        urgency: "high",
        dueLabel: null,
      });
    }
    if (o.status === "draft") {
      items.push({
        id: `draft-${o.id}`,
        title: `Draft order ${o.orderNumber} not submitted`,
        detail: `${o.originLabel ?? "Origin"} → ${o.destinationLabel ?? "destination"}, created ${o.createdAt.slice(0, 10)}.`,
        href: `/portal/orders/${o.id}`,
        urgency: "low",
        dueLabel: null,
      });
    }
  }

  for (const e of await listOpenExceptions()) {
    if (e.status === "action_required") {
      items.push({
        id: `exception-${e.id}`,
        title: `${e.exceptionNumber} needs your action`,
        detail: e.customerStatement,
        href: `/portal/shipments`,
        urgency:
          e.severity === "critical" || e.severity === "high" ? "high" : "medium",
        dueLabel: e.targetResolutionAt
          ? `Target ${e.targetResolutionAt.slice(0, 10)}`
          : null,
      });
    }
  }

  for (const i of await listInvoices()) {
    if (i.status === "overdue") {
      const days = -daysUntil(i.dueDate);
      items.push({
        id: `invoice-${i.id}`,
        title: `Invoice ${i.invoiceNumber} is overdue`,
        detail: `Balance ${formatAmount(i.balance, i.currency)}, due ${i.dueDate}.`,
        href: `/portal/invoices/${i.id}`,
        urgency: "high",
        dueLabel: `${days} day${days === 1 ? "" : "s"} overdue`,
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return items.sort((a, b) => {
    const byUrgency = rank[a.urgency] - rank[b.urgency];
    if (byUrgency !== 0) return byUrgency;
    return (a.dueLabel ?? "").localeCompare(b.dueLabel ?? "");
  });
}
