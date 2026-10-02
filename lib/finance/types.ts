/**
 * Finance workspace data shapes.
 *
 * This is the internal projection, so unlike the customer and agent types these
 * carry cost, margin and partner rates. Money and quantities remain decimal
 * strings, matching what Postgres `numeric` returns.
 *
 * BR-028 shows up throughout: any transaction that is not in the base currency
 * carries its transaction currency, the applied rate, the base-currency amount,
 * and where the rate came from. A converted figure without its rate and source
 * is not auditable, so those fields travel together or not at all.
 */

import type {
  InvoiceStatus,
  PaymentStatus,
  VendorBillStatus,
  ShipmentStatus,
} from "@/lib/domain/status";
import type { AllocationMethod, ChargeGroup } from "@/lib/domain/charges";

/* -------------------------------------------------------------------------- */
/* FX — BR-028                                                                */
/* -------------------------------------------------------------------------- */

export interface FxContext {
  readonly transactionCurrency: string;
  readonly baseCurrency: string;
  /** Rate actually applied to this transaction. */
  readonly appliedRate: string;
  /** Reference rate on the date, for variance reporting. */
  readonly referenceRate: string | null;
  readonly baseAmount: string;
  readonly rateSource: string;
  readonly rateDate: string;
}

/* -------------------------------------------------------------------------- */
/* Accounts receivable — §10.1                                                */
/* -------------------------------------------------------------------------- */

export interface FinanceInvoiceLine {
  readonly id: string;
  readonly description: string;
  readonly chargeGroup: ChargeGroup;
  readonly chargeCode: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly amount: string;
  readonly taxRatePct: string;
}

export interface FinanceInvoice {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly type: "proforma" | "invoice" | "debit_note" | "credit_note";
  readonly status: InvoiceStatus;
  readonly customerName: string;
  readonly customerId: string;
  readonly shipmentId: string | null;
  readonly shipmentNumber: string | null;
  readonly issueDate: string | null;
  readonly dueDate: string;
  readonly currency: string;
  readonly subtotal: string;
  readonly taxTotal: string;
  readonly total: string;
  readonly amountPaid: string;
  readonly balance: string;
  readonly lines: readonly FinanceInvoiceLine[];
  /** Who prepared it — drives the §13 separation check on issuing. */
  readonly preparedById: string | null;
  readonly preparedByName: string | null;
  readonly issuedById: string | null;
  readonly issuedByName: string | null;
  readonly fx: FxContext | null;
  /** Days past due; negative means not yet due. */
  readonly daysOverdue: number;
}

export interface FinancePaymentAllocation {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly amount: string;
}

export interface FinancePayment {
  readonly id: string;
  readonly reference: string;
  readonly status: PaymentStatus;
  readonly customerName: string;
  readonly customerId: string;
  readonly method: string;
  readonly paidAt: string;
  readonly submittedAt: string;
  readonly amount: string;
  readonly currency: string;
  readonly bankReference: string | null;
  readonly evidenceName: string | null;
  readonly allocations: readonly FinancePaymentAllocation[];
  /** Unallocated remainder — an overpayment or a payment not yet applied. */
  readonly unallocated: string;
  readonly recordedById: string | null;
  readonly recordedByName: string | null;
  readonly verifiedByName: string | null;
  readonly verifiedAt: string | null;
  readonly fx: FxContext | null;
}

export interface CustomerAccount {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly paymentTerms: string;
  readonly creditLimit: string | null;
  /** Total unpaid across issued invoices. */
  readonly balance: string;
  /** Aging buckets, §20 AR aging. */
  readonly current: string;
  readonly days1to30: string;
  readonly days31to60: string;
  readonly days61to90: string;
  readonly over90: string;
  readonly openInvoiceCount: number;
  readonly oldestDueDate: string | null;
  /** Balance as a percentage of the credit limit, null when no limit is set. */
  readonly creditUsedPct: number | null;
}

/* -------------------------------------------------------------------------- */
/* Accounts payable — §10.2                                                   */
/* -------------------------------------------------------------------------- */

