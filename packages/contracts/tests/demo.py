"""The demo's data, loaded from demo/demo.json.

scripts/seed.mjs sends exactly these strings and these steps to StudioNet, and
tests/test_runbook.py replays them offline, so the demo on the explorer and the
demo the tests check cannot drift apart.

Three jobs from one client, English into Spanish:

  LEAFLET  a pharmacy leaflet. Ann's first try says once a day and drops the
           alcohol warning: unfaithful, one more try. Her second says it all:
           faithful, Ann is paid
  TENANCY  a tenancy notice. Ben's first try turns 750 into 570 and ten days
           into thirty: unfaithful. His second is accurate, but in French:
           unfaithful, the client is refunded, and a third try is refused
  SIGN     a shop sign. Cal claims it and never delivers: a delivery after the
           deadline is refused before any model, and release() refunds the
           client
"""

import json
import pathlib

_DATA = json.loads((pathlib.Path(__file__).absolute().parent.parent / "demo" / "demo.json").read_text(encoding="utf-8"))

JOBS = {k: {**v, "fee": int(v["fee"])} for k, v in _DATA["jobs"].items()}
ORDER = ["leaflet", "tenancy", "sign"]       # job ids 0, 1, 2
DRAFTS = _DATA["drafts"]
STEPS = _DATA["steps"]

# the ruling each ok deliver step is expected to come back with, in order
EXPECTED_RULINGS = _DATA["expected_rulings"]
