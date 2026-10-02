import type { Metadata } from "next";
import Link from "next/link";
import {
  Ship,
  Plane,
  Truck,
  FileCheck2,
  Warehouse,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Ocean and air freight, road and rail, customs brokerage, warehousing and consolidation, and cargo insurance — coordinated end to end by Speedmax.",
};

const services = [
  {
    id: "ocean",
    icon: Ship,
    title: "Ocean Freight",
    lede: "FCL and LCL movements across major trade lanes, including transshipment and consolidation.",
    points: [
      "Full container (FCL) and less-than-container (LCL) loads",
      "Port-to-port, door-to-port and full door-to-door coverage",
      "Consolidation and deconsolidation at origin and destination",
      "Container, seal and bill of lading references recorded per leg",
      "Free time, demurrage and detention terms captured at booking",
    ],
  },
  {
    id: "air",
    icon: Plane,
    title: "Air Freight",
    lede: "Where transit time governs the decision — standard, express and urgent service levels.",
    points: [
      "Standard, express and urgent priorities",
      "Temperature-controlled and cold-chain handling",
      "High-value, fragile and oversized cargo arrangements",
      "Dangerous goods handled only under qualified review",
      "Master and house air waybill references tracked per movement",
    ],
  },
  {
    id: "road-rail",
    icon: Truck,
    title: "Road & Rail",
    lede: "Origin collection, cross-border linehaul and final-mile delivery as legs of one shipment.",
    points: [
      "Supplier pickup and origin drayage",
      "Cross-border trucking and rail linehaul",
      "Final-mile delivery with scheduled time windows",
      "Custody handoff recorded at every change of responsibility",
      "Vehicle and trip references retained for each segment",
    ],
  },
  {
    id: "customs",
    icon: FileCheck2,
    title: "Customs Brokerage",
    lede: "Export and import clearance coordinated with licensed brokers in each jurisdiction.",
    points: [
      "Export and import declaration coordination",
      "Requirement checklists that vary by country, route and commodity",
      "Duty, tax and official charge tracking with supporting evidence",
      "Query, examination and hold status surfaced as it happens",
      "Permits, licences and certificates of origin managed as documents",
    ],
  },
  {
    id: "warehousing",
    icon: Warehouse,
    title: "Warehousing & Consolidation",
    lede: "Cargo received, verified and staged before it moves — and again on arrival.",
    points: [
      "Cargo receipt against expected quantity and condition",
      "Inspection with actual measurements and photographic evidence",
      "Short-term storage at origin and destination",
      "Consolidation of multiple orders into one movement",
      "Deconsolidation and release against delivery instructions",
    ],
  },
  {
    id: "insurance",
    icon: ShieldCheck,
    title: "Cargo Insurance & Protection",
    lede: "Cover and special handling arranged per shipment against declared value.",
    points: [
      "Declared-value cargo insurance arranged per movement",
      "Pre-shipment inspection where the commodity warrants it",
      "Special handling: fragile, stackable, oversized, controlled goods",
      "Temperature range monitoring for sensitive cargo",
      "Claims raised, evidenced and pursued through to settlement",
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-steel-300 uppercase">
            Services
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Every mode, coordinated as one shipment record
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-steel-200">
            A movement is rarely one carrier and one leg. Speedmax models each
            segment separately — with its own provider, schedule, references and
            custody handoff — so multimodal and consolidated shipments stay
            legible instead of collapsing into a single opaque booking.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="space-y-16">
            {services.map((service, i) => (
              <article
                key={service.id}
                id={service.id}
                className={`scroll-mt-24 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 ${
                  i > 0 ? "border-t border-slate-200 pt-16" : ""
                }`}
              >
                <div>
                  <service.icon
                    className="size-7 text-steel-500"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
                    {service.title}
                  </h2>
                  <p className="mt-3 leading-relaxed text-slate-600">
                    {service.lede}
                  </p>
                </div>

                <ul className="grid gap-px self-start overflow-hidden rounded-sm bg-slate-200">
                  {service.points.map((point) => (
                    <li
                      key={point}
                      className="bg-white px-5 py-3.5 text-sm text-slate-700"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ice-50">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Not sure which service fits?
            </h2>
            <p className="mt-2 max-w-xl text-slate-600">
              Send the route, cargo and timing. We will come back with route
              options and their trade-offs stated plainly.
            </p>
          </div>
          <Link
            href="/quote"
            className="group flex shrink-0 items-center gap-2 rounded-sm bg-navy-900 px-6 py-3 font-medium text-white transition-colors hover:bg-navy-700"
          >
            Request a Quote
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>
    </>
  );
}
