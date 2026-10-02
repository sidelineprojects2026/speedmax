import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { STORE_VERSION, type AuditEntry, type StoreData } from "./schema";
import { buildSeed } from "./seed";

/**
 * File-backed store, standing in for Supabase.
 *
 * Substitute data, but not fake behaviour: writes persist to disk, survive a
 * dev-server restart, and every mutation is audited. The three portals read
 * projections of this one dataset, so an agent posting a milestone genuinely
 * moves the customer's timeline.
 *
 * Two properties matter and are easy to get wrong:
 *
 *  - **Writes are serialised.** Server actions can overlap, and a read-modify-
 *    write pair that interleaves silently loses one of the updates. Every
 *    mutation is queued behind the last, so the sequence is total.
 *
 *  - **Reads are not cached across requests.** Holding the parsed object in a
 *    module variable would serve stale data to the next request after a write
 *    from another worker. The file is small; re-reading it is cheap and correct.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "speedmax.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

async function ensureDirs(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function writeFileAtomic(data: StoreData): Promise<void> {
  await ensureDirs();
  // Write to a temp file and rename: a crash mid-write must not leave a
  // truncated JSON file that fails to parse on next boot.
  //
  // The temp name must be unique per write, not per process. Two concurrent
  // writes sharing one temp path race: the first rename moves the file away and
  // the second fails with ENOENT.
  const tmp = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

/**
 * In-flight seed, so concurrent first-reads produce one write rather than a
 * stampede. Next renders several server components per request, and every one
 * of them calls into the store.
 */
let seeding: Promise<StoreData> | null = null;

async function seedOnce(): Promise<StoreData> {
  if (!seeding) {
    seeding = (async () => {
      const fresh = buildSeed();
      await writeFileAtomic(fresh);
      return fresh;
    })().finally(() => {
      seeding = null;
    });
  }
  return seeding;
}

async function readOrSeed(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    // A schema change makes an old file unreadable in ways that surface as
    // confusing UI bugs. Re-seeding is the honest response for demo data.
    if (parsed.version !== STORE_VERSION) return seedOnce();
    return parsed;
  } catch (error) {
    const missing =
      (error as NodeJS.ErrnoException)?.code === "ENOENT" ||
      error instanceof SyntaxError;
    if (!missing) throw error;
    return seedOnce();
  }
}

/** Tail of the write queue. Each mutation chains onto the previous one. */
let writeChain: Promise<unknown> = Promise.resolve();

/** Read the whole store. Callers must not mutate the result. */
export async function readStore(): Promise<StoreData> {
  return readOrSeed();
}

/**
 * Apply a mutation under the write lock.
 *
 * `mutate` receives the live object and may modify it in place; whatever it
 * returns is handed back to the caller once the write has landed.
 */
export async function withStore<T>(
  mutate: (data: StoreData) => T | Promise<T>,
): Promise<T> {
  const run = async (): Promise<T> => {
    const data = await readOrSeed();
    const result = await mutate(data);
    await writeFileAtomic(data);
    return result;
  };

  // Chain regardless of whether the previous write succeeded, or one failure
  // would wedge the queue for the life of the process.
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => undefined);
  return next;
}

/** Discard all changes and re-seed. Backs the "Reset demo data" control. */
export async function resetStore(): Promise<void> {
  const fresh = buildSeed();
  await writeFileAtomic(fresh);
  // Uploaded files belong to records that no longer exist.
  await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/* -------------------------------------------------------------------------- */
/* Identifiers and control numbers — §14.2                                    */
/* -------------------------------------------------------------------------- */

export function newId(): string {
  return randomUUID();
}

/**
 * Human-readable control number, `PREFIX-YYYY-NNNNNN`.
 *
 * Kept separate from the stable id, per §14.2. Must be called inside
 * `withStore` so the counter increment is part of the same serialised write —
 * generating one outside the lock is how duplicate numbers appear.
 */
export function nextControlNumber(
  data: StoreData,
  key: string,
  prefix: string,
): string {
  const current = data.counters[key] ?? 1000;
  const next = current + 1;
  data.counters[key] = next;
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String(next).padStart(6, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Audit — §17.2                                                              */
/* -------------------------------------------------------------------------- */

export interface AuditInput {
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Actions that cannot be recorded without a reason (§17.2).
 *
 * Enforced here rather than at each call site, because the one that forgets is
 * the one that matters.
 */
const REASON_REQUIRED = [
  "reject",
  "override",
  "reverse",
  "credit",
  "cancel",
  "reopen",
  "return",
  "correct",
  "decline",
];

export function appendAudit(data: StoreData, input: AuditInput): AuditEntry {
  const needsReason = REASON_REQUIRED.some((verb) =>
    input.action.toLowerCase().includes(verb),
  );

  if (needsReason && !input.reason?.trim()) {
    throw new Error(
      `Action "${input.action}" requires a recorded reason (§17.2).`,
    );
  }

  const entry: AuditEntry = {
    id: newId(),
    actorId: input.actorId,
    actorName: input.actorName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    occurredAt: new Date().toISOString(),
    reason: input.reason?.trim() || null,
    before: input.before ?? null,
    after: input.after ?? null,
  };

  data.audit.unshift(entry);
  return entry;
}

/* -------------------------------------------------------------------------- */
/* Uploads                                                                    */
/* -------------------------------------------------------------------------- */

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-excel",
]);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export interface StoredUpload {
  storedPath: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Persist an uploaded file.
 *
 * §11.2 requires allowed-type restriction and size limits. Real malware
 * scanning is out of scope here, but the type and size gates are not — they are
 * the checks that stop a demo becoming an arbitrary file drop.
 */
export async function saveUpload(file: File): Promise<StoredUpload> {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`,
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(
      `File type "${file.type || "unknown"}" is not accepted. Allowed: PDF, images, CSV, text, Office documents and ZIP.`,
    );
  }

  await ensureDirs();
  const id = newId();
  const ext = path.extname(file.name).slice(0, 12);
  const stored = `${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, stored), buffer);

  return {
    storedPath: stored,
    // Strip any directory components a client might have sent.
    fileName: path.basename(file.name),
    sizeBytes: file.size,
    mimeType: file.type,
  };
}

export async function readUpload(storedPath: string): Promise<Buffer> {
  // Refuse anything that tries to escape the upload directory.
  const safe = path.basename(storedPath);
  return fs.readFile(path.join(UPLOAD_DIR, safe));
}
