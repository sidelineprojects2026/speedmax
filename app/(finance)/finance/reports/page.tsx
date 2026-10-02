import type { Metadata } from "next";
import { TriangleAlert, Info } from "lucide-react";
import { PageBody, PageHeader, Panel } from "@/components/ui/layout";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getFinanceSession } from "@/lib/finance/session";
import {
  MINIMUM_MARGIN_PCT,
  apPosition,
  arAging,
  listShipmentMargins,
  listUnbilledShipments,
} from "@/lib/finance/queries";
import { toDecimalString } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Reports" };

/** Format a margin percentage, or say plainly that it is not measurable. */
function marginLabel(pct: number | null): string {
  return pct === null ? "n/a" : `${pct.toFixed(2)}%`;
}

export default async function ReportsPage() {
  const session = await getFinanceSession();
  const [margins, unbilled, aging, ap] = await Promise.all([
    listShipmentMargins(),
    listUnbilledShipments(),
    arAging(session.baseCurrency),
    apPosition(session.baseCurrency),
  ]);

  const breaches = margins.filter((m) => m.needsEscalation);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Margin, aging and cost variance. All figures in ${session.baseCurrency} unless stated; converted amounts carry their rate and source.`}
      />

      <PageBody>
        {/* ---- Position ----------------------------------------------------- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label="AR total" value={<Money amount={aging.total} currency={aging.currency} />} />
          <Figure label="AP approved, unpaid" value={<Money amount={ap.approvedUnpaid} currency={ap.currency} />} />
          <Figure label="Accrued cost" value={<Money amount={ap.accrued} currency={ap.currency} />} />
          <Figure
            label="Margin breaches"
            value={String(breaches.length)}
            tone={breaches.length > 0 ? "danger" : "neutral"}
          />
        </div>

        {/* ---- Unbilled ------------------------------------------------------ */}
        {unbilled.length > 0 && (
          <div className="mt-6 flex gap-3 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-tone-danger-fg">
                {unbilled.length} shipment{unbilled.length === 1 ? "" : "s"} with
                cost recorded but no invoice
              </h2>
              <p className="mt-1 text-sm text-tone-danger-fg/90">
                Costs are recognised against no revenue, so the margin on these
                reads as a total loss until the invoice is raised. That is the
                intended behaviour — an unbilled shipment should be impossible
                to overlook, not quietly excluded from the numbers.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-tone-danger-fg/90">
                {unbilled.map((m) => (
                  <li key={m.record.shipmentId}>
                    <span className="font-medium">{m.record.shipmentNumber}</span>{" "}
                    — {m.record.customerName},{" "}
                    {toDecimalString(m.result.totalDirectCost)}{" "}
                    {m.record.currency} of cost
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ---- Margin by shipment -------------------------------------------- */}
        <div className="mt-6">
          <Panel
            title="Margin by shipment"
            description={`§10.3. Gross margin below ${MINIMUM_MARGIN_PCT}% requires escalation (§8.2).`}
            padded={false}
          >
            <Table>
              <THead>
                <TH>Shipment</TH>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH align="right">Net revenue</TH>
                <TH align="right">Total cost</TH>
                <TH align="right">Accrued</TH>
                <TH align="right">Gross profit</TH>
                <TH align="right">Margin</TH>
                <TH align="right">Cost vs quoted</TH>
              </THead>
              <TBody>
                {margins.map((m) => {
                  const pct = m.result.grossMarginPct;
                  const overrun = Number(m.costVariance) > 0;

                  return (
                    <TR key={m.record.shipmentId}>
                      <TD>
                        <Ref className="font-medium text-slate-900">
                          {m.record.shipmentNumber}
                        </Ref>
                        {!m.record.isBilled && (
                          <p className="mt-0.5 text-xs font-medium text-tone-danger-fg">
                            Unbilled
                          </p>
                        )}
                        {m.hasUnallocatedCost && (
                          <p className="mt-0.5 text-xs text-tone-warning-fg">
                            <Money
                              amount={m.record.unallocatedCost}
                              currency={m.record.currency}
                            />{" "}
                            unallocated
                          </p>
                        )}
                      </TD>
                      <TD>{m.record.customerName}</TD>
                      <TD>
                        <StatusBadge
                          lifecycle="shipment"
                          status={m.record.status}
                          size="sm"
                        />
                      </TD>
                      <TD align="right">
                        <Money
                          amount={toDecimalString(m.result.netRevenue)}
                          currency={m.record.currency}
                        />
                      </TD>
                      <TD align="right">
                        <Money
                          amount={toDecimalString(m.result.totalDirectCost)}
                          currency={m.record.currency}
                        />
                      </TD>
                      <TD align="right">
                        <Money
                          amount={m.record.accruals}
                          currency={m.record.currency}
                          className={
                            Number(m.record.accruals) > 0
                              ? "text-tone-warning-fg"
                              : ""
                          }
                        />
                      </TD>
                      <TD align="right">
                        <Money
                          amount={toDecimalString(m.result.grossProfit)}
                          currency={m.record.currency}
                          emphasis
                          className={
                            m.result.grossProfit.units < 0
                              ? "text-tone-danger-fg"
                              : ""
                          }
                        />
                      </TD>
                      <TD align="right">
                        <span
                          className={`tnum font-medium ${
                            pct === null
                              ? "text-slate-400"
                              : pct < 0
                                ? "text-tone-danger-fg"
                                : pct < MINIMUM_MARGIN_PCT
                                  ? "text-tone-warning-fg"
                                  : "text-tone-success-fg"
                          }`}
                        >
                          {marginLabel(pct)}
                        </span>
                      </TD>
                      <TD align="right">
                        <span
                          className={`tnum ${overrun ? "text-tone-danger-fg" : "text-slate-600"}`}
                        >
                          {overrun && "+"}
                          <Money
                            amount={m.costVariance}
                            currency={m.record.currency}
                          />
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Panel>
        </div>

        {/* ---- Escalations ---------------------------------------------------- */}
        {breaches.length > 0 && (
          <div className="mt-6">
            <Panel
              title="Requires escalation"
              description="§8.2 — negative or below-floor margin needs an approval decision above the desk."
              padded={false}
            >
              <ul className="divide-y divide-slate-150">
                {breaches.map((m) => (
                  <li key={m.record.shipmentId} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Ref className="font-medium text-slate-900">
                          {m.record.shipmentNumber}
                        </Ref>
                        <p className="mt-1 text-sm text-slate-600">
                          {m.record.customerName} — gross margin{" "}
                          {marginLabel(m.result.grossMarginPct)} against a{" "}
                          {MINIMUM_MARGIN_PCT}% floor.
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Cost ran{" "}
                          <span className="tnum font-medium">
                            {m.costVariance} {m.record.currency}
                          </span>{" "}
                          against quotation, of which{" "}
                          <span className="tnum font-medium">
                            {m.record.accruals} {m.record.currency}
                          </span>{" "}
                          is accrued rather than invoiced.
                        </p>
                      </div>
                      <Money
                        amount={toDecimalString(m.result.grossProfit)}
                        currency={m.record.currency}
                        emphasis
                        className={
                          m.result.grossProfit.units < 0
                            ? "text-tone-danger-fg"
                            : ""
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}

        <div className="mt-6 flex gap-3 rounded-sm border border-slate-200 bg-white p-4">
          <Info
            className="mt-0.5 size-5 shrink-0 text-steel-500"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-600">
            §20.1 — these figures distinguish estimated, accrued and actual
            amounts. Accruals are shown separately because they are estimates of
            costs not yet invoiced by the vendor; including them silently would
            understate margin volatility, and excluding them would overstate
            profit while bills are outstanding. Exports carry the generating
            user, the as-at date and the conversion basis.
          </p>
        </div>
      </PageBody>
    </>
  );
}

function Figure({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "danger";
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
      <p className="tnum mt-2.5 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
