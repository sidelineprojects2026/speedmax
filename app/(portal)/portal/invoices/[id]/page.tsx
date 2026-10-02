import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Banknote } from "lucide-react";
import { PageBody, PageHeader, Panel, buttonStyles } from "@/components/ui/layout";
import {
  DateText,
  Definition,
  DefinitionList,
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
import { getSession, can } from "@/lib/portal/session";
import { getInvoice, listPayments } from "@/lib/portal/queries";
import { chargeGroupLabel } from "@/lib/domain/charges";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const inv = await getInvoice(id);
  return { title: inv ? inv.invoiceNumber : "Invoice" };
}

const typeLabels: Record<string, string> = {
  proforma: "Pro forma invoice",
  invoice: "Invoice",
  debit_note: "Debit note",
  credit_note: "Credit note",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const allPayments = await listPayments();
  // Payments that touch this invoice, via their allocations (§10.1).
  const related = allPayments.filter((p) =>
    p.allocations.some((a) => a.invoiceId === invoice.id),
  );

  const isSettled = ["paid", "closed", "reversed"].includes(invoice.status);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Invoices", href: "/portal/invoices" },
          { label: invoice.invoiceNumber },
        ]}
        title={<Ref>{invoice.invoiceNumber}</Ref>}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge lifecycle="invoice" status={invoice.status} />
            <span className="text-sm text-slate-500">
              {typeLabels[invoice.type] ?? invoice.type}
              {invoice.shipmentNumber && (
                <>
                  {" · "}
                  <Ref>{invoice.shipmentNumber}</Ref>
                </>
              )}
            </span>
          </div>
        }
        actions={
          <>
            <button type="button" className={buttonStyles.secondary}>
              <Download className="size-4" aria-hidden="true" />
              Download PDF
            </button>
            {!isSettled && can(session, "payment.submit") && (
              <Link href="/portal/payments" className={buttonStyles.accent}>
                <Banknote className="size-4" aria-hidden="true" />
                Submit payment
              </Link>
            )}
          </>
        }
      />

      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            <Panel title="Charges" padded={false}>
              <Table>
                <THead>
                  <TH>Description</TH>
                  <TH>Group</TH>
                  <TH align="right">Qty</TH>
                  <TH align="right">Unit price</TH>
                  <TH align="right">Tax</TH>
                  <TH align="right">Amount</TH>
                </THead>
                <TBody>
                  {invoice.lines.map((line) => (
                    <TR key={line.id}>
                      <TD className="text-slate-800">{line.description}</TD>
                      <TD className="text-slate-500">
                        {chargeGroupLabel(line.chargeGroup)}
                      </TD>
                      <TD align="right" className="tnum">
                        {line.quantity}
                      </TD>
                      <TD align="right">
                        <Money
                          amount={line.unitPrice}
                          currency={invoice.currency}
                        />
                      </TD>
                      <TD align="right" className="tnum text-slate-500">
                        {Number(line.taxRatePct) > 0
                          ? `${Number(line.taxRatePct).toFixed(0)}%`
                          : "—"}
                      </TD>
                      <TD align="right">
                        <Money amount={line.amount} currency={invoice.currency} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="border-t-2 border-navy-900 bg-ice-50 px-5 py-4">
                <dl className="ml-auto max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between gap-8">
                    <dt className="text-slate-600">Subtotal</dt>
                    <dd>
                      <Money
                        amount={invoice.subtotal}
                        currency={invoice.currency}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-8">
                    <dt className="text-slate-600">Tax</dt>
                    <dd>
                      <Money
                        amount={invoice.taxTotal}
                        currency={invoice.currency}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-8 border-t border-slate-300 pt-2">
                    <dt className="font-semibold text-slate-900">Total</dt>
                    <dd>
                      <Money
                        amount={invoice.total}
                        currency={invoice.currency}
                        emphasis
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-8">
                    <dt className="text-slate-600">Paid</dt>
                    <dd>
                      <Money
                        amount={invoice.amountPaid}
                        currency={invoice.currency}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-8 border-t border-slate-300 pt-2">
                    <dt className="font-semibold text-slate-900">Balance due</dt>
                    <dd>
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
                    </dd>
                  </div>
                </dl>
              </div>
            </Panel>

            {related.length > 0 && (
              <Panel
                title="Payments applied"
                description="Payments allocate across invoices; only the portion applied here is shown."
                padded={false}
              >
                <Table>
                  <THead>
                    <TH>Reference</TH>
                    <TH>Status</TH>
                    <TH>Paid on</TH>
                    <TH>Bank reference</TH>
                    <TH align="right">Applied</TH>
                  </THead>
                  <TBody>
                    {related.map((payment) => {
                      const applied = payment.allocations.find(
                        (a) => a.invoiceId === invoice.id,
                      );
                      return (
                        <TR key={payment.id}>
                          <TD>
                            <Ref className="text-slate-800">
                              {payment.reference}
                            </Ref>
                          </TD>
                          <TD>
                            <StatusBadge
                              lifecycle="payment"
                              status={payment.status}
                              size="sm"
                            />
                          </TD>
                          <TD>
                            <DateText
                              value={payment.paidAt}
                              timeZone={session.timezone}
                            />
                          </TD>
                          <TD>
                            {payment.bankReference ? (
                              <Ref className="text-xs text-slate-600">
                                {payment.bankReference}
                              </Ref>
                            ) : (
                              <Value>{null}</Value>
                            )}
                          </TD>
                          <TD align="right">
                            <Money
                              amount={applied?.amount}
                              currency={payment.currency}
                              emphasis
                            />
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </Panel>
            )}
          </div>

          <div className="space-y-6">
            <Panel title="Details">
              <DefinitionList columns={1}>
                <Definition label="Issue date">
                  <DateText
                    value={invoice.issueDate}
                    timeZone={session.timezone}
                  />
                </Definition>
                <Definition label="Due date">
                  <DateText value={invoice.dueDate} timeZone={session.timezone} />
                </Definition>
                <Definition label="Currency">{invoice.currency}</Definition>
                <Definition label="Bill to">
                  {session.organizationName}
                </Definition>
              </DefinitionList>
            </Panel>

            {invoice.status === "overdue" && (
              <div className="rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
                <h2 className="font-semibold text-tone-danger-fg">
                  This invoice is overdue
                </h2>
                <p className="mt-1.5 text-sm text-tone-danger-fg/90">
                  If payment has already been sent, submit the remittance advice
                  and we will match it against this invoice.
                </p>
                <Link
                  href="/portal/payments"
                  className="mt-3 inline-block text-sm font-medium text-tone-danger-fg underline underline-offset-4"
                >
                  Submit payment evidence
                </Link>
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
