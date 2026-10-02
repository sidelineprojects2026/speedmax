import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Ship,
  Wallet,
  AlertTriangle,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState, buttonStyles } from "@/components/ui/layout";
import { DateText, Money, Ref } from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/portal/session";
import {
  listActionItems,
  listActiveShipments,
  listOpenExceptions,
  outstandingBalance,
  overdueBalance,
  shipmentTimeline,
} from "@/lib/portal/queries";
import { currentCustomerStep } from "@/lib/domain/milestones";

export const metadata: Metadata = { title: "Dashboard" };

const urgencyStyles = {
  high: "border-l-tone-danger-br bg-tone-danger-bg/40",
  medium: "border-l-tone-warning-br bg-tone-warning-bg/30",
  low: "border-l-slate-300 bg-white",
} as const;

export default async function PortalDashboard() {
  const session = await getSession();
  const [actions, active, exceptions, outstanding, overdue] = await Promise.all([
    listActionItems(),
    listActiveShipments(),
    listOpenExceptions(),
    outstandingBalance(session.currency),
    overdueBalance(session.currency),
  ]);

  const firstName = session.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description={
          actions.length > 0
            ? `${actions.length} item${actions.length === 1 ? "" : "s"} need your attention.`
            : "Nothing is waiting on you right now."
        }
        actions={
          <Link href="/portal/orders/new" className={buttonStyles.accent}>
            <Plus className="size-4" aria-hidden="true" />
            New Shipping Order
          </Link>
        }
      />

      <PageBody>
        {/* ---- Figures ---------------------------------------------------- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            icon={Ship}
            label="Active shipments"
            value={String(active.length)}
            href="/portal/shipments"
          />
          <Figure
            icon={Wallet}
            label="Outstanding balance"
            value={<Money amount={outstanding} currency={session.currency} />}
            href="/portal/invoices"
          />
          <Figure
            icon={AlertTriangle}
            label="Overdue"
            value={<Money amount={overdue} currency={session.currency} />}
            href="/portal/invoices"
            tone={Number(overdue) > 0 ? "danger" : "neutral"}
          />
          <Figure
            icon={TriangleAlert}
            label="Open exceptions"
            value={String(exceptions.length)}
            href="/portal/shipments"
            tone={exceptions.length > 0 ? "warning" : "neutral"}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* ---- Needs your attention ------------------------------------ */}
          <Panel
            title="Needs your attention"
            description="Sorted by risk, then by due date."
            padded={false}
          >
            {actions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing outstanding"
                description="No quotations awaiting acceptance, no orders returned for information, and no overdue invoices."
              />
            ) : (
              <ul className="divide-y divide-slate-150">
                {actions.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`flex items-start gap-4 border-l-4 px-5 py-4 transition-colors hover:bg-ice-50 ${
                        urgencyStyles[item.urgency]
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {item.detail}
                        </p>
                        {item.dueLabel && (
                          <p className="mt-1.5 text-xs font-medium text-slate-500">
                            {item.dueLabel}
                          </p>
                        )}
                      </div>
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ---- Shipments in progress ------------------------------------ */}
          <Panel
            title="Shipments in progress"
            actions={
              <Link href="/portal/shipments" className={buttonStyles.quiet}>
                View all
              </Link>
            }
            padded={false}
          >
            {active.length === 0 ? (
              <EmptyState
                icon={Ship}
                title="No shipments in progress"
                description="Accepted quotations become shipments once booking is confirmed."
              />
            ) : (
              <ul className="divide-y divide-slate-150">
                {active.map((shipment) => {
                  const step = currentCustomerStep(shipmentTimeline(shipment));
                  return (
                    <li key={shipment.id}>
                      <Link
                        href={`/portal/shipments/${shipment.id}`}
                        className="block px-5 py-4 transition-colors hover:bg-ice-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Ref className="text-sm font-medium text-slate-900">
                            {shipment.shipmentNumber}
                          </Ref>
                          <StatusBadge
                            lifecycle="shipment"
                            status={shipment.status}
                            size="sm"
                          />
                        </div>
                        <p className="mt-1.5 text-sm text-slate-600">
                          {shipment.originLabel} → {shipment.destinationLabel}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>{step ? step.label : "Awaiting first milestone"}</span>
                          <span>
                            ETA{" "}
                            <DateText
                              value={shipment.etaAt}
                              timeZone={session.timezone}
                            />
                          </span>
                        </div>
                        {shipment.hasActiveHold && (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-tone-danger-bg px-2 py-0.5 text-xs font-medium text-tone-danger-fg">
                            <TriangleAlert className="size-3" aria-hidden="true" />
                            On hold
                          </p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* ---- Open exceptions --------------------------------------------- */}
        {exceptions.length > 0 && (
          <div className="mt-6">
            <Panel
              title="Open exceptions"
              description="What we are doing about them, and what we need from you."
              padded={false}
            >
              <ul className="divide-y divide-slate-150">
                {exceptions.map((exc) => (
                  <li key={exc.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Ref className="text-sm font-medium text-slate-900">
                        {exc.exceptionNumber}
                      </Ref>
                      <StatusBadge
                        lifecycle="exception"
                        status={exc.status}
                        size="sm"
                      />
                      <span className="text-xs text-slate-500 capitalize">
                        {exc.type} · {exc.severity} severity
                      </span>
                      {exc.shipmentNumber && (
                        <Ref className="text-xs text-slate-500">
                          {exc.shipmentNumber}
                        </Ref>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {exc.customerStatement}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      {exc.ownerName && <span>Owner: {exc.ownerName}</span>}
                      {exc.targetResolutionAt && (
                        <span>
                          Target resolution:{" "}
                          <DateText
                            value={exc.targetResolutionAt}
                            timeZone={session.timezone}
                          />
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  href,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: React.ReactNode;
  href: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const accent = {
    neutral: "text-steel-500",
    warning: "text-tone-warning-fg",
    danger: "text-tone-danger-fg",
  }[tone];

  return (
    <Link
      href={href}
      className="group rounded-sm border border-slate-200 bg-white p-5 transition-colors hover:border-steel-300"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
          {label}
        </p>
        <Icon className={`size-4 ${accent}`} aria-hidden={true} />
      </div>
      <p className="tnum mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
