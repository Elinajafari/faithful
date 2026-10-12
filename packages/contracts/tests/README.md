# Contract tests

Faithful is tested at four levels, from the cheapest to the one that costs real
transactions. Each level has one command.

| Level | Command | Needs | What it proves |
|---|---|---|---|
| 1. Offline suite | `pnpm test:contract` | Python + pytest | the contract file itself behaves as specified, including against a lying leader, a moving clock and real payouts |
| 2. Mutation pass | `pnpm mutate:contract` | same | every defence is covered by a test that fails without it |
| 3. Live demo | `pnpm deploy:contract && pnpm seed:contract` | Node 20+ | the same behaviour happens on StudioNet, with real validators, real models, real GEN and the chain's own clock |
| 4. Chain checks | `pnpm e2e:contract`, `pnpm verify:contract`, `pnpm evidence:contract` | Node 20+ | what the record claims is what the chain holds, and what is deployed is this file |

## 1. The offline suite

```bash
pip install -r requirements-dev.txt
pnpm test:contract   # from the repo root, or here: python -m pytest tests -q
```

It runs the real `packages/contracts/faithful.py` on [`tests/glsim.py`](glsim.py), a
small GenVM stand-in. The stand-in gives the leader and each validator their own
mock model answers, can make a leader lie, sets the transaction time the
contract reads, carries the value a call sends and records the transfers it
makes (a refused call pays nobody), and refuses what GenVM refuses.

