'use strict';
/* ============================================================
   DOTA Kids 3D — MULTIPLAYER (PeerJS, P2P, domaćin = autoritet)
   - Domaćin vrti cijelu simulaciju i šalje snapshot ~12×/s.
   - Gost šalje samo naredbe (klik, moći, kupovine...).
   - 1 na 1: domaćin = plavi mid, gost = crveni mid, 4 bota.
   ============================================================ */

const net = {
  mode: 'local',          // 'local' | 'host' | 'guest'
  peer: null, conn: null,
  code: '',
  myPick: -1, otherPick: -1, myReady: false, otherReady: false,
  snapT: 0,
  guestUnits: new Map(),  // id -> jedinica (gost)
  ringBuilt: false,
  wasDead: false,
  visT: 0,
};

function isHuman(u){ return !!(u && (u.isPlayer || u.human)); }

/* ---------- LOBBY UI ---------- */
function netStatus(txt){
  const el = document.getElementById('mpStatus');
  if(el) el.textContent = txt;
}
function makeRoomCode(){
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function initNetUI(){
  document.getElementById('mpHost').addEventListener('click', netCreateRoom);
  document.getElementById('mpJoin').addEventListener('click', () => {
    const code = document.getElementById('mpCode').value.trim().toUpperCase();
    if(code.length === 4) netJoinRoom(code);
    else netStatus('Upiši kod sobe od 4 znaka!');
  });
}

function netCreateRoom(){
  if(net.peer) return;
  net.mode = 'host';
  net.code = makeRoomCode();
  netStatus('Stvaram sobu...');
  net.peer = new Peer('dotakids-' + net.code);
  net.peer.on('open', () => {
    const big = document.getElementById('mpCodeBig');
    big.textContent = '🔑 ' + net.code;
    big.classList.remove('hidden');
    netStatus('Pošalji prijatelju kod i čekaj da uđe...');
  });
  net.peer.on('connection', (c) => {
    if(net.conn){ c.close(); return; }
    net.conn = c;
    bindConn();
  });
  net.peer.on('error', (e) => {
    netStatus('⚠️ Greška veze: ' + e.type);
    netResetLobby();
  });
}
function netJoinRoom(code){
  if(net.peer) return;
  net.mode = 'guest';
  net.code = code;
  myTeam = TEAM_RED;
  netStatus('Spajam se na sobu ' + code + '...');
  net.peer = new Peer();
  net.peer.on('open', () => {
    net.conn = net.peer.connect('dotakids-' + code, { reliable: true });
    bindConn();
  });
  net.peer.on('error', (e) => {
    netStatus('⚠️ Ne mogu se spojiti (' + e.type + ') — provjeri kod!');
    netResetLobby();
  });
}
function netResetLobby(){
  try { if(net.peer) net.peer.destroy(); } catch(err){}
  net.peer = null; net.conn = null;
  net.mode = 'local';
  myTeam = TEAM_BLUE;
  net.myPick = -1; net.otherPick = -1; net.myReady = false; net.otherReady = false;
}
function bindConn(){
  net.conn.on('open', () => {
    document.getElementById('startBtn').textContent = '✅ SPREMAN!';
    netStatus(net.mode === 'host'
      ? '✅ Prijatelj je tu! Odaberite junake pa stisnite SPREMAN.'
      : '✅ Spojen! Ti si 🔴 crveni — odaberi junaka pa SPREMAN.');
    sendNet({ c: 'hello' });
  });
  net.conn.on('data', onNetData);
  net.conn.on('close', onNetClose);
  net.conn.on('error', () => {});
}
function sendNet(o){
  if(net.conn && net.conn.open){
    try { net.conn.send(o); } catch(err){}
  }
}
function onNetClose(){
  if(running && !gameOver){
    if(net.mode === 'host' && remoteHero){
      remoteHero.human = false;
      remoteHero.bot = { state: 'lane', thinkT: 0.5 };
      announce('🔌 Prijatelj je izašao', 'Preuzima ga bot');
      net.conn = null;
    } else if(net.mode === 'guest'){
      alert('Veza s domaćinom je prekinuta. 😢');
      location.reload();
    }
  } else {
    netStatus('Veza prekinuta.');
    net.conn = null;
  }
}

/* ---------- lobby: odabir i spremnost ---------- */
function netPick(i){
  net.myPick = i;
  sendNet({ c: 'pick', i });
  syncLobbyText();
}
function netReady(){
  if(net.myPick < 0){ netStatus('Prvo klikni junaka!'); return; }
  net.myReady = true;
  sendNet({ c: 'ready' });
  syncLobbyText();
  tryStartMatch();
}
function syncLobbyText(){
  if(!net.conn || running) return;
  const nm = (i) => i >= 0 ? HEROES[i].emoji + ' ' + HEROES[i].name : '…';
  netStatus('Ti: ' + nm(net.myPick) + (net.myReady ? ' ✅' : '') +
    '  •  Prijatelj: ' + nm(net.otherPick) + (net.otherReady ? ' ✅' : ''));
}
function tryStartMatch(){
  if(net.mode !== 'host' || !net.myReady || !net.otherReady) return;
  if(net.myPick < 0 || net.otherPick < 0) return;
  const pool = shuffle(HEROES.map((h, i) => i)
    .filter(i => i !== net.myPick && i !== net.otherPick));
  const bots = pool.slice(0, 4);
  genTrees();
  sendNet({ c: 'start', host: net.myPick, guest: net.otherPick, bots, trees });
  startMatchHost(net.myPick, net.otherPick, bots);
}

/* ---------- poruke ---------- */
function onNetData(d){
  if(!d || !d.c) return;
  switch(d.c){
    case 'hello': syncLobbyText(); break;
    case 'pick': net.otherPick = d.i; syncLobbyText(); break;
    case 'ready':
      net.otherReady = true;
      syncLobbyText();
      if(net.mode === 'host') tryStartMatch();
      break;
    case 'start': if(net.mode === 'guest') startMatchGuest(d); break;
    case 'snap': if(net.mode === 'guest') applySnapshot(d); break;
    case 'end':
      if(net.mode === 'guest' && !gameOver) endGameView(d.win);
      break;
    // --- ulazi gosta (obrađuje domaćin) ---
    case 'cmd':
      if(net.mode === 'host' && remoteHero && !remoteHero.dead){
        if(d.stop){ remoteHero.moveTarget = null; remoteHero.attackTarget = null; cancelTeleport(remoteHero); }
        else playerCommandFor(remoteHero, d.x, d.y);
      }
      break;
    case 'cast': if(net.mode === 'host' && remoteHero) castAbility(remoteHero, d.i, { x: d.x, y: d.y }); break;
    case 'learn': if(net.mode === 'host' && remoteHero) learnAbility(remoteHero, d.i); break;
    case 'stats': if(net.mode === 'host' && remoteHero) learnStats(remoteHero); break;
    case 'buy': if(net.mode === 'host' && remoteHero && ITEM_BY_ID[d.id]) tryBuy(remoteHero, ITEM_BY_ID[d.id]); break;
    case 'sell': if(net.mode === 'host' && remoteHero) sellItem(remoteHero, d.i); break;
    case 'tp': if(net.mode === 'host' && remoteHero) startTeleport(remoteHero); break;
    case 'buyback': if(net.mode === 'host' && remoteHero) buyback(remoteHero); break;
    case 'item': if(net.mode === 'host' && remoteHero) useItem(remoteHero, d.i, d.x != null ? { x: d.x, y: d.y } : null); break;
    case 'glyph': if(net.mode === 'host' && remoteHero) useGlyph(remoteHero.team, remoteHero); break;
    case 'talent': if(net.mode === 'host' && remoteHero) chooseTalent(remoteHero, d.l, d.p === 'b' ? 'b' : 'a'); break;
  }
}

/* gost → domaćin */
function netCmd(wx, wy){ sendNet({ c: 'cmd', x: Math.round(wx), y: Math.round(wy) }); }
function netStop(){ sendNet({ c: 'cmd', stop: 1 }); }
function netCast(i, aim){ sendNet({ c: 'cast', i, x: Math.round(aim.x), y: Math.round(aim.y) }); }
function netLearn(i){ sendNet({ c: 'learn', i }); }
function netStats(){ sendNet({ c: 'stats' }); }
function netBuy(id){ sendNet({ c: 'buy', id }); }
function netSell(i){ sendNet({ c: 'sell', i }); }
function netTp(){ sendNet({ c: 'tp' }); }
function netBuyback(){ sendNet({ c: 'buyback' }); }
function netItem(i, aim){ sendNet({ c: 'item', i, x: aim ? Math.round(aim.x) : null, y: aim ? Math.round(aim.y) : null }); }
function netGlyph(){ sendNet({ c: 'glyph' }); }
function netTalent(l, p){ sendNet({ c: 'talent', l, p }); }

/* ---------- SNAPSHOT: domaćin → gost ---------- */
function packStatus(st){
  return [st.slowT, st.stun, st.rootT, st.shieldT, st.hasteT, st.invisT, st.trackT, st.dmgMulT,
    st.silenceT, st.immuneT, st.poisonT, st.curseT, st.blindT, st.formT, st.rageT].map(v => Math.round(v * 10));
}
function heroExtras(h){
  return {
    g: Math.floor(h.gold), xp: Math.round(h.xp), sp: h.skillPoints, sr: h.statRanks,
    s: Math.round(h.str), a: Math.round(h.agi), n: Math.round(h.int),
    hr: +h.hpRegen.toFixed(2), mr: +h.mpRegen.toFixed(2),
    spd: Math.round(h.speed), dm: Math.round(h.dmg), ib: h.itemBonus.dmg,
    tc: +h.tpCd.toFixed(1), tch: +h.tpChannel.toFixed(2), dt2: +h.deadT.toFixed(1),
    as: h.assists, bb: +h.buybackCd.toFixed(1), ag: h.aegis ? 1 : 0, at: Math.round(h.aegisT), ic: h.itemCd, ich: h.itemCharges,
    tal: h.talents, cdr: h.cdr || 0,
    ab: h.abilities.map(a => [a.rank, +a.cd.toFixed(1)]),
    it: h.items.map(i => i.id),
    ip: h.items.reduce((a, it, k) => (it.pending && a.push(k), a), []),   // 🫏 čekaju kurira
  };
}
const CAMP_KEYS = ['boars', 'wolves', 'bear', 'boss', 'golem'];
function buildSnapshot(){
  const us = [];
  for(const u of units){
    if(u.removeMe) continue;
    const b = {
      i: u.id, k: u.kind, t: u.team,
      x: Math.round(u.x), y: Math.round(u.y),
      h: Math.round(u.hp), m: u.maxhp,
      d: +(u.dir || 0).toFixed(2),
    };
    if(u.atkN) b.an = u.atkN % 1000;     // 3D animacije napada i čaranja
    if(u.castN){ b.cn = u.castN % 1000; b.cf = u.castFx; }
    if(u.knockN) b.kn = u.knockN % 1000;   // odbačaj
    if(u.charge) b.ch = 1;                 // juriš
    if(u.kind === 'hero'){
      b.hi = HEROES.indexOf(u.hero);
      b.l = u.level; b.dd = u.dead ? 1 : 0;
      b.mp = Math.round(u.mp); b.mm = u.maxmp;
      b.st = packStatus(u.status);
      b.k2 = u.kills; b.d2 = u.deaths; b.a2 = u.assists; b.gd2 = Math.floor(u.gold);
      b.lh = u.lastHits || 0; b.dn = u.denies || 0;
      b.pl = u.isPlayer ? 1 : (u.human ? 2 : 0);
      if(u.aegis) b.ag = 1;
      b.it2 = u.items.map(i => i.emoji).join('');
    }
    else if(u.kind === 'creep'){ if(u.rangedCreep) b.rc = 1; if(u.siege) b.sg = 1; if(u.summonModel) b.sm = u.summonModel; if(u.superCreep) b.su = 1; }
    else if(u.kind === 'barracks'){ b.iv = u.invuln ? 1 : 0; b.ln = u.lane; }
    if(u.bdT != null && gameTime - u.bdT < 0.5) b.bd = 1;   // 🛡️ backdoor zaštita upravo radi
    else if(u.kind === 'neutral'){ b.ct = CAMP_KEYS.indexOf(u.camp.type); }
    else if(u.kind === 'tower'){ if(u.isGuard) b.gd = 1; }
    else if(u.kind === 'ancient'){ b.iv = u.invuln ? 1 : 0; }
    us.push(b);
  }
  return {
    c: 'snap', gt: +gameTime.toFixed(2), ks: kills.slice(),
    u: us,
    p: projectiles.map(p => ({ i: p.id, x: Math.round(p.x), y: Math.round(p.y), r: p.r, cl: p.color, e: p.emoji || 0,
      sh: p.shot || 0, sx: Math.round(p.src ? p.src.x : p.x), sy: Math.round(p.src ? p.src.y : p.y),
      tx: p.target ? Math.round(p.target.x) : 0, ty: p.target ? Math.round(p.target.y) : 0 })),
    z: zones.map(z => ({ i: z.id, x: Math.round(z.x), y: Math.round(z.y), r: z.r, t: +z.t.toFixed(2), dl: z.delay, s: z.started ? 1 : 0, cl: z.color, e: z.emoji, tk: z.ticksLeft })),
    rn: runes.length ? [{ x: runes[0].x, y: runes[0].y, di: RUNE_TYPES.indexOf(runes[0].def) }] : [],
    mk: markers.map(m => ({ x: Math.round(m.x), y: Math.round(m.y), t: +m.t.toFixed(2), r: Math.round(m.r), ir: m.isRing ? 1 : 0, cl: m.color })),
    ln: lines.map(l => ({ x1: Math.round(l.x1), y1: Math.round(l.y1), x2: Math.round(l.x2), y2: Math.round(l.y2), t: +l.t.toFixed(2), lf: l.life, cl: l.color, w: l.w })),
    fl: floats.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), hh: Math.round(f.h), tx: f.txt, cl: f.color, sz: f.size, t: +f.t.toFixed(2) })),
    fd: feed.map(f => ({ tx: f.txt, cl: f.color, t: +f.t.toFixed(2) })),
    bn: banner ? { tx: banner.txt, sb: banner.sub, t: banner.t, dr: banner.dur } : 0,
    me: remoteHero ? heroExtras(remoteHero) : 0,
    nf: +nightForceT.toFixed(1),
    gl: [Math.round(glyph[0].t * 10), Math.round(glyph[0].cd), Math.round(glyph[1].t * 10), Math.round(glyph[1].cd)],
    sh: shrines.map(s => [Math.round(s.cd), +s.t.toFixed(1)]),
    cu: couriers.map(c => [Math.round(c.x), Math.round(c.y), +c.dir.toFixed(2), ['home', 'go', 'back'].indexOf(c.state), c.carry]),
    wd: wards.map(w => ({ x: Math.round(w.x), y: Math.round(w.y), r: w.r, t: +w.t.toFixed(1), tm: w.team })),
  };
}
function maybeSendSnapshot(now){
  if(net.mode !== 'host' || !net.conn || !net.conn.open || !running) return;
  if(now - net.snapT < 80) return;
  net.snapT = now;
  sendNet(buildSnapshot());
}

