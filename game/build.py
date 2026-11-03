"""Build the single-file game: python3 game/build.py -> game/red-cap.html (everything inside it: it plays offline, from disk).
index.html is the page. Its marker lines are replaced:
  /*INCLUDE path*/      that file (a glob such as src/*.js: the files in name order); in an included .css, url(assets/…)
                        becomes that file's data (the fonts)
  /*DATA NAME folder*/  const NAME = {"file name": "data:…;base64,…", …}; from every file in the folder, in name order
  /*SHAPES path*/       const SHAPES = {…}; from the cut-out outlines' JSON"""
import base64, json, pathlib, re

d = pathlib.Path(__file__).resolve().parent
MIME = {'.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2'}


def data_uri(f):
    return 'data:' + MIME[f.suffix] + ';base64,' + base64.b64encode(f.read_bytes()).decode()


def include(pattern):
    files = sorted(d.glob(pattern))
    assert files, 'nothing matches ' + pattern
    out = []
    for f in files:
        text = f.read_text(encoding='utf-8')
        if f.suffix == '.css':
            text = re.sub(r'url\((assets/[^)]+)\)', lambda m: 'url(' + data_uri(d / m.group(1)) + ')', text)
        out.append(text)
    return ''.join(out).removesuffix('\n')


def data(name, folder):
    files = sorted(f for f in (d / folder).iterdir() if f.suffix in MIME)
    assert files, 'no files in ' + folder
    return 'const ' + name + ' = {' + ', '.join(json.dumps(f.stem) + ': ' + json.dumps(data_uri(f)) for f in files) + '};'


def shapes(path):
    return 'const SHAPES = ' + json.dumps(json.loads((d / path).read_text(encoding='utf-8'))) + ';'


def marker(m):
    kind, args = m.group(1), m.group(2).split()
    return include(*args) if kind == 'INCLUDE' else data(*args) if kind == 'DATA' else shapes(*args)


page = (d / 'index.html').read_text(encoding='utf-8')
out = re.sub(r'^/\*(INCLUDE|DATA|SHAPES) (.+?)\*/$', marker, page, flags=re.M)
(d / 'red-cap.html').write_text(out, encoding='utf-8')
print('built', len(out.encode()), 'bytes')
