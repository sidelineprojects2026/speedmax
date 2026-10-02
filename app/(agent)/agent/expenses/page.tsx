import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, Plus, Info } from "lucide-react";
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
import { getAgentSession, agentCan } from "@/lib/agent/session";
import { expenseTotals, listExpenses } from "@/lib/agent/queries";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const session = await getAgentSession();
  const [expenses, totals] = await Promise.all([
    listExpenses(),
    expenseTotals(session.currency),
  ]);

  const canSubmit = agentCan(session, "expense.submit");
  const drafts = expenses.filter((e) => e.status === "draft");

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Costs you have incurred on Speedmax's behalf, and where each claim sits on its way to settlement."
        actions={
          <button type="button" className={buttonStyles.accent}>
            <Plus className="size-4" aria-hidden="true" />
            Record expense
          </button>
        }
      />

      <PageBody>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Draft — not submitted">
            <Money amount={totals.draft} currency={totals.currency} emphasis />
          </SummaryCard>
          <SummaryCard label="Awaiting settlement">
            <Money
              amount={totals.awaitingSettlement}
              currency={totals.currency}
              emphasis
            />
          </SummaryCard>
          <SummaryCard label="Settled to date">
            <Money amount={totals.settled} currency={totals.currency} emphasis />
          </SummaryCard>
        </div>

        {drafts.length > 0 && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-warning-br bg-tone-warning-bg p-4">
            <Info
              className="mt-0.5 size-5 shrink-0 text-tone-warning-fg"
              aria-hidden="true"
            />
            <p className="text-sm text-tone-warning-fg">
              <span className="font-semibold">
                {drafts.length} expense{drafts.length === 1 ? "" : "s"} still in
                draft.
              </span>{" "}
              Draft expenses are not visible to Speedmax finance and will not be
              settled. Attach evidence and submit them.
              {!canSubmit && (
                <>
                  {" "}
                  Submission requires the agent manager role — ask your manager
                  to release these.
                </>
              )}
            </p>
          </div>
        )}

        <Panel padded={false}>
          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses recorded"
              description="Record costs you incur on a shipment — duties advanced, storage, trucking, examination fees — and attach the evidence."
            />
          ) : (
            <Table>
              <THead>
                <TH>Reference</TH>
                <TH>Description</TH>
                <TH>Shipment</TH>
                <TH>Status</TH>
                <TH>Incurred</TH>
                <TH>Settled</TH>
                <TH align="right">Amount</TH>
              </THead>
              <TBody>
                {expenses.map((expense) => (
                  <TR key={expense.id}>
                    <TD>
                      <Ref className="font-medium text-slate-900">
                        {expense.reference}
                      </Ref>
                      {expense.evidenceName ? (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {expense.evidenceName}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-tone-warning-fg">
                          No evidence attached
                        </p>
                      )}
                    </TD>
                    <TD>
                      <p className="text-slate-800">{expense.description}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <Ref>{expense.chargeCode}</Ref>
                      </p>
                    </TD>
                    <TD>
                      <Link
                        href="/agent/shipments"
                        className="text-steel-600 hover:text-navy-900"
                      >
                        <Ref>{expense.shipmentNumber}</Ref>
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge
                        lifecycle="vendor_bill"
                        status={expense.status}
                        size="sm"
                      />
                      {expense.rejectionReason && (
                        <p className="mt-1 max-w-xs text-xs text-tone-warning-fg">
                          {expense.rejectionReason}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <DateText
                        value={expense.incurredOn}
                        timeZone={session.timezone}
                      />
                    </TD>
                    <TD>
                      {expense.settledAt ? (
                        <DateText
                          value={expense.settledAt}
                          timeZone={session.timezone}
                        />
                      ) : (
                        <Value>{null}</Value>
                      )}
                    </TD>
                    <TD align="right">
                      <Money
                        amount={expense.amount}
                        currency={expense.currency}
                        emphasis
                        className={
                          expense.status === "reversed"
                            ? "text-slate-400 line-through"
                            : ""
                        }
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>

        <p className="mt-4 text-sm text-slate-500">
          Reversed expenses are shown struck through rather than removed, and are
          excluded from the totals above. A reversal is a correction with a
          reason, not a deletion.
        </p>
      </PageBody>
    </>
  );
}

function SummaryCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2.5 text-xl">{children}</p>
    </div>
  );
}
