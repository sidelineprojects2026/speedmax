"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CalendarClock,
  Ship,
  CheckSquare,
  FolderOpen,
  Receipt,
  Archive,
  BookOpen,
} from "lucide-react";

/**
 * §19 agent navigation — My Assignments; Upcoming; Active Shipments; Tasks;
 * Documents; Expenses; Completed.
 *
 * Seven destinations, so unlike the customer portal there is no grouping to
 * apply — a flat list reads faster than three headings over two items each.
 */

export interface AgentNavBadges {
  readonly actions: number;
  readonly upcoming: number;
  readonly active: number;
  readonly tasks: number;
  readonly documents: number;
}

const items: {
  href: string;
  label: string;
  icon: typeof ClipboardList;
  badge?: keyof AgentNavBadges;
}[] = [
  { href: "/agent", label: "My Assignments", icon: ClipboardList, badge: "actions" },
  { href: "/agent/upcoming", label: "Upcoming", icon: CalendarClock, badge: "upcoming" },
  { href: "/agent/shipments", label: "Active Shipments", icon: Ship, badge: "active" },
  { href: "/agent/tasks", label: "Tasks", icon: CheckSquare, badge: "tasks" },
  { href: "/agent/documents", label: "Documents", icon: FolderOpen, badge: "documents" },
  { href: "/agent/expenses", label: "Expenses", icon: Receipt },
  { href: "/agent/completed", label: "Completed", icon: Archive },
  { href: "/agent/manual", label: "User Manual", icon: BookOpen },
];

function isActive(pathname: string, href: string): boolean {
  // The dashboard matches exactly; assignment detail pages belong to it too,
  // since that is where "My Assignments" leads.
  if (href === "/agent") {
    return pathname === "/agent" || pathname.startsWith("/agent/assignments");
  }
  return pathname.startsWith(href);
}

export function AgentNav({ badges }: { badges: AgentNavBadges }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Agent portal" className="px-3 py-5">
      <ul className="space-y-0.5">
        {items.map((item) => {
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
                  <span
                    className={`tnum rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                      item.badge === "actions" ? "bg-beacon-500" : "bg-white/15"
                    }`}
                  >
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

/** Horizontal variant for narrow viewports — see the customer portal for why. */
export function AgentNavCompact({ badges }: { badges: AgentNavBadges }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Agent portal" className="border-t border-white/10">
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
                  <span
                    className={`tnum rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                      item.badge === "actions" ? "bg-beacon-500" : "bg-white/15"
                    }`}
                  >
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
