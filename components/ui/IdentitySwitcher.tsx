"use client";

import { useState, useTransition } from "react";
import { ChevronDown, RotateCcw, Check } from "lucide-react";
import { resetDemoData, switchIdentity } from "@/app/actions/session";
import type { Workspace } from "@/lib/identity";

/**
 * Demo identity picker, shown in each workspace's footer.
 *
 * More than a convenience. Several controls in this system are gated on *who*
 * you are rather than what your role is — issuing an invoice you prepared,
 * approving a vendor bill you entered — and there is no way to see that working
 * without being able to become someone else.
 */

export interface IdentityOption {
  id: string;
  fullName: string;
  jobTitle: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  customer_requestor: "Requestor",
  customer_approver: "Approver",
  customer_finance: "Finance",
  agent_operator: "Operator",
  agent_manager: "Manager",
  ops_coordinator: "Coordinator",
  pricing_officer: "Pricing",
  billing_officer: "Billing",
  collection_officer: "Collections",
  accounts_payable: "Payables",
  finance_approver: "Approver",
  finance_manager: "Finance manager",
  admin: "Administrator",
};

export function IdentitySwitcher({
  workspace,
  current,
  options,
}: {
  workspace: Workspace;
  current: { id: string; fullName: string; jobTitle: string };
  options: IdentityOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(id: string) {
    setOpen(false);
    startTransition(async () => {
      await switchIdentity(workspace, id);
    });
  }

  function reset() {
    setOpen(false);
    startTransition(async () => {
      await resetDemoData();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={pending}
        className="flex w-full items-center gap-2 rounded-sm px-1 py-1 text-xs text-steel-400 transition-colors hover:text-white disabled:opacity-60"
      >
        <span className="flex-1 text-left">
          {pending ? "Switching…" : "Switch demo identity"}
        </span>
        <ChevronDown
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl"
        >
          <p className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            Sign in as
          </p>
          <ul className="max-h-72 overflow-y-auto py-1">
            {options.map((option) => {
              const active = option.id === current.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => choose(option.id)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-ice-50 ${
                      active ? "bg-ice-50" : ""
                    }`}
                  >
                    <span className="mt-0.5 w-4 shrink-0">
                      {active && (
                        <Check
                          className="size-3.5 text-tone-success-fg"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {option.fullName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {option.jobTitle}
                        {ROLE_LABELS[option.role]
                          ? ` · ${ROLE_LABELS[option.role]}`
                          : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-slate-200 p-2">
            <button
              type="button"
              role="menuitem"
              onClick={reset}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-ice-50 hover:text-tone-danger-fg"
            >
              <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Reset demo data
                <span className="block text-[11px] text-slate-400">
                  Discards every change and re-seeds
                </span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
