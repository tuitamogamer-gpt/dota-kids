'use strict';
/* ============================================================
   DOTA Kids 3D — logika igre + HUD (DotA All-Stars mehanike)
   - Poeni vještina, recepti, džungla, rune, dan/noć
   - VISINE: rijeka je nizina, baze su platoi; pucanje uzbrdo
     zna promašiti (25%)
   - CILJANJE: moći s ciljem prikazuju domet + krug područja
   - Prodaja predmeta klikom na torbu (50% vrijednosti)
   ============================================================ */

/* ================= Pomoćne funkcije ================= */
const TAU = Math.PI * 2;
function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function distXY(x1, y1, x2, y2){ return Math.hypot(x1 - x2, y1 - y2); }
function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t){ return a + (b - a) * t; }
function rand(a, b){ return a + Math.random() * (b - a); }
function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function smoothstep(a, b, v){
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function stepToward(p, q, d){
  const dx = q.x - p.x, dy = q.y - p.y;
  const L = Math.hypot(dx, dy) || 1;
  return { x: p.x + dx / L * d, y: p.y + dy / L * d };
}
function clampRange(u, aim, R){
  const dx = aim.x - u.x, dy = aim.y - u.y;
  const d = Math.hypot(dx, dy);
  if(d <= R) return { x: aim.x, y: aim.y };
  return { x: u.x + dx / d * R, y: u.y + dy / d * R };
}
function distToSeg(px, py, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = clamp(t, 0, 1);
  return distXY(px, py, ax + dx * t, ay + dy * t);
}
function distToPath(pts, x, y){
  let m = 1e9;
  for(let i = 0; i < pts.length - 1; i++){
    m = Math.min(m, distToSeg(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return m;
}
function pathLength(pts){
  let L = 0;
  for(let i = 0; i < pts.length - 1; i++)
    L += distXY(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  return L;
}
function pointAt(pts, frac){
  const total = pathLength(pts);
  let d = clamp(frac, 0, 1) * total;
  for(let i = 0; i < pts.length - 1; i++){
    const seg = distXY(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if(d <= seg){
      const t = seg ? d / seg : 0;
      return { x: lerp(pts[i][0], pts[i + 1][0], t), y: lerp(pts[i][1], pts[i + 1][1], t) };
    }
    d -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last[0], y: last[1] };
}
const FONT_UI = '"Nunito","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';   // 🔤 v0.56 (bez Comic Sansa i rukopisnih slova)
function fontTxt(px, bold){ return (bold ? '800 ' : '600 ') + px + 'px ' + FONT_UI; }
function fontEmoji(px){ return px + 'px "Segoe UI Emoji","Apple Color Emoji",sans-serif'; }

// roundRect polyfill
if(typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r){
    if(typeof r === 'number') r = [r, r, r, r];
    this.moveTo(x + r[0], y);
    this.arcTo(x + w, y, x + w, y + h, r[1]);
    this.arcTo(x + w, y + h, x, y + h, r[2]);
    this.arcTo(x, y + h, x, y, r[3]);
    this.arcTo(x, y, x + w, y, r[0]);
    this.closePath();
    return this;
  };
}

/* ================= Mapa: staze, baze, kule, visine ================= */
const LANE_LIST = ['top', 'mid', 'bot'];
const LANE_PTS = {
  top: [[300,2520],[250,1450],[250,420],[420,250],[1450,250],[2520,300]],
  mid: [[420,2580],[1010,1990],[1500,1500],[1990,1010],[2580,420]],
  bot: [[480,2700],[1550,2750],[2580,2750],[2750,2580],[2750,1550],[2700,480]],
};
const S3 = v => Math.round(v * MAP_S);   // koordinate stare mape (3000) → nova veća mapa
for(const l in LANE_PTS) LANE_PTS[l] = LANE_PTS[l].map(([x, y]) => [S3(x), S3(y)]);
const LANE_REV = {};
for(const l of LANE_LIST) LANE_REV[l] = LANE_PTS[l].slice().reverse();
function lanePath(team, lane){ return team === TEAM_BLUE ? LANE_PTS[lane] : LANE_REV[lane]; }

const FOUNTAIN = [{ x: S3(150), y: S3(2850) }, { x: S3(2850), y: S3(150) }];
const ANCIENT_POS = [{ x: S3(320), y: S3(2680) }, { x: S3(2680), y: S3(320) }];
const GUARD_POS = [
  [[S3(470), S3(2640)], [S3(360), S3(2530)]],
  [[S3(2530), S3(360)], [S3(2640), S3(470)]],
];
/* 🏰 v0.56 raspored kao u DotA 2: na svakoj stazi T1 i T2, T3 na ulazu u bazu, vojarna odmah iza T3,
   a dvije T4 (čuvarske) uz prijestol. Udio puta od plave baze (crveni zrcalno: 1 − udio); sredina je kraća. */
const TOWER_FRACS = { top: [0.36, 0.25, 0.135], mid: [0.36, 0.25, 0.155], bot: [0.36, 0.25, 0.135] };
const RAX_FRAC = { top: 0.10, mid: 0.10, bot: 0.10 };
const towerFrac = (team, lane, i) => team === TEAM_BLUE ? TOWER_FRACS[lane][i] : 1 - TOWER_FRACS[lane][i];

// VISINA TERENA: rijeka = nizina (0), polje = 40, platoi baza = 80
// Rub platoa je strma LITICA (kao u Allstarsu), a gdje staze ulaze u bazu — blaga RAMPA.
const CLIFF_R0 = 640 * MAP_S, CLIFF_R1 = 700 * MAP_S;   // litica: od punog platoa do polja
function laneDist(x, y){
  let d = 1e9;
  for(const l of LANE_LIST) d = Math.min(d, distToPath(LANE_PTS[l], x, y));
  return d;
}
function groundHeightRaw(x, y){
  const dRiver = Math.abs(x - y) / Math.SQRT2;
  let h = smoothstep(70, 300, dRiver) * 40;
  const dBase = Math.min(distXY(x, y, ANCIENT_POS[0].x, ANCIENT_POS[0].y),
                         distXY(x, y, ANCIENT_POS[1].x, ANCIENT_POS[1].y));
  if(dBase < 500 * MAP_S) return h + 40;
  if(dBase > 860 * MAP_S) return h;
  const cliff = 1 - smoothstep(CLIFF_R0, CLIFF_R1, dBase);
  const wide = 1 - smoothstep(520 * MAP_S, 840 * MAP_S, dBase);
  const ramp = 1 - smoothstep(120, 240, laneDist(x, y));
  return h + 40 * (cliff + (wide - cliff) * ramp);
}
/* visine se jednom izračunaju u mrežu (brzo čitanje za tisuće poziva po sličici) */
const HGRID_N = Math.round(360 * MAP_S / 1.85);   // v0.47: mreža visina raste s mapom (litice ostaju oštre)
let hGrid = null;
function buildHeightGrid(){
  const n = HGRID_N + 1, cs = WORLD / HGRID_N;
  hGrid = new Float32Array(n * n);
  for(let j = 0; j < n; j++) for(let i = 0; i < n; i++) hGrid[j * n + i] = groundHeightRaw(i * cs, j * cs);
}
function groundHeight(x, y){
  if(!hGrid) buildHeightGrid();
  const cs = WORLD / HGRID_N, n = HGRID_N + 1;
  const fx = clamp(x / cs, 0, HGRID_N - 1e-4), fy = clamp(y / cs, 0, HGRID_N - 1e-4);
  const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * n + i;
  const a = hGrid[k] + (hGrid[k + 1] - hGrid[k]) * tx;
  const b = hGrid[k + n] + (hGrid[k + n + 1] - hGrid[k + n]) * tx;
  return a + (b - a) * ty;
}

/* ================= MAGLA RATA (fog of war) =================
   v0.38 (kao u DotA 2): vid je LINIJA POGLEDA — drveće zaklanja pogled (iza stabla je sjena), a s nizine
   se ne vidi gore na plato baze (uzbrdo); kule, oka i Sovino oko vide "odozgo" (bez prepreka).
   Noću je vid kraći. visGrid = vid po timu (mreža 128×128); magla na ekranu računa se iz iste mreže,
   pa se ono što vidiš točno poklapa s onim što igra smatra vidljivim. */
const VIS_N = Math.round(128 * MAP_S / 1.85);   // v0.47: mreža vida raste s mapom (polje ~43 jedinice kao prije)
const visGrid = [new Uint8Array(VIS_N * VIS_N), new Uint8Array(VIS_N * VIS_N)];
const visBlock = new Uint8Array(VIS_N * VIS_N);   // 1 = stablo (zaklanja pogled)
const visLvl = new Uint8Array(VIS_N * VIS_N);     // 0 = polje i rijeka, 1 = plato baze
let visBlockDirty = true;
let visionTimer = 0;
let fogCanvas = null, fogCtx = null, fogImg = null;
const fogA = new Float32Array(VIS_N * VIS_N);     // prikazana gustoća magle (polako prati vid — mekani prijelazi)
const fogT = new Float32Array(VIS_N * VIS_N);
const fogB = new Float32Array(VIS_N * VIS_N);

function visionRange(u){
  const base = u.kind === 'hero' ? 950 : (u.kind === 'tower' || u.kind === 'ancient' ? 900 : (u.kind === 'barracks' ? 700 : 750));
  return base * (isNight ? 0.65 : 1);
}
function markTreesDirty(){ visBlockDirty = true; }
function rebuildVisBlock(){
  visBlockDirty = false;
  const cs = WORLD / VIS_N;
  visBlock.fill(0);
  for(const t of trees){
    if(t.cut) continue;
    const gx = clamp(Math.floor(t.x / cs), 0, VIS_N - 1), gy = clamp(Math.floor(t.y / cs), 0, VIS_N - 1);
    visBlock[gy * VIS_N + gx] = 1;
  }
  for(let gy = 0; gy < VIS_N; gy++) for(let gx = 0; gx < VIS_N; gx++)
    visLvl[gy * VIS_N + gx] = groundHeight((gx + 0.5) * cs, (gy + 0.5) * cs) > 62 ? 1 : 0;
}
// pogled "odozgo": pun krug bez prepreka (kule, prijestol, oka, Sovino oko)
function markVision(g, x, y, r){
  const cs = WORLD / VIS_N;
  const minC = Math.max(0, Math.floor((x - r) / cs));
  const maxC = Math.min(VIS_N - 1, Math.floor((x + r) / cs));
  const minR = Math.max(0, Math.floor((y - r) / cs));
  const maxR = Math.min(VIS_N - 1, Math.floor((y + r) / cs));
  const r2 = r * r;
  for(let gy = minR; gy <= maxR; gy++){
    for(let gx = minC; gx <= maxC; gx++){
      if(g[gy * VIS_N + gx]) continue;
      const dx = (gx + 0.5) * cs - x, dy = (gy + 0.5) * cs - y;
      if(dx * dx + dy * dy <= r2) g[gy * VIS_N + gx] = 1;
    }
  }
}
// linija pogleda: zrake iz jedinice; stablo zaustavi zraku (samo stablo se vidi), viši teren se ne vidi
function markVisionLOS(g, x, y, r){
  const cs = WORLD / VIS_N;
  const cx = x / cs, cy = y / cs, R = r / cs;
  const c0x = clamp(Math.floor(cx), 0, VIS_N - 1), c0y = clamp(Math.floor(cy), 0, VIS_N - 1);
  const lvl = visLvl[c0y * VIS_N + c0x];
  g[c0y * VIS_N + c0x] = 1;
  const nRays = Math.max(48, Math.ceil(TAU * R * 1.25));
  for(let k = 0; k < nRays; k++){
    const a = k / nRays * TAU, dx = Math.cos(a) * 0.5, dy = Math.sin(a) * 0.5;
    let px = cx, py = cy, last = -1;
    for(let s = 0.5; s <= R; s += 0.5){
      px += dx; py += dy;
      const gx = px | 0, gy = py | 0;
      if(gx < 0 || gy < 0 || gx >= VIS_N || gy >= VIS_N) break;
      const ci = gy * VIS_N + gx;
      if(ci === last) continue;
      last = ci;
      if(visLvl[ci] > lvl) break;                  // ⛰️ uzbrdo na plato: ne vidi se
      g[ci] = 1;
      if(visBlock[ci] && s > 1.2) break;           // 🌳 stablo: vidi se stablo, ali ne i iza njega
    }
  }
}
function updateVision(){
  if(visBlockDirty) rebuildVisBlock();
  for(let team = 0; team < 2; team++){
    const g = visGrid[team];
    g.fill(0);
    for(const u of units){
      if(u.team !== team || u.dead || u.removeMe) continue;
      if(isStructure(u)) markVision(g, u.x, u.y, visionRange(u));
      else markVisionLOS(g, u.x, u.y, visionRange(u));
    }
    markVision(g, FOUNTAIN[team].x, FOUNTAIN[team].y, 800);
    for(const w of wards) if(w.team === team) markVision(g, w.x, w.y, w.r);   // 👁️ oka i Sovino oko vide odozgo
  }
  // ciljana magla za MOJ tim (gost = crveni); na ekranu je glatko prati drawFog()
  const g = visGrid[myTeam];
  for(let i = 0; i < fogT.length; i++) fogT[i] = g[i] ? 0 : 1;
}
/* svaki kadar: prikazana magla polako prati vid (mekano otkrivanje / skrivanje) + blago zamućenje rubova */
let fogLastT = 0;
function drawFog(){
  if(!fogCtx) return;
  const now = performance.now(), dt = Math.min(0.1, (now - (fogLastT || now)) / 1000);
  fogLastT = now;
  const k = Math.min(1, dt * 7);
  let changed = false;
  for(let i = 0; i < fogA.length; i++){
    const d = fogT[i] - fogA[i];
    if(d > 0.002 || d < -0.002){ fogA[i] += d * k; changed = true; }
    else if(d){ fogA[i] = fogT[i]; changed = true; }
  }
  if(!changed && fogImg) return;
  if(!fogImg) fogImg = fogCtx.createImageData(VIS_N, VIS_N);
  const N = VIS_N, D = fogImg.data;
  for(let y = 0; y < N; y++){   // vodoravno zamućenje 1-2-1
    const r = y * N;
    for(let x = 0; x < N; x++) fogB[r + x] = (fogA[r + Math.max(0, x - 1)] + 2 * fogA[r + x] + fogA[r + Math.min(N - 1, x + 1)]) * 0.25;
  }
  for(let y = 0; y < N; y++){   // okomito
    const ru = Math.max(0, y - 1) * N, r = y * N, rd = Math.min(N - 1, y + 1) * N;
    for(let x = 0; x < N; x++){
      const a = (fogB[ru + x] + 2 * fogB[r + x] + fogB[rd + x]) * 0.25, o = (r + x) * 4;
      D[o] = 8; D[o + 1] = 13; D[o + 2] = 28; D[o + 3] = Math.round(a * 158);
    }
  }
  fogCtx.putImageData(fogImg, 0, 0);
  markFogDirty();
}
function isVisibleTo(team, u){
  if(u.status && u.status.trackT > 0) return true;   // 💰 Ucjena: otkriven svima
  if(team === TEAM_NEUTRAL || u.team === team) return true;
  const cs = WORLD / VIS_N;
  const gx = clamp(Math.floor(u.x / cs), 0, VIS_N - 1);
  const gy = clamp(Math.floor(u.y / cs), 0, VIS_N - 1);
  return visGrid[team][gy * VIS_N + gx] === 1;
}
// mobilni neprijatelji su skriveni u magli; kule i prijestoli se uvijek vide
// (myTeam: u multiplayeru gost gleda iz perspektive crvenog tima)
function seenByPlayer(u){
  if(u.kind === 'hero' && u.status.trackT > 0) return true;   // ucijenjeni se uvijek vide
  if(u.kind === 'hero' && u.status.invisT > 0 && u.team !== myTeam) return false;  // nevidljivost
  if(u.team === myTeam || isStructure(u)) return true;
  return isVisibleTo(myTeam, u);
}

/* ================= Grafika (AI generirane slike) ================= */
const GFX = { heroes: {}, mobs: {}, tex: {} };
/* 🎨 v0.55 ikona moći (GPT Image 2.5) za platno — null dok se ne učita (ili je nema), tada se crta emoji */
const SPELL_IMG = {};
function artImg(src){   // v0.56: i ikone talenata i trake najava
  if(!src) return null;
  let im = SPELL_IMG[src];
  if(!im){ im = SPELL_IMG[src] = new Image(); im.src = src; }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
function spellIconImg(heroId, slot){ return artImg(spellIconSrc(heroId, slot)); }
/* ikona moći za HTML (ekran junaka, opisi): <img> s emojijem kao rezervom */
function spellIconHtml(heroId, slot, emoji, cls){
  const src = spellIconSrc(heroId, slot);
  return src ? `<img class="${cls || 'spIcon'}" src="${src}" alt="${emoji}" draggable="false" onerror="this.replaceWith(document.createTextNode(this.alt))">` : emoji;
}
function loadGameArt(){
  for(const h of HEROES){
    const im = new Image();
    im.src = 'assets/hero_' + h.id + '.jpg';
    GFX.heroes[h.id] = im;
  }
  const mobFiles = { boars: 'mob_boar', wolves: 'mob_wolf', bears: 'mob_bear', drake: 'mob_dragon', boss: 'mob_dragon' };
  for(const k in mobFiles){
    const im = new Image();
    im.src = 'assets/' + mobFiles[k] + '.jpg';
    GFX.mobs[k] = im;
  }
  for(const k of ['grass', 'path', 'water']){
    const im = new Image();
    im.src = 'assets/tex_' + k + '.jpg';
    GFX.tex[k] = im;
  }
  for(const k in BANNER_ART) artImg('assets/ui/banner_' + k + '.webp');   // 🎀 da i prva najava ima traku
}
function wrapLines(txt, maxW){   // riječi u retke koji stanu u maxW (trenutni ctx.font)
  const out = [];
  let cur = '';
  for(const w of String(txt).split(' ')){
    const t = cur ? cur + ' ' + w : w;
    if(cur && ctx.measureText(t).width > maxW){ out.push(cur); cur = w; } else cur = t;
  }
  if(cur) out.push(cur);
  return out;
}
function imgReady(im){ return !!(im && im.complete && im.naturalWidth > 0); }

/* ================= Globalno stanje ================= */
let glCanvas, hudCv, ctx, terrainCanvas;
let VW = 800, VH = 600, DPR = 1;
let units = [], projectiles = [], zones = [], particles = [], lines = [], floats = [], markers = [], feed = [];
let trees = [];
let camps = [];
let runes = [];
let wards = [];                 // 👁️ privremeni vid (Sovino oko)
let nightForceT = 0;            // 🌑 Vječna noć: prisilna noć još toliko sekundi
let superCreeps = [{}, {}];     // [tim][staza] = true kad je protivnička vojarna srušena
let barracksRespawn = [];       // 🏚️ srušene vojarne se obnavljaju (kao inhibitori u LoL-u): {team, lane, x, y, t}
let winnerTeam = null;          // tim koji je pobijedio (junaci plešu pobjednički ples)
let glyph = [{ t: 0, cd: 0 }, { t: 0, cd: 0 }];   // 🛡️ Glif utvrde po timu: t = još aktivan, cd = punjenje
const glyphAiT = [0, 0];
let bossKills = 0;              // koliko je puta Zmaj pao (od 2. puta daje 🧀 sir)
let teamDrakes = [[], []];      // 🐉 elementi zmajčića koje je tim ubio (trajni timski bonusi)
let nextDrake = null;           // element sljedećeg zmajčića
function drakeN(team, el){
  const a = teamDrakes[team];
  if(!a) return 0;
  let n = 0;
  for(const k of a) if(k === el) n++;
  return n;
}
let coinDrops = [];             // 3D zlatnici pri last-hitu (crta ih scene3d.js)
/* ⛔ uskraćivanje (deny): vlastiti vojnik ispod 50% ili kula ispod 10% */
function canDeny(t){
  if(!t || t.dead || t.removeMe || t.invuln) return false;
  if(t.kind === 'creep' && !t.summonOf) return t.hp < t.maxhp * CFG.denyHp;
  if(t.kind === 'tower') return t.hp < t.maxhp * CFG.denyTowerHp;
  return false;
}
function deniableNear(u, range){
  let best = null, bh = 1e9;
  for(const e of units){
    if(e.team !== u.team || e === u || !canDeny(e) || e.kind !== 'creep') continue;
    if(dist(u, e) > range || e.hp > u.dmg * 1.15) continue;
    if(e.hp < bh){ bh = e.hp; best = e; }
  }
  return best;
}
/* 🛡️ zaštita od backdoora: građevina bez neprijateljskih vojnika u blizini */
function backdoorProtected(t){
  for(const e of units){
    if(e.kind !== 'creep' || e.summonOf || e.team === t.team || e.dead || e.removeMe) continue;
    if(distXY(e.x, e.y, t.x, t.y) < CFG.backdoorR) return false;
  }
  return true;
}
let shrines = [];               // 🕊️ svetišta: { x, y, team, cd, t }
let creepTier = 0;              // koliko su puta vojnici ojačali
function makeShrines(){ shrines = SHRINE_SPOTS.map(s => ({ x: s.x, y: s.y, team: s.team, cd: 0, t: 0 })); }
/* 🫏 Kurir (kao u DotA): predmet kupljen daleko od baze čeka u škrinji (blijedi u torbi, ne radi);
   leteći magarac ga odnese junaku. Kad se junak sam vrati kući, uzme ga odmah. */
let couriers = [];              // { team, x, y, dir, state: 'home'|'go'|'back', to, carry }
function courierHome(team){
  const f = FOUNTAIN[team], k = team === 0 ? 1 : -1;
  return { x: f.x + 300 * k, y: f.y + 40 * k };
}
function makeCouriers(){
  couriers = [0, 1].map(team => { const p = courierHome(team); return { team, x: p.x, y: p.y, dir: team === 0 ? -0.8 : 2.3, state: 'home', to: 0, carry: 0 }; });
}
function hasPending(h){ return h.items.some(i => i.pending) || (h.backpack || []).some(i => i.pending); }
function nearBase(h){ return distXY(h.x, h.y, FOUNTAIN[h.team].x, FOUNTAIN[h.team].y) < CFG.courierBaseR; }
function pendingItem(item){ return Object.assign({}, item, { pending: true, stats: null, active: null, burn: 0 }); }
function deliverPending(h, byCourier){
  let n = 0;
  h.items = h.items.map(it => { if(!it.pending) return it; n++; return ITEM_BY_ID[it.id]; });
  if(h.backpack) h.backpack = h.backpack.map(it => { if(!it.pending) return it; n++; return ITEM_BY_ID[it.id]; });
  if(!n) return 0;
  recomputeItemStats(h);
  if(byCourier){
    addFloat(h.x, h.y - 30, L('🫏 Kurir je donio predmete!', '🫏 The courier brought your items!'), '#fde047', 15);
    burst(h.x, h.y, '#fde047', 14, 160, 4);
  }
  if(h.isPlayer){ sfx('buy'); refreshShop(); }
  return n;
}
function moveCourier(c, tx, ty, dt){
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  const step = CFG.courierSpeed * dt;
  if(d > 1) c.dir = Math.atan2(dy, dx);
  if(d <= step){ c.x = tx; c.y = ty; return true; }
  c.x += dx / d * step; c.y += dy / d * step;
  return false;
}
function updateCouriers(dt){
  for(const h of units)   // tko je kod kuće, uzme iz škrinje sam
    if(h.kind === 'hero' && !h.dead && hasPending(h) && nearBase(h)) deliverPending(h, false);
  for(const c of couriers){
    const owner = c.state === 'go' ? units.find(u => u.id === c.to) : null;
    if(c.state === 'go' && (!owner || owner.dead || owner.removeMe || !hasPending(owner))) c.state = 'back';
    if(c.state === 'home'){
      const h = units.find(u => u.kind === 'hero' && u.team === c.team && !u.dead && hasPending(u));
      if(h){
        c.state = 'go'; c.to = h.id; c.carry = h.items.concat(h.backpack || []).filter(i => i.pending).length;
        if(isHuman(h)) addFloat(h.x, h.y - 30, L('🫏 Kurir je krenuo prema tebi!', '🫏 The courier is on its way!'), '#fde68a', 13, h.team);
      }
    } else if(c.state === 'go'){
      if(moveCourier(c, owner.x, owner.y, dt) || distXY(c.x, c.y, owner.x, owner.y) < 80){
        deliverPending(owner, true);
        c.state = 'back'; c.carry = 0;
      }
    } else if(c.state === 'back'){
      c.carry = 0;
      const p = courierHome(c.team);
      if(moveCourier(c, p.x, p.y, dt)) c.state = 'home';
    }
  }
}
/* 💰 rune zlata (svake 3 min, 4 mjesta) i 📘 rune mudrosti (svakih 7 min, 2 kuta džungle) */
let extraRunes = [];            // { x, y, kind: 'bounty' | 'wisdom' }
let bountyT = 0, wisdomT = 0;
function resetExtraRunes(){ extraRunes = []; bountyT = 0; wisdomT = CFG.wisdomEvery; }
function updateExtraRunes(dt){
  bountyT -= dt;
  if(bountyT <= 0){
    bountyT = CFG.bountyEvery;
    extraRunes = extraRunes.filter(r => r.kind !== 'bounty');
    for(const p of BOUNTY_SPOTS) extraRunes.push({ x: p.x, y: p.y, kind: 'bounty' });
    if(gameTime > 1) feedMsg(L('💰 Rune zlata su se pojavile u džungli!', '💰 Bounty runes appeared in the jungle!'), '#fde047');
  }
  wisdomT -= dt;
  if(wisdomT <= 0){
    wisdomT = CFG.wisdomEvery;
    extraRunes = extraRunes.filter(r => r.kind !== 'wisdom');
    for(const p of WISDOM_SPOTS) extraRunes.push({ x: p.x, y: p.y, kind: 'wisdom' });
    announce(L('📘 Rune mudrosti!', '📘 Wisdom runes!'), L('U kutovima džungle — tko je uzme, dobiva puno iskustva', 'In the jungle corners — grab one for lots of XP'));
  }
  for(let i = extraRunes.length - 1; i >= 0; i--){
    const r = extraRunes[i];
    const h = units.find(u => u.kind === 'hero' && !u.dead && !u.removeMe && distXY(u.x, u.y, r.x, r.y) < 70);
    if(!h) continue;
    extraRunes.splice(i, 1);
    if(r.kind === 'bounty'){
      const g = Math.round(CFG.bountyGold + gameClock() / 60 * CFG.bountyGoldMin);
      for(const e of units) if(e.kind === 'hero' && e.team === h.team) e.gold += g;
      addFloat(h.x, h.y - 30, L('💰 +' + g + ' zlata cijelom timu!', '💰 +' + g + ' gold for the whole team!'), '#fde047', 16);
      feedMsg(L('💰 ' + h.emoji + ' ' + h.name + ' je uzeo runu zlata (+' + g + ' svima u timu)', '💰 ' + h.emoji + ' ' + h.name + ' took a bounty rune (+' + g + ' for the whole team)'), TEAM_COLOR[h.team]);
      if(h.team === myTeam) sfx('buy');
    } else {
      const xp = Math.round(220 + gameClock() / 60 * 22);
      giveXp(h, xp);
      addFloat(h.x, h.y - 30, L('📘 +' + xp + ' iskustva!', '📘 +' + xp + ' XP!'), '#93c5fd', 16);
      feedMsg(L('📘 ' + h.emoji + ' ' + h.name + ' je uzeo runu mudrosti!', '📘 ' + h.emoji + ' ' + h.name + ' took a wisdom rune!'), TEAM_COLOR[h.team]);
      if(h.isPlayer) sfx('levelup');
    }
    burst(r.x, r.y, r.kind === 'bounty' ? '#fde047' : '#93c5fd', 18, 200, 6);
  }
}

/* 💬 brze poruke i 📍 ping */
let pings = [];                 // { x, y, team, t }
let botBragT = -99, botHelpT = [-99, -99];   // 🤫 botovi ne zatrpavaju poruke
let chatOpen = false;
function say(h, txt){
  if(!h) return;
  if(gameTime - (h.chatT == null ? -9 : h.chatT) < 1.2) return;
  h.chatT = gameTime;
  feedMsg(h.emoji + ' ' + h.name + ': ' + txt, TEAM_COLOR[h.team]);
  if(!h.dead) addFloat(h.x, h.y - 46, txt, '#ffffff', 15);
}
function sendChat(h, i){
  if(!CHAT_LINES[i]) return;
  say(h, CHAT_LINES[i]);
  if(i === 2 && isHuman(h)){   // ⚔️ Napadamo! — botovi napadaju najbližeg vidljivog neprijatelja
    const e = units.filter(e => e.kind === 'hero' && e.team !== h.team && !e.dead && isVisibleTo(h.team, e) && dist(h, e) < 1400).sort((a, b) => dist(a, h) - dist(b, h))[0];
    if(e) botsAnswer(h, e.x, e.y);
  }
}
function addPing(h, x, y){
  if(!h || gameTime - (h.pingT == null ? -9 : h.pingT) < 0.8) return;
  h.pingT = gameTime;
  pings.push({ x: clamp(x, 0, WORLD), y: clamp(y, 0, WORLD), team: h.team, t: 0 });
  if(pings.length > 8) pings.shift();
  if(isHuman(h)) botsAnswer(h, x, y);   // 🤖 saveznički botovi dolaze
  if(h.team === myTeam) sfx('click');
}
function updatePings(dt){
  for(const p of pings) p.t += dt;
  if(pings.some(p => p.t >= 3)) pings = pings.filter(p => p.t < 3);
}

/* 🌰 neutralni predmeti iz džungle */
let neutralDrops = [{ 1: 0, 2: 0, 3: 0 }, { 1: 0, 2: 0, 3: 0 }];   // koliko je koji tim našao po razini
let neutralFx = [];                                                 // 3D: kutija s predmetom iskoči iz čudovišta
function neutralTierNow(){ return gameTime >= CFG.neutralT3 ? 3 : (gameTime >= CFG.neutralT2 ? 2 : 1); }
function maybeNeutralDrop(src, t){
  if(src.team === TEAM_NEUTRAL) return;
  const tier = neutralTierNow(), cnt = neutralDrops[src.team];
  if(cnt[tier] >= CFG.neutralMax) return;
  if(Math.random() > (t.boss ? 1 : CFG.neutralDrop)) return;
  const team = units.filter(h => h.kind === 'hero' && h.team === src.team && !h.removeMe);
  const owned = team.map(h => h.neutral && h.neutral.id);
  const pool = NEUTRAL_ITEMS.filter(n => n.ntier === tier && !owned.includes(n.id));
  const taker = [src].concat(team.filter(h => h !== src)).find(h => !h.neutral || h.neutral.ntier < tier);
  if(!pool.length || !taker) return;
  const item = choice(pool);
  cnt[tier]++;
  taker.neutral = item;
  recomputeItemStats(taker);
  feedMsg(L('🌰 ' + taker.emoji + ' ' + taker.name + ' je našao ' + item.emoji + ' ' + item.name + '!', '🌰 ' + taker.emoji + ' ' + taker.name + ' found ' + item.emoji + ' ' + item.name + '!'), '#bef264');
  addFloat(t.x, t.y - 30, '🌰 ' + item.emoji + ' ' + item.name + '!', '#bef264', 16);
  neutralFx.push({ x: t.x, y: t.y, tx: taker.x, ty: taker.y });
  if(taker.isPlayer) sfx('levelup');
}
/* svetište se samo upali kad ranjeni junak tima stane uz njega; 5 s liječi sve saveznike u krugu */
function updateShrines(dt){
  for(const s of shrines){
    if(s.cd > 0) s.cd -= dt;
    if(s.t > 0){
      s.t -= dt;
      for(const h of units){
        if(h.kind !== 'hero' || h.team !== s.team || h.dead || distXY(h.x, h.y, s.x, s.y) > CFG.shrineR) continue;
        h.hp = Math.min(h.maxhp, h.hp + h.maxhp * 0.05 * dt);
        h.mp = Math.min(h.maxmp, h.mp + h.maxmp * 0.04 * dt);
      }
      if(Math.random() < dt * 4) ring(s.x, s.y, CFG.shrineR * (0.3 + Math.random() * 0.7), TEAM_LIGHT[s.team]);
      continue;
    }
    if(s.cd > 0) continue;
    for(const h of units){
      if(h.kind !== 'hero' || h.team !== s.team || h.dead || h.hp > h.maxhp * 0.7) continue;
      if(distXY(h.x, h.y, s.x, s.y) > 170) continue;
      s.t = CFG.shrineDur; s.cd = CFG.shrineCd; s.n = (s.n || 0) + 1;
      feedMsg(L('🕊️ Svetište liječi tim ' + TEAM_NAME[s.team] + '!', '🕊️ A shrine heals the ' + TEAM_NAME[s.team] + ' team!'), TEAM_COLOR[s.team]);
      burst(s.x, s.y, TEAM_LIGHT[s.team], 30, 300, 7);
      if(h.isPlayer) sfx('heal');
      break;
    }
  }
}
/* 🎓 talenti (kao u DotA 2): na levelima 10 / 15 / 20 / 25 junak bira jedan od dva — v0.38: svaki junak ima svoje */
function heroTalents(h){ return (h && h.hero && HERO_TALENTS[h.hero.id]) || DEFAULT_TALENTS; }
function talentOpt(h, lvl, pick){ const tier = heroTalents(h)[TALENT_LVLS.indexOf(lvl)]; return tier ? tier[pick === 'b' ? 1 : 0] : null; }
function hasTal(u, f){ return !!(u && u.talFlags && u.talFlags[f]); }
function abBonus(u, key, f){ return (u && u.talAb && u.talAb[key] && u.talAb[key][f]) || 0; }
function chooseTalent(h, lvl, pick){
  if(!h || TALENT_LVLS.indexOf(lvl) < 0 || h.level < lvl || h.talents[lvl]) return;
  const t = talentOpt(h, lvl, pick);
  if(!t) return;
  h.talents[lvl] = pick === 'b' ? 'b' : 'a';
  applyTalent(h, t.e);
  addFloat(h.x, h.y, '🎓 ' + t.emoji + ' ' + t.txt, '#c4b5fd', 15);
  burst(h.x, h.y, '#c4b5fd', 16, 200, 5);
  h.talN = (h.talN || 0) + 1;   // 3D: stup svjetla
  if(h.isPlayer) sfx('levelup');
}
function applyTalent(h, e){
  if(e.dmg) h.dmg += e.dmg;
  if(e.hp){ h.maxhp += e.hp; h.hp += e.hp; }
  if(e.mp){ h.maxmp += e.mp; h.mp += e.mp; }
  if(e.spd) h.speed += e.spd;
  if(e.hpRegen) h.hpRegen += e.hpRegen;
  if(e.mpRegen) h.mpRegen += e.mpRegen;
  if(e.cdr) h.cdr = Math.min(0.4, (h.cdr || 0) + e.cdr);
  if(e.armor) h.talArmor = (h.talArmor || 0) + e.armor;
  if(e.aspd) h.talAspd = (h.talAspd || 0) + e.aspd;
  if(e.ls) h.talLs = (h.talLs || 0) + e.ls;
  if(e.range) h.talRange = (h.talRange || 0) + e.range;
  if(e.spellAmp) h.spellAmp = (h.spellAmp || 0) + e.spellAmp;
  if(e.evasion) h.talEva = 1 - (1 - (h.talEva || 0)) * (1 - e.evasion);
  if(e.pas) h.talPas = (h.talPas || 0) + e.pas;
  if(e.gold) h.talGold = (h.talGold || 0) + e.gold;
  if(e.flag) (h.talFlags = h.talFlags || {})[e.flag] = true;
  if(e.ab) for(const k in e.ab){
    const a = (h.talAb = h.talAb || {})[k] = (h.talAb[k] || {});
    for(const f in e.ab[k]) a[f] = (a[f] || 0) + e.ab[k][f];
  }
  if(e.armor && h.hero) recomputeAttrStats(h);
}
/* gost u mrežnoj igri: prikaz talenata (bonusi moći u opisima) iz popisa odabranih */
function deriveTalents(h){
  h.talAb = {}; h.talFlags = {}; h.talPas = 0;
  for(const lvl of TALENT_LVLS){
    const pick = h.talents && h.talents[lvl];
    const t = pick ? talentOpt(h, lvl, pick) : null;
    if(!t) continue;
    if(t.e.pas) h.talPas += t.e.pas;
    if(t.e.flag) h.talFlags[t.e.flag] = true;
    if(t.e.ab) for(const k in t.e.ab){ const a = h.talAb[k] = h.talAb[k] || {}; for(const f in t.e.ab[k]) a[f] = (a[f] || 0) + t.e.ab[k][f]; }
  }
}
function pendingTalent(h){
  for(const lvl of TALENT_LVLS){
    if(h.level >= lvl && !h.talents[lvl]){ const tier = heroTalents(h)[TALENT_LVLS.indexOf(lvl)]; return { lvl, a: tier[0], b: tier[1] }; }
  }
  return null;
}
/* ✨ kontekst moći: dok moć (ili njen projektil / zona) djeluje, talenti te moći dodaju štetu, omamu i liječenje */
let abCtx = null;
function abDur(){ return abCtx && abCtx.src ? abBonus(abCtx.src, abCtx.key, 'dur') : 0; }
function abMana(u, ab){ return Math.max(0, ab.def.mana + abBonus(u, ab.def.key, 'mana')); }
/* 🎯 kanaliziranje (Savršen hitac): junak stoji i nišani; omama, tišina ili nova naredba ga prekidaju
   v0.55: o = { tick(meta, dt) svaki kadar (Veliki zalogaj, Lepeza strijela), dir (smjer pogleda), kind: 'channel' (animacija
   kanaliziranja umjesto nišanjenja, bez lasera), msg (poruka kad se prekine) } */
function startChannel(u, dur, target, onDone, o){
  u.chan = { t: dur, dur, target, onDone, key: abCtx ? abCtx.key : null, o: o || null };
  u.moveTarget = null; u.attackTarget = null; u.windup = null;
  u.chanN = (u.chanN || 0) + 1;
}
function chanMsg(c){ return (c && c.o && c.o.msg) || L('🎯 Nišanjenje prekinuto!', '🎯 Aiming interrupted!'); }
function cancelChannel(u, why){
  if(!u.chan) return;
  u.chan = null;
  if(why && isHuman(u)) addFloat(u.x, u.y, why, '#fca5a5', 13, u.team);
}
const LANE_NAME = { top: L('gore', 'top'), mid: L('sredina', 'mid'), bot: L('dolje', 'bottom') };
let runeTimer = CFG.runeEvery, runeSpotI = 0;
let isNight = false;
let player = null;
let remoteHero = null;      // junak kojeg vodi PRIJATELJ preko mreže (na domaćinu)
let myTeam = TEAM_BLUE;     // gost u multiplayeru je TEAM_RED
let pendingCast = null;     // {i} — moć čeka klik na cilj ({item} predmet, {sum} čarolija prizivača; quick = brzo bacanje dok se drži tipka)
let hoverUnit = null;       // 🖱️ jedinica pod mišem (po tijelu na ekranu) — meta klika i moći
let amovePending = false;   // ⚔️ A: sljedeći klik je napad u hodu
let holdMove = null;        // 🖱️ držiš tipku miša na tlu: junak stalno ide prema mišu
let prepShop = false, prepTick = 0;   // ⏳ priprema: dućan otvoren sam od sebe / zadnja otkucana sekunda
let pickedSummoners = DEFAULT_SUMMONERS.slice();   // ✨ odabir na ekranu junaka (pamti se u pregledniku)
try { const ps = JSON.parse(localStorage.getItem('dk_summoners') || 'null'); if(Array.isArray(ps) && ps.length === 2 && ps.every(id => SUMMONER_BY_ID[id]) && ps[0] !== ps[1]) pickedSummoners = ps; } catch(e){}
let touchMode = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // 👆 tablet / mobitel
let scoreOpen = false;      // 📋 tablica otvorena gumbom (na tabletu nema tipke Tab)
let mouseIn = false;        // miš je iznad igre (za rubno pomicanje kamere)
/* ⚙️ postavke (pamte se u pregledniku) */
const SETTINGS = { vol: 0.8, quality: touchMode ? 'med' : 'high', edgePan: true, dmgNums: true, quickCast: false, voices: true, announcer: true, diff: 'normal',
  fullscreen: true, lockMouse: true, lastHit: true, tips: true, autoSkill: false, nature: true, quests: true, mode: 'normal', music: true, lane: 'mid' };   // 🛣️ lane: tvoja staza (top / mid / bot)   // 🎶 glazba   // ⚡ mode: 'normal' / 'turbo'   // 🎯 zadaci za početnike   // 🌲 zvukovi prirode   // ⬆️ vještine se mogu učiti same   // 🪙 pomoć za zadnji udarac, 💡 savjeti   // 🖥️ cijeli zaslon pri početku igre, 🔒 miš ne može izaći iz igre
try {
  const s = JSON.parse(localStorage.getItem('dk_settings') || '{}');
  if(typeof s.vol === 'number') SETTINGS.vol = clamp(s.vol, 0, 1);
  if(['low', 'med', 'high'].includes(s.quality)) SETTINGS.quality = s.quality;
  if(typeof s.edgePan === 'boolean') SETTINGS.edgePan = s.edgePan;
  if(typeof s.dmgNums === 'boolean') SETTINGS.dmgNums = s.dmgNums;
  if(typeof s.quickCast === 'boolean') SETTINGS.quickCast = s.quickCast;
  if(typeof s.voices === 'boolean') SETTINGS.voices = s.voices;
  if(typeof s.announcer === 'boolean') SETTINGS.announcer = s.announcer;
  if(['easy', 'normal', 'hard'].includes(s.diff)) SETTINGS.diff = s.diff;
  if(typeof s.fullscreen === 'boolean') SETTINGS.fullscreen = s.fullscreen;
  if(typeof s.lockMouse === 'boolean') SETTINGS.lockMouse = s.lockMouse;
  if(typeof s.lastHit === 'boolean') SETTINGS.lastHit = s.lastHit;
  if(typeof s.tips === 'boolean') SETTINGS.tips = s.tips;
  if(typeof s.autoSkill === 'boolean') SETTINGS.autoSkill = s.autoSkill;
  if(typeof s.nature === 'boolean') SETTINGS.nature = s.nature;
  if(typeof s.quests === 'boolean') SETTINGS.quests = s.quests;   // 🎯
  if(typeof s.music === 'boolean') SETTINGS.music = s.music;      // 🎶
  if(['normal', 'turbo'].includes(s.mode)) SETTINGS.mode = s.mode; // ⚡
  if(LANE_CHOICES.includes(s.lane)) SETTINGS.lane = s.lane;        // 🛣️ (v0.56: i 🌲 džungla)
} catch(e){}
function saveSettings(){ try { localStorage.setItem('dk_settings', JSON.stringify(SETTINGS)); } catch(e){} }
let ancients = [null, null];
let cam = { x: WORLD / 2, y: WORLD / 2, zoom: 0.9, follow: true };
let mouse = { sx: 0, sy: 0, wx: 0, wy: 0 };
let keys = {};
let running = false, paused = false, gameOver = false;
let gameTime = 0, waveTimer = CFG.firstWave, waveCount = 0;
let firstBlood = false, muted = false, shopOpen = false;
let banner = null;            // najava koju vidi OVAJ igrač
let netBanner = null, guestBanner = null, bannerN = 0;   // 🌐 domaćin: zajednička i gostova osobna najava (idu u snimku)
/* 🎀 v0.56 naslikane trake za velike najave (GPT Image 2.5, assets/ui/): cy = sredina trake po visini, tw = širina za tekst */
const BANNER_ART = {
  blue: { cy: 0.49, tw: 0.6, title: '#fde047', sub: '#fff', stroke: 'rgba(15,23,42,0.85)' },
  red: { cy: 0.49, tw: 0.62, title: '#fde047', sub: '#fff', stroke: 'rgba(69,10,10,0.9)' },
  gold: { cy: 0.47, tw: 0.6, title: '#7c2d12', sub: '#451a03', stroke: 'rgba(255,251,235,0.9)' },
};
const TAL_PANEL_Y = 76, TAL_PANEL_H = 104;   // 🎓 ploča za izbor talenta (najava ide ispod nje)
let kills = [0, 0];
let uiRects = { abil: [], learn: [], inv: [], qb: [], sum: [], tp: null, glyph: null, statBtn: null, mini: null, shop: null, mute: null, help: null };
let hoverUi = null;
let miniDrag = false;
let nextId = 1;
let selectedHero = -1;
let sfxLast = {};

/* ================= Jedinice ================= */
function baseStatus(){
  return { slowT: 0, slowF: 0, stun: 0, rootT: 0, shieldT: 0, shieldF: 0,
    hasteT: 0, hasteF: 1, dmgMulT: 0, dmgMulF: 1, invisT: 0, trackT: 0,
    poisonT: 0, poisonDps: 0, poisonAcc: 0, poisonSrc: null, silenceT: 0, immuneT: 0,
    curseT: 0, curseF: 0, blindT: 0, blindF: 0, formT: 0, rageT: 0, rageStun: 0, disarmT: 0, stunMax: 0 };
}

function makeUnit(o){
  const u = Object.assign({
    id: nextId++,
    kind: 'creep', team: 0, x: 0, y: 0, r: 16,
    hp: 100, maxhp: 100, mp: 0, maxmp: 0,
    hpRegen: 0, mpRegen: 0,
    dmg: 10, atkRange: 60, atkCd: 1.1, atkTimer: rand(0, 0.4), projSpeed: 0,
    speed: 130, face: 1, dir: 0,
    moveTarget: null, attackTarget: null,
    status: baseStatus(),
    dead: false, removeMe: false, invuln: false,
    isStatic: false, flash: 0,
    scanT: rand(0, 0.3),
  }, o);
  units.push(u);
  return u;
}

function makeHero(def, team, isPlayer, lane){
  const f = FOUNTAIN[team];
  const jungler = lane === 'jungle';   // 🌲 v0.56: džungla nije staza — junak pamti "kućnu" stazu za kad nema kampova
  if(jungler) lane = JUNGLE_HOME_LANE;
  const u = makeUnit({
    kind: 'hero', team,
    x: f.x + rand(-50, 50), y: f.y + rand(-50, 50),
    r: 22,
    hp: def.hp, maxhp: def.hp, mp: def.mp, maxmp: def.mp,
    hpRegen: 1.6, mpRegen: 1.7,
    dmg: def.dmg, atkRange: def.range, atkCd: def.atkCd, projSpeed: def.projSpeed,
    speed: def.speed,
    hero: def, name: def.name, emoji: def.emoji,
    level: 1, xp: 0, gold: CFG.startGold,
    skillPoints: 1, runeRegenT: 0,
    tpCd: 0, tpChannel: 0,
    str: def.attrs.str, agi: def.attrs.agi, int: def.attrs.int,
    statRanks: 0, atkSpdBonus: 0,
    attrBonus: { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 },
    kills: 0, deaths: 0, assists: 0, streak: 0, items: [], buildI: 0,
    buybackCd: 0, aegis: false, aegisT: 0, reviveAt: null, itemCd: {}, comboN: 0, hitBy: {},
    itemCharges: {}, howlT: 0, howlDmg: 0, noInvisT: 0, charge: null, burnAcc: 0,
    talents: {}, cdr: 0,
    summoners: jungler ? jungleSummoners(botSummoners(def)) : botSummoners(def), sumCd: [0, 0], barrierHp: 0, barrierT: 0, gwT: 0, weakT: 0,   // ✨ čarolije prizivača (LoL)
    jbuff: { blue: 0, red: 0 },   // 🔵🔴 buffovi džungle (preostale sekunde)
    lastHits: 0, denies: 0, multiN: 0, lastKillT: -99, tangoT: 0, clarityT: 0, neutral: null,
    itemBonus: { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 },
    backpack: [],                                   // 🎒 ruksak (3 mjesta): predmeti ovdje ne daju ništa
    itemAttr: { str: 0, agi: 0, int: 0 }, itemAspd: 0, itemArmor: 0, lifesteal: 0, evasion: 0, armor: 0, ifx: {},
    abilities: def.abilities.map(a => ({ def: a, cd: 0, rank: 0 })),
    isPlayer: !!isPlayer, lane, homeLane: lane, jungler, build: isPlayer ? null : botBuildFor(def, jungler),   // 🎲 v0.56 inačica gradnje
    bot: isPlayer ? null : { state: 'lane', thinkT: rand(0.2, 0.8), order: null },
    deadT: 0,
  });
  recomputeAttrStats(u);
  if(isPlayer) player = u;
  return u;
}

function makeCreep(team, lane, ranged, siege){
  const path = lanePath(team, lane);
  const sx = path[0][0], sy = path[0][1];
  const min = Math.max(0, gameClock()) / 60;   // 🪖 v0.49: rastu glatko sa satom igre (u brzoj igri brže)
  const hp = Math.round((siege ? 935 : (ranged ? 300 : 550)) * (1 + CFG.creepHpGrow * min));
  return makeUnit({
    kind: 'creep', team, lane,
    x: sx + rand(-45, 45), y: sy + rand(-45, 45),
    r: siege ? 19 : (ranged ? 14 : 16),
    hp, maxhp: hp,
    dmg: (siege ? 34 : (ranged ? 27 : 22)) * (1 + CFG.creepDmgGrow * min),
    armor: siege || ranged ? 0 : 2,   // kao u DotA: vojnici izbliza imaju malo oklopa
    atkRange: ranged ? 290 : 62,
    atkCd: siege ? 1.2 : (ranged ? 1.4 : 1.1),
    projSpeed: ranged ? 520 : 0,
    speed: siege ? 122 : 132,
    path, wpIndex: 1,
    goldValue: Math.round((siege ? 75 : (ranged ? 46 : 38)) * CFG.creepGoldMul),
    xpValue: Math.round((siege ? 85 : (ranged ? 52 : 46)) * CFG.creepXpMul),
    rangedCreep: !!ranged, siege: !!siege,
  });
}
// vojarna srušena → protivnički vojnici na toj stazi postaju SUPER (kao u DotA)
function makeCreepOnLane(team, lane, ranged, siege){
  const u = makeCreep(team, lane, ranged, siege);
  const tier = Math.max(0, Math.floor(gameTime / CFG.creepScaleEvery));   // svakih 7.5 min malo više zlata (život i šteta rastu u makeCreep)
  if(tier > 0) u.goldValue += 2 * tier;
  if(superCreeps[team][lane]){
    u.maxhp = u.hp = Math.round(u.maxhp * CFG.superCreepHp);
    u.dmg *= CFG.superCreepDmg;
    u.goldValue += 12;
    u.r += 2;
    u.superCreep = true;
  }
  return u;
}

function makeTower(team, x, y, lane, tier, isGuard){
  // kao u DotA: dublje kule su jače (više života i oklopa) — v0.56: T1 / T2 / T3 / T4 (čuvarske)
  const hpMul = isGuard ? 1.3 : [1, 1, 1.15, 1.2][tier || 1], arm = CFG.towerArmor + (isGuard ? 4 : [0, 0, 2, 3][tier || 1]);
  return makeUnit({
    kind: 'tower', team, x, y, r: 38,
    hp: Math.round(CFG.towerHp * hpMul), maxhp: Math.round(CFG.towerHp * hpMul),
    dmg: 108, atkRange: 390, atkCd: 1.0, projSpeed: 640,
    speed: 0, isStatic: true, armor: arm,   // 🛡️ oklop kule (kao u DotA)
    lane: lane || null, tier: tier || 0, isGuard: !!isGuard,
  });
}

// VOJARNE (barracks): po jedna uz svaku stazu u bazi; ranjive tek kad padne
// unutarnja kula te staze. Srušena vojarna = protivnik dobiva super vojnike.
function makeBarracks(team, lane, x, y){
  return makeUnit({
    kind: 'barracks', team, x, y, r: 58,
    hp: CFG.barracksHp, maxhp: CFG.barracksHp,
    dmg: 0, atkRange: 0, speed: 0, isStatic: true, invuln: true, lane, armor: CFG.barracksArmor,
  });
}
// prizvane jedinice (Majmunska vojska): vojnici koji prate gospodara
function makeSummon(owner, o){
  return makeUnit({
    kind: 'creep', team: owner.team, x: o.x, y: o.y, r: 13,
    hp: o.hp, maxhp: o.hp, dmg: o.dmg, atkRange: 70, atkCd: 1.0, speed: 190,
    goldValue: 15, xpValue: 18, name: o.name, emoji: o.emoji,
    summonOf: owner, lifeT: o.life, summonModel: o.model, path: null, wpIndex: 0,
  });
}
function makeAncient(team){
  const p = ANCIENT_POS[team];
  const u = makeUnit({
    kind: 'ancient', team, x: p.x, y: p.y, r: 56,
    hp: CFG.ancientHp, maxhp: CFG.ancientHp,
    dmg: 0, atkRange: 0, speed: 0, isStatic: true, invuln: true, armor: CFG.towerArmor + 4,
  });
  ancients[team] = u;
  return u;
}

/* ---------- džungla: kampovi ---------- */
function initCamps(){
  camps = CAMP_SPOTS.map(s => ({ x: s.x, y: s.y, type: s.type, units: [], respawnT: 0, fightT: 0 }));
  for(const c of camps){
    if(CFG.prepTime > 0) c.respawnT = CFG.prepTime;   // ⏳ čudovišta se pojave u 0:00, nakon pripreme
    else spawnCamp(c);
  }
}
/* 🐲 v0.47: level čudovišta raste sa satom igre (svake CFG.neutralLvlEvery s) — s njim rastu život, šteta i nagrada */
let neutralLvl = 1;
function neutralLevelNow(){ return 1 + Math.floor(Math.max(0, gameClock()) / CFG.neutralLvlEvery); }
function applyNeutralLevel(u, lvl){
  const b = u.nBase;
  if(!b || u.nlvl === lvl) return;
  const big = u.boss || u.drake, k = lvl - 1;
  const maxhp = Math.round(b.hp * (1 + k * (big ? CFG.bossLvlHp : CFG.neutralLvlHp)));
  u.hp = Math.max(1, u.hp * maxhp / u.maxhp); u.maxhp = maxhp;   // isti udio života
  u.dmg = Math.round(b.dmg * (1 + k * (big ? CFG.bossLvlDmg : CFG.neutralLvlDmg)));
  u.goldValue = Math.round(b.gold * (1 + k * CFG.neutralLvlGold));
  u.xpValue = Math.round(b.xp * (1 + k * CFG.neutralLvlXp));
  u.nlvl = lvl;
}
function updateNeutralLevel(){
  const lvl = neutralLevelNow();
  if(lvl === neutralLvl) return;
  neutralLvl = lvl;
  for(const c of camps) for(const n of c.units) if(!n.dead && !n.removeMe) applyNeutralLevel(n, lvl);
  if(lvl % 3 === 1) feedMsg(L('🐲 Čudovišta i zmajevi su jači — sada su level ' + lvl + '!', '🐲 Monsters and dragons are stronger — now level ' + lvl + '!'), '#fbbf24');
}
function spawnCamp(c){
  const t = CAMP_TYPES[c.type];
  c.units = [];
  for(let i = 0; i < t.n; i++){
    const ang = i / t.n * TAU;
    const u = makeUnit({
      kind: 'neutral', team: TEAM_NEUTRAL,
      x: c.x + Math.cos(ang) * 42, y: c.y + Math.sin(ang) * 42,
      r: t.r, hp: t.hp, maxhp: t.hp, hpRegen: t.hpRegen || 0.5,
      dmg: t.dmg, atkRange: t.range, atkCd: t.atkCd, projSpeed: 0, speed: t.speed,
      goldValue: Math.round(t.gold * CFG.creepGoldMul), xpValue: Math.round(t.xp * CFG.creepXpMul),
      emoji: t.emoji, name: t.name, boss: !!t.boss, camp: c, campType: c.type, buff: t.buff || null,
      stunHit: !!t.stunHit, scanT: rand(0, 0.4),
    });
    u.nBase = { hp: t.hp, dmg: t.dmg, gold: u.goldValue, xp: u.xpValue };
    applyNeutralLevel(u, neutralLevelNow());
    if(t.drake){   // 🐉 zmajčić: element se mijenja (nikad dvaput isti zaredom)
      const el = nextDrake || choice(DRAKE_KEYS);
      nextDrake = choice(DRAKE_KEYS.filter(k => k !== el));
      u.drake = el;
      u.name = DRAKES[el].name;
    }
    c.units.push(u);
  }
}

function isTargetable(e){ return e && !e.dead && !e.removeMe && !e.invuln; }
function isSpellTarget(e){ return e.kind === 'creep' || e.kind === 'hero' || e.kind === 'neutral'; }

function nearestEnemyOf(u, range, filter){
  let best = null, bd = range;
  for(const e of units){
    if(e.team === u.team || e.removeMe || e.dead || e.invuln) continue;
    if(e.kind === 'hero' && e.status.invisT > 0 && e.status.trackT <= 0) continue;   // nevidljivi se ne ciljaju (osim ucijenjenih)
    if(filter && !filter(e)) continue;                                                // (prvo jeftin filter — v0.46: puno čudovišta u džungli)
    if(!isStructure(e) && !isVisibleTo(u.team, e)) continue;                          // v0.38: magla rata vrijedi i za botove, vojnike i kule
    const d = dist(u, e) - (e.r || 0);
    if(d < bd){ bd = d; best = e; }
  }
  return best;
}
function weakestEnemyHero(u, range){
  let best = null, bh = 1e9;
  for(const e of units){
    if(e.team === u.team || e.removeMe || e.dead || e.kind !== 'hero') continue;
    if(dist(u, e) > range) continue;
    if(!isVisibleTo(u.team, e)) continue;   // magla rata
    if(e.status.invisT > 0 && e.status.trackT <= 0) continue;   // nevidljivost
    if(e.hp < bh){ bh = e.hp; best = e; }
  }
  return best;
}
function lowestHpEnemyCreep(u, range){
  let best = null, bh = 1e9;
  for(const e of units){
    if(e.team === u.team || e.removeMe || e.dead || e.kind !== 'creep') continue;
    if(dist(u, e) > range) continue;
    if(e.hp < bh){ bh = e.hp; best = e; }
  }
  return best;
}
function countOwnCreepsNear(team, p, range){
  let n = 0;
  for(const e of units){
    if(e.kind === 'creep' && e.team === team && !e.dead && !e.removeMe && dist(e, p) < range) n++;
  }
  return n;
}

/* ================= Efekti ================= */
function burst(x, y, color, n, spd, size, emoji){
  for(let i = 0; i < n; i++){
    if(particles.length > 450) break;
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: rand(0.3, 0.7), color, size: rand(size * 0.6, size * 1.3), emoji: emoji || null });
  }
}
function ring(x, y, r, color){ markers.push({ x, y, t: 0, color, r, isRing: true }); }
function addLine(x1, y1, x2, y2, color, w, life){
  lines.push({ x1, y1, x2, y2, color, w, life, t: 0 });
}
function addFloat(x, y, txt, color, size, team, st, who){   // team: osobna poruka (zlato, "Nema mane!"…) — vidi je samo taj tim; st: 'crit' = 💥 veliki iskačući broj; who: vide samo ti junaci (brojevi štete)
  if(floats.length > 70) floats.shift();
  floats.push({ x: x + rand(-10, 10), y: y + rand(-6, 6), h: 70, txt, color: color || '#fff', size: size || 15, t: 0, team: team == null ? -1 : team,
    st: st || null, rot: st === 'crit' ? rand(-0.12, 0.12) : 0, who: who || null,
    local: net.mode === 'guest' });   // gostova vlastita poruka (snimka domaćina je ne briše)
}
function feedMsg(txt, color, team){   // team: poruku vidi samo taj tim (npr. buff saveznika)
  if(feed.some(f => f.txt === txt && f.t < 4)) return;   // ista poruka maloprije: ne ponavljaj
  feed.unshift({ txt, color: color || '#fff', t: 0, team: team == null ? -1 : team });
  if(feed.length > 10) feed.pop();   // prikazuje se najviše 6 (poruke drugog tima se ne broje)
}
/* 🎀 tone = boja trake: 'gold' (dobra vijest), 'red' (loša), 'blue' (obična) ili broj tima kojem je vijest loša
   (taj tim vidi crvenu traku, drugi zlatnu) */
function localBanner(txt, sub, tone){ banner = txt ? { txt, sub: sub || '', t: 0, dur: 3, tone: tone == null ? 'blue' : tone } : null; }
function bannerKind(b){ return typeof b.tone === 'number' ? (b.tone === myTeam ? 'red' : 'gold') : BANNER_ART[b.tone] ? b.tone : 'blue'; }
function announce(txt, sub, tone){   // najava za sve (domaćin je šalje i gostu)
  localBanner(txt, sub, tone);
  netBanner = { id: ++bannerN, txt, sub: sub || '', t0: gameTime, tone };
}
/* osobna najava ("Bravo!", "Ne brini!", ulti…): vidi je samo taj junak — igrač odmah, gost preko mreže; bez teksta = makni */
function announceFor(h, txt, sub, tone){
  if(!h) return;
  if(h.isPlayer) localBanner(txt, sub, tone);
  else if(h === remoteHero && net.mode === 'host') guestBanner = { id: ++bannerN, txt: txt || '', sub: sub || '', t0: gameTime, tone };
}

/* ================= Statusi ================= */
function applySlow(t, f, dur){
  const st = t.status;
  if(st.immuneT > 0) return;
  if(st.slowT <= 0 || f >= st.slowF){ st.slowF = f; st.slowT = Math.max(st.slowT, dur); }
}
/* 💫 omama — v0.56: stunMax = koliko je omama trajala na početku (traka omame nad životom se prazni do kraja),
   a junak iznad glave pokaže koliko dugo (samo nova ili znatno dulja omama, ne svaki otkucaj zone) */
function applyStun(t, dur){
  const st = t.status;
  if(st.immuneT > 0) return;
  dur += abDur();
  if(dur <= st.stun) return;
  if(st.stun <= 0.05 || dur > st.stun + 0.4){
    st.stunMax = dur;
    if(t.kind === 'hero' && dur >= 0.8) addFloat(t.x, t.y - 34, '💫 ' + dur.toFixed(1) + ' s', '#fde047', 15);
  } else st.stunMax = Math.max(st.stunMax || 0, dur);
  st.stun = dur;
}
function applyRoot(t, dur){ if(t.status.immuneT > 0) return; dur += abDur(); t.status.rootT = Math.max(t.status.rootT, dur); }
function applySilence(t, dur){ if(t.status.immuneT > 0) return; dur += abDur(); t.status.silenceT = Math.max(t.status.silenceT, dur); }
function applyPoison(t, dps, dur, src, label){
  const st = t.status;
  if(st.immuneT > 0 || !isSpellTarget(t)) return;
  st.poisonDps = Math.max(st.poisonT > 0 ? st.poisonDps : 0, dps);
  st.poisonT = Math.max(st.poisonT, dur);
  st.poisonSrc = src || null;
  if(t.kind === 'hero') addFloat(t.x, t.y, label || L('🤢 Otrovan!', '🤢 Poisoned!'), label ? '#fca5a5' : '#86efac', 13);
}
// Kraljevski oklop: kratko ništa ne omamljuje, usporava, truje...
function applyImmune(h, dur){
  const st = h.status;
  st.immuneT = Math.max(st.immuneT, dur);
  st.stun = 0; st.slowT = 0; st.rootT = 0; st.silenceT = 0; st.poisonT = 0;
  addFloat(h.x, h.y, L('👑 Nepokolebljiv!', '👑 Unstoppable!'), '#fde047', 15);
}
function applyShield(t, f, dur){ t.status.shieldT = dur; t.status.shieldF = f; }
function applyAtkSpeed(t, f, dur){ t.aspdT = dur; t.aspdF = f; }          // Tigrove kandže: brži napadi
function applyDodge(t, f, dur){ t.dodgeT = dur; t.dodgeF = f; }           // Pijani korak: izbjegavanje udaraca
function applyTaunt(t, by, dur){                                         // Izazov: mora napadati izazivača
  if(t.status.immuneT > 0) return;
  dur += abDur();
  t.tauntT = dur; t.tauntBy = by;
  t.attackTarget = by; t.moveTarget = null;
  if(t.kind === 'hero') addFloat(t.x, t.y, '📢', '#fb923c', 18);
}
function applyDot(t, dps, dur, src){                                     // tiho gorenje / krvarenje (bez natpisa)
  const st = t.status;
  if(st.immuneT > 0 || !isSpellTarget(t)) return;
  st.poisonDps = Math.max(st.poisonT > 0 ? st.poisonDps : 0, dps);
  st.poisonT = Math.max(st.poisonT, dur);
  st.poisonSrc = src || null;
}
function inRiver(x, y){ return Math.abs(x - y) / Math.SQRT2 < 130; }
function applyHaste(t, f, dur){ t.status.hasteT = dur; t.status.hasteF = f; }
function applyCurse(t, f, dur){ if(t.status.immuneT > 0) return; t.status.curseT = Math.max(t.status.curseT, dur); t.status.curseF = Math.max(t.status.curseF, f); }
function applyBlind(t, f, dur){ if(t.status.immuneT > 0) return; t.status.blindT = Math.max(t.status.blindT, dur); t.status.blindF = Math.max(t.status.blindF, f); }
/* povuci jedinicu prema točki (pipci, vrtlog) — ne bliže od 60 */
function pullToward(e, x, y, d){
  if(e.status.immuneT > 0 || isStructure(e)) return;
  const dx = x - e.x, dy = y - e.y, L = Math.hypot(dx, dy);
  if(L < 1) return;
  const k = Math.min(d, Math.max(0, L - 60)) / L;
  e.x = clamp(e.x + dx * k, 40, WORLD - 40); e.y = clamp(e.y + dy * k, 40, WORLD - 40);
  e.moveTarget = null;
  burst(e.x, e.y, '#c7d2fe', 4, 80, 4);
}
/* odbaci jedinicu od točke (udarac rogom) */
function knockback(e, x, y, d){
  if(e.status.immuneT > 0 || isStructure(e)) return;
  let dx = e.x - x, dy = e.y - y, L = Math.hypot(dx, dy);
  if(L < 1){ dx = 1; dy = 0; L = 1; }
  e.x = clamp(e.x + dx / L * d, 40, WORLD - 40); e.y = clamp(e.y + dy / L * d, 40, WORLD - 40);
  e.moveTarget = null;
  e.knockN = (e.knockN || 0) + 1;   // 3D: model odleti lukom
  burst(e.x, e.y, '#fde68a', 5, 100, 4);
}
/* 🪝 v0.55 Udica (Pecko Q): pogođenog lanac dovuče skroz do bacača (ne može ništa dok ga vuče) */
function dragTo(e, src, speed){
  if(!e || e.dead || e.removeMe || e.status.immuneT > 0 || isStructure(e)) return;
  e.drag = { src, speed, t: 1.6 };
  e.moveTarget = null; e.windup = null;
  if(e.chan) cancelChannel(e, chanMsg(e.chan));
  if(e.kind === 'hero' && e.tpChannel > 0) cancelTeleport(e);
  e.charge = null;
}
function updateDrag(u, dt){
  const d = u.drag, s = d.src;
  d.t -= dt;
  if(!s || s.dead || s.removeMe || d.t <= 0 || u.status.immuneT > 0){ u.drag = null; return false; }
  const want = s.r + u.r + 12, L = dist(u, s);
  if(L <= want + 2){ u.drag = null; return false; }
  const step = Math.min(L - want, d.speed * dt);
  u.x = clamp(u.x + (s.x - u.x) / L * step, 40, WORLD - 40);
  u.y = clamp(u.y + (s.y - u.y) / L * step, 40, WORLD - 40);
  u.lastMoveT = gameTime;
  if(Math.random() < dt * 12) burst(u.x, u.y, '#cbd5e1', 2, 50, 3);
  return true;
}
/* 🤢⏳ v0.55 oblak oko junaka (Smrdljivi oblak — Pecko W, Pješčana oluja — Škorpo W): ide s njim i svakih pola sekunde rani neprijatelje */
function startCloud(u, o){
  u.cloud = Object.assign({ acc: 0, dur: o.t, key: abCtx && abCtx.src === u ? abCtx.key : null }, o);
}
function updateCloud(u, dt){
  const c = u.cloud;
  c.t -= dt; c.acc += dt;
  if(c.acc >= 0.5){
    c.acc -= 0.5;
    const prev = abCtx; abCtx = c.key ? { src: u, key: c.key } : null;
    for(const e of units){
      if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
      if(dist(u, e) > c.r + e.r * 0.5) continue;
      applyDamage(e, c.dps * 0.5, u);
      if(c.slow) applySlow(e, c.slow, 0.8);
    }
    abCtx = prev;
    if(c.self && !u.dead) u.hp = Math.max(1, u.hp - c.self * 0.5);   // smrdi i njemu (ali ne može sam sebe pobijediti)
  }
  if(c.t <= 0 || u.dead) u.cloud = null;
}
/* 🧪 v0.55 Otrovni prasak (Škorpo): otrovana meta koja padne rasprsne se po svima oko sebe; preživi li 4 s, malo prasne */
function applyCaustic(e, src){
  if(!e || e.dead || e.removeMe || isStructure(e) || !src || e.team === src.team) return;
  const rk = passiveRank(src, 'zalac');
  if(!rk) return;
  e.causticT = 4; e.causticSrc = src; e.causticDmg = 30 + 30 * rk;
}
function causticBurst(e, f){
  const s = e.causticSrc, dmg = (e.causticDmg || 0) * f;
  e.causticT = 0; e.causticSrc = null;
  if(!s || s.removeMe || dmg <= 0) return;
  for(const o of units){
    if(o === e || o.team === s.team || o.dead || o.removeMe || o.invuln || !isSpellTarget(o)) continue;
    if(dist(e, o) <= 220 + o.r * 0.5) applyDamage(o, dmg, s);
  }
  ring(e.x, e.y, 220, '#a3e635');
  burst(e.x, e.y, '#bef264', f >= 1 ? 22 : 12, 220, 6);
}
/* 🍉 v0.55 Gozba (Pecko): neprijateljski junak padne blizu — zauvijek +snaga */
function feastNear(t){
  for(const h of units){
    if(h.kind !== 'hero' || h.team === t.team || h.dead || h.removeMe) continue;
    const gz = passiveRank(h, 'gozba');
    if(!gz || dist(h, t) > 900) continue;
    const add = 1 + 0.5 * gz;
    h.str += add; h.feastN = (h.feastN || 0) + 1;
    recomputeAttrStats(h);
    addFloat(h.x, h.y - 20, L('🍉 Njam! +' + add.toFixed(1) + ' snage', '🍉 Yum! +' + add.toFixed(1) + ' strength'), '#fca5a5', 15, isHuman(h) ? undefined : h.team);
  }
}
/* 🎯 bot gađa malo ispred mete koja hoda (Udica) */
function leadAim(u, e, speed){
  if(!e.moveTarget || e.status.stun > 0 || e.status.rootT > 0) return { x: e.x, y: e.y };
  const tt = dist(u, e) / speed, dx = e.moveTarget.x - e.x, dy = e.moveTarget.y - e.y, L = Math.hypot(dx, dy) || 1;
  const go = Math.min(L, unitSpeed(e) * tt * 0.8);
  return { x: e.x + dx / L * go, y: e.y + dy / L * go };
}
/* zamjena mjesta (Gavran W) */
function swapPositions(u, e){
  const x = u.x, y = u.y;
  u.x = e.x; u.y = e.y; e.x = x; e.y = y;
  u.moveTarget = null; e.moveTarget = null; e.attackTarget = null;
  addLine(u.x, u.y, e.x, e.y, '#c4b5fd', 6, 0.35);
  burst(u.x, u.y, '#c4b5fd', 12, 160, 5); burst(e.x, e.y, '#c4b5fd', 12, 160, 5);
  addFloat(e.x, e.y, '🔁', '#c4b5fd', 18);
  if(e.isPlayer) cam.follow = true;
}
/* juriš (Nosorog Q): junak trči ravno dok ne udari prvog neprijatelja */
function startCharge(u, aim, o){
  const p = clampRange(u, aim, o.range);
  const dx = p.x - u.x, dy = p.y - u.y, L = Math.hypot(dx, dy) || 1;
  u.charge = { vx: dx / L * o.speed, vy: dy / L * o.speed, left: L, dmg: o.dmg, stun: o.stun, abKey: abCtx && abCtx.src === u ? abCtx.key : null };
  u.dir = Math.atan2(dy, dx);
  u.moveTarget = null; u.attackTarget = null;
  u.status.hasteT = 0;
}
function updateCharge(u, dt){
  const c = u.charge;
  if(!c) return false;
  if(u.status.stun > 0 || u.status.rootT > 0){ u.charge = null; return false; }
  const step = Math.min(c.left, Math.hypot(c.vx, c.vy) * dt);
  const L = Math.hypot(c.vx, c.vy) || 1;
  u.x = clamp(u.x + c.vx / L * step, 40, WORLD - 40);
  u.y = clamp(u.y + c.vy / L * step, 40, WORLD - 40);
  u.lastMoveT = gameTime;
  c.left -= step;
  if(Math.random() < dt * 20) burst(u.x, u.y, '#c9b48c', 2, 60, 4);
  for(const e of units){
    if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
    if(dist(u, e) <= u.r + e.r + 12){
      const prev = abCtx; abCtx = c.abKey ? { src: u, key: c.abKey } : null;
      applyDamage(e, c.dmg, u);
      applyStun(e, c.stun);
      abCtx = prev;
      knockback(e, u.x, u.y, 120);
      burst(e.x, e.y, '#fbbf24', 18, 240, 6);
      addFloat(e.x, e.y, '💥', '#fbbf24', 20);
      u.charge = null;
      u.attackTarget = e;
      return true;
    }
  }
  if(c.left <= 0.5 || u.x <= 40 || u.x >= WORLD - 40 || u.y <= 40 || u.y >= WORLD - 40) u.charge = null;
  return true;
}
/* predmeti s gutljajima / punjenjima (Čutura, Prah otkrića, Čarobno oko) */
function itemCharges(h, id){
  const v = h.itemCharges[id];
  return v == null ? (ITEM_BY_ID[id].charges || 0) : v;
}
function useCharge(h, id){ h.itemCharges[id] = itemCharges(h, id) - 1; }
/* Glif utvrde (F): sve građevine tima 5 s neranjive, puni se 5 min */
function useGlyph(team, who){
  const g = glyph[team];
  if(g.cd > 0){ if(who && isHuman(who)) addFloat(who.x, who.y, L('🛡️ Glif se još puni (' + Math.ceil(g.cd) + ' s)', '🛡️ Glyph is recharging (' + Math.ceil(g.cd) + ' s)'), '#e5e7eb', 13, who.team); return false; }
  g.t = CFG.glyphDur; g.cd = CFG.glyphCd;
  feedMsg(L('🛡️ ' + TEAM_NAME[team] + ' koristi Glif utvrde!', '🛡️ ' + TEAM_NAME[team] + ' uses the Glyph!'), TEAM_COLOR[team]);
  for(const u of units) if(isStructure(u) && u.team === team && !u.removeMe) ring(u.x, u.y, 80, '#fde047');
  if(who && who.isPlayer) sfx('cast');
  return true;
}
function heal(u, amt){
  if(!u || u.dead || u.removeMe) return;
  if(abCtx && abCtx.src && abCtx.src.team === u.team) amt += abBonus(abCtx.src, abCtx.key, 'heal');   // 🎓 talent liječenja
  if(u.gwT > 0) amt *= 0.6;   // 🔥 zapaljen: slabije liječenje
  const act = Math.min(u.maxhp - u.hp, amt);
  if(act <= 0) return;
  u.hp += act;
  addFloat(u.x, u.y, '+' + Math.round(act), '#4ade80', 14);
  burst(u.x, u.y, '#4ade80', 6, 90, 4);
}
function healCircle(u, r, amt){
  for(const e of units){
    if(e.team !== u.team || e.dead || e.removeMe) continue;
    if(e.kind !== 'hero' && e.kind !== 'creep') continue;
    if(dist(u, e) <= r) heal(e, amt);
  }
  ring(u.x, u.y, r, '#4ade80');
  sfxAt('heal', u.x, u.y);
}

/* ================= Šteta i smrt ================= */
/* 💀 pregled pogibije (kao u LoL-u): tko ti je i čime nanio štetu u zadnjih 15 s */
function dmgLabel(src, kind){
  if(kind === 'atk') return L('⚔️ Napadi', '⚔️ Attacks');
  const ab = src && src.kind === 'hero' && (src.curAb || (src.lastAb && gameTime - (src.lastAbT || -99) < 8 ? src.lastAb : null));
  return ab ? ab.emoji + ' ' + ab.name : L('✨ Čarolije', '✨ Spells');
}
function noteDamage(t, src, n, kind){
  const log = t.dmgLog || (t.dmgLog = []);
  while(log.length && gameTime - log[0].t > 15) log.shift();
  let g, name, icon, hero = null;
  if(!src){ g = 'x'; name = L('Otrov i ostalo', 'Poison and more'); icon = '☠️'; }
  else if(src.kind === 'hero'){ g = 'h' + src.id; name = src.name; icon = src.emoji; hero = src.hero && src.hero.id; }
  else if(isStructure(src)){ g = 'tower'; name = L('Kula', 'Tower'); icon = '🏰'; }
  else if(src.kind === 'creep'){ g = 'creep'; name = L('Vojnici', 'Creeps'); icon = '⚔️'; }
  else { g = 'n' + (src.name || ''); name = src.name || L('Čudovište', 'Monster'); icon = src.emoji || '🐾'; }
  log.push({ t: gameTime, g, name, icon, hero, team: src ? src.team : -1, n, lab: dmgLabel(src, kind) });
}
function buildRecap(t, killerName){
  const by = new Map();
  let total = 0;
  for(const e of t.dmgLog || []){
    if(gameTime - e.t > 15) continue;
    let r = by.get(e.g);
    if(!r){ r = { name: e.name, icon: e.icon, hero: e.hero, team: e.team, n: 0, parts: {} }; by.set(e.g, r); }
    r.n += e.n; total += e.n;
    r.parts[e.lab] = (r.parts[e.lab] || 0) + e.n;
  }
  t.dmgLog = [];
  const rows = [...by.values()].sort((a, b) => b.n - a.n).slice(0, 4).map(r => ({
    name: r.name, icon: r.icon, hero: r.hero, team: r.team, n: Math.round(r.n),
    parts: Object.entries(r.parts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => [k, Math.round(v)]) }));
  return { killer: killerName, total: Math.round(total), rows };
}
let hitCrit = false;   // 💥 upravo se dijeli kritični udarac (releaseAttack / projektil napada)
function applyDamage(t, amount, src, kind){
  if(!t || t.dead || t.removeMe || t.invuln || gameOver) return;
  if(t.cycloneT > 0) return;   // 🌪️ u vihoru: ništa ga ne može ozlijediti
  const st = t.status;
  if(isStructure(t) && glyph[t.team] && glyph[t.team].t > 0){   // 🛡️ Glif utvrde
    if(src && src.isPlayer && Math.random() < 0.3) addFloat(t.x, t.y, L('🛡️ Glif!', '🛡️ Glyph!'), '#fde047', 13);
    return;
  }
  if(isStructure(t) && src && src.team !== t.team && backdoorProtected(t)){   // 🛡️ backdoor
    amount *= CFG.backdoorMul;
    t.bdT = gameTime;
    if(src.isPlayer && gameTime - (t.bdWarnT || -99) > 4){
      t.bdWarnT = gameTime;
      addFloat(t.x, t.y, L('🛡️ Bez vojnika kula prima pola štete!', '🛡️ Without creeps, towers take half damage!'), '#93c5fd', 13);
    }
  }
  if(t.clarityT > 0 && src && src.kind === 'hero' && src.team !== t.team){   // 💧 udarac prekida Plavu kap
    t.clarityT = 0;
    if(isHuman(t)) addFloat(t.x, t.y, L('💧 Plava kap prekinuta!', '💧 Blue Drop interrupted!'), '#7dd3fc', 13, t.team);
  }
  if(kind !== 'atk' && src && src.kind === 'hero'){
    if(abCtx && abCtx.src === src){ const b = abBonus(src, abCtx.key, 'dmg'); if(b) amount += b; }   // 🎓 talent: jača moć
    if(src.spellAmp || src.itemAmp) amount *= 1 + (src.spellAmp || 0) + (src.itemAmp || 0);          // 🎓 jačina magija (📘 Knjiga čarolija)
    amount *= 1 + (src.int + (src.itemAttr ? src.itemAttr.int : 0)) * CFG.intSpellAmp;              // 🧠 inteligencija jača moći
  }
  if(kind !== 'atk' && t.mres) amount *= 1 - t.mres;   // 🧥 v0.56 otpor magiji (Vuneni ogrtač, Kapa protiv čarolija, Truba zaštite…)
  if(kind === 'atk' && t.staticT > 0 && src && !isStructure(src) && src.team !== t.team && Math.random() < 0.2){   // 🌩️ statički štit
    addLine(t.x, t.y, src.x, src.y, '#fde047', 4, 0.2); applyDamage(src, 200, t, true);
  }
  if(t.kind === 'hero' && !(t.projSpeed > 0)) amount *= 1 - CFG.meleeResist;   // ⚖️ junaci izbliza su izdržljiviji (moraju ući u borbu)
  const kz = passiveRank(t, 'koza');                 // Lavlja koža: pasivno smanjenje štete
  if(kz) amount *= 1 - (0.03 + 0.03 * kz);
  if(kind !== 'atk'){ const gz = passiveRank(t, 'gozba'); if(gz) amount *= 1 - (0.04 + 0.03 * gz); }   // 🍉 Gozba (Pecko): debela koža protiv magija
  if(st.shieldT > 0) amount *= (1 - st.shieldF);
  if(st.curseT > 0) amount *= 1 + st.curseF;         // 🌀 Kletva: prima više štete
  const tv = passiveRank(t, 'tvrd');                 // Debeli oklop (Rogo E): ravno smanjenje
  if(tv) amount -= 4 + 4 * tv;
  if(src && src.kind === 'hero' && src.team !== t.team){ const fd = drakeN(src.team, 'fire'); if(fd) amount *= 1 + 0.06 * fd; }   // 🔥 vatreni zmajčići
  if(kind === 'atk'){   // ⚔️ običan udarac: oklop i blok (kao u DotA); magije prolaze
    amount *= armorMul(unitArmor(t));
    // 🏰 "utvrđeni" oklop građevina (kao u Allstarsu): junaci rade manje štete, opsadni vojnici više
    if(isStructure(t) && src) amount *= src.kind === 'hero' ? CFG.heroVsStructure * lateSiegeMul() : (src.siege ? CFG.siegeVsStructure : 1);
    const bl = t.ifx && t.ifx.block;
    if(bl && src && !isStructure(src) && Math.random() < bl.c) amount -= bl.a * (src.projSpeed > 0 ? 0.5 : 1);   // blok ne djeluje na kule
  }
  if(t.barrierT > 0 && t.barrierHp > 0){   // 🫧 Barijera upije štetu
    const ab = Math.min(t.barrierHp, amount);
    t.barrierHp -= ab; amount -= ab;
    if(amount <= 0){ t.flash = 0.08; return; }
  }
  amount = Math.max(1, Math.round(amount));
  const hp0 = t.hp;
  t.hp -= amount;
  if(t.kind === 'hero' && isHuman(t)) noteDamage(t, src, Math.min(hp0, amount), kind);   // 💀 za pregled pogibije
  if(kind === 'atk' && src && !src.dead && !isStructure(t)){   // 🦇 krađa života udarcima
    const ls = Math.max(src.lifesteal || 0, src.auraLs || 0) + (src.talLs || 0) + (src.lsBoostT > 0 ? 1.5 : 0);
    if(ls > 0){
      src.hp = Math.min(src.maxhp, src.hp + Math.min(hp0, amount) * ls * (src.gwT > 0 ? 0.6 : 1));
      if(Math.random() < 0.35) burst(src.x, src.y, '#f87171', 2, 50, 3);
    }
  }
  t.flash = 0.12;
  if(src && src !== t) t.hitAng = Math.atan2(t.y - src.y, t.x - src.x);   // 3D: trzaj od napadača
  // 🔢 brojevi štete samo kad si TI uključen (tvoj udarac, tvoj prizvani pomoćnik ili udarac u tebe) — u 5 na 5 inače zatrpaju ekran
  const who = [];
  if(src && isHuman(src)) who.push(src.id);
  else if(src && src.summonOf && isHuman(src.summonOf)) who.push(src.summonOf.id);
  if(isHuman(t)) who.push(t.id);
  if(hitCrit && kind === 'atk'){   // 💥 kritični udarac: veliki broj koji iskoči + 3D rez preko mete
    t.critN = (t.critN || 0) + 1;
    if(who.length) addFloat(t.x, t.y, SETTINGS.dmgNums ? amount + '!' : L('KRIT!', 'CRIT!'), src && src.team === TEAM_BLUE ? '#ff5a1f' : '#ff3b6b', t.kind === 'hero' ? 27 : 23, undefined, 'crit', who);
    if(src && (src.isPlayer || t.isPlayer)) sfx('crit'); else sfxAt('crit', t.x, t.y);
  }
  else if(SETTINGS.dmgNums && who.length){
    const mine = isHuman(t) ? 't' : 's', df = t.dmgF;
    if(df && df.t < 0.3 && df.mine === mine && floats.includes(df)){ df.amt += amount; df.txt = '-' + df.amt; }   // brzi udarci (otrov, glad…) u jedan broj
    else {
      addFloat(t.x, t.y, '-' + amount, mine === 't' ? '#ff6b6b' : '#ffd166', t.kind === 'hero' ? 16 : 13, undefined, null, who);
      t.dmgF = floats[floats.length - 1]; t.dmgF.amt = amount; t.dmgF.mine = mine;
    }
  }
  if(isStructure(t) && src && src.team !== t.team) t.lastDmgT = gameTime;   // 🤖 obrana: koga upravo ruše
  if(src && src.kind === 'hero' && src.team !== t.team){   // 🏅 za medalje na kraju igre
    if(t.kind === 'hero') src.heroDmg = (src.heroDmg || 0) + Math.min(hp0, amount);
    else if(isStructure(t)) src.bldDmg = (src.bldDmg || 0) + Math.min(hp0, amount);
  }
  if(src && src.team !== t.team){   // 💨 borba prekida putovanje (udarci između junaka, kula i građevina)
    if(src.kind === 'hero' && (t.kind === 'hero' || isStructure(t))) noteCombat(src);
    if(t.kind === 'hero' && (src.kind === 'hero' || src.kind === 'tower')) noteCombat(t);
  }
  if(src && src.kind === 'hero' && !src.dead && src.team !== t.team){
    t.lastHitter = src;
    t.lastHitT = gameTime;
    if(t.kind === 'hero') (t.hitBy = t.hitBy || {})[src.id] = gameTime;   // za asistencije
  }
  // Oklop od bodlji (Bodljo E): napadaču polete bodlje natrag
  const okl = passiveRank(t, 'oklop');
  if(okl && src && src !== t && !src.dead && !src.removeMe && src.team !== t.team && isSpellTarget(src) &&
     Math.random() < 0.2 + 0.05 * okl){
    for(let i = 0; i < 3; i++) spawnHoming(t, src, { speed: 700, dmg: 18 + 10 * okl, r: 7, color: '#a3e635', emoji: '🌵' });
    if(isHuman(t)) addFloat(t.x, t.y, L('🌵 Bodlje!', '🌵 Spikes!'), '#a3e635', 13, t.team);
  }
  // 🌀 Bikovski vrtlog (Bikoš): kad ga udare, ponekad se zavrti sa sjekirom i rani sve oko sebe
  const hx = kind === 'atk' && src && src.team !== t.team && !isStructure(src) && !t.dead ? passiveRank(t, 'helix') : 0;
  if(hx && t.hp > 0 && gameTime >= (t.helixT || 0) && Math.random() < 0.16 + 0.03 * hx){
    t.helixT = gameTime + 0.3; t.helixN = (t.helixN || 0) + 1;
    for(const e of units){
      if(e.team === t.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e) || dist(t, e) > 230 + e.r * 0.5) continue;
      applyDamage(e, 60 + 35 * hx, t);
    }
  }
  if(src && src.kind === 'neutral' && src.camp && t.team !== TEAM_NEUTRAL) src.camp.fightT = gameTime;   // 🐗 kamp je u borbi
  if(t.kind === 'neutral' && src && !src.dead && !src.removeMe && src.team !== t.team && !isStructure(src)){
    // 🐗 v0.46: uzvrati onome tko te udara ako trenutnu metu samo ganjaš (tako se kamp "povuče" na vojnike na stazi)
    t.camp.fightT = gameTime;
    const cur = t.attackTarget;
    if(!t.returning && dist(t, src) < 700 && (!isTargetable(cur) || cur.team === TEAM_NEUTRAL || dist(t, cur) > t.atkRange + cur.r + 60)) t.attackTarget = src;
  }
  else if(t.kind === 'creep' && src && !src.dead && !src.removeMe && src.team !== t.team){
    if(!isTargetable(t.attackTarget) && dist(t, src) < 620){
      t.attackTarget = src;
      if(src.kind === 'hero') t.aggroT = gameTime + CFG.creepAggroChase;
    }
  }
  if(t.hp <= 0) kill(t, src);
}

function kill(t, src){
  t.hp = 0;
  t.hungerT = 0;
  if(t.causticT > 0) causticBurst(t, 1);   // 🧪 otrovana meta se rasprsne (v0.55)
  t.drag = null; t.cloud = null; t.epi = null; t.frostT = 0;
  if(src && src.hungerT > 0){ src.hungerT = 0; if(src.kind === 'hero') addFloat(src.x, src.y, L('🍖 Sit!', '🍖 Full!'), '#fdba74', 14); }   // 🍖 Ratna glad: sit je kad pobijedi
  if(t.kind === 'creep'){
    t.removeMe = true;
    burst(t.x, t.y, TEAM_LIGHT[t.team], 8, 130, 5);
    const denied = !!(src && src.team === t.team);   // ⛔ uskraćen: protivnik ne dobiva zlato i dobiva pola iskustva
    if(denied){
      if(src.kind === 'hero'){ src.denies++; addFloat(t.x, t.y, '❗', '#f87171', 24); }
    }
    else if(src && src.kind === 'hero' && !src.dead){
      src.gold += t.goldValue;
      src.lastHits++;
      if(isHuman(src)){ if(src.isPlayer) sfx('coin'); addFloat(t.x, t.y, '+' + t.goldValue + ' 💰', '#fde047', 15, src.team); coinDrops.push({ x: t.x, y: t.y, n: 1 + Math.floor(t.goldValue / 30) }); }
    }
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h.team !== TEAM_NEUTRAL && !h.dead && dist(h, t) < CFG.xpRadius)
        giveXp(h, (t.xpValue || CFG.creepXp) * (denied ? 0.5 : 1));
    }
  }
  else if(t.kind === 'neutral'){
    t.removeMe = true;
    burst(t.x, t.y, '#fcd34d', 10, 150, 5);
    const camp = t.camp;
    camp.units = camp.units.filter(x => x !== t);
    if(camp.units.length === 0) camp.respawnT = t.boss ? CFG.bossRespawn : (t.drake ? CFG.drakeRespawn : CFG.campRespawn);
    if(t.drake && src && (src.team === TEAM_BLUE || src.team === TEAM_RED)) takeDrake(src, t.drake);
    if(src && src.kind === 'hero' && !src.dead){
      const g = t.goldValue + (src.ifx && src.ifx.hunt && !t.boss && !t.drake ? src.ifx.hunt.gold : 0);   // 🐾 Lovački nož: više zlata iz kampova
      src.gold += g;
      src.lastHits++;
      if(isHuman(src)){ if(src.isPlayer) sfx('coin'); addFloat(t.x, t.y, '+' + g + ' 💰', '#fde047', 15, src.team); coinDrops.push({ x: t.x, y: t.y, n: Math.min(6, 1 + Math.floor(g / 40)) }); }
      for(const h of units){
        if(h.kind === 'hero' && h.team === src.team && !h.dead && dist(h, t) < CFG.xpRadius)
          giveXp(h, t.xpValue);
      }
      maybeNeutralDrop(src, t);
      if(t.buff) giveJungleBuff(src, t.buff, JUNGLE_BUFFS[t.buff].dur);   // 🔵🔴 buff džungle
      if(t.boss){
        bossKills++;
        histEvent('boss', src.team);
        for(const h of units) if(h.kind === 'hero' && h.team === src.team) h.bossKill = true;   // 🏆 Zmajoubojica (cijeli tim)
        if(bossKills >= 2){   // 🧀 od drugog puta Zmaj ostavlja i sir
          const cheese = ITEM_BY_ID.cheese;
          const taker = [src].concat(units.filter(h => h.kind === 'hero' && h.team === src.team && h !== src && !h.dead))
            .find(h => h.items.length < CFG.inventorySlots || (h.backpack || []).length < BACKPACK_SLOTS);
          if(taker){
            giveItem(taker, cheese); delete taker.itemCharges.cheese; recomputeItemStats(taker);
            feedMsg(L('🧀 ' + taker.emoji + ' ' + taker.name + ' je dobio Zmajevu poslasticu!', '🧀 ' + taker.emoji + ' ' + taker.name + ' got the Dragon Treat!'), '#fde047');
            if(taker.isPlayer) refreshShop();
          }
        }
        feedMsg(L('🐲 ' + src.emoji + ' ' + src.name + ' je porazio Velikog Zmaja!', '🐲 ' + src.emoji + ' ' + src.name + ' defeated the Great Dragon!'), '#fde047');
        announce(L('🐲 Veliki Zmaj je poražen!', '🐲 The Great Dragon is defeated!'), L(src.emoji + ' ' + src.name + ' dobiva Zmajev blagoslov!', src.emoji + ' ' + src.name + ' gets the Dragon Blessing!'), 1 - src.team);
        annEvent('dragon', src.team);
        for(const h of units){
          if(h.kind === 'hero' && h.team === src.team) h.gold += CFG.bossGoldTeam;
        }
        src.status.dmgMulT = Math.max(src.status.dmgMulT, 60);
        src.status.dmgMulF = Math.max(src.status.dmgMulF, 1.3);
        applyHaste(src, 1.15, 60);
        addFloat(src.x, src.y, L('🐲 Zmajev blagoslov!', '🐲 Dragon Blessing!'), '#fde047', 17);
        // 🛡️ Zmajev štit: ubojica se nakon pogibije vraća na mjestu
        src.aegis = true; src.aegisT = CFG.aegisDuration;
        feedMsg(L('🛡️ ' + src.emoji + ' ' + src.name + ' ima Zmajev štit!', '🛡️ ' + src.emoji + ' ' + src.name + ' has the Dragon Shield!'), '#fde047');
        sfx('kill');
      }
    }
  }
  else if(t.kind === 'hero'){
    t.dead = true;
    t.deaths++;
    kills[1 - t.team]++;
    t.deadT = CFG.respawnBase + t.level * CFG.respawnPerLvl;
    if(t.aegis){   // 🛡️ Zmajev štit: vraća se za 3 s na mjestu pogibije
      t.aegis = false; t.aegisT = 0;
      t.reviveAt = { x: t.x, y: t.y };
      t.deadT = 3;
      announce(L('🛡️ Zmajev štit!', '🛡️ Dragon Shield!'), L(t.emoji + ' ' + t.name + ' se vraća za 3 sekunde!', t.emoji + ' ' + t.name + ' comes back in 3 seconds!'), 1 - t.team);
    }
    t.moveTarget = null; t.attackTarget = null;
    t.tpChannel = 0; t.tpDest = null; t.danceT = 0; t.chan = null;
    feastNear(t);   // 🍉 Gozba (Pecko)
    // zapamti ucjenu PRIJE čišćenja statusa
    const wasTracked = t.status.trackT > 0;
    const trackBonusVal = t.trackBonus || 100;
    const trackerRef = t.trackedBy;
    t.status = baseStatus();
    burst(t.x, t.y, TEAM_COLOR[t.team], 26, 240, 7);
    burst(t.x, t.y, '#fff', 10, 160, 4);
    let killerName = L('🏰 Toranj', '🏰 Tower');
    let milestoneAnn = false;
    const victimStreak = t.streak || 0;
    t.streak = 0; t.multiN = 0;
    // kill ide junaku; ako je zadnji udarac zadala kula/vojnik, kill dobiva
    // junak koji je metu udario u zadnjih 6 sekundi (kao u DotA!)
    let credit = (src && src.kind === 'hero') ? src : null;
    if(!credit && t.lastHitter && t.lastHitter.kind === 'hero' && !t.lastHitter.removeMe &&
       t.lastHitter.team !== t.team && gameTime - (t.lastHitT || -99) < 6){
      credit = t.lastHitter;
    }
    let comebackPool = 0;
    if(credit){
      credit.kills++;
      credit.streak = (credit.streak || 0) + 1;
      credit.bestStreak = Math.max(credit.bestStreak || 0, credit.streak);
      credit.gold += CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl;
      giveXp(credit, CFG.heroKillXp + t.level * 15);
      killerName = credit.emoji + ' ' + credit.name;
      if(isHuman(credit)) addFloat(credit.x, credit.y, '+' + (CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl) + ' 💰', '#fde047', 17, credit.team);
      // 🔄 povratak u igru (kao u DotA): tim koji gubi dobiva više zlata kad ubije junaka tima koji vodi —
      //   v0.54: bonus se dijeli na ubojicu i suigrače koji su pomogli (dolje; prije sve ubojici, pa je najbogatiji bivao još bogatiji)
      const behind = teamNetWorth(t.team) - teamNetWorth(credit.team);
      if(behind > CFG.comebackFrom * CFG.teamSize)   // npr. 350 po junaku: 1750 u 5 na 5 (veći timovi = veće razlike)
        comebackPool = Math.min(CFG.comebackMax, Math.round(behind * CFG.comebackPct / 10) * 10);
      // višestruko ubojstvo (unutar 10 s) i niz ubojstava — kao najavljivač u DotA
      credit.multiN = gameTime - (credit.lastKillT || -99) < 10 ? (credit.multiN || 1) + 1 : 1;
      if(credit.bot && Math.random() < 0.3 && gameTime - botBragT > 45){ botBragT = gameTime; say(credit, choice(BOT_BRAG)); }   // botovi se rijetko pohvale
      credit.lastKillT = gameTime;
      const who = credit.emoji + ' ' + credit.name;
      const MULTI = { 2: L('⚔️⚔️ Dvostruko ubojstvo!', '⚔️⚔️ Double kill!'), 3: L('🔥 Trostruko ubojstvo!', '🔥 Triple kill!'), 4: L('💥 ULTRA ubojstvo!', '💥 ULTRA KILL!'), 5: L('🌋 POKOLJ!', '🌋 RAMPAGE!') };
      const STREAK = { 3: ['🔥', L('je u nizu ubojstava!', 'is on a killing spree!')], 4: ['😤', L('DOMINIRA!', 'is DOMINATING!')], 5: ['💪', L('MEGA ubojstvo!', 'gets a MEGA KILL!')], 6: ['⚡', L('je NEZAUSTAVLJIV!', 'is UNSTOPPABLE!')],
        7: ['🤯', L('je NEVJEROJATAN!', 'is INCREDIBLE!')], 8: ['👹', L('je ČUDOVIŠTE!', 'is a MONSTER!')], 9: ['🌟', L('je BOŽANSKI!', 'is GODLIKE!')] };
      const MULTI_VO = { 2: 'double_kill', 3: 'triple_kill', 4: 'ultra_kill', 5: 'rampage' };   // 📣 najavljivač
      const STREAK_VO = { 3: 'killing_spree', 4: 'dominating', 5: 'mega_kill', 6: 'unstoppable', 7: 'incredible', 8: 'monster_kill', 9: 'godlike' };
      const mk = MULTI[Math.min(5, credit.multiN)];
      const st = credit.streak >= 10 ? ['👑', L('je IZNAD BOŽANSKOG!', 'is BEYOND GODLIKE!')] : STREAK[credit.streak];
      if(mk && credit.multiN >= 2){ announce(mk, who + (st ? ' ' + st[1] : ''), 1 - credit.team); annEvent(MULTI_VO[Math.min(5, credit.multiN)]); milestoneAnn = true; }
      else if(st){ announce(st[0] + ' ' + who + ' ' + st[1], L(credit.streak + ' ubojstava zaredom!', credit.streak + ' kills in a row!'), 1 - credit.team); annEvent(credit.streak >= 10 ? 'beyond_godlike' : STREAK_VO[credit.streak]); milestoneAnn = true; }
      // 🛑 prekinut niz: ubojica dobiva dodatno zlato za tuđi niz
      if(victimStreak >= 3){
        const bonus = CFG.shutdownGold * (victimStreak - 1);
        credit.gold += bonus;
        feedMsg(L('🛑 ' + who + ' je prekinuo niz od ' + victimStreak + ' (' + t.emoji + ' ' + t.name + ') +' + bonus + ' 💰', '🛑 ' + who + ' ended a ' + victimStreak + '-kill streak (' + t.emoji + ' ' + t.name + ') +' + bonus + ' 💰'), TEAM_COLOR[credit.team]);
        annEvent('shutdown');
        if(isHuman(credit)) addFloat(credit.x, credit.y - 30, L('🛑 Prekinut niz! +' + bonus + ' 💰', '🛑 Shutdown! +' + bonus + ' 💰'), '#fde047', 16, credit.team);
      }
    }
    else if(src && src.kind === 'creep') killerName = L('⚔️ Vojnici', '⚔️ Creeps');
    else if(src && src.kind === 'neutral') killerName = src.emoji + ' ' + src.name;
    if(isHuman(t)) t.recap = buildRecap(t, killerName);   // 💀 pregled pogibije
    // 💰 Ucjena (Track): smrt označenog donosi dodatno zlato ubojici i Tragaču
    if(wasTracked){
      if(credit){
        credit.gold += trackBonusVal;
        if(isHuman(credit)) addFloat(credit.x, credit.y, L('+' + trackBonusVal + ' 💰 ucjena!', '+' + trackBonusVal + ' 💰 bounty!'), '#fde047', 16, credit.team);
      }
      if(trackerRef && trackerRef.kind === 'hero' && !trackerRef.removeMe && trackerRef !== credit && trackerRef.team !== t.team){
        trackerRef.gold += trackBonusVal;
        if(isHuman(trackerRef)) addFloat(trackerRef.x, trackerRef.y, L('+' + trackBonusVal + ' 💰 ucjena!', '+' + trackBonusVal + ' 💰 bounty!'), '#fde047', 16, trackerRef.team);
      }
      feedMsg(L('💰 Ucjena naplaćena za ' + t.emoji + ' ' + t.name + '!', '💰 Bounty claimed on ' + t.emoji + ' ' + t.name + '!'), '#fde047');
    }
    // 🎯 v0.54 bogata meta (protiv snowballa, kao ucjena u LoL-u): junak puno bogatiji od prosjeka svih junaka
    //   nosi nagradu — pola dobiva ubojica, a drugu polovicu dijele suigrači koji su pomogli (bez njih sve ubojici)
    const richPool = credit ? richBounty(t) : 0;
    // 🔵🔴 buffovi džungle prelaze na ubojicu (kao u LoL-u)
    if(t.jbuff){
      for(const k of ['blue', 'red']) if(t.jbuff[k] > 0){ if(credit) giveJungleBuff(credit, k, Math.max(30, t.jbuff[k])); t.jbuff[k] = 0; }
    }
    // asistencije (kao u DotA): suigrači koji su udarili metu u zadnjih 10 s ili su bili blizu — i malo zlata
    if(credit){
      const helpers = [];
      for(const h of units){
        if(h.kind !== 'hero' || h === credit || h.team !== credit.team || h.removeMe) continue;
        const hit = t.hitBy && gameTime - (t.hitBy[h.id] || -99) < 10;
        if(hit || (!h.dead && dist(h, t) < CFG.assistRange)){
          h.assists++;
          h.gold += CFG.assistGold;
          helpers.push(h);
          if(isHuman(h)) addFloat(h.x, h.y, L('🤝 Asistencija +' + CFG.assistGold + ' 💰', '🤝 Assist +' + CFG.assistGold + ' 💰'), '#a7f3d0', 15, h.team);
        }
      }
      if(comebackPool > 0){   // 🔄 povratak: jednako ubojici i pomagačima
        const part = Math.round(comebackPool / (helpers.length + 1));
        for(const h of [credit].concat(helpers)){
          h.gold += part;
          if(isHuman(h)) addFloat(h.x, h.y - 40, L('🔄 Povratak! +' + part + ' 💰', '🔄 Comeback! +' + part + ' 💰'), '#a7f3d0', 15, h.team);
        }
      }
      if(richPool > 0){   // 🎯 bogata meta: podjela nagrade
        const share = helpers.length ? Math.round(richPool / 2 / helpers.length) : 0;
        const mine = richPool - share * helpers.length;
        credit.gold += mine;
        if(isHuman(credit)) addFloat(credit.x, credit.y - 52, L('🎯 Bogata meta! +' + mine + ' 💰', '🎯 Rich target! +' + mine + ' 💰'), '#fde047', 16, credit.team);
        for(const h of helpers){
          h.gold += share;
          if(isHuman(h)) addFloat(h.x, h.y - 26, L('🎯 Bogata meta +' + share + ' 💰', '🎯 Rich target +' + share + ' 💰'), '#fde047', 14, h.team);
        }
        feedMsg(L('🎯 ' + t.emoji + ' ' + t.name + ' je bio bogata meta — tim je dobio +' + richPool + ' 💰', '🎯 ' + t.emoji + ' ' + t.name + ' was a rich target — the team got +' + richPool + ' 💰'), TEAM_COLOR[credit.team]);
      }
    }
    t.hitBy = {};
    src = credit || src;   // za "Bravo!" najavu i sfx ispod
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h !== src && !h.dead && dist(h, t) < CFG.xpRadius)
        giveXp(h, 70);
    }
    feedMsg(killerName + '  ⚔️  ' + t.emoji + ' ' + t.name, TEAM_COLOR[1 - t.team]);
    if(!firstBlood){ firstBlood = true; announce(L('🩸 Prva krv!', '🩸 First Blood!'), killerName, t.team); annEvent('first_blood'); if(src && src.kind === 'hero') src.firstBlood = true; }
    // 💀 ACE (kao u LoL-u): pao je cijeli tim
    else if(units.filter(h => h.kind === 'hero' && h.team === t.team).every(h => h.dead)){
      announce(CYR ? '💀 ЕЈС!' : '💀 ACE!', L('Cijeli tim ' + TEAM_NAME[t.team] + ' je pao — sada guraj!', 'All of Team ' + TEAM_NAME[t.team] + ' fell — push now!'), t.team);
      annEvent('ace');
      feedMsg(L((CYR ? '💀 ЕЈС! ' : '💀 ACE! ') + 'Tim ' + TEAM_NAME[t.team] + ' je pao', '💀 ACE! Team ' + TEAM_NAME[t.team] + ' fell'), TEAM_COLOR[1 - t.team]);
      milestoneAnn = true;
    }
    // osobne najave (i za gosta u mrežnoj igri — svatko vidi samo svoje)
    if(src && isHuman(src) && !milestoneAnn) announceFor(src, L('Bravo! 🎉', 'Well done! 🎉'), L('Pobijedio si ' + t.emoji + ' ' + t.name + '!', 'You defeated ' + t.emoji + ' ' + t.name + '!'), 'gold');
    if(src && src.kind === 'hero'){   // 🪙 3D: zlatnici polete od pobijeđenog do pobjednika (i kod gosta)
      src.killFxN = (src.killFxN || 0) + 1; src.killAt = { x: Math.round(t.x), y: Math.round(t.y) };
      if(src.isPlayer && net.mode !== 'host' && net.mode !== 'guest') slowMo = 0.5;   // ⏱️ tren usporenja (samo protiv botova)
    }
    if(isHuman(t)) announceFor(t, L('Ne brini! ⏳', "Don't worry! ⏳"), '', 'red');   // odbrojavanje do oživljavanja je odmah ispod (HUD)
    if(t.isPlayer) sfx('death');
    else if(src && src.isPlayer) sfx('kill');
    else sfxAt('kill', t.x, t.y);
  }
  else if(t.kind === 'tower'){
    t.removeMe = true;
    if(src && src.kind === 'hero' && src.team !== t.team) src.towerKills = (src.towerKills || 0) + 1;   // 🏆 Rušitelj
    histEvent('tower', 1 - t.team);
    if(player && !player.dead && player.team !== t.team && dist(player, t) < 1600) player.qTower = true;   // 🎯 pomogao srušiti kulu
    burst(t.x, t.y, '#fbbf24', 30, 300, 8);
    burst(t.x, t.y, '#94a3b8', 20, 200, 7);
    const denied = !!(src && src.team === t.team);   // ⛔ uskraćena kula: protivnik dobiva pola zlata
    if(denied){
      feedMsg(L('⛔ ' + (src.emoji || '') + ' ' + (src.name || '') + ' je uskratio svoj toranj!', '⛔ ' + (src.emoji || '') + ' ' + (src.name || '') + ' denied their own tower!'), TEAM_COLOR[t.team]);
      announce(L('⛔ Toranj uskraćen!', '⛔ Tower denied!'), L('Tim ' + TEAM_NAME[1 - t.team] + ' dobiva samo pola zlata', 'Team ' + TEAM_NAME[1 - t.team] + ' gets only half the gold'));
      annEvent('tower_denied');
      if(src.kind === 'hero') src.denies++;
    } else {
      feedMsg(L('🏰 Srušen toranj tima ' + TEAM_NAME[t.team] + '!', '🏰 Team ' + TEAM_NAME[t.team] + ' lost a tower!'), TEAM_COLOR[1 - t.team]);
      announce(L('🏰 BUM!', '🏰 BOOM!'), L('Toranj tima ' + TEAM_NAME[t.team] + ' je srušen!', 'Team ' + TEAM_NAME[t.team] + "'s tower is destroyed!"), t.team);
      annEvent('tower', t.team);
    }
    const tg = Math.round(CFG.towerGoldTeam * (denied ? 0.5 : 1));
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h.team !== TEAM_NEUTRAL){
        h.gold += tg;
        if(isHuman(h)) addFloat(h.x, h.y, '+' + tg + ' 💰', '#fde047', 15, h.team);
        if(!h.dead && dist(h, t) < 800) giveXp(h, CFG.towerXp * (denied ? 0.5 : 1));
      }
    }
    if(t.isGuard){
      const stillGuarded = units.some(x => x.kind === 'tower' && x.isGuard && x.team === t.team && !x.removeMe && x !== t);
      if(!stillGuarded && ancients[t.team]){
        ancients[t.team].invuln = false;
        announce(L('⚠️ Prijestol tima ' + TEAM_NAME[t.team] + ' je ranjiv!', '⚠️ Team ' + TEAM_NAME[t.team] + "'s throne is vulnerable!"), L('Napadnite ga!', 'Attack it!'), t.team);
        annEvent('throne', t.team);
      }
    }
    if(t.lane && t.tier < 3){   // 🏰 v0.56: pala T1 → T2 te staze je ranjiva, pala T2 → T3
      for(const n of units) if(n.kind === 'tower' && n.team === t.team && n.lane === t.lane && n.tier === t.tier + 1 && !n.removeMe) n.invuln = false;
    }
    if(t.tier === 3 && t.lane){   // pala T3 (ulaz u bazu) → vojarna te staze i T4 uz prijestol su ranjive
      for(const b of units){
        if(b.kind === 'barracks' && b.team === t.team && b.lane === t.lane && !b.removeMe){
          b.invuln = false;
          feedMsg(L('🏚️ Vojarna tima ' + TEAM_NAME[t.team] + ' (' + LANE_NAME[t.lane] + ') je ranjiva!', '🏚️ Team ' + TEAM_NAME[t.team] + "'s barracks (" + LANE_NAME[t.lane] + ') are vulnerable!'), '#fde047');
        }
        if(b.kind === 'tower' && b.isGuard && b.team === t.team && !b.removeMe) b.invuln = false;
      }
    }
    sfxAt('tower', t.x, t.y);
  }
  else if(t.kind === 'barracks'){
    t.removeMe = true;
    histEvent('rax', 1 - t.team);
    burst(t.x, t.y, '#fbbf24', 30, 300, 8);
    burst(t.x, t.y, '#a16207', 20, 200, 7);
    const enemy = 1 - t.team;
    superCreeps[enemy][t.lane] = true;
    barracksRespawn.push({ team: t.team, lane: t.lane, x: t.x, y: t.y, t: CFG.barracksRespawn });
    const all = LANE_LIST.every(l => superCreeps[enemy][l]);
    feedMsg(L('🏚️ Srušena vojarna tima ' + TEAM_NAME[t.team] + ' (' + LANE_NAME[t.lane] + ')!', '🏚️ Team ' + TEAM_NAME[t.team] + "'s barracks (" + LANE_NAME[t.lane] + ') destroyed!'), TEAM_COLOR[enemy]);
    announce(all ? L('💪💪 MEGA VOJNICI!', '💪💪 MEGA CREEPS!') : L('💪 Super vojnici!', '💪 Super creeps!'),
      L('Vojnici tima ' + TEAM_NAME[enemy] + ' na stazi ' + LANE_NAME[t.lane] + ' su sada jači!', 'Team ' + TEAM_NAME[enemy] + "'s creeps in the " + LANE_NAME[t.lane] + ' lane are now stronger!'), t.team);
    annEvent('barracks', t.team);
    for(const h of units){
      if(h.kind === 'hero' && h.team === enemy){
        h.gold += CFG.barracksGoldTeam;
        if(isHuman(h)) addFloat(h.x, h.y, '+' + CFG.barracksGoldTeam + ' 💰', '#fde047', 15, h.team);
      }
    }
    sfxAt('tower', t.x, t.y);
  }
  else if(t.kind === 'ancient'){
    t.removeMe = true;
    burst(t.x, t.y, '#fde047', 60, 400, 10);
    endGame(1 - t.team);
  }
}

/* ================= Levelovanje i poeni vještina ================= */
function giveXp(h, amt){
  if(h.level >= CFG.maxLevel) return;
  h.xp += amt;
  while(h.level < CFG.maxLevel && h.xp >= xpNeed(h.level)){
    h.xp -= xpNeed(h.level);
    levelUp(h);
  }
}
function levelUp(h){
  h.level++;
  const a = h.hero.attrs;
  h.str += a.strG;
  h.agi += a.agiG;
  h.int += a.intG;
  recomputeAttrStats(h);
  h.skillPoints++;
  addFloat(h.x, h.y, LS('LEVEL ') + h.level + '! ⬆️', '#fde047', 18);
  burst(h.x, h.y, '#fde047', 18, 200, 6);
  if(h.bot){
    botSpendPoints(h);
    const pt = pendingTalent(h);
    if(pt) chooseTalent(h, pt.lvl, Math.random() < 0.55 ? 'a' : 'b');
  }
  if(isHuman(h)){   // i gost u mrežnoj igri dobiva svoje najave
    if(h.isPlayer) sfx('levelup');
    if(h.level === CFG.ultLevels[0]) announceFor(h, L('🌟 ULTI dostupan!', '🌟 ULTIMATE ready!'), L('Pritisni R ili klikni + da ga naučiš!', 'Press R or click + to learn it!'), 'gold');
    if(pendingTalent(h) && !(h.isPlayer && VH < 520)) announceFor(h, LS('🎓 Talent!'),   // 📱 na mobitelu ploča talenata sama to kaže
      L('Odaberi jedan od dva bonusa (gumbi gore)', 'Pick one of two bonuses (buttons at the top)'), 'gold');
  }
}

// ATRIBUTI (kao u DotA): 💪 snaga = život, 🤸 okretnost = brzina i brzina
// napada, 🧠 inteligencija = mana i jače moći (CFG.intSpellAmp); GLAVNI atribut junaku daje štetu.
function recomputeAttrStats(h){
  const a = h.hero.attrs, ia = h.itemAttr || { str: 0, agi: 0, int: 0 };
  const dStr = h.str + ia.str - a.str, dAgi = h.agi + ia.agi - a.agi, dInt = h.int + ia.int - a.int;
  const prim = a.primary === 'str' ? dStr : (a.primary === 'agi' ? dAgi : dInt);
  const nb = {
    hp: Math.round(dStr * CFG.strHp),
    hpRegen: dStr * 0.07,
    mp: Math.round(dInt * 13),
    mpRegen: dInt * 0.06,
    speed: dAgi * CFG.agiSpeed,
    dmg: Math.round(prim * 1.2),
  };
  const ob = h.attrBonus;
  h.dmg += nb.dmg - ob.dmg;
  h.maxhp += nb.hp - ob.hp;
  h.hp = clamp(h.hp + Math.max(0, nb.hp - ob.hp), 1, h.maxhp);
  h.maxmp += nb.mp - ob.mp;
  h.mp = clamp(h.mp + Math.max(0, nb.mp - ob.mp), 0, h.maxmp);
  h.speed += nb.speed - ob.speed;
  h.hpRegen += nb.hpRegen - ob.hpRegen;
  h.mpRegen += nb.mpRegen - ob.mpRegen;
  h.attrBonus = nb;
  h.atkSpdBonus = dAgi * CFG.agiAtkSpd + (h.itemAspd || 0) / 100;
  h.armor = (h.agi + ia.agi) / CFG.agiArmorDiv + (h.itemArmor || 0) + 3 * drakeN(h.team, 'forest') + (h.talArmor || 0);   // okretnost daje malo oklopa; 🌿 šumski zmajčići; 🎓 talent
}
function canLearnStats(h){
  return h.statRanks < CFG.statMaxRanks;
}
function learnStats(h){
  if(h.skillPoints <= 0 || !canLearnStats(h)) return false;
  h.skillPoints--;
  h.statRanks++;
  h.str += CFG.statPerPoint;
  h.agi += CFG.statPerPoint;
  h.int += CFG.statPerPoint;
  recomputeAttrStats(h);
  if(isHuman(h)){
    addFloat(h.x, h.y, L('📊 +2 svi atributi! (' + h.statRanks + '/' + CFG.statMaxRanks + ')', '📊 +2 all attributes! (' + h.statRanks + '/' + CFG.statMaxRanks + ')'), '#a7f3d0', 15);
    if(h.isPlayer) sfx('buy');
  }
  return true;
}

function abilityMaxRank(ab){ return ab.def.ult ? 3 : 4; }   // Q/W/E po 4 ranga, ulti 3 (12 + 3 + 10 statsa = 25 levela)
function canLearn(h, i){
  const ab = h.abilities[i];
  if(!ab) return false;
  if(ab.rank >= abilityMaxRank(ab)) return false;
  if(ab.def.ult && h.level < CFG.ultLevels[ab.rank]) return false;
  if(!ab.def.ult && h.level < ab.rank * 2 + 1) return false;   // rang 2 od levela 3, rang 3 od 5, rang 4 od 7
  return true;
}
function learnAbility(h, i){
  if(h.skillPoints <= 0 || !canLearn(h, i)) return false;
  const ab = h.abilities[i];
  h.skillPoints--;
  ab.rank++;
  if(ab.def.onLearn) ab.def.onLearn(h, ab.rank);   // 🎖️ pasivni ulti (Majstorica luka): +okretnost
  if(isHuman(h)){
    addFloat(h.x, h.y, ab.def.emoji + ' ' + ab.def.name + L(' — rang ', ' — rank ') + ab.rank + '!', '#a7f3d0', 15);
    if(h.isPlayer) sfx('buy');
  }
  return true;
}
function botSpendPoints(h){
  let guard = 0;
  while(h.skillPoints > 0 && guard++ < 20){
    let idx = -1;
    if(canLearn(h, 3)) idx = 3;
    else {
      let bs = -1;
      for(let i = 0; i < 3; i++){
        if(!canLearn(h, i)) continue;
        const score = (5 - h.abilities[i].rank) * 10 - i * 3;
        if(score > bs){ bs = score; idx = i; }
      }
    }
    if(idx >= 0){ learnAbility(h, idx); continue; }
    if(canLearnStats(h)){ learnStats(h); continue; }   // višak poena ide u atribute
    break;
  }
}

/* ================= Moći ================= */
function spawnSkillshot(u, aim, o){
  let dx = aim.x - u.x, dy = aim.y - u.y;
  let L = Math.hypot(dx, dy);
  if(L < 1){ dx = Math.cos(u.dir || 0); dy = Math.sin(u.dir || 0); L = 1; }
  projectiles.push({
    id: nextId++,
    kind: 'skill', x: u.x, y: u.y,
    vx: dx / L * o.speed, vy: dy / L * o.speed,
    speed: o.speed, r: o.r, range: o.range, traveled: 0,
    dmg: o.dmg, src: u, team: u.team,
    color: o.color, emoji: o.emoji || null,
    pierce: !!o.pierce, slow: o.slow || null, hitIds: o.hitIds || {},   // v0.55: zajednički hitIds = val strijela pogodi svakoga samo jednom
    passCreeps: !!o.passCreeps,   // 🌠 v0.56: prolazi kroz vojnike (rani ih), staje na prvom junaku / čudovištu
    model: o.model || null, scale: o.scale || 0,   // 3D model projektila mimo emojija (Sveta strijela = velika strijela)
    onHitFn: o.onHit || null,
    abKey: abCtx && abCtx.src === u ? abCtx.key : null,   // 🎓 talenti moći djeluju i kad projektil pogodi kasnije
  });
  return true;
}
function spawnHoming(src, target, o){
  projectiles.push({
    id: nextId++,
    kind: 'homing', x: o.x != null ? o.x : src.x, y: o.y != null ? o.y : src.y, target,
    sx: o.x != null ? o.x : src.x, sy: o.y != null ? o.y : src.y,
    speed: o.speed, dmg: o.dmg, src, team: src.team,
    color: o.color || '#fff', emoji: o.emoji || null, r: o.r || 6,
    onHit: o.onHit || null, miss: !!o.miss,
    shot: o.shot || null,   // 3D model projektila (arrow/fire/ice/leaf/feather/bolt/tower)
    atk: !!o.atk,           // običan napad (oklop / blok / krađa života), ne magija
    crit: !!o.crit, big: !!o.big,   // 💥 kritični hitac / veliki hitac (3D: veći projektil, jači trag)
    abKey: !o.atk && abCtx && abCtx.src === src ? abCtx.key : null,
  });
}
function spawnZone(u, aim, o){
  const p = clampRange(u, aim, o.castRange || 600);
  zones.push({
    id: nextId++,
    x: p.x, y: p.y, r: o.r, team: u.team, src: u,
    delay: o.delay || 0.5, ticksLeft: o.ticks || 1, interval: o.interval || 0.7,
    dmg: o.dmg, slow: o.slow || null, root: o.root || 0, stun: o.stun || 0, poison: o.poison || null, silence: o.silence || 0,
    t: 0, tickT: 0, started: false,
    color: o.color || '#fff', emoji: o.emoji || '✨',
    abKey: abCtx && abCtx.src === u ? abCtx.key : null,
  });
  return true;
}
function damageCircle(u, x, y, r, dmg, o){
  o = o || {};
  ring(x, y, r, o.color || '#fff');
  for(const e of units){
    if(e.team === u.team || e.dead || e.removeMe || e.invuln) continue;
    if(!isSpellTarget(e)) continue;
    if(distXY(x, y, e.x, e.y) <= r + e.r * 0.5){
      applyDamage(e, dmg, u);
      if(o.slow) applySlow(e, o.slow.f, o.slow.t);
      if(o.stun) applyStun(e, o.stun);
      if(o.root) applyRoot(e, o.root);
      if(o.silence) applySilence(e, o.silence);
      if(o.poison) applyPoison(e, o.poison.dps, o.poison.t, u);
    }
  }
  return true;
}
function lineDamage(u, x1, y1, x2, y2, halfW, dmg){
  for(const e of units){
    if(e.team === u.team || e.dead || e.removeMe || e.invuln) continue;
    if(!isSpellTarget(e)) continue;
    if(distToSeg(e.x, e.y, x1, y1, x2, y2) <= halfW + e.r) applyDamage(e, dmg, u);
  }
}
function chainLightning(u, o){
  let cur = nearestEnemyOf(u, o.range, e => e.kind === 'hero') ||
            nearestEnemyOf(u, o.range, e => e.kind === 'creep' || e.kind === 'neutral');
  if(!cur) return false;
  let prev = u, n = 0;
  const hitIds = {};
  while(cur && n < o.max){
    addLine(prev.x, prev.y, cur.x, cur.y, '#fde047', 5, 0.25);
    addLine(prev.x, prev.y, cur.x, cur.y, '#ffffff', 2, 0.25);
    applyDamage(cur, o.dmg, u);
    burst(cur.x, cur.y, '#fde047', 8, 140, 4);
    hitIds[cur.id] = true;
    n++;
    prev = cur;
    let next = null, bd = o.jump;
    for(const e of units){
      if(e.team === u.team || e.dead || e.removeMe || e.invuln) continue;
      if(!isSpellTarget(e)) continue;
      if(e.kind === 'hero' && e.status.invisT > 0) continue;
      if(hitIds[e.id]) continue;
      const d = dist(prev, e);
      if(d < bd){ bd = d; next = e; }
    }
    cur = next;
  }
  sfxAt('zap', u.x, u.y);
  return true;
}
function leapTo(u, aim, maxR){
  const p = clampRange(u, aim, maxR);
  const steps = 6;
  for(let i = 0; i <= steps; i++){
    const t = i / steps;
    burst(lerp(u.x, p.x, t), lerp(u.y, p.y, t), '#fff', 2, 60, 4);
  }
  u.x = clamp(p.x, 40, WORLD - 40);
  u.y = clamp(p.y, 40, WORLD - 40);
  u.moveTarget = null;
}

function giveJungleBuff(h, k, dur){
  if(!h || h.kind !== 'hero' || !h.jbuff) return;
  h.jbuff[k] = Math.max(h.jbuff[k], dur);
  const b = JUNGLE_BUFFS[k];
  addFloat(h.x, h.y - 20, b.emoji + ' ' + b.name + '!', b.color, 16);
  feedMsg(L(b.emoji + ' ' + h.emoji + ' ' + h.name + ' ima ' + b.name.toLowerCase() + '!', b.emoji + ' ' + h.emoji + ' ' + h.name + ' has the ' + b.name.toLowerCase() + '!'), b.color, h.team);   // samo njegov tim
}
/* 🐉 tim je ubio zmajčića: trajni bonus za sve junake tima */
function takeDrake(src, el){
  const team = src.team, d = DRAKES[el];
  teamDrakes[team].push(el);
  for(const h of units){
    if(h.kind !== 'hero' || h.team !== team) continue;
    if(!h.dead) addFloat(h.x, h.y - 30, d.emoji + ' ' + d.desc, d.color, 14);
    if(el === 'forest') recomputeAttrStats(h);   // oklop se računa u statistici junaka
  }
  const n = drakeN(team, el);
  feedMsg(L('🐉 ' + (src.emoji || '') + ' ' + (src.name || '') + ' — tim ' + TEAM_NAME[team] + ' je ubio ' + d.acc + '!', '🐉 ' + (src.emoji || '') + ' ' + (src.name || '') + ' — Team ' + TEAM_NAME[team] + ' killed the ' + d.name + '!'), d.color);
  announce(d.emoji + ' ' + d.name + (n > 1 ? ' ×' + n : '') + '!', L('Tim ' + TEAM_NAME[team] + ' zauvijek dobiva: ' + d.desc, 'Team ' + TEAM_NAME[team] + ' gets forever: ' + d.desc), 1 - team);
  annEvent('drake', team);
  if(team === myTeam) sfx('levelup');
}
/* ✨ čarolija prizivača (D / F) — kao u League of Legends */
function summonerTarget(h, aim, range, ok){
  let best = null, bd = 260;
  for(const e of units){
    if(e.dead || e.removeMe || e.invuln || e.team === h.team || !ok(e) || dist(h, e) > range + 60) continue;
    const d = distXY(aim.x, aim.y, e.x, e.y);
    if(d < bd){ bd = d; best = e; }
  }
  return best;
}
function castSummoner(h, slot, aim){
  if(!h || h.dead || gameOver || !h.summoners) return false;
  const sp = SUMMONER_BY_ID[h.summoners[slot]];
  if(!sp) return false;
  if(h.sumCd[slot] > 0){ if(isHuman(h)) addFloat(h.x, h.y, sp.emoji + L(' još ', ' ready in ') + Math.ceil(h.sumCd[slot]) + ' s', '#e5e7eb', 13, h.team); return false; }
  if(h.status.stun > 0 || h.cycloneT > 0) return false;
  aim = aim || { x: h.x + Math.cos(h.dir || 0) * 200, y: h.y + Math.sin(h.dir || 0) * 200 };
  const lv = h.level;
  switch(sp.id){
    case 'flash': {
      const p = clampRange(h, aim, sp.range);
      h.x = clamp(p.x, 40, WORLD - 40); h.y = clamp(p.y, 40, WORLD - 40);
      h.moveTarget = null; h.windup = null;
      break;
    }
    case 'heal': {
      const amt = 90 + 20 * lv;
      heal(h, amt); applyHaste(h, 1.3, 1);
      let ally = null;
      for(const e of units) if(e.kind === 'hero' && e !== h && e.team === h.team && !e.dead && dist(h, e) <= 700 && (!ally || e.hp / e.maxhp < ally.hp / ally.maxhp)) ally = e;
      if(ally){ heal(ally, amt); applyHaste(ally, 1.3, 1); }
      ring(h.x, h.y, 700, '#4ade80');
      break;
    }
    case 'ignite': {
      const t = summonerTarget(h, aim, sp.range, e => e.kind === 'hero');
      if(!t){ if(isHuman(h)) addFloat(h.x, h.y, L('🔥 Klikni na neprijateljskog junaka', '🔥 Click an enemy hero'), '#e5e7eb', 13, h.team); return false; }
      applyDot(t, (70 + 20 * lv) / 5, 5, h); t.gwT = 5;
      addFloat(t.x, t.y, L('🔥 Zapaljen!', '🔥 Ignited!'), '#fb923c', 15);
      break;
    }
    case 'ghost': applyHaste(h, 1.35, 10); break;
    case 'barrier': h.barrierHp = 110 + 25 * lv; h.barrierT = 2.5; break;
    case 'exhaust': {
      const t = summonerTarget(h, aim, sp.range, e => e.kind === 'hero');
      if(!t){ if(isHuman(h)) addFloat(h.x, h.y, L('🐌 Klikni na neprijateljskog junaka', '🐌 Click an enemy hero'), '#e5e7eb', 13, h.team); return false; }
      applySlow(t, 0.3, 3); if(t.status.immuneT <= 0) t.weakT = 3;
      addFloat(t.x, t.y, L('🐌 Iscrpljen!', '🐌 Exhausted!'), '#d4d4d4', 15);
      break;
    }
    case 'smite': {
      const t = summonerTarget(h, aim, sp.range, e => e.kind === 'neutral' || e.kind === 'creep');
      if(!t){ if(isHuman(h)) addFloat(h.x, h.y, L('🌩️ Klikni na čudovište ili vojnika', '🌩️ Click a monster or creep'), '#e5e7eb', 13, h.team); return false; }
      h.smiteAt = { x: t.x, y: t.y };
      applyDamage(t, 450 + 20 * lv, h);
      break;
    }
  }
  h.sumCd[slot] = sp.cd;
  h.sumFx = sp.id; h.sumN = (h.sumN || 0) + 1;   // 3D: efekt (bez animacije čaranja)
  h.sumAim = { x: aim.x, y: aim.y };
  sfxAt(sp.id === 'flash' ? 'zap' : 'cast', h.x, h.y);
  return true;
}
function pressSummoner(slot, quick){
  if(!player || player.dead || gameOver || !player.summoners) return;
  const sp = SUMMONER_BY_ID[player.summoners[slot]];
  if(!sp) return;
  if(player.sumCd[slot] > 0){ addFloat(player.x, player.y, sp.emoji + L(' još ', ' ready in ') + Math.ceil(player.sumCd[slot]) + ' s', '#e5e7eb', 13); sfx('click'); return; }
  if(sp.target){   // s ciljem: kao moći — prvo pokaži domet, klik baca
    if(pendingCast && pendingCast.sum === slot){ castPending(aimPoint()); return; }
    pendingCast = { sum: slot, i: -1, quick: !!quick };
    return;
  }
  if(net.mode === 'guest') netSum(slot, null); else castSummoner(player, slot, null);
}
/* botovi: jednostavna pravila za čarolije prizivača */
function botUseSummoners(u, eh){
  if(!u.summoners) return;
  const dEh = eh ? dist(u, eh) : 1e9, hpF = u.hp / u.maxhp;
  u.summoners.forEach((id, slot) => {
    if(u.sumCd[slot] > 0) return;
    const f = FOUNTAIN[u.team];
    switch(id){
      case 'flash': if(eh && dEh < 350 && hpF < 0.22) castSummoner(u, slot, stepToward(u, f, 500)); break;
      case 'heal': if(hpF < 0.3 && eh && dEh < 700) castSummoner(u, slot); break;
      case 'barrier': if(hpF < 0.28 && eh && dEh < 500) castSummoner(u, slot); break;
      case 'ghost': if(u.bot.state === 'retreat' && eh && dEh < 700) castSummoner(u, slot); break;
      case 'ignite': if(eh && dEh < 560 && eh.hp < eh.maxhp * 0.3) castSummoner(u, slot, { x: eh.x, y: eh.y }); break;
      case 'exhaust': if(eh && dEh < 600 && (hpF < 0.5 || eh.hp < eh.maxhp * 0.35)) castSummoner(u, slot, { x: eh.x, y: eh.y }); break;
      case 'smite': {
        const m = nearestEnemyOf(u, 480, e => e.kind === 'neutral' && e.hp < 450 + 20 * u.level && (e.maxhp > 600 || u.hp < u.maxhp * 0.5));   // 🌩️ ne troši je na malo čudovište
        if(m) castSummoner(u, slot, { x: m.x, y: m.y });
        break;
      }
    }
  });
}
/* 🩸🪖 aure predmeta (Vučji stijeg, Generalov oklop, Okrugli štitić, Iscjeliteljske čarape): računaju se jednom po otkucaju za sve junake */
function updateItemAuras(){
  const heroes = units.filter(u => u.kind === 'hero');
  for(const h of heroes){ h.auraArmor = 0; h.auraAspd = 0; h.auraLs = 0; h.auraMp = 0; }
  for(const src of heroes){
    if(src.dead || !src.ifx || !src.ifx.aura || !src.ifx.aura.length) continue;
    for(const a of src.ifx.aura) for(const h of heroes){
      if(h.dead || h.team !== src.team || dist(h, src) > a.r) continue;
      h.auraArmor = Math.max(h.auraArmor, a.armor || 0);
      h.auraAspd = Math.max(h.auraAspd, a.aspd || 0);
      h.auraLs = Math.max(h.auraLs, a.ls || 0);
      h.auraMp = Math.max(h.auraMp, a.mpRegen || 0);
    }
  }
}
/* 🎇 Iskričavi štapić: puni se kad neprijateljski junak u blizini baci magiju */
function chargeWands(caster){
  for(const h of units){
    if(h.kind !== 'hero' || h.team === caster.team || h.dead || !h.ifx || !h.ifx.wand || dist(h, caster) > 1200) continue;
    h.itemCharges.wand = Math.min(20, itemCharges(h, 'wand') + 1);
  }
}
function castAbility(u, i, aim){
  if(!u || u.dead || gameOver) return;
  // GOST: vlastite moći šalje domaćinu na izvršenje
  if(net.mode === 'guest' && u === player){
    const abG = u.abilities[i];
    if(!abG) return;
    if(abG.rank <= 0){
      if(u.skillPoints > 0) netLearn(i);
      else addFloat(u.x, u.y, L('🔒 Treba ti poen vještine!', '🔒 You need a skill point!'), '#e5e7eb', 13);
      return;
    }
    if(abG.def.passive){ addFloat(u.x, u.y, L('✨ Pasivna moć — radi sama!', '✨ Passive ability — works by itself!'), '#e5e7eb', 13); return; }
    if(abG.cd > 0){ sfx('click'); return; }
    if(u.mp < abMana(u, abG)){ addFloat(u.x, u.y, L('Nema mane! 💧', 'Not enough mana! 💧'), '#7dd3fc', 14); return; }
    netCast(i, aim || { x: u.x + 200, y: u.y });
    return;
  }
  const ab = u.abilities[i];
  if(!ab) return;
  u.danceT = 0;                            // 💃 i ples
  if(u.tpChannel > 0) cancelTeleport(u);   // bacanje moći prekida teleport
  if(u.status.invisT > 0 && !ab.def.passive) u.status.invisT = 0;   // i nevidljivost
  if(ab.def.passive && ab.rank > 0){
    if(isHuman(u)) addFloat(u.x, u.y, L('✨ Pasivna moć — radi sama!', '✨ Passive ability — works by itself!'), '#e5e7eb', 13, u.team);
    return;
  }
  if(ab.rank <= 0){
    if(isHuman(u)){
      if(u.skillPoints > 0 && canLearn(u, i)) learnAbility(u, i);
      else if(ab.def.ult && u.level < CFG.ultLevels[0])
        addFloat(u.x, u.y, L('🔒 Ulti od levela ' + CFG.ultLevels[0] + '!', '🔒 Ult unlocks at level ' + CFG.ultLevels[0] + '!'), '#e5e7eb', 14);
      else
        addFloat(u.x, u.y, L('🔒 Treba ti poen vještine (level up)!', '🔒 You need a skill point (level up)!'), '#e5e7eb', 13);
    }
    return;
  }
  if(ab.cd > 0){ if(u.isPlayer) sfx('click'); return; }
  if(u.status.stun > 0) return;
  if(u.status.silenceT > 0){ if(isHuman(u)) addFloat(u.x, u.y, L('🤐 Ušutkan!', '🤐 Silenced!'), '#e5e7eb', 13, u.team); return; }
  if(u.mp < abMana(u, ab)){
    if(isHuman(u)) addFloat(u.x, u.y, L('Nema mane! 💧', 'Not enough mana! 💧'), '#7dd3fc', 14, u.team);
    return;
  }
  if(u.chan) cancelChannel(u);   // nova moć prekida nišanjenje
  u.curAb = ab.def;   // 💀 za pregled pogibije: šteta tijekom bacanja ide na ovu moć
  abCtx = { src: u, key: ab.def.key };   // 🎓 talenti ove moći
  const ok = ab.def.cast(u, aim || { x: u.x + Math.cos(u.dir || 0) * 200, y: u.y + Math.sin(u.dir || 0) * 200 }, ab.rank);
  abCtx = null;
  u.curAb = null;
  if(ok !== false){ u.lastAb = ab.def; u.lastAbT = gameTime; }   // projektili i zone koji stignu kasnije
  if(ok === false){
    if(isHuman(u)) addFloat(u.x, u.y, L('Nema mete! 🤔', 'No target! 🤔'), '#e5e7eb', 13, u.team);
    return;
  }
  u.mp -= abMana(u, ab);
  if(u.isPlayer) u.qCasts = (u.qCasts || 0) + 1;   // 🎯 zadaci
  ab.cd = Math.max(0.5, ab.def.cd * (1 - Math.min(0.5, (u.cdr || 0) + (u.itemCdr || 0)) - (u.jbuff && u.jbuff.blue > 0 ? 0.15 : 0)) + abBonus(u, ab.def.key, 'cd'));   // 🎓 talent / ⚛️ Čarobna jezgra / 🔵 plavi buff: kraće hlađenje
  if(u.cullRefresh){ ab.cd = 0; u.cullRefresh = false; }   // 🪓 Smrtni udarac: pobjeda nad junakom = ulti odmah spreman
  if(u.windup){ u.windup = null; u.atkTimer = 0; }   // čaranje prekida zamah — napad nije potrošen
  u.castAim = aim ? { x: aim.x, y: aim.y } : null;   // 3D: efekt na mjestu cilja
  chargeWands(u);
  u.castFx = u.hero.id + ':' + ab.def.key;   // 3D: efekt moći (scene3d.js)
  u.castN = (u.castN || 0) + 1;              // 3D: animacija čaranja
  noteCombat(u);
  if(aim && (Math.abs(aim.x - u.x) + Math.abs(aim.y - u.y) > 4)) u.dir = Math.atan2(aim.y - u.y, aim.x - u.x);
  sfxAt(ab.def.ult ? 'ult' : 'cast', u.x, u.y);
}

/* ================= Otkup (buyback) ================= */
function buybackCost(h){ return CFG.buybackBase + h.level * CFG.buybackPerLvl; }
function buyback(h){
  if(!h || !h.dead || gameOver) return;
  const cost = buybackCost(h);
  if(h.buybackCd > 0){ if(isHuman(h)) addFloat(h.x, h.y, L('⏱️ Otkup se još puni!', '⏱️ Buyback is recharging!'), '#e5e7eb', 13, h.team); return; }
  if(h.gold < cost){ if(isHuman(h)) addFloat(h.x, h.y, L('Nemaš dovoljno zlata za otkup! 💰', 'Not enough gold for buyback! 💰'), '#fca5a5', 13, h.team); return; }
  h.gold -= cost;
  h.buybackCd = CFG.buybackCd;
  h.reviveAt = null;
  respawn(h);
  feedMsg(L('💰 ' + h.emoji + ' ' + h.name + ' se otkupio!', '💰 ' + h.emoji + ' ' + h.name + ' bought back!'), TEAM_COLOR[h.team]);
  if(isHuman(h)){ if(h.isPlayer) sfx('buy'); announceFor(h, null); }   // makni "Ne brini!"
}

/* ================= Aktivni predmeti (klik ili tipke 1–6) ================= */
function useItem(h, idx, aim){
  if(!h || h.dead || gameOver) return false;
  const it = h.items[idx];
  if(!it || !it.active) return false;
  const cd = h.itemCd[it.id] || 0;
  if(cd > 0){ if(isHuman(h)) addFloat(h.x, h.y, L(it.emoji + ' još se puni (' + Math.ceil(cd) + ' s)', it.emoji + ' recharging (' + Math.ceil(cd) + ' s)'), '#e5e7eb', 13, h.team); return false; }
  if(h.status.stun > 0) return false;
  if(h.mp < it.active.mana){ if(isHuman(h)) addFloat(h.x, h.y, L('Nema mane! 💧', 'Not enough mana! 💧'), '#7dd3fc', 14, h.team); return false; }
  if((it.active.target === 'point' || it.active.target === 'tree') && !aim) return false;
  const ok = it.active.use(h, aim);
  if(ok === false) return false;
  h.mp -= it.active.mana;
  h.itemCd[it.id] = it.active.cd;
  h.castFx = 'item:' + it.id;
  u_castAnim(h);
  if(h.isPlayer) sfx('cast');
  if(it.consume && itemCharges(h, it.id) <= 0){   // potrošni predmet: nestaje iz torbe
    const k = h.items.indexOf(it);
    if(k >= 0){ h.items.splice(k, 1); recomputeItemStats(h); delete h.itemCharges[it.id]; refreshShop(); }
  }
  return true;
}
function u_castAnim(h){ h.castN = (h.castN || 0) + 1; }
/* 🌳 predmet koji cilja DRVO (tango, sjekirica): stablo kod klika; ako je predaleko, junak prvo dođe do njega */
function treeForUse(h, aim, range, emoji){
  const t = aim ? nearestTree(aim.x, aim.y, 190) : null;
  if(!t){ if(isHuman(h)) addFloat(h.x, h.y, emoji + L(' Klikni na drvo!', ' Click a tree!'), '#e5e7eb', 13, h.team); return null; }
  if(dist(h, t) > range + t.r + h.r){
    const it = h.items.find(i => i.active && i.active.target === 'tree' && (emoji === '🌿' ? i.id === 'tango' : i.id !== 'tango'));
    if(it){ h.useOrder = { id: it.id, tree: t, range }; h.attackTarget = null; h.moveTarget = null; }
    return null;
  }
  return t;
}
// igrač: predmet s ciljem prvo pokazuje domet (kao moći), ostali se odmah koriste
function pressItem(i, quick){
  if(!player || player.dead || gameOver) return;
  const it = player.items[i];
  if(!it || !it.active) return;
  if(it.active.target === 'point' || it.active.target === 'tree'){
    if(pendingCast && pendingCast.item === i){ castPending(aimPoint()); return; }
    if((player.itemCd[it.id] || 0) > 0){ sfx('click'); return; }
    pendingCast = { item: i, i: -1, quick: !!quick };
    sfx('click');
  } else {
    if(net.mode === 'guest') netItem(i, null);
    else useItem(player, i, null);
    pendingCast = null;
  }
}
/* 🌀 T: prvo pritisni pa klikni svoju kulu / vojarnu (ili minimapu); opet T (ili klik u bazi) = kući */
function pressTeleport(){
  if(!player || player.dead || gameOver || player.tpChannel > 0) return;
  if(player.tpCd > 0){ startTeleport(player); return; }   // poruka "još se puni"
  if(pendingCast && pendingCast.tp){ pendingCast = null; doTeleport(null); return; }
  pendingCast = { tp: true, i: -1 };
  sfx('click');
}
function doTeleport(aim){
  if(net.mode === 'guest') netTp(aim);
  else startTeleport(player, aim ? tpDestAt(player, aim.x, aim.y) : null);
}
// izvrši ono što čeka klik na cilj (moć ili predmet)
function castPending(aim){
  if(!pendingCast) return;
  aim = assistAim(player, pendingAbDef(), aim);   // 🎯 i klikom (na tlo blizu junaka)
  if(pendingCast.tp){ const a = aim; pendingCast = null; doTeleport(a); return; }
  if(pendingCast.sum != null){
    if(net.mode === 'guest') netSum(pendingCast.sum, aim);
    else castSummoner(player, pendingCast.sum, aim);
  } else if(pendingCast.item != null){
    if(net.mode === 'guest') netItem(pendingCast.item, aim);
    else useItem(player, pendingCast.item, aim);
  } else castAbility(player, pendingCast.i, aim);
  pendingCast = null;
}

/* ================= Teleport kući (T) ================= */
/* 🌀 v0.38: teleport kući ILI do vlastite kule / vojarne / prijestola (kao TP svitak u DotA) — na većoj mapi
   brže se stiže u obranu; dest = građevina (ili null = fontana) */
function tpDestAt(h, x, y){
  let best = null, bd = 650;
  for(const u of units){
    if(!isStructure(u) || u.team !== h.team || u.removeMe || u.dead) continue;
    const d = distXY(x, y, u.x, u.y); if(d < bd){ bd = d; best = u; }
  }
  return distXY(x, y, FOUNTAIN[h.team].x, FOUNTAIN[h.team].y) < 700 ? null : best;
}
function startTeleport(h, dest){
  if(!h || h.dead || gameOver || h.tpChannel > 0) return;
  if(h.tpCd > 0){
    if(isHuman(h)){ addFloat(h.x, h.y, L('Teleport se još puni! ⏱️', 'Teleport is recharging! ⏱️'), '#e5e7eb', 13, h.team); if(h.isPlayer) sfx('click'); }
    return;
  }
  if(dest && (dest.team !== h.team || !isStructure(dest) || dest.removeMe)) dest = null;
  if(!dest && distXY(h.x, h.y, FOUNTAIN[h.team].x, FOUNTAIN[h.team].y) < 400){
    if(isHuman(h)) addFloat(h.x, h.y, L('Već si kod kuće! 🏠', 'You are already home! 🏠'), '#e5e7eb', 13, h.team);
    return;
  }
  if(dest && dist(h, dest) < 700){ if(isHuman(h)) addFloat(h.x, h.y, L('Već si tu! 🏰', 'You are already there! 🏰'), '#e5e7eb', 13, h.team); return; }
  h.tpDest = dest || null;
  h.tpChannel = dest ? 3.5 : 3;
  h.tpDur = h.tpChannel;
  if(dest && h.team === myTeam && isHuman(h)) addFloat(dest.x, dest.y, L('🌀 ' + h.name + ' stiže!', '🌀 ' + h.name + ' is coming!'), '#93c5fd', 14, h.team);
  h.moveTarget = null;
  h.attackTarget = null;
  ring(h.x, h.y, 90, '#60a5fa');
  if(h.isPlayer) sfx('cast');
}
function cancelTeleport(h){
  if(h && h.tpChannel > 0){
    h.tpChannel = 0; h.tpDest = null;
    if(isHuman(h)) addFloat(h.x, h.y, L('Teleport prekinut! ❌', 'Teleport canceled! ❌'), '#fca5a5', 13, h.team);
  }
}

/* ================= Pasivne moći ================= */
/* urođena pasiva (odvojena od Q/W/E/R): rang 1 → 4 na levelima 1 / 7 / 13 / 19 */
function innateRank(h){ return Math.min(4, 1 + Math.floor((h.level - 1) / 6)) + (h.talPas || 0); }   // 🎓 talent: +1 rang (do 5)
function passiveRank(h, pid){
  if(h.kind !== 'hero' || !h.hero.passive || h.hero.passive.pid !== pid) return 0;
  return innateRank(h);
}

/* 🖱️ kamo cilja miš: na jedinicu pod mišem (njeno mjesto na tlu) ili na točku na tlu ispod miša;
   v0.56: dok ciljaš strijelom / kuglom, pomoć pri ciljanju (assistAim) */
function aimPoint(){
  const raw = hoverUnit && !hoverUnit.dead && !hoverUnit.removeMe ? { x: hoverUnit.x, y: hoverUnit.y } : { x: mouse.wx, y: mouse.wy };
  return assistAim(player, pendingAbDef(), raw);
}
function pendingAbDef(){   // moć koja čeka klik na cilj (ne predmet ni čarolija)
  if(!pendingCast || pendingCast.i == null || pendingCast.i < 0 || !player) return null;
  const ab = player.abilities[pendingCast.i];
  return ab ? ab.def : null;
}
/* 🎯 v0.56 pomoć pri ciljanju: strijela, kugla ili udica uperena u neprijatelja ili BLIZU neprijateljskog junaka
   (do 1,5 širine hica) pogodi njega — i gađa malo ispred ako hoda (kao botovi, leadAim). Djeca ne moraju sama
   pogađati kamo će junak otići; na tlu se meta vidi po krugu u boji moći (scene3d.js syncCastIndicator). */
function assistTarget(u, def, raw){
  if(!u || !def || !def.line || !def.lineFull) return null;
  const hu = hoverUnit;
  if(hu && hu.team !== u.team && !hu.dead && !hu.removeMe && isSpellTarget(hu) && canAttackTarget(u, hu) && !(def.passCreeps && hu.kind === 'creep')) return hu;
  let best = null, bd = Math.max(80, (def.lineW || 50) * 1.5);
  for(const e of units){
    if(e.kind !== 'hero' || e.team === u.team || e.dead || e.removeMe || !canAttackTarget(u, e)) continue;
    if(dist(u, e) > (def.castRange || 800) + 80) continue;
    const d = distXY(raw.x, raw.y, e.x, e.y);
    if(d < bd){ bd = d; best = e; }
  }
  return best;
}
function assistAim(u, def, raw){
  const t = assistTarget(u, def, raw);
  if(!t) return raw;
  return def.shotSpeed ? leadAim(u, t, def.shotSpeed) : { x: t.x, y: t.y };
}
// igračev tok: moći s ciljem prvo pokažu domet, pa se klikom baca (ili otpuštanjem tipke kod brzog bacanja)
function pressAbility(i, aimInstant, quick){
  if(!player || player.dead || gameOver) return;
  const ab = player.abilities[i];
  if(!ab) return;
  if(ab.rank <= 0){ castAbility(player, i, null); return; }
  if(ab.def.target === 'point'){
    if(pendingCast && pendingCast.item == null && pendingCast.sum == null && pendingCast.i === i){
      castAbility(player, i, aimInstant || aimPoint());
      pendingCast = null;
      return;
    }
    if(ab.cd > 0){ sfx('click'); return; }
    if(player.mp < abMana(player, ab)){
      addFloat(player.x, player.y, L('Nema mane! 💧', 'Not enough mana! 💧'), '#7dd3fc', 14);
      return;
    }
    pendingCast = { i, quick: !!quick };
    sfx('click');
  } else if(quick && ab.def.selfAoe && ab.cd <= 0 && player.mp >= abMana(player, ab) && !ab.def.passive){
    pendingCast = { i, quick: true };   // brzo bacanje: dok držiš tipku vidiš krug djelovanja, otpuštanje baca
  } else {
    castAbility(player, i, aimInstant || aimPoint());
    pendingCast = null;
  }
}

/* ================= Kretanje ================= */
function unitSpeed(u){
  let s = u.speed;
  const st = u.status;
  if(u.kind === 'hero') s *= CFG.heroMoveMul;   // 🐢 v0.46: junaci sporiji (kao u DotA 2 — mapa se ne pretrči u tren)
  if(st.slowT > 0) s *= (1 - st.slowF);
  if(st.hasteT > 0) s *= st.hasteF;
  const noc = passiveRank(u, 'noc');
  if(noc && isNight) s *= 1.15 + 0.08 * noc;
  const voda = passiveRank(u, 'voda');       // Vodozemac (Skokica): brža u rijeci
  if(voda && inRiver(u.x, u.y)) s *= 1.15 + 0.1 * voda;
  if(u.kind === 'hero'){ const sd = drakeN(u.team, 'storm'); if(sd) s *= 1 + 0.05 * sd; }   // ⚡ olujni zmajčići
  if(u.kind === 'hero' && u.hero.id === 'bikos' && units.some(e => e.hungerT > 0 && e.hungerSrc === u && !e.dead)) s *= 1.1;   // 🍖 Ratna glad
  if(u.kind === 'hero' && u.travel) s *= u.travel === 2 ? CFG.homeGuardSpeed : CFG.travelSpeed;   // 💨 putovanje izvan borbe
  return s;
}
/* 💨 putovanje (veća mapa za 5 na 5 — manje dosadnog hodanja):
   izvan borbe (6 s bez udaraca u junake i građevine) +15 % brzine; od fontane "vjetar doma" +40 % dok ne uđeš u borbu —
   v0.46: vjetar doma puše samo na POČETKU igre (prvi izlazak iz baze), poslije oživljavanja i povratka kući više ne */
function noteCombat(u){ if(u && u.kind === 'hero'){ u.combatT = gameTime; u.homeGuardT = 0; } }
function updateTravel(u, dt){
  const atHome = distXY(u.x, u.y, FOUNTAIN[u.team].x, FOUNTAIN[u.team].y) < 650;
  if(atHome && !u.windUsed) u.homeGuardT = CFG.homeGuardT;
  else if(u.homeGuardT > 0) u.homeGuardT -= dt;
  if(!atHome && gameTime >= 0) u.windUsed = true;   // izašao je iz baze nakon roga — vjetra više nema
  const calm = gameTime - (u.combatT == null ? -99 : u.combatT) > CFG.travelCalm;
  u.travel = u.status.slowT > 0 || u.status.rootT > 0 ? 0 : (u.homeGuardT > 0 ? 2 : (calm ? 1 : 0));
}
function moveToward(u, tx, ty, dt){
  const st = u.status;
  if(st.stun > 0 || st.rootT > 0) return false;
  const dx = tx - u.x, dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if(d < 5) return true;
  const s = unitSpeed(u) * dt;
  const k = Math.min(1, s / d);
  u.x += dx * k;
  u.y += dy * k;
  u.lastMoveT = gameTime;
  if(Math.abs(dx) > 2) u.face = dx < 0 ? -1 : 1;
  u.dir = Math.atan2(dy, dx);
  return d - s <= 5;
}

function separation(){
  for(let i = 0; i < units.length; i++){
    const a = units[i];
    if(a.dead || a.removeMe) continue;
    for(let j = i + 1; j < units.length; j++){
      const b = units[j];
      if(b.dead || b.removeMe) continue;
      if(a.isStatic && b.isStatic) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if(d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      if(a.isStatic){ b.x += nx * push * 2; b.y += ny * push * 2; }
      else if(b.isStatic){ a.x -= nx * push * 2; a.y -= ny * push * 2; }
      else { a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
    }
    if(!a.isStatic) forTreesNear(a.x, a.y, a.r + 30, tr => {
      const dx = a.x - tr.x, dy = a.y - tr.y;
      const rr = a.r + tr.r;
      const d2 = dx * dx + dy * dy;
      if(d2 >= rr * rr || d2 === 0) return;
      const d = Math.sqrt(d2);
      a.x = tr.x + dx / d * rr;
      a.y = tr.y + dy / d * rr;
    });
    a.x = clamp(a.x, a.r, WORLD - a.r);
    a.y = clamp(a.y, a.r, WORLD - a.r);
  }
}

/* ================= Borba ================= */
function performAttack(u, t){
  if(u.status.disarmT > 0){   // ⚜️ Gardijska helebarda: razoružan ne može udarati
    u.atkTimer = 0.25;
    if(isHuman(u) && gameTime - (u.disarmMsgT || -9) > 1.5){ u.disarmMsgT = gameTime; addFloat(u.x, u.y - 20, L('⚜️ Razoružan!', '⚜️ Disarmed!'), '#fde68a', 13, u.team); }
    return;
  }
  const copor = passiveRank(u, 'copor');       // Čopor: brži napad
  const raging = u.status.rageT > 0;           // Bijes: +40% brzine napada
  u.atkTimer = u.atkCd / (u.status.hasteT > 0 ? u.status.hasteF : 1) / (1 + (u.atkSpdBonus || 0) + 0.12 * copor + (raging ? 0.4 : 0) + (u.aspdT > 0 ? u.aspdF : 0) + (u.talAspd || 0) + (u.auraAspd || 0) / 100);
  u.atkN = (u.atkN || 0) + 1;   // 3D: animacija napada
  u.atkInt = u.atkTimer;        // 3D: animacija se ubrzava s brzinom napada
  if(Math.abs(t.x - u.x) > 2) u.face = t.x < u.x ? -1 : 1;
  u.dir = Math.atan2(t.y - u.y, t.x - u.x);
  // napad iz sjene (Tragač): bonus PRIJE nego nevidljivost pukne
  let shadowBonus = 0;
  if(u.status.invisT > 0){
    const sj = passiveRank(u, 'sjena');
    if(sj) shadowBonus = 40 + 30 * sj;
    if(u.sbBonus) shadowBonus += u.sbBonus;   // 🌒 Nevidljivi bodež
    u.sbBonus = 0;
    u.status.invisT = 0;   // napad prekida nevidljivost
  }
  // AGGRO (kao u DotA): napadneš li junaka — kula i njegovi vojnici okreću se na tebe
  if(u.kind === 'hero' && t.kind === 'hero') drawAggro(u, t);
  let dmg = u.dmg;
  if(u.kind === 'tower'){   // 🗼 v0.38: kula rano jako udara junake + "zagrijavanje" na isti cilj (kao u LoL-u)
    if(t.kind === 'hero'){
      u.heat = u.heatTgt === t ? Math.min(CFG.towerHeatMax, (u.heat || 0) + CFG.towerHeat) : 0;
      u.heatTgt = t;
      dmg *= towerHeroMul() * (1 + u.heat);
    } else { u.heat = 0; u.heatTgt = null; }
  }
  if(shadowBonus) dmg += shadowBonus;
  if(u.howlT > 0) dmg += u.howlDmg;            // Zavijanje: tim udara jače
  const noc = passiveRank(u, 'noc');          // Noćna ptica: noću jača
  if(noc && isNight) dmg += 12 + 10 * noc;
  const pero = passiveRank(u, 'pero');        // Gavranovo pero: krađa mane
  let peroProc = false;
  if(pero && t.kind === 'hero' && Math.random() < 0.25){ dmg += 15 + 10 * pero; peroProc = true; }
  const kombo = passiveRank(u, 'kombo');      // Kombo: svaki 3. udarac
  let komboHit = false;
  if(kombo){
    u.comboN = (u.comboN || 0) + 1;
    if(u.comboN >= 3){ u.comboN = 0; dmg += 30 + 25 * kombo; komboHit = true; }
  }
  // Lukavi udarac (Tragač W): podmukli proc
  let jinProc = false;
  const jin = passiveRank(u, 'jinada');
  if(jin && Math.random() < 0.15 + 0.05 * jin){ dmg += 25 + 25 * jin; jinProc = true; }
  if(u.status.dmgMulT > 0) dmg *= u.status.dmgMulF;
  if(u.weakT > 0) dmg *= 0.6;                  // 🐌 Iscrpljenost
  let clawProc = false;                        // Divlje kandže (Sivko E)
  if(u.clawHits > 0){ dmg += u.clawDmg; u.clawHits--; clawProc = true; }
  const krv = passiveRank(u, 'krv');           // Miris krvi (Zubo): jače po ranjenima
  if(krv && t.hp < t.maxhp * 0.5 && !isStructure(t)) dmg *= 1 + 0.12 + 0.12 * krv;
  const hsr = passiveRank(u, 'headshot');      // 🎯 Pogodak u glavu (Nišan)
  const hsProc = !!(hsr && !isStructure(t) && Math.random() < 0.20 + 0.04 * hsr);
  if(hsProc) dmg += 16 + 16 * hsr;
  if(u.precT > 0 && u.projSpeed > 0) dmg *= 1 + u.precF;   // 🎯 Aura preciznosti (Inja, v0.55)
  const frost = u.frostT > 0 && !isStructure(t);            // ❄️ Ledene strijele
  if(frost) dmg += u.frostDmg;
  const mk = u.kind === 'hero' && u.hero.id === 'irbis' && u.abilities[3] ? u.abilities[3].rank : 0;   // 🎖️ Majstorica luka
  const mkProc = !!(mk && !isStructure(t) && Math.random() < 0.2 + 0.05 * mk &&
    (hasTal(u, 'irbis_r_always') || !units.some(e => e.kind === 'hero' && e.team !== u.team && !e.dead && dist(u, e) < 400)));
  const zalac = passiveRank(u, 'zalac');       // 🧪 Otrovni prasak (Škorpo)
  // pasivne moći napadača
  let crit = false;
  const oko = passiveRank(u, 'oko');                 // Oštro oko: kritični pogodak
  let critM = oko && Math.random() < 0.15 ? 1.25 + 0.25 * oko : 1;
  const ifx = u.ifx || {};
  for(const c of ifx.crit || []) if(Math.random() < c.c) critM = Math.max(critM, c.m);   // 💥 Kristalni nož / Dedal: najjači krit
  if(critM > 1){ dmg *= critM; crit = true; }
  if(ifx.creepDmg && (t.kind === 'creep' || t.kind === 'neutral')) dmg += ifx.creepDmg * (u.projSpeed > 0 ? 0.5 : 1);   // ⛏️ Drvosječina sjekirica
  if(ifx.hunt && t.kind === 'neutral') dmg += ifx.hunt.dmg * (u.projSpeed > 0 ? 0.7 : 1);                              // 🐾 Lovački nož
  // 🔨 Kameni malj: tresak (najviše jednom u 2 s)
  const bashProc = !!(ifx.bash && gameTime >= (u.bashT || 0) && t.kind !== 'tower' && Math.random() < (u.projSpeed > 0 ? ifx.bash.cr : ifx.bash.c));
  if(bashProc) u.bashT = gameTime + 2;
  const mkbProc = !!(ifx.proc && Math.random() < ifx.proc.c);
  const dodir = passiveRank(u, 'dodir');             // Ledeni dodir: usporenje na napad
  const naboj = passiveRank(u, 'naboj');             // Statički naboj: munja na napad
  const onHitFx = (tt) => {
    if(ifx.hunt && tt.kind === 'neutral') heal(u, ifx.hunt.heal);   // 🐾 udarac po čudovištu liječi
    if(raging && tt.kind !== 'tower') applyStun(tt, u.status.rageStun || 0.3);
    if(u.stunHit && u.atkN % 3 === 0 && tt.kind !== 'tower'){ applyStun(tt, 0.6); addFloat(tt.x, tt.y, L('🗿 Tresak!', '🗿 Bash!'), '#cbd5e1', 14); }   // Golem
    if(peroProc && tt.maxmp){
      const m = Math.min(tt.mp, 20 + 15 * pero);
      tt.mp -= m; u.mp = Math.min(u.maxmp, u.mp + m);
      addFloat(tt.x, tt.y, '🪶 −' + Math.round(m) + ' 💧', '#c4b5fd', 14);
    }
    const sluz = passiveRank(tt, 'sluz');     // Sluzava koža (Pipko E): napadač se oklizne
    if(sluz && !u.dead && u.kind !== 'tower') applySlow(u, 0.15 + 0.05 * sluz, 1.5);
    if(komboHit){ heal(u, 15 + 10 * kombo); addFloat(tt.x, tt.y, L('👊 Kombo!', '👊 Combo!'), '#fde047', 15); }
    if(u.frenzyT > 0 && !isStructure(tt)) heal(u, dmg * u.frenzyF);   // 😤 Pomama: ugriz liječi
    if(clawProc && !isStructure(tt)){ applySlow(tt, 0.3, 1.5); addFloat(tt.x, tt.y, '💢', '#fca5a5', 15); }
    const zar = passiveRank(u, 'zar');         // Vatrena krv (Žarko): napadi pale
    if(zar && !isStructure(tt)) applyDot(tt, 6 + 6 * zar, 2, u);
    const mj = passiveRank(u, 'mjesec');       // Mjesečeva oštrica (Luna): odskok na drugog neprijatelja
    if(mj){
      let b2 = null, bd = 320;
      for(const e of units){
        if(e === tt || e.team === u.team || e.dead || e.removeMe || e.invuln || isStructure(e) || !isTargetable(e)) continue;
        const d = dist(tt, e); if(d < bd){ bd = d; b2 = e; }
      }
      if(b2){ applyDamage(b2, dmg * (0.25 + 0.1 * mj), u); addLine(tt.x, tt.y, b2.x, b2.y, '#c4b5fd', 4, 0.25); }
    }
    if(shadowBonus) addFloat(tt.x, tt.y, L('Iz sjene! 👤', 'From the shadows! 👤'), '#c4b5fd', 15);
    if(hsProc && !tt.dead){ applyStun(tt, 0.15); knockback(tt, u.x, u.y, 36); addFloat(tt.x, tt.y, L('🎯 U glavu!', '🎯 Headshot!'), '#fde047', 15); }
    if(jinProc){ applySlow(tt, 0.3, 1.5); addFloat(tt.x, tt.y, '💢', '#fb923c', 15); }
    if(dodir) applySlow(tt, 0.1 + 0.05 * dodir, 1.5);
    if(frost) applySlow(tt, u.frostSlow, 1.5);
    if(mkProc && !tt.dead){ applyDamage(tt, 30 + 25 * mk, u); addFloat(tt.x, tt.y - 10, '🎖️', '#7dd3fc', 16); }
    if(zalac) applyCaustic(tt, u);
    if(u.jbuff && u.jbuff.red > 0 && !isStructure(tt)){ applyDot(tt, 8 + u.level, 3, u); applySlow(tt, 0.15, 1.5); }   // 🔴 crveni buff
    // ---- predmeti ----
    if(bashProc && !tt.dead && !isStructure(tt)){ applyStun(tt, ifx.bash.t); applyDamage(tt, ifx.bash.dmg, u); addFloat(tt.x, tt.y, L('🔨 Tresak!', '🔨 Bash!'), '#e5e7eb', 15); }
    if(mkbProc && !tt.dead) applyDamage(tt, ifx.proc.dmg, u);                     // 🐒 čarobna šteta
    if(ifx.cold && !isStructure(tt)) applySlow(tt, ifx.cold.f, ifx.cold.t);       // 🧊 Ledeno srce
    if(ifx.mburn && tt.maxmp > 0 && tt.mp > 0 && !tt.dead){                       // 🪀 Oštrica ispijanja: pali manu
      const b = Math.min(tt.mp, ifx.mburn.mp * (u.projSpeed > 0 ? 0.6 : 1));
      tt.mp -= b; applyDamage(tt, b * ifx.mburn.f, u, true);
    }
    if(ifx.chain && !isStructure(tt) && Math.random() < ifx.chain.c) itemChain(u, tt, ifx.chain);   // ⛈️ munja u lancu
    if(ifx.corrupt){ tt.corruptT = ifx.corrupt.t; tt.corruptA = ifx.corrupt.a; }  // 🌘 skida oklop
    if(ifx.cleave && !u.projSpeed){                                               // 🪓 zamah po svima oko mete
      for(const e of units){
        if(e === tt || e.team === u.team || e.dead || e.removeMe || e.invuln || isStructure(e) || !isSpellTarget(e)) continue;
        if(dist(tt, e) <= 220) applyDamage(e, dmg * ifx.cleave, u);
      }
      if(Math.random() < 0.5) ring(tt.x, tt.y, 220, '#fca5a5');
    }
    if(naboj && Math.random() < 0.15 + 0.05 * naboj){
      applyDamage(tt, 30 + 25 * naboj, u);
      addLine(u.x, u.y, tt.x, tt.y, '#fde047', 4, 0.2);
      sfxAt('zap', u.x, u.y);
    }
  };
  // pucanje uzbrdo zna promašiti — visinska prednost kao u DotA!
  const ts = !!ifx.trueStrike;   // 🐒 Nepromašivi štap: nikad ne promašuje
  const miss = (!ts && (groundHeight(t.x, t.y) - groundHeight(u.x, u.y) > 25) && Math.random() < CFG.uphillMissChance) ||
    (u.status.blindT > 0 && Math.random() < u.status.blindF) ||   // 😵 tinta / vrtoglavica
    (!ts && t.dodgeT > 0 && Math.random() < t.dodgeF) ||          // 🥴 Pijani korak
    (!ts && (t.evasion > 0 || t.talEva > 0) && Math.random() < 1 - (1 - (t.evasion || 0)) * (1 - (t.talEva || 0)));   // 🦋 Plesna krila / 🎓 talent: izbjegavanje
  u.atkHeavy = crit || komboHit || jinProc || clawProc || shadowBonus > 0 || bashProc || hsProc || mkProc;   // 3D: jači zamah (attack2)
  u.atkCrit = crit && !miss;   // 3D: bljesak oružja prije kritičnog udarca
  // kao u DotA: zamah traje do "kadra udarca" animacije, tek tada šteta / projektil (kula puca odmah)
  const wind = u.kind === 'tower' ? 0 : ATK_POINT / Math.max(1, ATK_ANIM_LEN / u.atkTimer);
  const deliver = () => releaseAttack(u, t, dmg, miss, onHitFx, crit);
  if(wind > 0) u.windup = { t: gameTime + wind, target: t, deliver };
  else deliver();
}
/* ⛈️ v0.56 munja u lancu (Olujni čekić, Gromovnik): pogodi metu, pa skače na najbliže neprijatelje koje još nije pogodila */
function itemChain(u, first, ch){
  const hit = new Set();
  let cur = first, px = u.x, py = u.y;
  for(let k = 0; k < ch.n && cur; k++){
    hit.add(cur);
    addLine(px, py, cur.x, cur.y, '#fde047', 3, 0.22);
    applyDamage(cur, ch.dmg, u, true);
    px = cur.x; py = cur.y;
    let nx = null, nd = ch.r;
    for(const e of units){
      if(hit.has(e) || e.team === u.team || e.dead || e.removeMe || e.invuln || isStructure(e) || !isSpellTarget(e)) continue;
      if(e.kind === 'hero' && !isVisibleTo(u.team, e)) continue;
      const d = distXY(px, py, e.x, e.y); if(d < nd){ nd = d; nx = e; }
    }
    cur = nx;
  }
  sfxAt('zap', first.x, first.y, 0.6);
}
const ATK_POINT = 7 / 24;      // udarac je u 7. kadru animacije napada (24 kadra/s)
const ATK_ANIM_LEN = 0.62;     // ispod ovog razmaka napada animacija se ubrzava
function releaseAttack(u, t, dmg, miss, onHitFx, crit){
  if(u.dead || u.removeMe || !isTargetable(t)) return;
  if(u.attackOnce){ u.attackOnce = false; u.attackTarget = null; u.hold = true; }   // 🪙 A + klik: samo ovaj udarac
  if(dist(u, t) > u.atkRange + t.r + 160) return;   // meta pobjegla tijekom zamaha: promašaj u zrak
  if(u.projSpeed > 0){
    const off = u.kind === 'hero' && u.hero.shot === 'pellet' ? 58 : (u.r || 16) * 0.8 + 8;   // strijela / kugla polijeće iz ruke (metak iz cijevi puške) ispred junaka, ne iz sredine tijela
    spawnHoming(u, t, {
      x: u.x + Math.cos(u.dir || 0) * off, y: u.y + Math.sin(u.dir || 0) * off,
      speed: u.projSpeed, dmg, miss, atk: true, crit: crit && !miss,
      onHit: miss ? null : onHitFx,
      color: u.kind === 'tower' ? '#fbbf24' : TEAM_LIGHT[u.team],
      r: u.kind === 'tower' ? 9 : 6,
      shot: u.kind === 'tower' ? 'tower' : (u.kind === 'hero' ? (u.frostT > 0 ? 'ice' : (u.hero.shot || 'bolt')) : 'bolt'),
    });
    sfxAt(u.kind === 'hero' ? 'pew' : 'pewc', u.x, u.y, u.kind === 'hero' ? 1 : 0.35);
  } else {
    if(miss){
      if(isHuman(u) || isHuman(t))
        addFloat(t.x, t.y, L('Promašaj! 💨', 'Miss! 💨'), '#e5e7eb', 13, undefined, null, [u, t].filter(isHuman).map(x => x.id));
    } else {
      hitCrit = !!crit;
      applyDamage(t, dmg, u, 'atk');
      hitCrit = false;
      onHitFx(t);
      const deb = passiveRank(t, 'debela');   // Debela koža (Tutnjo E): vraća štetu izbliza
      if(deb && !u.dead && !u.removeMe && u.kind !== 'tower') applyDamage(u, 14 + 10 * deb, t);
    }
    if(u.kind === 'hero' || t.kind === 'hero') sfxAt('hit', u.x, u.y);
    else sfxAt('hitc', u.x, u.y, 0.35);   // vojnici se tuku tiše (inače stalno lupa)
  }
}

/* ================= AI: vojnici (DotA aggro pravila) =================
   - Acquisition: melee 500 / ranged 600 / siege 800 (siege voli kule).
   - Prioritet: neprijateljski VOJNICI > kule > junaci (junake samo izbliza).
   - Kad ih junak povuče (aggro), ganjaju ga 2.3 s pa se vraćaju vojnicima. */
function creepThink(u){
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > 700 ||
     (u.attackTarget.kind === 'neutral' && !neutralActive(u.attackTarget))) u.attackTarget = null;   // čudovište se vratilo u kamp
  // 🐗 v0.46: razljućena čudovišta (povučeni kamp) napadaju se kao neprijateljski vojnici
  // isteklo prisilno ganjanje junaka? vrati se vojnicima/kulama ako ih ima
  if(u.attackTarget && u.attackTarget.kind === 'hero' && gameTime > (u.aggroT || 0)){
    const c = nearestEnemyOf(u, 470, e => e.kind === 'creep') ||
              nearestEnemyOf(u, 470, e => isStructure(e));
    if(c) u.attackTarget = c;
  }
  if(!u.attackTarget){
    const acq = u.siege ? 800 : (u.rangedCreep ? 600 : 500);
    if(u.siege){
      // siege vojnici prvo ruše građevine (kao u DotA!)
      u.attackTarget =
        nearestEnemyOf(u, acq, e => isStructure(e)) ||
        nearestEnemyOf(u, 500, e => e.kind === 'creep' || neutralActive(e)) ||
        nearestEnemyOf(u, 260, e => e.kind === 'hero');
    } else {
      u.attackTarget =
        nearestEnemyOf(u, acq, e => e.kind === 'creep' || neutralActive(e)) ||
        nearestEnemyOf(u, 470, e => isStructure(e)) ||
        nearestEnemyOf(u, CFG.creepHeroAcq, e => e.kind === 'hero');   // v0.38: kao u DotA — bez drugih meta i junake do 500
    }
  }
  if(!u.attackTarget){
    const wps = u.path;
    if(u.wpIndex < wps.length){
      const wp = wps[u.wpIndex];
      if(distXY(u.x, u.y, wp[0], wp[1]) < 70 && u.wpIndex < wps.length - 1) u.wpIndex++;
      const cur = wps[u.wpIndex];
      u.moveTarget = { x: cur[0], y: cur[1] };
    } else {
      u.moveTarget = { x: ANCIENT_POS[1 - u.team].x, y: ANCIENT_POS[1 - u.team].y };
    }
  }
}

function isStructure(e){ return e.kind === 'tower' || e.kind === 'ancient' || e.kind === 'barracks'; }
/* ⚔️ DotA aggro: napad ILI NAREDBA napada na neprijateljskog junaka — kula (ako si u njenom dometu) i njegovi
   vojnici u 500 oko tebe okreću se na tebe (vojnici 2.3 s, pa 3 s pauze) */
function drawAggro(u, t){
  if(!u || !t || u.kind !== 'hero' || t.kind !== 'hero' || u.team === t.team || t.team === TEAM_NEUTRAL) return;
  for(const tw of units){
    if(tw.kind !== 'tower' || tw.team !== t.team || tw.removeMe) continue;
    if(dist(tw, u) <= tw.atkRange + u.r + 40){
      if(tw.attackTarget !== u){ tw.attackTarget = u; tw.atkTimer = Math.min(tw.atkTimer, 0.3); }
      if(isHuman(u) && tw.warnedTgt !== u) addFloat(u.x, u.y, L('⚠️ Toranj te gađa!', '⚠️ The tower is shooting you!'), '#fca5a5', 15, u.team);
      tw.warnedTgt = u;
    }
  }
  for(const cr of units){
    if(cr.kind !== 'creep' || cr.summonOf || cr.team !== t.team || cr.dead || cr.removeMe) continue;
    if(gameTime < (cr.aggroCdT || 0)) continue;
    if(dist(cr, u) < CFG.creepAggroRange){
      cr.attackTarget = u;
      cr.aggroT = gameTime + CFG.creepAggroChase;
      cr.aggroCdT = gameTime + CFG.creepAggroChase + CFG.creepAggroCd;
    }
  }
}
/* 🔄 DotA "de-aggro": naredba napada na vlastitog vojnika — neprijateljski vojnici koji te ganjaju prebace se na njega
   (ili na tvog najbližeg vojnika) */
function dropAggro(h, own){
  for(const cr of units){
    if(cr.kind !== 'creep' || cr.team === h.team || cr.attackTarget !== h || gameTime > (cr.aggroT || 0)) continue;
    let best = own && dist(own, cr) < 600 ? own : null, bd = 600;
    if(!best) for(const e of units){
      if(e.kind !== 'creep' || e.team !== h.team || e.dead || e.removeMe) continue;
      const d = dist(cr, e); if(d < bd){ bd = d; best = e; }
    }
    if(best){ cr.attackTarget = best; cr.aggroT = 0; }
  }
}
/* 🏰 v0.54: u dugoj igri junaci sve jače udaraju građevine (od 25. do 40. minute raste do ×(1 + lateSiege)) —
   sporija ekonomija i manji snowball znače ujednačenije timove, pa igra ne smije zapeti pred bazom */
function lateSiegeMul(){ return 1 + (CFG.lateSiege || 0) * clamp((gameClock() / 60 - 25) / 15, 0, 1); }
/* 🗼 koliko jače kula udara junake: ×2 do 10. minute, pa pada do ×1.3 u 20. minuti */
function towerHeroMul(){
  const m = gameClock() / 60, [a, b] = CFG.towerHeroMul;
  return m <= 10 ? a : (m >= 20 ? b : a + (b - a) * (m - 10) / 10);
}
/* kula neprijatelja tima `team` koja pokriva točku (x, y) — za botove (ne ulazi pod kulu) */
function enemyTowerAt(team, x, y, pad){
  for(const tw of units){
    if(tw.kind !== 'tower' || tw.team === team || tw.removeMe || tw.team === TEAM_NEUTRAL) continue;
    if(distXY(tw.x, tw.y, x, y) <= tw.atkRange + (pad || 0)) return tw;
  }
  return null;
}
/* prizvani (Majmunska vojska): brane gospodara i napadaju što i on */
function summonThink(u){
  const o = u.summonOf;
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > 600) u.attackTarget = null;
  if(!u.attackTarget && o && !o.dead && isTargetable(o.attackTarget) && dist(o, o.attackTarget) < 600) u.attackTarget = o.attackTarget;
  if(!u.attackTarget) u.attackTarget = nearestEnemyOf(u, 360, e => e.kind === 'hero' || e.kind === 'creep' || e.kind === 'neutral');
  if(!u.attackTarget && o && !o.removeMe){
    if(dist(u, o) > 110) u.moveTarget = { x: o.x + rand(-60, 60), y: o.y + rand(-60, 60) };
    else u.moveTarget = null;
  }
}

/* ================= AI: kule ================= */
/* v0.38 (kao u DotA 2): kula uzme NAJBLIŽU neprijateljsku jedinicu u dometu (vojnika ILI junaka) i drži je dok
   meta ne pogine ili ne izađe iz dometa; napadne li neprijateljski junak našeg junaka pod kulom — kula se okrene
   na njega (drawAggro). Junak koji prođe ispred svojih vojnika do kule — dobiva hitac! */
function towerThink(u){
  if(!isTargetable(u.attackTarget) || u.attackTarget.team === u.team || dist(u, u.attackTarget) > u.atkRange + u.attackTarget.r + 30 ||
     (u.attackTarget.kind === 'neutral' && !neutralActive(u.attackTarget)) ||
     (u.attackTarget.kind === 'hero' && u.attackTarget.status.invisT > 0 && u.attackTarget.status.trackT <= 0))
    u.attackTarget = null;
  if(!u.attackTarget){
    u.attackTarget = nearestEnemyOf(u, u.atkRange, e => e.kind === 'creep' || e.kind === 'hero' || neutralActive(e));   // 🐗 i povučena čudovišta
    const t = u.attackTarget;
    if(t && isHuman(t) && u.warnedTgt !== t) addFloat(t.x, t.y, L('⚠️ Toranj te gađa!', '⚠️ The tower is shooting you!'), '#fca5a5', 15, t.team);
    u.warnedTgt = t || u.warnedTgt;
  }
  if(u.attackTarget && u.atkTimer <= 0 && dist(u, u.attackTarget) <= u.atkRange + u.attackTarget.r + 30)
    performAttack(u, u.attackTarget);
}

/* ================= AI: neutralci =================
   v0.46 (kao u DotA 2): čudovišta su MIRNA dok ih netko ne udari — tada cijeli kamp napada napadača i ganja ga do
   povodca (CFG.campLeash od kampa). Usput uzvraćaju onome tko ih udara (vojnici, prizvani, drugi junak), a vojnici na
   stazi i kule napadaju razljućena čudovišta — tako se kamp može "povući" do svojih vojnika ili pod kulu.
   Predaleko od kampa ili bez ijednog udarca CFG.campGiveUp sekundi — vrate se kući i brzo se izliječe. */
function neutralLeash(u){ return u.boss || u.drake ? 620 : CFG.campLeash; }
/* 🗼 v0.47: kula (bilo koja) čiji domet + pad pokriva točku — čudovišta se tu okreću natrag */
function towerZoneAt(x, y, pad){
  for(const tw of units){
    if(tw.kind === 'tower' && !tw.removeMe && !tw.dead && distXY(tw.x, tw.y, x, y) <= tw.atkRange + pad) return tw;
  }
  return null;
}
/* razljućeno čudovište izvan kampa: njega napadaju vojnici i kule (Veliki Zmaj i zmajčić ne izlaze iz svojih jazbina) */
function neutralActive(e){ return e.kind === 'neutral' && !e.returning && !e.boss && !e.drake && isTargetable(e.attackTarget); }
function neutralThink(u){
  const camp = u.camp, leash = neutralLeash(u);
  const dHome = distXY(u.x, u.y, camp.x, camp.y);
  const t0 = u.attackTarget;
  const tgtFar = t0 && !t0.removeMe && distXY(t0.x, t0.y, camp.x, camp.y) > leash + 50;
  const bored = t0 && gameTime - (camp.fightT || 0) > CFG.campGiveUp;   // ganja, a nitko nikoga ne udara (bježi im)
  // 🗼 v0.47: ne idu pod kulu — ni za metom koja je pobjegla pod kulu
  const tower = (t0 || dHome > 150) && (towerZoneAt(u.x, u.y, u.r + CFG.campTowerPad) || (t0 && towerZoneAt(t0.x, t0.y, 30)));
  if(dHome > leash || tgtFar || bored || tower){
    u.attackTarget = null;
    u.returning = true;
  }
  if(u.returning){
    if(dHome < 90){ u.returning = false; u.moveTarget = null; }
    else { u.moveTarget = { x: camp.x + rand(-40, 40), y: camp.y + rand(-40, 40) }; return; }
  }
  if(!isTargetable(u.attackTarget) || u.attackTarget.team === TEAM_NEUTRAL) u.attackTarget = null;
  if(!u.attackTarget){   // udarili su nekoga iz kampa: cijeli kamp ide na istog
    for(const m of camp.units){
      if(m !== u && !m.dead && !m.removeMe && !m.returning && isTargetable(m.attackTarget)){
        u.attackTarget = m.attackTarget;
        break;
      }
    }
  }
  if(!u.attackTarget && dHome > 150 && gameTime - (camp.fightT || 0) < CFG.campGiveUp){
    // izvan kampa i još u borbi (npr. pobijedili su vojnika kojeg su ganjali): napadnu onoga tko je odmah uz njih
    let best = null, bd = 260;
    for(const e of units){
      if(e.team === TEAM_NEUTRAL || e.dead || e.removeMe || e.invuln || (e.kind !== 'hero' && e.kind !== 'creep')) continue;
      if(e.kind === 'hero' && e.status.invisT > 0 && e.status.trackT <= 0) continue;
      const d = dist(u, e) - e.r;
      if(d < bd){ bd = d; best = e; }
    }
    if(best) u.attackTarget = best;
  }
  if(!u.attackTarget && !u.moveTarget && dHome > 70){
    u.moveTarget = { x: camp.x + rand(-30, 30), y: camp.y + rand(-30, 30) };
  }
}

/* ================= AI: junaci botovi ================= */
function laneFrontCreep(team, lane){   // naš vojnik koji je najdalje odmakao na stazi
  let best = null, bp = -1;
  for(const u of units){
    if(u.kind !== 'creep' || u.team !== team || u.lane !== lane || u.dead || u.removeMe) continue;
    const wps = u.path;
    const wi = Math.min(u.wpIndex, wps.length - 1);
    const prog = wi * 10000 - distXY(u.x, u.y, wps[wi][0], wps[wi][1]);
    if(prog > bp){ bp = prog; best = u; }
  }
  return best;
}
function laneFront(team, lane){
  const best = laneFrontCreep(team, lane);
  if(best) return { x: best.x, y: best.y };
  let tw = null;
  for(const u of units){
    if(u.kind === 'tower' && u.team === team && u.lane === lane && !u.removeMe){
      if(!tw || u.tier < tw.tier) tw = u;
    }
  }
  if(tw) return stepToward(tw, FOUNTAIN[team], 110);
  const p = lanePath(team, lane)[0];
  return { x: p[0], y: p[1] };
}

function allyHeroLow(u, range, frac){
  for(const e of units){
    if(e.kind !== 'hero' || e.team !== u.team || e === u || e.dead) continue;
    if(dist(u, e) < range && e.hp < e.maxhp * frac) return e;
  }
  return null;
}

/* 🌲 v0.51: sredina kampa koji bot čisti (barem 2 čudovišta u dometu) — za moći po području, samo kad ima dosta mane */
function jungleAim(u, range){
  const c = u.bot && u.bot.camp;
  if(!c || u.mp < u.maxmp * 0.55) return null;
  const ms = c.units.filter(m => !m.dead && !m.removeMe && dist(u, m) < range);
  if(ms.length < 2) return null;
  return { x: ms.reduce((a, m) => a + m.x, 0) / ms.length, y: ms.reduce((a, m) => a + m.y, 0) / ms.length };
}
function botUseAbilities(u, eh, plan){
  for(let i = 0; i < u.abilities.length; i++){
    const ab = u.abilities[i];
    if(ab.rank <= 0 || ab.cd > 0 || u.mp < abMana(u, ab)) continue;
    const hint = ab.def.bot;
    if(!hint) continue;
    const dEh = eh ? dist(u, eh) : 1e9;
    switch(hint.type){
      case 'heal':
        if(u.hp < u.maxhp * 0.65 || allyHeroLow(u, 270, 0.6)) castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'ult-heal':
        if((u.hp < u.maxhp * 0.6 || allyHeroLow(u, 320, 0.5)) || (eh && dEh < 300 && u.hp < u.maxhp * 0.8))
          castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'shield':
        if(eh && dEh < hint.range) castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'haste':
        if(eh && dEh < hint.range) castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'aoe-self': {
        let creepN = 0;
        for(const e of units){
          if((e.kind === 'creep' || e.kind === 'neutral') && e.team !== u.team && !e.dead && !e.removeMe && dist(u, e) < hint.range) creepN++;
        }
        if((eh && dEh < hint.range) || creepN >= 3 || (creepN >= 2 && jungleAim(u, hint.range))) castAbility(u, i, { x: u.x, y: u.y });
        break;
      }
      case 'ult-aoe':
        if(eh && dEh < hint.range) castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'gap':   // skok / juriš u neprijatelja — v0.49: samo kad se bot odlučio boriti (ne sam na jačeg)
        if(eh && plan && plan.engage && dEh < hint.range && dEh > 120 && u.hp > u.maxhp * 0.55)
          castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'chain':
        if(eh && dEh < hint.range) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'snipe': {   // dalekometni hitac: najslabiji VIDLJIVI junak u dometu (ne samo najbliži)
        const tg = weakestEnemyHero(u, hint.range);
        if(tg && tg.hp < tg.maxhp * 0.5 && !(eh && dEh < 380 && u.hp < u.maxhp * 0.5)) castAbility(u, i, { x: tg.x, y: tg.y });
        break;
      }
      case 'execute': {   // 🪓 Smrtni udarac: samo kad meta pada odjednom
        const thr = 250 + 75 * ab.rank + (hasTal(u, 'bikos_r_plus') ? 150 : 0);
        const tg = nearestEnemyOf(u, hint.range, e => e.kind === 'hero' && e.hp <= thr && e.status.immuneT <= 0)
          || nearestEnemyOf(u, hint.range, e => e.kind === 'hero' && e.hp < e.maxhp * 0.4);   // ⚖️ v0.45: i kao jak udarac na ranjenog junaka (ulti se prije gotovo nikad nije bacao)
        if(tg) castAbility(u, i, { x: tg.x, y: tg.y });
        break;
      }
      case 'track':
        if(eh && dEh < hint.range && eh.status.trackT <= 0)
          castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'shot':
      case 'zone': {
        const ja = !eh && hint.type === 'zone' && jungleAim(u, hint.range);   // 🌲 v0.51: moć po području i na kamp (kad ima dosta mane)
        // 🌠 v0.56 dalekometna strijela (Sveta strijela): i na ranjenog junaka izvan blizine kojeg tim vidi
        const far = !eh && hint.type === 'shot' && hint.range > 700 ? weakestEnemyHero(u, hint.range) : null;
        const tg = eh && dEh < hint.range ? eh : (far && far.hp < far.maxhp * 0.7 ? far : null);
        if(tg) castAbility(u, i, ab.def.shotSpeed ? leadAim(u, tg, ab.def.shotSpeed) : { x: tg.x, y: tg.y });   // 🎯 strijela ispred mete koja hoda
        else if(ja) castAbility(u, i, ja);
        break;
      }
      case 'ward': {   // Sovino oko: pogledaj najbliže mjesto rune kad nema neprijatelja
        if(eh) break;
        let rs = null, bd = hint.range;
        for(const r of RUNE_SPOTS){ const d = distXY(u.x, u.y, r.x, r.y); if(d < bd){ bd = d; rs = r; } }
        if(rs) castAbility(u, i, { x: rs.x, y: rs.y });
        break;
      }
      case 'night':   // 🌑 Vječna noć: danju uvijek u borbi, noću kad su prijatelji uz nju (tim dobiva jače udarce)
        if(eh && dEh < hint.range && (!isNight || units.some(e => e.kind === 'hero' && e.team === u.team && e !== u && !e.dead && dist(u, e) < 800)))
          castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'escape': {   // bijeg prema fontani kad je ranjen i neprijatelj je blizu
        if(eh && dEh < hint.range && u.hp < u.maxhp * 0.4){
          const f = FOUNTAIN[u.team];
          castAbility(u, i, stepToward(u, f, 500));
        }
        break;
      }
      case 'burrow':   // 🕳️ Podzemni juriš (v0.55): u borbu kao skok, a ranjen pobjegne pod pijeskom prema fontani
        if(eh && dEh < 500 && u.hp < u.maxhp * 0.35) castAbility(u, i, stepToward(u, FOUNTAIN[u.team], 600));
        else if(eh && plan && plan.engage && dEh < hint.range && dEh > 120 && u.hp > u.maxhp * 0.55) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'hook':   // 🪝 Udica (v0.55): samo kad se tim bori ili je meta ranjena — ne vuci jačeg k sebi
        if(eh && dEh < hint.range && dEh > 200 && ((plan && plan.engage) || eh.hp < eh.maxhp * 0.45)) castAbility(u, i, leadAim(u, eh, 1300));
        break;
      case 'grab':   // 😋 Veliki zalogaj: neprijateljski junak uz bota, kad se bori
        if(eh && dEh < hint.range + eh.r && ((plan && plan.engage) || eh.hp < eh.maxhp * 0.5)) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'swap':   // Zamjena: povuci ranjenog neprijatelja k sebi kad je dalje
        if(eh && plan && plan.engage && dEh < hint.range && dEh > 220 && eh.hp < eh.maxhp * 0.6) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
    }
  }
}


/* ================= 🤖 AI: TIMSKA STRATEGIJA (v0.38) =================
   Svaki tim ima "zapovjednika" koji svakih ~2 s pogleda mapu (samo ono što TIM vidi) i botovima daje zadatke:
   🛡️ OBRANA  — neprijatelji ruše našu građevinu: najbliži botovi dolaze, a daleki se teleportiraju do kule
   🤝 POMOĆ   — (v0.51) suigrač je u borbi s jačima: dolazi bot u blizini kojemu se isplati
   🗡️ GANK    — ranjiv neprijateljski junak (ranjen, sam, predaleko od kule): botovi kojima se isplati ga zaskoče (v0.51: procjena)
   🏰 GURANJE — kad smo jači (više živih, veći level ili zlato) ili kasno u igri: tim se skupi na jednoj stazi
   🐲 ZMAJ    — kad protivnici leže mrtvi ili (v0.51) kad ga botovi u blizini brzo sruše, a protivnici ga ne mogu oteti
   🔁 STAZE   — staza bez naših junaka kojoj prijete neprijateljski vojnici dobiva bota s gušće staze
   Saveznici slušaju i tebe: 📍 ping (V) na neprijatelja / kulu ili "⚔️ Napadamo!" (G pa 3) pozove pomoć. */
let teamAI = [];
function resetTeamAI(){
  teamAI = [0, 1].map(team => ({ team, t: 4 + team, rotT: 45, gankT: 75 + team * 7, push: null, pushCd: 0,
    stats: { gank: 0, push: 0, defend: 0, rot: 0, boss: 0, tp: 0 }, log: '' }));
}
function aiBots(team){ return units.filter(u => u.kind === 'hero' && u.team === team && u.bot && !u.dead && !u.removeMe); }
function aiFree(u){ return u.bot && !u.bot.order && u.bot.state !== 'retreat' && u.hp > u.maxhp * 0.55 && u.tpChannel <= 0; }
function aiMacro(team){ return team !== myTeam && net.mode !== 'host' ? ({ easy: 0.5, normal: 1, hard: 1.25 }[SETTINGS.diff] || 1) : 1; }
function laneLabel(l){ return { top: L('gore', 'top'), mid: L('sredina', 'mid'), bot: L('dolje', 'bottom') }[l] || l; }
function giveOrder(u, o){
  u.bot.order = Object.assign({ t0: gameTime }, o);
  u.bot.camp = null;   // 🌲 zadatak tima je važniji od kampa u džungli
  if(o.lane) u.lane = o.lane;
}
function endOrder(u){
  const o = u.bot && u.bot.order;
  if(!o) return;
  u.bot.order = null;
  if(o.type === 'push' && u.homeLane) u.lane = u.homeLane;
}
const TEAM_SAY_CD = { '🛡️': 25, '🗡️': 12, '🏰': 30, '🔁': 20, '🐲': 30, '🤝': 15, '🌲': 45 };   // 🤫 ista vrsta poruke najviše jednom u N s
const teamSayT = [{}, {}];
function teamSay(team, txt){
  const k = [...txt][0], cd = TEAM_SAY_CD[k] || 10;
  if(gameTime - (teamSayT[team][k] == null ? -99 : teamSayT[team][k]) < cd) return;
  teamSayT[team][k] = gameTime;
  if(team === myTeam || (net.mode === 'host' && team === TEAM_RED)) feedMsg(txt, TEAM_COLOR[team], team);
}
/* naša građevina koju upravo ruše: najveća prijetnja (junaci vrijede više od vojnika) */
function findThreat(team){
  let best = null, bw = 1.9;
  for(const s of units){
    if(!isStructure(s) || s.team !== team || s.removeMe || s.invuln || gameTime - (s.lastDmgT || -99) > 4) continue;
    let w = 0, nh = 0;
    for(const e of units){
      if(e.team === team || e.team === TEAM_NEUTRAL || e.dead || e.removeMe || dist(e, s) > 950) continue;
      if(e.kind === 'hero' && isVisibleTo(team, e)){ w += 3; nh++; }
      else if(e.kind === 'creep') w += e.siege ? 1.5 : 0.5;
    }
    if(s.kind === 'ancient' || s.isGuard) w *= 2;   // baza: svi u obranu
    if(w > bw){ bw = w; best = { s, nh, w }; }
  }
  return best;
}
/* staza za guranje: ona gdje je naš val najbliži sljedećoj neprijateljskoj građevini */
function pushLane(team){
  let best = null, bd = 1e9;
  for(const lane of LANE_LIST){
    const fp = laneFront(team, lane);
    let tgt = null;
    for(const s of units){
      if(!isStructure(s) || s.team === team || s.removeMe || s.team === TEAM_NEUTRAL) continue;
      if(s.lane && s.lane !== lane) continue;
      const d = distXY(fp.x, fp.y, s.x, s.y);
      if(!tgt || d < tgt.d) tgt = { s, d };
    }
    if(tgt && tgt.d < bd){ bd = tgt.d; best = lane; }
  }
  return best;
}
/* ================= 🧠 v0.51: PROCJENA — kad u džunglu, u gank, po runu i u pomoć =================
   Botovi ne idu u gank i džunglu po satu, nego kad PROCIJENE da se isplati (kao pravi igrači):
   🌲 DŽUNGLA — na stazi nema posla (oba vala su mrtva ili je naš val stigao pod tuđu kulu) ili je staza izgubljena (jači
               protivnik ne da prići vojnicima): bot očisti kamp na svojoj strani koji SAM može pobijediti (vrijeme čišćenja ×
               šteta čudovišta) i vrati se po sljedeći val; kamp odmah uz sebe uzme usput (kad nema vojnika u blizini)
   🗡️ GANK    — meta je ranjena, sama ili predaleko od svoje kule; gankerima se isplati otići (na stazi nemaju posla, imaju
               runu ili spreman ulti, ne ostavljaju suigrača samog protiv dvojice) i zajedno je mogu srušiti
   🤝 POMOĆ   — suigrač je u borbi s jačima: bot koji stigne na vrijeme (pješice ili teleportom do kule uz borbu) i kojemu
               se isplati dođe pomoći
   ✨ RUNA    — bot najbliži čarobnoj runi (obično onaj sa sredine) uzme je kad je sigurno; s brzinom ili dvostrukom štetom
               odmah traži gank
   U fazi na stazama (CFG.laningPhase) procjene su opreznije: na stazi se više isplati ostati. */
/* ima li posla na stazi: neprijateljski vojnici uz naš val (ili uz bota) koji nisu pod njihovom kulom — ili naš val još
   putuje prema njihovom, pa sudar valova tek dolazi. Nema posla: oba vala su mrtva ili je naš val pod njihovom kulom. */
function laneWork(u){
  const fc = laneFrontCreep(u.team, u.lane), fp = fc || laneFront(u.team, u.lane);
  let n = 0;
  for(const e of units){
    if(e.kind !== 'creep' || e.team === u.team || e.lane !== u.lane || e.dead || e.removeMe) continue;
    if((dist(e, fp) < 1000 || dist(e, u) < 800) && !enemyTowerAt(u.team, e.x, e.y, 60)) n++;
  }
  if(!n && fc && !enemyTowerAt(u.team, fc.x, fc.y, 250)) n = 1;
  return n;
}
function heroDps(h){ return h.dmg * (1 + (h.atkSpdBonus || 0) + (h.talAspd || 0)) / h.atkCd; }
function ultReady(h){ return h.abilities.some(a => a.def.ult && a.rank > 0 && a.cd <= 0 && h.mp >= abMana(h, a)); }
function spellsReady(h){
  return h.abilities.filter(a => a.rank > 0 && a.cd <= 0 && h.mp >= abMana(h, a) && a.def.bot && /shot|zone|gap|aoe|chain|snipe|execute|swap|track/.test(a.def.bot.type)).length;
}
function powerRune(h){ return (h.runeRoamT || 0) > gameTime; }   // ✨ upravo uzeta runa brzine ili dvostruke štete
/* koliko bota "košta" otići sa staze: 0 = slobodan; više = gubi zlato i iskustvo ili ostavlja suigrača samog */
function roamCost(u){
  const lp = gameClock() < CFG.laningPhase;
  const mates = u.jungler ? [] : units.filter(h => h.kind === 'hero' && h.team === u.team && h !== u && !h.dead && h.lane === u.lane && !h.jungler && dist(h, u) < 1500);
  let c = u.jungler ? 0 : laneWork(u) > 0 ? (lp ? (mates.length ? 0.2 : (u.lane === 'mid' ? 0.45 : 0.3)) : 0.15) : 0;   // na stazi u dvoje farmu drži suigrač
  if(mates.length){
    let foes = 0;
    for(const e of units) if(e.kind === 'hero' && e.team !== u.team && !e.dead && isVisibleTo(u.team, e) && mates.some(m => dist(m, e) < 1300)) foes++;
    if(foes > mates.length) c += 0.6;   // suigrač bi ostao sam protiv dvojice
  }
  if(powerRune(u)) c -= 0.4;   // ✨ s runom je sad pravi trenutak
  if(ultReady(u)) c -= 0.15;
  return c;
}
/* 🗡️ koliko je neprijateljski junak ranjiv za gank — i zašto (ranjen, predaleko od svoje kule, sam) */
function gankVuln(team, t, seen){
  let v = 0;
  const why = [], hpF = t.hp / t.maxhp;
  if(hpF < 0.7){ v += (1 - hpF) * 1.3; if(hpF < 0.55) why.push('hurt'); }
  let dOwn = 1e9, dOurs = 1e9;
  for(const s of units){
    if(s.kind !== 'tower' || s.removeMe) continue;
    if(s.team === t.team) dOwn = Math.min(dOwn, dist(s, t));
    else if(s.team === team) dOurs = Math.min(dOurs, dist(s, t));
  }
  const ext = dOwn / (dOwn + dOurs);   // 0,5 = na pola puta između kula; više = ušao je na našu stranu
  if(ext > 0.5){ v += Math.min(1, (ext - 0.5) * 3) * 0.8; if(ext > 0.6) why.push('far'); }
  const buddies = seen.filter(o => o !== t && dist(o, t) < 1100).length;
  if(buddies) v -= 0.35 * buddies;
  else { v += 0.25; why.push('alone'); }
  return { v, why };
}
/* otprilike koliko štete junak napravi meti u ~5 s (udarci + spremne moći) */
function gankBurst(h, t){ return heroDps(h) * 5 * armorMul(unitArmor(t)) + spellsReady(h) * (45 + 25 * h.level); }
const GANK_WHY = { hurt: ['ima malo života', 'low on health'], far: ['predaleko od svoje kule', 'far from their tower'], alone: ['nema nikoga uz sebe', 'nobody nearby'],
  rune: ['imamo runu', 'we have a rune'], ult: ['ulti je spreman', 'ult is ready'] };
/* 🌲 kamp: može li ga bot SAM očistiti i ostati na nogama (vrijeme čišćenja × šteta čudovišta) i koliko vrijedi */
function campPlan(u, c){
  let hp = 0, dps = 0, gold = 0, xp = 0, n = 0;
  for(const m of c.units){
    if(m.dead || m.removeMe) continue;
    hp += m.hp; dps += m.dmg / m.atkCd; gold += m.goldValue; xp += m.xpValue; n++;
  }
  if(!n) return null;
  const aoe = n > 1 && u.mp > u.maxmp * 0.55 && u.abilities.some(a => a.rank > 0 && a.cd <= 0 && a.def.bot && /aoe-self|zone/.test(a.def.bot.type));
  const myDps = heroDps(u) * (aoe ? 1.3 : 1), t = hp / Math.max(1, myDps);
  // čudovišta padaju jedno po jedno: u prosjeku napada (n + 1) / 2n kampa
  const taken = (dps * armorMul(unitArmor(u)) * (n + 1) / (2 * n) - (u.hpRegen || 0) - myDps * (u.lifesteal || 0)) * t;
  return { t, ok: u.hp - taken > u.maxhp * 0.45, value: gold + xp * 0.6 };
}
function pickCamp(u, maxD){
  const lp = gameClock() < CFG.laningPhase, foe = 1 - u.team, spd = Math.max(60, unitSpeed(u));
  const jg = !u.jungler && lp && units.some(h => h.jungler && h.team === u.team && !h.dead);   // 🌲 mali kampovi su za našeg junaka u džungli
  let best = null, bv = 0;
  for(const c of camps){
    if(!c.units.length || c.type === 'boss' || c.type === 'drake') continue;
    if(jg && CAMP_TYPES[c.type].small) continue;
    const d = distXY(u.x, u.y, c.x, c.y);
    if(d > (maxD || (u.jungler ? 3600 : (lp ? 1700 : 2100)))) continue;
    const ours = distXY(c.x, c.y, FOUNTAIN[u.team].x, FOUNTAIN[u.team].y) < distXY(c.x, c.y, FOUNTAIN[foe].x, FOUNTAIN[foe].y);
    if(!ours && (lp || u.level < (u.jungler ? 8 : 10))) continue;   // tuđa džungla: tek poslije faze na stazama i kad je jak
    if(gameTime - (c.fightT || -99) < 3) continue;   // netko ga već tuče (ili su ga povukli vojnici)
    if(units.some(h => h.kind === 'hero' && !h.dead && h !== u && ((h.team === u.team && h.bot && h.bot.camp === c) ||
      (h.team === foe && isVisibleTo(u.team, h) && distXY(h.x, h.y, c.x, c.y) < 1200)))) continue;   // suigrač već ide / protivnik je tamo
    const p = campPlan(u, c);
    if(!p || !p.ok) continue;
    const v = p.value / (d / spd + p.t + 3);
    if(v > bv){ bv = v; best = c; }
  }
  return best;
}
/* 🌲 bot u džungli: kad na stazi nema posla (ili je izgubljena) očisti isplativ kamp, pa se vrati po sljedeći val */
function botJungle(u, fear){
  const b = u.bot;
  let c = b.camp;
  if(c){
    const engaged = c.units.some(n => n.attackTarget === u);
    const back = !u.jungler && !engaged && !fear && laneWork(u) >= 3 && dist(u, laneFront(u.team, u.lane)) < distXY(u.x, u.y, c.x, c.y);   // stigao je val — bliže je stazi
    if(!c.units.length || gameTime > b.campUntil || u.hp < u.maxhp * (u.jungler && engaged ? 0.2 : 0.35) || back){ b.camp = c = null; b.campT = gameTime + (u.jungler ? 0.5 : 3); }
  }
  if(!c){   // čudovište koje već napada bota (npr. povučeni kamp): uzvrati ako taj kamp može pobijediti — inače se vrati u kamp sam
    const agg = nearestEnemyOf(u, 450, e => e.kind === 'neutral' && e.attackTarget === u && !e.boss && !e.drake);
    const ap = agg && agg.camp && campPlan(u, agg.camp);
    if(ap && ap.ok){ b.camp = c = agg.camp; b.campUntil = gameTime + 8 + ap.t * 1.5; }
  }
  if(!c && u.jungler){   // 🌲 v0.56: junak u DŽUNGLI — od 0:00 i levela 1 ide od kampa do kampa (prvo mali kampovi s gušterima)
    if(gameTime < (b.campT || 0) || u.hp < u.maxhp * 0.45) return false;
    b.campT = gameTime + 1;
    c = pickCamp(u, 0);
    if(!c) return jungleWait(u);
    b.camp = c;
    b.campUntil = gameTime + 15 + distXY(u.x, u.y, c.x, c.y) / Math.max(60, unitSpeed(u)) + campPlan(u, c).t * 1.5;
  }
  if(!c){
    if(gameTime < (b.campT || 0) || u.hp < u.maxhp * 0.6 || u.level < 3) return false;
    b.campT = gameTime + 2;
    const lost = !!fear && dist(u, fear) < 1400;   // jači protivnik ne da prići vojnicima
    const busy = laneWork(u) > 0 && !lost;          // val se bije ili gura prema njihovoj kuli — bot ide s njim (pritisak na kule)
    if(roamCost(u) >= 0.6) return false;   // suigrač bi ostao sam protiv dvojice
    c = pickCamp(u, busy ? 650 : 0);       // 🌲 ima posla na stazi: samo kamp odmah uz bota (usput, bez vojnika u blizini)
    if(!c || (busy && nearestEnemyOf(u, 900, e => e.kind === 'creep'))) return false;
    b.camp = c;
    b.campUntil = gameTime + 12 + distXY(u.x, u.y, c.x, c.y) / Math.max(60, unitSpeed(u)) + campPlan(u, c).t * 1.5;
    const ai = teamAI[u.team];
    if(ai) ai.stats.jungle = (ai.stats.jungle || 0) + 1;
    if(lost) teamSay(u.team, L('🌲 ' + u.emoji + ' ' + u.name + ' ide u džunglu — na stazi su jači', '🌲 ' + u.emoji + ' ' + u.name + ' goes to the jungle — the enemies in lane are stronger'));
    else if(!busy) teamSay(u.team, L('🌲 ' + u.emoji + ' ' + u.name + ' farma džunglu — na stazi nema vojnika', '🌲 ' + u.emoji + ' ' + u.name + ' farms the jungle — no creeps in lane'));
  }
  let tg = null, bd = 1e9;
  for(const n of c.units){ if(n.dead || n.removeMe) continue; const d = dist(u, n); if(d < bd){ bd = d; tg = n; } }
  if(!tg){ b.camp = null; return false; }
  if(distXY(u.x, u.y, c.x, c.y) > 450 && !c.units.some(n => n.attackTarget === u)){ u.attackTarget = null; u.moveTarget = { x: c.x, y: c.y }; return true; }
  u.attackTarget = tg; u.moveTarget = null;
  return true;
}
/* 🌲 junak u džungli kad nijedan kamp nije isplativ (svi su očišćeni ili prejaki): pričeka kod kampa koji se prvi obnovi
   (ako je blizu) — inače vrati false i bot pomogne kućnoj stazi */
function jungleWait(u){
  let best = null, bt = 1e9;
  const foe = 1 - u.team;
  for(const c of camps){
    if(c.units.length || c.type === 'boss' || c.type === 'drake') continue;
    if(distXY(c.x, c.y, FOUNTAIN[u.team].x, FOUNTAIN[u.team].y) > distXY(c.x, c.y, FOUNTAIN[foe].x, FOUNTAIN[foe].y)) continue;
    const t = Math.max(c.respawnT || 0, distXY(u.x, u.y, c.x, c.y) / Math.max(60, unitSpeed(u)));
    if(t < bt){ bt = t; best = c; }
  }
  if(!best || (bt > 14 && gameTime > 0)) return false;   // u pripremi čeka kod prvog kampa
  u.attackTarget = null;
  const p = stepToward({ x: best.x, y: best.y }, FOUNTAIN[u.team], 260);   // malo dalje od kampa (da ga ne probudi)
  u.moveTarget = dist(u, p) > 120 ? p : null;
  return true;
}
/* ✨ čarobna runa na rijeci: ide po nju bot kojemu je najbliža (obično onaj sa sredine), ako tamo nije jači protivnik */
function botRune(u){
  if(!runes.length || u.hp < u.maxhp * 0.5) return false;
  const rn = runes[0], d = distXY(u.x, u.y, rn.x, rn.y);
  if(d > (gameClock() < CFG.laningPhase ? 1500 : 2200) || (d > 900 && laneWork(u) >= 4)) return false;
  for(const h of units){
    if(h.kind !== 'hero' || h.dead || h === u) continue;
    const dh = distXY(h.x, h.y, rn.x, rn.y);
    if(h.team === u.team && dh < d && (h.bot || dh < 700)) return false;   // suigrač je bliže
    if(h.team !== u.team && dh < 900 && isVisibleTo(u.team, h) && botFightScore(h) > botFightScore(u) * 1.1) return false;   // jači protivnik čuva runu
  }
  u.attackTarget = null; u.moveTarget = { x: rn.x, y: rn.y };
  return true;
}
function updateTeamAI(dt){
  if(!teamAI.length) resetTeamAI();
  for(const ai of teamAI){
    ai.t -= dt; ai.rotT -= dt; ai.gankT -= dt; ai.pushCd -= dt;
    if(ai.push && (gameTime > ai.push.until)) ai.push = null;
    if(ai.t > 0) continue;
    ai.t = 1.6 + Math.random() * 0.8;
    planTeam(ai);
  }
}
function planTeam(ai){
  const team = ai.team, foe = 1 - team, mk = aiMacro(team);
  const bots = aiBots(team);
  if(!bots.length || gameTime < 0) return;
  const heroes = units.filter(h => h.kind === 'hero' && !h.removeMe);
  const mine = heroes.filter(h => h.team === team), theirs = heroes.filter(h => h.team === foe);
  const mineAlive = mine.filter(h => !h.dead), theirsAlive = theirs.filter(h => !h.dead);
  const seen = theirsAlive.filter(h => isVisibleTo(team, h) && !(h.status.invisT > 0 && h.status.trackT <= 0));
  const avgLvl = arr => arr.reduce((a, h) => a + h.level, 0) / Math.max(1, arr.length);
  const lp = gameClock() < CFG.laningPhase;   // 🛣️ faza na stazama
  // 🛡️ 1) obrana
  const th = findThreat(team);
  const creepsOnly = !!th && th.nh === 0 && th.s.kind !== 'ancient' && !th.s.isGuard;
  const block = !!th && !creepsOnly;   // 🧠 v0.51: ostale planove prekida samo napad junaka (ili na prijestol), ne val vojnika
  if(th){
    const need = th.s.kind === 'ancient' || th.s.isGuard ? 5 : Math.min(4, Math.max(1, th.nh + 1));
    let have = mine.filter(h => !h.dead && dist(h, th.s) < 1100).length;
    // ⚖️ v0.49: dovoljno branitelja i po SNAZI (jak protivnik traži više junaka — da ne dolaze jedan po jedan)
    const thScore = theirsAlive.filter(e => dist(e, th.s) < 950 && isVisibleTo(team, e)).reduce((a, e) => a + botFightScore(e), 0);
    let haveScore = mine.filter(h => !h.dead && dist(h, th.s) < 1100).reduce((a, h) => a + botFightScore(h), 0);
    // 🧠 v0.51: u fazi na stazama, dok prva kula ima više od pola života, brane je junaci te staze — botovi s drugih staza
    //   dolaze samo kad je napadaju i junaci, a njima se isplati otići (na svojoj stazi nemaju posla); nitko se ne teleportira
    const t1Safe = lp && th.s.kind === 'tower' && th.s.tier === 1 && th.s.hp > th.s.maxhp * 0.5, minor = t1Safe && th.nh === 0;
    // samo vojnici (bez junaka) na kuli ili vojarni: dovoljan je jedan branitelj — ne prekida guranje ni gank drugih botova
    const cand = bots.filter(u => (aiFree(u) || (!creepsOnly && u.bot.order && u.bot.order.type !== 'defend')) && u.hp > u.maxhp * 0.45 && dist(u, th.s) > 1100 &&
      (!t1Safe || u.lane === th.s.lane || (!minor && roamCost(u) < 0.35)))
      .sort((a, b) => dist(a, th.s) - dist(b, th.s));
    for(const u of cand){
      if((have >= need && haveScore >= thScore * 1.15) || have >= 5) break;
      if(u.bot.order) endOrder(u);
      giveOrder(u, { type: 'defend', s: th.s, until: gameTime + 25 });
      have++; haveScore += botFightScore(u); ai.stats.defend++;
      if(!t1Safe && dist(u, th.s) > 2400 && u.tpCd <= 0){ startTeleport(u, th.s); ai.stats.tp++; }
      teamSay(team, L('🛡️ ' + u.emoji + ' ' + u.name + ' brani ' + (th.s.kind === 'ancient' ? 'prijestol' : (th.s.kind === 'barracks' ? 'vojarnu' : 'kulu')) + (th.s.lane ? ' (' + laneLabel(th.s.lane) + ')' : '') + '!',
        '🛡️ ' + u.emoji + ' ' + u.name + ' defends the ' + (th.s.kind === 'ancient' ? 'throne' : (th.s.kind === 'barracks' ? 'barracks' : 'tower')) + (th.s.lane ? ' (' + laneLabel(th.s.lane) + ')' : '') + '!'));
    }
    ai.log = 'obrana';
  }
  // 🐲 2) Veliki Zmaj — kad protivnici leže, ili 🧠 v0.51 po procjeni: barem trojica botova (level 9+) u blizini zajedno ga
  //   sruše za manje od ~16 s, a zmaj im pritom odnese manje od 40 % zajedničkog života, i protivnici ga ne mogu oteti
  //   (onih koji su blizu ili u magli ima manje nego nas). Zmaj daje štit, zlato i jače udarce — s njim tim lakše ruši kule.
  const bc = camps.find(c => c.type === 'boss'), boss = bc && bc.units[0];
  if(!block && boss && !boss.dead && !boss.removeMe && !bots.some(u => u.bot.order && u.bot.order.type === 'boss')){
    let grp = [];
    if(gameClock() > 900 && theirsAlive.length <= 2 && mineAlive.length >= 3 && avgLvl(mineAlive) >= 11) grp = bots.filter(u => aiFree(u) && dist(u, boss) < 3200);
    else {
      const g = bots.filter(u => aiFree(u) && u.level >= 9 && u.hp > u.maxhp * 0.7 && dist(u, boss) < 2600);
      const t = boss.hp / Math.max(1, g.reduce((a, u) => a + heroDps(u), 0));
      const taken = boss.dmg / boss.atkCd * t, tank = g.reduce((a, u) => a + u.hp, 0);
      const unknown = theirsAlive.filter(e => !isVisibleTo(team, e) || dist(e, boss) < 3000).length;
      if(g.length >= 3 && t < 16 && taken < tank * 0.4 && unknown < g.length) grp = g;
    }
    if(grp.length){
      for(const u of grp) giveOrder(u, { type: 'boss', until: gameTime + 35, need: Math.min(3, grp.length) });
      ai.stats.boss++; teamSay(team, L('🐲 Tim ide na Velikog Zmaja!', '🐲 The team goes for the Great Dragon!')); ai.log = 'zmaj';
    }
  }
  // 🏰 3) guranje kad smo jači
  const deadFoes = theirs.filter(h => h.dead && h.deadT > 10).length;
  const nwLead = teamNetWorth(team) / Math.max(1, teamNetWorth(foe));
  const strong = (deadFoes >= 2 && mineAlive.length >= 3) || (gameClock() > 840 && nwLead > CFG.pushLead && mineAlive.length >= theirsAlive.length) ||
    (gameClock() > 1260 && mineAlive.length >= theirsAlive.length && mineAlive.length >= 4);
  if(!block && !ai.push && ai.pushCd <= 0 && strong && Math.random() < mk){
    const lane = pushLane(team);
    if(lane){
      ai.push = { lane, until: gameTime + (deadFoes >= 2 ? 30 : 45) };
      ai.pushCd = 35 / mk;
      let n = 0;
      for(const u of bots){
        if(!aiFree(u) || u.level < 6) continue;
        giveOrder(u, { type: 'push', lane, until: ai.push.until }); n++;
      }
      if(n){ ai.stats.push++; teamSay(team, L('🏰 Guramo stazu ' + laneLabel(lane) + ' — svi zajedno!', '🏰 We push the ' + laneLabel(lane) + ' lane — all together!')); ai.log = 'guranje ' + lane; }
      else ai.push = null;
    }
  }
  // 🤝 4) 🧠 v0.51 pomoć: suigrač je u borbi s jačima — dolazi bot u blizini kojemu se isplati
  if(!block){
    for(const a of mineAlive){
      if(gameTime - (a.combatT == null ? -99 : a.combatT) > 2) continue;
      const e1 = seen.filter(e => dist(e, a) < 750).sort((p, q) => dist(p, a) - dist(q, a))[0];
      if(!e1) continue;
      const fs = fightSides(a, e1);
      if(fs.mine >= fs.theirs * 1.2 || a.hp < a.maxhp * 0.35 || enemyTowerAt(team, e1.x, e1.y, 60)) continue;   // snalaze se sami / prekasno / pod njihovom kulom
      // pomažu samo oni koji stignu na vrijeme: pješice (~10 s) ili — poslije faze na stazama — teleportom do naše kule uz borbu
      const tw = !lp && units.find(s => s.kind === 'tower' && s.team === team && !s.removeMe && dist(s, a) < 900);
      const hl = bots.filter(u => u !== a && aiFree(u) && u.hp > u.maxhp * 0.6 && dist(u, a) > 900 && roamCost(u) < (lp ? 0.35 : 0.55) &&
        (dist(u, a) < 1400 || (tw && u.tpCd <= 0 && dist(u, a) > 2400)))
        .sort((p, q) => dist(p, a) - dist(q, a)).slice(0, lp ? 1 : 2);
      if(!hl.length || fs.mine + hl.reduce((s, u) => s + botFightScore(u), 0) < fs.theirs) continue;   // ni s pomoći nismo jači
      for(const u of hl){
        giveOrder(u, { type: 'gank', target: e1, lx: e1.x, ly: e1.y, lastSeen: gameTime, until: gameTime + 12, help: true });
        if(dist(u, a) > 2400){ startTeleport(u, tw); ai.stats.tp++; }
      }
      ai.stats.help = (ai.stats.help || 0) + 1;
      teamSay(team, L('🤝 ' + hl.map(u => u.emoji + ' ' + u.name).join(' i ') + (hl.length > 1 ? ' idu' : ' ide') + ' pomoći ' + a.emoji + ' ' + a.name + '!',
        '🤝 ' + hl.map(u => u.emoji + ' ' + u.name).join(' and ') + (hl.length > 1 ? ' go' : ' goes') + ' to help ' + a.emoji + ' ' + a.name + '!'));
      break;
    }
  }
  // 🗡️ 5) gank — 🧠 v0.51: procjena umjesto sata. Meta: ranjena, sama ili predaleko od svoje kule. Gankeri: spremni, a otići
  //   im se isplati (na stazi nemaju posla, imaju runu ili ulti, suigrač ne ostaje sam protiv dvojice). Ide se kad je meta
  //   zaista ranjiva, kad smo jasno jači i kad je možemo srušiti — u fazi na stazama najviše dvojica i uz strožu procjenu.
  if(!block && !ai.push && seen.length && (ai.gankT <= 0 || bots.some(u => powerRune(u) && aiFree(u)))){
    ai.gankT = (6 + Math.random() * 4) / mk;
    let plan = null;
    for(const t of seen){
      if(enemyTowerAt(team, t.x, t.y, 80)) continue;   // pod svojom kulom — ne
      const vul = gankVuln(team, t, seen);
      if(vul.v < 0.3) continue;
      const near = mine.filter(h => !h.dead && dist(h, t) < 1100);
      const tScore = seen.filter(o => dist(o, t) < 1000).reduce((a, o) => a + botFightScore(o), 0);
      let gScore = near.reduce((a, h) => a + botFightScore(h), 0), burst = near.reduce((a, h) => a + gankBurst(h, t), 0), cost = 0;
      const cand = bots.filter(u => aiFree(u) && u.level >= CFG.gankLvl && u.hp > u.maxhp * 0.6 && !near.includes(u) && dist(u, t) < (lp ? 2600 : 3000) &&
          (u.mp > u.maxmp * 0.3 || spellsReady(u) > 0))
        .map(u => ({ u, c: roamCost(u) + dist(u, t) / Math.max(60, unitSpeed(u)) / 60 }))   // svaka minuta hoda = +1
        .filter(x => x.c < (lp ? 0.55 : 0.75)).sort((a, b) => a.c - b.c);
      const gk = [];
      for(const x of cand){
        if(gk.length >= (lp ? 2 : 3) || (near.length + gk.length >= 2 && gScore >= tScore * 1.3 && burst >= t.hp)) break;
        gk.push(x.u); gScore += botFightScore(x.u); burst += gankBurst(x.u, t); cost += x.c;
      }
      if(!gk.length || near.length + gk.length < 2 || gScore < tScore * 1.3) continue;   // ⚖️ v0.49: jasno jači od mete i onih uz nju
      const val = vul.v + 0.6 * Math.min(1.2, burst / t.hp) - cost / gk.length;
      if(val >= (lp ? 1.0 : 0.85) / mk && (!plan || val > plan.val))
        plan = { t, gk, val, why: vul.why.concat(gk.some(powerRune) ? ['rune'] : [], gk.some(ultReady) ? ['ult'] : []) };
    }
    if(plan){
      const t = plan.t, gk = plan.gk, why = plan.why.slice(0, 2);
      for(const u of gk) giveOrder(u, { type: 'gank', target: t, lx: t.x, ly: t.y, lastSeen: gameTime, until: gameTime + 18 });
      ai.stats.gank++; ai.log = 'gank ' + t.name;
      if(ai.stats.g1 == null) ai.stats.g1 = Math.round(gameClock());   // 🧪 sim: kada je bio prvi gank
      teamSay(team, L('🗡️ ' + gk.map(u => u.emoji + ' ' + u.name).join(' i ') + (gk.length > 1 ? ' idu' : ' ide') + ' u gank na ' + t.emoji + ' ' + t.name +
          (why.length ? ' — ' + why.map(k => GANK_WHY[k][0]).join(', ') : '') + '!',
        '🗡️ ' + gk.map(u => u.emoji + ' ' + u.name).join(' and ') + (gk.length > 1 ? ' go' : ' goes') + ' to gank ' + t.emoji + ' ' + t.name +
          (why.length ? ' — ' + why.map(k => GANK_WHY[k][1]).join(', ') : '') + '!'));
    }
  }
  // 🔁 6) promjena staze: staza bez naših junaka, a neprijateljski vojnici guraju našu kulu
  if(ai.rotT <= 0 && gameClock() >= CFG.laningPhase){   // 🛣️ v0.50: u fazi na stazama botovi ostaju na svojim stazama
    ai.rotT = 25;
    for(const lane of LANE_LIST){
      let tw = null;
      for(const s of units) if((s.kind === 'tower' || s.kind === 'barracks') && s.team === team && s.lane === lane && !s.removeMe && (!tw || (s.tier || 3.5) < (tw.tier || 3.5))) tw = s;   // vojarna je iza T3
      if(!tw) continue;
      const foes = units.filter(e => e.kind === 'creep' && e.team === foe && !e.dead && dist(e, tw) < 1300).length;
      const ours = mine.filter(h => !h.dead && dist(h, tw) < 1700).length;
      if(foes < 4 || ours > 0) continue;
      const count = l => mine.filter(h => !h.dead && h.lane === l && !h.jungler).length;   // 🌲 junak u džungli ne drži stazu
      const donor = bots.filter(u => aiFree(u) && !u.jungler && u.lane !== lane && count(u.lane) >= 2).sort((a, b) => dist(a, tw) - dist(b, tw))[0];
      if(!donor) continue;
      donor.lane = donor.homeLane = lane; ai.stats.rot++;
      teamSay(team, L('🔁 ' + donor.emoji + ' ' + donor.name + ' prelazi na stazu ' + laneLabel(lane) + '!', '🔁 ' + donor.emoji + ' ' + donor.name + ' moves to the ' + laneLabel(lane) + ' lane!'));
      break;
    }
  }
}
/* 🧠 v0.51: izdaleka ganker ne ide ravno na metu, nego malo iza nje (prema njenoj kuli) — da joj presiječe put za bijeg */
function gankApproach(u, o){
  const p = { x: o.lx, y: o.ly };
  if(o.help || distXY(u.x, u.y, p.x, p.y) < 900) return p;
  let tw = null, td = 1e9;
  for(const s of units){
    if(s.kind !== 'tower' || s.team === u.team || s.removeMe) continue;
    const d = distXY(s.x, s.y, p.x, p.y);
    if(d < td){ td = d; tw = s; }
  }
  return tw && td > 800 ? stepToward(p, tw, Math.min(350, (td - 700) * 0.5)) : p;
}
/* bot slijedi zadatak tima; vraća true ako je zadatak odlučio što bot radi ovaj put */
function followOrder(u, eh){
  const o = u.bot.order;
  if(!o) return false;
  if(gameTime > o.until){ endOrder(u); return false; }
  switch(o.type){
    case 'gank': {
      const t = o.target;
      if(!t || t.dead || t.removeMe || u.hp < u.maxhp * 0.35){ endOrder(u); return false; }
      const vis = isVisibleTo(u.team, t) && !(t.status.invisT > 0 && t.status.trackT <= 0);
      if(vis){ o.lx = t.x; o.ly = t.y; o.lastSeen = gameTime; }
      else if(gameTime - o.lastSeen > 4){ endOrder(u); return false; }
      const tw = enemyTowerAt(u.team, o.lx, o.ly, 40);
      if(tw && !(t.hp < t.maxhp * 0.25 && tw.attackTarget && tw.attackTarget.kind === 'creep')){ endOrder(u); return false; }
      if(vis && dist(u, t) < 1000){   // ⚖️ v0.49: ne ulijeći sam — pričekaj suigrače iz ganka (najviše 6 s), inače odustani
        const fs = fightSides(u, t);
        if(fs.mine < fs.theirs * 1.1){
          if(o.waitT == null) o.waitT = gameTime + 6;
          if(gameTime > o.waitT){ endOrder(u); return false; }
          u.attackTarget = null; u.moveTarget = stepToward(t, u, 820);
          return true;
        }
      }
      if(vis && dist(u, t) < u.atkRange + t.r + 260){ u.attackTarget = t; u.moveTarget = null; return true; }
      u.attackTarget = null; u.moveTarget = gankApproach(u, o);
      return true;
    }
    case 'defend': {
      const sd = o.s;
      if(!sd || sd.removeMe){ endOrder(u); return false; }
      if(eh && dist(u, eh) < 700) return false;   // ⚖️ v0.49: uz neprijatelja odlučuje procjena borbe (slabiji čeka suigrače)
      if(gameTime - (sd.lastDmgT || -99) > 8 && dist(u, sd) < 1000){ endOrder(u); return false; }
      if(dist(u, sd) > 2400 && u.tpCd <= 0 && !eh){ startTeleport(u, sd); return true; }
      if(dist(u, sd) > 700){ u.attackTarget = null; u.moveTarget = stepToward(sd, FOUNTAIN[u.team], 120); return true; }
      return false;   // na mjestu: borba oko kule po običnim pravilima
    }
    case 'push': {
      const ai = teamAI[u.team];
      if(!ai || !ai.push || ai.push.lane !== o.lane){ endOrder(u); return false; }
      if(eh && dist(u, eh) < 700) return false;   // ⚖️ v0.49: uz neprijatelja odlučuje procjena borbe
      const fp = laneFront(u.team, o.lane);
      if(dist(u, fp) > 750){ u.attackTarget = null; u.moveTarget = stepToward(fp, FOUNTAIN[u.team], 140); return true; }
      return false;   // uz val: ruši s vojnicima
    }
    case 'boss': {
      const bc = camps.find(c => c.type === 'boss'), bs = bc && bc.units[0];
      if(!bs || bs.dead || bs.removeMe || u.hp < u.maxhp * 0.3){ endOrder(u); return false; }
      if(eh && dist(u, eh) < 700) return false;   // ⚖️ v0.49: protivnik stiže — prvo procjena borbe
      const allies = units.filter(h => h.kind === 'hero' && h.team === u.team && !h.dead && dist(h, bs) < 750).length;
      if(allies < (o.need || 3) && bs.hp > bs.maxhp * 0.5){ u.attackTarget = null; u.moveTarget = stepToward(bs, FOUNTAIN[u.team], 380); return true; }
      u.attackTarget = bs; u.moveTarget = null;
      return true;
    }
  }
  return false;
}
/* 📍 ping / "Napadamo!" igrača: najbliži saveznički botovi dolaze pomoći */
function botsAnswer(h, x, y){
  if(!h || !isHuman(h)) return;
  const bots = aiBots(h.team).filter(u => u.bot.state !== 'retreat' && u.hp > u.maxhp * 0.45);
  if(!bots.length) return;
  const foe = units.filter(e => e.kind === 'hero' && e.team !== h.team && !e.dead && isVisibleTo(h.team, e) && distXY(e.x, e.y, x, y) < 600)
    .sort((a, b) => distXY(a.x, a.y, x, y) - distXY(b.x, b.y, x, y))[0];
  const near = bots.sort((a, b) => distXY(a.x, a.y, x, y) - distXY(b.x, b.y, x, y)).slice(0, 2).filter(u => distXY(u.x, u.y, x, y) < 3200);
  if(!near.length) return;
  for(const u of near){
    endOrder(u);
    if(foe) giveOrder(u, { type: 'gank', target: foe, lx: foe.x, ly: foe.y, lastSeen: gameTime, until: gameTime + 15 });
    else {
      const sd = units.filter(s => isStructure(s) && s.team === h.team && !s.removeMe && distXY(s.x, s.y, x, y) < 700)[0];
      if(sd) giveOrder(u, { type: 'defend', s: sd, until: gameTime + 18 });
      else { u.bot.order = { type: 'gank', target: null, until: 0 }; u.moveTarget = { x, y }; u.bot.order = null; u.bot.goT = gameTime + 8; u.bot.goTo = { x, y }; }
    }
  }
  say(near[0], foe ? L('👍 Idem na ' + foe.name + '!', '👍 Going for ' + foe.name + '!') : L('👍 Dolazim!', '👍 On my way!'));
}

/* 🤖 težina botova (igra protiv botova): protivnički botovi na "Lako" sporije reagiraju, rjeđe bacaju moći i
   koriste predmete, oprezniji su, ne otkupljuju se i zarađuju manje zlata; na "Teško" brži su i hrabriji.
   Saveznici i botovi u mrežnoj igri su uvijek normalni. */
const BOT_DIFF = {
  easy:   { think: [0.9, 1.3], abil: 0.35, items: 0.5, sum: 0.4, brave: 1.35, back: 1.05, chase: 0.12, flee: 0.42, deny: 0.1, gold: 0.75, buyback: false },
  normal: { think: [0.4, 0.6], abil: 1, items: 1, sum: 1, brave: 1.0, back: 1.15, chase: 0.25, flee: 0.3, deny: 0.35, gold: 1, buyback: true },   // v0.49: brave 0.8 → 1.0
  hard:   { think: [0.3, 0.42], abil: 1, items: 1, sum: 1, brave: 0.85, back: 1.3, chase: 0.32, flee: 0.25, deny: 0.5, gold: 1.25, buyback: true },  // v0.49: brave 0.65 → 0.85
};
function botDiff(u){ return (u.team !== myTeam && net.mode !== 'host' && BOT_DIFF[SETTINGS.diff]) || BOT_DIFF.normal; }
/* snaga junaka za procjenu borbe: level + vrijednost predmeta, puta koliko mu je ostalo života */
function botFightScore(h){ return (h.level + netWorth(h) / 800) * (0.35 + 0.65 * h.hp / h.maxhp); }
/* ⚖️ v0.49 procjena borbe: snaga NAŠIH junaka uz bota i PROTIVNIČKIH (vidljivih) uz metu. Prije se brojalo samo oko
   bota, a ranjena meta, gank i skok (Junački skok, juriš, treptaj) napadali su bez obzira na snagu — botovi su jedan po
   jedan uletali na jakog junaka i padali. Sada:
     engage — napadni: naša strana je dovoljno jaka (ili meta pada od nekoliko udaraca, a nismo puno slabiji)
     weaker — jasno slabiji: povuci se do suigrača ili iza svoje kule i pričekaj (4 s pamti koga se treba čuvati)
     risky  — otprilike izjednačeno: ne stoj u dometu njegovih udaraca */
function fightSides(u, t){
  let mine = 0, theirs = 0, allies = 0;
  for(const h of units){
    if(h.kind !== 'hero' || h.dead || h.removeMe) continue;
    if(h.team === u.team){ if(dist(h, u) < 900){ mine += botFightScore(h); allies++; } }
    else if(dist(h, t) < 900 && isVisibleTo(u.team, h) && !(h.status.invisT > 0 && h.status.trackT <= 0)) theirs += botFightScore(h);
  }
  return { mine, theirs, allies };
}
function botFightPlan(u, eh, bd){
  const fs = fightSides(u, eh);
  // ne ulazi pod neprijateljsku kulu za junakom (osim ako je skoro mrtav, a kula je zauzeta vojnicima)
  const ehTower = enemyTowerAt(u.team, eh.x, eh.y, 30);
  const dive = !ehTower || (eh.hp < eh.maxhp * 0.2 && u.hp > u.maxhp * 0.6 && ehTower.attackTarget && ehTower.attackTarget.kind === 'creep');
  const burst = (u.dmg * 3 + 40 * u.level) * fs.allies;   // otprilike što mi (i suigrači uz mene) napravimo u par sekundi
  const killable = eh.hp < eh.maxhp * bd.chase && eh.hp < burst && fs.mine >= fs.theirs * 0.6;
  const engage = dive && (killable || (u.hp > u.maxhp * 0.45 && fs.mine >= fs.theirs * bd.brave));
  return { engage, weaker: !engage && fs.theirs > fs.mine * bd.back, risky: !engage && fs.theirs > fs.mine * 0.9, fs };
}
/* kamo se povući kad smo slabiji: do najbližeg suigrača koji je dalje od opasnosti, inače iza svoje kule, inače kući */
function regroupPoint(u, eh){
  const f = FOUNTAIN[u.team];
  let best = null, bd = 1800;
  for(const h of units){
    if(h.kind !== 'hero' || h.team !== u.team || h === u || h.dead || h.removeMe) continue;
    const d = dist(u, h);
    if(d < bd && dist(h, eh) > dist(u, eh) + 100){ bd = d; best = h; }
  }
  if(best) return stepToward(best, f, 140);
  let tw = null, td = 2600;
  for(const t of units){
    if(t.kind !== 'tower' || t.team !== u.team || t.removeMe) continue;
    const d = dist(u, t);
    if(d < td && dist(t, eh) > dist(u, eh) - 200){ td = d; tw = t; }
  }
  if(tw) return stepToward(tw, f, 240);
  return stepToward(u, f, 450);
}
/* botovi koriste aktivne predmete (jednostavna pravila) */
function botUseItems(u, eh, plan){
  const dEh = eh ? dist(u, eh) : 1e9, hpF = u.hp / u.maxhp, mpF = u.maxmp ? u.mp / u.maxmp : 1;
  u.items.forEach((it, i) => {
    if(!it.active || it.pending || (u.itemCd[it.id] || 0) > 0 || u.mp < (it.active.mana || 0)) return;
    const fight = eh && dEh < 600;
    let aim = null, go = false;
    switch(it.id){
      case 'bkb': case 'mom': case 'satanic': case 'phase': case 'drum': go = fight && (it.id !== 'satanic' || hpF < 0.5); break;
      case 'mek': case 'wand': case 'bottle': go = hpF < 0.55 && (it.id !== 'wand' || itemCharges(u, 'wand') >= 5); break;
      case 'tango': {   // 🌿 pojedi drvo na dohvat ruke
        if(hpF > 0.6 || u.tangoT > 0) break;
        const tr = nearestTree(u.x, u.y, 165 + 24 + u.r);
        if(tr){ go = true; aim = { x: tr.x, y: tr.y }; }
        break;
      }
      case 'arcane': case 'soulring': case 'clarity': case 'mango': go = mpF < 0.35; break;
      case 'fairy': go = hpF < 0.25 && !!eh; break;
      case 'hood': go = fight && hpF < 0.75; break;
      case 'pipe': case 'greaves': {   // 🎺👢 kad tim (ili bot) strada
        const hurt = units.filter(e => e.kind === 'hero' && e.team === u.team && !e.dead && dist(u, e) < 1100 && e.hp < e.maxhp * 0.55).length;
        go = (fight && hurt >= 1) || hpF < 0.4 || (it.id === 'greaves' && hurt >= 2);
        break;
      }
      case 'glimmer': {   // 💫 spasi sebe ili ranjenog suigrača
        const mate = units.find(e => e.kind === 'hero' && e.team === u.team && !e.dead && dist(u, e) < 600 && e.hp < e.maxhp * 0.3 &&
          units.some(o => o.kind === 'hero' && o.team !== u.team && !o.dead && dist(o, e) < 700));
        if(mate){ go = true; aim = { x: mate.x, y: mate.y }; }
        break;
      }
      case 'mjollnir': go = fight; break;
      case 'orchid': case 'halberd': case 'atos': case 'diffusal':
        if(eh && dEh < (it.active.castRange || 600) && (eh.hp < eh.maxhp * 0.75 || (plan && plan.engage))){ go = true; aim = { x: eh.x, y: eh.y }; }
        break;
      case 'shiva': go = eh && dEh < 600; break;
      case 'refresher': go = fight && u.abilities.filter(a => a.def.ult && a.rank > 0 && a.cd > 10).length > 0; break;
      case 'dagon': case 'euls': case 'abyssal':
        if(eh && dEh < (it.active.castRange || 600) && eh.hp < eh.maxhp * 0.7){ go = true; aim = { x: eh.x, y: eh.y }; }
        break;
      case 'midas': {
        const c = nearestEnemyOf(u, 550, e => e.kind === 'creep' || (e.kind === 'neutral' && !e.boss && !e.drake));
        if(c && !fight){ go = true; aim = { x: c.x, y: c.y }; }
        break;
      }
      case 'shadowblade': go = eh && dEh < 900 && dEh > 350 && hpF > 0.5 && !!plan && (plan.engage || plan.weaker); break;   // ulazak u borbu ili bijeg
      case 'blink':   // ⚡ inicijatori (Bikoš, Rogo, Tutnjo…) treptajem uskoče u borbu, pa odmah bace moć oko sebe
        if(eh && plan && plan.engage && dEh > 320 && dEh < 1000 && hpF > 0.6 && u.abilities.some(a => a.rank > 0 && a.cd <= 0 && a.def.selfAoe && a.def.bot && /aoe/.test(a.def.bot.type))){ go = true; aim = { x: eh.x, y: eh.y }; }   // v0.49: samo kad tim ide u borbu
        break;
    }
    if(go) useItem(u, i, aim || { x: u.x + Math.cos(u.dir || 0) * 100, y: u.y + Math.sin(u.dir || 0) * 100 });
  });
}
function botThink(u){
  const b = u.bot;
  const fountain = FOUNTAIN[u.team];
  if(u.tpChannel > 0 || u.chan) return;   // ne prekidaj vlastiti teleport ni nišanjenje
  if(b.state === 'retreat'){
    if(u.hp > u.maxhp * 0.9){ b.state = 'lane'; }
    else {
      botUseSummoners(u, nearestEnemyOf(u, 700, e => e.kind === 'hero'));
      u.attackTarget = null;
      // daleko od kuće? teleportiraj se umjesto pješačenja
      if(u.tpCd <= 0 && distXY(u.x, u.y, fountain.x, fountain.y) > 1200 &&
         !nearestEnemyOf(u, 500, e => e.kind === 'hero')){
        startTeleport(u);
        return;
      }
      u.moveTarget = { x: fountain.x, y: fountain.y };
      return;
    }
  }
  // 🧪 ljekoviti melem (kupuje se bilo gdje) umjesto dugog pješačenja do fontane
  const pot = ITEM_BY_ID.potion;
  if(u.hp < u.maxhp * 0.42 && u.gold >= pot.cost + 60 && gameTime > (u.potT || 0) && b.state !== 'retreat'){
    u.potT = gameTime + 9; u.gold -= pot.cost; heal(u, pot.heal);
  }
  const bd = botDiff(u);   // 🤖 težina
  if(u.hp < u.maxhp * bd.flee){
    if(Math.random() < 0.3 && dist(u, player || u) < 2500 && gameTime - botHelpT[u.team] > 25){ botHelpT[u.team] = gameTime; say(u, CHAT_LINES[1]); addPing(u, u.x, u.y); }   // 🆘
    b.state = 'retreat';
    u.attackTarget = null;
    u.moveTarget = { x: fountain.x, y: fountain.y };
    return;
  }
  botShopping(u);
  const eh = nearestEnemyOf(u, 620, e => e.kind === 'hero');
  const plan = eh ? botFightPlan(u, eh, bd) : null;   // ⚖️ v0.49: borimo li se uopće?
  if(Math.random() < bd.abil) botUseAbilities(u, eh, plan);
  if(Math.random() < bd.items) botUseItems(u, eh, plan);
  if(Math.random() < bd.sum) botUseSummoners(u, eh);

  const tw = nearestEnemyOf(u, 430, e => e.kind === 'tower');
  if(tw && countOwnCreepsNear(u.team, tw, 320) === 0){
    u.attackTarget = null;
    u.moveTarget = stepToward(u, fountain, 300);
    return;
  }
  // 🗼 v0.38: kula gađa MENE (jako boli rano) — odmah van dometa, osim ako baš dokrajčujem junaka
  const shotBy = units.find(t => t.kind === 'tower' && t.team !== u.team && !t.removeMe && t.attackTarget === u);
  if(shotBy && !(eh && eh.hp < eh.maxhp * 0.12 && dist(u, eh) < u.atkRange + 60 && u.hp > u.maxhp * 0.5)){
    u.attackTarget = null;
    u.moveTarget = stepToward(shotBy, u, shotBy.atkRange + 140);
    return;
  }
  if(b.goTo && gameTime < b.goT && !eh){   // 📍 igrač je pingao mjesto: dođi
    if(distXY(u.x, u.y, b.goTo.x, b.goTo.y) > 200){ u.attackTarget = null; u.moveTarget = b.goTo; return; }
    b.goTo = null;
  }
  if(followOrder(u, eh)) return;   // 🤖 zadatak tima: gank, obrana, guranje, zmaj
  if(eh){
    // ⚖️ v0.49: napadni samo kad je naša strana dovoljno jaka; slabiji se ne zalijeće sam nego se povuče do suigrača ili kule
    if(plan.engage){ u.attackTarget = eh; return; }
    if(plan.weaker){
      b.fear = { h: eh, until: gameTime + 4 };
      u.attackTarget = null;
      u.moveTarget = regroupPoint(u, eh);
      return;
    }
    if(plan.risky && dist(u, eh) < eh.atkRange + eh.r + 160){   // izjednačeno: izvan dometa njegovih udaraca
      u.attackTarget = null;
      u.moveTarget = stepToward(u, fountain, 240);
      return;
    }
  }
  const fear = b.fear && gameTime < b.fear.until && !b.fear.h.dead && !b.fear.h.removeMe ? b.fear.h : null;   // jači junak kojeg izbjegavam
  if(!eh){   // 💰📘 uzmi runu u blizini
    let rn = null, bd = 650;
    for(const r of extraRunes){ const d = distXY(u.x, u.y, r.x, r.y); if(d < bd){ bd = d; rn = r; } }
    if(rn){ u.attackTarget = null; u.moveTarget = { x: rn.x, y: rn.y }; return; }
    if(!b.order && botRune(u)) return;   // ✨ v0.51: čarobna runa na rijeci (ne usred zadatka tima)
  }
  if(!eh && gameClock() > 300 && u.level >= 6){   // 🐉 zmajčić: botovi ga love u paru (ili sami kad su jaki)
    const dc = camps.find(c => c.type === 'drake'), dr = dc && dc.units[0];
    if(dr && !dr.dead && !dr.removeMe && u.hp > u.maxhp * (u.attackTarget === dr ? 0.35 : 0.7) && dist(u, dr) < 1300){
      const allies = units.reduce((a, h) => a + (h.kind === 'hero' && h.team === u.team && !h.dead && dist(h, dr) < 1300 ? 1 : 0), 0);
      if(allies >= 2 || u.level >= 11){ u.attackTarget = dr; return; }
    }
  }
  const anc = ancients[1 - u.team];
  if(isTargetable(anc) && dist(u, anc) < 700){
    u.attackTarget = anc;
    return;
  }
  if(u.jungler && !b.order && !(eh && plan && plan.engage) && botJungle(u, fear)) return;   // 🌲 v0.56: junak u džungli
  if(Math.random() < bd.deny){   // ⛔ botovi ponekad uskrate vlastitog vojnika (kao pravi igrači)
    const dn = deniableNear(u, u.atkRange + 120);
    if(dn){ u.attackTarget = dn; return; }
  }
  const lh = lowestHpEnemyCreep(u, 500);
  if(lh && !(fear && dist(lh, fear) < fear.atkRange + 260)){ u.attackTarget = lh; return; }
  const et = nearestEnemyOf(u, 520, e => e.kind === 'tower' || e.kind === 'barracks');
  if(et && countOwnCreepsNear(u.team, et, 350) > 0 && !(fear && dist(et, fear) < 700)){
    u.attackTarget = et;
    return;
  }
  // 🌲 v0.51: džungla po procjeni — kad na stazi nema posla (ili je izgubljena), kamp koji bot sam može očistiti;
  //   ne usred zadatka tima (guranje, obrana) — tada ostaje uz val ili kulu
  if(!eh && !b.order && botJungle(u, fear)) return;
  u.attackTarget = null;
  // stani IZA svojih vojnika (kao pravi DotA igrač), ne ispred njih
  const fp = laneFront(u.team, u.lane);
  let dest = stepToward(fp, FOUNTAIN[u.team], 90 + u.atkRange * 0.45);
  if(fear && dist(dest, fear) < fear.atkRange + 420) dest = regroupPoint(u, fear);   // ne vraćaj se sam pred jačeg
  if(dist(u, dest) > 130) u.moveTarget = dest;
  else u.moveTarget = null;
}

/* ================= Predmeti i recepti ================= */
function recomputeItemStats(h){
  const nb = { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 };
  const ia = { str: 0, agi: 0, int: 0 };
  let aspd = 0, armor = 0, ls = 0, ev = 0;
  let mres = 0, cdr = 0, amp = 0;   // v0.56: otpor magiji (množi se), kraće hlađenje (najjače), jačina magija (zbraja se)
  const fx = { chain: null, cold: null, mburn: null, crit: [], bash: null, cleave: 0, creepDmg: 0, hunt: null, corrupt: null, block: null, trueStrike: false, proc: null, aura: [], wand: false };
  const prim = h.hero ? h.hero.attrs.primary : 'str';
  for(const it of h.neutral ? h.items.concat([h.neutral]) : h.items){
    if(it.pending) continue;   // 🫏 još kod kurira
    const s = it.stats || {};
    for(const k in nb) if(s[k]) nb[k] += s[k];
    if(s.all){ ia.str += s.all; ia.agi += s.all; ia.int += s.all; }
    if(s.str) ia.str += s.str;
    if(s.agi) ia.agi += s.agi;
    if(s.int) ia.int += s.int;
    if(s.primary) ia[prim] += s.primary;
    aspd += s.aspd || 0; armor += s.armor || 0;
    ls = Math.max(ls, s.lifesteal || 0);                       // krađa života se ne zbraja (kao u DotA)
    ev = 1 - (1 - ev) * (1 - (s.evasion || 0));
    mres = 1 - (1 - mres) * (1 - (s.mres || 0)); cdr = Math.max(cdr, s.cdr || 0); amp += s.amp || 0;
    if(it.chain && (!fx.chain || it.chain.dmg > fx.chain.dmg)) fx.chain = it.chain;   // ⛈️ Olujni čekić / 🌩️ Gromovnik
    if(it.cold) fx.cold = it.cold;      // 🧊 Ledeno srce
    if(it.mburn) fx.mburn = it.mburn;   // 🪀 Oštrica ispijanja
    // pasivni efekti (DotA pravila: najjači krit, jedan tresak, zbrojeni sjekirica-bonus…)
    if(it.crit) fx.crit.push(it.crit);
    if(it.bash && !fx.bash) fx.bash = it.bash;
    if(it.cleave) fx.cleave = Math.max(fx.cleave, it.cleave);
    if(it.creepDmg) fx.creepDmg = Math.max(fx.creepDmg, it.creepDmg);
    if(it.hunt) fx.hunt = it.hunt;   // 🐾 Lovački nož (ne zbraja se)
    if(it.corrupt) fx.corrupt = it.corrupt;
    if(it.block && (!fx.block || it.block.a > fx.block.a)) fx.block = it.block;
    if(it.trueStrike) fx.trueStrike = true;
    if(it.proc) fx.proc = it.proc;
    if(it.aura) fx.aura.push(it.aura);
    if(it.wand) fx.wand = true;
  }
  if(h.hero){
    h.itemAttr = ia; h.itemAspd = aspd; h.itemArmor = armor; h.lifesteal = ls; h.evasion = ev; h.ifx = fx;
    h.mres = mres; h.itemCdr = cdr; h.itemAmp = amp;
  }
  const ob = h.itemBonus;
  h.dmg += nb.dmg - ob.dmg;
  h.maxhp += nb.hp - ob.hp;
  h.hp = clamp(h.hp + Math.max(0, nb.hp - ob.hp), 1, h.maxhp);
  h.maxmp += nb.mp - ob.mp;
  h.mp = clamp(h.mp + Math.max(0, nb.mp - ob.mp), 0, h.maxmp);
  h.speed += nb.speed - ob.speed;
  h.hpRegen += nb.hpRegen - ob.hpRegen;
  h.mpRegen += nb.mpRegen - ob.mpRegen;
  h.itemBonus = nb;
  if(h.hero) recomputeAttrStats(h);   // atributi s predmeta (snaga → život, okretnost → brzina napada i oklop…)
}
/* 🛡️ oklop kao u DotA: smanjuje štetu fizičkih udaraca (negativan oklop je povećava) */
function armorMul(armor){ return 1 - 0.06 * armor / (1 + 0.06 * Math.abs(armor)); }
function unitArmor(u){
  return (u.armor || 0) + (u.auraArmor || 0) - (u.corruptT > 0 ? u.corruptA : 0) + (u.armorBuffT > 0 ? u.armorBuff : 0);   // 🗯️ Bojni zov: jaki oklop
}
/* ukupni atributi (vlastiti + s predmeta) — za HUD */
function totalAttr(h, k){ return h[k] + ((h.itemAttr && h.itemAttr[k]) || 0); }
function itemFullCost(item){
  let c = item.cost;
  if(item.components) for(const cid of item.components) c += itemFullCost(ITEM_BY_ID[cid]);
  return c;
}
const BACKPACK_SLOTS = 3;
function planPurchase(h, item){
  const inv = h.items.concat(h.backpack || []).map(it => it.id);   // dijelovi recepta mogu biti i u ruksaku
  let cost = item.cost;
  function needComp(id){
    const idx = inv.indexOf(id);
    if(idx >= 0){ inv.splice(idx, 1); return; }
    const def = ITEM_BY_ID[id];
    cost += def.cost;
    if(def.components) for(const c of def.components) needComp(c);
  }
  if(item.components) for(const c of item.components) needComp(c);
  const slotsOk = inv.length + 1 <= CFG.inventorySlots + (h.backpack ? BACKPACK_SLOTS : 0);
  let tagOk = true;
  if(item.tag) tagOk = !inv.some(id => ITEM_BY_ID[id].tag === item.tag);
  return { cost, inv, slotsOk, tagOk, ok: slotsOk && tagOk };
}
function doPurchase(h, item, plan){
  const left = plan.inv.slice();   // preostali predmeti ostaju isti objekti (i oni što čekaju kurira)
  const keepOf = arr => arr.filter(it => { const k = left.indexOf(it.id); if(k >= 0){ left.splice(k, 1); return true; } return false; });
  h.items = keepOf(h.items);
  if(h.backpack) h.backpack = keepOf(h.backpack);
  giveItem(h, isHuman(h) && !h.dead && !nearBase(h) ? pendingItem(item) : item);
  h.gold -= plan.cost;
  recomputeItemStats(h);
}
/* stavi predmet u torbu (ili u ruksak ako je torba puna) */
function giveItem(h, item){
  if(h.items.length < CFG.inventorySlots){ h.items.push(item); return true; }
  if(h.backpack && h.backpack.length < BACKPACK_SLOTS){ h.backpack.push(item); return true; }
  return false;
}
/* 🎒 premještanje: mjesta 0–5 su torba, 6–8 ruksak (kao povlačenje mišem u DotA) */
function swapItems(h, a, b){
  if(!h || a === b || gameOver) return;
  const N = CFG.inventorySlots, bp = h.backpack || (h.backpack = []);
  const get = i => i < N ? h.items[i] : bp[i - N];
  const A = get(a), B = get(b);
  if(!A) return;
  const arrA = a < N ? h.items : bp, ia = a < N ? a : a - N;
  const arrB = b < N ? h.items : bp, ib = b < N ? b : b - N;
  if(B){ arrA[ia] = B; arrB[ib] = A; }                       // zamjena
  else if(arrA !== arrB){                                      // na prazno mjesto u drugom spremniku
    if(arrB.length >= (b < N ? N : BACKPACK_SLOTS)) return;
    arrA.splice(ia, 1); arrB.push(A);
  } else { arrA.splice(ia, 1); arrA.push(A); }                 // na kraj istog spremnika
  recomputeItemStats(h);
  if(h.isPlayer) refreshShop();
}
function firstMissingLeaf(h, item){
  const inv = h.items.concat(h.backpack || []).map(it => it.id);
  let found = null;
  (function walk(it){
    if(found) return;
    const idx = inv.indexOf(it.id);
    if(idx >= 0){ inv.splice(idx, 1); return; }
    if(!it.components){ found = it; return; }
    for(const c of it.components){
      walk(ITEM_BY_ID[c]);
      if(found) return;
    }
  })(item);
  return found;
}
function botShopping(u){
  if(!u.startBought){   // 🌿 početni tango (kao svaki junak u DotA)
    u.startBought = true;
    const hk = ITEM_BY_ID.hunter;   // 🌲 junak u džungli prvo kupi Lovački nož
    if(u.jungler && planPurchase(u, hk).ok) doPurchase(u, hk, planPurchase(u, hk));
    const tg = ITEM_BY_ID.tango;
    if(u.gold >= tg.cost + 255 && planPurchase(u, tg).ok) doPurchase(u, tg, planPurchase(u, tg));
  }
  let guard = 0;
  const build = u.build || (u.hero && u.hero.build) || BOT_BUILD;
  while(guard++ < 5 && u.buildI < build.length){
    const target = ITEM_BY_ID[build[u.buildI]];
    const plan = planPurchase(u, target);
    if(plan.ok && u.gold >= plan.cost){
      doPurchase(u, target, plan);
      u.buildI++;
      continue;
    }
    const leaf = firstMissingLeaf(u, target);
    if(leaf && leaf.id !== target.id){
      const lp = planPurchase(u, leaf);
      if(lp.ok && u.gold >= lp.cost){ doPurchase(u, leaf, lp); continue; }
    }
    break;
  }
}
function tryBuy(h, item){
  if(!h || gameOver) return;
  if(item.instant){
    if(h.gold < item.cost){
      addFloat(h.x, h.y, L('Nemaš dovoljno zlata! 💰', 'Not enough gold! 💰'), '#fca5a5', 14);
      if(h.isPlayer) sfx('click');
      return;
    }
    h.gold -= item.cost;
    heal(h, item.heal);
    if(h.isPlayer) sfx('buy');
    refreshShop();
    return;
  }
  if(item.charges && h.items.concat(h.backpack || []).some(i => i.id === item.id)){   // već imaš: kupnja = dopuna
    if(itemCharges(h, item.id) >= item.charges){ addFloat(h.x, h.y, item.emoji + L(' već je pun!', ' is already full!'), '#e5e7eb', 14); return; }
    if(h.gold < item.cost){ addFloat(h.x, h.y, L('Nemaš dovoljno zlata! 💰', 'Not enough gold! 💰'), '#fca5a5', 14); return; }
    h.gold -= item.cost; h.itemCharges[item.id] = item.charges;
    addFloat(h.x, h.y, item.emoji + L(' Dopunjeno!', ' Refilled!'), '#fde047', 15);
    if(h.isPlayer) sfx('buy');
    refreshShop();
    return;
  }
  const plan = planPurchase(h, item);
  if(!plan.tagOk){ addFloat(h.x, h.y, L('Već imaš čizme! 😄', 'You already have boots! 😄'), '#e5e7eb', 14); return; }
  if(!plan.slotsOk){ addFloat(h.x, h.y, L('Torba i ruksak su puni! 🎒', 'Inventory and backpack are full! 🎒'), '#fca5a5', 14); return; }
  if(h.gold < plan.cost){
    addFloat(h.x, h.y, L('Nemaš dovoljno zlata! 💰', 'Not enough gold! 💰'), '#fca5a5', 14);
    if(h.isPlayer) sfx('click');
    return;
  }
  doPurchase(h, item, plan);
  if(hasPending(h)) addFloat(h.x, h.y, '🫏 ' + item.emoji + L(' čeka kurira…', ' waits for the courier…'), '#fde68a', 15);
  else addFloat(h.x, h.y, item.emoji + ' ' + item.name + '!', '#fde047', 15);
  if(h.isPlayer) sfx('buy');
  refreshShop();
}
function sellItem(h, idx){
  if(!h || gameOver) return;
  const N = CFG.inventorySlots, arr = idx < N ? h.items : (h.backpack || []), k = idx < N ? idx : idx - N;
  const it = arr[k];
  if(!it) return;
  const v = Math.floor(itemFullCost(it) / 2);
  arr.splice(k, 1);
  delete h.itemCharges[it.id];
  recomputeItemStats(h);
  h.gold += v;
  addFloat(h.x, h.y, L('Prodano ', 'Sold ') + it.emoji + ' +' + v + ' 💰', '#fde047', 14);
  if(h.isPlayer) sfx('buy');
  refreshShop();
}

/* ================= Glavna logika ================= */
function updateUnit(u, dt){
  if(u.dead){
    if(u.kind === 'hero'){
      u.deadT -= dt;
      if(u.buybackCd > 0) u.buybackCd -= dt;
      // botovi se otkupljuju kasnije u igri kad su bogati
      if(u.bot && botDiff(u).buyback && u.deadT > 12 && gameClock() > 420 && u.buybackCd <= 0 && u.gold > buybackCost(u) * 2.5) buyback(u);
      else if(u.deadT <= 0) respawn(u);
    }
    return;
  }
  const st = u.status;
  st.stun = Math.max(0, st.stun - dt);
  st.slowT = Math.max(0, st.slowT - dt);
  st.rootT = Math.max(0, st.rootT - dt);
  st.shieldT = Math.max(0, st.shieldT - dt);
  st.hasteT = Math.max(0, st.hasteT - dt);
  st.dmgMulT = Math.max(0, st.dmgMulT - dt);
  st.invisT = Math.max(0, st.invisT - dt);
  st.trackT = Math.max(0, st.trackT - dt);
  st.silenceT = Math.max(0, st.silenceT - dt);
  st.immuneT = Math.max(0, st.immuneT - dt);
  st.curseT = Math.max(0, st.curseT - dt); if(st.curseT <= 0) st.curseF = 0;
  st.blindT = Math.max(0, st.blindT - dt); if(st.blindT <= 0) st.blindF = 0;
  st.formT = Math.max(0, st.formT - dt);
  st.rageT = Math.max(0, st.rageT - dt);
  if(st.poisonT > 0){   // 🤢 otrov: šteta svakih pola sekunde
    st.poisonT = Math.max(0, st.poisonT - dt);
    st.poisonAcc += dt;
    if(st.poisonAcc >= 0.5){
      st.poisonAcc -= 0.5;
      applyDamage(u, st.poisonDps * 0.5, st.poisonSrc && !st.poisonSrc.removeMe ? st.poisonSrc : null);
      if(u.dead || u.removeMe) return;
    }
  }
  if(u.causticT > 0){ u.causticT -= dt; if(u.causticT <= 0) causticBurst(u, 0.5); if(u.dead || u.removeMe) return; }   // 🧪 Otrovni prasak
  u.flash = Math.max(0, u.flash - dt);
  if(u.bot && u.kind === 'hero'){   // 🤖 težina: protivnički botovi na "Lako" zarađuju manje zlata, na "Teško" više
    const gm = botDiff(u).gold;
    if(gm !== 1 && u.goldSeen != null && u.gold > u.goldSeen) u.gold = u.goldSeen + (u.gold - u.goldSeen) * gm;
    u.goldSeen = u.gold;
  }
  if(u.danceCd > 0) u.danceCd -= dt;
  if(u.danceT > 0){   // 💃 ples prestaje čim se junak makne, napadne, bude omamljen ili teleportira
    u.danceT -= dt;
    if(u.moveTarget || u.attackTarget || st.stun > 0 || u.tpChannel > 0) u.danceT = 0;
  }
  u.atkTimer -= dt;
  if(u.cycloneT > 0) u.cycloneT -= dt;          // 🌪️ vihor
  if(u.sumCd){ u.sumCd[0] = Math.max(0, u.sumCd[0] - dt); u.sumCd[1] = Math.max(0, u.sumCd[1] - dt); }
  if(u.barrierT > 0){ u.barrierT -= dt; if(u.barrierT <= 0) u.barrierHp = 0; }
  if(st.disarmT > 0) st.disarmT = Math.max(0, st.disarmT - dt);   // ⚜️ v0.56 razoružan
  if(u.staticT > 0) u.staticT -= dt;                               // 🌩️ statički štit (Gromovnik)
  if(u.gwT > 0) u.gwT -= dt;
  if(u.jbuff){
    if(u.jbuff.blue > 0){ u.jbuff.blue -= dt; u.mp = Math.min(u.maxmp, u.mp + 4 * dt); }
    if(u.jbuff.red > 0){ u.jbuff.red -= dt; u.hp = Math.min(u.maxhp, u.hp + 3 * dt); }
    const wd = drakeN(u.team, 'water');   // 💧 vodeni zmajčići
    if(wd){ u.hp = Math.min(u.maxhp, u.hp + 3 * wd * dt); u.mp = Math.min(u.maxmp, u.mp + 1.5 * wd * dt); }
  }
  if(u.weakT > 0) u.weakT -= dt;
  if(u.armorBuffT > 0) u.armorBuffT -= dt;      // 🗯️ Bojni zov: oklop
  if(u.hungerT > 0){                            // 🍖 Ratna glad: gubi život dok ne pobijedi nekoga
    u.hungerT -= dt; u.hungerAcc = (u.hungerAcc || 0) + dt;
    if(u.hungerAcc >= 0.5){
      u.hungerAcc -= 0.5;
      applyDamage(u, u.hungerDps * 0.5, u.hungerSrc && !u.hungerSrc.removeMe ? u.hungerSrc : null);
      if(u.dead || u.removeMe) return;
    }
  }
  if(u.corruptT > 0) u.corruptT -= dt;          // 🌘 skinut oklop
  if(u.lsBoostT > 0) u.lsBoostT -= dt;          // 🦇 žeđ
  if(u.sbBonus && st.invisT <= 0) u.sbBonus = 0;
  if(u.auraMp) u.mp = Math.min(u.maxmp, u.mp + u.auraMp * dt);

  if(u.hpRegen) u.hp = Math.min(u.maxhp, u.hp + u.hpRegen * dt);
  if(u.mpRegen) u.mp = Math.min(u.maxmp, u.mp + u.mpRegen * dt);

  if(u.kind === 'hero'){
    for(const ab of u.abilities) ab.cd = Math.max(0, ab.cd - dt);
    u.tpCd = Math.max(0, u.tpCd - dt);
    for(const k in u.itemCd) u.itemCd[k] = Math.max(0, u.itemCd[k] - dt);
    if(u.buybackCd > 0) u.buybackCd -= dt;
    if(u.aegis){
      u.aegisT -= dt;
      if(u.aegisT <= 0){ u.aegis = false; if(isHuman(u)) addFloat(u.x, u.y, L('🛡️ Zmajev štit je istekao', '🛡️ The Dragon Shield expired'), '#e5e7eb', 13, u.team); }
    }
    const med = passiveRank(u, 'med');   // Med (Zuja E): aura liječenja
    if(med) for(const e of units){
      if(e.kind === 'hero' && e.team === u.team && !e.dead && dist(u, e) <= 300) e.hp = Math.min(e.maxhp, e.hp + (1 + med) * dt);
    }
    const cop = passiveRank(u, 'copor');       // Čopor (Sivko E): obnova života
    if(cop) u.hp = Math.min(u.maxhp, u.hp + (2 + 2 * cop) * dt);   // ⚖️ v0.45: jača obnova (bilo 1 + rang)
    if(u.frenzyT > 0) u.frenzyT -= dt;
    if(u.cloud) updateCloud(u, dt);              // 🤢⏳ oblak oko junaka (v0.55)
    if(u.frostT > 0) u.frostT -= dt;             // ❄️ Ledene strijele (Inja)
    if(u.precT > 0) u.precT -= dt;               // 🎯 Aura preciznosti
    const prec = passiveRank(u, 'precizna');
    if(prec) for(const e of units){
      if(e.kind === 'hero' && e.team === u.team && !e.dead && e.projSpeed > 0 && dist(u, e) <= 900){ e.precT = 0.5; e.precF = 0.03 + 0.02 * prec; }
    }
    if(u.epi){                                   // 🌋 Epicentar (Škorpo R): valovi sve većeg kruga
      const p = u.epi;
      p.t -= dt;
      if(p.t <= 0){
        p.t = 0.4;
        const r = 250 + 200 * (p.n > 1 ? p.i / (p.n - 1) : 1);
        const prev = abCtx; abCtx = { src: u, key: 'R' };
        damageCircle(u, u.x, u.y, r, p.dmg, { slow: { f: 0.3, t: 1 }, color: '#f59e0b' });
        abCtx = prev;
        u.epiN = (u.epiN || 0) + 1; u.epiR = r;
        if(++p.i >= p.n) u.epi = null;
      }
    }
    if(u.aspdT > 0) u.aspdT -= dt;
    if(u.dodgeT > 0) u.dodgeT -= dt;
    const kor = passiveRank(u, 'korijen');     // Korijeni (Listko): liječenje kad stoji
    if(kor){
      const moved = Math.abs(u.x - (u.lastX || 0)) + Math.abs(u.y - (u.lastY || 0)) > 0.5;
      u.stillT = moved ? 0 : (u.stillT || 0) + dt;
      if(u.stillT > 0.8){ u.hp = Math.min(u.maxhp, u.hp + (3 + 2 * kor) * dt); u.mp = Math.min(u.maxmp, u.mp + (1 + kor) * dt); }
      u.lastX = u.x; u.lastY = u.y;
    }
    const voda = passiveRank(u, 'voda');       // Vodozemac (Skokica): liječi se u rijeci
    if(voda && inRiver(u.x, u.y)) u.hp = Math.min(u.maxhp, u.hp + (2 + 2 * voda) * dt);
    const vid = passiveRank(u, 'vid');         // Orlovski vid (Orlina): veći domet
    if(u.scopeT > 0) u.scopeT -= dt;           // 🔭 Durbin (Nišan)
    updateTravel(u, dt);                       // 💨 putovanje izvan borbe
    u.atkRange = u.hero.range + 30 * vid + (u.talRange || 0) + (u.scopeT > 0 ? u.scopeR : 0);   // 🎓 talent dometa
    const griva = passiveRank(u, 'griva');     // Čarobna griva (Duga E): aura mane
    if(griva) for(const e of units){
      if(e.kind === 'hero' && e.team === u.team && !e.dead && dist(u, e) <= 450) e.mp = Math.min(e.maxmp, e.mp + (0.5 + 0.75 * griva) * dt);
    }
    const bam = passiveRank(u, 'bambus');      // Bambus (Panda E): obnova života i mane
    if(bam){ u.hp = Math.min(u.maxhp, u.hp + (1.5 + bam) * dt); u.mp = Math.min(u.maxmp, u.mp + (0.5 + 0.5 * bam) * dt); }
    if(u.howlT > 0) u.howlT -= dt;
    if(u.noInvisT > 0){ u.noInvisT -= dt; st.invisT = 0; }   // 🌫️ prašina: ne može se sakriti
    // ☀️ Sunčev kamen: žari neprijatelje oko sebe
    const sun = u.items.find(i => i.burn);
    if(sun){
      u.burnAcc += dt;
      if(u.burnAcc >= 0.5){
        u.burnAcc -= 0.5;
        for(const e of units){
          if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
          if(dist(u, e) <= sun.burnR) applyDamage(e, sun.burn * 0.5, u);
        }
      }
    }
    const f = FOUNTAIN[u.team];
    if(distXY(u.x, u.y, f.x, f.y) < CFG.fountainRadius){
      u.hp = Math.min(u.maxhp, u.hp + u.maxhp * CFG.fountainHeal * dt);
      u.mp = Math.min(u.maxmp, u.mp + u.maxmp * CFG.fountainHeal * dt);
      for(const it of u.items) if(it.charges && !it.consume && itemCharges(u, it.id) < it.charges){   // 🍼 Čutura se puni
        u.itemCharges[it.id] = it.charges;
        if(isHuman(u)) addFloat(u.x, u.y, it.emoji + L(' Napunjeno!', ' Refilled!'), '#7dd3fc', 13, u.team);
      }
    }
    if(u.tangoT > 0){ u.tangoT -= dt; u.hp = Math.min(u.maxhp, u.hp + 7.2 * dt); }        // 🌿 Šumska grickalica
    if(u.clarityT > 0){ u.clarityT -= dt; u.mp = Math.min(u.maxmp, u.mp + 7.5 * dt); }    // 💧 Plava kap
    if(u.runeRegenT > 0){
      u.runeRegenT -= dt;
      u.hp = Math.min(u.maxhp, u.hp + u.maxhp * 0.06 * dt);
      u.mp = Math.min(u.maxmp, u.mp + u.maxmp * 0.06 * dt);
    }
    if(gameTime > 0) u.gold += (CFG.passiveGold + (u.talGold || 0)) * dt;   // pasivno zlato teče od 0:00 (ne u pripremi)
  }

  if(isStructure(u) && u.hp < u.maxhp){   // 🛡️ backdoor: sama obnova dok nema neprijateljskih vojnika
    u.bdChkT = (u.bdChkT || 0) - dt;
    if(u.bdChkT <= 0){ u.bdChkT = 0.5; u.bdProt = backdoorProtected(u); }
    if(u.bdProt) u.hp = Math.min(u.maxhp, u.hp + CFG.backdoorRegen * dt);
  }
  if(u.kind === 'tower'){
    u.scanT -= dt;
    if(u.scanT <= 0){ u.scanT = 0.25; towerThink(u); }
    else if(u.attackTarget && u.atkTimer <= 0) towerThink(u);
    return;
  }
  if(u.kind === 'ancient') return;
  if(u.drag && updateDrag(u, dt)) return;   // 🪝 vuče ga Udica
  if(st.stun > 0){
    if(u.kind === 'hero' && u.tpChannel > 0) cancelTeleport(u);   // omama prekida teleport
    if(u.chan) cancelChannel(u, chanMsg(u.chan));
    u.charge = null;
    u.windup = null;   // omama prekida i zamah napada
    return;
  }
  if(u.windup){   // ⚔️ zamah napada: udarac pada u kadru udarca animacije
    if(gameTime >= u.windup.t){
      const w = u.windup; u.windup = null;
      w.deliver();
      if(u.dead || u.removeMe) return;
    } else if(u.attackTarget === u.windup.target && !u.charge) return;   // stoji dok zamahuje
  }
  if(u.charge && updateCharge(u, dt)) return;   // 🏃 juriš: ništa drugo dok traje
  if(u.chan){   // 🎯 kanaliziranje (Savršen hitac): stoji i nišani — v0.55: i Veliki zalogaj, Lepeza strijela, Epicentar
    const c = u.chan, t = c.target, o = c.o;
    if(st.silenceT > 0 || !t || t.dead || t.removeMe) cancelChannel(u, st.silenceT > 0 ? '🤐 ' + chanMsg(c).replace(/^\S+\s/, '') : null);
    else {
      if(o && o.dir != null) u.dir = o.dir;
      else if(t !== u) u.dir = Math.atan2(t.y - u.y, t.x - u.x);
      c.t -= dt;
      if(o && o.tick){
        const prev = abCtx; abCtx = c.key ? { src: u, key: c.key } : null;
        o.tick(t, dt, c);
        abCtx = prev;
        if(u.dead || u.removeMe || u.chan !== c) return;
      }
      if(c.t <= 0){
        u.chan = null;
        const prev = abCtx; abCtx = c.key ? { src: u, key: c.key } : null;
        if(c.onDone) c.onDone(t);
        abCtx = prev;
        if(!o){ u.atkN = (u.atkN || 0) + 1; u.atkHeavy = true; u.atkInt = 0.6; }   // 3D: hitac nakon nišanjenja
      }
      return;
    }
  }

  // kanaliziranje teleporta: stoji i čeka, pa kući
  if(u.kind === 'hero' && u.tpChannel > 0){
    u.tpChannel -= dt;
    if(Math.random() < dt * 3) ring(u.x, u.y, rand(50, 90), '#60a5fa');
    if(Math.random() < dt * 8) burst(u.x, u.y, '#60a5fa', 3, 80, 4);
    if(u.tpChannel <= 0){
      burst(u.x, u.y, '#60a5fa', 22, 260, 6);
      const d = u.tpDest && !u.tpDest.removeMe && !u.tpDest.dead ? u.tpDest : null;
      if(d){   // 🏰 do građevine: stane malo iza nje (prema svojoj bazi)
        const p = stepToward(d, FOUNTAIN[u.team], d.r + 60);
        u.x = clamp(p.x + rand(-40, 40), 40, WORLD - 40); u.y = clamp(p.y + rand(-40, 40), 40, WORLD - 40);
      } else {
        const f = FOUNTAIN[u.team];
        u.x = f.x + rand(-50, 50);
        u.y = f.y + rand(-50, 50);
      }
      burst(u.x, u.y, '#60a5fa', 22, 260, 6);
      u.tpChannel = 0; u.tpDest = null;
      u.tpCd = 60;
      if(isHuman(u)){ addFloat(u.x, u.y, d ? L('Stigao! 🏰', 'Arrived! 🏰') : L('Doma! 🏠', 'Home! 🏠'), '#93c5fd', 15, u.team); if(u.isPlayer){ sfx('heal'); } }
    }
    return;
  }

  if(u.kind === 'creep'){
    if(u.summonOf){   // prizvani: ograničen vijek
      u.lifeT -= dt;
      if(u.lifeT <= 0){ u.removeMe = true; burst(u.x, u.y, '#f59e0b', 8, 120, 4); return; }
    }
    u.scanT -= dt;
    if(u.scanT <= 0){ u.scanT = 0.35; if(u.summonOf) summonThink(u); else creepThink(u); }
  } else if(u.kind === 'neutral'){
    u.scanT -= dt;
    if(u.scanT <= 0){ u.scanT = 0.4; neutralThink(u); }
    if(u.returning) u.hp = Math.min(u.maxhp, u.hp + u.maxhp * 0.35 * dt);
  } else if(u.kind === 'hero' && u.bot){
    u.bot.thinkT -= dt;
    if(u.bot.thinkT <= 0){ const th = botDiff(u).think; u.bot.thinkT = rand(th[0], th[1]); botThink(u); }
  }

  if(u.useOrder){   // 🌿 ide do drveta (tango / sjekirica), pa ga pojede ili posiječe
    const o = u.useOrder, t = o.tree;
    if(t.cut || !u.items.some(it => it.id === o.id) || u.attackTarget || u.moveTarget) u.useOrder = null;
    else if(dist(u, t) <= o.range + t.r + u.r){
      u.useOrder = null;
      const k = u.items.findIndex(it => it.id === o.id);
      if(k >= 0) useItem(u, k, { x: t.x, y: t.y });
    } else { moveToward(u, t.x, t.y, dt); return; }
  }
  if(u.tauntT > 0){   // 📢 Izazov: mora napadati izazivača
    u.tauntT -= dt;
    const tb = u.tauntBy;
    if(tb && !tb.dead && !tb.removeMe){ u.attackTarget = tb; u.moveTarget = null; }
    else u.tauntT = 0;
  }
  if(u.amove && !u.moveTarget && !u.attackTarget) u.amove = null;   // napad u hodu završio
  if(u.kind === 'hero' && isHuman(u) && !u.attackTarget && (!u.moveTarget || u.amove) && !u.charge && !u.hold){   // ✋ S: stoji dok ne dobije naredbu
    u.acqT = (u.acqT || 0) - dt;
    if(u.acqT <= 0){ u.acqT = u.amove ? 0.15 : 0.25; autoAcquire(u, !!u.amove); }
  }
  if(u.attackTarget){
    const t = u.attackTarget;
    // magla rata / nevidljivost: junak gubi metu koja nestane (osim ucijenjene 💰)
    if(!isTargetable(t) ||
       (t.team === u.team && !canDeny(t)) ||   // vlastitu jedinicu napadaš samo dok se može uskratiti
       (t.kind === 'hero' && t.status.invisT > 0 && t.status.trackT <= 0 && t.team !== u.team) ||
       (t.team !== u.team && !isStructure(t) && !isVisibleTo(u.team, t))){   // v0.38: tko nestane u magli (iza drveća), gubi se kao meta
      u.attackTarget = null;
      if(u.attackOnce){ u.attackOnce = false; u.hold = true; }   // 🪙 vojnika je pobijedio netko drugi: ne udaraj sljedećeg
    }
    else {
      const d = dist(u, t);
      const reach = u.atkRange + t.r;
      if(d > reach) moveToward(u, t.x, t.y, dt);
      else if(u.atkTimer <= 0) performAttack(u, t);
    }
  }
  else if(u.moveTarget){
    if(moveToward(u, u.moveTarget.x, u.moveTarget.y, dt)){ u.moveTarget = null; u.amove = null; }
  }
}

function respawn(u){
  u.dead = false;
  u.windup = null;
  u.recap = null;
  u.hp = u.maxhp;
  u.mp = u.maxmp;
  const f = FOUNTAIN[u.team];
  if(u.reviveAt){
    u.x = u.reviveAt.x; u.y = u.reviveAt.y; u.reviveAt = null;
    addFloat(u.x, u.y, L('🛡️ Vratio se!', '🛡️ Back again!'), '#fde047', 16);
  } else {
    u.x = f.x + rand(-50, 50);
    u.y = f.y + rand(-50, 50);
  }
  u.status = baseStatus();
  u.tpChannel = 0; u.chan = null; u.hungerT = 0; u.armorBuffT = 0; u.scopeT = 0; u.useOrder = null;
  u.drag = null; u.cloud = null; u.epi = null; u.frostT = 0; u.causticT = 0;   // v0.55
  u.hold = false; u.attackOnce = false;   // v0.56
  u.moveTarget = null; u.attackTarget = null;
  if(u.bot){ u.bot.state = 'lane'; u.bot.order = null; }
  burst(u.x, u.y, TEAM_LIGHT[u.team], 16, 180, 6);
  if(u.isPlayer){ cam.follow = true; sfxAt('heal', u.x, u.y); }
}

function updateProjectiles(dt){
  for(let i = projectiles.length - 1; i >= 0; i--){
    const p = projectiles[i];
    if(p.kind === 'homing'){
      const t = p.target;
      if(!t || t.dead || t.removeMe){
        burst(p.x, p.y, p.color, 4, 80, 3);
        projectiles.splice(i, 1);
        continue;
      }
      const d = distXY(p.x, p.y, t.x, t.y);
      const step = p.speed * dt;
      if(d <= step + t.r){
        if(p.miss){
          if(isHuman(p.src) || isHuman(t))
            addFloat(t.x, t.y, L('Promašaj! 💨', 'Miss! 💨'), '#e5e7eb', 13, undefined, null, [p.src, t].filter(isHuman).map(x => x.id));
        } else {
          const prev = abCtx; abCtx = p.abKey ? { src: p.src, key: p.abKey } : null;
          hitCrit = p.crit && p.atk;
          applyDamage(t, p.dmg, p.src, p.atk ? 'atk' : null);
          hitCrit = false;
          if(p.onHit) p.onHit(t);
          abCtx = prev;
        }
        burst(t.x, t.y, p.color, 5, 100, 3);
        projectiles.splice(i, 1);
        continue;
      }
      p.x += (t.x - p.x) / d * step;
      p.y += (t.y - p.y) / d * step;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.traveled += p.speed * dt;
      let removed = false;
      for(const e of units){
        if(e.team === p.team || e.dead || e.removeMe || e.invuln) continue;
        if(!isSpellTarget(e)) continue;
        if(p.hitIds[e.id]) continue;
        if(distXY(p.x, p.y, e.x, e.y) <= p.r + e.r){
          const prev = abCtx; abCtx = p.abKey ? { src: p.src, key: p.abKey } : null;
          applyDamage(e, p.dmg, p.src);
          if(p.slow) applySlow(e, p.slow.f, p.slow.t);
          if(p.onHitFn) p.onHitFn(e, p);
          abCtx = prev;
          burst(e.x, e.y, p.color, 6, 120, 4);
          p.hitIds[e.id] = true;
          if(!p.pierce && !(p.passCreeps && e.kind === 'creep')){ projectiles.splice(i, 1); removed = true; break; }
        }
      }
      if(removed) continue;
      if(p.traveled >= p.range || p.x < 0 || p.x > WORLD || p.y < 0 || p.y > WORLD){
        burst(p.x, p.y, p.color, 4, 70, 3);
        projectiles.splice(i, 1);
      }
    }
  }
}

function zoneTick(z){
  if(z.ticksLeft <= 0) return;
  z.ticksLeft--;
  const prev = abCtx; abCtx = z.abKey ? { src: z.src, key: z.abKey } : null;
  for(const e of units){
    if(e.team === z.team || e.dead || e.removeMe || e.invuln) continue;
    if(!isSpellTarget(e)) continue;
    if(distXY(z.x, z.y, e.x, e.y) <= z.r + e.r * 0.5){
      applyDamage(e, z.dmg, z.src);
      if(z.slow) applySlow(e, z.slow.f, z.slow.t);
      if(z.root) applyRoot(e, z.root);
      if(z.stun) applyStun(e, z.stun);
      if(z.poison) applyPoison(e, z.poison.dps, z.poison.t, z.src);
      if(z.silence) applySilence(e, z.silence);
    }
  }
  abCtx = prev;
  burst(z.x, z.y, z.color, 12, 180, 5);
  sfxAt('boom', z.x, z.y);
}
function updateZones(dt){
  for(let i = zones.length - 1; i >= 0; i--){
    const z = zones[i];
    z.t += dt;
    if(!z.started){
      if(z.t >= z.delay){ z.started = true; zoneTick(z); }
    } else {
      z.tickT += dt;
      if(z.tickT >= z.interval){ z.tickT -= z.interval; zoneTick(z); }
    }
    if(z.started && z.ticksLeft <= 0) zones.splice(i, 1);
  }
}

function spawnWave(){
  waveCount++;
  for(let team = 0; team < 2; team++){
    for(const lane of LANE_LIST){
      for(let i = 0; i < CFG.meleePerWave; i++) makeCreepOnLane(team, lane, false, false);
      for(let i = 0; i < CFG.rangedPerWave; i++) makeCreepOnLane(team, lane, true, false);
      if(waveCount % CFG.siegeEveryNthWave === 0) makeCreepOnLane(team, lane, false, true);
    }
  }
  if(waveCount === 1){ announce(L('⚔️ Bitka počinje!', '⚔️ The battle begins!'), L('Vojnici kreću na staze — prati ih!', 'Creeps march down the lanes — follow them!'), 'gold'); annEvent('battle'); }
  if(waveCount === CFG.siegeEveryNthWave)   // samo prvi put (poslije su stalni dio vala)
    feedMsg(L('💪 Stigli su veliki vojnici!', '💪 Big creeps have arrived!'), '#fde047');
}

function update(dt){
  const wasPrep = gameTime < 0;
  gameTime += dt;
  if(wasPrep){   // ⏳ priprema: zadnjih 5 sekundi otkucava, u 0:00 svira rog
    if(gameTime >= 0) prepOver();
    else { const s = Math.ceil(-gameTime); if(s <= 5 && s !== prepTick){ prepTick = s; sfx('tick'); } }
  }
  if(cam.follow && player && !player.dead){
    cam.x = lerp(cam.x, player.x, Math.min(1, dt * 7));
    cam.y = lerp(cam.y, player.y, Math.min(1, dt * 7));
  }
  const panSpd = 900 / cam.zoom * dt;
  if(keys['arrowleft']){ cam.x -= panSpd; cam.follow = false; }
  if(keys['arrowright']){ cam.x += panSpd; cam.follow = false; }
  if(keys['arrowup']){ cam.y -= panSpd; cam.follow = false; }
  if(keys['arrowdown']){ cam.y += panSpd; cam.follow = false; }
  cam.x = clamp(cam.x, 100, WORLD - 100);
  cam.y = clamp(cam.y, 100, WORLD - 100);

  waveTimer -= dt;
  if(waveTimer <= 0){
    waveTimer = CFG.waveEvery;
    spawnWave();
  }
  updateItemAuras();
  for(let i = barracksRespawn.length - 1; i >= 0; i--){   // 🏚️ obnova vojarni
    const br = barracksRespawn[i];
    br.t -= dt;
    if(br.t > 0) continue;
    barracksRespawn.splice(i, 1);
    if(!ancients[br.team] || ancients[br.team].removeMe) continue;
    const b = makeBarracks(br.team, br.lane, br.x, br.y);
    b.invuln = false;   // unutarnja kula te staze je već pala
    superCreeps[1 - br.team][br.lane] = false;
    announce(L('🏚️ Vojarna obnovljena!', '🏚️ Barracks rebuilt!'), L('Tim ' + TEAM_NAME[br.team] + ' (' + LANE_NAME[br.lane] + ') — nema više super vojnika na toj stazi', 'Team ' + TEAM_NAME[br.team] + ' (' + LANE_NAME[br.lane] + ') — no more super creeps in that lane'), 1 - br.team);
    feedMsg(L('🏚️ Obnovljena vojarna tima ' + TEAM_NAME[br.team] + ' (' + LANE_NAME[br.lane] + ')', '🏚️ Team ' + TEAM_NAME[br.team] + "'s barracks rebuilt (" + LANE_NAME[br.lane] + ')'), TEAM_COLOR[br.team]);
  }

  updateNeutralLevel();   // 🐲 čudovišta jačaju s vremenom
  for(const c of camps){
    if(c.units.length === 0 && c.respawnT > 0){
      c.respawnT -= dt;
      if(c.respawnT <= 0){
        spawnCamp(c);
        const dr = c.units[0];
        if(dr && dr.drake) feedMsg(L('🐉 Na rijeci se pojavio ' + DRAKES[dr.drake].emoji + ' ' + DRAKES[dr.drake].name.toLowerCase() + '!', '🐉 A ' + DRAKES[dr.drake].emoji + ' ' + DRAKES[dr.drake].name.toLowerCase() + ' appeared on the river!'), DRAKES[dr.drake].color);
      }
    }
  }

  if(gameTime >= 0) runeTimer -= dt;   // rune tek nakon pripreme
  if(runeTimer <= 0){
    runeTimer = CFG.runeEvery;
    const sp = RUNE_SPOTS[runeSpotI];
    runeSpotI = 1 - runeSpotI;
    runes = [{ x: sp.x, y: sp.y, def: choice(RUNE_TYPES), t: 0 }];
    announce(L('✨ Čarobna runa!', '✨ Magic rune!'), L('Pojavila se na rijeci — uzmi je!', 'It appeared on the river — grab it!'));
  }
  if(runes.length){
    const rn = runes[0];
    rn.t += dt;
    for(const h of units){
      if(h.kind !== 'hero' || h.dead) continue;
      if(distXY(h.x, h.y, rn.x, rn.y) < 70){
        rn.def.apply(h);
        if(rn.def.id === 'haste' || rn.def.id === 'double') h.runeRoamT = gameTime + 15;   // 🧠 v0.51: bot s runom traži gank
        addFloat(h.x, h.y, rn.def.emoji + ' ' + rn.def.name + '!', '#fde047', 16);
        if(h.isPlayer) sfx('levelup');
        burst(rn.x, rn.y, '#fde047', 16, 200, 5);
        runes = [];
        break;
      }
    }
  }

  if(nightForceT > 0) nightForceT -= dt;
  updateTrees(dt);   // 🌳 pojedena / posječena stabla ponovo izrastu
  for(let i = wards.length - 1; i >= 0; i--){ wards[i].t -= dt; if(wards[i].t <= 0) wards.splice(i, 1); }
  updateShrines(dt);
  updateCouriers(dt);
  if(gameTime >= 0) updateTeamAI(dt);   // 🤖 timska strategija botova
  if(gameTime >= 0) updateExtraRunes(dt);   // rune zlata u 0:00, mudrosti u 7:00
  if(gameTime >= 0) updateRichBounty(dt);   // 🎯
  updatePings(dt);
  {   // 💪 vojnici jačaju svakih 7.5 min
    const tier = Math.max(0, Math.floor(gameTime / CFG.creepScaleEvery));
    if(tier > creepTier){
      creepTier = tier;
      const min = gameClock() / 60, hpP = Math.round(CFG.creepHpGrow * min * 100), dmgP = Math.round(CFG.creepDmgGrow * min * 100);
      announce(L('💪 Vojnici su ojačali!', '💪 Creeps got stronger!'), L('+' + hpP + '% života i +' + dmgP + '% štete na obje strane', '+' + hpP + '% health and +' + dmgP + '% damage on both sides'));
    }
  }
  // 🛡️ Glif utvrde: odbrojavanje; tim bez čovjeka ga sam koristi kad mu kula pada
  for(let tm = 0; tm < 2; tm++){
    const g = glyph[tm];
    if(g.t > 0) g.t -= dt;
    if(g.cd > 0) g.cd -= dt;
    glyphAiT[tm] = (glyphAiT[tm] || 0) - dt;
    if(g.cd <= 0 && glyphAiT[tm] <= 0){
      glyphAiT[tm] = 0.5;
      const human = units.some(u => u.kind === 'hero' && u.team === tm && isHuman(u));
      if(!human) for(const u of units){
        if(!isStructure(u) || u.team !== tm || u.removeMe || u.invuln) continue;
        if(u.hp < u.maxhp * 0.35 && gameTime - (u.lastHitT || -99) < 1.5){ useGlyph(tm, null); break; }
      }
    }
  }
  const phase = (gameTime % CFG.dayCycle) / CFG.dayCycle;
  const dayK = 0.5 + 0.5 * Math.cos(phase * TAU);
  const nightNow = dayK < 0.5 || nightForceT > 0;
  if(nightNow !== isNight){
    isNight = nightNow;
    announce(isNight ? L('🌙 Pada noć...', '🌙 Night falls...') : L('☀️ Svanulo je!', '☀️ Day has come!'), isNight ? L('Vid je kraći — pazi na zasjede!', 'Vision is shorter — watch out for ambushes!') : '');
    annEvent(isNight ? 'night' : 'day');
  }

  // magla rata: osvježi vid oba tima
  visionTimer -= dt;
  if(visionTimer <= 0){
    visionTimer = 0.2;
    updateVision();
  }

  // ciljanje: odustani ako moć više nije spremna
  if(pendingCast){
    if(pendingCast.tp || pendingCast.sum != null){
      if(!player || player.dead) pendingCast = null;
    } else if(pendingCast.item != null){
      if(!player || player.dead || !player.items[pendingCast.item] || !player.items[pendingCast.item].active) pendingCast = null;
    } else {
      const ab = player && !player.dead ? player.abilities[pendingCast.i] : null;
      if(!ab || ab.rank <= 0) pendingCast = null;
    }
  }

  for(const u of units) updateUnit(u, dt);
  separation();
  updateProjectiles(dt);
  updateZones(dt);

  for(let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    if(p.t > p.life) particles.splice(i, 1);
  }
  for(let i = floats.length - 1; i >= 0; i--){
    const f = floats[i];
    f.t += dt; f.h += (f.st === 'crit' ? 30 : 52) * dt;
    if(f.t > 1.1) floats.splice(i, 1);
  }
  for(let i = lines.length - 1; i >= 0; i--){
    lines[i].t += dt;
    if(lines[i].t > lines[i].life) lines.splice(i, 1);
  }
  for(let i = markers.length - 1; i >= 0; i--){
    markers[i].t += dt;
    if(markers[i].t > 0.5) markers.splice(i, 1);
  }
  for(let i = feed.length - 1; i >= 0; i--){
    feed[i].t += dt;
    if(feed[i].t > 7) feed.splice(i, 1);
  }
  if(banner){
    banner.t += dt;
    if(banner.t > banner.dur + 0.4) banner = null;
  }

  units = units.filter(u => !u.removeMe);

  if(shopOpen && Math.floor(gameTime * 2) !== Math.floor((gameTime - dt) * 2)) refreshShop();
}

/* ================= Svijet: drveće i teren ================= */
/* 🌳 prostorna mreža stabala (sudari, linija pogleda, tango) — stabla se mogu pojesti/posjeći i ponovo izrasti */
const TREE_CS = 160;
let treeGrid = [], treeGW = 1;
function treeCell(x, y){ return clamp(Math.floor(y / TREE_CS), 0, treeGW - 1) * treeGW + clamp(Math.floor(x / TREE_CS), 0, treeGW - 1); }
function buildTreeGrid(){
  treeGW = Math.ceil(WORLD / TREE_CS) + 1;
  treeGrid = Array.from({ length: treeGW * treeGW }, () => []);
  trees.forEach((t, i) => { t.i = i; if(!t.cut) treeGrid[treeCell(t.x, t.y)].push(t); });
}
// fn(stablo) za sva živa stabla u krugu r oko (x, y); vrati true = prekini
function forTreesNear(x, y, r, fn){
  const gx0 = clamp(Math.floor((x - r) / TREE_CS), 0, treeGW - 1), gx1 = clamp(Math.floor((x + r) / TREE_CS), 0, treeGW - 1);
  const gy0 = clamp(Math.floor((y - r) / TREE_CS), 0, treeGW - 1), gy1 = clamp(Math.floor((y + r) / TREE_CS), 0, treeGW - 1);
  for(let gy = gy0; gy <= gy1; gy++) for(let gx = gx0; gx <= gx1; gx++)
    for(const t of treeGrid[gy * treeGW + gx]) if(fn(t)) return;
}
function nearestTree(x, y, r){
  let best = null, bd = r;
  forTreesNear(x, y, r, t => { const d = distXY(x, y, t.x, t.y); if(d < bd){ bd = d; best = t; } });
  return best;
}
function genTrees(){
  trees = [];
  // v0.38: gušće šume (razmak 125 umjesto 150) i više pokušaja — na većoj mapi džungla je bila prorijeđena
  const want = Math.round(250 * MAP_S * MAP_S), GAP = 125, cs = 130, gw = Math.ceil(WORLD / cs) + 1, grid = new Map();
  let attempts = 0;
  while(trees.length < want && attempts < 60000){
    attempts++;
    const x = rand(70, WORLD - 70), y = rand(70, WORLD - 70);
    if(Math.abs(x - y) / Math.SQRT2 < 180) continue;
    let blocked = false;
    for(const l of LANE_LIST){
      if(distToPath(LANE_PTS[l], x, y) < 175){ blocked = true; break; }
    }
    if(blocked) continue;
    if(distXY(x, y, FOUNTAIN[0].x, FOUNTAIN[0].y) < 430) continue;
    if(distXY(x, y, FOUNTAIN[1].x, FOUNTAIN[1].y) < 430) continue;
    if(distXY(x, y, ANCIENT_POS[0].x, ANCIENT_POS[0].y) < 380) continue;
    if(distXY(x, y, ANCIENT_POS[1].x, ANCIENT_POS[1].y) < 380) continue;
    { const dB = Math.min(distXY(x, y, ANCIENT_POS[0].x, ANCIENT_POS[0].y), distXY(x, y, ANCIENT_POS[1].x, ANCIENT_POS[1].y));
      if(dB > CLIFF_R0 - 70 && dB < CLIFF_R1 + 70) continue; }   // ne na liticama
    for(const c of CAMP_SPOTS){
      if(distXY(x, y, c.x, c.y) < 260){ blocked = true; break; }
    }
    if(blocked) continue;
    for(const rs of RUNE_SPOTS.concat(BOUNTY_SPOTS, WISDOM_SPOTS)){
      if(distXY(x, y, rs.x, rs.y) < 150){ blocked = true; break; }
    }
    if(blocked) continue;
    for(const s of SHRINE_SPOTS){
      if(distXY(x, y, s.x, s.y) < 230){ blocked = true; break; }
    }
    if(blocked) continue;
    const gx = Math.floor(x / cs), gy = Math.floor(y / cs);
    for(let oy = -1; oy <= 1 && !blocked; oy++) for(let ox = -1; ox <= 1 && !blocked; ox++)
      for(const t of grid.get((gy + oy) * gw + gx + ox) || []) if(distXY(x, y, t.x, t.y) < GAP){ blocked = true; break; }
    if(blocked) continue;
    const t = { x, y, r: 24, size: rand(42, 62), kind: Math.random() < 0.7 ? '🌳' : '🌲' };
    trees.push(t);
    const k = gy * gw + gx;
    if(!grid.has(k)) grid.set(k, []);
    grid.get(k).push(t);
  }
  buildTreeGrid();
}
/* 🌿 stablo pojedeno (tango) ili posječeno (sjekirica): nestane, pogled se otvori; izraste za 3 min */
const TREE_REGROW = 180;
let treesCut = [];   // indeksi posječenih stabala (za 3D i mrežnu igru)
function cutTree(t, by){
  if(!t || t.cut) return false;
  t.cut = true; t.regrowT = TREE_REGROW;
  treesCut.push(t.i);
  const cell = treeGrid[treeCell(t.x, t.y)], k = cell.indexOf(t);
  if(k >= 0) cell.splice(k, 1);
  markTreesDirty();
  burst(t.x, t.y, '#4ade80', 14, 160, 6);
  if(typeof treeCut3D === 'function') treeCut3D(t.i);
  return true;
}
function updateTrees(dt){
  if(!treesCut.length) return;
  for(let n = treesCut.length - 1; n >= 0; n--){
    const t = trees[treesCut[n]];
    if(!t){ treesCut.splice(n, 1); continue; }
    t.regrowT -= dt;
    if(t.regrowT > 0) continue;
    // ne izrasti na nekome (pričekaj da se makne)
    if(units.some(u => !u.dead && !u.removeMe && !u.isStatic && distXY(u.x, u.y, t.x, t.y) < u.r + t.r + 4)){ t.regrowT = 1; continue; }
    t.cut = false;
    treesCut.splice(n, 1);
    treeGrid[treeCell(t.x, t.y)].push(t);
    markTreesDirty();
    if(typeof treeGrow3D === 'function') treeGrow3D(t.i);
  }
}

function buildTerrain(){
  terrainCanvas = document.createElement('canvas');
  // v0.38: veća mapa — tekstura do 4096 px na visokoj kvaliteti (manje na slabijim uređajima)
  const RES = Math.min(WORLD, SETTINGS.quality === 'high' ? 4096 : (SETTINGS.quality === 'med' ? 3400 : 2600));
  terrainCanvas.width = RES;
  terrainCanvas.height = RES;
  const t = terrainCanvas.getContext('2d');
  t.scale(RES / WORLD, RES / WORLD);   // crtamo u koordinatama svijeta

  // trava: AI tekstura ako je učitana, inače boja
  if(imgReady(GFX.tex.grass)){
    const pat = t.createPattern(GFX.tex.grass, 'repeat');
    if(pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.55));
    t.fillStyle = pat;
    t.fillRect(0, 0, WORLD, WORLD);
    t.save();   // v0.47: manje "neonska" trava — malo manje zasićena i toplija (kao oslikana livada)
    t.globalCompositeOperation = 'saturation';
    t.fillStyle = 'rgba(128,128,128,0.24)';
    t.fillRect(0, 0, WORLD, WORLD);
    t.restore();
    t.fillStyle = 'rgba(150,196,92,0.2)';   // blagi ton preko teksture
    t.fillRect(0, 0, WORLD, WORLD);
  } else {
    t.fillStyle = '#7ec850';
    t.fillRect(0, 0, WORLD, WORLD);
  }
  for(let i = 0; i < Math.round(420 * MAP_S * MAP_S); i++){
    t.fillStyle = Math.random() < 0.5 ? 'rgba(96,160,56,0.14)' : 'rgba(170,220,120,0.12)';
    t.beginPath();
    t.arc(rand(0, WORLD), rand(0, WORLD), rand(30, 130), 0, TAU);
    t.fill();
  }
  // 🌼 v0.47: velike sunčane livade i tamnije udoline — trava više nije jednolično zelena
  for(let i = 0; i < Math.round(60 * MAP_S * MAP_S); i++){
    const x = rand(0, WORLD), y = rand(0, WORLD), r = rand(220, 520), warm = Math.random() < 0.55;
    const c0 = warm ? '214,210,118' : '34,90,72';
    const g = t.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + c0 + ',' + (warm ? 0.17 : 0.15) + ')'); g.addColorStop(1, 'rgba(' + c0 + ',0)');
    t.fillStyle = g;
    t.beginPath(); t.arc(x, y, r, 0, TAU); t.fill();
  }
  // 🌲 šumsko tlo: ispod stabala tamnija, gušća trava — šume se odvajaju od svijetlih livada
  for(const tr of trees){
    const r = 120 + (tr.size || 50) * 1.2;
    const g = t.createRadialGradient(tr.x, tr.y, r * 0.15, tr.x, tr.y, r);
    g.addColorStop(0, 'rgba(30,66,26,0.3)'); g.addColorStop(0.6, 'rgba(36,76,30,0.16)'); g.addColorStop(1, 'rgba(36,76,30,0)');
    t.fillStyle = g;
    t.beginPath(); t.arc(tr.x, tr.y, r, 0, TAU); t.fill();
  }
  for(let i = 0; i < Math.round(200 * MAP_S * MAP_S); i++){
    t.fillStyle = choice(['#fef08a', '#fda4af', '#e9d5ff', '#ffffff']);
    t.beginPath();
    t.arc(rand(0, WORLD), rand(0, WORLD), rand(3, 6), 0, TAU);
    t.fill();
  }

  // rijeka (nizina) — AI vodena tekstura ako postoji
  t.strokeStyle = '#5ab6ee';
  t.lineWidth = 230;
  t.lineCap = 'round';
  t.beginPath(); t.moveTo(-50, -50); t.lineTo(WORLD + 50, WORLD + 50); t.stroke();
  if(imgReady(GFX.tex.water)){
    const wp = t.createPattern(GFX.tex.water, 'repeat');
    if(wp.setTransform) wp.setTransform(new DOMMatrix().scale(0.5));
    t.strokeStyle = wp;
  } else {
    t.strokeStyle = '#8ed3fa';
  }
  t.lineWidth = 150;
  t.beginPath(); t.moveTo(-50, -50); t.lineTo(WORLD + 50, WORLD + 50); t.stroke();
  t.fillStyle = 'rgba(255,255,255,0.5)';
  for(let i = 0; i < 60; i++){
    const d = rand(100, WORLD - 100);
    const off = rand(-60, 60);
    t.beginPath();
    t.ellipse(d + off, d - off, rand(8, 20), rand(3, 6), Math.PI / 4, 0, TAU);
    t.fill();
  }

  // staze — AI zemljana tekstura ako postoji
  for(const l of LANE_LIST){
    const pts = LANE_PTS[l];
    t.strokeStyle = '#d9c79b';
    t.lineWidth = 150;
    t.lineCap = 'round'; t.lineJoin = 'round';
    t.beginPath();
    t.moveTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++) t.lineTo(pts[i][0], pts[i][1]);
    t.stroke();
    if(imgReady(GFX.tex.path)){
      const pp = t.createPattern(GFX.tex.path, 'repeat');
      if(pp.setTransform) pp.setTransform(new DOMMatrix().scale(0.5));
      t.strokeStyle = pp;
    } else {
      t.strokeStyle = '#e8dab2';
    }
    t.lineWidth = 116;
    t.beginPath();
    t.moveTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++) t.lineTo(pts[i][0], pts[i][1]);
    t.stroke();
  }

  // podloge kampova: utabana zemlja s mekim rubom
  for(const c of CAMP_SPOTS){
    const r = c.type === 'boss' || c.type === 'drake' ? 175 : 120;
    const g = t.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r);
    g.addColorStop(0, 'rgba(140,98,52,0.34)'); g.addColorStop(0.65, 'rgba(140,98,52,0.2)'); g.addColorStop(1, 'rgba(140,98,52,0)');
    t.fillStyle = g;
    t.beginPath(); t.arc(c.x, c.y, r, 0, TAU); t.fill();
    for(let i = 0; i < 9; i++){   // kamenčići
      const a = rand(0, TAU), d = rand(20, r * 0.8);
      t.fillStyle = Math.random() < 0.5 ? 'rgba(120,110,96,0.45)' : 'rgba(170,160,140,0.4)';
      t.beginPath(); t.ellipse(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, rand(4, 9), rand(3, 6), a, 0, TAU); t.fill();
    }
  }

  // ☠️ Scourge strana (gore desno): zemlja gubi boju, tamni i dobiva ljubičaste mrlje — prijelaz počinje uz rijeku
  {
    const c = WORLD / 2, n = Math.SQRT1_2, a = 150 * MAP_S, b = 900 * MAP_S;
    const grad = (c0, c1) => { const g = t.createLinearGradient(c + n * a, c - n * a, c + n * b, c - n * b); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
    t.save();
    t.globalCompositeOperation = 'saturation';
    t.fillStyle = grad('rgba(128,128,128,0)', 'rgba(128,128,128,0.6)');
    t.fillRect(0, 0, WORLD, WORLD);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = grad('rgba(255,255,255,0)', 'rgba(132,116,150,0.62)');
    t.fillRect(0, 0, WORLD, WORLD);
    t.globalCompositeOperation = 'source-over';
    for(let i = 0; i < Math.round(160 * MAP_S * MAP_S); i++){
      const x = rand(0, WORLD), y = rand(0, WORLD);
      if((x - y) / Math.SQRT2 < 300 * MAP_S) continue;
      t.fillStyle = Math.random() < 0.6 ? 'rgba(40,22,52,0.16)' : 'rgba(88,28,60,0.12)';
      t.beginPath(); t.arc(x, y, rand(40, 160), 0, TAU); t.fill();
    }
    t.restore();
  }

  // baze: popločani trg oko prijestola i fontane (rub se gubi u travi)
  for(let team = 0; team < 2; team++){
    const a = ANCIENT_POS[team], f = FOUNTAIN[team];
    paintPlaza(t, a.x, a.y, 330 * MAP_S, team, true);
    paintPlaza(t, f.x, f.y, 190, team, false);
  }

  // sjena šume uz rub mape: teren se mekano utapa u tlo izvan mape (bez oštre crte)
  const EW = 220;
  for(const [x0, y0, x1, y1] of [[0, 0, EW, 0], [WORLD, 0, WORLD - EW, 0], [0, 0, 0, EW], [0, WORLD, 0, WORLD - EW]]){
    const g = t.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(28,46,22,0.42)'); g.addColorStop(1, 'rgba(28,46,22,0)');
    t.fillStyle = g;
    t.fillRect(0, 0, WORLD, WORLD);
  }

  setGround(terrainCanvas);
}
/* 🏛️ kameni trg: ploče u krugovima (Sentinel svijetli kamen i zlatni ukras, Scourge tamni kamen i ljubičaste rune) */
function paintPlaza(t, cx, cy, R, team, rune){
  const light = team === TEAM_BLUE;
  const base = light ? [140, 130, 108] : [62, 52, 70];
  const g = t.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
  g.addColorStop(0, `rgba(${base},0.6)`); g.addColorStop(0.7, `rgba(${base},0.35)`); g.addColorStop(1, `rgba(${base},0)`);
  t.fillStyle = g;
  t.beginPath(); t.arc(cx, cy, R, 0, TAU); t.fill();
  const step = 32;
  for(let r = 26, ring = 0; r < R * 0.95; r += step, ring++){
    const fade = 1 - smoothstep(R * 0.55, R * 0.95, r);
    const n = Math.max(6, Math.round(TAU * r / 44));
    for(let k = 0; k < n; k++){
      if(Math.random() < 0.04 + 0.5 * (1 - fade)) continue;   // na rubu ploče nedostaju — trg se gubi u travi
      const a0 = (k + (ring % 2) * 0.5) / n * TAU, a1 = a0 + TAU / n * 0.92;
      const v = (Math.random() - 0.5) * 26;
      t.fillStyle = `rgba(${base.map(c => Math.round(clamp(c + v + 6, 0, 255)))},${((light ? 0.6 : 0.85) * fade).toFixed(3)})`;
      t.beginPath(); t.arc(cx, cy, r + step / 2 - 2, a0, a1); t.arc(cx, cy, r - step / 2 + 2, a1, a0, true); t.closePath(); t.fill();
      t.strokeStyle = `rgba(30,24,20,${(0.22 * fade).toFixed(3)})`; t.lineWidth = 2; t.stroke();
    }
  }
  if(!rune) return;
  // ukrasni prsten oko prijestola
  t.lineWidth = 10;
  t.strokeStyle = light ? 'rgba(234,191,98,0.7)' : 'rgba(168,85,247,0.55)';
  t.beginPath(); t.arc(cx, cy, R * 0.5, 0, TAU); t.stroke();
  t.lineWidth = 4;
  t.beginPath(); t.arc(cx, cy, R * 0.5 + 16, 0, TAU); t.stroke();
  for(let k = 0; k < 12; k++){   // znakovi u prstenu
    const a = k / 12 * TAU, x = cx + Math.cos(a) * (R * 0.5 + 8), y = cy + Math.sin(a) * (R * 0.5 + 8);
    t.fillStyle = light ? 'rgba(250,215,120,0.85)' : 'rgba(192,132,252,0.8)';
    t.beginPath();
    if(light){ t.arc(x, y, 9, 0, TAU); }   // zlatni čavli
    else { t.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); t.lineTo(x + Math.cos(a + 1.6) * 8, y + Math.sin(a + 1.6) * 8); t.lineTo(x - Math.cos(a) * 12, y - Math.sin(a) * 12); t.lineTo(x + Math.cos(a - 1.6) * 8, y + Math.sin(a - 1.6) * 8); t.closePath(); }   // rune
    t.fill();
  }
}

function makeWorld(){
  for(let team = 0; team < 2; team++){
    makeAncient(team);
    for(const g of GUARD_POS[team]) makeTower(team, g[0], g[1], null, 9, true).invuln = true;   // T4: ranjive tek kad padne neka T3
    for(const lane of LANE_LIST){
      for(let i = 0; i < 3; i++){   // v0.56: T1, T2, T3 — dublja kula je neranjiva dok ne padne ona ispred nje (kao u DotA 2)
        const p = pointAt(LANE_PTS[lane], towerFrac(team, lane, i));
        makeTower(team, p.x, p.y, lane, i + 1, false).invuln = i > 0;
      }
      // vojarna: odmah iza T3, sa strane staze (dalje od sredine mape)
      const rf = RAX_FRAC[lane];
      const bp = pointAt(LANE_PTS[lane], team === TEAM_BLUE ? rf : 1 - rf);
      const q = pointAt(LANE_PTS[lane], team === TEAM_BLUE ? rf + 0.045 : 0.955 - rf);
      const L = Math.hypot(q.x - bp.x, q.y - bp.y) || 1;
      const nx = -(q.y - bp.y) / L, ny = (q.x - bp.x) / L;
      const c1 = { x: bp.x + nx * 120, y: bp.y + ny * 120 }, c2 = { x: bp.x - nx * 120, y: bp.y - ny * 120 };
      const far = distXY(c1.x, c1.y, WORLD / 2, WORLD / 2) > distXY(c2.x, c2.y, WORLD / 2, WORLD / 2) ? c1 : c2;
      makeBarracks(team, lane, clamp(far.x, 80, WORLD - 80), clamp(far.y, 80, WORLD - 80));
    }
  }
  initCamps();
}

/* ================= Početak / kraj igre ================= */
/* ⚡ BRZA IGRA (v0.45, kao Turbo u DotA): više zlata i iskustva, brže oživljavanje, slabije kule — igra traje ~12–15 min (v0.46: sporiji junaci).
   Svaka igra kreće od izvornih vrijednosti (CFG_BASE), pa brza igra pomnoži tempo i iskustvo (TURBO) i postavi svoje zlato (TURBO_GOLD). */
const CFG_BASE = Object.assign({}, CFG);
const TURBO = { heroKillXp: 1.7, creepXpMul: 2,
  creepXp: 2, towerXp: 1.5, respawnBase: 0.75, respawnPerLvl: 0.7, towerHp: 0.6, waveEvery: 0.85, timeScale: 0.6, barracksHp: 0.7, ancientHp: 0.7,
  campRespawn: 0.7, bossRespawn: 0.6, drakeRespawn: 0.6, barracksRespawn: 0.7, buybackCd: 0.5, startGold: 1.3, prepTime: 0.5, creepScaleEvery: 0.6 };
/* 💰 zlato u brzoj igri — zadane vrijednosti (ne množe se): brza igra zadržava svoju brzu ekonomiju i kad se mijenja normalna (data.js) */
const TURBO_GOLD = { passiveGold: 2.25, heroKillGold: 300, heroKillGoldPerLvl: 18, assistGold: 80, creepGoldMul: 2, towerGoldTeam: 180,
  barracksGoldTeam: 225, bountyGold: 40, bountyGoldMin: 3, bossGoldTeam: 200, shutdownGold: 60, comebackFrom: 500 };
/* ⏱️ „sat igre” za odluke koje ovise o vremenu (kada botovi guraju, jačina kula, rune): u brzoj igri teče brže */
function gameClock(){ return gameTime / (CFG.timeScale || 1); }
function gameMode(){ return net.mode === 'host' || net.mode === 'guest' ? 'normal' : (SETTINGS.mode === 'turbo' ? 'turbo' : 'normal'); }
function applyMode(){
  Object.assign(CFG, CFG_BASE);
  if(gameMode() !== 'turbo') return;
  for(const k in TURBO) CFG[k] = Math.round(CFG_BASE[k] * TURBO[k] * 100) / 100;
  Object.assign(CFG, TURBO_GOLD);
}
/* 🛣️ na početku: poruka na koju stazu ideš (i s kim) + oznaka na tvojoj prvoj kuli te staze (vidi se i na minimapi) */
function laneIntro(h){
  if(!h) return;
  if(h.jungler){   // 🌲 v0.56
    feedMsg(L('🌲 Tvoja uloga: DŽUNGLA — kupi 🐾 Lovački nož, počni s malim kampom 🦎 (označen na mapi), pa gankaj staze', '🌲 Your role: JUNGLE — buy the 🐾 Hunter\'s Knife, start at a small 🦎 camp (marked on the map), then gank lanes'), TEAM_COLOR[h.team], h.team);
    const c = camps.filter(c => c.type === 'lizards').sort((a, b) => distXY(a.x, a.y, FOUNTAIN[h.team].x, FOUNTAIN[h.team].y) - distXY(b.x, b.y, FOUNTAIN[h.team].x, FOUNTAIN[h.team].y))[0];
    if(c) pings.push({ x: c.x, y: c.y, team: h.team, t: 0 });
    return;
  }
  const mate = units.find(o => o.kind === 'hero' && o.team === h.team && o !== h && o.lane === h.lane && !o.jungler);
  const ln = laneLabel(h.lane).toUpperCase();
  feedMsg(mate ? L('🛣️ Tvoja staza: ' + ln + ' — s tobom je ' + mate.emoji + ' ' + mate.name + ' (2 na 2)', '🛣️ Your lane: ' + ln + ' — with ' + mate.emoji + ' ' + mate.name + ' (2 vs 2)')
               : L('🛣️ Tvoja staza: ' + ln + ' — sam si (1 na 1)', '🛣️ Your lane: ' + ln + ' — you are alone (1 vs 1)'), TEAM_COLOR[h.team], h.team);
  const t1 = units.find(t => t.kind === 'tower' && t.team === h.team && t.lane === h.lane && t.tier === 1);
  if(t1) pings.push({ x: t1.x, y: t1.y, team: h.team, t: 0 });
}
function startGame(heroIdx){
  applyMode();   // ⚡
  loadCos();     // 🎁
  units = []; projectiles = []; zones = []; particles = []; lines = [];
  floats = []; markers = []; feed = [];
  ancients = [null, null];
  kills = [0, 0];
  camps = []; runes = []; neutralLvl = 1;
  runeTimer = CFG.runeEvery; runeSpotI = 0; isNight = false;
  wards = []; nightForceT = 0; superCreeps = [{}, {}]; winnerTeam = null; barracksRespawn = [];
  glyph = [{ t: 0, cd: 0 }, { t: 0, cd: 0 }];
  makeShrines(); makeCouriers(); creepTier = 0; bossKills = 0; coinDrops = [];
  teamDrakes = [[], []]; nextDrake = null; scoreOpen = false;
  neutralDrops = [{ 1: 0, 2: 0, 3: 0 }, { 1: 0, 2: 0, 3: 0 }]; neutralFx = [];
  resetExtraRunes(); pings = []; chatOpen = false;
  pendingCast = null; resetTeamAI();
  tip.cur = null; tip.done = {}; tip.next = 8; slowMo = 0; gameRecorded = false;
  gameHist = { pts: [], ev: [], nextT: 0 };   // 📈
  quest.i = 0; quest.doneT = 0; quest.chk = 0; quest.allT = 0;   // 🎯
  gameTime = 0; waveTimer = CFG.firstWave; waveCount = 0;
  firstBlood = false; gameOver = false; paused = false;
  quickBuy = null; shopSel = null; invDrag = null; hideItemTip();   // nova igra: bez stare brze kupnje i opisa
  banner = null; netBanner = guestBanner = null;
  myTeam = TEAM_BLUE;
  remoteHero = null;

  clearScene3D();
  genTrees(); treesCut = [];
  markTreesDirty(); fogA.fill(1);
  buildTerrain();
  buildTrees3D();
  buildStatic3D();
  makeWorld();

  const rest = shuffle(HEROES.map((h, i) => i).filter(i => i !== heroIdx));
  const lanes = lanesFor(SETTINGS.lane);   // 🛣️ tvoja staza prva, botovi popune ostatak
  const redLanes = lanesFor('mid', SETTINGS.lane === 'jungle');   // 🌲 v0.56: ako si ti u džungli, i protivnici imaju junaka u džungli
  makeHero(HEROES[heroIdx], TEAM_BLUE, true, lanes[0]);
  player.summoners = player.jungler ? jungleSummoners(pickedSummoners) : pickedSummoners.slice();   // ✨ odabrane na ekranu junaka (🌲 u džungli uvijek s Kaznom)
  let ri = 0;   // 👥 ostatak oba tima (CFG.teamSize po timu, staze po LANE_PLAN)
  for(let i = 1; i < CFG.teamSize; i++) makeHero(HEROES[rest[ri++]], TEAM_BLUE, false, lanes[i]);
  for(let i = 0; i < CFG.teamSize; i++) makeHero(HEROES[rest[ri++]], TEAM_RED, false, redLanes[i]);

  for(const h of units){
    if(h.kind === 'hero' && h.bot) botSpendPoints(h);
  }

  buildPlayerRing();
  updateVision();

  cam.x = player.x; cam.y = player.y; cam.zoom = 0.9; cam.follow = true;
  running = true;
  document.getElementById('select').classList.add('hidden');
  announce(L('🏰 Sruši crveni prijestol! 👑', '🏰 Destroy the red throne! 👑'), L('Pritisni Q, W ili E da naučiš prvu moć!', 'Press Q, W or E to learn your first ability!'));
  laneIntro(player);
  refreshShop();
  beginPrep();
  sfx('levelup');
}
/* ⏳ odbrojavanje pripreme i gumb "Kreni odmah" u zaglavlju dućana (dućan je u pripremi otvoren i zaklanja sredinu ekrana) */
let shopPrepShown = null, shopPrepSec = -1;
function syncShopPrep(){
  const el = document.getElementById('shopPrep');
  if(!el) return;
  const on = running && !gameOver && gameTime < 0;
  if(on !== shopPrepShown){ el.classList.toggle('hidden', !on); shopPrepShown = on; }
  if(!on) return;
  const sec = Math.ceil(-gameTime);
  if(sec !== shopPrepSec){ shopPrepSec = sec; document.getElementById('shopPrepT').textContent = sec; el.classList.toggle('soon', sec <= 5); }
  const btn = document.getElementById('shopPrepGo'), solo = net.mode !== 'host' && net.mode !== 'guest';
  if(btn.classList.contains('hidden') === solo) btn.classList.toggle('hidden', !solo);
}
/* ⏳ priprema na početku (kao u DotA prije roga): 30 s za kupovinu — sat kreće od -0:30, a vojnici,
   čudovišta u džungli, rune i pasivno zlato tek u 0:00; dućan se sam otvori */
function beginPrep(){
  gameTime = -CFG.prepTime;
  waveTimer = CFG.prepTime + CFG.firstWave;
  prepTick = 0; prepShop = false;
  if(CFG.prepTime > 0 && !shopOpen){ toggleShop(); prepShop = true; }
  annLog = []; annEvent('welcome');   // 📣 "Welcome to Dota Kids!"
}
function prepOver(){   // 📯 rog: bitka počinje (najavu daje prvi val vojnika)
  sfx('horn');
  if(net.mode !== 'guest'){ laneIntro(player); if(remoteHero) laneIntro(remoteHero); }   // 🛣️ podsjetnik: kreni na svoju stazu
  if(prepShop && shopOpen) toggleShop();
  prepShop = false;
}
function skipPrep(){   // ▶️ igra protiv botova: ne čekaj do kraja pripreme
  if(gameTime >= 0 || gameOver || net.mode === 'host' || net.mode === 'guest') return;
  const rem = -gameTime;
  gameTime = 0;
  waveTimer = Math.max(0, waveTimer - rem);
  for(const c of camps) if(c.respawnT > 0) c.respawnT = Math.max(0.01, c.respawnT - rem);
  sfx('click');
  prepOver();
}

function endGame(winTeam){
  if(net.mode === 'host') sendNet({ c: 'end', win: winTeam });
  endGameView(winTeam);
}
function endGameView(winTeam){
  recordHist(true);   // 📈 zadnja točka grafa
  gameOver = true;
  winnerTeam = winTeam;
  const won = player && player.team === winTeam;
  pendingCast = null;
  hoverUi = null; invDrag = null;
  if(typeof hideItemTip === 'function') hideItemTip();   // opis predmeta ne smije ostati preko završnog ekrana
  if(shopOpen) toggleShop();
  localBanner(won ? L('🏆 POBJEDA!', '🏆 VICTORY!') : L('💔 PORAZ...', '💔 DEFEAT...'), won ? L('Neprijateljski prijestol se raspada!', 'The enemy throne is crumbling!') : L('Naš prijestol je pao...', 'Our throne has fallen...'), won ? 'gold' : 'red');   // svatko svoju
  voxSay('ann', won ? 'victory' : 'defeat');   // i kod gosta (svatko iz svoje perspektive)
  startCinematic(ANCIENT_POS[1 - winTeam]);   // kamera leti do prijestola koji se raspada
  sfx(won ? 'win' : 'lose');
  setTimeout(() => showEndScreen(winTeam, won), 3200);
}
/* 📈 povijest igre za graf na kraju (kao u DotA): svakih 10 s razlika u zlatu i iskustvu timova
   (plavi − crveni) i događaji — srušene kule i vojarne, Veliki Zmaj */
let gameHist = { pts: [], ev: [], nextT: 0 };
function heroXpTotal(h){ let s = h.xp || 0; for(let l = 1; l < h.level; l++) s += xpNeed(l); return s; }
function recordHist(force){
  if(!running || gameTime < 0 || (!force && gameTime < gameHist.nextT)) return;
  gameHist.nextT = gameTime + 10;
  const nw = [0, 0], xp = [0, 0];
  for(const h of units) if(h.kind === 'hero' && h.team <= 1){ nw[h.team] += netWorth(h); xp[h.team] += heroXpTotal(h); }
  gameHist.pts.push([Math.round(gameTime), nw[0] - nw[1], Math.round(xp[0] - xp[1])]);
}
function histEvent(kind, team){ if(gameTime >= 0) gameHist.ev.push([Math.round(gameTime), kind, team]); }
function histGraphHtml(){
  const P = gameHist.pts;
  if(P.length < 3) return '';
  const W = 640, H = 170, pl = 46, pr = 12, pt = 26, pb = 22, iw = W - pl - pr, mid = pt + (H - pt - pb) / 2, hh = (H - pt - pb) / 2;
  const tMax = Math.max(60, P[P.length - 1][0]);
  let m = 1000;
  for(const p of P) m = Math.max(m, Math.abs(p[1]), Math.abs(p[2]));
  const nice = [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 50000, 80000, 100000].find(v => v >= m) || m;
  const X = t => (pl + t / tMax * iw).toFixed(1), Y = v => (mid - v / nice * hh).toFixed(1);
  const fmt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000) + LS('k') : Math.abs(v));   // tisuće (ćirilica: к)
  const line = P.map(p => X(p[0]) + ',' + Y(p[1])).join(' ');
  const area = `${X(P[0][0])},${mid} ${line} ${X(P[P.length - 1][0])},${mid}`;
  let g = `<svg class="etGraph" viewBox="0 0 ${W} ${H}" role="img">` +
    `<defs><clipPath id="hgTop"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath><clipPath id="hgBot"><rect x="0" y="${mid}" width="${W}" height="${H}"/></clipPath></defs>`;
  for(const v of [nice, nice / 2, -nice / 2, -nice])
    g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="hgGrid"/><text x="${pl - 6}" y="${(+Y(v) + 4).toFixed(1)}" class="hgLbl" text-anchor="end">${fmt(v)}</text>`;
  for(let t = 300; t < tMax; t += tMax > 2400 ? 600 : 300)
    g += `<line x1="${X(t)}" x2="${X(t)}" y1="${pt}" y2="${H - pb}" class="hgGrid"/><text x="${X(t)}" y="${H - 6}" class="hgLbl" text-anchor="middle">${Math.round(t / 60)}:00</text>`;
  g += `<polygon points="${area}" class="hgBlue" clip-path="url(#hgTop)"/><polygon points="${area}" class="hgRed" clip-path="url(#hgBot)"/>`;
  g += `<line x1="${pl}" x2="${W - pr}" y1="${mid}" y2="${mid}" class="hgZero"/>`;
  g += `<polyline points="${P.map(p => X(p[0]) + ',' + Y(p[2])).join(' ')}" class="hgXp"/><polyline points="${line}" class="hgGold"/>`;
  for(const [t, k, team] of gameHist.ev){
    const x = X(t), y = team === TEAM_BLUE ? pt - 12 : pt - 2;
    g += `<circle cx="${x}" cy="${y}" r="8.5" class="${team === TEAM_BLUE ? 'hgEvB' : 'hgEvR'}"/><text x="${x}" y="${(y + 4).toFixed(1)}" class="hgEv" text-anchor="middle">${{ tower: '🗼', rax: '🏚️', boss: '🐲' }[k] || '•'}</text>`;
  }
  g += '</svg>';
  const me = player ? (player.team === TEAM_BLUE ? L('ti si 🔵', 'you are 🔵') : L('ti si 🔴', 'you are 🔴')) : '';
  return `<div class="etGraphBox"><div class="etGraphT">📈 ${L('Tko je vodio', 'Who was ahead')} <small>(${me})</small></div>${g}` +
    `<div class="etGraphL"><span class="hgLB">▲ ${L('Plavi vode', 'Blue ahead')}</span><span class="hgLR">▼ ${L('Crveni vode', 'Red ahead')}</span>` +
    `<span><i class="hgLGold"></i>${L('zlato', 'gold')}</span><span><i class="hgLXp"></i>${L('iskustvo', 'experience')}</span><span>🗼 ${L('kula', 'tower')} · 🐲 ${L('Zmaj', 'Dragon')}</span></div></div>`;
}
function teamNetWorth(team){ return units.reduce((a, h) => a + (h.kind === 'hero' && h.team === team ? netWorth(h) : 0), 0); }
/* 🎯 v0.54 bogata meta: koliko zlata nosi junak puno bogatiji od prosjeka svih junaka (dobiva ga tim koji ga sruši) */
function richBounty(t){
  if(!(CFG.richPct > 0) || !t || t.kind !== 'hero') return 0;
  let sum = 0, n = 0;
  for(const h of units) if(h.kind === 'hero' && !h.removeMe){ sum += netWorth(h); n++; }
  const over = netWorth(t) - sum / Math.max(1, n);
  return over > CFG.richFrom ? Math.min(CFG.richMax, Math.round((over - CFG.richFrom) * CFG.richPct / 10) * 10) : 0;
}
let richT = 0;
function updateRichBounty(dt){   // za oznaku 🎯 iznad junaka: jednom u sekundi je dosta
  richT -= dt;
  if(richT > 0) return;
  richT = 1;
  for(const h of units) if(h.kind === 'hero') h.richBounty = richBounty(h);
}
/* neto vrijednost (kao u DotA): zlato + vrijednost svih predmeta */
function netWorth(h){
  return Math.floor(h.gold + h.items.concat(h.backpack || []).reduce((a, it) => a + (it.cost != null ? itemFullCost(ITEM_BY_ID[it.id] || it) : 0), 0));
}
/* 🏅 medalje na kraju igre: svaka ide junaku koji je u nečemu najbolji (djeci je zabavno vidjeti svoju) */
const AWARDS = [
  { k: 'kills',   e: '🥇', n: L('Lovac', 'Hunter'),      d: L('najviše pobjeda nad junacima', 'most hero kills'), v: h => h.kills },
  { k: 'assists', e: '🤝', n: L('Pomagač', 'Helper'),    d: L('najviše asistencija', 'most assists'),           v: h => h.assists },
  { k: 'lh',      e: '🪙', n: L('Zlatar', 'Goldsmith'),     d: L('najviše zadnjih udaraca', 'most last hits'),       v: h => h.lastHits || 0 },
  { k: 'hdmg',    e: '💥', n: L('Razbijač', 'Smasher'),   d: L('najviše štete junacima', 'most damage to heroes'),        v: h => h.heroDmg },
  { k: 'bdmg',    e: '🏰', n: L('Rušitelj', 'Wrecker'),   d: L('najviše štete kulama', 'most damage to towers'),          v: h => h.bldDmg },
  { k: 'alive',   e: '🛡️', n: L('Neuništiv', 'Unbreakable'),  d: L('najmanje padova (najviše 2)', 'fewest deaths (2 at most)'),   v: h => h.deaths <= 2 ? 100 - h.deaths * 10 + h.kills + h.assists * 0.5 : 0 },
];
function computeAwards(heroes){
  const out = new Map();   // junak → [medalje]
  for(const a of AWARDS){
    let best = null, bv = 0;
    for(const h of heroes){ const v = a.v(h); if(v != null && v > bv){ bv = v; best = h; } }
    if(best){ if(!out.has(best)) out.set(best, []); out.get(best).push(a); }
  }
  return out;
}
/* završna tablica (kao u DotA): po timovima, K/D/A, zadnji udarci, neto vrijednost, predmeti, 👑 najbolji igrač */
function endTableHtml(winTeam){
  const heroesAll = units.filter(u => u.kind === 'hero');
  const awards = computeAwards(heroesAll);
  const score = h => h.kills * 3 + h.assists * 1.5 - h.deaths + (h.lastHits || 0) / 15 + netWorth(h) / 1500;
  const mvp = heroesAll.slice().sort((a, b) => score(b) - score(a))[0];
  const icon = it => it && ITEM_BY_ID[it.id] ? `<img class="etItem" src="${itemIconUrl(ITEM_BY_ID[it.id])}" title="${it.name}" alt="${it.emoji}">` : '<span class="etItem etEmpty"></span>';
  let html = '<table class="endT">';
  for(const team of [TEAM_BLUE, TEAM_RED]){
    const hs = heroesAll.filter(h => h.team === team).sort((a, b) => netWorth(b) - netWorth(a));
    const win = team === winTeam;
    html += `<tr class="etTeam t${team}"><th colspan="6">${team === TEAM_BLUE ? '🔵 ' + SIDE_NAME[0] : '🔴 ' + SIDE_NAME[1]} ${win ? L('<span class="etWin">🏆 POBJEDNIK</span>', '<span class="etWin">🏆 WINNER</span>') : ''}</th></tr>`;
    html += L('<tr class="etHead"><th>Junak</th><th>Lvl</th><th>K / D / A</th><th>LH / DN</th><th>🪙 Neto</th><th>Predmeti</th></tr>', '<tr class="etHead"><th>Hero</th><th>Lvl</th><th>K / D / A</th><th>LH / DN</th><th>🪙 Net</th><th>Items</th></tr>');
    for(const h of hs){
      const items = [];
      for(let i = 0; i < CFG.inventorySlots; i++) items.push(icon(h.items[i]));
      html += `<tr class="${h.isPlayer ? 'etMe' : ''}"><td class="etHero"><img src="assets/hero_${h.hero.id}.jpg" alt="${h.emoji}" onerror="this.replaceWith(document.createTextNode('${h.emoji}'))">` +
        `<span>${h === mvp ? '👑 ' : ''}${h.name}${h.isPlayer ? L(' <b>(TI)</b>', ' <b>(YOU)</b>') : ''}${(awards.get(h) || []).map(a => `<i class="etAw" title="${a.n} — ${a.d}">${a.e}</i>`).join('')}</span></td>` +
        `<td>${h.level}</td><td><b class="etK">${h.kills}</b> / <b class="etD">${h.deaths}</b> / <b class="etA">${h.assists}</b></td>` +
        `<td>${h.lastHits || 0} / ${h.denies || 0}</td><td class="etNw">${netWorth(h)}</td>` +
        `<td class="etItems">${items.join('')}${h.neutral ? `<img class="etItem etNeut" src="${itemIconUrl(h.neutral)}" title="${h.neutral.name}">` : ''}</td></tr>`;
    }
  }
  html += '</table>';
  if(mvp) html += `<div class="etMvp">👑 ${L('Najbolji igrač', 'Best player')}: <b>${mvp.emoji} ${mvp.name}</b> — ${mvp.kills} / ${mvp.deaths} / ${mvp.assists}</div>`;
  const mine = player && awards.get(player);
  if(mine) html += `<div class="etMvp etMine">🏅 ${L('Tvoje medalje', 'Your medals')}: ${mine.map(a => `<b>${a.e} ${a.n}</b> <small>(${a.d})</small>`).join(' · ')}</div>`;
  if(net.mode !== 'host' && net.mode !== 'guest')
    html += `<div class="etMvp">🤖 ${L('Botovi', 'Bots')}: <b>${{ easy: L('🐣 Lako', '🐣 Easy'), normal: L('⚔️ Normalno', '⚔️ Normal'), hard: L('🔥 Teško', '🔥 Hard') }[SETTINGS.diff]}</b>` +
      (gameMode() === 'turbo' ? ` · <b>${L('⚡ Brza igra', '⚡ Quick game')}</b>` : '') + `</div>`;
  return html;
}
function showEndScreen(winTeam, won){
  document.getElementById('endEmoji').textContent = won ? '🎉🏆🎉' : '😢💔😢';
  document.getElementById('endTitle').textContent = won ? L('POBJEDA!', 'VICTORY!') : L('PORAZ!', 'DEFEAT!');
  document.getElementById('endTitle').style.color = won ? '#fde047' : '#fca5a5';
  const fresh = recordGame(won);   // 🏆 nova postignuća idu IZNAD tablice (odmah se vide), profil ispod
  document.getElementById('endTable').innerHTML = achievementsNewHtml(fresh) + endTableHtml(winTeam) + histGraphHtml() + profileLineHtml();
  if(fresh.length) setTimeout(() => sfx('levelup'), 600);
  const conf = document.getElementById('confetti');
  conf.innerHTML = '';
  if(won){
    for(let i = 0; i < 26; i++){
      const s = document.createElement('span');
      s.textContent = choice(['🎉', '🎊', '⭐', '🏆', '✨']);
      s.style.left = rand(0, 100) + '%';
      s.style.animationDelay = rand(0, 2.5) + 's';
      s.style.fontSize = rand(18, 38) + 'px';
      conf.appendChild(s);
    }
  }
  document.getElementById('end').classList.remove('hidden');
}

/* ================= 🏆 PROFIL I POSTIGNUĆA =================
   Igra pamti (u pregledniku) koliko si igara odigrao i dobio, pobjede sa svakim junakom
   i postignuća. Novo postignuće se pokaže na završnom ekranu; sve se vide na ekranu odabira. */
const ACHIEVEMENTS = [
  { k: 'first_win',  e: '🎉', n: L('Prva pobjeda', 'First Win'),   d: L('pobijedi u igri', 'win a game') },
  { k: 'first_blood',e: '🩸', n: L('Prva krv', 'First Blood'),       d: L('pobijedi prvog junaka u igri', 'get the first hero kill of the game') },
  { k: 'hunter',     e: '⚔️', n: L('Lovac', 'Hunter'),          d: L('10 pobjeda nad junacima u jednoj igri', '10 hero kills in one game') },
  { k: 'farmer',     e: '🪙', n: L('Zlatar', 'Goldsmith'),         d: L('100 zadnjih udaraca u jednoj igri', '100 last hits in one game') },
  { k: 'spree',      e: '🔥', n: L('U vatri', 'On Fire'),        d: L('5 junaka zaredom bez pada', '5 heroes in a row without dying') },
  { k: 'survivor',   e: '🛡️', n: L('Neuništiv', 'Unbreakable'),      d: L('pobijedi a da ni jednom ne padneš', 'win without dying even once') },
  { k: 'helper',     e: '🤝', n: L('Timski igrač', 'Team Player'),   d: L('15 asistencija u jednoj igri', '15 assists in one game') },
  { k: 'towers',     e: '🏰', n: L('Rušitelj', 'Wrecker'),       d: L('zadnji udarac na 3 kule u jednoj igri', 'last hit on 3 towers in one game') },
  { k: 'dragon',     e: '🐲', n: L('Zmajoubojica', 'Dragon Slayer'),   d: L('tvoj tim pobijedi Velikog Zmaja', 'your team defeats the Great Dragon') },
  { k: 'tango',      e: '🌿', n: L('Proždrljivac', 'Big Eater'),   d: L('pojedi 4 drveta tangom u jednoj igri', 'eat 4 trees with tango in one game') },
  { k: 'mvp',        e: '👑', n: L('Najbolji', 'The Best'),       d: L('budi najbolji igrač igre', 'be the best player of the game') },
  { k: 'legend',     e: '🎓', n: L('Legenda', 'Legend'),        d: L('dođi do levela 25', 'reach level 25') },
  { k: 'hard',       e: '🦸', n: L('Junak', 'Hero'),          d: L('pobijedi botove na težini 🔥 Teško', 'beat the bots on 🔥 Hard') },
  { k: 'five',       e: '🌈', n: L('Svestran', 'All-Rounder'),       d: L('pobijedi s 5 različitih junaka', 'win with 5 different heroes') },
  { k: 'ten_wins',   e: '🏆', n: L('Prvak', 'Champion'),          d: L('ukupno 10 pobjeda', '10 wins in total') },
];
function loadProfile(){
  let p = null;
  try { p = JSON.parse(localStorage.getItem('dk_profile') || 'null'); } catch(e){}
  if(!p || typeof p !== 'object') p = {};
  return Object.assign({ games: 0, wins: 0, heroWins: {}, heroGames: {}, heroStats: {}, ach: {}, cos: { trail: 'stars', hat: 'none' } }, p);
}
function saveProfile(p){ try { localStorage.setItem('dk_profile', JSON.stringify(p)); } catch(e){} }
let gameRecorded = false;
/* upiši ovu igru u profil; vrati popis NOVIH postignuća */
function recordGame(won){
  if(!player || gameRecorded) return [];
  gameRecorded = true;
  const p = loadProfile(), id = player.hero.id, h = player;
  p.games++; p.heroGames[id] = (p.heroGames[id] || 0) + 1;
  {   // 📊 statistika s ovim junakom (ekran odabira)
    const hs = p.heroStats[id] = Object.assign({ k: 0, d: 0, a: 0, bestK: 0, lh: 0 }, p.heroStats[id]);
    hs.k += h.kills; hs.d += h.deaths; hs.a += h.assists; hs.bestK = Math.max(hs.bestK, h.kills); hs.lh = Math.max(hs.lh, h.lastHits || 0);
  }
  if(won){ p.wins++; p.heroWins[id] = (p.heroWins[id] || 0) + 1; }
  const heroesAll = units.filter(u => u.kind === 'hero');
  const score = x => x.kills * 3 + x.assists * 1.5 - x.deaths + (x.lastHits || 0) / 15 + netWorth(x) / 1500;
  const mvp = heroesAll.slice().sort((a, b) => score(b) - score(a))[0];
  const got = {
    first_win: won, first_blood: !!h.firstBlood, hunter: h.kills >= 10, farmer: (h.lastHits || 0) >= 100,
    spree: (h.bestStreak || h.streak || 0) >= 5, survivor: won && h.deaths === 0, helper: h.assists >= 15,
    towers: (h.towerKills || 0) >= 3, dragon: !!h.bossKill, tango: (h.treesEaten || 0) >= 4, mvp: mvp === h,
    legend: h.level >= 25, hard: won && net.mode !== 'host' && net.mode !== 'guest' && SETTINGS.diff === 'hard',
    five: Object.keys(p.heroWins).length >= 5, ten_wins: p.wins >= 10,
  };
  const fresh = [];
  for(const a of ACHIEVEMENTS) if(got[a.k] && !p.ach[a.k]){ p.ach[a.k] = Date.now(); fresh.push(a); }
  saveProfile(p);
  return fresh;
}
/* 🎁 NAGRADE (v0.45): postignuća otključavaju izgled tvog junaka — trag dok hodaš i nešto iznad glave.
   Biraju se na ploči postignuća; vidiš ih ti (u igri s prijateljem svatko vidi svoje). */
const COSMETICS = {
  trail: [
    { id: 'none',    e: '🚫', n: L('Bez traga', 'No trail') },
    { id: 'stars',   e: '⭐', n: L('Zvjezdice', 'Stars') },
    { id: 'hearts',  e: '💖', n: L('Srca', 'Hearts'),          need: 'first_win' },
    { id: 'notes',   e: '🎵', n: L('Note', 'Music notes'),     need: 'helper' },
    { id: 'coins',   e: '🪙', n: L('Zlatnici', 'Coins'),       need: 'farmer' },
    { id: 'fire',    e: '🔥', n: L('Plamen', 'Flames'),        need: 'spree' },
    { id: 'snow',    e: '❄️', n: L('Pahulje', 'Snowflakes'),   need: 'survivor' },
    { id: 'rainbow', e: '🌈', n: L('Duga', 'Rainbow'),         need: 'five' },
  ],
  hat: [
    { id: 'none',   e: '🚫', n: L('Ništa', 'Nothing') },
    { id: 'chick',  e: '🐥', n: L('Pile', 'Chick'),            games: 3 },
    { id: 'tophat', e: '🎩', n: L('Cilindar', 'Top hat'),      need: 'hunter' },
    { id: 'fly',    e: '🦋', n: L('Leptir', 'Butterfly'),      need: 'tango' },
    { id: 'dragon', e: '🐲', n: L('Zmajić', 'Little dragon'),  need: 'dragon' },
    { id: 'crown',  e: '👑', n: L('Kruna', 'Crown'),           need: 'mvp' },
    { id: 'star',   e: '🌟', n: L('Zvijezda', 'Star'),          need: 'legend' },
    { id: 'cup',    e: '🏆', n: L('Pehar', 'Trophy'),          need: 'ten_wins' },
  ],
};
const COS_PET = { chick: 1, fly: 1, dragon: 1 };   // ljubimci lete uz junaka, ostalo stoji na glavi
function cosUnlocked(p, c){ return c.need ? !!p.ach[c.need] : (c.games ? p.games >= c.games : true); }
function cosNeedTxt(c){
  if(c.games) return L('odigraj ' + c.games + ' igre', 'play ' + c.games + ' games');
  const a = ACHIEVEMENTS.find(x => x.k === c.need);
  return a ? a.e + ' ' + a.n + ' — ' + a.d : '';
}
let playerCos = { trail: 'stars', hat: 'none' };   // čita ga scene3d.js
function loadCos(){
  const p = loadProfile(), out = {};
  for(const slot of ['trail', 'hat']){
    const c = COSMETICS[slot].find(x => x.id === (p.cos || {})[slot]);
    out[slot] = c && cosUnlocked(p, c) ? c.id : (slot === 'trail' ? 'stars' : 'none');
  }
  playerCos = out;
  return out;
}
/* nove nagrade koje su otključala upravo dobivena postignuća */
function cosFromAch(fresh){
  const keys = fresh.map(a => a.k), out = [];
  for(const slot of ['trail', 'hat']) for(const c of COSMETICS[slot]) if(c.need && keys.includes(c.need)) out.push(c);
  return out;
}
function cosmeticsHtml(p){
  const row = (slot, title) => `<div class="cosRow"><div class="cosT">${title}</div><div class="cosGrid">` +
    COSMETICS[slot].map(c => {
      const ok = cosUnlocked(p, c), on = playerCos[slot] === c.id;
      return `<button class="cosItem${on ? ' on' : ''}${ok ? '' : ' lock'}" data-slot="${slot}" data-id="${c.id}" title="${ok ? c.n : L('🔒 Otključaj: ', '🔒 Unlock: ') + cosNeedTxt(c)}">` +
        `<b>${ok ? c.e : '🔒'}</b><span>${c.n}</span>${ok ? '' : `<small>${cosNeedTxt(c)}</small>`}</button>`;
    }).join('') + '</div></div>';
  return `<div class="cosBox"><h3>🎁 ${L('Nagrade — izgled tvog junaka', 'Rewards — your hero’s look')}</h3>` +
    row('trail', L('✨ Trag dok hodaš', '✨ Trail while you walk')) + row('hat', L('🎩 Iznad glave', '🎩 Above your head')) + '</div>';
}
function achievementsNewHtml(fresh){
  if(!fresh.length) return '';
  const gifts = cosFromAch(fresh);
  return `<div class="achNew"><span class="achNewT">${L('🎖️ Novo postignuće', '🎖️ New achievement')}${fresh.length > 1 ? ' ×' + fresh.length : ''}!</span>` +
    fresh.map((a, i) => `<span class="achBadge" style="animation-delay:${0.4 + i * 0.2}s" title="${a.d}"><b>${a.e}</b>${a.n}</span>`).join('') +
    (gifts.length ? `<span class="achBadge achGift" style="animation-delay:${0.5 + fresh.length * 0.2}s" title="${L('Odaberi je na ploči postignuća', 'Pick it on the achievements panel')}"><b>🎁</b>${L('Nova nagrada', 'New reward')}: ${gifts.map(c => c.e + ' ' + c.n).join(', ')}</span>` : '') + '</div>';
}
function profileLineHtml(){
  const p = loadProfile();
  return L(`<div class="etMvp">🏆 Tvoj profil: <b>${p.wins}</b> pobjeda u <b>${p.games}</b> igara · postignuća <b>${Object.keys(p.ach).length}/${ACHIEVEMENTS.length}</b></div>`,
    `<div class="etMvp">🏆 Your profile: <b>${p.wins}</b> wins in <b>${p.games}</b> games · achievements <b>${Object.keys(p.ach).length}/${ACHIEVEMENTS.length}</b></div>`);
}
/* 🏆 ploča postignuća na ekranu odabira */
function showAchievements(){
  const p = loadProfile();
  loadCos();   // 🎁 označi spremljeni izbor
  let el = document.getElementById('achPanel');
  if(!el){ el = document.createElement('div'); el.id = 'achPanel'; el.className = 'overlay'; document.body.appendChild(el); el.addEventListener('click', e => { if(e.target === el) el.classList.add('hidden'); }); }
  const best = Object.entries(p.heroWins).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, n]) => { const hh = HEROES.find(x => x.id === id); return hh ? hh.emoji + ' ' + hh.name + ' ×' + n : ''; }).filter(Boolean).join(' · ');
  el.innerHTML = `<div class="achBox"><h2>🏆 ${L('Postignuća', 'Achievements')}</h2>
    <div class="achSum">${L(`🎮 ${p.games} igara · 🏆 ${p.wins} pobjeda${best ? ' · najčešće pobjeđuješ s: ' + best : ''}`, `🎮 ${p.games} games · 🏆 ${p.wins} wins${best ? ' · you win most with: ' + best : ''}`)}</div>
    ${cosmeticsHtml(p)}
    <div class="achGrid">${ACHIEVEMENTS.map(a => `<div class="achItem${p.ach[a.k] ? ' on' : ''}"><b>${p.ach[a.k] ? a.e : '🔒'}</b><span><strong>${a.n}</strong><small>${a.d}</small></span></div>`).join('')}</div>
    <button class="achClose">${L('Zatvori ✖', 'Close ✖')}</button></div>`;
  el.querySelector('.achClose').addEventListener('click', () => el.classList.add('hidden'));
  for(const b of el.querySelectorAll('.cosItem')) b.addEventListener('click', () => {   // 🎁 odaberi nagradu
    if(b.classList.contains('lock')){ sfx('click'); return; }
    const pr = loadProfile();
    pr.cos = Object.assign({}, pr.cos, { [b.dataset.slot]: b.dataset.id }); saveProfile(pr); loadCos();
    for(const x of el.querySelectorAll('.cosItem[data-slot="' + b.dataset.slot + '"]')) x.classList.toggle('on', x === b);
    sfx('coin');
  });
  el.classList.remove('hidden');
  sfx('click');
}
/* broj pobjeda sa svakim junakom na njegovoj kartici */
function refreshHeroWins(){
  const p = loadProfile();
  HEROES.forEach((h, i) => {
    const c = document.getElementById('card-' + i); if(!c) return;
    let b = c.querySelector('.c-wins');
    const n = p.heroWins[h.id] || 0;
    if(!n){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('div'); b.className = 'c-wins'; c.appendChild(b); }
    b.textContent = '🏆' + n; b.title = L(n + ' pobjeda s ovim junakom', n + ' wins with this hero');
  });
  const btn = document.getElementById('achBtn');
  if(btn) btn.innerHTML = L('🏆<span class="lbl"> Postignuća ', '🏆<span class="lbl"> Achievements ') + Object.keys(p.ach).length + '/' + ACHIEVEMENTS.length + '</span>';
}

/* ================= Zvuk ================= */
let AC = null;
function ac(){
  if(!AC){
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ AC = null; }
  }
  return AC;
}
/* 🔊 v0.41 zvuk: svi efekti idu kroz zajednički kompresor (bez pucketanja kad ih je puno odjednom) i malo jeke;
   efekti u svijetu (sfxAt) su tiši izdaleka i lijevo/desno prema mjestu na ekranu */
const SND = { bus: null, noise: null };
function sndBus(){
  const a = ac();
  if(!a) return null;
  if(SND.bus) return SND.bus;
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
  comp.connect(a.destination);
  const wet = a.createGain(); wet.gain.value = 0.16;   // mala jeka (prostor bojišta)
  const conv = a.createConvolver();
  const len = Math.floor(a.sampleRate * 0.9), ir = a.createBuffer(2, len, a.sampleRate);
  for(let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  conv.buffer = ir; conv.connect(wet); wet.connect(comp);
  const nb = a.createBuffer(1, a.sampleRate, a.sampleRate), nd = nb.getChannelData(0);
  for(let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  SND.noise = nb;
  SND.bus = { dry: comp, rev: conv };
  return SND.bus;
}
/* izlaz za jedan zvuk: glasnoća + položaj lijevo/desno, dio ide u jeku */
function sndOut(o){
  const a = ac(), bus = sndBus();
  if(!a || !bus) return null;
  const g = a.createGain(); g.gain.value = o && o.k != null ? o.k : 1;
  let node = g;
  if(o && o.pan && a.createStereoPanner){ const p = a.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); node = p; }
  node.connect(bus.dry);
  const send = a.createGain(); send.gain.value = o && o.rev != null ? o.rev : 0.5; node.connect(send); send.connect(bus.rev);
  return g;
}
function tone(freq, dur, type, vol, slideTo, delay, out){
  vol *= SETTINGS.vol;   // ⚙️ glasnoća iz postavki
  if(vol < 0.0005) return;
  const a = ac();
  if(!a) return;
  const dst = out || sndOut();
  if(!dst) return;
  const t0 = a.currentTime + (delay || 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dst);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
/* šum kroz filtar: udarci, fijuk, prasak, šuškanje (f0 → f1 = pomak filtra) */
function noise(dur, vol, ftype, f0, f1, q, delay, out){
  vol *= SETTINGS.vol;
  if(vol < 0.0005) return;
  const a = ac(); if(!a || !sndBus()) return;
  const dst = out || sndOut();
  if(!dst) return;
  const t0 = a.currentTime + (delay || 0);
  const src = a.createBufferSource(); src.buffer = SND.noise;
  const f = a.createBiquadFilter(); f.type = ftype || 'bandpass'; f.Q.value = q || 1;
  f.frequency.setValueAtTime(f0, t0);
  if(f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.01, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dst);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
}
/* zvono (zlatnik, level): osnovni ton + viši alikvoti koji brže nestaju */
function bell(freq, dur, vol, delay, out){
  tone(freq, dur, 'sine', vol, 0, delay, out);
  tone(freq * 2.76, dur * 0.5, 'sine', vol * 0.35, 0, delay, out);
  tone(freq * 5.4, dur * 0.25, 'sine', vol * 0.15, 0, delay, out);
}
function sfx(name, o){
  if(muted) return;
  const now = performance.now();
  if(sfxLast[name] && now - sfxLast[name] < 60) return;
  sfxLast[name] = now;
  const out = sndOut(o);
  if(!out) return;
  const T = (f, d, ty, v, sl, dl) => tone(f, d, ty, v, sl, dl, out), N = (d, v, ty, f0, f1, q, dl) => noise(d, v, ty, f0, f1, q, dl, out);
  switch(name){
    case 'hit':     N(0.06, 0.09, 'bandpass', 1600, 700, 1.2); T(150, 0.09, 'sine', 0.09, 60); break;                 // tup udarac
    case 'pew':     N(0.14, 0.05, 'highpass', 3200, 900, 0.7); T(700, 0.1, 'triangle', 0.025, 330); break;           // fijuk strijele
    case 'pewc':    N(0.1, 0.04, 'highpass', 3000, 1200, 0.7); break;
    case 'hitc':    N(0.05, 0.07, 'bandpass', 1300, 600, 1.2); break;
    case 'cast':    T(440, 0.18, 'triangle', 0.05, 990); T(445, 0.18, 'sine', 0.04, 1000, 0.02); N(0.25, 0.03, 'bandpass', 5000, 9000, 4, 0.03); break;   // svjetlucanje
    case 'ult':     T(220, 0.4, 'sawtooth', 0.05, 880); T(330, 0.35, 'triangle', 0.07, 1320, 0.08); N(0.5, 0.07, 'lowpass', 1200, 120, 0.8); T(70, 0.45, 'sine', 0.12, 40); break;
    case 'zap':     T(1400, 0.08, 'sawtooth', 0.04, 300); N(0.1, 0.06, 'bandpass', 4000, 1500, 3); T(900, 0.06, 'square', 0.02, 2600, 0.04); break;
    case 'boom':    N(0.55, 0.16, 'lowpass', 1100, 70, 0.9); T(95, 0.5, 'sine', 0.14, 38); break;                     // prasak
    case 'heal':    bell(784, 0.5, 0.05); bell(988, 0.5, 0.045, 0.07); bell(1318, 0.6, 0.04, 0.14); break;
    case 'kill':    bell(659, 0.35, 0.08); bell(880, 0.35, 0.08, 0.09); bell(1318, 0.6, 0.09, 0.18); N(0.3, 0.04, 'highpass', 6000, 9000, 1, 0.18); break;
    case 'tower':   N(0.9, 0.18, 'lowpass', 700, 50, 0.7); T(110, 0.8, 'sine', 0.16, 35); N(0.6, 0.06, 'bandpass', 2500, 400, 1, 0.12); break;   // rušenje
    case 'levelup': [523, 659, 784, 1046].forEach((f, i) => bell(f, 0.45, 0.07, i * 0.085)); N(0.6, 0.035, 'highpass', 7000, 11000, 1, 0.25); break;
    case 'buy':     bell(1318, 0.35, 0.07); bell(1976, 0.4, 0.06, 0.07); break;                                        // zveckanje zlatnika
    case 'death':   T(392, 0.35, 'triangle', 0.08, 300); T(294, 0.5, 'triangle', 0.08, 180, 0.22); N(0.5, 0.04, 'lowpass', 800, 100, 0.7, 0.2); break;
    case 'win':     [523, 659, 784].forEach((f, i) => bell(f, 0.45, 0.1, i * 0.14)); bell(1046, 0.9, 0.11, 0.42); bell(1318, 0.9, 0.06, 0.42); break;
    case 'lose':    T(330, 0.25, 'triangle', 0.09); T(277, 0.25, 'triangle', 0.09, 0, 0.22); T(220, 0.6, 'triangle', 0.1, 0, 0.44); break;
    case 'click':   T(1200, 0.035, 'sine', 0.03, 900); break;
    case 'tick':    bell(1568, 0.18, 0.035); break;
    case 'horn':    T(147, 1.1, 'sawtooth', 0.06, 165); T(220, 1.1, 'triangle', 0.07, 247, 0.03); T(294, 0.9, 'sine', 0.05, 330, 0.06); break;
    case 'crit':    N(0.07, 0.12, 'highpass', 5000, 2000, 1); T(2400, 0.12, 'square', 0.025, 1500); T(140, 0.18, 'sine', 0.13, 50, 0.02); N(0.2, 0.07, 'lowpass', 1500, 120, 0.8, 0.02); break;
    case 'stun':    T(620, 0.08, 'square', 0.04, 160); N(0.09, 0.09, 'bandpass', 900, 300, 1.2); bell(1760, 0.16, 0.03, 0.1); bell(2093, 0.16, 0.03, 0.18); bell(1760, 0.16, 0.025, 0.26); break;   // 💫 bonk + ptičice
    case 'whoosh':  N(0.25, 0.06, 'bandpass', 600, 2400, 1.5); break;                                                 // skok / juriš
    case 'coin':    bell(1568 + Math.random() * 200, 0.25, 0.05); break;
  }
}
/* efekt u svijetu: tiši što je dalje od sredine ekrana, lijevo/desno prema položaju */
function sfxAt(name, x, y, k){
  const d = distXY(x, y, cam.x, cam.y);
  if(d > 1500) return;
  sfx(name, { k: Math.max(0.15, 1 - d / 1500) * (k == null ? 1 : k), pan: (x - cam.x) / 900 });
}

/* 🌲 zvukovi prirode (postavka): blagi vjetar, danju ptice, noću cvrčci, kraj rijeke žubor */
const AMB = { on: false, wind: null, water: null, next: 0 };
/* 🎶 GLAZBA (v0.45): vesela pozadinska glazba stvorena u pregledniku (bez datoteka) — mirna na izborniku,
   živahnija u igri; bubanj svira samo kad si u borbi. Melodija su fraze A A B A iz pentatonike nad
   akordima (C Am F G / C G Am F). Tiha, ide kroz isti kompresor kao efekti; gasi se u ⚙️ postavkama. */
const MUS = { g: null, song: null, next: 0, step: 0, phrases: null, fade: 0 };
const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
const SONGS = {
  menu:   { bpm: 88,  chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], scale: [69, 72, 74, 76, 79, 81, 84], seed: 7 },
  battle: { bpm: 108, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], scale: [72, 74, 76, 79, 81, 84, 86], seed: 21, drums: true },
};
function musRng(seed){ let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
/* fraza = 4 takta × 8 osminki; -1 = stanka */
function musPhrase(song, seed){
  const r = musRng(seed), out = [];
  let idx = 2;
  for(let bar = 0; bar < 4; bar++){
    const ch = song.chords[bar];
    for(let st = 0; st < 8; st++){
      if(st === 0){   // na prvu dobu ton akorda
        const want = ch[Math.floor(r() * 3)] + 12;
        idx = song.scale.reduce((bi, n, i) => Math.abs(n - want) < Math.abs(song.scale[bi] - want) ? i : bi, 0);
        out.push(idx); continue;
      }
      if(r() < (st % 2 ? 0.55 : 0.3)){ out.push(-1); continue; }
      idx = clamp(idx + Math.round((r() - 0.5) * 3.2), 0, song.scale.length - 1);
      out.push(idx);
    }
  }
  if(out[31] >= 0) out[31] = -1;   // kraj fraze diše
  return out;
}
function musVoice(freq, t, dur, type, vol, filt){
  const a = AC;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.25, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if(filt){ const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(MUS.g);
  o.start(t); o.stop(t + dur + 0.05);
}
function musPluck(freq, t, dur, type, vol){
  const a = AC;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(MUS.g);
  o.start(t); o.stop(t + dur + 0.05);
}
function musDrum(kind, t, vol){
  const a = AC;
  if(kind === 'kick'){
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(MUS.g); o.start(t); o.stop(t + 0.25);
    return;
  }
  if(!SND.noise) return;
  const src = a.createBufferSource(); src.buffer = SND.noise;
  const f = a.createBiquadFilter(), g = a.createGain();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1700; f.Q.value = kind === 'hat' ? 0.7 : 0.9;
  const d = kind === 'hat' ? 0.035 : 0.13;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f); f.connect(g); g.connect(MUS.g);
  src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
}
function updateMusic(){
  const a = AC;
  if(!a || a.state !== 'running' || !SND.bus) return;
  const want = !SETTINGS.music || muted || SETTINGS.vol <= 0 ? null : (running && !gameOver ? 'battle' : (gameOver ? null : 'menu'));
  if(!MUS.g){ MUS.g = a.createGain(); MUS.g.gain.value = 0; MUS.g.connect(SND.bus.dry); }
  const vol = 0.55 * SETTINGS.vol;
  if(want !== MUS.song){   // promjena pjesme: kratko utišaj pa kreni ispočetka
    MUS.g.gain.setTargetAtTime(0, a.currentTime, 0.25);
    if(a.currentTime < MUS.fade) return;
    if(!MUS.fade){ MUS.fade = a.currentTime + 0.9; return; }
    MUS.fade = 0;
    MUS.song = want; MUS.step = 0; MUS.next = a.currentTime + 0.1;
    if(want){ const sg = SONGS[want]; MUS.phrases = [musPhrase(sg, sg.seed), musPhrase(sg, sg.seed * 3 + 1)]; }
    return;
  }
  if(!want) return;
  MUS.g.gain.setTargetAtTime(vol, a.currentTime, 0.6);
  const sg = SONGS[want], st8 = 60 / sg.bpm / 2;   // trajanje osminke
  const fight = want === 'battle' && gameTime >= 0 && player && !player.dead && gameTime - (player.combatT == null ? -99 : player.combatT) < 5;
  while(MUS.next < a.currentTime + 0.3){
    const t = MUS.next, s = MUS.step, inBar = s % 8, bar = Math.floor(s / 8) % 4, part = Math.floor(s / 32) % 4;   // fraze A A B A
    const ch = sg.chords[bar];
    if(inBar === 0){
      for(const n of ch) musVoice(midiHz(n), t, st8 * 8.4, 'triangle', 0.016, 1400);   // jastuk akorda
      musPluck(midiHz(ch[0] - 24), t, st8 * 3, 'triangle', 0.075);                     // bas
    }
    if(inBar === 4) musPluck(midiHz(ch[0] - 24 + (bar % 2 ? 7 : 0)), t, st8 * 3, 'triangle', 0.06);
    const ph = MUS.phrases[part === 2 ? 1 : 0], ni = ph[s % 32];
    if(ni >= 0){ const f = midiHz(sg.scale[ni]); musPluck(f, t, st8 * 2.2, 'sine', 0.05); musPluck(f * 2, t, st8 * 1.2, 'sine', 0.012); }   // zvončić
    if(sg.drums){
      if(fight){
        if(inBar === 0 || inBar === 4) musDrum('kick', t, 0.16);
        if(inBar === 2 || inBar === 6) musDrum('snare', t, 0.05);
      }
      if(inBar % 2 === 1) musDrum('hat', t, fight ? 0.03 : 0.014);
    }
    MUS.next += st8; MUS.step++;
  }
}
function updateAmbience(){
  const a = AC;
  if(!a || !SND.bus) return;
  const want = running && !muted && SETTINGS.nature && SETTINGS.vol > 0 && !gameOver;
  if(want && !AMB.on){
    const mk = (type, f, q) => {
      const src = a.createBufferSource(); src.buffer = SND.noise; src.loop = true;
      const flt = a.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      const g = a.createGain(); g.gain.value = 0;
      src.connect(flt); flt.connect(g); g.connect(SND.bus.dry); src.start();
      return { src, flt, g };
    };
    AMB.wind = mk('lowpass', 420, 0.6); AMB.water = mk('bandpass', 1400, 0.8);
    AMB.on = true;
  } else if(!want && AMB.on){
    for(const n of [AMB.wind, AMB.water]) try { n.g.gain.setTargetAtTime(0, a.currentTime, 0.2); n.src.stop(a.currentTime + 1); } catch(e){}
    AMB.on = false; AMB.wind = AMB.water = null;
  }
  if(!AMB.on) return;
  const t = a.currentTime, v = SETTINGS.vol;
  AMB.wind.g.gain.setTargetAtTime(v * (0.035 + 0.02 * Math.sin(t * 0.21) + 0.01 * Math.sin(t * 0.73)), t, 0.5);
  AMB.wind.flt.frequency.setTargetAtTime(380 + 160 * Math.sin(t * 0.17), t, 0.5);
  const river = Math.max(0, 1 - Math.abs(cam.x - cam.y) / Math.SQRT2 / 700);   // kamera blizu rijeke
  AMB.water.g.gain.setTargetAtTime(v * 0.05 * river, t, 0.4);
  if(t > AMB.next){   // ptičji cvrkut danju, cvrčci noću
    if(!isNight){ const f = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3), pan = Math.random() * 1.6 - 0.8;
      for(let i = 0; i < n; i++) tone(f * (1 + Math.random() * 0.15), 0.08, 'sine', 0.018, f * 1.35, i * 0.11, sndOut({ pan, rev: 0.8 })); }
    else { const pan = Math.random() * 1.6 - 0.8, o = sndOut({ pan, k: 0.7 });
      for(let i = 0; i < 6; i++) tone(4400, 0.025, 'square', 0.006, 0, i * 0.045, o); }
    AMB.next = t + (isNight ? 1.5 + Math.random() * 2.5 : 3 + Math.random() * 6);
  }
}

/* 🗣️ Glasovi junaka i 📣 najavljivač (voices.js, Fish Audio): govori samo jedan glas.
   Puno važnija replika (+2) prekida trenutnu, ostale važnije od čavrljanja čekaju u redu (do 4 s), čavrljanje se preskoči. */
const VOX = { buf: {}, ld: {}, cur: null, curAnn: false, pri: -1, until: 0, req: 0, el: null, useEl: false,
  unlocked: false, nextChat: 0, hero: null, queue: [], annN: 0, annSeen: 0 };
const VOX_PRI = { move1: 1, move2: 1, attack: 1, pick: 2, respawn: 2, taunt: 2, ult: 3, kill: 3, death: 3 };
// 📣 važnost najava (nenavedene — ubojstva i nizovi — su 5)
const ANN_PRI = { welcome: 3, battle: 3, night: 3, day: 3, tower_enemy: 4, tower_ours: 4, tower_denied: 4,
  barracks_enemy: 4, barracks_ours: 4, throne_enemy: 4, throne_ours: 4, dragon_ours: 4, dragon_enemy: 4,
  drake_ours: 4, drake_enemy: 4, victory: 6, defeat: 6 };
let annLog = [];   // zadnje najave — domaćin ih šalje gostu u snimci (av)
const VOX_SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV////////////////////////////////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQC8AAAAAAAAAGw9wruFgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxHYAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
function voxSrc(id, key){   // id junaka ili 'ann' (najavljivač)
  if(typeof VOICES === 'undefined') return null;
  const ann = id === 'ann';
  if(ann ? (typeof ANNOUNCER === 'undefined' || key === 'voice' || !ANNOUNCER[key]) : !VOICES[id]) return null;
  if(VOICE_LOCAL) return 'assets/voice/' + id + '/' + key + '.mp3';
  const f = ann ? (typeof ANN_REMOTE !== 'undefined' && ANN_REMOTE[key]) : (VOICE_REMOTE[id] || '').split(' ')[VOICE_KEYS.indexOf(key)];
  return f ? VOICE_REMOTE_BASE + f + '.mp3' : null;
}
const voxOn = ann => !muted && SETTINGS.vol > 0 && (ann ? SETTINGS.announcer : SETTINGS.voices);
function voxWarm(src){ const el = new Audio(); el.preload = 'auto'; el.src = src; return src; }   // napuni predmemoriju preglednika
// učitaj repliku: Web Audio (točno i radi na iPadu); ako ne ide (file://, poslužitelj ne dopušta), običan <audio>
// VOX.buf čuva gotove replike (AudioBuffer ili adresu za <audio>) da voxSay može krenuti odmah
function voxLoad(id, key){
  const k = id + '/' + key;
  if(VOX.ld[k]) return VOX.ld[k];
  const src = voxSrc(id, key);
  if(!src) return (VOX.ld[k] = Promise.resolve(null));
  const a = !VOX.useEl && location.protocol !== 'file:' && typeof fetch === 'function' ? ac() : null;
  if(!a) return (VOX.ld[k] = Promise.resolve(VOX.buf[k] = voxWarm(src)));
  return (VOX.ld[k] = fetch(src).then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((res, rej) => a.decodeAudioData(ab, res, rej)))
    .then(b => (VOX.buf[k] = b))
    .catch(() => { VOX.useEl = true; return (VOX.buf[k] = voxWarm(src)); }));
}
function voxStop(){   // zaustavi trenutnu repliku (red čekanja ostaje)
  if(VOX.cur){ VOX.cur.stop(); VOX.cur = null; }
  VOX.until = 0; VOX.pri = -1;
}
function voxHush(){ VOX.queue.length = 0; voxStop(); }   // utišano / isključeno: i red čekanja
function voxEnded(cur){ if(VOX.cur === cur){ voxStop(); voxNext(); } }
function voxStart(x, pri, gain, ann){
  voxStop();
  const v = clamp(SETTINGS.vol * gain, 0, 1);
  const cur = {};
  if(typeof x !== 'string'){   // AudioBuffer
    const a = ac();
    if(a.state === 'suspended') a.resume();
    const s = a.createBufferSource(), g = a.createGain();
    s.buffer = x; g.gain.value = v;
    s.connect(g); g.connect(a.destination);
    s.start();
    s.onended = () => voxEnded(cur);
    cur.stop = () => { try { s.stop(); } catch(e){} };
    VOX.until = performance.now() + x.duration * 1000;
  } else {
    const el = VOX.el || (VOX.el = new Audio());
    el.onended = () => voxEnded(cur);
    el.src = x; el.volume = v;
    const p = el.play();
    if(p && p.catch) p.catch(() => voxEnded(cur));
    cur.stop = () => { try { el.pause(); } catch(e){} };
    VOX.until = performance.now() + 6000;
  }
  VOX.cur = cur; VOX.pri = pri; VOX.curAnn = !!ann;
}
// gotova replika: odmah, prekini (puno važnija) ili u red (do 3, najvažnije prve)
function voxOffer(x, pri, gain, ann, force){
  const now = performance.now();
  if(force || !VOX.cur || now >= VOX.until || pri >= VOX.pri + 2){ voxStart(x, pri, gain, ann); return; }
  if(pri < 2) return;
  const q = VOX.queue;
  q.push({ x, pri, gain, ann, t: now });
  q.sort((a, b) => b.pri - a.pri || a.t - b.t);
  if(q.length > 3) q.length = 3;
}
function voxNext(){
  const now = performance.now();
  while(VOX.queue.length){
    const e = VOX.queue.shift();
    if(now - e.t < 4000 && voxOn(e.ann)){ voxStart(e.x, e.pri, e.gain, e.ann); return; }   // zastarjelo ili isključeno — preskoči
  }
}
// opt: { pri, gain, force } — force: prekini što god govori (pregled glasa u izborniku)
function voxSay(id, key, opt){
  opt = opt || {};
  const ann = id === 'ann';
  if(!voxOn(ann) || !voxSrc(id, key)) return;
  const pri = opt.pri != null ? opt.pri : ann ? (ANN_PRI[key] || 5) : (VOX_PRI[key] || 1);
  const now = performance.now();
  if(!opt.force && pri < 2 && VOX.cur && now < VOX.until && pri < VOX.pri + 2) return;   // čavrljanje dok netko govori
  if(opt.force) VOX.queue.length = 0;
  const token = opt.force ? ++VOX.req : 0;
  const ready = VOX.buf[id + '/' + key];
  if(ready){ voxOffer(ready, pri, opt.gain || 1, ann, opt.force); return; }   // već učitano — odmah, i kad kadar kasni (prvi ulti, slab tablet)
  voxLoad(id, key).then(x => {
    if(opt.force && token !== VOX.req) return;   // u međuvremenu je kliknut drugi junak
    if(!x || performance.now() - now > 2500 || !voxOn(ann)) return;   // prekasno — preskoči
    voxOffer(x, pri, opt.gain || 1, ann, opt.force);
  });
}
// 📣 najava (domaćin / igra protiv botova): odmah se čuje, a gost je dobije u snimci; team = čiji je toranj, tko je ubio zmaja…
function annEvent(key, team){
  const tm = team == null ? -1 : team;
  annLog.push({ n: ++VOX.annN, key, team: tm, t: gameTime });
  if(annLog.length > 8) annLog.shift();
  annPlay(key, tm);
}
function annPlay(key, team){   // "ours" / "enemy" iz perspektive tima ovog igrača
  voxSay('ann', team >= 0 ? key + (team === myTeam ? '_ours' : '_enemy') : key);
}
// iPad/iPhone: <audio> smije svirati tek nakon dodira — "otključaj" ga tihim zvukom pri prvom dodiru/kliku
function voxUnlock(){
  if(VOX.unlocked) return;
  VOX.unlocked = true;
  const el = VOX.el || (VOX.el = new Audio());
  el.src = VOX_SILENT;
  const p = el.play();
  if(p && p.catch) p.catch(() => {});
}
/* 💃 ples (tipka J ili gumb 💃): junak zapleše i kaže šaljivu repliku — kao /dance u LoL-u; vide ga svi (i u mrežnoj igri) */
function startDance(u){
  if(!u || u.dead || u.kind !== 'hero' || gameOver || (u.danceCd || 0) > 0 || u.status.stun > 0) return;
  if(u.tpChannel > 0) cancelTeleport(u);
  u.moveTarget = null; u.attackTarget = null; u.windup = null;
  u.danceT = 3; u.danceCd = 5; u.danceN = (u.danceN || 0) + 1;
}
function pressDance(){
  if(!player || player.dead) return;
  if(net.mode === 'guest') sendNet({ c: 'emote' });
  else startDance(player);
}
// naredbe igrača: ponekad kratka replika (hodanje rjeđe, napad na junaka češće)
function voxCommand(isMove, tgt, opts){
  if(!player || !player.hero || (opts && opts.silent)) return;
  const now = performance.now();
  if(now < VOX.nextChat) return;
  const atk = (opts && opts.amove) || !isMove;
  const chance = !atk ? 0.3 : (tgt && tgt.kind === 'hero' ? 1 : 0.35);
  if(Math.random() >= chance) return;
  VOX.nextChat = now + (atk ? 7000 : 12000);
  voxSay(player.hero.id, atk ? 'attack' : (Math.random() < 0.5 ? 'move1' : 'move2'));
}
// svaki kadar: ulti, pobjeda, pogibija i povratak — radi i za mrežnog gosta (gleda castN/dead/kills iz snapshota)
function voxWatch(){
  if(VOX.cur && !voxOn(VOX.curAnn)) voxHush();
  else if(VOX.cur && performance.now() > VOX.until + 1500) voxEnded(VOX.cur);   // kraj se nije javio — idi dalje
  if(!running || !player || !player.hero || typeof VOICES === 'undefined') return;
  const pid = player.hero.id;
  if(VOX.hero !== pid){
    VOX.hero = pid;
    for(const k of VOICE_KEYS) voxLoad(pid, k);
    if(SETTINGS.announcer && typeof ANN_KEYS !== 'undefined') for(const k of ANN_KEYS) voxLoad('ann', k);
  }
  for(const u of units){
    if(u.kind !== 'hero' || !u.hero) continue;
    const w = u.vox;
    if(!w){
      u.vox = { cn: u.castN || 0, dead: !!u.dead, kills: u.kills || 0, dn: u.danceN || 0 };
      if(u !== player) voxLoad(u.hero.id, 'ult');   // tuđe ulti čuješ kad su blizu
      continue;
    }
    if((u.danceN || 0) !== w.dn){   // 💃 ples: šaljiva replika
      w.dn = u.danceN || 0;
      if(u === player) voxSay(pid, 'taunt');
      else if(!u.dead && seenByPlayer(u) && distXY(u.x, u.y, cam.x, cam.y) < 1300) voxSay(u.hero.id, 'taunt', { pri: 2, gain: 0.8 });
    }
    if((u.castN || 0) !== w.cn){
      w.cn = u.castN || 0;
      if(/:R$/.test(u.castFx || '')){
        if(u === player) voxSay(pid, 'ult');
        else if(!u.dead && seenByPlayer(u) && distXY(u.x, u.y, cam.x, cam.y) < 1300) voxSay(u.hero.id, 'ult', { pri: 2, gain: 0.8 });
      }
    }
    if(u === player){
      if(u.dead && !w.dead) voxSay(pid, 'death');
      else if(!u.dead && w.dead) voxSay(pid, 'respawn');
      else if((u.kills || 0) > w.kills) voxSay(pid, 'kill');
    }
    w.dead = !!u.dead; w.kills = u.kills || 0;
  }
}

/* ================= Unos ================= */
function pickEnemyAt(wx, wy, team){
  let best = null, bd = 1e9;
  for(const e of units){
    if(e.removeMe || e.dead || e.team === team || e.invuln) continue;
    // ne možeš kliknuti što tvoj TIM ne vidi (vrijedi i za mrežnog igrača)
    if(e.kind !== 'tower' && e.kind !== 'ancient'){
      if(e.kind === 'hero' && e.status.invisT > 0 && e.status.trackT <= 0) continue;
      if(!isVisibleTo(team, e)) continue;
    }
    const d = distXY(wx, wy, e.x, e.y);
    if(d < e.r + 34 && d < bd){ bd = d; best = e; }
  }
  return best;
}
/* DotA auto-napad: junak koji stoji besposlen sam napada neprijatelje u dometu
   (junaci prvo, pa vojnici i čudovišta; građevine samo na izričit klik) */
/* ✋ v0.56 S (kao u DotA): stani — prekida hodanje, napad, kanaliziranje i ZAMAH udarca (udarac koji još nije pao se ne troši,
   pa možeš odmah opet udariti: "otkazivanje animacije" za zadnji udarac); junak zatim stoji i sam ne napada dok ne dobije novu naredbu */
function stopHero(h){
  if(!h || h.dead) return;
  h.moveTarget = null; h.attackTarget = null; h.amove = null; h.useOrder = null; h.attackOnce = false;
  cancelTeleport(h);
  if(h.chan) cancelChannel(h, chanMsg(h.chan));
  if(h.windup && gameTime < h.windup.t){ h.windup = null; h.atkTimer = 0; }   // otkazan zamah: napad nije potrošen
  h.hold = true;
  if(isHuman(h)) addFloat(h.x, h.y - 24, L('✋ Stojiš', '✋ Holding'), '#e5e7eb', 12, h.team);
}
function autoAcquire(u, amove){
  // ⚔️ napad u hodu (A + klik) gleda dalje i napada i čudovišta i građevine na putu
  const R = u.atkRange + (amove ? 320 : 70);
  const vis = e => isVisibleTo(u.team, e);
  const t = nearestEnemyOf(u, R, e => e.kind === 'hero' && vis(e)) ||
            nearestEnemyOf(u, R, e => (e.kind === 'creep' || (e.kind === 'neutral' && (amove || (!e.returning && e.attackTarget)))) && vis(e)) ||
            (amove ? nearestEnemyOf(u, u.atkRange + 120, e => isStructure(e)) : null);
  if(t) u.attackTarget = t;
}
/* klik na vlastitog ranjenog vojnika (ispod 50%) ili kulu (ispod 10%) = uskrati ga */
function pickDeniableAt(wx, wy, h){
  let best = null, bd = 1e9;
  for(const e of units){
    if(e.team !== h.team || e === h || !canDeny(e)) continue;
    const d = distXY(wx, wy, e.x, e.y);
    if(d < e.r + 30 && d < bd){ bd = d; best = e; }
  }
  return best;
}
/* može li h napasti ovu jedinicu klikom (neprijatelj kojeg tim vidi, ili vlastita koja se može uskratiti)? */
function canAttackTarget(h, t){
  if(!h || !t || t.dead || t.removeMe || t === h) return false;
  if(t.team === h.team) return canDeny(t);
  if(t.invuln) return false;
  if(isStructure(t)) return true;
  if(t.kind === 'hero' && t.status.invisT > 0 && t.status.trackT <= 0) return false;
  return isVisibleTo(h.team, t);
}
/* naredba mišem: tgt = jedinica pod mišem (v0.31, po tijelu na ekranu), null = ništa pod mišem,
   undefined = stari način (najbliža jedinica točki na tlu — mrežni gost bez cilja, minimapa)
   opts.amove = napad u hodu (A + klik), opts.silent = držanje miša (bez oznake i zvuka) */
function playerCommandFor(h, wx, wy, tgt, opts){
  if(!h || h.dead || gameOver) return;
  opts = opts || {};
  cancelTeleport(h);   // nova naredba prekida teleport
  h.amove = null; h.useOrder = null;
  if(h.chan) cancelChannel(h, chanMsg(h.chan));
  for(const a of ancients){
    if(a && a.invuln && a.team !== h.team && (tgt === a || (tgt === undefined && distXY(wx, wy, a.x, a.y) < a.r + 26))){
      addFloat(a.x, a.y, L('🛡️ Prvo sruši čuvarske kule!', '🛡️ First destroy the guard towers!'), '#fff', 15);
    }
  }
  if(tgt && tgt.invuln && tgt.team !== h.team && (tgt.kind === 'tower' || tgt.kind === 'barracks'))   // 🔒 v0.56: dublje kule redom
    addFloat(tgt.x, tgt.y, tgt.isGuard ? L('🔒 Prvo sruši kulu na ulazu u bazu (T3)!', '🔒 First destroy a base tower (T3)!') :
      (tgt.kind === 'barracks' ? L('🔒 Prvo sruši kulu ispred vojarne!', '🔒 First destroy the tower in front of the barracks!') : L('🔒 Prvo sruši kulu ispred!', '🔒 First destroy the tower in front!')), '#fff', 15);
  const t = tgt === undefined ? (pickEnemyAt(wx, wy, h.team) || pickDeniableAt(wx, wy, h)) : (canAttackTarget(h, tgt) ? tgt : null);
  h.hold = false; h.attackOnce = false;
  if(t){
    h.attackTarget = t;
    h.moveTarget = null;
    // 🪙 v0.56 A + klik na vojnika ili čudovište: JEDAN udarac pa stani — za zadnji udarac i uskraćivanje (ne guraš stazu)
    if(opts.amove && (t.kind === 'creep' || t.kind === 'neutral')) h.attackOnce = true;
    if(t.kind === 'hero') drawAggro(h, t);                    // DotA: već sama naredba napada povlači aggro
    else if(t.team === h.team && t.kind === 'creep') dropAggro(h, t);   // klik na svog vojnika: neprijateljski vojnici te puste
    markers.push({ x: t.x, y: t.y, t: 0, color: t.team === h.team ? '#fde047' : '#f87171', r: t.r + 14 });
  } else {
    const dest = { x: wx, y: wy };   // klik na prijatelja ili prazno tlo: idi točno onamo
    h.attackTarget = null;
    h.moveTarget = { x: clamp(dest.x, 40, WORLD - 40), y: clamp(dest.y, 40, WORLD - 40) };
    if(opts.amove) h.amove = true;
    if(!opts.silent) markers.push({ x: dest.x, y: dest.y, t: 0, color: opts.amove ? '#f87171' : '#4ade80', r: 22 });
  }
  if(h.isPlayer && !opts.silent) sfx('click');
}
// igračeva naredba — lokalno ili preko mreže (gost); vraća true ako je to hodanje (ne napad)
function playerCommand(wx, wy, tgt, opts){
  if(!player || player.dead || gameOver) return false;
  const isMove = !(tgt && canAttackTarget(player, tgt));
  voxCommand(isMove, tgt, opts);
  if(net.mode === 'guest'){
    netCmd(wx, wy, tgt === undefined ? undefined : (tgt ? tgt.id : null), opts && opts.amove, opts && opts.silent);
    if(!(opts && opts.silent)) sfx('click');
    return isMove;
  }
  playerCommandFor(player, wx, wy, tgt, opts);
  return isMove;
}
function inRect(sx, sy, r){ return r && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h; }
/* ploče HUD-a: donja ploča junaka, naredbena kartica, gornja ploča s rezultatom */
function hudPanelAt(sx, sy){
  if(!running || !player) return false;
  const HL = hudLayout(), tw = 280;
  return inRect(sx, sy, { x: HL.px, y: HL.py, w: HL.pw, h: HL.ph }) ||
    inRect(sx, sy, { x: HL.cardX, y: HL.cardY, w: HL.cardW, h: HL.cardH }) ||
    inRect(sx, sy, { x: (VW - tw) / 2, y: 8, w: tw, h: 64 });
}
/* 👆 je li dodir na HUD-u (gumbi, predmeti, minimapa, ploče)? — tamo prst ne pomiče kameru */
function hudHit(sx, sy){
  const R = uiRects;
  for(const L of [R.learn, R.abil, R.sum, R.inv, R.qb, R.buff, chatOpen ? R.chat : null])
    for(const r of L || []) if(r && inRect(sx, sy, r)) return true;
  for(const r of [R.prepSkip, R.buyback, R.statBtn, R.glyph, R.tp, R.shop, R.mute, R.help, R.opts, R.score, R.center, R.mini,
    R.neutral, R.passive, R.talent && R.talent.a, R.talent && R.talent.b]) if(r && inRect(sx, sy, r)) return true;
  return hudPanelAt(sx, sy);
}
function miniToWorld(sx, sy){
  const m = uiRects.mini;
  return { x: (sx - m.x) / m.w * WORLD, y: (sy - m.y) / m.h * WORLD };
}
function aimFallback(u){
  const e = nearestEnemyOf(u, 700, x => x.kind === 'hero') || nearestEnemyOf(u, 700, null);
  if(e) return { x: e.x, y: e.y };
  return { x: u.x + Math.cos(u.dir || 0) * 220, y: u.y + Math.sin(u.dir || 0) * 220 };
}

function setupInput(){
  hudCv.addEventListener('contextmenu', e => e.preventDefault());
  hudCv.addEventListener('mouseleave', () => { hoverUi = null; mouseIn = false; holdMove = null; if(typeof hideItemTip === 'function') hideItemTip(); });
  document.addEventListener('mouseleave', () => { mouseIn = false; holdMove = null; });   // miš izašao iz prozora: ne pomiči kameru
  window.addEventListener('blur', () => {   // prozor izgubio fokus: otpuštanje tipke/miša neće stići
    keys = {}; holdMove = null;
    if(pendingCast && pendingCast.quick) pendingCast = null;
  });

  // 🔒 zaključan miš: preglednik sakrije pravi pokazivač i šalje samo pomake — crtamo svoj (drawLockedCursor)
  hudCv.addEventListener('mousedown', e => {
    if(!mouseLocked() && wantMouseLock()){ lockMouse(); mouse.sx = e.clientX; mouse.sy = e.clientY; }
    if(mouseLocked()) pointerDown(mouse.sx, mouse.sy, e.button);
    else pointerDown(e.clientX, e.clientY, e.button);
  });
  window.addEventListener('mouseup', e => mouseLocked() ? pointerUp(mouse.sx, mouse.sy) : pointerUp(e.clientX, e.clientY));
  hudCv.addEventListener('mousemove', e => {
    mouseIn = true;
    if(mouseLocked()) pointerMove(clamp(mouse.sx + e.movementX, 0, VW - 1), clamp(mouse.sy + e.movementY, 0, VH - 1));
    else pointerMove(e.clientX, e.clientY);
  });
  setupTouch();

  // pritisak (miš ili dodir): button 0 = lijevi klik / dodir, 2 = desni klik
  function pointerDown(sx, sy, button){
    if(ac() && AC.state === 'suspended') AC.resume();
    if(!running || gameOver) return;
    if(button === 0){
      if(uiRects.prepSkip && inRect(sx, sy, uiRects.prepSkip)){ skipPrep(); return; }
      if(inRect(sx, sy, uiRects.opts)){ toggleOptions(); return; }
      if(uiRects.fs && inRect(sx, sy, uiRects.fs)){ toggleFullscreen(); sfx('click'); return; }
      if(uiRects.score && inRect(sx, sy, uiRects.score)){ scoreOpen = !scoreOpen; sfx('click'); return; }
      if(uiRects.dance && inRect(sx, sy, uiRects.dance)){ pressDance(); return; }
      if(uiRects.center && inRect(sx, sy, uiRects.center)){ cam.follow = true; if(player){ cam.x = player.x; cam.y = player.y; } sfx('click'); return; }
      for(const lr of uiRects.learn){
        if(inRect(sx, sy, lr)){
          if(net.mode === 'guest'){ netLearn(lr.i); return; }
          if(learnAbility(player, lr.i)) return;
        }
      }
      for(let i = 0; i < uiRects.abil.length; i++){
        if(inRect(sx, sy, uiRects.abil[i])){
          pressAbility(i, aimFallback(player));
          return;
        }
      }
      for(let k = 0; k < (uiRects.sum || []).length; k++){
        if(uiRects.sum[k] && inRect(sx, sy, uiRects.sum[k])){ pressSummoner(k); return; }
      }
      for(let i = 0; i < uiRects.inv.length; i++){
        if(uiRects.inv[i] && inRect(sx, sy, uiRects.inv[i])){
          if(invItemAt(player, i)) invDrag = { from: i, sx, sy, moved: false };   // klik ili povlačenje — odluči mouseup
          return;
        }
      }
      for(const q of uiRects.qb || []){
        if(inRect(sx, sy, q)){ buyItemId(q.id); return; }
      }
      if(uiRects.buyback && inRect(sx, sy, uiRects.buyback)){
        if(net.mode === 'guest') netBuyback();
        else buyback(player);
        return;
      }
      if(inRect(sx, sy, uiRects.statBtn)){
        if(net.mode === 'guest') netStats();
        else learnStats(player);
        return;
      }
      if(uiRects.talent){
        for(const k of ['a', 'b']) if(inRect(sx, sy, uiRects.talent[k])){
          if(net.mode === 'guest') netTalent(uiRects.talent.lvl, k);
          else chooseTalent(player, uiRects.talent.lvl, k);
          return;
        }
      }
      if(chatOpen && uiRects.chat){
        for(let i = 0; i < uiRects.chat.length; i++) if(inRect(sx, sy, uiRects.chat[i])){
          if(net.mode === 'guest') netChat(i); else sendChat(player, i);
          chatOpen = false;
          return;
        }
      }
      if(uiRects.glyph && inRect(sx, sy, uiRects.glyph)){
        if(net.mode === 'guest') netGlyph();
        else useGlyph(player.team, player);
        return;
      }
      if(inRect(sx, sy, uiRects.tp)){ pressTeleport(); return; }
      if(inRect(sx, sy, uiRects.shop) || inRect(sx, sy, uiRects.gold)){ toggleShop(); return; }   // 💰 klik na zlato = dućan
      if(inRect(sx, sy, uiRects.mute)){ muted = !muted; sfx('click'); return; }
      if(inRect(sx, sy, uiRects.help)){ toggleHelp(); return; }
    }
    if(button === 2){
      for(let i = 0; i < uiRects.inv.length; i++){
        if(uiRects.inv[i] && inRect(sx, sy, uiRects.inv[i]) && invItemAt(player, i)){
          if(net.mode === 'guest') netSell(i);
          else sellItem(player, i);
          hideItemTip();
          return;
        }
      }
      for(const q of uiRects.qb || []){
        if(inRect(sx, sy, q)){ setQuickBuy(null); hideItemTip(); return; }
      }
    }
    if(inRect(sx, sy, uiRects.mini)){
      const w = miniToWorld(sx, sy);
      if(pendingCast && button === 0){
        castPending(w);
        return;
      }
      if(button === 2){ amovePending = false; playerCommand(w.x, w.y, null); }
      else if(amovePending){ amovePending = false; playerCommand(w.x, w.y, null, { amove: true }); }
      else { cam.x = w.x; cam.y = w.y; cam.follow = false; miniDrag = true; }
      return;
    }
    if(hudPanelAt(sx, sy)) return;   // klik na ploču HUD-a (ne na gumb) nije naredba u svijetu
    if(scoreOpen && button === 0){ scoreOpen = false; return; }   // 📋 dodir pored tablice je zatvara
    // 🖱️ v0.31: jedinica pod mišem po TIJELU na ekranu (klik na glavu junaka je napad, ne hodanje iza njega)
    const tgt = pickUnitScreen(sx, sy, touchMode ? 16 : 5);
    const w = screenToWorld(sx, sy);
    // ciljanje moći: lijevi klik baca (na jedinicu pod mišem ili na tlo), desni odustaje i daje običnu naredbu
    if(pendingCast){
      if(button === 0){ castPending(tgt ? { x: tgt.x, y: tgt.y } : w); return; }
      pendingCast = null;
    }
    if(amovePending){   // ⚔️ A + klik: napad u hodu (klik na neprijatelja je običan napad)
      amovePending = false;
      if(button === 0){ playerCommand(w.x, w.y, tgt, { amove: true }); return; }
    }
    if(playerCommand(w.x, w.y, tgt) && !touchMode) holdMove = { next: performance.now() + 200 };   // drži li se tipka, junak ide za mišem
  }

  function pointerUp(ux, uy){
    miniDrag = false;
    holdMove = null;
    if(!invDrag || !player) return;
    const d = invDrag; invDrag = null;
    const N = CFG.inventorySlots;
    if(d.moved){   // ispušten na drugo mjesto: zamijeni / premjesti
      for(let j = 0; j < uiRects.inv.length; j++){
        if(j !== d.from && uiRects.inv[j] && inRect(ux, uy, uiRects.inv[j])){
          if(net.mode === 'guest') netSwap(d.from, j); else swapItems(player, d.from, j);
          sfx('click');
          break;
        }
      }
      return;
    }
    const it = invItemAt(player, d.from);
    if(!it) return;
    if(d.from >= N){   // klik na ruksak: vrati u torbu (na prazno mjesto ili zamijeni sa zadnjim)
      const to = player.items.length < N ? player.items.length : N - 1;
      if(net.mode === 'guest') netSwap(d.from, to); else swapItems(player, d.from, to);
    }
    else if(it.active) pressItem(d.from);
    else addFloat(player.x, player.y, touchMode ? L('👆 Povuci za premještanje • prodaja u dućanu', '👆 Drag to move • sell in the shop') : L('🖱️ Povuci za premještanje • desni klik = prodaja', '🖱️ Drag to move • right-click = sell'), '#e5e7eb', 13);
  }

  function pointerMove(mx, my){
    mouse.sx = mx; mouse.sy = my;
    const w = screenToWorld(mouse.sx, mouse.sy);
    mouse.wx = w.x; mouse.wy = w.y;
    if(miniDrag && inRect(mouse.sx, mouse.sy, uiRects.mini)){
      const mw = miniToWorld(mouse.sx, mouse.sy);
      cam.x = mw.x; cam.y = mw.y;
    }
    if(invDrag && !invDrag.moved && Math.hypot(mouse.sx - invDrag.sx, mouse.sy - invDrag.sy) > 6){ invDrag.moved = true; hideItemTip(); }
    hoverUi = null;
    for(let i = 0; i < uiRects.abil.length; i++){
      if(inRect(mouse.sx, mouse.sy, uiRects.abil[i])) hoverUi = { type: 'abil', i };
    }
    for(const lr of uiRects.learn){
      if(inRect(mouse.sx, mouse.sy, lr)) hoverUi = { type: 'learn', i: lr.i };
    }
    for(let i = 0; i < uiRects.inv.length; i++){
      if(player && uiRects.inv[i] && invItemAt(player, i) && inRect(mouse.sx, mouse.sy, uiRects.inv[i])) hoverUi = { type: 'inv', i };
    }
    (uiRects.qb || []).forEach((q, i) => { if(inRect(mouse.sx, mouse.sy, q)) hoverUi = { type: 'qb', i }; });
    if(uiRects.neutral && inRect(mouse.sx, mouse.sy, uiRects.neutral)) hoverUi = { type: 'neut' };
    (uiRects.sum || []).forEach((r, i) => { if(r && inRect(mouse.sx, mouse.sy, r)) hoverUi = { type: 'sum', i }; });
    (uiRects.buff || []).forEach((r, i) => { if(inRect(mouse.sx, mouse.sy, r)) hoverUi = { type: 'buff', i }; });
    if(uiRects.passive && inRect(mouse.sx, mouse.sy, uiRects.passive)) hoverUi = { type: 'pas' };
    if(inRect(mouse.sx, mouse.sy, uiRects.statBtn)) hoverUi = { type: 'stat' };
    if(inRect(mouse.sx, mouse.sy, uiRects.tp)) hoverUi = { type: 'tp' };
    if(uiRects.glyph && inRect(mouse.sx, mouse.sy, uiRects.glyph)) hoverUi = { type: 'glyph' };
    if(inRect(mouse.sx, mouse.sy, uiRects.shop) || inRect(mouse.sx, mouse.sy, uiRects.gold)) hoverUi = { type: 'shop' };
    if(inRect(mouse.sx, mouse.sy, uiRects.mute)) hoverUi = { type: 'mute' };
    if(inRect(mouse.sx, mouse.sy, uiRects.help)) hoverUi = { type: 'help' };
    for(const k of ['opts', 'fs', 'score', 'center', 'dance']) if(uiRects[k] && inRect(mouse.sx, mouse.sy, uiRects[k])) hoverUi = { type: k };
    if(uiRects.prepSkip && inRect(mouse.sx, mouse.sy, uiRects.prepSkip)) hoverUi = { type: 'prep' };
    if(!running) hudCv.style.cursor = hoverUi ? 'pointer' : 'default';   // u igri pokazivač postavlja refreshPointer()
    if(!invDrag || !invDrag.moved) updateHudTip();
  }

  /* 👆 DODIR (tablet): dodir = naredba ili gumb, povlačenje prstom = pomicanje kamere,
     dva prsta = zum. Dok držiš prst na gumbu ili predmetu, vidiš njegov opis. */
  function setupTouch(){
    let tw = null;      // jedan prst u svijetu: { id, sx, sy, lx, ly, pan }
    let pinch = null;   // dva prsta: { d0, z0 }
    let holdT = 0;      // kad je prst stao na predmet u torbi
    const T = (e, i) => ({ id: e.touches[i].identifier, x: e.touches[i].clientX, y: e.touches[i].clientY });
    hudCv.addEventListener('touchstart', e => {
      e.preventDefault();
      touchMode = true;   // tablet: gumbi 📋 🎯, bez rubnog pomicanja kamere
      if(!running) return;
      if(e.touches.length >= 2){   // drugi prst: zum (poništi dodir u svijetu)
        const a = T(e, 0), b = T(e, 1);
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        tw = null;
        return;
      }
      const t = e.changedTouches[0], sx = t.clientX, sy = t.clientY;
      pointerMove(sx, sy);                     // opis gumba dok se drži
      if(hudHit(sx, sy)){   // gumbi, predmeti, minimapa: odmah
        pointerDown(sx, sy, 0);
        holdT = invDrag ? performance.now() : 0;   // držanje prsta na predmetu = prodaja
        return;
      }
      tw = { id: t.identifier, sx, sy, lx: sx, ly: sy, pan: false };
    }, { passive: false });
    hudCv.addEventListener('touchmove', e => {
      e.preventDefault();
      if(!running) return;
      if(pinch && e.touches.length >= 2){
        const a = T(e, 0), b = T(e, 1);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const before = screenToWorld(mx, my, true);
        cam.zoom = clamp(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, 0.5, 1.7);
        const after = screenToWorld(mx, my, true);
        cam.x += before.x - after.x; cam.y += before.y - after.y;
        const p0 = screenToWorld(pinch.mx, pinch.my, true), p1 = screenToWorld(mx, my, true);   // i pomicanje s dva prsta
        cam.x += p0.x - p1.x; cam.y += p0.y - p1.y;
        pinch.mx = mx; pinch.my = my;
        cam.follow = false;
        return;
      }
      const t = [...e.changedTouches].find(c => !tw || c.identifier === tw.id) || e.changedTouches[0];
      const sx = t.clientX, sy = t.clientY;
      if(!tw){ pointerMove(sx, sy); return; }   // povlačenje predmeta / minimape
      if(!tw.pan && Math.hypot(sx - tw.sx, sy - tw.sy) > 14) tw.pan = true;
      if(tw.pan){
        const a = screenToWorld(tw.lx, tw.ly, true), b = screenToWorld(sx, sy, true);
        cam.x += a.x - b.x; cam.y += a.y - b.y;
        cam.follow = false;
      }
      tw.lx = sx; tw.ly = sy;
    }, { passive: false });
    const end = e => {
      e.preventDefault();
      if(pinch){ if(e.touches.length < 2) pinch = null; tw = null; return; }
      const t = e.changedTouches[0];
      if(tw && t.identifier === tw.id){
        if(!tw.pan && running){ pointerMove(tw.sx, tw.sy); pointerDown(tw.sx, tw.sy, 0); }   // kratki dodir = naredba
        tw = null;
      } else if(holdT && invDrag && !invDrag.moved && performance.now() - holdT > 900){   // 💰 držao prst na predmetu: prodaj?
        const i = invDrag.from, it = invItemAt(player, i);
        invDrag = null;
        if(it && confirm(L('Prodati ' + it.name + ' za ' + Math.floor(itemFullCost(it) / 2) + ' zlata?', 'Sell ' + it.name + ' for ' + Math.floor(itemFullCost(it) / 2) + ' gold?'))){
          if(net.mode === 'guest') netSell(i); else sellItem(player, i);
        }
      } else pointerUp(t.clientX, t.clientY);
      holdT = 0;
      hoverUi = null; hideItemTip();
    };
    hudCv.addEventListener('touchend', end, { passive: false });
    hudCv.addEventListener('touchcancel', end, { passive: false });
  }

  hudCv.addEventListener('wheel', e => {
    e.preventDefault();
    if(!running) return;
    const before = screenToWorld(mouse.sx, mouse.sy, true);
    cam.zoom = clamp(cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 1.7);
    const after = screenToWorld(mouse.sx, mouse.sy, true);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if(e.target && e.target.tagName === 'INPUT' && e.target.id === 'shopSearch'){   // tražilica dućana
      if(k === 'escape') e.target.blur();
      return;
    }
    keys[k] = true;
    if(!running) return;
    if(optionsOpen() && k !== 'escape') return;   // ⚙️ dok su postavke otvorene, tipke ne upravljaju igrom
    if(k === ' '){ e.preventDefault(); cam.follow = true; if(player){ cam.x = player.x; cam.y = player.y; } }
    if(gameOver) return;
    // v0.31: držanje tipke ne ponavlja naredbu (preglednik šalje ponovljene pritiske — prije je to samo
    // od sebe bacilo moć na staro mjesto miša)
    if(e.repeat && 'qwerdfas123456'.includes(k)) return;
    const quick = SETTINGS.quickCast && !touchMode;   // ⚡ brzo bacanje: drži tipku = indikator, pusti = baci
    const pc0 = pendingCast;
    const qKey = () => { if(quick && pendingCast && pendingCast !== pc0) pendingCast.key = k; };   // samo ako je ova tipka započela ciljanje
    const abilKey = { q: 0, w: 1, e: 2, r: 3 }[k];
    if(abilKey != null){ amovePending = false; pressAbility(abilKey, null, quick); qKey(); }
    if(k === 'a' && player && !player.dead){   // ⚔️ napad u hodu: A pa klik
      pendingCast = null;
      amovePending = !amovePending;
    }
    if(k === 't'){ amovePending = false; pressTeleport(); }
    if(k === 's' && player && !player.dead){
      amovePending = false; holdMove = null;
      if(net.mode === 'guest') netStop();
      else stopHero(player);   // ✋ v0.56: i otkazuje zamah udarca
    }
    if(k === 'b') toggleShop();
    if(k === 'h') toggleHelp();
    if(k === 'o'){ if(net.mode === 'guest') netBuyback(); else buyback(player); }
    if(k === 'y' && player){ if(net.mode === 'guest') netGlyph(); else useGlyph(player.team, player); }   // 🛡️ glif (F je čarolija prizivača)
    if(k === 'd'){ amovePending = false; pressSummoner(0, quick); qKey(); }
    if(k === 'f'){ amovePending = false; pressSummoner(1, quick); qKey(); }
    if(k === 'k'){ const on = togglePost(); feedMsg(on ? L('✨ Efekti uključeni (sjaj, boje)', '✨ Effects on (glow, colors)') : L('✨ Efekti isključeni', '✨ Effects off'), '#e5e7eb'); }
    if(k === 'g' && player){ chatOpen = !chatOpen; return; }
    if(k === 'v' && player){ if(net.mode === 'guest') netPing(mouse.wx, mouse.wy); else addPing(player, mouse.wx, mouse.wy); }
    if(k === 'j') pressDance();   // 💃 ples
    if(chatOpen && k >= '1' && k <= '6'){
      const ci = parseInt(k, 10) - 1;
      if(net.mode === 'guest') netChat(ci); else sendChat(player, ci);
      chatOpen = false;
      return;
    }
    if(k >= '1' && k <= '6' && !e.ctrlKey && !e.metaKey){ amovePending = false; pressItem(parseInt(k, 10) - 1, quick); qKey(); }
    if(k === 'tab') e.preventDefault();
    if(k === 'm'){ muted = !muted; }
    if(k === 'p'){ paused = !paused; document.getElementById('pause').classList.toggle('hidden', !paused); }
    if(k === 'escape'){
      if(optionsOpen()) toggleOptions();
      else if(chatOpen) chatOpen = false;
      else if(pendingCast) pendingCast = null;
      else if(amovePending) amovePending = false;
      else if(shopOpen) toggleShop();
      else if(!document.getElementById('help').classList.contains('hidden')) toggleHelp();
      else if(scoreOpen) scoreOpen = false;
      else toggleOptions();   // ⚙️ Esc otvara postavke (kao u DotA)
    }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    keys[k] = false;
    // ⚡ brzo bacanje: otpuštanje tipke baca moć prema mišu (ili na jedinicu pod mišem)
    if(pendingCast && pendingCast.quick && pendingCast.key === k && running && !gameOver && !optionsOpen()) castPending(aimPoint());
  });
}

/* ================= DOM: dućan, pomoć, postavke, odabir ================= */
function toggleHelp(){
  document.getElementById('help').classList.toggle('hidden');
}
/* ⚙️ postavke: u igri protiv botova igra stoji dok su otvorene */
let optPausedByMenu = false;
function optionsOpen(){ const el = document.getElementById('options'); return !!el && !el.classList.contains('hidden'); }
function toggleOptions(){
  const el = document.getElementById('options');
  if(!el) return;
  const open = !optionsOpen();
  el.classList.toggle('hidden', !open);
  if(open){
    syncOptionsDom();
    if(running && !gameOver && net.mode !== 'guest' && net.mode !== 'host' && !paused){ paused = true; optPausedByMenu = true; }
    hideItemTip();
  } else if(optPausedByMenu){ paused = false; optPausedByMenu = false; }
  sfx('click');
}
function syncOptionsDom(){
  const $ = id => document.getElementById(id);
  $('optVol').value = Math.round(SETTINGS.vol * 100);
  $('optVolV').textContent = Math.round(SETTINGS.vol * 100) + '%';
  for(const b of $('optQ').querySelectorAll('button')) b.classList.toggle('on', b.dataset.q === SETTINGS.quality);
  const tog = (id, on) => { $(id).classList.toggle('on', on); $(id).textContent = on ? L('✅ Uključeno', '✅ On') : L('⬜ Isključeno', '⬜ Off'); };
  tog('optPost', typeof POST !== 'undefined' && POST.on);
  tog('optEdge', SETTINGS.edgePan);
  tog('optQuick', SETTINGS.quickCast);
  tog('optDmg', SETTINGS.dmgNums);
  if($('optLh')){ tog('optLh', SETTINGS.lastHit); tog('optTips', SETTINGS.tips); tog('optAuto', SETTINGS.autoSkill); tog('optNature', SETTINGS.nature); if($('optQuests')) tog('optQuests', SETTINGS.quests); if($('optMusic')) tog('optMusic', SETTINGS.music); }
  tog('optMute', !muted);
  tog('optVoices', SETTINGS.voices);
  tog('optAnn', SETTINGS.announcer);
  if($('optFs')){ tog('optFs', SETTINGS.fullscreen); tog('optLock', SETTINGS.lockMouse); $('optFsRow').classList.toggle('hidden', touchMode); $('optLockRow').classList.toggle('hidden', touchMode); }
  $('optEdgeRow').classList.toggle('hidden', touchMode);   // na tabletu nema miša
  $('optQuickRow').classList.toggle('hidden', touchMode);   // ni tipkovnice
  $('optQuit').classList.toggle('hidden', !running);
}
function buildOptionsDom(){
  const $ = id => document.getElementById(id);
  if(!$('options')) return;
  $('optVol').addEventListener('input', e => {
    SETTINGS.vol = clamp(+e.target.value / 100, 0, 1);
    $('optVolV').textContent = Math.round(SETTINGS.vol * 100) + '%';
    saveSettings();
  });
  $('optVol').addEventListener('change', () => sfx('click'));
  for(const b of $('optQ').querySelectorAll('button')) b.addEventListener('click', () => {
    SETTINGS.quality = b.dataset.q; saveSettings();
    setQuality3D(SETTINGS.quality);
    syncOptionsDom(); sfx('click');
  });
  $('optPost').addEventListener('click', () => { togglePost(); syncOptionsDom(); sfx('click'); });
  $('optEdge').addEventListener('click', () => { SETTINGS.edgePan = !SETTINGS.edgePan; saveSettings(); syncOptionsDom(); sfx('click'); });
  if($('optFs')){
    $('optFs').addEventListener('click', () => {   // 🖥️ odmah uđi / izađi iz cijelog zaslona i zapamti
      SETTINGS.fullscreen = !SETTINGS.fullscreen; saveSettings();
      if(SETTINGS.fullscreen !== isFullscreen()) toggleFullscreen();
      syncOptionsDom(); sfx('click');
    });
    $('optLock').addEventListener('click', () => { SETTINGS.lockMouse = !SETTINGS.lockMouse; saveSettings(); if(!SETTINGS.lockMouse) unlockMouse(); syncOptionsDom(); sfx('click'); });
  }
  $('optQuick').addEventListener('click', () => { SETTINGS.quickCast = !SETTINGS.quickCast; saveSettings(); syncOptionsDom(); sfx('click'); });
  $('optDmg').addEventListener('click', () => { SETTINGS.dmgNums = !SETTINGS.dmgNums; saveSettings(); syncOptionsDom(); sfx('click'); });
  if($('optMusic')) $('optMusic').addEventListener('click', () => { SETTINGS.music = !SETTINGS.music; saveSettings(); syncOptionsDom(); sfx('click'); });
  if($('optQuests')) $('optQuests').addEventListener('click', () => { SETTINGS.quests = !SETTINGS.quests; saveSettings(); syncOptionsDom(); sfx('click'); });
  if($('optLh')){
    $('optLh').addEventListener('click', () => { SETTINGS.lastHit = !SETTINGS.lastHit; saveSettings(); syncOptionsDom(); sfx('click'); });
    $('optAuto').addEventListener('click', () => { SETTINGS.autoSkill = !SETTINGS.autoSkill; saveSettings(); syncOptionsDom(); sfx('click'); });
    $('optNature').addEventListener('click', () => { SETTINGS.nature = !SETTINGS.nature; saveSettings(); syncOptionsDom(); sfx('click'); });
    $('optTips').addEventListener('click', () => {   // ponovno uključivanje vraća sve savjete
      SETTINGS.tips = !SETTINGS.tips; if(SETTINGS.tips){ tipCounts = {}; tip.done = {}; try { localStorage.removeItem('dk_tips'); } catch(e){} }
      saveSettings(); syncOptionsDom(); sfx('click');
    });
  }
  $('optMute').addEventListener('click', () => { muted = !muted; syncOptionsDom(); sfx('click'); });
  $('optVoices').addEventListener('click', () => {
    SETTINGS.voices = !SETTINGS.voices; saveSettings(); syncOptionsDom(); sfx('click');
    if(SETTINGS.voices && player && player.hero) voxSay(player.hero.id, 'pick', { force: true });   // poslušaj svoj glas
  });
  $('optAnn').addEventListener('click', () => {
    SETTINGS.announcer = !SETTINGS.announcer; saveSettings(); syncOptionsDom(); sfx('click');
    if(SETTINGS.announcer) voxSay('ann', 'welcome', { force: true });   // poslušaj najavljivača
  });
  $('optResume').addEventListener('click', toggleOptions);
  $('optQuit').addEventListener('click', () => {
    if(confirm(L('Izaći iz igre u izbornik? Ova igra će se prekinuti.', 'Quit to the menu? This game will end.'))) location.reload();
  });
  $('options').addEventListener('click', e => { if(e.target.id === 'options') toggleOptions(); });   // klik pored prozora zatvara
}
/* dućan, ikone i opisi predmeta: shop.js */
function buildSelectScreen(){
  loadCos();   // 🎁 izgled junaka (i u 3D pregledu)
  const cards = document.getElementById('cards');
  let html = '';
  HEROES.forEach((h, i) => {
    html += `<div class="card" id="card-${i}" data-r="${h.projSpeed > 0 ? 'R' : 'M'}" title="${h.name} — ${h.role}">
      <img class="c-img" src="assets/hero_${h.id}.jpg" alt="${h.emoji}"
        onerror="this.outerHTML='<div class=&quot;c-emoji&quot;>${h.emoji}</div>'">
      <div class="c-name">${h.name}</div>
      <div class="c-type">${h.projSpeed > 0 ? '🏹' : '⚔️'}</div>${heroDifficulty(h.id) === 0 ? L('<div class="c-easy" title="Lako za početnike">🟢</div>', '<div class="c-easy" title="Easy for beginners">🟢</div>') : ''}
    </div>`;
  });
  cards.innerHTML = html;
  HEROES.forEach((h, i) => {
    document.getElementById('card-' + i).addEventListener('click', () => { selectHero(i); sfx('click'); voxSay(h.id, 'pick', { force: true }); });
  });
  // filtar: svi / blizina / daljina
  document.querySelectorAll('#roleTabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#roleTabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('off', b.dataset.f !== 'all' && c.dataset.r !== b.dataset.f));
  }));
  { const fb = document.getElementById('fsBtn');   // ⛶ cijeli zaslon na ekranu odabira
    if(fb){
      if(touchMode || !(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) fb.classList.add('hidden');
      fb.addEventListener('click', () => { toggleFullscreen(); sfx('click'); });
      document.addEventListener('fullscreenchange', () => { fb.textContent = isFullscreen() ? '🗗' : '⛶'; });
    } }
  const syncDiff = () => document.querySelectorAll('#diffTabs button').forEach(x => x.classList.toggle('on', x.dataset.d === SETTINGS.diff));
  document.querySelectorAll('#diffTabs button').forEach(b => b.addEventListener('click', () => {   // 🤖 težina botova
    SETTINGS.diff = b.dataset.d; saveSettings(); syncDiff(); sfx('click');
  }));
  syncDiff();
  const syncLane = () => document.querySelectorAll('#laneTabs button').forEach(x => x.classList.toggle('on', x.dataset.l === SETTINGS.lane));
  document.querySelectorAll('#laneTabs button').forEach(b => b.addEventListener('click', () => {   // 🛣️ tvoja staza (uloga)
    SETTINGS.lane = b.dataset.l; saveSettings(); syncLane(); sfx('click');
    if(SETTINGS.lane === 'jungle' && !pickedSummoners.includes('smite')){   // 🌲 u džungli treba 🌩️ Kazna (ide na F)
      pickedSummoners = jungleSummoners(pickedSummoners);
      try { localStorage.setItem('dk_summoners', JSON.stringify(pickedSummoners)); } catch(e){}
      document.querySelectorAll('#heroDetail .sumb').forEach(x => {
        const k = pickedSummoners.indexOf(x.dataset.id);
        x.classList.toggle('on', k >= 0);
        x.querySelector('i').textContent = k === 0 ? 'D' : (k === 1 ? 'F' : '');
      });
    }
  }));
  syncLane();
  const syncMode = () => document.querySelectorAll('#modeTabs button').forEach(x => x.classList.toggle('on', x.dataset.m === SETTINGS.mode));
  document.querySelectorAll('#modeTabs button').forEach(b => b.addEventListener('click', () => {   // ⚡ brza ili normalna igra
    SETTINGS.mode = b.dataset.m; saveSettings(); syncMode(); sfx('click');
  }));
  syncMode();
  document.getElementById('startBtn').addEventListener('click', () => {
    if(SETTINGS.fullscreen) enterFullscreen();   // 🖥️ igra preko cijelog ekrana (klik je korisnikova radnja — preglednik to dopušta)
    if(net.conn){ netReady(); return; }   // multiplayer: čekaj oba igrača
    if(selectedHero >= 0) startGame(selectedHero);
  });
  { const ab = document.getElementById('achBtn'); if(ab) ab.addEventListener('click', showAchievements); }
  refreshHeroWins();
  document.getElementById('randomBtn').addEventListener('click', () => {
    const vis = HEROES.map((h, i) => i).filter(i => !document.getElementById('card-' + i).classList.contains('off'));
    const i = vis[Math.floor(Math.random() * vis.length)];
    selectHero(i); sfx('click'); voxSay(HEROES[i].id, 'pick', { force: true });
    document.getElementById('card-' + i).scrollIntoView({ block: 'nearest' });
  });
  document.getElementById('mpToggle').addEventListener('click', e => {
    const box = document.getElementById('mpBox');
    box.classList.toggle('hidden');
    e.currentTarget.classList.toggle('on', !box.classList.contains('hidden'));
    document.getElementById('diffTabs').classList.toggle('mpOff', !box.classList.contains('hidden'));   // 🤖 u igri s prijateljem ne vrijedi
    document.getElementById('modeTabs').classList.toggle('mpOff', !box.classList.contains('hidden'));   // ⚡ ni brza igra
  });
  document.getElementById('helpClose').addEventListener('click', toggleHelp);
  document.getElementById('againBtn').addEventListener('click', () => location.reload());
  selectHero(0);   // odmah je netko odabran — dovoljno je pritisnuti ZAIGRAJ
}
/* desna ploča: 3D model, uloga i 5 pločica (urođena pasiva + Q W E R); opis jedne po jednoj */
/* 🟢🟡🔴 težina junaka na ekranu odabira (za početnike: lako = jednostavne moći, puno života) */
const HERO_EASY = ['vitez', 'slon', 'nosorog', 'panda', 'bikos', 'jednorog', 'listko', 'zarko', 'strijela', 'irbis'];
const HERO_HARD = ['tragac', 'hobotnica', 'luna', 'gavran', 'sova', 'majmun'];
function heroDifficulty(id){ return HERO_EASY.includes(id) ? 0 : (HERO_HARD.includes(id) ? 2 : 1); }
/* 📊 tvoja statistika s junakom (ekran odabira) */
function heroStatsHtml(id){
  const p = loadProfile(), g = p.heroGames[id] || 0;
  if(!g) return `<div class="d-stats">${L('📊 Još nisi igrao s ovim junakom — probaj!', '📊 You haven’t played this hero yet — try it!')}</div>`;
  const w = p.heroWins[id] || 0, hs = p.heroStats[id] || { k: 0, d: 0, a: 0, bestK: 0 };
  const hrN = n => n % 10 === 1 && n % 100 !== 11 ? 'igra' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'igre' : 'igara');
  return `<div class="d-stats">📊 ${L(`S ovim junakom: <b>${g}</b> ${hrN(g)} · <b>${w}</b> 🏆 · K/D/A <b>${(hs.k / g).toFixed(1)}/${(hs.d / g).toFixed(1)}/${(hs.a / g).toFixed(1)}</b> · rekord <b>${hs.bestK}</b> ⚔️`,
    `With this hero: <b>${g}</b> ${g === 1 ? 'game' : 'games'} · <b>${w}</b> 🏆 · K/D/A <b>${(hs.k / g).toFixed(1)}/${(hs.d / g).toFixed(1)}/${(hs.a / g).toFixed(1)}</b> · best <b>${hs.bestK}</b> ⚔️`)}</div>`;
}
function selectHero(i){
  const h = HEROES[i];
  selectedHero = i;
  if(net.conn) netPick(i);   // multiplayer: javi prijatelju svoj odabir
  document.querySelectorAll('.card').forEach(c => c.classList.remove('sel'));
  document.getElementById('card-' + i).classList.add('sel');
  const primNames = { str: L('💪 Snaga', '💪 Strength'), agi: L('🤸 Okretnost', '🤸 Agility'), int: L('🧠 Pamet', '🧠 Intelligence') };
  const dif = heroDifficulty(h.id);
  const chips = (h.projSpeed > 0 ? L('<span class="chip chipR">🏹 Daljina</span>', '<span class="chip chipR">🏹 Ranged</span>') : L('<span class="chip chipM">⚔️ Blizina</span>', '<span class="chip chipM">⚔️ Melee</span>')) +
    '<span class="chip chipP">' + primNames[h.attrs.primary] + '</span>' +
    '<span class="chip chipD' + dif + '" title="' + L('Koliko je junak težak za igranje', 'How hard this hero is to play') + '">' + [L('🟢 Lako', '🟢 Easy'), L('🟡 Srednje', '🟡 Medium'), L('🔴 Teško', '🔴 Hard')][dif] + '</span>';
  const tiles = [];
  if(h.passive) tiles.push({ k: '✨', cls: 'pas', e: spellIconHtml(h.id, 'P', h.passive.emoji, 'ab-img'), name: h.passive.name, tag: L('<span class="pasTag">✨ UROĐENO</span>', '<span class="pasTag">✨ INNATE</span>'),
    desc: h.passive.desc.replace(/^(PASIVNO|PASSIVE|ПАСИВНО):\s*/, '') + L(' (uvijek radi)', ' (always on)') });
  for(const a of h.abilities) tiles.push({ k: a.key, cls: a.ult ? 'ult' : '', e: spellIconHtml(h.id, a.key, a.emoji, 'ab-img'), name: a.name,
    tag: a.ult ? L('<span class="ultTag">🌟 ULTI</span>', '<span class="ultTag">🌟 ULTIMATE</span>') : '', desc: a.desc.replace(/^(ULTI|ULT|УЛТИ):\s*/, '') });
  {   // 🎓 stablo talenata: na levelima 10 / 15 / 20 / 25 biraš jedan od dva bonusa (svaki junak ima svoje)
    const tt = HERO_TALENTS[h.id] || DEFAULT_TALENTS;
    tiles.push({ k: '🎓', cls: 'tal', e: spellIconHtml(h.id, 'T', '🌳', 'ab-img'), name: L('Talenti', 'Talents'), tag: '<span class="pasTag">🎓 LEVEL 10 / 15 / 20 / 25</span>',
      desc: '<div class="talTree">' + tt.map((tier, j) => `<div class="talRow"><span class="talL">${TALENT_LVLS[j]}</span>` +
        tier.map(t => `<span class="talO"><img class="talIc" src="${talentIconSrc(h.id, t)}" alt="${t.emoji}" draggable="false" onerror="this.replaceWith(document.createTextNode(this.alt))">${t.txt}</span>`).join(`<i>${L('ili', 'or')}</i>`) + '</div>').reverse().join('') + '</div>' });
  }
  const det = document.getElementById('heroDetail');
  det.innerHTML = `<div class="d-top">
      <div class="d-model"><img class="d-img" src="assets/hero_${h.id}.jpg" onerror="this.remove()"></div>
      <div><div class="d-head">${h.emoji} <b>${h.name}</b></div><div class="d-role">${h.role}</div><div>${chips}</div></div>
    </div>
    <div class="d-abils">${tiles.map((t, j) => `<button class="ab ${t.cls}" data-j="${j}" title="${t.name}"><span class="ab-k">${t.k}</span>${t.e}</button>`).join('')}</div>
    <div class="d-desc"></div>
    <div class="d-sum"><span class="d-sumL">${L('✨ Čarolije', '✨ Spells')} <b>D</b> <b>F</b></span>${SUMMONERS.map(sp => `<button class="sumb" data-id="${sp.id}" title="${sp.name}">${sp.emoji}<i></i></button>`).join('')}</div>` + heroStatsHtml(h.id);
  const show = j => {
    const t = tiles[j];
    det.querySelectorAll('.ab').forEach(b => b.classList.toggle('on', +b.dataset.j === j));
    det.querySelector('.d-desc').innerHTML = `${t.e} <b>${t.name}</b> ${t.tag}<br>${t.desc}`;
  };
  det.querySelectorAll('.ab').forEach(b => {
    b.addEventListener('mouseenter', () => show(+b.dataset.j));
    b.addEventListener('click', () => show(+b.dataset.j));
  });
  // ✨ čarolije prizivača (kao u LoL-u): klik bira, najviše dvije (prva = D, druga = F)
  const syncSum = () => det.querySelectorAll('.sumb').forEach(b => {
    const k = pickedSummoners.indexOf(b.dataset.id);
    b.classList.toggle('on', k >= 0);
    b.querySelector('i').textContent = k === 0 ? 'D' : (k === 1 ? 'F' : '');
  });
  det.querySelectorAll('.sumb').forEach(b => {
    const sp = SUMMONER_BY_ID[b.dataset.id];
    b.addEventListener('mouseenter', () => { det.querySelector('.d-desc').innerHTML = `${sp.emoji} <b>${sp.name}</b> <span class="pasTag">${L('✨ ČAROLIJA', '✨ SPELL')}</span><br>${sp.desc} · ⏱️ ${sp.cd} ${U_SEC}`; });
    b.addEventListener('click', () => {
      const k = pickedSummoners.indexOf(sp.id);
      if(k >= 0) return;                              // već odabrana
      pickedSummoners = [pickedSummoners[1], sp.id];  // nova ide na F, stara F prelazi na D
      try { localStorage.setItem('dk_summoners', JSON.stringify(pickedSummoners)); } catch(e){}
      syncSum(); sfx('click');
    });
  });
  syncSum();
  show(0);
  showHeroPreview(det.querySelector('.d-model'), h.id);   // 3D model iz Blendera
  document.getElementById('startBtn').disabled = false;
}

/* ================= HUD ================= */
function drawBar(x, y, w, h, frac, fg, bg){
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamp(frac, 0, 1)), h - 2);
}

/* 🖱️ okvir oko trake života jedinice pod mišem (crven za neprijatelja, zelen za prijatelja) */
function drawHoverFrame(u, s){
  let r;
  if(u.kind === 'hero') r = [s.x - 31, s.y - 13, 78, 19];
  else if(u.kind === 'creep') r = [s.x - 18, s.y - 2, 36, 9];
  else if(u.kind === 'neutral'){ const big = u.boss || u.drake, w = u.boss ? 80 : (u.drake ? 64 : 40); r = [s.x - w / 2 - 2, s.y - 2, w + 4, (big ? 8 : 5) + 4]; }
  else if(u.kind === 'ancient') r = [s.x - 62, s.y - 2, 124, 14];
  else r = [s.x - 44, s.y - 2, 88, 12];
  const enemy = player && u.team !== player.team;
  ctx.strokeStyle = enemy ? (u.team === TEAM_NEUTRAL ? '#fbbf24' : '#f87171') : '#86efac';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.75 + Math.sin(performance.now() / 120) * 0.25;
  ctx.strokeRect(r[0], r[1], r[2], r[3]);
  ctx.globalAlpha = 1;
}
/* ❤️ traka života junaka (kao u LoL-u): crtice svakih 100 života, svjetliji trag izgubljenog života,
   bijeli štit (Barijera), traka mane i kućica s levelom lijevo */
function drawHeroBar(u, cx, cy){
  const w = 74, h = 9, x = cx - w / 2 + 8, y = cy - 11;
  const mine = u.team === myTeam, frac = clamp(u.hp / u.maxhp, 0, 1);
  // trag izgubljenog života polako sustiže pravu vrijednost
  if(u._chip == null || u._chip < frac) u._chip = frac;
  else u._chip = Math.max(frac, u._chip - 0.6 * (1 / 60));
  ctx.fillStyle = 'rgba(5,8,12,0.85)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  const iw = w;
  ctx.fillStyle = 'rgba(255,240,200,0.75)'; ctx.fillRect(x, y, iw * u._chip, h);   // trag
  ctx.fillStyle = u.isPlayer ? '#22c55e' : (mine ? '#3b82f6' : '#ef4444');
  ctx.fillRect(x, y, iw * frac, h);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, iw * frac, 2);       // odsjaj
  if(u.barrierT > 0 && u.barrierHp > 0){   // 🫧 štit: bijeli dio nakon života
    const sw = Math.min(iw * (1 - frac), iw * u.barrierHp / u.maxhp);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + iw * frac, y, Math.max(2, sw), h);
  }
  // crtice: svakih 100 života tanka, svakih 1000 deblja
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const step = 100 / u.maxhp * iw;
  if(step >= 2.5) for(let k = 1; k * 100 < u.maxhp; k++){
    const tx = x + k * step, big = k % 10 === 0;
    ctx.fillRect(Math.round(tx), y, big ? 2 : 1, big ? h : h * 0.55);
  }
  // mana
  ctx.fillStyle = 'rgba(5,8,12,0.85)'; ctx.fillRect(x - 1, y + h + 1, w + 2, 5);
  ctx.fillStyle = '#38bdf8'; ctx.fillRect(x, y + h + 2, w * (u.maxmp ? clamp(u.mp / u.maxmp, 0, 1) : 0), 3);
  drawStunBar(u, x, y + h + 8, w, true);   // 💫 v0.56
  // level
  const lx = x - 19;
  ctx.fillStyle = 'rgba(5,8,12,0.9)'; ctx.fillRect(lx, y - 1, 17, h + 7);
  ctx.strokeStyle = mine ? '#93c5fd' : '#fca5a5'; ctx.lineWidth = 1; ctx.strokeRect(lx + 0.5, y - 0.5, 16, h + 6);
  ctx.fillStyle = '#fde047'; ctx.font = fontTxt(10.5, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(u.level, lx + 8.5, y + (h + 5) / 2);
  if(u.richBounty > 0){   // 🎯 v0.54 bogata meta: toliko zlata dobiva tim koji ga sruši
    const tx = '🎯' + u.richBounty;
    ctx.font = fontTxt(10.5, true);
    const tw = ctx.measureText(tx).width + 8, bx = x + w + 3;
    ctx.fillStyle = 'rgba(5,8,12,0.85)'; ctx.fillRect(bx, y - 1, tw, h + 7);
    ctx.strokeStyle = '#fde047'; ctx.strokeRect(bx + 0.5, y - 0.5, tw - 1, h + 6);
    ctx.fillStyle = '#fde047'; ctx.textAlign = 'left';
    ctx.fillText(tx, bx + 4, y + (h + 5) / 2);
  }
}
/* 💫 v0.56 traka omame (kao u DotA 2): zlatna, prazni se do kraja omame; junaci uz nju i sekunde */
function drawStunBar(u, x, y, w, secs){
  const st = u.status;
  if(!st || !(st.stun > 0)) return;
  const f = clamp(st.stun / Math.max(st.stunMax || st.stun, 0.1), 0, 1);
  ctx.fillStyle = 'rgba(5,8,12,0.85)'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
  ctx.fillStyle = '#facc15'; ctx.fillRect(x, y, w * f, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x, y, w * f, 1);
  if(secs){
    ctx.font = fontTxt(10.5, true); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3;
    const tx = '💫' + st.stun.toFixed(1);
    ctx.strokeText(tx, x + w + 3, y + 2); ctx.fillStyle = '#fde047'; ctx.fillText(tx, x + w + 3, y + 2);
  }
}
function barHeight(u){
  if(u.kind === 'hero') return 110;
  if(u.kind === 'barracks') return 150;
  if(u.kind === 'creep') return u.siege ? 72 : 62;
  if(u.kind === 'neutral') return u.boss ? 150 : (u.drake ? 118 : u.r * 2.4 + 22);
  if(u.kind === 'tower') return 196;
  return 185;
}

/* 💡 savjeti za početnike: kratka poruka u pravom trenutku (iznad ploče junaka). Svaki savjet najviše
   2 puta ukupno (pamti se u pregledniku), jedan po jedan, najviše jedan u 25 s; isključuju se u ⚙️ postavkama */
let tipCounts = {};
try { tipCounts = JSON.parse(localStorage.getItem('dk_tips') || '{}') || {}; } catch(e){}
const tip = { cur: null, t: 0, next: 8, done: {}, chk: 0, combatT: -99 };
const TIPS = [
  { k: 'lowhp', txt: L('❤️ Malo života! Makni se od neprijatelja ili pritisni T dvaput — teleport kući 🏠', '❤️ Low health! Move away from enemies or press T twice — teleport home 🏠'),
    test: p => p.hp < p.maxhp * 0.3 && !nearBase(p) },
  { k: 'lasthit', txt: L('🪙 Kad vojnik ima zlatnik iznad glave, udari ga baš tada — dobit ćeš zlato!', '🪙 When a creep has a coin over its head, hit it right then — you get gold!'),
    test: p => gameTime > 50 && (p.lastHits || 0) < 3 && units.some(c => c.kind === 'creep' && lastHitMark(c) === 'gold') },
  { k: 'buy', txt: null,
    test: p => { const it = tipNextBuy(p); if(!it) return false; tip.buyName = it.emoji + ' ' + it.name; return true; } },
  { k: 'jungle', txt: L('🌲 U džungli si! Udari 🦎 guštera u malom kampu (označen na mapi) — kad mu je malo života, baci 🌩️ Kaznu (D ili F)', '🌲 You are the jungler! Hit a 🦎 lizard at the small camp (marked on the map) — when it is low, cast 🌩️ Smite (D or F)'),   // v0.56
    test: p => p.jungler && gameTime > 3 && gameTime < 90 && (p.lastHits || 0) < 2 },
  { k: 'tango', txt: L('🌿 Klikni Šumsku grickalicu pa DRVO — junak pojede drvo i polako se liječi', '🌿 Click the Forest Snack, then a TREE — your hero eats it and slowly heals'),
    test: p => itemCharges(p, 'tango') > 0 && p.items.some(i => i.id === 'tango') && p.hp < p.maxhp * 0.65 && gameTime - tip.combatT > 3 },
  { k: 'ult', txt: L('🌟 Level 6 — otključaj ULTI! Klikni + iznad tipke R', '🌟 Level 6 — unlock your ULT! Click + above the R key'),
    test: p => p.level >= 6 && p.skillPoints > 0 && p.abilities[3] && p.abilities[3].rank === 0 },
  { k: 'tower', txt: L('🗼 Kula gađa TEBE! Pusti svoje vojnike naprijed pa onda napadaj kulu', '🗼 The tower is shooting YOU! Let your creeps go first, then attack it'),
    test: p => units.some(t => t.kind === 'tower' && t.team !== p.team && !t.dead && t.attackTarget === p) },
  { k: 'dead', txt: L('⏳ Dok čekaš oživljavanje, otvori dućan (B) i kupi nešto novo 🛒', '⏳ While you wait to respawn, open the shop (B) and buy something new 🛒'),
    test: p => p.dead && p.gold >= 250 },
  { k: 'tp', txt: L('🌀 Jedna staza je daleko? T pa klik na svoju kulu — teleport do nje!', '🌀 A lane is far away? Press T, then click your tower — teleport there!'),
    test: p => gameTime > 300 && !p.dead && p.tpCd <= 0 && nearBase(p) },
];
function tipNextBuy(p){   // sljedeći korak iz vodiča koji si možeš priuštiti
  if(typeof quickBuyList !== 'function' || p.dead || shopOpen) return null;
  const nextId = guideNextId(p);
  if(!nextId) return null;
  const step = quickBuyList(p, nextId).find(x => !x.instant && p.gold >= planPurchase(p, x).cost && planPurchase(p, x).ok);
  return step && nearBase(p) ? step : null;
}
/* ⬆️ same uče vještine (postavka): neiskorišteni poen nakon 2.5 s potroši se kao kod botova (ulti prvi, pa ravnomjerno) */
let autoSkillAt = 0;   // stvarno vrijeme (i na sporom tabletu jednako brzo)
function updateAutoSkill(){
  if(!SETTINGS.autoSkill || !player || player.dead || player.skillPoints <= 0 || gameOver){ autoSkillAt = 0; return; }
  const now = performance.now();
  if(!autoSkillAt){ autoSkillAt = now; return; }
  if(now - autoSkillAt < 2500) return;
  autoSkillAt = 0;
  if(net.mode !== 'guest'){ botSpendPoints(player); return; }
  const i = canLearn(player, 3) ? 3 : [0, 1, 2].filter(k => canLearn(player, k)).sort((a, b) => player.abilities[a].rank - player.abilities[b].rank)[0];
  if(i != null) netLearn(i);
}
function updateTips(dt){
  if(!player || !SETTINGS.tips || gameOver || gameTime < 0) return;
  if(gameTime - (player.combatT == null ? -99 : player.combatT) < 0.5) tip.combatT = gameTime;
  if(tip.cur){ tip.t += dt; if(tip.t > 7) { tip.cur = null; tip.next = gameTime + 25; } return; }
  if(gameTime < tip.next || (tip.chk -= dt) > 0) return;
  tip.chk = 1;
  for(const t of TIPS){
    if(tip.done[t.k] || (tipCounts[t.k] || 0) >= 2) continue;
    let ok = false;
    try { ok = t.test(player); } catch(e){ ok = false; }
    if(!ok) continue;
    tip.cur = t.k === 'buy' ? { k: 'buy', txt: L('🛒 Imaš dovoljno zlata za ' + tip.buyName + '! Pritisni B — dućan', '🛒 You have enough gold for ' + tip.buyName + '! Press B — shop') } : t;
    tip.t = 0; tip.done[t.k] = true;
    tipCounts[t.k] = (tipCounts[t.k] || 0) + 1;
    try { localStorage.setItem('dk_tips', JSON.stringify(tipCounts)); } catch(e){}
    sfx('tick');
    break;
  }
}
function drawTip(){
  if(!tip.cur || !SETTINGS.tips || gameOver || keys['tab'] || scoreOpen) return;
  if(VH < 520 && player && player.dead) return;   // 📱 ne zaklanjaj gumb za otkup
  const HL = hudLayout();
  const a = tip.t < 0.25 ? tip.t / 0.25 : (tip.t > 6.4 ? Math.max(0, (7 - tip.t) / 0.6) : 1);
  ctx.save();
  ctx.globalAlpha = a;
  const small = VH < 520;   // 📱 mobitel: manji savjet, manje zaklanja igru
  ctx.font = fontTxt(small ? 12 : 15, true);
  const txt = '💡 ' + tip.cur.txt, w = Math.min(VW - 40, ctx.measureText(txt).width + 34), h = small ? 28 : 36;
  const x = clamp(HL.px + HL.pw / 2 - w / 2, 10, VW - w - 10), y = HL.py - h - (small ? 30 : 44) - (1 - a) * 8;
  ctx.fillStyle = 'rgba(15,23,42,0.88)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.stroke();
  ctx.fillStyle = '#fef9c3'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, x + w / 2, y + h / 2 + 1, w - 24);
  ctx.restore();
}
/* 🎯 ZADACI ZA POČETNIKE (v0.44): jedan po jedan mali zadatak uz minimapu — svaki riješeni daje zlato.
   Vode dijete kroz igru: kupi → nauči moć → zadnji udarci → moći → pobjeda nad junakom → ulti → kula → prijestol.
   Samo protiv botova (u igri s prijateljem bi zlato bilo nepravedno); isključuje se u ⚙️ postavkama. */
const QUESTS = [
  { e: '🛒', n: L('Kupi predmet u dućanu (B)', 'Buy an item in the shop (B)'), gold: 40, goal: 1,
    v: p => (p.items.some(Boolean) || (p.backpack || []).some(Boolean)) ? 1 : 0 },
  { e: '⬆️', n: L('Nauči moć — klikni + iznad Q, W ili E', 'Learn an ability — click + above Q, W or E'), gold: 40, goal: 1,
    v: p => p.abilities.some(a => a && a.rank > 0) ? 1 : 0 },
  { e: '🪙', n: L('Dokrajči 5 vojnika zadnjim udarcem', 'Finish off 5 creeps with the last hit'), gold: 75, goal: 5, v: p => p.lastHits || 0 },
  { e: '✨', n: L('Baci moć 3 puta (Q, W ili E)', 'Cast an ability 3 times (Q, W or E)'), gold: 50, goal: 3, v: p => p.qCasts || 0 },
  { e: '⚔️', n: L('Pobijedi neprijateljskog junaka ili pomozi timu', 'Defeat an enemy hero or help your team do it'), gold: 100, goal: 1, v: p => p.kills + p.assists },
  { e: '🌟', n: L('Dođi do levela 6 i otključaj ULTI (R)', 'Reach level 6 and unlock your ULT (R)'), gold: 100, goal: 1,
    v: p => p.abilities[3] && p.abilities[3].rank > 0 ? 1 : 0 },
  { e: '🗼', n: L('Budi blizu kad tvoj tim sruši neprijateljsku kulu', 'Be close when your team knocks down an enemy tower'), gold: 150, goal: 1, v: p => p.qTower ? 1 : 0 },
];
const quest = { i: 0, doneT: 0, chk: 0, allT: 0, last: null };
function questsOn(){ return SETTINGS.quests && player && net.mode !== 'host' && net.mode !== 'guest' && !gameOver; }
function updateQuests(dt){
  if(!questsOn()) return;
  if(quest.doneT > 0){ quest.doneT -= dt; if(quest.doneT <= 0) quest.i++; return; }
  if(quest.i >= QUESTS.length){ quest.allT += dt; return; }
  if((quest.chk -= dt) > 0) return;
  quest.chk = 0.4;
  const q = QUESTS[quest.i];
  let v = 0;
  try { v = q.v(player); } catch(e){}
  if(v >= q.goal){   // ✅ riješeno: zlato, zvuk, zlatnici
    quest.doneT = 2.6; quest.last = q;
    player.gold += q.gold;
    addFloat(player.x, player.y, '+' + q.gold + ' 🪙', '#fde047', 18, player.team);
    burst(player.x, player.y, '#fde047', 18, 220, 6);
    sfx('coin'); setTimeout(() => sfx('levelup'), 120);
  }
}
function drawQuest(){
  if(!questsOn() || gameTime < -28 || VH < 560 || keys['tab'] || scoreOpen || chatOpen) return;   // tablica i brze poruke idu preko
  const HL = hudLayout();
  const all = quest.i >= QUESTS.length;
  if(all && quest.allT > 7) return;
  const done = quest.doneT > 0, q = done ? quest.last : QUESTS[Math.min(quest.i, QUESTS.length - 1)];
  const w = 318, h = 62, x = 14, y = HL.my - h - 16;
  const pop = done ? 1 + Math.max(0, quest.doneT - 2.3) * 0.25 : 1;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop, pop); ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.globalAlpha = all ? Math.min(1, (7 - quest.allT) / 0.8) : 1;
  ctx.fillStyle = done || all ? 'rgba(20,83,45,0.92)' : 'rgba(15,23,42,0.86)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = done || all ? '#4ade80' : '#c9a24a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if(all){
    ctx.font = fontTxt(14, true); ctx.fillStyle = '#bbf7d0';
    ctx.fillText(L('🏆 Svi zadaci riješeni!', '🏆 All quests done!'), x + 12, y + 20, w - 24);
    ctx.font = fontTxt(13, true); ctx.fillStyle = '#fef9c3';
    ctx.fillText(L('Sad sruši protivnički prijestol 👑', 'Now knock down the enemy throne 👑'), x + 12, y + 43, w - 24);
    ctx.restore(); return;
  }
  ctx.font = fontTxt(12, true); ctx.fillStyle = done ? '#bbf7d0' : '#c9b27a';
  ctx.fillText(done ? L('✅ Zadatak riješen!', '✅ Quest done!') : '🎯 ' + L('Zadatak', 'Quest') + ' ' + (quest.i + 1) + '/' + QUESTS.length, x + 12, y + 14);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fde047';
  ctx.fillText('+' + q.gold + ' 🪙', x + w - 12, y + 14);
  ctx.textAlign = 'left'; ctx.font = fontTxt(13.5, true); ctx.fillStyle = '#fff';
  ctx.fillText(q.e + ' ' + q.n, x + 12, y + 34, w - 24);
  let v = q.goal;
  if(!done) try { v = Math.min(q.goal, q.v(player)); } catch(e){ v = 0; }
  drawBar(x + 12, y + h - 13, w - (q.goal > 1 ? 70 : 24), 6, v / q.goal, done ? '#4ade80' : '#fde047');
  if(q.goal > 1){ ctx.font = fontTxt(11, true); ctx.textAlign = 'right'; ctx.fillStyle = '#e5e7eb'; ctx.fillText(v + '/' + q.goal, x + w - 12, y + h - 10); }
  ctx.restore();
}
/* 🪙 zadnji udarac (kao u DotA): neprijateljski vojnik kojeg tvoj sljedeći udarac pobjeđuje dobije zlatnik iznad trake života,
   a tvoj vojnik kojeg možeš uskratiti ❗ — djeca tako uče farmati zlato */
function lastHitMark(c){
  if(!player || player.dead || !SETTINGS.lastHit || c.summonOf) return null;
  const range = (player.atkRange || 150) + 380;
  if(dist(player, c) > range) return null;
  const ranged = player.projSpeed > 0;
  const raw = (player.dmg || 0) + (c.team !== player.team && player.ifx && player.ifx.creepDmg ? player.ifx.creepDmg * (ranged ? 0.5 : 1) : 0);
  const hit = raw * armorMul(unitArmor(c));
  if(c.hp > hit) return null;
  if(c.team !== player.team) return seenByPlayer(c) ? 'gold' : null;
  return c.hp < c.maxhp * CFG.denyHp ? 'deny' : null;
}
function drawWorldOverlay(){
  for(const u of units){
    if(u.dead || u.removeMe) continue;
    if(!seenByPlayer(u)) continue;   // magla rata
    const gh = groundHeight(u.x, u.y);
    const s = worldToScreen(u.x, gh + barHeight(u), u.y);
    if(!s || s.x < -80 || s.x > VW + 80 || s.y < -60 || s.y > VH + 60) continue;
    if(u.kind === 'hero'){
      ctx.font = fontTxt(13, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      const nm = (u.streak >= 3 ? '🔥 ' : '') + u.name + (u.isPlayer ? ' ⭐' : '');   // 🔥 niz pobjeda (3+)
      ctx.strokeText(nm, s.x + 8, s.y - 13);
      ctx.fillStyle = '#fff';
      ctx.fillText(nm, s.x + 8, s.y - 13);
      drawHeroBar(u, s.x, s.y);
      if(u.tpChannel > 0){
        drawBar(s.x - 24, s.y + 6, 48, 6, 1 - u.tpChannel / (u.tpDur || 3), '#60a5fa');
        ctx.font = fontEmoji(12);
        ctx.fillText(u.tpDest ? '🌀' : '🏠', s.x + 32, s.y + 9);
      }
    }
    else if(u.kind === 'creep'){
      drawBar(s.x - 16, s.y, 32, 5, u.hp / u.maxhp, TEAM_COLOR[u.team]);
      drawStunBar(u, s.x - 16, s.y + 7, 32);
      const lh = lastHitMark(u);   // 🪙 pomoć za "zadnji udarac": tvoj sljedeći udarac ga pobjeđuje
      if(lh){
        const bob = Math.sin(performance.now() / 120) * 2;
        ctx.font = fontEmoji(lh === 'deny' ? 12 : 15);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(lh === 'deny' ? '❗' : '🪙', s.x, s.y - 2 + bob);
        if(lh === 'gold'){ ctx.strokeStyle = 'rgba(253,224,71,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(s.x - 17, s.y - 1, 34, 7); }
      }
    }
    else if(u.kind === 'neutral'){
      const big = u.boss || u.drake, w = u.boss ? 80 : (u.drake ? 64 : 40), bh = big ? 8 : 5;
      drawBar(s.x - w / 2, s.y, w, bh, u.hp / u.maxhp, u.drake ? DRAKES[u.drake].color : '#f59e0b');
      drawStunBar(u, s.x - w / 2, s.y + bh + 2, w);
      if(u.nlvl > 1){   // 🐲 level čudovišta (raste s vremenom)
        const lx = s.x - w / 2 - 15, ly = s.y - 2, lh = Math.max(9, bh + 4);
        ctx.fillStyle = 'rgba(5,8,12,0.85)'; ctx.fillRect(lx, ly, 13, lh);
        ctx.fillStyle = '#fde047'; ctx.font = fontTxt(9, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(u.nlvl, lx + 6.5, ly + lh / 2 + 0.5);
      }
      if(big){
        const nm = u.boss ? L('🐲 Veliki Zmaj', '🐲 Great Dragon') : DRAKES[u.drake].emoji + ' ' + DRAKES[u.drake].name;
        ctx.font = fontTxt(u.boss ? 13 : 12, true);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(nm, s.x, s.y - 3);
        ctx.fillStyle = u.boss ? '#fde047' : DRAKES[u.drake].color;
        ctx.fillText(nm, s.x, s.y - 3);
      }
    }
    else if(u.kind === 'tower'){
      drawBar(s.x - 42, s.y, 84, 8, u.hp / u.maxhp, TEAM_COLOR[u.team]);
      ctx.font = fontTxt(10, true); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';   // 🏰 v0.56: oznaka T1–T4
      ctx.fillStyle = '#e5e7eb'; ctx.fillText(u.isGuard ? 'T4' : 'T' + u.tier, s.x + 45, s.y + 9);
      if(u.invuln){
        ctx.font = fontEmoji(16);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('🔒', s.x, s.y - 3);
      }
    }
    else if(u.kind === 'barracks'){
      drawBar(s.x - 42, s.y, 84, 8, u.hp / u.maxhp, TEAM_COLOR[u.team]);
      if(u.invuln){
        ctx.font = fontEmoji(16);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('🔒', s.x, s.y - 3);
      }
    }
    else if(u.kind === 'ancient'){
      drawBar(s.x - 60, s.y, 120, 10, u.hp / u.maxhp, TEAM_COLOR[u.team]);
      if(u.invuln){
        ctx.font = fontEmoji(20);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('🛡️', s.x, s.y - 4);
      }
    }
    if(u === hoverUnit) drawHoverFrame(u, s);
  }

  for(const p of particles){
    if(!p.emoji && typeof fx !== 'undefined' && fx.points) continue;   // obične iskre crta 3D sustav čestica
    const s = worldToScreen(p.x, groundHeight(p.x, p.y) + 28, p.y);
    if(!s) continue;
    ctx.globalAlpha = 1 - p.t / p.life;
    if(p.emoji){
      ctx.font = fontEmoji(p.size * 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, s.x, s.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, p.size * (0.5 + cam.zoom * 0.55), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  for(const f of floats){
    if(f.team != null && f.team >= 0 && f.team !== myTeam) continue;   // tuđa osobna poruka
    if(f.who && !(player && f.who.includes(player.id))) continue;      // tuđi brojevi štete (mrežna igra)
    const s = worldToScreen(f.x, groundHeight(f.x, f.y) + f.h, f.y);
    if(!s) continue;
    ctx.globalAlpha = f.t < 0.7 ? 1 : 1 - (f.t - 0.7) / 0.4;
    if(f.st === 'crit'){ drawCritFloat(f, s); ctx.globalAlpha = 1; continue; }
    ctx.font = fontTxt(f.size, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.txt, s.x, s.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, s.x, s.y);
    ctx.globalAlpha = 1;
  }
}

/* 🎬 efekti preko cijelog ekrana: bljesak ultija, crveni rub kad te jako udare, pulsiranje pri malo života */
const scrFx = { flash: 0, col: '#ffffff', hurt: 0, hp: -1, pid: -1 };
function screenFlash(col, a){ scrFx.col = col || '#ffffff'; scrFx.flash = Math.max(scrFx.flash, a || 0.3); }
function drawScreenFx(dt){
  if(!player) return;
  if(scrFx.pid !== player.id){ scrFx.pid = player.id; scrFx.hp = player.hp; }
  if(!player.dead && player.hp < scrFx.hp - player.maxhp * 0.04) scrFx.hurt = Math.min(1, scrFx.hurt + (scrFx.hp - player.hp) / player.maxhp * 3);
  scrFx.hp = player.hp;
  const low = !player.dead && player.hp < player.maxhp * 0.25 && !nearBase(player) ? 0.3 + 0.2 * Math.sin(performance.now() / 180) : 0;   // u bazi si siguran
  const red = Math.max(scrFx.hurt * 0.75, low);
  if(red > 0.01){
    const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    g.addColorStop(0, 'rgba(220,20,20,0)'); g.addColorStop(1, 'rgba(200,10,10,' + red.toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  if(scrFx.flash > 0.01){
    const g = ctx.createRadialGradient(VW / 2, VH / 2, 0, VW / 2, VH / 2, Math.max(VW, VH) * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, scrFx.col);
    ctx.globalAlpha = scrFx.flash; ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1;
  }
  scrFx.hurt = Math.max(0, scrFx.hurt - dt * 2.2);
  scrFx.flash = Math.max(0, scrFx.flash - dt * 2.5);
}
/* 💥 kritični broj: iskoči prevelik, odskoči na mjesto, iza njega bljesne zvijezda */
function drawCritFloat(f, s){
  const t = f.t;
  const pop = t < 0.09 ? 0.4 + t / 0.09 * 1.25 : (t < 0.2 ? 1.65 - (t - 0.09) / 0.11 * 0.65 : 1 + Math.max(0, 0.3 - t) * 0.2);
  const shk = t < 0.18 ? (1 - t / 0.18) * 4 : 0;
  ctx.save();
  ctx.translate(s.x + (Math.random() - 0.5) * shk, s.y - 6 + (Math.random() - 0.5) * shk);
  ctx.rotate(f.rot || 0);
  ctx.scale(pop, pop);
  if(t < 0.35){   // zvjezdasti bljesak iza broja
    const k = 1 - t / 0.35, R = f.size * (1.3 + (1 - k) * 0.8);
    ctx.save();
    ctx.globalAlpha *= k * 0.85;
    ctx.rotate(t * 3);
    const g = ctx.createRadialGradient(0, -f.size * 0.45, 0, 0, -f.size * 0.45, R);
    g.addColorStop(0, 'rgba(255,248,200,1)'); g.addColorStop(0.45, 'rgba(255,140,40,0.75)'); g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for(let i = 0; i < 16; i++){
      const a = i / 16 * TAU, r = i % 2 ? R * 0.42 : R;
      ctx.lineTo(Math.cos(a) * r, -f.size * 0.45 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.font = fontTxt(f.size, true);
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  const tw = ctx.measureText(f.txt).width;
  ctx.strokeStyle = 'rgba(40,0,0,0.9)'; ctx.lineWidth = 6;
  ctx.strokeText(f.txt, 0, 0);
  const gr = ctx.createLinearGradient(0, -f.size, 0, 0);
  gr.addColorStop(0, '#fff3a3'); gr.addColorStop(0.45, '#ffb020'); gr.addColorStop(1, f.color);
  ctx.fillStyle = gr;
  ctx.fillText(f.txt, 0, 0);
  ctx.font = fontEmoji(f.size * 0.7);
  ctx.fillText('💥', -tw * 0.5 - f.size * 0.55, -f.size * 0.1);
  ctx.restore();
}

/* 💬 izbornik brzih poruka (G) */
function drawChatWheel(){
  uiRects.chat = null;
  if(!chatOpen || !player) return;
  const w = 210, rh = 26, x = 14, y = VH - hudLayout().ms - 60 - CHAT_LINES.length * rh;
  drawFrame(x, y - 30, w, CHAT_LINES.length * rh + 40, 10);
  ctx.font = fontTxt(13, true);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  ctx.fillText(L('💬 Brza poruka (1–6)', '💬 Quick chat (1–6)'), x + w / 2, y - 14);
  uiRects.chat = [];
  CHAT_LINES.forEach((ln, i) => {
    const ry = y + i * rh;
    const r = { x: x + 8, y: ry, w: w - 16, h: rh - 4 };
    uiRects.chat.push(r);
    const hov = inRect(mouse.sx, mouse.sy, r);
    ctx.fillStyle = hov ? '#334155' : '#1e293b';
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'left';
    ctx.font = fontTxt(12, true);
    ctx.fillText(String(i + 1), r.x + 8, r.y + r.h / 2);
    ctx.fillStyle = '#f8fafc';
    ctx.font = fontEmoji(13);
    ctx.fillText(ln, r.x + 26, r.y + r.h / 2);
  });
}

/* položaji dijelova HUD-a (Warcraft 3 raspored) */
const INV_SW = 44, INV_SH = 33, INV_G = 4;
/* 🔵🔴 traka buffova (kao u LoL-u): sve što trenutno djeluje na junaka, s preostalim vremenom */
function drakeDesc(el, n){
  if(el === 'fire') return L('+' + 6 * n + '% štete junaka (udarci i moći)', '+' + 6 * n + '% hero damage (attacks and abilities)');
  if(el === 'water') return L('+' + 3 * n + ' obnove života i +' + String(1.5 * n).replace('.', ',') + ' obnove mane', '+' + 3 * n + ' HP regen and +' + (1.5 * n) + ' mana regen');
  if(el === 'storm') return L('+' + 5 * n + '% brzine kretanja', '+' + 5 * n + '% move speed');
  return L('+' + 3 * n + ' oklopa', '+' + 3 * n + ' armor');
}
function buffList(h){
  const st = h.status, L = [];
  const add = (e, name, t, good, desc) => { if(t > 0) L.push({ e, name, t, good, desc }); };
  for(const el of DRAKE_KEYS){   // 🐉 trajni bonusi zmajčića (cijeli tim)
    const n = drakeN(h.team, el);
    if(n) L.push({ e: DRAKES[el].emoji, name: DRAKES[el].name + (n > 1 ? ' ×' + n : ''), t: Infinity, good: true, perm: true, n, col: DRAKES[el].color, desc: drakeDesc(el, n) });
  }
  if(h.jbuff){ add('🔵', JUNGLE_BUFFS.blue.name, h.jbuff.blue, true, JUNGLE_BUFFS.blue.desc); add('🔴', JUNGLE_BUFFS.red.name, h.jbuff.red, true, JUNGLE_BUFFS.red.desc); }
  // (ovdje je L lokalni popis, pa se tekst bira s EN ? 'English' : 'hrvatski')
  if(h.aegis) add('🛡️', EN ? 'Dragon Shield' : LS('Zmajev štit'), h.aegisT, true, EN ? 'one free respawn where you fell' : LS('jedno besplatno oživljavanje na mjestu smrti'));
  if(st.dmgMulT > 0 && st.dmgMulF > 1) add('⚔️', EN ? 'Stronger attacks' : LS('Jači udarci'), st.dmgMulT, true, EN ? '+' + Math.round((st.dmgMulF - 1) * 100) + '% attack damage' : LS('+' + Math.round((st.dmgMulF - 1) * 100) + '% štete udarcima'));
  add('🫧', EN ? 'Barrier' : LS('Barijera'), h.barrierT, true, EN ? 'shield that blocks ' + Math.round(h.barrierHp || 0) + ' damage' : LS('štit od ' + Math.round(h.barrierHp || 0) + ' štete'));
  add('👑', EN ? 'Unstoppable' : LS('Nepokolebljiv'), st.immuneT, true, EN ? 'nothing can stun or slow you' : LS('ništa te ne može omamiti ni usporiti'));
  add('🏃', EN ? 'Haste' : LS('Ubrzanje'), st.hasteT, true, EN ? 'faster movement' : LS('brže kretanje'));
  add('💨', h.travel === 2 ? (EN ? 'Home Wind' : LS('Vjetar doma')) : (EN ? 'Traveler' : LS('Putnik')), h.travel ? 999 : 0, true,
    h.travel === 2 ? (EN ? '+40% speed from the fountain at the start of the game — until you fight' : LS('+40% brzine od fontane na početku igre — dok ne uđeš u borbu')) : (EN ? '+15% speed when not fighting' : LS('+15% brzine kad nisi u borbi')));
  add('🛡️', EN ? 'Battle Call' : LS('Bojni zov'), h.armorBuffT, true, EN ? '+' + (h.armorBuff || 0) + ' armor' : LS('+' + (h.armorBuff || 0) + ' oklopa'));
  add('🔭', EN ? 'Spyglass' : LS('Durbin'), h.scopeT, true, EN ? 'you shoot farther and faster' : LS('gađaš dalje i brže'));
  add('🍖', EN ? 'War Hunger' : LS('Ratna glad'), h.hungerT, false, EN ? 'you lose health until you defeat someone' : LS('gubiš život dok nekoga ne pobijediš'));
  add('🛡', EN ? 'Shield' : LS('Štit'), st.shieldT, true, EN ? 'you take less damage' : LS('primaš manje štete'));
  add('👻', EN ? 'Invisible' : LS('Nevidljiv'), st.invisT, true, EN ? "enemies can't see you (attacking ends it)" : LS('neprijatelji te ne vide (napad prekida)'));
  add('🦇', EN ? 'Thirst' : LS('Žeđ'), h.lsBoostT, true, EN ? 'attacks steal lots of health' : LS('udarci kradu puno života'));
  add('✨', EN ? 'Regen Rune' : LS('Runa obnove'), h.runeRegenT, true, EN ? 'fast health and mana regen' : LS('brzo obnavljanje života i mane'));
  add('🐌', EN ? 'Exhausted' : LS('Iscrpljen'), h.weakT, false, EN ? 'weaker attacks' : LS('slabiji udarci'));
  add('🔥', EN ? 'Ignited' : LS('Zapaljen'), h.gwT, false, EN ? 'weaker healing' : LS('slabije liječenje'));
  add('❄️', EN ? 'Slowed' : LS('Usporen'), st.slowT, false, EN ? 'slower movement' : LS('sporije kretanje'));
  add('⭐', EN ? 'Stunned' : LS('Omamljen'), st.stun, false, EN ? "you can't do anything" : LS('ne možeš ništa'));
  add('🤐', EN ? 'Silenced' : LS('Ušutkan'), st.silenceT, false, EN ? "you can't cast abilities" : LS('ne možeš bacati moći'));
  add('🤢', EN ? 'Poison' : LS('Otrov'), st.poisonT, false, EN ? 'you lose health' : LS('gubiš život'));
  add('🌀', EN ? 'Curse' : LS('Kletva'), st.curseT, false, EN ? 'you take more damage' : LS('primaš više štete'));
  add('😵', EN ? 'Dizzy' : LS('Vrtoglavica'), st.blindT, false, EN ? 'your attacks miss' : LS('promašuješ udarce'));
  add('🌘', EN ? 'Armor Broken' : LS('Skinut oklop'), h.corruptT, false, EN ? '−' + (h.corruptA || 0) + ' armor' : LS('−' + (h.corruptA || 0) + ' oklopa'));
  return L;
}
function drawBuffBar(HL){
  uiRects.buff = [];
  const L = buffList(player);
  if(!L.length) return;
  const sz = 26, g = 4, x0 = HL.px + 10, y0 = HL.py - sz - 8;
  L.slice(0, 12).forEach((b, i) => {
    const x = x0 + i * (sz + g), y = y0;
    uiRects.buff.push({ x, y, w: sz, h: sz, b });
    ctx.fillStyle = 'rgba(8,12,18,0.85)'; ctx.fillRect(x, y, sz, sz);
    ctx.strokeStyle = b.col || (b.good ? '#4ade80' : '#f87171'); ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, sz - 1, sz - 1);
    ctx.font = fontEmoji(15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.e, x + sz / 2, y + sz / 2);
    if(b.n > 1){   // 🐉 broj zmajčića istog elementa
      ctx.font = fontTxt(9, true); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2.5;
      ctx.strokeText('×' + b.n, x + sz - 2, y + sz - 2); ctx.fillStyle = '#fde68a'; ctx.fillText('×' + b.n, x + sz - 2, y + sz - 2);
    } else if(b.t < 600){
      ctx.font = fontTxt(9, true); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2.5;
      const tt = b.t >= 100 ? Math.ceil(b.t / 60) + 'm' : Math.ceil(b.t);
      ctx.strokeText(tt, x + sz - 2, y + sz - 2); ctx.fillStyle = '#fff'; ctx.fillText(tt, x + sz - 2, y + sz - 2);
    }
  });
}
function drawSummonerBtn(k, x, y, as){
  const sp = player.summoners && SUMMONER_BY_ID[player.summoners[k]];
  const r = { x, y, w: as, h: as };
  uiRects.sum[k] = r;
  if(!sp) return;
  const cd = (player.sumCd && player.sumCd[k]) || 0, pend = pendingCast && pendingCast.sum === k;
  const hov = hoverUi && hoverUi.type === 'sum' && hoverUi.i === k;
  const g = ctx.createLinearGradient(x, y, x, y + as);
  g.addColorStop(0, hexA(sp.color, 0.45)); g.addColorStop(1, '#0f141c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x + as / 2, y + as / 2, as / 2 - 1, 0, TAU); ctx.fill();   // okrugli kao u LoL-u
  ctx.strokeStyle = pend ? '#fde047' : (hov ? '#fff' : hexA(sp.color, 0.9)); ctx.lineWidth = pend ? 3.5 : 2.5;
  ctx.beginPath(); ctx.arc(x + as / 2, y + as / 2, as / 2 - 1, 0, TAU); ctx.stroke();
  ctx.font = fontEmoji(24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = cd > 0 ? 0.4 : 1;
  ctx.fillText(sp.emoji, x + as / 2, y + as / 2 + 1);
  ctx.globalAlpha = 1;
  if(cd > 0){
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.moveTo(x + as / 2, y + as / 2); ctx.arc(x + as / 2, y + as / 2, as / 2 - 2, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / sp.cd)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = fontTxt(15, true);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
    ctx.strokeText(Math.ceil(cd), x + as / 2, y + as / 2 + 1); ctx.fillText(Math.ceil(cd), x + as / 2, y + as / 2 + 1);
  }
  ctx.font = fontTxt(11, true); ctx.fillStyle = '#fde68a';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3;
  ctx.strokeText(k ? 'F' : 'D', x + 7, y + 8); ctx.fillText(k ? 'F' : 'D', x + 7, y + 8);
}
let invDrag = null;   // {from, sx, sy, moved} — povlačenje predmeta mišem
function drawItemSlot(it, x, y, w, h, i, opt){
  const hov = hoverUi && hoverUi.type === 'inv' && hoverUi.i === i;
  ctx.fillStyle = 'rgba(5,8,12,0.85)';
  ctx.fillRect(x, y, w, h);
  if(it){
    const img = itemIconCanvas(it);
    ctx.globalAlpha = it.pending ? 0.32 + 0.12 * Math.sin(gameTime * 5) : (opt.dim ? 0.45 : 1);
    if(invDrag && invDrag.moved && invDrag.from === i) ctx.globalAlpha = 0.25;
    ctx.drawImage(img, x, y, w, h);
    ctx.globalAlpha = 1;
    if(opt.dim){ ctx.fillStyle = 'rgba(20,24,30,0.35)'; ctx.fillRect(x, y, w, h); }
    if(it.pending){ ctx.font = fontEmoji(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🫏', x + w - 8, y + h - 8); }
    else if(!opt.dim && it.active){
      const icd = player.itemCd[it.id] || 0;
      if(icd > 0){   // hlađenje: tamni "sat" koji se otvara + sekunde
        const f = Math.min(1, icd / it.active.cd);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2); ctx.arc(x + w / 2, y + h / 2, w, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = fontTxt(13, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
        ctx.strokeText(Math.ceil(icd), x + w / 2, y + h / 2 + 1); ctx.fillText(Math.ceil(icd), x + w / 2, y + h / 2 + 1);
      } else if(player.mp < (it.active.mana || 0)){   // nema mane: plavi veo
        ctx.fillStyle = 'rgba(30,64,175,0.45)'; ctx.fillRect(x, y, w, h);
      }
      if(it.charges || it.wand){   // punjenja dolje desno
        const ch = itemCharges(player, it.id);
        ctx.font = fontTxt(11, true); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 3; ctx.strokeText(ch, x + w - 3, y + h - 3);
        ctx.fillStyle = ch > 0 ? '#fff' : '#fca5a5'; ctx.fillText(ch, x + w - 3, y + h - 3);
      }
    }
  }
  if(opt.key){   // tipka gore lijevo
    ctx.font = fontTxt(9, true); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2.5;
    ctx.strokeText(opt.key, x + 3, y + 2);
    ctx.fillStyle = pendingCast && pendingCast.item === i ? '#fde047' : (it && it.active ? '#e5e7eb' : '#6b7280');
    ctx.fillText(opt.key, x + 3, y + 2);
  }
  ctx.strokeStyle = hov ? '#fde047' : (it ? hexA((ITEM_QUALITY[it.q] || ITEM_QUALITY.comp)[0], 0.55) : hudTheme().rim2);
  ctx.lineWidth = hov ? 2 : 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function drawInventory(HL, py, ph){
  const N = CFG.inventorySlots, bp = player.backpack || [];
  const x0 = HL.invX, y0 = py + 10;
  uiRects.inv = [];
  for(let i = 0; i < N; i++){
    const x = x0 + (i % 3) * (INV_SW + INV_G), y = y0 + Math.floor(i / 3) * (INV_SH + INV_G);
    uiRects.inv[i] = { x, y, w: INV_SW, h: INV_SH };
    drawItemSlot(player.items[i], x, y, INV_SW, INV_SH, i, { key: String(i + 1) });
  }
  // ruksak: 3 manja mjesta ispod (predmeti ovdje ne djeluju)
  const bw = 30, bh = 22, by = y0 + 2 * (INV_SH + INV_G) + 2;
  for(let k = 0; k < BACKPACK_SLOTS; k++){
    const x = x0 + k * (bw + INV_G);
    uiRects.inv[N + k] = { x, y: by, w: bw, h: bh };
    drawItemSlot(bp[k], x, by, bw, bh, N + k, { dim: true });
  }
  ctx.font = fontTxt(8.5, true); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#8b93a1';
  if(!bp.length) ctx.fillText(L('ruksak', 'backpack'), x0 + 3, by + bh / 2);
  // 🌰 neutralni predmet: okruglo mjesto desno od ruksaka
  const nr = 12, ncx = x0 + 3 * (bw + INV_G) + nr + 6, ncy = by + bh / 2;
  uiRects.neutral = { x: ncx - nr, y: ncy - nr, w: nr * 2, h: nr * 2 };
  const hovN = hoverUi && hoverUi.type === 'neut';
  ctx.fillStyle = hovN ? '#365314' : '#1a2e05';
  ctx.strokeStyle = player.neutral ? '#bef264' : '#3f6212'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ncx, ncy, nr, 0, TAU); ctx.fill(); ctx.stroke();
  if(player.neutral){
    ctx.save(); ctx.beginPath(); ctx.arc(ncx, ncy, nr - 1, 0, TAU); ctx.clip();
    ctx.drawImage(itemIconCanvas(player.neutral), ncx - nr * 1.4, ncy - nr, nr * 2.8, nr * 2);
    ctx.restore();
  } else {
    ctx.globalAlpha = 0.35; ctx.font = fontEmoji(11); ctx.textAlign = 'center'; ctx.fillText('🌰', ncx, ncy + 1); ctx.globalAlpha = 1;
  }
  // predmet koji se povlači prati miš
  if(invDrag && invDrag.moved){
    const it = invItemAt(player, invDrag.from);
    if(it){ ctx.globalAlpha = 0.85; ctx.drawImage(itemIconCanvas(it), mouse.sx - INV_SW / 2, mouse.sy - INV_SH / 2, INV_SW, INV_SH); ctx.globalAlpha = 1; }
  }
}
/* 📌 brza kupnja: iznad naredbene kartice — što još fali za prikvačeni predmet */
/* 💰 v0.56 jasan prikaz zlata (kao u DotA 2 uz dućan): velika zlatna ploča iznad torbe — zlato koje imaš, zlato u minuti
   i "+N" koji iskoči kad zaradiš; broj se kratko "odbrojava" prema novom iznosu, a crveno trepne kad potrošiš. Klik = dućan. */
const goldHud = { shown: null, last: null, earned: 0, pops: [], flash: 0, spend: 0 };
function drawGoldBox(HL){
  const g = Math.floor(player.gold);
  if(goldHud.last == null || gameTime < -25){ goldHud.last = g; goldHud.shown = g; }
  const d = g - goldHud.last;
  if(d > 0){ if(gameTime > 0) goldHud.earned += d; if(d >= 5){ goldHud.pops.push({ n: d, t: 0 }); goldHud.flash = 1; } }
  else if(d <= -5) goldHud.spend = 1;
  goldHud.last = g;
  goldHud.shown += (g - goldHud.shown) * Math.min(1, frameDt * 9);
  if(Math.abs(g - goldHud.shown) < 1) goldHud.shown = g;
  goldHud.flash = Math.max(0, goldHud.flash - frameDt * 2.5); goldHud.spend = Math.max(0, goldHud.spend - frameDt * 3);
  const w = 158, h = 40, x = HL.px + HL.pw - w, y = HL.py - h - 6;
  uiRects.gold = { x, y, w, h };
  drawFrame(x, y, w, h, 8);
  if(goldHud.flash > 0){ ctx.save(); ctx.globalAlpha = goldHud.flash * 0.5; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.restore(); }
  ctx.font = fontEmoji(24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🪙', x + 22, y + h / 2 + 1);
  ctx.font = fontTxt(22, true); ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3;
  const txt = String(Math.round(goldHud.shown));
  ctx.strokeText(txt, x + 40, y + h / 2 + 1);
  ctx.fillStyle = goldHud.spend > 0 ? '#fca5a5' : '#fde047';
  ctx.fillText(txt, x + 40, y + h / 2 + 1);
  const gpm = gameTime > 30 ? Math.round(goldHud.earned / (gameTime / 60)) : 0;
  ctx.font = fontTxt(10, true); ctx.textAlign = 'right'; ctx.fillStyle = '#d6b37a';
  ctx.fillText(L('zlato', 'gold'), x + w - 8, y + 12);
  ctx.fillStyle = '#86efac';
  ctx.fillText(gpm ? '+' + gpm + L('/min', '/min') : '', x + w - 8, y + h - 11);
  for(let i = goldHud.pops.length - 1; i >= 0; i--){   // "+N" iskoči iznad ploče
    const p = goldHud.pops[i];
    p.t += frameDt;
    if(p.t > 1.3){ goldHud.pops.splice(i, 1); continue; }
    const k = p.t / 1.3;
    ctx.globalAlpha = 1 - k * k;
    ctx.font = fontTxt(16 + Math.min(8, p.n / 40), true); ctx.textAlign = 'center';
    ctx.strokeText('+' + p.n, x + 70 + (i % 3) * 18, y - 4 - k * 30);
    ctx.fillStyle = '#fde047'; ctx.fillText('+' + p.n, x + 70 + (i % 3) * 18, y - 4 - k * 30);
    ctx.globalAlpha = 1;
  }
}
function drawQuickBuy(HL){
  uiRects.qb = [];
  const list = quickBuyNext(player);
  if(!list || !list.length) return;
  const w = 40, h = 29, g = 4, n = Math.min(list.length, 6);
  const x0 = HL.cardX + HL.cardW - n * (w + g) - 6, y0 = HL.cardY - h - 36;
  ctx.font = fontTxt(10, true); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
  ctx.strokeText(L('📌 Brza kupnja', '📌 Quick buy'), x0 - 6, y0 + h); ctx.fillStyle = '#fde68a'; ctx.fillText(L('📌 Brza kupnja', '📌 Quick buy'), x0 - 6, y0 + h);
  const start = list.length - n;
  for(let k = 0; k < n; k++){
    const it = list[start + k], x = x0 + k * (w + g), last = start + k === list.length - 1;
    const cost = planPurchase(player, it).cost;
    const can = player.gold >= cost;
    uiRects.qb.push({ x, y: y0, w, h, id: it.id });
    ctx.globalAlpha = can ? 1 : 0.55;
    ctx.drawImage(itemIconCanvas(it), x, y0, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = last ? '#fbbf24' : (can ? '#4ade80' : '#475569'); ctx.lineWidth = last ? 2 : 1.4;
    ctx.strokeRect(x + 0.5, y0 + 0.5, w - 1, h - 1);
    if(can && !last && Math.sin(gameTime * 6) > 0){ ctx.strokeStyle = 'rgba(74,222,128,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(x - 1, y0 - 1, w + 2, h + 2); }
    ctx.font = fontTxt(9.5, true); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2.5;
    ctx.strokeText(Math.ceil(cost), x + w / 2, y0 + h + 1); ctx.fillStyle = can ? '#fde047' : '#f87171'; ctx.fillText(Math.ceil(cost), x + w / 2, y0 + h + 1);
  }
}   // mjesto u torbi (omjer slike predmeta kao u DotA)
function hudLayout(){
  const ms = VW < 1000 ? 140 : 170;
  const as = 52, gap = 6, cardW = 5 * as + 4 * gap + 24, cardH = 2 * as + gap + 24;   // 5. stupac: čarolije prizivača D / F
  const cardX = VW - cardW - 10, cardY = VH - cardH - 10;
  const left = 14 + ms + 22, right = cardX - 10;
  const pw = Math.min(482, Math.max(420, right - left)), ph = 124;
  const px = left + Math.max(0, (right - left - pw) / 2), py = VH - ph - 10;
  const invW = 3 * INV_SW + 2 * INV_G;   // torba 3×2 (kao u DotA) + ruksak ispod
  return { ms, mx: 21, my: VH - ms - 21, as, gap, cardX, cardY, cardW, cardH, pw, ph, px, py, invX: px + pw - invW - 12, invW };
}
/* 🏛️ okvir u stilu Allstarsa: tamna ploča, dvostruki rub i zakovice
   (Sentinel = tamno drvo i zlato, Scourge = tamni kamen i kost s ljubičastim) */
function hudTheme(){
  return myTeam === TEAM_RED
    ? { a: '#2a2133', b: '#0f0a15', rim: '#d6cbb0', rim2: '#5b4a6b', gem: '#c084fc' }
    : { a: '#28331f', b: '#0d130a', rim: '#e9bf62', rim2: '#7a5a22', gem: '#4ade80' };
}
function drawFrame(x, y, w, h, r, alpha){
  const th = hudTheme();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, th.a); g.addColorStop(1, th.b);
  ctx.save();
  ctx.globalAlpha = alpha == null ? 0.94 : alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = th.rim2; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
  ctx.strokeStyle = th.rim; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(2, r - 1)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4)); ctx.stroke();
  for(const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]){   // zakovice
    ctx.fillStyle = th.rim;
    ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx - 4, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.gem;
    ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ----- velika najava (traka) — kad je igrač mrtav, crta se tek preko tamnog sloja ----- */
function drawBanner(){
  if(!banner) return;
  const f = banner.t < 0.25 ? banner.t / 0.25 : (banner.t > banner.dur ? 1 - (banner.t - banner.dur) / 0.4 : 1);
  ctx.globalAlpha = clamp(f, 0, 1);
  ctx.textAlign = 'center';
  const kind = bannerKind(banner), art = BANNER_ART[kind], bim = artImg('assets/ui/banner_' + kind + '.webp');
  if(bim){   // 🎀 v0.56: naslov i podnaslov na naslikanoj traci (plava vijest, zlatna dobra, crvena loša)
    const k = clamp(Math.min(VH / 720, VW / 900), 0.6, 1);
    let fs = 32 * k, ss = 15 * k;
    ctx.font = fontTxt(fs, true);
    const tw = ctx.measureText(banner.txt).width;
    ctx.font = fontTxt(ss, true);
    const sw = banner.sub ? ctx.measureText(banner.sub).width : 0;
    const maxW = VW * 0.96;
    let bw = Math.max(440 * k, Math.max(tw, sw) / art.tw);
    if(bw > maxW){ fs *= maxW / bw; ss *= maxW / bw; bw = maxW; }   // predug tekst: manja slova
    const pop = banner.t < 0.25 ? 0.82 + 0.18 * Math.sin(banner.t / 0.25 * Math.PI / 2) : 1;   // traka "iskoči"
    const bh = bw * bim.naturalHeight / bim.naturalWidth;
    const top = VH < 520 ? 70   // 📱 nizak zaslon: nema mjesta ispod okvira — traka je gore (ploče se crtaju preko nje)
      : player && !player.dead && pendingTalent(player) ? TAL_PANEL_Y + TAL_PANEL_H + 6   // ne preko ploče talenata,
      : gameTime < 0 && !gameOver && !shopOpen ? 148 : 70;                                // okvira pripreme ni gornje trake
    const cy = Math.max(VH * 0.24, top + bh * art.cy);
    ctx.save();
    ctx.translate(VW / 2, cy);
    ctx.scale(pop, pop);
    ctx.drawImage(bim, -bw / 2, -bh * art.cy, bw, bh);
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const ty = banner.sub ? -ss * 0.72 : 0;
    ctx.font = fontTxt(Math.round(fs), true);
    ctx.strokeStyle = art.stroke; ctx.lineWidth = Math.max(3, fs * 0.17);
    ctx.strokeText(banner.txt, 0, ty);
    ctx.fillStyle = art.title;
    ctx.fillText(banner.txt, 0, ty);
    if(banner.sub){
      ctx.font = fontTxt(Math.round(ss), true);
      ctx.lineWidth = Math.max(2.5, ss * 0.22);
      ctx.strokeText(banner.sub, 0, ty + fs * 0.5 + ss * 0.85);
      ctx.fillStyle = art.sub;
      ctx.fillText(banner.sub, 0, ty + fs * 0.5 + ss * 0.85);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  } else {   // traka se još učitava: samo tekst
    ctx.font = fontTxt(34, true);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 6;
    ctx.strokeText(banner.txt, VW / 2, VH * 0.26);
    ctx.fillStyle = '#fde047';
    ctx.fillText(banner.txt, VW / 2, VH * 0.26);
    if(banner.sub){
      ctx.font = fontTxt(17, true);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 4;
      ctx.strokeText(banner.sub, VW / 2, VH * 0.26 + 34);
      ctx.fillStyle = '#fff';
      ctx.fillText(banner.sub, VW / 2, VH * 0.26 + 34);
    }
    ctx.globalAlpha = 1;
  }
}
function drawHud(){
  // ----- gornja ploča -----
  const tw = 280, tx = (VW - tw) / 2;
  drawFrame(tx, 8, tw, 64, 10);
  ctx.font = fontTxt(22, true);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = TEAM_LIGHT[0];
  ctx.fillText(kills[0], tx + 60, 30);
  ctx.fillStyle = '#fff';
  ctx.fillText('⚔️', tx + tw / 2, 30);
  ctx.fillStyle = TEAM_LIGHT[1];
  ctx.fillText(kills[1], tx + tw - 60, 30);
  const gtA = gameTime < 0 ? Math.ceil(-gameTime) : Math.floor(gameTime), mm = Math.floor(gtA / 60), ss = gtA % 60;
  ctx.font = fontTxt(13, true);
  ctx.fillStyle = gameTime < 0 ? '#fde047' : '#cbd5e1';
  ctx.fillText((isNight ? '🌙 ' : '☀️ ') + (gameTime < 0 ? '-' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss, tx + tw / 2, 50);
  if(ancients[0]) drawBar(tx + 14, 56, 100, 8, ancients[0].hp / ancients[0].maxhp, TEAM_COLOR[0]);
  if(ancients[1]) drawBar(tx + tw - 114, 56, 100, 8, ancients[1].hp / ancients[1].maxhp, TEAM_COLOR[1]);
  ctx.font = fontEmoji(11);
  ctx.fillText('👑', tx + 8, 60);
  ctx.fillText('👑', tx + tw - 6, 60);
  if(gameMode() === 'turbo'){   // ⚡ brza igra: mala oznaka ispod sata
    const lbl = L('⚡ BRZA IGRA', '⚡ QUICK GAME');
    ctx.font = fontTxt(11, true);
    const lw = ctx.measureText(lbl).width + 16;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath(); ctx.roundRect(tx + tw / 2 - lw / 2, 73, lw, 17, 8); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(lbl, tx + tw / 2, 82);
  }

  // ----- kill feed -----
  ctx.textAlign = 'left';
  const feedMine = feed.filter(f => f.team == null || f.team < 0 || f.team === myTeam).slice(0, 6);   // poruke za tim vidi samo taj tim
  for(let i = 0; i < feedMine.length; i++){
    const f = feedMine[i];
    ctx.globalAlpha = f.t > 6 ? 1 - (f.t - 6) : 1;
    ctx.font = fontTxt(14, true);
    const y = 90 + i * 24;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.txt, 12, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, 12, y);
    ctx.globalAlpha = 1;
  }

  // ----- ⏳ priprema: odbrojavanje do roga i gumb "kreni odmah" (igra protiv botova) -----
  uiRects.prepSkip = null;
  syncShopPrep();
  if(gameTime < 0 && !gameOver && !shopOpen){   // dok je dućan otvoren, odbrojavanje i gumb su u dućanu
    const left = Math.ceil(-gameTime), solo = net.mode !== 'host' && net.mode !== 'guest';
    const bw = 340, bh = 62, bx = (VW - bw) / 2 - (solo ? 62 : 0), by = 80;
    drawFrame(bx, by, bw, bh, 10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = fontTxt(16, true); ctx.fillStyle = '#fde047';
    ctx.fillText(L('🛒 PRIPREMA — kupi predmete!', '🛒 PREPARATION — buy items!'), bx + bw / 2, by + 18);
    ctx.font = fontTxt(13, true); ctx.fillStyle = left <= 5 ? '#fca5a5' : '#e5e7eb';
    ctx.fillText(L('⚔️ Vojnici kreću za ' + left + ' s', '⚔️ Creeps march in ' + left + ' s'), bx + bw / 2, by + 38);
    drawBar(bx + 20, by + bh - 12, bw - 40, 6, clamp(1 + gameTime / CFG.prepTime, 0, 1), '#fde047');
    if(solo){
      const txt = L('▶️ Kreni odmah', '▶️ Start now');
      ctx.font = fontTxt(14, true);
      const r = { x: bx + bw + 10, y: by + 12, w: Math.max(114, ctx.measureText(txt).width + 20), h: 38 };   // širina po tekstu (ćirilica je šira)
      const hov = hoverUi && hoverUi.type === 'prep';
      ctx.fillStyle = hov ? '#16a34a' : '#15803d';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 9); ctx.fill();
      ctx.strokeStyle = '#86efac'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2 + 1);
      uiRects.prepSkip = r;
    }
  }

  // ----- velika najava -----
  if(!(player && player.dead && !gameOver)) drawBanner();   // mrtav: crta se iznad tamnog sloja (niže)

  // ----- donja ploča igrača -----
  uiRects.learn = [];
  uiRects.inv = [];
  if(player){
    // raspored kao u Warcraftu 3: minimapa dolje lijevo, ploča junaka u sredini (portret, trake, torba 2×3), moći dolje desno
    const HL = hudLayout();
    const pw = HL.pw, ph = HL.ph, px = HL.px, py = HL.py;
    drawFrame(px, py, pw, ph, 10);
    if(player.dead){ ctx.fillStyle = 'rgba(30,30,40,0.35)'; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.fill(); }

    // portret (AI slika junaka, emoji kao rezerva)
    ctx.fillStyle = player.dead ? '#475569' : TEAM_LIGHT[0];
    ctx.beginPath(); ctx.arc(px + 52, py + ph / 2, 36, 0, TAU); ctx.fill();
    ctx.globalAlpha = player.dead ? 0.5 : 1;
    const pim = GFX.heroes[player.hero.id];
    if(imgReady(pim)){
      ctx.save();
      ctx.beginPath(); ctx.arc(px + 52, py + ph / 2, 34, 0, TAU); ctx.clip();
      ctx.drawImage(pim, px + 18, py + ph / 2 - 34, 68, 68);
      ctx.restore();
      ctx.strokeStyle = player.dead ? '#64748b' : '#fde047';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px + 52, py + ph / 2, 35, 0, TAU); ctx.stroke();
    } else {
      ctx.font = fontEmoji(42);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(player.emoji, px + 52, py + ph / 2 - 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(px + 78, py + ph / 2 + 24, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = fontTxt(13, true);
    ctx.fillText(player.level, px + 78, py + ph / 2 + 25);
    uiRects.passive = null;
    if(player.hero.passive){   // ✨ urođena pasiva: okrugla značka gore desno na portretu
      const pv = player.hero.passive, cx = px + 82, cy = py + ph / 2 - 26;
      uiRects.passive = { x: cx - 14, y: cy - 14, w: 28, h: 28 };
      const hov = hoverUi && hoverUi.type === 'pas';
      ctx.fillStyle = hov ? '#065f46' : '#064e3b';
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.stroke();
      const pim = spellIconImg(player.hero.id, 'P');
      if(pim){ ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 12.5, 0, TAU); ctx.clip(); ctx.drawImage(pim, cx - 12.5, cy - 12.5, 25, 25); ctx.restore(); }
      else {
        ctx.font = fontEmoji(15);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pv.emoji, cx, cy + 1);
      }
      const ir = innateRank(player);
      for(let k = 0; k < 4; k++){   // točkice ranga ispod značke
        ctx.fillStyle = k < ir ? '#34d399' : '#334155';
        ctx.beginPath(); ctx.arc(cx - 9 + k * 6, cy + 18, 2, 0, TAU); ctx.fill();
      }
    }
    if(player.aegis){   // 🛡️ Zmajev štit
      ctx.font = fontEmoji(18);
      ctx.fillText('🛡️', px + 24, py + ph / 2 - 26);
      ctx.font = fontTxt(9, true);
      ctx.fillStyle = '#fde047';
      ctx.fillText(Math.ceil(player.aegisT / 60) + 'min', px + 24, py + ph / 2 - 12);
    }

    // trake
    const bx = px + 104, bw = Math.min(210, HL.invX - 14 - bx);
    ctx.font = fontTxt(14, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(player.name + ' ⭐ ', bx, py + 16);
    const nameW = ctx.measureText(player.name + ' ⭐ ').width;
    ctx.font = fontTxt(11, true);   // 💰 v0.56: zlato je u svojoj velikoj ploči iznad torbe (drawGoldBox)
    ctx.fillStyle = '#cbd5e1';
    const kdaTxt = '⚔️' + player.kills + ' 💀' + player.deaths + ' 🤝' + player.assists, kdaX = Math.max(bx + 86, bx + nameW + 4);
    if(kdaX + ctx.measureText(kdaTxt).width + 6 <= bx + bw) ctx.fillText(kdaTxt, kdaX, py + 16);
    drawBar(bx, py + 26, bw, 16, player.hp / player.maxhp, '#22c55e');
    drawBar(bx, py + 44, bw, 10, player.maxmp ? player.mp / player.maxmp : 0, '#38bdf8');
    drawBar(bx, py + 56, bw, 5, player.xp / xpNeed(player.level), '#fde047');
    ctx.font = fontTxt(11, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.ceil(player.hp) + ' / ' + player.maxhp, bx + bw / 2, py + 34);

    // ATRIBUTI (glavni je zlatan) + STATISTIKE UŽIVO
    {
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const put = (txt, color, sy3) => {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(txt, putX, sy3);
        ctx.fillStyle = color;
        ctx.fillText(txt, putX, sy3);
        putX += ctx.measureText(txt).width + 9;
      };
      // red 1: 💪 snaga / 🤸 okretnost / 🧠 inteligencija
      ctx.font = fontTxt(11.5, true);
      let putX = bx;
      const prim = player.hero.attrs.primary;
      const ia = player.itemAttr || { str: 0, agi: 0, int: 0 };
      for(const [k, ic] of [['str', '💪'], ['agi', '🤸'], ['int', '🧠']]){   // kao u DotA: ukupno, a bonus s predmeta zeleno
        put(ic + ' ' + Math.round(player[k] + ia[k]), prim === k ? '#fde047' : '#cbd5e1', py + 70);
        if(ia[k]){ putX -= 7; put('+' + Math.round(ia[k]), '#4ade80', py + 70); }
      }
      // red 2: šteta (s bonusom od predmeta), brzina, obnove
      putX = bx;
      const mul = player.status.dmgMulT > 0 ? player.status.dmgMulF : 1;
      put('⚔️ ' + Math.round(player.dmg * mul) + (player.itemBonus.dmg ? ' (+' + player.itemBonus.dmg + ')' : ''),
        mul > 1 ? '#fb923c' : '#fbbf24', py + 84);
      put('🛡️ ' + unitArmor(player).toFixed(1), '#cbd5e1', py + 84);
      put('🏃 ' + Math.round(unitSpeed(player)), '#a7f3d0', py + 84);
      // red 3: iskustvo + obnove (u redu 2 ne stanu uz torbu)
      putX = bx;
      ctx.font = fontTxt(10.5, true);
      put(player.level >= CFG.maxLevel ? '⭐ Max!' : '⭐ ' + Math.floor(player.xp) + '/' + xpNeed(player.level), '#fde68a', py + 101);
      const wd = drakeN(player.team, 'water');   // 💧 vodeni zmajčići se vide u obnovi
      put('♥ +' + (player.hpRegen + 3 * wd).toFixed(1) + '/' + U_SEC, '#4ade80', py + 101);
      put('💧 +' + (player.mpRegen + 1.5 * wd).toFixed(1) + '/' + U_SEC, '#7dd3fc', py + 101);
    }

    // 🎒 torba 3×2 + ruksak 3 (kao u DotA): slika predmeta, hlađenje, punjenja, tipka; povuci = premjesti, desni klik = prodaj
    drawInventory(HL, py, ph);
    drawBuffBar(HL);
    drawGoldBox(HL);   // 💰 v0.56
    drawQuickBuy(HL);

    // moći (Q W E R) + atributi (📊) + teleport (T)
    uiRects.abil = [];
    const as = HL.as, gap = HL.gap;
    drawFrame(HL.cardX, HL.cardY, HL.cardW, HL.cardH, 10);   // naredbena kartica (Warcraft 3)
    const ax0 = HL.cardX + 12, ay = HL.cardY + 12, ay2 = ay + as + gap;
    if(pendingCast || amovePending){
      ctx.font = fontTxt(13, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = amovePending && !pendingCast ? '#fca5a5' : '#fde047';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      const txt = !pendingCast ? L('⚔️ A: klik na vojnika = JEDAN udarac (zadnji udarac) • klik na tlo = napad u hodu • S = stani', '⚔️ A: click a creep = ONE hit (last hit) • click the ground = attack-move • S = stop') :
        pendingCast.tp ? L('🌀 Klikni svoju kulu ili minimapu • T = kući • desni klik = odustani', '🌀 Click your tower or the minimap • T = home • right-click = cancel') :
        (pendingCast.quick && pendingCast.key ? L('⚡ Pusti tipku za bacanje • desni klik = odustani', '⚡ Release the key to cast • right-click = cancel') :
          (touchMode ? L('🎯 Dodirni cilj', '🎯 Tap a target') : L('🎯 Klikni cilj (ili junaka) • desni klik = odustani', '🎯 Click a target (or a hero) • right-click = cancel')));
      const tw = ctx.measureText(txt).width;   // ne izlazi preko ruba ekrana
      const tx = Math.min(ax0 + (5 * (as + gap) - gap) / 2, VW - 8 - tw / 2);
      ctx.strokeText(txt, tx, ay - 4);
      ctx.fillText(txt, tx, ay - 4);
    }
    else if(player.skillPoints > 0 && !player.dead){
      ctx.font = fontTxt(13, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#4ade80';
      const bob = Math.sin(gameTime * 5) * 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      const txt = L('⬆️ Poen vještine! Klikni +', '⬆️ Skill point! Click +');
      ctx.strokeText(txt, ax0 + (5 * (as + gap) - gap) / 2, ay - 4 + bob);
      ctx.fillText(txt, ax0 + (5 * (as + gap) - gap) / 2, ay - 4 + bob);
    }
    for(let i = 0; i < 4; i++){
      const ab = player.abilities[i];
      if(!ab) continue;
      const ax = ax0 + i * (as + gap);
      uiRects.abil.push({ x: ax, y: ay, w: as, h: as });
      const mxR = abilityMaxRank(ab);
      const unlearned = ab.rank === 0;
      const ultLocked = ab.def.ult && unlearned && player.level < CFG.ultLevels[0];
      const noMana = player.mp < abMana(player, ab);
      const canL = player.skillPoints > 0 && canLearn(player, i);
      const isPending = pendingCast && pendingCast.i === i;
      ctx.fillStyle = ab.def.ult ? '#3b2a4d' : '#1e293b';
      ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 6); ctx.fill();
      ctx.strokeStyle = isPending ? '#fde047' : (ab.def.ult ? '#c084fc' : (!unlearned && noMana ? '#38bdf8' : hudTheme().rim2));
      ctx.lineWidth = isPending ? 4 : 3;
      ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 6); ctx.stroke();
      ctx.strokeStyle = isPending ? '#fef9c3' : hudTheme().rim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(ax + 3, ay + 3, as - 6, as - 6, 4); ctx.stroke();
      ctx.font = fontEmoji(26);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = unlearned ? 0.3 : ((ab.cd > 0 || noMana) ? 0.45 : 1);
      const sim = spellIconImg(player.hero.id, ab.def.key);   // 🎨 v0.55: naslikana ikona moći
      if(sim){
        ctx.save(); ctx.beginPath(); ctx.roundRect(ax + 3, ay + 3, as - 6, as - 6, 4); ctx.clip();
        ctx.drawImage(sim, ax + 3, ay + 3, as - 6, as - 6);
        const sh = ctx.createLinearGradient(0, ay + as * 0.55, 0, ay + as);   // tamni rub dolje: točkice ranga i tipka se vide
        sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = sh; ctx.fillRect(ax, ay, as, as);
        ctx.restore();
      }
      else ctx.fillText(ab.def.emoji, ax + as / 2, ay + as / 2 - 6);
      ctx.globalAlpha = 1;
      if(ultLocked){
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 6); ctx.fill();
        ctx.font = fontEmoji(18);
        ctx.fillText('🔒', ax + as / 2, ay + as / 2 - 8);
        ctx.fillStyle = '#e9d5ff';
        ctx.font = fontTxt(10, true);
        ctx.fillText('Lvl ' + CFG.ultLevels[0], ax + as / 2, ay + as - 11);
      }
      else if(unlearned){
        const pulse = canL ? 1 + Math.sin(gameTime * 6) * 0.15 : 1;
        ctx.fillStyle = canL ? '#4ade80' : '#64748b';
        ctx.font = fontTxt(26 * pulse, true);
        ctx.fillText('+', ax + as / 2, ay + as / 2 + 2);
      }
      else {
        const stunned = player.status.stun > 0, silenced = player.status.silenceT > 0;
        if(!ab.def.passive && (stunned || silenced)){   // 💫 v0.56: omamljen / ušutkan — moć se sada ne može baciti
          ctx.fillStyle = stunned ? 'rgba(113,63,18,0.6)' : 'rgba(30,41,59,0.65)';
          ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 6); ctx.fill();
          ctx.font = fontEmoji(ab.cd > 0 ? 14 : 22);
          ctx.fillText(stunned ? '💫' : '🤐', ax + (ab.cd > 0 ? as - 12 : as / 2), ay + (ab.cd > 0 ? as - 14 : as / 2));
        }
        if(!ab.def.passive && ab.cd > 0){
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.moveTo(ax + as / 2, ay + as / 2);
          ctx.arc(ax + as / 2, ay + as / 2, as * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * (ab.cd / ab.def.cd));
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = fontTxt(17, true);
          ctx.fillText(Math.ceil(ab.cd), ax + as / 2, ay + as / 2);
        }
        if(ab.def.passive){
          ctx.fillStyle = '#a7f3d0';
          ctx.font = fontTxt(9, true);
          ctx.fillText(L('✨ pasiv', '✨ passive'), ax + as / 2 + 6, ay + 10);
        } else {
          ctx.fillStyle = '#7dd3fc';
          ctx.font = fontTxt(10, true);
          ctx.fillText(ab.def.mana, ax + as - 12, ay + 10);
        }
        for(let p = 0; p < mxR; p++){
          ctx.fillStyle = p < ab.rank ? '#fde047' : '#475569';
          ctx.beginPath();
          ctx.arc(ax + as / 2 - (mxR - 1) * 5 + p * 10, ay + as - 8, 3.2, 0, TAU);
          ctx.fill();
        }
        if(canL){
          const br = { x: ax + as - 18, y: ay + as - 20, w: 20, h: 20, i };
          uiRects.learn.push(br);
          const pulse = 1 + Math.sin(gameTime * 6) * 0.1;
          ctx.fillStyle = '#16a34a';
          ctx.beginPath(); ctx.arc(br.x + 10, br.y + 10, 9 * pulse, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(br.x + 10, br.y + 10, 9 * pulse, 0, TAU); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = fontTxt(14, true);
          ctx.fillText('+', br.x + 10, br.y + 10.5);
        }
      }
      ctx.fillStyle = ab.def.ult ? '#c084fc' : '#fde047';
      ctx.font = fontTxt(12, true);
      ctx.fillText(ab.def.key, ax + 10, ay + 10);
    }

    // ATRIBUTI gumb (📊 = +2 sve, kao DotA "Attribute Bonus")
    {
      const sb = { x: ax0, y: ay2, w: as, h: as };
      uiRects.statBtn = sb;
      const canS = player.skillPoints > 0 && canLearnStats(player);
      ctx.fillStyle = '#1e3a2f';
      ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 6); ctx.fill();
      ctx.strokeStyle = canS ? '#4ade80' : hudTheme().rim2;
      ctx.lineWidth = canS ? 3 : 2.5;
      ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 6); ctx.stroke();
      ctx.font = fontEmoji(17);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = player.statRanks >= CFG.statMaxRanks ? 0.45 : 1;
      ctx.fillText('📊', sb.x + sb.w / 2, sb.y + 16);
      ctx.globalAlpha = 1;
      if(canS){
        const pulse = 1 + Math.sin(gameTime * 6) * 0.15;
        ctx.fillStyle = '#4ade80';
        ctx.font = fontTxt(15 * pulse, true);
        ctx.fillText('+', sb.x + sb.w / 2, sb.y + 32);
      }
      ctx.fillStyle = '#a7f3d0';
      ctx.font = fontTxt(9.5, true);
      ctx.fillText(player.statRanks + '/' + CFG.statMaxRanks, sb.x + sb.w / 2, sb.y + as - 8);
    }

    // teleport kući (T)
    {
      const tr = { x: ax0 + (as + gap), y: ay2, w: as, h: as };
      uiRects.tp = tr;
      const channeling = player.tpChannel > 0;
      ctx.fillStyle = channeling ? '#1e3a5f' : '#16243a';
      ctx.beginPath(); ctx.roundRect(tr.x, tr.y, tr.w, tr.h, 6); ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = channeling ? 3.5 : 2.5;
      ctx.beginPath(); ctx.roundRect(tr.x, tr.y, tr.w, tr.h, 6); ctx.stroke();
      ctx.font = fontEmoji(20);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = player.tpCd > 0 && !channeling ? 0.4 : 1;
      ctx.fillText('🏠', tr.x + tr.w / 2, tr.y + tr.h / 2 - 3);
      ctx.globalAlpha = 1;
      if(channeling){
        drawBar(tr.x + 4, tr.y + tr.h - 9, tr.w - 8, 5, 1 - player.tpChannel / (player.tpDur || 3), '#60a5fa');
      }
      else if(player.tpCd > 0){
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.moveTo(tr.x + tr.w / 2, tr.y + tr.h / 2);
        ctx.arc(tr.x + tr.w / 2, tr.y + tr.h / 2, tr.w * 0.66, -Math.PI / 2, -Math.PI / 2 + TAU * (player.tpCd / 60));
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = fontTxt(13, true);
        ctx.fillText(Math.ceil(player.tpCd), tr.x + tr.w / 2, tr.y + tr.h / 2);
      }
      // 🛡️ Glif utvrde (F): kule i vojarne tima 5 s neranjive
      const gr = { x: ax0 + 2 * (as + gap), y: ay2, w: as, h: as };
      uiRects.glyph = gr;
      const gl = glyph[player.team];
      ctx.fillStyle = gl.t > 0 ? '#3f2a0a' : '#2a2214';
      ctx.beginPath(); ctx.roundRect(gr.x, gr.y, gr.w, gr.h, 6); ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = gl.t > 0 ? 3.5 : 2.5;
      ctx.beginPath(); ctx.roundRect(gr.x, gr.y, gr.w, gr.h, 6); ctx.stroke();
      ctx.font = fontEmoji(20);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = gl.cd > 0 && gl.t <= 0 ? 0.4 : 1;
      ctx.fillText('🛡️', gr.x + gr.w / 2, gr.y + gr.h / 2 - 3);
      ctx.globalAlpha = 1;
      if(gl.t > 0) drawBar(gr.x + 4, gr.y + gr.h - 9, gr.w - 8, 5, gl.t / CFG.glyphDur, '#fde047');
      else if(gl.cd > 0){
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.moveTo(gr.x + gr.w / 2, gr.y + gr.h / 2);
        ctx.arc(gr.x + gr.w / 2, gr.y + gr.h / 2, gr.w * 0.66, -Math.PI / 2, -Math.PI / 2 + TAU * (gl.cd / CFG.glyphCd));
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = fontTxt(12, true);
        ctx.fillText(Math.ceil(gl.cd), gr.x + gr.w / 2, gr.y + gr.h / 2);
      }
      ctx.fillStyle = '#fde047'; ctx.font = fontTxt(9, true);
      ctx.fillText('Y', gr.x + gr.w - 7, gr.y + 8);
      ctx.fillStyle = '#93c5fd';
      ctx.font = fontTxt(10, true);
      ctx.fillText('T', tr.x + 8, tr.y + 9);
    }

    // ✨ čarolije prizivača (LoL): D gore, F dolje u petom stupcu
    uiRects.sum = [];
    for(let k = 0; k < 2; k++) drawSummonerBtn(k, ax0 + 4 * (as + gap), k ? ay2 : ay, as);

    // 🛒 dućan: zadnji gumb naredbene kartice; zvuk i pomoć gore desno
    uiRects.shop = { x: ax0 + 3 * (as + gap), y: ay2, w: as, h: as };
    {
      const r = uiRects.shop, hov = hoverUi && hoverUi.type === 'shop';
      ctx.fillStyle = shopOpen ? '#4a3510' : '#2a2214';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill();
      ctx.strokeStyle = hov || shopOpen ? '#fde047' : '#f59e0b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.stroke();
      ctx.font = fontEmoji(22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🛒', r.x + r.w / 2, r.y + r.h / 2 - 2);
      ctx.fillStyle = '#fde047'; ctx.font = fontTxt(9, true);
      ctx.fillText('B', r.x + r.w - 7, r.y + 8);
    }
    uiRects.mute = { x: VW - 92, y: 12, w: 38, h: 32 };
    uiRects.help = { x: VW - 48, y: 12, w: 38, h: 32 };
    uiRects.opts = { x: VW - 136, y: 12, w: 38, h: 32 };   // ⚙️ postavke
    uiRects.fs = { x: VW - 180, y: 12, w: 38, h: 32 };     // ⛶ cijeli zaslon
    const topBtns = [[muted ? '🔇' : '🔊', uiRects.mute], ['❓', uiRects.help], ['⚙️', uiRects.opts], [isFullscreen() ? '🗗' : '⛶', uiRects.fs, isFullscreen()]];
    uiRects.score = uiRects.center = null;
    if(touchMode){   // 👆 tablet: gumbi umjesto tipki Tab i razmaknice
      uiRects.score = { x: VW - 224, y: 12, w: 38, h: 32 };
      uiRects.center = { x: VW - 268, y: 12, w: 38, h: 32 };
      topBtns.push(['📋', uiRects.score, scoreOpen], ['🎯', uiRects.center, cam.follow]);
    }
    uiRects.dance = { x: VW - (touchMode ? 312 : 224), y: 12, w: 38, h: 32 };   // 💃 ples (J)
    topBtns.push(['💃', uiRects.dance, player.danceT > 0]);
    for(const [em, r, on] of topBtns){
      drawFrame(r.x, r.y, r.w, r.h, 7);
      if(on){ ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6); ctx.stroke(); }
      ctx.font = fontEmoji(16);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(em, r.x + r.w / 2, r.y + r.h / 2 + 1);
    }

    // opisi (moći, pasiva, atributi, glif…) su DOM opisi u stilu DotA: shop.js updateHudTip()

    // nišan dok ciljaš: pokazivač miša (CURSOR.aim, refreshPointer)

    // oživljavanje + otkup (buyback)
    // 🎓 talent: izbor jednog od dva bonusa (level 10 / 15)
    uiRects.talent = null;
    const ptal = !player.dead ? pendingTalent(player) : null;
    if(ptal){   // 🎨 v0.56: svaki izbor ima naslikanu ikonu (moć koju jača ili opći bonus) i tekst u dva retka
      const pw = Math.min(560, VW - 16), ph = TAL_PANEL_H, px0 = VW / 2 - pw / 2, py0 = TAL_PANEL_Y;
      ctx.fillStyle = 'rgba(30,27,75,0.94)';
      ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.fill();
      ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.stroke();
      ctx.font = fontTxt(13, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e9d5ff';
      ctx.fillText(L('🎓 Talent (level ' + ptal.lvl + ') — odaberi jedan bonus:', '🎓 Talent (level ' + ptal.lvl + ') — pick one bonus:'), px0 + pw / 2, py0 + 15);
      const bw = (pw - 40) / 2, bh = 64, by = py0 + 30;
      const ra = { x: px0 + 14, y: by, w: bw, h: bh }, rb = { x: px0 + pw - 14 - bw, y: by, w: bw, h: bh };
      uiRects.talent = { lvl: ptal.lvl, a: ra, b: rb };
      for(const [r, t] of [[ra, ptal.a], [rb, ptal.b]]){
        const hov = inRect(mouse.sx, mouse.sy, r);
        ctx.fillStyle = hov ? '#7c3aed' : '#4c1d95';
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 11); ctx.fill();
        ctx.strokeStyle = hov ? '#fde047' : '#a78bfa'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 11); ctx.stroke();
        const ic = bh - 12, ix = r.x + 6, iy = r.y + 6;
        const tim = artImg(talentIconSrc(player.hero.id, t));
        ctx.save();
        ctx.beginPath(); ctx.roundRect(ix, iy, ic, ic, 8); ctx.clip();
        if(tim) ctx.drawImage(tim, ix, iy, ic, ic);
        else { ctx.fillStyle = '#2e1065'; ctx.fillRect(ix, iy, ic, ic); ctx.fillStyle = '#fff'; ctx.font = fontTxt(26, true); ctx.fillText(t.emoji, ix + ic / 2, iy + ic / 2 + 1); }
        ctx.restore();
        ctx.strokeStyle = hov ? '#fde047' : '#fcd34d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(ix, iy, ic, ic, 8); ctx.stroke();
        const tx = ix + ic + 9, tw = r.x + r.w - 8 - tx;
        let fsz = 14, lines;
        do { ctx.font = fontTxt(fsz, true); lines = wrapLines(t.txt, tw); } while(lines.length > 2 && --fsz > 10);
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
        lines.forEach((ln, i) => ctx.fillText(ln, tx, r.y + r.h / 2 + (i - (lines.length - 1) / 2) * (fsz + 3)));
        ctx.textAlign = 'center';
      }
    }
    uiRects.buyback = null;
    if(player.dead && !gameOver){   // na kraju igre ne prekrivaj završni ekran
      ctx.fillStyle = 'rgba(15,23,42,0.45)';
      ctx.fillRect(0, 0, VW, VH);
      drawBanner();
      const rc = player.recap && player.recap.rows && player.recap.rows.length ? player.recap : null;
      const ty = rc ? VH * 0.26 + 72 : VH * 0.42;   // 💀 s pregledom pogibije sve malo više (ali ispod najave "Ne brini!")
      ctx.textAlign = 'center';
      ctx.font = fontTxt(36, true);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 6;
      ctx.strokeText(L('⏳ Oživljavaš za ' + Math.ceil(player.deadT) + 's', '⏳ Respawn in ' + Math.ceil(player.deadT) + 's'), VW / 2, ty);
      ctx.fillStyle = '#fff';
      ctx.fillText(L('⏳ Oživljavaš za ' + Math.ceil(player.deadT) + 's', '⏳ Respawn in ' + Math.ceil(player.deadT) + 's'), VW / 2, ty);
      if(!player.reviveAt){
        const cost = buybackCost(player);
        const can = player.buybackCd <= 0 && player.gold >= cost;
        const br = { x: VW / 2 - 155, y: ty + 30, w: 310, h: 44 };
        uiRects.buyback = br;
        ctx.fillStyle = can ? '#b45309' : '#334155';
        ctx.beginPath(); ctx.roundRect(br.x, br.y, br.w, br.h, 12); ctx.fill();
        ctx.strokeStyle = can ? '#fde047' : '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(br.x, br.y, br.w, br.h, 12); ctx.stroke();
        ctx.font = fontTxt(17, true);
        ctx.textBaseline = 'middle';
        ctx.fillStyle = can ? '#fff' : '#94a3b8';
        ctx.fillText(player.buybackCd > 0 ? L('⏱️ Otkup za ' + Math.ceil(player.buybackCd) + ' s', '⏱️ Buyback in ' + Math.ceil(player.buybackCd) + ' s') : L('💰 Otkup odmah (' + cost + ' zlata, tipka O)', '💰 Buy back now (' + cost + ' gold, key O)'), br.x + br.w / 2, br.y + br.h / 2);
      }
      if(rc) drawRecap(rc, ty + (player.reviveAt ? 34 : 92));
    }
  }
  // ----- minimapa -----
  const ML = hudLayout();
  drawMinimap(ML.ms, ML.mx, ML.my);
  if(keys['tab'] || scoreOpen) drawScoreboard();   // tablica preko minimape (na mobitelu se preklapaju)
}

/* 💀 pregled pogibije (kao u LoL-u): tko ti je nanio štetu u zadnjih 15 s, čime i koliko */
function drawRecap(rc, y0){
  const L = hudLayout();
  const rowH = 42, head = 48;
  const room = Math.floor((L.py - 46 - y0 - head - 8) / rowH);
  const n = Math.max(1, Math.min(rc.rows.length, room));
  let w = Math.min(470, VW - 40), x = (VW - w) / 2;
  if(room < 1){   // nizak ekran (mobitel): preko ploče junaka, ali između minimape i kartice moći (dućan i moći ostaju vidljivi)
    const left = 14 + L.ms + 22, right = L.cardX - 10;
    w = Math.min(w, right - left); x = left + (right - left - w) / 2;
  }
  const h = head + n * rowH + 8;
  drawFrame(x, y0, w, h, 12);
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = fontTxt(15, true); ctx.fillStyle = '#fecaca';
  ctx.fillText(EN ? '💀 Defeated by: ' + rc.killer : LS('💀 Ubio te: ' + rc.killer), x + 14, y0 + 17);   // (L je ovdje raspored HUD-a)
  ctx.font = fontTxt(11.5); ctx.fillStyle = '#cbd5e1';
  ctx.fillText(EN ? 'Damage in the last 15 seconds — total ' + rc.total : LS('Šteta u zadnjih 15 sekundi — ukupno ' + rc.total), x + 14, y0 + 35);
  const max = rc.rows[0].n || 1;
  for(let i = 0; i < n; i++){
    const r = rc.rows[i], ry = y0 + head + i * rowH, s = rowH - 8;
    const pim = r.hero && GFX.heroes[r.hero];
    if(imgReady(pim)) ctx.drawImage(pim, x + 12, ry + 4, s, s);
    else { ctx.font = fontEmoji(22); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(r.icon, x + 12 + s / 2, ry + rowH / 2); }
    const bx = x + 22 + s, bw = w - (22 + s) - 70;
    ctx.textAlign = 'left'; ctx.font = fontTxt(13, true); ctx.fillStyle = r.team >= 0 ? TEAM_LIGHT[r.team] : '#e5e7eb';
    ctx.fillText(r.name, bx, ry + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, ry + 18, bw, 6);
    ctx.fillStyle = r.team === TEAM_BLUE ? '#60a5fa' : r.team === TEAM_RED ? '#f87171' : '#fbbf24';
    ctx.fillRect(bx, ry + 18, Math.max(2, bw * r.n / max), 6);
    ctx.font = fontTxt(10.5); ctx.fillStyle = '#cbd5e1';
    ctx.fillText(r.parts.map(p => p[0] + ' ' + p[1]).join('  ·  '), bx, ry + 33);
    ctx.textAlign = 'right'; ctx.font = fontTxt(16, true); ctx.fillStyle = '#fff';
    ctx.fillText(String(r.n), x + w - 14, ry + rowH / 2);
  }
  ctx.restore();
}

/* ================= Tablica rezultata (Tab) ================= */
function drawScoreboard(){
  const heroes = units.filter(u => u.kind === 'hero');
  // na niskom ekranu (mobitel) redovi se stisnu da stane cijela tablica
  const rowH = clamp(Math.floor((VH - 76 - 64 - 48 - 14) / Math.max(1, heroes.length)), 22, 34);
  const w = Math.min(760, VW - 20), h = 64 + 2 * 24 + heroes.length * rowH + 14;
  const x = (VW - w) / 2, y = Math.max(Math.min(70, VH - h - 4), VH * 0.46 - h / 2);
  drawFrame(x, y, w, h, 12);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = fontTxt(18, true); ctx.fillStyle = '#f3d48a';
  ctx.fillText(scoreOpen ? L('📋 Tablica  (📋 zatvara)', '📋 Scoreboard  (📋 closes)') : L('📋 Tablica  (drži Tab)', '📋 Scoreboard  (hold Tab)'), x + w / 2, y + 22);
  const k = w / 760;   // stupci se skupljaju na uskom ekranu
  const C = { lvl: 200, kda: 268, lh: 352, nw: 430, items: 488 };
  for(const c in C) C[c] *= k;
  ctx.font = fontTxt(10.5, true); ctx.fillStyle = '#c9b27a';
  for(const [t, cx] of [['LVL', C.lvl], ['K / D / A', C.kda], ['LH / DN', C.lh], [L('NETO', 'NET'), C.nw]]) ctx.fillText(t, x + cx, y + 46);
  ctx.textAlign = 'left'; ctx.fillText(L('PREDMETI', 'ITEMS'), x + C.items, y + 46);
  let ry = y + 58;
  for(const team of [TEAM_BLUE, TEAM_RED]){
    ctx.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.28)' : 'rgba(239,68,68,0.28)';
    ctx.fillRect(x + 10, ry, w - 20, 22);
    ctx.font = fontTxt(12, true); ctx.textAlign = 'left'; ctx.fillStyle = team === TEAM_BLUE ? '#bfdbfe' : '#fecaca';
    ctx.fillText((team === TEAM_BLUE ? '🔵 ' + SIDE_NAME[0] : '🔴 ' + SIDE_NAME[1]) + '   ⚔️ ' + kills[team] +
      (teamDrakes[team].length ? '   🐉 ' + teamDrakes[team].map(k => DRAKES[k].emoji).join('') : ''), x + 18, ry + 11);
    ry += 24;
    for(const hh of heroes.filter(u => u.team === team).sort((a, b) => netWorth(b) - netWorth(a))){
      const cy = ry + rowH / 2;
      if(hh.isPlayer){ ctx.fillStyle = 'rgba(253,224,71,0.12)'; ctx.fillRect(x + 10, ry + 1, w - 20, rowH - 2); }
      const pim = GFX.heroes[hh.hero.id];
      if(imgReady(pim)){ ctx.save(); ctx.globalAlpha = hh.dead ? 0.4 : 1; ctx.drawImage(pim, x + 16, ry + 3, rowH - 6, rowH - 6); ctx.restore(); }
      else { ctx.font = fontEmoji(16); ctx.textAlign = 'center'; ctx.fillText(hh.emoji, x + 30, cy); }
      ctx.textAlign = 'left'; ctx.font = fontTxt(13, true); ctx.fillStyle = TEAM_LIGHT[hh.team];
      ctx.fillText(hh.name + (hh.dead ? ' 💀' : '') + (hh.aegis ? ' 🛡️' : '') + (hh.isPlayer ? L(' (TI)', ' (YOU)') : ''), x + 20 + rowH, cy);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText(hh.level, x + C.lvl, cy);
      ctx.fillText(hh.kills + ' / ' + hh.deaths + ' / ' + hh.assists, x + C.kda, cy);
      ctx.fillStyle = '#cbd5e1'; ctx.fillText((hh.lastHits || 0) + ' / ' + (hh.denies || 0), x + C.lh, cy);
      ctx.fillStyle = '#fde047'; ctx.fillText(netWorth(hh), x + C.nw, cy);
      const iw = Math.min(Math.round(34 * Math.min(1, k + 0.15)), Math.round((rowH - 4) / 0.73)), ih = Math.round(iw * 0.73);   // i niži redovi na mobitelu
      for(let i = 0; i < CFG.inventorySlots; i++){
        const ix = x + C.items + i * (iw + 3), iy = cy - ih / 2, it = hh.items[i];
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(ix, iy, iw, ih);
        if(it && ITEM_BY_ID[it.id]) ctx.drawImage(itemIconCanvas(ITEM_BY_ID[it.id]), ix, iy, iw, ih);
      }
      if(hh.neutral){
        const nx = x + C.items + 6 * (iw + 3) + 4 + ih / 2;
        ctx.save(); ctx.beginPath(); ctx.arc(nx, cy, ih / 2, 0, TAU); ctx.clip();
        ctx.drawImage(itemIconCanvas(hh.neutral), nx - ih * 0.7, cy - ih / 2, ih * 1.4, ih); ctx.restore();
      }
      ry += rowH;
    }
  }
}

function drawMinimap(ms, mx, my){
  uiRects.mini = { x: mx, y: my, w: ms, h: ms };
  const sc = ms / WORLD;
  drawFrame(mx - 7, my - 7, ms + 14, ms + 14, 10, 1);
  if(terrainCanvas){   // pravi teren (rijeka, staze, Scourge strana) umanjen na minimapu
    ctx.save();
    ctx.beginPath(); ctx.roundRect(mx, my, ms, ms, 6); ctx.clip();
    ctx.drawImage(terrainCanvas, mx, my, ms, ms);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(126,200,80,0.95)';
    ctx.beginPath(); ctx.roundRect(mx, my, ms, ms, 6); ctx.fill();
  }
  for(const u of units){
    if(u.dead || u.removeMe) continue;
    if(!seenByPlayer(u)) continue;   // magla rata i na minimapi
    const ux = mx + u.x * sc, uy = my + u.y * sc;
    if(u.kind === 'tower'){
      ctx.fillStyle = TEAM_COLOR[u.team];
      ctx.fillRect(ux - 3.5, uy - 3.5, 7, 7);
    } else if(u.kind === 'barracks'){
      ctx.strokeStyle = TEAM_COLOR[u.team];
      ctx.lineWidth = 2;
      ctx.strokeRect(ux - 3.5, uy - 3.5, 7, 7);
    } else if(u.kind === 'ancient'){
      ctx.font = fontEmoji(13);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('👑', ux, uy);
    } else if(u.kind === 'creep'){
      ctx.fillStyle = TEAM_COLOR[u.team];
      ctx.beginPath(); ctx.arc(ux, uy, 2, 0, TAU); ctx.fill();
    } else if(u.kind === 'neutral'){
      if(u.boss){
        ctx.font = fontEmoji(11);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🐲', ux, uy);
      } else if(u.drake){   // 🐉 zmajčić: krug u boji elementa
        ctx.fillStyle = DRAKES[u.drake].color;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ux, uy, 6, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.font = fontEmoji(8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🐉', ux, uy + 0.5);
      } else if(u.buff){   // 🔵🔴 čudovište s buffom: veća točka u boji buffa
        ctx.fillStyle = JUNGLE_BUFFS[u.buff].color;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ux, uy, 3.6, 0, TAU); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(ux, uy, 2.2, 0, TAU); ctx.fill();
      }
    }
  }
  // magla rata preko minimape
  if(fogCanvas){
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mx, my, ms, ms, 10);
    ctx.clip();
    ctx.drawImage(fogCanvas, mx, my, ms, ms);
    ctx.restore();
  }
  if(runes.length){
    ctx.font = fontEmoji(13);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⭐', mx + runes[0].x * sc, my + runes[0].y * sc);
  }
  // 🦁 junaci: okrugli portreti u prstenu boje tima (ti: zlatni prsten, uvijek na vrhu), iznad magle
  const heroDots = units.filter(u => u.kind === 'hero' && !u.dead && !u.removeMe && seenByPlayer(u)).sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  const pr = Math.max(6, Math.round(ms * 0.045));
  for(const u of heroDots){
    const ux = mx + u.x * sc, uy = my + u.y * sc, r = u.isPlayer ? pr + 1.5 : pr;
    ctx.fillStyle = TEAM_COLOR[u.team];
    ctx.beginPath(); ctx.arc(ux, uy, r + 2, 0, TAU); ctx.fill();
    const pim = GFX.heroes[u.hero.id];
    if(imgReady(pim)){
      ctx.save();
      ctx.beginPath(); ctx.arc(ux, uy, r, 0, TAU); ctx.clip();
      ctx.drawImage(pim, ux - r, uy - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.font = fontEmoji(r * 1.4); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.emoji, ux, uy + 1);
    }
    ctx.strokeStyle = u.isPlayer ? '#fde047' : (u.team === myTeam ? '#e0f2fe' : '#fecaca');
    ctx.lineWidth = u.isPlayer ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(ux, uy, r + 1.5, 0, TAU); ctx.stroke();
  }
  for(const w of wards){
    if(w.team !== myTeam) continue;
    ctx.font = fontEmoji(11);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('👁️', mx + w.x * sc, my + w.y * sc);
  }
  ctx.font = fontEmoji(11);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for(const r of extraRunes) ctx.fillText(r.kind === 'bounty' ? '💰' : '📘', mx + r.x * sc, my + r.y * sc);
  for(const p of pings){   // 📍 pingovi suigrača: krugovi koji se šire
    if(p.team !== myTeam) continue;
    const px = mx + p.x * sc, py = my + p.y * sc;
    for(let k = 0; k < 2; k++){
      const f = ((p.t * 1.6 + k * 0.5) % 1);
      ctx.strokeStyle = 'rgba(253,224,71,' + (1 - f).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 4 + f * 14, 0, TAU); ctx.stroke();
    }
    ctx.font = fontEmoji(12);
    ctx.fillText('📍', px, py - 6);
  }
  for(const c of couriers){   // 🫏 naš kurir (protivnički samo kad se vidi)
    if(c.team !== myTeam && !isVisibleTo(myTeam, c)) continue;
    ctx.font = fontEmoji(c.state === 'home' ? 9 : 12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🫏', mx + c.x * sc, my + c.y * sc);
  }
  const corners = [
    screenToWorld(0, 0, true), screenToWorld(VW, 0, true),
    screenToWorld(VW, VH, true), screenToWorld(0, VH, true),
  ];
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for(let i = 0; i < 4; i++){
    const c = corners[i];
    const cx = mx + clamp(c.x, -400, WORLD + 400) * sc;
    const cy = my + clamp(c.y, -400, WORLD + 400) * sc;
    if(i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(mx, my, ms, ms, 10); ctx.stroke();
}

/* 🖱️ rubno pomicanje kamere (kao u DotA i LoL-u): miš uz sam rub ekrana pomiče kameru */
/* ================= 🖥️ cijeli zaslon i 🔒 zaključani miš =================
   U cijelom zaslonu (i s dva monitora) pokazivač ne smije pobjeći iz igre: Pointer Lock sakrije pravi
   pokazivač, igra crta svoj i drži ga unutar prozora — rubno pomicanje kamere uvijek radi.
   Kad se otvori izbornik (dućan, postavke, pomoć, kraj), miš se otpusti; klik na igru ga opet zaključa. */
function isFullscreen(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function enterFullscreen(){
  if(touchMode || isFullscreen()) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if(!req) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    const kb = () => { try { if(navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); } catch(e){} };   // Esc otvara postavke, ne izbacuje iz zaslona
    if(p && p.then) p.then(kb).catch(() => {}); else kb();
  } catch(e){}
}
function exitFullscreen(){
  try { if(navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch(e){}
  const ex = document.exitFullscreen || document.webkitExitFullscreen;
  if(ex && isFullscreen()) try { const p = ex.call(document); if(p && p.catch) p.catch(() => {}); } catch(e){}
}
function toggleFullscreen(){ if(isFullscreen()) exitFullscreen(); else enterFullscreen(); }
function domOverlayOpen(){
  for(const id of ['shop', 'options', 'help', 'end', 'pause', 'select']){
    const el = document.getElementById(id);
    if(el && !el.classList.contains('hidden')) return true;
  }
  return false;
}
function mouseLocked(){ return !!hudCv && document.pointerLockElement === hudCv; }
function wantMouseLock(){ return SETTINGS.lockMouse && !touchMode && running && !gameOver && isFullscreen() && !domOverlayOpen(); }
let lockFailT = 0;
function lockMouse(){
  if(!hudCv.requestPointerLock || performance.now() - lockFailT < 1200) return;   // preglednik ne dopušta odmah nakon Esc
  try {
    const p = hudCv.requestPointerLock();
    if(p && p.catch) p.catch(() => { lockFailT = performance.now(); });
  } catch(e){ lockFailT = performance.now(); }
}
function unlockMouse(){ if(mouseLocked()) try { document.exitPointerLock(); } catch(e){} }
function watchMouseLock(){   // svaka sličica: otvoren izbornik → otpusti miš
  if(mouseLocked() && !wantMouseLock()) unlockMouse();
}
document.addEventListener('pointerlockchange', () => { if(mouseLocked()) mouseIn = true; curCursor = ''; });
document.addEventListener('pointerlockerror', () => { lockFailT = performance.now(); });
document.addEventListener('fullscreenchange', () => { if(!isFullscreen()) unlockMouse(); });
/* nacrtani pokazivač dok je miš zaključan (isti oblici kao CSS pokazivači) */
const LOCK_CUR = {};
function lockCurImg(key, svg){
  if(!LOCK_CUR[key]){ const im = new Image(); im.src = 'data:image/svg+xml,' + encodeURIComponent(svg); LOCK_CUR[key] = im; }
  return LOCK_CUR[key];
}
const CUR_ARROW = "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><path d='M3 2L3 22L8.5 16.8L12.2 25L16 23.3L12.4 15.3L19.5 15.3Z' fill='#ffffff' stroke='#111827' stroke-width='2' stroke-linejoin='round'/></svg>";
const CUR_HAND = "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><path d='M9 13V4.5a2 2 0 0 1 4 0V11l1-.2V3.5a2 2 0 0 1 4 0V11l1 .1V5.5a2 2 0 0 1 4 0V17c0 4.5-3 8-7.5 8S8 23 6 19.5L3.3 14.8a1.9 1.9 0 0 1 3.1-2.1Z' fill='#ffffff' stroke='#111827' stroke-width='1.8' stroke-linejoin='round'/></svg>";
function drawLockedCursor(){
  if(!mouseLocked()) return;
  const c = curCursor;
  let im, hx = 3, hy = 2;
  if(c === CURSOR.attack){ im = lockCurImg('atk', decodeURIComponent(c.split('"')[1].slice('data:image/svg+xml,'.length))); hx = 3; hy = 3; }
  else if(c === CURSOR.aim){ im = lockCurImg('aim', decodeURIComponent(c.split('"')[1].slice('data:image/svg+xml,'.length))); hx = 16; hy = 16; }
  else if(c === 'pointer' || c === 'grabbing'){ im = lockCurImg('hand', CUR_HAND); hx = 9; hy = 2; }
  else im = lockCurImg('arrow', CUR_ARROW);
  if(im.complete && im.naturalWidth) ctx.drawImage(im, mouse.sx - hx, mouse.sy - hy);
}
function edgePan(dt){
  if(!SETTINGS.edgePan || touchMode || !mouseIn || invDrag || miniDrag || optionsOpen()) return;
  const m = 8;
  const dx = mouse.sx <= m ? -1 : (mouse.sx >= VW - m ? 1 : 0);
  const dy = mouse.sy <= m ? -1 : (mouse.sy >= VH - m ? 1 : 0);
  if(!dx && !dy) return;
  const sp = 1000 / cam.zoom * dt;
  cam.x = clamp(cam.x + dx * sp, 100, WORLD - 100);
  cam.y = clamp(cam.y + dy * sp, 100, WORLD - 100);
  cam.follow = false;
}

/* 🖱️ pokazivači miša (kao u LoL-u): mač nad neprijateljem, nišan pri ciljanju */
const svgCur = (svg, x, y, fb) => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + x + ' ' + y + ', ' + fb;
const CURSOR = {
  attack: svgCur("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>" +
    "<path d='M4 4L21 21' stroke='#1f2937' stroke-width='7' stroke-linecap='round'/><path d='M4 4L21 21' stroke='#fca5a5' stroke-width='3.5' stroke-linecap='round'/>" +
    "<path d='M15 25L25 15' stroke='#1f2937' stroke-width='6' stroke-linecap='round'/><path d='M15 25L25 15' stroke='#fbbf24' stroke-width='3' stroke-linecap='round'/>" +
    "<path d='M22 22L28 28' stroke='#1f2937' stroke-width='6' stroke-linecap='round'/><path d='M22 22L28 28' stroke='#b45309' stroke-width='3' stroke-linecap='round'/></svg>", 3, 3, 'pointer'),
  aim: svgCur("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>" +
    "<circle cx='16' cy='16' r='9' fill='none' stroke='#1f2937' stroke-width='4.5'/><circle cx='16' cy='16' r='9' fill='none' stroke='#fde047' stroke-width='2.2'/>" +
    "<path d='M16 1v8M16 23v8M1 16h8M23 16h8' stroke='#1f2937' stroke-width='4.5'/><path d='M16 1v8M16 23v8M1 16h8M23 16h8' stroke='#fde047' stroke-width='2.2'/>" +
    "<circle cx='16' cy='16' r='1.6' fill='#fde047'/></svg>", 16, 16, 'crosshair'),
};
let curCursor = '';
/* svaka sličica: točka na tlu ispod miša (kamera se pomiče i kad miš miruje — prije je nišan zaostajao
   i moć je letjela na staro mjesto) i jedinica pod mišem */
function refreshPointer(){
  if(!running || !camera3){ hoverUnit = null; return; }
  const w = screenToWorld(mouse.sx, mouse.sy);
  mouse.wx = w.x; mouse.wy = w.y;
  if(touchMode){ hoverUnit = null; return; }
  const overHud = hudHit(mouse.sx, mouse.sy);
  hoverUnit = mouseIn && !overHud && !invDrag && !miniDrag && !gameOver ? pickUnitScreen(mouse.sx, mouse.sy, 5) : null;
  const c = invDrag && invDrag.moved ? 'grabbing' : (hoverUi ? 'pointer' : (overHud ? 'default' :
    (pendingCast || amovePending ? CURSOR.aim : (hoverUnit && player && canAttackTarget(player, hoverUnit) ? CURSOR.attack : 'default'))));
  if(c !== curCursor){ hudCv.style.cursor = c; curCursor = c; }
}
/* 🖱️ držiš tipku miša na tlu: junak stalno ide prema mišu (kao u LoL-u) */
function updateHoldMove(){
  if(!holdMove) return;
  if(!running || paused || gameOver || !player || player.dead || pendingCast || amovePending){ holdMove = null; return; }
  const now = performance.now();   // stvarno vrijeme (ne broj sličica — i na sporom tabletu jednako brzo reagira)
  if(now < holdMove.next) return;
  holdMove.next = now + 150;
  if(!hudHit(mouse.sx, mouse.sy)) playerCommand(mouse.wx, mouse.wy, null, { silent: true });
}

/* ================= Glavna petlja ================= */
let lastT = performance.now();
let slowMo = 0;
let frameDt = 0;   // stvarno vrijeme kadra (za HUD animacije, i u pauzi)
function frame(now){
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  frameDt = Math.min(0.1, Math.max(0, dt));
  dt = Math.min(dt, 0.05);
  if(slowMo > 0){ slowMo -= dt; dt *= slowMo > 0.2 ? 0.35 : 0.35 + (0.2 - slowMo) / 0.2 * 0.65; }   // ⏱️ usporenje nakon tvoje pobjede nad junakom
  if(running && !paused && !gameOver){
    if(net.mode === 'guest') guestFrame(dt);   // gost ne simulira — prima snapshotte
    else update(dt);
    recordHist(false);   // 📈 graf na kraju igre
    edgePan(dt);
  }
  if(net.mode === 'host') maybeSendSnapshot(now);
  voxWatch();
  if(running) drawFog();   // 🌫️ magla rata mekano prati vid

  applyDayNight(gameTime);
  updateCamera3();
  refreshPointer();
  updateHoldMove();
  if(running) syncScene(now / 1000);
  render3D();

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  if(running){
    if(!paused){ updateTips(dt); updateAutoSkill(); updateQuests(dt); }
    drawWorldOverlay();
    drawScreenFx(dt);
    drawHud();
    drawTip();
    drawQuest();
    drawChatWheel();
  }
  watchMouseLock();
  drawLockedCursor();
  if(now - (frame.ambT || 0) > 250){ frame.ambT = now; updateAmbience(); }
  if(now - (frame.musT || 0) > 90){ frame.musT = now; updateMusic(); }   // 🎶   // 🌲 4× u sekundi je dovoljno
}

function resize(){
  DPR = window.devicePixelRatio || 1;
  VW = window.innerWidth;
  VH = window.innerHeight;
  hudCv.width = VW * DPR;
  hudCv.height = VH * DPR;
  hudCv.style.width = VW + 'px';
  hudCv.style.height = VH + 'px';
  resize3D();
}

window.addEventListener('error', e => {
  const el = document.getElementById('err');
  if(el){
    el.style.display = 'block';
    el.textContent = L('⚠️ Greška: ', '⚠️ Error: ') + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')';
  }
});

window.addEventListener('DOMContentLoaded', () => {
  glCanvas = document.getElementById('game');
  hudCv = document.getElementById('hud');
  ctx = hudCv.getContext('2d');
  loadGameArt();
  // 🔤 v0.56: platno (HUD) samo ne učitava font — učitaj Nunito odmah (latinica, naša slova, ćirilica)
  if(document.fonts && document.fonts.load) for(const w of ['600', '800']) document.fonts.load(w + ' 16px Nunito', 'AaŽžĐđЖжЉљ').catch(() => {});
  fogCanvas = document.createElement('canvas');
  fogCanvas.width = fogCanvas.height = VIS_N;
  fogCtx = fogCanvas.getContext('2d');
  initScene3D(glCanvas);
  setQuality3D(SETTINGS.quality);
  setFogCanvas(fogCanvas);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('touchstart', () => { touchMode = true; }, { passive: true, capture: true });   // 👆 dodir bilo gdje = tablet
  for(const ev of ['touchend', 'pointerdown', 'keydown']) window.addEventListener(ev, voxUnlock, { passive: true, capture: true });   // 🗣️ iPad: dopusti glasove
  buildSelectScreen();
  buildShopDom();
  { const pg = document.getElementById('shopPrepGo'); if(pg) pg.addEventListener('click', skipPrep); }
  buildOptionsDom();
  setupInput();
  initNetUI();
  requestAnimationFrame(frame);
});
