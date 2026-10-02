/**
 * Charges, margin and cost allocation — §8.1, §10.3, §10.4.
 *
 * Two rules shape this file:
 *
 *  1. Cost and sell live side by side on a charge line, but only sell is ever
 *     customer-visible (BR-008). The types below keep them in separate shapes
 *     so it is not possible to hand a customer-facing component a value that
 *     carries cost, and forgetting to strip a field becomes a type error rather
 *     than a data leak.
 *
 *  2. Allocations must sum exactly to the amount being allocated. Proportional
 *     splits with independent rounding do not — they leave stray minor units.
 *     `allocate` uses largest-remainder so the parts always reconcile.
 */

import {
  add,
  compare,
  isZero,
  money,
  type Money,
  subtract,
  sum,
  zero,
} from "./money";

/* -------------------------------------------------------------------------- */
/* §8.1 — Charge structure                                                    */
/* -------------------------------------------------------------------------- */

export type ChargeGroup =
  | "origin"
  | "main_carriage"
  | "destination"
  | "protection"
  | "speedmax"
  | "adjustments";

export interface ChargeGroupDef {
  readonly group: ChargeGroup;
  readonly label: string;
  readonly seq: number;
  /** Illustrative charge codes — the real catalog is configurable (BR-035). */
  readonly examples: readonly string[];
}

export const chargeGroups: readonly ChargeGroupDef[] = [
  {
    group: "origin",
    label: "Origin",
    seq: 1,
    examples: [
      "Pickup",
      "Export documentation",
      "Warehouse",
      "Handling",
      "Customs brokerage",
      "Terminal charges",
    ],
  },
  {
    group: "main_carriage",
    label: "Main Carriage",
    seq: 2,
    examples: [
      "Air freight",
      "Ocean freight",
      "Road",
      "Rail",
      "Surcharge",
      "Security",
      "Fuel",
    ],
  },
  {
    group: "destination",
    label: "Destination",
    seq: 3,
    examples: [
      "Terminal handling",
      "Brokerage",
      "Duties and taxes estimate",
      "Warehouse",
      "Final delivery",
    ],
  },
  {
    group: "protection",
    label: "Protection",
    seq: 4,
    examples: [
      "Cargo insurance",
      "Inspection",
      "Special handling",
      "Temperature control",
    ],
  },
  {
    group: "speedmax",
    label: "Speedmax",
    seq: 5,
    examples: [
      "Service fee",
      "Documentation fee",
      "Coordination fee",
      "Markup",
    ],
  },
  {
    group: "adjustments",
    label: "Adjustments",
    seq: 6,
    examples: [
      "Discount",
      "Tax",
      "Currency adjustment",
      "Contingency",
      "Additional charge",
    ],
  },
] as const;

export function chargeGroupLabel(group: ChargeGroup): string {
  return chargeGroups.find((g) => g.group === group)?.label ?? group;
}

/* -------------------------------------------------------------------------- */
/* Charge lines                                                               */
/* -------------------------------------------------------------------------- */

/** What a customer may see: sell price only, never cost. */
export interface CustomerChargeLine {
  readonly id: string;
  readonly group: ChargeGroup;
  readonly chargeCode: string;
  readonly description: string;
  readonly quantity: number;
  readonly sell: Money;
  readonly taxable: boolean;
}

/**
 * The internal view. Deliberately a superset rather than a separate hierarchy,
 * so `toCustomerLine` is the single, obvious narrowing point.
 */
export interface InternalChargeLine extends CustomerChargeLine {
  readonly cost: Money;
}

/**
 * Strip cost from an internal charge line.
 *
 * This is the only sanctioned way to produce a customer-facing line. Anywhere
 * a customer surface needs charges, it should receive the result of this —
 * never an InternalChargeLine with the cost field ignored at render time.
 */
export function toCustomerLine(line: InternalChargeLine): CustomerChargeLine {
  const { id, group, chargeCode, description, quantity, sell, taxable } = line;
  return { id, group, chargeCode, description, quantity, sell, taxable };
}

