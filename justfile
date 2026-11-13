set dotenv-load

# `env CYG_SYS_BASHRC=1` guards against Cygwin's /etc/bash.bashrc tripping `-u`.
set shell := ["env", "CYG_SYS_BASHRC=1", "bash", "-eu", "-o", "pipefail", "-c"]

BOLD := '\033[1m'
RESET := '\033[0m'

# Grouped operations: `just <module>` lists a module's recipes.
mod vault "just/vault.just"
mod snapshot "just/snapshot.just"
mod release "just/release.just"
mod ci "just/ci.just"

default:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v md &> /dev/null; then
        md just.md
    else
        echo -e "{{ BOLD }}Datacore Engine/Client/Views{{ RESET }}"
        echo "========================================"
    fi
    echo
    just --list --list-submodules | grep -v 'default'

# Install dependencies
setup:
    pnpm install

# Build every package (plugins land in packages/<plugin>/build/plugin)
build:
    pnpm build

# Everything CI checks: format, lint, typecheck, tests, plugin manifests
check:
    pnpm check

# Rebuild both plugins on change
dev:
    pnpm --parallel --filter @yankeeinlondon/datacore-engine --filter @yankeeinlondon/datacore-view-preact dev

# Docs site with live reload
docs:
    pnpm docs:start
