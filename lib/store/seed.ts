/**
 * The one seed dataset.
 *
 * This replaces `lib/portal/fixtures.ts`, `lib/agent/fixtures.ts` and
 * `lib/finance/fixtures.ts`, which each held their own copy of the same
 * shipments, invoices and expenses. Those copies agreed only because they were
 * tuned by hand; here each fact exists once and every portal projects it.
 *
 * The data is deliberately not all-green. It carries a quotation awaiting the
 * customer, an order returned for missing dangerous-goods paperwork, a shipment
 * under customs hold with margin eroded below the floor, a delivered-but-
 * unbilled shipment, a partially paid invoice, an overdue invoice, an
 * unallocated overpayment, a duplicate vendor invoice, a reversed expense and a
 * claim under review — because those are the screens that need to work.
 */

import type { ChargeGroup } from "@/lib/domain/charges";
import { applyOperatingCurrency } from "./currency";
import { NOW, ORG, USER } from "./ids";
import { STORE_VERSION, type StoreData } from "./schema";
import type {
  Address,
  AgentSettlement,
  AllocatableCost,
  Assignment,
  Claim,
  Expense,
  ExceptionRecord,
  Invoice,
  MessageThread,
  Organization,
  Payment,
  Profile,
  Quotation,
  Shipment,
  ShippingOrder,
  StoredDocument,
  VendorBill,
} from "./schema";


/* -------------------------------------------------------------------------- */
/* Organisations                                                              */
/* -------------------------------------------------------------------------- */

function org(
  id: string,
  orgType: Organization["orgType"],
  legalName: string,
  extra: Partial<Organization> = {},
): Organization {
  return {
    id,
    orgType,
    legalName,
    tradingName: null,
    registrationNo: null,
    taxId: null,
    countryCode: "PH",
    website: null,
    paymentTerms: null,
    creditLimit: null,
    creditCurrency: null,
    baseLocation: null,
    isActive: true,
    ...extra,
  };
}

const organizations: Organization[] = [
  org(ORG.speedmax, "speedmax", "Speedmax Intl. Cargo Solutions Corp", {
    tradingName: "Speedmax",
    baseLocation: "Metro Manila, Philippines",
  }),
  org(ORG.northwind, "customer", "Northwind Trading Corporation", {
    tradingName: "Northwind Trading",
    registrationNo: "CS201704482",
    taxId: "008-442-119-000",
    website: "https://northwind-trading.example",
    paymentTerms: "Net 30 days from invoice date",
    creditLimit: "150000.00",
    creditCurrency: "USD",
  }),
  org(ORG.vertex, "customer", "Vertex Industrial Supply Inc", {
    paymentTerms: "Net 30 days",
    creditLimit: "80000.00",
    creditCurrency: "USD",
  }),
  org(ORG.luzon, "customer", "Luzon Ceramics Export Corp", {
    paymentTerms: "50% deposit, balance on delivery",
  }),
  org(ORG.pacificrim, "agent", "Pacific Rim Logistics Services", {
    baseLocation: "Manila, Philippines",
  }),
  org("org-ningbo", "supplier", "Ningbo Fastening Industries Ltd", { countryCode: "CN" }),
  org("org-shenzhen", "supplier", "Shenzhen Precision Components Co", { countryCode: "CN" }),
  org("org-qingdao", "supplier", "Qingdao Coatings Group", { countryCode: "CN" }),
  org("org-busan", "supplier", "Busan Metals Trading Co", { countryCode: "KR" }),
  org("org-maersk", "carrier", "Maersk Line", { countryCode: "DK" }),
  org("org-pal", "carrier", "Philippine Airlines Cargo"),
  org("org-hapag", "carrier", "Hapag-Lloyd", { countryCode: "DE" }),
  org("org-evergreen", "carrier", "Evergreen Line", { countryCode: "TW" }),
];

