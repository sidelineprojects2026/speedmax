/**
 * Derived values.
 *
 * Anything that can be computed from other records is computed here rather than
 * stored: invoice totals from lines, amount paid from verified allocations,
 * shipment profitability from the vendor bills, expenses and settlement lines
 * actually attached to it.
 *
 * The reason is concrete. An earlier pass stored `total` alongside `lines`, and
 * three of the four invoices displayed a total their own rows did not add up to.
 * Deriving removes that failure mode entirely — and it makes mutation coherent,
 * because approving a vendor bill moves the margin without anything having to
 * remember to recalculate it.
 */

import {
  add,
  multiply,
  parseMoney,
  subtract,
  toDecimalString,
  zero,
  type Money,
} from "@/lib/domain/money";
import { computeProfitability, type Profitability } from "@/lib/domain/charges";

import type {
  AgentSettlement,
  Expense,
  Invoice,
  Payment,
  Shipment,
  StoreData,
  VendorBill,
} from "./schema";

/* -------------------------------------------------------------------------- */
/* Invoices                                                                   */
/* -------------------------------------------------------------------------- */

export interface InvoiceTotals {
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balance: string;
  currency: string;
  /** Positive when past due; negative means not yet due. */
  daysOverdue: number;
}

/** Line amounts and the tax each one attracts. */
function invoiceAmounts(invoice: Invoice): { subtotal: Money; tax: Money } {
  const ccy = invoice.currency;
  let subtotal = zero(ccy);
  let tax = zero(ccy);

  for (const line of invoice.lines) {
    const amount = parseMoney(line.amount, ccy);
    subtotal = add(subtotal, amount);
    const rate = Number(line.taxRatePct);
    if (Number.isFinite(rate) && rate > 0) {
      tax = add(tax, multiply(amount, rate / 100));
    }
  }

  return { subtotal, tax };
}

/**
 * Amount paid, counting only VERIFIED payments.
 *
 * A submitted-but-unverified payment is a claim by the customer, not money we
 * have confirmed. Counting it would let anyone clear their own balance by
 * asserting a transfer — which is exactly why §13 separates verification.
 */
export function invoicePaid(invoice: Invoice, payments: Payment[]): Money {
  const ccy = invoice.currency;
  return payments
    .filter((p) => p.status === "verified")
    .flatMap((p) => p.allocations.filter((a) => a.invoiceId === invoice.id))
    .reduce((acc, a) => add(acc, parseMoney(a.amount, ccy)), zero(ccy));
}

export function invoiceTotals(
  invoice: Invoice,
  payments: Payment[],
  today = new Date(),
): InvoiceTotals {
  const { subtotal, tax } = invoiceAmounts(invoice);
  const total = add(subtotal, tax);
  const paid = invoicePaid(invoice, payments);
  const balance = subtract(total, paid);

  const due = new Date(`${invoice.dueDate}T00:00:00Z`).getTime();
  const daysOverdue = Math.floor((today.getTime() - due) / 86_400_000);

  return {
    subtotal: toDecimalString(subtotal),
    taxTotal: toDecimalString(tax),
    total: toDecimalString(total),
    amountPaid: toDecimalString(paid),
    balance: toDecimalString(balance),
    currency: invoice.currency,
    daysOverdue,
  };
}

/** Invoice statuses that no longer represent money owed. */
const SETTLED_STATUSES = ["paid", "closed", "reversed"];

