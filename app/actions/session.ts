"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { IDENTITY_COOKIE, WORKSPACE_ROLES, type Workspace } from "@/lib/identity";
import { readStore, resetStore } from "@/lib/store/db";

/**
 * Demo session controls.
 *
 * Switching identity is what makes separation of duties observable: the same
 * invoice that Corazon cannot issue becomes issuable as Ramon, and the block is
 * visibly about who you are rather than a permanently dead button.
 */

export async function switchIdentity(
  workspace: Workspace,
  profileId: string,
): Promise<void> {
  const data = await readStore();
  const allowed = WORKSPACE_ROLES[workspace] ?? [];

  // Only accept a profile that genuinely belongs to this workspace. Trusting
  // the posted id would let a customer identity be set on the finance
  // workspace, which is a permission boundary, not a display preference.
  const profile = data.profiles.find(
    (p) => p.id === profileId && p.isActive && allowed.includes(p.role),
  );
  if (!profile) {
    throw new Error(`${profileId} is not a valid identity for ${workspace}.`);
  }

  const store = await cookies();
  store.set(`${IDENTITY_COOKIE}_${workspace}`, profileId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
}

/** Discard every change and re-seed. One click back to a known-good demo. */
export async function resetDemoData(): Promise<void> {
  await resetStore();
  revalidatePath("/", "layout");
}
