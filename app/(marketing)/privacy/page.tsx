import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description:
    "How Speedmax collects, uses, separates and retains personal and commercial information.",
};

const sections: readonly LegalSection[] = [
  {
    heading: "What we collect and why",
    paragraphs: [
      "We collect only the information required to provide freight services and to meet our compliance, security, billing and support obligations. We do not collect information speculatively in case it becomes useful later.",
    ],
    bullets: [
      "Contact and account details for authorised users of customer, supplier and agent organisations.",
      "Shipment information: cargo descriptions, parties, addresses, routes, schedules and references.",
      "Documents supplied for commercial, transport, customs, cargo, finance, delivery or claim purposes.",
      "Financial records: invoices, payments, payment evidence and settlement history.",
      "Security and audit records: authentication events, authorisation failures, privilege changes, access to sensitive documents, and financial actions.",
    ],
  },
  {
    heading: "How information is separated",
    paragraphs: [
      "Customer-visible data, partner-visible data, internal operational data and restricted finance or security data are held separately and access is granted deny-by-default. Access is scoped by organisation, by assignment, and by field sensitivity.",
      "In practice this means a customer sees their own organisation's records and nobody else's, and internal cost, margin and partner rates are not exposed to customer or supplier users at all.",
    ],
  },
  {
    heading: "Documents and storage",
    paragraphs: [
      "Documents are held in private storage and shared through time-limited links rather than public URLs. Uploads are restricted by file type and scanned before they are made available. Replaced documents remain in version history rather than being overwritten.",
    ],
  },
  {
    heading: "Retention",
    paragraphs: [
      "Retention periods are defined by document and record category, and are subject to legal review for each operating country. Freight, customs and financial records generally carry statutory retention obligations that exceed the life of the shipment.",
      "We support lawful correction of information without destroying historical transaction evidence: corrections are recorded as amendments with the reason, not as silent edits.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "Subject to the applicable law in your jurisdiction, you may request access to the personal information we hold about you, ask us to correct it, or object to certain processing. Requests are handled through a documented data-subject procedure.",
      "Where we rely on consent, you may withdraw it; where we rely on contract or legal obligation, some information must be retained for the statutory period regardless.",
    ],
  },
  {
    heading: "Exports and disclosure",
    paragraphs: [
      "Data exports are logged and controlled. Information is disclosed to carriers, agents, brokers and authorities only to the extent required to move and clear the cargo, and to regulators where legally required.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Privacy enquiries and data-subject requests should be directed to privacy@speedmax.example.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      intro="How Speedmax Intl. Cargo Solutions Corp collects, uses, separates and retains personal and commercial information."
      updated="25 August 2026"
      sections={sections}
      footnote="Draft prepared during system validation. Retention periods, lawful bases and data-subject procedures require legal review for each operating country before this notice is published."
    />
  );
}
