import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Upload, Info } from "lucide-react";
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
import { getSession, can } from "@/lib/portal/session";
import { listPayments, outstandingBalance } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Payments" };

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card",
  online_gateway: "Online payment",
  offset: "Offset",
  other: "Other",
};

export default async function PaymentsPage() {
  const session = await getSession();
  const [payments, outstanding] = await Promise.all([
    listPayments(),
    outstandingBalance(session.currency),
  ]);

  const canSubmit = can(session, "payment.submit");
  const awaitingVerification = payments.filter((p) => p.status === "submitted");

  return (
    <>
      <PageHeader
        title="Payments"
        description="Payment evidence you have submitted, and how each payment has been allocated across invoices."
        actions={
          canSubmit ? (
            <button type="button" className={buttonStyles.accent}>
              <Upload className="size-4" aria-hidden="true" />
              Submit payment evidence
            </button>
          ) : undefined
        }
      />

      <PageBody>
        {!canSubmit && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-info-br bg-tone-info-bg p-4">
            <Info
              className="mt-0.5 size-5 shrink-0 text-tone-info-fg"
              aria-hidden="true"
            />
            <p className="text-sm text-tone-info-fg">
              You can view payments but not submit new ones. Submitting payment
              evidence is restricted to users with the finance role — ask your
              company administrator if you need that access.
            </p>
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-sm border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
              Outstanding balance
            </p>
            <p className="mt-2.5 text-xl">
              <Money amount={outstanding} currency={session.currency} emphasis />
            </p>
          </div>
          <div className="rounded-sm border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
              Awaiting verification
            </p>
            <p className="tnum mt-2.5 text-xl font-semibold text-slate-900">
              {awaitingVerification.length}
            </p>
          </div>
        </div>

        <Panel padded={false}>
          {payments.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No payments recorded"
              description="Submit remittance advice against an invoice and it will appear here for verification."
            />
          ) : (
            <Table>
              <THead>
                <TH>Reference</TH>
                <TH>Status</TH>
                <TH>Method</TH>
                <TH>Paid on</TH>
                <TH>Bank reference</TH>
                <TH>Allocated to</TH>
                <TH align="right">Amount</TH>
              </THead>
              <TBody>
                {payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD>
                      <Ref className="font-medium text-slate-900">
                        {payment.reference}
                      </Ref>
                      {payment.evidenceName && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {payment.evidenceName}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge
                        lifecycle="payment"
                        status={payment.status}
                        size="sm"
                      />
                      {payment.status === "submitted" && (
                        <p className="mt-1 text-xs text-slate-500">
                          Speedmax finance will verify this
                        </p>
                      )}
                      {payment.verifiedAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          <DateText
                            value={payment.verifiedAt}
                            timeZone={session.timezone}
                          />
                        </p>
                      )}
                    </TD>
                    <TD>{methodLabels[payment.method] ?? payment.method}</TD>
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
                    <TD>
                      <ul className="space-y-1">
                        {payment.allocations.map((alloc) => (
                          <li key={alloc.invoiceId}>
                            <Link
                              href={`/portal/invoices/${alloc.invoiceId}`}
                              className="text-steel-600 hover:text-navy-900"
                            >
                              <Ref className="text-xs">{alloc.invoiceNumber}</Ref>
                            </Link>
                            <span className="tnum ml-2 text-xs text-slate-500">
                              <Money amount={alloc.amount} currency={payment.currency} />
                            </span>
                          </li>
                        ))}
                      </ul>
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
          )}
        </Panel>
      </PageBody>
    </>
  );
}
