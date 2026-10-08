# The CI server's runner for this repository

> Part of [ADR-103](../../docs/decisions.md#adr-103--macos-and-windows-run-on-a-minor-and-every-night-the-linux-jobs-run-on-every-push)
> and the fleet's CI norm (`CLAUDE.md`, *CI — the fleet's self-hosted runner*).
> Nothing here moves a job until the repository variable `CI_RUNNER` is set; until then
> every job uses GitHub's hosted `ubuntu-latest`.

`Dockerfile` and `entrypoint.sh` build the image `tura-ci-runner`: Ubuntu 22.04
with the Tauri system libraries, a pinned and checksummed Actions runner, and a
`runner` user whose `sudo` is root of the **container** and of nothing else. A
container, and not a runner on the host as the other repositories have, because
this repository is public: the jobs run code from dependencies a Dependabot pull
request brings in, and that code should not be able to touch the machine's other
runners. The runner carries the fleet's label, **`shvia-ci`**, so the same
`runs-on` switch works here as everywhere.

Which jobs may use it (`ci.yml`): `contracts`, `frontend`, `dependency
advisories` and the Linux leg of `rust`. What stays on GitHub whatever the
variable says: Arch and the server container (they need Docker), the Android
core (it needs the NDK the hosted image ships), macOS and Windows, and `disk`
(a container cannot mount a filesystem of its own, which the full-disk test
needs, and the one-second rule watches 21 000 directories against the host's
inotify limits).

**A pull request from a fork never reaches it:** `ci.yml` falls back to
`ubuntu-latest` for those, whatever the variable says. On top of that, the
repository must have *Settings → Actions → General → Fork pull request
workflows → Require approval for all external contributors*, which the fleet norm
makes mandatory for a public repository on `cicd`.

## Bring it up (on the CI server, once)

```sh
# 1. Build the image. The checksum is the runner release's own (v2.337.0).
cd tools/ci-runner
docker build --build-arg RUNNER_SHA256=70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613 -t tura-ci-runner:2 .

# 2. A registration token (valid for an hour), from a machine logged into gh as
#    someone who administers the repository. It goes into a file only the owner of
#    the process can read, and never onto a command line, where `ps` would show it.
umask 077
gh api -X POST repos/samirhvbr/tura-notes/actions/runners/registration-token -q .token \
  | sed 's/^/REG_TOKEN=/' > /srv/runners/ci/reg.env     # on the server, via ssh

# 3. Two runners, so the Linux jobs run side by side as they do on GitHub. The
#    limits keep a build from starving the other repositories' runners.
for n in 1 2; do
  docker volume create tura-ci-$n
  docker run -d --name tura-ci-$n --restart unless-stopped \
    --cpus 4 --memory 5g --memory-swap 5g --pids-limit 4096 \
    --env-file /srv/runners/ci/reg.env \
    -e REPO_URL=https://github.com/samirhvbr/tura-notes \
    -e RUNNER_NAME=cicd-tura-$n -e RUNNER_LABELS=shvia-ci \
    -v tura-ci-$n:/home/runner/r tura-ci-runner:2
done
shred -u /srv/runners/ci/reg.env
```

The token is used once; afterwards the registration lives in the volume. The
entrypoint drops it from the environment before the runner starts.
`docker logs tura-ci-1` should say *Listening for Jobs*, and the runners appear
under Settings → Actions → Runners with the label `shvia-ci`.

## Try it before trusting it

A manual run can point the Linux jobs at it without changing anything else:

```sh
gh workflow run ci.yml -f runner=shvia-ci
```

Read every job of that run. When it is green, make it the default, at
**repository** scope (never organisation scope, which would retarget every
repository at once):

```sh
gh variable set CI_RUNNER --body shvia-ci -R samirhvbr/tura-notes
```

## Going back

```sh
gh variable delete CI_RUNNER -R samirhvbr/tura-notes
```

That alone sends every job back to GitHub. The containers can stay up or go
(`docker rm -f tura-ci-1 tura-ci-2`), and the runners can be removed from the
repository's settings.
