/**
 * Finance and operations projection.
 *
 * Internal, so unlike the other two projections these shapes carry cost, margin
 * and partner rates. Nothing is stripped; what changes is that totals, balances,
 * aging, duplicate flags, profitability and the closure checklist are all
 * derived from the records rather than stored beside them.
 */

import type {
  AgentSettlement,
  AllocatableCost,
  CloseCheck,
  CustomerAccount,
  FinanceExpense,
  FinanceInvoice,
  FinancePayment,
  ShipmentCloseCandidate,
  ShipmentProfitability,
  VendorBill,
} from "./types";

import type {
  AgentSettlement as StoreSettlement,
  AllocatableCost as StoreCost,
  Expense as StoreExpense,
  Invoice as StoreInvoice,
  Payment as StorePayment,
  Shipment,
  StoreData,
  VendorBill as StoreBill,
} from "@/lib/store/schema";

import { formatAmount } from "@/lib/domain/money";
import { OPERATING_CURRENCY } from "@/lib/store/currency";
import {
  agingFor,
  duplicateVendorInvoice,
  invoiceTotals,
  paymentUnallocated,
  settlementTotals,
  shipmentFinancials,
  vendorBillBalance,
  vendorBillTotal,
} from "@/lib/store/derive";

const nameOf = (data: StoreData, id: string | null) =>
  id ? (data.profiles.find((p) => p.id === id)?.fullName ?? null) : null;

const orgOf = (data: StoreData, id: string) =>
  data.organizations.find((o) => o.id === id)?.legalName ?? id;

/* -------------------------------------------------------------------------- */
/* Receivables                                                                */
/* -------------------------------------------------------------------------- */

export function projectFinanceInvoice(
  data: StoreData,
  invoice: StoreInvoice,
  today = new Date(),
): FinanceInvoice {
  const totals = invoiceTotals(invoice, data.payments, today);
  const shipment = data.shipments.find((s) => s.id === invoice.shipmentId);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    status: invoice.status,
    customerName: orgOf(data, invoice.customerOrgId),
    customerId: invoice.customerOrgId,
    shipmentId: invoice.shipmentId,
    shipmentNumber: shipment?.shipmentNumber ?? null,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    amountPaid: totals.amountPaid,
    balance: totals.balance,
    lines: invoice.lines,
    preparedById: invoice.preparedById,
    preparedByName: nameOf(data, invoice.preparedById),
    issuedById: invoice.issuedById,
    issuedByName: nameOf(data, invoice.issuedById),
    fx: invoice.fx,
    daysOverdue: totals.daysOverdue,
  };
}

export function projectFinancePayment(
  data: StoreData,
  payment: StorePayment,
): FinancePayment {
  return {
    id: payment.id,
    reference: payment.reference,
    status: payment.status,
    customerName: orgOf(data, payment.customerOrgId),
    customerId: payment.customerOrgId,
    method: payment.method,
    paidAt: payment.paidAt,
    submittedAt: payment.submittedAt,
    amount: payment.amount,
    currency: payment.currency,
    bankReference: payment.bankReference,
    evidenceName: payment.evidenceName,
    allocations: payment.allocations.map((a) => ({
      invoiceId: a.invoiceId,
      invoiceNumber:
        data.invoices.find((i) => i.id === a.invoiceId)?.invoiceNumber ?? a.invoiceId,
      amount: a.amount,
    })),
    unallocated: paymentUnallocated(payment),
    recordedById: payment.recordedById,
    recordedByName: payment.recordedByName,
    verifiedByName: nameOf(data, payment.verifiedById),
    verifiedAt: payment.verifiedAt,
    fx: payment.fx,
  };
}

