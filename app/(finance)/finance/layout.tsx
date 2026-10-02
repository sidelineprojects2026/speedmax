import Link from "next/link";
import { ExternalLink, TriangleAlert, ShieldAlert } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { IdentitySwitcher } from "@/components/ui/IdentitySwitcher";
import { getIdentity } from "@/lib/identity";
import { FinanceNav, FinanceNavCompact } from "@/components/finance/FinanceNav";
import { getFinanceSession } from "@/lib/finance/session";
import {
  listAllocatableCosts,
  listCloseCandidates,
  listExpensesToAction,
  listFinanceActions,
  listInvoicesToAction,
  listPaymentsToVerify,
  listVendorBills,
} from "@/lib/finance/queries";

export default async function FinanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getFinanceSession();
  const identity = await getIdentity("finance");
  const [actions, billing, collections, bills, expenses, costs, close] =
    await Promise.all([
      listFinanceActions(),
      listInvoicesToAction(),
      listPaymentsToVerify(),
      listVendorBills(),
      listExpensesToAction(),
      listAllocatableCosts(),
      listCloseCandidates(),
    ]);

  const badges = {
    actions: actions.length,
    billing: billing.length,
    collections: collections.length,
    vendorBills: bills.filter(
      (b) => b.status === "draft" || b.status === "verified",
    ).length,
    expenses: expenses.length,
    allocations: costs.filter((c) => !c.isAllocated).length,
    close: close.length,
  };

  const initials = session.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  const workspaceLabel = (
    <p className="text-[10px] font-semibold tracking-[0.18em] text-steel-400 uppercase">
      Finance Workspace
    </p>
  );

  return (
    <div className="min-h-screen bg-ice-50 lg:grid lg:grid-cols-[260px_1fr]">
      {/* ---- Compact header, below `lg` ---------------------------------- */}
      <div className="bg-navy-900 lg:hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <Link href="/" className="text-white" aria-label="Speedmax home">
              <Wordmark />
            </Link>
            <div className="mt-1.5">{workspaceLabel}</div>
          </div>
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-steel-500 text-xs font-semibold text-white"
            title={`${session.fullName} · ${session.jobTitle}`}
          >
            {initials}
          </span>
        </div>
        <FinanceNavCompact badges={badges} />
      </div>

      {/* ------------------------------------------------------------ Sidebar */}
      <aside className="hidden flex-col bg-navy-900 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-white/10 px-5 py-4">
          <Link href="/" className="text-white" aria-label="Speedmax home">
            <Wordmark />
          </Link>
          <div className="mt-2">{workspaceLabel}</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <FinanceNav badges={badges} />
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-steel-500 text-sm font-semibold text-white"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {session.fullName}
              </p>
              <p className="truncate text-xs text-steel-400">
                {session.jobTitle}
              </p>
            </div>
          </div>
          <p className="mt-2 px-1 text-xs text-steel-400">
            Reporting currency {session.baseCurrency}
          </p>
          <div className="mt-3 border-t border-white/10 pt-3">
            <IdentitySwitcher
              workspace="finance"
              current={{
                id: identity.profile.id,
                fullName: identity.profile.fullName,
                jobTitle: identity.profile.jobTitle ?? "",
              }}
              options={identity.options}
            />
          </div>
          <Link
            href="/"
            className="mt-2 flex items-center gap-1.5 px-1 text-xs text-steel-400 transition-colors hover:text-white"
          >
            <ExternalLink className="size-3" aria-hidden="true" />
            Back to speedmax.example
          </Link>
        </div>
      </aside>

      {/* ------------------------------------------------------------ Content */}
      <div className="flex min-w-0 flex-col">
        {/* Internal-only marker. This workspace shows cost, margin and partner
            rates — the fields BR-008 hides from customers and agents — so the
            boundary is stated rather than assumed. */}
        <div className="flex items-center gap-2.5 border-b border-navy-700 bg-navy-800 px-6 py-2 text-xs text-steel-200">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold text-white">Internal.</span> This
            workspace shows supplier cost, margin and partner rates. These are
            restricted under §13 and must not be shared with customers or agents.
          </p>
        </div>

        {session.isDemo && (
          <div
            role="status"
            className="flex items-start gap-2.5 border-b border-tone-warning-br bg-tone-warning-bg px-6 py-2.5 text-sm text-tone-warning-fg"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-semibold">Demo mode.</span> Authentication is
              not enabled — you are signed in as{" "}
              <span className="font-medium">{session.fullName}</span> (
              {session.jobTitle}) against sample data.
            </p>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
