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
const LANE_REV = {};
for(const l of LANE_LIST) LANE_REV[l] = LANE_PTS[l].slice().reverse();
function lanePath(team, lane){ return team === TEAM_BLUE ? LANE_PTS[lane] : LANE_REV[lane]; }

const FOUNTAIN = [{ x: 150, y: 2850 }, { x: 2850, y: 150 }];
const ANCIENT_POS = [{ x: 320, y: 2680 }, { x: 2680, y: 320 }];
const GUARD_POS = [
  [[470, 2640], [360, 2530]],
  [[2530, 360], [2640, 470]],
];
const TOWER_FRACS = [[0.36, 0.16], [0.64, 0.84]];

// VISINA TERENA: rijeka = nizina (0), polje = 40, platoi baza = 80
function groundHeight(x, y){
  const dRiver = Math.abs(x - y) / Math.SQRT2;
  let h = smoothstep(70, 300, dRiver) * 40;
  const dBase = Math.min(distXY(x, y, ANCIENT_POS[0].x, ANCIENT_POS[0].y),
                         distXY(x, y, ANCIENT_POS[1].x, ANCIENT_POS[1].y));
  h += (1 - smoothstep(500, 780, dBase)) * 40;
  return h;
}

/* ================= MAGLA RATA (fog of war) =================
   Svaki tim vidi samo oko svojih jedinica; noću je vid kraći.
   visGrid = mreža vidljivosti po timu, fogCanvas = vizualna magla. */
const VIS_N = 48;
const visGrid = [new Uint8Array(VIS_N * VIS_N), new Uint8Array(VIS_N * VIS_N)];
let visionTimer = 0;
let fogCanvas = null, fogCtx = null;

function visionRange(u){
  const base = u.kind === 'hero' ? 950 : (u.kind === 'tower' || u.kind === 'ancient' ? 900 : 750);
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
  }
  // vizualna magla za igračev tim
  if(fogCtx){
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.clearRect(0, 0, 256, 256);
    fogCtx.fillStyle = 'rgba(8,13,28,0.62)';
    fogCtx.fillRect(0, 0, 256, 256);
    fogCtx.globalCompositeOperation = 'destination-out';
    const s = 256 / WORLD;
    const night = isNight ? 0.65 : 1;
    for(const u of units){
      if(u.team !== TEAM_BLUE || u.dead || u.removeMe) continue;
      const r = visionRange(u) * s;
      const gr = fogCtx.createRadialGradient(u.x * s, u.y * s, r * 0.55, u.x * s, u.y * s, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      fogCtx.fillStyle = gr;
      fogCtx.beginPath(); fogCtx.arc(u.x * s, u.y * s, r, 0, TAU); fogCtx.fill();
    }
    const fr = 800 * night * s;
    const fgr = fogCtx.createRadialGradient(FOUNTAIN[0].x * s, FOUNTAIN[0].y * s, fr * 0.55, FOUNTAIN[0].x * s, FOUNTAIN[0].y * s, fr);
    fgr.addColorStop(0, 'rgba(0,0,0,1)');
    fgr.addColorStop(1, 'rgba(0,0,0,0)');
    fogCtx.fillStyle = fgr;
    fogCtx.beginPath(); fogCtx.arc(FOUNTAIN[0].x * s, FOUNTAIN[0].y * s, fr, 0, TAU); fogCtx.fill();
    fogCtx.globalCompositeOperation = 'source-over';
    markFogDirty();
  }
}
function isVisibleTo(team, u){
  if(team === TEAM_NEUTRAL || u.team === team) return true;
  const cs = WORLD / VIS_N;
  const gx = clamp(Math.floor(u.x / cs), 0, VIS_N - 1);
  const gy = clamp(Math.floor(u.y / cs), 0, VIS_N - 1);
  return visGrid[team][gy * VIS_N + gx] === 1;
}
// mobilni neprijatelji su skriveni u magli; kule i prijestoli se uvijek vide
function seenByPlayer(u){
  if(u.kind === 'hero' && u.status.invisT > 0 && u.team !== TEAM_BLUE) return false;  // nevidljivost
  if(u.team === TEAM_BLUE || u.kind === 'tower' || u.kind === 'ancient') return true;
  return isVisibleTo(TEAM_BLUE, u);
}

/* ================= Globalno stanje ================= */
let glCanvas, hudCv, ctx, terrainCanvas;
let VW = 800, VH = 600, DPR = 1;
let units = [], projectiles = [], zones = [], particles = [], lines = [], floats = [], markers = [], feed = [];
let trees = [];
let camps = [];
let runes = [];
let runeTimer = CFG.runeEvery, runeSpotI = 0;
let isNight = false;
let player = null;
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
let uiRects = { abil: [], learn: [], inv: [], tp: null, mini: null, shop: null, mute: null, help: null };
let hoverUi = null;
let miniDrag = false;
let nextId = 1;
let selectedHero = -1;
let sfxLast = {};

/* ================= Jedinice ================= */
function baseStatus(){
  return { slowT: 0, slowF: 0, stun: 0, rootT: 0, shieldT: 0, shieldF: 0,
    hasteT: 0, hasteF: 1, dmgMulT: 0, dmgMulF: 1, invisT: 0 };
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
    kills: 0, deaths: 0, streak: 0, items: [], buildI: 0,
    itemBonus: { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 },
    abilities: def.abilities.map(a => ({ def: a, cd: 0, rank: 0 })),
    isPlayer: !!isPlayer, lane,
    bot: isPlayer ? null : { state: 'lane', thinkT: rand(0.2, 0.8) },
    deadT: 0,
  });
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

function makeTower(team, x, y, lane, tier, isGuard){
  return makeUnit({
    kind: 'tower', team, x, y, r: 38,
    hp: 1900, maxhp: 1900,
    dmg: 108, atkRange: 390, atkCd: 1.0, projSpeed: 640,
    speed: 0, isStatic: true,
    lane: lane || null, tier: tier || 0, isGuard: !!isGuard,
  });
}

