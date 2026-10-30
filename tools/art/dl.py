# v0.55 — slike iz GPT Image 2.5 (Fish Audio) u igru:
#   portret  → assets/hero_<junak>.jpg (512 px)
#   list ikona (mreža 3 × 2: urođena P, Q, W, E, R, talenti T) → assets/ab/<junak>_<P|Q|W|E|R|T>.jpg (128 px)
# pa upiše SPELL_ICONS u data.js (igra tada crta ikone umjesto emojija).
#   python3 tools/art/dl.py                       sve iz tools/art/urls.json (treba pristup platform.r2.fish.audio)
#   python3 tools/art/dl.py --only=nilski,irbis   samo neki junaci     --no-portraits   samo ikone
# Originali (PNG) ostaju u tools/art/src/ (nisu u gitu), pa ponovno rezanje ne preuzima ništa.
import io, json, os, re, sys, urllib.request
from PIL import Image, ImageFilter, ImageOps

D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))
SRC, AB = os.path.join(D, 'src'), os.path.join(ROOT, 'assets', 'ab')
SLOTS = ['P', 'Q', 'W', 'E', 'R', 'T']
arg = lambda k, d=None: next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--' + k + '=')), d)
only = [x for x in (arg('only') or '').split(',') if x]
urls = json.load(open(os.path.join(D, 'urls.json'), encoding='utf-8'))


def fetch(key):
    """original iz tools/art/src/ ili s Fish Audio poslužitelja"""
    os.makedirs(SRC, exist_ok=True)
    p = os.path.join(SRC, key.replace('/', '_') + '.png')
    if not os.path.exists(p):
        with urllib.request.urlopen(urls[key], timeout=60) as r:
            open(p, 'wb').write(r.read())
    return Image.open(p).convert('RGB')


def cuts(img, n, axis):
    """granice pločica: oko očekivane 1/n crte traži najjači rub (GPT ponekad crta tanke razmake ili pomakne crtu)"""
    g = ImageOps.grayscale(img).filter(ImageFilter.FIND_EDGES)
    w, h = g.size
    size = w if axis == 0 else h
    px = g.load()
    out = [0]
    for k in range(1, n):
        exp = size * k / n
        best, bv = int(exp), -1
        for c in range(int(exp - size * 0.05), int(exp + size * 0.05)):
            if axis == 0:
                v = sum(px[c, y] for y in range(0, h, 3))
            else:
                v = sum(px[x, c] for x in range(0, w, 3))
            v -= abs(c - exp) * 0.5 * (h if axis == 0 else w) / 3 / 40   # blaga sklonost očekivanoj crti
            if v > bv:
                bv, best = v, c
        out.append(best)
    out.append(size)
    return out


def slice_sheet(img, inset=0.03):
    xs, ys = cuts(img, 3, 0), cuts(img, 2, 1)
    tiles = []
    for r in range(2):
        for c in range(3):
            x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
            s = min(x1 - x0, y1 - y0)                       # kvadrat u sredini pločice
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            s *= 1 - 2 * inset                               # malo odreži rub (susjedne pločice, okviri)
            tiles.append(img.crop((int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2))))
    return tiles


done = []
heroes = sorted({k.split('/')[0] for k in urls})
for hid in heroes:
    if only and hid not in only:
        continue
    if '--no-portraits' not in sys.argv and hid + '/portrait' in urls:
        im = fetch(hid + '/portrait').resize((512, 512), Image.LANCZOS)
        im.save(os.path.join(ROOT, 'assets', 'hero_%s.jpg' % hid), quality=86, optimize=True, progressive=True)
    if hid + '/icons' in urls:
        os.makedirs(AB, exist_ok=True)
        for slot, t in zip(SLOTS, slice_sheet(fetch(hid + '/icons'), float(arg('inset', '0.03')))):
            t.resize((128, 128), Image.LANCZOS).save(os.path.join(AB, '%s_%s.jpg' % (hid, slot)), quality=86, optimize=True)
        done.append(hid)
    print('✓', hid)

# SPELL_ICONS u data.js: svi junaci koji imaju svih 6 ikona
have = sorted(h for h in heroes if all(os.path.exists(os.path.join(AB, '%s_%s.jpg' % (h, s))) for s in SLOTS))
p = os.path.join(ROOT, 'data.js')
src = open(p, encoding='utf-8').read()
src = re.sub(r"const SPELL_ICONS = \[[^\]]*\];", 'const SPELL_ICONS = [%s];' % ', '.join("'%s'" % h for h in have), src, count=1)
open(p, 'w', encoding='utf-8').write(src)
print('ikone: %d junaka, portreti: %s' % (len(have), 'ne' if '--no-portraits' in sys.argv else 'da'))