export function projectCustomerAccount(
  data: StoreData,
  organizationId: string,
  today = new Date(),
): CustomerAccount {
  const org = data.organizations.find((o) => o.id === organizationId);
  const currency = org?.creditCurrency ?? OPERATING_CURRENCY;
  const invoices = data.invoices.filter((i) => i.customerOrgId === organizationId);
  const aging = agingFor(invoices, data.payments, currency, today);

  const limit = org?.creditLimit ? Number(org.creditLimit) : null;
  const balance = Number(aging.total);

  return {
    id: organizationId,
    name: org?.legalName ?? organizationId,
    currency,
    paymentTerms: org?.paymentTerms ?? "—",
    creditLimit: org?.creditLimit ?? null,
    balance: aging.total,
    current: aging.current,
    days1to30: aging.days1to30,
    days31to60: aging.days31to60,
    days61to90: aging.days61to90,
    over90: aging.over90,
    openInvoiceCount: aging.openInvoiceCount,
    oldestDueDate: aging.oldestDueDate,
    creditUsedPct:
      limit && limit > 0 ? Math.round((balance / limit) * 1000) / 10 : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Payables                                                                   */
/* -------------------------------------------------------------------------- */

export function projectVendorBill(data: StoreData, bill: StoreBill): VendorBill {
  const duplicate = duplicateVendorInvoice(bill, data.vendorBills);
  // Only the later record is flagged; the original stands.
  const isLater = duplicate ? bill.billDate >= duplicate.billDate : false;

  return {
    id: bill.id,
    billNumber: bill.billNumber,
    vendorInvoiceNumber: bill.vendorInvoiceNumber,
    vendorName: bill.vendorName,
    vendorType: bill.vendorType,
    status: bill.status,
    shipmentNumbers: bill.shipmentIds.map(
      (id) => data.shipments.find((s) => s.id === id)?.shipmentNumber ?? id,
    ),
    billDate: bill.billDate,
    dueDate: bill.dueDate,
    currency: bill.currency,
    netAmount: bill.netAmount,
    taxAmount: bill.taxAmount,
    total: vendorBillTotal(bill),
    amountPaid: bill.amountPaid,
    balance: vendorBillBalance(bill),
    description: bill.description,
    evidenceName: bill.evidenceName,
    preparedById: bill.preparedById,
    preparedByName: nameOf(data, bill.preparedById),
    approvedByName: nameOf(data, bill.approvedById),
    fx: bill.fx,
    isAccrual: bill.isAccrual,
    duplicateWarning:
      duplicate && isLater
        ? `Vendor invoice ${bill.vendorInvoiceNumber} is already recorded on ${duplicate.billNumber} (${duplicate.status}). Approving this would pay ${bill.vendorName} twice for the same movement.`
        : null,
  };
}

export function projectSettlement(
  data: StoreData,
  settlement: StoreSettlement,
): AgentSettlement {
  const totals = settlementTotals(settlement);

  return {
    id: settlement.id,
    settlementNumber: settlement.settlementNumber,
    agentName: orgOf(data, settlement.agentOrgId),
    agentId: settlement.agentOrgId,
    periodFrom: settlement.periodFrom,
    periodTo: settlement.periodTo,
    status: settlement.status,
    currency: settlement.currency,
    lines: settlement.lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      description: l.description,
      shipmentNumber: l.shipmentId
        ? (data.shipments.find((s) => s.id === l.shipmentId)?.shipmentNumber ?? null)
        : null,
      reference: l.reference,
      amount: l.amount,
    })),
    feesTotal: totals.feesTotal,
    reimbursementsTotal: totals.reimbursementsTotal,
    advancesTotal: totals.advancesTotal,
    deductionsTotal: totals.deductionsTotal,
    netPayable: totals.netPayable,
    preparedById: settlement.preparedById,
    preparedByName: nameOf(data, settlement.preparedById),
    approvedByName: nameOf(data, settlement.approvedById),
    fx: settlement.fx,
  };
}

