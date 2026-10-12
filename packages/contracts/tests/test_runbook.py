"""
The demo, replayed offline.

scripts/seed.mjs puts the demo on StudioNet from demo/demo.json, step by step.
This file replays the same steps through the real contract in the simulator,
so a demo that could not succeed is caught before a transaction is spent on it.

When deployments/studionet.json exists, the replay goes further: it feeds the
simulator the rulings the validators actually agreed on, and checks that this
repository's contract pays and refunds exactly as the deployed one did and
refuses exactly where it refused.

    pytest tests/test_runbook.py -v
"""

import collections
import hashlib
import json
import pathlib

import pytest

import glsim as S

CONTRACT_PATH = "faithful.py"
M = S.load_contract(CONTRACT_PATH)
RECORD = pathlib.Path("deployments/studionet.json")

import demo as D  # noqa: E402

WHO = {"client": "0x" + "a1" * 20, "ann": "0x" + "b2" * 20, "ben": "0x" + "c3" * 20,
       "cal": "0x" + "d4" * 20, "stranger": "0x" + "e5" * 20}
T0 = 1_790_000_000
J = D.JOBS

# the job each ok deliver step is about, in order
DELIVERED = [s["id"] for s in D.STEPS if s["method"] == "deliver" and s["expect"] == "ok"]


def call_for(step):
    """The method, arguments and value seed.mjs sends for one step."""
    m = step["method"]
    if m == "commission":
        x = J[step["job"]]
        return [x["title"], x["source"], x["source_lang"], x["target_lang"], x["window"]], x["fee"]
    if m == "deliver":
        return [step["id"], D.DRAFTS[step["draft"]]], 0
    return [step["id"]], 0


def replay(rulings, who=WHO):
    """Run the steps. `rulings` are what the ok deliver steps come back with, in order."""
    c = S.deploy(CONTRACT_PATH)
    S.reset_transfers()
    outcomes = []
    clock = T0
    queue = list(rulings)
    for step in D.STEPS:
        clock += 30
        if "after_deadline_of" in step:
            clock = max(clock, M.seconds(c.job(step["after_deadline_of"])["deadline"]) + 20)
        S.set_time(M.iso(clock))
        S.set_mocks()
        if step["method"] == "deliver" and step["expect"] == "ok":
            want = queue.pop(0)
            S.set_mocks(leader_prompts={
                "[0] faithful:": {"option": str(M.FORWARD.index(want)), "because": "replayed"},
                "[0] unfaithful:": {"option": str(M.REVERSED.index(want)), "because": "replayed"}})
        args, value = call_for(step)
        S.set_sender(who[step["who"]])
        try:
            S.call(c, step["method"], *args, value=value)
            outcomes.append(("ok", ""))
        except S.UserError as e:
            outcomes.append(("refused", e.message))
    return c, outcomes


def received():
    out = collections.Counter()
    for to, v in S.transfers():
        out[to] += v
    return out


class TestDemoData:
    def test_every_string_and_amount_the_demo_sends_passes_the_bounds(self):
        for key in D.ORDER:
            x = J[key]
            assert M.bounded(M.clean_text(x["title"]), M.MIN_TITLE, M.MAX_TITLE)
            assert M.bounded(M.clean_text(x["source"]), M.MIN_SOURCE, M.MAX_SOURCE)
            assert 1 <= x["fee"] <= M.MAX_FEE and M.MIN_WINDOW <= x["window"] <= M.MAX_WINDOW
        for text in D.DRAFTS.values():
            assert M.bounded(M.clean_text(text), M.MIN_TRANSLATION, M.MAX_TRANSLATION)

    def test_each_draft_changes_one_thing(self):
        """The leaflet's first draft says once a day and drops the alcohol line;
        the tenancy's first turns 750 into 570 and ten days into thirty; its
        second is accurate but French."""
        assert "twice a day" in J["leaflet"]["source"] and "una vez al día" in D.DRAFTS["leaflet_first"]
        assert "alcohol" in J["leaflet"]["source"] and "alcohol" not in D.DRAFTS["leaflet_first"]
        assert "dos veces al día" in D.DRAFTS["leaflet_second"] and "alcohol" in D.DRAFTS["leaflet_second"]
        assert "750" in J["tenancy"]["source"] and "570" in D.DRAFTS["tenancy_first"]
        assert "treinta" in D.DRAFTS["tenancy_first"] and "Le loyer" in D.DRAFTS["tenancy_second"]
        assert "750" in D.DRAFTS["tenancy_second"] and "dix jours" in D.DRAFTS["tenancy_second"]

    def test_the_windows_outlast_the_steps_meant_to_land_inside_them(self):
        """Fourteen steps after the leaflet is posted are meant to land before
        its deadline, four of them rulings; at up to 60 s a transaction (120 s
        a ruling) they land well inside. The sign is claimed five steps in."""
        assert J["leaflet"]["window"] >= 10 * 60 + 4 * 120 and J["tenancy"]["window"] == J["leaflet"]["window"]
        assert J["sign"]["window"] >= 6 * 60


