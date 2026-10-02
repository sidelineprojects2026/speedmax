import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, Clock, ArrowRight, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Speedmax Intl. Cargo Solutions Corp — operations, pricing, finance and claims.",
};

const desks = [
  {
    name: "Operations",
    purpose:
      "Live shipments, pickups, milestones, customs status, delivery scheduling and exceptions.",
    email: "operations@speedmax.example",
    phone: "+63 2 0000 0000",
  },
  {
    name: "Pricing",
    purpose:
      "Quotations, route options, rate validity, additional charges and change requests.",
    email: "pricing@speedmax.example",
    phone: "+63 2 0000 0001",
  },
  {
    name: "Finance",
    purpose:
      "Invoices, statements of account, payment evidence, allocations and balances.",
    email: "finance@speedmax.example",
    phone: "+63 2 0000 0002",
  },
  {
    name: "Claims",
    purpose:
      "Cargo damage, shortage and loss notices, survey coordination and settlement.",
    email: "claims@speedmax.example",
    phone: "+63 2 0000 0003",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-steel-300 uppercase">
            Contact
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Reach the desk that can actually act
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-steel-200">
            If your shipment is already with us, the fastest route is a message
            on the shipment record in the portal — it reaches the assigned
            coordinator with the full context attached.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="grid gap-px overflow-hidden rounded-sm bg-slate-200 sm:grid-cols-2">
            {desks.map((desk) => (
              <div key={desk.name} className="bg-white p-7">
                <h2 className="text-lg font-semibold text-slate-900">
                  {desk.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {desk.purpose}
                </p>
                <div className="mt-5 space-y-2.5 text-sm">
                  <a
                    href={`mailto:${desk.email}`}
                    className="flex items-center gap-2.5 text-steel-600 underline underline-offset-4"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden="true" />
                    {desk.email}
                  </a>
                  <a
                    href={`tel:${desk.phone.replace(/\s/g, "")}`}
                    className="ref flex items-center gap-2.5 text-slate-700"
                  >
                    <Phone className="size-4 shrink-0" aria-hidden="true" />
                    {desk.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex gap-3.5">
              <Building2
                className="mt-0.5 size-5 shrink-0 text-steel-500"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold text-slate-900">Head office</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Speedmax Intl. Cargo Solutions Corp
                  <br />
                  Address to be confirmed
                  <br />
                  Metro Manila, Philippines
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <Clock
                className="mt-0.5 size-5 shrink-0 text-steel-500"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold text-slate-900">Hours</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Monday–Friday, 08:00–18:00 PHT
                  <br />
                  Shipments in transit are monitored outside office hours.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <ArrowRight
                className="mt-0.5 size-5 shrink-0 text-steel-500"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold text-slate-900">New enquiries</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Send route, cargo and timing through the quote form for the
                  fastest turnaround.
                </p>
                <Link
                  href="/quote"
                  className="mt-2 inline-block text-sm font-medium text-steel-600 underline underline-offset-4"
                >
                  Request a Quote
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-12 rounded-sm bg-ice-50 p-4 text-sm text-slate-500">
            Contact details shown for system validation. Confirmed office
            addresses, numbers and desk routing are to be supplied by Speedmax
            before publication.
          </p>
        </div>
      </section>
    </>
  );
}
