import Link from "next/link";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { IdentitySwitcher } from "@/components/ui/IdentitySwitcher";
import { getIdentity } from "@/lib/identity";
import { PortalNav, PortalNavCompact } from "@/components/portal/PortalNav";
import { getSession } from "@/lib/portal/session";
import {
  listActionItems,
  listClaims,
  unreadMessageCount,
} from "@/lib/portal/queries";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const identity = await getIdentity("portal");
  const [actions, messages, claims] = await Promise.all([
    listActionItems(),
    unreadMessageCount(),
    listClaims(),
  ]);

  const badges = {
    actions: actions.length,
    messages,
    openClaims: claims.filter((c) => c.status !== "closed").length,
  };

  const initials = session.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="min-h-screen bg-ice-50 lg:grid lg:grid-cols-[260px_1fr]">
      {/* ---- Compact header, below `lg` ---------------------------------- */}
      <div className="bg-navy-900 lg:hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="text-white" aria-label="Speedmax home">
            <Wordmark />
          </Link>
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-steel-500 text-xs font-semibold text-white"
            title={`${session.fullName} · ${session.organizationName}`}
          >
            {initials}
          </span>
        </div>
        <PortalNavCompact badges={badges} />
      </div>

      {/* ------------------------------------------------------------ Sidebar */}
      <aside className="hidden flex-col bg-navy-900 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-white/10 px-5 py-4">
          <Link href="/" className="text-white" aria-label="Speedmax home">
            <Wordmark />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <PortalNav badges={badges} />
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-steel-500 text-sm font-semibold text-white"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {session.fullName}
              </p>
              <p className="truncate text-xs text-steel-400">
                {session.organizationName}
              </p>
            </div>
          </div>
          <div className="mt-3 border-t border-white/10 pt-3">
            <IdentitySwitcher
              workspace="portal"
              current={{
                id: identity.profile.id,
                fullName: identity.profile.fullName,
                jobTitle: identity.profile.jobTitle ?? "",
              }}
              options={identity.options}
            />
          </div>
          <Link
            href="/"
            className="mt-2 flex items-center gap-1.5 px-1 text-xs text-steel-400 transition-colors hover:text-white"
          >
            <ExternalLink className="size-3" aria-hidden="true" />
            Back to speedmax.example
          </Link>
        </div>
      </aside>

      {/* ------------------------------------------------------------ Content */}
      <div className="flex min-w-0 flex-col">
        {session.isDemo && (
          <div
            role="status"
            className="flex items-start gap-2.5 border-b border-tone-warning-br bg-tone-warning-bg px-6 py-2.5 text-sm text-tone-warning-fg"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              <span className="font-semibold">Demo mode.</span> Authentication is
              not enabled — you are signed in as{" "}
              <span className="font-medium">{session.fullName}</span> (
              {session.jobTitle}, {session.organizationName}) against sample
              data. Nothing here is a real shipment.
            </p>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
