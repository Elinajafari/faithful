import { describe, expect, it } from "vitest";
import demo from "../../contracts/demo/demo.json";
import record from "../../contracts/deployments/studionet.json";
import shape from "../contract-shape.json";
import { outcome, parseJob } from "./index";

// The live deployment's own answers, as packages/contracts/scripts/seed.mjs
// read them back from studionet. If the contract ever returned a shape these
// parsers refuse, a client built on this package would break on real data;
// this is where that shows up first.

describe("the parsers accept everything the live deployment returned", () => {
  it("every job, with exactly the fields the contract describes", () => {
    for (const x of record.jobs) {
      expect(Object.keys(parseJob(x)).sort()).toEqual(shape.views.job.fields);
    }
  });

  it("every job's source and fee are the ones the demo posted", () => {
    const keys = ["leaflet", "tenancy", "sign"] as const;
    record.jobs.forEach((x, k) => {
      const j = parseJob(x);
      expect(j.source).toBe(demo.jobs[keys[k]].source);
      expect(j.fee).toBe(BigInt(demo.jobs[keys[k]].fee));
    });
  });

  it("every ruled job was settled the way the port says its last ruling settles", () => {
    for (const j of record.jobs.map(parseJob)) {
      const last = j.attempts === 2 ? j.ruling_2 : j.ruling_1;
      if (last !== "" && outcome(last, j.attempts) !== "") expect(j.paid_to).toBe(outcome(last, j.attempts));
    }
  });

  it("the wallets moved by exactly the payouts", () => {
    const b = record.balances;
    const jobs = record.jobs.map(parseJob);
    const owed = (who: "client" | "ann" | "ben") => jobs.reduce((s, j) => {
      if (who === "client" && j.paid_to === "client") return s + j.fee;
      if (j.paid_to === "translator" && j.translator.toLowerCase() === record.accounts[who].toLowerCase()) return s + j.fee;
      return s;
    }, 0n);
    for (const who of ["client", "ann", "ben"] as const) {
      expect(BigInt(b[`${who}_after`]) - BigInt(b[`${who}_before`])).toBe(owed(who));
    }
  });
});
