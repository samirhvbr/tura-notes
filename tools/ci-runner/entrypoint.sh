#!/bin/bash
# Start the runner. The first time, it registers itself with the one-time token in
# REG_TOKEN (which GitHub gives for an hour and which is useless afterwards);
# every later start finds `.runner` in the volume and only runs.
set -euo pipefail
cd /home/runner/r
[ -f run.sh ] || cp -a /opt/runner-dist/. .
if [ ! -f .runner ]; then
  : "${REG_TOKEN:?the first start needs REG_TOKEN (a registration token)}"
  : "${REPO_URL:?need REPO_URL, e.g. https://github.com/owner/repo}"
  ./config.sh --unattended --replace \
    --url "$REPO_URL" --token "$REG_TOKEN" \
    --name "${RUNNER_NAME:-tura-ci}" --labels "${RUNNER_LABELS:-shvia-ci}" \
    --work _work
fi
# The token is not needed again and must not stay in the environment of the jobs.
unset REG_TOKEN
exec ./run.sh
