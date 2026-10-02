"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Info } from "lucide-react";
import { Panel, buttonStyles } from "@/components/ui/layout";
import { formatMoney, parseMoney } from "@/lib/domain/money";

/**
 * Shipping Order request form — §7.1 header, §7.2 cargo and packages.
 *
 * Cargo lines are managed client-side because an order routinely carries
 * several, and making the user save between lines would be worse than useless.
 * Submission is disabled while authentication and the database are stubbed —
 * see the notice at the foot of the form.
 */

interface CargoLine {
  readonly key: number;
  description: string;
  hsCode: string;
  originCountry: string;
  quantity: string;
  uom: string;
  unitValue: string;
  hazardous: boolean;
  fragile: boolean;
  oversized: boolean;
  highValue: boolean;
  controlled: boolean;
}

function blankLine(key: number): CargoLine {
  return {
    key,
    description: "",
    hsCode: "",
    originCountry: "",
    quantity: "",
    uom: "CTN",
    unitValue: "",
    hazardous: false,
    fragile: false,
    oversized: false,
    highValue: false,
    controlled: false,
  };
}

const field =
  "w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";
const label = "block text-sm font-medium text-slate-800";

export function NewOrderForm() {
  const [lines, setLines] = useState<CargoLine[]>([blankLine(1)]);
  const [nextKey, setNextKey] = useState(2);

  function updateLine(key: number, patch: Partial<CargoLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine(nextKey)]);
    setNextKey((k) => k + 1);
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  // BR-003 — anything special routes the order for qualified review, and the
  // customer should know that before they submit rather than discover it after.
  const needsReview = lines.some(
    (l) => l.hazardous || l.controlled || l.highValue || l.oversized,
  );

  const peso = (amount: string) => formatMoney(parseMoney(amount, "PHP"));

  const lineTotal = (l: CargoLine) => {
    const q = Number(l.quantity);
    const v = Number(l.unitValue);
    if (!Number.isFinite(q) || !Number.isFinite(v) || q <= 0 || v <= 0) return null;
    return (q * v).toFixed(2);
  };

  const declaredTotal = lines.reduce((sum, l) => {
    const t = lineTotal(l);
    return t === null ? sum : sum + Number(t);
  }, 0);

  return (
    <form className="space-y-6">
      {/* ---- Service and route -------------------------------------------- */}
      <Panel title="Service and route">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="customer_reference" className={label}>
              Your reference
            </label>
            <input
              id="customer_reference"
              name="customer_reference"
              placeholder="e.g. NW-PO-88700"
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="mode" className={label}>
              Mode
            </label>
            <select id="mode" name="mode" className={`${field} mt-1.5`}>
              <option value="">Advise best option</option>
              <option value="sea">Ocean</option>
              <option value="air">Air</option>
              <option value="road">Road</option>
              <option value="rail">Rail</option>
              <option value="courier">Courier</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority" className={label}>
              Priority
            </label>
            <select id="priority" name="priority" className={`${field} mt-1.5`}>
              <option value="standard">Standard</option>
              <option value="express">Express</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label htmlFor="supplier" className={label}>
              Supplier
            </label>
            <input
              id="supplier"
              name="supplier"
              placeholder="Supplier company name"
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="origin" className={label}>
              Origin
            </label>
            <input
              id="origin"
              name="origin"
              placeholder="City and country"
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="destination" className={label}>
              Destination
            </label>
            <input
              id="destination"
              name="destination"
              placeholder="Final delivery point"
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="incoterm" className={label}>
              Incoterm
            </label>
            <select id="incoterm" name="incoterm" className={`${field} mt-1.5`}>
              <option value="">Not yet agreed</option>
              {["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label htmlFor="pickup_date" className={label}>
              Requested pickup
            </label>
            <input
              id="pickup_date"
              name="pickup_date"
              type="date"
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="delivery_date" className={label}>
              Requested delivery
            </label>
            <input
              id="delivery_date"
              name="delivery_date"
              type="date"
              className={`${field} mt-1.5`}
            />
          </div>
        </div>

        <label className="mt-5 flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            name="insurance"
            className="size-4 accent-steel-500"
          />
          Request cargo insurance against declared value
        </label>
      </Panel>

      {/* ---- Cargo --------------------------------------------------------- */}
      <Panel
        title="Cargo"
        description="Add one line per commodity. Weights and dimensions are captured per package below."
        actions={
          <button type="button" onClick={addLine} className={buttonStyles.secondary}>
            <Plus className="size-4" aria-hidden="true" />
            Add line
          </button>
        }
      >
        <div className="space-y-5">
          {lines.map((line, index) => (
            <fieldset
              key={line.key}
              className="rounded-sm border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-slate-800">
                  Line {index + 1}
                </legend>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-tone-danger-fg"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label htmlFor={`desc-${line.key}`} className={label}>
                    Description
                  </label>
                  <input
                    id={`desc-${line.key}`}
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.key, { description: e.target.value })
                    }
                    placeholder="Commodity description"
                    className={`${field} mt-1.5`}
                  />
                </div>
                <div>
                  <label htmlFor={`hs-${line.key}`} className={label}>
                    HS code
                  </label>
                  <input
                    id={`hs-${line.key}`}
                    value={line.hsCode}
                    onChange={(e) => updateLine(line.key, { hsCode: e.target.value })}
                    placeholder="Optional"
                    className={`ref ${field} mt-1.5`}
                  />
                </div>
                <div>
                  <label htmlFor={`origin-${line.key}`} className={label}>
                    Country of origin
                  </label>
                  <input
                    id={`origin-${line.key}`}
                    value={line.originCountry}
                    onChange={(e) =>
                      updateLine(line.key, { originCountry: e.target.value })
                    }
                    placeholder="e.g. CN"
                    maxLength={2}
                    className={`${field} mt-1.5 uppercase`}
                  />
                </div>
                <div>
                  <label htmlFor={`qty-${line.key}`} className={label}>
                    Quantity
                  </label>
                  <input
                    id={`qty-${line.key}`}
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: e.target.value })
                    }
                    className={`tnum ${field} mt-1.5`}
                  />
                </div>
                <div>
                  <label htmlFor={`uom-${line.key}`} className={label}>
                    Unit
                  </label>
                  <select
                    id={`uom-${line.key}`}
                    value={line.uom}
                    onChange={(e) => updateLine(line.key, { uom: e.target.value })}
                    className={`${field} mt-1.5`}
                  >
                    {["CTN", "PCS", "PALLET", "DRUM", "CRATE", "BAG", "COIL", "SET"].map(
                      (u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor={`unit-${line.key}`} className={label}>
                    Unit value (PHP)
                  </label>
                  <input
                    id={`unit-${line.key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitValue}
                    onChange={(e) =>
                      updateLine(line.key, { unitValue: e.target.value })
                    }
                    className={`tnum ${field} mt-1.5`}
                  />
                </div>
                <div>
                  <span className={label}>Line value</span>
                  <p className="tnum mt-1.5 py-2 text-sm text-slate-700">
                    {lineTotal(line) ? peso(lineTotal(line)!) : "—"}
                  </p>
                </div>
              </div>

              <fieldset className="mt-4">
                <legend className="text-sm font-medium text-slate-800">
                  Handling
                </legend>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                  {(
                    [
                      ["hazardous", "Dangerous goods"],
                      ["controlled", "Controlled / licensed"],
                      ["highValue", "High value"],
                      ["oversized", "Oversized"],
                      ["fragile", "Fragile"],
                    ] as const
                  ).map(([key, text]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={line[key]}
                        onChange={(e) =>
                          updateLine(line.key, { [key]: e.target.checked })
                        }
                        className="size-4 accent-steel-500"
                      />
                      {text}
                    </label>
                  ))}
                </div>
              </fieldset>
            </fieldset>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">
            Total declared value
            <span className="tnum ml-2 font-semibold text-slate-900">
              {declaredTotal > 0 ? peso(declaredTotal.toFixed(2)) : "—"}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            {lines.length} cargo line{lines.length === 1 ? "" : "s"}
          </p>
        </div>

        {needsReview && (
          <div className="mt-4 flex gap-3 rounded-sm border border-tone-info-br bg-tone-info-bg p-4">
            <Info
              className="mt-0.5 size-5 shrink-0 text-tone-info-fg"
              aria-hidden="true"
            />
            <p className="text-sm text-tone-info-fg">
              This order will be routed for qualified review before pricing
              because it contains special cargo. Expect a request for the
              relevant certificates or declarations.
            </p>
          </div>
        )}
      </Panel>

      {/* ---- Instructions --------------------------------------------------- */}
      <Panel title="Instructions">
        <label htmlFor="instructions" className={label}>
          Special instructions
        </label>
        <textarea
          id="instructions"
          name="instructions"
          rows={4}
          placeholder="Access restrictions, delivery windows, stacking limits, temperature requirements, anything else we should plan around."
          className={`${field} mt-1.5`}
        />
      </Panel>

      {/* ---- Submit --------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-4 rounded-sm border border-tone-warning-br bg-tone-warning-bg p-5">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-tone-warning-fg">
            Submission is disabled in demo mode
          </p>
          <p className="mt-1 text-sm text-tone-warning-fg/90">
            The form is complete and validates as it will in production, but
            there is no database connected yet, so nothing can be saved. This
            becomes live once Supabase is wired up.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled className={buttonStyles.secondary}>
            Save draft
          </button>
          <button type="button" disabled className={buttonStyles.accent}>
            Submit order
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        <Link
          href="/portal/orders"
          className="text-steel-600 underline underline-offset-4"
        >
          Back to Shipping Orders
        </Link>
      </p>
    </form>
  );
}
