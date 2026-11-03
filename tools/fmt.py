"""Prettier on the game's code: python3 tools/fmt.py [--check]  (game/src/*.js, settings in tools/.prettierrc.json)"""
import sys, subprocess, pathlib
root = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
here = pathlib.Path(__file__).resolve().parent
files = sorted(str(f) for f in (here.parent / 'game' / 'src').glob('*.js'))
mode = '--check' if '--check' in sys.argv else '--write'
r = subprocess.run(['node', root + '/prettier/bin/prettier.cjs', '--config', str(here / '.prettierrc.json'), mode, *files], capture_output=True, text=True)
print('formatted' if r.returncode == 0 else r.stdout + r.stderr)
sys.exit(r.returncode)
