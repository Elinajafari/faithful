"""Mutation pass: break every defence on purpose, confirm a test notices.

Passing tests prove nothing on their own. Each entry below is a small edit to
the contract that removes a defence. The suite must fail for every one of them,
and this script records WHICH test caught it, so the table in the README is
measured rather than claimed.

    python scripts/mutate.py            # run them all, print what caught what
    python scripts/mutate.py --md       # emit the markdown table for the README

An escaping mutation is a finding, not a nuisance: either a missing test, or a
later defence strict enough that an earlier test can no longer fail. The script
exits non-zero if anything escapes, and refuses to run on a red baseline.

Three rules keep the harness honest:

  * the unmutated suite must be green before anything is mutated;
  * a find string that is missing, or matches more than once, is a failure of
    the harness, never a skip, so refactoring cannot quietly turn a row off;
  * scripts/lift.py runs inside every mutated copy before the suite, so the lib
    parity test can never stand in for the behavioural test a mutation deserves.
"""

import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).absolute().parent.parent
TARGET = "faithful.py"

FENCE = '    return str(raw).replace("<", "(").replace(">", ")").replace("[", "(").replace("]", ")")'


def status_check(status, msg):
    """The status check of one method, found by its unique refusal sentence."""
    return (f"        if str(j.status) != {status}:\n            raise gl.vm.UserError(f\"{{ERR_EXPECTED}} {msg}",
            f"        if False:\n            raise gl.vm.UserError(f\"{{ERR_EXPECTED}} {msg}")


