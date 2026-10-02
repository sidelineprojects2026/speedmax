import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Upload, TriangleAlert } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState, buttonStyles } from "@/components/ui/layout";
import {
  DateText,
  Ref,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAgentSession } from "@/lib/agent/session";
import { listAgentDocuments } from "@/lib/agent/queries";

export const metadata: Metadata = { title: "Documents" };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AgentDocumentsPage() {
  const session = await getAgentSession();
  const documents = await listAgentDocuments();

  const rejected = documents.filter((d) => d.status === "rejected");

  return (
    <>
      <PageHeader
        title="Documents"
        description="Everything you have uploaded against your assignments, and where Speedmax has got to verifying it."
        actions={
          <button type="button" className={buttonStyles.accent}>
            <Upload className="size-4" aria-hidden="true" />
            Upload document
          </button>
        }
      />

      <PageBody>
        {rejected.length > 0 && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-danger-br bg-tone-danger-bg p-4">
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-danger-fg"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-tone-danger-fg">
                {rejected.length} document{rejected.length === 1 ? "" : "s"}{" "}
                returned for correction
              </h2>
              <ul className="mt-2 space-y-2 text-sm text-tone-danger-fg/90">
                {rejected.map((doc) => (
                  <li key={doc.id}>
                    <span className="font-medium">{doc.name}</span>
                    {doc.rejectionReason && (
                      <span> — {doc.rejectionReason}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <Panel padded={false}>
          {documents.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No documents yet"
              description="Pickup receipts, customs entries, inspection photographs and proof of delivery are uploaded here."
            />
          ) : (
            <Table>
              <THead>
                <TH>Document</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Shipment</TH>
                <TH align="right">Version</TH>
                <TH>Uploaded</TH>
              </THead>
              <TBody>
                {documents.map((doc) => (
                  <TR key={doc.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{doc.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatSize(doc.sizeBytes)}
                      </p>
                    </TD>
                    <TD>{doc.typeName}</TD>
                    <TD>
                      <StatusBadge
                        lifecycle="document"
                        status={doc.status}
                        size="sm"
                      />
                      {doc.rejectionReason && (
                        <p className="mt-1 max-w-xs text-xs text-tone-danger-fg">
                          {doc.rejectionReason}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <Link
                        href={`/agent/shipments`}
                        className="text-steel-600 hover:text-navy-900"
                      >
                        <Ref>{doc.shipmentNumber}</Ref>
                      </Link>
                    </TD>
                    <TD align="right" className="tnum">
                      v{doc.versionNo}
                    </TD>
                    <TD>
                      <DateText
                        value={doc.uploadedAt}
                        timeZone={session.timezone}
                      />
                      <p className="text-xs text-slate-500">
                        {doc.uploadedByName}
                      </p>
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