/* ---------- gost: primjena snapshotta ---------- */
function unpackStatus(st, arr){
  st.slowT = arr[0] / 10; st.stun = arr[1] / 10; st.rootT = arr[2] / 10;
  st.shieldT = arr[3] / 10; st.hasteT = arr[4] / 10; st.invisT = arr[5] / 10;
  st.trackT = arr[6] / 10; st.dmgMulT = arr[7] / 10;
  st.silenceT = (arr[8] || 0) / 10; st.immuneT = (arr[9] || 0) / 10; st.poisonT = (arr[10] || 0) / 10;
  st.curseT = (arr[11] || 0) / 10; st.blindT = (arr[12] || 0) / 10; st.formT = (arr[13] || 0) / 10; st.rageT = (arr[14] || 0) / 10;
  if(st.slowT > 0 && st.slowF <= 0) st.slowF = 0.3;
  st.dmgMulF = st.dmgMulT > 0 ? 2 : 1;
  st.hasteF = st.hasteT > 0 ? 1.3 : 1;
  st.shieldF = 0.5;
}
function makeGuestUnit(b){
  const base = {
    id: b.i, kind: b.k, team: b.t, x: b.x, y: b.y,
    hp: b.h, maxhp: b.m, mp: 0, maxmp: 0,
    dir: b.d || 0, face: 1, r: 16,
    dead: false, removeMe: false, invuln: false,
    status: baseStatus(), flash: 0,
    moveTarget: null, attackTarget: null,
    isStatic: false, lastMoveT: -9,
    tx2: b.x, ty2: b.y, tDir: b.d || 0,
  };
  if(b.k === 'hero'){
    const def = HEROES[b.hi];
    base.r = 22;
    base.hero = def; base.name = def.name; base.emoji = def.emoji;
    base.atkRange = def.range; base.projSpeed = def.projSpeed;
    base.level = b.l || 1; base.maxmp = b.mm || 0;
    base.kills = 0; base.deaths = 0; base.gold = 0; base.xp = 0;
    base.skillPoints = 0; base.statRanks = 0;
    base.str = def.attrs.str; base.agi = def.attrs.agi; base.int = def.attrs.int;
    base.hpRegen = 0; base.mpRegen = 0; base.speed = def.speed; base.dmg = def.dmg;
    base.itemBonus = { dmg: 0, hp: 0, mp: 0, speed: 0, hpRegen: 0, mpRegen: 0 };
    base.tpCd = 0; base.tpChannel = 0; base.deadT = 0;
    base.items = [];
    base.abilities = def.abilities.map(a => ({ def: a, rank: 0, cd: 0 }));
    base.isPlayer = (b.pl === 2);   // GOST: moj junak je onaj kojeg vodi čovjek na crvenoj strani
    base.human = false;
  }
  else if(b.k === 'creep'){
    base.r = b.sg ? 19 : (b.rc ? 14 : 16);
    base.rangedCreep = !!b.rc; base.siege = !!b.sg;
    if(b.sm){ base.summonModel = b.sm; base.summonOf = true; base.r = 13; }
    if(b.su){ base.superCreep = true; base.r += 2; }
  }
  else if(b.k === 'barracks'){
    base.r = 58; base.isStatic = true; base.invuln = !!b.iv; base.lane = b.ln;
  }
  else if(b.k === 'neutral'){
    const key = CAMP_KEYS[b.ct] || 'boars';
    const ct = CAMP_TYPES[key];
    base.r = ct.r; base.emoji = ct.emoji; base.name = ct.name; base.boss = !!ct.boss;
    base.campType = key;
  }
  else if(b.k === 'tower'){ base.r = 38; base.isStatic = true; base.isGuard = !!b.gd; }
  else if(b.k === 'ancient'){ base.r = 56; base.isStatic = true; base.invuln = !!b.iv; }
  return base;
}
function mergeById(arr, list, makeFn, updFn){
  const m = new Map();
  for(const o of arr) m.set(o.id, o);
  const out = [];
  for(const o of list){
    let ex = m.get(o.i);
    if(!ex) ex = makeFn(o);
    updFn(ex, o);
    out.push(ex);
  }
  return out;
}
function applySnapshot(d){
  gameTime = d.gt;
  kills = d.ks;
  const seen = new Set();
  for(const b of d.u){
    seen.add(b.i);
    let u = net.guestUnits.get(b.i);
    if(!u){
      u = makeGuestUnit(b);
      net.guestUnits.set(b.i, u);
      units.push(u);
    }
    u.tx2 = b.x; u.ty2 = b.y; u.tDir = b.d || 0;
    if(Math.abs(b.x - u.x) > 260 || Math.abs(b.y - u.y) > 260){ u.x = b.x; u.y = b.y; }
    u.hp = b.h; u.maxhp = b.m;
    u.atkN = b.an || 0; u.castN = b.cn || 0; if(b.cf) u.castFx = b.cf;
    u.knockN = b.kn || 0; u.charge = b.ch ? { net: true } : null;
    if(u.kind === 'hero'){
      u.level = b.l; u.dead = !!b.dd;
      u.mp = b.mp; u.maxmp = b.mm;
      unpackStatus(u.status, b.st);
      u.kills = b.k2; u.deaths = b.d2; u.assists = b.a2 || 0; u.gold = b.gd2;
      u.lastHits = b.lh || 0; u.denies = b.dn || 0;
      u.aegis = !!b.ag;
      if(!u.isPlayer) u.items = (b.it2 || '').split('').map(e => ({ emoji: e, name: '' })).filter(i => i.emoji.trim());
      if(b.pl === 2 && !u.isPlayer){ u.isPlayer = true; }
    }
    if(u.kind === 'ancient' || u.kind === 'barracks') u.invuln = !!b.iv;
    if(b.bd) u.bdT = gameTime;
  }
  for(const id of [...net.guestUnits.keys()]){
    if(!seen.has(id)) net.guestUnits.delete(id);
  }
  units = units.filter(u => net.guestUnits.has(u.id));
  ancients[0] = units.find(u => u.kind === 'ancient' && u.team === 0) || null;
  ancients[1] = units.find(u => u.kind === 'ancient' && u.team === 1) || null;
  // moj junak (mirror) + puni podaci
  const mine = units.find(u => u.kind === 'hero' && u.isPlayer);
  if(mine) player = mine;
  if(player && d.me){
    const e = d.me;
    player.gold = e.g; player.xp = e.xp; player.skillPoints = e.sp; player.statRanks = e.sr;
    player.str = e.s; player.agi = e.a; player.int = e.n;
    player.hpRegen = e.hr; player.mpRegen = e.mr;
    player.speed = e.spd; player.dmg = e.dm; player.itemBonus.dmg = e.ib;
    player.tpCd = e.tc; player.tpChannel = e.tch; player.deadT = e.dt2;
    player.assists = e.as || 0; player.buybackCd = e.bb || 0; player.aegis = !!e.ag; player.aegisT = e.at || 0;
    player.itemCd = e.ic || {};
    player.itemCharges = e.ich || {};
    player.talents = e.tal || {}; player.cdr = e.cdr || 0;
    e.ab.forEach((a, j) => {
      if(player.abilities[j]){ player.abilities[j].rank = a[0]; player.abilities[j].cd = a[1]; }
    });
    player.items = e.it.map((id, k) => ITEM_BY_ID[id] && ((e.ip || []).includes(k) ? pendingItem(ITEM_BY_ID[id]) : ITEM_BY_ID[id])).filter(Boolean);
  }
  if(player && !net.ringBuilt){ buildPlayerRing(); net.ringBuilt = true; }
  // projektili / zone / rune
  projectiles = mergeById(projectiles, d.p,
    o => ({ id: o.i, kind: 'homing', x: o.x, y: o.y, r: o.r, color: o.cl, emoji: o.e || null,
      shot: o.sh || null, sx: o.sx, sy: o.sy }),
    (p, o) => { p.x = o.x; p.y = o.y; p.tx = o.tx || null; p.ty = o.ty || null; });
  zones = mergeById(zones, d.z,
    o => ({ id: o.i, x: o.x, y: o.y, r: o.r, t: o.t, delay: o.dl, started: !!o.s,
      ticksLeft: 1, interval: 1, color: o.cl, emoji: o.e, team: 0 }),
    (z, o) => { z.t = o.t; z.started = !!o.s; if(o.tk != null) z.ticksLeft = o.tk; });
  if(!d.rn.length) runes = [];
  else if(!runes.length || runes[0].x !== d.rn[0].x || runes[0].y !== d.rn[0].y){
    runes = [{ x: d.rn[0].x, y: d.rn[0].y, def: RUNE_TYPES[d.rn[0].di] || RUNE_TYPES[0], t: 0 }];
  }
  markers = d.mk.map(m => ({ x: m.x, y: m.y, t: m.t, r: m.r, isRing: !!m.ir, color: m.cl }));
  {   // zadrži iste objekte linija (3D cijev munje se gradi samo jednom)
    const old = lines;
    lines = d.ln.map(l => {
      const ex = old.find(o => o.x1 === l.x1 && o.y1 === l.y1 && o.x2 === l.x2 && o.y2 === l.y2 && o.color === l.cl);
      if(ex){ ex.t = l.t; return ex; }
      return { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, t: l.t, life: l.lf, color: l.cl, w: l.w || 4 };
    });
  }
  floats = d.fl.map(f => ({ x: f.x, y: f.y, h: f.hh, txt: f.tx, color: f.cl, size: f.sz, t: f.t }));
  feed = d.fd.map(f => ({ txt: f.tx, color: f.cl, t: f.t }));
  banner = d.bn ? { txt: d.bn.tx, sub: d.bn.sb, t: d.bn.t, dur: d.bn.dr } : null;
  nightForceT = d.nf || 0;
  if(d.gl){ glyph[0].t = d.gl[0] / 10; glyph[0].cd = d.gl[1]; glyph[1].t = d.gl[2] / 10; glyph[1].cd = d.gl[3]; }
  if(d.sh){ if(shrines.length !== d.sh.length) makeShrines(); d.sh.forEach((v, i) => { shrines[i].cd = v[0]; shrines[i].t = v[1]; }); }
  if(d.cu){   // 🫏 isti objekti kurira (3D model se gradi samo jednom)
    if(couriers.length !== d.cu.length) makeCouriers();
    d.cu.forEach((v, i) => { const c = couriers[i]; c.x = v[0]; c.y = v[1]; c.dir = v[2]; c.state = ['home', 'go', 'back'][v[3]] || 'home'; c.carry = v[4]; });
  }
  {   // zadrži iste objekte oka da 3D prikaz ne gradi mrežu iznova svaki snapshot
    const old = wards;
    wards = (d.wd || []).map(w => {
      const ex = old.find(o => o.x === w.x && o.y === w.y && o.team === w.tm);
      if(ex){ ex.t = w.t; ex.r = w.r; return ex; }
      return { x: w.x, y: w.y, r: w.r, t: w.t, team: w.tm };
    });
  }
}

