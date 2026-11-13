set working-directory := ".."
set shell := ["env", "CYG_SYS_BASHRC=1", "bash", "-eu", "-o", "pipefail", "-c"]

# Recent GitHub Actions runs; follows the latest one while it is still running
status:
    gh run list --limit 6
    @run="$(gh run list --limit 1 --json databaseId,status --jq 'select(.[0].status != "completed") | .[0].databaseId')"; \
    if [ -n "$run" ]; then gh run watch "$run" --exit-status; fi
