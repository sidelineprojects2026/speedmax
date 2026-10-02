import "server-only";

/**
 * Public shipment tracking (§9.3).
 *
 * The only unauthenticated read in the application. It matches an exact
 * reference — shipment number, house or master bill, container or booking — and
 * returns customer-visible milestones only. Exactness matters: a prefix or
 * fuzzy match would let anyone enumerate the shipment book by walking
 * sequential numbers.
 *
 * Mirrors the `public_track` RPC in supabase/migrations/0005, which is
 * SECURITY DEFINER for the same reason: no anonymous SELECT policy exists on
 * shipments or tracking events.
 */

import { readStore } from "@/lib/store/db";
import {
  deriveCustomerTimeline,
  type TimelineEntry,
} from "@/lib/domain/milestones";
import type { Shipment, StoreData } from "@/lib/store/schema";

export type TrackingLookup =
  | { readonly kind: "unavailable" }
  | { readonly kind: "not_found"; readonly reference: string }
  | {
      readonly kind: "found";
      readonly reference: string;
      readonly shipmentNumber: string;
      readonly status: string;
      readonly mode: string | null;
      readonly originLabel: string | null;
      readonly destinationLabel: string | null;
      readonly etaAt: string | null;
      readonly timeline: TimelineEntry[];
    };

function matches(shipment: Shipment, ref: string): boolean {
  if (shipment.shipmentNumber.toUpperCase() === ref) return true;
  return shipment.legs.some((leg) =>
    [leg.houseBill, leg.masterBill, leg.containerNumber, leg.bookingNumber]
      .filter((v): v is string => Boolean(v))
      .some((v) => v.toUpperCase() === ref),
  );
}

/** First submission and acceptance across linked orders — timeline steps 1–2. */
function commercialTimes(data: StoreData, shipment: Shipment) {
  const orderSubmittedAt =
    shipment.orderIds
      .map((id) => data.orders.find((o) => o.id === id)?.submittedAt)
      .filter((v): v is string => Boolean(v))
      .sort()[0] ?? null;

  const quotationAcceptedAt =
    shipment.orderIds
      .flatMap((id) => data.quotations.filter((q) => q.orderId === id))
      .map((q) => q.acceptance?.acceptedAt)
      .filter((v): v is string => Boolean(v))
      .sort()[0] ?? null;

  return {
    orderSubmittedAt,
    quotationAcceptedAt,
    bookingConfirmedAt: shipment.booking?.confirmedAt ?? null,
  };
}

export async function trackShipment(reference: string): Promise<TrackingLookup> {
  const ref = reference.trim().toUpperCase();
  // Too short to be a real reference; refuse rather than scan.
  if (ref.length < 4) return { kind: "not_found", reference: reference.trim() };

  let data: StoreData;
  try {
    data = await readStore();
  } catch {
    return { kind: "unavailable" };
  }

  const shipment = data.shipments.find((s) => matches(s, ref));
  if (!shipment) return { kind: "not_found", reference: reference.trim() };

  const timeline = deriveCustomerTimeline(
    shipment.events
      .filter((e) => e.visibility === "customer" && !e.isSuperseded)
      .map((e) => ({
        milestoneCode: e.milestoneCode,
        eventTime: e.eventTime,
        visibility: e.visibility,
      })),
    commercialTimes(data, shipment),
  );

  return {
    kind: "found",
    reference: reference.trim(),
    shipmentNumber: shipment.shipmentNumber,
    status: shipment.status,
    mode: shipment.mode,
    originLabel: shipment.originLabel,
    destinationLabel: shipment.destinationLabel,
    etaAt: shipment.etaAt,
    timeline,
  };
}
