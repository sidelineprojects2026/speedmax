/**
 * Shared seed constants.
 *
 * These live in their own module to break a circular import: `seed.ts` pulls in
 * `seed-execution.ts` and `seed-records.ts`, and both of those need the
 * organisation and user ids. Importing them back from `seed.ts` would make the
 * sub-modules evaluate first and read the constants before initialisation — a
 * temporal-dead-zone crash at module load, not a type error, so it would only
 * show up at runtime.
 */

export const ORG = {
  speedmax: "org-speedmax",
  northwind: "org-northwind",
  vertex: "org-vertex",
  luzon: "org-luzon",
  pacificrim: "org-pacificrim",
} as const;

export const USER = {
  // Northwind Trading
  marisol: "user-marisol",
  ferdinand: "user-ferdinand",
  grace: "user-grace",
  roberto: "user-roberto",
  // Pacific Rim Logistics
  joel: "user-joel",
  elena: "user-elena",
  // Speedmax operations
  dante: "user-dante",
  aileen: "user-aileen",
  miguel: "user-miguel",
  // Speedmax finance
  corazon: "user-corazon",
  benigno: "user-benigno",
  ramon: "user-ramon",
  teresita: "user-teresita",
  admin: "user-admin",
} as const;

export const NOW = "2026-09-02T08:00:00Z";

/*
 * There is deliberately no PHP conversion helper here.
 *
 * The peso is the base currency, so a peso amount has no exchange rate to
 * carry — it is already what it converts to. Only genuinely foreign amounts
 * (international carrier invoices, in dollars) get an FX context, and that is
 * built in `./currency`.
 */
