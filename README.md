# Red Cap

A paper slasher in three floors. Silence every talker, then wake up.

**Play:** https://serhiikazarian.github.io/red-cap/

A 3D browser game built from the author's paintings: paper characters in a Three.js world, with an ink, halftone and grain
look. Controls: keyboard and mouse, touchscreen or gamepad.

## How it's built

```
game/src/*.js      the game, one file per part (core, Red Cap, each talker, floors, menus, loop)
game/index.html    the page; its marker lines are filled at build time
game/style.css     styles (fonts.css: the fonts)
game/assets/       paintings (img/), sounds (sfx/), fonts, cut-out outlines (shapes.json)
game/vendor/       Three.js r128
game/build.py      packs everything into one file, game/red-cap.html (~6 MB, works offline)
tests/             automated checks in a headless browser
tools/             checks, formatting, lint, building an older version (1.13 on)
docs/              version history and the code's internal rules
```

## Build and run locally

```bash
python3 game/build.py
```

Then open `game/red-cap.html` in a browser (no server needed).

## Publishing

Every push to `main` runs `.github/workflows/pages.yml`: build, checks (formatting, lint, the game starts without errors), then
publishing to GitHub Pages. If a check fails, the site stays on the previous version.

Each version is a commit whose subject is the version number, such as `1.14`. GitHub Actions tags it `v1.14` and attaches that
version's game file to a release (the Releases page), so any version from 1.13 on can be downloaded and played offline.
`tools/build-at.sh 1.14` rebuilds one locally.