export function toCustomerLines(
  lines: readonly InternalChargeLine[],
): CustomerChargeLine[] {
  return lines.map(toCustomerLine);
}

/** Group charge lines for display, in §8.1 order, omitting empty groups. */
export function groupCharges<T extends CustomerChargeLine>(
  lines: readonly T[],
): { group: ChargeGroupDef; lines: T[]; subtotal: Money }[] {
  if (lines.length === 0) return [];
  const currency = lines[0]!.sell.currency;
  return chargeGroups
    .map((group) => {
      const groupLines = lines.filter((l) => l.group === group.group);
      return {
        group,
        lines: groupLines,
        subtotal: sum(
          groupLines.map((l) => l.sell),
          currency,
        ),
      };
    })
    .filter((g) => g.lines.length > 0);
}

/* -------------------------------------------------------------------------- */
/* §10.3 — Cost and margin                                                    */
/* -------------------------------------------------------------------------- */

export interface RevenueInputs {
  /** Sum of customer charges before adjustments. */
  readonly customerCharges: Money;
  readonly discounts?: Money;
  readonly credits?: Money;
  readonly debits?: Money;
}

export interface CostInputs {
  readonly actualVendorCost?: Money;
  readonly agentCost?: Money;
  readonly internalDirectCost?: Money;
  /** Accrued but not yet invoiced by the vendor (§10.2). */
  readonly accruals?: Money;
}

export interface Profitability {
  readonly netRevenue: Money;
  readonly totalDirectCost: Money;
  readonly grossProfit: Money;
  /**
   * Gross margin as a percentage. Null when net revenue is zero — §10.3 defines
   * the ratio only for non-zero revenue, and returning 0 there would read as a
   * real break-even rather than "not meaningful".
   */
  readonly grossMarginPct: number | null;
}

/** Net Revenue = Customer Charges − Discounts − Credits + Debits (§10.3). */
export function netRevenue(input: RevenueInputs): Money {
  const ccy = input.customerCharges.currency;
  let result = input.customerCharges;
  result = subtract(result, input.discounts ?? zero(ccy));
  result = subtract(result, input.credits ?? zero(ccy));
  result = add(result, input.debits ?? zero(ccy));
  return result;
}

/**
 * Total Direct Cost = Actual Vendor + Agent + Internal Direct + Accruals (§10.3).
 * Accruals are included so profitability is not overstated while vendor invoices
 * are outstanding (§10.2).
 */
export function totalDirectCost(input: CostInputs, currency: string): Money {
  return sum(
    [
      input.actualVendorCost,
      input.agentCost,
      input.internalDirectCost,
      input.accruals,
    ].filter((m): m is Money => m !== undefined),
    currency,
  );
}

/**
 * Margin is a ratio of two exact amounts, so it is unavoidably a float — but
 * the raw quotient carries binary noise (2800/10000*100 evaluates to
 * 28.000000000000004). Left alone that reaches the UI as a margin of
 * "28.000000000000004%" and makes threshold comparisons in
 * `marginRequiresEscalation` turn on noise rather than on the number.
 *
 * Four decimal places is finer than any margin policy is written to and well
 * inside double precision for the magnitudes involved.
 */
const MARGIN_DP = 4;

function roundPct(value: number): number {
  const factor = 10 ** MARGIN_DP;
  return Math.round(value * factor) / factor;
}

export function computeProfitability(
  revenue: RevenueInputs,
  cost: CostInputs,
): Profitability {
  const net = netRevenue(revenue);
  const total = totalDirectCost(cost, net.currency);
  const profit = subtract(net, total);

  return {
    netRevenue: net,
    totalDirectCost: total,
    grossProfit: profit,
    grossMarginPct: isZero(net) ? null : roundPct((profit.units / net.units) * 100),
  };
}

