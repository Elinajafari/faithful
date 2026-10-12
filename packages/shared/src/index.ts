/**
 * Types and pure rules shared by the Faithful contract (packages/contracts/faithful.py)
 * and any client that reads it: a script, a bot, another app.
 *
 * Two kinds of thing live here:
 *
 *   1. The SHAPE of what the contract's views return, with a parser that
 *      refuses anything else. The fee comes back as a decimal string and is
 *      parsed to bigint, because it can exceed what a number holds.
 *      genlayer-js 1.1.8 returns plain objects; older builds returned Map, so
 *      the parser accepts both.
 *
 *   2. A PORT of the contract's deterministic rules: how caller text is
 *      cleaned, how a model's answer is read back through the order it was
 *      asked in, how the two orders fold into one ruling, and what a ruling on
 *      a given try does. A port that disagrees with the contract is worse than
 *      none, so it is tested against faithful-vectors.json, which is generated
 *      FROM the contract's own functions and read by its Python tests too.
 */

// ---------------------------------------------------------------- tokens

export const FAITHFUL = "faithful" as const;
export const UNFAITHFUL = "unfaithful" as const;
export const RULINGS = ["", FAITHFUL, UNFAITHFUL] as const;
export type Ruling = (typeof RULINGS)[number];
export const STATUSES = ["open", "claimed", "paid", "refunded"] as const;
export type Status = (typeof STATUSES)[number];
export const PAYEES = ["", "translator", "client"] as const;
export type Payee = (typeof PAYEES)[number];

/** The order the options are asked in first, and then reversed. */
export const FORWARD = [FAITHFUL, UNFAITHFUL] as const;
export const REVERSED = [UNFAITHFUL, FAITHFUL] as const;

export const EXPECTED = "[EXPECTED]";
export const MIN_TITLE = 2;
export const MAX_TITLE = 120;
export const MIN_SOURCE = 20;
export const MAX_SOURCE = 2000;
export const MIN_LANGUAGE = 2;
export const MAX_LANGUAGE = 40;
export const MIN_TRANSLATION = 10;
export const MAX_TRANSLATION = 4000;
export const MAX_ATTEMPTS = 2;
export const MIN_WINDOW = 60;
export const MAX_WINDOW = 60 * 86400;
export const MAX_FEE = 10n ** 30n;

// ---------------------------------------------------------------- shapes

export interface Job {
  id: number;
  title: string;
  source: string;
  source_lang: string;
  target_lang: string;
  client: string;
  /** "" until claimed */
  translator: string;
  fee: bigint;
  status: Status;
  posted_at: string;
  deadline: string;
  claimed_at: string;
  attempts: number;
  draft_1: string;
  ruling_1: Ruling;
  draft_2: string;
  ruling_2: Ruling;
  /** leader-supplied and NOT part of consensus */
  why: string;
  reason_is_leader_supplied: boolean;
  settled_at: string;
  paid_to: Payee;
}

type Raw = Record<string, unknown>;

function record(v: unknown): Raw | null {
  if (v instanceof Map) return Object.fromEntries(v.entries()) as Raw;
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Raw;
  return null;
}

function num(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`expected a number, got ${String(v)}`);
  return n;
}

function str(v: unknown): string {
  if (typeof v !== "string") throw new Error(`expected a string, got ${typeof v}`);
  return v;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  const s = str(v);
  if (!(allowed as readonly string[]).includes(s)) throw new Error(`unexpected ${what}: ${s}`);
  return s as T;
}

export function parseJob(v: unknown): Job {
  const r = record(v);
  if (!r) throw new Error("job is not an object");
  const fee = str(r.fee);
  if (!/^[0-9]+$/.test(fee)) throw new Error(`expected an amount of wei, got ${fee}`);
  const job: Job = {
    id: num(r.id), title: str(r.title), source: str(r.source), source_lang: str(r.source_lang),
    target_lang: str(r.target_lang), client: str(r.client), translator: str(r.translator), fee: BigInt(fee),
    status: oneOf(r.status, STATUSES, "status"), posted_at: str(r.posted_at), deadline: str(r.deadline),
    claimed_at: str(r.claimed_at), attempts: num(r.attempts), draft_1: str(r.draft_1),
    ruling_1: oneOf(r.ruling_1, RULINGS, "ruling"), draft_2: str(r.draft_2), ruling_2: oneOf(r.ruling_2, RULINGS, "ruling"),
    why: str(r.why), reason_is_leader_supplied: Boolean(r.reason_is_leader_supplied), settled_at: str(r.settled_at),
    paid_to: oneOf(r.paid_to, PAYEES, "payee"),
  };
  // settled <-> paid to someone; paid <-> the translator; the last ruling always decides who
  const settled = job.status === "paid" || job.status === "refunded";
  if (settled !== (job.paid_to !== "")) throw new Error(`a ${job.status} job paid to "${job.paid_to}"`);
  if ((job.status === "paid") !== (job.paid_to === "translator")) throw new Error(`a ${job.status} job paid to the translator`);
  if (job.attempts < 0 || job.attempts > MAX_ATTEMPTS) throw new Error(`${job.attempts} deliveries`);
  if ((job.ruling_1 !== "") !== (job.attempts >= 1) || (job.ruling_2 !== "") !== (job.attempts >= 2)) {
    throw new Error(`${job.attempts} deliveries but rulings "${job.ruling_1}" and "${job.ruling_2}"`);
  }
  const last = job.attempts === 2 ? job.ruling_2 : job.ruling_1;
  if (last !== "" && outcome(last, job.attempts) !== "" && outcome(last, job.attempts) !== job.paid_to) {
    throw new Error(`ruled ${last} on try ${job.attempts} but paid ${job.paid_to}`);
  }
  return job;
}

