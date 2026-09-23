#!/usr/bin/env python3
"""`tools/crash-save-loop.sh` fails when its writer never wrote (R6-30a).

The loop used to discard the writer's exit status and check the file against
its own header, and the seed it starts from is a valid payload. A writer that
exited on its own -- a failed `write_atomic`, a panic, a stale binary -- left the
seed in place, and every round came back green. These stubs stand in for the
writer through `CRASH_WRITER`, so the refusals are checked without building
anything.
"""
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LOOP = ROOT / 'tools/crash-save-loop.sh'


def run(stub_body: str, rounds: int = 3):
    with tempfile.TemporaryDirectory() as d:
        stub = Path(d) / 'writer'
        stub.write_text('#!/usr/bin/env bash\n' + stub_body)
        stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
        env = dict(os.environ, CRASH_WRITER=str(stub), ROUNDS=str(rounds))
        return subprocess.run(['bash', str(LOOP)], env=env, capture_output=True, text=True)


class CrashLoop(unittest.TestCase):
    def test_a_writer_that_exits_on_its_own_fails_the_run(self):
        r = run('exit 101\n')
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('exited by itself with status 101', r.stdout)

    def test_a_writer_that_never_writes_fails_the_run(self):
        r = run('exec sleep 5\n')
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('never left its seed', r.stdout)

    def test_a_writer_that_writes_and_is_killed_passes(self):
        r = run('printf "LEN=100\\n%s\\nEND\\n" "$(printf "x%.0s" $(seq 100))" > "$1/new" && mv "$1/new" "$1/$2"\n'
                'exec sleep 5\n', rounds=20)
        # Twenty rounds, because a kill can land before the stub has written:
        # all twenty doing so is a (1/4)^20 event, three was 1 in 64.
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == '__main__':
    unittest.main()
