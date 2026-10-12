// Put the demo on the explorer: every route the contract has, refusals included.
//
//   pnpm seed:contract
//
// Reads the address from deployments/studionet.json (written by deploy.mjs)
// and sends the steps in demo/demo.json, in order: the client posts three
// jobs and pays their fees in, three translators claim them, two deliver
// (one twice to a payout, one twice to a refund), one never does, and the run
// waits on the chain's clock until the third job's deadline has passed before
// releasing it. It sends every write the contract exists to refuse.
// Everything is appended to the same record: each transaction hash and its
// sender, its status, the refusal sentence where there was one, every job as
// the chain holds it, and the wallets' balances read from the chain after the
// fees were paid in and once every payout had landed. Nothing in that file is
// typed by hand.
//
// Five wallets act, each in one role: the client, three translators (Ann, Ben
// and Cal) and a stranger. They come from CLIENT_PRIVATE_KEY,
// ANN_PRIVATE_KEY, BEN_PRIVATE_KEY, CAL_PRIVATE_KEY and STRANGER_PRIVATE_KEY,
// or on studionet are made in memory for this run and never written to disk;
// the client is funded from the StudioNet faucet. The run stops at the first
// step that does not do what the demo expects, because the record claims
// whatever it holds.
//
// The steps are the ones tests/test_runbook.py replays offline, from the same
// file, so a demo that could not succeed fails a test before it costs a
// transaction.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PKG, RECORD_FILE, accountFrom, balanceOf, clientFor, fundAccount, loadEnv, network, readRetry, recorder, sleep, sourceSha256 } from "./lib.mjs";

loadEnv();
const net = network();
const record = JSON.parse(readFileSync(RECORD_FILE, "utf8"));
if (record.source_sha256 !== sourceSha256()) {
  throw new Error("faithful.py has changed since it was deployed; run pnpm deploy:contract first");
}
const address = record.contract;
const demo = JSON.parse(readFileSync(path.join(PKG, "demo", "demo.json"), "utf8"));
const GEN = 10n ** 18n;

const who = {
  client: accountFrom("CLIENT_PRIVATE_KEY", net),
  ann: accountFrom("ANN_PRIVATE_KEY", net),
  ben: accountFrom("BEN_PRIVATE_KEY", net),
  cal: accountFrom("CAL_PRIVATE_KEY", net),
  stranger: accountFrom("STRANGER_PRIVATE_KEY", net),
};
const as = Object.fromEntries(Object.entries(who).map(([k, a]) => [k, clientFor(net, a)]));
const ro = clientFor(net, null);
console.log(`\ncontract ${address}`);
for (const [k, a] of Object.entries(who)) console.log(`  ${k.padEnd(8)} ${a.address}`);

const rec = recorder();
const read = (fn, args = []) => readRetry(() => ro.readContract({ address, functionName: fn, args }));
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));

const existing = Number(await read("count"));
if (existing !== 0) throw new Error(`the demo expects a fresh contract; this one already has ${existing} jobs`);

if (net.name === "studionet") {
  console.log("\nfunding the client from the StudioNet faucet");
  await fundAccount(net, ro, who.client.address, 2n * GEN);
}

// A ruling must come back as the demo expects, or every step after it would be
// recorded against the wrong story: stop here instead.
const expected = [...demo.expected_rulings];
const attempts = {};
let before = null;
const PARTIES = ["client", "ann", "ben"];
const balances = async () => Object.fromEntries(await Promise.all(PARTIES.map(async (k) => [k, await balanceOf(ro, who[k].address)])));

console.log("\nthe demo");
for (const step of demo.steps) {
  if (step.after_deadline_of !== undefined) {
    const deadline = Date.parse(plain(await read("job", [step.after_deadline_of])).deadline);
    for (let left = deadline + 20_000 - Date.now(); left > 0; left = deadline + 20_000 - Date.now()) {
      console.log(`  waiting ${Math.ceil(left / 1000)} s for job ${step.after_deadline_of}'s deadline`);
      await sleep(Math.min(left, 30_000));
    }
  }
  let args = [step.id];
  let value = 0n;
  if (step.method === "commission") {
    const x = demo.jobs[step.job];
    args = [x.title, x.source, x.source_lang, x.target_lang, x.window];
    value = BigInt(x.fee);
  } else if (step.method === "deliver") {
    args = [step.id, demo.drafts[step.draft]];
  }
  await rec.write(as[step.who], who[step.who], address, step.method, args, { step: step.step, expect: step.expect, value });
  if (step.method === "deliver" && step.expect === "ok") {
    attempts[step.id] = (attempts[step.id] ?? 0) + 1;
    const got = plain(await read("job", [step.id]));
    const ruling = got[`ruling_${attempts[step.id]}`];
    const want = expected.shift();
    console.log(`      ruled ${ruling}: ${got.why}`);
    if (ruling !== want) throw new Error(`job ${step.id} was ruled ${ruling}, the demo expects ${want}`);
  }
  // the fees are in once the last commission lands: read the wallets from here
  if (step.method === "commission" && !demo.steps.slice(demo.steps.indexOf(step) + 1).some((x) => x.method === "commission")) {
    before = await balances();
  }
}

const n = Number(await read("count"));
const jobs = [];
for (let k = 0; k < n; k++) jobs.push(plain(await read("job", [k])));
const owed = (k) => jobs.reduce((sum, j) => {
  if (k === "client" && j.paid_to === "client") return sum + BigInt(j.fee);
  if (j.paid_to === "translator" && j.translator.toLowerCase() === who[k].address.toLowerCase()) return sum + BigInt(j.fee);
  return sum;
}, 0n);
// a payout is a message the chain delivers after the transaction; wait until every one has landed
let after = await balances();
for (let k = 0; k < 12 && PARTIES.some((p) => after[p] - before[p] !== owed(p)); k++) {
  await sleep(10_000);
  after = await balances();
}
const out = {
  ...record,
  accounts: { deployer: record.deployer, ...Object.fromEntries(Object.entries(who).map(([k, a]) => [k, a.address])) },
  steps: [...record.steps.filter((st) => st.step === "deploy"), ...rec.steps],
  jobs,
  balances: Object.fromEntries(PARTIES.flatMap((p) => [[`${p}_before`, String(before[p])], [`${p}_after`, String(after[p])]])),
  held_after: String(await read("held_total")),
};
writeFileSync(RECORD_FILE, JSON.stringify(out, null, 2) + "\n");

const gen = (wei) => `${Number(BigInt(wei)) / 1e18} GEN`;
console.log("");
for (const j of jobs) console.log(`  job ${j.id}  ${j.status.padEnd(9)} rulings ${j.ruling_1 || "-"} / ${j.ruling_2 || "-"}  paid to ${j.paid_to}`);
for (const p of PARTIES) console.log(`  ${p.padEnd(8)} ${gen(before[p])} -> ${gen(after[p])}  (owed ${gen(owed(p))})`);
console.log(`  written  ${path.relative(PKG, RECORD_FILE)}\n`);
