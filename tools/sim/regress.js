/* =====================================================================
   🧪 DOTA Kids — regresijski test (Node, bez preglednika; ~10 s)
   Greške koje su jednom popravljene ne smiju se vratiti. Igra se učita kao u sim.js (isti stubovi za DOM i 3D),
   pa svaka provjera namjesti malu situaciju i usporedi ishod. Zadnja provjera baci SVAKU moć SVAKOG junaka na
   neprijatelja i pusti igru nekoliko sekundi — iznimka ili NaN u logici bilo koje moći ruši test.

     node tools/sim/regress.js          (pokreće ga i tools/check.sh)
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
// isti kontekst i stubovi kao simulacija (kao tools/sim/econ.js: zaglavlje sim.js do funkcije runGame)
const head = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8').split('function runGame')[0];
const { makeContext, SRC } = new Function('require', '__dirname', 'process', head + '\n;return { makeContext, SRC };')(require, __dirname, { argv: ['node', 'sim.js'] });

function game(){
  const ctx = makeContext();
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'game-bundle.js' });
  return code => vm.runInContext('(function(){' + code + '})()', ctx);
}
/* zajednička priprema: igra s junakom `id`, igrač P i jedan neprijateljski junak E sami na sredini mape */
const SETUP = id => `
  startGame(HEROES.findIndex(h => h.id === '${id}')); gameTime = 100;
  const P = player; P.bot = null;
  const E = units.find(u => u.kind === 'hero' && u.team !== P.team && !u.projSpeed && u.hero.id !== 'jelko') || units.find(u => u.kind === 'hero' && u.team !== P.team);
  E.bot = null;
  units = units.filter(u => u === P || u === E); projectiles = []; zones = [];
  P.x = 3000; P.y = 3000; E.x = 3200; E.y = 3000;
  P.maxhp = P.hp = 1e6; P.maxmp = P.mp = 1e5; E.maxhp = E.hp = 1e6; E.maxmp = E.mp = 1000; E.armor = 0; E.hpRegen = 0; E.evasion = 0;
  const hold = () => { E.status.stun = 5; E.moveTarget = null; E.attackTarget = null; E.atkTimer = 99; };
  const run = (sec, each) => { for(let k = 0; k < sec * 20; k++){ hold(); if(each) each(k); update(0.05); } };
`;
let failed = 0;
function check(name, fn){
  let res, err = null;
  try { res = fn(); } catch(e){ err = e; }
  const ok = !err && res === true;
  if(!ok) failed++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + (err ? err.message : JSON.stringify(res))));
}