const addresses: Address[] = [
  {
    id: "addr-1",
    organizationId: ORG.northwind,
    label: "Head office",
    line1: "18F Cyberscape Beta, Topaz Road",
    line2: "Ortigas Center",
    city: "Pasig City",
    stateRegion: "Metro Manila",
    postalCode: "1605",
    countryCode: "PH",
    isPickup: false,
    isDelivery: false,
    isBilling: true,
  },
  {
    id: "addr-2",
    organizationId: ORG.northwind,
    label: "Valenzuela distribution centre",
    line1: "Lot 7, Karuhatan Industrial Park",
    line2: null,
    city: "Valenzuela City",
    stateRegion: "Metro Manila",
    postalCode: "1441",
    countryCode: "PH",
    isPickup: false,
    isDelivery: true,
    isBilling: false,
  },
  {
    id: "addr-3",
    organizationId: ORG.northwind,
    label: "Cebu branch warehouse",
    line1: "Block 4, Mandaue Reclamation Area",
    line2: null,
    city: "Mandaue City",
    stateRegion: "Cebu",
    postalCode: "6014",
    countryCode: "PH",
    isPickup: false,
    isDelivery: true,
    isBilling: false,
  },
];

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

function profile(
  id: string,
  organizationId: string,
  role: Profile["role"],
  fullName: string,
  email: string,
  jobTitle: string,
  extra: Partial<Profile> = {},
): Profile {
  return {
    id,
    organizationId,
    role,
    fullName,
    email,
    phone: null,
    jobTitle,
    timezone: "Asia/Manila",
    locale: "en-PH",
    currency: "USD",
    isActive: true,
    ...extra,
  };
}

const profiles: Profile[] = [
  profile(USER.marisol, ORG.northwind, "customer_approver", "Marisol Reyes", "marisol.reyes@northwind-trading.example", "Import Manager", { phone: "+63 917 000 0001" }),
  profile(USER.ferdinand, ORG.northwind, "customer_requestor", "Ferdinand Cruz", "ferdinand.cruz@northwind-trading.example", "Logistics Coordinator", { phone: "+63 917 000 0002" }),
  profile(USER.grace, ORG.northwind, "customer_finance", "Grace Tan", "grace.tan@northwind-trading.example", "Finance Officer", { phone: "+63 917 000 0003" }),
  profile(USER.roberto, ORG.northwind, "customer_requestor", "Roberto Lim", "roberto.lim@northwind-trading.example", "Warehouse Supervisor", { isActive: false }),

  profile(USER.joel, ORG.pacificrim, "agent_operator", "Joel Mercado", "joel.mercado@pacificrim-logistics.example", "Operations Supervisor", { currency: "PHP" }),
  profile(USER.elena, ORG.pacificrim, "agent_manager", "Elena Bautista", "elena.bautista@pacificrim-logistics.example", "Branch Manager", { currency: "PHP" }),

  profile(USER.dante, ORG.speedmax, "ops_coordinator", "Dante Villanueva", "dante.villanueva@speedmax.example", "Operations Coordinator"),
  profile(USER.aileen, ORG.speedmax, "ops_coordinator", "Aileen Bautista", "aileen.bautista@speedmax.example", "Operations Coordinator"),
  profile(USER.miguel, ORG.speedmax, "pricing_officer", "Miguel Santos", "miguel.santos@speedmax.example", "Pricing Officer"),

  profile(USER.corazon, ORG.speedmax, "finance_manager", "Corazon Salazar", "corazon.salazar@speedmax.example", "Finance Officer"),
  profile(USER.benigno, ORG.speedmax, "finance_approver", "Benigno Rosales", "benigno.rosales@speedmax.example", "Financial Controller"),
  profile(USER.ramon, ORG.speedmax, "billing_officer", "Ramon Aquino", "ramon.aquino@speedmax.example", "Billing Officer"),
  profile(USER.teresita, ORG.speedmax, "accounts_payable", "Teresita Cruz", "teresita.cruz@speedmax.example", "Accounts Payable Officer"),
  profile(USER.admin, ORG.speedmax, "admin", "Sofia Ramos", "sofia.ramos@speedmax.example", "System Administrator"),
];

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

