"""usage: python3 tests/pics-cmp.py dirA dirB [diffDir] [name]
For each picture in both folders (or only name.png): the share of pixels that differ by more than a little, and the largest difference.
Writes a side-by-side + difference image for any that differ when diffDir is given."""
import sys, pathlib
from PIL import Image, ImageChops

a, b = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
only = sys.argv[4] + '.png' if len(sys.argv) > 4 else None
same = True
for pa in sorted(a.glob('*.png')):
    if only and pa.name != only:
        continue
    pb = b / pa.name
    if not pb.exists():
        print(f'{pa.name:14} missing in {b}')
        same = False
        continue
    A, B = Image.open(pa).convert('RGB'), Image.open(pb).convert('RGB')
    d = ImageChops.difference(A, B).convert('L')
    hist = d.histogram()
    total = sum(hist)
    off = sum(hist[9:]) / total  # differs by more than 8 of 255
    print(f'{pa.name:14} {off * 100:6.2f}% of pixels differ, largest {d.getextrema()[1]}')
    if off > 0.001:
        same = False
        if out:
            out.mkdir(parents=True, exist_ok=True)
            w, h = A.size
            c = Image.new('RGB', (w * 3, h))
            c.paste(A, (0, 0))
            c.paste(B, (w, 0))
            c.paste(d.point(lambda v: 255 if v > 8 else 0).convert('RGB'), (w * 2, 0))
            c.save(out / pa.name)
print('ALL SAME' if same else 'DIFFERENT')
