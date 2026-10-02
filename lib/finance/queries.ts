import "server-only";

/**
 * Finance workspace data access.
 *
 * Internal, so nothing is scoped away — but everything is computed. Totals come
 * from lines, aging from balances, profitability from the §10.3 formula in
 * lib/domain/charges, allocation previews from the largest-remainder splitter
 * in the same module. None of that arithmetic is reimplemented here.
 */

import { readStore } from "@/lib/store/db";
import { agingFor } from "@/lib/store/derive";
import type { StoreData } from "@/lib/store/schema";

import {
  projectAllocatableCost,
  projectCloseCandidate,
  projectCustomerAccount,
  projectFinanceExpense,
  projectFinanceInvoice,
  projectFinancePayment,
  projectProfitability,
  projectSettlement,
  projectVendorBill,
} from "./project";

import type {
  AgentSettlement,
  AllocatableCost,
  CustomerAccount,
  FinanceExpense,
  FinanceInvoice,
  FinancePayment,
  ShipmentCloseCandidate,
  ShipmentProfitability,
  VendorBill,
} from "./types";

import {
  allocate,
  allocationReconciles,
  computeProfitability,
  marginRequiresEscalation,
  type AllocationResult,
  type Profitability,
} from "@/lib/domain/charges";
import {
  add,
  parseMoney,
  subtract,
  toDecimalString,
  zero,
  formatAmount,
} from "@/lib/domain/money";

/** Minimum acceptable gross margin. §8.2 makes this configuration, not code. */
export const MINIMUM_MARGIN_PCT = 12;

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

function sumOf(values: readonly string[], currency: string): string {
  return toDecimalString(
    values.reduce((acc, v) => add(acc, parseMoney(v, currency)), zero(currency)),
  );
}

const store = (): Promise<StoreData> => readStore();

/* -------------------------------------------------------------------------- */
/* Billing — §10.1                                                            */
/* -------------------------------------------------------------------------- */

export async function listInvoices(): Promise<FinanceInvoice[]> {
  const data = await store();
  return data.invoices
    .map((i) => projectFinanceInvoice(data, i))
    .sort(byDateDesc((i) => i.issueDate ?? i.dueDate));
}

export async function getInvoice(id: string): Promise<FinanceInvoice | null> {
  const data = await store();
  const invoice = data.invoices.find((i) => i.id === id);
  return invoice ? projectFinanceInvoice(data, invoice) : null;
}

/** Invoices in draft or awaiting approval — the billing work queue. */
export async function listInvoicesToAction(): Promise<FinanceInvoice[]> {
  const list = await listInvoices();
  return list.filter((i) => i.status === "draft" || i.status === "for_approval");
}

/* -------------------------------------------------------------------------- */
/* Collections                                                                */
/* -------------------------------------------------------------------------- */

export async function listPayments(): Promise<FinancePayment[]> {
  const data = await store();
  return data.payments
    .map((p) => projectFinancePayment(data, p))
    .sort(byDateDesc((p) => p.submittedAt));
}

/** Payments awaiting verification — §13 separates this from preparation. */
export async function listPaymentsToVerify(): Promise<FinancePayment[]> {
  const list = await listPayments();
  return list.filter((p) => p.status === "submitted");
}

/** Money received but not yet applied to an invoice (§10.1 overpayment). */
export async function unallocatedReceipts(currency: string): Promise<string> {
  const list = await listPayments();
  return sumOf(
    list.filter((p) => p.currency === currency).map((p) => p.unallocated),
    currency,
  );
}

export async function listCustomerAccounts(): Promise<CustomerAccount[]> {
  const data = await store();
  return data.organizations
    .filter((o) => o.orgType === "customer")
    .map((o) => projectCustomerAccount(data, o.id))
    .sort((a, b) => Number(b.balance) - Number(a.balance));
}

export interface ArAging {
  readonly current: string;
  readonly days1to30: string;
  readonly days31to60: string;
  readonly days61to90: string;
  readonly over90: string;
  readonly total: string;
  readonly currency: string;
}

/** §20 — AR aging across every customer. */
export async function arAging(currency: string): Promise<ArAging> {
  const data = await store();
  const aging = agingFor(data.invoices, data.payments, currency);
  return {
    current: aging.current,
    days1to30: aging.days1to30,
    days31to60: aging.days31to60,
    days61to90: aging.days61to90,
    over90: aging.over90,
    total: aging.total,
    currency,
  };
}

/* -------------------------------------------------------------------------- */
/* Payables                                                                   */
/* -------------------------------------------------------------------------- */

