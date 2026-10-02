import type { Metadata } from "next";
import { CheckCircle2, TriangleAlert, Split } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState, buttonStyles } from "@/components/ui/layout";
import {
  Money,
  Ref,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/data";
import { getFinanceSession } from "@/lib/finance/session";
import { listAllocatableCosts, previewAllocation } from "@/lib/finance/queries";
import { allocationMethods } from "@/lib/domain/charges";
import { toDecimalString } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Allocations" };

const methodLabels = Object.fromEntries(
  allocationMethods.map((m) => [m.method, m.label]),
);
const methodUseCases = Object.fromEntries(
  allocationMethods.map((m) => [m.method, m.useCase]),
);

export default async function AllocationsPage() {
  const session = await getFinanceSession();
  const costs = await listAllocatableCosts();
  const previews = await Promise.all(costs.map(previewAllocation));

  const pending = previews.filter((p) => !p.cost.isAllocated);
  const done = previews.filter((p) => p.cost.isAllocated);

  return (
    <>
      <PageHeader
        title="Allocations"
        description="Spreading costs that relate to more than one shipment, using the §10.4 method appropriate to each charge."
      />

      <PageBody>
        {/* ---- Method reference -------------------------------------------- */}
        <Panel
          title="Allocation methods"
          description="§10.4 — the basis is chosen per charge and recorded with the result."
          padded={false}
        >
          <Table>
            <THead>
              <TH>Method</TH>
              <TH>Use case</TH>
            </THead>
            <TBody>
              {allocationMethods.map((method) => (
                <TR key={method.method}>
                  <TD className="font-medium text-slate-900">{method.label}</TD>
                  <TD>{method.useCase}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Panel>

        {/* ---- Pending ------------------------------------------------------ */}
        <div className="mt-6 space-y-6">
          {pending.length === 0 ? (
            <Panel padded={false}>
              <EmptyState
                icon={Split}
                title="Nothing awaiting allocation"
                description="Every recorded cost has been allocated to its shipments."
              />
            </Panel>
          ) : (
            pending.map((preview) => (
              <Panel
                key={preview.cost.id}
                title={
                  <span className="flex flex-wrap items-center gap-3 normal-case">
                    <Ref className="text-base font-semibold tracking-normal text-slate-900">
                      {preview.cost.reference}
                    </Ref>
                    <span className="rounded-sm bg-ice-100 px-2 py-0.5 text-xs font-medium tracking-normal text-slate-700">
                      {methodLabels[preview.cost.method]}
                    </span>
                  </span>
                }
                description={preview.cost.description}
                padded={false}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
                  <p className="text-sm text-slate-600">
                    {methodUseCases[preview.cost.method]}
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-500">Amount to allocate </span>
                    <Money
                      amount={preview.cost.amount}
                      currency={preview.cost.currency}
                      emphasis
                    />
                  </p>
                </div>

                <Table>
                  <THead>
                    <TH>Shipment</TH>
                    <TH>Basis</TH>
                    <TH align="right">Share</TH>
                    <TH align="right">Allocated</TH>
                  </THead>
                  <TBody>
                    {preview.results.map((result) => {
                      const target = preview.cost.targets.find(
                        (t) => t.shipmentId === result.id,
                      );
                      return (
                        <TR key={result.id}>
                          <TD>
                            <Ref className="font-medium text-slate-900">
                              {result.shipmentNumber}
                            </Ref>
                          </TD>
                          <TD className="tnum text-slate-600">
                            {target?.basisLabel ?? result.basis}
                          </TD>
                          <TD align="right" className="tnum">
                            {result.sharePct.toFixed(2)}%
                          </TD>
                          <TD align="right">
                            <Money
                              // toDecimalString respects the currency's minor
                              // units. Dividing by 100 here would silently
                              // break JPY, KRW and the three-decimal Gulf
                              // currencies.
                              amount={toDecimalString(result.amount)}
                              currency={preview.cost.currency}
                              emphasis
                            />
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>

                {/* Reconciliation is asserted, not assumed. An allocation whose
                    parts do not sum to the whole is a finance defect. */}
                <div
                  className={`flex items-center justify-between gap-4 border-t-2 px-5 py-4 ${
                    preview.reconciles
                      ? "border-navy-900 bg-ice-50"
                      : "border-tone-danger-br bg-tone-danger-bg"
                  }`}
                >
                  <p
                    className={`flex items-center gap-2 text-sm ${
                      preview.reconciles
                        ? "text-tone-success-fg"
                        : "text-tone-danger-fg"
                    }`}
                  >
                    {preview.reconciles ? (
                      <>
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        Allocation reconciles exactly to{" "}
                        <Money
                          amount={preview.cost.amount}
                          currency={preview.cost.currency}
                        />
                      </>
                    ) : (
                      <>
                        <TriangleAlert className="size-4" aria-hidden="true" />
                        Allocation does not reconcile — do not post.
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    disabled
                    className={buttonStyles.accent}
                    title="Disabled until the database is connected"
                  >
                    Post allocation
                  </button>
                </div>
              </Panel>
            ))
          )}
        </div>

        {/* ---- Already allocated -------------------------------------------- */}
        {done.length > 0 && (
          <div className="mt-6">
            <Panel title="Already allocated" padded={false}>
              <Table>
                <THead>
                  <TH>Reference</TH>
                  <TH>Description</TH>
                  <TH>Method</TH>
                  <TH>Shipments</TH>
                  <TH align="right">Amount</TH>
                </THead>
                <TBody>
                  {done.map((preview) => (
                    <TR key={preview.cost.id}>
                      <TD>
                        <Ref className="font-medium text-slate-900">
                          {preview.cost.reference}
                        </Ref>
                      </TD>
                      <TD>{preview.cost.description}</TD>
                      <TD>{methodLabels[preview.cost.method]}</TD>
                      <TD>
                        <ul className="space-y-0.5">
                          {preview.cost.targets.map((t) => (
                            <li key={t.shipmentId}>
                              <Ref className="text-xs text-slate-600">
                                {t.shipmentNumber}
                              </Ref>
                            </li>
                          ))}
                        </ul>
                      </TD>
                      <TD align="right">
                        <Money
                          amount={preview.cost.amount}
                          currency={preview.cost.currency}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Panel>
          </div>
        )}

        <p className="mt-4 text-sm text-slate-500">
          Splits use largest-remainder distribution, so the parts always sum
          exactly to the amount allocated. Proportional splits with independent
          rounding leave stray minor units, and an allocation that does not
          reconcile to its source is a defect rather than a display quirk.
          Reporting currency {session.baseCurrency}.
        </p>
      </PageBody>
    </>
  );
}