/* gostov "frame" — interpolacija + kamera + vid (bez simulacije!) */
function guestFrame(dt){
  for(const u of units){
    if(u.tx2 == null) continue;
    const k = Math.min(1, dt * 10);
    const dx = u.tx2 - u.x, dy = u.ty2 - u.y;
    if(Math.abs(dx) + Math.abs(dy) > 1){
      u.x += dx * k; u.y += dy * k;
      u.lastMoveT = gameTime;
      if(Math.abs(dx) > 2) u.face = dx < 0 ? -1 : 1;
    }
    let dd = (u.tDir || 0) - (u.dir || 0);
    while(dd > Math.PI) dd -= TAU;
    while(dd < -Math.PI) dd += TAU;
    u.dir = (u.dir || 0) + dd * Math.min(1, dt * 12);
  }
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
  // vid (magla rata za crveni tim — lokalno)
  net.visT -= dt;
  if(net.visT <= 0){ net.visT = 0.25; updateVision(); }
  // dan i noć (samo zastavica za HUD/svjetlo)
  const dayK = 0.5 + 0.5 * Math.cos((gameTime % CFG.dayCycle) / CFG.dayCycle * TAU);
  isNight = dayK < 0.5 || nightForceT > 0;
  // ciljanje: odustani ako moć nije spremna
  if(pendingCast){
    const ab = player && !player.dead ? player.abilities[pendingCast.i] : null;
    if(!ab || ab.rank <= 0) pendingCast = null;
  }
  // zvuk smrti
  if(player){
    if(player.dead && !net.wasDead) sfx('death');
    net.wasDead = player.dead;
  }
}

