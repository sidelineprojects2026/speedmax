import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canTransition,
  nextStatuses,
  statusLabel,
  statusTone,
  transitionRequiresReason,
  lifecycles,
  type LifecycleKey,
} from "./status";

import {
  deriveCustomerTimeline,
  hasActiveHold,
  milestoneCatalog,
  customerSteps,
  currentCustomerStep,
  milestonesForRole,
  roleCanPostMilestone,
  type PostedEvent,
} from "./milestones";

import {
  parseMoney,
  toDecimalString,
  add,
  subtract,
  multiply,
  sum,
  money,
  zero,
  convert,
  minorUnitsFor,
} from "./money";

import {
  allocate,
  allocationReconciles,
  computeProfitability,
  marginRequiresEscalation,
  toCustomerLine,
  type InternalChargeLine,
} from "./charges";

import { canApprove, canVerifyPayment } from "./segregation";

/* -------------------------------------------------------------------------- */
/* Status lifecycles                                                          */
/* -------------------------------------------------------------------------- */

test("transitions follow the declared graph", () => {
  assert.equal(canTransition("shipping_order", "draft", "submitted"), true);
  assert.equal(canTransition("shipping_order", "draft", "converted"), false);
  assert.equal(canTransition("invoice", "issued", "paid"), true);
  assert.equal(canTransition("invoice", "draft", "paid"), false);
});

test("unknown statuses fail closed", () => {
  assert.equal(canTransition("shipment", "not_a_status", "delivered"), false);
  assert.equal(canTransition("shipment", "planned", "not_a_status"), false);
  assert.deepEqual(nextStatuses("shipment", "nonsense"), []);
});

test("terminal statuses have no exits", () => {
  assert.deepEqual(nextStatuses("shipping_order", "rejected"), []);
  assert.deepEqual(nextStatuses("quotation", "accepted"), []);
});

test("labels and tones fall back rather than blanking", () => {
  assert.equal(statusLabel("invoice", "overdue"), "Overdue");
  assert.equal(statusLabel("invoice", "mystery"), "mystery");
  assert.equal(statusTone("invoice", "mystery"), "neutral");
});

test("destructive transitions demand a reason (§17.2)", () => {
  assert.equal(transitionRequiresReason("shipping_order", "rejected"), true);
  assert.equal(transitionRequiresReason("invoice", "reversed"), true);
  assert.equal(transitionRequiresReason("shipping_order", "submitted"), false);
});

