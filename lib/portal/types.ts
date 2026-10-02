/**
 * Portal data shapes.
 *
 * These mirror the tables in supabase/migrations/ one for one, including the
 * convention that monetary and quantity values arrive as decimal strings —
 * that is what supabase-js returns for a Postgres `numeric`, and parsing them
 * through lib/domain/money keeps the arithmetic exact.
 *
 * Nothing here carries internal cost or margin. The customer-facing types are
 * the sell-side shapes from `quotation_charges_customer` (BR-008), so there is
 * no cost field for a component to leak by accident.
 */

import type {
  ShippingOrderStatus,
  QuotationStatus,
  ShipmentStatus,
  InvoiceStatus,
  PaymentStatus,
  ClaimStatus,
  DocumentStatus,
  ExceptionStatus,
} from "@/lib/domain/status";
import type { ChargeGroup } from "@/lib/domain/charges";

export type UserRole =
  | "customer_requestor"
  | "customer_approver"
  | "customer_finance";

export type TransportMode =
  | "air"
  | "sea"
  | "road"
  | "rail"
  | "courier"
  | "warehouse_transfer"
  | "other";

export type ServicePriority = "standard" | "express" | "urgent";

/* -------------------------------------------------------------------------- */
/* Orders — §7                                                                */
/* -------------------------------------------------------------------------- */

export interface CargoItem {
  readonly id: string;
  readonly lineNo: number;
  readonly description: string;
  readonly category: string;
  readonly hsCode: string | null;
  readonly originCountry: string | null;
  readonly quantity: string;
  readonly uom: string;
  readonly unitValue: string | null;
  readonly totalValue: string | null;
  readonly currency: string;
  readonly isFragile: boolean;
  readonly isHazardous: boolean;
  readonly isOversized: boolean;
  readonly isHighValue: boolean;
  readonly isControlled: boolean;
  readonly temperatureMinC: string | null;
  readonly temperatureMaxC: string | null;
}

export interface CargoPackage {
  readonly id: string;
  readonly lineNo: number;
  readonly packagingType: string;
  readonly packageCount: number;
  readonly grossWeightKg: string | null;
  readonly netWeightKg: string | null;
  readonly lengthCm: string | null;
  readonly widthCm: string | null;
  readonly heightCm: string | null;
  readonly volumeCbm: string | null;
  readonly marksAndNumbers: string | null;
}

export interface ShippingOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: ShippingOrderStatus;
  readonly customerReference: string | null;
  readonly requestDate: string;
  readonly mode: TransportMode | null;
  readonly serviceType: string | null;
  readonly priority: ServicePriority;
  readonly requestedPickupDate: string | null;
  readonly requestedDeliveryDate: string | null;
  readonly insuranceRequested: boolean;
  readonly supplierName: string | null;
  readonly originLabel: string | null;
  readonly destinationLabel: string | null;
  readonly incoterm: string | null;
  readonly incotermNamedPlace: string | null;
  readonly declaredValue: string | null;
  readonly declaredCurrency: string | null;
  readonly specialInstructions: string | null;
  readonly requiresReview: boolean;
  readonly reviewReason: string | null;
  readonly statusReason: string | null;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  readonly items: readonly CargoItem[];
  readonly packages: readonly CargoPackage[];
  /** Quotation raised against this order, once one exists. */
  readonly quotationId: string | null;
  readonly shipmentIds: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Quotations — §8                                                            */
/* -------------------------------------------------------------------------- */

/** Sell-side only. There is no cost field here by design (BR-008). */
export interface QuotationCharge {
  readonly id: string;
  readonly group: ChargeGroup;
  readonly description: string;
  readonly quantity: string;
  readonly sellAmount: string;
  readonly currency: string;
  readonly isTaxable: boolean;
  readonly taxRatePct: string;
}

export interface RouteOption {
  readonly id: string;
  readonly optionNo: number;
  readonly label: string;
  readonly mode: TransportMode;
  readonly originLabel: string;
  readonly destinationLabel: string;
  readonly transitDaysMin: number | null;
  readonly transitDaysMax: number | null;
  readonly departureFrequency: string | null;
  readonly carrierName: string | null;
  readonly scheduleNote: string | null;
  readonly assumptions: string | null;
  readonly exclusions: string | null;
  readonly isRecommended: boolean;
  readonly charges: readonly QuotationCharge[];
}

export interface Quotation {
  readonly id: string;
  readonly quoteNumber: string;
  readonly status: QuotationStatus;
  readonly versionNo: number;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly currency: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly terms: string | null;
  readonly assumptions: string | null;
  readonly exclusions: string | null;
  readonly releasedAt: string | null;
  readonly routeOptions: readonly RouteOption[];
  readonly acceptance: {
    readonly acceptedByName: string;
    readonly acceptedAt: string;
    readonly routeOptionId: string;
  } | null;
}

/* -------------------------------------------------------------------------- */
/* Shipments — §9                                                             */
/* -------------------------------------------------------------------------- */

export interface ShipmentLeg {
  readonly id: string;
  readonly sequenceNo: number;
  readonly mode: TransportMode;
  readonly originLabel: string;
  readonly destinationLabel: string;
  readonly providerName: string | null;
  readonly plannedDeparture: string | null;
  readonly actualDeparture: string | null;
  readonly plannedArrival: string | null;
  readonly actualArrival: string | null;
  readonly vesselOrFlight: string | null;
  readonly voyageNumber: string | null;
  readonly containerNumber: string | null;
  readonly sealNumber: string | null;
  readonly houseBill: string | null;
  readonly masterBill: string | null;
}

export interface TrackingEvent {
  readonly id: string;
  readonly milestoneCode: string;
  readonly eventTime: string;
  readonly locationText: string | null;
  readonly visibility: "customer" | "internal" | "restricted";
  readonly notes: string | null;
}

