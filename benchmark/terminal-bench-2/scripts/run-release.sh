#!/usr/bin/env bash
# Run terminal-bench against the latest published cheap release. The
# agent downloads the tarball from GitHub, verifies its sha256, and installs
# it inside the container. No local build toolchain required.
#
# Usage examples:
#   ./scripts/run-release.sh -i terminal-bench/fix-git
#   MODEL=cheap-dev/minimax-m2.7 ./scripts/run-release.sh -i terminal-bench/fix-git
#   ./scripts/run-release.sh -i terminal-bench/fix-git -k 3 --agent-kwarg multi-model=true
set -euo pipefail

DATASET="terminal-bench/terminal-bench-2"

: "${CHEAP_API_KEY:?set CHEAP_API_KEY in env}"

BENCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BENCH_DIR"

# Force the release path: ignore any host-side binary.
unset CHEAP_CODE_BINARY

exec uv run --python 3.14 harbor run \
    --agent-import-path cheap_agent:Cheap \
    --env docker \
    --model "${MODEL:-cheap-dev/kimi-k2.5}" \
    --ae "CHEAP_API_KEY=$CHEAP_API_KEY" \
    -d "$DATASET" \
    "$@"