/** Whether anyone may release this job at `now`. A view has no clock, so the
 * caller brings one; the contract applies the same rule to the chain's clock
 * when release() is sent. */
export function isReleasable(job: Job, now: Date): boolean {
  if (job.status !== "open" && job.status !== "claimed") return false;
  return now.getTime() > Date.parse(job.deadline);
}

// ---------------------------------------------------------------- the port

/** Python's str.split() whitespace, as far as cleaned text can contain it:
 * JavaScript's \s plus NEL (U+0085), which Python splits on and \s does not. */
const PY_WS = /[\s\u0085]+/;

/** The contract's clean_text: control characters become spaces, whitespace
 * collapses, nothing is truncated. */
export function cleanText(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const o = ch.codePointAt(0) ?? 0;
    out += o < 32 || o === 127 ? " " : ch;
  }
  return out.split(PY_WS).filter(Boolean).join(" ");
}

/** Length as Python's len() counts it: code points, not UTF-16 units. */
export function pyLen(s: string): number {
  return [...s].length;
}

/** Python's str.strip(chars): remove any of `chars` from both ends. */
function stripChars(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

/** A model's answer as an option number 0..n-1, or "" if it is not one. */
export function normaliseChoice(raw: string, n: number): string {
  const s = stripChars(raw.trim().toLowerCase(), "[]()#").trim();
  if (s === "" || s.length > 2 || !/^[0-9]+$/.test(s)) return "";
  const k = Number(s);
  if (k < 0 || k >= n) return "";
  return String(k);
}

/** An option number, read back into its token through the order it was asked in. */
export function optionOf(choice: string, order: readonly string[]): string {
  if (choice === "") return "";
  return order[Number(choice)];
}

/** Both orders into one ruling. The same option stands; anything else is unfaithful. */
export function fold(forward: string, reverse: string): string {
  if (forward === "" || reverse === "") return "";
  return forward === reverse ? forward : UNFAITHFUL;
}

/** The validator's free check: one of the two options. */
export function rulingSound(ruling: string): boolean {
  return ruling === FAITHFUL || ruling === UNFAITHFUL;
}

/** What a ruling on the given try (1-based) does: pay the translator, refund
 * the client, or "" when nothing moves yet. */
export function outcome(ruling: string, attempt: number): "" | "translator" | "client" {
  if (ruling === FAITHFUL) return "translator";
  if (attempt >= MAX_ATTEMPTS) return "client";
  return "";
}

/** Why commission() would refuse these values before touching storage, or "". */
export function commissionRefusal(title: string, source: string, sourceLang: string, targetLang: string,
  window: number, fee: bigint): string {
  const t = pyLen(cleanText(title));
  if (t < MIN_TITLE || t > MAX_TITLE) return `${EXPECTED} a title is ${MIN_TITLE} to ${MAX_TITLE} characters`;
  const s = pyLen(cleanText(source));
  if (s < MIN_SOURCE || s > MAX_SOURCE) return `${EXPECTED} a source text is ${MIN_SOURCE} to ${MAX_SOURCE} characters`;
  const a = cleanText(sourceLang);
  const b = cleanText(targetLang);
  const ok = (x: string) => pyLen(x) >= MIN_LANGUAGE && pyLen(x) <= MAX_LANGUAGE;
  if (!ok(a) || !ok(b)) return `${EXPECTED} a language is named in ${MIN_LANGUAGE} to ${MAX_LANGUAGE} characters`;
  if (a.toLowerCase() === b.toLowerCase()) return `${EXPECTED} the source and target languages must differ`;
  if (window < MIN_WINDOW || window > MAX_WINDOW) return `${EXPECTED} a window is ${MIN_WINDOW} to ${MAX_WINDOW} seconds`;
  if (fee < 1n || fee > MAX_FEE) return `${EXPECTED} pay a fee of 1 to ${MAX_FEE} wei in with commission()`;
  return "";
}
