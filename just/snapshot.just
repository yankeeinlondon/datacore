# Rendering regression check: renders every note in fixtures/vault/Parity off-screen in the running app and compares
# it with the reviewed baseline. Needs Obsidian open on the test vault. Run before releases and after changes to the
# engine, contract, client, shared, or view-preact.
set working-directory := "../fixtures"
set shell := ["env", "CYG_SYS_BASHRC=1", "bash", "-eu", "-o", "pipefail", "-c"]

export PARITY_VAULT := env("TEST_VAULT_NAME", "Test Vault")

# Sync the fixture notes, snapshot them, and compare with the baseline
run:
    node parity.ts sync
    node parity.ts snapshot current
    node parity.ts compare baseline current | tail -1

# Show the full diff between the baseline and the latest snapshot
diff:
    node parity.ts compare baseline current || true

# Accept the latest snapshot as the new baseline (after reviewing `just snapshot diff`)
accept:
    cp parity/current/*.html parity/baseline/
    node parity.ts compare baseline current | tail -1
    @echo "Baseline updated; commit fixtures/parity/baseline with a note on what changed and why."
