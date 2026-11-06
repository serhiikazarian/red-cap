"""Extract the game script (the last <script> block) from a build: python3 tools/script.py in.html out.js"""
import sys, pathlib
s = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
i = s.rindex('<script>\n') + len('<script>\n')
j = s.rindex('</script>')
pathlib.Path(sys.argv[2]).write_text(s[i:j], encoding='utf-8')