function order(
  id: string,
  orderNumber: string,
  customerOrgId: string,
  extra: Partial<ShippingOrder>,
): ShippingOrder {
  return {
    id,
    orderNumber,
    status: "draft",
    customerOrgId,
    requestorId: USER.marisol,
    customerReference: null,
    requestDate: "2026-09-01",
    mode: null,
    serviceType: null,
    priority: "standard",
    requestedPickupDate: null,
    requestedDeliveryDate: null,
    insuranceRequested: false,
    supplierName: null,
    originLabel: null,
    destinationLabel: null,
    incoterm: null,
    incotermNamedPlace: null,
    declaredValue: null,
    declaredCurrency: "USD",
    specialInstructions: null,
    requiresReview: false,
    reviewReason: null,
    statusReason: null,
    submittedAt: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [],
    packages: [],
    sourceEnquiryId: null,
    ...extra,
  };
}

const orders: ShippingOrder[] = [
  order("so-1042", "SO-2026-001042", ORG.northwind, {
    status: "converted",
    customerReference: "NW-PO-88431",
    requestDate: "2026-07-30",
    mode: "sea",
    serviceType: "FCL door-to-door",
    requestedPickupDate: "2026-08-12",
    requestedDeliveryDate: "2026-09-15",
    insuranceRequested: true,
    supplierName: "Ningbo Fastening Industries Ltd",
    originLabel: "Ningbo, CN",
    destinationLabel: "Manila, PH",
    incoterm: "FOB",
    incotermNamedPlace: "Ningbo",
    declaredValue: "184500.00",
    specialInstructions:
      "Palletised, shrink-wrapped. Delivery bay accepts 40ft; advise 24h before arrival.",
    submittedAt: "2026-07-30T02:15:00Z",
    reviewedById: USER.dante,
    reviewedAt: "2026-07-30T06:00:00Z",
    createdAt: "2026-07-29T08:40:00Z",
    items: [
      { id: "soi-1042-1", lineNo: 1, description: "Stainless steel fasteners, assorted M6–M16", category: "General cargo", hsCode: "7318.15", originCountry: "CN", quantity: "480", uom: "CTN", unitValue: "310.00", totalValue: "148800.00", currency: "USD", isFragile: false, isHazardous: false, isOversized: false, isHighValue: false, isControlled: false, temperatureMinC: null, temperatureMaxC: null },
      { id: "soi-1042-2", lineNo: 2, description: "Galvanised anchor bolts, 20mm", category: "General cargo", hsCode: "7318.15", originCountry: "CN", quantity: "120", uom: "CTN", unitValue: "297.50", totalValue: "35700.00", currency: "USD", isFragile: false, isHazardous: false, isOversized: false, isHighValue: false, isControlled: false, temperatureMinC: null, temperatureMaxC: null },
    ],
    packages: [
      { id: "pkg-1042-1", lineNo: 1, packagingType: "PALLET", packageCount: 24, grossWeightKg: "18420.000", netWeightKg: "17880.000", lengthCm: "120.00", widthCm: "100.00", heightCm: "145.00", volumeCbm: "41.7600", marksAndNumbers: "NWTC / MNL / 1-24" },
    ],
  }),

  order("so-1067", "SO-2026-001067", ORG.northwind, {
    status: "accepted_for_quotation",
    customerReference: "NW-PO-88602",
    requestDate: "2026-08-22",
    mode: "air",
    serviceType: "Airport-to-door, express",
    priority: "express",
    requestedPickupDate: "2026-09-08",
    requestedDeliveryDate: "2026-09-16",
    insuranceRequested: true,
    supplierName: "Shenzhen Precision Components Co",
    originLabel: "Shenzhen, CN",
    destinationLabel: "Cebu, PH",
    incoterm: "FCA",
    incotermNamedPlace: "Shenzhen",
    declaredValue: "96200.00",
    specialInstructions: "Anti-static packaging required. Do not stack above two tiers.",
    requiresReview: true,
    reviewReason: "High-value cargo flagged for review before pricing (BR-003).",
    submittedAt: "2026-08-22T06:05:00Z",
    reviewedById: USER.dante,
    reviewedAt: "2026-08-23T01:00:00Z",
    createdAt: "2026-08-21T23:50:00Z",
    items: [
      { id: "soi-1067-1", lineNo: 1, description: "CNC-machined aluminium housings, anodised", category: "High value", hsCode: "8487.90", originCountry: "CN", quantity: "1800", uom: "PCS", unitValue: "53.44", totalValue: "96192.00", currency: "USD", isFragile: true, isHazardous: false, isOversized: false, isHighValue: true, isControlled: false, temperatureMinC: null, temperatureMaxC: null },
    ],
    packages: [
      { id: "pkg-1067-1", lineNo: 1, packagingType: "CARTON", packageCount: 60, grossWeightKg: "1440.000", netWeightKg: "1332.000", lengthCm: "60.00", widthCm: "40.00", heightCm: "35.00", volumeCbm: "5.0400", marksAndNumbers: "NWTC / CEB / A1-A60" },
    ],
  }),

  order("so-1071", "SO-2026-001071", ORG.northwind, {
    status: "information_required",
    customerReference: "NW-PO-88655",
    requestDate: "2026-08-26",
    mode: "sea",
    serviceType: "LCL port-to-door",
    requestedPickupDate: "2026-09-14",
    requestedDeliveryDate: "2026-10-20",
    supplierName: "Qingdao Coatings Group",
    originLabel: "Qingdao, CN",
    destinationLabel: "Manila, PH",
    incoterm: "EXW",
    incotermNamedPlace: "Qingdao plant",
    declaredValue: "41800.00",
    specialInstructions: "Supplier to confirm UN numbers before collection.",
    requiresReview: true,
    reviewReason: "Dangerous goods declared — qualified review required.",
    statusReason:
      "Safety data sheets and the dangerous-goods declaration are missing for line 1. Please upload both, then resubmit.",
    submittedAt: "2026-08-26T01:30:00Z",
    reviewedById: USER.aileen,
    reviewedAt: "2026-08-27T06:00:00Z",
    createdAt: "2026-08-25T09:10:00Z",
    items: [
      { id: "soi-1071-1", lineNo: 1, description: "Industrial solvent-based coating, UN1263 Class 3", category: "Dangerous goods", hsCode: "3208.10", originCountry: "CN", quantity: "220", uom: "DRUM", unitValue: "190.00", totalValue: "41800.00", currency: "USD", isFragile: false, isHazardous: true, isOversized: false, isHighValue: false, isControlled: true, temperatureMinC: "5.00", temperatureMaxC: "30.00" },
    ],
    packages: [
      { id: "pkg-1071-1", lineNo: 1, packagingType: "DRUM", packageCount: 220, grossWeightKg: "4620.000", netWeightKg: "4400.000", lengthCm: "58.00", widthCm: "58.00", heightCm: "88.00", volumeCbm: "9.8000", marksAndNumbers: "UN1263 / NWTC / MNL" },
    ],
  }),

  order("so-1080", "SO-2026-001080", ORG.northwind, {
    status: "draft",
    requestorId: USER.ferdinand,
    requestDate: "2026-09-01",
    originLabel: "Ho Chi Minh City, VN",
    destinationLabel: "Manila, PH",
    declaredCurrency: null,
    createdAt: "2026-09-01T07:20:00Z",
  }),

  order("so-1055", "SO-2026-001055", ORG.northwind, {
    status: "converted",
    customerReference: "NW-PO-88540",
    requestDate: "2026-08-08",
    mode: "air",
    serviceType: "Airport-to-door",
    priority: "express",
    requestedPickupDate: "2026-08-18",
    requestedDeliveryDate: "2026-08-30",
    insuranceRequested: true,
    supplierName: "Shenzhen Precision Components Co",
    originLabel: "Shenzhen, CN",
    destinationLabel: "Manila, PH",
    incoterm: "FCA",
    incotermNamedPlace: "Shenzhen",
    declaredValue: "72400.00",
    submittedAt: "2026-08-08T03:00:00Z",
    reviewedById: USER.dante,
    reviewedAt: "2026-08-08T07:00:00Z",
    createdAt: "2026-08-07T22:15:00Z",
    items: [
      { id: "soi-1055-1", lineNo: 1, description: "Electronic control modules", category: "High value", hsCode: "8537.10", originCountry: "CN", quantity: "900", uom: "PCS", unitValue: "80.44", totalValue: "72396.00", currency: "USD", isFragile: true, isHazardous: false, isOversized: false, isHighValue: true, isControlled: false, temperatureMinC: null, temperatureMaxC: null },
    ],
    packages: [
      { id: "pkg-1055-1", lineNo: 1, packagingType: "CARTON", packageCount: 45, grossWeightKg: "810.000", netWeightKg: "742.500", lengthCm: "55.00", widthCm: "40.00", heightCm: "30.00", volumeCbm: "2.9700", marksAndNumbers: "NWTC / MNL / E1-E45" },
    ],
  }),

  order("so-1019", "SO-2026-001019", ORG.northwind, {
    status: "converted",
    customerReference: "NW-PO-88290",
    requestDate: "2026-06-28",
    mode: "sea",
    serviceType: "FCL port-to-door",
    requestedPickupDate: "2026-07-06",
    requestedDeliveryDate: "2026-08-02",
    insuranceRequested: true,
    supplierName: "Busan Metals Trading Co",
    originLabel: "Busan, KR",
    destinationLabel: "Manila, PH",
    incoterm: "CIF",
    incotermNamedPlace: "Manila",
    declaredValue: "128900.00",
    submittedAt: "2026-06-28T05:40:00Z",
    reviewedById: USER.aileen,
    reviewedAt: "2026-06-29T01:00:00Z",
    createdAt: "2026-06-27T11:05:00Z",
    items: [
      { id: "soi-1019-1", lineNo: 1, description: "Cold-rolled steel coil, 1.2mm", category: "General cargo", hsCode: "7209.17", originCountry: "KR", quantity: "38", uom: "COIL", unitValue: "3392.10", totalValue: "128899.80", currency: "USD", isFragile: false, isHazardous: false, isOversized: true, isHighValue: false, isControlled: false, temperatureMinC: null, temperatureMaxC: null },
    ],
    packages: [
      { id: "pkg-1019-1", lineNo: 1, packagingType: "COIL", packageCount: 38, grossWeightKg: "22800.000", netWeightKg: "22610.000", lengthCm: "150.00", widthCm: "150.00", heightCm: "90.00", volumeCbm: "38.0000", marksAndNumbers: "NWTC / MNL / STEEL" },
    ],
  }),

  // Other customers' orders — these back the shipments the agent and finance
  // workspaces already reference, which previously existed only as loose
  // shipment numbers with no order behind them.
  order("so-vertex-1", "SO-2026-001061", ORG.vertex, {
    status: "converted",
    requestorId: null,
    customerReference: "VX-PO-4410",
    requestDate: "2026-08-14",
    mode: "sea",
    serviceType: "FCL port-to-door",
    supplierName: "Kaohsiung Bearing Works",
    originLabel: "Kaohsiung, TW",
    destinationLabel: "Manila, PH",
    incoterm: "FOB",
    declaredValue: "118400.00",
    submittedAt: "2026-08-14T02:00:00Z",
    createdAt: "2026-08-13T09:00:00Z",
    items: [
      { id: "soi-vx-1", lineNo: 1, description: "Industrial bearings and drive components", category: "General cargo", hsCode: "8482.10", originCountry: "TW", quantity: "96", uom: "CTN", unitValue: "1233.33", totalValue: "118399.68", currency: "USD", isFragile: false, isHazardous: false, isOversized: false, isHighValue: false, isControlled: false, temperatureMinC: null, temperatureMaxC: null },
    ],
    packages: [
      { id: "pkg-vx-1", lineNo: 1, packagingType: "CARTON", packageCount: 96, grossWeightKg: "12480.000", netWeightKg: "11900.000", lengthCm: "80.00", widthCm: "60.00", heightCm: "55.00", volumeCbm: "24.6000", marksAndNumbers: "VERTEX / MNL" },
    ],
  }),

  order("so-luzon-1", "SO-2026-001074", ORG.luzon, {
    status: "converted",
    requestorId: null,
    customerReference: "LC-EXP-2210",
    requestDate: "2026-08-27",
    mode: "sea",
    serviceType: "FCL door-to-port",
    supplierName: "Luzon Ceramics plant, Santo Tomas",
    originLabel: "Manila, PH",
    destinationLabel: "Singapore, SG",
    incoterm: "FOB",
    declaredValue: "64200.00",
    submittedAt: "2026-08-27T01:00:00Z",
    createdAt: "2026-08-26T08:00:00Z",
    items: [
      { id: "soi-lc-1", lineNo: 1, description: "Glazed ceramic tiles and sanitary ware", category: "General cargo", hsCode: "6907.21", originCountry: "PH", quantity: "320", uom: "CRATE", unitValue: "200.63", totalValue: "64201.60", currency: "USD", isFragile: true, isHazardous: false, isOversized: false, isHighValue: false, isControlled: false, temperatureMinC: null, temperatureMaxC: null },
    ],
    packages: [
      { id: "pkg-lc-1", lineNo: 1, packagingType: "CRATE", packageCount: 320, grossWeightKg: "17600.000", netWeightKg: "16800.000", lengthCm: "100.00", widthCm: "80.00", heightCm: "70.00", volumeCbm: "31.2000", marksAndNumbers: "LUZON / SIN" },
    ],
  }),
];

