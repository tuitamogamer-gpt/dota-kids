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
function fontTxt(px, bold){ return (bold ? 'bold ' : '') + px + 'px "Comic Sans MS","Segoe UI",sans-serif'; }
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
const TOWER_FRACS = [[0.36, 0.16], [0.64, 0.84]];

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
const HGRID_N = 360;
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
   Svaki tim vidi samo oko svojih jedinica; noću je vid kraći.
   visGrid = mreža vidljivosti po timu, fogCanvas = vizualna magla. */
const VIS_N = 64;
const visGrid = [new Uint8Array(VIS_N * VIS_N), new Uint8Array(VIS_N * VIS_N)];
let visionTimer = 0;
let fogCanvas = null, fogCtx = null;

function visionRange(u){
  const base = u.kind === 'hero' ? 950 : (u.kind === 'tower' || u.kind === 'ancient' ? 900 : (u.kind === 'barracks' ? 700 : 750));
  return base * (isNight ? 0.65 : 1);
}
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
function updateVision(){
  for(let team = 0; team < 2; team++){
    const g = visGrid[team];
    g.fill(0);
    for(const u of units){
      if(u.team !== team || u.dead || u.removeMe) continue;
      markVision(g, u.x, u.y, visionRange(u));
    }
    markVision(g, FOUNTAIN[team].x, FOUNTAIN[team].y, 800);
    for(const w of wards) if(w.team === team) markVision(g, w.x, w.y, w.r);
  }
  // vizualna magla za MOJ tim (gost = crveni)
  if(fogCtx){
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.clearRect(0, 0, 256, 256);
    fogCtx.fillStyle = 'rgba(8,13,28,0.62)';
    fogCtx.fillRect(0, 0, 256, 256);
    fogCtx.globalCompositeOperation = 'destination-out';
    const s = 256 / WORLD;
    const night = isNight ? 0.65 : 1;
    for(const u of units){
      if(u.team !== myTeam || u.dead || u.removeMe) continue;
      const r = visionRange(u) * s;
      const gr = fogCtx.createRadialGradient(u.x * s, u.y * s, r * 0.55, u.x * s, u.y * s, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      fogCtx.fillStyle = gr;
      fogCtx.beginPath(); fogCtx.arc(u.x * s, u.y * s, r, 0, TAU); fogCtx.fill();
    }
    const ff = FOUNTAIN[myTeam];
    const fr = 800 * night * s;
    const fgr = fogCtx.createRadialGradient(ff.x * s, ff.y * s, fr * 0.55, ff.x * s, ff.y * s, fr);
    fgr.addColorStop(0, 'rgba(0,0,0,1)');
    fgr.addColorStop(1, 'rgba(0,0,0,0)');
    fogCtx.fillStyle = fgr;
    fogCtx.beginPath(); fogCtx.arc(ff.x * s, ff.y * s, fr, 0, TAU); fogCtx.fill();
    for(const w of wards){   // 👁️ Sovino oko
      if(w.team !== myTeam) continue;
      const wr = w.r * s;
      const wg = fogCtx.createRadialGradient(w.x * s, w.y * s, wr * 0.6, w.x * s, w.y * s, wr);
      wg.addColorStop(0, 'rgba(0,0,0,1)'); wg.addColorStop(1, 'rgba(0,0,0,0)');
      fogCtx.fillStyle = wg;
      fogCtx.beginPath(); fogCtx.arc(w.x * s, w.y * s, wr, 0, TAU); fogCtx.fill();
    }
    fogCtx.globalCompositeOperation = 'source-over';
    markFogDirty();
  }
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
function loadGameArt(){
  for(const h of HEROES){
    const im = new Image();
    im.src = 'assets/hero_' + h.id + '.jpg';
    GFX.heroes[h.id] = im;
  }
  const mobFiles = { boars: 'mob_boar', wolves: 'mob_wolf', bear: 'mob_bear', boss: 'mob_dragon' };
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
let winnerTeam = null;          // tim koji je pobijedio (junaci plešu pobjednički ples)
let glyph = [{ t: 0, cd: 0 }, { t: 0, cd: 0 }];   // 🛡️ Glif utvrde po timu: t = još aktivan, cd = punjenje
const glyphAiT = [0, 0];
let bossKills = 0;              // koliko je puta Zmaj pao (od 2. puta daje 🧀 sir)
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
    addFloat(h.x, h.y - 30, '🫏 Kurir je donio predmete!', '#fde047', 15);
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
        if(h.isPlayer) addFloat(h.x, h.y - 30, '🫏 Kurir je krenuo prema tebi!', '#fde68a', 13);
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
    if(gameTime > 1) feedMsg('💰 Rune zlata su se pojavile u džungli!', '#fde047');
  }
  wisdomT -= dt;
  if(wisdomT <= 0){
    wisdomT = CFG.wisdomEvery;
    extraRunes = extraRunes.filter(r => r.kind !== 'wisdom');
    for(const p of WISDOM_SPOTS) extraRunes.push({ x: p.x, y: p.y, kind: 'wisdom' });
    announce('📘 Rune mudrosti!', 'U kutovima džungle — tko je uzme, dobiva puno iskustva');
  }
  for(let i = extraRunes.length - 1; i >= 0; i--){
    const r = extraRunes[i];
    const h = units.find(u => u.kind === 'hero' && !u.dead && !u.removeMe && distXY(u.x, u.y, r.x, r.y) < 70);
    if(!h) continue;
    extraRunes.splice(i, 1);
    if(r.kind === 'bounty'){
      const g = Math.round(40 + gameTime / 60 * 3);
      for(const e of units) if(e.kind === 'hero' && e.team === h.team) e.gold += g;
      addFloat(h.x, h.y - 30, '💰 +' + g + ' zlata cijelom timu!', '#fde047', 16);
      feedMsg('💰 ' + h.emoji + ' ' + h.name + ' je uzeo runu zlata (+' + g + ' svima u timu)', TEAM_COLOR[h.team]);
      if(h.team === myTeam) sfx('buy');
    } else {
      const xp = Math.round(220 + gameTime / 60 * 22);
      giveXp(h, xp);
      addFloat(h.x, h.y - 30, '📘 +' + xp + ' iskustva!', '#93c5fd', 16);
      feedMsg('📘 ' + h.emoji + ' ' + h.name + ' je uzeo runu mudrosti!', TEAM_COLOR[h.team]);
      if(h.isPlayer) sfx('levelup');
    }
    burst(r.x, r.y, r.kind === 'bounty' ? '#fde047' : '#93c5fd', 18, 200, 6);
  }
}

/* 💬 brze poruke i 📍 ping */
let pings = [];                 // { x, y, team, t }
let chatOpen = false;
function say(h, txt){
  if(!h) return;
  if(gameTime - (h.chatT == null ? -9 : h.chatT) < 1.2) return;
  h.chatT = gameTime;
  feedMsg(h.emoji + ' ' + h.name + ': ' + txt, TEAM_COLOR[h.team]);
  if(!h.dead) addFloat(h.x, h.y - 46, txt, '#ffffff', 15);
}
function sendChat(h, i){ if(CHAT_LINES[i]) say(h, CHAT_LINES[i]); }
function addPing(h, x, y){
  if(!h || gameTime - (h.pingT == null ? -9 : h.pingT) < 0.8) return;
  h.pingT = gameTime;
  pings.push({ x: clamp(x, 0, WORLD), y: clamp(y, 0, WORLD), team: h.team, t: 0 });
  if(pings.length > 8) pings.shift();
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
  feedMsg('🌰 ' + taker.emoji + ' ' + taker.name + ' je našao ' + item.emoji + ' ' + item.name + '!', '#bef264');
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
      feedMsg('🕊️ Svetište liječi tim ' + TEAM_NAME[s.team] + '!', TEAM_COLOR[s.team]);
      burst(s.x, s.y, TEAM_LIGHT[s.team], 30, 300, 7);
      if(h.isPlayer) sfx('heal');
      break;
    }
  }
}
/* 🎓 talenti: na levelu 10 i 15 junak bira jedan od dva bonusa */
function chooseTalent(h, lvl, pick){
  if(!h || h.dead && false) return;
  const tier = TALENTS.find(t => t.lvl === lvl);
  if(!tier || h.level < lvl || h.talents[lvl]) return;
  const t = tier[pick];
  if(!t) return;
  h.talents[lvl] = pick;
  switch(t.id){
    case 'dmg': h.dmg += 30; break;
    case 'hp': h.maxhp += 300; h.hp += 300; break;
    case 'spd': h.speed = Math.round(h.speed * 1.15); break;
    case 'cdr': h.cdr = 0.2; break;
    case 'dmg2': h.dmg += 60; break;
    case 'hp2': h.maxhp += 650; h.hp += 650; break;
    case 'aspd': h.talAspd = 0.35; break;
    case 'cdr2': h.cdr = Math.min(0.4, (h.cdr || 0) + 0.15); break;
  }
  addFloat(h.x, h.y, '🎓 ' + t.emoji + ' ' + t.txt, '#c4b5fd', 15);
  burst(h.x, h.y, '#c4b5fd', 16, 200, 5);
  if(h.isPlayer) sfx('levelup');
}
function pendingTalent(h){
  for(const t of TALENTS) if(h.level >= t.lvl && !h.talents[t.lvl]) return t;
  return null;
}
const LANE_NAME = { top: 'gore', mid: 'sredina', bot: 'dolje' };
let runeTimer = CFG.runeEvery, runeSpotI = 0;
let isNight = false;
let player = null;
let remoteHero = null;      // junak kojeg vodi PRIJATELJ preko mreže (na domaćinu)
let myTeam = TEAM_BLUE;     // gost u multiplayeru je TEAM_RED
let pendingCast = null;     // {i} — moć čeka klik na cilj
let ancients = [null, null];
let cam = { x: WORLD / 2, y: WORLD / 2, zoom: 0.9, follow: true };
let mouse = { sx: 0, sy: 0, wx: 0, wy: 0 };
let keys = {};
let running = false, paused = false, gameOver = false;
let gameTime = 0, waveTimer = CFG.firstWave, waveCount = 0;
let firstBlood = false, muted = false, shopOpen = false;
let banner = null;
let kills = [0, 0];
let uiRects = { abil: [], learn: [], inv: [], qb: [], tp: null, glyph: null, statBtn: null, mini: null, shop: null, mute: null, help: null };
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
    curseT: 0, curseF: 0, blindT: 0, blindF: 0, formT: 0, rageT: 0, rageStun: 0 };
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
    lastHits: 0, denies: 0, multiN: 0, lastKillT: -99, tangoT: 0, clarityT: 0, neutral: null,
    itemBonus: { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 },
    backpack: [],                                   // 🎒 ruksak (3 mjesta): predmeti ovdje ne daju ništa
    itemAttr: { str: 0, agi: 0, int: 0 }, itemAspd: 0, itemArmor: 0, lifesteal: 0, evasion: 0, armor: 0, ifx: {},
    abilities: def.abilities.map(a => ({ def: a, cd: 0, rank: 0 })),
    isPlayer: !!isPlayer, lane,
    bot: isPlayer ? null : { state: 'lane', thinkT: rand(0.2, 0.8) },
    deadT: 0,
  });
  recomputeAttrStats(u);
  if(isPlayer) player = u;
  return u;
}

function makeCreep(team, lane, ranged, siege){
  const path = lanePath(team, lane);
  const sx = path[0][0], sy = path[0][1];
  const grow = waveCount;
  return makeUnit({
    kind: 'creep', team, lane,
    x: sx + rand(-45, 45), y: sy + rand(-45, 45),
    r: siege ? 19 : (ranged ? 14 : 16),
    hp: siege ? 850 + grow * 14 : (ranged ? 230 + grow * 6 : 330 + grow * 8),
    maxhp: siege ? 850 + grow * 14 : (ranged ? 230 + grow * 6 : 330 + grow * 8),
    dmg: siege ? 34 + grow : (ranged ? 27 : 22) + grow * 0.6,
    atkRange: ranged ? 290 : 62,
    atkCd: siege ? 1.2 : (ranged ? 1.4 : 1.1),
    projSpeed: ranged ? 520 : 0,
    speed: siege ? 122 : 132,
    path, wpIndex: 1,
    goldValue: siege ? 75 : (ranged ? 46 : 38),
    xpValue: siege ? 85 : (ranged ? 52 : 46),
    rangedCreep: !!ranged, siege: !!siege,
  });
}
// vojarna srušena → protivnički vojnici na toj stazi postaju SUPER (kao u DotA)
function makeCreepOnLane(team, lane, ranged, siege){
  const u = makeCreep(team, lane, ranged, siege);
  const tier = Math.floor(gameTime / CFG.creepScaleEvery);   // vojnici s vremenom jačaju
  if(tier > 0){
    const k = 1 + CFG.creepScalePct * tier;
    u.maxhp = u.hp = Math.round(u.maxhp * k);
    u.dmg *= k;
    u.goldValue += 2 * tier;
  }
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
  // kao u DotA: dublje kule su jače (više života i oklopa)
  const hpMul = isGuard ? 1.375 : (tier >= 2 ? 1.25 : 1), arm = CFG.towerArmor + (isGuard ? 4 : (tier >= 2 ? 2 : 0));
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
  camps = CAMP_SPOTS.map(s => ({ x: s.x, y: s.y, type: s.type, units: [], respawnT: 0 }));
  for(const c of camps) spawnCamp(c);
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
      goldValue: t.gold, xpValue: t.xp,
      emoji: t.emoji, name: t.name, boss: !!t.boss, camp: c, campType: c.type,
      stunHit: !!t.stunHit, scanT: rand(0, 0.4),
    });
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
    if(filter && !filter(e)) continue;
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
function addFloat(x, y, txt, color, size){
  if(floats.length > 70) floats.shift();
  floats.push({ x: x + rand(-10, 10), y: y + rand(-6, 6), h: 70, txt, color: color || '#fff', size: size || 15, t: 0 });
}
function feedMsg(txt, color){
  feed.unshift({ txt, color: color || '#fff', t: 0 });
  if(feed.length > 6) feed.pop();
}
function announce(txt, sub){
  banner = { txt, sub: sub || '', t: 0, dur: 3 };
}

