import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSeed } from "./seed";
import {
  agingFor,
  invoiceTotals,
  paymentUnallocated,
  settlementTotals,
  shipmentFinancials,
  duplicateVendorInvoice,
} from "./derive";

/**
 * Seed integrity and derivation tests.
 *
 * The referential checks matter more than they look. Three fixture modules were
 * merged into this one dataset by hand, and a dangling id — a shipment pointing
 * at an order that no longer exists — would not fail to compile. It would show
 * up as a blank field on some page nobody opened during review.
 */

const data = buildSeed();

const ids = <T extends { id: string }>(rows: T[]) => new Set(rows.map((r) => r.id));

/* -------------------------------------------------------------------------- */
/* Referential integrity                                                      */
/* -------------------------------------------------------------------------- */

test("every id is unique within its collection", () => {
  const collections: [string, { id: string }[]][] = [
    ["organizations", data.organizations],
    ["profiles", data.profiles],
    ["orders", data.orders],
    ["quotations", data.quotations],
    ["shipments", data.shipments],
    ["assignments", data.assignments],
    ["documents", data.documents],
    ["invoices", data.invoices],
    ["payments", data.payments],
    ["vendorBills", data.vendorBills],
    ["settlements", data.settlements],
    ["expenses", data.expenses],
    ["claims", data.claims],
    ["exceptions", data.exceptions],
    ["threads", data.threads],
  ];

  for (const [name, rows] of collections) {
    assert.equal(ids(rows).size, rows.length, `${name} has duplicate ids`);
  }
});

test("control numbers are unique", () => {
  const numbers = [
    ...data.orders.map((o) => o.orderNumber),
    ...data.quotations.map((q) => q.quoteNumber),
    ...data.shipments.map((s) => s.shipmentNumber),
    ...data.invoices.map((i) => i.invoiceNumber),
    ...data.payments.map((p) => p.reference),
  ];
  assert.equal(new Set(numbers).size, numbers.length);
});

test("every organisation reference resolves", () => {
  const orgs = ids(data.organizations);

  for (const p of data.profiles) {
    assert.ok(orgs.has(p.organizationId), `profile ${p.id} → ${p.organizationId}`);
  }
  for (const o of data.orders) {
    assert.ok(orgs.has(o.customerOrgId), `order ${o.orderNumber}`);
  }
  for (const s of data.shipments) {
    assert.ok(orgs.has(s.customerOrgId), `shipment ${s.shipmentNumber}`);
  }
  for (const i of data.invoices) {
    assert.ok(orgs.has(i.customerOrgId), `invoice ${i.invoiceNumber}`);
  }
  for (const a of data.assignments) {
    assert.ok(orgs.has(a.organizationId), `assignment ${a.id}`);
  }
  for (const e of data.expenses) {
    assert.ok(orgs.has(e.organizationId), `expense ${e.reference}`);
  }
});

test("every shipment reference resolves", () => {
  const shipments = ids(data.shipments);
  const orders = ids(data.orders);

  for (const s of data.shipments) {
    for (const orderId of s.orderIds) {
      assert.ok(orders.has(orderId), `shipment ${s.shipmentNumber} → ${orderId}`);
    }
  }
  for (const a of data.assignments) {
    assert.ok(shipments.has(a.shipmentId), `assignment ${a.id} → ${a.shipmentId}`);
  }
  for (const i of data.invoices) {
    if (i.shipmentId) {
      assert.ok(shipments.has(i.shipmentId), `invoice ${i.invoiceNumber}`);
    }
  }
  for (const e of data.expenses) {
    assert.ok(shipments.has(e.shipmentId), `expense ${e.reference}`);
  }
  for (const c of data.claims) {
    assert.ok(shipments.has(c.shipmentId), `claim ${c.claimNumber}`);
  }
});

test("quotations point at real orders, and accepted ones at a real option", () => {
  const orders = ids(data.orders);
  for (const q of data.quotations) {
    assert.ok(orders.has(q.orderId), `quotation ${q.quoteNumber} → ${q.orderId}`);
    if (q.acceptance) {
      const optionIds = q.routeOptions.map((r) => r.id);
      assert.ok(
        optionIds.includes(q.acceptance.routeOptionId),
        `${q.quoteNumber} accepted an option that does not exist`,
      );
    }
  }
});

