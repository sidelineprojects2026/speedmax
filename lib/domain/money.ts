/**
 * Money — exact decimal arithmetic in integer minor units.
 *
 * §14.2 requires decimal types for money. Postgres `numeric` gives us that at
 * rest, but JavaScript numbers do not: 0.1 + 0.2 !== 0.3, and a freight invoice
 * built from twenty charge lines will visibly drift. So every amount is carried
 * here as an integer count of minor units (cents, fils, etc.) and only rendered
 * as a decimal string at the edge.
 *
 * Amounts arrive from Postgres as strings — supabase-js does not coerce
 * `numeric` to a JS number, precisely to avoid this class of bug — so `parse`
 * takes the string form directly.
 */

/** Minor-unit digits per currency. ISO 4217 exponent. */
const MINOR_UNITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
};

const DEFAULT_MINOR_UNITS = 2;

export function minorUnitsFor(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? DEFAULT_MINOR_UNITS;
}

/** An exact monetary amount. `units` is an integer count of minor units. */
export interface Money {
  readonly units: number;
  readonly currency: string;
}

export function money(units: number, currency: string): Money {
  if (!Number.isInteger(units)) {
    throw new Error(`Money units must be an integer, received ${units}`);
  }
  return { units, currency: currency.toUpperCase() };
}

export function zero(currency: string): Money {
  return money(0, currency);
}

/**
 * Parse a decimal string (as returned by Postgres `numeric`) into Money.
 * Rounds half-away-from-zero at the currency's minor unit.
 */
export function parseMoney(value: string | number, currency: string): Money {
  const exp = minorUnitsFor(currency);
  const raw = typeof value === "number" ? value.toString() : value.trim();

  if (raw === "" || raw === null) return zero(currency);

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match) throw new Error(`Cannot parse "${raw}" as a monetary amount`);

  const [, sign, whole = "0", frac = ""] = match;
  const padded = (frac + "0".repeat(exp + 1)).slice(0, exp + 1);
  const truncated = padded.slice(0, exp);
  const nextDigit = Number(padded[exp] ?? "0");

  let units = Number((whole || "0") + truncated);
  if (nextDigit >= 5) units += 1;
  if (sign === "-") units = -units;

  return money(units, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: cannot combine ${a.currency} with ${b.currency}. ` +
        `Convert through an explicit exchange rate first (§10.3).`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.units + b.units, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.units - b.units, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.units, a.currency);
}

export function sum(amounts: readonly Money[], currency: string): Money {
  return amounts.reduce((acc, m) => add(acc, m), zero(currency));
}

/** Multiply by a quantity or rate. Rounds half-away-from-zero. */
export function multiply(a: Money, factor: number): Money {
  const exact = a.units * factor;
  const rounded =
    exact < 0 ? -Math.round(-exact) : Math.round(exact);
  return money(rounded, a.currency);
}

export function isZero(a: Money): boolean {
  return a.units === 0;
}

export function isNegative(a: Money): boolean {
  return a.units < 0;
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.units - b.units;
}

/** Decimal string, suitable for writing back to a Postgres `numeric`. */
export function toDecimalString(a: Money): string {
  const exp = minorUnitsFor(a.currency);
  const sign = a.units < 0 ? "-" : "";
  const abs = Math.abs(a.units).toString().padStart(exp + 1, "0");
  if (exp === 0) return sign + abs;
  const whole = abs.slice(0, -exp);
  const frac = abs.slice(-exp);
  return `${sign}${whole}.${frac}`;
}

/**
 * Localised display string. Currency is always shown — §20.1 requires financial
 * totals to identify their currency, and a bare number in a multi-currency
 * ledger is ambiguous at best.
 */
/**
 * Format a decimal-string amount for display.
 *
 * The same thing as `formatMoney(parseMoney(...))`, given a name because
 * status and alert text needs it constantly, and hand-writing
 * `${currency} ${amount}` there is how "PHP 514755.00" ends up on a page
 * beside a column of properly formatted pesos.
 */
export function formatAmount(
  amount: string,
  currency: string,
  locale = "en-US",
): string {
  return formatMoney(parseMoney(amount, currency), locale);
}

export function formatMoney(a: Money, locale = "en-US"): string {
  const exp = minorUnitsFor(a.currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: a.currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(a.units / 10 ** exp);
  } catch {
    // Unknown or non-ISO currency code — fall back to a plain, labelled figure.
    return `${a.currency} ${toDecimalString(a)}`;
  }
}

/* -------------------------------------------------------------------------- */
/* Exchange — §14.2, BR-028                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Convert between currencies at an explicit rate.
 *
 * BR-028 requires transactions to retain transaction currency, reference rate,
 * applied rate, base-currency amount, and rate source/date. This function
 * performs only the arithmetic; the caller is responsible for persisting the
 * rate and its provenance alongside the result. Conversion is never implicit.
 */
export function convert(a: Money, rate: number, toCurrency: string): Money {
  if (!(rate > 0)) {
    throw new Error(`Exchange rate must be positive, received ${rate}`);
  }
  const fromExp = minorUnitsFor(a.currency);
  const toExp = minorUnitsFor(toCurrency);
  const majorValue = (a.units / 10 ** fromExp) * rate;
  const targetUnits = majorValue * 10 ** toExp;
  const rounded =
    targetUnits < 0 ? -Math.round(-targetUnits) : Math.round(targetUnits);
  return money(rounded, toCurrency);
}
