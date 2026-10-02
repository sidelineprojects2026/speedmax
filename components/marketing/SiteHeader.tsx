import Link from "next/link";
import { Phone, Mail, ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";

const nav = [
  { href: "/services", label: "Services" },
  { href: "/network", label: "Network" },
  { href: "/track", label: "Track" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header>
      {/* Utility strip — the operational details a shipper looks for first. */}
      <div className="hidden border-b border-white/10 bg-navy-950 text-steel-300 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs">
          <p className="tracking-wide">
            Speedmax Intl. Cargo Solutions Corp — Freight forwarding, customs
            brokerage and end-to-end logistics
          </p>
          <div className="flex items-center gap-6">
            <a
              href="tel:+6320000000"
              className="flex items-center gap-2 transition-colors hover:text-white"
            >
              <Phone className="size-3.5" aria-hidden="true" />
              <span className="ref">+63 2 0000 0000</span>
            </a>
            <a
              href="mailto:operations@speedmax.example"
              className="flex items-center gap-2 transition-colors hover:text-white"
            >
              <Mail className="size-3.5" aria-hidden="true" />
              operations@speedmax.example
            </a>
          </div>
        </div>
      </div>

      <div className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <Link href="/" className="shrink-0" aria-label="Speedmax home">
            <Wordmark />
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-8 text-sm">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-steel-200 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="hidden rounded-sm border border-steel-400/50 px-4 py-2 text-sm text-steel-100 transition-colors hover:border-steel-300 hover:text-white sm:block"
            >
              Customer Portal
            </Link>
            <Link
              href="/quote"
              className="group flex items-center gap-2 rounded-sm bg-beacon-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-beacon-600"
            >
              Request a Quote
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>

        {/* Mobile nav — the desktop bar collapses rather than hiding behind a
            menu button, keeping every destination one tap away. */}
        <nav aria-label="Main (compact)" className="border-t border-white/10 lg:hidden">
          <ul className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-6 py-3 text-sm">
            {nav.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="text-steel-200 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
