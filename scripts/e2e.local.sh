#!/usr/bin/env bash
set -euo pipefail

PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJ"

PORT="${ANVIL_PORT:-8545}"
export ANVIL_RPC="http://127.0.0.1:${PORT}"

echo "[e2e] forge build..."
forge build --root contracts >/dev/null

echo "[e2e] starting anvil on :${PORT}..."
anvil --port "$PORT" --silent &
ANVIL_PID=$!
cleanup() { kill "$ANVIL_PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 40); do
  if cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1; then break; fi
  sleep 0.25
done

echo "[e2e] running terminal e2e..."
"$PROJ/node_modules/.bin/tsx" scripts/e2e.local.ts
