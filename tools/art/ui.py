# v0.56 — slike sučelja iz GPT Image 2.5 (Fish Audio) u igru:
#   2 lista ikona talenata (mreža 4 × 2)        → assets/talent/<učinak>.jpg (128 px)
#   3 trake za velike najave (magenta pozadina) → assets/ui/banner_<blue|red|gold>.webp (prozirna pozadina)
#   python3 tools/art/ui.py      (originali su u tools/art/src/ui_*.png, nisu u gitu)
import os
import numpy as np
from PIL import Image, ImageFilter, ImageOps

D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))
SRC = os.path.join(D, 'src')
SHEETS = {   # redom po retcima, kao u promptu
    'ui_talents_a': ['dmg', 'aspd', 'ls', 'range', 'evasion', 'spellAmp', 'cdr', 'mp'],
    'ui_talents_b': ['hp', 'armor', 'hpRegen', 'mpRegen', 'spd', 'gold', 'special', 'all'],
}
BANNERS = ['blue', 'red', 'gold']


def cuts(img, n, axis):
    """granice pločica: oko očekivane 1/n crte traži najjači rub (kao tools/art/dl.py)"""
    g = np.asarray(ImageOps.grayscale(img).filter(ImageFilter.FIND_EDGES), dtype=np.float32)
    prof = g.sum(axis=0) if axis == 0 else g.sum(axis=1)
    size = len(prof)
    out = [0]
    for k in range(1, n):
        exp = size * k / n
        lo, hi = int(exp - size * 0.02), int(exp + size * 0.02)
        c = lo + int(np.argmax(prof[lo:hi]))
        out.append(c if abs(c - exp) <= size * 0.01 else round(exp))
    out.append(size)
    return out


def icons():
    out = os.path.join(ROOT, 'assets', 'talent')
    os.makedirs(out, exist_ok=True)
    for sheet, keys in SHEETS.items():
        img = Image.open(os.path.join(SRC, sheet + '.png')).convert('RGB')
        xs, ys = cuts(img, 4, 0), cuts(img, 2, 1)
        for i, key in enumerate(keys):
            r, c = divmod(i, 4)
            x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
            s = min(x1 - x0, y1 - y0) * 0.95                 # malo odreži rub (susjedna pločica)
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            t = img.crop((int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2)))
            t.resize((128, 128), Image.LANCZOS).save(os.path.join(out, key + '.jpg'), quality=88, optimize=True)
        print('✓', sheet, xs, ys)


def banners(width=960):
    out = os.path.join(ROOT, 'assets', 'ui')
    os.makedirs(out, exist_ok=True)
    for name in BANNERS:
        a = np.asarray(Image.open(os.path.join(SRC, 'ui_banner_' + name + '.png')).convert('RGB'), dtype=np.float32)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        m = np.minimum(r, b) - g                              # koliko je piksel magenta (R i B visoko, G nisko)
        alpha = np.clip(1 - (m - 70) / (170 - 70), 0, 1)
        # rub: makni magenta odsjaj (piksel = α·boja + (1−α)·magenta)
        k = np.array([255, 0, 255], dtype=np.float32)
        aa = np.maximum(alpha, 0.05)[..., None]
        rgb = np.clip((a - (1 - aa) * k) / aa, 0, 255)
        al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))   # 1 px uži rub
        im = Image.fromarray(rgb.astype(np.uint8)).convert('RGBA')
        im.putalpha(al)
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(os.path.join(out, 'banner_' + name + '.webp'), quality=88, method=6)
        print('✓ banner', name, im.size, os.path.getsize(os.path.join(out, 'banner_' + name + '.webp')) // 1024, 'KB')


icons()
banners()
