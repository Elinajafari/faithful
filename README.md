# Faithful

**A translation escrow that pays the translator only when the translation says
what the source says, on GenLayer.** The name is the test: not fluent, not
elegant, faithful.

The client posts a source text, the two languages and a deadline, and pays the
fee into the contract. A translator claims the job and delivers. In the same
transaction GenLayer's validators decide one thing: is the translation
faithful to the source, or not. Faithful, the translator is paid. Unfaithful,
the translator has one more try; a second unfaithful delivery, or nothing
faithful by the deadline, refunds the client.

**Live on studionet at `0xd91BB7Da22D3d4f672Eb346CeE6941c3557A98F1`.**
Intelligent contract + shared type layer + scripts that deploy, seed, verify
and prove it, not a standalone contract.

> Every transaction of the live demo, and the wallet that sent it, read back
> from the chain: **[EVIDENCE.md](EVIDENCE.md)**.
> A second round from two new wallets: **[EVIDENCE-ACTIVITY.md](EVIDENCE-ACTIVITY.md)**.

---

## Why this exists

A client who commissions a translation into a language they cannot read
cannot check what they paid for. A translator paid on delivery has every
reason to hand over something fluent that quietly drops the hard sentence,
and a translator paid on approval can be refused by a client who simply
changed their mind. The pharmacy leaflet that says "once a day" where the
source said "twice", or leaves out "do not drink alcohol", reads perfectly
well to someone who cannot read the source.

Asking a model "should the translator be paid?" does not fix it. It hands the
model the fee and both parties at once and gets back whatever seems fair.

### In plain terms

The client writes the source, and it can never be edited. The fee goes into
the contract, not to the translator. A translator claims the job and delivers
a translation. The validators each read the source and the translation, twice,
with the two options in different orders, and have to agree exactly: faithful,
or not. A changed number, a dropped warning, an added condition or the wrong
language is not faithful; a different word order or a plainer word is. If the
first try is not faithful the translator may try once more. If nothing
faithful arrives by the deadline, anyone can release the fee back to the
client.

### Why this needs GenLayer specifically

Whether "Tome un comprimido una vez al día" is a faithful rendering of "Take
one tablet twice a day" is a judgment about two natural languages. A normal
smart contract cannot make it. An LLM can, but a single model run by a
translation agency is the agency's opinion with extra steps.

Here the reading is done by a validator quorum under consensus rules, and the
money moves on the same chain. Everything that is not a judgment is kept away
from the model: the source was fixed before anyone claimed the job, the fee,
the parties and the try number are never shown to it, the answer is one of two
options the contract wrote, and a translation that only passes when "faithful"
is listed first is not paid. A model answer that cannot be parsed fails
closed: it is raised as `[LLM_ERROR]`, which no validator agrees with, so a
broken model can never move anyone's money or use up anyone's try.

### How you actually use it

1. **Commission** (the client): `commission(title, source, source_lang, target_lang, window)`, paying the fee.
2. **Claim** (any translator but the client): `claim(id)`.
3. **Deliver** (the translator, before the deadline): `deliver(id, translation)`.
   Faithful pays the translator; unfaithful allows one more delivery, and a
   second unfaithful one refunds the client.
4. **Release** (anyone, after the deadline): `release(id)` refunds the client
   when nothing faithful arrived.
5. **Rely on it from another contract**: `status(id)` returns one word.

   ```python
   faithful = gl.get_contract_at(Address(FAITHFUL))
   if faithful.view().status(job_id) == "paid":
       ...  # e.g. publish the translated leaflet
   ```

## Stack

| Layer | Tech |
|---|---|
| Contract | GenLayer Intelligent Contract, Python (GenVM): [`packages/contracts/faithful.py`](packages/contracts/faithful.py) |
| Consensus | custom leader/validator with `gl.vm.run_nondet_unsafe`: a free structural check, then exact agreement on faithful or not |
| Money | `commission()` is payable; every payout goes through one path, through the external message form with `value` |
| Tests | pytest on a GenVM stand-in that runs the real file, moves the chain's clock and records every transfer, plus a mutation pass that breaks every defence on purpose |
| Chain client | `genlayer-js` 1.1.8: deploy, seed, e2e, verify and evidence scripts; the StudioNet faucet funds the client |
| Types | [`packages/shared`](packages/shared): view types (the fee as bigint), parsers and a port of the contract's deterministic rules, tested against vectors generated from the contract |

There is no backend and no database. Every value in this repository's record
was read back from the chain.

---

## Quick start

```bash
pnpm install
pip install -r packages/contracts/requirements-dev.txt

pnpm test               # contract (pytest) + shared (vitest), no chain needed
```

Deploy your own copy and put the whole demo on the explorer:

```bash
pnpm deploy:contract    # a fresh deployer wallet deploys packages/contracts/faithful.py
pnpm seed:contract      # 3 jobs, 4 rulings, 1 payout, 2 refunds, 6 refusals, real GEN
pnpm e2e:contract       # re-reads every transaction, every view and the balances: PASS/FAIL
pnpm evidence:contract  # rewrites EVIDENCE.md from the chain
```

| Command | What it does |
|---|---|
| `pnpm test` | contract and shared suites |
| `pnpm test:contract` | pytest against `faithful.py`, no chain needed |
| `pnpm test:shared` | vitest: the TypeScript port against the contract's vectors, and the parsers against the live record |
| `pnpm typecheck` | `tsc --noEmit` on the shared package |
| `pnpm mutate:contract` | removes every defence one at a time; every mutant must be caught by a named test |
| `pnpm measure:contract` | runs the suite and the mutation pass and renders the numbers into the contract README |
| `pnpm lint:genvm` | GenVM linter on the contract, pinned to the runner it depends on |
| `pnpm deploy:contract` | deploy to studionet (a throwaway deployer key) |
| `pnpm seed:contract` | the demo: every route and every refusal, recorded; waits for the sign's deadline so its release is real |
| `pnpm seed:activity` | a second round on the deployed contract from two new wallets, recorded apart from the demo |
| `pnpm e2e:contract` | the record checked against the live chain |
| `pnpm verify:contract` | the deployed source, byte for byte against the file, and linted |
| `pnpm evidence:contract` | EVIDENCE.md: every transaction and its sender, from the chain |
| `pnpm evidence:activity` | EVIDENCE-ACTIVITY.md: the second round, from the chain |
| `pnpm demo:contract` | deploy, seed, e2e and evidence in one go |

### Configuration

Copy `.env.example` to `.env`. On studionet nothing is needed: every role gets
a wallet made in memory for the run, no key is ever written to disk, and the
client is funded from the StudioNet faucet. On any other network
(`GENLAYER_NETWORK=testnet-asimov`) the scripts refuse to run without a key
for every role, and the client must hold the fees.

## The live demo

One client posts three jobs, English into Spanish, to three translators:

| Job | What happened | Rulings | Paid to |
|---|---|---|---|
| Pharmacy leaflet, 0.3 GEN: "Take one tablet twice a day ... Do not drink alcohol ..." | Ann's first draft says once a day and drops the alcohol line; her second says it all | **unfaithful**, then **faithful** | **Ann**, the translator |
| Tenancy notice, 0.2 GEN: "The rent is 750 pounds a month ... returned within ten days ..." | Ben's first draft says 570 pounds and thirty days; his second is accurate but in French | **unfaithful**, **unfaithful** | **the client**, refunded |
| Shop sign, 0.1 GEN | Cal claims it and delivers only after the deadline: refused before any model | never ruled | **the client**, by release() |

The client's, Ann's and Ben's balances were read from the chain after the fees
were paid in and again once every payout had landed: each moved by exactly
what the contract paid it. Around them, six refusals, each from the wallet it
is about: a release before the deadline, the client claiming its own job, a
second claim on a claimed job, a stranger delivering, a third try on a
refunded job, and the late delivery. Full detail, with every hash:
[EVIDENCE.md](EVIDENCE.md) and
[`packages/contracts/README.md`](packages/contracts/README.md#verified-against-the-live-deployment).

### Second round, two new wallets

`pnpm seed:activity` ran on the same contract from two wallets that had never
been used: a new client posted a train station notice for 0.05 GEN, tried to
claim it and was refused, a new translator claimed it, the client tried to
deliver it and was refused, and the translator delivered a faithful Spanish
version and was paid. Every hash: [EVIDENCE-ACTIVITY.md](EVIDENCE-ACTIVITY.md).

## Repo layout

```
.
├─ packages/
│  ├─ contracts/                 the Intelligent Contract and everything that proves it
│  │  ├─ faithful.py             the contract
│  │  ├─ tests/                  pytest on a GenVM stand-in (see tests/README.md)
│  │  ├─ scripts/                deploy · seed · e2e · verify · evidence · lint · mutate · measure
│  │  ├─ demo/demo.json          the demo, read by the seed script AND the tests
│  │  ├─ deployments/            studionet.json, written by the scripts, never by hand
│  │  ├─ lib/                    the faithfulness rules, generated from the contract
│  │  └─ DECISIONS.md            why every rule is the way it is
│  └─ shared/                    types, parsers, contract-shape.json, the rules port and its vectors
├─ EVIDENCE.md                   every live transaction and its sender
├─ EVIDENCE-ACTIVITY.md          the second round, two new wallets
├─ .env.example
└─ package.json · pnpm-workspace.yaml
```

## License

MIT © 2026 Elina ([@Elinajafari](https://github.com/Elinajafari))
