'use strict';
/* ============================================================
   DOTA Kids — engine igre
   Mapa s 3 staze, rijeka, šuma, kule, vojnici, 6 junaka,
   3 protiv 3 (ti + 2 bota protiv 3 bota).
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

// roundRect polyfill (za starije preglednike)
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

/* ================= Mapa: staze, baze, kule ================= */
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
const TOWER_FRACS = [[0.36, 0.16], [0.64, 0.84]]; // [team] -> [T1, T2] kao dio staze

/* ================= Globalno stanje ================= */
let canvas, ctx, terrainCanvas;
let VW = 800, VH = 600, DPR = 1;
let units = [], projectiles = [], zones = [], particles = [], lines = [], floats = [], markers = [], feed = [];
let trees = [];
let player = null;
let ancients = [null, null];
let cam = { x: WORLD / 2, y: WORLD / 2, zoom: 0.9, follow: true };
let mouse = { sx: 0, sy: 0, wx: 0, wy: 0 };
let keys = {};
let running = false, paused = false, gameOver = false;
let gameTime = 0, waveTimer = CFG.firstWave, waveCount = 0;
let firstBlood = false, muted = false, shopOpen = false;
let banner = null; // {txt, sub, t, dur}
let kills = [0, 0];
let uiRects = { abil: [], mini: null, shop: null, mute: null, help: null };
let hoverUi = null;
let miniDrag = false;
let nextId = 1;
let selectedHero = -1;
let sfxLast = {};

/* ================= Jedinice ================= */
function baseStatus(){
  return { slowT: 0, slowF: 0, stun: 0, rootT: 0, shieldT: 0, shieldF: 0, hasteT: 0, hasteF: 1 };
}

function makeUnit(o){
  const u = Object.assign({
    id: nextId++,
    kind: 'creep', team: 0, x: 0, y: 0, r: 16,
    hp: 100, maxhp: 100, mp: 0, maxmp: 0,
    hpRegen: 0, mpRegen: 0,
    dmg: 10, atkRange: 60, atkCd: 1.1, atkTimer: rand(0, 0.4), projSpeed: 0,
    speed: 130, face: 1,
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
    kills: 0, deaths: 0, items: [], buildI: 0,
    abilities: def.abilities.map(a => ({ def: a, cd: 0 })),
    isPlayer: !!isPlayer, lane,
    bot: isPlayer ? null : { state: 'lane', thinkT: rand(0.2, 0.8) },
    deadT: 0,
  });
  if(isPlayer) player = u;
  return u;
}

function makeCreep(team, lane, ranged, idx){
  const path = lanePath(team, lane);
  const sx = path[0][0], sy = path[0][1];
  const grow = waveCount;
  return makeUnit({
    kind: 'creep', team, lane,
    x: sx + rand(-45, 45), y: sy + rand(-45, 45),
    r: ranged ? 14 : 16,
    hp: ranged ? 230 + grow * 6 : 330 + grow * 8,
    maxhp: ranged ? 230 + grow * 6 : 330 + grow * 8,
    dmg: (ranged ? 27 : 22) + grow * 0.6,
    atkRange: ranged ? 290 : 62,
    atkCd: ranged ? 1.4 : 1.1,
    projSpeed: ranged ? 520 : 0,
    speed: 132,
    path, wpIndex: 1,
    goldValue: ranged ? 46 : 38,
    rangedCreep: !!ranged,
  });
}

