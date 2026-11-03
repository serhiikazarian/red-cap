#!/bin/sh
# Proof that play and looks did not change: scripted replays and fixed pictures of the current build against tests/baseline.
#   tools/same.sh        quick replay + pictures (~3 min)  -> SAME, or what differs (pictures that differ: out/same-diff/)
#   tools/same.sh full   full replay + pictures
#   tools/same.sh new    remake the baselines from the current build (after a change meant to alter play or looks)
cd "$(dirname "$0")/.."
export NODE_PATH="$(npm root -g)"
mkdir -p out && rm -rf out/same-pics out/same-diff
q=quick r=replay-quick.json
[ "$1" = full ] && q= r=replay.json
if [ "$1" = new ]; then
  node tests/replay.js game/red-cap.html tests/baseline/replay.json >/dev/null 2>&1 &&
  node tests/replay.js game/red-cap.html tests/baseline/replay-quick.json quick >/dev/null 2>&1 &&
  rm -rf tests/baseline/pics && node tests/pics.js game/red-cap.html tests/baseline/pics >/dev/null 2>&1 &&
  echo "baselines remade" || { echo "FAIL remaking baselines"; exit 1; }
  exit 0
fi
node tests/replay.js game/red-cap.html out/same.json $q >/dev/null 2>&1 || { echo "FAIL replay run"; exit 1; }
a=$(node tests/replay-cmp.js tests/baseline/$r out/same.json 2>&1)
node tests/pics.js game/red-cap.html out/same-pics >/dev/null 2>&1 || { echo "FAIL pictures run"; exit 1; }
b=$(python3 tests/pics-cmp.py tests/baseline/pics out/same-pics out/same-diff 2>&1)
if [ "$(echo "$a" | tail -1)" = "ALL SAME" ] && [ "$(echo "$b" | tail -1)" = "ALL SAME" ]; then echo SAME; exit 0; fi
echo "$a" | grep -v ' same .* samples$\|^ALL SAME$'
echo "$b" | grep -v ' 0.00% of pixels differ\|^ALL SAME$'
exit 1
