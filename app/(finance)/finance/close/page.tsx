import type { Metadata } from "next";
import { Check, X, Lock, ClipboardCheck } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState, buttonStyles } from "@/components/ui/layout";
import { DateText, Ref } from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getFinanceSession, financeCan } from "@/lib/finance/session";
import { listCloseCandidates } from "@/lib/finance/queries";

export const metadata: Metadata = { title: "Close" };

const categoryLabels: Record<string, string> = {
  operational: "Operational",
  document: "Documents",
  finance: "Finance",
  exception: "Exceptions and claims",
};

export default async function ClosePage() {
  const session = await getFinanceSession();
  const candidates = await listCloseCandidates();
  const canClose = financeCan(session, "shipment.close");

  return (
    <>
      <PageHeader
        title="Close"
        description="Shipment closure is blocked until the configured operational, document, finance and exception checks all pass (BR-030)."
      />

      <PageBody>
        {candidates.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={ClipboardCheck}
              title="Nothing awaiting closure"
              description="Delivered shipments appear here once they are ready to be checked."
            />
          </Panel>
        ) : (
          <div className="space-y-6">
            {candidates.map((candidate) => {
              const failed = candidate.checks.filter((c) => !c.passed);
              const passed = candidate.checks.filter((c) => c.passed);

              const grouped = (
                ["operational", "document", "finance", "exception"] as const
              ).map((category) => ({
                category,
                checks: candidate.checks.filter((c) => c.category === category),
              }));

              return (
                <Panel
                  key={candidate.shipmentId}
                  title={
                    <span className="flex flex-wrap items-center gap-3 normal-case">
                      <Ref className="text-base font-semibold tracking-normal text-slate-900">
                        {candidate.shipmentNumber}
                      </Ref>
                      <StatusBadge
                        lifecycle="shipment"
                        status={candidate.status}
                        size="sm"
                      />
                      <span className="text-sm font-normal tracking-normal text-slate-600">
                        {candidate.customerName}
                      </span>
                    </span>
                  }
                  description={
                    candidate.deliveredAt ? (
                      <>
                        Delivered{" "}
                        <DateText
                          value={candidate.deliveredAt}
                          timeZone={session.timezone}
                        />
                        {" · "}
                        {passed.length} of {candidate.checks.length} checks passed
                      </>
                    ) : (
                      <>
                        Not yet delivered · {passed.length} of{" "}
                        {candidate.checks.length} checks passed
                      </>
                    )
                  }
                  padded={false}
                >
                  {/* Progress rail across the four check categories. */}
                  <div className="flex gap-1 border-b border-slate-200 px-5 py-4">
                    {candidate.checks.map((check) => (
                      <div
                        key={check.id}
                        className={`h-1.5 flex-1 rounded-full ${
                          check.passed ? "bg-tone-success-fg" : "bg-tone-danger-br"
                        }`}
                        title={check.label}
                      />
                    ))}
                  </div>

                  <div className="divide-y divide-slate-150">
                    {grouped.map(({ category, checks }) =>
                      checks.length === 0 ? null : (
                        <div key={category} className="px-5 py-4">
                          <h3 className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
                            {categoryLabels[category]}
                          </h3>
                          <ul className="mt-3 space-y-3">
                            {checks.map((check) => (
                              <li key={check.id} className="flex gap-3">
                                <span
                                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                                    check.passed
                                      ? "bg-tone-success-fg text-white"
                                      : "bg-tone-danger-fg text-white"
                                  }`}
                                  aria-hidden="true"
                                >
                                  {check.passed ? (
                                    <Check className="size-3" strokeWidth={3} />
                                  ) : (
                                    <X className="size-3" strokeWidth={3} />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <p
                                    className={`text-sm font-medium ${
                                      check.passed
                                        ? "text-slate-700"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {check.label}
                                    <span className="sr-only">
                                      {check.passed ? " — passed" : " — failed"}
                                    </span>
                                  </p>
                                  <p
                                    className={`mt-0.5 text-sm ${
                                      check.passed
                                        ? "text-slate-500"
                                        : "text-tone-danger-fg"
                                    }`}
                                  >
                                    {check.detail}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-navy-900 bg-ice-50 px-5 py-4">
                    {failed.length === 0 ? (
                      <p className="text-sm text-tone-success-fg">
                        All checks pass. This shipment can be closed.
                      </p>
                    ) : (
                      <p className="flex items-start gap-2 text-sm text-tone-danger-fg">
                        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                          {failed.length} check{failed.length === 1 ? "" : "s"}{" "}
                          outstanding. Closure is blocked until they pass — a
                          closed shipment with unresolved costs or claims cannot
                          be corrected without a reopening.
                        </span>
                      </p>
                    )}
                    <button
                      type="button"
                      disabled
                      className={buttonStyles.accent}
                      title={
                        failed.length > 0
                          ? "Blocked by outstanding checks"
                          : canClose
                            ? "Disabled until the database is connected"
                            : "Your role does not permit closing shipments"
                      }
                    >
                      Close shipment
                    </button>
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