/**
 * Whether a quotation needs escalated approval on margin grounds (§8.2).
 * Negative margin always escalates; so does anything under the configured floor.
 * Unknown margin (zero revenue) escalates rather than passing silently.
 */
export function marginRequiresEscalation(
  grossMarginPct: number | null,
  minimumMarginPct: number,
): boolean {
  if (grossMarginPct === null) return true;
  return grossMarginPct < 0 || grossMarginPct < minimumMarginPct;
}

/* -------------------------------------------------------------------------- */
/* §10.4 — Cost allocation                                                    */
/* -------------------------------------------------------------------------- */

export type AllocationMethod =
  | "direct"
  | "quantity"
  | "weight"
  | "volume"
  | "value"
  | "equal"
  | "manual";

export const allocationMethods: readonly {
  readonly method: AllocationMethod;
  readonly label: string;
  readonly useCase: string;
}[] = [
  { method: "direct", label: "Direct", useCase: "Charge relates to one shipment or one cargo line" },
  { method: "quantity", label: "Quantity", useCase: "Allocate by units" },
  { method: "weight", label: "Weight", useCase: "Allocate by chargeable, gross, or net weight" },
  { method: "volume", label: "Volume", useCase: "Allocate by cubic volume" },
  { method: "value", label: "Value", useCase: "Allocate by declared or invoice value" },
  { method: "equal", label: "Equal", useCase: "Allocate equally across selected records" },
  { method: "manual", label: "Manual", useCase: "Authorized user enters justified allocation" },
] as const;

export interface AllocationTarget {
  readonly id: string;
  /** Basis value for the chosen method — units, kg, m³, or declared value. */
  readonly basis: number;
}

export interface AllocationResult {
  readonly id: string;
  readonly amount: Money;
  readonly basis: number;
  readonly sharePct: number;
}

/**
 * Allocate an amount across targets in proportion to their basis.
 *
 * Uses largest-remainder: each target gets the floor of its exact share, then
 * the leftover minor units go one each to the targets with the largest
 * fractional remainders. This guarantees the parts sum exactly to the total,
 * which naive per-target rounding does not — and an allocation that does not
 * reconcile to its source amount is a finance defect, not a display quirk.
 *
 * Zero total basis falls back to an equal split, since a proportional split is
 * undefined there and silently allocating nothing would hide the cost entirely.
 */
export function allocate(
  amount: Money,
  targets: readonly AllocationTarget[],
  method: AllocationMethod = "direct",
): AllocationResult[] {
  if (targets.length === 0) return [];

  const useEqual = method === "equal";
  const bases = targets.map((t) => (useEqual ? 1 : Math.max(0, t.basis)));
  const totalBasis = bases.reduce((a, b) => a + b, 0);

  // Undefined proportional split — fall back to equal rather than dropping cost.
  const effective = totalBasis === 0 ? targets.map(() => 1) : bases;
  const effectiveTotal = totalBasis === 0 ? targets.length : totalBasis;

  const exact = effective.map((b) => (amount.units * b) / effectiveTotal);
  const floored = exact.map((v) => Math.floor(v));
  let remainder = amount.units - floored.reduce((a, b) => a + b, 0);

  // Hand out leftover minor units to the largest fractional remainders first.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const final = [...floored];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    final[order[cursor % order.length].i] += 1;
    remainder -= 1;
    cursor += 1;
  }
  while (remainder < 0 && order.length > 0) {
    final[order[cursor % order.length].i] -= 1;
    remainder += 1;
    cursor += 1;
  }

  return targets.map((t, i) => ({
    id: t.id,
    amount: money(final[i], amount.currency),
    basis: effective[i],
    sharePct: (effective[i] / effectiveTotal) * 100,
  }));
}

/** Verify an allocation reconciles to its source amount. */
export function allocationReconciles(
  amount: Money,
  results: readonly AllocationResult[],
): boolean {
  const allocated = sum(
    results.map((r) => r.amount),
    amount.currency,
  );
  return compare(allocated, amount) === 0;
}
