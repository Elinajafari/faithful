# Faithful - GenLayer Intelligent Contract

[`faithful.py`](./faithful.py) is the whole protocol: the client posts a
source text, the two languages and a deadline, and pays the fee into the
contract; a translator claims the job; the translator delivers, and in the
same transaction validators rule by consensus, in two orders, whether the
translation says what the source says; the contract pays the translator, or
allows one more try, or refunds the client.

## Core rule

```
the source, the languages and the deadline are frozen at commission(), with the fee paid in
a ruling is one of two options the contract wrote: faithful or unfaithful; the model never sees the fee or a party
faithful pays the translator; the two orders must agree, else unfaithful
an unfaithful first try moves nothing; an unfaithful second try refunds the client
the translator who wants to be paid carries the burden: no faithful delivery by the deadline refunds the client
```

## Lifecycle

```
client:      commission(title, source, source_lang, target_lang, window)   pays the fee in; the deadline starts
translator:  claim(id)                 once, first come, not the client, before the deadline
translator:  deliver(id, translation)  until the deadline: [validators, both orders] -> faithful: translator paid
                                                                                       unfaithful: one more try,
                                                                                       or on the 2nd the client refunded
                                       after it: refused before any model
anyone:      release(id)               after the deadline, if nothing faithful arrived -> the client is refunded
anyone:      count, held_total, status, job
```

Judgment fails **closed**: an unusable model answer is retried once inside
the block and then raised as `[LLM_ERROR]`, which no validator agrees with.
It never moves money and never uses up a try. The deadline ends in someone
being paid: nobody can hold the fee by doing nothing.

## Deploy

```bash
pnpm install                          # from the repo root
pnpm deploy:contract                  # studionet, a deployer key made for this run
pnpm deploy:contract testnet-asimov   # needs DEPLOYER_PRIVATE_KEY in .env
pnpm seed:contract                    # the demo, recorded in deployments/studionet.json
pnpm e2e:contract                     # the record checked against the chain
pnpm verify:contract                  # deployed source == faithful.py, and genvm-lint on it
pnpm evidence:contract                # EVIDENCE.md at the repo root, from the chain
```

Every script reads a transaction's outcome from the leader's result
(`return` or `rollback`), never from `ACCEPTED` alone: the committee accepts a
refusal too. Sends are nonce-guarded, so a lost answer is never sent twice. On
studionet the client is funded from the StudioNet faucet, and the payouts are
checked by reading the wallets' balances from the chain after the fees were
paid in and once every payout has landed. Why each rule is the way it is:
[DECISIONS.md](DECISIONS.md).

## Surface

| Thing | What it is |
|---|---|
| **Job** | a title, a source text of 20 to 2000 characters, two different languages, a fee in wei and a window of 60 s to 60 days, all frozen at `commission()` |
| **Translator** | whoever claims the job first; the only one who may deliver |
| **Delivery** | a translation of 10 to 4000 characters, ruled in the call that delivers it; at most two |
| **Ruling** | `faithful` (the translator is paid) or `unfaithful` (one more try, then a refund) |
| **Status** | `open` → `claimed` → `paid` or `refunded`; or `open` → `refunded` when nobody claims it in time |

| Write | Caller | Why |
|---|---|---|
| `commission(title, source, source_lang, target_lang, window)` *payable* | anyone, paying the fee in | the caller becomes the client |
| `claim(id)` | anyone but the client, once, before the deadline | one translator per job, on the record |
| `deliver(id, translation)` | the translator who claimed it, before the deadline, at most twice | a ruling spends inference on every validator, so only the one who will be paid may ask |
| `release(id)` | anyone, deliberately, after the deadline | it reads no model and refunds the client only what the clock already says is due |

| View | Returns |
|---|---|
| `count()` | number of jobs |
| `held_total()` | wei held for unsettled jobs; equals the contract's accepted balance while the accounting is right |
| `status(id)` | one word for another contract |
| `job(id)` | everything about a job: the frozen source and languages, the parties, the deadline, both drafts and their rulings, who was paid |

## How it holds together

