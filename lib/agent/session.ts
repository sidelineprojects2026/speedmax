import "server-only";

import { getIdentity, roleCan } from "@/lib/identity";
import type { AgentUserRole } from "./types";

/**
 * Agent portal session. Same swap point as the customer portal's.
 */

export interface AgentSession {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly role: AgentUserRole;
  readonly organizationId: string;
  readonly organizationName: string;
  /** Where this partner operates — shown in the shell for orientation. */
  readonly baseLocation: string;
  readonly timezone: string;
  readonly locale: string;
  /** Currency the agent bills Speedmax in. Not the customer's currency. */
  readonly currency: string;
  readonly isDemo: boolean;
}

export async function getAgentSession(): Promise<AgentSession> {
  const { profile, organizationName, organization } = await getIdentityWithOrg();

  return {
    userId: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    jobTitle: profile.jobTitle ?? "",
    role: profile.role as AgentUserRole,
    organizationId: profile.organizationId,
    organizationName,
    baseLocation: organization ?? "—",
    timezone: profile.timezone,
    locale: profile.locale,
    currency: profile.currency,
    isDemo: true,
  };
}

/** Pulls the partner's base location alongside the identity. */
async function getIdentityWithOrg() {
  const { readStore } = await import("@/lib/store/db");
  const identity = await getIdentity("agent");
  const data = await readStore();
  const org = data.organizations.find(
    (o) => o.id === identity.profile.organizationId,
  );
  return { ...identity, organization: org?.baseLocation ?? null };
}

export function agentCan(session: AgentSession, permission: string): boolean {
  return roleCan(session.role, permission);
}
