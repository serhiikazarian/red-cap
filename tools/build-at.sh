#!/bin/sh
# Build any version for side-by-side checks (e.g. tests/menus.js): tools/build-at.sh 1.05 -> out/red-cap-1.05.html
# Takes a version (the commit whose subject is exactly "1.05"), or any commit.
set -e
cd "$(dirname "$0")/.."
t=${1:?usage: tools/build-at.sh <version N.NN or commit>}
v=${t#v}; v=${v#.}
ref=$(git log --format=%H -1 --grep="^$(echo "$v" | sed 's/\./\\./g')\$" HEAD || true)
[ -n "$ref" ] || ref=$(git rev-parse -q --verify "$t^{commit}" || true)
[ -n "$ref" ] || { echo "no such version or commit: $t" >&2; exit 1; }
d=out/at-$v
rm -rf "$d" && mkdir -p "$d"
git archive "$ref" game | tar -x -C "$d"
python3 "$d/game/build.py" >/dev/null
mv "$d/game/red-cap.html" "out/red-cap-$v.html" && rm -rf "$d"
echo "out/red-cap-$v.html"
