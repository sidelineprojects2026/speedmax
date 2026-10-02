import type { Metadata } from "next";
import { QuoteForm } from "./QuoteForm";

export const metadata: Metadata = {
  title: "Request a Quote",
  description:
    "Send Speedmax your route, cargo and timing and receive route options with schedule, assumptions and price.",
};

const expectations = [
  {
    title: "Route options, not one number",
    body: "Where more than one routing is viable we quote each, with its schedule and trade-offs stated.",
  },
  {
    title: "Assumptions written down",
    body: "Every quotation carries its assumptions, exclusions and validity period, so there are no discovered charges later.",
  },
  {
    title: "Special cargo reviewed first",
    body: "Hazardous, temperature-controlled, oversized and controlled goods go to qualified review before we price them.",
  },
];

export default function QuotePage() {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-steel-300 uppercase">
            Request a Quote
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Tell us what needs to move
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-steel-200">
            The more precise the cargo and timing, the tighter the quotation. If
            something is not settled yet — the Incoterm, the exact weight — say
            so and we will quote against stated assumptions.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-20 lg:py-20">
          <div>
            <QuoteForm />
          </div>

          <aside className="lg:pt-2">
            <div className="rounded-sm border border-slate-200 bg-ice-50 p-6">
              <h2 className="text-sm font-semibold tracking-[0.14em] text-slate-700 uppercase">
                What you will get back
              </h2>
              <ul className="mt-5 space-y-5">
                {expectations.map((item) => (
                  <li key={item.title}>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-7 border-t border-slate-200 pt-5">
                <p className="text-sm text-slate-600">
                  Prefer to talk it through?
                </p>
                <a
                  href="mailto:operations@speedmax.example"
                  className="mt-1 block text-sm font-medium text-steel-600 underline underline-offset-4"
                >
                  operations@speedmax.example
                </a>
                <a
                  href="tel:+6320000000"
                  className="ref mt-1 block text-sm text-slate-700"
                >
                  +63 2 0000 0000
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
