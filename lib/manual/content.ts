/**
 * In-app user manual content.
 *
 * One source, three audiences. Each block declares who it is for, and the
 * workspace route renders only what that audience should read.
 *
 * This is not presentation fussiness. The system spends considerable effort
 * keeping internal cost and margin away from customers and agents (BR-008,
 * §13); a manual that explained the margin report inside the customer portal
 * would undo that in prose. So the finance sections are tagged `finance`, the
 * milestone-scope rules `agent`, and only genuinely shared material is `all`.
 */

export type Audience = "customer" | "agent" | "finance";

export interface ManualBlock {
  kind: "prose" | "steps" | "list" | "note" | "table" | "flow";
  /**
   * Restrict this block to certain readers. Omitted means everyone who can see
   * the section. Used where a section is shared but one detail is not — a
   * customer has no reason to read what the finance workspace shows.
   */
  audiences?: Audience[];
  /** Optional heading above the block. */
  heading?: string;
  /** Paragraphs, list items, or ordered steps depending on `kind`. */
  body?: string[];
  /** For `note`: how strongly to mark it. */
  tone?: "info" | "warning" | "danger";
  /** For `table`. */
  columns?: string[];
  rows?: string[][];
  /** For `flow`: the ordered step labels. */
  steps?: string[];
}

export interface ManualSection {
  id: string;
  title: string;
  /** One line under the title. */
  summary: string;
  audiences: Audience[];
  blocks: ManualBlock[];
}