class TestReplay:
    def test_the_demo_succeeds_and_refuses_exactly_where_it_says(self):
        _, outcomes = replay(D.EXPECTED_RULINGS)
        assert [o for o, _ in outcomes] == [s["expect"] for s in D.STEPS]

    def test_the_refusals_say_why(self):
        _, outcomes = replay(D.EXPECTED_RULINGS)
        msgs = [m for o, m in outcomes if o == "refused"]
        wants = ["the job is open until", "the client cannot claim its own job", "only an open job is claimed",
                 "only the translator who claimed this job", "this job is refunded; only a claimed job",
                 "delivery closed at"]
        assert len(msgs) == len(wants)
        for msg, want in zip(msgs, wants):
            assert want in msg, (want, msg)

    def test_the_expected_rulings_pay_ann_and_refund_the_rest(self):
        c, _ = replay(D.EXPECTED_RULINGS)
        assert [(c.job(k)["status"], c.job(k)["ruling_1"], c.job(k)["ruling_2"], c.job(k)["paid_to"]) for k in range(3)] == [
            ("paid", "unfaithful", "faithful", "translator"), ("refunded", "unfaithful", "unfaithful", "client"),
            ("refunded", "", "", "client")]
        assert S.transfers() == [(WHO["ann"], J["leaflet"]["fee"]), (WHO["client"], J["tenancy"]["fee"]),
                                 (WHO["client"], J["sign"]["fee"])]
        assert c.held_total() == 0


@pytest.mark.skipif(not RECORD.exists(), reason="no deployment recorded yet: pnpm deploy:contract && pnpm seed:contract")
class TestTheRecord:
    def _record(self):
        return json.loads(RECORD.read_text(encoding="utf-8"))

    def test_the_record_is_of_this_source(self):
        here = hashlib.sha256(pathlib.Path(CONTRACT_PATH).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
        assert self._record()["source_sha256"] == here, "the deployed contract is not this file; redeploy"

    def test_every_step_on_chain_did_what_the_demo_expected(self):
        steps = [s for s in self._record()["steps"] if s["step"] != "deploy"]
        assert [("ok" if s["ok"] else "refused") for s in steps] == [s["expect"] for s in D.STEPS]

    def test_this_contract_pays_as_the_deployed_one_did(self):
        rec = self._record()
        rulings = []
        seen = collections.Counter()
        for k in DELIVERED:
            seen[k] += 1
            rulings.append(rec["jobs"][k][f"ruling_{seen[k]}"])
        c, outcomes = replay(rulings)
        assert [o for o, _ in outcomes] == [s["expect"] for s in D.STEPS]
        for x in rec["jobs"]:
            mine = c.job(x["id"])
            for f in ("status", "ruling_1", "ruling_2", "paid_to", "fee", "attempts"):
                assert mine[f] == x[f], (x["id"], f)

    def test_the_payouts_reached_the_wallets(self):
        """The wallets' balances were read from the chain after the fees were
        paid in and once every payout had landed: each moved by exactly what
        the jobs paid it."""
        rec = self._record()
        b = rec["balances"]

        def owed(to, who):
            return sum(int(x["fee"]) for x in rec["jobs"] if x["paid_to"] == to
                       and (to == "client" or x["translator"].lower() == rec["accounts"][who].lower()))

        assert int(b["client_after"]) - int(b["client_before"]) == owed("client", "client")
        assert int(b["ann_after"]) - int(b["ann_before"]) == owed("translator", "ann")
        assert int(b["ben_after"]) - int(b["ben_before"]) == owed("translator", "ben")