export async function listVendorBills(): Promise<VendorBill[]> {
  const data = await store();
  return data.vendorBills
    .map((b) => projectVendorBill(data, b))
    .sort(byDateDesc((b) => b.billDate));
}

export async function getVendorBill(id: string): Promise<VendorBill | null> {
  const data = await store();
  const bill = data.vendorBills.find((b) => b.id === id);
  return bill ? projectVendorBill(data, bill) : null;
}

export async function listSettlements(): Promise<AgentSettlement[]> {
  const data = await store();
  return data.settlements
    .map((s) => projectSettlement(data, s))
    .sort(byDateDesc((s) => s.periodTo));
}

export async function listExpenses(): Promise<FinanceExpense[]> {
  const data = await store();
  return data.expenses
    .map((e) => projectFinanceExpense(data, e))
    .sort(byDateDesc((e) => e.incurredOn));
}

/** Expenses awaiting a finance decision. Reversed ones are already resolved. */
export async function listExpensesToAction(): Promise<FinanceExpense[]> {
  const list = await listExpenses();
  return list.filter((e) => e.status === "draft" || e.status === "verified");
}

export interface ApPosition {
  readonly awaitingApproval: string;
  readonly approvedUnpaid: string;
  readonly accrued: string;
  readonly currency: string;
}

export async function apPosition(currency: string): Promise<ApPosition> {
  const bills = (await listVendorBills()).filter((b) => b.currency === currency);
  const where = (pred: (b: VendorBill) => boolean) =>
    sumOf(bills.filter(pred).map((b) => b.balance), currency);

  return {
    awaitingApproval: where((b) => b.status === "draft" || b.status === "verified"),
    approvedUnpaid: where(
      (b) => b.status === "approved" || b.status === "partially_paid",
    ),
    // Accruals are shown separately: they are estimates, not obligations yet.
    accrued: where((b) => b.isAccrual),
    currency,
  };
}

/** Bills flagged as a possible duplicate vendor invoice (§10.2). */
export async function listDuplicateWarnings(): Promise<VendorBill[]> {
  const bills = await listVendorBills();
  return bills.filter((b) => b.duplicateWarning !== null);
}

/* -------------------------------------------------------------------------- */
/* Allocation — §10.4                                                         */
/* -------------------------------------------------------------------------- */

export async function listAllocatableCosts(): Promise<AllocatableCost[]> {
  const data = await store();
  return data.allocatableCosts.map((c) => projectAllocatableCost(data, c));
}

export interface AllocationPreview {
  readonly cost: AllocatableCost;
  readonly results: readonly (AllocationResult & { shipmentNumber: string })[];
  readonly reconciles: boolean;
}

/**
 * Preview how a cost would split across its targets.
 *
 * Runs the real allocator, then asserts the parts reconcile to the whole. If
 * they ever do not, the UI says so rather than displaying a split that quietly
 * loses or invents money.
 */
export async function previewAllocation(
  cost: AllocatableCost,
): Promise<AllocationPreview> {
  const amount = parseMoney(cost.amount, cost.currency);
  const results = allocate(
    amount,
    cost.targets.map((t) => ({ id: t.shipmentId, basis: t.basis })),
    cost.method,
  );

  const byId = new Map(cost.targets.map((t) => [t.shipmentId, t.shipmentNumber]));

  return {
    cost,
    results: results.map((r) => ({ ...r, shipmentNumber: byId.get(r.id) ?? r.id })),
    reconciles: allocationReconciles(amount, results),
  };
}

/* -------------------------------------------------------------------------- */
/* Profitability — §10.3                                                      */
/* -------------------------------------------------------------------------- */

export interface ShipmentMargin {
  readonly record: ShipmentProfitability;
  readonly result: Profitability;
  /** Actual cost against what was quoted. Positive means an overrun. */
  readonly costVariance: string;
  readonly needsEscalation: boolean;
  readonly hasUnallocatedCost: boolean;
}

export function shipmentMargin(record: ShipmentProfitability): ShipmentMargin {
  const ccy = record.currency;

  const result = computeProfitability(
    {
      customerCharges: parseMoney(record.customerCharges, ccy),
      discounts: parseMoney(record.discounts, ccy),
      credits: parseMoney(record.credits, ccy),
      debits: parseMoney(record.debits, ccy),
    },
    {
      actualVendorCost: parseMoney(record.actualVendorCost, ccy),
      agentCost: parseMoney(record.agentCost, ccy),
      internalDirectCost: parseMoney(record.internalDirectCost, ccy),
      accruals: parseMoney(record.accruals, ccy),
    },
  );

  const costVariance = toDecimalString(
    subtract(result.totalDirectCost, parseMoney(record.quotedCost, ccy)),
  );

  return {
    record,
    result,
    costVariance,
    // An unbilled shipment has no revenue yet, so its margin is not a finding in
    // itself — the missing invoice is. Escalate only once it is billed.
    needsEscalation:
      record.isBilled &&
      marginRequiresEscalation(result.grossMarginPct, MINIMUM_MARGIN_PCT),
    hasUnallocatedCost: Number(record.unallocatedCost) > 0,
  };
}

