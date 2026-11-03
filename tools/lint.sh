#!/bin/sh
# lint the built game's script (all of game/src as one script): undefined names, unused names, unreachable code
cd "$(dirname "$0")/.." && mkdir -p out && python3 tools/script.py game/red-cap.html out/game.js && npx --no-install eslint --no-config-lookup -c tools/eslint.config.js out/game.js
