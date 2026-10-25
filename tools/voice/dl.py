# Preuzmi glasove s Fish Audio u assets/voice/<junak>/<ključ>.mp3 (treba mrežni pristup *.fish.audio):
#   python3 tools/voice/dl.py
# Svaku repliku skrati (tišina na rubovima), izjednači glasnoću i spremi kao mali mono mp3,
# pa u voices.js postavi VOICE_LOCAL = true (igra tada čita lokalne datoteke).
import json, os, re, subprocess, sys, tempfile, urllib.request
D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))
urls = json.load(open(os.path.join(D, 'urls.json'), encoding='utf-8'))
out_dir = os.path.join(ROOT, 'assets', 'voice')
AF = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,'
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,'
      'loudnorm=I=-16:TP=-1.5:LRA=11')
tmp = tempfile.mkdtemp()
fails = 0
for key, url in sorted(urls.items()):
    hero, k = key.split('/')
    dst = os.path.join(out_dir, hero, k + '.mp3')
    if os.path.exists(dst):
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    raw = os.path.join(tmp, hero + '_' + k + '.mp3')
    try:
        urllib.request.urlretrieve(url, raw)
    except Exception as e:
        print('FAIL download', key, e); fails += 1
        if fails >= 3: sys.exit('stopping: downloads are failing (is *.fish.audio allowed?)')
        continue
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', AF, '-ac', '1', '-ar', '24000', '-b:a', '40k', dst])
    if r.returncode != 0:
        os.replace(raw, dst)   # bez obrade, ali barem original
    print('ok', key, os.path.getsize(dst))
missing = [k for k in urls if not os.path.exists(os.path.join(out_dir, *k.split('/')) + '.mp3')]
if missing:
    sys.exit('%d clips still missing' % len(missing))
p = os.path.join(ROOT, 'voices.js')
s = open(p, encoding='utf-8').read()
open(p, 'w', encoding='utf-8').write(s.replace('const VOICE_LOCAL = false;', 'const VOICE_LOCAL = true;'))
print('all %d clips local; VOICE_LOCAL = true' % len(urls))
