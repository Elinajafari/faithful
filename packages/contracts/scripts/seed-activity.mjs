// A second round on the deployed contract, from two NEW wallets.
//
//   pnpm seed:activity
//
// The contract in deployments/studionet.json is not redeployed. Two wallets
// made in memory for this run, used by nothing else, run one job from
// commission to payout, and each tries once what only the other may do:
//
//   client       posts a station notice, English into Spanish, 0.05 GEN
//   client       tries to claim it                           refused: the client cannot claim
//   translator   claims it
//   client       tries to deliver it                         refused: only the translator
//   translator   delivers                                    expected faithful: paid
//
// Everything goes to deployments/studionet-activity.json, apart from the demo's
// own record, so the demo and the tests that replay it are untouched. Then
// `pnpm evidence:activity` writes EVIDENCE-ACTIVITY.md from the chain.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createAccount, generatePrivateKey } from "genlayer-js";
import { PKG, RECORD_FILE, balanceOf, clientFor, fundAccount, loadEnv, network, readRetry, recorder, sleep } from "./lib.mjs";

loadEnv();
const net = network();
if (net.name !== "studionet") throw new Error("the activity round makes throwaway wallets; run it on studionet");
const address = JSON.parse(readFileSync(RECORD_FILE, "utf8")).contract;
const data = JSON.parse(readFileSync(path.join(PKG, "demo", "activity.json"), "utf8"));
const OUT = path.join(PKG, "deployments", "studionet-activity.json");

const client = createAccount(generatePrivateKey());
const translator = createAccount(generatePrivateKey());
const asClient = clientFor(net, client);
const asTranslator = clientFor(net, translator);
const ro = clientFor(net, null);
const read = (fn, args = []) => readRetry(() => ro.readContract({ address, functionName: fn, args }));
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));

const id = Number(await read("count"));
console.log(`\ncontract ${address} (already deployed, ${id} jobs on it)\n  client     ${client.address}\n  translator ${translator.address}`);
await fundAccount(net, ro, client.address, 10n ** 18n);
const before = await balanceOf(ro, translator.address);

const J = data.job;
const fee = BigInt(J.fee);
const rec = recorder();
await rec.write(asClient, client, address, "commission", [J.title, J.source, J.source_lang, J.target_lang, J.window],
  { step: `job ${id}: a new client posts a station notice, 0.05 GEN`, value: fee });
await rec.write(asClient, client, address, "claim", [id], { step: "the client tries to claim it", expect: "refused" });
await rec.write(asTranslator, translator, address, "claim", [id], { step: "a new translator claims it" });
await rec.write(asClient, client, address, "deliver", [id, data.translation], { step: "the client tries to deliver it", expect: "refused" });
await rec.write(asTranslator, translator, address, "deliver", [id, data.translation],
  { step: `delivered and ruled: both orders (expected ${data.expected_ruling})` });

let after = await balanceOf(ro, translator.address);
for (let k = 0; k < 6 && after - before < fee; k++) {
  await sleep(10_000);
  after = await balanceOf(ro, translator.address);
}

const job = plain(await read("job", [id]));
writeFileSync(OUT, JSON.stringify({
  network: net.name,
  contract: address,
  accounts: { client: client.address, translator: translator.address },
  steps: rec.steps,
  jobs: { [id]: job },
  balances: { translator_before: String(before), translator_after: String(after) },
}, null, 2) + "\n");

console.log(`  job ${id}  ${job.status}  ruling ${job.ruling_1}  paid to ${job.paid_to}`);
console.log(`  translator went from ${Number(before) / 1e18} to ${Number(after) / 1e18} GEN`);
console.log(`  written  ${path.relative(PKG, OUT)}\n`);