export function projectFinanceExpense(
  data: StoreData,
  expense: StoreExpense,
): FinanceExpense {
  const shipment = data.shipments.find((s) => s.id === expense.shipmentId);
  return {
    id: expense.id,
    reference: expense.reference,
    source: expense.source,
    submittedByName: expense.submittedByName,
    submittedById: expense.submittedById,
    organizationName: orgOf(data, expense.organizationId),
    shipmentNumber: shipment?.shipmentNumber ?? expense.shipmentId,
    shipmentId: expense.shipmentId,
    description: expense.description,
    chargeCode: expense.chargeCode,
    incurredOn: expense.incurredOn,
    amount: expense.amount,
    currency: expense.currency,
    status: expense.status,
    evidenceName: expense.evidenceName,
    rejectionReason: expense.rejectionReason,
    fx: expense.fx,
  };
}

export function projectAllocatableCost(
  data: StoreData,
  cost: StoreCost,
): AllocatableCost {
  return {
    id: cost.id,
    reference: cost.reference,
    description: cost.description,
    sourceType: cost.sourceType,
    amount: cost.amount,
    currency: cost.currency,
    method: cost.method,
    isAllocated: cost.isAllocated,
    targets: cost.targets.map((t) => ({
      shipmentId: t.shipmentId,
      shipmentNumber:
        data.shipments.find((s) => s.id === t.shipmentId)?.shipmentNumber ??
        t.shipmentId,
      basis: t.basis,
      basisLabel: t.basisLabel,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Profitability                                                              */
/* -------------------------------------------------------------------------- */

export function projectProfitability(
  data: StoreData,
  shipment: Shipment,
): ShipmentProfitability {
  const fin = shipmentFinancials(shipment, data);

  // This shipment's share of costs recorded but not yet allocated. Surfacing it
  // matters: an unallocated cost is real money that the margin does not yet
  // reflect, so a shipment can look profitable purely because nobody has
  // distributed the bill.
  const unallocated = data.allocatableCosts
    .filter(
      (c) => !c.isAllocated && c.targets.some((t) => t.shipmentId === shipment.id),
    )
    .reduce((sum, c) => {
      const share = c.targets.find((t) => t.shipmentId === shipment.id);
      if (!share) return sum;
      const totalBasis = c.targets.reduce((n, t) => n + t.basis, 0) || 1;
      return sum + (Number(c.amount) * share.basis) / totalBasis;
    }, 0);

  return {
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    customerName: orgOf(data, shipment.customerOrgId),
    status: shipment.status,
    currency: fin.currency,
    customerCharges: fin.customerCharges,
    discounts: "0.00",
    credits: "0.00",
    debits: "0.00",
    quotedCost: fin.quotedCost,
    actualVendorCost: fin.actualVendorCost,
    agentCost: fin.agentCost,
    internalDirectCost: fin.internalDirectCost,
    accruals: fin.accruals,
    isBilled: fin.isBilled,
    isClosed: shipment.closedAt !== null,
    unallocatedCost: unallocated.toFixed(2),
  };
}

/* -------------------------------------------------------------------------- */
/* Close — §21, BR-030                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Build the closure checklist from live data.
 *
 * Previously these checks were written out by hand, which meant they could say
 * "invoice settled" while the invoice sat overdue. Deriving them means the
 * blocker list is always the true one, and closing genuinely becomes possible
 * once the underlying records are put right.
 */
export function projectCloseCandidate(
  data: StoreData,
  shipment: Shipment,
  today = new Date(),
): ShipmentCloseCandidate {
  const checks: CloseCheck[] = [];

  const pod = shipment.pod;
  checks.push({
    id: `${shipment.id}-pod`,
    label: "Delivery confirmed with proof of delivery",
    category: "operational",
    passed: pod !== null,
    detail: pod
      ? `POD recorded ${pod.deliveredAt.slice(0, 10)}, received by ${pod.receiverName}.`
      : "No proof of delivery recorded yet.",
  });

  const docs = data.documents.filter(
    (d) => d.linkedType === "shipment" && d.linkedId === shipment.id,
  );
  const badDocs = docs.filter(
    (d) => d.status === "rejected" || d.status === "under_review",
  );
  checks.push({
    id: `${shipment.id}-docs`,
    label: "Required documents verified",
    category: "document",
    passed: docs.length > 0 && badDocs.length === 0,
    detail:
      badDocs.length > 0
        ? `${badDocs.length} document${badDocs.length === 1 ? "" : "s"} still rejected or under review: ${badDocs.map((d) => d.name).join(", ")}.`
        : docs.length === 0
          ? "No documents attached to this shipment."
          : `${docs.length} documents verified.`,
  });

  const invoices = data.invoices.filter(
    (i) => i.shipmentId === shipment.id && i.type !== "proforma",
  );
  const unsettled = invoices.filter((i) => {
    const t = invoiceTotals(i, data.payments, today);
    return Number(t.balance) > 0;
  });
  checks.push({
    id: `${shipment.id}-invoice`,
    label: "Customer invoiced and settled",
    category: "finance",
    passed: invoices.length > 0 && unsettled.length === 0,
    detail:
      invoices.length === 0
        ? "This shipment has not been invoiced."
        : unsettled.length > 0
          ? unsettled
              .map((i) => {
                const t = invoiceTotals(i, data.payments, today);
                return `${i.invoiceNumber} outstanding ${formatAmount(t.balance, i.currency)}`;
              })
              .join("; ")
          : "All invoices settled in full.",
  });

  const bills = data.vendorBills.filter((b) => b.shipmentIds.includes(shipment.id));
  const openBills = bills.filter(
    (b) => b.status === "draft" || b.status === "verified",
  );
  checks.push({
    id: `${shipment.id}-costs`,
    label: "Vendor costs recorded and approved",
    category: "finance",
    passed: bills.length > 0 && openBills.length === 0,
    detail:
      openBills.length > 0
        ? `${openBills.map((b) => `${b.billNumber} (${b.status})`).join(", ")} awaiting approval.`
        : bills.length === 0
          ? "No vendor costs recorded against this shipment."
          : "All vendor bills approved.",
  });

  const settlementsTouching = data.settlements.filter((s) =>
    s.lines.some((l) => l.shipmentId === shipment.id),
  );
  const unapproved = settlementsTouching.filter((s) => s.approvedById === null);
  if (settlementsTouching.length > 0) {
    checks.push({
      id: `${shipment.id}-settlement`,
      label: "Agent settlement approved",
      category: "finance",
      passed: unapproved.length === 0,
      detail:
        unapproved.length > 0
          ? `${unapproved.map((s) => s.settlementNumber).join(", ")} is not yet approved, and carries this shipment's agent fee.`
          : "Agent settlement approved.",
    });
  }

  const openExceptions = data.exceptions.filter(
    (e) =>
      e.shipmentId === shipment.id &&
      !["resolved", "closed"].includes(e.status),
  );
  const openClaims = data.claims.filter(
    (c) => c.shipmentId === shipment.id && c.status !== "closed",
  );
  checks.push({
    id: `${shipment.id}-exceptions`,
    label: "Exceptions and claims resolved",
    category: "exception",
    passed: openExceptions.length === 0 && openClaims.length === 0,
    detail:
      openExceptions.length + openClaims.length > 0
        ? [
            ...openExceptions.map((e) => `${e.exceptionNumber} ${e.status}`),
            ...openClaims.map((c) => `${c.claimNumber} ${c.status}`),
          ].join("; ")
        : "No open exceptions or claims.",
  });

  return {
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    customerName: orgOf(data, shipment.customerOrgId),
    status: shipment.status,
    deliveredAt: shipment.pod?.deliveredAt ?? shipment.ataAt,
    checks,
    canClose: checks.every((c) => c.passed),
  };
}
