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


def run(stub_body: str, rounds: int = 3, **extra):
    with tempfile.TemporaryDirectory() as d:
        stub = Path(d) / 'writer'
        stub.write_text('#!/usr/bin/env bash\n' + stub_body)
        stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
        env = dict(os.environ, CRASH_WRITER=str(stub), ROUNDS=str(rounds), **extra)
        return subprocess.run(['bash', str(LOOP)], env=env, capture_output=True, text=True)


class CrashLoop(unittest.TestCase):
    def test_a_writer_that_exits_on_its_own_fails_the_run(self):
        # A fixed delay, because the random 1-40 ms window is shorter than the
        # time a busy macOS takes to start even this stub: every round could end
        # in the kill and the run would blame the wrong thing.
        r = run('exit 101\n', CRASH_KILL_MS='600')
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('exited by itself with status 101', r.stdout)

    def test_a_writer_slower_than_the_random_window_is_still_judged_by_what_it_did(self):
        r = run('sleep 0.2\nexit 101\n', CRASH_KILL_MS='900')
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('exited by itself with status 101', r.stdout)

    def test_a_kill_delay_that_is_not_a_number_of_milliseconds_is_refused(self):
        for bad in ('0', '1000', 'abc', '-5'):
            r = run('exit 101\n', CRASH_KILL_MS=bad)
            self.assertEqual(r.returncode, 2, (bad, r.stdout, r.stderr))
            self.assertIn('CRASH_KILL_MS must be a number from 1 to 999', r.stderr)

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

    def test_a_writer_that_outlives_its_kill_ends_the_run_in_seconds_not_hours(self):
        # The Windows leg of the nightly hung for GitHub's six hours on every night
        # from 05/11 to 09/11, in a random round each time. A real writer cannot
        # survive SIGKILL on Linux, so the copy of the loop under test has a `stop`
        # that does nothing: what is measured is the five-second limit on the wait
        # and what the run says, not the platform's kill.
        with tempfile.TemporaryDirectory() as d:
            loop = Path(d) / 'loop.sh'
            text = LOOP.read_text()
            line = '  stop() { kill -9 "$1" 2>/dev/null; }\n'
            self.assertEqual(text.count(line), 1)
            loop.write_text(text.replace(line, '    stop() { :; }\n'))
            stub = Path(d) / 'writer'
            stub.write_text('#!/usr/bin/env bash\nexec sleep 8\n')
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
            env = dict(os.environ, CRASH_WRITER=str(stub), ROUNDS='3', CRASH_KILL_MS='50')
            r = subprocess.run(['bash', str(loop)], env=env, capture_output=True, text=True, timeout=25)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('was still running 5 s after the kill', r.stdout)


if __name__ == '__main__':
    unittest.main()
