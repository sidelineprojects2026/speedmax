import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Speedmax Intl. Cargo Solutions Corp — how we operate, the controls we work to, and the standards our processes are built against.",
};

const principles = [
  {
    title: "One accountable owner",
    body: "Every shipment has a named Speedmax Operations Coordinator. Every material activity is assigned to a named user, a partner organisation, or an automated integration — never to nobody in particular.",
  },
  {
    title: "Appropriate visibility",
    body: "Customers and suppliers see what is appropriate to their relationship. Internal cost, margin, risk notes and partner rates are restricted, and that restriction is enforced by the system rather than by convention.",
  },
  {
    title: "No self-approval",
    body: "No user approves their own high-risk commercial or financial transaction. Whoever prepares a quotation is not the person who approves it; whoever prepares an invoice is not the person who verifies the payment.",
  },
  {
    title: "Correction, not deletion",
    body: "Posted financial facts and completed milestones are corrected by controlled reversal or amendment. History is preserved with the reason for every change, because an audit trail that can be quietly edited is not an audit trail.",
  },
];

const standards = [
  {
    name: "FIATA",
    detail:
      "Recognised freight-forwarding document families — FCR, FCT, FWR, FBL and FWB. Formal FIATA-branded documents are issued only under applicable authorisation and controls.",
    href: "https://fiata.org/resources/",
  },
  {
    name: "WCO Data Model",
    detail:
      "Harmonised cross-border data definitions for customs and regulatory agencies, used as the reference for how declaration and clearance data is structured.",
    href: "https://www.wcoomd.org/datamodel",
  },
  {
    name: "OWASP ASVS 5.0",
    detail:
      "Application Security Verification Standard, used as the security baseline for the platform handling customer, cargo and financial data.",
    href: "https://owasp.org/www-project-application-security-verification-standard/",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-steel-300 uppercase">
            About Speedmax
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            The operational bridge between everyone your cargo touches
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-steel-200">
            Speedmax Intl. Cargo Solutions Corp coordinates customers, suppliers,
            origin and destination agents, carriers, customs brokers, warehouses
            and transport providers — and takes responsibility for the seams
            between them, which is where shipments usually go wrong.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                How we operate
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Freight forwarding fails quietly: an unanswered email, a document
                nobody checked, a cost nobody recorded. These four principles
                exist to make those failures visible early rather than at
                invoicing.
              </p>
            </div>

            <dl className="space-y-8">
              {principles.map((p) => (
                <div key={p.title} className="border-l-2 border-steel-300 pl-6">
                  <dt className="text-lg font-semibold text-slate-900">
                    {p.title}
                  </dt>
                  <dd className="mt-2 leading-relaxed text-slate-600">
                    {p.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-ice-50">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Standards we build against
            </h2>
            <p className="mt-4 text-slate-600">
              These inform how our documents, customs data and platform security
              are structured. They do not replace legal, customs, tax or
              operational advice for any specific country or shipment.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-sm bg-slate-200 lg:grid-cols-3">
            {standards.map((s) => (
              <div key={s.name} className="bg-white p-7">
                <h3 className="text-lg font-semibold text-slate-900">
                  {s.name}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                  {s.detail}
                </p>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-steel-600 underline underline-offset-4"
                >
                  Reference
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy-900">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Work with us
            </h2>
            <p className="mt-2 text-steel-200">
              Send a shipment to quote, or ask about the agent network.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/quote"
              className="rounded-sm bg-beacon-500 px-6 py-3 font-medium text-white transition-colors hover:bg-beacon-600"
            >
              Request a Quote
            </Link>
            <Link
              href="/contact"
              className="rounded-sm border border-steel-400/50 px-6 py-3 font-medium text-steel-100 transition-colors hover:border-steel-300 hover:text-white"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