```
commission()  payable       the source exists, and the fee is held by the contract, before anyone translates
claim(id)                   one translator, with the chain's time
deliver(id, translation)
  └─ nondet block
        leader                                    validator
        ask with the options faithful,            refuse a ruling that is neither
        unfaithful, then reversed                 option (free)
        same option in both → it, else            ask both orders itself, compare exactly
        unfaithful                                an [LLM_ERROR] is never agreed with
        no fee, no party, no try number enters the block
  deterministic half: check the ruling again, count the try, pay, refund, or wait for the next
release(id)                 no faithful delivery by the deadline: the client is refunded
```

A translation that only reads as faithful when that option is listed first
does not clearly say what the source says, and the translator who wants to be
paid carries the burden of showing it. That uncertainty goes into the value
(unfaithful), never into the comparison.

## Threat model

| Attack | What stops it |
|---|---|
| A source edited after delivery to make a translation miss it | it is frozen at `commission()`, before anyone claims the job |
| A fluent translation that drops the hard sentence | the prompt checks every fact, number, date, name, condition and negation; the demo's leaflet without its alcohol warning is ruled `unfaithful` on chain |
| A correct translation into the wrong language | the options say a text not written in the target language is unfaithful; the demo's French draft is ruled `unfaithful` on chain |
| The model deciding who deserves the money | it never sees the fee, the parties or which try it is, and only picks one of two options the contract wrote |
| A leader that invents a fault, or hides one | every validator asks both orders itself and must match exactly |
| A leader proposes a ruling that is neither option | refused for free before the validator spends a prompt, and again in the deterministic half |
| A broken model moves money, or burns a try, by failing | an unusable answer is retried once, then raised as `[LLM_ERROR]`, which no validator agrees with and which rolls the try back |
| A ruling that depends on the order it was shown | both orders inside one block; a difference is `unfaithful` |
| A translator who keeps trying until something passes | two deliveries per job; the second unfaithful one refunds the client and closes the job |
| A late delivery that takes back money already due | `deliver()` refuses once the deadline passes, before any model; `release()` refunds the client |
| A translator who claims and vanishes, holding the job | anyone may `release()` after the deadline |
| Paying out another job's money | the contract counts what it holds per fee paid in; a payout beyond it is refused |
| A stranger or the client delivering | `deliver()` checks the sender against the translator who claimed; a static test walks the source for it |
| Prompt injection inside the source or a translation | `fence()` replaces `< > [ ]` at the prompt boundary and the contract numbers the options itself |
| A script reports "done" when the contract refused | success is the leader's `return`, not `ACCEPTED`; a `rollback` is recorded with the contract's own sentence |

## Tests

The suite runs on [`tests/glsim.py`](tests/glsim.py), a small GenVM stand-in
that executes the real contract file, gives the leader and the validator their
own mock answers, can make a leader lie, sets the chain's clock, carries the
value a call sends and the transfers it makes, and refuses what GenVM refuses.
What each file covers, and what every demo transaction proves, is in
[tests/README.md](tests/README.md).

<!-- measured:tests:start -->
Measured: **116 passed**, 0 skipped, including the checks of the live record in `deployments/studionet.json`, which run once `pnpm seed:contract` has written it. The same record is checked against the chain itself by `pnpm e2e:contract`.
<!-- measured:tests:end -->

**The tests have teeth.** [`scripts/mutate.py`](scripts/mutate.py) removes every
defence one at a time and names the test that caught each mutant. It refuses to
run on a red baseline and exits non-zero if anything escapes.

<!-- measured:mutations:start -->
Measured: **59 mutations, 59 caught, 0 escaped.**

