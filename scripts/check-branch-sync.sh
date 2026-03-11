#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_BRANCH="${1:-main}"
COMPARE_BRANCH="${2:-origin/feat/improvements}"

git fetch --all --prune >/dev/null 2>&1 || true

ahead_behind="$(git rev-list --left-right --count "$BASE_BRANCH...$COMPARE_BRANCH")"
base_ahead="$(echo "$ahead_behind" | awk '{print $1}')"
base_behind="$(echo "$ahead_behind" | awk '{print $2}')"

echo "[sync-check] $BASE_BRANCH ahead=$base_ahead behind=$base_behind vs $COMPARE_BRANCH"

if [[ "$base_behind" -gt 0 ]]; then
  echo "[sync-check] ERROR: $BASE_BRANCH is behind $COMPARE_BRANCH"
  echo "[sync-check] Missing commits:" 
  git log --oneline "$BASE_BRANCH..$COMPARE_BRANCH"
  exit 1
fi

echo "[sync-check] OK: $BASE_BRANCH is up to date with $COMPARE_BRANCH"
