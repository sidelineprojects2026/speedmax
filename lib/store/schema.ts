/**
 * Canonical store schema.
 *
 * One record per real-world fact. Before this existed, the same shipment was
 * hand-copied into three fixture modules — one per portal — which was harmless
 * only because everything was read-only. Under mutation those copies drift
 * apart within a single click, so there is now exactly one `Shipment`, one
 * `Invoice`, one `Expense`, and the portals read *projections* of them.
 *
 * The projections mirror the RLS policies already written in
 * supabase/migrations/0004–0005: customers see their own organisation without
 * cost, agents see assigned shipments without customer pricing, finance and
 * operations see everything. When Supabase arrives, this module is what gets
 * replaced; the projection signatures stay put.
 *
 * Conventions, matching what Postgres would hand back:
 *  - money, weights, volumes and rates are decimal STRINGS, never numbers
 *  - timestamps are ISO 8601 strings in UTC
 *  - nothing is hard-deleted; records move to a terminal status instead
 */

import type {
  ShippingOrderStatus,
  QuotationStatus,
  BookingStatus,
  ShipmentStatus,
  InvoiceStatus,
  PaymentStatus,
  VendorBillStatus,
  ExceptionStatus,
  ClaimStatus,
  DocumentStatus,
} from "@/lib/domain/status";
import type { AllocationMethod, ChargeGroup } from "@/lib/domain/charges";
import type { AssignmentRole } from "@/lib/domain/milestones";

export type TransportMode =
  | "air"
  | "sea"
  | "road"
  | "rail"
  | "courier"
  | "warehouse_transfer"
  | "other";

export type ServicePriority = "standard" | "express" | "urgent";
export type Visibility = "customer" | "internal" | "restricted";
export type OrgType =
  | "speedmax"
  | "customer"
  | "supplier"
  | "agent"
  | "carrier"
  | "broker"
  | "warehouse"
  | "transporter";

/** Every role across all four surfaces, so one identity model serves all. */
export type UserRole =
  // customer
  | "customer_requestor"
  | "customer_approver"
  | "customer_finance"
  // partner
  | "agent_operator"
  | "agent_manager"
  // internal
  | "ops_coordinator"
  | "pricing_officer"
  | "billing_officer"
  | "collection_officer"
  | "accounts_payable"
  | "finance_approver"
  | "finance_manager"
  | "admin";

/* -------------------------------------------------------------------------- */
/* Party                                                                      */
/* -------------------------------------------------------------------------- */

export interface Organization {
  id: string;
  orgType: OrgType;
  legalName: string;
  tradingName: string | null;
  registrationNo: string | null;
  taxId: string | null;
  countryCode: string;
  website: string | null;
  paymentTerms: string | null;
  creditLimit: string | null;
  creditCurrency: string | null;
  baseLocation: string | null;
  isActive: boolean;
}

export interface Address {
  id: string;
  organizationId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string;
  isPickup: boolean;
  isDelivery: boolean;
  isBilling: boolean;
}

export interface Profile {
  id: string;
  organizationId: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  timezone: string;
  locale: string;
  /** Currency this person's workspace reports in. */
  currency: string;
  isActive: boolean;
}

/* -------------------------------------------------------------------------- */
/* Orders — §7                                                                */
/* -------------------------------------------------------------------------- */

export interface CargoItem {
  id: string;
  lineNo: number;
  description: string;
  category: string;
  hsCode: string | null;
  originCountry: string | null;
  quantity: string;
  uom: string;
  unitValue: string | null;
  totalValue: string | null;
  currency: string;
  isFragile: boolean;
  isHazardous: boolean;
  isOversized: boolean;
  isHighValue: boolean;
  isControlled: boolean;
  temperatureMinC: string | null;
  temperatureMaxC: string | null;
}

export interface CargoPackage {
  id: string;
  lineNo: number;
  packagingType: string;
  packageCount: number;
  grossWeightKg: string | null;
  netWeightKg: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumeCbm: string | null;
  marksAndNumbers: string | null;
}

