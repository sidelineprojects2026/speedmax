import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
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
} from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/portal/session";
import { listQuotations, routeOptionTotal } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const session = await getSession();
  const quotations = await listQuotations();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Route options and prices we have released against your orders. A quotation can only be accepted while it is still valid."
      />

      <PageBody>
        <Panel padded={false}>
          {quotations.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No quotations yet"
              description="Once an order is accepted for quotation, priced route options appear here."
            />
          ) : (
            <Table>
              <THead>
                <TH>Quotation</TH>
                <TH>Status</TH>
                <TH>Order</TH>
                <TH align="center">Options</TH>
                <TH align="right">From</TH>
                <TH>Valid until</TH>
                <TH>Released</TH>
              </THead>
              <TBody>
                {quotations.map((q) => {
                  const totals = q.routeOptions.map((o) =>
                    Number(routeOptionTotal(o, q.currency).total),
                  );
                  const cheapest =
                    totals.length > 0 ? Math.min(...totals).toFixed(2) : null;
                  const expired =
                    q.status === "released" && q.validUntil < today;

                  return (
                    <TR key={q.id}>
                      <TD>
                        <Link
                          href={`/portal/quotations/${q.id}`}
                          className="font-medium text-steel-600 hover:text-navy-900"
                        >
                          <Ref>{q.quoteNumber}</Ref>
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Version {q.versionNo}
                        </p>
                      </TD>
                      <TD>
                        {/* An expired-but-still-"released" quotation is shown as
                            expired: §8.2 forbids accepting it either way. */}
                        <StatusBadge
                          lifecycle="quotation"
                          status={expired ? "expired" : q.status}
                          size="sm"
                        />
                      </TD>
                      <TD>
                        <Ref className="text-slate-600">{q.orderNumber}</Ref>
                      </TD>
                      <TD align="center" className="tnum">
                        {q.routeOptions.length}
                      </TD>
                      <TD align="right">
                        <Money amount={cheapest} currency={q.currency} emphasis />
                      </TD>
                      <TD>
                        <DateText value={q.validUntil} timeZone={session.timezone} />
                      </TD>
                      <TD>
                        <DateText value={q.releasedAt} timeZone={session.timezone} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
