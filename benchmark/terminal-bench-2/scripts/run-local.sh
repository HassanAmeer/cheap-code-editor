#!/usr/bin/env bash
# Run terminal-bench against the current working tree. Always cross-builds a
# Linux amd64 cheap binary, since terminal-bench task images are amd64
# (often amd64-only — Apple Silicon hosts run them under Rosetta translation).
#
# Usage examples:
#   ./scripts/run-local.sh -i terminal-bench/fix-git
#   MODEL=cheap-dev/kimi-k2.5 ./scripts/run-local.sh -i terminal-bench/fix-git -k 3
#   ./scripts/run-local.sh -i terminal-bench/fix-git -k 3 --agent-kwarg multi-model=true
set -euo pipefail

DATASET="terminal-bench/terminal-bench-2"

: "${CHEAP_API_KEY:?set CHEAP_API_KEY in env}"

BENCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(git -C "$BENCH_DIR" rev-parse --show-toplevel)"

echo "==> Cross-building cheap (target=linux-x64)"
(cd "$REPO_ROOT" && pnpm run build:binary-linux-x64)
# `build:binary-linux-x64` produces dist/bin/cheap alongside dist/share/cheap/{package.json,theme,export-html}.
# The agent walks up from the binary to find the share/ tree, so point CHEAP_CODE_BINARY at bin/cheap.
export CHEAP_CODE_BINARY="$REPO_ROOT/dist/bin/cheap"

cd "$BENCH_DIR"
exec uv run --python 3.14 harbor run \
    --agent-import-path cheap_agent:Cheap \
    --env docker \
    --model "${MODEL:-cheap-dev/kimi-k2.5}" \
    --ae "CHEAP_API_KEY=$CHEAP_API_KEY" \
    -d "$DATASET" \
    "$@"