function makeAncient(team){
  const p = ANCIENT_POS[team];
  const u = makeUnit({
    kind: 'ancient', team, x: p.x, y: p.y, r: 56,
    hp: 3200, maxhp: 3200,
    dmg: 0, atkRange: 0, speed: 0, isStatic: true, invuln: true,
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
      emoji: t.emoji, name: t.name, boss: !!t.boss, camp: c,
      scanT: rand(0, 0.4),
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
    if(e.kind === 'hero' && e.status.invisT > 0) continue;   // nevidljivi se ne ciljaju
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
    if(e.status.invisT > 0) continue;       // nevidljivost
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
  if(st.slowT <= 0 || f >= st.slowF){ st.slowF = f; st.slowT = Math.max(st.slowT, dur); }
}
function applyStun(t, dur){ t.status.stun = Math.max(t.status.stun, dur); }
function applyRoot(t, dur){ t.status.rootT = Math.max(t.status.rootT, dur); }
function applyShield(t, f, dur){ t.status.shieldT = dur; t.status.shieldF = f; }
function applyHaste(t, f, dur){ t.status.hasteT = dur; t.status.hasteF = f; }
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
function applyDamage(t, amount, src){
  if(!t || t.dead || t.removeMe || t.invuln || gameOver) return;
  const st = t.status;
  const kz = passiveRank(t, 'koza');                 // Lavlja koža: pasivno smanjenje štete
  if(kz) amount *= 1 - (0.03 + 0.03 * kz);
  if(st.shieldT > 0) amount *= (1 - st.shieldF);
  amount = Math.max(1, Math.round(amount));
  t.hp -= amount;
  t.flash = 0.12;
  if(t.kind === 'hero' || t.kind === 'tower' || t.kind === 'ancient' || (src && src.isPlayer)){
    addFloat(t.x, t.y, '-' + amount, src && src.team === TEAM_BLUE ? '#ffd166' : '#ff8fa3', t.kind === 'hero' ? 16 : 13);
  }
  if(src && src.kind === 'hero' && !src.dead) t.lastHitter = src;
  if((t.kind === 'creep' || t.kind === 'neutral') && src && !src.dead && !src.removeMe && src.team !== t.team){
    if(!isTargetable(t.attackTarget) && dist(t, src) < 620) t.attackTarget = src;
  }
  if(t.hp <= 0) kill(t, src);
}

function kill(t, src){
  t.hp = 0;
  if(t.kind === 'creep'){
    t.removeMe = true;
    burst(t.x, t.y, TEAM_LIGHT[t.team], 8, 130, 5);
    if(src && src.kind === 'hero' && !src.dead){
      src.gold += t.goldValue;
      if(src.isPlayer) addFloat(t.x, t.y, '+' + t.goldValue + ' 💰', '#fde047', 15);
    }
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h.team !== TEAM_NEUTRAL && !h.dead && dist(h, t) < CFG.xpRadius)
        giveXp(h, t.xpValue || CFG.creepXp);
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
      if(src.isPlayer) addFloat(t.x, t.y, '+' + t.goldValue + ' 💰', '#fde047', 15);
      for(const h of units){
        if(h.kind === 'hero' && h.team === src.team && !h.dead && dist(h, t) < CFG.xpRadius)
          giveXp(h, t.xpValue);
      }
      if(t.boss){
        feedMsg('🐲 ' + src.emoji + ' ' + src.name + ' je porazio Velikog Zmaja!', '#fde047');
        announce('🐲 Veliki Zmaj je poražen!', src.emoji + ' ' + src.name + ' dobiva Zmajev blagoslov!');
        for(const h of units){
          if(h.kind === 'hero' && h.team === src.team) h.gold += 200;
        }
        src.status.dmgMulT = Math.max(src.status.dmgMulT, 60);
        src.status.dmgMulF = Math.max(src.status.dmgMulF, 1.3);
        applyHaste(src, 1.15, 60);
        addFloat(src.x, src.y, '🐲 Zmajev blagoslov!', '#fde047', 17);
        sfx('kill');
      }
    }
  }
  else if(t.kind === 'hero'){
    t.dead = true;
    t.deaths++;
    kills[1 - t.team]++;
    t.deadT = CFG.respawnBase + t.level * CFG.respawnPerLvl;
    t.moveTarget = null; t.attackTarget = null;
    t.tpChannel = 0;
    t.status = baseStatus();
    burst(t.x, t.y, TEAM_COLOR[t.team], 26, 240, 7);
    burst(t.x, t.y, '#fff', 10, 160, 4);
    let killerName = '🏰 Toranj';
    let milestoneAnn = false;
    t.streak = 0;
    if(src && src.kind === 'hero'){
      src.kills++;
      src.streak = (src.streak || 0) + 1;
      src.gold += CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl;
      giveXp(src, CFG.heroKillXp + t.level * 15);
      killerName = src.emoji + ' ' + src.name;
      if(src.isPlayer) addFloat(src.x, src.y, '+' + (CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl) + ' 💰', '#fde047', 17);
      if(src.streak === 3){ announce('🔥 ' + src.emoji + ' ' + src.name + ' divlja!', '3 ubojstva zaredom!'); milestoneAnn = true; }
      else if(src.streak === 5){ announce('⚡ ' + src.emoji + ' ' + src.name + ' je NEZAUSTAVLJIV!', '5 ubojstava zaredom!'); milestoneAnn = true; }
    } else if(src && src.kind === 'creep') killerName = '⚔️ Vojnici';
    else if(src && src.kind === 'neutral') killerName = src.emoji + ' ' + src.name;
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
    feedMsg('🏰 Srušen toranj tima ' + TEAM_NAME[t.team] + '!', TEAM_COLOR[1 - t.team]);
    announce('🏰 BUM!', 'Toranj tima ' + TEAM_NAME[t.team] + ' je srušen!');
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h.team !== TEAM_NEUTRAL){
        h.gold += CFG.towerGoldTeam;
        if(h.isPlayer) addFloat(h.x, h.y, '+' + CFG.towerGoldTeam + ' 💰', '#fde047', 15);
        if(!h.dead && dist(h, t) < 800) giveXp(h, CFG.towerXp);
      }
    }
    if(t.isGuard){
      const stillGuarded = units.some(x => x.kind === 'tower' && x.isGuard && x.team === t.team && !x.removeMe && x !== t);
      if(!stillGuarded && ancients[t.team]){
        ancients[t.team].invuln = false;
        announce('⚠️ Prijestol tima ' + TEAM_NAME[t.team] + ' je ranjiv!', 'Napadnite ga!');
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
  const d = h.hero;
  h.maxhp += d.hpG; h.hp += d.hpG;
  h.maxmp += d.mpG; h.mp += d.mpG;
  h.dmg += d.dmgG;
  h.hpRegen += 0.18; h.mpRegen += 0.12;
  h.skillPoints++;
  addFloat(h.x, h.y, 'LEVEL ' + h.level + '! ⬆️', '#fde047', 18);
  burst(h.x, h.y, '#fde047', 18, 200, 6);
  if(h.bot) botSpendPoints(h);
  if(h.isPlayer){
    sfx('levelup');
    if(h.level === CFG.ultLevels[0]) announce('🌟 ULTI dostupan!', 'Pritisni R ili klikni + da ga naučiš!');
  }
}

function abilityMaxRank(ab){ return ab.def.ult ? 2 : 4; }
function canLearn(h, i){
  const ab = h.abilities[i];
  if(!ab) return false;
  if(ab.rank >= abilityMaxRank(ab)) return false;
  if(ab.def.ult && h.level < CFG.ultLevels[ab.rank]) return false;
  return true;
}
function learnAbility(h, i){
  if(h.skillPoints <= 0 || !canLearn(h, i)) return false;
  const ab = h.abilities[i];
  h.skillPoints--;
  ab.rank++;
  if(h.isPlayer){
    addFloat(h.x, h.y, ab.def.emoji + ' ' + ab.def.name + ' — rang ' + ab.rank + '!', '#a7f3d0', 15);
    sfx('buy');
  }
  return true;
}
function botSpendPoints(h){
  let guard = 0;
  while(h.skillPoints > 0 && guard++ < 10){
    let idx = -1;
    if(canLearn(h, 3)) idx = 3;
    else {
      let bs = -1;
      for(let i = 0; i < 3; i++){
        if(!canLearn(h, i)) continue;
        const score = (4 - h.abilities[i].rank) * 10 - i * 3;
        if(score > bs){ bs = score; idx = i; }
      }
    }
    if(idx < 0) break;
    learnAbility(h, idx);
  }
}

/* ================= Moći ================= */
function spawnSkillshot(u, aim, o){
  let dx = aim.x - u.x, dy = aim.y - u.y;
  let L = Math.hypot(dx, dy);
  if(L < 1){ dx = Math.cos(u.dir || 0); dy = Math.sin(u.dir || 0); L = 1; }
  projectiles.push({
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
    kind: 'homing', x: src.x, y: src.y, target,
    speed: o.speed, dmg: o.dmg, src, team: src.team,
    color: o.color || '#fff', emoji: o.emoji || null, r: o.r || 6,
    onHit: o.onHit || null, miss: !!o.miss,
  });
}
function spawnZone(u, aim, o){
  const p = clampRange(u, aim, o.castRange || 600);
  zones.push({
    x: p.x, y: p.y, r: o.r, team: u.team, src: u,
    delay: o.delay || 0.5, ticksLeft: o.ticks || 1, interval: o.interval || 0.7,
    dmg: o.dmg, slow: o.slow || null, root: o.root || 0, stun: o.stun || 0,
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

function castAbility(u, i, aim){
  if(!u || u.dead || gameOver) return;
  const ab = u.abilities[i];
  if(!ab) return;
  if(u.tpChannel > 0) cancelTeleport(u);   // bacanje moći prekida teleport
  if(u.status.invisT > 0 && !ab.def.passive) u.status.invisT = 0;   // i nevidljivost
  if(ab.def.passive && ab.rank > 0){
    if(u.isPlayer) addFloat(u.x, u.y, '✨ Pasivna moć — radi sama!', '#e5e7eb', 13);
    return;
  }
  if(ab.rank <= 0){
    if(u.isPlayer){
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
  if(u.mp < ab.def.mana){
    if(u.isPlayer) addFloat(u.x, u.y, 'Nema mane! 💧', '#7dd3fc', 14);
    return;
  }
  const ok = ab.def.cast(u, aim || { x: u.x + Math.cos(u.dir || 0) * 200, y: u.y + Math.sin(u.dir || 0) * 200 }, ab.rank);
  if(ok === false){
    if(u.isPlayer) addFloat(u.x, u.y, 'Nema mete! 🤔', '#e5e7eb', 13);
    return;
  }
  u.mp -= ab.def.mana;
  ab.cd = ab.def.cd;
  sfxAt(ab.def.ult ? 'ult' : 'cast', u.x, u.y);
}

/* ================= Teleport kući (T) ================= */
function startTeleport(h){
  if(!h || h.dead || gameOver || h.tpChannel > 0) return;
  if(h.tpCd > 0){
    if(h.isPlayer){ addFloat(h.x, h.y, 'Teleport se još puni! ⏱️', '#e5e7eb', 13); sfx('click'); }
    return;
  }
  if(distXY(h.x, h.y, FOUNTAIN[h.team].x, FOUNTAIN[h.team].y) < 400){
    if(h.isPlayer) addFloat(h.x, h.y, 'Već si kod kuće! 🏠', '#e5e7eb', 13);
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
function passiveRank(h, pid){
  if(h.kind !== 'hero') return 0;
  for(const ab of h.abilities) if(ab.def.pid === pid) return ab.rank;
  return 0;
}

// igračev tok: moći s ciljem prvo pokažu domet, pa se klikom baca
function pressAbility(i, aimInstant){
  if(!player || player.dead || gameOver) return;
  const ab = player.abilities[i];
  if(!ab) return;
  if(ab.rank <= 0){ castAbility(player, i, null); return; }
  if(ab.def.target === 'point'){
    if(pendingCast && pendingCast.i === i){
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
  u.atkTimer = u.atkCd / (u.status.hasteT > 0 ? u.status.hasteF : 1);
  if(Math.abs(t.x - u.x) > 2) u.face = t.x < u.x ? -1 : 1;
  u.dir = Math.atan2(t.y - u.y, t.x - u.x);
  if(u.status.invisT > 0) u.status.invisT = 0;   // napad prekida nevidljivost
  // AGGRO: kula brani svog junaka — napadneš li junaka ispod kule, kula gađa TEBE!
  if(u.kind === 'hero' && t.kind === 'hero'){
    for(const tw of units){
      if(tw.kind !== 'tower' || tw.team !== t.team || tw.removeMe) continue;
      if(dist(tw, u) <= tw.atkRange + u.r + 40){
        tw.attackTarget = u;
        if(u.isPlayer && tw.warnedTgt !== u) addFloat(u.x, u.y, '⚠️ Toranj te gađa!', '#fca5a5', 15);
        tw.warnedTgt = u;
      }
    }
  }
  let dmg = u.dmg;
  if(u.status.dmgMulT > 0) dmg *= u.status.dmgMulF;
  // pasivne moći napadača
  let crit = false;
  const oko = passiveRank(u, 'oko');                 // Oštro oko: kritični pogodak
  if(oko && Math.random() < 0.15){ dmg *= 1.25 + 0.25 * oko; crit = true; }
  const dodir = passiveRank(u, 'dodir');             // Ledeni dodir: usporenje na napad
  const naboj = passiveRank(u, 'naboj');             // Statički naboj: munja na napad
  const onHitFx = (tt) => {
    if(crit) addFloat(tt.x, tt.y, 'KRIT! 💥', '#fb923c', 15);
    if(dodir) applySlow(tt, 0.1 + 0.05 * dodir, 1.5);
    if(naboj && Math.random() < 0.15 + 0.05 * naboj){
      applyDamage(tt, 30 + 25 * naboj, u);
      addLine(u.x, u.y, tt.x, tt.y, '#fde047', 4, 0.2);
      sfxAt('zap', u.x, u.y);
    }
  };
  // pucanje uzbrdo zna promašiti — visinska prednost kao u DotA!
  const miss = (groundHeight(t.x, t.y) - groundHeight(u.x, u.y) > 25) &&
    Math.random() < CFG.uphillMissChance;
  if(u.projSpeed > 0){
    spawnHoming(u, t, {
      speed: u.projSpeed, dmg, miss,
      onHit: miss ? null : onHitFx,
      color: u.kind === 'tower' ? '#fbbf24' : TEAM_LIGHT[u.team],
      r: u.kind === 'tower' ? 9 : 6,
    });
    sfxAt('pew', u.x, u.y);
  } else {
    if(miss){
      if(u.kind === 'hero' || t.kind === 'hero')
        addFloat(t.x, t.y, 'Promašaj! 💨', '#e5e7eb', 13);
    } else {
      applyDamage(t, dmg, u);
      onHitFx(t);
    }
    sfxAt('hit', u.x, u.y);
  }
}

/* ================= AI: vojnici ================= */
function creepThink(u){
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > 700) u.attackTarget = null;
  if(!u.attackTarget){
    const e = nearestEnemyOf(u, 470, x => x.kind !== 'neutral');
    if(e) u.attackTarget = e;
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

/* ================= AI: kule ================= */
function towerThink(u){
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > u.atkRange + u.attackTarget.r + 30 ||
     (u.attackTarget.kind === 'hero' && u.attackTarget.status.invisT > 0))
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
      case 'shot':
      case 'zone':
        if(eh && dEh < hint.range) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
    }
  }
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
  if(u.hp < u.maxhp * 0.3){
    b.state = 'retreat';
    u.attackTarget = null;
    u.moveTarget = { x: fountain.x, y: fountain.y };
    return;
  }
  botShopping(u);
  const eh = nearestEnemyOf(u, 620, e => e.kind === 'hero');
  botUseAbilities(u, eh);

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
  const anc = ancients[1 - u.team];
  if(isTargetable(anc) && dist(u, anc) < 700){
    u.attackTarget = anc;
    return;
  }
  const lh = lowestHpEnemyCreep(u, 500);
  if(lh){ u.attackTarget = lh; return; }
  const et = nearestEnemyOf(u, 520, e => e.kind === 'tower');
  if(et && countOwnCreepsNear(u.team, et, 350) > 0){
    u.attackTarget = et;
    return;
  }
  if(!eh && u.hp > u.maxhp * 0.55){
    const ec = nearestEnemyOf(u, 750, e => e.kind === 'creep');
    if(!ec){
      const nb = nearestEnemyOf(u, 850, e => e.kind === 'neutral' &&
        (!e.boss || (u.level >= 8 && u.hp > u.maxhp * 0.8)));
      if(nb){ u.attackTarget = nb; return; }
    }
  }
  u.attackTarget = null;
  const fp = laneFront(u.team, u.lane);
  if(dist(u, fp) > 150) u.moveTarget = fp;
  else u.moveTarget = null;
}

/* ================= Predmeti i recepti ================= */
function recomputeItemStats(h){
  const nb = { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 };
  for(const it of h.items){
    const s = it.stats || {};
    for(const k in nb) if(s[k]) nb[k] += s[k];
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
}
function itemFullCost(item){
  let c = item.cost;
  if(item.components) for(const cid of item.components) c += itemFullCost(ITEM_BY_ID[cid]);
  return c;
}
function planPurchase(h, item){
  const inv = h.items.map(it => it.id);
  let cost = item.cost;
  function needComp(id){
    const idx = inv.indexOf(id);
    if(idx >= 0){ inv.splice(idx, 1); return; }
    const def = ITEM_BY_ID[id];
    cost += def.cost;
    if(def.components) for(const c of def.components) needComp(c);
  }
  if(item.components) for(const c of item.components) needComp(c);
  const slotsOk = inv.length + 1 <= CFG.inventorySlots;
  let tagOk = true;
  if(item.tag) tagOk = !inv.some(id => ITEM_BY_ID[id].tag === item.tag);
  return { cost, inv, slotsOk, tagOk, ok: slotsOk && tagOk };
}
function doPurchase(h, item, plan){
  h.items = plan.inv.map(id => ITEM_BY_ID[id]);
  h.items.push(item);
  h.gold -= plan.cost;
  recomputeItemStats(h);
}
function firstMissingLeaf(h, item){
  const inv = h.items.map(it => it.id);
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
  let guard = 0;
  while(guard++ < 5 && u.buildI < BOT_BUILD.length){
    const target = ITEM_BY_ID[BOT_BUILD[u.buildI]];
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
function tryBuy(item){
  if(!player || gameOver) return;
  if(item.instant){
    if(player.gold < item.cost){
      addFloat(player.x, player.y, 'Nemaš dovoljno zlata! 💰', '#fca5a5', 14);
      sfx('click');
      return;
    }
    player.gold -= item.cost;
    heal(player, item.heal);
    sfx('buy');
    refreshShop();
    return;
  }
  const plan = planPurchase(player, item);
  if(!plan.tagOk){ addFloat(player.x, player.y, 'Već imaš čizme! 😄', '#e5e7eb', 14); return; }
  if(!plan.slotsOk){ addFloat(player.x, player.y, 'Torba je puna! 🎒', '#fca5a5', 14); return; }
  if(player.gold < plan.cost){
    addFloat(player.x, player.y, 'Nemaš dovoljno zlata! 💰', '#fca5a5', 14);
    sfx('click');
    return;
  }
  doPurchase(player, item, plan);
  addFloat(player.x, player.y, item.emoji + ' ' + item.name + '!', '#fde047', 15);
  sfx('buy');
  refreshShop();
}
function sellItem(idx){
  if(!player || gameOver) return;
  const it = player.items[idx];
  if(!it) return;
  const v = Math.floor(itemFullCost(it) / 2);
  player.items.splice(idx, 1);
  recomputeItemStats(player);
  player.gold += v;
  addFloat(player.x, player.y, 'Prodano ' + it.emoji + ' +' + v + ' 💰', '#fde047', 14);
  sfx('buy');
  refreshShop();
}

/* ================= Glavna logika ================= */
function updateUnit(u, dt){
  if(u.dead){
    if(u.kind === 'hero'){
      u.deadT -= dt;
      if(u.deadT <= 0) respawn(u);
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
  u.flash = Math.max(0, u.flash - dt);
  u.atkTimer -= dt;

  if(u.hpRegen) u.hp = Math.min(u.maxhp, u.hp + u.hpRegen * dt);
  if(u.mpRegen) u.mp = Math.min(u.maxmp, u.mp + u.mpRegen * dt);

  if(u.kind === 'hero'){
    for(const ab of u.abilities) ab.cd = Math.max(0, ab.cd - dt);
    u.tpCd = Math.max(0, u.tpCd - dt);
    const f = FOUNTAIN[u.team];
    if(distXY(u.x, u.y, f.x, f.y) < CFG.fountainRadius){
      u.hp = Math.min(u.maxhp, u.hp + u.maxhp * CFG.fountainHeal * dt);
      u.mp = Math.min(u.maxmp, u.mp + u.maxmp * CFG.fountainHeal * dt);
    }
    if(u.runeRegenT > 0){
      u.runeRegenT -= dt;
      u.hp = Math.min(u.maxhp, u.hp + u.maxhp * 0.06 * dt);
      u.mp = Math.min(u.maxmp, u.mp + u.maxmp * 0.06 * dt);
    }
    u.gold += CFG.passiveGold * dt;
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
    return;
  }

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
    u.scanT -= dt;
    if(u.scanT <= 0){ u.scanT = 0.35; creepThink(u); }
  } else if(u.kind === 'neutral'){
    u.scanT -= dt;
    if(u.scanT <= 0){ u.scanT = 0.4; neutralThink(u); }
    if(u.returning) u.hp = Math.min(u.maxhp, u.hp + u.maxhp * 0.35 * dt);
  } else if(u.kind === 'hero' && u.bot){
    u.bot.thinkT -= dt;
    if(u.bot.thinkT <= 0){ u.bot.thinkT = rand(0.4, 0.6); botThink(u); }
  }

  if(u.attackTarget){
    const t = u.attackTarget;
    // magla rata / nevidljivost: junak gubi metu koja nestane
    if(!isTargetable(t) ||
       (t.kind === 'hero' && t.status.invisT > 0 && t.team !== u.team) ||
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
  u.hp = u.maxhp;
  u.mp = u.maxmp;
  const f = FOUNTAIN[u.team];
  u.x = f.x + rand(-50, 50);
  u.y = f.y + rand(-50, 50);
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
          applyDamage(t, p.dmg, p.src);
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
      for(let i = 0; i < CFG.meleePerWave; i++) makeCreep(team, lane, false, false);
      for(let i = 0; i < CFG.rangedPerWave; i++) makeCreep(team, lane, true, false);
      if(waveCount % CFG.siegeEveryNthWave === 0) makeCreep(team, lane, false, true);
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

  const phase = (gameTime % CFG.dayCycle) / CFG.dayCycle;
  const dayK = 0.5 + 0.5 * Math.cos(phase * TAU);
  const nightNow = dayK < 0.5;
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
    const ab = player && !player.dead ? player.abilities[pendingCast.i] : null;
    if(!ab || ab.rank <= 0) pendingCast = null;
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
  while(trees.length < 150 && attempts < 4000){
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
    for(const c of CAMP_SPOTS){
      if(distXY(x, y, c.x, c.y) < 260){ blocked = true; break; }
    }
    if(blocked) continue;
    for(const rs of RUNE_SPOTS){
      if(distXY(x, y, rs.x, rs.y) < 150){ blocked = true; break; }
    }
    if(blocked) continue;
    for(const t of trees){
      if(distXY(x, y, t.x, t.y) < 200){ blocked = true; break; }
    }
    if(blocked) continue;
    trees.push({ x, y, r: 24, size: rand(42, 62), kind: Math.random() < 0.7 ? '🌳' : '🌲' });
  }
}

function buildTerrain(){
  terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = WORLD;
  terrainCanvas.height = WORLD;
  const t = terrainCanvas.getContext('2d');

  t.fillStyle = '#7ec850';
  t.fillRect(0, 0, WORLD, WORLD);
  for(let i = 0; i < 420; i++){
    t.fillStyle = Math.random() < 0.5 ? 'rgba(96,160,56,0.18)' : 'rgba(170,220,120,0.16)';
    t.beginPath();
    t.arc(rand(0, WORLD), rand(0, WORLD), rand(30, 130), 0, TAU);
    t.fill();
  }
  for(let i = 0; i < 200; i++){
    t.fillStyle = choice(['#fef08a', '#fda4af', '#e9d5ff', '#ffffff']);
    t.beginPath();
    t.arc(rand(0, WORLD), rand(0, WORLD), rand(3, 6), 0, TAU);
    t.fill();
  }

  // rijeka (nizina)
  t.strokeStyle = '#5ab6ee';
  t.lineWidth = 230;
  t.lineCap = 'round';
  t.beginPath(); t.moveTo(-50, -50); t.lineTo(WORLD + 50, WORLD + 50); t.stroke();
  t.strokeStyle = '#8ed3fa';
  t.lineWidth = 140;
  t.beginPath(); t.moveTo(-50, -50); t.lineTo(WORLD + 50, WORLD + 50); t.stroke();
  t.fillStyle = 'rgba(255,255,255,0.5)';
  for(let i = 0; i < 60; i++){
    const d = rand(100, WORLD - 100);
    const off = rand(-60, 60);
    t.beginPath();
    t.ellipse(d + off, d - off, rand(8, 20), rand(3, 6), Math.PI / 4, 0, TAU);
    t.fill();
  }

  // staze
  for(const l of LANE_LIST){
    const pts = LANE_PTS[l];
    t.strokeStyle = '#d9c79b';
    t.lineWidth = 150;
    t.lineCap = 'round'; t.lineJoin = 'round';
    t.beginPath();
    t.moveTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++) t.lineTo(pts[i][0], pts[i][1]);
    t.stroke();
    t.strokeStyle = '#e8dab2';
    t.lineWidth = 110;
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

  // baze (platoi)
  for(let team = 0; team < 2; team++){
    const a = ANCIENT_POS[team];
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.22)' : 'rgba(239,68,68,0.22)';
    t.beginPath(); t.arc(a.x, a.y, 460, 0, TAU); t.fill();
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)';
    t.beginPath(); t.arc(a.x, a.y, 260, 0, TAU); t.fill();
    const f = FOUNTAIN[team];
    t.fillStyle = 'rgba(255,255,255,0.45)';
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
  pendingCast = null;
  gameTime = 0; waveTimer = CFG.firstWave; waveCount = 0;
  firstBlood = false; gameOver = false; paused = false;
  banner = null;

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
  gameOver = true;
  const won = player && player.team === winTeam;
  document.getElementById('endEmoji').textContent = won ? '🎉🏆🎉' : '😢💔😢';
  document.getElementById('endTitle').textContent = won ? 'POBJEDA!' : 'PORAZ!';
  document.getElementById('endTitle').style.color = won ? '#fde047' : '#fca5a5';
  let html = '<table><tr><th></th><th>Junak</th><th>⚔️</th><th>💀</th><th>⬆️</th><th>💰</th></tr>';
  const heroesAll = units.filter(u => u.kind === 'hero');
  heroesAll.sort((a, b) => a.team - b.team || b.kills - a.kills);
  for(const h of heroesAll){
    const me = h.isPlayer ? ' (TI)' : '';
    html += `<tr style="color:${TEAM_LIGHT[h.team]}"><td>${h.emoji}</td><td>${h.name}${me}</td><td>${h.kills}</td><td>${h.deaths}</td><td>${h.level}</td><td>${Math.floor(h.gold)}</td></tr>`;
  }
  html += '</table>';
  document.getElementById('endTable').innerHTML = html;
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
  sfx(won ? 'win' : 'lose');
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
    if(!seenByPlayer(e)) continue;   // ne možeš kliknuti što ne vidiš
    const d = distXY(wx, wy, e.x, e.y);
    if(d < e.r + 26 && d < bd){ bd = d; best = e; }
  }
  return best;
}
function playerCommand(wx, wy){
  if(!player || player.dead || gameOver) return;
  cancelTeleport(player);   // nova naredba prekida teleport
  for(const a of ancients){
    if(a && a.invuln && a.team !== player.team && distXY(wx, wy, a.x, a.y) < a.r + 26){
      addFloat(a.x, a.y, '🛡️ Prvo sruši čuvarske kule!', '#fff', 15);
    }
  }
  const t = pickEnemyAt(wx, wy, player.team);
  if(t){
    player.attackTarget = t;
    player.moveTarget = null;
    markers.push({ x: t.x, y: t.y, t: 0, color: '#f87171', r: t.r + 14 });
  } else {
    player.attackTarget = null;
    player.moveTarget = { x: clamp(wx, 40, WORLD - 40), y: clamp(wy, 40, WORLD - 40) };
    markers.push({ x: wx, y: wy, t: 0, color: '#4ade80', r: 22 });
  }
  sfx('click');
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
          sellItem(i);
          return;
        }
      }
      if(inRect(sx, sy, uiRects.tp)){ startTeleport(player); return; }
      if(inRect(sx, sy, uiRects.shop)){ toggleShop(); return; }
      if(inRect(sx, sy, uiRects.mute)){ muted = !muted; sfx('click'); return; }
      if(inRect(sx, sy, uiRects.help)){ toggleHelp(); return; }
    }
    if(inRect(sx, sy, uiRects.mini)){
      const w = miniToWorld(sx, sy);
      if(pendingCast && e.button === 0){
        castAbility(player, pendingCast.i, w);
        pendingCast = null;
        return;
      }
      if(e.button === 2) playerCommand(w.x, w.y);
      else { cam.x = w.x; cam.y = w.y; cam.follow = false; miniDrag = true; }
      return;
    }
    // ciljanje moći: lijevi klik baca, desni odustaje
    if(pendingCast){
      if(e.button === 0){
        const w = screenToWorld(sx, sy);
        castAbility(player, pendingCast.i, w);
      }
      pendingCast = null;
      return;
    }
    const w = screenToWorld(sx, sy);
    playerCommand(w.x, w.y);
  });

  window.addEventListener('mouseup', () => { miniDrag = false; });

  hudCv.addEventListener('mousemove', e => {
    mouse.sx = e.clientX; mouse.sy = e.clientY;
    const w = screenToWorld(mouse.sx, mouse.sy);
    mouse.wx = w.x; mouse.wy = w.y;
    if(miniDrag && inRect(mouse.sx, mouse.sy, uiRects.mini)){
      const mw = miniToWorld(mouse.sx, mouse.sy);
      cam.x = mw.x; cam.y = mw.y;
    }
    hoverUi = null;
    for(let i = 0; i < uiRects.abil.length; i++){
      if(inRect(mouse.sx, mouse.sy, uiRects.abil[i])) hoverUi = { type: 'abil', i };
    }
    for(const lr of uiRects.learn){
      if(inRect(mouse.sx, mouse.sy, lr)) hoverUi = { type: 'learn', i: lr.i };
    }
    for(let i = 0; i < uiRects.inv.length; i++){
      if(uiRects.inv[i] && inRect(mouse.sx, mouse.sy, uiRects.inv[i])) hoverUi = { type: 'inv', i };
    }
    if(inRect(mouse.sx, mouse.sy, uiRects.tp)) hoverUi = { type: 'tp' };
    if(inRect(mouse.sx, mouse.sy, uiRects.shop)) hoverUi = { type: 'shop' };
    if(inRect(mouse.sx, mouse.sy, uiRects.mute)) hoverUi = { type: 'mute' };
    if(inRect(mouse.sx, mouse.sy, uiRects.help)) hoverUi = { type: 'help' };
    hudCv.style.cursor = hoverUi ? 'pointer' : 'crosshair';
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
    keys[k] = true;
    if(!running) return;
    if(k === ' '){ e.preventDefault(); cam.follow = true; if(player){ cam.x = player.x; cam.y = player.y; } }
    if(gameOver) return;
    if(k === 'q') pressAbility(0);
    if(k === 'w') pressAbility(1);
    if(k === 'e') pressAbility(2);
    if(k === 'r') pressAbility(3);
    if(k === 't') startTeleport(player);
    if(k === 's' && player && !player.dead){ player.moveTarget = null; player.attackTarget = null; cancelTeleport(player); }
    if(k === 'b') toggleShop();
    if(k === 'h') toggleHelp();
    if(k === 'm'){ muted = !muted; }
    if(k === 'p'){ paused = !paused; document.getElementById('pause').classList.toggle('hidden', !paused); }
    if(k === 'escape'){
      if(pendingCast) pendingCast = null;
      else if(shopOpen) toggleShop();
      else if(!document.getElementById('help').classList.contains('hidden')) toggleHelp();
    }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
}

/* ================= DOM: dućan, pomoć, odabir ================= */
function toggleShop(){
  shopOpen = !shopOpen;
  document.getElementById('shop').classList.toggle('hidden', !shopOpen);
  if(shopOpen) refreshShop();
}
function toggleHelp(){
  document.getElementById('help').classList.toggle('hidden');
}
function statChipsHtml(item){
  const out = [];
  const s = item.stats || {};
  if(item.instant) out.push('<span class="ch ch-heal">💚 +' + item.heal + ' odmah</span>');
  if(s.dmg) out.push('<span class="ch ch-dmg">⚔️ +' + s.dmg + ' štete</span>');
  if(s.hp) out.push('<span class="ch ch-hp">❤️ +' + s.hp + ' života</span>');
  if(s.mp) out.push('<span class="ch ch-mp">🔮 +' + s.mp + ' mane</span>');
  if(s.speed) out.push('<span class="ch ch-spd">🏃 +' + s.speed + ' brzine</span>');
  if(s.hpRegen) out.push('<span class="ch ch-hp">♥ +' + s.hpRegen + '/s</span>');
  if(s.mpRegen) out.push('<span class="ch ch-mp">💧 +' + s.mpRegen + '/s</span>');
  return out.join('');
}
function refreshShop(){
  if(!player) return;
  document.getElementById('shopGold').textContent = '💰 ' + Math.floor(player.gold);
  for(const item of ITEMS){
    const btn = document.getElementById('buy-' + item.id);
    if(!btn) continue;
    // koliko ih već imaš u torbi
    const ownEl = document.getElementById('own-' + item.id);
    if(ownEl){
      const n = player.items.filter(it => it.id === item.id).length;
      ownEl.textContent = n > 0 ? '✓ imaš' + (n > 1 ? ' ×' + n : '') : '';
    }
    if(item.instant){
      btn.disabled = player.gold < item.cost;
      btn.textContent = item.cost + ' 💰';
      btn.classList.toggle('afford', player.gold >= item.cost);
      continue;
    }
    const plan = planPurchase(player, item);
    // označi dijelove recepta koje već imaš (zeleno)
    if(item.components){
      const invCopy = player.items.map(it => it.id);
      item.components.forEach((cid, i) => {
        const ce = document.getElementById('ce-' + item.id + '-' + i);
        if(!ce) return;
        const idx = invCopy.indexOf(cid);
        if(idx >= 0){ invCopy.splice(idx, 1); ce.classList.add('have'); }
        else ce.classList.remove('have');
      });
    }
    if(!plan.tagOk){ btn.disabled = true; btn.textContent = 'Imaš ✓'; btn.classList.remove('afford'); }
    else if(!plan.slotsOk){ btn.disabled = true; btn.textContent = 'Puno 🎒'; btn.classList.remove('afford'); }
    else {
      btn.disabled = player.gold < plan.cost;
      btn.textContent = Math.ceil(plan.cost) + ' 💰';
      btn.classList.toggle('afford', player.gold >= plan.cost);
    }
  }
}
function buildShopDom(){
  const wrap = document.getElementById('shopItems');
  let html = '';
  for(const tg of ITEM_TIERS){
    html += `<div class="shopSec t${tg.tier}">${tg.label}</div>`;
    for(const item of ITEMS){
      if(item.tier !== tg.tier) continue;
      let rec = '';
      if(item.components){
        const comps = item.components.map((c, i) =>
          `<span class="ce" id="ce-${item.id}-${i}" title="${ITEM_BY_ID[c].name}">${ITEM_BY_ID[c].emoji}</span>`
        ).join('<span class="plus">+</span>');
        rec = `<div class="si-rec">${comps}<span class="plus">+</span><span class="rcost">${item.cost}💰</span><span class="rarr">➜</span><span class="res">${item.emoji}</span></div>`;
      }
      html += `<div class="shopItem tier${item.tier}">
        <div class="si-top">
          <span class="si-emoji">${item.emoji}</span>
          <span class="si-name"><b>${item.name}</b><span class="own" id="own-${item.id}"></span></span>
          <button id="buy-${item.id}">${item.cost} 💰</button>
        </div>
        <div class="si-stats">${statChipsHtml(item)}</div>
        ${rec}
      </div>`;
    }
  }
  wrap.innerHTML = html;
  for(const item of ITEMS){
    document.getElementById('buy-' + item.id).addEventListener('click', () => tryBuy(item));
  }
  document.getElementById('shopClose').addEventListener('click', toggleShop);
}
function buildSelectScreen(){
  const cards = document.getElementById('cards');
  let html = '';
  HEROES.forEach((h, i) => {
    const chip = h.projSpeed > 0
      ? '<span class="chip chipR">🏹 Daljina</span>'
      : '<span class="chip chipM">⚔️ Blizina</span>';
    html += `<div class="card" id="card-${i}">
      <div class="c-emoji">${h.emoji}</div>
      <div class="c-name">${h.name}</div>
      <div class="c-type">${chip}</div>
      <div class="c-role">${h.role}</div>
    </div>`;
  });
  cards.innerHTML = html;
  HEROES.forEach((h, i) => {
    document.getElementById('card-' + i).addEventListener('click', () => {
      selectedHero = i;
      document.querySelectorAll('.card').forEach(c => c.classList.remove('sel'));
      document.getElementById('card-' + i).classList.add('sel');
      const chip = h.projSpeed > 0
        ? '<span class="chip chipR">🏹 Daljina — napada izdaleka</span>'
        : '<span class="chip chipM">⚔️ Blizina — bori se prsa o prsa</span>';
      let det = `<div class="d-head">${h.emoji} <b>${h.name}</b></div><div class="d-role">${h.role}</div><div class="d-type">${chip}</div>`;
      for(const a of h.abilities){
        const tag = a.ult ? ' <span class="ultTag">🌟 ULTI</span>'
          : (a.passive ? ' <span class="pasTag">✨ PASIVNO</span>' : '');
        det += `<div class="d-abil"><b>${a.key}</b> ${a.emoji} <b>${a.name}</b>${tag} — ${a.desc}</div>`;
      }
      document.getElementById('heroDetail').innerHTML = det;
      document.getElementById('startBtn').disabled = false;
      sfx('click');
    });
  });
  document.getElementById('startBtn').addEventListener('click', () => {
    if(selectedHero >= 0) startGame(selectedHero);
  });
  document.getElementById('helpClose').addEventListener('click', toggleHelp);
  document.getElementById('againBtn').addEventListener('click', () => location.reload());
}

/* ================= HUD ================= */
function drawBar(x, y, w, h, frac, fg, bg){
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamp(frac, 0, 1)), h - 2);
}

function barHeight(u){
  if(u.kind === 'hero') return 105;
  if(u.kind === 'creep') return u.r * 2 + 28;
  if(u.kind === 'neutral') return u.r * 2 + 30;
  if(u.kind === 'tower') return 158;
  return 195;
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
      drawBar(s.x - 27, s.y - 10, 54, 7, u.hp / u.maxhp, u.team === TEAM_BLUE ? '#22c55e' : '#ef4444');
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

function drawHud(){
  // ----- gornja ploča -----
  const tw = 280, tx = (VW - tw) / 2;
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.beginPath(); ctx.roundRect(tx, 8, tw, 64, 14); ctx.fill();
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
    const pw = 640, ph = 122;
    const px = (VW - pw) / 2, py = VH - ph - 10;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill();
    ctx.strokeStyle = player.dead ? '#64748b' : TEAM_COLOR[0];
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.stroke();

    // portret
    ctx.fillStyle = player.dead ? '#475569' : TEAM_LIGHT[0];
    ctx.beginPath(); ctx.arc(px + 52, py + ph / 2, 36, 0, TAU); ctx.fill();
    ctx.font = fontEmoji(42);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = player.dead ? 0.5 : 1;
    ctx.fillText(player.emoji, px + 52, py + ph / 2 - 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(px + 78, py + ph / 2 + 24, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = fontTxt(13, true);
    ctx.fillText(player.level, px + 78, py + ph / 2 + 25);

    // trake
    const bx = px + 104, bw = 200;
    ctx.font = fontTxt(14, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(player.name + ' ⭐ ', bx, py + 16);
    ctx.font = fontTxt(11, true);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('⚔️' + player.kills + ' 💀' + player.deaths, bx + 86, py + 16);
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

    // STATISTIKE UŽIVO: šteta (s bonusom od predmeta), brzina, obnove
    {
      ctx.font = fontTxt(11.5, true);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      let sx2 = bx;
      const sy2 = py + 71;
      const put = (txt, color) => {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(txt, sx2, sy2);
        ctx.fillStyle = color;
        ctx.fillText(txt, sx2, sy2);
        sx2 += ctx.measureText(txt).width + 9;
      };
      const mul = player.status.dmgMulT > 0 ? player.status.dmgMulF : 1;
      put('⚔️ ' + Math.round(player.dmg * mul) + (player.itemBonus.dmg ? ' (+' + player.itemBonus.dmg + ')' : ''),
        mul > 1 ? '#fb923c' : '#fbbf24');
      put('🏃 ' + Math.round(player.speed), '#a7f3d0');
      put('♥ +' + player.hpRegen.toFixed(1) + '/s', '#4ade80');
      put('💧 +' + player.mpRegen.toFixed(1) + '/s', '#7dd3fc');
    }

    // torba (klik = prodaja za pola cijene)
    for(let i = 0; i < CFG.inventorySlots; i++){
      const ix = bx + i * 26, iy = py + 90;
      const hovered = hoverUi && hoverUi.type === 'inv' && hoverUi.i === i && player.items[i];
      uiRects.inv[i] = player.items[i] ? { x: ix, y: iy, w: 23, h: 23 } : null;
      ctx.fillStyle = hovered ? '#334155' : '#0f172a';
      ctx.strokeStyle = hovered ? '#fde047' : '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(ix, iy, 23, 23, 5); ctx.fill(); ctx.stroke();
      if(player.items[i]){
        ctx.font = fontEmoji(15);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(player.items[i].emoji, ix + 11.5, iy + 12);
      }
    }
    if(hoverUi && hoverUi.type === 'inv' && player.items[hoverUi.i]){
      const it = player.items[hoverUi.i];
      const v = Math.floor(itemFullCost(it) / 2);
      ctx.font = fontTxt(12, true);
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      const txt = it.name + ' — klik = prodaj za ' + v + ' 💰';
      ctx.strokeText(txt, bx, py - 6);
      ctx.fillStyle = '#fde047';
      ctx.fillText(txt, bx, py - 6);
    }

    // moći (Q W E R) + teleport (T)
    uiRects.abil = [];
    const as = 56, gap = 7;
    const ax0 = px + 322, ay = py + 20;
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
      ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 12); ctx.fill();
      ctx.strokeStyle = isPending ? '#fde047' : (ab.def.ult ? '#c084fc' : (!unlearned && noMana ? '#38bdf8' : '#94a3b8'));
      ctx.lineWidth = isPending ? 4 : 2.5;
      ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 12); ctx.stroke();
      ctx.font = fontEmoji(26);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = unlearned ? 0.3 : ((ab.cd > 0 || noMana) ? 0.45 : 1);
      ctx.fillText(ab.def.emoji, ax + as / 2, ay + as / 2 - 6);
      ctx.globalAlpha = 1;
      if(ultLocked){
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 12); ctx.fill();
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

    // teleport kući (T)
    {
      const tr = { x: ax0 + 4 * (as + gap) + 4, y: ay + 5, w: 46, h: 46 };
      uiRects.tp = tr;
      const channeling = player.tpChannel > 0;
      ctx.fillStyle = channeling ? '#1e3a5f' : '#16243a';
      ctx.beginPath(); ctx.roundRect(tr.x, tr.y, tr.w, tr.h, 11); ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = channeling ? 3.5 : 2;
      ctx.beginPath(); ctx.roundRect(tr.x, tr.y, tr.w, tr.h, 11); ctx.stroke();
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
      ctx.fillStyle = '#93c5fd';
      ctx.font = fontTxt(10, true);
      ctx.fillText('T', tr.x + 8, tr.y + 9);
    }

    // gumbi sa strane
    const gx = px + pw + 10;
    uiRects.shop = { x: gx, y: py, w: 44, h: 30 };
    uiRects.mute = { x: gx, y: py + 37, w: 44, h: 30 };
    uiRects.help = { x: gx, y: py + 74, w: 44, h: 30 };
    const btns = [['🛒', uiRects.shop], [muted ? '🔇' : '🔊', uiRects.mute], ['❓', uiRects.help]];
    for(const [em, r] of btns){
      ctx.fillStyle = 'rgba(15,23,42,0.85)';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 9); ctx.fill();
      ctx.font = fontEmoji(17);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(em, r.x + r.w / 2, r.y + r.h / 2);
    }

    // tooltip moći
    if(hoverUi && (hoverUi.type === 'abil' || hoverUi.type === 'learn') && player.abilities[hoverUi.i]){
      const ab = player.abilities[hoverUi.i];
      const txt1 = ab.def.emoji + ' ' + ab.def.name + (ab.def.ult ? ' 🌟' : '') + (ab.def.passive ? ' ✨' : '') + '  (rang ' + ab.rank + '/' + abilityMaxRank(ab) + ')';
      const txt2 = ab.def.desc;
      const txt3 = ab.def.passive
        ? '✨ PASIVNO — uvijek radi, ne baca se'
        : '💧 ' + ab.def.mana + '   ⏱️ ' + ab.def.cd + 's' + (ab.def.ult ? '   🔓 level ' + CFG.ultLevels[0] + ' i ' + CFG.ultLevels[1] : '');
      ctx.font = fontTxt(13, true);
      const wdt = Math.max(ctx.measureText(txt1).width, ctx.measureText(txt2).width, ctx.measureText(txt3).width) + 24;
      const r = uiRects.abil[hoverUi.i];
      const ttx = clamp(r.x + as / 2 - wdt / 2, 8, VW - wdt - 8), tty = r.y - 84;
      ctx.fillStyle = 'rgba(15,23,42,0.94)';
      ctx.beginPath(); ctx.roundRect(ttx, tty, wdt, 74, 10); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(txt1, ttx + 12, tty + 17);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontTxt(12, false);
      ctx.fillText(txt2, ttx + 12, tty + 38);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText(txt3, ttx + 12, tty + 58);
    }

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

    // oživljavanje
    if(player.dead){
      ctx.fillStyle = 'rgba(15,23,42,0.45)';
      ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center';
      ctx.font = fontTxt(36, true);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 6;
      ctx.strokeText('⏳ Oživljavaš za ' + Math.ceil(player.deadT) + 's', VW / 2, VH * 0.42);
      ctx.fillStyle = '#fff';
      ctx.fillText('⏳ Oživljavaš za ' + Math.ceil(player.deadT) + 's', VW / 2, VH * 0.42);
    }
  }

  // ----- minimapa -----
  const ms = 200, mx = VW - ms - 12, my = VH - ms - 12;
  uiRects.mini = { x: mx, y: my, w: ms, h: ms };
  const sc = ms / WORLD;
  ctx.fillStyle = 'rgba(126,200,80,0.95)';
  ctx.beginPath(); ctx.roundRect(mx, my, ms, ms, 10); ctx.fill();
  ctx.strokeStyle = '#5ab6ee';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + ms, my + ms); ctx.stroke();
  ctx.strokeStyle = '#d9c79b';
  ctx.lineWidth = 6;
  for(const l of LANE_LIST){
    const pts = LANE_PTS[l];
    ctx.beginPath();
    ctx.moveTo(mx + pts[0][0] * sc, my + pts[0][1] * sc);
    for(let i = 1; i < pts.length; i++) ctx.lineTo(mx + pts[i][0] * sc, my + pts[i][1] * sc);
    ctx.stroke();
  }
  for(const u of units){
    if(u.dead || u.removeMe) continue;
    if(!seenByPlayer(u)) continue;   // magla rata i na minimapi
    const ux = mx + u.x * sc, uy = my + u.y * sc;
    if(u.kind === 'tower'){
      ctx.fillStyle = TEAM_COLOR[u.team];
      ctx.fillRect(ux - 3.5, uy - 3.5, 7, 7);
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
  if(running && !paused && !gameOver) update(dt);

  applyDayNight(gameTime);
  updateCamera3();
  if(running) syncScene(now / 1000);
  renderer3.render(scene3, camera3);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  if(running){
    drawWorldOverlay();
    drawHud();
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
  requestAnimationFrame(frame);
});
