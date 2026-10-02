import { statusLabel, statusTone, type LifecycleKey, type StatusTone } from "@/lib/domain/status";

/**
 * The only way a status is rendered anywhere in the application.
 *
 * Colour comes from the status registry via a semantic tone, never from the
 * call site. Adding a status to lib/domain/status.ts is therefore enough to
 * make it render correctly everywhere, and no screen can invent its own
 * colour for "overdue".
 */

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-tone-neutral-bg text-tone-neutral-fg border-tone-neutral-br",
  info: "bg-tone-info-bg text-tone-info-fg border-tone-info-br",
  progress: "bg-tone-progress-bg text-tone-progress-fg border-tone-progress-br",
  success: "bg-tone-success-bg text-tone-success-fg border-tone-success-br",
  warning: "bg-tone-warning-bg text-tone-warning-fg border-tone-warning-br",
  danger: "bg-tone-danger-bg text-tone-danger-fg border-tone-danger-br",
};

export function StatusBadge({
  lifecycle,
  status,
  size = "md",
}: {
  lifecycle: LifecycleKey;
  status: string;
  size?: "sm" | "md";
}) {
  const tone = statusTone(lifecycle, status);
  const label = statusLabel(lifecycle, status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap ${
        toneClasses[tone]
      } ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current opacity-70"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