test("payment allocations point at real invoices", () => {
  const invoices = ids(data.invoices);
  for (const p of data.payments) {
    for (const a of p.allocations) {
      assert.ok(invoices.has(a.invoiceId), `${p.reference} → ${a.invoiceId}`);
    }
  }
});

test("documents link to a record that exists", () => {
  const byType: Record<string, Set<string>> = {
    order: ids(data.orders),
    shipment: ids(data.shipments),
    invoice: ids(data.invoices),
    claim: ids(data.claims),
  };
  for (const d of data.documents) {
    assert.ok(
      byType[d.linkedType]?.has(d.linkedId),
      `document ${d.id} → ${d.linkedType}/${d.linkedId}`,
    );
  }
});

test("every actor reference resolves to a profile", () => {
  const people = ids(data.profiles);
  const check = (id: string | null, where: string) => {
    if (id !== null) assert.ok(people.has(id), `${where} → ${id}`);
  };

  for (const s of data.shipments) check(s.coordinatorId, `shipment ${s.shipmentNumber}`);
  for (const i of data.invoices) {
    check(i.preparedById, `invoice ${i.invoiceNumber} preparedBy`);
    check(i.issuedById, `invoice ${i.invoiceNumber} issuedBy`);
  }
  for (const b of data.vendorBills) {
    check(b.preparedById, `bill ${b.billNumber} preparedBy`);
    check(b.approvedById, `bill ${b.billNumber} approvedBy`);
  }
  for (const p of data.payments) {
    check(p.recordedById, `payment ${p.reference} recordedBy`);
    check(p.verifiedById, `payment ${p.reference} verifiedBy`);
  }
});

/* -------------------------------------------------------------------------- */
/* Derived totals                                                             */
/* -------------------------------------------------------------------------- */

const invoiceBy = (n: string) => data.invoices.find((i) => i.invoiceNumber === n)!;

test("invoice totals derive from their own lines", () => {
  const paid = invoiceTotals(invoiceBy("INV-2026-000318"), data.payments);
  assert.equal(paid.subtotal, "417375.00");
  assert.equal(paid.taxTotal, "15997.50");
  assert.equal(paid.total, "433372.50");
  assert.equal(paid.amountPaid, "433372.50");
  assert.equal(paid.balance, "0.00");

  const partial = invoiceTotals(invoiceBy("INV-2026-000341"), data.payments);
  assert.equal(partial.subtotal, "376860.94");
  assert.equal(partial.taxTotal, "12960.00");
  assert.equal(partial.total, "389820.94");
  assert.equal(partial.amountPaid, "168750.00");
  assert.equal(partial.balance, "221070.94");

  const overdue = invoiceTotals(invoiceBy("INV-2026-000352"), data.payments);
  assert.equal(overdue.total, "514755.00");
  assert.equal(overdue.balance, "514755.00");
});

test("subtotal plus tax always equals total, for every invoice", () => {
  for (const invoice of data.invoices) {
    const t = invoiceTotals(invoice, data.payments);
    const sum = (Number(t.subtotal) + Number(t.taxTotal)).toFixed(2);
    assert.equal(
      t.total,
      sum,
      `${invoice.invoiceNumber}: ${t.subtotal} + ${t.taxTotal} != ${t.total}`,
    );
  }
});

test("unverified payments do not reduce a balance", () => {
  // PAY-2026-000802 is submitted but not verified, and allocates to PRO-360.
  const proforma = invoiceBy("PRO-2026-000360");
  const totals = invoiceTotals(proforma, data.payments);
  assert.equal(totals.amountPaid, "0.00", "an unverified payment must not count");
  assert.equal(totals.balance, totals.total);
});

test("an unapplied receipt shows as unallocated", () => {
  const overpaid = data.payments.find((p) => p.reference === "PAY-2026-000815")!;
  assert.equal(paymentUnallocated(overpaid), "281250.00");

  const applied = data.payments.find((p) => p.reference === "PAY-2026-000771")!;
  assert.equal(paymentUnallocated(applied), "0.00");
});

