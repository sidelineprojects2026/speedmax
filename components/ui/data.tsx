import { formatMoney, parseMoney } from "@/lib/domain/money";

/**
 * Monetary amount.
 *
 * Takes the decimal string form that Postgres `numeric` returns, parses it into
 * exact minor units, and formats with the currency always shown (§20.1). Never
 * render an amount by interpolating the raw string — that skips both the
 * currency label and the locale grouping.
 */
export function Money({
  amount,
  currency,
  locale = "en-US",
  className = "",
  emphasis = false,
}: {
  amount: string | null | undefined;
  currency: string;
  locale?: string;
  className?: string;
  emphasis?: boolean;
}) {
  if (amount === null || amount === undefined || amount === "") {
    return <span className={`text-slate-400 ${className}`}>—</span>;
  }
  const value = parseMoney(amount, currency);
  return (
    <span
      className={`tnum ${emphasis ? "font-semibold text-slate-900" : ""} ${className}`}
    >
      {formatMoney(value, locale)}
    </span>
  );
}

/** A control number, container, seal or bill reference. */
export function Ref({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`ref ${className}`}>{children}</span>;
}

/** Date, or an em dash when absent. Dates are stored UTC, shown in a zone. */
export function DateText({
  value,
  timeZone,
  locale = "en-US",
  withTime = false,
}: {
  value: string | null | undefined;
  timeZone?: string;
  locale?: string;
  withTime?: boolean;
}) {
  if (!value) return <span className="text-slate-400">—</span>;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return <span className="text-slate-400">—</span>;

  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone,
  }).format(d);

  return <span className="tnum whitespace-nowrap">{formatted}</span>;
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Dense data table.
 *
 * Wrapped in its own horizontal scroll container so a wide manifest never makes
 * the whole page scroll sideways — the portal carries a lot of columns and this
 * is the difference between usable and unusable on a laptop.
 */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-ice-50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase whitespace-nowrap ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : ""
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-150">{children}</tbody>;
}

export function TR({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={`transition-colors hover:bg-ice-50 ${className}`}>
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = "left",
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-3 align-top text-slate-700 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Definition lists — the standard record-detail layout                       */
/* -------------------------------------------------------------------------- */

export function DefinitionList({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}) {
  const cols = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return <dl className={`grid gap-x-8 gap-y-5 ${cols}`}>{children}</dl>;
}

export function Definition({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-full" : ""}>
      <dt className="text-xs font-medium tracking-[0.06em] text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 text-slate-800">{children}</dd>
    </div>
  );
}

/** A value that may be absent, rendered consistently rather than as blank. */
export function Value({ children }: { children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") {
    return <span className="text-slate-400">—</span>;
  }
  return <>{children}</>;
}
