# Red Cap

A paper slasher in three floors. Silence every talker, then wake up.

**Play:** https://serhiikazarian.github.io/red-cap/

A 3D browser game built from the author's paintings: paper characters in a Three.js world, with an ink, halftone and grain
look. Controls: keyboard and mouse, touchscreen or gamepad.

## How it's built

```
game/src/*.js      the game, one file per part (core, Red Cap, each talker, floors, menus, loop)
game/index.html    the page; /*INCLUDE path*/ lines are replaced by files at build time
game/style.css     styles
game/data/         fonts, images, cut-out shapes, sounds (embedded data)
game/vendor/       Three.js r128
game/build.py      builds everything into one file, game/red-cap.html (~6 MB, works offline)
tests/             automated checks in a headless browser
tools/             formatting, lint, building any older version
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

Each version is a commit whose subject is the version number, such as `1.05`. Any version can be rebuilt with
`tools/build-at.sh 1.05`.