/* ---------- početak meča ---------- */
function resetMatchState(){
  units = []; projectiles = []; zones = []; particles = []; lines = [];
  floats = []; markers = []; feed = [];
  ancients = [null, null];
  kills = [0, 0];
  camps = []; runes = [];
  runeTimer = CFG.runeEvery; runeSpotI = 0; isNight = false;
  wards = []; nightForceT = 0; superCreeps = [{}, {}]; winnerTeam = null;
  glyph = [{ t: 0, cd: 0 }, { t: 0, cd: 0 }];
  makeShrines(); makeCouriers(); creepTier = 0; bossKills = 0; coinDrops = [];
  pendingCast = null;
  gameTime = 0; waveTimer = CFG.firstWave; waveCount = 0;
  firstBlood = false; gameOver = false; paused = false;
  banner = null;
  remoteHero = null;
  net.guestUnits.clear();
  net.ringBuilt = false;
}
function startMatchHost(hostIdx, guestIdx, botIdcs){
  resetMatchState();
  myTeam = TEAM_BLUE;
  clearScene3D();
  // trees su VEĆ generirane u tryStartMatch (poslane gostu — ista šuma!)
  buildTerrain();
  buildTrees3D();
  buildStatic3D();
  makeWorld();
  makeHero(HEROES[hostIdx], TEAM_BLUE, true, 'mid');
  remoteHero = makeHero(HEROES[guestIdx], TEAM_RED, false, 'mid');
  remoteHero.human = true;
  remoteHero.bot = null;
  makeHero(HEROES[botIdcs[0]], TEAM_BLUE, false, 'top');
  makeHero(HEROES[botIdcs[1]], TEAM_BLUE, false, 'bot');
  makeHero(HEROES[botIdcs[2]], TEAM_RED, false, 'top');
  makeHero(HEROES[botIdcs[3]], TEAM_RED, false, 'bot');
  for(const h of units){
    if(h.kind === 'hero' && h.bot) botSpendPoints(h);
  }
  buildPlayerRing();
  updateVision();
  cam.x = player.x; cam.y = player.y; cam.zoom = 0.9; cam.follow = true;
  running = true;
  document.getElementById('select').classList.add('hidden');
  announce('⚔️ 1 NA 1!', 'Sruši protivnikov prijestol! 👑');
  refreshShop();
  sfx('levelup');
}
function startMatchGuest(d){
  resetMatchState();
  myTeam = TEAM_RED;
  trees = d.trees;          // ista šuma kao kod domaćina!
  clearScene3D();
  buildTerrain();
  buildTrees3D();
  buildStatic3D();
  // jedinice stižu snapshotima
  player = null;
  running = true;
  cam.x = FOUNTAIN[1].x; cam.y = FOUNTAIN[1].y; cam.zoom = 0.9; cam.follow = true;
  document.getElementById('select').classList.add('hidden');
  banner = { txt: '⚔️ 1 NA 1!', sub: 'Sruši plavi prijestol! 👑', t: 0, dur: 3 };
  sfx('levelup');
}