/* -------------------------------------------------------------------------- */
/* Quotations                                                                 */
/* -------------------------------------------------------------------------- */

/** Charge helper — cost and sell together; the customer projection drops cost. */
function charge(
  id: string,
  group: ChargeGroup,
  chargeCode: string,
  description: string,
  quantity: string,
  costAmount: string,
  sellAmount: string,
  taxRatePct = "0.000",
  isTaxable = true,
) {
  return {
    id,
    group,
    chargeCode,
    description,
    quantity,
    costAmount,
    sellAmount,
    currency: "USD",
    isTaxable,
    taxRatePct,
  };
}

const quotations: Quotation[] = [
  {
    id: "qt-2248",
    quoteNumber: "QT-2026-002248",
    status: "released",
    versionNo: 2,
    orderId: "so-1067",
    customerOrgId: ORG.northwind,
    currency: "USD",
    validFrom: "2026-08-28",
    validUntil: "2026-09-11",
    terms:
      "Rates valid for the cargo described. Payment 50% deposit on booking, balance against delivery. Subject to Speedmax standard trading conditions.",
    assumptions:
      "Based on 1,440 kg gross / 5.04 CBM as declared. Chargeable weight taken as gross. Cargo ready 08 Sep 2026. Single pickup location.",
    exclusions:
      "Import duties and taxes. Destination customs examination fees if levied. Storage beyond 3 free days at destination. Insurance unless separately confirmed.",
    preparedById: USER.miguel,
    approvedById: USER.dante,
    approvedAt: "2026-08-28T08:00:00Z",
    releasedAt: "2026-08-28T09:30:00Z",
    escalated: false,
    escalationReason: null,
    acceptance: null,
    createdAt: "2026-08-24T02:00:00Z",
    updatedAt: "2026-08-28T09:30:00Z",
    routeOptions: [
      {
        id: "ro-2248-1",
        optionNo: 1,
        label: "Direct air freight — fastest",
        mode: "air",
        originLabel: "Shenzhen (SZX)",
        destinationLabel: "Cebu (CEB)",
        transitDaysMin: 3,
        transitDaysMax: 4,
        departureFrequency: "Daily except Sunday",
        carrierName: "Cathay Cargo",
        scheduleNote: "Next available uplift 09 Sep 2026.",
        assumptions: "Direct routing, no transshipment.",
        exclusions: "Duties and taxes at destination.",
        isRecommended: true,
        charges: [
          charge("c1", "origin", "ORG_PICKUP", "Pickup — Shenzhen plant to SZX", "1", "310.00", "420.00"),
          charge("c2", "origin", "ORG_EXPDOC", "Export documentation", "1", "60.00", "95.00"),
          charge("c3", "origin", "ORG_BROKERAGE", "Export customs brokerage", "1", "125.00", "180.00"),
          charge("c4", "main_carriage", "MC_AIR", "Air freight SZX–CEB, 1,440 kg chargeable", "1440", "3888.00", "5040.00", "0.000", false),
          charge("c5", "main_carriage", "MC_FUEL", "Fuel surcharge", "1440", "720.00", "864.00", "0.000", false),
          charge("c6", "main_carriage", "MC_SECURITY", "Security surcharge", "1440", "230.00", "288.00", "0.000", false),
          charge("c7", "destination", "DST_THC", "Terminal handling — CEB", "1", "225.00", "310.00", "12.000"),
          charge("c8", "destination", "DST_BROKERAGE", "Import customs brokerage", "1", "180.00", "265.00", "12.000"),
          charge("c9", "destination", "DST_DELIVERY", "Final delivery — CEB to consignee", "1", "270.00", "385.00", "12.000"),
          charge("c10", "protection", "PRT_INSURANCE", "Cargo insurance — 110% of declared value", "1", "432.00", "529.06", "0.000", false),
          charge("c11", "protection", "PRT_SPECIAL", "Special handling — anti-static, fragile", "1", "165.00", "240.00"),
          charge("c12", "speedmax", "SPX_COORD", "Coordination fee", "1", "0.00", "350.00", "12.000"),
        ],
      },
      {
        id: "ro-2248-2",
        optionNo: 2,
        label: "Consolidated air via Manila — lower cost",
        mode: "air",
        originLabel: "Shenzhen (SZX)",
        destinationLabel: "Cebu (CEB)",
        transitDaysMin: 6,
        transitDaysMax: 8,
        departureFrequency: "Tuesday and Friday",
        carrierName: "Philippine Airlines Cargo",
        scheduleNote:
          "Consolidated uplift to MNL, then domestic feeder to CEB. Next consolidation closes 10 Sep 2026.",
        assumptions: "Transshipment at Manila. Two additional days for deconsolidation.",
        exclusions: "Duties and taxes at destination. Storage at MNL beyond 2 days.",
        isRecommended: false,
        charges: [
          charge("d1", "origin", "ORG_PICKUP", "Pickup — Shenzhen plant to SZX", "1", "310.00", "420.00"),
          charge("d2", "origin", "ORG_EXPDOC", "Export documentation", "1", "60.00", "95.00"),
          charge("d3", "origin", "ORG_BROKERAGE", "Export customs brokerage", "1", "125.00", "180.00"),
          charge("d4", "main_carriage", "MC_AIR", "Air freight SZX–MNL consolidated, 1,440 kg", "1440", "2736.00", "3600.00", "0.000", false),
          charge("d5", "main_carriage", "MC_AIR", "Domestic feeder MNL–CEB", "1", "520.00", "690.00", "0.000", false),
          charge("d6", "main_carriage", "MC_FUEL", "Fuel surcharge", "1440", "600.00", "720.00", "0.000", false),
          charge("d7", "destination", "DST_WHS", "Deconsolidation — MNL", "1", "195.00", "275.00", "12.000"),
          charge("d8", "destination", "DST_THC", "Terminal handling — CEB", "1", "225.00", "310.00", "12.000"),
          charge("d9", "destination", "DST_BROKERAGE", "Import customs brokerage", "1", "180.00", "265.00", "12.000"),
          charge("d10", "destination", "DST_DELIVERY", "Final delivery — CEB to consignee", "1", "270.00", "385.00", "12.000"),
          charge("d11", "protection", "PRT_INSURANCE", "Cargo insurance — 110% of declared value", "1", "432.00", "529.06", "0.000", false),
          charge("d12", "speedmax", "SPX_COORD", "Coordination fee", "1", "0.00", "350.00", "12.000"),
        ],
      },
    ],
  },
  {
    id: "qt-2211",
    quoteNumber: "QT-2026-002211",
    status: "accepted",
    versionNo: 1,
    orderId: "so-1042",
    customerOrgId: ORG.northwind,
    currency: "USD",
    validFrom: "2026-08-01",
    validUntil: "2026-08-15",
    terms: "Payment 30 days from invoice date. Subject to Speedmax standard trading conditions.",
    assumptions: "One 40ft container, shipper's load and count. Cargo ready 12 Aug 2026.",
    exclusions: "Import duties and taxes. Demurrage and detention beyond 7 free days.",
    preparedById: USER.miguel,
    approvedById: USER.dante,
    approvedAt: "2026-08-01T06:00:00Z",
    releasedAt: "2026-08-01T07:00:00Z",
    escalated: false,
    escalationReason: null,
    createdAt: "2026-07-31T02:00:00Z",
    updatedAt: "2026-08-04T01:22:00Z",
    acceptance: {
      acceptedById: USER.marisol,
      acceptedByName: "Marisol Reyes",
      acceptedAt: "2026-08-04T01:22:00Z",
      routeOptionId: "ro-2211-1",
      acceptedTerms: "Payment 30 days from invoice date.",
      evidenceNote: null,
    },
    routeOptions: [
      {
        id: "ro-2211-1",
        optionNo: 1,
        label: "Direct ocean FCL",
        mode: "sea",
        originLabel: "Ningbo (CNNGB)",
        destinationLabel: "Manila (PHMNL)",
        transitDaysMin: 12,
        transitDaysMax: 16,
        departureFrequency: "Weekly, Thursday",
        carrierName: "Maersk Line",
        scheduleNote: "Vessel MAERSK SENTOSA, voyage 634W.",
        assumptions: "One 40ft HC container.",
        exclusions: "Duties and taxes at destination.",
        isRecommended: true,
        charges: [
          charge("e1", "origin", "ORG_PICKUP", "Pickup — Ningbo plant to CNNGB", "1", "495.00", "680.00"),
          charge("e2", "origin", "ORG_EXPDOC", "Export documentation", "1", "70.00", "110.00"),
          charge("e3", "origin", "ORG_TERMINAL", "Origin terminal charges", "1", "290.00", "395.00"),
          charge("e4", "main_carriage", "MC_OCEAN", "Ocean freight CNNGB–PHMNL, 40ft HC", "1", "1620.00", "2150.00", "0.000", false),
          charge("e5", "main_carriage", "MC_SURCHARGE", "Bunker adjustment factor", "1", "324.00", "430.00", "0.000", false),
          charge("e6", "destination", "DST_THC", "Terminal handling — Manila", "1", "385.00", "520.00", "12.000"),
          charge("e7", "destination", "DST_BROKERAGE", "Import customs brokerage", "1", "240.00", "340.00", "12.000"),
          charge("e8", "destination", "DST_DELIVERY", "Final delivery — Manila to warehouse", "1", "440.00", "610.00", "12.000"),
          charge("e9", "protection", "PRT_INSURANCE", "Cargo insurance — 110% of declared value", "1", "830.00", "1014.75", "0.000", false),
          charge("e10", "speedmax", "SPX_COORD", "Coordination fee", "1", "0.00", "450.00", "12.000"),
        ],
      },
    ],
  },
];

