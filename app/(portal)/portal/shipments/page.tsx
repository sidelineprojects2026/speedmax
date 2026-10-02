import type { Metadata } from "next";
import Link from "next/link";
import { Ship, TriangleAlert } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState } from "@/components/ui/layout";
import {
  DateText,
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
import { getSession } from "@/lib/portal/session";
import { listShipments, shipmentTimeline } from "@/lib/portal/queries";
import { currentCustomerStep } from "@/lib/domain/milestones";

export const metadata: Metadata = { title: "Shipments" };

const modeLabels: Record<string, string> = {
  air: "Air",
  sea: "Ocean",
  road: "Road",
  rail: "Rail",
  courier: "Courier",
  warehouse_transfer: "Warehouse transfer",
  other: "Other",
};

export default async function ShipmentsPage() {
  const session = await getSession();
  const shipments = await listShipments();

  return (
    <>
      <PageHeader
        title="Shipments"
        description="Movements Speedmax is executing for you, with their current milestone and estimated arrival."
      />

      <PageBody>
        <Panel padded={false}>
          {shipments.length === 0 ? (
            <EmptyState
              icon={Ship}
              title="No shipments yet"
              description="An accepted quotation becomes a shipment once booking is confirmed."
            />
          ) : (
            <Table>
              <THead>
                <TH>Shipment</TH>
                <TH>Status</TH>
                <TH>Route</TH>
                <TH>Mode</TH>
                <TH>Current milestone</TH>
                <TH>Departed</TH>
                <TH>ETA</TH>
              </THead>
              <TBody>
                {shipments.map((shipment) => {
                  const step = currentCustomerStep(shipmentTimeline(shipment));
                  return (
                    <TR key={shipment.id}>
                      <TD>
                        <Link
                          href={`/portal/shipments/${shipment.id}`}
                          className="font-medium text-steel-600 hover:text-navy-900"
                        >
                          <Ref>{shipment.shipmentNumber}</Ref>
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {shipment.orderNumbers.join(", ")}
                        </p>
                      </TD>
                      <TD>
                        <StatusBadge
                          lifecycle="shipment"
                          status={shipment.status}
                          size="sm"
                        />
                        {shipment.hasActiveHold && (
                          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-tone-danger-fg">
                            <TriangleAlert className="size-3" aria-hidden="true" />
                            On hold
                          </span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {shipment.originLabel}
                        <span className="mx-1.5 text-slate-400">→</span>
                        {shipment.destinationLabel}
                      </TD>
                      <TD>{modeLabels[shipment.mode] ?? shipment.mode}</TD>
                      <TD>
                        <Value>{step?.label}</Value>
                      </TD>
                      <TD>
                        <DateText
                          value={shipment.atdAt ?? shipment.etdAt}
                          timeZone={session.timezone}
                        />
                      </TD>
                      <TD>
                        <DateText
                          value={shipment.ataAt ?? shipment.etaAt}
                          timeZone={session.timezone}
                        />
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
