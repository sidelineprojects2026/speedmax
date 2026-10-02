import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCheck, TriangleAlert } from "lucide-react";
import { PageBody, PageHeader, Panel } from "@/components/ui/layout";
import {
  DateText,
  Definition,
  DefinitionList,
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
import { Timeline } from "@/components/ui/Timeline";
import { getSession } from "@/lib/portal/session";
import {
  getShipment,
  listDocumentsFor,
  listExceptions,
  shipmentTimeline,
} from "@/lib/portal/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = await getShipment(id);
  return { title: s ? s.shipmentNumber : "Shipment" };
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

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const shipment = await getShipment(id);
  if (!shipment) notFound();

  const [documents, allExceptions] = await Promise.all([
    listDocumentsFor("shipment", shipment.id),
    listExceptions(),
  ]);

  const timeline = shipmentTimeline(shipment);
  const exceptions = allExceptions.filter(
    (e) => e.shipmentNumber === shipment.shipmentNumber,
  );

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Shipments", href: "/portal/shipments" },
          { label: shipment.shipmentNumber },
        ]}
        title={<Ref>{shipment.shipmentNumber}</Ref>}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge lifecycle="shipment" status={shipment.status} />
            <span className="text-sm text-slate-500">
              {shipment.originLabel} → {shipment.destinationLabel} ·{" "}
              {modeLabels[shipment.mode] ?? shipment.mode}
            </span>
          </div>
        }
      />

      <PageBody>
        {shipment.hasActiveHold && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-tone-danger-fg">
                This shipment is on hold
              </h2>
              <p className="mt-1 text-sm text-tone-danger-fg/90">
                {exceptions.find((e) => e.status === "action_required")
                  ?.customerStatement ??
                  "A hold has been raised against this shipment. Your coordinator will update you as it is resolved."}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            {/* ---- Summary ------------------------------------------------- */}
            <Panel title="Shipment">
              <DefinitionList columns={3}>
                <Definition label="Orders">
                  {shipment.orderNumbers.map((n) => (
                    <Ref key={n} className="mr-2 text-slate-700">
                      {n}
                    </Ref>
                  ))}
                </Definition>
                <Definition label="Booking">
                  {shipment.bookingNumber ? (
                    <Ref>{shipment.bookingNumber}</Ref>
                  ) : (
                    <Value>{null}</Value>
                  )}
                </Definition>
                <Definition label="Coordinator">
                  <Value>{shipment.coordinatorName}</Value>
                </Definition>
                <Definition label="Departure (planned)">
                  <DateText
                    value={shipment.etdAt}
                    timeZone={session.timezone}
                    withTime
                  />
                </Definition>
                <Definition label="Departure (actual)">
                  <DateText
                    value={shipment.atdAt}
                    timeZone={session.timezone}
                    withTime
                  />
                </Definition>
                <Definition label="Arrival (estimated)">
                  <DateText
                    value={shipment.etaAt}
                    timeZone={session.timezone}
                    withTime
                  />
                </Definition>
              </DefinitionList>
            </Panel>

            {/* ---- Legs ---------------------------------------------------- */}
            <Panel
              title="Movement plan"
              description="Each leg is one movement or custody segment (§9.1)."
              padded={false}
            >
              <Table>
                <THead>
                  <TH>#</TH>
                  <TH>Mode</TH>
                  <TH>From → To</TH>
                  <TH>Provider</TH>
                  <TH>References</TH>
                  <TH>Departure</TH>
                  <TH>Arrival</TH>
                </THead>
                <TBody>
                  {shipment.legs.map((leg) => (
                    <TR key={leg.id}>
                      <TD className="tnum text-slate-500">{leg.sequenceNo}</TD>
                      <TD>{modeLabels[leg.mode] ?? leg.mode}</TD>
                      <TD>
                        <p className="text-slate-800">{leg.originLabel}</p>
                        <p className="mt-0.5 text-slate-500">
                          → {leg.destinationLabel}
                        </p>
                      </TD>
                      <TD>
                        <Value>{leg.providerName}</Value>
                      </TD>
                      <TD>
                        <ul className="space-y-0.5 text-xs">
                          {leg.vesselOrFlight && (
                            <li>
                              <span className="text-slate-500">Vessel/flight </span>
                              <Ref>{leg.vesselOrFlight}</Ref>
                              {leg.voyageNumber && (
                                <>
                                  {" "}
                                  <Ref>{leg.voyageNumber}</Ref>
                                </>
                              )}
                            </li>
                          )}
                          {leg.containerNumber && (
                            <li>
                              <span className="text-slate-500">Container </span>
                              <Ref>{leg.containerNumber}</Ref>
                            </li>
                          )}
                          {leg.sealNumber && (
                            <li>
                              <span className="text-slate-500">Seal </span>
                              <Ref>{leg.sealNumber}</Ref>
                            </li>
                          )}
                          {leg.houseBill && (
                            <li>
                              <span className="text-slate-500">HBL/HAWB </span>
                              <Ref>{leg.houseBill}</Ref>
                            </li>
                          )}
                          {leg.masterBill && (
                            <li>
                              <span className="text-slate-500">MBL/MAWB </span>
                              <Ref>{leg.masterBill}</Ref>
                            </li>
                          )}
                          {!leg.vesselOrFlight &&
                            !leg.containerNumber &&
                            !leg.houseBill && (
                              <li className="text-slate-400">—</li>
                            )}
                        </ul>
                      </TD>
                      <TD>
                        <DateText
                          value={leg.actualDeparture ?? leg.plannedDeparture}
                          timeZone={session.timezone}
                          withTime
                        />
                        {!leg.actualDeparture && (
                          <p className="text-xs text-slate-400">Planned</p>
                        )}
                      </TD>
                      <TD>
                        <DateText
                          value={leg.actualArrival ?? leg.plannedArrival}
                          timeZone={session.timezone}
                          withTime
                        />
                        {!leg.actualArrival && (
                          <p className="text-xs text-slate-400">Planned</p>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Panel>

            {/* ---- Proof of delivery ---------------------------------------- */}
            {shipment.pod && (
              <Panel title="Proof of delivery">
                <div className="flex gap-3">
                  <PackageCheck
                    className="mt-0.5 size-5 shrink-0 text-tone-success-fg"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <DefinitionList columns={2}>
                      <Definition label="Received by">
                        {shipment.pod.receiverName}
                      </Definition>
                      <Definition label="Delivered at">
                        <DateText
                          value={shipment.pod.deliveredAt}
                          timeZone={session.timezone}
                          withTime
                        />
                      </Definition>
                      <Definition label="Location">
                        <Value>{shipment.pod.locationText}</Value>
                      </Definition>
                      <Definition label="Quantity received">
                        <Value>{shipment.pod.quantityReceived}</Value>
                      </Definition>
                      {shipment.pod.conditionNote && (
                        <Definition label="Condition" full>
                          {shipment.pod.conditionNote}
                        </Definition>
                      )}
                      {shipment.pod.exceptionResult && (
                        <Definition label="Exception" full>
                          <span className="text-tone-warning-fg">
                            {shipment.pod.exceptionResult}
                          </span>
                        </Definition>
                      )}
                    </DefinitionList>
                  </div>
                </div>
              </Panel>
            )}
          </div>

          {/* ---- Sidebar ---------------------------------------------------- */}
          <div className="space-y-6">
            <Panel title="Progress">
              <Timeline
                entries={timeline}
                locale={session.locale}
                timeZone={session.timezone}
              />
            </Panel>

            {exceptions.length > 0 && (
              <Panel title="Exceptions" padded={false}>
                <ul className="divide-y divide-slate-150">
                  {exceptions.map((exc) => (
                    <li key={exc.id} className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Ref className="text-sm font-medium text-slate-900">
                          {exc.exceptionNumber}
                        </Ref>
                        <StatusBadge
                          lifecycle="exception"
                          status={exc.status}
                          size="sm"
                        />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {exc.customerStatement}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel
              title="Documents"
              description={`${documents.length} attached`}
              padded={false}
            >
              {documents.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No documents yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-150">
                  {documents.map((doc) => (
                    <li key={doc.id} className="px-5 py-3">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {doc.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          lifecycle="document"
                          status={doc.status}
                          size="sm"
                        />
                        <span className="text-xs text-slate-500">
                          {doc.typeName}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Need something?">
              <p className="text-sm text-slate-600">
                Messages raised here reach the assigned coordinator with the
                shipment context attached.
              </p>
              <Link
                href="/portal/messages"
                className="mt-3 inline-block text-sm font-medium text-steel-600 underline underline-offset-4"
              >
                Open messages
              </Link>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