export { organizations, addresses, profiles, orders, quotations };
export { ORG, USER, NOW } from "./ids";

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

import { shipments, assignments } from "./seed-execution";
import {
  documents,
  invoices,
  payments,
  vendorBills,
  settlements,
  expenses,
  allocatableCosts,
  claims,
  exceptions,
  threads,
  enquiries,
} from "./seed-records";

/** A fresh copy of the demo dataset. Deep-cloned so callers cannot alias it. */
export function buildSeed(): StoreData {
  const data: StoreData = {
    version: STORE_VERSION,
    seededAt: new Date().toISOString(),
    counters: {
      order: 1080,
      quotation: 2248,
      shipment: 4203,
      booking: 300,
      invoice: 371,
      payment: 815,
      vendorBill: 520,
      settlement: 88,
      expense: 430,
      exception: 91,
      claim: 12,
      enquiry: 120,
    },
    organizations,
    addresses,
    profiles,
    orders,
    quotations,
    shipments,
    assignments,
    documents,
    invoices,
    payments,
    vendorBills,
    settlements,
    expenses,
    allocatableCosts,
    claims,
    exceptions,
    threads,
    enquiries,
    audit: [],
  };

  // The seed is authored in dollars; Speedmax operates in pesos. Converting
  // here keeps the source readable while the store holds real peso figures.
  return applyOperatingCurrency(structuredClone(data));
}

export type {
  AgentSettlement,
  AllocatableCost,
  Assignment,
  Claim,
  Expense,
  ExceptionRecord,
  Invoice,
  MessageThread,
  Payment,
  Shipment,
  StoredDocument,
  VendorBill,
};