test("every declared transition target exists in its own lifecycle", () => {
  // Guards against a typo in `next` silently creating an unreachable status.
  for (const key of Object.keys(lifecycles) as LifecycleKey[]) {
    const lc = lifecycles[key];
    const known = new Set(Object.keys(lc.states));
    assert.ok(known.has(lc.initial), `${key}: initial status missing`);
    for (const [from, def] of Object.entries(lc.states)) {
      for (const to of def.next as readonly string[]) {
        assert.ok(known.has(to), `${key}: ${from} -> ${to} targets unknown status`);
      }
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Milestone catalog and customer timeline                                    */
/* -------------------------------------------------------------------------- */

test("catalog matches the §9.2 shape", () => {
  assert.equal(milestoneCatalog.length, 25);
  const seqs = milestoneCatalog.map((m) => m.seq);
  assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), "sequence must be ordered");
  assert.equal(new Set(milestoneCatalog.map((m) => m.code)).size, 25, "codes unique");
});

test("every customerStep maps to a real §9.3 step", () => {
  const valid = new Set(customerSteps.map((s) => s.step));
  for (const m of milestoneCatalog) {
    if (m.customerStep) {
      assert.ok(valid.has(m.customerStep), `${m.code} maps to unknown step`);
    }
  }
});

test("timeline backfills earlier steps when an intermediate event is missing", () => {
  // Departed origin posted, but the collection milestone never was.
  const events: PostedEvent[] = [
    {
      milestoneCode: "DEPARTED_ORIGIN",
      eventTime: "2026-03-10T08:00:00Z",
      visibility: "customer",
    },
  ];
  const tl = deriveCustomerTimeline(events, {
    orderSubmittedAt: "2026-03-01T00:00:00Z",
  });

  const byStep = Object.fromEntries(tl.map((t) => [t.step, t]));
  assert.equal(byStep.order_submitted.state, "complete");
  assert.equal(byStep.cargo_collected.state, "complete", "backfilled");
  assert.equal(byStep.departed_origin.state, "current");
  assert.equal(byStep.in_transit.state, "pending");
});

test("internal events never advance the customer timeline", () => {
  const events: PostedEvent[] = [
    {
      milestoneCode: "DEPARTED_ORIGIN",
      eventTime: "2026-03-10T08:00:00Z",
      visibility: "internal",
    },
  ];
  const tl = deriveCustomerTimeline(events);
  assert.ok(tl.every((t) => t.state === "pending"), "nothing should advance");
});

test("re-posting a milestone keeps the earliest time", () => {
  const events: PostedEvent[] = [
    { milestoneCode: "DELIVERED", eventTime: "2026-04-02T10:00:00Z", visibility: "customer" },
    { milestoneCode: "DELIVERED", eventTime: "2026-04-01T09:00:00Z", visibility: "customer" },
  ];
  const tl = deriveCustomerTimeline(events);
  const delivered = tl.find((t) => t.step === "delivered")!;
  assert.equal(delivered.reachedAt?.toISOString(), "2026-04-01T09:00:00.000Z");
});

test("the final step reads complete, not current", () => {
  const tl = deriveCustomerTimeline([
    { milestoneCode: "POD_ACCEPTED", eventTime: "2026-04-05T12:00:00Z", visibility: "customer" },
  ]);
  assert.equal(tl.at(-1)!.state, "complete");
  assert.equal(currentCustomerStep(tl)?.step, "delivered");
});

test("a cleared customs hold is no longer active", () => {
  const held: PostedEvent[] = [
    { milestoneCode: "CUSTOMS_HOLD", eventTime: "2026-03-20T10:00:00Z", visibility: "customer" },
  ];
  assert.equal(hasActiveHold(held), true);

  const cleared: PostedEvent[] = [
    ...held,
    { milestoneCode: "IMPORT_CLEARED", eventTime: "2026-03-22T10:00:00Z", visibility: "customer" },
  ];
  assert.equal(hasActiveHold(cleared), false, "clearance resolves the hold");

  // Held again after clearance — active once more.
  const reheld: PostedEvent[] = [
    ...cleared,
    { milestoneCode: "CUSTOMS_HOLD", eventTime: "2026-03-25T10:00:00Z", visibility: "customer" },
  ];
  assert.equal(hasActiveHold(reheld), true);
});

/* -------------------------------------------------------------------------- */
/* Assignment role scoping                                                    */
/* -------------------------------------------------------------------------- */

test("an origin agent may post origin milestones but not destination ones", () => {
  assert.equal(roleCanPostMilestone("origin_agent", "CARGO_PICKED_UP"), true);
  assert.equal(roleCanPostMilestone("origin_agent", "EXPORT_CLEARED"), true);
  // Destination work belongs to the destination agent.
  assert.equal(roleCanPostMilestone("origin_agent", "IMPORT_CLEARED"), false);
  assert.equal(roleCanPostMilestone("origin_agent", "POD_ACCEPTED"), false);
});

test("a destination agent may post destination milestones but not origin ones", () => {
  assert.equal(
    roleCanPostMilestone("destination_agent", "IMPORT_CLEARANCE_SUBMITTED"),
    true,
  );
  assert.equal(roleCanPostMilestone("destination_agent", "POD_ACCEPTED"), true);
  assert.equal(
    roleCanPostMilestone("destination_agent", "CARGO_PICKED_UP"),
    false,
  );
  assert.equal(roleCanPostMilestone("destination_agent", "EXPORT_CLEARED"), false);
});

test("arrival at destination belongs to the destination agent", () => {
  // Regression guard. ARRIVED_DESTINATION originally sat in the transit phase,
  // which let an origin agent post arrival at a port on the other side of the
  // world. It is destination work and must stay in the destination phase.
  assert.equal(
    roleCanPostMilestone("destination_agent", "ARRIVED_DESTINATION"),
    true,
  );
  assert.equal(
    roleCanPostMilestone("origin_agent", "ARRIVED_DESTINATION"),
    false,
  );
});

test("role scoping fails closed on unknown milestones", () => {
  assert.equal(roleCanPostMilestone("origin_agent", "NOT_A_MILESTONE"), false);
  assert.equal(
    roleCanPostMilestone("destination_agent", "NOT_A_MILESTONE"),
    false,
  );
});

test("the coordinator can post anything; agents cannot", () => {
  // §3 — the coordinator owns the shipment end to end and must be able to
  // correct any part of it.
  assert.equal(milestonesForRole("coordinator").length, milestoneCatalog.length);
  assert.ok(
    milestonesForRole("origin_agent").length < milestoneCatalog.length,
    "an origin agent must not see the whole catalog",
  );
  assert.ok(
    milestonesForRole("destination_agent").length < milestoneCatalog.length,
    "a destination agent must not see the whole catalog",
  );
});

test("origin and destination agent scopes do not overlap", () => {
  const origin = new Set(milestonesForRole("origin_agent").map((m) => m.code));
  const destination = milestonesForRole("destination_agent").map((m) => m.code);
  const overlap = destination.filter((code) => origin.has(code));
  assert.deepEqual(overlap, [], "no milestone should be postable by both agents");
});

test("every role's milestones come from the catalog", () => {
  const known = new Set(milestoneCatalog.map((m) => m.code));
  for (const role of [
    "origin_agent",
    "destination_agent",
    "carrier",
    "broker",
    "transporter",
    "warehouse",
    "coordinator",
  ] as const) {
    for (const m of milestonesForRole(role)) {
      assert.ok(known.has(m.code), `${role}: ${m.code} not in catalog`);
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Segregation of duties — §13                                                */
/* -------------------------------------------------------------------------- */

const ALICE = "user-alice";
const BOB = "user-bob";

test("a preparer cannot approve their own work", () => {
  const outcome = canApprove({
    actorId: ALICE,
    hasPermission: true,
    preparedById: ALICE,
    action: "issuing an invoice",
  });
  assert.equal(outcome.allowed, false);
  assert.match(
    outcome.allowed === false ? outcome.reason : "",
    /prepared this record/i,
  );
});

test("a different person holding the permission may approve", () => {
  const outcome = canApprove({
    actorId: BOB,
    hasPermission: true,
    preparedById: ALICE,
    action: "issuing an invoice",
  });
  assert.equal(outcome.allowed, true);
});

test("permission alone is not enough, and neither is being a different person", () => {
  // Different person, but no permission.
  assert.equal(
    canApprove({
      actorId: BOB,
      hasPermission: false,
      preparedById: ALICE,
      action: "approving a vendor bill",
    }).allowed,
    false,
  );
  // Permission, but same person.
  assert.equal(
    canApprove({
      actorId: ALICE,
      hasPermission: true,
      preparedById: ALICE,
      action: "approving a vendor bill",
    }).allowed,
    false,
  );
});

test("an unknown preparer fails closed", () => {
  // If we cannot establish who prepared a financial record we cannot establish
  // that the approver is someone else, so approval must be refused.
  const outcome = canApprove({
    actorId: BOB,
    hasPermission: true,
    preparedById: null,
    action: "approving a settlement",
  });
  assert.equal(outcome.allowed, false);
  assert.match(
    outcome.allowed === false ? outcome.reason : "",
    /not recorded/i,
  );
});

test("payment verification follows the same separation rule", () => {
  assert.equal(canVerifyPayment(ALICE, true, ALICE).allowed, false);
  assert.equal(canVerifyPayment(BOB, true, ALICE).allowed, true);
  assert.equal(canVerifyPayment(BOB, false, ALICE).allowed, false);
  assert.equal(canVerifyPayment(BOB, true, null).allowed, false);
});

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

test("parses and renders decimal strings exactly", () => {
  assert.equal(toDecimalString(parseMoney("1234.56", "USD")), "1234.56");
  assert.equal(toDecimalString(parseMoney("0.1", "USD")), "0.10");
  assert.equal(toDecimalString(parseMoney("-45.005", "USD")), "-45.01");
  assert.equal(toDecimalString(parseMoney("", "USD")), "0.00");
});

test("respects currency minor units", () => {
  assert.equal(minorUnitsFor("JPY"), 0);
  assert.equal(minorUnitsFor("KWD"), 3);
  assert.equal(toDecimalString(parseMoney("1500", "JPY")), "1500");
  assert.equal(parseMoney("1500", "JPY").units, 1500);
  assert.equal(parseMoney("15.00", "USD").units, 1500);
});

test("float drift does not occur", () => {
  // The canonical case: 0.1 + 0.2 must be exactly 0.30.
  const total = add(parseMoney("0.1", "USD"), parseMoney("0.2", "USD"));
  assert.equal(toDecimalString(total), "0.30");

  // Twenty charge lines of 0.07 must be exactly 1.40.
  const lines = Array.from({ length: 20 }, () => parseMoney("0.07", "USD"));
  assert.equal(toDecimalString(sum(lines, "USD")), "1.40");
});

test("refuses to mix currencies", () => {
  assert.throws(
    () => add(parseMoney("10", "USD"), parseMoney("10", "EUR")),
    /Currency mismatch/,
  );
});

test("multiplication rounds half away from zero", () => {
  assert.equal(toDecimalString(multiply(parseMoney("10.00", "USD"), 1.005)), "10.05");
  assert.equal(toDecimalString(multiply(parseMoney("-10.00", "USD"), 1.005)), "-10.05");
});

test("conversion crosses minor-unit scales", () => {
  const usd = parseMoney("100.00", "USD");
  const jpy = convert(usd, 150, "JPY");
  assert.equal(jpy.currency, "JPY");
  assert.equal(toDecimalString(jpy), "15000");
  assert.throws(() => convert(usd, 0, "JPY"), /must be positive/);
});

/* -------------------------------------------------------------------------- */
/* Charges, margin and allocation                                             */
/* -------------------------------------------------------------------------- */

test("toCustomerLine removes cost entirely (BR-008)", () => {
  const internal: InternalChargeLine = {
    id: "1",
    group: "main_carriage",
    chargeCode: "MC_OCEAN",
    description: "Ocean freight",
    quantity: 1,
    cost: parseMoney("800.00", "USD"),
    sell: parseMoney("1150.00", "USD"),
    taxable: true,
  };
  const customer = toCustomerLine(internal);
  assert.ok(!("cost" in customer), "cost key must not survive the narrowing");
  assert.equal(toDecimalString(customer.sell), "1150.00");
});

test("margin follows the §10.3 formula", () => {
  const p = computeProfitability(
    {
      customerCharges: parseMoney("10000.00", "USD"),
      discounts: parseMoney("500.00", "USD"),
      credits: parseMoney("200.00", "USD"),
      debits: parseMoney("700.00", "USD"),
    },
    {
      actualVendorCost: parseMoney("6000.00", "USD"),
      agentCost: parseMoney("800.00", "USD"),
      accruals: parseMoney("400.00", "USD"),
    },
  );

  // 10000 - 500 - 200 + 700 = 10000
  assert.equal(toDecimalString(p.netRevenue), "10000.00");
  assert.equal(toDecimalString(p.totalDirectCost), "7200.00");
  assert.equal(toDecimalString(p.grossProfit), "2800.00");
  assert.equal(p.grossMarginPct, 28);
});

test("zero revenue yields null margin, not zero", () => {
  const p = computeProfitability(
    { customerCharges: zero("USD") },
    { actualVendorCost: parseMoney("100.00", "USD") },
  );
  assert.equal(p.grossMarginPct, null);
  // And an unknown margin must escalate rather than pass silently (§8.2).
  assert.equal(marginRequiresEscalation(null, 10), true);
});

test("negative and thin margins escalate", () => {
  assert.equal(marginRequiresEscalation(-3, 10), true);
  assert.equal(marginRequiresEscalation(4, 10), true);
  assert.equal(marginRequiresEscalation(18, 10), false);
});

test("allocation reconciles exactly to the source amount", () => {
  // 100.00 over three equal parts is the classic rounding trap: 33.33 x 3
  // leaves a stray cent unless the remainder is distributed.
  const amount = parseMoney("100.00", "USD");
  const result = allocate(amount, [
    { id: "a", basis: 1 },
    { id: "b", basis: 1 },
    { id: "c", basis: 1 },
  ]);

  assert.equal(allocationReconciles(amount, result), true);
  assert.equal(
    toDecimalString(sum(result.map((r) => r.amount), "USD")),
    "100.00",
  );
});

test("weight allocation is proportional and still reconciles", () => {
  const amount = parseMoney("1000.00", "USD");
  const result = allocate(
    amount,
    [
      { id: "a", basis: 1234.567 },
      { id: "b", basis: 89.1 },
      { id: "c", basis: 3456.789 },
    ],
    "weight",
  );

  assert.equal(allocationReconciles(amount, result), true);
  // Heaviest line takes the largest share.
  const biggest = result.reduce((m, r) => (r.amount.units > m.amount.units ? r : m));
  assert.equal(biggest.id, "c");
});

test("zero total basis falls back to an equal split rather than losing the cost", () => {
  const amount = parseMoney("90.00", "USD");
  const result = allocate(
    amount,
    [
      { id: "a", basis: 0 },
      { id: "b", basis: 0 },
      { id: "c", basis: 0 },
    ],
    "weight",
  );
  assert.equal(allocationReconciles(amount, result), true);
  assert.deepEqual(
    result.map((r) => toDecimalString(r.amount)),
    ["30.00", "30.00", "30.00"],
  );
});

test("negative amounts (credits) allocate and reconcile", () => {
  const amount = money(-10000, "USD"); // -100.00
  const result = allocate(amount, [
    { id: "a", basis: 1 },
    { id: "b", basis: 1 },
    { id: "c", basis: 1 },
  ]);
  assert.equal(allocationReconciles(amount, result), true);
  assert.equal(toDecimalString(sum(result.map((r) => r.amount), "USD")), "-100.00");
});

test("allocating to no targets is empty, not an error", () => {
  assert.deepEqual(allocate(parseMoney("50.00", "USD"), []), []);
});

test("subtract underpins balance arithmetic", () => {
  const invoice = parseMoney("2500.00", "USD");
  const paid = parseMoney("1000.00", "USD");
  assert.equal(toDecimalString(subtract(invoice, paid)), "1500.00");
});
