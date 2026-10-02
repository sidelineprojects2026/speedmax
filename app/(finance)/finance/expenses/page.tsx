import type { Metadata } from "next";
import { Receipt, Lock } from "lucide-react";
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
import { listExpenses, listExpensesToAction } from "@/lib/finance/queries";
import { canApprove } from "@/lib/domain/segregation";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const session = await getFinanceSession();
  const [expenses, queue] = await Promise.all([
    listExpenses(),
    listExpensesToAction(),
  ]);

  const canApproveExpense = financeCan(session, "expense.approve");

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Costs recorded by agents and internal staff against shipments, awaiting verification, approval and settlement."
      />

      <PageBody>
        <Panel
          title={`Awaiting a decision (${queue.length})`}
          description="Verify the evidence, then approve for settlement."
          padded={false}
        >
          {queue.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nothing awaiting a decision"
              description="Every submitted expense has been approved or resolved."
            />
          ) : (
            <ul className="divide-y divide-slate-150">
              {queue.map((expense) => {
                const decision = canApprove({
                  actorId: session.userId,
                  hasPermission: canApproveExpense,
                  preparedById: expense.submittedById,
                  action: "approving an expense",
                });

                return (
                  <li key={expense.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Ref className="font-medium text-slate-900">
                            {expense.reference}
                          </Ref>
                          <StatusBadge
                            lifecycle="vendor_bill"
                            status={expense.status}
                            size="sm"
                          />
                          <span className="rounded-sm bg-ice-100 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize">
                            {expense.source}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-800">
                          {expense.description}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {expense.organizationName} · {expense.submittedByName} ·{" "}
                          <Ref>{expense.shipmentNumber}</Ref>
                        </p>
                        {!expense.evidenceName && (
                          <p className="mt-1.5 text-xs font-medium text-tone-warning-fg">
                            No evidence attached — §10.2 requires supporting
                            documents before approval.
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Money
                          amount={expense.amount}
                          currency={expense.currency}
                          emphasis
                        />
                        {expense.fx && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            <Money
                              amount={expense.fx.baseAmount}
                              currency={expense.fx.baseCurrency}
                            />{" "}
                            at {expense.fx.appliedRate}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      {decision.allowed && expense.evidenceName ? (
                        <button type="button" disabled className={buttonStyles.accent}>
                          Approve expense
                        </button>
                      ) : (
                        <p className="flex items-start gap-2 rounded-sm bg-tone-warning-bg p-3 text-xs text-tone-warning-fg">
                          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {!expense.evidenceName
                              ? "Supporting evidence is required before this expense can be approved."
                              : !decision.allowed
                                ? decision.reason
                                : ""}
                          </span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="mt-6">
          <Panel title="All expenses" padded={false}>
            <Table>
              <THead>
                <TH>Reference</TH>
                <TH>Description</TH>
                <TH>Source</TH>
                <TH>Shipment</TH>
                <TH>Status</TH>
                <TH>Incurred</TH>
                <TH align="right">Amount</TH>
                <TH align="right">Base ({session.baseCurrency})</TH>
              </THead>
              <TBody>
                {expenses.map((expense) => (
                  <TR key={expense.id}>
                    <TD>
                      <Ref className="font-medium text-slate-900">
                        {expense.reference}
                      </Ref>
                    </TD>
                    <TD>
                      <p className="text-slate-800">{expense.description}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <Ref>{expense.chargeCode}</Ref>
                      </p>
                    </TD>
                    <TD>
                      <p className="capitalize">{expense.source}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {expense.organizationName}
                      </p>
                    </TD>
                    <TD>
                      <Ref className="text-xs text-slate-600">
                        {expense.shipmentNumber}
                      </Ref>
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
                    <TD align="right">
                      <Money
                        amount={expense.amount}
                        currency={expense.currency}
                        className={
                          expense.status === "reversed"
                            ? "text-slate-400 line-through"
                            : ""
                        }
                      />
                    </TD>
                    <TD align="right">
                      {expense.fx ? (
                        <>
                          <Money
                            amount={expense.fx.baseAmount}
                            currency={expense.fx.baseCurrency}
                            className={
                              expense.status === "reversed"
                                ? "text-slate-400 line-through"
                                : ""
                            }
                          />
                          <p className="tnum mt-0.5 text-xs text-slate-500">
                            @ {expense.fx.appliedRate}
                          </p>
                        </>
                      ) : expense.currency === session.baseCurrency ? (
                        <Money
                          amount={expense.amount}
                          currency={expense.currency}
                        />
                      ) : (
                        <Value>{null}</Value>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Panel>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Every converted amount carries its applied rate, source and date
          (BR-028). Reversed expenses stay visible, struck through, and count
          toward nothing.
        </p>
      </PageBody>
    </>
  );
}
