import {
  add,
  multiply,
  parseMoney,
  toDecimalString,
} from "@/lib/domain/money";
import type { FxContext, StoreData, VendorBill } from "./schema";

/**
 * Operating currency.
 *
 * Speedmax is a Philippine company, so the peso is what it prices, bills,
 * settles and reports in. Everything customer-facing is PHP, and PHP is the
 * base currency every converted figure resolves to.
 *
 * The seed was originally authored in dollars. Rather than relabelling those
 * amounts — which would have understated every figure by a factor of fifty-six
 * — this converts them, so a peso figure is a real peso figure.
 *
 * One case is deliberately left in dollars: international carriers invoice in
 * USD. A Manila forwarder genuinely does pay Maersk in dollars and bill its
 * customer in pesos, so keeping those bills foreign preserves the real
 * multi-currency case the system has to handle (BR-028) instead of flattening
 * it away.
 */

export const OPERATING_CURRENCY = "PHP";

/** Pesos per dollar for the period. */
export const USD_TO_PHP = 56.25;
export const RATE_SOURCE = "BSP reference rate";

/** Convert a decimal-string amount from `from` into the operating currency. */
export function toOperating(amount: string, from: string): string {
  if (from === OPERATING_CURRENCY) return amount;
  if (from !== "USD") return amount;
  return toDecimalString(
    multiply(parseMoney(amount, OPERATING_CURRENCY), USD_TO_PHP),
  );
}

/** Nullable variant, for optional amounts. */
function toOperatingOrNull(
  amount: string | null,
  from: string,
): string | null {
  return amount === null ? null : toOperating(amount, from);
}

/** BR-028 — a foreign transaction carries its rate, source, date and base amount. */
export function fxToOperating(
  amount: string,
  from: string,
  rateDate: string,
): FxContext | null {
  if (from === OPERATING_CURRENCY) return null;
  return {
    transactionCurrency: from,
    baseCurrency: OPERATING_CURRENCY,
    appliedRate: USD_TO_PHP.toFixed(6),
    referenceRate: USD_TO_PHP.toFixed(6),
    baseAmount: toOperating(amount, from),
    rateSource: RATE_SOURCE,
    rateDate,
  };
}

/** Net plus tax, in the bill's own currency. */
function billTotal(bill: VendorBill): string {
  return toDecimalString(
    add(
      parseMoney(bill.netAmount, bill.currency),
      parseMoney(bill.taxAmount, bill.currency),
    ),
  );
}

/**
 * Rewrite a freshly built seed into the operating currency.
 *
 * Field-directed rather than a blanket numeric sweep: only the fields named
 * here are touched, so weights, volumes, quantities and percentages cannot be
 * caught by accident.
 */
export function applyOperatingCurrency(data: StoreData): StoreData {
  const PHP = OPERATING_CURRENCY;

  // ---- Party ------------------------------------------------------------
  for (const org of data.organizations) {
    if (org.creditLimit && org.creditCurrency) {
      org.creditLimit = toOperating(org.creditLimit, org.creditCurrency);
      org.creditCurrency = PHP;
    }
  }
  for (const profile of data.profiles) profile.currency = PHP;

  // ---- Orders -----------------------------------------------------------
  for (const order of data.orders) {
    const from = order.declaredCurrency ?? "USD";
    order.declaredValue = toOperatingOrNull(order.declaredValue, from);
    if (order.declaredCurrency) order.declaredCurrency = PHP;
    for (const item of order.items) {
      item.unitValue = toOperatingOrNull(item.unitValue, item.currency);
      item.totalValue = toOperatingOrNull(item.totalValue, item.currency);
      item.currency = PHP;
    }
  }

  // ---- Quotations -------------------------------------------------------
  for (const quotation of data.quotations) {
    for (const option of quotation.routeOptions) {
      for (const charge of option.charges) {
        charge.costAmount = toOperating(charge.costAmount, charge.currency);
        charge.sellAmount = toOperating(charge.sellAmount, charge.currency);
        charge.currency = PHP;
      }
    }
    quotation.currency = PHP;
  }

  // ---- Shipments --------------------------------------------------------
  for (const shipment of data.shipments) {
    shipment.quotedCost = toOperating(shipment.quotedCost, shipment.currency);
    shipment.internalDirectCost = toOperating(
      shipment.internalDirectCost,
      shipment.currency,
    );
    shipment.currency = PHP;
  }

  // ---- Receivables ------------------------------------------------------
  for (const invoice of data.invoices) {
    for (const line of invoice.lines) {
      line.unitPrice = toOperating(line.unitPrice, invoice.currency);
      line.amount = toOperating(line.amount, invoice.currency);
    }
    invoice.currency = PHP;
    invoice.fx = null;
  }

  for (const payment of data.payments) {
    payment.amount = toOperating(payment.amount, payment.currency);
    for (const allocation of payment.allocations) {
      allocation.amount = toOperating(allocation.amount, payment.currency);
    }
    payment.currency = PHP;
    payment.fx = null;
  }

  // ---- Payables ---------------------------------------------------------
  for (const bill of data.vendorBills) {
    // International carriers invoice in dollars; that stays true, and the bill
    // carries its rate so the peso equivalent is auditable.
    if (bill.vendorType === "carrier" && bill.currency === "USD") {
      bill.fx = fxToOperating(billTotal(bill), "USD", bill.billDate);
      continue;
    }
    bill.netAmount = toOperating(bill.netAmount, bill.currency);
    bill.taxAmount = toOperating(bill.taxAmount, bill.currency);
    bill.amountPaid = toOperating(bill.amountPaid, bill.currency);
    bill.currency = PHP;
    bill.fx = null;
  }

  for (const settlement of data.settlements) {
    for (const line of settlement.lines) {
      line.amount = toOperating(line.amount, settlement.currency);
    }
    settlement.currency = PHP;
    // Already the operating currency, so there is nothing to convert.
    settlement.fx = null;
  }

  for (const expense of data.expenses) {
    expense.amount = toOperating(expense.amount, expense.currency);
    expense.currency = PHP;
    expense.fx = null;
  }

  for (const cost of data.allocatableCosts) {
    cost.amount = toOperating(cost.amount, cost.currency);
    cost.currency = PHP;
  }

  // ---- Claims -----------------------------------------------------------
  for (const claim of data.claims) {
    claim.claimedAmount = toOperating(claim.claimedAmount, claim.currency);
    claim.settledAmount = toOperatingOrNull(claim.settledAmount, claim.currency);
    claim.currency = PHP;
  }

  return data;
}
