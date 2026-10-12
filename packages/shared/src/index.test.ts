import { describe, expect, it } from "vitest";
import vectors from "../faithful-vectors.json";
import {
  FORWARD,
  REVERSED,
  cleanText,
  commissionRefusal,
  fold,
  isReleasable,
  normaliseChoice,
  optionOf,
  outcome,
  parseJob,
  pyLen,
  rulingSound,
} from "./index";

// faithful-vectors.json is generated from the contract's own functions
// (see packages/contracts/tests/test_vectors.py), so every case below is the
// contract's answer, not a hand-written expectation.

describe("the port agrees with the contract on every vector", () => {
  it.each(vectors.clean_text)("clean_text %#", ({ raw, clean }) => expect(cleanText(raw)).toBe(clean));
  it.each(vectors.normalise_choice)("normalise_choice %#", ({ raw, n, choice }) => expect(normaliseChoice(raw, n)).toBe(choice));
  it.each(vectors.option_of)("option_of %#", ({ choice, order, option }) => expect(optionOf(choice, order)).toBe(option));
  it.each(vectors.fold)("fold %#", ({ forward, reverse, folded }) => expect(fold(forward, reverse)).toBe(folded));
  it.each(vectors.ruling_sound)("ruling_sound %#", ({ ruling, sound }) => expect(rulingSound(ruling)).toBe(sound));
  it.each(vectors.outcome)("outcome %#", ({ ruling, attempt, outcome: want }) => expect(outcome(ruling, attempt)).toBe(want));
});

describe("the two orders", () => {
  it("are each other's reverse", () => {
    expect([...REVERSED]).toEqual([...FORWARD].reverse());
  });
});

describe("the client-side refusals mirror the contract's", () => {
  const src = "Take one tablet twice a day, with food.";
  it("a character outside the BMP is one character, as in Python", () => {
    expect(pyLen("🚚")).toBe(1);
  });
  it("accepts a well formed job and refuses the bounds", () => {
    expect(commissionRefusal("Leaflet", src, "English", "Spanish", 600, 10n ** 17n)).toBe("");
    expect(commissionRefusal("x", src, "English", "Spanish", 600, 1n)).toContain("a title is 2 to 120");
    expect(commissionRefusal("Leaflet", "too short", "English", "Spanish", 600, 1n)).toContain("a source text is 20 to 2000");
    expect(commissionRefusal("Leaflet", src, "E", "Spanish", 600, 1n)).toContain("a language is named in 2 to 40");
    expect(commissionRefusal("Leaflet", src, "Spanish", " spanish ", 600, 1n)).toContain("must differ");
    expect(commissionRefusal("Leaflet", src, "English", "Spanish", 59, 1n)).toContain("a window is 60 to");
    expect(commissionRefusal("Leaflet", src, "English", "Spanish", 600, 0n)).toContain("pay a fee of 1 to");
  });
});

describe("parsers refuse what the contract never returns", () => {
  const base = {
    id: 0, title: "Leaflet", source: "Take one tablet twice a day.", source_lang: "English", target_lang: "Spanish",
    client: "0x" + "11".repeat(20), translator: "0x" + "22".repeat(20), fee: "300000000000000000", status: "paid",
    posted_at: "t", deadline: "2026-10-08T12:25:00Z", claimed_at: "t", attempts: 2, draft_1: "d1", ruling_1: "unfaithful",
    draft_2: "d2", ruling_2: "faithful", why: "", reason_is_leader_supplied: true, settled_at: "t", paid_to: "translator",
  };
  it("parses a job from an object or a Map, with the fee as bigint", () => {
    expect(parseJob(base).fee).toBe(3n * 10n ** 17n);
    expect(parseJob(new Map(Object.entries(base))).paid_to).toBe("translator");
  });
  it("refuses a ruling, a status or a payee the contract never returns", () => {
    expect(() => parseJob({ ...base, ruling_2: "accurate" })).toThrow("unexpected ruling");
    expect(() => parseJob({ ...base, status: "done" })).toThrow("unexpected status");
    expect(() => parseJob({ ...base, fee: "3e17" })).toThrow("amount of wei");
  });
  it("refuses a payout that contradicts the status, the tries or the last ruling", () => {
    expect(() => parseJob({ ...base, paid_to: "client" })).toThrow();
    expect(() => parseJob({ ...base, status: "refunded" })).toThrow();
    expect(() => parseJob({ ...base, attempts: 1 })).toThrow();
    expect(() => parseJob({ ...base, attempts: 3 })).toThrow();
    expect(() => parseJob({ ...base, ruling_2: "unfaithful" })).toThrow();
    expect(parseJob({ ...base, status: "refunded", paid_to: "client", ruling_2: "unfaithful" }).paid_to).toBe("client");
    expect(parseJob({ ...base, status: "claimed", paid_to: "", attempts: 1, draft_2: "", ruling_2: "", settled_at: "" }).status).toBe("claimed");
    expect(parseJob({ ...base, status: "refunded", paid_to: "client", attempts: 0, draft_1: "", ruling_1: "", draft_2: "", ruling_2: "" }).attempts).toBe(0);
  });
  it("tells when anyone may release, with the clock the view does not have", () => {
    const claimed = parseJob({ ...base, status: "claimed", paid_to: "", attempts: 1, draft_2: "", ruling_2: "", settled_at: "" });
    expect(isReleasable(claimed, new Date("2026-10-08T12:25:00Z"))).toBe(false);
    expect(isReleasable(claimed, new Date("2026-10-08T12:25:01Z"))).toBe(true);
    expect(isReleasable(parseJob(base), new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });
});
