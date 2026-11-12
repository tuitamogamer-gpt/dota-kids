# v0.56 — naslikane ikone predmeta: listovi 4 × 3 (GPT Image 2.5 preko Fish Audija, tools/art/items.py) → assets/item/<id>.jpg (176 × 128)
# pa upiše ITEM_ICONS u data.js (igra tada crta sliku umjesto sličice-emojija).
#   python3 tools/art/dl_items.py              svi listovi "items/<n>" iz tools/art/urls.json
#   python3 tools/art/dl_items.py --only=3,7   samo neki listovi
# Originali (PNG) ostaju u tools/art/src/ (nisu u gitu).
import json, os, re, sys, urllib.request
from PIL import Image, ImageFilter, ImageOps

D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))
SRC, OUT = os.path.join(D, 'src'), os.path.join(ROOT, 'assets', 'item')
W, H = 176, 128
arg = lambda k, d=None: next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--' + k + '=')), d)
only = [x for x in (arg('only') or '').split(',') if x]
urls = json.load(open(os.path.join(D, 'urls.json'), encoding='utf-8'))
prompts = json.load(open(os.path.join(D, 'item_prompts.json'), encoding='utf-8'))


def fetch(key):
    os.makedirs(SRC, exist_ok=True)
    p = os.path.join(SRC, key.replace('/', '_') + '.png')
    if not os.path.exists(p):
        with urllib.request.urlopen(urls[key], timeout=60) as r:
            open(p, 'wb').write(r.read())
    return Image.open(p).convert('RGB')


def cuts(img, n, axis):
    """granice pločica: oko očekivane 1/n crte traži najjači rub (isto kao tools/art/dl.py)"""
    g = ImageOps.grayscale(img).filter(ImageFilter.FIND_EDGES)
    w, h = g.size
    size = w if axis == 0 else h
    px = g.load()
    out = [0]
    for k in range(1, n):
        exp = size * k / n
        best, bv = int(exp), -1
        for c in range(int(exp - size * 0.04), int(exp + size * 0.04)):
            v = sum(px[c, y] for y in range(0, h, 3)) if axis == 0 else sum(px[x, c] for x in range(0, w, 3))
            v -= abs(c - exp) * 0.5 * (h if axis == 0 else w) / 3 / 40
            if v > bv:
                bv, best = v, c
        out.append(best if abs(best - exp) <= size * 0.012 else round(exp))
    out.append(size)
    return out


os.makedirs(OUT, exist_ok=True)
for key in sorted((k for k in urls if k.startswith('items/')), key=lambda k: int(k.split('/')[1])):
    if only and key.split('/')[1] not in only:
        continue
    img = fetch(key)
    xs, ys = cuts(img, 4, 0), cuts(img, 3, 1)
    inset = float(arg('inset', 0.035))
    for k, iid in enumerate(prompts[key]['ids']):
        r, c = divmod(k, 4)
        x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
        cw, ch = (x1 - x0) * (1 - 2 * inset), (y1 - y0) * (1 - 2 * inset)
        if cw / ch > W / H:
            cw = ch * W / H            # pločica šira od ikone: odreži sa strane
        else:
            ch = cw * H / W
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        t = img.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.LANCZOS)
        t.save(os.path.join(OUT, iid + '.jpg'), quality=84, optimize=True)
    print('✓', key)

have = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.jpg'))
p = os.path.join(ROOT, 'data.js')
src = open(p, encoding='utf-8').read()
src, n = re.subn(r"const ITEM_ICONS = \[[^\]]*\];", 'const ITEM_ICONS = [%s];' % ', '.join("'%s'" % h for h in have), src, count=1)
assert n == 1, 'data.js nema const ITEM_ICONS = [...]'
open(p, 'w', encoding='utf-8').write(src)
print('ikone predmeta:', len(have))
