#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_BRANCH="main"
SOURCE_BRANCH="origin/feat/improvements"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[sync-main] Working tree is not clean. Commit or stash changes first."
  exit 1
fi

git fetch --all --prune

git checkout "$TARGET_BRANCH"

# Fast-forward only to avoid accidental merge commits.
git merge --ff-only "$SOURCE_BRANCH"

echo "[sync-main] $TARGET_BRANCH synced to $SOURCE_BRANCH via fast-forward."