| Mutation | Caught by |
|---|---|
| a delivery after the deadline is ruled | `test_a_delivery_on_the_last_second_is_ruled_and_one_after_is_refused_for_free` |
| a delivery on the last second is refused | `test_a_delivery_on_the_last_second_is_ruled_and_one_after_is_refused_for_free` |
| a claim after the deadline is accepted | `test_claims_close_at_the_deadline` |
| a release before the deadline is accepted | `test_an_unclaimed_job_is_released_to_the_client_after_the_deadline` |
| the deadline ignores the window | `test_a_job_is_posted_with_its_source_frozen_and_the_fee_held` |
| the client may claim its own job | `test_the_client_cannot_claim` |
| anyone may deliver | `test_only_the_translator_who_claimed_may_deliver` |
| a claimed job is claimed again | `test_a_translator_claims_once` |
| an unclaimed or settled job takes a delivery | `test_a_second_unfaithful_translation_refunds_the_client_and_ends_the_job` |
| a settled job is released again | `test_a_settled_job_is_not_released` |
| the claimant is not recorded | `test_a_translator_claims_once` |
| a title of any length is accepted | `test_the_title_and_source_are_bounded` |
| a source of any length is accepted | `test_the_title_and_source_are_bounded` |
| a language of any length is accepted | `test_a_language_name_is_bounded` |
| the same language both ways is accepted | `test_the_languages_must_differ` |
| a window of any length is accepted | `test_the_window_is_bounded` |
| a fee of zero is accepted | `test_a_fee_must_be_paid_in` |
| a translation of any length is accepted | `test_the_translation_length_bounds` |
| control characters are stored | `test_clean_text_collapses_whitespace_and_control_characters` |
| an unfaithful first try refunds the client | `test_a_first_unfaithful_translation_moves_nothing_and_allows_one_more_try` |
| an unfaithful second try allows a third | `test_a_second_unfaithful_translation_refunds_the_client_and_ends_the_job` |
| an unfaithful translation pays the translator | `test_a_first_unfaithful_translation_moves_nothing_and_allows_one_more_try` |
| a refund goes to the translator | `test_a_second_unfaithful_translation_refunds_the_client_and_ends_the_job` |
| a payment goes to the client | `test_a_faithful_translation_pays_the_translator` |
| a refund is marked paid | `test_a_second_unfaithful_translation_refunds_the_client_and_ends_the_job` |
| a release pays the translator | `test_an_unclaimed_job_is_released_to_the_client_after_the_deadline` |
| a ruling that moves nothing still pays | `test_a_first_unfaithful_translation_moves_nothing_and_allows_one_more_try` |
| the attempt is not counted | `test_a_faithful_translation_pays_the_translator` |
| the second draft overwrites the first | `test_a_first_unfaithful_translation_moves_nothing_and_allows_one_more_try` |
| the held counter is not raised | `test_a_job_is_posted_with_its_source_frozen_and_the_fee_held` |
| a payout beyond what is held is sent | `test_a_payout_beyond_what_is_held_is_refused` |
| the held counter is not lowered | `test_a_faithful_translation_pays_the_translator` |
| the second pass is asked in the forward order | `test_the_options_are_asked_in_both_orders` |
| the reversed order is not reversed | `test_the_options_are_asked_in_both_orders` |
| a disagreement between the orders keeps the forward ruling | `test_a_model_that_always_answers_0_pays_nobody` |
| a disagreement between the orders pays the translator | `test_a_model_that_always_answers_0_pays_nobody` |
| an answer is not read back through its order | `test_a_faithful_translation_pays_the_translator` |
| an option past the list is accepted | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| an answer in words is read as a number | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| an unusable answer is not retried | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| a bare value is read as if it were an object | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| an unusable answer becomes unfaithful | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| the validator agrees with a leader error | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| the validator skips the free structural check | `test_a_ruling_that_is_neither_option_is_refused_for_free` |
| the validator agrees with anything | `test_nodes_that_rule_differently_do_not_agree` |
| the validator agrees when its own model fails | `test_a_validator_whose_model_fails_does_not_agree` |
| agreement ignores the structural check | `test_agreement_is_exact_symmetric_and_over_sound_rulings` |
| any word is a sound ruling | `test_a_ruling_that_is_neither_option_is_refused_for_free` |
| the fence does nothing | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the fence leaves square brackets | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the translation reaches the prompt unfenced | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the source reaches the prompt unfenced | `test_every_value_interpolated_into_the_prompt_is_fenced_or_ours` |
| the source language reaches the prompt unfenced | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the target language reaches the prompt unfenced | `test_every_value_interpolated_into_the_prompt_is_fenced_or_ours` |
| the prompt no longer checks numbers and negations | `test_the_prompt_checks_meaning_and_language_and_never_shows_money` |
| the prompt judges elegance | `test_the_prompt_checks_meaning_and_language_and_never_shows_money` |
| the options no longer name the target language | `test_the_prompt_checks_meaning_and_language_and_never_shows_money` |
| the leader's reason is stored raw | `test_the_reason_is_not_compared_and_is_stored_sanitised` |
| the leader's reason is not capped | `test_the_reason_is_not_compared_and_is_stored_sanitised` |
<!-- measured:mutations:end -->

