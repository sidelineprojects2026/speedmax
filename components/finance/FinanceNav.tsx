"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSpreadsheet,
  HandCoins,
  Users,
  ReceiptText,
  Handshake,
  Receipt,
  Split,
  ClipboardCheck,
  ChartNoAxesColumn,
  BookOpen,
} from "lucide-react";

/**
 * §19 finance navigation.
 *
 * Nine sections, grouped by what they do to the ledger: money coming in, money
 * going out, and the controls over both. Flat, that list reads as an
 * undifferentiated wall; grouped, the shape of the job is obvious.
 */

export interface FinanceNavBadges {
  readonly actions: number;
  readonly billing: number;
  readonly collections: number;
  readonly vendorBills: number;
  readonly expenses: number;
  readonly allocations: number;
  readonly close: number;
}

const groups: {
  heading: string | null;
  items: {
    href: string;
    label: string;
    icon: typeof FileSpreadsheet;
    badge?: keyof FinanceNavBadges;
  }[];
}[] = [
  {
    heading: null,
    items: [
      { href: "/finance", label: "Billing", icon: FileSpreadsheet, badge: "billing" },
    ],
  },
  {
    heading: "Receivables",
    items: [
      { href: "/finance/collections", label: "Collections", icon: HandCoins, badge: "collections" },
      { href: "/finance/accounts", label: "Customer Accounts", icon: Users },
    ],
  },
  {
    heading: "Payables",
    items: [
      { href: "/finance/vendor-bills", label: "Vendor Bills", icon: ReceiptText, badge: "vendorBills" },
      { href: "/finance/settlements", label: "Agent Settlements", icon: Handshake },
      { href: "/finance/expenses", label: "Expenses", icon: Receipt, badge: "expenses" },
    ],
  },
  {
    heading: "Control",
    items: [
      { href: "/finance/allocations", label: "Allocations", icon: Split, badge: "allocations" },
      { href: "/finance/close", label: "Close", icon: ClipboardCheck, badge: "close" },
      { href: "/finance/reports", label: "Reports", icon: ChartNoAxesColumn },
      { href: "/finance/manual", label: "User Manual", icon: BookOpen },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/finance") {
    return pathname === "/finance" || pathname.startsWith("/finance/invoices");
  }
  return pathname.startsWith(href);
}

export function FinanceNav({ badges }: { badges: FinanceNavBadges }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Finance workspace" className="px-3 py-5">
      {groups.map((group, gi) => (
        <div key={group.heading ?? "root"} className={gi > 0 ? "mt-7" : ""}>
          {group.heading && (
            <h2 className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-steel-400 uppercase">
              {group.heading}
            </h2>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
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
                      <span className="tnum rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white">
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

/** Horizontal variant for narrow viewports. */
export function FinanceNavCompact({ badges }: { badges: FinanceNavBadges }) {
  const pathname = usePathname();
  const items = groups.flatMap((g) => g.items);

  return (
    <nav aria-label="Finance workspace" className="border-t border-white/10">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
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
                  <span className="tnum rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
