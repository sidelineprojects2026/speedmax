import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Page heading with optional breadcrumb and right-aligned actions. */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumb?: readonly { label: string; href?: string }[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 bg-white px-6 py-6 lg:px-8">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
            {breadcrumb.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    className="size-3.5 text-slate-300"
                    aria-hidden="true"
                  />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="transition-colors hover:text-steel-600"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-700">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-3xl text-slate-600">{description}</p>
          )}
          {meta && <div className="mt-3">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Standard content wrapper — consistent gutters across every portal page. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-6 lg:px-8">{children}</div>;
}

/** A bordered content panel with an optional header row. */
export function Panel({
  title,
  description,
  actions,
  children,
  padded = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-sm border border-slate-200 bg-white">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold tracking-[0.06em] text-slate-800 uppercase">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      {Icon && (
        <Icon className="mx-auto size-8 text-slate-300" aria-hidden={true} />
      )}
      <p className="mt-3 font-medium text-slate-700">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons — links and actions share one visual language                      */
/* -------------------------------------------------------------------------- */

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-navy-900 text-white hover:bg-navy-700`,
  accent: `${buttonBase} bg-beacon-500 text-white hover:bg-beacon-600`,
  secondary: `${buttonBase} border border-slate-300 bg-white text-slate-700 hover:border-slate-400`,
  quiet: `${buttonBase} text-steel-600 hover:bg-ice-50 hover:text-navy-900`,
} as const;
