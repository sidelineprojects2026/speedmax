import type { Metadata } from "next";
import { HandCoins, Lock, TriangleAlert } from "lucide-react";
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
  listInvoices,
  listPayments,
  listPaymentsToVerify,
} from "@/lib/finance/queries";
import { canVerifyPayment } from "@/lib/domain/segregation";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const session = await getFinanceSession();
  const [toVerify, payments, invoices, aging] = await Promise.all([
    listPaymentsToVerify(),
    listPayments(),
    listInvoices(),
    arAging(session.baseCurrency),
  ]);

  const canVerify = financeCan(session, "payment.verify");
  const overdue = invoices.filter((i) => i.status === "overdue");

  return (
    <>
      <PageHeader
        title="Collections"
        description="Receivables position, overdue invoices, and payment evidence awaiting verification."
      />

      <PageBody>
        {/* ---- AR aging ---------------------------------------------------- */}
        <Panel
          title="Accounts receivable aging"
          description={`As at ${new Date().toISOString().slice(0, 10)} · ${aging.currency}`}
          padded={false}
        >
          <Table>
            <THead>
              <TH>Current</TH>
              <TH>1–30 days</TH>
              <TH>31–60 days</TH>
              <TH>61–90 days</TH>
              <TH>Over 90 days</TH>
              <TH align="right">Total</TH>
            </THead>
            <TBody>
              <TR>
                <TD><Money amount={aging.current} currency={aging.currency} /></TD>
                <TD>
                  <Money
                    amount={aging.days1to30}
                    currency={aging.currency}
                    className={Number(aging.days1to30) > 0 ? "text-tone-warning-fg" : ""}
                  />
                </TD>
                <TD>
                  <Money
                    amount={aging.days31to60}
                    currency={aging.currency}
                    className={Number(aging.days31to60) > 0 ? "text-tone-danger-fg" : ""}
                  />
                </TD>
                <TD>
                  <Money
                    amount={aging.days61to90}
                    currency={aging.currency}
                    className={Number(aging.days61to90) > 0 ? "text-tone-danger-fg" : ""}
                  />
                </TD>
                <TD>
                  <Money
                    amount={aging.over90}
                    currency={aging.currency}
                    className={Number(aging.over90) > 0 ? "text-tone-danger-fg" : ""}
                  />
                </TD>
                <TD align="right">
                  <Money amount={aging.total} currency={aging.currency} emphasis />
                </TD>
              </TR>
            </TBody>
          </Table>
        </Panel>

        {/* ---- Overdue ----------------------------------------------------- */}
        {overdue.length > 0 && (
          <div className="mt-6">
            <Panel
              title={`Overdue (${overdue.length})`}
              description="Chase these first."
              padded={false}
            >
              <Table>
                <THead>
                  <TH>Invoice</TH>
                  <TH>Customer</TH>
                  <TH>Due</TH>
                  <TH align="right">Days overdue</TH>
                  <TH align="right">Balance</TH>
                </THead>
                <TBody>
                  {overdue.map((invoice) => (
                    <TR key={invoice.id}>
                      <TD>
                        <Ref className="font-medium text-slate-900">
                          {invoice.invoiceNumber}
                        </Ref>
                        {invoice.shipmentNumber && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            <Ref>{invoice.shipmentNumber}</Ref>
                          </p>
                        )}
                      </TD>
                      <TD>{invoice.customerName}</TD>
                      <TD>
                        <DateText
                          value={invoice.dueDate}
                          timeZone={session.timezone}
                        />
                      </TD>
                      <TD align="right" className="tnum text-tone-danger-fg">
                        {invoice.daysOverdue}
                      </TD>
                      <TD align="right">
                        <Money
                          amount={invoice.balance}
                          currency={invoice.currency}
                          emphasis
                          className="text-tone-danger-fg"
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Panel>
          </div>
        )}

        {/* ---- Verification queue ------------------------------------------ */}
        <div className="mt-6">
          <Panel
            title={`Awaiting verification (${toVerify.length})`}
            description="§13 separates payment verification from preparation. Verify against the bank record, then allocate."
            padded={false}
          >
            {toVerify.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title="Nothing awaiting verification"
                description="Every submitted payment has been verified."
              />
            ) : (
              <ul className="divide-y divide-slate-150">
                {toVerify.map((payment) => {
                  const decision = canVerifyPayment(
                    session.userId,
                    canVerify,
                    payment.recordedById,
                  );
                  const hasUnallocated = Number(payment.unallocated) > 0;

                  return (
                    <li key={payment.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <Ref className="font-medium text-slate-900">
                              {payment.reference}
                            </Ref>
                            <StatusBadge
                              lifecycle="payment"
                              status={payment.status}
                              size="sm"
                            />
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {payment.customerName} · paid{" "}
                            <DateText
                              value={payment.paidAt}
                              timeZone={session.timezone}
                            />
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Bank reference{" "}
                            {payment.bankReference ? (
                              <Ref>{payment.bankReference}</Ref>
                            ) : (
                              "—"
                            )}
                            {payment.evidenceName && ` · ${payment.evidenceName}`}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Recorded by {payment.recordedByName}
                          </p>
                        </div>
                        <div className="text-right">
                          <Money
                            amount={payment.amount}
                            currency={payment.currency}
                            emphasis
                          />
                        </div>
                      </div>

                      {/* Allocation state — §10.1 supports partial, full and
                          overpayment, so unapplied money must be visible. */}
                      {payment.allocations.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm">
                          {payment.allocations.map((alloc) => (
                            <li
                              key={alloc.invoiceId}
                              className="flex justify-between gap-6 text-slate-600"
                            >
                              <Ref>{alloc.invoiceNumber}</Ref>
                              <Money
                                amount={alloc.amount}
                                currency={payment.currency}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {hasUnallocated && (
                        <p className="mt-3 flex items-start gap-2 rounded-sm border border-tone-warning-br bg-tone-warning-bg p-3 text-sm text-tone-warning-fg">
                          <TriangleAlert
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            <span className="font-semibold">
                              <Money amount={payment.unallocated} currency={payment.currency} />{" "}
                              unallocated.
                            </span>{" "}
                            Money received against no invoice. Apply it or record
                            it as a customer credit — it must not sit unapplied
                            through period end.
                          </span>
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {decision.allowed ? (
                          <>
                            <button type="button" disabled className={buttonStyles.accent}>
                              Verify payment
                            </button>
                            <button type="button" disabled className={buttonStyles.secondary}>
                              Allocate
                            </button>
                          </>
                        ) : (
                          <p className="flex items-start gap-2 rounded-sm bg-tone-warning-bg p-3 text-xs text-tone-warning-fg">
                            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
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

        {/* ---- All payments ------------------------------------------------ */}
        <div className="mt-6">
          <Panel title="Payment history" padded={false}>
            <Table>
              <THead>
                <TH>Reference</TH>
                <TH>Status</TH>
                <TH>Customer</TH>
                <TH>Paid</TH>
                <TH>Verified</TH>
                <TH>Allocated to</TH>
                <TH align="right">Unallocated</TH>
                <TH align="right">Amount</TH>
              </THead>
              <TBody>
                {payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD>
                      <Ref className="font-medium text-slate-900">
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
                    <TD>{payment.customerName}</TD>
                    <TD>
                      <DateText value={payment.paidAt} timeZone={session.timezone} />
                    </TD>
                    <TD>
                      {payment.verifiedAt ? (
                        <>
                          <DateText
                            value={payment.verifiedAt}
                            timeZone={session.timezone}
                          />
                          <p className="text-xs text-slate-500">
                            {payment.verifiedByName}
                          </p>
                        </>
                      ) : (
                        <Value>{null}</Value>
                      )}
                    </TD>
                    <TD>
                      {payment.allocations.length === 0 ? (
                        <Value>{null}</Value>
                      ) : (
                        <ul className="space-y-0.5">
                          {payment.allocations.map((a) => (
                            <li key={a.invoiceId}>
                              <Ref className="text-xs">{a.invoiceNumber}</Ref>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TD>
                    <TD align="right">
                      <Money
                        amount={payment.unallocated}
                        currency={payment.currency}
                        className={
                          Number(payment.unallocated) > 0
                            ? "text-tone-warning-fg"
                            : ""
                        }
                      />
                    </TD>
                    <TD align="right">
                      <Money
                        amount={payment.amount}
                        currency={payment.currency}
                        emphasis
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
