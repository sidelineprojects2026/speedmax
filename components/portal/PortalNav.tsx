"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ReceiptText,
  Ship,
  Radar,
  FolderOpen,
  FileSpreadsheet,
  Banknote,
  ShieldAlert,
  MessagesSquare,
  Building2,
  BookOpen,
} from "lucide-react";

/**
 * §19 customer navigation — all eleven sections.
 *
 * Badge counts are passed in from the server layout rather than fetched here,
 * so the nav stays a presentational client component and there is no waterfall
 * of client-side requests on every page load.
 */

export interface NavBadges {
  readonly actions: number;
  readonly messages: number;
  readonly openClaims: number;
}

const groups: {
  heading: string | null;
  items: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: keyof NavBadges;
  }[];
}[] = [
  {
    heading: null,
    items: [
      { href: "/portal", label: "Dashboard", icon: LayoutDashboard, badge: "actions" },
    ],
  },
  {
    heading: "Commercial",
    items: [
      { href: "/portal/orders", label: "Shipping Orders", icon: FileText },
      { href: "/portal/quotations", label: "Quotations", icon: ReceiptText },
    ],
  },
  {
    heading: "Operations",
    items: [
      { href: "/portal/shipments", label: "Shipments", icon: Ship },
      { href: "/portal/tracking", label: "Tracking", icon: Radar },
      { href: "/portal/documents", label: "Documents", icon: FolderOpen },
    ],
  },
  {
    heading: "Finance",
    items: [
      { href: "/portal/invoices", label: "Invoices", icon: FileSpreadsheet },
      { href: "/portal/payments", label: "Payments", icon: Banknote },
    ],
  },
  {
    heading: "Support",
    items: [
      { href: "/portal/claims", label: "Claims", icon: ShieldAlert, badge: "openClaims" },
      { href: "/portal/messages", label: "Messages", icon: MessagesSquare, badge: "messages" },
      { href: "/portal/profile", label: "Company Profile", icon: Building2 },
      { href: "/portal/manual", label: "User Manual", icon: BookOpen },
    ],
  },
];

/**
 * Horizontal variant, used below the `lg` breakpoint.
 *
 * The vertical sidebar is right on a desktop and wrong on a phone: eleven
 * stacked items fill the whole viewport, so every page would open with a screen
 * of navigation and the content pushed below the fold. Here the same
 * destinations become one scrollable strip, grouped labels dropped since the
 * grouping does not survive a single row anyway.
 */
export function PortalNavCompact({ badges }: { badges: NavBadges }) {
  const pathname = usePathname();
  const items = groups.flatMap((g) => g.items);

  return (
    <nav aria-label="Portal" className="border-t border-white/10">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2">
        {items.map((item) => {
          const active =
            item.href === "/portal"
              ? pathname === "/portal"
              : pathname.startsWith(item.href);
          const count = item.badge ? badges[item.badge] : 0;

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-steel-500/20 font-medium text-white"
                    : "text-steel-200 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon
                  className="size-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {item.label}
                {count > 0 && (
                  <span className="tnum rounded-full bg-beacon-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PortalNav({ badges }: { badges: NavBadges }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal" className="px-3 py-5">
      {groups.map((group, gi) => (
        <div key={group.heading ?? "root"} className={gi > 0 ? "mt-7" : ""}>
          {group.heading && (
            <h2 className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-steel-400 uppercase">
              {group.heading}
            </h2>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              // Exact match for the dashboard root; prefix match elsewhere, so
              // a detail page keeps its section highlighted.
              const active =
                item.href === "/portal"
                  ? pathname === "/portal"
                  : pathname.startsWith(item.href);
              const count = item.badge ? badges[item.badge] : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-steel-500/20 font-medium text-white"
                        : "text-steel-200 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon
                      className="size-4 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 && (
                      <span className="tnum rounded-full bg-beacon-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
