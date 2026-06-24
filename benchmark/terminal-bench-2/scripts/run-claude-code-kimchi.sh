#!/usr/bin/env bash
# Run terminal-bench with the Claude Code scaffold, configured to use the
# Cheap Anthropic-compatible gateway. The selected model is controlled by MODEL.
#
# Usage examples:
#   MODEL=cheap-dev/kimi-k2.5 ./scripts/run-claude-code-cheap.sh -i terminal-bench/fix-git
#   MODEL=cheap-dev/minimax-m2.7 ./scripts/run-claude-code-cheap.sh -i terminal-bench/fix-git -k 3
#   CLAUDE_CODE_VERSION=2.1.144 MODEL=cheap-dev/kimi-k2.5 ./scripts/run-claude-code-cheap.sh -i terminal-bench/fix-git
#   CLAUDE_CODE_API_MAX_RETRIES=0 ./scripts/run-claude-code-cheap.sh -i terminal-bench/fix-git
set -euo pipefail

DATASET="terminal-bench/terminal-bench-2"

: "${CHEAP_API_KEY:?set CHEAP_API_KEY in env}"

BENCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BENCH_DIR"

HARBOR_ARGS=(
    --agent-import-path cheap_agent:ClaudeCodeCheap
    --env docker
    --model "${MODEL:-cheap-dev/kimi-k2.5}"
    --ae "CHEAP_API_KEY=$CHEAP_API_KEY"
    --max-retries "${CLAUDE_CODE_API_MAX_RETRIES:-2}"
    --retry-include RetryableApiError
    -d "$DATASET"
)

if [[ -n "${CLAUDE_CODE_VERSION:-}" ]]; then
    HARBOR_ARGS+=(--agent-kwarg "version=$CLAUDE_CODE_VERSION")
fi

exec uv run --python 3.14 harbor run "${HARBOR_ARGS[@]}" "$@"