MUTATIONS = [
    # -- the clock: a late delivery must never take back money already due
    ("a delivery after the deadline is ruled",
     "        if now > int(j.deadline):\n            raise gl.vm.UserError(f\"{ERR_EXPECTED} delivery closed",
     "        if False:\n            raise gl.vm.UserError(f\"{ERR_EXPECTED} delivery closed"),
    ("a delivery on the last second is refused",
     "        if now > int(j.deadline):\n            raise gl.vm.UserError(f\"{ERR_EXPECTED} delivery closed",
     "        if now >= int(j.deadline):\n            raise gl.vm.UserError(f\"{ERR_EXPECTED} delivery closed"),
    ("a claim after the deadline is accepted",
     "        if now > int(j.deadline):\n            raise gl.vm.UserError(f\"{ERR_EXPECTED} the deadline passed",
     "        if False:\n            raise gl.vm.UserError(f\"{ERR_EXPECTED} the deadline passed"),
    ("a release before the deadline is accepted", "        if now <= int(j.deadline):", "        if False:"),
    ("the deadline ignores the window", "deadline=u256(now + w)", "deadline=u256(now + MAX_WINDOW)"),

    # -- who may write
    ("the client may claim its own job", "        if sender == j.client:", "        if False:"),
    ("anyone may deliver", "        if gl.message.sender_address != j.translator:", "        if False:"),
    ("a claimed job is claimed again", *status_check("OPEN", "this job is {j.status}; only an open job is claimed")),
    ("an unclaimed or settled job takes a delivery",
     *status_check("CLAIMED", "this job is {j.status}; only a claimed job takes a delivery")),
    ("a settled job is released again", "        if status != OPEN and status != CLAIMED:", "        if False:"),
    ("the claimant is not recorded", "        j.translator = sender", "        pass"),

    # -- what commission() and deliver() accept
    ("a title of any length is accepted", "        if not bounded(t, MIN_TITLE, MAX_TITLE):", "        if False:"),
    ("a source of any length is accepted", "        if not bounded(body, MIN_SOURCE, MAX_SOURCE):", "        if False:"),
    ("a language of any length is accepted",
     "        if not bounded(a, MIN_LANGUAGE, MAX_LANGUAGE) or not bounded(b, MIN_LANGUAGE, MAX_LANGUAGE):", "        if False:"),
    ("the same language both ways is accepted", "        if a.lower() == b.lower():", "        if False:"),
    ("a window of any length is accepted", "        if w < MIN_WINDOW or w > MAX_WINDOW:", "        if False:"),
    ("a fee of zero is accepted", "        if fee < 1 or fee > MAX_FEE:", "        if fee > MAX_FEE:"),
    ("a translation of any length is accepted",
     "        if not bounded(body, MIN_TRANSLATION, MAX_TRANSLATION):", "        if False:"),
    ("control characters are stored", '            out.append(" ")\n        else:', "            out.append(ch)\n        else:"),

    # -- what the contract decides
    ("an unfaithful first try refunds the client", "    if attempt >= MAX_ATTEMPTS:", "    if attempt >= 1:"),
    ("an unfaithful second try allows a third", "    if attempt >= MAX_ATTEMPTS:", "    if attempt > MAX_ATTEMPTS:"),
    ("an unfaithful translation pays the translator", '    if ruling == FAITHFUL:\n        return "translator"',
     '    if True:\n        return "translator"'),
    ("a refund goes to the translator", '        self._send(j.translator if to == "translator" else j.client, int(j.fee))',
     "        self._send(j.translator, int(j.fee))"),
    ("a payment goes to the client", '        self._send(j.translator if to == "translator" else j.client, int(j.fee))',
     "        self._send(j.client, int(j.fee))"),
    ("a refund is marked paid", '        j.status = PAID if to == "translator" else REFUNDED', "        j.status = PAID"),
    ("a release pays the translator", '        self._pay(j, "client", now)', '        self._pay(j, "translator", now)'),
    ("a ruling that moves nothing still pays", '        if to != "":\n            self._pay(j, to, now)',
     '        self._pay(j, to or "translator", now)'),
    ("the attempt is not counted", "        j.attempts = u256(attempt)", "        pass"),
    ("the second draft overwrites the first",
     "        if attempt == 1:\n            j.draft_1 = body", "        if True:\n            j.draft_1 = body"),

    # -- money
    ("the held counter is not raised", "        self.held = u256(int(self.held) + fee)", "        pass"),
    ("a payout beyond what is held is sent", "        if amount > int(self.held):", "        if False:"),
    ("the held counter is not lowered", "        self.held = u256(int(self.held) - amount)", "        pass"),

    # -- the two orders
    ("the second pass is asked in the forward order",
     "            rev, _ = ask(source_lang, target_lang, source, body, REVERSED)",
     "            rev, _ = ask(source_lang, target_lang, source, body, FORWARD)"),
    ("the reversed order is not reversed", "REVERSED = [UNFAITHFUL, FAITHFUL]", "REVERSED = [FAITHFUL, UNFAITHFUL]"),
    ("a disagreement between the orders keeps the forward ruling",
     "    return forward if forward == reverse else UNFAITHFUL", "    return forward"),
    ("a disagreement between the orders pays the translator",
     "    return forward if forward == reverse else UNFAITHFUL", "    return forward if forward == reverse else FAITHFUL"),
    ("an answer is not read back through its order", "    return order[int(choice)]", "    return FORWARD[int(choice)]"),

    # -- reading the model
    ("an option past the list is accepted", "    if k < 0 or k >= n:", "    if False:"),
    ("an answer in words is read as a number",
     '    if s == "" or any(ch not in "0123456789" for ch in s) or len(s) > 2:', '    if s == "":'),
    ("an unusable answer is not retried", "    for _ in range(2):", "    for _ in range(1):"),
    ("a bare value is read as if it were an object", "        if isinstance(raw, dict):", "        if True:"),
    ("an unusable answer becomes unfaithful",
     '    raise gl.vm.UserError(f"{ERR_LLM} the model named neither option")', '    return UNFAITHFUL, ""'),

    # -- the validator
    ("the validator agrees with a leader error",
     "                # An [LLM_ERROR] is never agreed with.\n                return False",
     "                # An [LLM_ERROR] is never agreed with.\n                return True"),
    ("the validator skips the free structural check", "            if not ruling_sound(proposed):", "            if False:"),
    ("the validator agrees with anything", '            return faithful_agrees(mine["ruling"], proposed)', "            return True"),
    ("the validator agrees when its own model fails",
     "            except gl.vm.UserError:\n                return False", "            except gl.vm.UserError:\n                return True"),
    ("agreement ignores the structural check",
     "    return ruling_sound(mine) and ruling_sound(theirs) and str(mine) == str(theirs)", "    return str(mine) == str(theirs)"),
    ("any word is a sound ruling", "    return ruling == FAITHFUL or ruling == UNFAITHFUL", '    return ruling != ""'),

    # -- the prompt boundary
    ("the fence does nothing", FENCE, "    return str(raw)"),
    ("the fence leaves square brackets", FENCE, '    return str(raw).replace("<", "(").replace(">", ")")'),
    ("the translation reaches the prompt unfenced", "{fence(translation)}", "{translation}"),
    ("the source reaches the prompt unfenced", "{fence(source)}", "{source}"),
    ("the source language reaches the prompt unfenced", "{fence(source_lang)}", "{source_lang}"),
    ("the target language reaches the prompt unfenced", "{fence(target_lang)}", "{target_lang}"),
    ("the prompt no longer checks numbers and negations",
     "Check every fact,\nnumber, date, name, quantity, condition and negation. ", ""),
    ("the prompt judges elegance",
     "Do not judge\nwhether the translation is elegant, or whether the source is right, only\nwhether the translation says what the source says, in the target language.",
     "Judge\nwhether the translation is elegant."),
    ("the options no longer name the target language",
     "; or it is not written in \"\n                 \"the target language",
     "\"\n                 \""),
    ("the leader's reason is stored raw", '        j.why = sanitise_reason(res.get("because", ""))', '        j.why = str(res.get("because", ""))'),
    ("the leader's reason is not capped", '    return " ".join("".join(out).split())[:limit]', '    return " ".join("".join(out).split())'),
]