export function isOpenInvoice(invoice: Invoice): boolean {
  return (
    !SETTLED_STATUSES.includes(invoice.status) &&
    invoice.status !== "draft" &&
    invoice.status !== "for_approval"
  );
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

/** Money received against no invoice — an overpayment or an unapplied receipt. */
export function paymentUnallocated(payment: Payment): string {
  const ccy = payment.currency;
  const allocated = payment.allocations.reduce(
    (acc, a) => add(acc, parseMoney(a.amount, ccy)),
    zero(ccy),
  );
  return toDecimalString(subtract(parseMoney(payment.amount, ccy), allocated));
}

/* -------------------------------------------------------------------------- */
/* Settlements                                                                */
/* -------------------------------------------------------------------------- */

export interface SettlementTotals {
  feesTotal: string;
  reimbursementsTotal: string;
  advancesTotal: string;
  deductionsTotal: string;
  netPayable: string;
  currency: string;
}

/**
 * Net payable = fees + reimbursements − advances − deductions (§10.2).
 * Advances are money already handed over; deductions are recoveries.
 */
export function settlementTotals(settlement: AgentSettlement): SettlementTotals {
  const ccy = settlement.currency;
  const sumKind = (kind: string) =>
    settlement.lines
      .filter((l) => l.kind === kind)
      .reduce((acc, l) => add(acc, parseMoney(l.amount, ccy)), zero(ccy));

  const fees = sumKind("fee");
  const reimbursements = sumKind("reimbursement");
  const advances = sumKind("advance");
  const deductions = sumKind("deduction");

  const net = subtract(subtract(add(fees, reimbursements), advances), deductions);

  return {
    feesTotal: toDecimalString(fees),
    reimbursementsTotal: toDecimalString(reimbursements),
    advancesTotal: toDecimalString(advances),
    deductionsTotal: toDecimalString(deductions),
    netPayable: toDecimalString(net),
    currency: ccy,
  };
}

/* -------------------------------------------------------------------------- */
/* Vendor bills and expenses                                                  */
/* -------------------------------------------------------------------------- */

export function vendorBillTotal(bill: VendorBill): string {
  return toDecimalString(
    add(
      parseMoney(bill.netAmount, bill.currency),
      parseMoney(bill.taxAmount, bill.currency),
    ),
  );
}

export function vendorBillBalance(bill: VendorBill): string {
  return toDecimalString(
    subtract(
      add(
        parseMoney(bill.netAmount, bill.currency),
        parseMoney(bill.taxAmount, bill.currency),
      ),
      parseMoney(bill.amountPaid, bill.currency),
    ),
  );
}

/**
 * Amount in the reporting currency.
 *
 * A record in another currency must carry its FX context (BR-028); if it does
 * not, we return zero rather than guess a rate, because a silently wrong
 * conversion in a margin report is worse than a visible gap.
 */
function inBase(
  amount: string,
  currency: string,
  fx: { baseCurrency: string; baseAmount: string } | null,
  baseCurrency: string,
): Money {
  if (currency === baseCurrency) return parseMoney(amount, baseCurrency);
  if (fx && fx.baseCurrency === baseCurrency) {
    return parseMoney(fx.baseAmount, baseCurrency);
  }
  return zero(baseCurrency);
}

/** Bills flagged as duplicates: same vendor invoice number, different record. */
export function duplicateVendorInvoice(
  bill: VendorBill,
  all: VendorBill[],
): VendorBill | null {
  return (
    all.find(
      (other) =>
        other.id !== bill.id &&
        other.vendorInvoiceNumber === bill.vendorInvoiceNumber &&
        other.vendorName === bill.vendorName &&
        other.status !== "reversed",
    ) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/* Shipment profitability — §10.3                                             */
/* -------------------------------------------------------------------------- */

export interface ShipmentFinancials {
  shipment: Shipment;
  profitability: Profitability;
  customerCharges: string;
  actualVendorCost: string;
  agentCost: string;
  internalDirectCost: string;
  accruals: string;
  quotedCost: string;
  costVariance: string;
  isBilled: boolean;
  currency: string;
}

/** Vendor-bill statuses that represent a real, recognised cost. */
const RECOGNISED_BILL = ["approved", "partially_paid", "paid", "closed"];
/** Expense statuses that represent a real, recognised cost. */
const RECOGNISED_EXPENSE = ["approved", "partially_paid", "paid", "closed"];

/**
 * Compute a shipment's position from the records actually attached to it.
 *
 * Revenue counts issued invoices only, and excludes pro forma: §10.1 treats a
 * pro forma as a request for a deposit, not a posted invoice, so counting one
 * would recognise revenue that has not been billed.
 */
export function shipmentFinancials(
  shipment: Shipment,
  data: Pick<StoreData, "invoices" | "vendorBills" | "expenses" | "settlements">,
): ShipmentFinancials {
  const ccy = shipment.currency;

  const linked = data.invoices.filter(
    (i) => i.shipmentId === shipment.id && i.type !== "proforma",
  );
  const posted = linked.filter(
    (i) => i.status !== "draft" && i.status !== "for_approval",
  );

  let charges = zero(ccy);
  let credits = zero(ccy);
  let debits = zero(ccy);

  for (const invoice of posted) {
    const { subtotal } = invoiceAmounts(invoice);
    if (invoice.type === "credit_note") credits = add(credits, subtotal);
    else if (invoice.type === "debit_note") debits = add(debits, subtotal);
    else charges = add(charges, subtotal);
  }

  let vendorCost = zero(ccy);
  let accruals = zero(ccy);
  for (const bill of data.vendorBills) {
    if (!bill.shipmentIds.includes(shipment.id)) continue;
    const amount = inBase(vendorBillTotal(bill), bill.currency, bill.fx, ccy);
    if (bill.isAccrual) {
      // Accruals count against margin so profit is not overstated while the
      // vendor's real invoice is outstanding (§10.2) — but they are reported
      // separately because they are estimates.
      if (bill.status !== "reversed") accruals = add(accruals, amount);
    } else if (RECOGNISED_BILL.includes(bill.status)) {
      vendorCost = add(vendorCost, amount);
    }
  }

  let agentCost = zero(ccy);
  for (const expense of data.expenses) {
    if (expense.shipmentId !== shipment.id) continue;
    if (!RECOGNISED_EXPENSE.includes(expense.status)) continue;
    agentCost = add(
      agentCost,
      inBase(expense.amount, expense.currency, expense.fx, ccy),
    );
  }
  for (const settlement of data.settlements) {
    if (settlement.status === "reversed") continue;
    for (const line of settlement.lines) {
      if (line.shipmentId !== shipment.id) continue;
      // Fees are a cost to us. Reimbursements are already captured as expenses,
      // so counting them here too would double the agent cost.
      if (line.kind !== "fee") continue;
      const base = inBase(
        line.amount,
        settlement.currency,
        settlement.fx
          ? {
              baseCurrency: settlement.fx.baseCurrency,
              baseAmount: toDecimalString(
                multiply(
                  parseMoney(line.amount, settlement.currency),
                  Number(settlement.fx.appliedRate),
                ),
              ),
            }
          : null,
        ccy,
      );
      agentCost = add(agentCost, base);
    }
  }

  const internal = parseMoney(shipment.internalDirectCost, ccy);

  const profitability = computeProfitability(
    { customerCharges: charges, credits, debits },
    {
      actualVendorCost: vendorCost,
      agentCost,
      internalDirectCost: internal,
      accruals,
    },
  );

  return {
    shipment,
    profitability,
    customerCharges: toDecimalString(charges),
    actualVendorCost: toDecimalString(vendorCost),
    agentCost: toDecimalString(agentCost),
    internalDirectCost: toDecimalString(internal),
    accruals: toDecimalString(accruals),
    quotedCost: shipment.quotedCost,
    costVariance: toDecimalString(
      subtract(profitability.totalDirectCost, parseMoney(shipment.quotedCost, ccy)),
    ),
    isBilled: posted.length > 0,
    currency: ccy,
  };
}

/* -------------------------------------------------------------------------- */
/* Aging — §20                                                                */
/* -------------------------------------------------------------------------- */

export interface AgingBuckets {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  total: string;
  openInvoiceCount: number;
  oldestDueDate: string | null;
  currency: string;
}

export function agingFor(
  invoices: Invoice[],
  payments: Payment[],
  currency: string,
  today = new Date(),
): AgingBuckets {
  const buckets = {
    current: zero(currency),
    days1to30: zero(currency),
    days31to60: zero(currency),
    days61to90: zero(currency),
    over90: zero(currency),
  };

  let count = 0;
  let oldest: string | null = null;

  for (const invoice of invoices) {
    if (invoice.currency !== currency || !isOpenInvoice(invoice)) continue;
    const totals = invoiceTotals(invoice, payments, today);
    const balance = parseMoney(totals.balance, currency);
    if (balance.units <= 0) continue;

    count += 1;
    if (oldest === null || invoice.dueDate < oldest) oldest = invoice.dueDate;

    const d = totals.daysOverdue;
    if (d <= 0) buckets.current = add(buckets.current, balance);
    else if (d <= 30) buckets.days1to30 = add(buckets.days1to30, balance);
    else if (d <= 60) buckets.days31to60 = add(buckets.days31to60, balance);
    else if (d <= 90) buckets.days61to90 = add(buckets.days61to90, balance);
    else buckets.over90 = add(buckets.over90, balance);
  }

  const total = add(
    add(add(buckets.current, buckets.days1to30), add(buckets.days31to60, buckets.days61to90)),
    buckets.over90,
  );

  return {
    current: toDecimalString(buckets.current),
    days1to30: toDecimalString(buckets.days1to30),
    days31to60: toDecimalString(buckets.days31to60),
    days61to90: toDecimalString(buckets.days61to90),
    over90: toDecimalString(buckets.over90),
    total: toDecimalString(total),
    openInvoiceCount: count,
    oldestDueDate: oldest,
    currency,
  };
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export function orgName(data: StoreData, id: string | null): string {
  if (!id) return "—";
  return data.organizations.find((o) => o.id === id)?.legalName ?? id;
}

export function userName(data: StoreData, id: string | null): string {
  if (!id) return "—";
  return data.profiles.find((p) => p.id === id)?.fullName ?? id;
}

export function shipmentByNumber(
  data: StoreData,
  shipmentNumber: string,
): Shipment | undefined {
  return data.shipments.find((s) => s.shipmentNumber === shipmentNumber);
}
