import Link from "next/link";
import {
  Ship,
  Plane,
  Truck,
  FileCheck2,
  Warehouse,
  ShieldCheck,
  ArrowRight,
  Check,
} from "lucide-react";
import { TrackForm } from "@/components/marketing/TrackForm";

const services = [
  {
    id: "ocean",
    icon: Ship,
    title: "Ocean Freight",
    body: "FCL and LCL across major trade lanes, with consolidation, transshipment and port-to-port or door-to-door coverage.",
  },
  {
    id: "air",
    icon: Plane,
    title: "Air Freight",
    body: "Standard, express and urgent airfreight where transit time governs, including temperature-controlled and high-value cargo.",
  },
  {
    id: "road-rail",
    icon: Truck,
    title: "Road & Rail",
    body: "Origin pickup, cross-border trucking, rail linehaul and final-mile delivery coordinated as legs of one shipment.",
  },
  {
    id: "customs",
    icon: FileCheck2,
    title: "Customs Brokerage",
    body: "Export and import clearance coordinated with licensed brokers, with requirement checklists that vary by country and commodity.",
  },
  {
    id: "warehousing",
    icon: Warehouse,
    title: "Warehousing & Consolidation",
    body: "Cargo receipt, inspection, storage, consolidation and deconsolidation at origin and destination.",
  },
  {
    id: "insurance",
    icon: ShieldCheck,
    title: "Cargo Insurance",
    body: "Declared-value cover arranged per shipment, with inspection and special-handling arrangements where cargo requires it.",
  },
];

const flow = [
  {
    step: "01",
    title: "Request",
    body: "Submit a Shipping Order with cargo lines, packages, route and service requirements.",
  },
  {
    step: "02",
    title: "Quotation",
    body: "We return route options with schedule, assumptions, exclusions, validity and a fixed price.",
  },
  {
    step: "03",
    title: "Booking",
    body: "On acceptance we confirm carrier space and assign origin agent, broker and destination agent.",
  },
  {
    step: "04",
    title: "Execution",
    body: "Pickup, inspection, export clearance, departure, transit and arrival — each milestone recorded.",
  },
  {
    step: "05",
    title: "Delivery",
    body: "Import release, delivery scheduling and proof of delivery with receiver, condition and quantity.",
  },
  {
    step: "06",
    title: "Settlement",
    body: "Invoicing, payment allocation and formal closure once operational and financial checks pass.",
  },
];

const controls = [
  "One accountable coordinator on every shipment",
  "Every milestone timestamped, sourced and attributable",
  "Documents versioned, verified and retained — never overwritten",
  "Customs requirements tracked per country, route and commodity",
  "Exceptions raised as structured records with an owner and a due date",
  "Corrections made by controlled reversal, never by deletion",
];

