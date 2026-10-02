import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Upload, Download, TriangleAlert } from "lucide-react";
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
  Value,
} from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/portal/session";
import { listDocuments } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Documents" };

const categoryLabels: Record<string, string> = {
  commercial: "Commercial",
  transport: "Transport",
  customs: "Customs",
  cargo: "Cargo",
  finance: "Finance",
  delivery: "Delivery",
  claim: "Claim",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A document is a concern if it is rejected, expired, or expiring soon. */
function documentConcern(doc: {
  status: string;
  expiryDate: string | null;
}): string | null {
  if (doc.status === "rejected") return "Rejected — a replacement is needed";
  if (doc.status === "expired") return "Expired";
  if (doc.expiryDate) {
    const days = Math.ceil(
      (new Date(doc.expiryDate).getTime() - Date.now()) / 86_400_000,
    );
    if (days < 0) return `Expired ${Math.abs(days)} days ago`;
    if (days <= 30) return `Expires in ${days} days`;
  }
  return null;
}

export default async function DocumentsPage() {
  const session = await getSession();
  const documents = await listDocuments();

  const concerns = documents.filter((d) => documentConcern(d) !== null);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Everything attached to your orders, shipments, invoices and claims. Replaced documents are kept in version history rather than overwritten."
        actions={
          <button type="button" className={buttonStyles.accent}>
            <Upload className="size-4" aria-hidden="true" />
            Upload document
          </button>
        }
      />

      <PageBody>
        {concerns.length > 0 && (
          <div className="mb-6 flex gap-3 rounded-sm border border-tone-warning-br bg-tone-warning-bg p-4">
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0 text-tone-warning-fg"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-tone-warning-fg">
                {concerns.length} document{concerns.length === 1 ? "" : "s"} need
                attention
              </h2>
              <ul className="mt-1.5 space-y-1 text-sm text-tone-warning-fg/90">
                {concerns.map((doc) => (
                  <li key={doc.id}>
                    <span className="font-medium">{doc.name}</span> —{" "}
                    {documentConcern(doc)}
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
              description="Commercial invoices, packing lists, certificates and transport documents appear here."
            />
          ) : (
            <Table>
              <THead>
                <TH>Document</TH>
                <TH>Type</TH>
                <TH>Category</TH>
                <TH>Status</TH>
                <TH>Linked to</TH>
                <TH align="right">Version</TH>
                <TH>Expiry</TH>
                <TH>Uploaded</TH>
                <TH />
              </THead>
              <TBody>
                {documents.map((doc) => {
                  const concern = documentConcern(doc);
                  const linkHref =
                    doc.linkedType === "order"
                      ? `/portal/orders/${doc.linkedId}`
                      : doc.linkedType === "shipment"
                        ? `/portal/shipments/${doc.linkedId}`
                        : doc.linkedType === "invoice"
                          ? `/portal/invoices/${doc.linkedId}`
                          : `/portal/claims`;

                  return (
                    <TR key={doc.id}>
                      <TD>
                        <p className="font-medium text-slate-900">{doc.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatSize(doc.sizeBytes)}
                        </p>
                      </TD>
                      <TD>{doc.typeName}</TD>
                      <TD>{categoryLabels[doc.category] ?? doc.category}</TD>
                      <TD>
                        <StatusBadge
                          lifecycle="document"
                          status={doc.status}
                          size="sm"
                        />
                        {concern && (
                          <p className="mt-1 text-xs text-tone-warning-fg">
                            {concern}
                          </p>
                        )}
                      </TD>
                      <TD>
                        <Link
                          href={linkHref}
                          className="text-steel-600 hover:text-navy-900"
                        >
                          <Ref>{doc.linkedLabel}</Ref>
                        </Link>
                      </TD>
                      <TD align="right" className="tnum">
                        v{doc.versionNo}
                      </TD>
                      <TD>
                        <DateText
                          value={doc.expiryDate}
                          timeZone={session.timezone}
                        />
                      </TD>
                      <TD>
                        <DateText
                          value={doc.uploadedAt}
                          timeZone={session.timezone}
                        />
                        <p className="text-xs text-slate-500">
                          <Value>{doc.uploadedByName}</Value>
                        </p>
                      </TD>
                      <TD align="right">
                        <button
                          type="button"
                          className="text-slate-400 transition-colors hover:text-steel-600"
                          aria-label={`Download ${doc.name}`}
                          title="Download"
                        >
                          <Download className="size-4" aria-hidden="true" />
                        </button>
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
