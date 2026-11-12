/* 🧪 Probna igra u pregledniku (Playwright + Chromium): učita igru s malim poslužiteljem, odabere junaka, pokrene igru
   i pusti je nekoliko sekundi — svaka greška na stranici (i u 3D crtanju, koje simulacija ne pokreće) ruši provjeru.
   Uz to provjeri geometriju svih 3D modela: nijedan komad ne smije biti izvrnut naopako (insideOutPieces),
   i da svaka moć svakog junaka ima svoju animaciju (isječak abQ / abW / abE / abR u modelu).
     npm i --no-save playwright && npx playwright install chromium && node tools/smoke.js */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
/* 🧸 provjera geometrije modela (u stranici, nakon učitavanja GLB-a): zatvoreni komad s negativnim obujmom je izvrnut naopako —
   plohe gledaju prema unutra, pa je u igri crn (obris) ili krivo osvijetljen. Tako su bile Bikoševa sjekira, Zekina zvijezda
   i desna krila zmajeva (tools/blender/build_models.py: poly()). Vraća popis takvih komada. */
function insideOutPieces(){
  const bad = [];
  for(const name of Object.keys(MODELS.tpl)){
    MODELS.tpl[name].traverse(o => {
      if(!o.isMesh) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index, nT = (idx ? idx.count : pos.count) / 3, vi = k => idx ? idx.getX(k) : k;
      const key = new Map(), wid = new Int32Array(pos.count);   // vrhovi na istom mjestu = isti vrh (glTF ih dijeli po normali i boji)
      for(let i = 0; i < pos.count; i++){ const k = Math.round(pos.getX(i) * 2e4) + ',' + Math.round(pos.getY(i) * 2e4) + ',' + Math.round(pos.getZ(i) * 2e4); let w = key.get(k); if(w === undefined){ w = key.size; key.set(k, w); } wid[i] = w; }
      const par = new Int32Array(key.size).map((_, i) => i), find = x => { while(par[x] !== x){ par[x] = par[par[x]]; x = par[x]; } return x; };
      for(let t = 0; t < nT; t++){ const a = find(wid[vi(t * 3)]); par[find(wid[vi(t * 3 + 1)])] = a; par[find(wid[vi(t * 3 + 2)])] = a; }
      const vol = new Map(), edges = new Map();
      for(let t = 0; t < nT; t++){
        const i = [vi(t * 3), vi(t * 3 + 1), vi(t * 3 + 2)], P = i.map(k => [pos.getX(k), pos.getY(k), pos.getZ(k)]), r = find(wid[i[0]]);
        vol.set(r, (vol.get(r) || 0) + (P[0][0] * (P[1][1] * P[2][2] - P[1][2] * P[2][1]) - P[0][1] * (P[1][0] * P[2][2] - P[1][2] * P[2][0]) + P[0][2] * (P[1][0] * P[2][1] - P[1][1] * P[2][0])) / 6);
        for(const [x, y] of [[wid[i[0]], wid[i[1]]], [wid[i[1]], wid[i[2]]], [wid[i[2]], wid[i[0]]]]){ const k = x < y ? x + '_' + y : y + '_' + x; edges.set(k, (edges.get(k) || 0) + 1); }
      }
      const open = new Set();
      for(const [k, n] of edges) if(n === 1) open.add(find(+k.split('_')[0]));
      for(const [r, v] of vol) if(!open.has(r) && v < -1e-9) bad.push(o.name + ' (' + (o.userData.matName || '') + ')');
    });
  }
  return bad;
}
(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/';
  const errors = [];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for(const lang of ['hr', 'en']){
    const p = await b.newPage({ viewport: { width: 1100, height: 650 } });
    p.on('pageerror', e => errors.push(lang + ': ' + e.message));
    await p.goto(url + '?lang=' + lang, { waitUntil: 'load', timeout: 120000 });
    await p.waitForTimeout(2000);
    await p.evaluate(() => document.getElementById('lgPlay').click());
    await p.waitForTimeout(800);
    await p.evaluate(() => selectHero(Math.floor(Math.random() * HEROES.length)));
    await p.evaluate(() => { const s = document.getElementById('startBtn'); s.disabled = false; s.click(); });
    await p.waitForTimeout(4000);
    // preskoči pripremu i pusti igru (logika + crtanje) da se vrti
    await p.evaluate(() => { if(shopOpen) toggleShop(); gameTime = 1; for(let k = 0; k < 900; k++) update(1 / 30); });
    await p.waitForTimeout(6000);
    const st = await p.evaluate(() => ({ running, t: Math.round(gameTime), units: units.length, models: !!(MODELS.ready || MODELS.failed) }));
    console.log(lang, JSON.stringify(st));
    if(!st.running || st.units < 20) errors.push(lang + ': igra ne radi ' + JSON.stringify(st));
    if(lang === 'hr'){   // 🧸 modeli: nijedan komad ne smije biti izvrnut naopako
      const bad = await p.evaluate('(' + insideOutPieces.toString() + ')()');
      console.log('modeli: izvrnutih komada ' + bad.length);
      if(bad.length) errors.push('izvrnuti komadi modela: ' + bad.slice(0, 12).join(', '));
      // 🎬 svaka moć koja se baca ima svoju kretnju iz Blendera (isječak 'ab' + tipka u modelu junaka)
      const noAnim = await p.evaluate(() => HEROES.flatMap(h => h.abilities.filter(a => !a.passive && !(MODELS.clips['hero_' + h.id] || {})['ab' + a.key]).map(a => h.id + ':' + a.key)));
      console.log('modeli: moći bez vlastite animacije ' + noAnim.length);
      if(noAnim.length) errors.push('moći bez animacije: ' + noAnim.join(', '));
    }
    await p.close();
  }
  await b.close();
  server.close();
  if(errors.length){ console.error('✗ greške:\n' + errors.join('\n')); process.exit(1); }
  console.log('✓ probna igra bez grešaka');
})().catch(e => { console.error(e); process.exit(1); });
