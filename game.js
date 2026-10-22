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
let uiRects = { abil: [], learn: [], inv: [], tp: null, glyph: null, statBtn: null, mini: null, shop: null, mute: null, help: null };
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
    lastHits: 0, denies: 0, multiN: 0, lastKillT: -99, tangoT: 0, clarityT: 0,
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
  return makeUnit({
    kind: 'tower', team, x, y, r: 38,
    hp: 1900, maxhp: 1900,
    dmg: 108, atkRange: 390, atkCd: 1.0, projSpeed: 640,
    speed: 0, isStatic: true,
    lane: lane || null, tier: tier || 0, isGuard: !!isGuard,
  });
}

// VOJARNE (barracks): po jedna uz svaku stazu u bazi; ranjive tek kad padne
// unutarnja kula te staze. Srušena vojarna = protivnik dobiva super vojnike.
function makeBarracks(team, lane, x, y){
  return makeUnit({
    kind: 'barracks', team, x, y, r: 58,
    hp: CFG.barracksHp, maxhp: CFG.barracksHp,
    dmg: 0, atkRange: 0, speed: 0, isStatic: true, invuln: true, lane,
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
function applyPoison(t, dps, dur, src){
  const st = t.status;
  if(st.immuneT > 0 || !isSpellTarget(t)) return;
  st.poisonDps = Math.max(st.poisonT > 0 ? st.poisonDps : 0, dps);
  st.poisonT = Math.max(st.poisonT, dur);
  st.poisonSrc = src || null;
  if(t.kind === 'hero') addFloat(t.x, t.y, '🤢 Otrovan!', '#86efac', 13);
}
// Kraljevski oklov (BKB): kratko ništa ne omamljuje, usporava, truje...
function applyImmune(h, dur){
  const st = h.status;
  st.immuneT = Math.max(st.immuneT, dur);
  st.stun = 0; st.slowT = 0; st.rootT = 0; st.silenceT = 0; st.poisonT = 0;
  addFloat(h.x, h.y, '👑 Nepokolebljiv!', '#fde047', 15);
}
function applyShield(t, f, dur){ t.status.shieldT = dur; t.status.shieldF = f; }
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
function applyDamage(t, amount, src){
  if(!t || t.dead || t.removeMe || t.invuln || gameOver) return;
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
  amount = Math.max(1, Math.round(amount));
  t.hp -= amount;
  t.flash = 0.12;
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
      if(t.boss){
        bossKills++;
        if(bossKills >= 2){   // 🧀 od drugog puta Zmaj ostavlja i sir
          const cheese = ITEM_BY_ID.cheese;
          const taker = [src].concat(units.filter(h => h.kind === 'hero' && h.team === src.team && h !== src && !h.dead))
            .find(h => h.items.length < CFG.inventorySlots);
          if(taker){
            taker.items.push(cheese); delete taker.itemCharges.cheese; recomputeItemStats(taker);
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
      // višestruko ubojstvo (unutar 10 s) i niz ubojstava — kao najavljivač u DotA
      credit.multiN = gameTime - (credit.lastKillT || -99) < 10 ? (credit.multiN || 1) + 1 : 1;
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
    // asistencije: suigrači koji su udarili metu u zadnjih 10 s
    if(credit){
      for(const h of units){
        if(h.kind !== 'hero' || h === credit || h.team !== credit.team) continue;
        if(t.hitBy && gameTime - (t.hitBy[h.id] || -99) < 10) h.assists++;
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
  const a = h.hero.attrs;
  const dStr = h.str - a.str, dAgi = h.agi - a.agi, dInt = h.int - a.int;
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
  h.atkSpdBonus = dAgi * 0.006;
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

function abilityMaxRank(ab){ return 3; }   // Q/W/E i ulti: po 3 ranga (9 + 3 + 6 statsa = 18 levela)
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
        const score = (4 - h.abilities[i].rank) * 10 - i * 3;
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
    kind: 'homing', x: src.x, y: src.y, target,
    speed: o.speed, dmg: o.dmg, src, team: src.team,
    color: o.color || '#fff', emoji: o.emoji || null, r: o.r || 6,
    onHit: o.onHit || null, miss: !!o.miss,
    shot: o.shot || null,   // 3D model projektila (arrow/fire/ice/leaf/feather/bolt/tower)
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
  u.atkTimer = u.atkCd / (u.status.hasteT > 0 ? u.status.hasteF : 1) / (1 + (u.atkSpdBonus || 0) + 0.1 * copor + (raging ? 0.4 : 0));
  u.atkN = (u.atkN || 0) + 1;   // 3D: animacija napada
  if(Math.abs(t.x - u.x) > 2) u.face = t.x < u.x ? -1 : 1;
  u.dir = Math.atan2(t.y - u.y, t.x - u.x);
  // napad iz sjene (Tragač): bonus PRIJE nego nevidljivost pukne
  let shadowBonus = 0;
  if(u.status.invisT > 0){
    const sj = passiveRank(u, 'sjena');
    if(sj) shadowBonus = 40 + 30 * sj;
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
  // pasivne moći napadača
  let crit = false;
  const oko = passiveRank(u, 'oko');                 // Oštro oko: kritični pogodak
  if(oko && Math.random() < 0.15){ dmg *= 1.25 + 0.25 * oko; crit = true; }
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
    if(shadowBonus) addFloat(tt.x, tt.y, 'Iz sjene! 👤', '#c4b5fd', 15);
    if(jinProc){ applySlow(tt, 0.3, 1.5); addFloat(tt.x, tt.y, '💢', '#fb923c', 15); }
    if(dodir) applySlow(tt, 0.1 + 0.05 * dodir, 1.5);
    if(naboj && Math.random() < 0.15 + 0.05 * naboj){
      applyDamage(tt, 30 + 25 * naboj, u);
      addLine(u.x, u.y, tt.x, tt.y, '#fde047', 4, 0.2);
      sfxAt('zap', u.x, u.y);
    }
  };
  // pucanje uzbrdo zna promašiti — visinska prednost kao u DotA!
  const miss = ((groundHeight(t.x, t.y) - groundHeight(u.x, u.y) > 25) && Math.random() < CFG.uphillMissChance) ||
    (u.status.blindT > 0 && Math.random() < u.status.blindF);   // 😵 tinta / vrtoglavica
  if(u.projSpeed > 0){
    spawnHoming(u, t, {
      speed: u.projSpeed, dmg, miss,
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
      applyDamage(t, dmg, u);
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
      case 'swap':   // Zamjena: povuci ranjenog neprijatelja k sebi kad je dalje
        if(eh && dEh < hint.range && dEh > 220 && eh.hp < eh.maxhp * 0.6) castAbility(u, i, { x: eh.x, y: eh.y });
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
  if(item.charges && h.items.some(i => i.id === item.id)){   // već imaš: kupnja = dopuna
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
  if(!plan.slotsOk){ addFloat(h.x, h.y, 'Torba je puna! 🎒', '#fca5a5', 14); return; }
  if(h.gold < plan.cost){
    addFloat(h.x, h.y, 'Nemaš dovoljno zlata! 💰', '#fca5a5', 14);
    if(h.isPlayer) sfx('click');
    return;
  }
  doPurchase(h, item, plan);
  addFloat(h.x, h.y, item.emoji + ' ' + item.name + '!', '#fde047', 15);
  if(h.isPlayer) sfx('buy');
  refreshShop();
}
function sellItem(h, idx){
  if(!h || gameOver) return;
  const it = h.items[idx];
  if(!it) return;
  const v = Math.floor(itemFullCost(it) / 2);
  h.items.splice(idx, 1);
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
    return;
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
    for(const s of SHRINE_SPOTS){
      if(distXY(x, y, s.x, s.y) < 230){ blocked = true; break; }
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
  for(let i = 0; i < 420; i++){
    t.fillStyle = Math.random() < 0.5 ? 'rgba(96,160,56,0.14)' : 'rgba(170,220,120,0.12)';
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

  // baze (platoi)
  for(let team = 0; team < 2; team++){
    const a = ANCIENT_POS[team];
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.22)' : 'rgba(239,68,68,0.22)';
    t.beginPath(); t.arc(a.x, a.y, 460, 0, TAU); t.fill();
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)';
    t.beginPath(); t.arc(a.x, a.y, 260, 0, TAU); t.fill();
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
  makeShrines(); creepTier = 0; bossKills = 0; coinDrops = [];
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
function showEndScreen(winTeam, won){
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
          if(player.items[i] && player.items[i].active) pressItem(i);
          else addFloat(player.x, player.y, 'Desni klik = prodaja', '#e5e7eb', 13);
          return;
        }
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
        if(uiRects.inv[i] && inRect(sx, sy, uiRects.inv[i])){
          if(net.mode === 'guest') netSell(i);
          else sellItem(player, i);
          return;
        }
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
    if(inRect(mouse.sx, mouse.sy, uiRects.statBtn)) hoverUi = { type: 'stat' };
    if(inRect(mouse.sx, mouse.sy, uiRects.tp)) hoverUi = { type: 'tp' };
    if(uiRects.glyph && inRect(mouse.sx, mouse.sy, uiRects.glyph)) hoverUi = { type: 'glyph' };
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
    if(k === 't'){ if(net.mode === 'guest') netTp(); else startTeleport(player); }
    if(k === 's' && player && !player.dead){
      if(net.mode === 'guest') netStop();
      else { player.moveTarget = null; player.attackTarget = null; cancelTeleport(player); }
    }
    if(k === 'b') toggleShop();
    if(k === 'h') toggleHelp();
    if(k === 'o'){ if(net.mode === 'guest') netBuyback(); else buyback(player); }
    if(k === 'f' && player){ if(net.mode === 'guest') netGlyph(); else useGlyph(player.team, player); }
    if(k >= '1' && k <= '6' && !e.ctrlKey && !e.metaKey) pressItem(parseInt(k, 10) - 1);
    if(k === 'tab') e.preventDefault();
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
  if(shopOpen) setShopTab(shopTab);   // ponovno složi preporuke za trenutnog junaka
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
  // 🎯 sljedeći preporučeni predmet (prvi iz builda koji još nemaš ni ugrađen)
  const build = (player.hero && player.hero.build) || BOT_BUILD;
  const nextId = build.find(id => !ownsOrUsed(player, id)) || null;
  for(const item of ITEMS){
    const el = document.getElementById('si-' + item.id);
    if(el){
      const isNext = shopTab === 'rec' && item.id === nextId;
      el.classList.toggle('next', isNext);
      const ne = document.getElementById('next-' + item.id);
      if(ne) ne.style.display = isNext ? 'inline-block' : 'none';
    }
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
/* ima li junak predmet — ili ga je već ugradio u veći recept */
function ownsOrUsed(h, id){
  const has = (it) => it.id === id || (it.components || []).some(c => has(ITEM_BY_ID[c]));
  return h.items.some(has);
}
/* preporučeni redoslijed: potrošno za početak + build junaka */
function recommendedFor(h){
  const build = (h.hero && h.hero.build) || BOT_BUILD;
  return ['tango', 'potion', 'clarity', 'bottle'].concat(build.filter(id => !['tango', 'potion', 'clarity', 'bottle'].includes(id)));
}
let shopTab = 'rec';
function setShopTab(id){
  shopTab = id;
  document.querySelectorAll('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.cat === id));
  const rec = player ? recommendedFor(player) : [];
  for(const item of ITEMS){
    const el = document.getElementById('si-' + item.id);
    if(!el) continue;   // predmeti koji se ne prodaju (🧀 sir)
    let show, order;
    if(id === 'rec'){ order = rec.indexOf(item.id); show = order >= 0; }
    else if(id === 'all'){ show = true; order = item.tier * 100 + ITEMS.indexOf(item); }
    else { show = item.cat === id; order = item.tier * 100 + ITEMS.indexOf(item); }
    el.classList.toggle('hid', !show);
    el.style.order = order;
  }
  document.querySelectorAll('#shopItems .shopSec').forEach(s => s.classList.toggle('hid', id !== 'all'));
  const info = document.getElementById('shopInfo');
  if(info) info.textContent = id === 'rec' && player ? '⭐ Kupuj redom — zeleno 🎯 je sljedeće za ' + player.name + '!' : '';
  refreshShop();
}
function buildShopDom(){
  const wrap = document.getElementById('shopItems');
  let html = '';
  for(const tg of ITEM_TIERS) html += `<div class="shopSec t${tg.tier}" style="order:${tg.tier * 100 - 1}">${tg.label}</div>`;
  for(const item of ITEMS){
    if(item.noShop) continue;
    let rec = '';
    if(item.components){
      const comps = item.components.map((c, i) =>
        `<span class="ce" id="ce-${item.id}-${i}" title="${ITEM_BY_ID[c].name}">${ITEM_BY_ID[c].emoji}</span>`
      ).join('<span class="plus">+</span>');
      rec = `<div class="si-rec">${comps}<span class="plus">+</span><span class="rcost">${item.cost}💰</span><span class="rarr">➜</span><span class="res">${item.emoji}</span></div>`;
    }
    const catLbl = (ITEM_CATS.find(c => c.id === item.cat) || {}).label || '';
    html += `<div class="shopItem tier${item.tier}" id="si-${item.id}">
      <div class="si-top">
        <span class="si-emoji">${item.emoji}</span>
        <span class="si-name"><b>${item.name}</b><span class="own" id="own-${item.id}"></span><span class="si-cat">${catLbl}</span></span>
        <span class="si-next" id="next-${item.id}">🎯 sljedeće</span>
        <button id="buy-${item.id}">${item.cost} 💰</button>
      </div>
      <div class="si-desc">${item.desc}</div>
      <div class="si-stats">${statChipsHtml(item)}</div>
      ${rec}
    </div>`;
  }
  wrap.innerHTML = html;
  const tabs = document.getElementById('shopTabs');
  if(tabs){
    tabs.innerHTML = ITEM_CATS.map(c => `<button data-cat="${c.id}" title="${c.label}">${c.label}</button>`).join('');
    tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { setShopTab(b.dataset.cat); sfx('click'); }));
  }
  for(const item of ITEMS){
    if(item.noShop) continue;
    document.getElementById('buy-' + item.id).addEventListener('click', () => {
      if(net.mode === 'guest') netBuy(item.id);
      else tryBuy(player, item);
    });
  }
  document.getElementById('shopClose').addEventListener('click', toggleShop);
  setShopTab('rec');
}
function buildSelectScreen(){
  const cards = document.getElementById('cards');
  let html = '';
  HEROES.forEach((h, i) => {
    const chip = h.projSpeed > 0
      ? '<span class="chip chipR">🏹 Daljina</span>'
      : '<span class="chip chipM">⚔️ Blizina</span>';
    html += `<div class="card" id="card-${i}">
      <img class="c-img" src="assets/hero_${h.id}.jpg" alt="${h.emoji}"
        onerror="this.outerHTML='<div class=&quot;c-emoji&quot;>${h.emoji}</div>'">
      <div class="c-name">${h.name}</div>
      <div class="c-type">${chip}</div>
      <div class="c-role">${h.role}</div>
    </div>`;
  });
  cards.innerHTML = html;
  HEROES.forEach((h, i) => {
    document.getElementById('card-' + i).addEventListener('click', () => {
      selectedHero = i;
      if(net.conn) netPick(i);   // multiplayer: javi prijatelju svoj odabir
      document.querySelectorAll('.card').forEach(c => c.classList.remove('sel'));
      document.getElementById('card-' + i).classList.add('sel');
      const chip = h.projSpeed > 0
        ? '<span class="chip chipR">🏹 Daljina — napada izdaleka</span>'
        : '<span class="chip chipM">⚔️ Blizina — bori se prsa o prsa</span>';
      const primNames = { str: '💪 Snaga', agi: '🤸 Okretnost', int: '🧠 Inteligencija' };
      const primChip = '<span class="chip chipP">' + primNames[h.attrs.primary] + '</span>';
      let det = `<img class="d-img" src="assets/hero_${h.id}.jpg" onerror="this.remove()"><div class="d-head">${h.emoji} <b>${h.name}</b></div><div class="d-role">${h.role}</div><div class="d-type">${chip} ${primChip}</div>`;
      for(const a of h.abilities){
        const tag = a.ult ? ' <span class="ultTag">🌟 ULTI</span>'
          : (a.passive ? ' <span class="pasTag">✨ PASIVNO</span>' : '');
        det += `<div class="d-abil"><b>${a.key}</b> ${a.emoji} <b>${a.name}</b>${tag} — ${a.desc}</div>`;
      }
      document.getElementById('heroDetail').innerHTML = det;
      showHeroPreview(document.getElementById('heroDetail'), h.id);   // 3D model iz Blendera
      document.getElementById('startBtn').disabled = false;
      sfx('click');
    });
  });
  document.getElementById('startBtn').addEventListener('click', () => {
    if(net.conn){ netReady(); return; }   // multiplayer: čekaj oba igrača
    if(selectedHero >= 0) startGame(selectedHero);
  });
  const rndBtn = document.getElementById('randomBtn');
  if(rndBtn) rndBtn.addEventListener('click', () => {
    document.getElementById('card-' + Math.floor(Math.random() * HEROES.length)).click();
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
    const pw = 640, ph = 134;
    const px = (VW - pw) / 2, py = VH - ph - 10;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill();
    ctx.strokeStyle = player.dead ? '#64748b' : TEAM_COLOR[0];
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.stroke();

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
    if(player.aegis){   // 🛡️ Zmajev štit
      ctx.font = fontEmoji(18);
      ctx.fillText('🛡️', px + 24, py + ph / 2 - 26);
      ctx.font = fontTxt(9, true);
      ctx.fillStyle = '#fde047';
      ctx.fillText(Math.ceil(player.aegisT / 60) + 'min', px + 24, py + ph / 2 - 12);
    }

    // trake
    const bx = px + 104, bw = 200;
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
      put('💪 ' + Math.round(player.str), prim === 'str' ? '#fde047' : '#cbd5e1', py + 70);
      put('🤸 ' + Math.round(player.agi), prim === 'agi' ? '#fde047' : '#cbd5e1', py + 70);
      put('🧠 ' + Math.round(player.int), prim === 'int' ? '#fde047' : '#cbd5e1', py + 70);
      // red 2: šteta (s bonusom od predmeta), brzina, obnove
      putX = bx;
      const mul = player.status.dmgMulT > 0 ? player.status.dmgMulF : 1;
      put('⚔️ ' + Math.round(player.dmg * mul) + (player.itemBonus.dmg ? ' (+' + player.itemBonus.dmg + ')' : ''),
        mul > 1 ? '#fb923c' : '#fbbf24', py + 84);
      put('🏃 ' + Math.round(player.speed), '#a7f3d0', py + 84);
      put('♥ +' + player.hpRegen.toFixed(1) + '/s', '#4ade80', py + 84);
      put('💧 +' + player.mpRegen.toFixed(1) + '/s', '#7dd3fc', py + 84);
    }

    // torba (klik = prodaja za pola cijene)
    for(let i = 0; i < CFG.inventorySlots; i++){
      const ix = bx + i * 26, iy = py + 102;
      const hovered = hoverUi && hoverUi.type === 'inv' && hoverUi.i === i && player.items[i];
      uiRects.inv[i] = player.items[i] ? { x: ix, y: iy, w: 23, h: 23 } : null;
      ctx.fillStyle = hovered ? '#334155' : '#0f172a';
      ctx.strokeStyle = hovered ? '#fde047' : '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(ix, iy, 23, 23, 5); ctx.fill(); ctx.stroke();
      const itm = player.items[i];
      if(itm){
        ctx.font = fontEmoji(15);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(itm.emoji, ix + 11.5, iy + 12);
        if(itm.active){
          const icd = player.itemCd[itm.id] || 0;
          if(icd > 0){
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath(); ctx.roundRect(ix, iy, 23, 23 * Math.min(1, icd / itm.active.cd), 5); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = fontTxt(10, true);
            ctx.fillText(Math.ceil(icd), ix + 11.5, iy + 12);
          }
          ctx.fillStyle = pendingCast && pendingCast.item === i ? '#fde047' : '#4ade80';
          ctx.font = fontTxt(8, true);
          ctx.fillText(i + 1, ix + 18, iy + 5);
          if(itm.charges){   // gutljaji / punjenja
            const ch = itemCharges(player, itm.id);
            ctx.fillStyle = ch > 0 ? '#7dd3fc' : '#fca5a5';
            ctx.fillText(ch, ix + 5, iy + 19);
          }
        }
      }
    }
    if(hoverUi && hoverUi.type === 'inv' && player.items[hoverUi.i]){
      const it = player.items[hoverUi.i];
      const v = Math.floor(itemFullCost(it) / 2);
      ctx.font = fontTxt(12, true);
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      const txt = it.name + (it.active ? ' — klik ili tipka ' + (hoverUi.i + 1) + ' = koristi • ' : ' — ') + 'desni klik = prodaj za ' + v + ' 💰';
      ctx.strokeText(txt, bx, py - 6);
      ctx.fillStyle = '#fde047';
      ctx.fillText(txt, bx, py - 6);
    }

    // moći (Q W E R) + atributi (📊) + teleport (T)
    uiRects.abil = [];
    const as = 52, gap = 6;
    const ax0 = px + 318, ay = py + 20;
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

    // ATRIBUTI gumb (📊 = +2 sve, kao DotA "Attribute Bonus")
    {
      const sb = { x: ax0 + 4 * (as + gap), y: ay, w: 40, h: as };
      uiRects.statBtn = sb;
      const canS = player.skillPoints > 0 && canLearnStats(player);
      ctx.fillStyle = '#1e3a2f';
      ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 10); ctx.fill();
      ctx.strokeStyle = canS ? '#4ade80' : '#475569';
      ctx.lineWidth = canS ? 3 : 2;
      ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 10); ctx.stroke();
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
      const tr = { x: ax0 + 4 * (as + gap) + 46, y: ay + 2, w: 42, h: 48 };
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
      // 🛡️ Glif utvrde (F): kule i vojarne tima 5 s neranjive
      const gr = { x: tr.x + tr.w + 6, y: tr.y, w: 42, h: 48 };
      uiRects.glyph = gr;
      const gl = glyph[player.team];
      ctx.fillStyle = gl.t > 0 ? '#3f2a0a' : '#2a2214';
      ctx.beginPath(); ctx.roundRect(gr.x, gr.y, gr.w, gr.h, 11); ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = gl.t > 0 ? 3.5 : 2;
      ctx.beginPath(); ctx.roundRect(gr.x, gr.y, gr.w, gr.h, 11); ctx.stroke();
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

    // tooltip atributa
    if(hoverUi && hoverUi.type === 'stat'){
      const txt1 = '📊 Atributi+  (rang ' + player.statRanks + '/' + CFG.statMaxRanks + ')';
      const txt2 = '+2 💪 Snaga, +2 🤸 Okretnost, +2 🧠 Inteligencija';
      const txt3 = '💪 = život • 🤸 = brzina i brzina napada • 🧠 = mana';
      ctx.font = fontTxt(13, true);
      const wdt = Math.max(ctx.measureText(txt1).width, ctx.measureText(txt2).width, ctx.measureText(txt3).width) + 24;
      const sb = uiRects.statBtn;
      const ttx = clamp(sb.x + sb.w / 2 - wdt / 2, 8, VW - wdt - 8), tty = sb.y - 84;
      ctx.fillStyle = 'rgba(15,23,42,0.94)';
      ctx.beginPath(); ctx.roundRect(ttx, tty, wdt, 74, 10); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText(txt1, ttx + 12, tty + 17);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontTxt(12, false);
      ctx.fillText(txt2, ttx + 12, tty + 38);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText(txt3, ttx + 12, tty + 58);
    }

    // tooltip glifa
    if(hoverUi && hoverUi.type === 'glyph' && uiRects.glyph){
      const gl = glyph[player.team];
      const txt1 = '🛡️ Glif utvrde (tipka F)' + (gl.cd > 0 ? ' — puni se još ' + Math.ceil(gl.cd) + ' s' : '');
      const txt2 = 'Sve kule i vojarne tvog tima 5 s ne primaju štetu. Puni se 5 min.';
      ctx.font = fontTxt(13, true);
      const wdt = Math.max(ctx.measureText(txt1).width, ctx.measureText(txt2).width) + 24;
      const sb = uiRects.glyph;
      const ttx = clamp(sb.x + sb.w / 2 - wdt / 2, 8, VW - wdt - 8), tty = sb.y - 62;
      ctx.fillStyle = 'rgba(15,23,42,0.94)';
      ctx.beginPath(); ctx.roundRect(ttx, tty, wdt, 52, 10); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(txt1, ttx + 12, tty + 17);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontTxt(12, false);
      ctx.fillText(txt2, ttx + 12, tty + 37);
    }

    // tooltip moći (s konkretnim brojevima za trenutni rang!)
    if(hoverUi && (hoverUi.type === 'abil' || hoverUi.type === 'learn') && player.abilities[hoverUi.i]){
      const ab = player.abilities[hoverUi.i];
      const txt1 = ab.def.emoji + ' ' + ab.def.name + (ab.def.ult ? ' 🌟' : '') + (ab.def.passive ? ' ✨' : '') + '  (rang ' + ab.rank + '/' + abilityMaxRank(ab) + ')';
      const txt2 = ab.def.desc;
      const tipTxt = ab.def.tip ? ab.def.tip(Math.max(1, ab.rank)) + (ab.rank === 0 ? '  (na rangu 1)' : '') : '';
      const txt3 = ab.def.passive
        ? '✨ PASIVNO — uvijek radi, ne baca se'
        : '💧 ' + ab.def.mana + '   ⏱️ ' + ab.def.cd + 's' + (ab.def.ult ? '   🔓 leveli ' + CFG.ultLevels.join('/') : '');
      ctx.font = fontTxt(13, true);
      const wdt = Math.max(ctx.measureText(txt1).width, ctx.measureText(txt2).width,
        ctx.measureText(tipTxt).width, ctx.measureText(txt3).width) + 24;
      const hgt = tipTxt ? 94 : 74;
      const r = uiRects.abil[hoverUi.i];
      const ttx = clamp(r.x + as / 2 - wdt / 2, 8, VW - wdt - 8), tty = r.y - hgt - 10;
      ctx.fillStyle = 'rgba(15,23,42,0.94)';
      ctx.beginPath(); ctx.roundRect(ttx, tty, wdt, hgt, 10); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(txt1, ttx + 12, tty + 17);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontTxt(12, false);
      ctx.fillText(txt2, ttx + 12, tty + 38);
      let yy = tty + 58;
      if(tipTxt){
        ctx.fillStyle = '#fbbf24';
        ctx.font = fontTxt(12, true);
        ctx.fillText(tipTxt, ttx + 12, yy);
        yy += 20;
      }
      ctx.fillStyle = '#7dd3fc';
      ctx.font = fontTxt(12, false);
      ctx.fillText(txt3, ttx + 12, yy);
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
  const ms = 200, mx = VW - ms - 12, my = VH - ms - 12;
  drawMinimap(ms, mx, my);
}

/* ================= Tablica rezultata (Tab) ================= */
function drawScoreboard(){
  const heroes = units.filter(u => u.kind === 'hero').sort((a, b) => a.team - b.team || b.kills - a.kills);
  const w = 620, rowH = 30, h = 70 + heroes.length * rowH + 16;
  const x = (VW - w) / 2, y = Math.max(80, VH * 0.5 - h / 2);
  ctx.fillStyle = 'rgba(15,23,42,0.93)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = fontTxt(20, true);
  ctx.fillStyle = '#fde047';
  ctx.fillText('📋 Tablica (drži Tab)', x + w / 2, y + 24);
  ctx.font = fontTxt(12, true);
  ctx.fillStyle = '#94a3b8';
  const cols = [['Junak', 70], ['Lvl', 190], ['⚔️', 228], ['💀', 262], ['🤝', 296], ['LH/DN', 350], ['💰', 412], ['Torba', 515]];
  for(const [t, cx] of cols) ctx.fillText(t, x + cx, y + 52);
  heroes.forEach((hh, i) => {
    const ry = y + 70 + i * rowH + rowH / 2;
    if(hh.isPlayer){
      ctx.fillStyle = 'rgba(253,224,71,0.12)';
      ctx.beginPath(); ctx.roundRect(x + 10, ry - rowH / 2 + 2, w - 20, rowH - 4, 8); ctx.fill();
    }
    ctx.font = fontEmoji(16);
    ctx.fillText(hh.emoji, x + 32, ry);
    ctx.font = fontTxt(13, true);
    ctx.fillStyle = TEAM_LIGHT[hh.team];
    ctx.textAlign = 'left';
    ctx.fillText(hh.name + (hh.dead ? ' 💀' : '') + (hh.aegis ? ' 🛡️' : ''), x + 50, ry);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(hh.level, x + 190, ry);
    ctx.fillText(hh.kills, x + 228, ry);
    ctx.fillText(hh.deaths, x + 262, ry);
    ctx.fillText(hh.assists, x + 296, ry);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText((hh.lastHits || 0) + ' / ' + (hh.denies || 0), x + 350, ry);
    ctx.fillStyle = '#fde047';
    ctx.fillText(hh.team === myTeam ? Math.floor(hh.gold) : '?', x + 412, ry);
    ctx.font = fontEmoji(13);
    ctx.fillStyle = '#fff';
    ctx.fillText(hh.items.map(it => it.emoji).join(' '), x + 515, ry);
  });
}

function drawMinimap(ms, mx, my){
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
