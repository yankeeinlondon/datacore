# Releases: plugins to their release repos (GitHub, BRAT), contract and client to npm and JSR.
# Versions come from the package.json files (`pnpm release:version` after a changeset).
set working-directory := ".."
set shell := ["env", "CYG_SYS_BASHRC=1", "bash", "-eu", "-o", "pipefail", "-c"]

# Release both plugins at their package versions (refuses if the rendering snapshot predates the code)
plugins:
    #!/usr/bin/env bash
    set -euo pipefail
    changed="$(git log -1 --format=%ct -- packages/engine packages/view-preact packages/client packages/shared packages/contract)"
    meta="fixtures/parity/current/_meta.json"
    if [ ! -f "$meta" ] || [ "$(stat -f %m "$meta")" -lt "$changed" ]; then
        echo "The rendering snapshot is older than the last code change: run 'just snapshot run' first." >&2
        exit 1
    fi
    node scripts/release-plugin.mjs engine
    node scripts/release-plugin.mjs view-preact

# Publish contract, then client, to npm (asks for a fresh authenticator code before each)
npm:
    #!/usr/bin/env bash
    set -euo pipefail
    for pkg in contract client; do
        read -r -p "npm one-time code for datacore-$pkg: " otp
        pnpm --filter "@yankeeinlondon/datacore-$pkg" publish --access public --otp="$otp"
    done
    echo "npm may report 404 (and E409 on a retry) for a few minutes while it scans a new version; 'just release verify' waits for it."

# Publish contract and client to JSR (approve in the browser)
jsr:
    pnpm jsr:stage
    cd build/jsr && npx --yes jsr@0.14.3 publish

# Install the published packages as an outside consumer (npm, JSR via npm, Deno) and type-check them
verify:
    node scripts/verify-published.mjs
