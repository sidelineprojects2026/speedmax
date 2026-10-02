import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing quotations, bookings, cargo acceptance, charges, payment and liability for Speedmax freight services.",
};

const sections: readonly LegalSection[] = [
  {
    heading: "Quotations",
    bullets: [
      "A quotation is valid only for the period stated on it and only for the version released. An expired quotation cannot be accepted without revalidation.",
      "Each quotation states its assumptions and exclusions. Charges arising from circumstances outside those assumptions are handled as a change request.",
      "Acceptance is recorded against the identity of the accepting user, the timestamp, the accepted version and the terms in force at that moment.",
    ],
  },
  {
    heading: "Bookings",
    bullets: [
      "A booking is released only once commercial acceptance and any deposit, credit or compliance condition is satisfied, or an authorised override is recorded.",
      "Carrier schedules are indicative. Where a booking fails or a schedule changes materially, a rebooking case is raised and the history of the original booking is retained.",
      "Cut-off times, free time, and cancellation terms are recorded at booking and apply as stated by the carrier.",
    ],
  },
  {
    heading: "Cargo and information",
    bullets: [
      "The customer is responsible for the accuracy and completeness of cargo descriptions, values, weights, dimensions and supporting documents.",
      "Restricted, hazardous, temperature-controlled, oversized, high-value and controlled goods must be declared. Undeclared cargo of these types may be refused, held, or returned at the customer's cost.",
      "Where actual weight, volume, quantity, commodity or service differs materially from what was quoted, a hold and commercial review is raised before the shipment proceeds.",
    ],
  },
  {
    heading: "Customs and compliance",
    bullets: [
      "Speedmax coordinates clearance with licensed brokers. We do not determine legal admissibility, tariff classification, taxes, sanctions status or dangerous-goods acceptance without qualified review.",
      "Duties, taxes and official charges are payable by the party identified under the applicable Incoterm and are passed through with supporting evidence.",
      "Delays arising from customs query, examination, hold, permit or valuation issues are outside our control and do not constitute a service failure.",
    ],
  },
  {
    heading: "Charges and payment",
    bullets: [
      "Invoices are payable by the due date stated. Payment is applied against invoices by allocation and acknowledged by receipt once verified.",
      "Additional charges arising after acceptance require a controlled change request unless already covered by the accepted terms.",
      "Disputed items should be raised against the specific invoice so the balance of the account remains payable while the dispute is assessed.",
    ],
  },
  {
    heading: "Liability and claims",
    bullets: [
      "Services are provided subject to our standard trading conditions and, where applicable, the mandatory liability regimes governing the mode of carriage.",
      "Cargo insurance is arranged only when requested and confirmed. Absent cover, exposure rests with the cargo interest.",
      "Claims must be notified promptly with supporting evidence. Claims follow a documented lifecycle through review, assessment, decision and settlement.",
    ],
  },
  {
    heading: "Portal access",
    bullets: [
      "Access is granted to named authorised users. Credentials must not be shared, and organisations are responsible for requesting removal of users who leave.",
      "Users may view only information appropriate to their organisation and role. Attempting to access other organisations' records or restricted commercial data is a breach of these terms.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="Terms governing quotations, bookings, cargo acceptance, charges, payment and liability for services provided by Speedmax Intl. Cargo Solutions Corp."
      updated="25 August 2026"
      sections={sections}
      footnote="Draft prepared during system validation. Standard trading conditions, liability limits, jurisdiction and governing law must be settled by Speedmax and its legal advisers before these terms are relied upon."
    />
  );
}
