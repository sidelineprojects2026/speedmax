import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Star, TriangleAlert } from "lucide-react";
import { PageBody, PageHeader, Panel } from "@/components/ui/layout";
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
import { AcceptQuotation } from "./AcceptQuotation";
import { getSession, can } from "@/lib/portal/session";
import { getQuotation, routeOptionTotal } from "@/lib/portal/queries";
import { chargeGroups } from "@/lib/domain/charges";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const q = await getQuotation(id);
  return { title: q ? q.quoteNumber : "Quotation" };
}

const modeLabels: Record<string, string> = {
  air: "Air",
  sea: "Ocean",
  road: "Road",
  rail: "Rail",
  courier: "Courier",
  warehouse_transfer: "Warehouse transfer",
  other: "Other",
};

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const quotation = await getQuotation(id);
  if (!quotation) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = quotation.validUntil < today;
  const isAccepted = quotation.acceptance !== null;
  // §8.2 — acceptance requires a released, unexpired version and the
  // quotation.accept permission. All three, or the action is not offered.
  const canAccept =
    quotation.status === "released" &&
    !isAccepted &&
    !isExpired &&
    can(session, "quotation.accept");

  const daysLeft = Math.ceil(
    (new Date(quotation.validUntil).getTime() - Date.now()) / 86_400_000,
  );

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Quotations", href: "/portal/quotations" },
          { label: quotation.quoteNumber },
        ]}
        title={<Ref>{quotation.quoteNumber}</Ref>}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              lifecycle="quotation"
              status={isExpired && quotation.status === "released" ? "expired" : quotation.status}
            />
            <span className="text-sm text-slate-500">
              Version {quotation.versionNo} · against order{" "}
              <Link
                href={`/portal/orders/${quotation.orderId}`}
                className="text-steel-600 underline underline-offset-4"
              >
                <Ref>{quotation.orderNumber}</Ref>
              </Link>
            </span>
          </div>
        }
      />

      <PageBody>
        {/* ---- Validity banner --------------------------------------------- */}
        {isAccepted && quotation.acceptance && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-success-br bg-tone-success-bg p-4">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-tone-success-fg"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-tone-success-fg">
                Accepted
              </h2>
              <p className="mt-1 text-sm text-tone-success-fg/90">
                Accepted by {quotation.acceptance.acceptedByName} on{" "}
                <DateText
                  value={quotation.acceptance.acceptedAt}
                  timeZone={session.timezone}
                  withTime
                />
                . This acceptance is recorded against version{" "}
                {quotation.versionNo} and the terms in force at that time.
              </p>
            </div>
          </div>
        )}

        {!isAccepted && isExpired && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-tone-danger-fg">
                This quotation has expired
              </h2>
              <p className="mt-1 text-sm text-tone-danger-fg/90">
                It lapsed on{" "}
                <DateText value={quotation.validUntil} timeZone={session.timezone} />{" "}
                and cannot be accepted without revalidation. Ask your coordinator
                to reissue it and we will confirm whether the rates still stand.
              </p>
            </div>
          </div>
        )}

        {!isAccepted && !isExpired && quotation.status === "released" && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-info-br bg-tone-info-bg p-4">
            <Clock
              className="mt-0.5 size-5 shrink-0 text-tone-info-fg"
              aria-hidden="true"
            />
            <p className="text-sm text-tone-info-fg">
              Valid until{" "}
              <DateText value={quotation.validUntil} timeZone={session.timezone} />
              {daysLeft >= 0 && (
                <>
                  {" "}
                  — {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining.
                </>
              )}{" "}
              Choose a route option below to accept.
            </p>
          </div>
        )}

        {/* ---- Route options ------------------------------------------------ */}
        <div className="space-y-6">
          {quotation.routeOptions.map((option) => {
            const totals = routeOptionTotal(option, quotation.currency);
            const isChosen =
              quotation.acceptance?.routeOptionId === option.id;

            return (
              <Panel
                key={option.id}
                title={
                  <span className="flex flex-wrap items-center gap-2.5 normal-case">
                    <span className="text-base font-semibold tracking-normal text-slate-900">
                      Option {option.optionNo} — {option.label}
                    </span>
                    {option.isRecommended && (
                      <span className="flex items-center gap-1 rounded-sm bg-tone-info-bg px-2 py-0.5 text-xs font-medium tracking-normal text-tone-info-fg">
                        <Star className="size-3" aria-hidden="true" />
                        Recommended
                      </span>
                    )}
                    {isChosen && (
                      <span className="flex items-center gap-1 rounded-sm bg-tone-success-bg px-2 py-0.5 text-xs font-medium tracking-normal text-tone-success-fg">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Accepted option
                      </span>
                    )}
                  </span>
                }
                padded={false}
              >
                <div className="border-b border-slate-200 p-5">
                  <DefinitionList columns={4}>
                    <Definition label="Routing">
                      {option.originLabel} → {option.destinationLabel}
                    </Definition>
                    <Definition label="Mode">
                      {modeLabels[option.mode] ?? option.mode}
                    </Definition>
                    <Definition label="Transit time">
                      <Value>
                        {option.transitDaysMin && option.transitDaysMax
                          ? `${option.transitDaysMin}–${option.transitDaysMax} days`
                          : null}
                      </Value>
                    </Definition>
                    <Definition label="Carrier">
                      <Value>{option.carrierName}</Value>
                    </Definition>
                    {option.departureFrequency && (
                      <Definition label="Departures">
                        {option.departureFrequency}
                      </Definition>
                    )}
                    {option.scheduleNote && (
                      <Definition label="Schedule" full>
                        {option.scheduleNote}
                      </Definition>
                    )}
                  </DefinitionList>
                </div>

                {/* ---- Charges by §8.1 group ---------------------------------- */}
                <Table>
                  <THead>
                    <TH>Charge</TH>
                    <TH align="right">Qty</TH>
                    <TH align="right">Amount</TH>
                    <TH align="right">Tax</TH>
                  </THead>
                  <TBody>
                    {chargeGroups.map((group) => {
                      const groupCharges = option.charges.filter(
                        (c) => c.group === group.group,
                      );
                      if (groupCharges.length === 0) return null;

                      return (
                        <TR key={group.group} className="hover:bg-transparent">
                          <TD colSpan={4} className="!p-0">
                            <table className="w-full border-collapse">
                              <tbody>
                                <tr className="bg-ice-50">
                                  <td
                                    colSpan={4}
                                    className="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase"
                                  >
                                    {group.label}
                                  </td>
                                </tr>
                                {groupCharges.map((charge) => (
                                  <tr
                                    key={charge.id}
                                    className="border-t border-slate-150"
                                  >
                                    <td className="px-4 py-2.5 text-sm text-slate-700">
                                      {charge.description}
                                    </td>
                                    <td className="tnum w-24 px-4 py-2.5 text-right text-sm text-slate-600">
                                      {charge.quantity}
                                    </td>
                                    <td className="w-36 px-4 py-2.5 text-right text-sm">
                                      <Money
                                        amount={charge.sellAmount}
                                        currency={charge.currency}
                                      />
                                    </td>
                                    <td className="tnum w-24 px-4 py-2.5 text-right text-sm text-slate-500">
                                      {charge.isTaxable &&
                                      Number(charge.taxRatePct) > 0
                                        ? `${Number(charge.taxRatePct).toFixed(0)}%`
                                        : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>

                {/* ---- Totals ------------------------------------------------- */}
                <div className="border-t-2 border-navy-900 bg-ice-50 px-5 py-4">
                  <dl className="ml-auto max-w-xs space-y-2 text-sm">
                    <div className="flex justify-between gap-8">
                      <dt className="text-slate-600">Subtotal</dt>
                      <dd>
                        <Money
                          amount={totals.subtotal}
                          currency={quotation.currency}
                        />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-8">
                      <dt className="text-slate-600">Tax</dt>
                      <dd>
                        <Money amount={totals.tax} currency={quotation.currency} />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-8 border-t border-slate-300 pt-2">
                      <dt className="font-semibold text-slate-900">Total</dt>
                      <dd>
                        <Money
                          amount={totals.total}
                          currency={quotation.currency}
                          emphasis
                        />
                      </dd>
                    </div>
                  </dl>

                  {canAccept && (
                    <div className="mt-5 flex justify-end">
                      <AcceptQuotation
                        quotationId={quotation.id}
                        routeOptionId={option.id}
                        quoteNumber={quotation.quoteNumber}
                        optionLabel={`Option ${option.optionNo} — ${option.label}`}
                        total={`${quotation.currency} ${totals.total}`}
                        acceptorName={session.fullName}
                        validUntil={quotation.validUntil}
                      />
                    </div>
                  )}
                </div>

                {(option.assumptions || option.exclusions) && (
                  <div className="grid gap-5 border-t border-slate-200 p-5 sm:grid-cols-2">
                    {option.assumptions && (
                      <div>
                        <h3 className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
                          Assumptions
                        </h3>
                        <p className="mt-1.5 text-sm text-slate-600">
                          {option.assumptions}
                        </p>
                      </div>
                    )}
                    {option.exclusions && (
                      <div>
                        <h3 className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
                          Exclusions
                        </h3>
                        <p className="mt-1.5 text-sm text-slate-600">
                          {option.exclusions}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>

        {/* ---- Quotation-level terms ---------------------------------------- */}
        <div className="mt-6">
          <Panel title="Terms, assumptions and exclusions">
            <DefinitionList columns={1}>
              {quotation.terms && (
                <Definition label="Terms">{quotation.terms}</Definition>
              )}
              {quotation.assumptions && (
                <Definition label="Assumptions">{quotation.assumptions}</Definition>
              )}
              {quotation.exclusions && (
                <Definition label="Exclusions">{quotation.exclusions}</Definition>
              )}
              <Definition label="Validity">
                <DateText value={quotation.validFrom} timeZone={session.timezone} />
                {" to "}
                <DateText value={quotation.validUntil} timeZone={session.timezone} />
              </Definition>
            </DefinitionList>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
