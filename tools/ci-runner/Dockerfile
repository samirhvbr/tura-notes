# The GitHub Actions runner for this repository's Linux jobs, in a container
# (ADR-103). It is Ubuntu 22.04 on purpose: the jobs in `ci.yml` were written for
# GitHub's `ubuntu-latest` and install what they need with `sudo apt-get`,
# download Node and Python with `actions/setup-*`, and run `unshare` for the
# full-disk test, all of which assume that family. The container is what keeps a
# job from touching the machine it runs on: `sudo` here is root of this container
# and nothing else.
FROM ubuntu:22.04

ARG RUNNER_VERSION=2.337.0
# The runner's own published checksum, so a tarball that is not the one GitHub
# released fails the build instead of running with a token.
ARG RUNNER_SHA256=

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8

# What the jobs use and would otherwise install on every run: a C toolchain, the
# Tauri system libraries (so `apt-get install` in the rust job finds them there
# and does nothing), git, python and the tools `contracts` calls.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git sudo jq unzip xz-utils zstd tar gnupg \
      build-essential pkg-config libssl-dev \
      libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
      python3 python3-pip python3-venv python3-yaml \
      util-linux mount kmod procps \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1001 -s /bin/bash runner \
    && echo 'runner ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/runner \
    && chmod 0440 /etc/sudoers.d/runner

# The runner itself, kept apart from the directory it works in: that directory
# is a volume, so its registration survives a restart, and is filled from here the
# first time.
RUN curl -fsSL -o /tmp/runner.tgz \
      "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    && if [ -n "$RUNNER_SHA256" ]; then echo "$RUNNER_SHA256  /tmp/runner.tgz" | sha256sum -c -; fi \
    && mkdir -p /opt/runner-dist && tar -xzf /tmp/runner.tgz -C /opt/runner-dist && rm /tmp/runner.tgz \
    && /opt/runner-dist/bin/installdependencies.sh \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh && mkdir -p /home/runner/r && chown -R runner:runner /home/runner /opt/runner-dist

USER runner
WORKDIR /home/runner/r
ENTRYPOINT ["/entrypoint.sh"]
