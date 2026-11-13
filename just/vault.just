# The scratch vault used for in-app checks. Override with TEST_VAULT / TEST_VAULT_NAME in .env.
set working-directory := ".."
set shell := ["env", "CYG_SYS_BASHRC=1", "bash", "-eu", "-o", "pipefail", "-c"]

VAULT := env("TEST_VAULT", home_directory() / "Library/Mobile Documents/iCloud~md~obsidian/Documents/TestVault/Test Vault")
VAULT_NAME := env("TEST_VAULT_NAME", "Test Vault")
OBSIDIAN := env("OBSIDIAN_CLI", "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli")

# Build both plugins and copy them into the test vault
install:
    pnpm --filter @yankeeinlondon/datacore-engine --filter @yankeeinlondon/datacore-view-preact build
    scripts/install-built "{{ VAULT }}" engine view-preact

# Reload both plugins in the running app (session only: your saved plugin list is untouched)
reload:
    @"{{ OBSIDIAN }}" "vault={{ VAULT_NAME }}" eval code="(async () => { for (const id of ['datacore-engine', 'datacore-view-preact']) { await app.plugins.disablePlugin(id); await app.plugins.enablePlugin(id); } await window.dc?.ready?.(); return 'reloaded'; })()" | grep '^=>'

# Build the example consumer plugin (client from npm) and copy it into the test vault
example:
    cd examples/consumer-plugin && npm ci && npm run build
    mkdir -p "{{ VAULT }}/.obsidian/plugins/datacore-example-consumer"
    cp examples/consumer-plugin/main.js examples/consumer-plugin/manifest.json "{{ VAULT }}/.obsidian/plugins/datacore-example-consumer/"
    @echo "Installed datacore-example-consumer; enable it in Settings → Community plugins → Installed plugins."