export interface VendorBill {
  readonly id: string;
  readonly billNumber: string;
  /** The vendor's own invoice number — duplicate-checked per §10.2. */
  readonly vendorInvoiceNumber: string;
  readonly vendorName: string;
  readonly vendorType: "carrier" | "agent" | "broker" | "warehouse" | "transporter" | "other";
  readonly status: VendorBillStatus;
  readonly shipmentNumbers: readonly string[];
  readonly billDate: string;
  readonly dueDate: string;
  readonly currency: string;
  readonly netAmount: string;
  readonly taxAmount: string;
  readonly total: string;
  readonly amountPaid: string;
  readonly balance: string;
  readonly description: string;
  readonly evidenceName: string | null;
  readonly preparedById: string | null;
  readonly preparedByName: string | null;
  readonly approvedByName: string | null;
  readonly fx: FxContext | null;
  /** True when this is an accrual pending the vendor's final invoice (§10.2). */
  readonly isAccrual: boolean;
  readonly duplicateWarning: string | null;
}

/**
 * Agent settlement — §10.2: fees, advances, reimbursements, deductions, balance.
 *
 * Modelled as its own record rather than a vendor bill because the arithmetic
 * differs: an agent settlement nets what we owe them against what they hold of
 * ours, and the net can land either way.
 */
export interface SettlementLine {
  readonly id: string;
  readonly kind: "fee" | "reimbursement" | "advance" | "deduction";
  readonly description: string;
  readonly shipmentNumber: string | null;
  readonly reference: string | null;
  readonly amount: string;
}

export interface AgentSettlement {
  readonly id: string;
  readonly settlementNumber: string;
  readonly agentName: string;
  readonly agentId: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly status: VendorBillStatus;
  readonly currency: string;
  readonly lines: readonly SettlementLine[];
  readonly feesTotal: string;
  readonly reimbursementsTotal: string;
  readonly advancesTotal: string;
  readonly deductionsTotal: string;
  /** Positive means Speedmax owes the agent; negative means the reverse. */
  readonly netPayable: string;
  readonly preparedById: string | null;
  readonly preparedByName: string | null;
  readonly approvedByName: string | null;
  readonly fx: FxContext | null;
}

export interface FinanceExpense {
  readonly id: string;
  readonly reference: string;
  readonly source: "agent" | "internal";
  readonly submittedByName: string;
  readonly submittedById: string | null;
  readonly organizationName: string;
  readonly shipmentNumber: string;
  readonly shipmentId: string;
  readonly description: string;
  readonly chargeCode: string;
  readonly incurredOn: string;
  readonly amount: string;
  readonly currency: string;
  readonly status: VendorBillStatus;
  readonly evidenceName: string | null;
  readonly rejectionReason: string | null;
  readonly fx: FxContext | null;
}

/* -------------------------------------------------------------------------- */
/* Allocation and profitability — §10.3, §10.4                                */
/* -------------------------------------------------------------------------- */

export interface AllocatableCost {
  readonly id: string;
  readonly reference: string;
  readonly description: string;
  readonly sourceType: "vendor_bill" | "expense" | "settlement";
  readonly amount: string;
  readonly currency: string;
  readonly method: AllocationMethod;
  /** Shipments the cost is spread across, with the basis for each. */
  readonly targets: readonly {
    readonly shipmentId: string;
    readonly shipmentNumber: string;
    readonly basis: number;
    readonly basisLabel: string;
  }[];
  readonly isAllocated: boolean;
}

export interface ShipmentProfitability {
  readonly shipmentId: string;
  readonly shipmentNumber: string;
  readonly customerName: string;
  readonly status: ShipmentStatus;
  readonly currency: string;

  /** Revenue side — §10.3. */
  readonly customerCharges: string;
  readonly discounts: string;
  readonly credits: string;
  readonly debits: string;

  /** Cost side — §10.3, with quoted kept for variance against actual. */
  readonly quotedCost: string;
  readonly actualVendorCost: string;
  readonly agentCost: string;
  readonly internalDirectCost: string;
  readonly accruals: string;

  readonly isBilled: boolean;
  readonly isClosed: boolean;
  /** Costs recorded but not yet allocated to this shipment. */
  readonly unallocatedCost: string;
}

/* -------------------------------------------------------------------------- */
/* Close — §21, §25.3                                                         */
/* -------------------------------------------------------------------------- */

export interface CloseCheck {
  readonly id: string;
  readonly label: string;
  readonly category: "operational" | "document" | "finance" | "exception";
  readonly passed: boolean;
  readonly detail: string;
}

export interface ShipmentCloseCandidate {
  readonly shipmentId: string;
  readonly shipmentNumber: string;
  readonly customerName: string;
  readonly status: ShipmentStatus;
  readonly deliveredAt: string | null;
  readonly checks: readonly CloseCheck[];
  readonly canClose: boolean;
}
