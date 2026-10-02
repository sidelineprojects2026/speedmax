"use client";

import { CheckCircle2 } from "lucide-react";
import { ActionDialog, CheckboxField } from "@/components/ui/ActionForm";
import { acceptQuotation } from "../../actions";

/**
 * Quotation acceptance (§8.2).
 *
 * Two steps by design. Accepting is a commercial commitment recorded against
 * the accepter's identity, the version and the terms in force, and it creates
 * the shipment — so the dialog states exactly what is being agreed before the
 * button is live, rather than treating it as an ordinary click.
 */
export function AcceptQuotation({
  quotationId,
  routeOptionId,
  quoteNumber,
  optionLabel,
  total,
  acceptorName,
  validUntil,
}: {
  quotationId: string;
  routeOptionId: string;
  quoteNumber: string;
  optionLabel: string;
  total: string;
  acceptorName: string;
  validUntil: string;
}) {
  return (
    <ActionDialog
      action={acceptQuotation}
      trigger="Accept this option"
      triggerVariant="accent"
      triggerIcon={<CheckCircle2 className="size-4" aria-hidden="true" />}
      title={`Accept quotation ${quoteNumber}`}
      description="This is a commercial commitment. Your name, the time and the accepted version are recorded."
      submitLabel="Accept and proceed to booking"
      pendingLabel="Accepting…"
      hidden={{ quotation_id: quotationId, route_option_id: routeOptionId }}
    >
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">Option</dt>
          <dd className="text-right font-medium text-slate-900">{optionLabel}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">Total</dt>
          <dd className="tnum text-right font-semibold text-slate-900">{total}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">Valid until</dt>
          <dd className="tnum text-right text-slate-900">{validUntil}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">Accepted by</dt>
          <dd className="text-right font-medium text-slate-900">{acceptorName}</dd>
        </div>
      </dl>

      <CheckboxField
        name="agreed"
        label={
          <>
            I am authorised to accept this quotation on behalf of my company, and
            I accept the stated terms, assumptions and exclusions.
          </>
        }
      />

      <p className="rounded-sm bg-ice-50 p-3 text-sm text-slate-600">
        On acceptance the order is converted and a shipment is created. Booking
        is released separately by Speedmax once the deposit, cargo-readiness and
        document conditions are confirmed (§8.3).
      </p>
    </ActionDialog>
  );
}