function makeTower(team, x, y, lane, tier, isGuard){
  return makeUnit({
    kind: 'tower', team, x, y, r: 38,
    hp: 1550, maxhp: 1550,
    dmg: 92, atkRange: 380, atkCd: 1.05, projSpeed: 640,
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

function isTargetable(e){ return e && !e.dead && !e.removeMe && !e.invuln; }

function nearestEnemyOf(u, range, filter){
  let best = null, bd = range;
  for(const e of units){
    if(e.team === u.team || e.removeMe || e.dead || e.invuln) continue;
    if(filter && !filter(e)) continue;
    const d = dist(u, e) - (e.r || 0);
    if(d < bd){ bd = d; best = e; }
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

/* ================= Efekti (čestice, brojevi, linije) ================= */
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
  floats.push({ x: x + rand(-8, 8), y, txt, color: color || '#fff', size: size || 15, t: 0 });
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
  addFloat(u.x, u.y - u.r - 14, '+' + Math.round(act), '#4ade80', 14);
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
  if(st.shieldT > 0) amount *= (1 - st.shieldF);
  amount = Math.max(1, Math.round(amount));
  t.hp -= amount;
  t.flash = 0.12;
  if(t.kind === 'hero' || t.kind === 'tower' || t.kind === 'ancient' || (src && src.isPlayer)){
    addFloat(t.x, t.y - t.r - 12, '-' + amount, src && src.team === TEAM_BLUE ? '#ffd166' : '#ff8fa3', t.kind === 'hero' ? 16 : 13);
  }
  if(src && src.kind === 'hero' && !src.dead) t.lastHitter = src;
  // vojnici uzvraćaju napadaču
  if(t.kind === 'creep' && src && !src.dead && !src.removeMe && src.team !== t.team){
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
      if(src.isPlayer) addFloat(t.x, t.y - 20, '+' + t.goldValue + ' 💰', '#fde047', 15);
    }
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && !h.dead && dist(h, t) < CFG.xpRadius)
        giveXp(h, CFG.creepXp);
    }
  }
  else if(t.kind === 'hero'){
    t.dead = true;
    t.deaths++;
    kills[1 - t.team]++;
    t.deadT = CFG.respawnBase + t.level * CFG.respawnPerLvl;
    t.moveTarget = null; t.attackTarget = null;
    t.status = baseStatus();
    burst(t.x, t.y, TEAM_COLOR[t.team], 26, 240, 7);
    burst(t.x, t.y, '#fff', 10, 160, 4);
    let killerName = '🏰 Toranj';
    if(src && src.kind === 'hero'){
      src.kills++;
      src.gold += CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl;
      giveXp(src, CFG.heroKillXp + t.level * 15);
      killerName = src.emoji + ' ' + src.name;
      if(src.isPlayer) addFloat(src.x, src.y - 40, '+' + (CFG.heroKillGold + t.level * CFG.heroKillGoldPerLvl) + ' 💰', '#fde047', 17);
    } else if(src && src.kind === 'creep') killerName = '⚔️ Vojnici';
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team && h !== src && !h.dead && dist(h, t) < CFG.xpRadius)
        giveXp(h, 70);
    }
    feedMsg(killerName + '  ⚔️  ' + t.emoji + ' ' + t.name, TEAM_COLOR[1 - t.team]);
    if(!firstBlood){ firstBlood = true; announce('🩸 Prva krv!', killerName); }
    if(t.isPlayer){ sfx('death'); announce('Ne brini! ⏳', 'Oživjet ćeš za ' + Math.ceil(t.deadT) + ' sekundi'); }
    else if(src && src.isPlayer){ sfx('kill'); announce('Bravo! 🎉', 'Pobijedio si ' + t.emoji + ' ' + t.name + '!'); }
    else sfxAt('kill', t.x, t.y);
  }
  else if(t.kind === 'tower'){
    t.removeMe = true;
    burst(t.x, t.y, '#fbbf24', 30, 300, 8);
    burst(t.x, t.y, '#94a3b8', 20, 200, 7);
    feedMsg('🏰 Srušen toranj tima ' + TEAM_NAME[t.team] + '!', TEAM_COLOR[1 - t.team]);
    announce('🏰 BUM!', 'Toranj tima ' + TEAM_NAME[t.team] + ' je srušen!');
    for(const h of units){
      if(h.kind === 'hero' && h.team !== t.team){
        h.gold += CFG.towerGoldTeam;
        if(h.isPlayer) addFloat(h.x, h.y - 40, '+' + CFG.towerGoldTeam + ' 💰', '#fde047', 15);
      }
      if(h.kind === 'hero' && h.team !== t.team && !h.dead && dist(h, t) < 800) giveXp(h, CFG.towerXp);
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
  addFloat(h.x, h.y - h.r - 26, 'LEVEL ' + h.level + '! ⬆️', '#fde047', 18);
  burst(h.x, h.y, '#fde047', 18, 200, 6);
  if(h.isPlayer) sfx('levelup');
}

/* ================= Moći (koriste ih data.js cast funkcije) ================= */
function spawnSkillshot(u, aim, o){
  let dx = aim.x - u.x, dy = aim.y - u.y;
  let L = Math.hypot(dx, dy);
  if(L < 1){ dx = u.face || 1; dy = 0; L = 1; }
  projectiles.push({
    kind: 'skill', x: u.x, y: u.y,
    vx: dx / L * o.speed, vy: dy / L * o.speed,
    speed: o.speed, r: o.r, range: o.range, traveled: 0,
    dmg: o.dmg, src: u, team: u.team,
    color: o.color, emoji: o.emoji || null,
    pierce: !!o.pierce, slow: o.slow || null, hitIds: {},
  });
  return true;
}
function spawnHoming(src, target, o){
  projectiles.push({
    kind: 'homing', x: src.x, y: src.y - 10, target,
    speed: o.speed, dmg: o.dmg, src, team: src.team,
    color: o.color || '#fff', emoji: o.emoji || null, r: o.r || 6,
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
    if(e.kind !== 'creep' && e.kind !== 'hero') continue;
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
    if(e.kind !== 'creep' && e.kind !== 'hero') continue;
    if(distToSeg(e.x, e.y, x1, y1, x2, y2) <= halfW + e.r) applyDamage(e, dmg, u);
  }
}
function chainLightning(u, o){
  let cur = nearestEnemyOf(u, o.range, e => e.kind === 'hero') ||
            nearestEnemyOf(u, o.range, e => e.kind === 'creep');
  if(!cur) return false;
  let prev = u, n = 0;
  const hitIds = {};
  while(cur && n < o.max){
    addLine(prev.x, prev.y - 10, cur.x, cur.y - 10, '#fde047', 5, 0.25);
    addLine(prev.x, prev.y - 10, cur.x, cur.y - 10, '#ffffff', 2, 0.25);
    applyDamage(cur, o.dmg, u);
    burst(cur.x, cur.y, '#fde047', 8, 140, 4);
    hitIds[cur.id] = true;
    n++;
    prev = cur;
    let next = null, bd = o.jump;
    for(const e of units){
      if(e.team === u.team || e.dead || e.removeMe || e.invuln) continue;
      if(e.kind !== 'hero' && e.kind !== 'creep') continue;
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
  if(ab.cd > 0){ if(u.isPlayer) sfx('click'); return; }
  if(u.status.stun > 0) return;
  if(u.mp < ab.def.mana){
    if(u.isPlayer) addFloat(u.x, u.y - u.r - 20, 'Nema mane! 💧', '#7dd3fc', 14);
    return;
  }
  const ok = ab.def.cast(u, aim || { x: u.x + u.face * 200, y: u.y });
  if(ok === false){
    if(u.isPlayer) addFloat(u.x, u.y - u.r - 20, 'Nema mete! 🤔', '#e5e7eb', 13);
    return;
  }
  u.mp -= ab.def.mana;
  ab.cd = ab.def.cd;
  sfxAt('cast', u.x, u.y);
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
  if(Math.abs(dx) > 2) u.face = dx < 0 ? -1 : 1;
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
    // drveće
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
  if(u.projSpeed > 0){
    spawnHoming(u, t, {
      speed: u.projSpeed, dmg: u.dmg,
      color: u.kind === 'tower' ? '#fbbf24' : TEAM_LIGHT[u.team],
      r: u.kind === 'tower' ? 9 : 6,
    });
    sfxAt('pew', u.x, u.y);
  } else {
    applyDamage(t, u.dmg, u);
    sfxAt('hit', u.x, u.y);
  }
}

/* ================= AI: vojnici ================= */
function creepThink(u){
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > 700) u.attackTarget = null;
  if(!u.attackTarget){
    const e = nearestEnemyOf(u, 470, null);
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
  if(!isTargetable(u.attackTarget) || dist(u, u.attackTarget) > u.atkRange + u.attackTarget.r + 30)
    u.attackTarget = null;
  if(!u.attackTarget){
    u.attackTarget =
      nearestEnemyOf(u, u.atkRange, e => e.kind === 'creep') ||
      nearestEnemyOf(u, u.atkRange, e => e.kind === 'hero');
  }
  if(u.attackTarget && u.atkTimer <= 0 && dist(u, u.attackTarget) <= u.atkRange + u.attackTarget.r + 30)
    performAttack(u, u.attackTarget);
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
  // bez vojnika: stani kod svoje prednje kule
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
    if(ab.cd > 0 || u.mp < ab.def.mana) continue;
    const hint = ab.def.bot;
    if(!hint) continue;
    const dEh = eh ? dist(u, eh) : 1e9;
    switch(hint.type){
      case 'heal':
        if(u.hp < u.maxhp * 0.65 || allyHeroLow(u, 270, 0.6)) castAbility(u, i, { x: u.x, y: u.y });
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
          if(e.kind === 'creep' && e.team !== u.team && !e.dead && !e.removeMe && dist(u, e) < hint.range) creepN++;
        }
        if((eh && dEh < hint.range) || creepN >= 3) castAbility(u, i, { x: u.x, y: u.y });
        break;
      }
      case 'gap':
        if(eh && dEh < hint.range && dEh > 120 && u.hp > u.maxhp * 0.55)
          castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'chain':
        if(eh && dEh < hint.range) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
      case 'shot':
      case 'zone':
        if(eh && dEh < hint.range) castAbility(u, i, { x: eh.x, y: eh.y });
        break;
    }
  }
}

function buyBotItems(u){
  while(u.buildI < BOT_BUILD.length){
    const item = ITEMS.find(it => it.id === BOT_BUILD[u.buildI]);
    if(!item || u.gold < item.cost) break;
    u.gold -= item.cost;
    applyItem(u, item);
    u.buildI++;
  }
}

function botThink(u){
  const b = u.bot;
  const fountain = FOUNTAIN[u.team];
  if(b.state === 'retreat'){
    if(u.hp > u.maxhp * 0.9){ b.state = 'lane'; }
    else {
      u.attackTarget = null;
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
  buyBotItems(u);
  const eh = nearestEnemyOf(u, 620, e => e.kind === 'hero');
  botUseAbilities(u, eh);

  // ne zalijeći se pod neprijateljsku kulu bez svojih vojnika
  const tw = nearestEnemyOf(u, 430, e => e.kind === 'tower');
  if(tw && countOwnCreepsNear(u.team, tw, 320) === 0){
    u.attackTarget = null;
    u.moveTarget = stepToward(u, fountain, 300);
    return;
  }
  // borba s junakom
  if(eh && dist(u, eh) < 520 && (u.hp / u.maxhp > 0.45 || eh.hp < eh.maxhp * 0.25)){
    u.attackTarget = eh;
    return;
  }
  // napadni prijestol ako je ranjiv
  const anc = ancients[1 - u.team];
  if(isTargetable(anc) && dist(u, anc) < 700){
    u.attackTarget = anc;
    return;
  }
  // farmaj vojnike
  const lh = lowestHpEnemyCreep(u, 500);
  if(lh){ u.attackTarget = lh; return; }
  // ruši kulu kad su vojnici uz tebe
  const et = nearestEnemyOf(u, 520, e => e.kind === 'tower');
  if(et && countOwnCreepsNear(u.team, et, 350) > 0){
    u.attackTarget = et;
    return;
  }
  // inače idi na svoju stazu
  u.attackTarget = null;
  const fp = laneFront(u.team, u.lane);
  if(dist(u, fp) > 150) u.moveTarget = fp;
  else u.moveTarget = null;
}

/* ================= Predmeti ================= */
function applyItem(h, item){
  if(item.instant){
    heal(h, item.heal);
    return;
  }
  const s = item.stats || {};
  if(s.dmg) h.dmg += s.dmg;
  if(s.hp){ h.maxhp += s.hp; h.hp += s.hp; }
  if(s.mp){ h.maxmp += s.mp; h.mp += s.mp; }
  if(s.speed) h.speed += s.speed;
  if(s.mpRegen) h.mpRegen += s.mpRegen;
  h.items.push(item);
}
function tryBuy(item){
  if(!player || gameOver) return;
  if(item.unique && player.items.some(it => it.id === item.id)){
    addFloat(player.x, player.y - 40, 'Već imaš to! 😄', '#e5e7eb', 14);
    return;
  }
  if(player.gold < item.cost){
    addFloat(player.x, player.y - 40, 'Nemaš dovoljno zlata! 💰', '#fca5a5', 14);
    sfx('click');
    return;
  }
  player.gold -= item.cost;
  applyItem(player, item);
  addFloat(player.x, player.y - 40, item.emoji + ' ' + item.name + '!', '#fde047', 15);
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
  u.flash = Math.max(0, u.flash - dt);
  u.atkTimer -= dt;

  // regeneracija
  if(u.hpRegen) u.hp = Math.min(u.maxhp, u.hp + u.hpRegen * dt);
  if(u.mpRegen) u.mp = Math.min(u.maxmp, u.mp + u.mpRegen * dt);

  if(u.kind === 'hero'){
    for(const ab of u.abilities) ab.cd = Math.max(0, ab.cd - dt);
    const f = FOUNTAIN[u.team];
    if(distXY(u.x, u.y, f.x, f.y) < CFG.fountainRadius){
      u.hp = Math.min(u.maxhp, u.hp + u.maxhp * CFG.fountainHeal * dt);
      u.mp = Math.min(u.maxmp, u.mp + u.maxmp * CFG.fountainHeal * dt);
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
  if(st.stun > 0) return;

  // razmišljanje
  if(u.kind === 'creep'){
    u.scanT -= dt;
    if(u.scanT <= 0){ u.scanT = 0.35; creepThink(u); }
  } else if(u.kind === 'hero' && u.bot){
    u.bot.thinkT -= dt;
    if(u.bot.thinkT <= 0){ u.bot.thinkT = rand(0.4, 0.6); botThink(u); }
  }

  // izvršavanje naredbi
  if(u.attackTarget){
    const t = u.attackTarget;
    if(!isTargetable(t)){ u.attackTarget = null; }
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
        applyDamage(t, p.dmg, p.src);
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
        if(e.kind !== 'creep' && e.kind !== 'hero') continue;
        if(p.hitIds[e.id]) continue;
        if(distXY(p.x, p.y, e.x, e.y) <= p.r + e.r){
          applyDamage(e, p.dmg, p.src);
          if(p.slow) applySlow(e, p.slow.f, p.slow.t);
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
    if(e.kind !== 'creep' && e.kind !== 'hero') continue;
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
      for(let i = 0; i < CFG.meleePerWave; i++) makeCreep(team, lane, false, i);
      for(let i = 0; i < CFG.rangedPerWave; i++) makeCreep(team, lane, true, i);
    }
  }
  if(waveCount === 1) announce('⚔️ Vojnici kreću!', 'Prati ih niz stazu');
}

function update(dt){
  gameTime += dt;
  // kamera
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

  // valovi
  waveTimer -= dt;
  if(waveTimer <= 0){
    waveTimer = CFG.waveEvery;
    spawnWave();
  }

  for(const u of units) updateUnit(u, dt);
  separation();
  updateProjectiles(dt);
  updateZones(dt);

  // efekti
  for(let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    if(p.t > p.life) particles.splice(i, 1);
  }
  for(let i = floats.length - 1; i >= 0; i--){
    const f = floats[i];
    f.t += dt; f.y -= 34 * dt;
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
    if(Math.abs(x - y) / Math.SQRT2 < 180) continue;                 // rijeka
    let nearLane = false;
    for(const l of LANE_LIST){
      if(distToPath(LANE_PTS[l], x, y) < 175){ nearLane = true; break; }
    }
    if(nearLane) continue;
    if(distXY(x, y, FOUNTAIN[0].x, FOUNTAIN[0].y) < 430) continue;
    if(distXY(x, y, FOUNTAIN[1].x, FOUNTAIN[1].y) < 430) continue;
    if(distXY(x, y, ANCIENT_POS[0].x, ANCIENT_POS[0].y) < 380) continue;
    if(distXY(x, y, ANCIENT_POS[1].x, ANCIENT_POS[1].y) < 380) continue;
    let nearTree = false;
    for(const t of trees){
      if(distXY(x, y, t.x, t.y) < 200){ nearTree = true; break; }
    }
    if(nearTree) continue;
    trees.push({ x, y, r: 24, size: rand(42, 62), kind: Math.random() < 0.7 ? '🌳' : '🌲' });
  }
}

function buildTerrain(){
  terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = WORLD;
  terrainCanvas.height = WORLD;
  const t = terrainCanvas.getContext('2d');

  // trava
  t.fillStyle = '#7ec850';
  t.fillRect(0, 0, WORLD, WORLD);
  for(let i = 0; i < 420; i++){
    t.fillStyle = Math.random() < 0.5 ? 'rgba(96,160,56,0.18)' : 'rgba(170,220,120,0.16)';
    t.beginPath();
    t.arc(rand(0, WORLD), rand(0, WORLD), rand(30, 130), 0, TAU);
    t.fill();
  }
  // cvjetići
  for(let i = 0; i < 200; i++){
    t.fillStyle = choice(['#fef08a', '#fda4af', '#e9d5ff', '#ffffff']);
    t.beginPath();
    t.arc(rand(0, WORLD), rand(0, WORLD), rand(3, 6), 0, TAU);
    t.fill();
  }

  // rijeka (dijagonala od gornjeg-lijevog do donjeg-desnog)
  t.strokeStyle = '#5ab6ee';
  t.lineWidth = 230;
  t.lineCap = 'round';
  t.beginPath(); t.moveTo(-50, -50); t.lineTo(WORLD + 50, WORLD + 50); t.stroke();
  t.strokeStyle = '#8ed3fa';
  t.lineWidth = 140;
  t.beginPath(); t.moveTo(-50, -50); t.lineTo(WORLD + 50, WORLD + 50); t.stroke();
  // svjetlucanje rijeke
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

  // baze
  for(let team = 0; team < 2; team++){
    const a = ANCIENT_POS[team];
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.22)' : 'rgba(239,68,68,0.22)';
    t.beginPath(); t.arc(a.x, a.y, 460, 0, TAU); t.fill();
    t.fillStyle = team === TEAM_BLUE ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)';
    t.beginPath(); t.arc(a.x, a.y, 260, 0, TAU); t.fill();
    // fontana
    const f = FOUNTAIN[team];
    t.fillStyle = 'rgba(255,255,255,0.55)';
    t.beginPath(); t.arc(f.x, f.y, 130, 0, TAU); t.fill();
    t.strokeStyle = team === TEAM_BLUE ? '#3b82f6' : '#ef4444';
    t.lineWidth = 10;
    t.beginPath(); t.arc(f.x, f.y, 130, 0, TAU); t.stroke();
    t.font = fontEmoji(90);
    t.textAlign = 'center'; t.textBaseline = 'middle';
    t.fillText('⛲', f.x, f.y);
  }

  // drveće
  t.textAlign = 'center'; t.textBaseline = 'middle';
  for(const tr of trees){
    t.fillStyle = 'rgba(0,0,0,0.15)';
    t.beginPath();
    t.ellipse(tr.x, tr.y + tr.size * 0.3, tr.size * 0.4, tr.size * 0.16, 0, 0, TAU);
    t.fill();
    t.font = fontEmoji(tr.size);
    t.fillText(tr.kind, tr.x, tr.y);
  }

  // rub svijeta
  t.strokeStyle = '#3f6b2a';
  t.lineWidth = 40;
  t.strokeRect(0, 0, WORLD, WORLD);
}

function makeWorld(){
  // prijestoli + čuvarske kule
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
}

/* ================= Početak / kraj igre ================= */
function startGame(heroIdx){
  units = []; projectiles = []; zones = []; particles = []; lines = [];
  floats = []; markers = []; feed = [];
  ancients = [null, null];
  kills = [0, 0];
  gameTime = 0; waveTimer = CFG.firstWave; waveCount = 0;
  firstBlood = false; gameOver = false; paused = false;
  banner = null;

  genTrees();
  buildTerrain();
  makeWorld();

  // junaci: ti + 2 bota (plavi) protiv 3 bota (crveni)
  const rest = shuffle(HEROES.map((h, i) => i).filter(i => i !== heroIdx));
  makeHero(HEROES[heroIdx], TEAM_BLUE, true, 'mid');
  makeHero(HEROES[rest[0]], TEAM_BLUE, false, 'top');
  makeHero(HEROES[rest[1]], TEAM_BLUE, false, 'bot');
  makeHero(HEROES[rest[2]], TEAM_RED, false, 'mid');
  makeHero(HEROES[rest[3]], TEAM_RED, false, 'top');
  makeHero(HEROES[rest[4]], TEAM_RED, false, 'bot');

  cam.x = player.x; cam.y = player.y; cam.zoom = 0.9; cam.follow = true;
  running = true;
  document.getElementById('select').classList.add('hidden');
  announce('🏰 Sruši crveni prijestol! 👑', 'Q W E = moći • B = dućan • H = pomoć');
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
  // konfeti
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

/* ================= Zvuk (WebAudio, bez datoteka) ================= */
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
  const dx = Math.abs(x - cam.x), dy = Math.abs(y - cam.y);
  if(dx < VW / 2 / cam.zoom + 250 && dy < VH / 2 / cam.zoom + 250) sfx(name);
}

/* ================= Unos ================= */
function screenToWorld(sx, sy){
  return { x: (sx - VW / 2) / cam.zoom + cam.x, y: (sy - VH / 2) / cam.zoom + cam.y };
}
function pickEnemyAt(wx, wy, team){
  let best = null, bd = 1e9;
  for(const e of units){
    if(e.removeMe || e.dead || e.team === team || e.invuln) continue;
    const d = distXY(wx, wy, e.x, e.y);
    if(d < e.r + 16 && d < bd){ bd = d; best = e; }
  }
  return best;
}
function playerCommand(wx, wy){
  if(!player || player.dead || gameOver) return;
  // klik na zaštićeni prijestol?
  for(const a of ancients){
    if(a && a.invuln && a.team !== player.team && distXY(wx, wy, a.x, a.y) < a.r + 16){
      addFloat(a.x, a.y - a.r - 20, '🛡️ Prvo sruši čuvarske kule!', '#fff', 15);
    }
  }
  const t = pickEnemyAt(wx, wy, player.team);
  if(t){
    player.attackTarget = t;
    player.moveTarget = null;
    markers.push({ x: t.x, y: t.y, t: 0, color: '#f87171', r: t.r + 12 });
  } else {
    player.attackTarget = null;
    player.moveTarget = { x: clamp(wx, 40, WORLD - 40), y: clamp(wy, 40, WORLD - 40) };
    markers.push({ x: wx, y: wy, t: 0, color: '#4ade80', r: 20 });
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
  return { x: u.x + u.face * 220, y: u.y };
}

function setupInput(){
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    if(ac() && AC.state === 'suspended') AC.resume();
    const sx = e.clientX, sy = e.clientY;
    if(!running || gameOver) return;
    // UI gumbi
    if(e.button === 0){
      for(let i = 0; i < uiRects.abil.length; i++){
        if(inRect(sx, sy, uiRects.abil[i])){
          castAbility(player, i, aimFallback(player));
          return;
        }
      }
      if(inRect(sx, sy, uiRects.shop)){ toggleShop(); return; }
      if(inRect(sx, sy, uiRects.mute)){ muted = !muted; sfx('click'); return; }
      if(inRect(sx, sy, uiRects.help)){ toggleHelp(); return; }
    }
    // minimapa
    if(inRect(sx, sy, uiRects.mini)){
      const w = miniToWorld(sx, sy);
      if(e.button === 2) playerCommand(w.x, w.y);
      else { cam.x = w.x; cam.y = w.y; cam.follow = false; miniDrag = true; }
      return;
    }
    // svijet
    const w = screenToWorld(sx, sy);
    playerCommand(w.x, w.y);
  });

  window.addEventListener('mouseup', () => { miniDrag = false; });

  canvas.addEventListener('mousemove', e => {
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
    if(inRect(mouse.sx, mouse.sy, uiRects.shop)) hoverUi = { type: 'shop' };
    if(inRect(mouse.sx, mouse.sy, uiRects.mute)) hoverUi = { type: 'mute' };
    if(inRect(mouse.sx, mouse.sy, uiRects.help)) hoverUi = { type: 'help' };
    canvas.style.cursor = hoverUi ? 'pointer' : 'crosshair';
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if(!running) return;
    const before = screenToWorld(mouse.sx, mouse.sy);
    cam.zoom = clamp(cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 1.7);
    const after = screenToWorld(mouse.sx, mouse.sy);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if(!running) return;
    if(k === ' '){ e.preventDefault(); cam.follow = true; if(player){ cam.x = player.x; cam.y = player.y; } }
    if(gameOver) return;
    if(k === 'q') castAbility(player, 0, { x: mouse.wx, y: mouse.wy });
    if(k === 'w') castAbility(player, 1, { x: mouse.wx, y: mouse.wy });
    if(k === 'e') castAbility(player, 2, { x: mouse.wx, y: mouse.wy });
    if(k === 's' && player && !player.dead){ player.moveTarget = null; player.attackTarget = null; }
    if(k === 'b') toggleShop();
    if(k === 'h') toggleHelp();
    if(k === 'm'){ muted = !muted; }
    if(k === 'p'){ paused = !paused; document.getElementById('pause').classList.toggle('hidden', !paused); }
    if(k === 'escape'){
      if(shopOpen) toggleShop();
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
function refreshShop(){
  if(!player) return;
  document.getElementById('shopGold').textContent = '💰 ' + Math.floor(player.gold);
  const wrap = document.getElementById('shopItems');
  for(const item of ITEMS){
    const btn = document.getElementById('buy-' + item.id);
    if(!btn) continue;
    const owned = item.unique && player.items.some(it => it.id === item.id);
    btn.disabled = owned || player.gold < item.cost;
    btn.textContent = owned ? 'Imaš ✓' : item.cost + ' 💰';
  }
}
function buildShopDom(){
  const wrap = document.getElementById('shopItems');
  let html = '';
  for(const item of ITEMS){
    html += `<div class="shopItem">
      <span class="si-emoji">${item.emoji}</span>
      <span class="si-info"><b>${item.name}</b><small>${item.desc}</small></span>
      <button id="buy-${item.id}">${item.cost} 💰</button>
    </div>`;
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
    html += `<div class="card" id="card-${i}">
      <div class="c-emoji">${h.emoji}</div>
      <div class="c-name">${h.name}</div>
      <div class="c-role">${h.role}</div>
    </div>`;
  });
  cards.innerHTML = html;
  HEROES.forEach((h, i) => {
    document.getElementById('card-' + i).addEventListener('click', () => {
      selectedHero = i;
      document.querySelectorAll('.card').forEach(c => c.classList.remove('sel'));
      document.getElementById('card-' + i).classList.add('sel');
      let det = `<div class="d-head">${h.emoji} <b>${h.name}</b></div><div class="d-role">${h.role}</div>`;
      for(const a of h.abilities){
        det += `<div class="d-abil"><b>${a.key}</b> ${a.emoji} <b>${a.name}</b> — ${a.desc}</div>`;
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

/* ================= Crtanje ================= */
function drawBar(x, y, w, h, frac, fg, bg){
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamp(frac, 0, 1)), h - 2);
}

function drawUnit(u){
  const x = u.x, y = u.y;
  // sjena
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + u.r * 0.75, u.r * 0.85, u.r * 0.35, 0, 0, TAU);
  ctx.fill();

  if(u.kind === 'tower'){
    ctx.fillStyle = TEAM_LIGHT[u.team];
    ctx.strokeStyle = TEAM_COLOR[u.team];
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(x - 34, y - 34, 68, 68, 14); ctx.fill(); ctx.stroke();
    ctx.font = fontEmoji(46);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏰', x, y - 4);
    drawBar(x - 42, y - 62, 84, 9, u.hp / u.maxhp, TEAM_COLOR[u.team]);
  }
  else if(u.kind === 'ancient'){
    const pulse = 1 + Math.sin(gameTime * 2.2) * 0.04;
    const grad = ctx.createRadialGradient(x, y, 8, x, y, u.r * pulse);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, TEAM_LIGHT[u.team]);
    ctx.fillStyle = grad;
    ctx.strokeStyle = TEAM_COLOR[u.team];
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(x, y, u.r * pulse, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.font = fontEmoji(64);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('👑', x, y - 4);
    if(u.invuln){
      ctx.font = fontEmoji(26);
      ctx.fillText('🛡️', x, y - u.r - 26);
    }
    drawBar(x - 60, y - u.r - 16, 120, 11, u.hp / u.maxhp, TEAM_COLOR[u.team]);
  }
  else if(u.kind === 'creep'){
    ctx.fillStyle = TEAM_LIGHT[u.team];
    ctx.strokeStyle = TEAM_COLOR[u.team];
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, u.r, 0, TAU); ctx.fill(); ctx.stroke();
    // slatko lice
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(x - u.r * 0.32, y - 3, 2.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + u.r * 0.32, y - 3, 2.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y + 3, u.r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if(u.rangedCreep){
      ctx.font = fontEmoji(13);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✨', x + u.r * 0.8, y - u.r * 0.8);
    }
    drawBar(x - 16, y - u.r - 11, 32, 5, u.hp / u.maxhp, TEAM_COLOR[u.team]);
  }
  else if(u.kind === 'hero'){
    // tijelo
    const grad = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, u.r + 3);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, TEAM_LIGHT[u.team]);
    ctx.fillStyle = grad;
    ctx.strokeStyle = u.isPlayer ? '#fde047' : TEAM_COLOR[u.team];
    ctx.lineWidth = u.isPlayer ? 5 : 4;
    ctx.beginPath(); ctx.arc(x, y, u.r, 0, TAU); ctx.fill(); ctx.stroke();
    // emoji junaka (okrenut po smjeru)
    ctx.save();
    ctx.translate(x, y - 2);
    ctx.scale(u.face < 0 ? -1 : 1, 1);
    ctx.font = fontEmoji(30);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.emoji, 0, 0);
    ctx.restore();
    // štit / statusi
    if(u.status.shieldT > 0){
      ctx.strokeStyle = 'rgba(253,224,71,0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, u.r + 8, 0, TAU); ctx.stroke();
    }
    if(u.status.stun > 0){
      ctx.font = fontEmoji(16);
      const a = gameTime * 6;
      ctx.fillText('⭐', x + Math.cos(a) * 18, y - u.r - 16 + Math.sin(a) * 5);
      ctx.fillText('⭐', x - Math.cos(a) * 18, y - u.r - 16 - Math.sin(a) * 5);
    }
    if(u.status.rootT > 0){
      ctx.font = fontEmoji(18);
      ctx.fillText('🌱', x, y + u.r + 6);
    }
    if(u.status.slowT > 0){
      ctx.font = fontEmoji(14);
      ctx.fillText('❄️', x - u.r - 8, y);
    }
    // ime + trake
    ctx.font = fontTxt(13, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const nm = u.name + (u.isPlayer ? ' ⭐' : '');
    ctx.strokeText(nm, x, y - u.r - 22);
    ctx.fillText(nm, x, y - u.r - 22);
    drawBar(x - 26, y - u.r - 19, 52, 7, u.hp / u.maxhp, u.team === TEAM_BLUE ? '#22c55e' : '#ef4444');
    drawBar(x - 26, y - u.r - 11, 52, 4, u.maxmp ? u.mp / u.maxmp : 0, '#38bdf8');
    // level
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(x + u.r * 0.85, y + u.r * 0.7, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = fontTxt(11, true);
    ctx.textBaseline = 'middle';
    ctx.fillText(u.level, x + u.r * 0.85, y + u.r * 0.7 + 1);
  }

  // bljesak štete
  if(u.flash > 0){
    ctx.fillStyle = 'rgba(255,255,255,' + (u.flash * 3.5) + ')';
    ctx.beginPath(); ctx.arc(x, y, u.r + 2, 0, TAU); ctx.fill();
  }
}

function render(){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#16331f';
  ctx.fillRect(0, 0, VW, VH);
  if(!running) return;

  ctx.save();
  ctx.translate(VW / 2, VH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  if(terrainCanvas) ctx.drawImage(terrainCanvas, 0, 0);

  // zone (najave i aktivne)
  for(const z of zones){
    ctx.save();
    if(!z.started){
      const f = clamp(z.t / z.delay, 0, 1);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = z.color;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * f, 0, TAU); ctx.fill();
    } else {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = z.color;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = fontEmoji(40);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(z.emoji, z.x, z.y - 10 + Math.sin(gameTime * 8) * 6);
    }
    ctx.restore();
  }

  // oznake klika / prstenovi
  for(const m of markers){
    const f = m.t / 0.5;
    ctx.globalAlpha = 1 - f;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = m.isRing ? 5 : 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.isRing ? m.r * (0.4 + f * 0.6) : m.r * (1 - f * 0.5), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // domet napada igrača (nježno)
  if(player && !player.dead && player.atkRange > 100){
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.atkRange, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // jedinice (sortirane po y), samo vidljive
  const viewL = cam.x - VW / 2 / cam.zoom - 120, viewR = cam.x + VW / 2 / cam.zoom + 120;
  const viewT = cam.y - VH / 2 / cam.zoom - 120, viewB = cam.y + VH / 2 / cam.zoom + 120;
  const drawList = [];
  for(const u of units){
    if(u.dead || u.removeMe) continue;
    if(u.x < viewL || u.x > viewR || u.y < viewT || u.y > viewB) continue;
    drawList.push(u);
  }
  drawList.sort((a, b) => a.y - b.y);
  for(const u of drawList) drawUnit(u);

  // projektili
  for(const p of projectiles){
    if(p.emoji){
      ctx.save();
      ctx.translate(p.x, p.y);
      const ang = p.kind === 'skill' ? Math.atan2(p.vy, p.vx) : 0;
      ctx.rotate(ang);
      ctx.font = fontEmoji(p.r * 2.2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.45, 0, TAU); ctx.fill();
    }
  }

  // munje / linije
  for(const l of lines){
    ctx.globalAlpha = 1 - l.t / l.life;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = l.w;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // čestice
  for(const p of particles){
    ctx.globalAlpha = 1 - p.t / p.life;
    if(p.emoji){
      ctx.font = fontEmoji(p.size * 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // lebdeći brojevi
  for(const f of floats){
    ctx.globalAlpha = f.t < 0.7 ? 1 : 1 - (f.t - 0.7) / 0.4;
    ctx.font = fontTxt(f.size, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.txt, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  drawHud();
}

/* ================= HUD ================= */
function drawHud(){
  // ----- gornja ploča: rezultat + vrijeme + prijestoli -----
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
  ctx.fillText(mm + ':' + (ss < 10 ? '0' : '') + ss, tx + tw / 2, 50);
  // mini trake prijestola
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
  if(player){
    const pw = 560, ph = 104;
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
    const bx = px + 104, bw = 230;
    ctx.font = fontTxt(14, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(player.name + ' ⭐', bx, py + 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.fillText('💰 ' + Math.floor(player.gold), bx + bw, py + 16);
    drawBar(bx, py + 28, bw, 17, player.hp / player.maxhp, '#22c55e');
    drawBar(bx, py + 48, bw, 11, player.maxmp ? player.mp / player.maxmp : 0, '#38bdf8');
    drawBar(bx, py + 62, bw, 6, player.xp / xpNeed(player.level), '#fde047');
    ctx.font = fontTxt(11, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.ceil(player.hp) + ' / ' + player.maxhp, bx + bw / 2, py + 37);
    // predmeti
    ctx.font = fontEmoji(16);
    ctx.textAlign = 'left';
    const shown = player.items.slice(-9);
    for(let i = 0; i < shown.length; i++){
      ctx.fillText(shown[i].emoji, bx + i * 22, py + 86);
    }

    // moći (Q W E)
    uiRects.abil = [];
    const ax0 = px + 354, ay = py + 18, as = 62, gap = 10;
    for(let i = 0; i < 3; i++){
      const ab = player.abilities[i];
      const ax = ax0 + i * (as + gap);
      uiRects.abil.push({ x: ax, y: ay, w: as, h: as });
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 12); ctx.fill();
      const noMana = player.mp < ab.def.mana;
      ctx.strokeStyle = noMana ? '#38bdf8' : '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(ax, ay, as, as, 12); ctx.stroke();
      ctx.font = fontEmoji(30);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = ab.cd > 0 || noMana ? 0.45 : 1;
      ctx.fillText(ab.def.emoji, ax + as / 2, ay + as / 2 - 4);
      ctx.globalAlpha = 1;
      // cooldown "pita"
      if(ab.cd > 0){
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(ax + as / 2, ay + as / 2);
        ctx.arc(ax + as / 2, ay + as / 2, as * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * (ab.cd / ab.def.cd));
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = fontTxt(18, true);
        ctx.fillText(Math.ceil(ab.cd), ax + as / 2, ay + as / 2);
      }
      ctx.fillStyle = '#fde047';
      ctx.font = fontTxt(12, true);
      ctx.fillText(ab.def.key, ax + 10, ay + 10);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = fontTxt(10, true);
      ctx.fillText(ab.def.mana, ax + as - 11, ay + as - 9);
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
    if(hoverUi && hoverUi.type === 'abil'){
      const ab = player.abilities[hoverUi.i];
      const txt1 = ab.def.emoji + ' ' + ab.def.name;
      const txt2 = ab.def.desc;
      const txt3 = '💧 ' + ab.def.mana + '   ⏱️ ' + ab.def.cd + 's';
      ctx.font = fontTxt(14, true);
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
  // rijeka
  ctx.strokeStyle = '#5ab6ee';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + ms, my + ms); ctx.stroke();
  // staze
  ctx.strokeStyle = '#d9c79b';
  ctx.lineWidth = 6;
  for(const l of LANE_LIST){
    const pts = LANE_PTS[l];
    ctx.beginPath();
    ctx.moveTo(mx + pts[0][0] * sc, my + pts[0][1] * sc);
    for(let i = 1; i < pts.length; i++) ctx.lineTo(mx + pts[i][0] * sc, my + pts[i][1] * sc);
    ctx.stroke();
  }
  // jedinice
  for(const u of units){
    if(u.dead || u.removeMe) continue;
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
    } else {
      ctx.fillStyle = TEAM_COLOR[u.team];
      ctx.strokeStyle = u.isPlayer ? '#fde047' : '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ux, uy, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  // okvir kamere
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    mx + (cam.x - VW / 2 / cam.zoom) * sc,
    my + (cam.y - VH / 2 / cam.zoom) * sc,
    VW / cam.zoom * sc, VH / cam.zoom * sc);
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
  render();
}

function resize(){
  DPR = window.devicePixelRatio || 1;
  VW = window.innerWidth;
  VH = window.innerHeight;
  canvas.width = VW * DPR;
  canvas.height = VH * DPR;
  canvas.style.width = VW + 'px';
  canvas.style.height = VH + 'px';
}

window.addEventListener('error', e => {
  const el = document.getElementById('err');
  if(el){
    el.style.display = 'block';
    el.textContent = '⚠️ Greška: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')';
  }
});

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  buildSelectScreen();
  buildShopDom();
  setupInput();
  requestAnimationFrame(frame);
});
