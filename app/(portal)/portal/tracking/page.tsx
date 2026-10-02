import type { Metadata } from "next";
import Link from "next/link";
import { Radar, TriangleAlert } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
import { DateText, Ref, Value } from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import { getSession } from "@/lib/portal/session";
import { listActiveShipments, shipmentTimeline } from "@/lib/portal/queries";
import { milestoneLabel } from "@/lib/domain/milestones";

export const metadata: Metadata = { title: "Tracking" };

export default async function TrackingPage() {
  const session = await getSession();
  const shipments = await listActiveShipments();

  return (
    <>
      <PageHeader
        title="Tracking"
        description="Every shipment currently moving, side by side. Milestones shown are the customer timeline; your coordinator holds the full operational detail."
      />

      <PageBody>
        {shipments.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={Radar}
              title="Nothing in transit"
              description="Shipments appear here from booking confirmation until delivery."
            />
          </Panel>
        ) : (
          <div className="space-y-6">
            {shipments.map((shipment) => {
              const timeline = shipmentTimeline(shipment);
              // Customer-visible events only — internal detail never reaches here.
              const visible = shipment.events
                .filter((e) => e.visibility === "customer")
                .slice()
                .reverse();

              return (
                <Panel
                  key={shipment.id}
                  title={
                    <span className="flex flex-wrap items-center gap-3 normal-case">
                      <Link
                        href={`/portal/shipments/${shipment.id}`}
                        className="text-base font-semibold tracking-normal text-steel-600 hover:text-navy-900"
                      >
                        <Ref>{shipment.shipmentNumber}</Ref>
                      </Link>
                      <StatusBadge
                        lifecycle="shipment"
                        status={shipment.status}
                        size="sm"
                      />
                      {shipment.hasActiveHold && (
                        <span className="flex items-center gap-1 rounded-sm bg-tone-danger-bg px-2 py-0.5 text-xs font-medium tracking-normal text-tone-danger-fg">
                          <TriangleAlert className="size-3" aria-hidden="true" />
                          On hold
                        </span>
                      )}
                    </span>
                  }
                  description={`${shipment.originLabel} → ${shipment.destinationLabel} · ETA ${
                    shipment.etaAt ? shipment.etaAt.slice(0, 10) : "to be advised"
                  }`}
                >
                  <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
                    <Timeline
                      entries={timeline}
                      locale={session.locale}
                      timeZone={session.timezone}
                    />

                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
                        Event history
                      </h3>
                      <ol className="mt-4 space-y-3">
                        {visible.map((event) => (
                          <li
                            key={event.id}
                            className="border-l-2 border-slate-200 pl-4"
                          >
                            <div className="flex flex-wrap items-baseline gap-x-3">
                              <p className="font-medium text-slate-900">
                                {milestoneLabel(event.milestoneCode)}
                              </p>
                              <p className="text-xs text-slate-500">
                                <DateText
                                  value={event.eventTime}
                                  timeZone={session.timezone}
                                  withTime
                                />
                              </p>
                            </div>
                            <p className="mt-0.5 text-sm text-slate-600">
                              <Value>{event.locationText}</Value>
                            </p>
                            {event.notes && (
                              <p className="mt-1 text-sm text-slate-500">
                                {event.notes}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
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