## Verified against the live deployment

<!-- measured:deployment:start -->
Deployed on studionet at [`0xd91BB7Da22D3d4f672Eb346CeE6941c3557A98F1`](https://explorer-studio.genlayer.com/address/0xd91BB7Da22D3d4f672Eb346CeE6941c3557A98F1) (deploy [`0x9bf92639...`](https://explorer-studio.genlayer.com/tx/0x9bf92639c23e6b531e9149da90b56a2f81c8bcb031dc3ccfa20d38796065cb84)). Every value below was read back from the chain by `scripts/seed.mjs` and written to [`deployments/studionet.json`](deployments/studionet.json); none of it is typed by hand.

| Job | Fee | First delivery | Second delivery | Paid to | Reason the leader gave last (not consensus) |
|---|---|---|---|---|---|
| 0: Pharmacy leaflet: how to take the antibiotic (English to Spanish) | 0.3 GEN | **unfaithful** | **faithful** | translator | The translation accurately conveys all instructions, conditions, and warnings from the source text without any omissions or changes in meani |
| 1: Tenancy notice: rent and deposit (English to Spanish) | 0.2 GEN | **unfaithful** | **unfaithful** | client | The translation is written in French instead of the specified target language, Spanish. |
| 2: Shop sign: opening hours (English to Spanish) | 0.1 GEN | never delivered: the deadline passed and a late delivery was refused | - | client | - |

The wallets' balances were read from the chain after the fees were paid in and once every payout had landed: the client went from 1.4 GEN to 1.7 GEN, Ann, who translated, from 0 GEN to 0.3 GEN, and Ben from 0 GEN to 0 GEN.

Every transaction, in order, refusals included, with the wallet that sent it:

| Step | From | Outcome | Transaction |
|---|---|---|---|
| job 0: a pharmacy leaflet, 0.3 GEN | client | ok | [`0x9054507c...`](https://explorer-studio.genlayer.com/tx/0x9054507ca0fa6c1ed7a144c782f1c251dcd91ff26073fa9ca934e0c72b60da0b) |
| job 1: a tenancy notice, 0.2 GEN | client | ok | [`0xbf835d0c...`](https://explorer-studio.genlayer.com/tx/0xbf835d0c17cb5745db3d0d1293a556ec7a8535e9bf5bee6b050b3c1a6f0d21be) |
| job 2: a shop sign, 0.1 GEN | client | ok | [`0x2e776836...`](https://explorer-studio.genlayer.com/tx/0x2e7768363e6b7970284bbd65ee0640986ab2420a58e6fe5987a83f6c37ee63bf) |
| a release before the sign's deadline | stranger | refused: the job is open until 2026-10-12T03:06:05Z | [`0x0e9c6d05...`](https://explorer-studio.genlayer.com/tx/0x0e9c6d052e3a32bde70efa10e39aa18753e09f178a1aab98cc649f1606ff2660) |
| the client claims its own job | client | refused: the client cannot claim its own job | [`0x6072a2aa...`](https://explorer-studio.genlayer.com/tx/0x6072a2aa4f7839501c79574954e87443d3377001652b6bc8e179a010bf112016) |
| Ann claims the leaflet | ann | ok | [`0x3cd48e14...`](https://explorer-studio.genlayer.com/tx/0x3cd48e14c5d1cc3b38b0db2bf6565f82319106766a40f0245e83eb5d9d1ec055) |
| Ben claims the leaflet too | ben | refused: this job is claimed; only an open job is claimed | [`0x64d28fd5...`](https://explorer-studio.genlayer.com/tx/0x64d28fd5040d99a58d4605fd11901d54356246cf3ba6ba9e0f78293bc45599b2) |
| Ben claims the tenancy notice | ben | ok | [`0x6a18f6a4...`](https://explorer-studio.genlayer.com/tx/0x6a18f6a498ee68aac7a42de6b98a92aba92fc89ea8b7aa87cc88abc693c5b9c4) |
| Cal claims the shop sign | cal | ok | [`0x3c53c431...`](https://explorer-studio.genlayer.com/tx/0x3c53c431e378d86dd776f227d928fd797dfd368e57125b54528b24741c538981) |
| a stranger delivers the leaflet | stranger | refused: only the translator who claimed this job may deliver | [`0x07acae78...`](https://explorer-studio.genlayer.com/tx/0x07acae7887b1f4858adb05efddc6da5dcdea7350ff524318faa212e32cb51acd) |
| the leaflet, 1st try: once a day, no alcohol line | ann | ok | [`0x6512065a...`](https://explorer-studio.genlayer.com/tx/0x6512065a3c9c9bcf1c640ba3eb4ed864c80ba9d46826627ae0d1ef55a42014f1) |
| the leaflet, 2nd try | ann | ok | [`0x37a63d81...`](https://explorer-studio.genlayer.com/tx/0x37a63d81be9e781e6182f0017badce751e285d906b57af2456267c3103ebb380) |
| the tenancy, 1st try: 570 pounds, thirty days | ben | ok | [`0xbd8613e3...`](https://explorer-studio.genlayer.com/tx/0xbd8613e3d34e9b84058a1793e128bb4b36c055f27bda69722df3fc64afc8d883) |
| the tenancy, 2nd try: in French | ben | ok | [`0x7396e707...`](https://explorer-studio.genlayer.com/tx/0x7396e707868988b2c49563431c50925500e4db32bdbd052d8d1e5758e9d8b9ab) |
| the tenancy, a third try | ben | refused: this job is refunded; only a claimed job takes a delivery | [`0xc5f1dfe2...`](https://explorer-studio.genlayer.com/tx/0xc5f1dfe21ced90e05146f2b7a41f76d5029772909549b1a98e0ba5a609af1e5d) |
| the sign delivered after its deadline | cal | refused: delivery closed at 2026-10-12T03:06:05Z; a late translation is never ruled, and release() refunds the client | [`0x29547351...`](https://explorer-studio.genlayer.com/tx/0x29547351c7029bfcbfc553fc4ff279ff7b4f9fcd27b79048b94685265c6e9529) |
| the sign released: the client refunded | stranger | ok | [`0xcef8137c...`](https://explorer-studio.genlayer.com/tx/0xcef8137cfd5337bb48fb30a80f6ffc0273b133106abbc28c3d667af56cc75187) |

`tests/test_runbook.py::TestTheRecord` replays these rulings through this repository's contract and fails unless it pays and refunds exactly as the deployed one did.
<!-- measured:deployment:end -->

On top of the record: `pnpm e2e:contract` asks the chain again for every transaction
and every job and checks each against the record, along with the wallets'
balances, and `pnpm verify:contract` reads the deployed source back with
`gen_getContractCode`, compares it byte for byte with
`packages/contracts/faithful.py`, and runs genvm-lint on the deployed bytes.

## Known limits

- Validators judge meaning, not quality: a faithful but clumsy translation is paid. A client who wants style needs a second round outside the contract.
- Validators read the two texts the model is given; a translation that depends on context outside the source (a glossary, a brand voice) is judged without it.
- One translator per job, the native token only, whole wei.
- StudioNet is a test network; its state can be reset.

## Path forward

- A glossary frozen with the source, shown to the model as terms that must be kept.
- Several jobs from one long document, each a paragraph, so a long text is paid paragraph by paragraph.
- A front end that lists open jobs and shows each one's deadline and drafts.
