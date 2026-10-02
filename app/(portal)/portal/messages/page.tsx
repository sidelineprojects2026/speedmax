import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Paperclip, Send } from "lucide-react";
import { PageBody, PageHeader, Panel, EmptyState, buttonStyles } from "@/components/ui/layout";
import { DateText, Ref } from "@/components/ui/data";
import { getSession } from "@/lib/portal/session";
import { listThreads } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await getSession();
  const threads = await listThreads();

  return (
    <>
      <PageHeader
        title="Messages"
        description="Correspondence tied to a specific order, shipment, invoice or claim — so context travels with the conversation rather than living in someone's inbox."
      />

      <PageBody>
        {threads.length === 0 ? (
          <Panel padded={false}>
            <EmptyState
              icon={MessagesSquare}
              title="No messages"
              description="Messages raised against your records appear here."
            />
          </Panel>
        ) : (
          <div className="space-y-6">
            {threads.map((thread) => {
              const linkHref =
                thread.linkedType === "order"
                  ? "/portal/orders"
                  : thread.linkedType === "shipment"
                    ? "/portal/shipments"
                    : thread.linkedType === "invoice"
                      ? "/portal/invoices"
                      : "/portal/claims";

              return (
                <Panel
                  key={thread.id}
                  title={
                    <span className="flex flex-wrap items-center gap-3 normal-case">
                      <span className="text-base font-semibold tracking-normal text-slate-900">
                        {thread.subject}
                      </span>
                      {thread.unreadCount > 0 && (
                        <span className="rounded-full bg-beacon-500 px-2 py-0.5 text-[11px] font-semibold tracking-normal text-white">
                          {thread.unreadCount} new
                        </span>
                      )}
                    </span>
                  }
                  description={
                    <>
                      <Link
                        href={linkHref}
                        className="text-steel-600 underline underline-offset-4"
                      >
                        <Ref>{thread.linkedLabel}</Ref>
                      </Link>
                      {" · last activity "}
                      <DateText
                        value={thread.lastMessageAt}
                        timeZone={session.timezone}
                        withTime
                      />
                    </>
                  }
                >
                  <ol className="space-y-5">
                    {thread.messages.map((message) => {
                      const mine = message.authorSide === "customer";
                      return (
                        <li
                          key={message.id}
                          className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              mine
                                ? "bg-steel-500 text-white"
                                : "bg-navy-900 text-white"
                            }`}
                          >
                            {message.authorName
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")}
                          </span>

                          <div
                            className={`min-w-0 max-w-2xl rounded-sm border px-4 py-3 ${
                              mine
                                ? "border-steel-200 bg-ice-50"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div
                              className={`flex flex-wrap items-baseline gap-x-3 ${
                                mine ? "justify-end" : ""
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                {message.authorName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {mine ? "Your company" : "Speedmax"} ·{" "}
                                <DateText
                                  value={message.sentAt}
                                  timeZone={session.timezone}
                                  withTime
                                />
                              </p>
                            </div>
                            <p
                              className={`mt-2 text-sm leading-relaxed text-slate-700 ${
                                mine ? "text-right" : ""
                              }`}
                            >
                              {message.body}
                            </p>
                            {message.attachmentNames.length > 0 && (
                              <ul
                                className={`mt-3 space-y-1 ${mine ? "text-right" : ""}`}
                              >
                                {message.attachmentNames.map((name) => (
                                  <li
                                    key={name}
                                    className="inline-flex items-center gap-1.5 text-xs text-steel-600"
                                  >
                                    <Paperclip
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                    {name}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <label
                      htmlFor={`reply-${thread.id}`}
                      className="block text-sm font-medium text-slate-800"
                    >
                      Reply
                    </label>
                    <textarea
                      id={`reply-${thread.id}`}
                      rows={3}
                      placeholder="Type your reply…"
                      className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
                    />
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <p className="text-xs text-slate-500">
                        Sending is disabled in demo mode.
                      </p>
                      <button type="button" disabled className={buttonStyles.accent}>
                        <Send className="size-4" aria-hidden="true" />
                        Send reply
                      </button>
                    </div>
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
