import type { Metadata } from "next";
import { ShieldAlert, Plus } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState, buttonStyles } from "@/components/ui/layout";
import {
  DateText,
  Definition,
  DefinitionList,
  Money,
  Ref,
  Value,
} from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession, can } from "@/lib/portal/session";
import { listClaims, listDocuments } from "@/lib/portal/queries";
import { claimLifecycle } from "@/lib/domain/status";

export const metadata: Metadata = { title: "Claims" };

/**
 * The §12.2 claim lifecycle, rendered as a progress rail so the customer can
 * see where their claim sits without needing the status vocabulary explained.
 * Terminal branches (rejected) are excluded from the happy path.
 */
const claimPath = [
  "draft",
  "submitted",
  "under_review",
  "negotiation",
  "approved",
  "settled",
  "closed",
] as const;

export default async function ClaimsPage() {
  const session = await getSession();
  const [claims, documents] = await Promise.all([listClaims(), listDocuments()]);

  return (
    <>
      <PageHeader
        title="Claims"
        description="Cargo damage, shortage and loss claims, from notice through to settlement."
        actions={
          can(session, "claim.file") ? (
            <button type="button" className={buttonStyles.accent}>
              <Plus className="size-4" aria-hidden="true" />
              File a claim
            </button>
          ) : undefined
        }
      />

      <PageBody>
        {claims.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={ShieldAlert}
              title="No claims"
              description="If cargo arrives damaged, short or not at all, file a claim here with your evidence and we will pursue it."
            />
          </Panel>
        ) : (
          <div className="space-y-6">
            {claims.map((claim) => {
              const currentIndex = claimPath.indexOf(
                claim.status as (typeof claimPath)[number],
              );
              const isRejected = claim.status === "rejected";
              const claimDocs = documents.filter((d) =>
                claim.documentIds.includes(d.id),
              );

              return (
                <Panel
                  key={claim.id}
                  title={
                    <span className="flex flex-wrap items-center gap-3 normal-case">
                      <Ref className="text-base font-semibold tracking-normal text-slate-900">
                        {claim.claimNumber}
                      </Ref>
                      <StatusBadge lifecycle="claim" status={claim.status} size="sm" />
                      <span className="text-sm font-normal tracking-normal text-slate-500">
                        {claim.basis} · <Ref>{claim.shipmentNumber}</Ref>
                      </span>
                    </span>
                  }
                >
                  {/* ---- Progress rail --------------------------------------- */}
                  {!isRejected && (
                    <ol className="mb-6 flex flex-wrap gap-1">
                      {claimPath.map((step, i) => {
                        const reached = currentIndex >= 0 && i <= currentIndex;
                        const current = i === currentIndex;
                        return (
                          <li key={step} className="flex-1 basis-24">
                            <div
                              className={`h-1 rounded-full ${
                                reached ? "bg-steel-500" : "bg-slate-200"
                              }`}
                            />
                            <p
                              className={`mt-1.5 text-[11px] ${
                                current
                                  ? "font-semibold text-slate-900"
                                  : reached
                                    ? "text-slate-600"
                                    : "text-slate-400"
                              }`}
                            >
                              {claimLifecycle.states[step].label}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  <DefinitionList columns={4}>
                    <Definition label="Incident date">
                      <DateText
                        value={claim.incidentDate}
                        timeZone={session.timezone}
                      />
                    </Definition>
                    <Definition label="Submitted">
                      <DateText
                        value={claim.submittedAt}
                        timeZone={session.timezone}
                      />
                    </Definition>
                    <Definition label="Amount claimed">
                      <Money
                        amount={claim.claimedAmount}
                        currency={claim.currency}
                        emphasis
                      />
                    </Definition>
                    <Definition label="Amount settled">
                      <Money
                        amount={claim.settledAmount}
                        currency={claim.currency}
                      />
                    </Definition>
                    <Definition label="Description" full>
                      {claim.description}
                    </Definition>
                    {claim.decisionNote && (
                      <Definition label="Decision" full>
                        {claim.decisionNote}
                      </Definition>
                    )}
                  </DefinitionList>

                  {claimDocs.length > 0 && (
                    <div className="mt-6 border-t border-slate-200 pt-5">
                      <h3 className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
                        Evidence
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {claimDocs.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center gap-3 text-sm"
                          >
                            <span className="font-medium text-slate-800">
                              {doc.name}
                            </span>
                            <StatusBadge
                              lifecycle="document"
                              status={doc.status}
                              size="sm"
                            />
                            <span className="text-xs text-slate-500">
                              <Value>{doc.typeName}</Value>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
