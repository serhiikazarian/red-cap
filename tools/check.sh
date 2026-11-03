#!/bin/sh
# Every quick check in one go: format, build, lint, unused names, boot. Prints OK, or FAIL <step> and that step's output.
#   tools/check.sh       formats the code first (prettier rewrites game/src)
#   tools/check.sh ci    only checks the format (CI: a file that needs formatting fails)
cd "$(dirname "$0")/.."
export NODE_PATH="$(npm root -g)" NPM_CONFIG_UPDATE_NOTIFIER=false
fail() { echo "FAIL $1"; echo "$2"; exit 1; }
fmt=; [ "$1" = ci ] && fmt=--check
o=$(python3 tools/fmt.py $fmt 2>&1) || fail format "$o"
o=$(python3 game/build.py 2>&1) || fail build "$o"
o=$(tools/lint.sh 2>&1); [ -z "$o" ] || fail lint "$o"
o=$(node tools/unused.js 2>&1); [ -z "$o" ] || fail unused "$o"
o=$(node tests/boot.js game/red-cap.html 2>&1); [ "$o" = "[]" ] || fail boot "$o"
echo OK
