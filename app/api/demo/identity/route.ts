import { NextResponse, type NextRequest } from "next/server";

import { IDENTITY_COOKIE, WORKSPACE_ROLES, type Workspace } from "@/lib/identity";
import { readStore } from "@/lib/store/db";

/**
 * Deep-linkable demo identity.
 *
 * `/api/demo/identity?workspace=finance&as=user-benigno&to=/finance`
 *
 * The sidebar picker is the normal way to switch; this exists so an identity
 * can be linked or bookmarked — useful when showing someone a specific control,
 * such as the invoice Corazon cannot issue but Benigno can.
 *
 * Demo scaffolding, and it must not outlive the stub: once real authentication
 * is wired up this route is deleted, since a GET that changes who you are would
 * otherwise be a session-fixation hole.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const workspace = (params.get("workspace") ?? "") as Workspace;
  const profileId = params.get("as") ?? "";
  const to = params.get("to") ?? `/${workspace}`;

  const allowed = WORKSPACE_ROLES[workspace];
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Unknown workspace "${workspace}".`,
        workspaces: Object.keys(WORKSPACE_ROLES),
      },
      { status: 400 },
    );
  }

  const data = await readStore();
  const candidates = data.profiles.filter(
    (p) => p.isActive && allowed.includes(p.role),
  );
  const profile = candidates.find((p) => p.id === profileId);

  if (!profile) {
    return NextResponse.json(
      {
        error: `"${profileId}" is not a valid identity for the ${workspace} workspace.`,
        available: candidates.map((p) => ({
          id: p.id,
          name: p.fullName,
          role: p.role,
        })),
      },
      { status: 400 },
    );
  }

  // Only ever redirect within this app — an open redirect is trivial to add by
  // accident here and pointless to risk.
  const target = to.startsWith("/") && !to.startsWith("//") ? to : `/${workspace}`;

  const response = NextResponse.redirect(new URL(target, request.nextUrl.origin));
  response.cookies.set(`${IDENTITY_COOKIE}_${workspace}`, profile.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
