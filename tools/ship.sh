#!/bin/sh
# Ship a version: tools/ship.sh N.NN ["trailer lines"]   -> SHIPPED N.NN, or FAIL <why>
# First set the title label (#version in game/index.html: vN.NN) and append "## N.NN (date)" to docs/HISTORY.md.
# Runs tools/check.sh, then makes ONE commit with subject N.NN on top of origin/main holding exactly the current files (nothing is
# merged, so nothing can conflict) and pushes it to main. A work branch then records the version as a second parent with the same
# files, so it goes on from main: no merge, no force push, ever. The optional second argument is added under the subject (attribution lines).
cd "$(dirname "$0")/.."
v=$1
fail() { echo "FAIL $1"; exit 1; }
echo "$v" | grep -Eq '^[0-9]+\.[0-9]{2}$' || fail "usage: tools/ship.sh N.NN [\"trailer lines\"]"
grep -q "id=\"version\">v$v<" game/index.html || fail "label: #version in game/index.html is not v$v"
grep -q "^## $v (" docs/HISTORY.md || fail "history: no '## $v (' entry in docs/HISTORY.md"
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
git log -1 --format=%s origin/main | grep -qx "$v" && fail "main is already $v"
git add -A
tree=$(git write-tree)
[ "$tree" = "$(git rev-parse origin/main^{tree})" ] && fail "nothing differs from main"
c=$(printf '%s\n\n%b\n' "$v" "$2" | git commit-tree "$tree" -p origin/main) || fail "commit"
push origin "$c:refs/heads/main" || fail "push main"
br=$(git rev-parse --abbrev-ref HEAD)
if [ "$br" = main ]; then
  git reset -q "$c"
else
  # the work branch takes the version as a second parent (same files): it goes on from main without rewriting anything
  m=$(git commit-tree "$tree" -p HEAD -p "$c" -m "Shipped $v") && git reset -q "$m" && git branch -f main "$c" &&
    push -u origin "$br" || echo "note: $br not pushed (main is shipped)"
fi
echo "SHIPPED $v"
