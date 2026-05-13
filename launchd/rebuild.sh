#!/bin/bash
# Daily rebuild of preed.ee dashboard.
# Runs under launchd — must avoid getcwd() on protected paths (macOS TCC blocks it under Desktop).
# Strategy: stay at cwd=/, pass absolute paths + --git-dir/--work-tree to every git call.
set -e
R=/Users/preedee/Cowork/preed-ee
cd /

/Users/preedee/.bun/bin/bun "$R/scripts/scan-projects.ts"

GIT=(git --git-dir="$R/.git" --work-tree="$R")

"${GIT[@]}" add docs/projects.json docs/index.html

if ! "${GIT[@]}" diff --cached --quiet; then
    "${GIT[@]}" commit -m "daily rescan $(date -u +%Y-%m-%dT%H:%MZ)"
    "${GIT[@]}" push
fi