check('Protučarolija pod neprijateljskom fontanom ne ruši igru', () => {
  const g = game();
  return g(SETUP('jelko') + `
    P.abilities[1].rank = 4;
    const f = FOUNTAIN[1 - P.team];
    for(let k = 0; k < 200; k++){ P.x = f.x - 100; P.y = f.y + 100; P.moveTarget = null; if(k % 20 === 0){ P.abilities[1].cd = 0; castAbility(P, 1, { x: P.x, y: P.y }); } update(0.05); }
    return P.hp < 1e6 || 'fontana nije gađala';`);
});
check('Tragač: udarac iz sjene (E) nosi bonus štetu', () => {
  const g = game();
  return g(SETUP('tragac') + `
    P.abilities[2].rank = 4; E.x = P.x + 60;
    const hit = () => { const h0 = E.hp; P.attackTarget = E; P.atkTimer = 0; run(1.2, () => { P.attackTarget = E; }); P.attackTarget = null; P.windup = null; return h0 - E.hp; };
    Math.random = () => 0.99;                       // bez kritičnih i pasivnih pogodaka
    P.atkTimer = 0; const plain = hit();
    castAbility(P, 2, { x: P.x, y: P.y }); const shadow = hit();
    return shadow - plain > 100 || { plain, shadow };`);
});
check('Talent štete moći se ne broji dvaput (Nišan R +250)', () => {
  const dmg = tal => game()(SETUP('nisan') + `
    P.abilities[3].rank = 1; E.x = P.x + 600; E.status.trackT = 999;
    ${tal ? "applyTalent(P, { ab: { R: { dmg: 250 } } });" : ''}
    const h0 = E.hp; castAbility(P, 3, { x: E.x, y: E.y }); run(5);
    return h0 - E.hp;`);
  const a = dmg(false), b = dmg(true);
  return (b - a > 150 && b - a < 400) || { base: a, withTalent: b };
});
check('Jači učinak ostaje: runa brzine preživi Iscjeljenje, jaki otrov se ne produžuje slabim', () => {
  const g = game();
  return g(SETUP('zarko') + `
    applyHaste(P, 1.8, 15); applyHaste(P, 1.3, 1);
    if(P.status.hasteF !== 1.8 || P.status.hasteT < 14) return { haste: [P.status.hasteF, P.status.hasteT] };
    applyShield(P, 0.5, 15); applyShield(P, 0.2, 3);
    if(P.status.shieldF !== 0.5) return { shield: P.status.shieldF };
    applySlow(E, 0.12, 10); applySlow(E, 0.5, 1.5);
    if(E.status.slowF !== 0.5 || E.status.slowT > 1.6) return { slow: [E.status.slowF, E.status.slowT] };
    clearStatus(E.status, 'slowT');
    P.x = 800; P.y = 5200;                          // daleko: bez običnih udaraca, samo otrov
    const h0 = E.hp; applyDot(E, 54, 5, P);
    run(20, k => { if(k % 20 === 0) applyDot(E, 12, 2, P); });
    const total = h0 - E.hp;
    return (total > 250 && total < 700) || { dotTotal: total };`);
});
check('Premještanje predmeta u ruksak i natrag ne liječi', () => {
  const g = game();
  return g(SETUP('vitez') + `
    giveItem(P, ITEM_BY_ID.vanguard); recomputeItemStats(P);
    P.hp = 50;
    for(let k = 0; k < 4; k++){ swapItems(P, 0, CFG.inventorySlots); swapItems(P, CFG.inventorySlots, 0); }
    return P.hp <= 50 || { hp: P.hp };`);
});
check('Jedinica pada samo jednom; pobjeda pomagača ide njegovom junaku', () => {
  const g = game();
  return g(SETUP('majmun') + `
    const d0 = E.deaths, k0 = kills[P.team];
    kill(E, P); kill(E, P);
    if(E.deaths - d0 !== 1 || kills[P.team] - k0 !== 1) return { deaths: E.deaths - d0, kills: kills[P.team] - k0 };
    const cr = makeUnit({ kind: 'creep', team: E.team, x: 3100, y: 3100, hp: 10, maxhp: 10, dmg: 1, r: 14, goldValue: 26, xpValue: 10 });
    const pet = makeUnit({ kind: 'creep', team: P.team, x: 3100, y: 3080, hp: 100, maxhp: 100, dmg: 50, r: 14 }); pet.summonOf = P;
    const g0 = P.gold, lh0 = P.lastHits;
    kill(cr, pet);
    return (P.gold - g0 === 26 && P.lastHits - lh0 === 1) || { gold: P.gold - g0, lastHits: P.lastHits - lh0 };`);
});
check('Gost: nišanjenje teleporta, čarolije i predmeta ne nestaje nakon jedne sličice', () => {
  const g = game();
  return g(SETUP('zeka') + `
    net.mode = 'guest';
    const out = [];
    for(const pc of [{ tp: true, i: -1 }, { sum: 0, i: -1 }]){ pendingCast = pc; guestFrame(0.05); out.push(pendingCast === pc); }
    net.mode = 'local'; pendingCast = null;
    return out.every(Boolean) || out;`);
});
check('Hlađenja teku i dok junak čeka oživljavanje', () => {
  const g = game();
  return g(SETUP('zarko') + `
    P.abilities[3].rank = 1; P.abilities[3].cd = 100; P.sumCd[0] = 60; P.tpCd = 40;
    P.maxhp = P.hp = 100; applyDamage(P, 99999, E);
    if(!P.dead) return 'junak nije pao';
    for(let k = 0; k < 100; k++) update(0.05);       // 5 s
    const r = [P.abilities[3].cd, P.sumCd[0], P.tpCd].map(v => +v.toFixed(1));
    return (Math.abs(r[0] - 95) < 0.3 && Math.abs(r[1] - 55) < 0.3 && Math.abs(r[2] - 35) < 0.3) || r;`);
});
check('Imun na čarolije: jezik ga ne privuče, zamjena mjesta ga ne dira (a bez imunosti rade)', () => {
  const tongue = immune => game()(SETUP('skokica') + `
    P.abilities[0].rank = 4; E.x = P.x + 300;
    ${immune ? 'E.status.immuneT = 9;' : ''}
    castAbility(P, 0, { x: E.x, y: E.y });
    for(let k = 0; k < 30; k++){ E.moveTarget = null; E.attackTarget = null; E.atkTimer = 99; update(0.05); }
    return Math.round(dist(P, E));`);
  const swap = immune => game()(SETUP('gavran') + `
    P.abilities[1].rank = 4; E.x = P.x + 300; E.status.trackT = 99; updateVision();
    ${immune ? 'E.status.immuneT = 9;' : ''}
    const x0 = P.x; castAbility(P, 1, { x: E.x, y: E.y });
    return Math.round(P.x - x0);`);
  const r = { tongueImmune: tongue(true), tongueNormal: tongue(false), swapImmune: swap(true), swapNormal: swap(false) };
  return (r.tongueImmune > 250 && r.tongueNormal < 150 && r.swapImmune === 0 && r.swapNormal === 300) || r;
});
check('Gost: učinci na traci, oklop i brojevi štete ne ovise o postavkama domaćina', () => {
  const host = JSON.parse(game()(SETUP('zarko') + `
    net.mode = 'host'; remoteHero = E; E.human = true; SETTINGS.dmgNums = false;
    floats = []; applyDamage(E, 50, P); applyDamage(P, 40, E);
    E.armorBuffT = 4; E.armorBuff = 12; E.weakT = 3; E.gwT = 2; E.corruptT = 5; E.corruptA = 6; E.lsBoostT = 7; E.runeRegenT = 8;
    E.barrierT = 2.5; E.barrierHp = 80; applyDmgMul(E, 1.4, 6);
    const out = JSON.stringify({ snap: buildSnapshot(), arm: unitArmor(E), hostSees: floats.filter(f => f.dn === 1 && SETTINGS.dmgNums).length });
    net.mode = 'local'; return out;`));
  const r = game()(`
    startGame(0); net.mode = 'guest'; units = [];
    applySnapshot(${JSON.stringify(host.snap)});
    const icons = buffList(player).map(b => b.e), need = ['🛡️', '🦇', '✨', '🐌', '🔥', '🌘', '🫧', '⚔️'];
    const out = { miss: need.filter(e => !icons.includes(e)), nums: floats.filter(f => f.dn === 1 && f.who.includes(player.id)).length,
      arm: +unitArmor(player).toFixed(1), mul: player.status.dmgMulF, barrier: player.barrierT };
    net.mode = 'local'; return out;`);
  return (r.miss.length === 0 && r.nums >= 1 && host.hostSees === 0 && Math.abs(r.arm - host.arm) < 0.11 && r.mul === 1.4 && r.barrier === 2.5) || { guest: r, hostArmor: host.arm, hostSees: host.hostSees };
});
check('Glif botova: bazu štiti i kad je ruše samo vojnici, kulu tek pred sam pad', () => {
  const g = game();
  return g(`
    startGame(0); gameTime = 100;
    const T = units.find(u => u.kind === 'tower' && u.team === 1 && !u.invuln), B = units.find(u => u.kind === 'barracks' && u.team === 1);
    const cr = makeUnit({ kind: 'creep', team: 0, x: T.x - 60, y: T.y + 60, hp: 1e5, maxhp: 1e5, dmg: 1, r: 14 });
    const step = (S, f) => { glyph[1].t = 0; glyph[1].cd = 0; glyphAiT[1] = 0; units.forEach(u => { if(isStructure(u)) u.lastDmgT = u.lastHitT = -99; });
      const iv = S.invuln; S.invuln = false; S.hp = S.maxhp * f; S.lastDmgT = gameTime;
      update(0.05); const used = glyph[1].t > 0; S.hp = S.maxhp; S.invuln = iv; return used; };
    const r = { tower30: step(T, 0.3), tower10: step(T, 0.1), barracks30: step(B, 0.3) };
    return (!r.tower30 && r.tower10 && r.barracks30) || r;`);
});
check('Svaki predmet: recept, opis, kupnja za točnu cijenu, aktivno radi bez iznimke', () => {
  const g = game();
  return g(SETUP('vitez') + `
    const bad = [];
    const SPECIAL = ['crit', 'bash', 'cleave', 'creepDmg', 'hunt', 'corrupt', 'block', 'trueStrike', 'proc', 'aura', 'burn', 'wand', 'chain', 'cold', 'mburn', 'range', 'tpFast', 'ultCd'];
    const base = () => { P.items = []; P.backpack = []; P.itemCharges = {}; P.itemCd = {}; P.neutral = null; recomputeItemStats(P); P.dead = false; P.status.stun = 0; P.status.silenceT = 0;
      P.maxhp = P.hp = 1e6; P.maxmp = P.mp = 1e5; P.gold = 99999; };
    for(const it of ITEMS){
      if(!it.name || !it.emoji || !it.lore) bad.push(it.id + ': nema imena, sličice ili priče');
      if(SPECIAL.some(k => it[k]) && !it.pas) bad.push(it.id + ': poseban učinak bez opisa (pas)');
      if(it.active && !it.act) bad.push(it.id + ': aktivno bez opisa (act)');
      for(const k in it.stats || {}) if(!STAT_LABEL[k]) bad.push(it.id + ': nepoznata statistika ' + k);
      for(const c of it.components || []) if(!ITEM_BY_ID[c]) bad.push(it.id + ': nepoznat dio ' + c);
      if(it.components && it.components.includes(it.id)) bad.push(it.id + ': sam sebi dio');
      if(!it.instant && !it.noShop && itemFullCost(it) <= 0) bad.push(it.id + ': cijena 0');
      base(); P.x = FOUNTAIN[P.team].x; P.y = FOUNTAIN[P.team].y;
      if(!it.noShop && !it.instant){   // kupnja odjednom: dijelovi + recept
        const cost = Math.ceil(planPurchase(P, it).cost), g0 = P.gold;
        tryBuy(P, it);
        if(!P.items.some(x => x.id === it.id)) bad.push(it.id + ': kupnja ga nije stavila u torbu');
        else if(Math.abs((g0 - P.gold) - cost) > 1) bad.push(it.id + ': naplaćeno ' + (g0 - P.gold) + ' umjesto ' + cost);
        if(P.items.length !== 1) bad.push(it.id + ': nakon kupnje u torbi ' + P.items.map(x => x.id).join('+'));
      } else if(!it.instant){ giveItem(P, it); recomputeItemStats(P); }
      if(it.active){
        P.x = 3000; P.y = 3000; E.x = 3150; E.y = 3000; P.hp = P.maxhp * 0.5; P.mp = P.maxmp;
        for(const aim of [{ x: E.x, y: E.y }, { x: P.x, y: P.y }]){
          const i = P.items.findIndex(x => x.id === it.id);
          if(i < 0) break;
          P.itemCd = {};
          try { useItem(P, i, aim); run(1.5); } catch(e){ bad.push(it.id + ': aktivno baca iznimku — ' + e.message); }
        }
      }
      try { run(0.5); } catch(e){ bad.push(it.id + ': ' + e.message); }
      if(![P, E].every(u => isFinite(u.x) && isFinite(u.y) && isFinite(u.hp) && isFinite(u.mp) && isFinite(u.dmg) && isFinite(u.speed))) bad.push(it.id + ': NaN');
    }
    const ids = ITEMS.map(i => i.id), em = ITEMS.concat(NEUTRAL_ITEMS).map(i => i.emoji);
    for(const x of new Set(ids)) if(ids.filter(y => y === x).length > 1) bad.push('dvaput isti id ' + x);
    for(const x of new Set(em)) if(em.filter(y => y === x).length > 1) bad.push('dvaput ista sličica ' + x + ' (' + ITEMS.concat(NEUTRAL_ITEMS).filter(i => i.emoji === x).map(i => i.id).join(', ') + ')');
    for(const b of [BUILD_TANK, BUILD_MELEE, BUILD_RANGED, BUILD_MAGE, BUILD_SUPPORT, ...Object.values(HERO_BUILDS), ...[...BUILD_ALTS.values()].flat(), ...Object.values(LATE_ALTS), START_ITEMS, START_JUNGLE])
      for(const id of b) if(!ITEM_BY_ID[id]) bad.push('vodič spominje nepostojeći predmet ' + id);
    return bad.length === 0 || bad;`);
});
check('Novi predmeti rade kako piše (domet, ulti, žaba, medalja, zrcalo, veo, štit; jači učinak pobjeđuje)', () => {
  const g = game();
  return g(SETUP('zarko') + `
    const out = {};
    const give = (u, ...ids) => { u.items = ids.map(id => ITEM_BY_ID[id]); u.itemCd = {}; recomputeItemStats(u); };
    const use = (u, id, aim) => { u.itemCd = {}; u.mp = u.maxmp; return useItem(u, u.items.findIndex(x => x.id === id), aim); };
    // 🐉 domet samo junacima koji gađaju izdaleka (Žarko gađa, E udara izbliza)
    give(P); give(E); run(0.2); const r0 = P.atkRange, m0 = E.atkRange;
    give(P, 'lance'); give(E, 'lance'); run(0.2); out.lance = [P.atkRange - r0, E.atkRange - m0];
    // 🧙 ulti se puni 30% brže
    P.abilities[3].rank = 1; give(P); P.abilities[3].cd = 0; castAbility(P, 3, { x: E.x, y: E.y }); const cd0 = P.abilities[3].cd;
    give(P, 'scepter'); P.abilities[3].cd = 0; castAbility(P, 3, { x: E.x, y: E.y }); out.ultCd = +(P.abilities[3].cd / cd0).toFixed(2);
    run(4); projectiles = []; zones = [];
    // 🚀 brži teleport, jači učinak pobjeđuje bez obzira na redoslijed u torbi
    give(P, 'travel'); out.tpFast = P.ifx.tpFast;
    give(P, 'deso', 'blight'); const c1 = P.ifx.corrupt.a; give(P, 'blight', 'deso'); out.corrupt = [c1, P.ifx.corrupt.a];
    give(P, 'skadi', 'venom'); const f1 = P.ifx.cold.f; give(P, 'venom', 'skadi'); out.cold = [f1, P.ifx.cold.f];
    give(P, 'mkb', 'javelin'); const p1 = P.ifx.proc.dmg; give(P, 'javelin', 'mkb'); out.proc = [p1, P.ifx.proc.dmg];
    // 🐸 žaba: ne udara, ne baca moći, upola sporija
    clearStatus(E.status, 'slowT'); E.status.silenceT = 0; E.status.disarmT = 0;
    give(P, 'hex'); use(P, 'hex', { x: E.x, y: E.y }); out.hex = [E.status.silenceT > 2, E.status.disarmT > 2, E.status.slowF];
    // 🏵️ medalja: neprijatelju −6 oklopa
    E.corruptT = 0; const a0 = unitArmor(E); give(P, 'medallion'); use(P, 'medallion', { x: E.x, y: E.y }); out.medal = +(unitArmor(E) - a0).toFixed(1);
    // 🕸️ veo: +18% primljene štete
    clearStatus(E.status, 'curseT'); give(P, 'veil'); use(P, 'veil', { x: E.x, y: E.y }); out.veil = [E.status.curseT > 7, E.status.curseF];
    // 🏰 štit tvrđave: +8 oklopa i štit 200
    P.armorBuffT = 0; P.barrierHp = 0; give(P, 'crimson'); const pa = unitArmor(P); use(P, 'crimson'); out.crimson = [+(unitArmor(P) - pa).toFixed(1), P.barrierHp];
    // 🌸 zrcalo: čarolija se vrati onome tko ju je bacio
    give(P, 'lotus'); use(P, 'lotus', { x: P.x, y: P.y }); P.barrierHp = 0; P.barrierT = 0;
    const hp0 = P.hp, eh0 = E.hp; applyDamage(P, 300, E, true); out.lotus = [hp0 - P.hp, eh0 - E.hp > 100];
    const ok = out.lance[0] === 110 && out.lance[1] === 0 && out.ultCd === 0.7 && out.tpFast === true && out.corrupt.join() === '6,6' && out.cold.join() === '0.35,0.35' &&
      out.proc.join() === '70,70' && out.hex[0] && out.hex[1] && out.hex[2] === 0.5 && out.medal === -6 && out.veil[0] && out.veil[1] === 0.18 &&
      out.crimson[0] === 8 && out.crimson[1] === 200 && out.lotus[0] === 0 && out.lotus[1];
    return ok || out;`);
});
check('Svaka moć svakog junaka: bez iznimke i bez NaN', () => {
  const g = game();
  const n = g('return HEROES.length;');
  const bad = [];
  for(let i = 0; i < n; i++){
    const r = g(`
      startGame(${i}); gameTime = 100;
      const P = player; P.bot = null;
      while(P.level < 25) levelUp(P);
      for(let j = 0; j < P.abilities.length; j++){ let q = 0; while(P.skillPoints > 0 && canLearn(P, j) && q++ < 9) learnAbility(P, j); }
      for(const lvl of TALENT_LVLS) chooseTalent(P, lvl, lvl % 20 ? 'a' : 'b');
      const foes = units.filter(u => u.kind === 'hero' && u.team !== P.team), mate = units.find(u => u.kind === 'hero' && u.team === P.team && u !== P);
      const place = () => { P.x = 3000; P.y = 3000; P.dead = false; P.hp = P.maxhp; P.mp = P.maxmp = 1e5; P.status.stun = 0; P.status.silenceT = 0;
        foes.forEach((e, k) => { e.x = 3180 + k * 45; e.y = 2950 - k * 30; e.dead = false; e.hp = e.maxhp; });
        if(mate){ mate.x = 2920; mate.y = 3060; mate.hp = mate.maxhp * 0.5; } };
      for(let j = 0; j < P.abilities.length; j++) for(const self of [false, true]){
        place(); P.abilities[j].cd = 0;
        castAbility(P, j, self ? { x: P.x, y: P.y } : { x: foes[0].x, y: foes[0].y });
        for(let k = 0; k < 70; k++) update(0.05);
      }
      for(let s = 0; s < 2; s++){ place(); P.sumCd[s] = 0; castSummoner(P, s, { x: foes[0].x, y: foes[0].y }); for(let k = 0; k < 20; k++) update(0.05); }
      const nan = units.filter(u => !isFinite(u.x) || !isFinite(u.y) || !isFinite(u.hp) || !isFinite(u.mp || 0)).length;
      return nan ? P.hero.id + ': NaN u ' + nan + ' jedinica' : null;`);
    if(r) bad.push(r);
  }
  return bad.length === 0 || bad;
});

if(failed){ console.error('✗ regresijski test: ' + failed + ' provjera nije prošlo'); process.exit(1); }
console.log('✓ regresijski test prošao');
