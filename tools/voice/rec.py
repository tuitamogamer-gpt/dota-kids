# Zapiši URL-ove generiranih glasova: python3 rec.py hero key=task_id [key=task_id ...]  (VOX_DATE=2026-10-25)
import json, os, sys
DATE = os.environ.get('VOX_DATE', '2026-10-25')
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'urls.json')
d = json.load(open(P, encoding='utf-8')) if os.path.exists(P) else {}
hero = sys.argv[1]
for kv in sys.argv[2:]:
    k, tid = kv.split('=')
    d[hero + '/' + k] = 'https://platform.r2.fish.audio/tasks/' + DATE + '/' + tid + '.mp3'
json.dump(dict(sorted(d.items())), open(P, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(d), 'clips recorded')
