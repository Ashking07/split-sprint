#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3002}"
WEB_PORT="${WEB_PORT:-5173}"

echo "[restart-dev] Clearing any existing listeners on :$API_PORT and :$WEB_PORT"
for port in "$API_PORT" "$WEB_PORT"; do
  pids="$(lsof -ti :"$port" || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs -n1 kill -9 2>/dev/null || true
    echo "[restart-dev] Killed PID(s) on :$port -> $pids"
  else
    echo "[restart-dev] No process currently listening on :$port"
  fi
done

echo "[restart-dev] Starting API + frontend via npm run dev:all"
exec npm run dev:all