export const manualSections: ManualSection[] = [
  /* ------------------------------------------------------------------ */
  {
    id: "orientation",
    title: "How this system fits together",
    summary:
      "Speedmax coordinates every party to a shipment. Each one gets a workspace showing only their own slice of the same record.",
    audiences: ["customer", "agent", "finance"],
    blocks: [
      {
        kind: "prose",
        body: [
          "A shipment involves the customer, the supplier, an origin agent, a carrier, a customs broker and a destination agent. Rather than coordinating those by email, each party works in their own space and the system keeps one traceable record connecting all of it — from the first request through to a settled, closed shipment.",
        ],
      },
      {
        // Customers and agents get a description of Speedmax's internal side
        // that does not enumerate what it contains. Advertising the margin
        // report to a customer would sit oddly beside a system built to keep
        // it from them.
        kind: "table",
        audiences: ["customer", "agent"],
        heading: "The workspaces",
        columns: ["Workspace", "Who uses it", "What it shows"],
        rows: [
          [
            "Customer portal",
            "The shipper paying for the freight",
            "Their own organisation's orders, quotations, shipments, invoices and claims",
          ],
          [
            "Agent portal",
            "Partner agents at origin and destination",
            "Only the shipments assigned to them, with their own fee",
          ],
          [
            "Speedmax internal",
            "Operations and finance staff",
            "Coordinates the shipment and handles billing and settlement",
          ],
          [
            "Public site",
            "Anyone",
            "Services, coverage, shipment tracking and quote enquiries",
          ],
        ],
      },
      {
        kind: "table",
        audiences: ["finance"],
        heading: "The workspaces",
        columns: ["Workspace", "Who uses it", "What it shows"],
        rows: [
          [
            "Customer portal",
            "The shipper paying for the freight",
            "Their own organisation's records. Never internal cost or margin",
          ],
          [
            "Agent portal",
            "Partner agents at origin and destination",
            "Only assigned shipments, with their own fee — never the customer's price",
          ],
          [
            "Operations",
            "Speedmax coordinators and pricing",
            "Order review, quotation building, booking and milestones",
          ],
          [
            "Finance workspace",
            "Speedmax billing, collections and payables",
            "Receivables, payables, cost and margin",
          ],
          [
            "Public site",
            "Anyone",
            "Services, coverage, shipment tracking and quote enquiries",
          ],
        ],
      },
      {
        kind: "note",
        tone: "info",
        body: [
          "These are boundaries, not view filters. You cannot reach another organisation's records, and information restricted from your role is removed before it reaches the page rather than hidden on it.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "process",
    title: "The process, end to end",
    summary:
      "Twelve phases in order. A phase cannot begin until the one before it has produced its outcome.",
    audiences: ["customer", "agent", "finance"],
    blocks: [
      {
        kind: "steps",
        body: [
          "**Customer onboarding.** The customer organisation, its authorised users, addresses and billing profile are recorded. Nothing can be requested until a valid profile exists.",
          "**Shipping Order request.** The customer raises an order: route, service, supplier, cargo lines and packages. Special handling is flagged for review before pricing.",
          "**Review and supplier coordination.** Speedmax accepts the order for quotation, returns it for information, or rejects it — each with a logged reason. The supplier confirms cargo readiness and actual measurements.",
          "**Route planning and quotation.** Pricing builds one or more route options, each with its own schedule, assumptions, exclusions and price. A released version becomes read-only; changes create a new version.",
          "**Acceptance and booking release.** The customer accepts an option. That converts the order and creates the shipment, but does not release the booking — that waits on the payment or credit condition, cargo readiness and documents.",
          "**Agent and carrier assignment.** Origin agent, destination agent, carrier and broker are assigned, each with scope, deliverables, due dates and an acknowledgement.",
          "**Origin execution.** Pickup, cargo receipt, inspection, export documents and clearance, then handover to the carrier. Material variance in weight or quantity raises a hold rather than letting the shipment sail mispriced.",
          "**Transit and tracking.** Loading, departure, transshipment and arrival are posted as events, each with its time, place, source and visibility.",
          "**Destination execution.** Pre-alert, arrival, import declaration, duties assessment and release. A customs hold blocks progress until a clearing milestone follows it.",
          "**Delivery and proof of delivery.** Delivery is scheduled and completed; the POD records receiver, time, quantity, condition and any exception.",
          "**Billing and settlement.** The customer is invoiced, payments are verified and allocated, and supplier and agent costs are approved and settled.",
          "**Shipment closure.** Closure is blocked until delivery, documents, invoicing, costs and open exceptions all check out.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "orders",
    title: "Raising a shipment request",
    summary: "From a draft order to something Speedmax can price.",
    audiences: ["customer"],
    blocks: [
      {
        kind: "steps",
        body: [
          "Go to **Shipping Orders** and choose **New Shipping Order**.",
          "Fill in the route and service. Origin and destination are the delivery points, not just the ports.",
          "Add a cargo line for each commodity. Weight, volume and package count go in the package block below.",
          "Tick any special handling that applies. The form tells you immediately if that will route the order for qualified review.",
          "**Save draft** to finish later, or **Submit order** to send it. Submitting needs an origin, a destination and at least one cargo line.",
        ],
      },
      {
        kind: "prose",
        body: [
          "If Speedmax needs more from you, the order comes back as *Information Required* with the reason shown on the order itself. Upload what was asked for and resubmit — the order keeps its number and history.",
        ],
      },
      {
        kind: "note",
        tone: "info",
        body: [
          "Dangerous, controlled, high-value and oversized cargo is routed for qualified review before it is priced. Declaring it up front avoids a hold later; undeclared cargo of these types may be refused or returned at your cost.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "quotations",
    title: "Comparing and accepting a quotation",
    summary:
      "Route options sit side by side so the trade-off between price and transit time is visible.",
    audiences: ["customer"],
    blocks: [
      {
        kind: "prose",
        body: [
          "**Quotations** lists everything released to you. Opening one shows each route option with its routing, transit time, carrier and charges grouped by origin, main carriage, destination, protection and Speedmax fees.",
        ],
      },
      {
        kind: "steps",
        body: [
          "Choose the option you want and press **Accept this option**.",
          "Check the option, total and validity, then confirm you are authorised to accept on your company's behalf.",
          "On acceptance the order is converted and a shipment is created. Speedmax confirms the booking separately.",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        body: [
          "Only a user with the Approver role can accept. If you do not see the button, your role covers raising requests or handling invoices rather than agreeing prices.",
          "An expired quotation cannot be accepted, even a day late. Ask your coordinator to reissue it and we will confirm whether the rates still stand.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "tracking",
    title: "Following a shipment",
    summary: "Ten steps, from submitted order to delivered cargo.",
    audiences: ["customer"],
    blocks: [
      {
        kind: "flow",
        steps: [
          "Order Submitted",
          "Quotation Approved",
          "Booking Confirmed",
          "Cargo Collected",
          "Departed Origin",
          "In Transit",
          "Arrived at Destination",
          "Customs Processing",
          "Out for Delivery",
          "Delivered",
        ],
      },
      {
        kind: "prose",
        body: [
          "**Shipments** shows one shipment in detail; **Tracking** shows everything in motion at once. The timeline is deliberately simpler than the operational one — internal handoffs are summarised rather than listed.",
          "A step can show as complete with a dash instead of a time. That means it was reached — a later milestone proves it — but no separate event was posted for that step.",
        ],
      },
      {
        kind: "prose",
        heading: "Tracking without signing in",
        body: [
          "Anyone holding a reference can track from the public site. It accepts a Speedmax shipment number, a house or master bill, an air waybill, a container or a booking reference. The match must be exact.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "customer-finance",
    title: "Documents, invoices and claims",
    summary: "The paperwork side of a shipment.",
    audiences: ["customer"],
    blocks: [
      {
        kind: "list",
        heading: "Documents",
        body: [
          "Everything attached to your orders, shipments, invoices and claims, with its verification status and expiry date.",
          "Replacing a document supersedes it rather than overwriting — the previous version stays in history.",
          "A rejected document tells you why, so you know what to send instead.",
        ],
      },
      {
        kind: "list",
        heading: "Invoices and payments",
        body: [
          "Invoices show subtotal, tax, amount paid and balance, with aging on the overdue ones.",
          "Submit payment evidence against an invoice with the bank reference and the remittance advice.",
          "A payment reduces your balance only once Speedmax finance has verified it against the bank record — until then it shows as submitted.",
        ],
      },
      {
        kind: "list",
        heading: "Claims and messages",
        body: [
          "File a claim for damage, shortage or loss with the incident date, amount and your evidence. It then runs through review, assessment, decision and settlement.",
          "Messages are tied to a specific order, shipment, invoice or claim, so the context travels with the conversation instead of living in someone's inbox.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "assignments",
    title: "Working an assignment",
    summary:
      "Your queue is driven by what is due next, not by when the shipment was created.",
    audiences: ["agent"],
    blocks: [
      {
        kind: "list",
        body: [
          "**My Assignments** — what needs you now: unacknowledged assignments, exceptions requiring action, tasks due within three days, and documents Speedmax has returned.",
          "**Upcoming** — issued to you, cargo not yet at your end.",
          "**Active Shipments** — cargo in your hands.",
          "**Completed** — finished work, kept for reference and settlement.",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        body: [
          "Acknowledge an assignment as soon as you receive it. Acknowledging confirms you accept the scope, deliverables, due dates and fee as issued; until you do, Speedmax treats the assignment as unconfirmed and may reassign it.",
        ],
      },
      {
        kind: "prose",
        heading: "What you can see",
        body: [
          "Only shipments assigned to your organisation — across every customer, not just one. Seeing another company's shipment here is correct if you were assigned to it. What you never see is what Speedmax charged that customer; you see your own fee and your own expenses.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "milestones",
    title: "Posting milestones",
    summary:
      "The board offers only the milestones your role is responsible for.",
    audiences: ["agent"],
    blocks: [
      {
        kind: "prose",
        body: [
          "An origin agent gets the origin and transit milestones; a destination agent gets destination and delivery. The two sets do not overlap, because an agent in Manila has no basis for confirming a departure in Ningbo.",
        ],
      },
      {
        kind: "steps",
        body: [
          "Open the assignment and choose the milestone from **Post milestones**. Anything already posted shows its time and is not offered again.",
          "Record the time the event **actually happened**, not the time you are entering it. Both are kept.",
          "Add the location and any note the coordinator or customer needs.",
        ],
      },
      {
        kind: "note",
        tone: "danger",
        body: [
          "Events are append-only. A posted milestone cannot be edited or deleted — a mistake is corrected by posting a superseding entry with a reason, and the original stays visible. This is what makes the tracking history worth trusting.",
        ],
      },
      {
        kind: "list",
        heading: "Tasks, documents and expenses",
        body: [
          "**Tasks** are the deliverables across all your live assignments, overdue ones first. Most complete by posting the milestone they expect.",
          "**Documents** shows what you uploaded and how Speedmax assessed it. A rejected document explains what to change.",
          "**Expenses** are costs you incurred on Speedmax's behalf. A draft expense is invisible to finance and will not be settled — attach evidence and submit it.",
          "Reversed expenses stay visible, struck through, and count toward nothing. A reversal is a correction, not a deletion.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "receivables",
    title: "Receivables",
    summary: "Billing, collections and the customer account position.",
    audiences: ["finance"],
    blocks: [
      {
        kind: "list",
        body: [
          "**Billing** — the position at a glance, what needs attention, and invoices awaiting issue.",
          "**Collections** — aging, overdue invoices, and payments awaiting verification.",
          "**Customer Accounts** — balance, credit utilisation and aging per customer.",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        body: [
          "Money received against no invoice is flagged as unallocated. Apply it to an invoice or record it as a customer credit — it must not sit unapplied through period end.",
        ],
      },
      {
        kind: "prose",
        body: [
          "Invoice totals are computed from their own lines, and the amount paid counts only verified payments. A submitted-but-unverified payment is a claim by the customer, not money confirmed received.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "payables",
    title: "Payables and allocation",
    summary: "Supplier costs, agent settlements and spreading shared charges.",
    audiences: ["finance"],
    blocks: [
      {
        kind: "list",
        body: [
          "**Vendor Bills** — carrier, agent, broker and transport costs. Accruals are held apart from confirmed obligations because they are estimates.",
          "**Agent Settlements** — fees and reimbursements netted against advances and deductions.",
          "**Expenses** — agent and internal costs awaiting verification and approval.",
          "**Allocations** — spreading a cost that belongs to more than one shipment.",
        ],
      },
      {
        kind: "prose",
        heading: "Allocating a shared cost",
        body: [
          "Choose the basis that suits the charge: weight, volume, value, quantity, equally, directly, or a justified manual split. The result always reconciles exactly to the amount being allocated — an allocation whose parts do not sum to the whole is a defect, not a rounding quirk, and the screen refuses to post one.",
        ],
      },
      {
        kind: "note",
        tone: "danger",
        body: [
          "Two bills carrying the same vendor invoice number are blocked from approval regardless of who prepared them. Paying a carrier twice for one movement is the failure this exists to prevent.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "margin",
    title: "Reading the margin report",
    summary: "Three cost figures, kept deliberately apart.",
    audiences: ["finance"],
    blocks: [
      {
        kind: "table",
        columns: ["Figure", "Means"],
        rows: [
          ["Quoted", "What was priced when the customer accepted"],
          ["Actual", "What suppliers have invoiced and finance has approved"],
          ["Accrued", "What is expected but not yet billed by the vendor"],
        ],
      },
      {
        kind: "prose",
        body: [
          "Accruals count against margin so profit is not overstated while bills are outstanding, but they are reported separately so you can see how much of a thin margin is estimate rather than fact.",
          "Gross margin below the policy floor, or negative, requires escalated approval. Margin on zero revenue is reported as not measurable rather than as break-even.",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        body: [
          "A shipment with cost recorded and no invoice reads as a total loss. That is intended: delivered but unbilled is the finding, and it should be impossible to overlook rather than quietly excluded from the numbers.",
        ],
      },
      {
        kind: "prose",
        heading: "Closing a shipment",
        body: [
          "**Close** lists every check a shipment must pass — delivery and proof of delivery, document verification, invoicing and settlement, vendor costs, agent settlement, and open exceptions or claims. Closure stays blocked until all of them pass, and the screen names the ones outstanding.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "refusals",
    title: "When the system says no",
    summary:
      "Several controls will refuse you, and the refusal is the feature. Each explains itself rather than just greying out.",
    audiences: ["customer", "agent", "finance"],
    blocks: [
      {
        kind: "table",
        columns: ["You will be stopped from", "Because"],
        rows: [
          [
            "Approving something you prepared",
            "No one approves their own high-risk financial transaction. Holding the permission is necessary but not sufficient — the approver must be a different person.",
          ],
          [
            "Accepting an expired quotation",
            "A lapsed price cannot be accepted without revalidation, even a day late.",
          ],
          [
            "Moving a record to an invalid status",
            "Each record type has a defined lifecycle. An unrecognised status is never movable — the check fails closed.",
          ],
          [
            "Approving a duplicate vendor invoice",
            "Two bills with the same vendor invoice number would pay the supplier twice.",
          ],
          [
            "Closing a shipment too early",
            "Any outstanding operational, document, finance or exception check blocks closure.",
          ],
          [
            "Editing a posted tracking event",
            "Events are append-only. Post a correction and both the original and the reason are kept.",
          ],
          [
            "Acting without a reason",
            "Rejecting, overriding, reversing, cancelling and reopening all require a reason, recorded against your name.",
          ],
        ],
      },
      {
        kind: "note",
        tone: "info",
        body: [
          "If a record has no recorded preparer, approval is refused outright. A separation of duties that cannot be evidenced is not a control.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "statuses",
    title: "Status reference",
    summary:
      "Every record type has a defined lifecycle. Colour always means the same thing, whichever record you are looking at.",
    audiences: ["customer", "agent", "finance"],
    blocks: [
      {
        kind: "table",
        columns: ["Record", "Lifecycle"],
        rows: [
          [
            "Shipping Order",
            "Draft → Submitted → Information Required · Accepted for Quotation · Rejected · Cancelled → Converted",
          ],
          [
            "Quotation",
            "Draft → Internal Approval → Released → Accepted · Revision Requested · Declined · Expired",
          ],
          [
            "Booking",
            "Awaiting Conditions → Requested → Confirmed · Failed · Rebooking Required → Completed",
          ],
          [
            "Shipment",
            "Planned → Booked → Origin Processing → In Transit → Destination Processing → Out for Delivery → Delivered → Closed",
          ],
          [
            "Invoice",
            "Draft → For Approval → Issued → Partially Paid · Paid · Overdue · Disputed → Closed · Reversed",
          ],
          ["Payment", "Submitted → Verified · Rejected → Reversed"],
          [
            "Vendor Bill",
            "Draft → Verified → Approved → Partially Paid · Paid → Closed · Reversed",
          ],
          [
            "Exception",
            "Open → Assigned → Investigating → Action Required → Resolved → Closed · Reopened",
          ],
          [
            "Claim",
            "Draft → Submitted → Under Review → Negotiation → Approved · Rejected → Settled → Closed",
          ],
          [
            "Document",
            "Uploaded → Under Review → Verified · Rejected · Expired · Superseded",
          ],
        ],
      },
      {
        kind: "prose",
        body: [
          "Nothing is deleted. A record that is finished with moves to a terminal status, and a mistake is corrected by reversal or amendment so the history survives.",
        ],
      },
    ],
  },
];

export function sectionsFor(audience: Audience): ManualSection[] {
  return manualSections
    .filter((s) => s.audiences.includes(audience))
    .map((s) => ({
      ...s,
      blocks: s.blocks.filter(
        (b) => !b.audiences || b.audiences.includes(audience),
      ),
    }));
}