| File | What it covers |
|---|---|
| [`test_logic.py`](test_logic.py) | the pure rules: text cleaning, reading a model's answer back through the order it was asked in, the fold of the two orders, the structural check, the agreement, what a ruling on each try does, the fence and the prompt, and that `lib/faithful_consensus.py` is exactly the contract's code |
| [`test_e2e.py`](test_e2e.py) | the contract executed: `commission` and its bounds (the fee paid in, two different languages); `claim` (not the client, once, before the deadline); `deliver` (faithful pays, a first unfaithful try moves nothing, a second refunds and closes the job, the model never sees the fee, the parties or the try, an order-dependent answer is unfaithful, a lying or malformed leader is refused, a malformed one for free, an `[LLM_ERROR]` never agreed with and never uses up a try, only the translator who claimed may deliver, a delivery after the deadline is refused for free); `release` (the client refunded after the deadline, once); money (a payout beyond what is held refused, two jobs never pay each other's money); and static checks over the parsed source (runner pinned, class named after the product, pure ASCII, storage types, the block never touches storage, money, parties or the try, prompts only inside the block, every gated write checks its sender, only `commission` takes money and one path pays it, both second lines pinned) |
| [`test_runbook.py`](test_runbook.py) | the live demo replayed offline from [`demo/demo.json`](../demo/demo.json), with the clock moved past the sign's deadline, before any transaction is spent; and once `deployments/studionet.json` exists, the validators' real rulings are replayed through this file, which must pay and refund exactly as the deployed contract did, and the wallets' balances must have moved by exactly the payouts |
| [`test_vectors.py`](test_vectors.py) | `packages/shared/faithful-vectors.json` is exactly what this contract's text cleaning, answer reading, order folding, structural check and outcome compute, so the TypeScript port in `packages/shared` is tested against the contract's own answers (`UPDATE_VECTORS=1` regenerates it) |
| [`test_shape.py`](test_shape.py) | `packages/shared/contract-shape.json` describes every public write (payable or not) and view, its parameters and types, and the fields the live deployment returned, exactly; any drift on either side fails |

The last group, `TestTheRecord`, is skipped until a deployment has been
recorded, and then runs every time.

## 2. The mutation pass

```bash
pnpm mutate:contract
```

[`scripts/mutate.py`](../scripts/mutate.py) makes small edits to a copy of the
contract, each one removing a defence ("a delivery after the deadline is
ruled", "an unfaithful first try refunds the client", "anyone may deliver", "a
disagreement between the orders pays the translator", ...), runs the suite
against each, and names the test that failed. A mutant that survives is a
missing test, and the script exits non-zero. It refuses to run on a red
baseline, and a mutation whose target text is missing or ambiguous is a
failure, never a skip. The table in the README is its output.

## 3. The live demo

```bash
pnpm install
pnpm deploy:contract          # a fresh deployer wallet deploys packages/contracts/faithful.py
pnpm seed:contract            # a fresh client, three translators and a stranger run the demo
```

Six wallets, one role each, all made in memory for the run; the client is
funded from the StudioNet faucet:

| Wallet | Does |
|---|---|
| deployer | deploys the contract, nothing else |
| client | posts three jobs and pays their fees in, tries to claim its own |
| ann | claims the pharmacy leaflet and delivers it twice |
| ben | tries to claim the leaflet too, claims the tenancy notice and delivers it twice, then a third time |
| cal | claims the shop sign and delivers it only after the deadline |
| stranger | tries to deliver a job it never claimed, tries to release early, then releases the sign |

Every transaction, in order, and what it proves. The steps are
[`demo/demo.json`](../demo/demo.json), read by the seed script and by
`test_runbook.py`. If the chain does anything else, including a ruling other
than the one the demo expects, the run stops, because the record claims
whatever it holds.

| # | Sent by | Call | Expected | What it proves |
|---|---|---|---|---|
| 0 | deployer | deploy | deployed | the file deploys as it is; its sha256 is recorded |
| 1-3 | client | `commission` the leaflet (0.3), the tenancy notice (0.2), the shop sign (0.1) | executed | each source, pair of languages and deadline is frozen, and the fee held |
| 4 | stranger | `release(2)` | refused | the sign is open until its deadline |
| 5 | client | `claim(0)` | refused | the client cannot claim its own job |
| 6 | ann | `claim(0)` | executed | |
| 7 | ben | `claim(0)` | refused | one translator per job |
| 8-9 | ben, cal | `claim(1)`, `claim(2)` | executed | |
| 10 | stranger | `deliver(0)` | refused | only the translator who claimed may deliver, and no model is asked |
| 11 | ann | `deliver(0)`: once a day, no alcohol line | **unfaithful** | a changed number and a dropped warning; nothing moves, one more try |
| 12 | ann | `deliver(0)`: the whole leaflet | **faithful** | Ann is paid 0.3 GEN |
| 13 | ben | `deliver(1)`: 570 pounds, thirty days | **unfaithful** | changed numbers; one more try |
| 14 | ben | `deliver(1)`: accurate, but in French | **unfaithful** | the wrong language; the client is refunded 0.2 GEN |
| 15 | ben | `deliver(1)` a third time | refused | a refunded job takes no delivery |
| 16 | cal | `deliver(2)` after the deadline | **refused** | a late delivery is never ruled, and no model is asked |
| 17 | stranger | `release(2)` | **refunded** | nobody delivered in time: the client is refunded 0.1 GEN |

Before step 16 the script reads the sign's `deadline` from the chain and waits
until it has passed by 20 seconds. It reads the client's, Ann's and Ben's
balances from the chain after the fees were paid in and again once every
payout has landed. The seed then reads every job back from the chain into
[`deployments/studionet.json`](../deployments/studionet.json).

## 4. Checking the chain, not the record

```bash
pnpm e2e:contract             # PASS/FAIL per check
pnpm verify:contract          # the deployed source, byte for byte, and genvm-lint on it
pnpm evidence:contract        # EVIDENCE.md
```

- **`e2e`** fetches every recorded transaction again and checks that the chain
  still says what the record says (executed, or refused with the same
  sentence), then re-reads every job. Every demo job is settled, so each must
  match exactly; nothing may still be held; and the balances must have moved by
  exactly the payouts.
- **`verify`** reads the deployed source back with `gen_getContractCode`,
  compares it byte for byte with `packages/contracts/faithful.py`, and runs
  genvm-lint on the bytes that came off the chain (pinned to GenVM `v0.3.0-rc7`).
- **`evidence`** builds [EVIDENCE.md](../../../EVIDENCE.md) from the chain's answers
  alone: for each hash the sender, the status and the outcome, plus a table of
  the wallets and how many transactions each sent. A row whose on-chain
  outcome disagrees with the record is marked.

A refusal still reaches ACCEPTED or FINALIZED: the committee agreed that the
contract refused. That is why every script reads the leader's result (`return`
or `rollback`) and never treats the status alone as success.

## Measuring

```bash
pnpm measure:contract
```

Runs the suite and the mutation pass now and renders their numbers, and the
live record, into the README. It writes nothing if the suite is red, a mutant
escapes, or the record is of a different contract file.
