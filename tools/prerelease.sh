#!/bin/sh
# Try a version on the prerelease branch before it ships: tools/prerelease.sh N.NN ["trailer lines"]   -> PRERELEASED N.NN, or FAIL <why>
# First set the title label (#version in game/index.html: vN.NN) and the "## N.NN (date)" entry in docs/HISTORY.md, as for a ship.
# Runs tools/check.sh, then makes ONE commit with subject N.NN holding exactly the current files on top of origin/prerelease (and of
# origin/main too when prerelease does not hold it yet, so the branch never falls behind main; started from main if it does not
# exist) and pushes it to prerelease. The same version may go there again and again. CI builds it and keeps the game as a download
# on the run's Summary page (Artifacts); nothing is published. The work branch records it as a second parent with the same files.
# Nothing is merged or force-pushed, ever. The optional second argument is added under the subject (attribution lines).
cd "$(dirname "$0")/.."
v=$1
fail() { echo "FAIL $1"; exit 1; }
echo "$v" | grep -Eq '^[0-9]+\.[0-9]{2}$' || fail "usage: tools/prerelease.sh N.NN [\"trailer lines\"]"
grep -q "id=\"version\">v$v<" game/index.html || fail "label: #version in game/index.html is not v$v"
grep -q "^## $v (" docs/HISTORY.md || fail "history: no '## $v (' entry in docs/HISTORY.md"
br=$(git rev-parse --abbrev-ref HEAD)
[ "$br" = main ] && fail "on main: work on the session's branch"
o=$(tools/check.sh 2>&1)
[ "$(echo "$o" | tail -1)" = OK ] || { echo "$o"; fail check; }
push() { # git push with retries on network trouble (2, 4, 8, 16 s)
  for w in 2 4 8 16 0; do
    git push -q "$@" 2>/dev/null && return 0
    [ $w = 0 ] && return 1
    sleep $w
  done
}
git fetch -q origin main || fail "fetch origin main"
if git fetch -q origin prerelease 2>/dev/null; then
  base=origin/prerelease
  parents="-p $base"
  git merge-base --is-ancestor origin/main "$base" || parents="$parents -p origin/main"
else
  base=origin/main
  parents="-p $base"
fi
git add -A
tree=$(git write-tree)
[ "$tree" = "$(git rev-parse "$base^{tree}")" ] && fail "nothing differs from $base"
c=$(printf '%s\n\n%b\n' "$v" "$2" | git commit-tree "$tree" $parents) || fail "commit"
push origin "$c:refs/heads/prerelease" || fail "push prerelease"
m=$(git commit-tree "$tree" -p HEAD -p "$c" -m "Prereleased $v") && git reset -q "$m" && push -u origin "$br" ||
  echo "note: $br not pushed (prerelease is pushed)"
echo "PRERELEASED $v"
