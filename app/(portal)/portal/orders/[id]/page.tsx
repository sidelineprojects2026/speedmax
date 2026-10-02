import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info, TriangleAlert, Upload, Send } from "lucide-react";
import { PageBody, PageHeader, Panel, buttonStyles } from "@/components/ui/layout";
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
import { getSession } from "@/lib/portal/session";
import { getOrder, listDocumentsFor } from "@/lib/portal/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrder(id);
  return { title: order ? order.orderNumber : "Shipping Order" };
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

/** Handling attributes worth surfacing as chips on a cargo line (§7.2). */
function handlingFlags(item: {
  isFragile: boolean;
  isHazardous: boolean;
  isOversized: boolean;
  isHighValue: boolean;
  isControlled: boolean;
  temperatureMinC: string | null;
  temperatureMaxC: string | null;
}) {
  const flags: string[] = [];
  if (item.isHazardous) flags.push("Dangerous goods");
  if (item.isControlled) flags.push("Controlled");
  if (item.isHighValue) flags.push("High value");
  if (item.isOversized) flags.push("Oversized");
  if (item.isFragile) flags.push("Fragile");
  if (item.temperatureMinC || item.temperatureMaxC) {
    flags.push(`${item.temperatureMinC ?? "?"}–${item.temperatureMaxC ?? "?"} °C`);
  }
  return flags;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const order = await getOrder(id);
  if (!order) notFound();

  const documents = await listDocumentsFor("order", order.id);
  const currency = order.declaredCurrency ?? session.currency;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Shipping Orders", href: "/portal/orders" },
          { label: order.orderNumber },
        ]}
        title={<Ref>{order.orderNumber}</Ref>}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge lifecycle="shipping_order" status={order.status} />
            {order.customerReference && (
              <span className="text-sm text-slate-500">
                Your reference <Ref>{order.customerReference}</Ref>
              </span>
            )}
          </div>
        }
        actions={
          <>
            {order.status === "information_required" && (
              <button type="button" className={buttonStyles.accent}>
                <Send className="size-4" aria-hidden="true" />
                Resubmit order
              </button>
            )}
            {order.status === "draft" && (
              <button type="button" className={buttonStyles.accent}>
                <Send className="size-4" aria-hidden="true" />
                Submit order
              </button>
            )}
            <button type="button" className={buttonStyles.secondary}>
              <Upload className="size-4" aria-hidden="true" />
              Upload document
            </button>
          </>
        }
      />

      <PageBody>
        {/* ---- Status callouts --------------------------------------------- */}
        {order.status === "information_required" && order.statusReason && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-warning-br bg-tone-warning-bg p-4">
            <Info
              className="mt-0.5 size-5 shrink-0 text-tone-warning-fg"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-tone-warning-fg">
                We need more information
              </h2>
              <p className="mt-1 text-sm text-tone-warning-fg/90">
                {order.statusReason}
              </p>
            </div>
          </div>
        )}

        {order.requiresReview && order.reviewReason && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-info-br bg-tone-info-bg p-4">
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-info-fg"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-tone-info-fg">
                Routed for qualified review
              </h2>
              <p className="mt-1 text-sm text-tone-info-fg/90">
                {order.reviewReason}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            {/* ---- Request details ---------------------------------------- */}
            <Panel title="Request">
              <DefinitionList columns={3}>
                <Definition label="Request date">
                  <DateText value={order.requestDate} timeZone={session.timezone} />
                </Definition>
                <Definition label="Mode">
                  <Value>{order.mode ? modeLabels[order.mode] : null}</Value>
                </Definition>
                <Definition label="Service">
                  <Value>{order.serviceType}</Value>
                </Definition>
                <Definition label="Priority">
                  <span className="capitalize">{order.priority}</span>
                </Definition>
                <Definition label="Requested pickup">
                  <DateText
                    value={order.requestedPickupDate}
                    timeZone={session.timezone}
                  />
                </Definition>
                <Definition label="Requested delivery">
                  <DateText
                    value={order.requestedDeliveryDate}
                    timeZone={session.timezone}
                  />
                </Definition>
                <Definition label="Supplier">
                  <Value>{order.supplierName}</Value>
                </Definition>
                <Definition label="Origin">
                  <Value>{order.originLabel}</Value>
                </Definition>
                <Definition label="Destination">
                  <Value>{order.destinationLabel}</Value>
                </Definition>
                <Definition label="Incoterm">
                  <Value>
                    {order.incoterm
                      ? `${order.incoterm}${
                          order.incotermNamedPlace
                            ? ` — ${order.incotermNamedPlace}`
                            : ""
                        }`
                      : null}
                  </Value>
                </Definition>
                <Definition label="Declared value">
                  <Money amount={order.declaredValue} currency={currency} />
                </Definition>
                <Definition label="Insurance requested">
                  {order.insuranceRequested ? "Yes" : "No"}
                </Definition>
                {order.specialInstructions && (
                  <Definition label="Special instructions" full>
                    {order.specialInstructions}
                  </Definition>
                )}
              </DefinitionList>
            </Panel>

            {/* ---- Cargo --------------------------------------------------- */}
            <Panel
              title="Cargo"
              description={`${order.items.length} line${order.items.length === 1 ? "" : "s"}`}
              padded={false}
            >
              {order.items.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No cargo lines have been added yet.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TH>#</TH>
                    <TH>Description</TH>
                    <TH>HS code</TH>
                    <TH>Origin</TH>
                    <TH align="right">Quantity</TH>
                    <TH align="right">Unit value</TH>
                    <TH align="right">Total value</TH>
                  </THead>
                  <TBody>
                    {order.items.map((item) => {
                      const flags = handlingFlags(item);
                      return (
                        <TR key={item.id}>
                          <TD className="tnum text-slate-500">{item.lineNo}</TD>
                          <TD>
                            <p className="font-medium text-slate-900">
                              {item.description}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {item.category}
                            </p>
                            {flags.length > 0 && (
                              <ul className="mt-1.5 flex flex-wrap gap-1">
                                {flags.map((flag) => (
                                  <li
                                    key={flag}
                                    className="rounded-sm bg-tone-warning-bg px-1.5 py-0.5 text-[11px] font-medium text-tone-warning-fg"
                                  >
                                    {flag}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TD>
                          <TD>
                            {item.hsCode ? (
                              <Ref className="text-slate-600">{item.hsCode}</Ref>
                            ) : (
                              <Value>{null}</Value>
                            )}
                          </TD>
                          <TD>
                            <Value>{item.originCountry}</Value>
                          </TD>
                          <TD align="right" className="tnum whitespace-nowrap">
                            {item.quantity} {item.uom}
                          </TD>
                          <TD align="right">
                            <Money amount={item.unitValue} currency={item.currency} />
                          </TD>
                          <TD align="right">
                            <Money
                              amount={item.totalValue}
                              currency={item.currency}
                              emphasis
                            />
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </Panel>

            {/* ---- Packages ------------------------------------------------ */}
            {order.packages.length > 0 && (
              <Panel title="Packages" padded={false}>
                <Table>
                  <THead>
                    <TH>#</TH>
                    <TH>Packaging</TH>
                    <TH align="right">Count</TH>
                    <TH align="right">Gross (kg)</TH>
                    <TH align="right">Net (kg)</TH>
                    <TH align="right">Dimensions (cm)</TH>
                    <TH align="right">Volume (m³)</TH>
                    <TH>Marks</TH>
                  </THead>
                  <TBody>
                    {order.packages.map((pkg) => (
                      <TR key={pkg.id}>
                        <TD className="tnum text-slate-500">{pkg.lineNo}</TD>
                        <TD className="capitalize">
                          {pkg.packagingType.toLowerCase()}
                        </TD>
                        <TD align="right" className="tnum">
                          {pkg.packageCount}
                        </TD>
                        <TD align="right" className="tnum">
                          <Value>{pkg.grossWeightKg}</Value>
                        </TD>
                        <TD align="right" className="tnum">
                          <Value>{pkg.netWeightKg}</Value>
                        </TD>
                        <TD align="right" className="tnum whitespace-nowrap">
                          {pkg.lengthCm && pkg.widthCm && pkg.heightCm
                            ? `${pkg.lengthCm} × ${pkg.widthCm} × ${pkg.heightCm}`
                            : "—"}
                        </TD>
                        <TD align="right" className="tnum">
                          <Value>{pkg.volumeCbm}</Value>
                        </TD>
                        <TD>
                          {pkg.marksAndNumbers ? (
                            <Ref className="text-xs text-slate-600">
                              {pkg.marksAndNumbers}
                            </Ref>
                          ) : (
                            <Value>{null}</Value>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Panel>
            )}
          </div>

          {/* ---- Sidebar ---------------------------------------------------- */}
          <div className="space-y-6">
            <Panel title="Linked records">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Quotation</span>
                  {order.quotationId ? (
                    <Link
                      href={`/portal/quotations/${order.quotationId}`}
                      className="font-medium text-steel-600 hover:text-navy-900"
                    >
                      View quotation
                    </Link>
                  ) : (
                    <span className="text-slate-400">Not raised</span>
                  )}
                </li>
                <li className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Shipments</span>
                  {order.shipmentIds.length > 0 ? (
                    <ul className="text-right">
                      {order.shipmentIds.map((sid) => (
                        <li key={sid}>
                          <Link
                            href={`/portal/shipments/${sid}`}
                            className="font-medium text-steel-600 hover:text-navy-900"
                          >
                            View shipment
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400">None yet</span>
                  )}
                </li>
              </ul>
            </Panel>

            <Panel
              title="Documents"
              description={`${documents.length} attached`}
              padded={false}
            >
              {documents.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No documents attached to this order.
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
                          v{doc.versionNo}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