export default function HomePage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        {/* Faint structural grid — the plotted-chart feel, kept well back. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-steel-300 uppercase">
              International Shipping &amp; Logistics
            </p>
            <h1 className="mt-6 text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Freight moved with a record you can actually follow.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-steel-200">
              Speedmax coordinates the customer, supplier, origin agent, carrier,
              customs broker and destination agent as one operation — so a
              shipment is never a chain of forwarded emails and a spreadsheet
              nobody trusts.
            </p>

            <div className="mt-10 max-w-xl rounded-sm border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <TrackForm variant="dark" />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-steel-300">
              <Link
                href="/quote"
                className="group flex items-center gap-2 font-medium text-white"
              >
                Request a quotation
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link href="/services" className="transition-colors hover:text-white">
                Explore services
              </Link>
            </div>
          </div>

          {/* Manifest card — a real shipment record, not decoration. It shows a
              prospective customer exactly what they will be looking at. */}
          <div className="lg:pt-8">
            <div className="rounded-sm border border-white/12 bg-navy-800/80 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <span className="text-xs font-semibold tracking-[0.16em] text-steel-300 uppercase">
                  Shipment
                </span>
                <span className="ref text-sm text-white">SHP-2026-004182</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 px-5 py-5 text-sm">
                <div>
                  <dt className="text-xs text-steel-400">Origin</dt>
                  <dd className="mt-1 font-medium">Ningbo, CN</dd>
                </div>
                <div>
                  <dt className="text-xs text-steel-400">Destination</dt>
                  <dd className="mt-1 font-medium">Manila, PH</dd>
                </div>
                <div>
                  <dt className="text-xs text-steel-400">Mode</dt>
                  <dd className="mt-1 font-medium">Ocean · FCL</dd>
                </div>
                <div>
                  <dt className="text-xs text-steel-400">Container</dt>
                  <dd className="ref mt-1">MSKU 704 3318</dd>
                </div>
              </dl>

              <div className="border-t border-white/10 px-5 py-5">
                <p className="text-xs font-semibold tracking-[0.16em] text-steel-300 uppercase">
                  Timeline
                </p>
                <ol className="mt-4 space-y-3.5">
                  {[
                    { label: "Booking Confirmed", done: true },
                    { label: "Cargo Collected", done: true },
                    { label: "Departed Origin", done: true },
                    { label: "In Transit", done: false, current: true },
                    { label: "Arrived at Destination", done: false },
                    { label: "Delivered", done: false },
                  ].map((s) => (
                    <li key={s.label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          s.done
                            ? "border-transparent bg-emerald-400/90"
                            : s.current
                              ? "border-beacon-500 bg-beacon-500/20"
                              : "border-white/20"
                        }`}
                      >
                        {s.done && (
                          <Check
                            className="size-3 text-navy-900"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        )}
                        {s.current && (
                          <span className="size-1.5 rounded-full bg-beacon-500" />
                        )}
                      </span>
                      <span
                        className={
                          s.done || s.current ? "text-white" : "text-steel-400"
                        }
                      >
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-steel-400">
              Illustrative record — the customer timeline as it appears in the
              portal.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Services */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-steel-500 uppercase">
              Services
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Door to door, or any segment of it
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              A shipment is modelled as ordered legs with explicit custody
              handoffs, so multimodal, transshipment and consolidation cases do
              not have to be forced into a single carrier record.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-sm bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                id={service.id}
                className="scroll-mt-24 bg-white p-7 transition-colors hover:bg-ice-50"
              >
                <service.icon
                  className="size-6 text-steel-500"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {service.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                  {service.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Flow */}
      <section className="bg-ice-50">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-steel-500 uppercase">
              How it works
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Request to settlement, in one record
            </h2>
          </div>

          <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {flow.map((item) => (
              <li key={item.step} className="border-t-2 border-navy-900 pt-5">
                <span className="ref text-sm font-medium text-beacon-600">
                  {item.step}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Controls */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-steel-500 uppercase">
              Operating discipline
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              The controls behind the tracking page
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-700">
              Visibility is a by-product of how the work is recorded. Every
              material activity is assigned to a named person or partner, and
              posted facts are corrected by amendment rather than quietly
              rewritten.
            </p>
            <Link
              href="/about"
              className="group mt-8 inline-flex items-center gap-2 font-medium text-steel-600 hover:text-navy-900"
            >
              How we operate
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>

          <ul className="space-y-4">
            {controls.map((control) => (
              <li
                key={control}
                className="flex gap-3.5 border-b border-slate-200 pb-4 text-slate-700 last:border-0"
              >
                <Check
                  className="mt-0.5 size-5 shrink-0 text-steel-500"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>{control}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="bg-navy-900">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-6 py-16 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Tell us what needs to move.
            </h2>
            <p className="mt-3 max-w-xl text-steel-200">
              Send the route, the cargo and the timing. We will come back with
              route options, a schedule and a price with its assumptions stated.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/quote"
              className="group flex items-center gap-2 rounded-sm bg-beacon-500 px-6 py-3 font-medium text-white transition-colors hover:bg-beacon-600"
            >
              Request a Quote
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/contact"
              className="rounded-sm border border-steel-400/50 px-6 py-3 font-medium text-steel-100 transition-colors hover:border-steel-300 hover:text-white"
            >
              Talk to operations
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
