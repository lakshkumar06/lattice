#!/usr/bin/env bash
set -euo pipefail

PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJ"

PORT="${ANVIL_PORT:-8545}"
export ANVIL_RPC="http://127.0.0.1:${PORT}"

forge build --root contracts >/dev/null
anvil --port "$PORT" --silent &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1 && break
  sleep 0.25
done

DEPLOY="$("$PROJ/node_modules/.bin/tsx" scripts/deploy.local.ts)"
CONTRACT="$(printf '%s' "$DEPLOY" | sed -E 's/.*"contract":"([^"]+)".*/\1/')"
echo "[server.local] deployed contract: $CONTRACT"

export STAKE_AND_ADVANCE_ADDRESS="$CONTRACT"
export RPC_URL="$ANVIL_RPC"
export CHAIN_ID=31337
export PORT="${SERVER_PORT:-8788}"
export REPORTER_PRIVATE_KEY="0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"

echo "[server.local] starting backend on :$PORT"
"$PROJ/node_modules/.bin/tsx" server/index.ts
