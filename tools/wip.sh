#!/bin/sh
# Save work in progress to the current work branch (never main): tools/wip.sh "message" ["trailer lines"]   -> SAVED, or FAIL <why>
# Commits every change and pushes the branch. It publishes nothing: GitHub Pages and the versions come only from main (tools/ship.sh).
cd "$(dirname "$0")/.."
fail() { echo "FAIL $1"; exit 1; }
[ -n "$1" ] || fail "usage: tools/wip.sh \"message\" [\"trailer lines\"]"
br=$(git rev-parse --abbrev-ref HEAD)
[ "$br" = main ] && fail "on main: work on the session's branch"
git add -A
git diff --cached --quiet || printf '%s\n\n%b\n' "$1" "$2" | git commit -q -F - || fail commit
for w in 2 4 8 16 0; do
  git push -q -u origin "$br" 2>/dev/null && { echo SAVED; exit 0; }
  [ $w = 0 ] && fail "push $br"
  sleep $w
done
