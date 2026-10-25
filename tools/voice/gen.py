# Upiše Fish Audio linkove iz urls.json u voices.js (blok VOICE_REMOTE): python3 tools/voice/gen.py
import json, os, re
D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))
urls = json.load(open(os.path.join(D, 'urls.json'), encoding='utf-8'))
KEYS = ['pick', 'move1', 'move2', 'attack', 'ult', 'kill', 'death', 'respawn']
src = open(os.path.join(ROOT, 'voices.js'), encoding='utf-8').read()
heroes = re.findall(r"^  (\w+): \{ voice:", src, re.M)
base = 'https://platform.r2.fish.audio/tasks/'
rows = []
for h in heroes:
    ids = []
    for k in KEYS:
        u = urls[h + '/' + k]
        assert u.startswith(base) and u.endswith('.mp3'), u
        ids.append(u[len(base):-4])   # datum/id
    rows.append("  %s: '%s'," % (h, ' '.join(ids)))
block = ("/* @remote — Fish Audio linkovi (tools/voice/gen.py iz urls.json); redom kao VOICE_KEYS (datum/id).\n"
         "   Kad su datoteke preuzete u assets/voice/ (tools/voice/dl.py), VOICE_LOCAL = true. */\n"
         "const VOICE_LOCAL = false;\n"
         "const VOICE_REMOTE_BASE = '%s';\n"
         "const VOICE_REMOTE = {\n%s\n};\n") % (base, '\n'.join(rows))
i = src.find('/* @remote')
src = (src[:i] if i >= 0 else src.rstrip('\n') + '\n') + block
open(os.path.join(ROOT, 'voices.js'), 'w', encoding='utf-8').write(src)
print('voices.js: %d heroes, %d clips' % (len(rows), len(rows) * len(KEYS)))