export interface ProofOfDelivery {
  readonly receiverName: string;
  readonly deliveredAt: string;
  readonly locationText: string | null;
  readonly quantityReceived: string | null;
  readonly conditionNote: string | null;
  readonly exceptionResult: string | null;
}

export interface Shipment {
  readonly id: string;
  readonly shipmentNumber: string;
  readonly status: ShipmentStatus;
  readonly mode: TransportMode;
  readonly originLabel: string;
  readonly destinationLabel: string;
  readonly etdAt: string | null;
  readonly atdAt: string | null;
  readonly etaAt: string | null;
  readonly ataAt: string | null;
  readonly hasActiveHold: boolean;
  readonly coordinatorName: string | null;
  readonly orderNumbers: readonly string[];
  readonly bookingNumber: string | null;
  readonly bookingConfirmedAt: string | null;
  readonly legs: readonly ShipmentLeg[];
  readonly events: readonly TrackingEvent[];
  readonly pod: ProofOfDelivery | null;
  /** Commercial timestamps feeding the first three customer timeline steps. */
  readonly orderSubmittedAt: string | null;
  readonly quotationAcceptedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Documents — §11                                                            */
/* -------------------------------------------------------------------------- */

export interface DocumentRecord {
  readonly id: string;
  readonly name: string;
  readonly typeCode: string;
  readonly typeName: string;
  readonly category:
    | "commercial"
    | "transport"
    | "customs"
    | "cargo"
    | "finance"
    | "delivery"
    | "claim";
  readonly status: DocumentStatus;
  readonly versionNo: number;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly issueDate: string | null;
  readonly expiryDate: string | null;
  readonly uploadedByName: string;
  readonly uploadedAt: string;
  /** What the document is attached to. */
  readonly linkedType: "order" | "shipment" | "invoice" | "claim";
  readonly linkedId: string;
  readonly linkedLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Finance — §10                                                              */
/* -------------------------------------------------------------------------- */

export interface InvoiceLine {
  readonly id: string;
  readonly description: string;
  readonly chargeGroup: ChargeGroup;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly amount: string;
  readonly taxRatePct: string;
}

export interface Invoice {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly type: "proforma" | "invoice" | "debit_note" | "credit_note";
  readonly status: InvoiceStatus;
  readonly shipmentNumber: string | null;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly currency: string;
  readonly subtotal: string;
  readonly taxTotal: string;
  readonly total: string;
  readonly amountPaid: string;
  readonly balance: string;
  readonly lines: readonly InvoiceLine[];
}

export interface PaymentAllocation {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly amount: string;
}

export interface Payment {
  readonly id: string;
  readonly reference: string;
  readonly status: PaymentStatus;
  readonly method:
    | "bank_transfer"
    | "cheque"
    | "cash"
    | "card"
    | "online_gateway"
    | "offset"
    | "other";
  readonly paidAt: string;
  readonly submittedAt: string;
  readonly verifiedAt: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly bankReference: string | null;
  readonly evidenceName: string | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly rejectionReason: string | null;
}

/* -------------------------------------------------------------------------- */
/* Service — §12, BR-006                                                      */
/* -------------------------------------------------------------------------- */

export interface Claim {
  readonly id: string;
  readonly claimNumber: string;
  readonly status: ClaimStatus;
  readonly shipmentNumber: string;
  readonly basis: string;
  readonly description: string;
  readonly claimedAmount: string;
  readonly settledAmount: string | null;
  readonly currency: string;
  readonly incidentDate: string;
  readonly submittedAt: string | null;
  readonly decisionNote: string | null;
  readonly documentIds: readonly string[];
}

export interface ExceptionRecord {
  readonly id: string;
  readonly exceptionNumber: string;
  readonly status: ExceptionStatus;
  readonly type:
    | "cargo"
    | "schedule"
    | "documentation"
    | "customs"
    | "commercial"
    | "delivery"
    | "system";
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly shipmentNumber: string | null;
  readonly detectedAt: string;
  readonly targetResolutionAt: string | null;
  /** §12.1 — the customer-visible statement, never the internal notes. */
  readonly customerStatement: string;
  readonly ownerName: string | null;
}

export interface Message {
  readonly id: string;
  readonly authorName: string;
  readonly authorSide: "speedmax" | "customer";
  readonly body: string;
  readonly sentAt: string;
  readonly attachmentNames: readonly string[];
}

export interface MessageThread {
  readonly id: string;
  readonly subject: string;
  readonly linkedType: "order" | "shipment" | "invoice" | "claim";
  readonly linkedLabel: string;
  readonly lastMessageAt: string;
  readonly unreadCount: number;
  readonly messages: readonly Message[];
}

/* -------------------------------------------------------------------------- */
/* Company profile                                                            */
/* -------------------------------------------------------------------------- */

export interface CompanyContact {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly jobTitle: string | null;
  readonly role: UserRole;
  readonly isActive: boolean;
}

export interface CompanyAddress {
  readonly id: string;
  readonly label: string;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly stateRegion: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly isPickup: boolean;
  readonly isDelivery: boolean;
  readonly isBilling: boolean;
}

export interface CompanyProfile {
  readonly id: string;
  readonly legalName: string;
  readonly tradingName: string | null;
  readonly registrationNo: string | null;
  readonly taxId: string | null;
  readonly countryCode: string;
  readonly website: string | null;
  readonly paymentTerms: string | null;
  readonly creditLimit: string | null;
  readonly creditCurrency: string | null;
  readonly addresses: readonly CompanyAddress[];
  readonly contacts: readonly CompanyContact[];
}