export interface ShippingOrder {
  id: string;
  orderNumber: string;
  status: ShippingOrderStatus;
  customerOrgId: string;
  requestorId: string | null;
  customerReference: string | null;
  requestDate: string;
  mode: TransportMode | null;
  serviceType: string | null;
  priority: ServicePriority;
  requestedPickupDate: string | null;
  requestedDeliveryDate: string | null;
  insuranceRequested: boolean;
  supplierName: string | null;
  originLabel: string | null;
  destinationLabel: string | null;
  incoterm: string | null;
  incotermNamedPlace: string | null;
  declaredValue: string | null;
  declaredCurrency: string | null;
  specialInstructions: string | null;
  requiresReview: boolean;
  reviewReason: string | null;
  statusReason: string | null;
  submittedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: CargoItem[];
  packages: CargoPackage[];
  /** Set when a public enquiry was converted into this order. */
  sourceEnquiryId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Quotations — §8                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A charge line carries BOTH cost and sell. The customer projection strips
 * `costAmount`; it is never sent to a customer surface (BR-008).
 */
export interface QuotationCharge {
  id: string;
  group: ChargeGroup;
  chargeCode: string;
  description: string;
  quantity: string;
  costAmount: string;
  sellAmount: string;
  currency: string;
  isTaxable: boolean;
  taxRatePct: string;
}

export interface RouteOption {
  id: string;
  optionNo: number;
  label: string;
  mode: TransportMode;
  originLabel: string;
  destinationLabel: string;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  departureFrequency: string | null;
  carrierName: string | null;
  scheduleNote: string | null;
  assumptions: string | null;
  exclusions: string | null;
  isRecommended: boolean;
  charges: QuotationCharge[];
}

export interface QuotationAcceptance {
  acceptedById: string;
  acceptedByName: string;
  acceptedAt: string;
  routeOptionId: string;
  acceptedTerms: string;
  evidenceNote: string | null;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  status: QuotationStatus;
  versionNo: number;
  orderId: string;
  customerOrgId: string;
  currency: string;
  validFrom: string;
  validUntil: string;
  terms: string | null;
  assumptions: string | null;
  exclusions: string | null;
  preparedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  escalated: boolean;
  escalationReason: string | null;
  routeOptions: RouteOption[];
  acceptance: QuotationAcceptance | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Execution — §9                                                             */
/* -------------------------------------------------------------------------- */

export interface ShipmentLeg {
  id: string;
  sequenceNo: number;
  mode: TransportMode;
  originLabel: string;
  destinationLabel: string;
  providerName: string | null;
  plannedDeparture: string | null;
  actualDeparture: string | null;
  plannedArrival: string | null;
  actualArrival: string | null;
  bookingNumber: string | null;
  vesselOrFlight: string | null;
  voyageNumber: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  houseBill: string | null;
  masterBill: string | null;
  visibility: Visibility;
}

/** Append-only (§9.4). Corrections insert a superseding row. */
export interface TrackingEvent {
  id: string;
  milestoneCode: string;
  eventTime: string;
  recordedAt: string;
  locationText: string | null;
  source:
    | "manual"
    | "partner"
    | "carrier_api"
    | "gps_iot"
    | "email_ingestion"
    | "batch_import";
  visibility: Visibility;
  notes: string | null;
  postedById: string | null;
  postedByName: string;
  correctsEventId: string | null;
  correctionReason: string | null;
  isSuperseded: boolean;
}

export interface ProofOfDelivery {
  receiverName: string;
  deliveredAt: string;
  locationText: string | null;
  quantityReceived: string | null;
  conditionNote: string | null;
  exceptionResult: string | null;
  recordedByName: string;
}

export interface Booking {
  id: string;
  bookingRef: string;
  status: BookingStatus;
  carrierName: string | null;
  carrierBookingNumber: string | null;
  cutoffAt: string | null;
  etdAt: string | null;
  etaAt: string | null;
  freeTimeDays: number | null;
  /** The six §8.3 release conditions. */
  acceptanceConfirmed: boolean;
  paymentConditionMet: boolean;
  cargoReadyConfirmed: boolean;
  documentsReady: boolean;
  overrideById: string | null;
  overrideReason: string | null;
  rebookedFromId: string | null;
  failureReason: string | null;
  confirmedById: string | null;
  confirmedAt: string | null;
}

export interface AssignmentTask {
  id: string;
  title: string;
  detail: string | null;
  dueAt: string | null;
  completedAt: string | null;
  completedById: string | null;
  milestoneCode: string | null;
}

export interface Assignment {
  id: string;
  shipmentId: string;
  organizationId: string;
  role: AssignmentRole;
  isPrimary: boolean;
  instructions: string;
  deliverables: string[];
  dueAt: string | null;
  feeAmount: string | null;
  feeCurrency: string | null;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
  tasks: AssignmentTask[];
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  customerOrgId: string;
  mode: TransportMode;
  originLabel: string;
  destinationLabel: string;
  etdAt: string | null;
  atdAt: string | null;
  etaAt: string | null;
  ataAt: string | null;
  coordinatorId: string | null;
  /** Many-to-many, which is what makes split and consolidation representable. */
  orderIds: string[];
  legs: ShipmentLeg[];
  events: TrackingEvent[];
  pod: ProofOfDelivery | null;
  booking: Booking | null;
  cargoSummary: string;
  packageCount: number;
  grossWeightKg: string | null;
  volumeCbm: string | null;
  handlingFlags: string[];
  /** Priced cost from the accepted quotation, for variance reporting. */
  quotedCost: string;
  internalDirectCost: string;
  currency: string;
  closedAt: string | null;
  closedById: string | null;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Documents — §11                                                            */
/* -------------------------------------------------------------------------- */

export interface DocumentVersion {
  versionNo: number;
  fileName: string;
  storedPath: string | null;
  sizeBytes: number;
  mimeType: string;
  uploadedById: string | null;
  uploadedByName: string;
  uploadedAt: string;
}

export interface StoredDocument {
  id: string;
  name: string;
  typeCode: string;
  typeName: string;
  category:
    | "commercial"
    | "transport"
    | "customs"
    | "cargo"
    | "finance"
    | "delivery"
    | "claim";
  status: DocumentStatus;
  visibility: Visibility;
  ownerOrgId: string;
  linkedType: "order" | "shipment" | "invoice" | "claim";
  linkedId: string;
  issueDate: string | null;
  expiryDate: string | null;
  rejectionReason: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  versions: DocumentVersion[];
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Finance — §10                                                              */
/* -------------------------------------------------------------------------- */

export interface FxContext {
  transactionCurrency: string;
  baseCurrency: string;
  appliedRate: string;
  referenceRate: string | null;
  baseAmount: string;
  rateSource: string;
  rateDate: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  chargeGroup: ChargeGroup;
  chargeCode: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  taxRatePct: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: "proforma" | "invoice" | "debit_note" | "credit_note";
  status: InvoiceStatus;
  customerOrgId: string;
  shipmentId: string | null;
  issueDate: string | null;
  dueDate: string;
  currency: string;
  lines: InvoiceLine[];
  preparedById: string | null;
  issuedById: string | null;
  issuedAt: string | null;
  fx: FxContext | null;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  invoiceId: string;
  amount: string;
}

export interface Payment {
  id: string;
  reference: string;
  status: PaymentStatus;
  customerOrgId: string;
  method:
    | "bank_transfer"
    | "cheque"
    | "cash"
    | "card"
    | "online_gateway"
    | "offset"
    | "other";
  paidAt: string;
  submittedAt: string;
  amount: string;
  currency: string;
  bankReference: string | null;
  evidenceDocumentId: string | null;
  evidenceName: string | null;
  allocations: PaymentAllocation[];
  recordedById: string | null;
  recordedByName: string;
  verifiedById: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  fx: FxContext | null;
}

export interface VendorBill {
  id: string;
  billNumber: string;
  vendorInvoiceNumber: string;
  vendorOrgId: string | null;
  vendorName: string;
  vendorType: "carrier" | "agent" | "broker" | "warehouse" | "transporter" | "other";
  status: VendorBillStatus;
  shipmentIds: string[];
  billDate: string;
  dueDate: string;
  currency: string;
  netAmount: string;
  taxAmount: string;
  amountPaid: string;
  description: string;
  evidenceName: string | null;
  preparedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  isAccrual: boolean;
  fx: FxContext | null;
  statusReason: string | null;
}

export interface SettlementLine {
  id: string;
  kind: "fee" | "reimbursement" | "advance" | "deduction";
  description: string;
  shipmentId: string | null;
  reference: string | null;
  amount: string;
}

export interface AgentSettlement {
  id: string;
  settlementNumber: string;
  agentOrgId: string;
  periodFrom: string;
  periodTo: string;
  status: VendorBillStatus;
  currency: string;
  lines: SettlementLine[];
  preparedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  fx: FxContext | null;
}

export interface Expense {
  id: string;
  reference: string;
  source: "agent" | "internal";
  organizationId: string;
  shipmentId: string;
  description: string;
  chargeCode: string;
  incurredOn: string;
  amount: string;
  currency: string;
  status: VendorBillStatus;
  evidenceName: string | null;
  submittedById: string | null;
  submittedByName: string;
  submittedAt: string | null;
  approvedById: string | null;
  settledAt: string | null;
  rejectionReason: string | null;
  fx: FxContext | null;
}

/** A cost awaiting distribution across shipments (§10.4). */
export interface AllocatableCost {
  id: string;
  reference: string;
  description: string;
  sourceType: "vendor_bill" | "expense" | "settlement";
  sourceId: string | null;
  amount: string;
  currency: string;
  method: AllocationMethod;
  targets: { shipmentId: string; basis: number; basisLabel: string }[];
  isAllocated: boolean;
  allocatedAt: string | null;
  allocatedById: string | null;
}

/* -------------------------------------------------------------------------- */
/* Service — §12, BR-006                                                      */
/* -------------------------------------------------------------------------- */

export interface Claim {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  customerOrgId: string;
  shipmentId: string;
  basis: string;
  description: string;
  claimedAmount: string;
  settledAmount: string | null;
  currency: string;
  incidentDate: string;
  submittedAt: string | null;
  decisionNote: string | null;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExceptionRecord {
  id: string;
  exceptionNumber: string;
  status: ExceptionStatus;
  type:
    | "cargo"
    | "schedule"
    | "documentation"
    | "customs"
    | "commercial"
    | "delivery"
    | "system";
  severity: "low" | "medium" | "high" | "critical";
  shipmentId: string | null;
  orderId: string | null;
  detectedAt: string;
  targetResolutionAt: string | null;
  /** §12.1 keeps these strictly apart. */
  customerStatement: string;
  internalNotes: string;
  ownerId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  authorId: string | null;
  authorName: string;
  authorSide: "speedmax" | "customer" | "agent";
  body: string;
  sentAt: string;
  attachmentNames: string[];
  readBy: string[];
}

export interface MessageThread {
  id: string;
  subject: string;
  /** BR-006 — threads are scoped to an audience. */
  audience: "customer" | "agent" | "internal";
  participantOrgIds: string[];
  linkedType: "order" | "shipment" | "invoice" | "claim";
  linkedId: string;
  linkedLabel: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

/** Public enquiry from the marketing quote form. */
export interface QuoteEnquiry {
  id: string;
  reference: string;
  company: string;
  contactName: string;
  email: string;
  phone: string | null;
  mode: string | null;
  priority: string | null;
  incoterm: string | null;
  origin: string;
  destination: string;
  cargoDescription: string;
  grossWeightKg: string | null;
  volumeCbm: string | null;
  packageCount: number | null;
  readyDate: string | null;
  handlingFlags: string[];
  notes: string | null;
  isHandled: boolean;
  handledById: string | null;
  handledAt: string | null;
  convertedOrderId: string | null;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Audit — §17.2                                                              */
/* -------------------------------------------------------------------------- */

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  occurredAt: string;
  /** Mandatory for reject, override, reverse, credit, cancel and reopen. */
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/* -------------------------------------------------------------------------- */
/* Root                                                                       */
/* -------------------------------------------------------------------------- */

export interface StoreData {
  /** Bumped when the schema changes so a stale file re-seeds rather than break. */
  version: number;
  seededAt: string;
  counters: Record<string, number>;
  organizations: Organization[];
  addresses: Address[];
  profiles: Profile[];
  orders: ShippingOrder[];
  quotations: Quotation[];
  shipments: Shipment[];
  assignments: Assignment[];
  documents: StoredDocument[];
  invoices: Invoice[];
  payments: Payment[];
  vendorBills: VendorBill[];
  settlements: AgentSettlement[];
  expenses: Expense[];
  allocatableCosts: AllocatableCost[];
  claims: Claim[];
  exceptions: ExceptionRecord[];
  threads: MessageThread[];
  enquiries: QuoteEnquiry[];
  audit: AuditEntry[];
}

export const STORE_VERSION = 3;
