/* =====================================================================
   🤖 DOTA Kids — headless simulacija (Node, bez preglednika)
   Učita data.js, game.js, shop.js i net.js u izolirani kontekst (3D i DOM su
   prazni stubovi), pa pusti da botovi vode OBA tima — i tvog junaka.
   Koristi se za provjeru ravnoteže, veličine mape i umjetne inteligencije.

     node tools/sim/sim.js [broj igara] [--max=sekunde] [--diff=normal] [--quiet]

   Ispis po igri: trajanje, pobjednik, ubojstva, srušene kule, statistike
   razmaka među junacima (koliko je mapa "gužva"), gankovi i guranja.
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const N = parseInt(args.find(a => /^\d+$/.test(a)) || '1', 10);
const MAX = parseFloat((args.find(a => a.startsWith('--max=')) || '--max=2400').slice(6));
const DIFF = (args.find(a => a.startsWith('--diff=')) || '--diff=normal').slice(7);
const QUIET = args.includes('--quiet');
const HERO = (args.find(a => a.startsWith('--hero=')) || '').slice(7);   // tvoj junak (id), npr. --hero=nisan
const VS = (args.find(a => a.startsWith('--vs=')) || '').slice(5);       // junaci koji su sigurno u igri, npr. --vs=bikos,nisan
const CHECK = args.includes('--check');                                   // ispiši stanje svakog junaka na kraju

function stubEl(){
  const el = {
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', offsetWidth: 100, offsetHeight: 100, isConnected: false,
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){}, focus(){}, blur(){},
    querySelector(){ return stubEl(); }, querySelectorAll(){ return []; }, getBoundingClientRect(){ return { x: 0, y: 0, width: 10, height: 10 }; },
    getContext(){ return new Proxy({}, { get: (t, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop(){} }) : (k === 'measureText' ? () => ({ width: 10 }) : (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {})), set: () => true }); },
    toDataURL(){ return ''; }, scrollIntoView(){},
  };
  return el;
}
function makeContext(){
  const lang = ['en', 'sr', 'cy'].find(l => process.argv.includes('--' + l));   // --en / --sr / --cy: engleski, srpski, ćirilica
  const store = lang ? { dk_lang: lang } : {};
  const ctx = {
    console, Math, Date, JSON, Map, Set, WeakMap, Array, Object, Number, String, Boolean, Promise, Symbol, Error, RegExp, Proxy,
    Float32Array, Uint8Array, Uint8ClampedArray, Int16Array, Int32Array, Uint16Array, Float64Array,
    parseInt, parseFloat, isFinite, isNaN, setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { userAgent: 'node' },
    matchMedia: () => ({ matches: false }),
    confirm: () => true, alert(){}, innerWidth: 1280, innerHeight: 720,
    Image: function(){ this.complete = false; this.naturalWidth = 0; this.addEventListener = () => {}; },
    Audio: function(){ this.play = () => ({ catch(){} }); this.pause = () => {}; },
    CanvasRenderingContext2D: function(){},
    DOMMatrix: function(){ this.scale = () => this; },
  };
  ctx.window = ctx;
  ctx.document = {
    getElementById: () => stubEl(), createElement: () => stubEl(), querySelectorAll: () => [], querySelector: () => stubEl(),
    addEventListener(){}, body: stubEl(), documentElement: stubEl(), fullscreenElement: null, pointerLockElement: null,
  };
  ctx.addEventListener = () => {};
  ctx.location = { protocol: 'http:', reload(){} };
  return ctx;
}
// 3D (scene3d.js) i ostalo što logika poziva — prazno
const STUBS = `
var camera3 = null, POST = { on: false }, fx = { points: null };
function setGround(){} function buildTrees3D(){} function buildStatic3D(){} function clearScene3D(){} function buildPlayerRing(){}
function setFogCanvas(){} function markFogDirty(){} function initScene3D(){} function setQuality3D(){} function resize3D(){} function render3D(){}
function syncScene(){} function updateCamera3(){} function applyDayNight(){} function togglePost(){ return false; } function startCinematic(){}
function showHeroPreview(){} function screenToWorld(){ return { x: 0, y: 0 }; } function worldToScreen(){ return null; } function pickUnitScreen(){ return null; }
function unitHitShape(){ return { H: 1, R: 1 }; } function treeCut3D(){} function treeGrow3D(){}
`;
const SRC = ['sr.js', 'i18n.js', 'data.js', 'voices.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + STUBS +
  ['game.js', 'shop.js', 'net.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + `
;globalThis.__G = { get units(){ return units; }, get gameTime(){ return gameTime; }, get gameOver(){ return gameOver; },
  get winnerTeam(){ return winnerTeam; }, get kills(){ return kills; }, get player(){ return player; }, get teamAI(){ return typeof teamAI !== 'undefined' ? teamAI : null; },
  HEROES, CFG, WORLD, SETTINGS, startGame, update, netWorth, LANE_PTS, FOUNTAIN, trees: () => trees, camps: () => camps,
  treesCut: () => treesCut.length, treeEaten: () => trees.filter(t => t.everCut).length };
{ const cA = castAbility; castAbility = function(u, i, aim){ const cd0 = u.abilities[i] && u.abilities[i].cd; cA(u, i, aim); const ab = u.abilities[i];
    if(ab && cd0 <= 0 && ab.cd > 0){ u.casts = u.casts || {}; u.casts[ab.def.key] = (u.casts[ab.def.key] || 0) + 1; } }; }
{ const cT = cutTree; cutTree = function(t, by){ const r = cT(t, by); if(r) t.everCut = true; return r; }; }
`;

function runGame(gi){
  const ctx = makeContext();
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'game-bundle.js' });
  const G = ctx.__G;
  G.SETTINGS.diff = DIFF;
  const hi = HERO ? G.HEROES.findIndex(h => h.id === HERO) : Math.floor(Math.random() * G.HEROES.length);
  if(VS){   // zadani junaci prvi u ostatku (crveni tim kreće od 5. mjesta: prvo popuni crvene)
    const want = VS.split(',').map(id => G.HEROES.findIndex(h => h.id === id)).filter(i => i >= 0 && i !== hi);
    const orig = ctx.shuffle;
    ctx.shuffle = arr => { const a = orig(arr).filter(i => !want.includes(i)); a.splice(4, 0, ...want); return a; };
  }
  G.startGame(hi);
  const p = G.player;
  p.bot = { state: 'lane', thinkT: 0.3 };   // i tvog junaka vodi bot
  const dt = 0.05;
  const stat = { nearSum: 0, nearN: 0, crowd: 0, crowdN: 0, fightT: 0, towerKills: [0, 0], heroDeaths: 0, tDeath: [], spread: 0 };
  let tLog = 0;
  while(!G.gameOver && G.gameTime < MAX){
    G.update(dt);
    if(G.gameTime < 0) continue;
    // svake sekunde: razmak do najbližeg neprijateljskog junaka, gužva (junaci unutar 700)
    if(Math.floor(G.gameTime) !== Math.floor(G.gameTime - dt)){
      const hs = G.units.filter(u => u.kind === 'hero' && !u.dead);
      for(const h of hs){
        let nd = 1e9, near = 0;
        for(const o of hs){
          if(o === h) continue;
          const d = Math.hypot(o.x - h.x, o.y - h.y);
          if(o.team !== h.team) nd = Math.min(nd, d);
          if(d < 700) near++;
        }
        if(nd < 1e9){ stat.nearSum += nd; stat.nearN++; }
        stat.crowd += near; stat.crowdN++;
        if(nd < 600) stat.fightT++;
      }
      if(!QUIET && G.gameTime - tLog >= 300){
        tLog = G.gameTime;
        const lv = t => (G.units.filter(u => u.kind === 'hero' && u.team === t).reduce((a, h) => a + h.level, 0) / 5).toFixed(1);
        const tw = t => G.units.filter(u => u.kind === 'tower' && u.team === t).length;
        console.log(`  [${(G.gameTime / 60).toFixed(0)} min] K ${G.kills[0]}:${G.kills[1]}  lvl ${lv(0)}/${lv(1)}  kule ${tw(0)}/${tw(1)}` +
          (G.teamAI ? '  ' + G.teamAI.map(a => a.log || '').join(' | ') : ''));
      }
    }
  }
  const heroes = G.units.filter(u => u.kind === 'hero');
  const res = {
    i: gi, hero: G.HEROES[hi].name, min: +(G.gameTime / 60).toFixed(1), win: G.winnerTeam, kills: G.kills.slice(),
    towers: [0, 1].map(t => G.units.filter(u => u.kind === 'tower' && u.team === t).length),
    lvl: [0, 1].map(t => +(heroes.filter(h => h.team === t).reduce((a, h) => a + h.level, 0) / 5).toFixed(1)),
    nw: [0, 1].map(t => heroes.filter(h => h.team === t).reduce((a, h) => a + G.netWorth(h), 0)),
    nearEnemy: Math.round(stat.nearSum / Math.max(1, stat.nearN)),
    crowd: +(stat.crowd / Math.max(1, stat.crowdN)).toFixed(2),
    fightPct: +(100 * stat.fightT / Math.max(1, stat.nearN)).toFixed(1),
    ai: G.teamAI ? G.teamAI.map(a => a.stats) : null,
    deaths: heroes.reduce((a, h) => a + h.deaths, 0),
  };
  if(CHECK) for(const h of heroes){
    const tl = Object.keys(h.talents).map(l => l + (h.talents[l])).join(' ');
    console.log(`   ${h.team ? '🔴' : '🔵'} ${h.hero.id.padEnd(10)} lvl ${String(h.level).padStart(2)} K/D/A ${h.kills}/${h.deaths}/${h.assists}  talenti [${tl}]` +
      `  moći ${h.abilities.map(a => a.rank).join('')}  predmeti ${h.items.map(i => i.id).join(',')}` +
      (h.helixN ? '  vrtlog×' + h.helixN : '') + (h.chanN ? '  nišanio×' + h.chanN : '') + (h.casts ? '  bacio ' + JSON.stringify(h.casts) : ''));
  }
  if(CHECK) console.log('   posječena/pojedena stabla sada:', ctx.__G.treesCut ? ctx.__G.treesCut() : '?', ' ukupno pojedeno:', ctx.__G.treeEaten ? ctx.__G.treeEaten() : '?');
  return res;
}

const all = [];
for(let i = 0; i < N; i++){
  const t0 = Date.now();
  const r = runGame(i + 1);
  all.push(r);
  console.log(`#${r.i} ${r.hero.padEnd(9)} ${String(r.min).padStart(5)} min  pobjeda: ${r.win == null ? '—' : (r.win === 0 ? 'plavi' : 'crveni')}  K ${r.kills[0]}:${r.kills[1]}` +
    `  kule ${r.towers[0]}/${r.towers[1]}  lvl ${r.lvl[0]}/${r.lvl[1]}  neto ${r.nw[0]}/${r.nw[1]}  razmak ${r.nearEnemy}  gužva ${r.crowd}  borba ${r.fightPct}%` +
    (r.ai ? '  AI ' + JSON.stringify(r.ai) : '') + `  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
if(N > 1){
  const avg = k => (all.reduce((a, r) => a + r[k], 0) / all.length).toFixed(1);
  console.log(`prosjek: ${avg('min')} min, razmak ${avg('nearEnemy')}, gužva ${avg('crowd')}, borba ${avg('fightPct')}%, smrti ${avg('deaths')}, pobjede plavi ${all.filter(r => r.win === 0).length}/${all.length}`);
}
