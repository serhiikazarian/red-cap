# Red Cap: change history

One entry per version, newest at the bottom: `## N.NN (date)`, short plain bullets, key names in backticks. Search it, don't
read it whole. Versions before 1.05 (the old numbering, up to 7.2) are not in the tree:
`git show 0508438:HISTORY.md | rg -n "name"`.

## 1.05 (3 Nov 2026)
- Fresh repository from Serj's 7.2 folder (same game). Version numbering restarts at 1.05: two digits after the point, +0.01
  per release; a version is the commit whose subject is exactly the number. The title screen shows it bottom left, in small
  grey letters (`#version`, `v1.05`).
- Each push to `main` builds, checks and publishes on GitHub Pages (`.github/workflows/pages.yml`). Built copies are not kept:
  `tools/build-at.sh N.NN` rebuilds any version. Docs: `CLAUDE.md` (always loaded), `docs/ARCHITECTURE.md` (on demand),
  `README.md` in English.

## 1.06 (3 Nov 2026), no change to the game
- Leaner for future sessions: this file keeps only versions from 1.05 on (the old log stays in git, see above); `CLAUDE.md`
  is shorter and says how to work surgically; probe notes moved to `docs/ARCHITECTURE.md` § Testing.
- One command per check: `tools/check.sh` → `OK` (format, build, lint, unused names, boot) and `tools/same.sh` → `SAME`
  (replays + pictures against the baselines; `full`, or `new` to remake them).
- The picture test photographed a blank screen (a fade frozen at its start covered every floor), so it proved nothing. It now
  lets fades finish and fixes the dice from the page's first line (the smoke texture is drawn at random at start-up), and
  shows each floor the same way every run; its baselines were remade.
- Title label `v1.06`.

## 1.07 (3 Nov 2026)
- When a boss opens up, a big yellow word flashes mid-screen in the marker font: `EXPOSED` (the Priest loses his last ghost),
  `UNMASKED` (the Jester's mask breaks), `WINDED` (the Geezer runs out of breath). Under it, a smaller red line
  `Attack him!` swells in and out. The small yellow "— hit him" line under the boss's name is gone.
- When the Geezer misses his last stare, `WINDED` takes over from `MISSED` at once.
- `bigWord(text, color, size, under)` takes an optional smaller line; a talker's `bar(e)` returns `[text, lit, word]`.
- Title label `v1.07`.
