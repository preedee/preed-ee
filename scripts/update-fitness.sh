#!/bin/bash
# Daily Whoop pull + fitness dashboard rebuild + deploy (run by launchd com.pai.whoop-pull).
# Commits ONLY the encrypted dashboard file; aborts cleanly on any git conflict.
set -euo pipefail

BUN=/Users/preedee/.bun/bin/bun
REPO=/Users/preedee/Cowork/preed-ee
PAGE=docs/personal/fitness/index.html

"$BUN" run /Users/preedee/.claude/PAI/Tools/Whoop.ts pull
cd "$REPO"
"$BUN" run scripts/build-fitness.ts

if git diff --quiet -- "$PAGE"; then
  echo "dashboard unchanged, nothing to deploy"
  exit 0
fi

git pull --rebase origin main || { git rebase --abort 2>/dev/null; echo "rebase conflict — manual fix needed"; exit 1; }
git add "$PAGE"
git commit -m "fitness: daily data refresh"
git push origin main
echo "dashboard deployed"
