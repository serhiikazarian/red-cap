"""Extract the game script (the last <script> block) from a build: python3 tools/script.py in.html out.js"""
import sys, re
s = open(sys.argv[1], encoding='utf-8').read()
i = s.rindex('<script>\n') + len('<script>\n')
j = s.rindex('</script>')
open(sys.argv[2], 'w', encoding='utf-8').write(s[i:j])
