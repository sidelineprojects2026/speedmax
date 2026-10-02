/**
 * Segregation of duties — §13.
 *
 * The blueprint states the rule plainly: "No user should approve their own
 * high-risk commercial or financial transaction", with payment verification and
 * payment execution separated where required.
 *
 * That is not a UI convention, so it lives here as a pure function rather than
 * as a disabled button somewhere. Holding the permission is necessary but not
 * sufficient — the approver must also be a different person from the preparer.
 * The database enforces the same rule; this is the half that lets the interface
 * explain *why* an action is unavailable instead of silently hiding it.
 */

export type ApprovalOutcome =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export interface ApprovalRequest {
  /** Who is attempting the approval. */
  readonly actorId: string;
  /** Whether the actor's role grants the approving permission at all. */
  readonly hasPermission: boolean;
  /** Who prepared or submitted the record. Null when unknown. */
  readonly preparedById: string | null;
  /** Human label for the action, used in the refusal message. */
  readonly action: string;
}

/**
 * Whether `actorId` may approve a record prepared by `preparedById`.
 *
 * Fails closed on unknown preparers: if we cannot establish who prepared a
 * financial record, we cannot establish that the approver is someone else, and
 * a control that cannot be evidenced is not a control.
 */
export function canApprove(request: ApprovalRequest): ApprovalOutcome {
  if (!request.hasPermission) {
    return {
      allowed: false,
      reason: `Your role does not permit ${request.action}.`,
    };
  }

  if (request.preparedById === null) {
    return {
      allowed: false,
      reason:
        "The preparer of this record is not recorded, so separation of duties cannot be verified.",
    };
  }

  if (request.preparedById === request.actorId) {
    return {
      allowed: false,
      reason: `You prepared this record. ${capitalise(request.action)} must be carried out by someone else (§13).`,
    };
  }

  return { allowed: true };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Whether a payment may be verified by this actor.
 *
 * §13 separates payment verification from preparation, and §10.1 requires a
 * verified payment before a receipt is acknowledged. Same rule, named
 * separately because the audit trail distinguishes the two actions.
 */
export function canVerifyPayment(
  actorId: string,
  hasPermission: boolean,
  recordedById: string | null,
): ApprovalOutcome {
  return canApprove({
    actorId,
    hasPermission,
    preparedById: recordedById,
    action: "payment verification",
  });
}
