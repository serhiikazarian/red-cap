#!/bin/sh
# Proof that play and looks did not change: every full replay and fixed picture of the current build against tests/baseline
# (tests/same.js, three at a time, the touched floors first: ~75 s).
#   tools/same.sh       -> SAME, or what differs then DIFFERENT (pictures that differ: out/same-diff/); a progress line a job
#                          goes to stderr (2>&1 to watch it)
#   tools/same.sh new   remake the baselines (after a change meant to alter play or looks): from the last check's run when it
#                       was of this build (seconds), else after running it; only the files that changed are written
cd "$(dirname "$0")/.."
NODE_PATH="$(npm root -g)" exec node tests/same.js game/red-cap.html "$1"
