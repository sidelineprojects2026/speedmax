import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, TriangleAlert } from "lucide-react";
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
import { getSession } from "@/lib/portal/session";
import { listOrders } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Shipping Orders" };

const modeLabels: Record<string, string> = {
  air: "Air",
  sea: "Ocean",
  road: "Road",
  rail: "Rail",
  courier: "Courier",
  warehouse_transfer: "Warehouse transfer",
  other: "Other",
};

export default async function OrdersPage() {
  const session = await getSession();
  const orders = await listOrders();

  return (
    <>
      <PageHeader
        title="Shipping Orders"
        description="Requests you have raised with Speedmax, from draft through to conversion into a shipment."
        actions={
          <Link href="/portal/orders/new" className={buttonStyles.accent}>
            <Plus className="size-4" aria-hidden="true" />
            New Shipping Order
          </Link>
        }
      />

      <PageBody>
        <Panel padded={false}>
          {orders.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No shipping orders yet"
              description="Create a shipping order to tell us what needs to move."
              action={
                <Link href="/portal/orders/new" className={buttonStyles.accent}>
                  New Shipping Order
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TH>Order</TH>
                <TH>Status</TH>
                <TH>Route</TH>
                <TH>Mode</TH>
                <TH>Your reference</TH>
                <TH align="right">Declared value</TH>
                <TH>Submitted</TH>
              </THead>
              <TBody>
                {orders.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <Link
                        href={`/portal/orders/${order.id}`}
                        className="font-medium text-steel-600 hover:text-navy-900"
                      >
                        <Ref>{order.orderNumber}</Ref>
                      </Link>
                      {order.requiresReview && (
                        <span
                          className="mt-1 flex items-center gap-1 text-xs text-tone-warning-fg"
                          title={order.reviewReason ?? undefined}
                        >
                          <TriangleAlert className="size-3" aria-hidden="true" />
                          Flagged for review
                        </span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge
                        lifecycle="shipping_order"
                        status={order.status}
                        size="sm"
                      />
                    </TD>
                    <TD>
                      <span className="whitespace-nowrap">
                        <Value>{order.originLabel}</Value>
                        <span className="mx-1.5 text-slate-400">→</span>
                        <Value>{order.destinationLabel}</Value>
                      </span>
                    </TD>
                    <TD>
                      <Value>{order.mode ? modeLabels[order.mode] : null}</Value>
                    </TD>
                    <TD>
                      {order.customerReference ? (
                        <Ref className="text-slate-600">
                          {order.customerReference}
                        </Ref>
                      ) : (
                        <Value>{null}</Value>
                      )}
                    </TD>
                    <TD align="right">
                      <Money
                        amount={order.declaredValue}
                        currency={order.declaredCurrency ?? session.currency}
                      />
                    </TD>
                    <TD>
                      <DateText
                        value={order.submittedAt}
                        timeZone={session.timezone}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