test("settlement nets fees and reimbursements against advances and deductions", () => {
  const totals = settlementTotals(data.settlements[0]);
  assert.equal(totals.feesTotal, "88900.00");
  assert.equal(totals.reimbursementsTotal, "261900.00");
  assert.equal(totals.advancesTotal, "100000.00");
  assert.equal(totals.deductionsTotal, "9600.00");
  // 88,900 + 261,900 − 100,000 − 9,600
  assert.equal(totals.netPayable, "241200.00");
});

test("the duplicate vendor invoice is detected", () => {
  const dup = data.vendorBills.find((b) => b.billNumber === "VB-2026-000515")!;
  const match = duplicateVendorInvoice(dup, data.vendorBills);
  assert.ok(match, "VB-000515 duplicates VB-000501 by vendor invoice number");
  assert.equal(match.billNumber, "VB-2026-000501");

  const unique = data.vendorBills.find((b) => b.billNumber === "VB-2026-000455")!;
  assert.equal(duplicateVendorInvoice(unique, data.vendorBills), null);
});

/* -------------------------------------------------------------------------- */
/* Profitability — §10.3                                                      */
/* -------------------------------------------------------------------------- */

const shipmentBy = (n: string) =>
  data.shipments.find((s) => s.shipmentNumber === n)!;

test("profitability is computed from the records attached to the shipment", () => {
  const fin = shipmentFinancials(shipmentBy("SHP-2026-004150"), data);
  // Revenue is the issued invoice's lines, excluding tax, in pesos.
  assert.equal(fin.customerCharges, "417375.00");
  assert.ok(fin.isBilled);
  // Hapag-Lloyd bill is paid, so it counts as actual vendor cost.
  assert.equal(fin.actualVendorCost, "167625.00");
  assert.ok(Number(fin.agentCost) > 0, "agent fee and reimbursements count");
  assert.ok(fin.profitability.grossMarginPct !== null);
});

test("a pro forma does not recognise revenue", () => {
  // SHP-2026-004203 has only a pro forma against it, still awaiting approval.
  const fin = shipmentFinancials(shipmentBy("SHP-2026-004203"), data);
  assert.equal(fin.customerCharges, "0.00");
  assert.equal(fin.isBilled, false, "a pro forma must not mark a shipment billed");
});

test("a delivered but unbilled shipment shows cost against no revenue", () => {
  const fin = shipmentFinancials(shipmentBy("SHP-2026-004195"), data);
  assert.equal(fin.isBilled, false, "invoice is still for approval");
  assert.ok(
    Number(fin.agentCost) > 0 || Number(fin.actualVendorCost) > 0,
    "cost has been recorded",
  );
  // Margin on zero revenue is not measurable, and must not read as break-even.
  assert.equal(fin.profitability.grossMarginPct, null);
});

test("accruals are counted against margin but reported separately", () => {
  const fin = shipmentFinancials(shipmentBy("SHP-2026-004170"), data);
  assert.equal(fin.accruals, "118125.00", "the destination accrual is recognised");
  // §10.2 — accruing before the vendor's final invoice keeps profit honest.
  assert.ok(
    Number(fin.profitability.grossMarginPct) < 12,
    "margin should sit below the policy floor once the hold's costs accrue",
  );
});

/* -------------------------------------------------------------------------- */
/* Aging                                                                      */
/* -------------------------------------------------------------------------- */

test("aging buckets sum to the total receivable", () => {
  const aging = agingFor(data.invoices, data.payments, "PHP");
  const sum = (
    Number(aging.current) +
    Number(aging.days1to30) +
    Number(aging.days31to60) +
    Number(aging.days61to90) +
    Number(aging.over90)
  ).toFixed(2);
  assert.equal(aging.total, sum);
  assert.ok(aging.openInvoiceCount > 0);
});


/* -------------------------------------------------------------------------- */
/* Operating currency                                                         */
/* -------------------------------------------------------------------------- */

test("everything customer-facing is priced in pesos", () => {
  for (const i of data.invoices) assert.equal(i.currency, "PHP", i.invoiceNumber);
  for (const p of data.payments) assert.equal(p.currency, "PHP", p.reference);
  for (const q of data.quotations) assert.equal(q.currency, "PHP", q.quoteNumber);
  for (const s of data.shipments) assert.equal(s.currency, "PHP", s.shipmentNumber);
  for (const c of data.claims) assert.equal(c.currency, "PHP", c.claimNumber);
});

