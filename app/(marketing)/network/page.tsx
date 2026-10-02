import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Users, MapPin, Handshake } from "lucide-react";

export const metadata: Metadata = {
  title: "Network & Coverage",
  description:
    "Speedmax operates through employees, partner agents and third-party service providers across origin and destination markets.",
};

const model = [
  {
    icon: Users,
    title: "Speedmax coordinators",
    body: "Every shipment has one accountable Speedmax Operations Coordinator who owns execution and coordinates all parties. Not a shared inbox — a named person.",
  },
  {
    icon: Handshake,
    title: "Partner agents",
    body: "Origin agents coordinate the supplier, pickup, export handoff and departure. Destination agents coordinate arrival, release, delivery and proof of delivery. Each carries scope, deliverables, due dates and commercial terms.",
  },
  {
    icon: MapPin,
    title: "Local service providers",
    body: "Carriers, customs brokers, warehouses and transporters are engaged per shipment against recorded instructions and acknowledged assignments.",
  },
];

const lanes = [
  { region: "East Asia", markets: "China, Hong Kong, Taiwan, South Korea, Japan" },
  { region: "Southeast Asia", markets: "Philippines, Vietnam, Thailand, Malaysia, Singapore, Indonesia" },
  { region: "South Asia", markets: "India, Bangladesh, Sri Lanka" },
  { region: "Middle East", markets: "UAE, Saudi Arabia, Qatar, Oman" },
  { region: "Europe", markets: "Netherlands, Germany, United Kingdom, Italy, Spain" },
  { region: "North America", markets: "United States, Canada, Mexico" },
  { region: "Oceania", markets: "Australia, New Zealand" },
];

export default function NetworkPage() {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-steel-300 uppercase">
            Network &amp; Coverage
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            A coordinated network, with one party accountable
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-steel-200">
            Speedmax operates through its own staff, partner agents and
            third-party providers. The value is not the size of the network — it
            is that responsibility for each handoff is assigned and recorded
            rather than assumed.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="grid gap-px overflow-hidden rounded-sm bg-slate-200 lg:grid-cols-3">
            {model.map((item) => (
              <div key={item.title} className="bg-white p-8">
                <item.icon
                  className="size-6 text-steel-500"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h2 className="mt-5 text-lg font-semibold text-slate-900">
                  {item.title}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-ice-50">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Where we move cargo
            </h2>
            <p className="mt-4 text-slate-600">
              Coverage is arranged per lane through the agent network. If a
              market is not listed, ask — partner coverage is extended against
              real demand rather than advertised speculatively.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-navy-900">
                  <th
                    scope="col"
                    className="py-3 pr-6 text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase"
                  >
                    Region
                  </th>
                  <th
                    scope="col"
                    className="py-3 text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase"
                  >
                    Markets served
                  </th>
                </tr>
              </thead>
              <tbody>
                {lanes.map((lane) => (
                  <tr key={lane.region} className="border-b border-slate-200">
                    <th
                      scope="row"
                      className="py-4 pr-6 align-top font-semibold whitespace-nowrap text-slate-900"
                    >
                      {lane.region}
                    </th>
                    <td className="py-4 text-slate-700">{lane.markets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Coverage listed for illustration during system validation. Confirmed
            lanes, offices and agent agreements are to be supplied by Speedmax
            before publication.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Need a lane that is not listed?
          </h2>
          <Link
            href="/contact"
            className="group flex shrink-0 items-center gap-2 rounded-sm bg-navy-900 px-6 py-3 font-medium text-white transition-colors hover:bg-navy-700"
          >
            Talk to operations
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
