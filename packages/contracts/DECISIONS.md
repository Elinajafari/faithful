# DECISIONS

Why Faithful is built the way it is. Each section names the alternative that
was rejected and what it would have cost.

## The source is the contract, frozen before anyone translates

The source text, both languages and the deadline are written at
`commission()`, with the fee paid in, before a translator can even claim the
job. A source that could be edited after delivery could be edited to make a
good translation miss it, or a bad one fit. The view returns the source as it
was frozen, next to every draft and its ruling.

## Two options the contract wrote, never a score

An earlier sketch asked the model for a score out of ten and paid above a
threshold. Two honest nodes rarely agree on a score exactly, and a tolerance
band only moves the argument to its edge. Whether a translation says what the
source says is a yes or a no, so the answer is one of two options the contract
wrote, `faithful` or `unfaithful`, labelled `[0]` and `[1]` inside an
`<options>` block after every caller string has been fenced.

## Order-dependence is unfaithful

The options are asked in the order faithful, unfaithful and then reversed and
renumbered; each answer is read back through the order it was asked in. The
same option both ways stands; anything else is `unfaithful`. A translation
that only passes when "faithful" is listed first does not clearly say what the
source says, and the translator who wants to be paid carries the burden of
showing it. A model that always answers "0" pays nobody, and the tests check
it.

## Meaning, numbers and the language, not style

The prompt tells the model to check every fact, number, date, name, quantity,
condition and negation, and the options say that a text not written in the
target language is unfaithful. It also tells it not to judge elegance, or
whether the source is right. A client paying for a translation is paying for
the meaning to arrive; the demo's first leaflet draft changes twice a day to
once a day and drops the alcohol warning, and the tenancy's second draft is
accurate but in French. Both are ruled unfaithful on chain.

## Two tries, then a refund

A translator who gets one fact wrong deserves a chance to fix it, and a client
deserves not to wait forever. So a job takes at most two deliveries: an
unfaithful first one moves nothing, an unfaithful second one refunds the
client and closes the job. `outcome()` is the whole rule, pure and tested in
every combination. A third try is refused before any model by the job's status;
a second check on the try count is kept under it, unreachable today, and pinned
by a structural test so no change to the refund rule can buy a third try.

## The ruling happens in the delivery

There is no separate "rule" step. A delivery that has not been ruled would be
a state someone has to push forward, and a deadline someone could wait out to
make a good translation unpaid. Ruling in `deliver()` means the translator who
wants to be paid is the one who spends the inference, at the moment they
deliver, and the result is on the record with the draft.

## Every waiting state has a clock, and the clock refunds

Before the deadline, the translator may claim and deliver. After it,
`claim()` and `deliver()` refuse before any model is asked, and anyone may
`release()` the job, which refunds the client. A translator who claims and
vanishes cannot hold the fee, and a late delivery can never take back money a
client has already waited out.

## release() is anyone's

It reads no model and only refunds what the clock already says is due. A
client who has lost a key must not be able to strand their own fee, and a
translator cannot block it.

## Money in, money out, counted

`commission()` is the only payable method, and the fee must be 1 wei or more.
`held` counts every fee paid in and every payout out, and a payout larger than
`held` is refused. Every payout goes through `_pay()`, which writes the
status, the payee and the time before `_send()` moves anything.

## A parse failure is an error, never a ruling

An unusable answer is retried once inside the block, then raised as
`[LLM_ERROR]`. The validator never agrees with an error, so the call fails,
nothing is stored, and the try is not used up. A broken model cannot pay a
translator or burn their chance.

## The agreed ruling is checked twice

The validator refuses a ruling that is neither option before it spends a
prompt. The deterministic half checks the agreed ruling again before it is
stored. That second check is unreachable through any public call today, and a
structural test keeps it there.

## Tagging untrusted text is not a fence

The source, the languages and every draft are written by someone with a stake.
`fence()` replaces `< > [ ]` at the prompt boundary, length preserved, and the
contract labels the options itself. Stored text is kept verbatim; only the
prompt is fenced.

## Why the tests are built the way they are

- **Each node gets its own answers**, and a leader can lie, so every validator check is reachable, and the free layer is measured at zero prompts.
- **The clock and the money are part of the stand-in.** The deadline is tested on its last second and the one after; every payout is checked by the transfers the stand-in recorded, and a refused call pays nobody.
- **The runbook is a test.** The demo is replayed offline from `demo/demo.json` before a transaction is spent; once `deployments/studionet.json` exists, the recorded rulings are replayed through this contract, which must pay and refund exactly as the deployed one did, and the wallets' balances must have moved by exactly the payouts.
- **The port is tested against the contract.** `packages/shared/faithful-vectors.json` is generated from the contract's own functions.
- **Mutation testing.** `scripts/mutate.py` removes each defence and names the test that caught it.

## GenVM constraints this contract obeys

- the runner is pinned (`py-genlayer:1jb45aa8...`), never `test` or `latest`
- the class is named after the product, because `genvm-lint validate` does not see a class named `Contract`; the storage row is called `Job` so no dataclass shares its name
- no `int`, `list`, `dict` or `tuple` as a storage type, and no collection inside a storage dataclass; one flat row per job
- every persistent field is declared in the class body, and every stored field is read somewhere
- the block returns a flat dict of strings, and never pays
- the clock is `gl.message_raw["datetime"]`, converted with integer arithmetic
- the fee is returned by the view as a decimal string, so no client number type rounds it
- the file is pure ASCII
- `genvm-lint` validates against GenVM `v0.3.0-rc7`, the release that ships the pinned runner; `scripts/verify.mjs` sets `GENVM_VERSION` accordingly

## Not upgradable

There is no owner and no admin method. The source a translator worked from is
the source the translation is judged against.

## Success is read from the leader's result, not from ACCEPTED

A refusal is agreed on too: when `deliver()` raises "delivery closed", the
committee accepts that the contract raised it. A script that treats `ACCEPTED`
as success reports a refused write as done. `scripts/lib.mjs` (`outcome()`)
and `scripts/evidence.mjs` read `consensus_data.leader_receipt[0].result.status`
instead: `return` is success, and a `rollback` carries the contract's own
sentence, which is recorded as it was raised.

## Every role is its own wallet, made in memory

`deploy.mjs` and `seed.mjs` make the deployer, the client, the three
translators and the stranger with `generatePrivateKey()` for the run and never
write them anywhere, so on the explorer each role is a different address and
every refusal comes from the account it is about. The client is funded from
the StudioNet faucet (`sim_fundAccount`), and the balance, not the faucet's
answer, decides whether the funding happened. On a funded network the scripts
refuse to run without keys from the environment.

## The deadline is waited out on the chain's time, with a margin

The contract decides the deadline by the transaction's own time. The seed
script reads the sign's `deadline` from the chain and sends the steps that
depend on it only once the local clock is 20 seconds past, so no step is
recorded as the wrong outcome because two clocks disagreed by a few seconds.