PYTEST = [sys.executable, "-m", "pytest", "tests/", "-x", "-q", "--no-header", "-p", "no:cacheprovider"]


def copy_repo(tmp):
    dst = pathlib.Path(tmp) / "repo"
    shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns(
        "__pycache__", ".pytest_cache", ".git", "artifacts", "*.pyc", "node_modules", "deployments"))
    # tests/test_vectors.py and tests/test_shape.py read ../shared; a mutant
    # must face the same vectors and the same described surface.
    shared = pathlib.Path(tmp) / "shared"
    shared.mkdir()
    for name in ("faithful-vectors.json", "contract-shape.json"):
        shutil.copy(ROOT.parent / "shared" / name, shared / name)
    return dst


def run_one(label, find, replace):
    with tempfile.TemporaryDirectory() as tmp:
        dst = copy_repo(tmp)
        target = dst / TARGET
        src = target.read_text(encoding="utf-8")
        hits = src.count(find)
        if hits == 0:
            return "PATTERN NOT FOUND", None
        if hits > 1:
            return "PATTERN NOT UNIQUE", None
        target.write_text(src.replace(find, replace, 1), encoding="utf-8", newline="\n")
        subprocess.run([sys.executable, "scripts/lift.py"], cwd=dst, capture_output=True)
        proc = subprocess.run(PYTEST, cwd=dst, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
        if proc.returncode == 0:
            return "ESCAPED", None
        text = proc.stdout + proc.stderr
        m = re.search(r"^(?:FAILED|ERROR) (\S+?)::(\S+?)(?:\[|\s|$)", text, re.M)
        if m:
            return "caught", m.group(2).split("::")[-1]
        m = re.search(r"^E\s+(\w*(?:Error|Exception))", text, re.M)
        if m:
            return "caught", m.group(1) + " at import"
        return "caught", "unnamed failure"


def baseline_is_green():
    with tempfile.TemporaryDirectory() as tmp:
        dst = copy_repo(tmp)
        proc = subprocess.run(PYTEST, cwd=dst, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
        return proc.returncode == 0, (proc.stdout + proc.stderr)[-2000:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", action="store_true", help="emit the README table")
    args = ap.parse_args()

    green, tail = baseline_is_green()
    if not green:
        print("the unmutated suite is not green; every mutation would look caught:\n" + tail, file=sys.stderr)
        return 2

    rows, escaped = [], []
    for label, find, replace in MUTATIONS:
        status, test = run_one(label, find, replace)
        if status == "caught":
            rows.append((label, test))
            if not args.md:
                print("  caught   %-70s %s" % (label, test), flush=True)
        else:
            escaped.append((label, status))
            print("  %-8s %s" % (status, label), file=sys.stderr, flush=True)

    if args.md:
        print("| Mutation | Caught by |")
        print("|---|---|")
        for label, test in rows:
            print("| %s | `%s` |" % (label, test))
    else:
        print()
        print("  %d mutations, %d caught, %d escaped" % (len(MUTATIONS), len(rows), len(escaped)))
    return 1 if escaped else 0


if __name__ == "__main__":
    sys.exit(main())