test("international carrier bills stay in their own currency, with a rate", () => {
  // A Manila forwarder pays Maersk in dollars and bills the customer in pesos.
  // Flattening that away would remove the only real multi-currency case, so
  // carrier bills keep USD and carry the context BR-028 requires.
  const carriers = data.vendorBills.filter((b) => b.vendorType === "carrier");
  assert.ok(carriers.length > 0);

  for (const bill of carriers) {
    assert.equal(bill.currency, "USD", bill.billNumber);
    assert.ok(bill.fx, `${bill.billNumber} must carry an FX context`);
    assert.equal(bill.fx.baseCurrency, "PHP");
    assert.ok(Number(bill.fx.appliedRate) > 0);
    assert.ok(bill.fx.rateSource.length > 0, "the rate needs a stated source");
    assert.ok(bill.fx.rateDate.length > 0, "the rate needs a date");
  }
});

test("converting the currency does not move the margin", () => {
  // A uniform conversion scales revenue and cost together, so the ratio is
  // invariant. If this drifts, the conversion has been applied unevenly —
  // which is precisely the bug that relabelling instead of converting causes.
  const held = data.shipments.find((s) => s.shipmentNumber === "SHP-2026-004170")!;
  const fin = shipmentFinancials(held, data);
  assert.ok(fin.profitability.grossMarginPct !== null);
  assert.ok(
    Math.abs(fin.profitability.grossMarginPct! - -2.7939) < 0.01,
    `margin should be unchanged by the conversion, got ${fin.profitability.grossMarginPct}`,
  );
});

test("the converter leaves nothing behind in dollars", () => {
  // `applyOperatingCurrency` is field-directed: it converts the fields it names
  // and nothing else, so that weights and quantities cannot be caught by a
  // blanket numeric sweep. The cost of that safety is that a field it forgets
  // stays in dollars silently. This sweeps every currency-bearing record and
  // fails if one was missed — the carrier bills being the single exemption.
  const stray: string[] = [];
  const check = (currency: string | null, where: string) => {
    if (currency !== null && currency !== "PHP") stray.push(`${where}=${currency}`);
  };

  for (const o of data.organizations) check(o.creditCurrency ?? null, `org ${o.id}`);
  for (const p of data.profiles) check(p.currency, `profile ${p.id}`);
  for (const o of data.orders) {
    check(o.declaredCurrency ?? null, `order ${o.orderNumber}`);
    for (const i of o.items) check(i.currency, `${o.orderNumber} item ${i.lineNo}`);
  }
  for (const q of data.quotations) {
    check(q.currency, `quote ${q.quoteNumber}`);
    for (const r of q.routeOptions) {
      for (const c of r.charges) check(c.currency, `${q.quoteNumber} charge ${c.id}`);
    }
  }
  for (const s of data.shipments) check(s.currency, `shipment ${s.shipmentNumber}`);
  for (const i of data.invoices) check(i.currency, `invoice ${i.invoiceNumber}`);
  for (const p of data.payments) check(p.currency, `payment ${p.reference}`);
  for (const s of data.settlements) check(s.currency, `settlement ${s.settlementNumber}`);
  for (const e of data.expenses) check(e.currency, `expense ${e.reference}`);
  for (const c of data.allocatableCosts) check(c.currency, `cost ${c.id}`);
  for (const c of data.claims) check(c.currency, `claim ${c.claimNumber}`);
  for (const b of data.vendorBills) {
    if (b.vendorType === "carrier") continue; // the deliberate exemption
    check(b.currency, `bill ${b.billNumber}`);
  }

  assert.deepEqual(stray, [], `these were never converted: ${stray.join(", ")}`);
});

test("a peso record carries no exchange rate", () => {
  // The peso is the base currency, so a peso amount has nothing to convert to.
  // An FX context on one would mean a rate was recorded against itself.
  for (const p of data.payments) assert.equal(p.fx, null, p.reference);
  for (const i of data.invoices) assert.equal(i.fx, null, i.invoiceNumber);
  for (const e of data.expenses) assert.equal(e.fx, null, e.reference);
  for (const s of data.settlements) assert.equal(s.fx, null, s.settlementNumber);
  for (const b of data.vendorBills) {
    if (b.currency === "PHP") assert.equal(b.fx, null, b.billNumber);
  }
});
