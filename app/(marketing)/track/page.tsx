import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Info, ArrowRight } from "lucide-react";
import { TrackForm } from "@/components/marketing/TrackForm";
import { Timeline } from "@/components/ui/Timeline";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { trackShipment } from "@/lib/queries/tracking";

export const metadata: Metadata = {
  title: "Track a Shipment",
  description:
    "Track a Speedmax shipment by shipment number, bill of lading or air waybill.",
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const result = ref ? await trackShipment(ref) : null;

  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Track a shipment
          </h1>
          <p className="mt-4 text-lg text-steel-200">
            Enter a Speedmax shipment number, bill of lading or air waybill.
          </p>
          <div className="mt-8">
            <TrackForm variant="dark" autoFocus={!ref} />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          {!result && (
            <div className="rounded-sm border border-slate-200 bg-ice-50 p-8 text-center">
              <PackageSearch
                className="mx-auto size-8 text-steel-400"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <p className="mt-4 text-slate-700">
                Enter a reference above to see the shipment&rsquo;s progress.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                For documents, invoices and full operational detail, sign in to
                the customer portal.
              </p>
            </div>
          )}

          {result?.kind === "unavailable" && (
            <div className="rounded-sm border border-tone-warning-br bg-tone-warning-bg p-6">
              <div className="flex gap-3">
                <Info
                  className="mt-0.5 size-5 shrink-0 text-tone-warning-fg"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-semibold text-tone-warning-fg">
                    Tracking is temporarily unavailable
                  </h2>
                  <p className="mt-1.5 text-sm text-tone-warning-fg/90">
                    We could not reach the tracking service. Please try again
                    shortly, or contact your Speedmax coordinator for the current
                    status.
                  </p>
                  <Link
                    href="/contact"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-tone-warning-fg underline underline-offset-4"
                  >
                    Contact operations
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {result?.kind === "not_found" && (
            <div className="rounded-sm border border-slate-200 bg-white p-8">
              <h2 className="text-lg font-semibold text-slate-900">
                No shipment found for{" "}
                <span className="ref text-slate-700">{result.reference}</span>
              </h2>
              <p className="mt-3 text-slate-600">
                Check the reference and try again. A shipment becomes trackable
                once its booking has been confirmed — before that, progress is
                visible on the order in the customer portal.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/portal"
                  className="rounded-sm bg-navy-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-700"
                >
                  Sign in to the portal
                </Link>
                <Link
                  href="/contact"
                  className="rounded-sm border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400"
                >
                  Contact operations
                </Link>
              </div>
            </div>
          )}

          {result?.kind === "found" && (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    Shipment
                  </p>
                  <p className="ref mt-1.5 text-2xl font-medium text-slate-900">
                    {result.shipmentNumber}
                  </p>
                </div>
                <StatusBadge lifecycle="shipment" status={result.status} />
              </div>

              <dl className="grid gap-x-8 gap-y-5 border-b border-slate-200 py-6 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-500">Origin</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {result.originLabel ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Destination</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {result.destinationLabel ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Estimated arrival</dt>
                  <dd className="tnum mt-1 font-medium text-slate-900">
                    {result.etaAt
                      ? new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                        }).format(new Date(result.etaAt))
                      : "—"}
                  </dd>
                </div>
              </dl>

              <div className="pt-8">
                <h2 className="mb-6 text-lg font-semibold text-slate-900">
                  Progress
                </h2>
                <Timeline entries={result.timeline} />
              </div>

              <p className="mt-10 rounded-sm bg-ice-50 p-4 text-sm text-slate-600">
                This is the customer timeline. Operational detail, documents and
                invoices are available in the{" "}
                <Link
                  href="/portal"
                  className="font-medium text-steel-600 underline underline-offset-4"
                >
                  customer portal
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
