import type { Metadata } from "next";
import { TriangleAlert, Lock, Info } from "lucide-react";
import { PageBody, PageHeader, Panel, buttonStyles } from "@/components/ui/layout";
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
import { getFinanceSession, financeCan } from "@/lib/finance/session";
import {
  apPosition,
  listDuplicateWarnings,
  listVendorBills,
} from "@/lib/finance/queries";
import { canApprove } from "@/lib/domain/segregation";

export const metadata: Metadata = { title: "Vendor Bills" };

const vendorTypeLabels: Record<string, string> = {
  carrier: "Carrier",
  agent: "Agent",
  broker: "Broker",
  warehouse: "Warehouse",
  transporter: "Transporter",
  other: "Other",
};

export default async function VendorBillsPage() {
  const session = await getFinanceSession();
  const [bills, duplicates, ap] = await Promise.all([
    listVendorBills(),
    listDuplicateWarnings(),
    apPosition(session.baseCurrency),
  ]);

  const canApproveBills = financeCan(session, "vendor_bill.approve");

  return (
    <>
      <PageHeader
        title="Vendor Bills"
        description="Carrier, agent, broker, warehouse and transport costs, with accruals held separately from confirmed obligations."
        actions={
          <button type="button" className={buttonStyles.accent}>
            Record vendor bill
          </button>
        }
      />

      <PageBody>
        <div className="grid gap-4 sm:grid-cols-3">
          <Figure label="Awaiting approval" value={<Money amount={ap.awaitingApproval} currency={ap.currency} />} />
          <Figure label="Approved, unpaid" value={<Money amount={ap.approvedUnpaid} currency={ap.currency} />} />
          <Figure
            label="Accrued"
            value={<Money amount={ap.accrued} currency={ap.currency} />}
            note="Estimated, pending the vendor's final invoice"
          />
        </div>

        {/* ---- Duplicate warnings — §10.2 ---------------------------------- */}
        {duplicates.length > 0 && (
          <div className="mt-6 flex gap-3 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-tone-danger-fg">
                {duplicates.length} possible duplicate vendor invoice
                {duplicates.length === 1 ? "" : "s"}
              </h2>
              <ul className="mt-2 space-y-2 text-sm text-tone-danger-fg/90">
                {duplicates.map((bill) => (
                  <li key={bill.id}>
                    <span className="font-medium">{bill.billNumber}</span> —{" "}
                    {bill.duplicateWarning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Panel title="All vendor bills" padded={false}>
            <Table>
              <THead>
                <TH>Bill</TH>
                <TH>Vendor</TH>
                <TH>Status</TH>
                <TH>Shipments</TH>
                <TH>Bill date</TH>
                <TH>Due</TH>
                <TH align="right">Total</TH>
                <TH align="right">Balance</TH>
                <TH />
              </THead>
              <TBody>
                {bills.map((bill) => {
                  const decision = canApprove({
                    actorId: session.userId,
                    hasPermission: canApproveBills,
                    preparedById: bill.preparedById,
                    action: "approving a vendor bill",
                  });
                  const needsDecision =
                    bill.status === "draft" || bill.status === "verified";

                  // A duplicate blocks approval regardless of who prepared it —
                  // paying a carrier twice is the failure §10.2 is guarding
                  // against, and separation of duties would not catch it.
                  const blockReason = bill.duplicateWarning
                    ? bill.duplicateWarning
                    : decision.allowed
                      ? null
                      : decision.reason;

                  return (
                    <TR key={bill.id}>
                      <TD>
                        <Ref className="font-medium text-slate-900">
                          {bill.billNumber}
                        </Ref>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Vendor inv. <Ref>{bill.vendorInvoiceNumber}</Ref>
                        </p>
                        {bill.isAccrual && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-tone-info-bg px-1.5 py-0.5 text-[11px] font-medium text-tone-info-fg">
                            <Info className="size-3" aria-hidden="true" />
                            Accrual
                          </span>
                        )}
                        {bill.duplicateWarning && (
                          <span className="mt-1 block text-xs font-medium text-tone-danger-fg">
                            Possible duplicate
                          </span>
                        )}
                      </TD>
                      <TD>
                        <p className="text-slate-800">{bill.vendorName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {vendorTypeLabels[bill.vendorType] ?? bill.vendorType}
                        </p>
                      </TD>
                      <TD>
                        <StatusBadge
                          lifecycle="vendor_bill"
                          status={bill.status}
                          size="sm"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Prepared by {bill.preparedByName ?? "—"}
                        </p>
                        {bill.approvedByName && (
                          <p className="text-xs text-slate-500">
                            Approved by {bill.approvedByName}
                          </p>
                        )}
                      </TD>
                      <TD>
                        <ul className="space-y-0.5">
                          {bill.shipmentNumbers.map((n) => (
                            <li key={n}>
                              <Ref className="text-xs text-slate-600">{n}</Ref>
                            </li>
                          ))}
                        </ul>
                      </TD>
                      <TD>
                        <DateText
                          value={bill.billDate}
                          timeZone={session.timezone}
                        />
                      </TD>
                      <TD>
                        <DateText
                          value={bill.dueDate}
                          timeZone={session.timezone}
                        />
                      </TD>
                      <TD align="right">
                        <Money amount={bill.total} currency={bill.currency} />
                        {bill.fx && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            <Money
                              amount={bill.fx.baseAmount}
                              currency={bill.fx.baseCurrency}
                            />{" "}
                            at {bill.fx.appliedRate}
                          </p>
                        )}
                      </TD>
                      <TD align="right">
                        <Money
                          amount={bill.balance}
                          currency={bill.currency}
                          emphasis
                        />
                      </TD>
                      <TD align="right">
                        {needsDecision ? (
                          blockReason === null ? (
                            <button
                              type="button"
                              disabled
                              className={buttonStyles.secondary}
                            >
                              Approve
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-tone-warning-fg"
                              title={blockReason}
                            >
                              <Lock className="size-3" aria-hidden="true" />
                              Blocked
                            </span>
                          )
                        ) : (
                          <Value>{null}</Value>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Panel>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Accruals are recognised before the vendor&rsquo;s final invoice so
          shipment profitability is not overstated while costs are outstanding
          (§10.2). They reverse when the real bill arrives.
        </p>
      </PageBody>
    </>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium tracking-[0.08em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="tnum mt-2.5 text-xl font-semibold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}