export async function listShipmentMargins(): Promise<ShipmentMargin[]> {
  const data = await store();
  return data.shipments
    .map((s) => projectProfitability(data, s))
    .map(shipmentMargin);
}

/** Shipments with costs recorded but no issued invoice (§19.1). */
export async function listUnbilledShipments(): Promise<ShipmentMargin[]> {
  const all = await listShipmentMargins();
  return all.filter((m) => !m.record.isBilled);
}

/* -------------------------------------------------------------------------- */
/* Close — §21                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Shipments far enough along to be considered for closure: delivered, or in
 * destination handling. Anything still at origin is not a close candidate and
 * would only clutter the queue.
 */
const CLOSE_CANDIDATE_STATUS = [
  "destination_processing",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
];

export async function listCloseCandidates(): Promise<ShipmentCloseCandidate[]> {
  const data = await store();
  return data.shipments
    .filter((s) => CLOSE_CANDIDATE_STATUS.includes(s.status) && !s.closedAt)
    .map((s) => projectCloseCandidate(data, s));
}

export async function getCloseCandidate(
  shipmentId: string,
): Promise<ShipmentCloseCandidate | null> {
  const data = await store();
  const shipment = data.shipments.find((s) => s.id === shipmentId);
  return shipment ? projectCloseCandidate(data, shipment) : null;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface FinanceActionItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly urgency: "high" | "medium" | "low";
  readonly amountLabel: string | null;
}

/**
 * §19.1 finance priorities: delivered but unbilled, margin below floor,
 * duplicate vendor invoices, overdue invoices, and payments awaiting
 * verification.
 */
export async function listFinanceActions(): Promise<FinanceActionItem[]> {
  const items: FinanceActionItem[] = [];

  for (const margin of await listUnbilledShipments()) {
    const cost = toDecimalString(margin.result.totalDirectCost);
    if (Number(cost) <= 0) continue;
    items.push({
      id: `unbilled-${margin.record.shipmentId}`,
      title: `${margin.record.shipmentNumber} has costs recorded but no invoice`,
      detail: `${margin.record.customerName} — ${formatAmount(cost, margin.record.currency)} of cost recognised against no revenue.`,
      href: "/finance/reports",
      urgency: "high",
      amountLabel: null,
    });
  }

  for (const margin of await listShipmentMargins()) {
    if (!margin.needsEscalation) continue;
    const pct = margin.result.grossMarginPct;
    items.push({
      id: `margin-${margin.record.shipmentId}`,
      title: `${margin.record.shipmentNumber} margin below policy`,
      detail: `${margin.record.customerName} — gross margin ${pct === null ? "not measurable" : `${pct.toFixed(2)}%`}, against a ${MINIMUM_MARGIN_PCT}% floor.`,
      href: "/finance/reports",
      urgency: pct !== null && pct < 0 ? "high" : "medium",
      amountLabel: null,
    });
  }

  for (const bill of await listDuplicateWarnings()) {
    items.push({
      id: `dup-${bill.id}`,
      title: `${bill.billNumber} looks like a duplicate`,
      detail: bill.duplicateWarning ?? "",
      href: "/finance/vendor-bills",
      urgency: "high",
      amountLabel: formatAmount(bill.total, bill.currency),
    });
  }

  for (const invoice of await listInvoices()) {
    if (invoice.status !== "overdue") continue;
    items.push({
      id: `overdue-${invoice.id}`,
      title: `${invoice.invoiceNumber} is ${invoice.daysOverdue} days overdue`,
      detail: `${invoice.customerName} — balance outstanding.`,
      href: "/finance/collections",
      urgency: "high",
      amountLabel: formatAmount(invoice.balance, invoice.currency),
    });
  }

  for (const payment of await listPaymentsToVerify()) {
    items.push({
      id: `verify-${payment.id}`,
      title: `${payment.reference} awaiting verification`,
      detail:
        Number(payment.unallocated) > 0
          ? `${payment.customerName} — ${formatAmount(payment.unallocated, payment.currency)} is unallocated and needs applying to an invoice.`
          : `${payment.customerName} — allocated, pending verification.`,
      href: "/finance/collections",
      urgency: "medium",
      amountLabel: formatAmount(payment.amount, payment.currency),
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return items.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}
