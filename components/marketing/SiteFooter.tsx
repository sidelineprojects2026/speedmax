import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";

const columns = [
  {
    heading: "Services",
    links: [
      { href: "/services#ocean", label: "Ocean Freight" },
      { href: "/services#air", label: "Air Freight" },
      { href: "/services#road-rail", label: "Road & Rail" },
      { href: "/services#customs", label: "Customs Brokerage" },
      { href: "/services#warehousing", label: "Warehousing & Consolidation" },
      { href: "/services#insurance", label: "Cargo Insurance" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Speedmax" },
      { href: "/network", label: "Network & Coverage" },
      { href: "/contact", label: "Contact" },
      { href: "/quote", label: "Request a Quote" },
    ],
  },
  {
    heading: "Portals",
    links: [
      { href: "/portal", label: "Customer Portal" },
      { href: "/agent", label: "Agent Portal" },
      { href: "/finance", label: "Finance Workspace" },
      { href: "/track", label: "Track a Shipment" },
      { href: "/privacy", label: "Privacy Notice" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 text-steel-300">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Wordmark className="text-white" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              One traceable record connecting the customer request, supplier
              confirmation, booking, shipment execution, delivery evidence and
              settlement.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="text-xs font-semibold tracking-[0.16em] text-white uppercase">
                {col.heading}
              </h2>
              <ul className="mt-5 space-y-3 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Speedmax Intl. Cargo Solutions Corp.
            All rights reserved.
          </p>
          <p className="text-steel-400">
            Freight forwarding services provided subject to standard trading
            conditions.
          </p>
        </div>
      </div>
    </footer>
  );
}
