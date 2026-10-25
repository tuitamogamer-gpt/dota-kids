# Upiše Fish Audio linkove iz urls.json u voices.js (blok VOICE_REMOTE + ANN_REMOTE): python3 tools/voice/gen.py
import json, os, re
D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))
urls = json.load(open(os.path.join(D, 'urls.json'), encoding='utf-8'))
src = open(os.path.join(ROOT, 'voices.js'), encoding='utf-8').read()
KEYS = re.findall(r"'(\w+)'", re.search(r"const VOICE_KEYS = \[(.*?)\];", src).group(1))
heroes = re.findall(r"^  (\w+): \{ voice:", src, re.M)
ann_block = re.search(r"const ANNOUNCER = \{(.*?)\n\};", src, re.S).group(1)
ANN = [k for k in re.findall(r"(\w+): ['\"]", ann_block) if k != 'voice']
base = 'https://platform.r2.fish.audio/tasks/'
def rel(key):
    u = urls[key]
    assert u.startswith(base) and u.endswith('.mp3'), u
    return u[len(base):-4]   # datum/id
rows = ["  %s: '%s'," % (h, ' '.join(rel(h + '/' + k) for k in KEYS)) for h in heroes]
ann_rows = ["  %s: '%s'," % (k, rel('ann/' + k)) for k in ANN]
block = ("/* @remote — Fish Audio linkovi (tools/voice/gen.py iz urls.json); redom kao VOICE_KEYS (datum/id).\n"
         "   Kad su datoteke preuzete u assets/voice/ (tools/voice/dl.py), VOICE_LOCAL = true. */\n"
         "const VOICE_LOCAL = false;\n"
         "const VOICE_REMOTE_BASE = '%s';\n"
         "const VOICE_REMOTE = {\n%s\n};\n"
         "const ANN_REMOTE = {\n%s\n};\n") % (base, '\n'.join(rows), '\n'.join(ann_rows))
i = src.find('/* @remote')
src = (src[:i] if i >= 0 else src.rstrip('\n') + '\n') + block
open(os.path.join(ROOT, 'voices.js'), 'w', encoding='utf-8').write(src)
print('voices.js: %d heroes x %d lines, %d announcer lines' % (len(rows), len(KEYS), len(ann_rows)))
