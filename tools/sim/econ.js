/* =====================================================================
   💰 DOTA Kids — ekonomija u simulaciji (v0.54; botovi vode oba tima, kao sim.js)
   Za svaki zlatnik zapiše IZVOR (zadnji udarac, džungla, ubojstvo, asistencija, pasivno, kula, runa…),
   pa ispiše zlato po minuti po fazi igre, krivulju neto vrijednosti (prosjek / najbogatiji / najsiromašniji),
   vodstvo tima, kad junaci kupe prvi veliki predmet i koliko je najbogatiji junak ispred ostalih (snowball).

     node tools/sim/econ.js [broj igara] [--max=sekunde] [--turbo] [--json=igre.json]
     node tools/sim/econ.js 4 --set=creepGoldMul=0.6,heroKillGold=80   (probaj druge vrijednosti iz CFG)
     node tools/sim/econ.js --load=a.json,b.json                        (samo sažetak već odigranih igara)
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const argv = process.argv.slice(2);
const N = parseInt(argv.find(a => /^\d+$/.test(a)) || '6', 10);
const MAX = parseFloat((argv.find(a => a.startsWith('--max=')) || '--max=2700').slice(6));
const ROOT = (argv.find(a => a.startsWith('--repo=')) || '').slice(7) || path.resolve(__dirname, '..', '..');
const JSON_OUT = (argv.find(a => a.startsWith('--json=')) || '').slice(7);
const TURBO = argv.includes('--turbo');
const SET = ((argv.find(a => a.startsWith('--set=')) || '').slice(6)).split(',').filter(Boolean).map(kv => kv.split('='));
const PATCH = (argv.find(a => a.startsWith('--patch=')) || '').slice(8);   // dodatni JS u kontekstu igre (npr. zamjena funkcije)
const simSrc = fs.readFileSync(path.join(ROOT, 'tools/sim/sim.js'), 'utf8');
const head = simSrc.split('function runGame')[0];
const mk = new Function('require', '__dirname', 'process', head + '\n;return { makeContext, SRC, STUBS };');
const { makeContext, SRC, STUBS } = mk(require, path.join(ROOT, 'tools/sim'), { argv: ['node', 'sim.js'] });
const pre = ['sr.js', 'i18n.js', 'data.js', 'voices.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
const nl = s => s.split('\n').length - 1;
const dataStart = nl(pre[0] + '\n' + pre[1] + '\n') + 1;
const dataEnd = dataStart + nl(pre[2]) + 1;
const gameStart = nl(pre.join('\n') + STUBS) + 1;
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const gameEnd = gameStart + nl(gameSrc) + 1;
const gameLines = gameSrc.split('\n');
// izvor po retku game.js: prepoznaj po sadržaju retka (radi i kad se game.js promijeni)
function srcName(file, L){
  if(file === 'd') return 'data';
  const s = gameLines[L - 1] || '';
  if(/t\.goldValue/.test(s)){
    for(let i = L - 1; i > L - 40 && i > 0; i--){
      const q = gameLines[i - 1];
      if(/t\.kind === 'neutral'/.test(q)) return 'jungle';
      if(/t\.kind === 'creep'/.test(q)) return 'lasthit';
    }
    return 'goldValue?';
  }
  if(/passiveGold/.test(s)) return 'passive';
  if(/heroKillGold/.test(s)) return 'kill';
  if(/\bcb\b|\bpart\b/.test(s)) return 'comeback';
  if(/bossGoldTeam/.test(s)) return 'dragon';
  if(/bonus/.test(s) && /credit/.test(s)) return 'shutdown';
  if(/trackBonusVal/.test(s)) return 'track';
  if(/gold \+= (mine|share)/.test(s)) return 'rich';
  if(/assistGold/.test(s)) return 'assist';
  if(/\btg\b/.test(s)) return 'tower';
  if(/barracksGoldTeam/.test(s)) return 'barracks';
  if(/\+= 200/.test(s)) return 'dragon';
  if(/e\.gold \+= g/.test(s)) return 'bountyrune';
  if(/q\.gold/.test(s)) return 'quest';
  if(/h\.gold \+= v/.test(s)) return 'sell';
  return 'g' + L;
}
Error.stackTraceLimit = 4;
function classify(){
  const st = new Error().stack;
  const re = /game-bundle\.js:(\d+):/g;
  let m;
  while((m = re.exec(st))){
    const L = +m[1];
    if(L >= gameStart && L < gameEnd) return srcName('g', L - gameStart + 1);
    if(L >= dataStart && L < dataEnd) return 'data:' + (L - dataStart + 1);
  }
  return 'other';
}

function runGame(gi){
  const ctx = makeContext();
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'game-bundle.js' });
  const G = ctx.__G;
  G.SETTINGS.diff = 'normal';
  if(TURBO) G.SETTINGS.mode = 'turbo';
  for(const kv of SET) vm.runInContext('CFG_BASE[' + JSON.stringify(kv[0]) + '] = ' + kv[1], ctx);   // --set=ključ=vrijednost,...
  if(PATCH) vm.runInContext(PATCH, ctx);
  const hi = Math.floor(Math.random() * G.HEROES.length);
  G.startGame(hi);
  G.player.bot = { state: 'lane', thinkT: 0.3 };
  const heroes = G.units.filter(u => u.kind === 'hero');
  const inc = new Map();      // junak -> { izvor: zlato }
  let phase = 0;
  for(const h of heroes){
    let v = h.gold;
    const rec = {};
    inc.set(h, rec);
    Object.defineProperty(h, 'gold', {
      get(){ return v; },
      set(nv){
        const d = nv - v; v = nv;
        if(!(d > 1e-9) || G.gameTime < 0) return;
        const k = classify();
        if(k === 'sell') return;
        const key = k + '@' + phase;
        rec[key] = (rec[key] || 0) + d;
      }, configurable: true, enumerable: true,
    });
  }
  const samples = [];   // po minuti: { t, nw:[po junaku], lv, team nw, items }
  const big = new Map(); // junak -> { 1800: t, 3000: t, 4500: t }
  const dt = 0.05;
  let nextS = 60;
  const fullCost = it => G.netWorth({ gold: 0, items: [it], backpack: [] });
  while(!G.gameOver && G.gameTime < MAX){
    G.update(dt);
    phase = G.gameTime < 600 ? 0 : (G.gameTime < 1200 ? 1 : 2);
    if(G.gameTime >= nextS){
      const t = nextS; nextS += 60;
      const nw = heroes.map(h => G.netWorth(h));
      samples.push({ t, nw, team: [0, 1].map(tm => heroes.reduce((a, h, i) => a + (h.team === tm ? nw[i] : 0), 0)),
        lv: heroes.map(h => h.level), k: G.kills.slice(),
        tw: [0, 1].map(tm => G.units.filter(u => (u.kind === 'tower' || u.kind === 'barracks') && u.team === tm && !u.dead).length) });
      for(const h of heroes){
        const b = big.get(h) || {};
        for(const it of h.items.concat(h.backpack || [])) if(b[it.id] == null) b[it.id] = [t, fullCost(it)];
        big.set(h, b);
      }
    }
  }
  const T = G.gameTime;
  return {
    min: +(T / 60).toFixed(1), win: G.winnerTeam, kills: G.kills.slice(),
    heroes: heroes.map(h => ({ id: h.hero.id, team: h.team, lvl: h.level, k: h.kills, d: h.deaths, a: h.assists, lh: h.lastHits,
      nw: G.netWorth(h), inc: inc.get(h), big: big.get(h) || {} })),
    samples,
  };
}

const LOAD = (argv.find(a => a.startsWith('--load=')) || '').slice(7);
const games = LOAD ? LOAD.split(',').flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8'))) : [];
for(let i = 0; i < (LOAD ? 0 : N); i++){
  const t0 = Date.now();
  const r = runGame(i + 1);
  games.push(r);
  console.log(`#${i + 1} ${String(r.min).padStart(5)} min  pobjeda ${r.win === 0 ? 'plavi ' : (r.win === 1 ? 'crveni' : '—     ')}  K ${r.kills[0]}:${r.kills[1]}  ` +
    `NW ${r.heroes.filter(h => h.team === 0).reduce((a, h) => a + h.nw, 0)}/${r.heroes.filter(h => h.team === 1).reduce((a, h) => a + h.nw, 0)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
if(JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(games));

// ---------- sažetak ----------
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const med = a => { if(!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log(`\nigara ${games.length}, trajanje prosjek ${mean(games.map(g => g.min)).toFixed(1)} min (min ${Math.min(...games.map(g => g.min))}, max ${Math.max(...games.map(g => g.min))}), ubojstava po igri ${mean(games.map(g => g.kills[0] + g.kills[1])).toFixed(1)}`);
// zlato po izvoru: zlato/min po junaku, po fazi (0–10, 10–20, 20+)
const phaseLen = g => [Math.min(g.min, 10), Math.max(0, Math.min(g.min, 20) - 10), Math.max(0, g.min - 20)];
const srcs = new Set();
for(const g of games) for(const h of g.heroes) for(const k in h.inc) srcs.add(k.split('@')[0]);
console.log('\nzlato/min po junaku (prosjek), po fazi igre:');
console.log('  izvor'.padEnd(16) + ['0–10', '10–20', '20+', 'cijela'].map(s => s.padStart(9)).join(''));
const tot = [0, 0, 0, 0];
const rows = [];
for(const s of srcs){
  const v = [0, 1, 2].map(p => {
    let gold = 0, mins = 0;
    for(const g of games){ const pl = phaseLen(g)[p]; if(pl <= 0) continue; mins += pl * g.heroes.length; for(const h of g.heroes) gold += h.inc[s + '@' + p] || 0; }
    return mins ? gold / mins : 0;
  });
  let gold = 0, mins = 0;
  for(const g of games){ mins += g.min * g.heroes.length; for(const h of g.heroes) for(const p of [0, 1, 2]) gold += h.inc[s + '@' + p] || 0; }
  v.push(gold / mins);
  rows.push([s, v]);
}
rows.sort((a, b) => b[1][3] - a[1][3]);
for(const [s, v] of rows){ console.log('  ' + s.padEnd(14) + v.map(x => x.toFixed(0).padStart(9)).join('')); v.forEach((x, i) => tot[i] += x); }
console.log('  ' + 'UKUPNO'.padEnd(14) + tot.map(x => x.toFixed(0).padStart(9)).join(''));
// neto vrijednost po minuti
console.log('\nneto vrijednost junaka (prosjek / najbogatiji / najsiromašniji u igri, prosjek po igrama), level, vodstvo tima:');
for(const m of [5, 10, 15, 20, 25, 30, 35]){
  const ss = games.map(g => g.samples.find(s => s.t === m * 60)).filter(Boolean);
  if(ss.length < Math.max(2, games.length * 0.3)) continue;
  const avg = mean(ss.map(s => mean(s.nw))), mx = mean(ss.map(s => Math.max(...s.nw))), mn = mean(ss.map(s => Math.min(...s.nw)));
  const lead = mean(ss.map(s => Math.abs(s.team[0] - s.team[1])));
  const leadPct = mean(ss.map(s => Math.abs(s.team[0] - s.team[1]) / Math.max(1, (s.team[0] + s.team[1]) / 2) * 100));
  const lv = mean(ss.map(s => mean(s.lv)));
  console.log(`  ${String(m).padStart(2)} min (${ss.length} ig.): NW ${avg.toFixed(0).padStart(6)}  max ${mx.toFixed(0).padStart(6)}  min ${mn.toFixed(0).padStart(5)}  max/prosjek ${(mx / avg).toFixed(2)}  ` +
    `lvl ${lv.toFixed(1)}  vodstvo tima ${lead.toFixed(0).padStart(6)} (${leadPct.toFixed(0)}%)`);
}
// tko vodi u 10./15. min — pobijedi li?
for(const m of [10, 15]){
  let n = 0, w = 0;
  for(const g of games){ const s = g.samples.find(x => x.t === m * 60); if(!s || g.win == null) continue; n++; if((s.team[0] > s.team[1] ? 0 : 1) === g.win) w++; }
  console.log(`  vodeći tim u ${m}. min pobijedi: ${w}/${n}`);
}
// veliki predmeti
console.log('\nprvi predmet (puna cijena) ≥ 1000 / 2000 / 2500 — medijan vremena (min) i udio junaka koji ga imaju do 10 / 15 / 20 min:');
for(const th of [1000, 2000, 2500]){
  const ts = [];
  let n = 0, by = [0, 0, 0];
  for(const g of games) for(const h of g.heroes){ n++; let t = null; for(const id in h.big){ const [tt, c] = h.big[id]; if(c >= th && (t == null || tt < t)) t = tt; } if(t != null){ ts.push(t / 60); if(t <= 600) by[0]++; if(t <= 900) by[1]++; if(t <= 1200) by[2]++; } }
  console.log(`  ≥ ${String(th).padStart(4)}: medijan ${med(ts).toFixed(1)} min (najraniji ${Math.min(...ts).toFixed(0)})  do 10 min ${(100 * by[0] / n).toFixed(0)}%  do 15 min ${(100 * by[1] / n).toFixed(0)}%  do 20 min ${(100 * by[2] / n).toFixed(0)}%`);
}
// udio zlata od ubojstava kod najbogatijeg junaka
let kshare = [];
for(const g of games){
  const h = g.heroes.slice().sort((a, b) => b.nw - a.nw)[0];
  let all = 0, kill = 0;
  for(const k in h.inc){ all += h.inc[k]; if(/^(kill|shutdown|comeback|assist|track|rich)/.test(k)) kill += h.inc[k]; }
  kshare.push(kill / all);
}
console.log(`\nnajbogatiji junak u igri: udio zlata od ubojstava/asistencija ${(100 * mean(kshare)).toFixed(0)}%`);
