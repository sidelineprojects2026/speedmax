import "server-only";

import { getIdentity, roleCan } from "@/lib/identity";
import type { UserRole } from "./types";

/**
 * Customer portal session.
 *
 * Backed by the store and a demo identity cookie rather than a hard-coded
 * object. The shape is unchanged, so every page above this keeps working; when
 * Supabase auth arrives, only `lib/identity.ts` changes.
 */

export interface PortalSession {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly role: UserRole;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly timezone: string;
  readonly locale: string;
  /** Base currency for the customer account — drives money formatting. */
  readonly currency: string;
  /** True while authentication is stubbed. Surfaces the demo banner. */
  readonly isDemo: boolean;
}

export async function getSession(): Promise<PortalSession> {
  const { profile, organizationName } = await getIdentity("portal");

  return {
    userId: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    jobTitle: profile.jobTitle ?? "",
    role: profile.role as UserRole,
    organizationId: profile.organizationId,
    organizationName,
    timezone: profile.timezone,
    locale: profile.locale,
    currency: profile.currency,
    isDemo: true,
  };
}

export function can(session: PortalSession, permission: string): boolean {
  return roleCan(session.role, permission);
}