/* ================= Statusi ================= */
function applySlow(t, f, dur){
  const st = t.status;
  if(st.immuneT > 0) return;
  if(st.slowT <= 0 || f >= st.slowF){ st.slowF = f; st.slowT = Math.max(st.slowT, dur); }
}
function applyStun(t, dur){ if(t.status.immuneT > 0) return; t.status.stun = Math.max(t.status.stun, dur); }
function applyRoot(t, dur){ if(t.status.immuneT > 0) return; t.status.rootT = Math.max(t.status.rootT, dur); }
function applySilence(t, dur){ if(t.status.immuneT > 0) return; t.status.silenceT = Math.max(t.status.silenceT, dur); }
function applyPoison(t, dps, dur, src, label){
  const st = t.status;
  if(st.immuneT > 0 || !isSpellTarget(t)) return;
  st.poisonDps = Math.max(st.poisonT > 0 ? st.poisonDps : 0, dps);
  st.poisonT = Math.max(st.poisonT, dur);
  st.poisonSrc = src || null;
  if(t.kind === 'hero') addFloat(t.x, t.y, label || '🤢 Otrovan!', label ? '#fca5a5' : '#86efac', 13);
}
// Kraljevski oklov (BKB): kratko ništa ne omamljuje, usporava, truje...
function applyImmune(h, dur){
  const st = h.status;
  st.immuneT = Math.max(st.immuneT, dur);
  st.stun = 0; st.slowT = 0; st.rootT = 0; st.silenceT = 0; st.poisonT = 0;
  addFloat(h.x, h.y, '👑 Nepokolebljiv!', '#fde047', 15);
}
function applyShield(t, f, dur){ t.status.shieldT = dur; t.status.shieldF = f; }
function applyAtkSpeed(t, f, dur){ t.aspdT = dur; t.aspdF = f; }          // Tigrove kandže: brži napadi
function applyDodge(t, f, dur){ t.dodgeT = dur; t.dodgeF = f; }           // Pijani korak: izbjegavanje udaraca
function applyTaunt(t, by, dur){                                         // Izazov: mora napadati izazivača
  if(t.status.immuneT > 0) return;
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
  u.charge = { vx: dx / L * o.speed, vy: dy / L * o.speed, left: L, dmg: o.dmg, stun: o.stun };
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
      applyDamage(e, c.dmg, u);
      applyStun(e, c.stun);
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
/* predmeti s gutljajima / punjenjima (Boca, Prašina, Oko) */
function itemCharges(h, id){
  const v = h.itemCharges[id];
  return v == null ? (ITEM_BY_ID[id].charges || 0) : v;
}
function useCharge(h, id){ h.itemCharges[id] = itemCharges(h, id) - 1; }
/* Glif utvrde (F): sve građevine tima 5 s neranjive, puni se 5 min */
function useGlyph(team, who){
  const g = glyph[team];
  if(g.cd > 0){ if(who && isHuman(who)) addFloat(who.x, who.y, '🛡️ Glif se još puni (' + Math.ceil(g.cd) + ' s)', '#e5e7eb', 13); return false; }
  g.t = CFG.glyphDur; g.cd = CFG.glyphCd;
  feedMsg('🛡️ ' + TEAM_NAME[team] + ' koristi Glif utvrde!', TEAM_COLOR[team]);
  for(const u of units) if(isStructure(u) && u.team === team && !u.removeMe) ring(u.x, u.y, 80, '#fde047');
  if(who && who.isPlayer) sfx('cast');
  return true;
}
function heal(u, amt){
  if(!u || u.dead || u.removeMe) return;
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
function applyDamage(t, amount, src, kind){
  if(!t || t.dead || t.removeMe || t.invuln || gameOver) return;
  if(t.cycloneT > 0) return;   // 🌪️ u vihoru: ništa ga ne može ozlijediti
  const st = t.status;
  if(isStructure(t) && glyph[t.team] && glyph[t.team].t > 0){   // 🛡️ Glif utvrde
    if(src && src.isPlayer && Math.random() < 0.3) addFloat(t.x, t.y, '🛡️ Glif!', '#fde047', 13);
    return;
  }
  if(isStructure(t) && src && src.team !== t.team && backdoorProtected(t)){   // 🛡️ backdoor
    amount *= CFG.backdoorMul;
    t.bdT = gameTime;
    if(src.isPlayer && gameTime - (t.bdWarnT || -99) > 4){
      t.bdWarnT = gameTime;
      addFloat(t.x, t.y, '🛡️ Bez vojnika kula prima pola štete!', '#93c5fd', 13);
    }
  }
  if(t.clarityT > 0 && src && src.kind === 'hero' && src.team !== t.team){   // 💧 udarac prekida Bistrinu
    t.clarityT = 0;
    if(isHuman(t)) addFloat(t.x, t.y, '💧 Bistrina prekinuta!', '#7dd3fc', 13);
  }
  const kz = passiveRank(t, 'koza');                 // Lavlja koža: pasivno smanjenje štete
  if(kz) amount *= 1 - (0.03 + 0.03 * kz);
  if(st.shieldT > 0) amount *= (1 - st.shieldF);
  if(st.curseT > 0) amount *= 1 + st.curseF;         // 🌀 Kletva: prima više štete
  const tv = passiveRank(t, 'tvrd');                 // Debeli oklop (Rogo E): ravno smanjenje
  if(tv) amount -= 4 + 4 * tv;
  if(kind === 'atk'){   // ⚔️ običan udarac: oklop i blok (kao u DotA); magije prolaze
    amount *= armorMul(unitArmor(t));
    // 🏰 "utvrđeni" oklop građevina (kao u Allstarsu): junaci rade manje štete, opsadni vojnici više
    if(isStructure(t) && src) amount *= src.kind === 'hero' ? CFG.heroVsStructure : (src.siege ? CFG.siegeVsStructure : 1);
    const bl = t.ifx && t.ifx.block;
    if(bl && src && !isStructure(src) && Math.random() < bl.c) amount -= bl.a * (src.projSpeed > 0 ? 0.5 : 1);   // blok ne djeluje na kule
  }
  amount = Math.max(1, Math.round(amount));
  const hp0 = t.hp;
  t.hp -= amount;
  if(kind === 'atk' && src && !src.dead && !isStructure(t)){   // 🦇 krađa života udarcima
    const ls = Math.max(src.lifesteal || 0, src.auraLs || 0) + (src.lsBoostT > 0 ? 1.5 : 0);
    if(ls > 0){
      src.hp = Math.min(src.maxhp, src.hp + Math.min(hp0, amount) * ls);
      if(Math.random() < 0.35) burst(src.x, src.y, '#f87171', 2, 50, 3);
    }
  }
  t.flash = 0.12;
  if(src && src !== t) t.hitAng = Math.atan2(t.y - src.y, t.x - src.x);   // 3D: trzaj od napadača
  if(t.kind === 'hero' || t.kind === 'tower' || t.kind === 'ancient' || t.kind === 'barracks' || (src && src.isPlayer)){
    addFloat(t.x, t.y, '-' + amount, src && src.team === TEAM_BLUE ? '#ffd166' : '#ff8fa3', t.kind === 'hero' ? 16 : 13);
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
    if(t.isPlayer) addFloat(t.x, t.y, '🌵 Bodlje!', '#a3e635', 13);
  }
  if((t.kind === 'creep' || t.kind === 'neutral') && src && !src.dead && !src.removeMe && src.team !== t.team){
    if(!isTargetable(t.attackTarget) && dist(t, src) < 620){
      t.attackTarget = src;
      if(t.kind === 'creep' && src.kind === 'hero') t.aggroT = gameTime + CFG.creepAggroChase;
    }
  }
  if(t.hp <= 0) kill(t, src);
}

function kill(t, src){
  t.hp = 0;
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
      if(isHuman(src)){ addFloat(t.x, t.y, '+' + t.goldValue + ' 💰', '#fde047', 15); coinDrops.push({ x: t.x, y: t.y, n: 1 + Math.floor(t.goldValue / 30) }); }
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
    if(camp.units.length === 0) camp.respawnT = t.boss ? CFG.bossRespawn : CFG.campRespawn;
    if(src && src.kind === 'hero' && !src.dead){
      src.gold += t.goldValue;
      src.lastHits++;
      if(isHuman(src)){ addFloat(t.x, t.y, '+' + t.goldValue + ' 💰', '#fde047', 15); coinDrops.push({ x: t.x, y: t.y, n: Math.min(6, 1 + Math.floor(t.goldValue / 40)) }); }
      for(const h of units){
        if(h.kind === 'hero' && h.team === src.team && !h.dead && dist(h, t) < CFG.xpRadius)
          giveXp(h, t.xpValue);
      }
      maybeNeutralDrop(src, t);
      if(t.boss){
        bossKills++;
        if(bossKills >= 2){   // 🧀 od drugog puta Zmaj ostavlja i sir
          const cheese = ITEM_BY_ID.cheese;
          const taker = [src].concat(units.filter(h => h.kind === 'hero' && h.team === src.team && h !== src && !h.dead))
            .find(h => h.items.length < CFG.inventorySlots || (h.backpack || []).length < BACKPACK_SLOTS);
          if(taker){
            giveItem(taker, cheese); delete taker.itemCharges.cheese; recomputeItemStats(taker);
            feedMsg('🧀 ' + taker.emoji + ' ' + taker.name + ' je dobio Zmajev sir!', '#fde047');
            if(taker.isPlayer) refreshShop();
          }
        }
        feedMsg('🐲 ' + src.emoji + ' ' + src.name + ' je porazio Velikog Zmaja!', '#fde047');
        announce('🐲 Veliki Zmaj je poražen!', src.emoji + ' ' + src.name + ' dobiva Zmajev blagoslov!');
        for(const h of units){
          if(h.kind === 'hero' && h.team === src.team) h.gold += 200;
        }
        src.status.dmgMulT = Math.max(src.status.dmgMulT, 60);
        src.status.dmgMulF = Math.max(src.status.dmgMulF, 1.3);
        applyHaste(src, 1.15, 60);
        addFloat(src.x, src.y, '🐲 Zmajev blagoslov!', '#fde047', 17);
        // 🛡️ Zmajev štit (Aegis): ubojica se nakon pogibije vraća na mjestu
        src.aegis = true; src.aegisT = CFG.aegisDuration;
        feedMsg('🛡️ ' + src.emoji + ' ' + src.name + ' ima Zmajev štit!', '#fde047');
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
      announce('🛡️ Zmajev štit!', t.emoji + ' ' + t.name + ' se vraća za 3 sekunde!');
    }
    t.moveTarget = null; t.attackTarget = null;
    t.tpChannel = 0;
    // zapamti ucjenu PRIJE čišćenja statusa
    const wasTracked = t.status.trackT > 0;
    const trackBonusVal = t.trackBonus || 100;
    const trackerRef = t.trackedBy;
    t.status = baseStatus();
    burst(t.x, t.y, TEAM_COLOR[t.team], 26, 240, 7);
    burst(t.x, t.y, '#fff', 10, 160, 4);
    let killerName = '🏰 Toranj';
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
    if(credit){
      credit.kills++;
      credit.streak = (credit.streak || 0) + 1;
      credit.gold += CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl;
      giveXp(credit, CFG.heroKillXp + t.level * 15);
      killerName = credit.emoji + ' ' + credit.name;
      if(credit.isPlayer) addFloat(credit.x, credit.y, '+' + (CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl) + ' 💰', '#fde047', 17);
      // 🔄 povratak u igru (kao u DotA): tim koji gubi dobiva više zlata kad ubije junaka tima koji vodi
      const behind = teamNetWorth(t.team) - teamNetWorth(credit.team);
      if(behind > 1500){
        const cb = Math.min(CFG.comebackMax, Math.round(behind * CFG.comebackPct / 10) * 10);
        credit.gold += cb;
        if(credit.isPlayer) addFloat(credit.x, credit.y - 26, '🔄 Povratak! +' + cb + ' 💰', '#a7f3d0', 15);
      }
      // višestruko ubojstvo (unutar 10 s) i niz ubojstava — kao najavljivač u DotA
      credit.multiN = gameTime - (credit.lastKillT || -99) < 10 ? (credit.multiN || 1) + 1 : 1;
      if(credit.bot && Math.random() < 0.3) say(credit, choice(BOT_BRAG));   // botovi se malo pohvale
      credit.lastKillT = gameTime;
      const who = credit.emoji + ' ' + credit.name;
      const MULTI = { 2: '⚔️⚔️ Dvostruko ubojstvo!', 3: '🔥 Trostruko ubojstvo!', 4: '💥 ULTRA ubojstvo!', 5: '🌋 POKOLJ!' };
      const STREAK = { 3: ['🔥', 'je u nizu ubojstava!'], 4: ['😤', 'DOMINIRA!'], 5: ['💪', 'MEGA ubojstvo!'], 6: ['⚡', 'je NEZAUSTAVLJIV!'],
        7: ['🤯', 'je NEVJEROJATAN!'], 8: ['👹', 'je ČUDOVIŠTE!'], 9: ['🌟', 'je BOŽANSKI!'] };
      const mk = MULTI[Math.min(5, credit.multiN)];
      const st = credit.streak >= 10 ? ['👑', 'je IZNAD BOŽANSKOG!'] : STREAK[credit.streak];
      if(mk && credit.multiN >= 2){ announce(mk, who + (st ? ' ' + st[1] : '')); milestoneAnn = true; }
      else if(st){ announce(st[0] + ' ' + who + ' ' + st[1], credit.streak + ' ubojstava zaredom!'); milestoneAnn = true; }
      // 🛑 prekinut niz: ubojica dobiva dodatno zlato za tuđi niz
      if(victimStreak >= 3){
        const bonus = CFG.shutdownGold * (victimStreak - 1);
        credit.gold += bonus;
        feedMsg('🛑 ' + who + ' je prekinuo niz od ' + victimStreak + ' (' + t.emoji + ' ' + t.name + ') +' + bonus + ' 💰', TEAM_COLOR[credit.team]);
        if(credit.isPlayer) addFloat(credit.x, credit.y - 30, '🛑 Prekinut niz! +' + bonus + ' 💰', '#fde047', 16);
      }
    }
    else if(src && src.kind === 'creep') killerName = '⚔️ Vojnici';
    else if(src && src.kind === 'neutral') killerName = src.emoji + ' ' + src.name;
    // 💰 Ucjena (Track): smrt označenog donosi dodatno zlato ubojici i Tragaču
    if(wasTracked){
      if(credit){
        credit.gold += trackBonusVal;
        if(credit.isPlayer) addFloat(credit.x, credit.y, '+' + trackBonusVal + ' 💰 ucjena!', '#fde047', 16);
      }
      if(trackerRef && trackerRef.kind === 'hero' && !trackerRef.removeMe && trackerRef !== credit && trackerRef.team !== t.team){
        trackerRef.gold += trackBonusVal;
        if(trackerRef.isPlayer) addFloat(trackerRef.x, trackerRef.y, '+' + trackBonusVal + ' 💰 ucjena!', '#fde047', 16);
      }
      feedMsg('💰 Ucjena naplaćena za ' + t.emoji + ' ' + t.name + '!', '#fde047');
    }
    // asistencije (kao u DotA): suigrači koji su udarili metu u zadnjih 10 s ili su bili blizu — i malo zlata
    if(credit){
      for(const h of units){
        if(h.kind !== 'hero' || h === credit || h.team !== credit.team || h.removeMe) continue;
        const hit = t.hitBy && gameTime - (t.hitBy[h.id] || -99) < 10;
        if(hit || (!h.dead && dist(h, t) < CFG.assistRange)){
          h.assists++;
          h.gold += CFG.assistGold;
          if(h.isPlayer) addFloat(h.x, h.y, '🤝 Asistencija +' + CFG.assistGold + ' 💰', '#a7f3d0', 15);
        }
      }
    }
    t.hitBy = {};
    src = credit || src;   // za "Bravo!" najavu i sfx ispod
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h !== src && !h.dead && dist(h, t) < CFG.xpRadius)
        giveXp(h, 70);
    }
    feedMsg(killerName + '  ⚔️  ' + t.emoji + ' ' + t.name, TEAM_COLOR[1 - t.team]);
    if(!firstBlood){ firstBlood = true; announce('🩸 Prva krv!', killerName); }
    if(t.isPlayer){ sfx('death'); announce('Ne brini! ⏳', 'Oživjet ćeš za ' + Math.ceil(t.deadT) + ' sekundi'); }
    else if(src && src.isPlayer){ sfx('kill'); if(!milestoneAnn) announce('Bravo! 🎉', 'Pobijedio si ' + t.emoji + ' ' + t.name + '!'); }
    else sfxAt('kill', t.x, t.y);
  }
  else if(t.kind === 'tower'){
    t.removeMe = true;
    burst(t.x, t.y, '#fbbf24', 30, 300, 8);
    burst(t.x, t.y, '#94a3b8', 20, 200, 7);
    const denied = !!(src && src.team === t.team);   // ⛔ uskraćena kula: protivnik dobiva pola zlata
    if(denied){
      feedMsg('⛔ ' + (src.emoji || '') + ' ' + (src.name || '') + ' je uskratio svoj toranj!', TEAM_COLOR[t.team]);
      announce('⛔ Toranj uskraćen!', 'Tim ' + TEAM_NAME[1 - t.team] + ' dobiva samo pola zlata');
      if(src.kind === 'hero') src.denies++;
    } else {
      feedMsg('🏰 Srušen toranj tima ' + TEAM_NAME[t.team] + '!', TEAM_COLOR[1 - t.team]);
      announce('🏰 BUM!', 'Toranj tima ' + TEAM_NAME[t.team] + ' je srušen!');
    }
    const tg = Math.round(CFG.towerGoldTeam * (denied ? 0.5 : 1));
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h.team !== TEAM_NEUTRAL){
        h.gold += tg;
        if(h.isPlayer) addFloat(h.x, h.y, '+' + tg + ' 💰', '#fde047', 15);
        if(!h.dead && dist(h, t) < 800) giveXp(h, CFG.towerXp * (denied ? 0.5 : 1));
      }
    }
    if(t.isGuard){
      const stillGuarded = units.some(x => x.kind === 'tower' && x.isGuard && x.team === t.team && !x.removeMe && x !== t);
      if(!stillGuarded && ancients[t.team]){
        ancients[t.team].invuln = false;
        announce('⚠️ Prijestol tima ' + TEAM_NAME[t.team] + ' je ranjiv!', 'Napadnite ga!');
      }
    }
    if(t.tier === 2 && t.lane){   // pala unutarnja kula → vojarna te staze je ranjiva
      for(const b of units){
        if(b.kind === 'barracks' && b.team === t.team && b.lane === t.lane && !b.removeMe){
          b.invuln = false;
          feedMsg('🏚️ Vojarna tima ' + TEAM_NAME[t.team] + ' (' + LANE_NAME[t.lane] + ') je ranjiva!', '#fde047');
        }
      }
    }
    sfxAt('tower', t.x, t.y);
  }
  else if(t.kind === 'barracks'){
    t.removeMe = true;
    burst(t.x, t.y, '#fbbf24', 30, 300, 8);
    burst(t.x, t.y, '#a16207', 20, 200, 7);
    const enemy = 1 - t.team;
    superCreeps[enemy][t.lane] = true;
    const all = LANE_LIST.every(l => superCreeps[enemy][l]);
    feedMsg('🏚️ Srušena vojarna tima ' + TEAM_NAME[t.team] + ' (' + LANE_NAME[t.lane] + ')!', TEAM_COLOR[enemy]);
    announce(all ? '💪💪 MEGA VOJNICI!' : '💪 Super vojnici!',
      'Vojnici tima ' + TEAM_NAME[enemy] + ' na stazi ' + LANE_NAME[t.lane] + ' su sada jači!');
    for(const h of units){
      if(h.kind === 'hero' && h.team === enemy){
        h.gold += CFG.barracksGoldTeam;
        if(h.isPlayer) addFloat(h.x, h.y, '+' + CFG.barracksGoldTeam + ' 💰', '#fde047', 15);
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
  addFloat(h.x, h.y, 'LEVEL ' + h.level + '! ⬆️', '#fde047', 18);
  burst(h.x, h.y, '#fde047', 18, 200, 6);
  if(h.bot){
    botSpendPoints(h);
    const pt = pendingTalent(h);
    if(pt) chooseTalent(h, pt.lvl, Math.random() < 0.5 ? 'a' : 'b');
  }
  if(h.isPlayer){
    sfx('levelup');
    if(h.level === CFG.ultLevels[0]) announce('🌟 ULTI dostupan!', 'Pritisni R ili klikni + da ga naučiš!');
    if(pendingTalent(h)) announce('🎓 Talent!', 'Odaberi jedan od dva bonusa (gumbi gore)');
  }
}

// ATRIBUTI (kao u DotA): 💪 snaga = život, 🤸 okretnost = brzina i brzina
// napada, 🧠 inteligencija = mana; GLAVNI atribut junaku daje štetu.
function recomputeAttrStats(h){
  const a = h.hero.attrs, ia = h.itemAttr || { str: 0, agi: 0, int: 0 };
  const dStr = h.str + ia.str - a.str, dAgi = h.agi + ia.agi - a.agi, dInt = h.int + ia.int - a.int;
  const prim = a.primary === 'str' ? dStr : (a.primary === 'agi' ? dAgi : dInt);
  const nb = {
    hp: Math.round(dStr * 18),
    hpRegen: dStr * 0.07,
    mp: Math.round(dInt * 13),
    mpRegen: dInt * 0.06,
    speed: dAgi * 0.3,
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
  h.atkSpdBonus = dAgi * 0.006 + (h.itemAspd || 0) / 100;
  h.armor = (h.agi + ia.agi) / 10 + (h.itemArmor || 0);   // okretnost daje malo oklopa
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
    addFloat(h.x, h.y, '📊 +2 svi atributi! (' + h.statRanks + '/' + CFG.statMaxRanks + ')', '#a7f3d0', 15);
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
  if(isHuman(h)){
    addFloat(h.x, h.y, ab.def.emoji + ' ' + ab.def.name + ' — rang ' + ab.rank + '!', '#a7f3d0', 15);
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
    pierce: !!o.pierce, slow: o.slow || null, hitIds: {},
    onHitFn: o.onHit || null,
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

/* 🩸🪖 aure predmeta (Vladimirov dar, Napadački oklop): računaju se jednom po otkucaju za sve junake */
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
/* 🎇 Čarobni štapić: puni se kad neprijateljski junak u blizini baci magiju */
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
      else addFloat(u.x, u.y, '🔒 Treba ti poen vještine!', '#e5e7eb', 13);
      return;
    }
    if(abG.def.passive){ addFloat(u.x, u.y, '✨ Pasivna moć — radi sama!', '#e5e7eb', 13); return; }
    if(abG.cd > 0){ sfx('click'); return; }
    if(u.mp < abG.def.mana){ addFloat(u.x, u.y, 'Nema mane! 💧', '#7dd3fc', 14); return; }
    netCast(i, aim || { x: u.x + 200, y: u.y });
    return;
  }
  const ab = u.abilities[i];
  if(!ab) return;
  if(u.tpChannel > 0) cancelTeleport(u);   // bacanje moći prekida teleport
  if(u.status.invisT > 0 && !ab.def.passive) u.status.invisT = 0;   // i nevidljivost
  if(ab.def.passive && ab.rank > 0){
    if(isHuman(u)) addFloat(u.x, u.y, '✨ Pasivna moć — radi sama!', '#e5e7eb', 13);
    return;
  }
  if(ab.rank <= 0){
    if(isHuman(u)){
      if(u.skillPoints > 0 && canLearn(u, i)) learnAbility(u, i);
      else if(ab.def.ult && u.level < CFG.ultLevels[0])
        addFloat(u.x, u.y, '🔒 Ulti od levela ' + CFG.ultLevels[0] + '!', '#e5e7eb', 14);
      else
        addFloat(u.x, u.y, '🔒 Treba ti poen vještine (level up)!', '#e5e7eb', 13);
    }
    return;
  }
  if(ab.cd > 0){ if(u.isPlayer) sfx('click'); return; }
  if(u.status.stun > 0) return;
  if(u.status.silenceT > 0){ if(isHuman(u)) addFloat(u.x, u.y, '🤐 Ušutkan!', '#e5e7eb', 13); return; }
  if(u.mp < ab.def.mana){
    if(isHuman(u)) addFloat(u.x, u.y, 'Nema mane! 💧', '#7dd3fc', 14);
    return;
  }
  const ok = ab.def.cast(u, aim || { x: u.x + Math.cos(u.dir || 0) * 200, y: u.y + Math.sin(u.dir || 0) * 200 }, ab.rank);
  if(ok === false){
    if(isHuman(u)) addFloat(u.x, u.y, 'Nema mete! 🤔', '#e5e7eb', 13);
    return;
  }
  u.mp -= ab.def.mana;
  ab.cd = ab.def.cd * (1 - (u.cdr || 0));   // 🎓 talent: kraće hlađenje
  if(u.windup){ u.windup = null; u.atkTimer = 0; }   // čaranje prekida zamah — napad nije potrošen
  u.castAim = aim ? { x: aim.x, y: aim.y } : null;   // 3D: efekt na mjestu cilja
  chargeWands(u);
  u.castFx = u.hero.id + ':' + ab.def.key;   // 3D: efekt moći (scene3d.js)
  u.castN = (u.castN || 0) + 1;              // 3D: animacija čaranja
  if(aim && (Math.abs(aim.x - u.x) + Math.abs(aim.y - u.y) > 4)) u.dir = Math.atan2(aim.y - u.y, aim.x - u.x);
  sfxAt(ab.def.ult ? 'ult' : 'cast', u.x, u.y);
}

/* ================= Otkup (buyback) ================= */
function buybackCost(h){ return CFG.buybackBase + h.level * CFG.buybackPerLvl; }
function buyback(h){
  if(!h || !h.dead || gameOver) return;
  const cost = buybackCost(h);
  if(h.buybackCd > 0){ if(isHuman(h)) addFloat(h.x, h.y, '⏱️ Otkup se još puni!', '#e5e7eb', 13); return; }
  if(h.gold < cost){ if(isHuman(h)) addFloat(h.x, h.y, 'Nemaš dovoljno zlata za otkup! 💰', '#fca5a5', 13); return; }
  h.gold -= cost;
  h.buybackCd = CFG.buybackCd;
  h.reviveAt = null;
  respawn(h);
  feedMsg('💰 ' + h.emoji + ' ' + h.name + ' se otkupio!', TEAM_COLOR[h.team]);
  if(h.isPlayer){ sfx('buy'); banner = null; }
}

/* ================= Aktivni predmeti (klik ili tipke 1–6) ================= */
function useItem(h, idx, aim){
  if(!h || h.dead || gameOver) return false;
  const it = h.items[idx];
  if(!it || !it.active) return false;
  const cd = h.itemCd[it.id] || 0;
  if(cd > 0){ if(isHuman(h)) addFloat(h.x, h.y, it.emoji + ' još se puni (' + Math.ceil(cd) + ' s)', '#e5e7eb', 13); return false; }
  if(h.status.stun > 0) return false;
  if(h.mp < it.active.mana){ if(isHuman(h)) addFloat(h.x, h.y, 'Nema mane! 💧', '#7dd3fc', 14); return false; }
  if(it.active.target === 'point' && !aim) return false;
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
// igrač: predmet s ciljem prvo pokazuje domet (kao moći), ostali se odmah koriste
function pressItem(i){
  if(!player || player.dead || gameOver) return;
  const it = player.items[i];
  if(!it || !it.active) return;
  if(it.active.target === 'point'){
    if(pendingCast && pendingCast.item === i){ castPending({ x: mouse.wx, y: mouse.wy }); return; }
    if((player.itemCd[it.id] || 0) > 0){ sfx('click'); return; }
    pendingCast = { item: i, i: -1 };
    sfx('click');
  } else {
    if(net.mode === 'guest') netItem(i, null);
    else useItem(player, i, null);
    pendingCast = null;
  }
}
// izvrši ono što čeka klik na cilj (moć ili predmet)
function castPending(aim){
  if(!pendingCast) return;
  if(pendingCast.item != null){
    if(net.mode === 'guest') netItem(pendingCast.item, aim);
    else useItem(player, pendingCast.item, aim);
  } else castAbility(player, pendingCast.i, aim);
  pendingCast = null;
}

/* ================= Teleport kući (T) ================= */
function startTeleport(h){
  if(!h || h.dead || gameOver || h.tpChannel > 0) return;
  if(h.tpCd > 0){
    if(isHuman(h)){ addFloat(h.x, h.y, 'Teleport se još puni! ⏱️', '#e5e7eb', 13); if(h.isPlayer) sfx('click'); }
    return;
  }
  if(distXY(h.x, h.y, FOUNTAIN[h.team].x, FOUNTAIN[h.team].y) < 400){
    if(isHuman(h)) addFloat(h.x, h.y, 'Već si kod kuće! 🏠', '#e5e7eb', 13);
    return;
  }
  h.tpChannel = 3;
  h.moveTarget = null;
  h.attackTarget = null;
  ring(h.x, h.y, 90, '#60a5fa');
  if(h.isPlayer) sfx('cast');
}
function cancelTeleport(h){
  if(h && h.tpChannel > 0){
    h.tpChannel = 0;
    if(h.isPlayer) addFloat(h.x, h.y, 'Teleport prekinut! ❌', '#fca5a5', 13);
  }
}

/* ================= Pasivne moći ================= */
/* urođena pasiva (odvojena od Q/W/E/R): rang 1 → 4 na levelima 1 / 7 / 13 / 19 */
function innateRank(h){ return Math.min(4, 1 + Math.floor((h.level - 1) / 6)); }
function passiveRank(h, pid){
  if(h.kind !== 'hero' || !h.hero.passive || h.hero.passive.pid !== pid) return 0;
  return innateRank(h);
}

// igračev tok: moći s ciljem prvo pokažu domet, pa se klikom baca
function pressAbility(i, aimInstant){
  if(!player || player.dead || gameOver) return;
  const ab = player.abilities[i];
  if(!ab) return;
  if(ab.rank <= 0){ castAbility(player, i, null); return; }
  if(ab.def.target === 'point'){
    if(pendingCast && pendingCast.item == null && pendingCast.i === i){
      castAbility(player, i, aimInstant || { x: mouse.wx, y: mouse.wy });
      pendingCast = null;
      return;
    }
    if(ab.cd > 0){ sfx('click'); return; }
    if(player.mp < ab.def.mana){
      addFloat(player.x, player.y, 'Nema mane! 💧', '#7dd3fc', 14);
      return;
    }
    pendingCast = { i };
    sfx('click');
  } else {
    castAbility(player, i, aimInstant || { x: mouse.wx, y: mouse.wy });
    pendingCast = null;
  }
}

/* ================= Kretanje ================= */
function unitSpeed(u){
  let s = u.speed;
  const st = u.status;
  if(st.slowT > 0) s *= (1 - st.slowF);
  if(st.hasteT > 0) s *= st.hasteF;
  const noc = passiveRank(u, 'noc');
  if(noc && isNight) s *= 1.15 + 0.08 * noc;
  const voda = passiveRank(u, 'voda');       // Vodozemac (Skokica): brža u rijeci
  if(voda && inRiver(u.x, u.y)) s *= 1.15 + 0.1 * voda;
  return s;
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
    for(const tr of trees){
      const dx = a.x - tr.x, dy = a.y - tr.y;
      const rr = a.r + tr.r;
      const d2 = dx * dx + dy * dy;
      if(d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      a.x = tr.x + dx / d * rr;
      a.y = tr.y + dy / d * rr;
    }
    a.x = clamp(a.x, a.r, WORLD - a.r);
    a.y = clamp(a.y, a.r, WORLD - a.r);
  }
}

/* ================= Borba ================= */
function performAttack(u, t){
  const copor = passiveRank(u, 'copor');       // Čopor: brži napad
  const raging = u.status.rageT > 0;           // Bijes: +40% brzine napada
  u.atkTimer = u.atkCd / (u.status.hasteT > 0 ? u.status.hasteF : 1) / (1 + (u.atkSpdBonus || 0) + 0.1 * copor + (raging ? 0.4 : 0) + (u.aspdT > 0 ? u.aspdF : 0) + (u.talAspd || 0) + (u.auraAspd || 0) / 100);
  u.atkN = (u.atkN || 0) + 1;   // 3D: animacija napada
  u.atkInt = u.atkTimer;        // 3D: animacija se ubrzava s brzinom napada
  if(Math.abs(t.x - u.x) > 2) u.face = t.x < u.x ? -1 : 1;
  u.dir = Math.atan2(t.y - u.y, t.x - u.x);
  // napad iz sjene (Tragač): bonus PRIJE nego nevidljivost pukne
  let shadowBonus = 0;
  if(u.status.invisT > 0){
    const sj = passiveRank(u, 'sjena');
    if(sj) shadowBonus = 40 + 30 * sj;
    if(u.sbBonus) shadowBonus += u.sbBonus;   // 🌒 Sjenovita oštrica
    u.sbBonus = 0;
    u.status.invisT = 0;   // napad prekida nevidljivost
  }
  // AGGRO (kao u DotA): napadneš li junaka —
  if(u.kind === 'hero' && t.kind === 'hero'){
    // 1) kula brani svog junaka i gađa TEBE
    for(const tw of units){
      if(tw.kind !== 'tower' || tw.team !== t.team || tw.removeMe) continue;
      if(dist(tw, u) <= tw.atkRange + u.r + 40){
        tw.attackTarget = u;
        if(u.isPlayer && tw.warnedTgt !== u) addFloat(u.x, u.y, '⚠️ Toranj te gađa!', '#fca5a5', 15);
        tw.warnedTgt = u;
      }
    }
    // 2) neprijateljski vojnici u 500 oko tebe te ganjaju 2.3 s (pa 3 s pauze)
    for(const cr of units){
      if(cr.kind !== 'creep' || cr.team !== t.team || cr.dead || cr.removeMe) continue;
      if(gameTime < (cr.aggroCdT || 0)) continue;
      if(dist(cr, u) < CFG.creepAggroRange){
        cr.attackTarget = u;
        cr.aggroT = gameTime + CFG.creepAggroChase;
        cr.aggroCdT = gameTime + CFG.creepAggroChase + CFG.creepAggroCd;
      }
    }
  }
  let dmg = u.dmg;
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
  let clawProc = false;                        // Divlje kandže (Sivko E)
  if(u.clawHits > 0){ dmg += u.clawDmg; u.clawHits--; clawProc = true; }
  const krv = passiveRank(u, 'krv');           // Miris krvi (Zubo): jače po ranjenima
  if(krv && t.hp < t.maxhp * 0.5 && !isStructure(t)) dmg *= 1 + 0.12 + 0.12 * krv;
  // pasivne moći napadača
  let crit = false;
  const oko = passiveRank(u, 'oko');                 // Oštro oko: kritični pogodak
  let critM = oko && Math.random() < 0.15 ? 1.25 + 0.25 * oko : 1;
  const ifx = u.ifx || {};
  for(const c of ifx.crit || []) if(Math.random() < c.c) critM = Math.max(critM, c.m);   // 💥 Kristalni nož / Dedal: najjači krit
  if(critM > 1){ dmg *= critM; crit = true; }
  if(ifx.creepDmg && (t.kind === 'creep' || t.kind === 'neutral')) dmg += ifx.creepDmg * (u.projSpeed > 0 ? 0.5 : 1);   // ⛏️ Sjekirica
  // 🔨 Lubanjolomac: tresak (najviše jednom u 2 s)
  const bashProc = !!(ifx.bash && gameTime >= (u.bashT || 0) && t.kind !== 'tower' && Math.random() < (u.projSpeed > 0 ? ifx.bash.cr : ifx.bash.c));
  if(bashProc) u.bashT = gameTime + 2;
  const mkbProc = !!(ifx.proc && Math.random() < ifx.proc.c);
  const dodir = passiveRank(u, 'dodir');             // Ledeni dodir: usporenje na napad
  const naboj = passiveRank(u, 'naboj');             // Statički naboj: munja na napad
  const onHitFx = (tt) => {
    if(crit) addFloat(tt.x, tt.y, 'KRIT! 💥', '#fb923c', 15);
    if(raging && tt.kind !== 'tower') applyStun(tt, u.status.rageStun || 0.3);
    if(u.stunHit && u.atkN % 3 === 0 && tt.kind !== 'tower'){ applyStun(tt, 0.6); addFloat(tt.x, tt.y, '🗿 Tresak!', '#cbd5e1', 14); }   // Golem
    if(peroProc && tt.maxmp){
      const m = Math.min(tt.mp, 20 + 15 * pero);
      tt.mp -= m; u.mp = Math.min(u.maxmp, u.mp + m);
      addFloat(tt.x, tt.y, '🪶 −' + Math.round(m) + ' 💧', '#c4b5fd', 14);
    }
    const sluz = passiveRank(tt, 'sluz');     // Sluzava koža (Pipko E): napadač se oklizne
    if(sluz && !u.dead && u.kind !== 'tower') applySlow(u, 0.15 + 0.05 * sluz, 1.5);
    if(komboHit){ heal(u, 15 + 10 * kombo); addFloat(tt.x, tt.y, '👊 Kombo!', '#fde047', 15); }
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
    if(shadowBonus) addFloat(tt.x, tt.y, 'Iz sjene! 👤', '#c4b5fd', 15);
    if(jinProc){ applySlow(tt, 0.3, 1.5); addFloat(tt.x, tt.y, '💢', '#fb923c', 15); }
    if(dodir) applySlow(tt, 0.1 + 0.05 * dodir, 1.5);
    // ---- predmeti ----
    if(bashProc && !tt.dead && !isStructure(tt)){ applyStun(tt, ifx.bash.t); applyDamage(tt, ifx.bash.dmg, u); addFloat(tt.x, tt.y, '🔨 Tresak!', '#e5e7eb', 15); }
    if(mkbProc && !tt.dead) applyDamage(tt, ifx.proc.dmg, u);                     // 🐒 čarobna šteta
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
  const ts = !!ifx.trueStrike;   // 🐒 Majmunova šipka: nikad ne promašuje
  const miss = (!ts && (groundHeight(t.x, t.y) - groundHeight(u.x, u.y) > 25) && Math.random() < CFG.uphillMissChance) ||
    (u.status.blindT > 0 && Math.random() < u.status.blindF) ||   // 😵 tinta / vrtoglavica
    (!ts && t.dodgeT > 0 && Math.random() < t.dodgeF) ||          // 🥴 Pijani korak
    (!ts && t.evasion > 0 && Math.random() < t.evasion);          // 🦋 Leptir: izbjegavanje
  u.atkHeavy = crit || komboHit || jinProc || clawProc || shadowBonus > 0 || bashProc;   // 3D: jači zamah (attack2)
  // kao u DotA: zamah traje do "kadra udarca" animacije, tek tada šteta / projektil (kula puca odmah)
  const wind = u.kind === 'tower' ? 0 : ATK_POINT / Math.max(1, ATK_ANIM_LEN / u.atkTimer);
  const deliver = () => releaseAttack(u, t, dmg, miss, onHitFx);
  if(wind > 0) u.windup = { t: gameTime + wind, target: t, deliver };
  else deliver();
}
const ATK_POINT = 7 / 24;      // udarac je u 7. kadru animacije napada (24 kadra/s)
const ATK_ANIM_LEN = 0.62;     // ispod ovog razmaka napada animacija se ubrzava
function releaseAttack(u, t, dmg, miss, onHitFx){
  if(u.dead || u.removeMe || !isTargetable(t)) return;
  if(dist(u, t) > u.atkRange + t.r + 160) return;   // meta pobjegla tijekom zamaha: promašaj u zrak
  if(u.projSpeed > 0){
    const off = (u.r || 16) * 0.8 + 8;   // strijela / kugla polijeće iz ruke ispred junaka, ne iz sredine tijela
    spawnHoming(u, t, {
      x: u.x + Math.cos(u.dir || 0) * off, y: u.y + Math.sin(u.dir || 0) * off,
      speed: u.projSpeed, dmg, miss, atk: true,
      onHit: miss ? null : onHitFx,
      color: u.kind === 'tower' ? '#fbbf24' : TEAM_LIGHT[u.team],
      r: u.kind === 'tower' ? 9 : 6,
      shot: u.kind === 'tower' ? 'tower' : (u.kind === 'hero' ? (u.hero.shot || 'bolt') : 'bolt'),
    });
    sfxAt('pew', u.x, u.y);
  } else {
    if(miss){
      if(u.kind === 'hero' || t.kind === 'hero')
        addFloat(t.x, t.y, 'Promašaj! 💨', '#e5e7eb', 13);
    } else {
      applyDamage(t, dmg, u, 'atk');
      onHitFx(t);
      const deb = passiveRank(t, 'debela');   // Debela koža (Tutnjo E): vraća štetu izbliza
      if(deb && !u.dead && !u.removeMe && u.kind !== 'tower') applyDamage(u, 14 + 10 * deb, t);
    }
    sfxAt('hit', u.x, u.y);
  }
}

/* ================= AI: vojnici (DotA aggro pravila) =================
   - Acquisition: melee 500 / ranged 600 / siege 800 (siege voli kule).
   - Prioritet: neprijateljski VOJNICI > kule > junaci (junake samo izbliza).
   - Kad ih junak povuče (aggro), ganjaju ga 2.3 s pa se vraćaju vojnicima. */
function creepThink(u){
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > 700) u.attackTarget = null;
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
        nearestEnemyOf(u, 500, e => e.kind === 'creep') ||
        nearestEnemyOf(u, 260, e => e.kind === 'hero');
    } else {
      u.attackTarget =
        nearestEnemyOf(u, acq, e => e.kind === 'creep') ||
        nearestEnemyOf(u, 470, e => isStructure(e)) ||
        nearestEnemyOf(u, 260, e => e.kind === 'hero');
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
function towerThink(u){
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > u.atkRange + u.attackTarget.r + 30 ||
     (u.attackTarget.kind === 'hero' && u.attackTarget.status.invisT > 0 && u.attackTarget.status.trackT <= 0))
    u.attackTarget = null;
  if(!u.attackTarget){
    u.attackTarget =
      nearestEnemyOf(u, u.atkRange, e => e.kind === 'creep') ||
      nearestEnemyOf(u, u.atkRange, e => e.kind === 'hero');
    if(u.attackTarget && u.attackTarget.isPlayer && u.warnedTgt !== u.attackTarget)
      addFloat(player.x, player.y, '⚠️ Toranj te gađa!', '#fca5a5', 15);
    u.warnedTgt = u.attackTarget || u.warnedTgt;
  }
  if(u.attackTarget && u.atkTimer <= 0 && dist(u, u.attackTarget) <= u.atkRange + u.attackTarget.r + 30)
    performAttack(u, u.attackTarget);
}

/* ================= AI: neutralci ================= */
function neutralThink(u){
  const camp = u.camp;
  const dHome = distXY(u.x, u.y, camp.x, camp.y);
  const tgtFar = u.attackTarget && !u.attackTarget.removeMe &&
    distXY(u.attackTarget.x, u.attackTarget.y, camp.x, camp.y) > 650;
  if(dHome > 620 || tgtFar){
    u.attackTarget = null;
    u.returning = true;
  }
  if(u.returning){
    if(dHome < 90){ u.returning = false; u.moveTarget = null; }
    else { u.moveTarget = { x: camp.x + rand(-40, 40), y: camp.y + rand(-40, 40) }; return; }
  }
  if(!isTargetable(u.attackTarget)) u.attackTarget = null;
  if(!u.attackTarget){
    for(const m of camp.units){
      if(m !== u && !m.dead && !m.removeMe && isTargetable(m.attackTarget)){
        u.attackTarget = m.attackTarget;
        break;
      }
    }
  }
  if(!u.attackTarget){
    let best = null, bd = 240;
    for(const e of units){
      if(e.team === TEAM_NEUTRAL || e.dead || e.removeMe || e.invuln) continue;
      if(e.kind !== 'hero' && e.kind !== 'creep') continue;
      const d = distXY(e.x, e.y, camp.x, camp.y);
      if(d < bd){ bd = d; best = e; }
    }
    if(best) u.attackTarget = best;
  }
  if(!u.attackTarget && !u.moveTarget && dHome > 70){
    u.moveTarget = { x: camp.x + rand(-30, 30), y: camp.y + rand(-30, 30) };
  }
}

/* ================= AI: junaci botovi ================= */
function laneFront(team, lane){
  let best = null, bp = -1;
  for(const u of units){
    if(u.kind !== 'creep' || u.team !== team || u.lane !== lane || u.dead || u.removeMe) continue;
    const wps = u.path;
    const wi = Math.min(u.wpIndex, wps.length - 1);
    const prog = wi * 10000 - distXY(u.x, u.y, wps[wi][0], wps[wi][1]);
    if(prog > bp){ bp = prog; best = u; }
  }
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

function botUseAbilities(u, eh){
  for(let i = 0; i < u.abilities.length; i++){
    const ab = u.abilities[i];
    if(ab.rank <= 0 || ab.cd > 0 || u.mp < ab.def.mana) continue;
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
        if((eh && dEh < hint.range) || creepN >= 3) castAbility(u, i, { x: u.x, y: u.y });
        break;
      }
      case 'ult-aoe':
        if(eh && dEh < hint.range) castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'gap':
        if(eh && dEh < hint.range && dEh > 120 && u.hp > u.maxhp * 0.55)
          castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'chain':
        if(eh && dEh < hint.range) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'snipe':
        if(eh && dEh < hint.range && eh.hp < eh.maxhp * 0.55)
          castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'track':
        if(eh && dEh < hint.range && eh.status.trackT <= 0)
          castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'shot':
      case 'zone':
        if(eh && dEh < hint.range) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'ward': {   // Sovino oko: pogledaj najbliže mjesto rune kad nema neprijatelja
        if(eh) break;
        let rs = null, bd = hint.range;
        for(const r of RUNE_SPOTS){ const d = distXY(u.x, u.y, r.x, r.y); if(d < bd){ bd = d; rs = r; } }
        if(rs) castAbility(u, i, { x: rs.x, y: rs.y });
        break;
      }
      case 'night':
        if(eh && dEh < hint.range && !isNight) castAbility(u, i, { x: u.x, y: u.y });
        break;
      case 'escape': {   // bijeg prema fontani kad je ranjen i neprijatelj je blizu
        if(eh && dEh < hint.range && u.hp < u.maxhp * 0.4){
          const f = FOUNTAIN[u.team];
          castAbility(u, i, stepToward(u, f, 500));
        }
        break;
      }
      case 'swap':   // Zamjena: povuci ranjenog neprijatelja k sebi kad je dalje
        if(eh && dEh < hint.range && dEh > 220 && eh.hp < eh.maxhp * 0.6) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
    }
  }
}

/* botovi koriste aktivne predmete (jednostavna pravila) */
function botUseItems(u, eh){
  const dEh = eh ? dist(u, eh) : 1e9, hpF = u.hp / u.maxhp, mpF = u.maxmp ? u.mp / u.maxmp : 1;
  u.items.forEach((it, i) => {
    if(!it.active || it.pending || (u.itemCd[it.id] || 0) > 0 || u.mp < (it.active.mana || 0)) return;
    const fight = eh && dEh < 600;
    let aim = null, go = false;
    switch(it.id){
      case 'bkb': case 'mom': case 'satanic': case 'phase': case 'drum': go = fight && (it.id !== 'satanic' || hpF < 0.5); break;
      case 'mek': case 'wand': case 'tango': case 'bottle': go = hpF < 0.55 && (it.id !== 'wand' || itemCharges(u, 'wand') >= 5) && (it.id !== 'tango' || !(u.tangoT > 0)); break;
      case 'arcane': case 'soulring': case 'clarity': go = mpF < 0.35; break;
      case 'shiva': go = eh && dEh < 600; break;
      case 'refresher': go = fight && u.abilities.filter(a => a.def.ult && a.rank > 0 && a.cd > 10).length > 0; break;
      case 'dagon': case 'euls': case 'abyssal':
        if(eh && dEh < (it.active.castRange || 600) && eh.hp < eh.maxhp * 0.7){ go = true; aim = { x: eh.x, y: eh.y }; }
        break;
      case 'midas': {
        const c = nearestEnemyOf(u, 550, e => e.kind === 'creep' || (e.kind === 'neutral' && !e.boss));
        if(c && !fight){ go = true; aim = { x: c.x, y: c.y }; }
        break;
      }
      case 'shadowblade': go = eh && dEh < 900 && dEh > 350 && hpF > 0.5; break;
    }
    if(go) useItem(u, i, aim || { x: u.x + Math.cos(u.dir || 0) * 100, y: u.y + Math.sin(u.dir || 0) * 100 });
  });
}
function botThink(u){
  const b = u.bot;
  const fountain = FOUNTAIN[u.team];
  if(u.tpChannel > 0) return;   // ne prekidaj vlastiti teleport
  if(b.state === 'retreat'){
    if(u.hp > u.maxhp * 0.9){ b.state = 'lane'; }
    else {
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
  if(u.hp < u.maxhp * 0.3){
    if(Math.random() < 0.3 && dist(u, player || u) < 2500){ say(u, CHAT_LINES[1]); addPing(u, u.x, u.y); }   // 🆘
    b.state = 'retreat';
    u.attackTarget = null;
    u.moveTarget = { x: fountain.x, y: fountain.y };
    return;
  }
  botShopping(u);
  const eh = nearestEnemyOf(u, 620, e => e.kind === 'hero');
  botUseAbilities(u, eh);
  botUseItems(u, eh);

  const tw = nearestEnemyOf(u, 430, e => e.kind === 'tower');
  if(tw && countOwnCreepsNear(u.team, tw, 320) === 0){
    u.attackTarget = null;
    u.moveTarget = stepToward(u, fountain, 300);
    return;
  }
  if(eh && dist(u, eh) < 520 && (u.hp / u.maxhp > 0.45 || eh.hp < eh.maxhp * 0.25)){
    u.attackTarget = eh;
    return;
  }
  if(!eh){   // 💰📘 uzmi runu u blizini
    let rn = null, bd = 650;
    for(const r of extraRunes){ const d = distXY(u.x, u.y, r.x, r.y); if(d < bd){ bd = d; rn = r; } }
    if(rn){ u.attackTarget = null; u.moveTarget = { x: rn.x, y: rn.y }; return; }
  }
  const anc = ancients[1 - u.team];
  if(isTargetable(anc) && dist(u, anc) < 700){
    u.attackTarget = anc;
    return;
  }
  if(Math.random() < 0.35){   // ⛔ botovi ponekad uskrate vlastitog vojnika (kao pravi igrači)
    const dn = deniableNear(u, u.atkRange + 120);
    if(dn){ u.attackTarget = dn; return; }
  }
  const lh = lowestHpEnemyCreep(u, 500);
  if(lh){ u.attackTarget = lh; return; }
  const et = nearestEnemyOf(u, 520, e => e.kind === 'tower' || e.kind === 'barracks');
  if(et && countOwnCreepsNear(u.team, et, 350) > 0){
    u.attackTarget = et;
    return;
  }
  // džungla tek od levela 3 i s dosta života (da ne dolaze polumrtvi na stazu!)
  if(!eh && u.level >= 3 && u.hp > u.maxhp * 0.65){
    const ec = nearestEnemyOf(u, 750, e => e.kind === 'creep');
    if(!ec){
      const nb = nearestEnemyOf(u, 700, e => e.kind === 'neutral' &&
        (!e.boss || (u.level >= 8 && u.hp > u.maxhp * 0.8)));
      if(nb){ u.attackTarget = nb; return; }
    }
  }
  u.attackTarget = null;
  // stani IZA svojih vojnika (kao pravi DotA igrač), ne ispred njih
  const fp = laneFront(u.team, u.lane);
  const dest = stepToward(fp, FOUNTAIN[u.team], 90 + u.atkRange * 0.45);
  if(dist(u, dest) > 130) u.moveTarget = dest;
  else u.moveTarget = null;
}

/* ================= Predmeti i recepti ================= */
function recomputeItemStats(h){
  const nb = { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 };
  const ia = { str: 0, agi: 0, int: 0 };
  let aspd = 0, armor = 0, ls = 0, ev = 0;
  const fx = { crit: [], bash: null, cleave: 0, creepDmg: 0, corrupt: null, block: null, trueStrike: false, proc: null, aura: [], wand: false };
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
    // pasivni efekti (DotA pravila: najjači krit, jedan tresak, zbrojeni sjekirica-bonus…)
    if(it.crit) fx.crit.push(it.crit);
    if(it.bash && !fx.bash) fx.bash = it.bash;
    if(it.cleave) fx.cleave = Math.max(fx.cleave, it.cleave);
    if(it.creepDmg) fx.creepDmg = Math.max(fx.creepDmg, it.creepDmg);
    if(it.corrupt) fx.corrupt = it.corrupt;
    if(it.block && (!fx.block || it.block.a > fx.block.a)) fx.block = it.block;
    if(it.trueStrike) fx.trueStrike = true;
    if(it.proc) fx.proc = it.proc;
    if(it.aura) fx.aura.push(it.aura);
    if(it.wand) fx.wand = true;
  }
  if(h.hero){
    h.itemAttr = ia; h.itemAspd = aspd; h.itemArmor = armor; h.lifesteal = ls; h.evasion = ev; h.ifx = fx;
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
  return (u.armor || 0) + (u.auraArmor || 0) - (u.corruptT > 0 ? u.corruptA : 0);
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
    const tg = ITEM_BY_ID.tango;
    if(u.gold >= tg.cost + 255 && planPurchase(u, tg).ok) doPurchase(u, tg, planPurchase(u, tg));
  }
  let guard = 0;
  const build = (u.hero && u.hero.build) || BOT_BUILD;
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
      addFloat(h.x, h.y, 'Nemaš dovoljno zlata! 💰', '#fca5a5', 14);
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
    if(itemCharges(h, item.id) >= item.charges){ addFloat(h.x, h.y, item.emoji + ' već je pun!', '#e5e7eb', 14); return; }
    if(h.gold < item.cost){ addFloat(h.x, h.y, 'Nemaš dovoljno zlata! 💰', '#fca5a5', 14); return; }
    h.gold -= item.cost; h.itemCharges[item.id] = item.charges;
    addFloat(h.x, h.y, item.emoji + ' Dopunjeno!', '#fde047', 15);
    if(h.isPlayer) sfx('buy');
    refreshShop();
    return;
  }
  const plan = planPurchase(h, item);
  if(!plan.tagOk){ addFloat(h.x, h.y, 'Već imaš čizme! 😄', '#e5e7eb', 14); return; }
  if(!plan.slotsOk){ addFloat(h.x, h.y, 'Torba i ruksak su puni! 🎒', '#fca5a5', 14); return; }
  if(h.gold < plan.cost){
    addFloat(h.x, h.y, 'Nemaš dovoljno zlata! 💰', '#fca5a5', 14);
    if(h.isPlayer) sfx('click');
    return;
  }
  doPurchase(h, item, plan);
  if(hasPending(h)) addFloat(h.x, h.y, '🫏 ' + item.emoji + ' čeka kurira…', '#fde68a', 15);
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
  addFloat(h.x, h.y, 'Prodano ' + it.emoji + ' +' + v + ' 💰', '#fde047', 14);
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
      if(u.bot && u.deadT > 12 && gameTime > 420 && u.buybackCd <= 0 && u.gold > buybackCost(u) * 2.5) buyback(u);
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
  u.flash = Math.max(0, u.flash - dt);
  u.atkTimer -= dt;
  if(u.cycloneT > 0) u.cycloneT -= dt;          // 🌪️ vihor
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
      if(u.aegisT <= 0){ u.aegis = false; if(u.isPlayer) addFloat(u.x, u.y, '🛡️ Zmajev štit je istekao', '#e5e7eb', 13); }
    }
    const med = passiveRank(u, 'med');   // Med (Zuja E): aura liječenja
    if(med) for(const e of units){
      if(e.kind === 'hero' && e.team === u.team && !e.dead && dist(u, e) <= 300) e.hp = Math.min(e.maxhp, e.hp + (1 + med) * dt);
    }
    const cop = passiveRank(u, 'copor');       // Čopor (Sivko E): obnova života
    if(cop) u.hp = Math.min(u.maxhp, u.hp + (1 + cop) * dt);
    if(u.frenzyT > 0) u.frenzyT -= dt;
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
    if(vid) u.atkRange = u.hero.range + 30 * vid;
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
      for(const it of u.items) if(it.charges && !it.consume && itemCharges(u, it.id) < it.charges){   // 🍼 Boca se puni
        u.itemCharges[it.id] = it.charges;
        if(u.isPlayer) addFloat(u.x, u.y, it.emoji + ' Napunjeno!', '#7dd3fc', 13);
      }
    }
    if(u.tangoT > 0){ u.tangoT -= dt; u.hp = Math.min(u.maxhp, u.hp + 7.2 * dt); }        // 🌿 Tango
    if(u.clarityT > 0){ u.clarityT -= dt; u.mp = Math.min(u.maxmp, u.mp + 7.5 * dt); }    // 💧 Bistrina
    if(u.runeRegenT > 0){
      u.runeRegenT -= dt;
      u.hp = Math.min(u.maxhp, u.hp + u.maxhp * 0.06 * dt);
      u.mp = Math.min(u.maxmp, u.mp + u.maxmp * 0.06 * dt);
    }
    u.gold += CFG.passiveGold * dt;
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
  if(st.stun > 0){
    if(u.kind === 'hero' && u.tpChannel > 0) cancelTeleport(u);   // omama prekida teleport
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

  // kanaliziranje teleporta: stoji i čeka, pa kući
  if(u.kind === 'hero' && u.tpChannel > 0){
    u.tpChannel -= dt;
    if(Math.random() < dt * 3) ring(u.x, u.y, rand(50, 90), '#60a5fa');
    if(Math.random() < dt * 8) burst(u.x, u.y, '#60a5fa', 3, 80, 4);
    if(u.tpChannel <= 0){
      burst(u.x, u.y, '#60a5fa', 22, 260, 6);
      const f = FOUNTAIN[u.team];
      u.x = f.x + rand(-50, 50);
      u.y = f.y + rand(-50, 50);
      burst(u.x, u.y, '#60a5fa', 22, 260, 6);
      u.tpChannel = 0;
      u.tpCd = 60;
      if(u.isPlayer){ addFloat(u.x, u.y, 'Doma! 🏠', '#93c5fd', 15); sfx('heal'); }
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
    if(u.bot.thinkT <= 0){ u.bot.thinkT = rand(0.4, 0.6); botThink(u); }
  }

  if(u.tauntT > 0){   // 📢 Izazov: mora napadati izazivača
    u.tauntT -= dt;
    const tb = u.tauntBy;
    if(tb && !tb.dead && !tb.removeMe){ u.attackTarget = tb; u.moveTarget = null; }
    else u.tauntT = 0;
  }
  if(u.kind === 'hero' && isHuman(u) && !u.attackTarget && !u.moveTarget && !u.charge){
    u.acqT = (u.acqT || 0) - dt;
    if(u.acqT <= 0){ u.acqT = 0.25; autoAcquire(u); }
  }
  if(u.attackTarget){
    const t = u.attackTarget;
    // magla rata / nevidljivost: junak gubi metu koja nestane (osim ucijenjene 💰)
    if(!isTargetable(t) ||
       (t.team === u.team && !canDeny(t)) ||   // vlastitu jedinicu napadaš samo dok se može uskratiti
       (t.kind === 'hero' && t.status.invisT > 0 && t.status.trackT <= 0 && t.team !== u.team) ||
       (u.kind === 'hero' && t.team !== u.team && t.kind !== 'tower' && t.kind !== 'ancient' && !isVisibleTo(u.team, t))){
      u.attackTarget = null;
    }
    else {
      const d = dist(u, t);
      const reach = u.atkRange + t.r;
      if(d > reach) moveToward(u, t.x, t.y, dt);
      else if(u.atkTimer <= 0) performAttack(u, t);
    }
  }
  else if(u.moveTarget){
    if(moveToward(u, u.moveTarget.x, u.moveTarget.y, dt)) u.moveTarget = null;
  }
}

function respawn(u){
  u.dead = false;
  u.windup = null;
  u.hp = u.maxhp;
  u.mp = u.maxmp;
  const f = FOUNTAIN[u.team];
  if(u.reviveAt){
    u.x = u.reviveAt.x; u.y = u.reviveAt.y; u.reviveAt = null;
    addFloat(u.x, u.y, '🛡️ Vratio se!', '#fde047', 16);
  } else {
    u.x = f.x + rand(-50, 50);
    u.y = f.y + rand(-50, 50);
  }
  u.status = baseStatus();
  u.tpChannel = 0;
  u.moveTarget = null; u.attackTarget = null;
  if(u.bot) u.bot.state = 'lane';
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
          if((p.src && p.src.kind === 'hero') || t.kind === 'hero')
            addFloat(t.x, t.y, 'Promašaj! 💨', '#e5e7eb', 13);
        } else {
          applyDamage(t, p.dmg, p.src, p.atk ? 'atk' : null);
          if(p.onHit) p.onHit(t);
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
          applyDamage(e, p.dmg, p.src);
          if(p.slow) applySlow(e, p.slow.f, p.slow.t);
          if(p.onHitFn) p.onHitFn(e, p);
          burst(e.x, e.y, p.color, 6, 120, 4);
          if(!p.pierce){ projectiles.splice(i, 1); removed = true; break; }
          p.hitIds[e.id] = true;
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
  if(waveCount === 1) announce('⚔️ Vojnici kreću!', 'Prati ih niz stazu');
  if(waveCount % CFG.siegeEveryNthWave === 0 && waveCount > 1)
    feedMsg('💪 Stigli su veliki vojnici!', '#fde047');
}

function update(dt){
  gameTime += dt;
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

  for(const c of camps){
    if(c.units.length === 0 && c.respawnT > 0){
      c.respawnT -= dt;
      if(c.respawnT <= 0) spawnCamp(c);
    }
  }

  runeTimer -= dt;
  if(runeTimer <= 0){
    runeTimer = CFG.runeEvery;
    const sp = RUNE_SPOTS[runeSpotI];
    runeSpotI = 1 - runeSpotI;
    runes = [{ x: sp.x, y: sp.y, def: choice(RUNE_TYPES), t: 0 }];
    announce('✨ Čarobna runa!', 'Pojavila se na rijeci — uzmi je!');
  }
  if(runes.length){
    const rn = runes[0];
    rn.t += dt;
    for(const h of units){
      if(h.kind !== 'hero' || h.dead) continue;
      if(distXY(h.x, h.y, rn.x, rn.y) < 70){
        rn.def.apply(h);
        addFloat(h.x, h.y, rn.def.emoji + ' ' + rn.def.name + '!', '#fde047', 16);
        if(h.isPlayer) sfx('levelup');
        burst(rn.x, rn.y, '#fde047', 16, 200, 5);
        runes = [];
        break;
      }
    }
  }

  if(nightForceT > 0) nightForceT -= dt;
  for(let i = wards.length - 1; i >= 0; i--){ wards[i].t -= dt; if(wards[i].t <= 0) wards.splice(i, 1); }
  updateShrines(dt);
  updateCouriers(dt);
  updateExtraRunes(dt);
  updatePings(dt);
  {   // 💪 vojnici jačaju svakih 7.5 min
    const tier = Math.floor(gameTime / CFG.creepScaleEvery);
    if(tier > creepTier){ creepTier = tier; announce('💪 Vojnici su ojačali!', '+' + Math.round(CFG.creepScalePct * 100 * tier) + '% života i štete na obje strane'); }
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
    announce(isNight ? '🌙 Pada noć...' : '☀️ Svanulo je!', isNight ? 'Vid je kraći — pazi na zasjede!' : '');
  }

  // magla rata: osvježi vid oba tima
  visionTimer -= dt;
  if(visionTimer <= 0){
    visionTimer = 0.2;
    updateVision();
  }

  // ciljanje: odustani ako moć više nije spremna
  if(pendingCast){
    if(pendingCast.item != null){
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
    f.t += dt; f.h += 52 * dt;
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
function genTrees(){
  trees = [];
  let attempts = 0;
  while(trees.length < Math.round(220 * MAP_S * MAP_S) && attempts < 14000){
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
    for(const t of trees){
      if(distXY(x, y, t.x, t.y) < 150){ blocked = true; break; }
    }
    if(blocked) continue;
    trees.push({ x, y, r: 24, size: rand(42, 62), kind: Math.random() < 0.7 ? '🌳' : '🌲' });
  }
}

function buildTerrain(){
  terrainCanvas = document.createElement('canvas');
  const RES = Math.min(WORLD, 3600);   // tekstura do 3600 px (veće ne podnose svi uređaji)
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
    t.fillStyle = 'rgba(126,200,80,0.22)';   // blagi ton preko teksture
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

  // podloge kampova
  for(const c of CAMP_SPOTS){
    t.fillStyle = 'rgba(146,100,47,0.25)';
    t.beginPath(); t.arc(c.x, c.y, c.type === 'boss' ? 160 : 110, 0, TAU); t.fill();
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
    t.fillStyle = grad('rgba(255,255,255,0)', 'rgba(120,104,140,0.75)');
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

  // baze (platoi)
  for(let team = 0; team < 2; team++){
    const a = ANCIENT_POS[team];
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.22)' : 'rgba(76,29,58,0.32)';
    t.beginPath(); t.arc(a.x, a.y, 460 * MAP_S, 0, TAU); t.fill();
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.3)' : 'rgba(127,29,29,0.3)';
    t.beginPath(); t.arc(a.x, a.y, 260 * MAP_S, 0, TAU); t.fill();
    const f = FOUNTAIN[team];
    t.fillStyle = 'rgba(214,203,181,0.55)';
    t.beginPath(); t.arc(f.x, f.y, 150, 0, TAU); t.fill();
  }

  t.strokeStyle = '#3f6b2a';
  t.lineWidth = 40;
  t.strokeRect(0, 0, WORLD, WORLD);

  setGround(terrainCanvas);
}

function makeWorld(){
  for(let team = 0; team < 2; team++){
    makeAncient(team);
    for(const g of GUARD_POS[team]) makeTower(team, g[0], g[1], null, 9, true);
    for(const lane of LANE_LIST){
      for(let i = 0; i < 2; i++){
        const p = pointAt(LANE_PTS[lane], TOWER_FRACS[team][i]);
        makeTower(team, p.x, p.y, lane, i + 1, false);
      }
      // vojarna: malo iza unutarnje kule, sa strane staze (dalje od sredine mape)
      const bp = pointAt(LANE_PTS[lane], team === TEAM_BLUE ? 0.075 : 0.925);
      const q = pointAt(LANE_PTS[lane], team === TEAM_BLUE ? 0.12 : 0.88);
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
function startGame(heroIdx){
  units = []; projectiles = []; zones = []; particles = []; lines = [];
  floats = []; markers = []; feed = [];
  ancients = [null, null];
  kills = [0, 0];
  camps = []; runes = [];
  runeTimer = CFG.runeEvery; runeSpotI = 0; isNight = false;
  wards = []; nightForceT = 0; superCreeps = [{}, {}]; winnerTeam = null;
  glyph = [{ t: 0, cd: 0 }, { t: 0, cd: 0 }];
  makeShrines(); makeCouriers(); creepTier = 0; bossKills = 0; coinDrops = [];
  neutralDrops = [{ 1: 0, 2: 0, 3: 0 }, { 1: 0, 2: 0, 3: 0 }]; neutralFx = [];
  resetExtraRunes(); pings = []; chatOpen = false;
  pendingCast = null;
  gameTime = 0; waveTimer = CFG.firstWave; waveCount = 0;
  firstBlood = false; gameOver = false; paused = false;
  banner = null;
  myTeam = TEAM_BLUE;
  remoteHero = null;

  clearScene3D();
  genTrees();
  buildTerrain();
  buildTrees3D();
  buildStatic3D();
  makeWorld();

  const rest = shuffle(HEROES.map((h, i) => i).filter(i => i !== heroIdx));
  makeHero(HEROES[heroIdx], TEAM_BLUE, true, 'mid');
  makeHero(HEROES[rest[0]], TEAM_BLUE, false, 'top');
  makeHero(HEROES[rest[1]], TEAM_BLUE, false, 'bot');
  makeHero(HEROES[rest[2]], TEAM_RED, false, 'mid');
  makeHero(HEROES[rest[3]], TEAM_RED, false, 'top');
  makeHero(HEROES[rest[4]], TEAM_RED, false, 'bot');

  for(const h of units){
    if(h.kind === 'hero' && h.bot) botSpendPoints(h);
  }

  buildPlayerRing();
  updateVision();

  cam.x = player.x; cam.y = player.y; cam.zoom = 0.9; cam.follow = true;
  running = true;
  document.getElementById('select').classList.add('hidden');
  announce('🏰 Sruši crveni prijestol! 👑', 'Pritisni Q, W ili E da naučiš prvu moć!');
  refreshShop();
  sfx('levelup');
}

function endGame(winTeam){
  if(net.mode === 'host') sendNet({ c: 'end', win: winTeam });
  endGameView(winTeam);
}
function endGameView(winTeam){
  gameOver = true;
  winnerTeam = winTeam;
  const won = player && player.team === winTeam;
  pendingCast = null;
  announce(won ? '🏆 POBJEDA!' : '💔 PORAZ...', won ? 'Neprijateljski prijestol se raspada!' : 'Naš prijestol je pao...');
  startCinematic(ANCIENT_POS[1 - winTeam]);   // kamera leti do prijestola koji se raspada
  sfx(won ? 'win' : 'lose');
  setTimeout(() => showEndScreen(winTeam, won), 3200);
}
function teamNetWorth(team){ return units.reduce((a, h) => a + (h.kind === 'hero' && h.team === team ? netWorth(h) : 0), 0); }
/* neto vrijednost (kao u DotA): zlato + vrijednost svih predmeta */
function netWorth(h){
  return Math.floor(h.gold + h.items.concat(h.backpack || []).reduce((a, it) => a + (it.cost != null ? itemFullCost(ITEM_BY_ID[it.id] || it) : 0), 0));
}
/* završna tablica (kao u DotA): po timovima, K/D/A, zadnji udarci, neto vrijednost, predmeti, 👑 najbolji igrač */
function endTableHtml(winTeam){
  const heroesAll = units.filter(u => u.kind === 'hero');
  const score = h => h.kills * 3 + h.assists * 1.5 - h.deaths + (h.lastHits || 0) / 15 + netWorth(h) / 1500;
  const mvp = heroesAll.slice().sort((a, b) => score(b) - score(a))[0];
  const icon = it => it && ITEM_BY_ID[it.id] ? `<img class="etItem" src="${itemIconUrl(ITEM_BY_ID[it.id])}" title="${it.name}" alt="${it.emoji}">` : '<span class="etItem etEmpty"></span>';
  let html = '<table class="endT">';
  for(const team of [TEAM_BLUE, TEAM_RED]){
    const hs = heroesAll.filter(h => h.team === team).sort((a, b) => netWorth(b) - netWorth(a));
    const win = team === winTeam;
    html += `<tr class="etTeam t${team}"><th colspan="6">${team === TEAM_BLUE ? '🔵 Sentinel' : '🔴 Scourge'} ${win ? '<span class="etWin">🏆 POBJEDNIK</span>' : ''}</th></tr>`;
    html += '<tr class="etHead"><th>Junak</th><th>Lvl</th><th>K / D / A</th><th>LH / DN</th><th>🪙 Neto</th><th>Predmeti</th></tr>';
    for(const h of hs){
      const items = [];
      for(let i = 0; i < CFG.inventorySlots; i++) items.push(icon(h.items[i]));
      html += `<tr class="${h.isPlayer ? 'etMe' : ''}"><td class="etHero"><img src="assets/hero_${h.hero.id}.jpg" alt="${h.emoji}" onerror="this.replaceWith(document.createTextNode('${h.emoji}'))">` +
        `<span>${h === mvp ? '👑 ' : ''}${h.name}${h.isPlayer ? ' <b>(TI)</b>' : ''}</span></td>` +
        `<td>${h.level}</td><td><b class="etK">${h.kills}</b> / <b class="etD">${h.deaths}</b> / <b class="etA">${h.assists}</b></td>` +
        `<td>${h.lastHits || 0} / ${h.denies || 0}</td><td class="etNw">${netWorth(h)}</td>` +
        `<td class="etItems">${items.join('')}${h.neutral ? `<img class="etItem etNeut" src="${itemIconUrl(h.neutral)}" title="${h.neutral.name}">` : ''}</td></tr>`;
    }
  }
  html += '</table>';
  if(mvp) html += `<div class="etMvp">👑 Najbolji igrač: <b>${mvp.emoji} ${mvp.name}</b> — ${mvp.kills} / ${mvp.deaths} / ${mvp.assists}</div>`;
  return html;
}
function showEndScreen(winTeam, won){
  document.getElementById('endEmoji').textContent = won ? '🎉🏆🎉' : '😢💔😢';
  document.getElementById('endTitle').textContent = won ? 'POBJEDA!' : 'PORAZ!';
  document.getElementById('endTitle').style.color = won ? '#fde047' : '#fca5a5';
  document.getElementById('endTable').innerHTML = endTableHtml(winTeam);
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

/* ================= Zvuk ================= */
let AC = null;
function ac(){
  if(!AC){
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ AC = null; }
  }
  return AC;
}
function tone(freq, dur, type, vol, slideTo, delay){
  const a = ac();
  if(!a) return;
  const t0 = a.currentTime + (delay || 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function sfx(name){
  if(muted) return;
  const now = performance.now();
  if(sfxLast[name] && now - sfxLast[name] < 60) return;
  sfxLast[name] = now;
  switch(name){
    case 'hit':     tone(190, 0.07, 'square', 0.045, 120); break;
    case 'pew':     tone(720, 0.09, 'sine', 0.04, 280); break;
    case 'cast':    tone(420, 0.13, 'sine', 0.08, 900); break;
    case 'ult':     tone(300, 0.3, 'sawtooth', 0.1, 900); tone(600, 0.25, 'triangle', 0.1, 1200, 0.12); break;
    case 'zap':     tone(1200, 0.1, 'sawtooth', 0.05, 300); break;
    case 'boom':    tone(160, 0.25, 'sawtooth', 0.09, 50); break;
    case 'heal':    tone(523, 0.1, 'triangle', 0.06); tone(659, 0.1, 'triangle', 0.06, 0, 0.07); tone(784, 0.12, 'triangle', 0.06, 0, 0.14); break;
    case 'kill':    tone(600, 0.12, 'triangle', 0.1); tone(800, 0.12, 'triangle', 0.1, 0, 0.1); tone(1000, 0.2, 'triangle', 0.1, 0, 0.2); break;
    case 'tower':   tone(220, 0.4, 'sawtooth', 0.12, 55); tone(110, 0.5, 'square', 0.08, 40, 0.1); break;
    case 'levelup': tone(523, 0.1, 'triangle', 0.09); tone(659, 0.1, 'triangle', 0.09, 0, 0.09); tone(784, 0.1, 'triangle', 0.09, 0, 0.18); tone(1046, 0.22, 'triangle', 0.1, 0, 0.27); break;
    case 'buy':     tone(880, 0.07, 'square', 0.06); tone(1320, 0.09, 'square', 0.06, 0, 0.07); break;
    case 'death':   tone(400, 0.5, 'sawtooth', 0.1, 120); break;
    case 'win':     tone(523, 0.16, 'triangle', 0.11); tone(659, 0.16, 'triangle', 0.11, 0, 0.14); tone(784, 0.16, 'triangle', 0.11, 0, 0.28); tone(1046, 0.4, 'triangle', 0.12, 0, 0.42); break;
    case 'lose':    tone(330, 0.22, 'sawtooth', 0.09, 0, 0); tone(277, 0.22, 'sawtooth', 0.09, 0, 0.2); tone(220, 0.45, 'sawtooth', 0.1, 0, 0.4); break;
    case 'click':   tone(1000, 0.04, 'sine', 0.035); break;
  }
}
function sfxAt(name, x, y){
  if(distXY(x, y, cam.x, cam.y) < 1300) sfx(name);
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
function autoAcquire(u){
  const R = u.atkRange + 70;
  const vis = e => isVisibleTo(u.team, e);
  const t = nearestEnemyOf(u, R, e => e.kind === 'hero' && vis(e)) ||
            nearestEnemyOf(u, R, e => (e.kind === 'creep' || (e.kind === 'neutral' && !e.returning && e.attackTarget)) && vis(e));
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
function playerCommandFor(h, wx, wy){
  if(!h || h.dead || gameOver) return;
  cancelTeleport(h);   // nova naredba prekida teleport
  for(const a of ancients){
    if(a && a.invuln && a.team !== h.team && distXY(wx, wy, a.x, a.y) < a.r + 26){
      addFloat(a.x, a.y, '🛡️ Prvo sruši čuvarske kule!', '#fff', 15);
    }
  }
  const t = pickEnemyAt(wx, wy, h.team) || pickDeniableAt(wx, wy, h);
  if(t){
    h.attackTarget = t;
    h.moveTarget = null;
    markers.push({ x: t.x, y: t.y, t: 0, color: t.team === h.team ? '#fde047' : '#f87171', r: t.r + 14 });
  } else {
    h.attackTarget = null;
    h.moveTarget = { x: clamp(wx, 40, WORLD - 40), y: clamp(wy, 40, WORLD - 40) };
    markers.push({ x: wx, y: wy, t: 0, color: '#4ade80', r: 22 });
  }
  if(h.isPlayer) sfx('click');
}
// igračeva naredba — lokalno ili preko mreže (gost)
function playerCommand(wx, wy){
  if(net.mode === 'guest'){
    if(!player || player.dead || gameOver) return;
    netCmd(wx, wy);
    sfx('click');
    return;
  }
  playerCommandFor(player, wx, wy);
}
function inRect(sx, sy, r){ return r && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h; }
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

  hudCv.addEventListener('mousedown', e => {
    if(ac() && AC.state === 'suspended') AC.resume();
    const sx = e.clientX, sy = e.clientY;
    if(!running || gameOver) return;
    if(e.button === 0){
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
      if(inRect(sx, sy, uiRects.tp)){
        if(net.mode === 'guest') netTp();
        else startTeleport(player);
        return;
      }
      if(inRect(sx, sy, uiRects.shop)){ toggleShop(); return; }
      if(inRect(sx, sy, uiRects.mute)){ muted = !muted; sfx('click'); return; }
      if(inRect(sx, sy, uiRects.help)){ toggleHelp(); return; }
    }
    if(e.button === 2){
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
      if(pendingCast && e.button === 0){
        castPending(w);
        return;
      }
      if(e.button === 2) playerCommand(w.x, w.y);
      else { cam.x = w.x; cam.y = w.y; cam.follow = false; miniDrag = true; }
      return;
    }
    // ciljanje moći: lijevi klik baca, desni odustaje
    if(pendingCast){
      if(e.button === 0) castPending(screenToWorld(sx, sy));
      else pendingCast = null;
      return;
    }
    const w = screenToWorld(sx, sy);
    playerCommand(w.x, w.y);
  });

  window.addEventListener('mouseup', e => {
    miniDrag = false;
    if(!invDrag || !player) return;
    const d = invDrag; invDrag = null;
    const N = CFG.inventorySlots;
    if(d.moved){   // ispušten na drugo mjesto: zamijeni / premjesti
      for(let j = 0; j < uiRects.inv.length; j++){
        if(j !== d.from && uiRects.inv[j] && inRect(e.clientX, e.clientY, uiRects.inv[j])){
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
    else addFloat(player.x, player.y, '🖱️ Povuci za premještanje • desni klik = prodaja', '#e5e7eb', 13);
  });

  hudCv.addEventListener('mousemove', e => {
    mouse.sx = e.clientX; mouse.sy = e.clientY;
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
    if(uiRects.passive && inRect(mouse.sx, mouse.sy, uiRects.passive)) hoverUi = { type: 'pas' };
    if(inRect(mouse.sx, mouse.sy, uiRects.statBtn)) hoverUi = { type: 'stat' };
    if(inRect(mouse.sx, mouse.sy, uiRects.tp)) hoverUi = { type: 'tp' };
    if(uiRects.glyph && inRect(mouse.sx, mouse.sy, uiRects.glyph)) hoverUi = { type: 'glyph' };
    if(inRect(mouse.sx, mouse.sy, uiRects.shop)) hoverUi = { type: 'shop' };
    if(inRect(mouse.sx, mouse.sy, uiRects.mute)) hoverUi = { type: 'mute' };
    if(inRect(mouse.sx, mouse.sy, uiRects.help)) hoverUi = { type: 'help' };
    hudCv.style.cursor = invDrag && invDrag.moved ? 'grabbing' : (hoverUi ? 'pointer' : 'crosshair');
    if(!invDrag || !invDrag.moved) updateHudTip();
  });

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
    if(k === ' '){ e.preventDefault(); cam.follow = true; if(player){ cam.x = player.x; cam.y = player.y; } }
    if(gameOver) return;
    if(k === 'q') pressAbility(0);
    if(k === 'w') pressAbility(1);
    if(k === 'e') pressAbility(2);
    if(k === 'r') pressAbility(3);
    if(k === 't'){ if(net.mode === 'guest') netTp(); else startTeleport(player); }
    if(k === 's' && player && !player.dead){
      if(net.mode === 'guest') netStop();
      else { player.moveTarget = null; player.attackTarget = null; cancelTeleport(player); }
    }
    if(k === 'b') toggleShop();
    if(k === 'h') toggleHelp();
    if(k === 'o'){ if(net.mode === 'guest') netBuyback(); else buyback(player); }
    if(k === 'f' && player){ if(net.mode === 'guest') netGlyph(); else useGlyph(player.team, player); }
    if(k === 'k'){ const on = togglePost(); feedMsg(on ? '✨ Efekti uključeni (sjaj, boje)' : '✨ Efekti isključeni', '#e5e7eb'); }
    if(k === 'g' && player){ chatOpen = !chatOpen; return; }
    if(k === 'v' && player){ if(net.mode === 'guest') netPing(mouse.wx, mouse.wy); else addPing(player, mouse.wx, mouse.wy); }
    if(chatOpen && k >= '1' && k <= '6'){
      const ci = parseInt(k, 10) - 1;
      if(net.mode === 'guest') netChat(ci); else sendChat(player, ci);
      chatOpen = false;
      return;
    }
    if(k >= '1' && k <= '6' && !e.ctrlKey && !e.metaKey) pressItem(parseInt(k, 10) - 1);
    if(k === 'tab') e.preventDefault();
    if(k === 'm'){ muted = !muted; }
    if(k === 'p'){ paused = !paused; document.getElementById('pause').classList.toggle('hidden', !paused); }
    if(k === 'escape'){
      if(chatOpen) chatOpen = false;
      else if(pendingCast) pendingCast = null;
      else if(shopOpen) toggleShop();
      else if(!document.getElementById('help').classList.contains('hidden')) toggleHelp();
    }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
}

/* ================= DOM: dućan, pomoć, odabir ================= */
function toggleHelp(){
  document.getElementById('help').classList.toggle('hidden');
}
/* dućan, ikone i opisi predmeta: shop.js */
function buildSelectScreen(){
  const cards = document.getElementById('cards');
  let html = '';
  HEROES.forEach((h, i) => {
    html += `<div class="card" id="card-${i}" data-r="${h.projSpeed > 0 ? 'R' : 'M'}" title="${h.name} — ${h.role}">
      <img class="c-img" src="assets/hero_${h.id}.jpg" alt="${h.emoji}"
        onerror="this.outerHTML='<div class=&quot;c-emoji&quot;>${h.emoji}</div>'">
      <div class="c-name">${h.name}</div>
      <div class="c-type">${h.projSpeed > 0 ? '🏹' : '⚔️'}</div>
    </div>`;
  });
  cards.innerHTML = html;
  HEROES.forEach((h, i) => {
    document.getElementById('card-' + i).addEventListener('click', () => { selectHero(i); sfx('click'); });
  });
  // filtar: svi / blizina / daljina
  document.querySelectorAll('#roleTabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#roleTabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('off', b.dataset.f !== 'all' && c.dataset.r !== b.dataset.f));
  }));
  document.getElementById('startBtn').addEventListener('click', () => {
    if(net.conn){ netReady(); return; }   // multiplayer: čekaj oba igrača
    if(selectedHero >= 0) startGame(selectedHero);
  });
  document.getElementById('randomBtn').addEventListener('click', () => {
    const vis = HEROES.map((h, i) => i).filter(i => !document.getElementById('card-' + i).classList.contains('off'));
    const i = vis[Math.floor(Math.random() * vis.length)];
    selectHero(i); sfx('click');
    document.getElementById('card-' + i).scrollIntoView({ block: 'nearest' });
  });
  document.getElementById('mpToggle').addEventListener('click', e => {
    const box = document.getElementById('mpBox');
    box.classList.toggle('hidden');
    e.currentTarget.classList.toggle('on', !box.classList.contains('hidden'));
  });
  document.getElementById('helpClose').addEventListener('click', toggleHelp);
  document.getElementById('againBtn').addEventListener('click', () => location.reload());
  selectHero(0);   // odmah je netko odabran — dovoljno je pritisnuti ZAIGRAJ
}
/* desna ploča: 3D model, uloga i 5 pločica (urođena pasiva + Q W E R); opis jedne po jednoj */
function selectHero(i){
  const h = HEROES[i];
  selectedHero = i;
  if(net.conn) netPick(i);   // multiplayer: javi prijatelju svoj odabir
  document.querySelectorAll('.card').forEach(c => c.classList.remove('sel'));
  document.getElementById('card-' + i).classList.add('sel');
  const primNames = { str: '💪 Snaga', agi: '🤸 Okretnost', int: '🧠 Pamet' };
  const chips = (h.projSpeed > 0 ? '<span class="chip chipR">🏹 Daljina</span>' : '<span class="chip chipM">⚔️ Blizina</span>') +
    '<span class="chip chipP">' + primNames[h.attrs.primary] + '</span>';
  const tiles = [];
  if(h.passive) tiles.push({ k: '✨', cls: 'pas', e: h.passive.emoji, name: h.passive.name, tag: '<span class="pasTag">✨ UROĐENO</span>',
    desc: h.passive.desc.replace(/^PASIVNO:\s*/, '') + ' (uvijek radi)' });
  for(const a of h.abilities) tiles.push({ k: a.key, cls: a.ult ? 'ult' : '', e: a.emoji, name: a.name,
    tag: a.ult ? '<span class="ultTag">🌟 ULTI</span>' : '', desc: a.desc.replace(/^ULTI:\s*/, '') });
  const det = document.getElementById('heroDetail');
  det.innerHTML = `<div class="d-top">
      <div class="d-model"><img class="d-img" src="assets/hero_${h.id}.jpg" onerror="this.remove()"></div>
      <div><div class="d-head">${h.emoji} <b>${h.name}</b></div><div class="d-role">${h.role}</div><div>${chips}</div></div>
    </div>
    <div class="d-abils">${tiles.map((t, j) => `<button class="ab ${t.cls}" data-j="${j}" title="${t.name}"><span class="ab-k">${t.k}</span>${t.e}</button>`).join('')}</div>
    <div class="d-desc"></div>`;
  const show = j => {
    const t = tiles[j];
    det.querySelectorAll('.ab').forEach(b => b.classList.toggle('on', +b.dataset.j === j));
    det.querySelector('.d-desc').innerHTML = `${t.e} <b>${t.name}</b> ${t.tag}<br>${t.desc}`;
  };
  det.querySelectorAll('.ab').forEach(b => {
    b.addEventListener('mouseenter', () => show(+b.dataset.j));
    b.addEventListener('click', () => show(+b.dataset.j));
  });
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

function barHeight(u){
  if(u.kind === 'hero') return 102;
  if(u.kind === 'barracks') return 150;
  if(u.kind === 'creep') return u.siege ? 72 : 62;
  if(u.kind === 'neutral') return u.boss ? 150 : u.r * 2.4 + 22;
  if(u.kind === 'tower') return 172;
  return 185;
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
      const nm = u.name + (u.isPlayer ? ' ⭐' : '');
      ctx.strokeText(nm, s.x, s.y - 12);
      ctx.fillStyle = '#fff';
      ctx.fillText(nm, s.x, s.y - 12);
      drawBar(s.x - 27, s.y - 10, 54, 7, u.hp / u.maxhp, u.team === myTeam ? '#22c55e' : '#ef4444');
      drawBar(s.x - 27, s.y - 2, 54, 4, u.maxmp ? u.mp / u.maxmp : 0, '#38bdf8');
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.arc(s.x + 36, s.y - 6, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.font = fontTxt(11, true);
      ctx.textBaseline = 'middle';
      ctx.fillText(u.level, s.x + 36, s.y - 5);
      if(u.tpChannel > 0){
        drawBar(s.x - 24, s.y + 6, 48, 6, 1 - u.tpChannel / 3, '#60a5fa');
        ctx.font = fontEmoji(12);
        ctx.fillText('🏠', s.x + 32, s.y + 9);
      }
    }
    else if(u.kind === 'creep'){
      drawBar(s.x - 16, s.y, 32, 5, u.hp / u.maxhp, TEAM_COLOR[u.team]);
    }
    else if(u.kind === 'neutral'){
      const w = u.boss ? 80 : 40;
      drawBar(s.x - w / 2, s.y, w, u.boss ? 8 : 5, u.hp / u.maxhp, '#f59e0b');
      if(u.boss){
        ctx.font = fontTxt(13, true);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText('🐲 Veliki Zmaj', s.x, s.y - 3);
        ctx.fillStyle = '#fde047';
        ctx.fillText('🐲 Veliki Zmaj', s.x, s.y - 3);
      }
    }
    else if(u.kind === 'tower'){
      drawBar(s.x - 42, s.y, 84, 8, u.hp / u.maxhp, TEAM_COLOR[u.team]);
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
    const s = worldToScreen(f.x, groundHeight(f.x, f.y) + f.h, f.y);
    if(!s) continue;
    ctx.globalAlpha = f.t < 0.7 ? 1 : 1 - (f.t - 0.7) / 0.4;
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

/* 💬 izbornik brzih poruka (G) */
function drawChatWheel(){
  uiRects.chat = null;
  if(!chatOpen || !player) return;
  const w = 210, rh = 26, x = 14, y = VH - hudLayout().ms - 60 - CHAT_LINES.length * rh;
  drawFrame(x, y - 30, w, CHAT_LINES.length * rh + 40, 10);
  ctx.font = fontTxt(13, true);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  ctx.fillText('💬 Brza poruka (1–6)', x + w / 2, y - 14);
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
  if(!bp.length) ctx.fillText('ruksak', x0 + 3, by + bh / 2);
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
function drawQuickBuy(HL){
  uiRects.qb = [];
  const list = quickBuyNext(player);
  if(!list || !list.length) return;
  const w = 40, h = 29, g = 4, n = Math.min(list.length, 6);
  const x0 = HL.cardX + HL.cardW - n * (w + g) - 6, y0 = HL.cardY - h - 36;
  ctx.font = fontTxt(10, true); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
  ctx.strokeText('📌 Brza kupnja', x0 - 6, y0 + h); ctx.fillStyle = '#fde68a'; ctx.fillText('📌 Brza kupnja', x0 - 6, y0 + h);
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
  const as = 52, gap = 6, cardW = 4 * as + 3 * gap + 24, cardH = 2 * as + gap + 24;
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
  const mm = Math.floor(gameTime / 60), ss = Math.floor(gameTime % 60);
  ctx.font = fontTxt(13, true);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText((isNight ? '🌙 ' : '☀️ ') + mm + ':' + (ss < 10 ? '0' : '') + ss, tx + tw / 2, 50);
  if(ancients[0]) drawBar(tx + 14, 56, 100, 8, ancients[0].hp / ancients[0].maxhp, TEAM_COLOR[0]);
  if(ancients[1]) drawBar(tx + tw - 114, 56, 100, 8, ancients[1].hp / ancients[1].maxhp, TEAM_COLOR[1]);
  ctx.font = fontEmoji(11);
  ctx.fillText('👑', tx + 8, 60);
  ctx.fillText('👑', tx + tw - 6, 60);

  // ----- kill feed -----
  ctx.textAlign = 'left';
  for(let i = 0; i < feed.length; i++){
    const f = feed[i];
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

  // ----- velika najava -----
  if(banner){
    const f = banner.t < 0.25 ? banner.t / 0.25 : (banner.t > banner.dur ? 1 - (banner.t - banner.dur) / 0.4 : 1);
    ctx.globalAlpha = clamp(f, 0, 1);
    ctx.textAlign = 'center';
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
      ctx.font = fontEmoji(15);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pv.emoji, cx, cy + 1);
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
    ctx.font = fontTxt(11, true);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('⚔️' + player.kills + ' 💀' + player.deaths + ' 🤝' + player.assists, bx + 86, py + 16);
    ctx.font = fontTxt(14, true);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.fillText('💰 ' + Math.floor(player.gold), bx + bw, py + 16);
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
      put('♥ +' + player.hpRegen.toFixed(1) + '/s', '#4ade80', py + 101);
      put('💧 +' + player.mpRegen.toFixed(1) + '/s', '#7dd3fc', py + 101);
    }

    // 🎒 torba 3×2 + ruksak 3 (kao u DotA): slika predmeta, hlađenje, punjenja, tipka; povuci = premjesti, desni klik = prodaj
    drawInventory(HL, py, ph);
    drawQuickBuy(HL);

    // moći (Q W E R) + atributi (📊) + teleport (T)
    uiRects.abil = [];
    const as = HL.as, gap = HL.gap;
    drawFrame(HL.cardX, HL.cardY, HL.cardW, HL.cardH, 10);   // naredbena kartica (Warcraft 3)
    const ax0 = HL.cardX + 12, ay = HL.cardY + 12, ay2 = ay + as + gap;
    if(pendingCast){
      ctx.font = fontTxt(13, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      const txt = '🎯 Klikni cilj • desni klik = odustani';
      ctx.strokeText(txt, ax0 + (4 * (as + gap) - gap) / 2, ay - 4);
      ctx.fillText(txt, ax0 + (4 * (as + gap) - gap) / 2, ay - 4);
    }
    else if(player.skillPoints > 0 && !player.dead){
      ctx.font = fontTxt(13, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#4ade80';
      const bob = Math.sin(gameTime * 5) * 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      const txt = '⬆️ Poen vještine! Klikni +';
      ctx.strokeText(txt, ax0 + (4 * (as + gap) - gap) / 2, ay - 4 + bob);
      ctx.fillText(txt, ax0 + (4 * (as + gap) - gap) / 2, ay - 4 + bob);
    }
    for(let i = 0; i < 4; i++){
      const ab = player.abilities[i];
      if(!ab) continue;
      const ax = ax0 + i * (as + gap);
      uiRects.abil.push({ x: ax, y: ay, w: as, h: as });
      const mxR = abilityMaxRank(ab);
      const unlearned = ab.rank === 0;
      const ultLocked = ab.def.ult && unlearned && player.level < CFG.ultLevels[0];
      const noMana = player.mp < ab.def.mana;
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
      ctx.fillText(ab.def.emoji, ax + as / 2, ay + as / 2 - 6);
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
          ctx.fillText('✨ pasiv', ax + as / 2 + 6, ay + 10);
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
        drawBar(tr.x + 4, tr.y + tr.h - 9, tr.w - 8, 5, 1 - player.tpChannel / 3, '#60a5fa');
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
      ctx.fillText('F', gr.x + gr.w - 7, gr.y + 8);
      ctx.fillStyle = '#93c5fd';
      ctx.font = fontTxt(10, true);
      ctx.fillText('T', tr.x + 8, tr.y + 9);
    }

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
    for(const [em, r] of [[muted ? '🔇' : '🔊', uiRects.mute], ['❓', uiRects.help]]){
      drawFrame(r.x, r.y, r.w, r.h, 7);
      ctx.font = fontEmoji(16);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(em, r.x + r.w / 2, r.y + r.h / 2 + 1);
    }

    // opisi (moći, pasiva, atributi, glif…) su DOM opisi u stilu DotA: shop.js updateHudTip()

    // nišan dok ciljaš
    if(pendingCast && !player.dead){
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(mouse.sx, mouse.sy, 14, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouse.sx - 22, mouse.sy); ctx.lineTo(mouse.sx - 8, mouse.sy);
      ctx.moveTo(mouse.sx + 8, mouse.sy); ctx.lineTo(mouse.sx + 22, mouse.sy);
      ctx.moveTo(mouse.sx, mouse.sy - 22); ctx.lineTo(mouse.sx, mouse.sy - 8);
      ctx.moveTo(mouse.sx, mouse.sy + 8); ctx.lineTo(mouse.sx, mouse.sy + 22);
      ctx.stroke();
    }

    // oživljavanje + otkup (buyback)
    // 🎓 talent: izbor jednog od dva bonusa (level 10 / 15)
    uiRects.talent = null;
    const ptal = !player.dead ? pendingTalent(player) : null;
    if(ptal){
      const pw = 470, ph = 62, px0 = VW / 2 - pw / 2, py0 = 76;
      ctx.fillStyle = 'rgba(30,27,75,0.94)';
      ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.fill();
      ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.stroke();
      ctx.font = fontTxt(13, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e9d5ff';
      ctx.fillText('🎓 Talent (level ' + ptal.lvl + ') — odaberi jedan bonus:', px0 + pw / 2, py0 + 14);
      const bw = 215, bh = 30, by = py0 + 27;
      const ra = { x: px0 + 14, y: by, w: bw, h: bh }, rb = { x: px0 + pw - 14 - bw, y: by, w: bw, h: bh };
      uiRects.talent = { lvl: ptal.lvl, a: ra, b: rb };
      for(const [r, t] of [[ra, ptal.a], [rb, ptal.b]]){
        const hov = inRect(mouse.sx, mouse.sy, r);
        ctx.fillStyle = hov ? '#7c3aed' : '#4c1d95';
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 9); ctx.fill();
        ctx.strokeStyle = hov ? '#fde047' : '#a78bfa'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 9); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = fontTxt(13, true);
        ctx.fillText(t.emoji + ' ' + t.txt, r.x + r.w / 2, r.y + r.h / 2);
      }
    }
    uiRects.buyback = null;
    if(player.dead && !gameOver){   // na kraju igre ne prekrivaj završni ekran
      ctx.fillStyle = 'rgba(15,23,42,0.45)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center';
      ctx.font = fontTxt(36, true);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 6;
      ctx.strokeText('⏳ Oživljavaš za ' + Math.ceil(player.deadT) + 's', VW / 2, VH * 0.42);
      ctx.fillStyle = '#fff';
      ctx.fillText('⏳ Oživljavaš za ' + Math.ceil(player.deadT) + 's', VW / 2, VH * 0.42);
      if(!player.reviveAt){
        const cost = buybackCost(player);
        const can = player.buybackCd <= 0 && player.gold >= cost;
        const br = { x: VW / 2 - 130, y: VH * 0.42 + 30, w: 260, h: 44 };
        uiRects.buyback = br;
        ctx.fillStyle = can ? '#b45309' : '#334155';
        ctx.beginPath(); ctx.roundRect(br.x, br.y, br.w, br.h, 12); ctx.fill();
        ctx.strokeStyle = can ? '#fde047' : '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(br.x, br.y, br.w, br.h, 12); ctx.stroke();
        ctx.font = fontTxt(17, true);
        ctx.textBaseline = 'middle';
        ctx.fillStyle = can ? '#fff' : '#94a3b8';
        ctx.fillText(player.buybackCd > 0 ? '⏱️ Otkup za ' + Math.ceil(player.buybackCd) + ' s' : '💰 Otkup odmah (' + cost + ' zlata, tipka O)', br.x + br.w / 2, br.y + br.h / 2);
      }
    }
  }
  if(keys['tab']) drawScoreboard();

  // ----- minimapa -----
  const ML = hudLayout();
  drawMinimap(ML.ms, ML.mx, ML.my);
}

/* ================= Tablica rezultata (Tab) ================= */
function drawScoreboard(){
  const heroes = units.filter(u => u.kind === 'hero');
  const w = Math.min(760, VW - 20), rowH = 34, h = 64 + 2 * 24 + heroes.length * rowH + 14;
  const x = (VW - w) / 2, y = Math.max(70, VH * 0.46 - h / 2);
  drawFrame(x, y, w, h, 12);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = fontTxt(18, true); ctx.fillStyle = '#f3d48a';
  ctx.fillText('📋 Tablica  (drži Tab)', x + w / 2, y + 22);
  const k = w / 760;   // stupci se skupljaju na uskom ekranu
  const C = { lvl: 200, kda: 268, lh: 352, nw: 430, items: 488 };
  for(const c in C) C[c] *= k;
  ctx.font = fontTxt(10.5, true); ctx.fillStyle = '#c9b27a';
  for(const [t, cx] of [['LVL', C.lvl], ['K / D / A', C.kda], ['LH / DN', C.lh], ['NETO', C.nw]]) ctx.fillText(t, x + cx, y + 46);
  ctx.textAlign = 'left'; ctx.fillText('PREDMETI', x + C.items, y + 46);
  let ry = y + 58;
  for(const team of [TEAM_BLUE, TEAM_RED]){
    ctx.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.28)' : 'rgba(239,68,68,0.28)';
    ctx.fillRect(x + 10, ry, w - 20, 22);
    ctx.font = fontTxt(12, true); ctx.textAlign = 'left'; ctx.fillStyle = team === TEAM_BLUE ? '#bfdbfe' : '#fecaca';
    ctx.fillText((team === TEAM_BLUE ? '🔵 Sentinel' : '🔴 Scourge') + '   ⚔️ ' + kills[team], x + 18, ry + 11);
    ry += 24;
    for(const hh of heroes.filter(u => u.team === team).sort((a, b) => netWorth(b) - netWorth(a))){
      const cy = ry + rowH / 2;
      if(hh.isPlayer){ ctx.fillStyle = 'rgba(253,224,71,0.12)'; ctx.fillRect(x + 10, ry + 1, w - 20, rowH - 2); }
      const pim = GFX.heroes[hh.hero.id];
      if(imgReady(pim)){ ctx.save(); ctx.globalAlpha = hh.dead ? 0.4 : 1; ctx.drawImage(pim, x + 16, ry + 3, rowH - 6, rowH - 6); ctx.restore(); }
      else { ctx.font = fontEmoji(16); ctx.textAlign = 'center'; ctx.fillText(hh.emoji, x + 30, cy); }
      ctx.textAlign = 'left'; ctx.font = fontTxt(13, true); ctx.fillStyle = TEAM_LIGHT[hh.team];
      ctx.fillText(hh.name + (hh.dead ? ' 💀' : '') + (hh.aegis ? ' 🛡️' : '') + (hh.isPlayer ? ' (TI)' : ''), x + 20 + rowH, cy);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText(hh.level, x + C.lvl, cy);
      ctx.fillText(hh.kills + ' / ' + hh.deaths + ' / ' + hh.assists, x + C.kda, cy);
      ctx.fillStyle = '#cbd5e1'; ctx.fillText((hh.lastHits || 0) + ' / ' + (hh.denies || 0), x + C.lh, cy);
      ctx.fillStyle = '#fde047'; ctx.fillText(netWorth(hh), x + C.nw, cy);
      const iw = Math.round(34 * Math.min(1, k + 0.15)), ih = Math.round(iw * 0.73);
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
      } else {
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(ux, uy, 2.2, 0, TAU); ctx.fill();
      }
    } else {
      ctx.fillStyle = TEAM_COLOR[u.team];
      ctx.strokeStyle = u.isPlayer ? '#fde047' : '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ux, uy, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
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

/* ================= Glavna petlja ================= */
let lastT = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.05);
  if(running && !paused && !gameOver){
    if(net.mode === 'guest') guestFrame(dt);   // gost ne simulira — prima snapshotte
    else update(dt);
  }
  if(net.mode === 'host') maybeSendSnapshot(now);

  applyDayNight(gameTime);
  updateCamera3();
  if(running) syncScene(now / 1000);
  render3D();

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  if(running){
    drawWorldOverlay();
    drawHud();
    drawChatWheel();
  }
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
    el.textContent = '⚠️ Greška: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')';
  }
});

window.addEventListener('DOMContentLoaded', () => {
  glCanvas = document.getElementById('game');
  hudCv = document.getElementById('hud');
  ctx = hudCv.getContext('2d');
  loadGameArt();
  fogCanvas = document.createElement('canvas');
  fogCanvas.width = fogCanvas.height = 256;
  fogCtx = fogCanvas.getContext('2d');
  initScene3D(glCanvas);
  setFogCanvas(fogCanvas);
  resize();
  window.addEventListener('resize', resize);
  buildSelectScreen();
  buildShopDom();
  setupInput();
  initNetUI();
  requestAnimationFrame(frame);
});
