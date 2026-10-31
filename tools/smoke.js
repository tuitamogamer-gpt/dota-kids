/* 🧪 Probna igra u pregledniku (Playwright + Chromium): učita igru s malim poslužiteljem, odabere junaka, pokrene igru
   i pusti je nekoliko sekundi — svaka greška na stranici (i u 3D crtanju, koje simulacija ne pokreće) ruši provjeru.
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
    await p.close();
  }
  await b.close();
  server.close();
  if(errors.length){ console.error('✗ greške:\n' + errors.join('\n')); process.exit(1); }
  console.log('✓ probna igra bez grešaka');
})().catch(e => { console.error(e); process.exit(1); });
