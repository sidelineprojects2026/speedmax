import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
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
import { getSession } from "@/lib/portal/session";
import {
  listInvoices,
  outstandingBalance,
  overdueBalance,
} from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Invoices" };

const typeLabels: Record<string, string> = {
  proforma: "Pro forma",
  invoice: "Invoice",
  debit_note: "Debit note",
  credit_note: "Credit note",
};

export default async function InvoicesPage() {
  const session = await getSession();
  const [invoices, outstanding, overdue] = await Promise.all([
    listInvoices(),
    outstandingBalance(session.currency),
    overdueBalance(session.currency),
  ]);

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Pro forma invoices, invoices, and credit or debit notes raised against your shipments."
      />

      <PageBody>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Outstanding balance">
            <Money amount={outstanding} currency={session.currency} emphasis />
          </SummaryCard>
          <SummaryCard label="Overdue" tone={Number(overdue) > 0 ? "danger" : undefined}>
            <Money amount={overdue} currency={session.currency} emphasis />
          </SummaryCard>
          <SummaryCard label="Payment terms">
            <span className="text-lg font-medium text-slate-900">Net 30 days</span>
          </SummaryCard>
        </div>

        <Panel padded={false}>
          {invoices.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No invoices yet"
              description="Invoices are raised once a shipment's services have been delivered."
            />
          ) : (
            <Table>
              <THead>
                <TH>Document</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Shipment</TH>
                <TH>Issued</TH>
                <TH>Due</TH>
                <TH align="right">Total</TH>
                <TH align="right">Paid</TH>
                <TH align="right">Balance</TH>
              </THead>
              <TBody>
                {invoices.map((inv) => (
                  <TR key={inv.id}>
                    <TD>
                      <Link
                        href={`/portal/invoices/${inv.id}`}
                        className="font-medium text-steel-600 hover:text-navy-900"
                      >
                        <Ref>{inv.invoiceNumber}</Ref>
                      </Link>
                    </TD>
                    <TD>{typeLabels[inv.type] ?? inv.type}</TD>
                    <TD>
                      <StatusBadge
                        lifecycle="invoice"
                        status={inv.status}
                        size="sm"
                      />
                    </TD>
                    <TD>
                      {inv.shipmentNumber ? (
                        <Ref className="text-slate-600">{inv.shipmentNumber}</Ref>
                      ) : (
                        <Value>{null}</Value>
                      )}
                    </TD>
                    <TD>
                      <DateText value={inv.issueDate} timeZone={session.timezone} />
                    </TD>
                    <TD>
                      <DateText value={inv.dueDate} timeZone={session.timezone} />
                    </TD>
                    <TD align="right">
                      <Money amount={inv.total} currency={inv.currency} />
                    </TD>
                    <TD align="right">
                      <Money amount={inv.amountPaid} currency={inv.currency} />
                    </TD>
                    <TD align="right">
                      <Money
                        amount={inv.balance}
                        currency={inv.currency}
                        emphasis
                        className={
                          inv.status === "overdue" ? "text-tone-danger-fg" : ""
                        }
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

function SummaryCard({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div
      className={`rounded-sm border bg-white p-5 ${
        tone === "danger" ? "border-tone-danger-br" : "border-slate-200"
      }`}
    >
      <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2.5 text-xl">{children}</p>
    </div>
  );
}
