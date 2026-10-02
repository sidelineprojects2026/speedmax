"use server";

import { revalidatePath } from "next/cache";

import {
  appendAudit,
  newId,
  nextControlNumber,
  withStore,
} from "@/lib/store/db";

/**
 * Public quote enquiry.
 *
 * The only anonymous write in the application. It creates an enquiry that lands
 * in the operations Control Tower, where a coordinator converts it into a real
 * Shipping Order.
 */

export interface QuoteRequestState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Field-level validation messages, keyed by input name. */
  errors?: Record<string, string>;
  /** Reference returned on success, so the enquirer has something to quote. */
  reference?: string;
}

const REQUIRED: { name: string; label: string }[] = [
  { name: "company", label: "Company" },
  { name: "contact_name", label: "Contact name" },
  { name: "email", label: "Email" },
  { name: "origin", label: "Origin" },
  { name: "destination", label: "Destination" },
  { name: "cargo_description", label: "Cargo description" },
];

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function decimal(form: FormData, key: string, places: number): string | null {
  const raw = str(form, key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(places);
}

function integer(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export async function submitQuoteRequest(
  _prev: QuoteRequestState,
  formData: FormData,
): Promise<QuoteRequestState> {
  // Honeypot. Bots fill hidden fields; humans never see this one.
  if (str(formData, "website")) {
    return { status: "success", reference: "RQ-RECEIVED" };
  }

  const errors: Record<string, string> = {};
  for (const field of REQUIRED) {
    if (!str(formData, field.name)) {
      errors[field.name] = `${field.label} is required.`;
    }
  }

  const email = str(formData, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      errors,
    };
  }

  try {
    const reference = await withStore((data) => {
      const ref = nextControlNumber(data, "enquiry", "RQ");
      const id = newId();

      data.enquiries.unshift({
        id,
        reference: ref,
        company: str(formData, "company"),
        contactName: str(formData, "contact_name"),
        email,
        phone: str(formData, "phone") || null,
        mode: str(formData, "mode") || null,
        priority: str(formData, "priority") || null,
        incoterm: str(formData, "incoterm") || null,
        origin: str(formData, "origin"),
        destination: str(formData, "destination"),
        cargoDescription: str(formData, "cargo_description"),
        grossWeightKg: decimal(formData, "gross_weight_kg", 3),
        volumeCbm: decimal(formData, "volume_cbm", 4),
        packageCount: integer(formData, "package_count"),
        readyDate: str(formData, "ready_date") || null,
        // §7.1 special requirements — these route the enquiry for review (BR-003).
        handlingFlags: formData.getAll("handling").map(String),
        notes: str(formData, "notes") || null,
        isHandled: false,
        handledById: null,
        handledAt: null,
        convertedOrderId: null,
        createdAt: new Date().toISOString(),
      });

      appendAudit(data, {
        actorId: null,
        actorName: `${str(formData, "contact_name")} (${str(formData, "company")})`,
        action: "enquiry.submit",
        entityType: "enquiry",
        entityId: id,
        entityLabel: ref,
      });

      return ref;
    });

    // The new enquiry belongs in the operations queue immediately.
    revalidatePath("/ops");
    revalidatePath("/ops/enquiries");

    return { status: "success", reference };
  } catch {
    return {
      status: "error",
      message:
        "We could not record your request. Please email operations@speedmax.example and we will pick it up directly.",
    };
  }
}
