"""Build the single-file game: python3 game/build.py -> game/red-cap.html
index.html is the page; a line /*INCLUDE path*/ is replaced by that file (a glob such as src/*.js: the files in name order)."""
import pathlib, re
d = pathlib.Path(__file__).resolve().parent


def include(m):
    files = sorted(d.glob(m.group(1)))
    assert files, 'nothing matches ' + m.group(1)
    return ''.join(f.read_text(encoding='utf-8') for f in files).removesuffix('\n')


page = (d / 'index.html').read_text(encoding='utf-8')
out = re.sub(r'^/\*INCLUDE (\S+)\*/$', include, page, flags=re.M)
(d / 'red-cap.html').write_text(out, encoding='utf-8')
print('built', len(out.encode()), 'bytes')
