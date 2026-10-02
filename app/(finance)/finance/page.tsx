import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock, FileSpreadsheet } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState, buttonStyles } from "@/components/ui/layout";
import {
  DateText,
  Money,
  Ref,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Value,
} from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getFinanceSession, financeCan } from "@/lib/finance/session";
import {
  arAging,
  apPosition,
  listFinanceActions,
  listInvoices,
  listInvoicesToAction,
  unallocatedReceipts,
} from "@/lib/finance/queries";
import { canApprove } from "@/lib/domain/segregation";

export const metadata: Metadata = { title: "Billing" };

const urgencyStyles = {
  high: "border-l-tone-danger-br bg-tone-danger-bg/40",
  medium: "border-l-tone-warning-br bg-tone-warning-bg/30",
  low: "border-l-slate-300 bg-white",
} as const;

const typeLabels: Record<string, string> = {
  proforma: "Pro forma",
  invoice: "Invoice",
  debit_note: "Debit note",
  credit_note: "Credit note",
};

export default async function BillingPage() {
  const session = await getFinanceSession();
  const [actions, queue, invoices, aging, ap, unallocated] = await Promise.all([
    listFinanceActions(),
    listInvoicesToAction(),
    listInvoices(),
    arAging(session.baseCurrency),
    apPosition(session.baseCurrency),
    unallocatedReceipts(session.baseCurrency),
  ]);

  const canIssue = financeCan(session, "invoice.issue");

  return (
    <>
      <PageHeader
        title="Billing"
        description={
          actions.length > 0
            ? `${actions.length} item${actions.length === 1 ? "" : "s"} need attention across receivables, payables and margin.`
            : "Nothing outstanding across receivables and payables."
        }
        actions={
          <button type="button" className={buttonStyles.accent}>
            Raise invoice
          </button>
        }
      />

      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label="Receivable" value={<Money amount={aging.total} currency={aging.currency} />} href="/finance/collections" />
          <Figure label="Unallocated receipts" value={<Money amount={unallocated} currency={session.baseCurrency} />} href="/finance/collections" tone={Number(unallocated) > 0 ? "warning" : "neutral"} />
          <Figure label="Payable, approved" value={<Money amount={ap.approvedUnpaid} currency={ap.currency} />} href="/finance/vendor-bills" />
          <Figure label="Accrued" value={<Money amount={ap.accrued} currency={ap.currency} />} href="/finance/vendor-bills" note="Estimates, not yet obligations" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <Panel
            title="Needs attention"
            description="Sorted by risk. Unbilled shipments and margin breaches first."
            padded={false}
          >
            {actions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing outstanding"
                description="No unbilled shipments, no margin breaches, no overdue invoices and no payments awaiting verification."
              />
            ) : (
              <ul className="divide-y divide-slate-150">
                {actions.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`flex items-start gap-4 border-l-4 px-5 py-4 transition-colors hover:bg-ice-50 ${urgencyStyles[item.urgency]}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {item.amountLabel && (
                          <p className="tnum text-sm font-medium text-slate-700">
                            {item.amountLabel}
                          </p>
                        )}
                        <ArrowRight
                          className="mt-1 ml-auto size-4 text-slate-400"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Awaiting issue"
            description="Drafts and invoices pending approval."
            padded={false}
          >
            {queue.length === 0 ? (
              <EmptyState
                icon={FileSpreadsheet}
                title="Nothing to issue"
                description="Every prepared invoice has been issued."
              />
            ) : (
              <ul className="divide-y divide-slate-150">
                {queue.map((invoice) => {
                  // §13 — holding invoice.issue is not enough; the issuer must
                  // be someone other than the preparer.
                  const decision = canApprove({
                    actorId: session.userId,
                    hasPermission: canIssue,
                    preparedById: invoice.preparedById,
                    action: "issuing an invoice",
                  });

                  return (
                    <li key={invoice.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Ref className="font-medium text-slate-900">
                            {invoice.invoiceNumber}
                          </Ref>
                          <p className="mt-1 text-sm text-slate-600">
                            {invoice.customerName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Prepared by {invoice.preparedByName ?? "unknown"}
                          </p>
                        </div>
                        <div className="text-right">
                          <Money
                            amount={invoice.total}
                            currency={invoice.currency}
                            emphasis
                          />
                          <div className="mt-1.5">
                            <StatusBadge
                              lifecycle="invoice"
                              status={invoice.status}
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        {decision.allowed ? (
                          <button
                            type="button"
                            disabled
                            className={buttonStyles.accent}
                            title="Disabled until the database is connected"
                          >
                            Issue invoice
                          </button>
                        ) : (
                          <p className="flex items-start gap-2 rounded-sm bg-tone-warning-bg p-3 text-xs text-tone-warning-fg">
                            <Lock
                              className="mt-0.5 size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{decision.reason}</span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="mt-6">
          <Panel title="All invoices" padded={false}>
            <Table>
              <THead>
                <TH>Document</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Customer</TH>
                <TH>Shipment</TH>
                <TH>Issued</TH>
                <TH>Due</TH>
                <TH align="right">Total</TH>
                <TH align="right">Balance</TH>
              </THead>
              <TBody>
                {invoices.map((invoice) => (
                  <TR key={invoice.id}>
                    <TD>
                      <Ref className="font-medium text-slate-900">
                        {invoice.invoiceNumber}
                      </Ref>
                    </TD>
                    <TD>{typeLabels[invoice.type] ?? invoice.type}</TD>
                    <TD>
                      <StatusBadge
                        lifecycle="invoice"
                        status={invoice.status}
                        size="sm"
                      />
                    </TD>
                    <TD>{invoice.customerName}</TD>
                    <TD>
                      {invoice.shipmentNumber ? (
                        <Ref className="text-slate-600">
                          {invoice.shipmentNumber}
                        </Ref>
                      ) : (
                        <Value>{null}</Value>
                      )}
                    </TD>
                    <TD>
                      <DateText
                        value={invoice.issueDate}
                        timeZone={session.timezone}
                      />
                    </TD>
                    <TD>
                      <DateText
                        value={invoice.dueDate}
                        timeZone={session.timezone}
                      />
                    </TD>
                    <TD align="right">
                      <Money amount={invoice.total} currency={invoice.currency} />
                    </TD>
                    <TD align="right">
                      <Money
                        amount={invoice.balance}
                        currency={invoice.currency}
                        emphasis
                        className={
                          invoice.status === "overdue"
                            ? "text-tone-danger-fg"
                            : ""
                        }
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}

function Figure({
  label,
  value,
  href,
  tone = "neutral",
  note,
}: {
  label: string;
  value: React.ReactNode;
  href: string;
  tone?: "neutral" | "warning";
  note?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm border bg-white p-5 transition-colors hover:border-steel-300 ${
        tone === "warning" ? "border-tone-warning-br" : "border-slate-200"
      }`}
    >
      <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="tnum mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </Link>
  );
}
