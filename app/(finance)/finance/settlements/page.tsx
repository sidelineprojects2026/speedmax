import type { Metadata } from "next";
import { Handshake, Lock } from "lucide-react";
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
import { listSettlements } from "@/lib/finance/queries";
import { canApprove } from "@/lib/domain/segregation";

export const metadata: Metadata = { title: "Agent Settlements" };

const kindLabels: Record<string, string> = {
  fee: "Fee",
  reimbursement: "Reimbursement",
  advance: "Advance",
  deduction: "Deduction",
};

/** Advances and deductions reduce the net; fees and reimbursements increase it. */
const kindSign: Record<string, "add" | "subtract"> = {
  fee: "add",
  reimbursement: "add",
  advance: "subtract",
  deduction: "subtract",
};

export default async function SettlementsPage() {
  const session = await getFinanceSession();
  const settlements = await listSettlements();
  const canApproveSettlement = financeCan(session, "settlement.approve");

  return (
    <>
      <PageHeader
        title="Agent Settlements"
        description="Fees, reimbursements, advances and deductions netted per agent and period (§10.2)."
        actions={
          <button type="button" className={buttonStyles.accent}>
            Prepare settlement
          </button>
        }
      />

      <PageBody>
        {settlements.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={Handshake}
              title="No settlements"
              description="Settlements are prepared per agent at the end of each period."
            />
          </Panel>
        ) : (
          <div className="space-y-6">
            {settlements.map((settlement) => {
              const decision = canApprove({
                actorId: session.userId,
                hasPermission: canApproveSettlement,
                preparedById: settlement.preparedById,
                action: "approving a settlement",
              });

              const grouped = (["fee", "reimbursement", "advance", "deduction"] as const).map(
                (kind) => ({
                  kind,
                  lines: settlement.lines.filter((l) => l.kind === kind),
                }),
              );

              return (
                <Panel
                  key={settlement.id}
                  title={
                    <span className="flex flex-wrap items-center gap-3 normal-case">
                      <Ref className="text-base font-semibold tracking-normal text-slate-900">
                        {settlement.settlementNumber}
                      </Ref>
                      <StatusBadge
                        lifecycle="vendor_bill"
                        status={settlement.status}
                        size="sm"
                      />
                      <span className="text-sm font-normal tracking-normal text-slate-600">
                        {settlement.agentName}
                      </span>
                    </span>
                  }
                  description={
                    <>
                      Period{" "}
                      <DateText
                        value={settlement.periodFrom}
                        timeZone={session.timezone}
                      />
                      {" to "}
                      <DateText
                        value={settlement.periodTo}
                        timeZone={session.timezone}
                      />
                      {" · prepared by "}
                      {settlement.preparedByName ?? "unknown"}
                    </>
                  }
                  padded={false}
                >
                  <Table>
                    <THead>
                      <TH>Type</TH>
                      <TH>Description</TH>
                      <TH>Shipment</TH>
                      <TH>Reference</TH>
                      <TH align="right">Amount</TH>
                    </THead>
                    <TBody>
                      {grouped.map(({ kind, lines }) =>
                        lines.length === 0 ? null : (
                          <TR key={kind} className="hover:bg-transparent">
                            <TD colSpan={5} className="!p-0">
                              <table className="w-full border-collapse">
                                <tbody>
                                  <tr className="bg-ice-50">
                                    <td
                                      colSpan={5}
                                      className="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase"
                                    >
                                      {kindLabels[kind]}
                                      {kindSign[kind] === "subtract" && (
                                        <span className="ml-2 font-normal text-slate-500 normal-case">
                                          reduces the net payable
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                  {lines.map((line) => (
                                    <tr
                                      key={line.id}
                                      className="border-t border-slate-150"
                                    >
                                      <td className="w-32 px-4 py-2.5 text-sm text-slate-500">
                                        {kindLabels[line.kind]}
                                      </td>
                                      <td className="px-4 py-2.5 text-sm text-slate-800">
                                        {line.description}
                                      </td>
                                      <td className="w-44 px-4 py-2.5 text-sm">
                                        {line.shipmentNumber ? (
                                          <Ref className="text-xs text-slate-600">
                                            {line.shipmentNumber}
                                          </Ref>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                      <td className="w-44 px-4 py-2.5 text-sm">
                                        {line.reference ? (
                                          <Ref className="text-xs text-slate-600">
                                            {line.reference}
                                          </Ref>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                      <td className="w-40 px-4 py-2.5 text-right text-sm">
                                        <span
                                          className={
                                            kindSign[line.kind] === "subtract"
                                              ? "text-tone-danger-fg"
                                              : ""
                                          }
                                        >
                                          {kindSign[line.kind] === "subtract" && "−"}
                                          <Money
                                            amount={line.amount}
                                            currency={settlement.currency}
                                          />
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </TD>
                          </TR>
                        ),
                      )}
                    </TBody>
                  </Table>

                  {/* ---- Net ---------------------------------------------- */}
                  <div className="border-t-2 border-navy-900 bg-ice-50 px-5 py-4">
                    <dl className="ml-auto max-w-sm space-y-2 text-sm">
                      <Row label="Fees">
                        <Money amount={settlement.feesTotal} currency={settlement.currency} />
                      </Row>
                      <Row label="Reimbursements">
                        <Money amount={settlement.reimbursementsTotal} currency={settlement.currency} />
                      </Row>
                      <Row label="Less advances">
                        <span className="text-tone-danger-fg">
                          −<Money amount={settlement.advancesTotal} currency={settlement.currency} />
                        </span>
                      </Row>
                      <Row label="Less deductions">
                        <span className="text-tone-danger-fg">
                          −<Money amount={settlement.deductionsTotal} currency={settlement.currency} />
                        </span>
                      </Row>
                      <div className="flex justify-between gap-8 border-t border-slate-300 pt-2">
                        <dt className="font-semibold text-slate-900">
                          Net payable to agent
                        </dt>
                        <dd>
                          <Money
                            amount={settlement.netPayable}
                            currency={settlement.currency}
                            emphasis
                          />
                        </dd>
                      </div>
                      {settlement.fx && (
                        <div className="flex justify-between gap-8 text-xs text-slate-500">
                          <dt>
                            In {settlement.fx.baseCurrency} at{" "}
                            {settlement.fx.appliedRate}
                          </dt>
                          <dd>
                            <Money
                              amount={settlement.fx.baseAmount}
                              currency={settlement.fx.baseCurrency}
                            />
                          </dd>
                        </div>
                      )}
                    </dl>

                    {settlement.fx && (
                      <p className="mt-3 text-right text-xs text-slate-500">
                        Rate source: {settlement.fx.rateSource}, as at{" "}
                        <DateText
                          value={settlement.fx.rateDate}
                          timeZone={session.timezone}
                        />{" "}
                        (BR-028)
                      </p>
                    )}

                    <div className="mt-4 flex justify-end">
                      {decision.allowed ? (
                        <button type="button" disabled className={buttonStyles.accent}>
                          Approve settlement
                        </button>
                      ) : (
                        <p className="flex items-start gap-2 rounded-sm bg-tone-warning-bg p-3 text-xs text-tone-warning-fg">
                          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span>{decision.reason}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-8">
      <dt className="text-slate-600">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
