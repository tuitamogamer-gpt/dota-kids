'use strict';
/* ============================================================
   DOTA Kids 3D — podaci (DotA All-Stars mehanike)
   - 10 junaka; moći imaju RANGOVE (Q/W/E i ulti po 3).
   - Ciljanje: target:'point' otvara prikaz dometa (castRange,
     aoe = krug područja, line = putanja); selfAoe = krug oko
     junaka koji se vidi kad lebdiš nad moći.
   - tip(rk) = kratki opis brojeva za tooltip.
   - Atributi: str/agi/int + rast po levelu; primary daje štetu.
   ============================================================ */

const MAP_S = 1.45;                        // mjerilo mape (1 = stara mapa 3000×3000)
const WORLD = Math.round(3000 * MAP_S);
const TEAM_BLUE = 0, TEAM_RED = 1, TEAM_NEUTRAL = 2;
const TEAM_COLOR = ['#3b82f6', '#ef4444', '#f59e0b'];
const TEAM_LIGHT = ['#93c5fd', '#fca5a5', '#fcd34d'];
const TEAM_DARK  = ['#1e3a8a', '#7f1d1d', '#92400e'];
const TEAM_NAME  = ['Plavi', 'Crveni', 'Neutralni'];

const CFG = {
  waveEvery: 28,
  firstWave: 10,
  meleePerWave: 3,
  rangedPerWave: 1,
  siegeEveryNthWave: 3,
  creepXp: 46,
  xpRadius: 720,
  heroKillGold: 200,
  heroKillGoldPerLvl: 12,
  heroKillXp: 150,
  assistRange: 1000,        // 🤝 suigrači u ovom krugu oko ubijenog junaka dobivaju asistenciju
  assistGold: 50,
  towerGoldTeam: 120,
  towerXp: 90,
  passiveGold: 0.9,
  startGold: 650,
  respawnBase: 4,
  respawnPerLvl: 1.3,
  fountainRadius: 330,
  fountainHeal: 0.07,
  maxLevel: 25,
  ultLevels: [6, 12, 18],
  statMaxRanks: 10,
  statPerPoint: 2,
  inventorySlots: 6,
  campRespawn: 60,
  bossRespawn: 180,
  runeEvery: 120,
  dayCycle: 240,
  uphillMissChance: 0.25,
  barracksHp: 2000,
  towerHp: 2400,
  ancientHp: 5000,
  heroVsStructure: 0.6,     // junaci udaraju građevine slabije (utvrđeni oklop kao u Allstarsu)
  siegeVsStructure: 1.25,   // opsadni vojnici jače
  towerArmor: 8,            // 🛡️ oklop građevina (smanjuje štetu udaraca; Oštrica pustoši ga skida)
  barracksArmor: 6,
  barracksGoldTeam: 150,
  superCreepHp: 1.6,        // vojnici postaju "super" kad padne vojarna
  superCreepDmg: 1.4,
  buybackBase: 100,         // otkup (buyback): cijena = base + level * perLvl
  buybackPerLvl: 20,
  buybackCd: 180,
  aegisDuration: 300,       // Zmajev štit (Aegis) traje 5 min
  glyphCd: 300,             // Glif utvrde (F): sve građevine tima neranjive 5 s
  glyphDur: 5,
  denyHp: 0.5,              // vlastiti vojnik ispod 50% života može se uskratiti (deny)
  denyTowerHp: 0.1,         // vlastita kula ispod 10%
  backdoorR: 900,           // zaštita od "backdoora": bez neprijateljskih vojnika u blizini
  backdoorMul: 0.5,         //   građevina prima pola štete
  backdoorRegen: 15,        //   i obnavlja 15 života/s
  shutdownGold: 60,         // prekid niza ubojstava: +60 zlata po ubojstvu u nizu (od 3.)
  neutralDrop: 0.12,        // 🌰 šansa da čudovište iz džungle ispusti neutralni predmet
  neutralT2: 600,           //   od 10. minute bolji predmeti (razina 2)
  neutralT3: 1200,          //   od 20. minute najbolji (razina 3)
  neutralMax: 3,            //   najviše 3 po razini za svaki tim
  bountyEvery: 180,         // 💰 rune zlata u džungli svake 3 min
  wisdomEvery: 420,         // 📘 rune mudrosti svakih 7 min
  courierSpeed: 520,        // 🫏 kurir leti brže od junaka
  courierBaseR: 900,        // kupljeno dalje od ovoga od fontane čeka kurira
  creepScaleEvery: 450,     // vojnici jačaju svakih 7.5 min (kao u DotA)
  creepScalePct: 0.12,
  shrineCd: 240,            // svetište: liječi 5 s, puni se 4 min
  shrineDur: 5,
  shrineR: 320,
  // DotA aggro pravila (creep aggro)
  creepAggroRange: 500,     // napad na heroja povlači creepove u ovom radijusu
  creepAggroChase: 2.3,     // koliko dugo ganjaju
  creepAggroCd: 3,          // pa se smire
};

function xpNeed(level){ return 55 + level * 60; }

/* ---------------- JUNACI ---------------- */

const HEROES = [
  {
    id:'vitez', name:'Lavko', emoji:'🦁',
    role:'🛡️ Vitez — hrabri tenk',
    hp:680, mp:240, dmg:60,
    attrs:{ str:25, agi:16, int:13, strG:5.6, agiG:2.2, intG:2.0, primary:'str' },
    range:78, speed:168, atkCd:1.1, projSpeed:0,
    passive:{ name:'Lavlja koža', emoji:'🦺', color:'#fde047', pid:'koza',
      desc:'PASIVNO: tvrda lavlja koža trajno smanjuje SVU primljenu štetu',
      tip:rk => '🛡️ primaš ' + Math.round((0.03 + 0.03*rk) * 100) + '% manje štete' },
    abilities:[
      { key:'Q', name:'Vrtlog', emoji:'🌪️', cd:7, mana:40, color:'#fbbf24',
        desc:'Zavrti mač i udari sve oko sebe',
        selfAoe:175,
        tip:rk => '⚔️ ' + (60 + 45*rk) + ' štete svima oko tebe',
        bot:{type:'aoe-self', range:175},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 175, 60 + 45*rk, {color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 16, 220, 5);
          return true;
        }},
      { key:'W', name:'Bojni poklič', emoji:'📯', cd:16, mana:60, color:'#f59e0b',
        desc:'Rikni da ohrabriš tim — ti i prijatelji oko tebe udarate jače i brže trčite',
        selfAoe:500,
        tip:rk => '⚔️ +' + (15 + 7*rk) + '% štete i 🏃 +10% brzine timu u krugu 500 na 6 s',
        bot:{type:'haste', range:500},
        cast(u, aim, rk){
          for(const e of units){
            if(e.kind !== 'hero' || e.team !== u.team || e.dead || dist(u, e) > 500) continue;
            const cur = e.status.dmgMulT > 0 ? e.status.dmgMulF : 1;
            e.status.dmgMulF = Math.max(cur, 1.15 + 0.07*rk); e.status.dmgMulT = Math.max(e.status.dmgMulT, 6);
            applyHaste(e, 1.1, 6);
            addFloat(e.x, e.y - 20, '📯', '#fde68a', 18);
          }
          ring(u.x, u.y, 500, '#f59e0b');
          burst(u.x, u.y, '#fde68a', 20, 240, 6);
          return true;
        }},
      { key:'E', name:'Junački skok', emoji:'💥', cd:15, mana:70, color:'#f97316',
        desc:'Skoči na mjesto, udari i omami neprijatelje',
        target:'point', castRange:360, aoe:160,
        tip:rk => '⚔️ ' + (60 + 35*rk) + ' štete + omama ' + (0.7 + 0.1*rk).toFixed(1) + ' s',
        bot:{type:'gap', range:360},
        cast(u, aim, rk){
          leapTo(u, aim, 360);
          damageCircle(u, u.x, u.y, 160, 60 + 35*rk, {stun:0.7 + 0.1*rk, color:'#f97316'});
          burst(u.x, u.y, '#f97316', 22, 260, 6);
          return true;
        }},
      { key:'R', name:'Kraljev urlik', emoji:'🦁', cd:70, mana:120, ult:true, color:'#fde047',
        desc:'ULTI: Moćan urlik — velika šteta i omama oko tebe, a ti dobivaš štit',
        selfAoe:320,
        tip:rk => '⚔️ ' + (150 + 100*rk) + ' štete + omama ' + (1.2 + 0.3*rk).toFixed(1) + ' s + štit',
        bot:{type:'ult-aoe', range:300},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 320, 150 + 100*rk, {stun:1.2 + 0.3*rk, color:'#fde047'});
          applyShield(u, 0.5, 4);
          burst(u.x, u.y, '#fde047', 40, 340, 8);
          burst(u.x, u.y, '#f97316', 24, 260, 6);
          return true;
        }},
    ],
  },
  {
    id:'zarko', name:'Žarko', emoji:'🐉',
    role:'🔥 Vatreni zmaj — čarobnjak',
    hp:530, mp:300, dmg:52,
    attrs:{ str:18, agi:16, int:24, strG:3.6, agiG:2.4, intG:5.4, primary:'int' },
    range:330, speed:165, atkCd:1.15, projSpeed:600, shot:'fire',
    passive:{ name:'Vatrena krv', emoji:'🔥', color:'#fb923c', pid:'zar',
      desc:'PASIVNO: napadi pale neprijatelje — gore još 2 sekunde',
      tip:rk => '🔥 +' + (6 + 6*rk) + ' štete/s gorenja 2 s nakon napada' },
    abilities:[
      { key:'Q', name:'Vatrena kugla', emoji:'🔥', cd:6, mana:45, color:'#fb923c',
        desc:'Ispali vatrenu kuglu prema cilju',
        target:'point', castRange:760, line:true,
        tip:rk => '⚔️ ' + (70 + 45*rk) + ' štete prvom pogođenom',
        bot:{type:'shot', range:680},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:560, r:24, range:760,
            dmg:70 + 45*rk, color:'#fb923c', emoji:'🔥'});
        }},
      { key:'W', name:'Plameni krug', emoji:'💍', cd:10, mana:55, color:'#f97316',
        desc:'Plamen oprži sve oko tebe i malo ih uspori',
        selfAoe:215,
        tip:rk => '⚔️ ' + (45 + 32*rk) + ' štete oko tebe + usporenje',
        bot:{type:'aoe-self', range:215},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 215, 45 + 32*rk,
            {slow:{f:0.25, t:1.5}, color:'#f97316'});
          burst(u.x, u.y, '#fb923c', 20, 240, 6);
          return true;
        }},
      { key:'E', name:'Meteor', emoji:'☄️', cd:20, mana:100, color:'#f97316',
        desc:'Pozovi meteor — velika šteta i kratka omama',
        target:'point', castRange:620, aoe:185,
        tip:rk => '⚔️ ' + (130 + 70*rk) + ' štete + omama 0.5 s',
        bot:{type:'zone', range:560},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:185, delay:0.9, ticks:1, interval:0.5,
            dmg:130 + 70*rk, stun:0.5, castRange:620,
            color:'#f97316', emoji:'☄️'});
        }},
      { key:'R', name:'Zmajev dah', emoji:'🐲', cd:70, mana:130, ult:true, color:'#ef4444',
        desc:'ULTI: Ogromna vatrena lopta koja probija sve na svom putu',
        target:'point', castRange:950, line:true,
        tip:rk => '⚔️ ' + (170 + 90*rk) + ' štete SVIMA na putu + usporenje',
        bot:{type:'shot', range:820},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:620, r:56, range:950,
            dmg:170 + 90*rk, pierce:true, slow:{f:0.3, t:2},
            color:'#ef4444', emoji:'🔥'});
        }},
    ],
  },
  {
    id:'ledena', name:'Ledena', emoji:'🐧',
    role:'❄️ Snježna čarobnica',
    hp:530, mp:310, dmg:50,
    attrs:{ str:18, agi:16, int:24, strG:3.6, agiG:2.4, intG:5.2, primary:'int' },
    range:330, speed:165, atkCd:1.15, projSpeed:600, shot:'ice',
    passive:{ name:'Ledeni dodir', emoji:'❄️', color:'#7dd3fc', pid:'dodir',
      desc:'PASIVNO: svaki tvoj napad usporava neprijatelja',
      tip:rk => '❄️ napadi usporavaju ' + Math.round((0.1 + 0.05*rk) * 100) + '% na 1.5 s' },
    abilities:[
      { key:'Q', name:'Ledena strijela', emoji:'🧊', cd:6, mana:40, color:'#38bdf8',
        desc:'Ledena strijela ranjava i jako usporava',
        target:'point', castRange:740, line:true,
        tip:rk => '⚔️ ' + (58 + 40*rk) + ' štete + usporenje ' + Math.round((0.3 + 0.05*rk) * 100) + '%',
        bot:{type:'shot', range:660},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:520, r:22, range:740,
            dmg:58 + 40*rk, slow:{f:0.3 + 0.05*rk, t:2.5},
            color:'#38bdf8', emoji:'🧊'});
        }},
      { key:'W', name:'Trbušno klizanje', emoji:'🛷', cd:11, mana:50, color:'#7dd3fc',
        desc:'Klizni na trbuhu po ledu — oštetiš i usporiš sve preko kojih prijeđeš',
        target:'point', castRange:480, line:true,
        tip:rk => '⚔️ ' + (40 + 30*rk) + ' štete + 🐌 usporenje 40% 2 s svima na putu',
        bot:{type:'gap', range:450},
        cast(u, aim, rk){
          const fx = u.x, fy = u.y;
          leapTo(u, aim, 480);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distToSeg(e.x, e.y, fx, fy, u.x, u.y) > 70 + e.r) continue;
            applyDamage(e, 40 + 30*rk, u); applySlow(e, 0.4, 2);
          }
          addLine(fx, fy, u.x, u.y, '#bae6fd', 10, 0.5);
          burst(u.x, u.y, '#e0f2fe', 14, 180, 5);
          return true;
        }},
      { key:'E', name:'Snježna oluja', emoji:'🌨️', cd:20, mana:100, color:'#7dd3fc',
        desc:'Mećava na mjestu — pada 4 puta i usporava',
        target:'point', castRange:600, aoe:205,
        tip:rk => '⚔️ 4 × ' + (28 + 20*rk) + ' štete + usporenje',
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:205, delay:0.5, ticks:4, interval:0.8,
            dmg:28 + 20*rk, slow:{f:0.4, t:1}, castRange:600,
            color:'#7dd3fc', emoji:'❄️'});
        }},
      { key:'R', name:'Ledeno doba', emoji:'🥶', cd:75, mana:140, ult:true, color:'#bae6fd',
        desc:'ULTI: Zamrzni veliko područje — neprijatelji su omamljeni',
        target:'point', castRange:600, aoe:300,
        tip:rk => '⚔️ ' + (140 + 80*rk) + ' štete + omama ' + (1.4 + 0.3*rk).toFixed(1) + ' s',
        bot:{type:'zone', range:560},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:300, delay:0.7, ticks:1, interval:0.5,
            dmg:140 + 80*rk, stun:1.4 + 0.3*rk, castRange:600,
            color:'#bae6fd', emoji:'🥶'});
        }},
    ],
  },
  {
    id:'strijela', name:'Strijela', emoji:'🦊',
    role:'🏹 Lukava lisica — strijelac',
    hp:550, mp:250, dmg:58,
    attrs:{ str:18, agi:24, int:15, strG:3.4, agiG:6.0, intG:2.2, primary:'agi' },
    range:360, speed:170, atkCd:1.0, projSpeed:680, shot:'arrow',
    passive:{ name:'Oštro oko', emoji:'👁️', color:'#fb923c', pid:'oko',
      desc:'PASIVNO: šansa za KRITIČNI pogodak',
      tip:rk => '💥 15% šanse za ×' + (1.25 + 0.25*rk).toFixed(2) + ' štete' },
    abilities:[
      { key:'Q', name:'Probojna strijela', emoji:'🎯', cd:7, mana:40, color:'#fbbf24',
        desc:'Strijela koja probija sve na svom putu',
        target:'point', castRange:860, line:true,
        tip:rk => '⚔️ ' + (62 + 42*rk) + ' štete SVIMA na putu',
        bot:{type:'shot', range:760},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:680, r:18, range:860,
            dmg:62 + 42*rk, pierce:true, color:'#fbbf24', emoji:'🎯'});
        }},
      { key:'W', name:'Lovačka mreža', emoji:'🕸️', cd:12, mana:55, color:'#a3e635',
        desc:'Baci mrežu — prvi neprijatelj kojeg pogodi ostane zarobljen na mjestu',
        target:'point', castRange:700, line:true,
        tip:rk => '⚔️ ' + (40 + 30*rk) + ' štete + 🕸️ ne može se micati ' + (1.2 + 0.3*rk).toFixed(1) + ' s',
        bot:{type:'shot', range:650},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:900, r:26, range:700, dmg:40 + 30*rk, color:'#a3e635', emoji:'🕸️',
            onHit:e => { applyRoot(e, 1.2 + 0.3*rk); addFloat(e.x, e.y, '🕸️ Uhvaćen!', '#d9f99d', 15); }});
        }},
      { key:'E', name:'Kiša strijela', emoji:'🌧️', cd:18, mana:90, color:'#f59e0b',
        desc:'Strijele padaju 3 puta na odabrano mjesto',
        target:'point', castRange:600, aoe:200,
        tip:rk => '⚔️ 3 × ' + (40 + 25*rk) + ' štete',
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:200, delay:0.6, ticks:3, interval:0.6,
            dmg:40 + 25*rk, castRange:600,
            color:'#f59e0b', emoji:'🏹'});
        }},
      { key:'R', name:'Sokolovo oko', emoji:'🌠', cd:65, mana:110, ult:true, color:'#fde047',
        desc:'ULTI: Čarobna strijela sama pronađe najslabijeg neprijateljskog junaka!',
        tip:rk => '⚔️ ' + (180 + 120*rk) + ' štete najslabijem junaku (ne može promašiti)',
        bot:{type:'snipe', range:2000},
        cast(u, aim, rk){
          const t = weakestEnemyHero(u, 2200);
          if(!t) return false;
          spawnHoming(u, t, {speed:950, dmg:180 + 120*rk, r:12,
            color:'#fde047', emoji:'🌠',
            onHit(e){ burst(e.x, e.y, '#fde047', 26, 300, 7); }});
          return true;
        }},
    ],
  },
  {
    id:'listko', name:'Listko', emoji:'🐢',
    role:'🌿 Šumski iscjelitelj',
    hp:600, mp:300, dmg:52,
    attrs:{ str:23, agi:14, int:20, strG:4.8, agiG:2.0, intG:3.4, primary:'str' },
    range:300, speed:163, atkCd:1.15, projSpeed:560, shot:'leaf',
    passive:{ name:'Korijeni', emoji:'🌱', color:'#4ade80', pid:'korijen',
      desc:'PASIVNO: kad stojiš na mjestu, puštaš korijenje i brzo se liječiš',
      tip:rk => '💚 +' + (3 + 2*rk) + ' života/s i 💧 +' + (1 + rk) + ' mane/s kad stojiš' },
    abilities:[
      { key:'Q', name:'Trnova kugla', emoji:'🌰', cd:6, mana:40, color:'#84cc16',
        desc:'Baci bodljikavu kuglu koja usporava',
        target:'point', castRange:720, line:true,
        tip:rk => '⚔️ ' + (60 + 40*rk) + ' štete + usporenje 25%',
        bot:{type:'shot', range:640},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:540, r:22, range:720,
            dmg:60 + 40*rk, slow:{f:0.25, t:1.5},
            color:'#84cc16', emoji:'🌰'});
        }},
      { key:'W', name:'Iscjeljenje', emoji:'💚', cd:11, mana:65, color:'#4ade80',
        desc:'Izliječi sebe i prijatelje oko sebe',
        selfAoe:270,
        tip:rk => '💚 ' + (55 + 45*rk) + ' liječenja tebi i prijateljima',
        bot:{type:'heal', range:270},
        cast(u, aim, rk){
          healCircle(u, 270, 55 + 45*rk);
          return true;
        }},
      { key:'E', name:'Korijenje', emoji:'🌱', cd:17, mana:90, color:'#22c55e',
        desc:'Korijenje zaustavi neprijatelje na mjestu',
        target:'point', castRange:560, aoe:215,
        tip:rk => '⚔️ ' + (35 + 28*rk) + ' štete + korijen ' + (1.1 + 0.2*rk).toFixed(1) + ' s',
        bot:{type:'zone', range:520},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:215, delay:0.4, ticks:1, interval:0.5,
            dmg:35 + 28*rk, root:1.1 + 0.2*rk, castRange:560,
            color:'#22c55e', emoji:'🌱'});
        }},
      { key:'R', name:'Šumsko srce', emoji:'🌳', cd:70, mana:130, ult:true, color:'#22c55e',
        desc:'ULTI: Velika šuma — izliječi i ubrza prijatelje, a neprijatelje veže korijenjem',
        selfAoe:340,
        tip:rk => '💚 ' + (110 + 70*rk) + ' liječenja + ⚔️ ' + (50 + 30*rk) + ' i korijen neprijateljima',
        bot:{type:'ult-heal', range:340},
        cast(u, aim, rk){
          healCircle(u, 340, 110 + 70*rk);
          for(const e of units){
            if(e.dead || e.removeMe) continue;
            if(e.kind !== 'hero' && e.kind !== 'creep' && e.kind !== 'neutral') continue;
            if(distXY(u.x, u.y, e.x, e.y) > 340) continue;
            if(e.team === u.team){ applyHaste(e, 1.3, 3); }
            else { applyRoot(e, 1.3 + 0.3*rk); applyDamage(e, 50 + 30*rk, u); }
          }
          ring(u.x, u.y, 340, '#22c55e');
          burst(u.x, u.y, '#4ade80', 36, 320, 7);
          return true;
        }},
    ],
  },
  {
    id:'munja', name:'Munja', emoji:'🐯',
    role:'⚡ Brzi tigar — ubojica',
    hp:580, mp:260, dmg:62,
    attrs:{ str:19, agi:25, int:14, strG:4.0, agiG:6.2, intG:2.2, primary:'agi' },
    range:95, speed:188, atkCd:1.0, projSpeed:0,
    passive:{ name:'Statički naboj', emoji:'🔋', color:'#fde047', pid:'naboj',
      desc:'PASIVNO: tvoji napadi imaju šansu okinuti dodatnu munju',
      tip:rk => '⚡ ' + Math.round((0.15 + 0.05*rk) * 100) + '% šanse za +' + (30 + 25*rk) + ' štete' },
    abilities:[
      { key:'Q', name:'Munjeviti udar', emoji:'⚡', cd:6, mana:45, color:'#fde047',
        desc:'Munja skače s neprijatelja na neprijatelja (do 3)',
        selfAoe:480,
        tip:rk => '⚔️ ' + (55 + 38*rk) + ' štete, skače na 3 mete',
        bot:{type:'chain', range:470},
        cast(u, aim, rk){
          return chainLightning(u, {range:480, jump:330, max:3, dmg:55 + 38*rk});
        }},
      { key:'W', name:'Bljesak', emoji:'🌀', cd:9, mana:40, color:'#fde047',
        desc:'Munjevito juriš prema cilju i ošteti sve na putu',
        target:'point', castRange:330, line:true,
        tip:rk => '⚔️ ' + (25 + 18*rk) + ' štete na putu juriša',
        bot:{type:'gap', range:330},
        cast(u, aim, rk){
          const fx = u.x, fy = u.y;
          leapTo(u, aim, 330);
          lineDamage(u, fx, fy, u.x, u.y, 80, 25 + 18*rk);
          addLine(fx, fy, u.x, u.y, '#fde047', 6, 0.3);
          return true;
        }},
      { key:'E', name:'Tigrove kandže', emoji:'🐾', cd:14, mana:50, color:'#facc15',
        desc:'Munjevito zamahuj kandžama — napadaš puno brže nekoliko sekundi',
        tip:rk => '⚡ +' + (30 + 15*rk) + '% brzine napada i 🏃 +12% brzine na 5 s',
        bot:{type:'haste', range:350},
        cast(u, aim, rk){
          applyAtkSpeed(u, 0.3 + 0.15*rk, 5); applyHaste(u, 1.12, 5);
          addFloat(u.x, u.y - 30, '🐾 Brže!', '#fde047', 15);
          burst(u.x, u.y, '#facc15', 18, 200, 5);
          return true;
        }},
      { key:'R', name:'Gnjev oluje', emoji:'🌩️', cd:65, mana:120, ult:true, color:'#a78bfa',
        desc:'ULTI: Divovska munja skače na čak 6 neprijatelja, a tebe ubrza',
        selfAoe:600,
        tip:rk => '⚔️ ' + (100 + 60*rk) + ' štete, skače na 6 meta + ubrzanje',
        bot:{type:'chain', range:550},
        cast(u, aim, rk){
          const ok = chainLightning(u, {range:600, jump:420, max:6, dmg:100 + 60*rk});
          if(!ok) return false;
          applyHaste(u, 1.4, 3);
          burst(u.x, u.y, '#a78bfa', 24, 280, 6);
          return true;
        }},
    ],
  },
  {
    id:'skokica', name:'Skokica', emoji:'🐸',
    role:'👅 Žabac — vuče neprijatelje k sebi',
    hp:640, mp:260, dmg:58,
    attrs:{ str:24, agi:18, int:14, strG:5.2, agiG:3.0, intG:2.2, primary:'str' },
    range:85, speed:172, atkCd:1.05, projSpeed:0,
    passive:{ name:'Vodozemac', emoji:'💧', color:'#38bdf8', pid:'voda',
      desc:'PASIVNO: u rijeci si brža i liječiš se',
      tip:rk => '🏃 +' + (15 + 10*rk) + '% brzine i 💚 +' + (2 + 2*rk) + ' života/s u rijeci' },
    abilities:[
      { key:'Q', name:'Jezičina', emoji:'👅', cd:9, mana:50, color:'#f472b6',
        desc:'Izbaci jezik — prvog pogođenog povuče k sebi i kratko omami!',
        target:'point', castRange:560, line:true,
        tip:rk => '⚔️ ' + (55 + 35*rk) + ' štete + povlačenje + omama ' + (0.4 + 0.1*rk).toFixed(1) + ' s',
        bot:{type:'shot', range:540},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:720, r:18, range:560,
            dmg:55 + 35*rk, color:'#f472b6', emoji:'👅',
            onHit(e){
              const p = stepToward(u, e, 70);
              e.x = p.x; e.y = p.y;
              applyStun(e, 0.4 + 0.1*rk);
              addLine(u.x, u.y, e.x, e.y, '#f472b6', 5, 0.25);
              burst(e.x, e.y, '#f472b6', 10, 160, 5);
            }});
        }},
      { key:'W', name:'Žablji skok', emoji:'🦵', cd:11, mana:55, color:'#86efac',
        desc:'Skoči na mjesto i uspori sve oko sebe',
        target:'point', castRange:340, aoe:150,
        tip:rk => '⚔️ ' + (40 + 25*rk) + ' štete + usporenje 30%',
        bot:{type:'gap', range:340},
        cast(u, aim, rk){
          leapTo(u, aim, 340);
          damageCircle(u, u.x, u.y, 150, 40 + 25*rk, {slow:{f:0.3, t:2}, color:'#86efac'});
          burst(u.x, u.y, '#86efac', 18, 220, 5);
          return true;
        }},
      { key:'E', name:'Mjehur', emoji:'🫧', cd:14, mana:60, color:'#a5f3fc',
        desc:'Mjehurići štite tebe i prijatelje (upijaju trećinu štete)',
        selfAoe:260,
        tip:rk => '🛡️ štit 35% na 3 s + 💚 ' + (30 + 25*rk) + ' liječenja',
        bot:{type:'shield', range:340},
        cast(u, aim, rk){
          for(const e of units){
            if(e.team !== u.team || e.dead || e.removeMe || e.kind !== 'hero') continue;
            if(dist(u, e) > 260) continue;
            applyShield(e, 0.35, 3);
            heal(e, 30 + 25*rk);
          }
          ring(u.x, u.y, 260, '#a5f3fc');
          burst(u.x, u.y, '#a5f3fc', 16, 180, 5);
          return true;
        }},
      { key:'R', name:'Veliki val', emoji:'🌊', cd:70, mana:130, ult:true, color:'#38bdf8',
        desc:'ULTI: Pozovi golemi val — velika šteta i jako usporenje',
        target:'point', castRange:560, aoe:300,
        tip:rk => '⚔️ ' + (160 + 90*rk) + ' štete + usporenje 50%',
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:300, delay:0.6, ticks:1, interval:0.5,
            dmg:160 + 90*rk, slow:{f:0.5, t:3}, castRange:560,
            color:'#38bdf8', emoji:'🌊'});
        }},
    ],
  },
  {
    id:'orlina', name:'Orlina', emoji:'🦅',
    role:'🪶 Orao — zračni snajper',
    hp:520, mp:270, dmg:60,
    attrs:{ str:16, agi:25, int:16, strG:3.0, agiG:6.4, intG:2.4, primary:'agi' },
    range:380, speed:175, atkCd:1.0, projSpeed:700, shot:'feather',
    passive:{ name:'Orlovski vid', emoji:'🔭', color:'#fbbf24', pid:'vid',
      desc:'PASIVNO: orlovske oči — gađaš s veće daljine',
      tip:rk => '🏹 +' + (30*rk) + ' dometa napada' },
    abilities:[
      { key:'Q', name:'Pero-oštrica', emoji:'🪶', cd:6, mana:40, color:'#e2e8f0',
        desc:'Munjevito brzo pero — pogađa izdaleka',
        target:'point', castRange:900, line:true,
        tip:rk => '⚔️ ' + (66 + 44*rk) + ' štete izdaleka',
        bot:{type:'shot', range:800},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:820, r:16, range:900,
            dmg:66 + 44*rk, color:'#e2e8f0', emoji:'🪶'});
        }},
      { key:'W', name:'Uzlet', emoji:'🌬️', cd:12, mana:50, color:'#bae6fd',
        desc:'Vjetar pod krilima — ubrzanje i skida sva usporenja s tebe',
        tip:rk => '🌬️ +' + Math.round((0.4 + 0.05*rk) * 100) + '% brzine 3 s + čisti usporenja',
        bot:{type:'haste', range:520},
        cast(u, aim, rk){
          applyHaste(u, 1.4 + 0.05*rk, 3);
          u.status.slowT = 0;
          u.status.rootT = 0;
          burst(u.x, u.y, '#bae6fd', 16, 200, 5);
          return true;
        }},
      { key:'E', name:'Obrušavanje', emoji:'🦅', cd:13, mana:65, color:'#fbbf24',
        desc:'Obruši se na mjesto — šteta i usporenje',
        target:'point', castRange:380, aoe:150,
        tip:rk => '⚔️ ' + (55 + 35*rk) + ' štete + usporenje 35%',
        bot:{type:'gap', range:380},
        cast(u, aim, rk){
          leapTo(u, aim, 380);
          damageCircle(u, u.x, u.y, 150, 55 + 35*rk, {slow:{f:0.35, t:2}, color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 20, 240, 6);
          return true;
        }},
      { key:'R', name:'Kralj neba', emoji:'🌪️', cd:70, mana:125, ult:true, color:'#fde047',
        desc:'ULTI: Pošalji sokole na SVE neprijateljske junake u blizini!',
        selfAoe:1400,
        tip:rk => '⚔️ ' + (130 + 70*rk) + ' štete SVAKOM vidljivom neprijateljskom junaku',
        bot:{type:'chain', range:900},
        cast(u, aim, rk){
          let n = 0;
          for(const e of units){
            if(e.kind !== 'hero' || e.team === u.team || e.dead || e.removeMe) continue;
            if(dist(u, e) > 1400) continue;
            if(!isVisibleTo(u.team, e)) continue;
            if(e.status.invisT > 0 && e.status.trackT <= 0) continue;
            spawnHoming(u, e, {speed:800, dmg:130 + 70*rk, r:10,
              color:'#fde047', emoji:'🦅',
              onHit(t){ burst(t.x, t.y, '#fde047', 18, 240, 6); }});
            n++;
          }
          if(!n) return false;
          burst(u.x, u.y, '#fde047', 22, 260, 6);
          return true;
        }},
    ],
  },
  {
    id:'luna', name:'Luna', emoji:'🐱',
    role:'🌙 Mjesečeva mačka — strijela iz sjene',
    hp:540, mp:280, dmg:56,
    attrs:{ str:17, agi:24, int:18, strG:3.2, agiG:5.8, intG:2.8, primary:'agi' },
    range:340, speed:172, atkCd:1.05, projSpeed:650, shot:'arrow',
    passive:{ name:'Mjesečeva oštrica', emoji:'🌙', color:'#c4b5fd', pid:'mjesec',
      desc:'PASIVNO: svaki napad odskoči na još jednog neprijatelja u blizini',
      tip:rk => '🌙 odskok: ' + (25 + 10*rk) + '% štete drugom neprijatelju' },
    abilities:[
      { key:'Q', name:'Sveta strijela', emoji:'🌠', cd:9, mana:50, color:'#e9d5ff',
        desc:'Mjesečeva strijela leti JAKO daleko — što dulje leti, jače omami i ranjava!',
        target:'point', castRange:1100, line:true,
        tip:rk => '⚔️ do ' + (90 + 70*rk) + ' štete, omama do ' + (1.2 + 0.3*rk).toFixed(1) + ' s (raste s daljinom)',
        bot:{type:'shot', range:900},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:620, r:20, range:1100,
            dmg:50 + 30*rk, color:'#e9d5ff', emoji:'🌠',
            onHit(e, p){
              const far = Math.min(1, (p ? p.traveled : 0) / 1100);
              applyStun(e, 0.5 + far * (0.7 + 0.3*rk));
              applyDamage(e, Math.round(far * (40 + 40*rk)), u);
              if(far > 0.7) addFloat(e.x, e.y, '🌙 Dalekometni pogodak!', '#e9d5ff', 15);
              burst(e.x, e.y, '#e9d5ff', 14, 200, 5);
            }});
        }},
      { key:'W', name:'Zvjezdana kiša', emoji:'⭐', cd:11, mana:60, color:'#e9d5ff',
        desc:'Zvijezde padaju na sve neprijatelje oko tebe',
        selfAoe:250,
        tip:rk => '⚔️ ' + (40 + 32*rk) + ' štete svima oko tebe',
        bot:{type:'aoe-self', range:250},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 250, 40 + 32*rk, {color:'#e9d5ff'});
          burst(u.x, u.y, '#fde047', 14, 200, 5);
          burst(u.x, u.y, '#e9d5ff', 14, 240, 5);
          return true;
        }},
      { key:'E', name:'Mjesečev skok', emoji:'🌜', cd:12, mana:50, color:'#bae6fd',
        desc:'Skoči naprijed i potrči brže 2 sekunde',
        target:'point', castRange:400, line:true,
        tip:rk => '🌜 skok ' + 400 + ' + ubrzanje ' + Math.round((0.2 + 0.05*rk) * 100) + '%',
        bot:{type:'gap', range:400},
        cast(u, aim, rk){
          leapTo(u, aim, 400);
          applyHaste(u, 1.2 + 0.05*rk, 2);
          burst(u.x, u.y, '#bae6fd', 16, 200, 5);
          return true;
        }},
      { key:'R', name:'Mjesečeva sjena', emoji:'👻', cd:80, mana:140, ult:true, color:'#c4b5fd',
        desc:'ULTI: CIJELI tvoj tim postaje NEVIDLJIV! Napad prekida nevidljivost',
        tip:rk => '👻 svi tvoji junaci nevidljivi ' + (5 + 3*rk) + ' s',
        bot:{type:'ult-aoe', range:500},
        cast(u, aim, rk){
          for(const e of units){
            if(e.kind !== 'hero' || e.team !== u.team || e.dead) continue;
            e.status.invisT = 5 + 3*rk;
            addFloat(e.x, e.y, '👻 Nevidljiv!', '#c4b5fd', 15);
            burst(e.x, e.y, '#c4b5fd', 12, 160, 5);
          }
          return true;
        }},
    ],
  },
  {
    id:'tragac', name:'Tragač', emoji:'🦝',
    role:'💰 Lovac na glave — nevidljivi plaćenik',
    hp:560, mp:250, dmg:60,
    attrs:{ str:19, agi:25, int:16, strG:3.8, agiG:6.2, intG:2.4, primary:'agi' },
    range:95, speed:175, atkCd:1.0, projSpeed:0,
    passive:{ name:'Lukavi udarac', emoji:'💢', color:'#fb923c', pid:'jinada',
      desc:'PASIVNO: šansa da udarac bude podmukao — dodatna šteta i usporenje',
      tip:rk => '💢 ' + Math.round((0.15 + 0.05*rk) * 100) + '% šanse za +' + (25 + 25*rk) + ' štete i usporenje' },
    abilities:[
      { key:'Q', name:'Leteća zvijezda', emoji:'💫', cd:8, mana:45, color:'#fbbf24',
        desc:'Baci oštru zvijezdu koja ranjava i kratko omami',
        target:'point', castRange:600, line:true,
        tip:rk => '⚔️ ' + (60 + 45*rk) + ' štete + omama 0.4 s',
        bot:{type:'shot', range:560},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:750, r:16, range:600,
            dmg:60 + 45*rk, color:'#fbbf24', emoji:'💫',
            onHit(e){ applyStun(e, 0.4); }});
        }},
      { key:'W', name:'Dimna bomba', emoji:'💨', cd:14, mana:60, color:'#94a3b8',
        desc:'Baci dimnu bombu — neprijatelji u dimu ne mogu čarati i promašuju udarce',
        target:'point', castRange:550, aoe:240,
        tip:rk => '🤐 tišina ' + (1.5 + 0.5*rk).toFixed(1) + ' s + 😵 promašuju 40% 4 s + ⚔️ ' + (30 + 20*rk),
        bot:{type:'zone', range:500},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 550);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 240 + e.r * 0.5) continue;
            applyDamage(e, 30 + 20*rk, u); applySilence(e, 1.5 + 0.5*rk); applyBlind(e, 0.4, 4);
          }
          ring(p.x, p.y, 240, '#94a3b8');
          burst(p.x, p.y, '#cbd5e1', 30, 220, 9);
          return true;
        }},
      { key:'E', name:'Sjena', emoji:'👤', cd:16, mana:60, color:'#c4b5fd',
        pid:'sjena',
        desc:'Nestani u sjenu — nevidljiv si, a napad iz sjene jako boli!',
        tip:rk => '👤 nevidljiv ' + (6 + 2*rk) + ' s; napad iz sjene +' + (40 + 30*rk) + ' štete',
        bot:{type:'shield', range:380},
        cast(u, aim, rk){
          u.status.invisT = 6 + 2*rk;
          applyHaste(u, 1.12, 2);
          addFloat(u.x, u.y, '👤 U sjeni!', '#c4b5fd', 15);
          burst(u.x, u.y, '#c4b5fd', 14, 180, 5);
          return true;
        }},
      { key:'R', name:'Ucjena', emoji:'💰', cd:22, mana:60, ult:true, color:'#fde047',
        desc:'ULTI: Označi neprijateljskog junaka — svi ga vide (i nevidljivog!), a njegova smrt donosi DODATNO zlato',
        target:'point', castRange:700, aoe:260,
        tip:rk => '💰 meta otkrivena 25 s; pogiba li, ti i ubojica dobivate +' + (80 + 40*rk) + ' zlata',
        bot:{type:'track', range:650},
        cast(u, aim, rk){
          let best = null, bd = 260;
          for(const e of units){
            if(e.kind !== 'hero' || e.team === u.team || e.dead || e.removeMe) continue;
            const d = distXY(aim.x, aim.y, e.x, e.y);
            if(d < bd){ bd = d; best = e; }
          }
          if(!best) return false;
          best.status.trackT = 25;
          best.trackedBy = u;
          best.trackBonus = 80 + 40*rk;
          addFloat(best.x, best.y, '💰 Ucijenjen!', '#fde047', 16);
          addLine(u.x, u.y, best.x, best.y, '#fde047', 4, 0.35);
          burst(best.x, best.y, '#fde047', 14, 200, 5);
          return true;
        }},
    ],
  },
  /* ---------------- NOVI JUNACI (v0.9) ---------------- */
  {
    id:'jez', name:'Bodljo', emoji:'🦔',
    role:'🌵 Jež — bodljikavi tenk',
    hp:660, mp:230, dmg:58,
    attrs:{ str:24, agi:17, int:13, strG:5.4, agiG:2.4, intG:1.8, primary:'str' },
    range:80, speed:170, atkCd:1.1, projSpeed:0,
    passive:{ name:'Oklop od bodlji', emoji:'🦔', color:'#a3e635', pid:'oklop',
      desc:'PASIVNO: tko te udari, može dobiti bodlje natrag!',
      tip:rk => '🌵 ' + Math.round((0.2 + 0.05*rk) * 100) + '% šanse da napadaču poleti ' + (3) + ' bodlje po ' + (18 + 10*rk) + ' štete' },
    abilities:[
      { key:'Q', name:'Kiša bodlji', emoji:'🌵', cd:6, mana:35, color:'#a3e635',
        desc:'Ispali bodlje na sve oko sebe; svaka bodlja u neprijatelju boli sve više!',
        selfAoe:230,
        tip:rk => '⚔️ ' + (45 + 35*rk) + ' štete svima oko tebe, +8 po svakoj bodlji u meti',
        bot:{type:'aoe-self', range:230},
        cast(u, aim, rk){
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(dist(u, e) > 230 + e.r * 0.5) continue;
            const stacks = (e.quillT > gameTime) ? (e.quillN || 0) : 0;
            applyDamage(e, 45 + 35*rk + stacks * 8, u);
            e.quillN = stacks + 1; e.quillT = gameTime + 8;
            if(e.kind === 'hero' && e.quillN >= 3) addFloat(e.x, e.y, '🌵 ×' + e.quillN, '#a3e635', 13);
          }
          ring(u.x, u.y, 230, '#a3e635');
          burst(u.x, u.y, '#a3e635', 18, 260, 5);
          return true;
        }},
      { key:'W', name:'Ljepljiva sluz', emoji:'🟢', cd:8, mana:45, color:'#84cc16',
        desc:'Baci ljepljivu grudu — prvi pogođeni se zalijepi i uspori',
        target:'point', castRange:650, line:true,
        tip:rk => '⚔️ ' + (40 + 30*rk) + ' štete + usporenje ' + Math.round((0.3 + 0.05*rk) * 100) + '% na 3 s',
        bot:{type:'shot', range:600},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:600, r:22, range:650,
            dmg:40 + 30*rk, slow:{f:0.3 + 0.05*rk, t:3}, color:'#84cc16', emoji:'🟢'});
        }},
      { key:'E', name:'Klupko', emoji:'🌰', cd:12, mana:55, color:'#a16207',
        desc:'Smotaj se u bodljikavo klupko i otkotrljaj se — prvi neprijatelj na putu bude omamljen',
        target:'point', castRange:520, line:true,
        tip:rk => '⚔️ ' + (50 + 35*rk) + ' štete + 💫 omama ' + (0.6 + 0.15*rk).toFixed(2) + ' s',
        bot:{type:'gap', range:500},
        cast(u, aim, rk){
          startCharge(u, aim, {range:520, speed:950, dmg:50 + 35*rk, stun:0.6 + 0.15*rk});
          return true;
        }},
      { key:'R', name:'Juriš bodlji', emoji:'🏃', cd:60, mana:100, ult:true, color:'#bef264',
        desc:'ULTI: Zalet! Puno brži i jači 8 sekundi, a život ti se obnavlja',
        tip:rk => '🏃 +' + Math.round((0.25 + 0.1*rk) * 100) + '% brzine, ×' + (1.2 + 0.1*rk).toFixed(1) + ' štete 8 s + 💚 ' + (60 + 40*rk) + ' liječenja',
        bot:{type:'ult-aoe', range:450},
        cast(u, aim, rk){
          applyHaste(u, 1.25 + 0.1*rk, 8);
          u.status.dmgMulT = 8; u.status.dmgMulF = 1.2 + 0.1*rk;
          heal(u, 60 + 40*rk);
          burst(u.x, u.y, '#bef264', 24, 260, 6);
          return true;
        }},
    ],
  },
  {
    id:'slon', name:'Tutnjo', emoji:'🐘',
    role:'🐘 Slon — golemi branič',
    hp:740, mp:220, dmg:62,
    attrs:{ str:27, agi:13, int:12, strG:5.8, agiG:1.8, intG:1.8, primary:'str' },
    range:88, speed:160, atkCd:1.15, projSpeed:0,
    passive:{ name:'Debela koža', emoji:'🛡️', color:'#c7d2fe', pid:'debela',
      desc:'PASIVNO: tko te udari izbliza, i sam se ozlijedi',
      tip:rk => '🛡️ napadač izbliza prima ' + (14 + 10*rk) + ' štete natrag' },
    abilities:[
      { key:'Q', name:'Topot', emoji:'🦶', cd:12, mana:60, color:'#c4b5fd',
        desc:'Lupi nogom — zemlja se zatrese, svi oko tebe su omamljeni',
        selfAoe:210,
        tip:rk => '⚔️ ' + (60 + 45*rk) + ' štete + omama ' + (1.0 + 0.3*rk).toFixed(1) + ' s',
        bot:{type:'aoe-self', range:210},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 210, 60 + 45*rk, {stun:1.0 + 0.3*rk, color:'#c4b5fd'});
          burst(u.x, u.y, '#c9b48c', 22, 240, 6);
          return true;
        }},
      { key:'W', name:'Surla-zamah', emoji:'🌀', cd:7, mana:40, color:'#a5b4fc',
        desc:'Zamahni surlom ispred sebe — velika šteta u pravcu',
        target:'point', castRange:320, line:true,
        tip:rk => '⚔️ ' + (80 + 55*rk) + ' štete svima u pravcu zamaha',
        bot:{type:'shot', range:300},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 320);
          u.dir = Math.atan2(p.y - u.y, p.x - u.x);
          lineDamage(u, u.x, u.y, p.x, p.y, 90, 80 + 55*rk);
          addLine(u.x, u.y, p.x, p.y, '#a5b4fc', 8, 0.25);
          burst(p.x, p.y, '#a5b4fc', 12, 200, 5);
          return true;
        }},
      { key:'E', name:'Tuš iz surle', emoji:'💦', cd:15, mana:70, color:'#38bdf8',
        desc:'Poprskaj prijatelje vodom iz surle — izliječi ih i daj im mali štit',
        selfAoe:320,
        tip:rk => '💚 +' + (60 + 40*rk) + ' života i 🛡️ štit 20% 3 s tebi i prijateljima u krugu 320',
        bot:{type:'heal'},
        cast(u, aim, rk){
          for(const e of units){
            if(e.kind !== 'hero' || e.team !== u.team || e.dead || dist(u, e) > 320) continue;
            heal(e, 60 + 40*rk); applyShield(e, 0.2, 3);
            addFloat(e.x, e.y - 20, '💦', '#7dd3fc', 18);
          }
          ring(u.x, u.y, 320, '#38bdf8');
          burst(u.x, u.y, '#7dd3fc', 24, 220, 6);
          return true;
        }},
      { key:'R', name:'Stampedo', emoji:'🐘', cd:80, mana:130, ult:true, color:'#818cf8',
        desc:'ULTI: Cijeli tvoj tim juri kao stampedo! Neprijatelji oko tebe su pregaženi i omamljeni',
        selfAoe:320,
        tip:rk => '🏃 tim +50% brzine 4 s • ⚔️ ' + (110 + 80*rk) + ' štete + omama 1.5 s oko tebe',
        bot:{type:'ult-aoe', range:320},
        cast(u, aim, rk){
          for(const e of units){
            if(e.kind === 'hero' && e.team === u.team && !e.dead) applyHaste(e, 1.5, 4);
          }
          damageCircle(u, u.x, u.y, 320, 110 + 80*rk, {stun:1.5, color:'#818cf8'});
          burst(u.x, u.y, '#c9b48c', 40, 320, 8);
          return true;
        }},
    ],
  },
  {
    id:'pcela', name:'Zuja', emoji:'🐝',
    role:'🍯 Pčela — otrovna čarobnica',
    hp:520, mp:320, dmg:48,
    attrs:{ str:17, agi:18, int:25, strG:3.4, agiG:2.6, intG:5.6, primary:'int' },
    range:340, speed:168, atkCd:1.1, projSpeed:650, shot:'bolt',
    passive:{ name:'Med', emoji:'🧈', color:'#fde68a', pid:'med',
      desc:'PASIVNO: slatki med polako liječi tebe i prijatelje oko tebe',
      tip:rk => '💚 +' + (1 + rk) + ' života/s tebi i prijateljima u krugu 300' },
    abilities:[
      { key:'Q', name:'Otrovni ubod', emoji:'🐝', cd:7, mana:45, color:'#facc15',
        desc:'Pošalji pčelu — ubod otruje neprijatelja koji gubi život nekoliko sekundi',
        target:'point', castRange:700, line:true,
        tip:rk => '⚔️ ' + (35 + 25*rk) + ' štete + 🤢 otrov ' + (10 + 7*rk) + '/s na 4 s',
        bot:{type:'shot', range:640},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:640, r:20, range:700,
            dmg:35 + 25*rk, color:'#facc15', emoji:'🐝',
            onHit(e){ applyPoison(e, 10 + 7*rk, 4, u); }});
        }},
      { key:'W', name:'Roj', emoji:'🍯', cd:14, mana:70, color:'#fbbf24',
        desc:'Pozovi roj pčela na mjesto — bodu i usporavaju sve u krugu',
        target:'point', castRange:600, aoe:200,
        tip:rk => '⚔️ 5 × ' + (18 + 14*rk) + ' štete + usporenje',
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:200, delay:0.4, ticks:5, interval:0.8,
            dmg:18 + 14*rk, slow:{f:0.3, t:1}, castRange:600,
            color:'#fbbf24', emoji:'🍯'});
        }},
      { key:'E', name:'Zuj-bijeg', emoji:'🌬️', cd:13, mana:45, color:'#fde047',
        desc:'Zuj! Naglo odleti na drugo mjesto i kratko ubrzaj',
        target:'point', castRange:420,
        tip:rk => '🐝 skok do 420 + 🏃 +' + (20 + 10*rk) + '% brzine ' + (1.5 + 0.5*rk) + ' s',
        bot:{type:'escape', range:450},
        cast(u, aim, rk){
          leapTo(u, aim, 420);
          applyHaste(u, 1.2 + 0.1*rk, 1.5 + 0.5*rk);
          burst(u.x, u.y, '#fde047', 14, 180, 5);
          return true;
        }},
      { key:'R', name:'Košnica', emoji:'🏺', cd:75, mana:140, ult:true, color:'#f59e0b',
        desc:'ULTI: Golema košnica — otrovni oblak koji dugo traje i truje sve u njemu',
        target:'point', castRange:650, aoe:320,
        tip:rk => '⚔️ 6 × ' + (40 + 28*rk) + ' štete + 🤢 otrov svima u krugu',
        bot:{type:'zone', range:600},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:320, delay:0.6, ticks:6, interval:1.0,
            dmg:40 + 28*rk, poison:{dps:8 + 4*rk, t:3}, castRange:650,
            color:'#f59e0b', emoji:'🏺'});
        }},
    ],
  },
  {
    id:'sova', name:'Mudra', emoji:'🦉',
    role:'🌙 Sova — gospodarica noći',
    hp:540, mp:300, dmg:52,
    attrs:{ str:18, agi:19, int:23, strG:3.6, agiG:2.8, intG:5.0, primary:'int' },
    range:350, speed:170, atkCd:1.1, projSpeed:650, shot:'feather',
    passive:{ name:'Noćna ptica', emoji:'🌙', color:'#a78bfa', pid:'noc',
      desc:'PASIVNO: noću si brža i jača!',
      tip:rk => '🌙 noću +' + Math.round((0.15 + 0.08*rk) * 100) + '% brzine i +' + (12 + 10*rk) + ' štete' },
    abilities:[
      { key:'Q', name:'Huk', emoji:'📣', cd:10, mana:55, color:'#e9d5ff',
        desc:'Glasni huk — neprijatelji oko tebe su ušutkani i ne mogu bacati moći',
        selfAoe:260,
        tip:rk => '⚔️ ' + (45 + 35*rk) + ' štete + 🤐 ušutkani ' + (2 + 0.5*rk).toFixed(1) + ' s',
        bot:{type:'aoe-self', range:260},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 260, 45 + 35*rk, {silence:2 + 0.5*rk, color:'#e9d5ff'});
          ring(u.x, u.y, 160, '#e9d5ff'); ring(u.x, u.y, 260, '#e9d5ff');
          return true;
        }},
      { key:'W', name:'Sovino oko', emoji:'👁️', cd:25, mana:50, color:'#c4b5fd',
        desc:'Pogledaj daleko — vidiš odabrano mjesto 10 sekundi (i kroz maglu rata!)',
        target:'point', castRange:1400, aoe:420,
        tip:rk => '👁️ vid u krugu 420 na ' + (8 + 3*rk) + ' s',
        bot:{type:'ward', range:1200},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 1400);
          wards.push({ x:p.x, y:p.y, r:420, team:u.team, t:8 + 3*rk, owner:u });
          ring(p.x, p.y, 420, '#c4b5fd');
          burst(p.x, p.y, '#c4b5fd', 10, 150, 5);
          return true;
        }},
      { key:'E', name:'Tihi let', emoji:'🌫️', cd:18, mana:70, color:'#a78bfa',
        desc:'Sova leti potpuno tiho — postaneš nevidljiva i brža (napad te otkrije)',
        tip:rk => '👻 nevidljivost ' + (3 + rk) + ' s + 🏃 +20% brzine',
        bot:{type:'escape', range:500},
        cast(u, aim, rk){
          u.status.invisT = 3 + rk;
          applyHaste(u, 1.2, 3 + rk);
          burst(u.x, u.y, '#c4b5fd', 16, 160, 5);
          return true;
        }},
      { key:'R', name:'Vječna noć', emoji:'🌑', cd:90, mana:120, ult:true, color:'#6d28d9',
        desc:'ULTI: Pozovi noć usred dana! Neprijatelji vide kraće, a tvoj tim je brži',
        tip:rk => '🌑 noć ' + (18 + 6*rk) + ' s • tim +20% brzine 6 s',
        bot:{type:'night', range:700},
        cast(u, aim, rk){
          nightForceT = Math.max(nightForceT, 18 + 6*rk);
          for(const e of units){
            if(e.kind === 'hero' && e.team === u.team && !e.dead) applyHaste(e, 1.2, 6);
          }
          announce('🌑 Vječna noć!', u.emoji + ' ' + u.name + ' je pozvala noć!');
          burst(u.x, u.y, '#6d28d9', 30, 300, 7);
          return true;
        }},
    ],
  },
  {
    id:'majmun', name:'Skakač', emoji:'🐵',
    role:'🥢 Majmun — brzi borac sa štapom',
    hp:580, mp:260, dmg:64,
    attrs:{ str:19, agi:26, int:15, strG:4.0, agiG:6.4, intG:2.2, primary:'agi' },
    range:90, speed:180, atkCd:1.0, projSpeed:0,
    passive:{ name:'Kombo', emoji:'👊', color:'#fde047', pid:'kombo',
      desc:'PASIVNO: svaki treći udarac je jači i malo te izliječi',
      tip:rk => '👊 svaki 3. napad +' + (30 + 25*rk) + ' štete i 💚 ' + (15 + 10*rk) + ' liječenja' },
    abilities:[
      { key:'Q', name:'Štap-udarac', emoji:'🥢', cd:9, mana:50, color:'#fbbf24',
        desc:'Štap se produži i udari sve u pravcu — kratka omama',
        target:'point', castRange:420, line:true,
        tip:rk => '⚔️ ' + (65 + 45*rk) + ' štete + omama ' + (0.5 + 0.2*rk).toFixed(1) + ' s svima u pravcu',
        bot:{type:'shot', range:400},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 420);
          u.dir = Math.atan2(p.y - u.y, p.x - u.x);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distToSeg(e.x, e.y, u.x, u.y, p.x, p.y) <= 70 + e.r){
              applyDamage(e, 65 + 45*rk, u);
              applyStun(e, 0.5 + 0.2*rk);
            }
          }
          addLine(u.x, u.y, p.x, p.y, '#fbbf24', 7, 0.3);
          burst(p.x, p.y, '#fbbf24', 10, 180, 5);
          return true;
        }},
      { key:'W', name:'Majmunski skok', emoji:'🐵', cd:10, mana:45, color:'#86efac',
        desc:'Skoči na mjesto i kratko potrči brže',
        target:'point', castRange:450, line:true,
        tip:rk => '🐵 skok 450 + ubrzanje ' + Math.round((0.15 + 0.05*rk) * 100) + '% na 2 s',
        bot:{type:'gap', range:450},
        cast(u, aim, rk){
          leapTo(u, aim, 450);
          applyHaste(u, 1.15 + 0.05*rk, 2);
          burst(u.x, u.y, '#c9b48c', 14, 200, 5);
          return true;
        }},
      { key:'E', name:'Banana', emoji:'🍌', cd:10, mana:45, color:'#fde047',
        desc:'Baci koru od banane — tko je pogodi, oklizne se i padne',
        target:'point', castRange:650, line:true,
        tip:rk => '⚔️ ' + (35 + 25*rk) + ' štete + 💫 omama ' + (0.8 + 0.2*rk).toFixed(1) + ' s',
        bot:{type:'shot', range:600},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:720, r:24, range:650, dmg:35 + 25*rk, color:'#fde047', emoji:'🍌',
            onHit:e => { applyStun(e, 0.8 + 0.2*rk); addFloat(e.x, e.y, '🍌 Oklizn!', '#fde047', 15); }});
        }},
      { key:'R', name:'Majmunska vojska', emoji:'🐒', cd:80, mana:130, ult:true, color:'#f59e0b',
        desc:'ULTI: Pozovi 3 majmuna koji se bore uz tebe!',
        tip:rk => '🐒 3 majmuna (' + (260 + 140*rk) + ' života, ' + (22 + 14*rk) + ' štete) na ' + (12 + 3*rk) + ' s',
        bot:{type:'ult-aoe', range:500},
        cast(u, aim, rk){
          for(let i = 0; i < 3; i++){
            const a = i / 3 * TAU + 0.7;
            makeSummon(u, { x:u.x + Math.cos(a) * 60, y:u.y + Math.sin(a) * 60,
              hp:260 + 140*rk, dmg:22 + 14*rk, life:12 + 3*rk, model:'hero_majmun', emoji:'🐒', name:'Majmunčić' });
          }
          burst(u.x, u.y, '#f59e0b', 24, 260, 6);
          return true;
        }},
    ],
  },
  /* ---------------- NOVI JUNACI (v0.10) ---------------- */
  {
    id:'vuk', name:'Sivko', emoji:'🐺',
    role:'🌕 Vuk — vođa čopora',
    hp:640, mp:230, dmg:60,
    attrs:{ str:24, agi:20, int:12, strG:5.0, agiG:3.2, intG:1.6, primary:'str' },
    range:82, speed:176, atkCd:1.05, projSpeed:0,
    passive:{ name:'Čopor', emoji:'🐾', color:'#cbd5e1', pid:'copor',
      desc:'PASIVNO: brže napadaš i rane ti brže zacjeljuju',
      tip:rk => '⚡ +' + (10*rk) + '% brzine napada • 💚 +' + (1 + rk) + ' života/s' },
    abilities:[
      { key:'Q', name:'Zavijanje', emoji:'🌕', cd:11, mana:45, color:'#e2e8f0',
        desc:'Zavij na mjesec — tvoj tim udara jače, a neprijatelji se od straha usporavaju',
        selfAoe:420,
        tip:rk => '⚔️ tim +' + (15 + 10*rk) + ' štete 6 s • 🐌 neprijatelji usporeni 20% 3 s',
        bot:{type:'aoe-self', range:420},
        cast(u, aim, rk){
          for(const e of units){
            if(e.dead || e.removeMe || dist(u, e) > 420) continue;
            if(e.kind === 'hero' && e.team === u.team){ e.howlT = 6; e.howlDmg = 15 + 10*rk; }
            else if(e.team !== u.team && isSpellTarget(e)) applySlow(e, 0.2, 3);
          }
          ring(u.x, u.y, 420, '#e2e8f0');
          burst(u.x, u.y, '#e2e8f0', 16, 220, 5);
          return true;
        }},
      { key:'W', name:'Ugriz', emoji:'🦷', cd:8, mana:40, color:'#fca5a5',
        desc:'Skoči na neprijatelja i ugrizi ga — rana krvari još 3 sekunde',
        target:'point', castRange:300, line:true,
        tip:rk => '⚔️ ' + (50 + 40*rk) + ' štete + 🩸 ' + (8 + 6*rk) + '/s na 3 s',
        bot:{type:'gap', range:300},
        cast(u, aim, rk){
          leapTo(u, aim, 300);
          const e = nearestEnemyOf(u, 110, x => isSpellTarget(x));
          if(e){ applyDamage(e, 50 + 40*rk, u); applyPoison(e, 8 + 6*rk, 3, u); addFloat(e.x, e.y, '🦷', '#fca5a5', 16); }
          burst(u.x, u.y, '#fca5a5', 12, 200, 5);
          return true;
        }},
      { key:'E', name:'Divlje kandže', emoji:'💢', cd:12, mana:40, color:'#ef4444',
        desc:'Naoštri kandže — sljedeća 3 napada jače udaraju i usporavaju',
        tip:rk => '⚔️ sljedeća 3 napada +' + (25 + 20*rk) + ' štete i 🐌 usporenje 30%',
        bot:{type:'haste', range:300},
        cast(u, aim, rk){
          u.clawHits = 3; u.clawDmg = 25 + 20*rk;
          addFloat(u.x, u.y - 30, '💢 Kandže!', '#fca5a5', 15);
          burst(u.x, u.y, '#ef4444', 14, 160, 5);
          return true;
        }},
      { key:'R', name:'Vučji oblik', emoji:'🐺', cd:75, mana:120, ult:true, color:'#94a3b8',
        desc:'ULTI: Pretvori se u golemog vuka — puno brži i jači, a rane se zacijele',
        tip:rk => '🐺 ' + (10 + 2*rk) + ' s: +35% brzine, ×' + (1.25 + 0.1*rk).toFixed(2) + ' štete • 💚 ' + (100 + 50*rk),
        bot:{type:'ult-aoe', range:500},
        cast(u, aim, rk){
          const d = 10 + 2*rk;
          u.status.formT = d;
          applyHaste(u, 1.35, d);
          u.status.dmgMulT = d; u.status.dmgMulF = 1.25 + 0.1*rk;
          heal(u, 100 + 50*rk);
          burst(u.x, u.y, '#94a3b8', 30, 300, 7);
          announce('🐺 Vučji oblik!', u.name + ' je postao golemi vuk!');
          return true;
        }},
    ],
  },
  {
    id:'gavran', name:'Mrak', emoji:'🐦‍⬛',
    role:'🌑 Gavran — mračni čarobnjak',
    hp:520, mp:340, dmg:50,
    attrs:{ str:17, agi:17, int:26, strG:3.2, agiG:2.4, intG:5.8, primary:'int' },
    range:360, speed:166, atkCd:1.1, projSpeed:640, shot:'feather',
    passive:{ name:'Gavranovo pero', emoji:'🪶', color:'#ddd6fe', pid:'pero',
      desc:'PASIVNO: pokoji napad ukrade neprijatelju manu i da je tebi',
      tip:rk => '🪶 25% šanse: 💧 ' + (20 + 15*rk) + ' mane ukradeno + ' + (15 + 10*rk) + ' štete' },
    abilities:[
      { key:'Q', name:'Kletva', emoji:'🌀', cd:9, mana:55, color:'#a78bfa',
        desc:'Baci kletvu na mjesto — ukleti primaju više štete od svega 5 sekundi',
        target:'point', castRange:600, aoe:180,
        tip:rk => '⚔️ ' + (50 + 40*rk) + ' štete + 🌀 +' + Math.round((0.2 + 0.05*rk) * 100) + '% primljene štete 5 s',
        bot:{type:'zone', range:550},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 600);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 180 + e.r * 0.5) continue;
            applyCurse(e, 0.2 + 0.05*rk, 5);
            applyDamage(e, 50 + 40*rk, u);
          }
          ring(p.x, p.y, 180, '#a78bfa');
          burst(p.x, p.y, '#6d28d9', 16, 200, 5);
          return true;
        }},
      { key:'W', name:'Zamjena', emoji:'🔁', cd:14, mana:60, color:'#c4b5fd',
        desc:'Zamijeni mjesto s neprijateljskim junakom — povuci ga k svojima!',
        target:'point', castRange:520, aoe:140,
        tip:rk => '🔁 zamjena mjesta + ⚔️ ' + (40 + 30*rk) + ' štete + 🐌 usporenje 2 s',
        bot:{type:'swap', range:520},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 520);
          let best = null, bd = 150;
          for(const e of units){
            if(e.kind !== 'hero' || e.team === u.team || e.dead || e.status.invisT > 0) continue;
            const d = distXY(p.x, p.y, e.x, e.y);
            if(d < bd){ bd = d; best = e; }
          }
          if(!best) return false;
          swapPositions(u, best);
          applyDamage(best, 40 + 30*rk, u);
          applySlow(best, 0.3, 2);
          return true;
        }},
      { key:'E', name:'Pernata oluja', emoji:'🪶', cd:13, mana:70, color:'#6366f1',
        desc:'Vihor oštrog perja kruži nad mjestom — ranjava i usporava sve u njemu',
        target:'point', castRange:600, aoe:230,
        tip:rk => '⚔️ 4 × ' + (25 + 18*rk) + ' štete + 🐌 usporenje 30%',
        bot:{type:'zone', range:550},
        cast(u, aim, rk){
          return spawnZone(u, aim, {castRange:600, r:230, delay:0.3, ticks:4, interval:0.6,
            dmg:25 + 18*rk, slow:{f:0.3, t:1}, color:'#6366f1', emoji:'🪶'});
        }},
      { key:'R', name:'Jato gavranova', emoji:'🐦‍⬛', cd:80, mana:140, ult:true, color:'#4c1d95',
        desc:'ULTI: Pozovi jato gavranova — kljucaju i ušutkavaju sve u krugu',
        target:'point', castRange:650, aoe:300,
        tip:rk => '⚔️ 6 × ' + (35 + 25*rk) + ' štete + 🤐 ušutkani',
        bot:{type:'zone', range:600},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:300, delay:0.3, ticks:6, interval:0.7,
            dmg:35 + 25*rk, silence:1.0, castRange:650,
            color:'#4c1d95', emoji:'🐦‍⬛'});
        }},
    ],
  },
  {
    id:'hobotnica', name:'Pipko', emoji:'🐙',
    role:'🌊 Hobotnica — vladar dubina',
    hp:700, mp:250, dmg:58,
    attrs:{ str:26, agi:14, int:14, strG:5.6, agiG:1.8, intG:2.0, primary:'str' },
    range:92, speed:160, atkCd:1.15, projSpeed:0,
    passive:{ name:'Sluzava koža', emoji:'💧', color:'#a5b4fc', pid:'sluz',
      desc:'PASIVNO: tko te udari, oklizne se po sluzi i uspori',
      tip:rk => '🐌 napadač usporen ' + Math.round((0.15 + 0.05*rk) * 100) + '% na 1.5 s' },
    abilities:[
      { key:'Q', name:'Mlaz tinte', emoji:'🖤', cd:8, mana:45, color:'#312e81',
        desc:'Ispljuni tintu — pogođeni ne vidi dobro i promašuje napade',
        target:'point', castRange:650, line:true,
        tip:rk => '⚔️ ' + (45 + 35*rk) + ' štete + 😵 promašuje ' + Math.round((0.4 + 0.1*rk) * 100) + '% 3 s',
        bot:{type:'shot', range:600},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:620, r:24, range:650,
            dmg:45 + 35*rk, color:'#312e81', emoji:'🖤',
            onHit(e){ applyBlind(e, 0.4 + 0.1*rk, 3); }});
        }},
      { key:'W', name:'Pipci', emoji:'🐙', cd:10, mana:50, color:'#818cf8',
        desc:'Ispruži pipke u pravcu — zgrabi neprijatelje i povuci ih k sebi',
        target:'point', castRange:380, line:true,
        tip:rk => '⚔️ ' + (40 + 30*rk) + ' štete + povlačenje ' + (140 + 20*rk) + ' + 🐌 usporenje',
        bot:{type:'shot', range:350},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 380);
          u.dir = Math.atan2(p.y - u.y, p.x - u.x);
          let n = 0;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distToSeg(e.x, e.y, u.x, u.y, p.x, p.y) <= 80 + e.r){
              applyDamage(e, 40 + 30*rk, u);
              pullToward(e, u.x, u.y, 140 + 20*rk);
              applySlow(e, 0.3, 2);
              n++;
            }
          }
          addLine(u.x, u.y, p.x, p.y, '#818cf8', 9, 0.3);
          burst(p.x, p.y, '#818cf8', 10, 160, 5);
          return true;
        }},
      { key:'E', name:'Zagrljaj pipaka', emoji:'🫂', cd:13, mana:60, color:'#8b5cf6',
        desc:'Pipcima zgrabi neprijatelje ispred sebe — ne mogu se micati i polako gube život',
        target:'point', castRange:320, aoe:140,
        tip:rk => '🐙 drži ' + (1.2 + 0.3*rk).toFixed(1) + ' s + ⚔️ ' + (25 + 15*rk) + ' štete/s',
        bot:{type:'zone', range:300},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 320), d = 1.2 + 0.3*rk;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 140 + e.r * 0.5) continue;
            pullToward(e, p.x, p.y, 40);
            applyRoot(e, d); applyDot(e, 25 + 15*rk, d, u);
            if(e.kind === 'hero') addFloat(e.x, e.y, '🐙', '#c4b5fd', 18);
          }
          ring(p.x, p.y, 140, '#8b5cf6');
          burst(p.x, p.y, '#a78bfa', 16, 160, 5);
          return true;
        }},
      { key:'R', name:'Vrtlog dubina', emoji:'🌀', cd:85, mana:140, ult:true, color:'#4f46e5',
        desc:'ULTI: Golemi vrtlog povuče sve neprijatelje k tebi i omami ih',
        selfAoe:380,
        tip:rk => '🌀 povlačenje + ⚔️ ' + (140 + 100*rk) + ' štete + omama ' + (1.2 + 0.3*rk).toFixed(1) + ' s',
        bot:{type:'ult-aoe', range:350},
        cast(u, aim, rk){
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(dist(u, e) > 380 + e.r * 0.5) continue;
            pullToward(e, u.x, u.y, 170);
            applyDamage(e, 140 + 100*rk, u);
            applyStun(e, 1.2 + 0.3*rk);
          }
          ring(u.x, u.y, 380, '#4f46e5'); ring(u.x, u.y, 200, '#818cf8');
          burst(u.x, u.y, '#4f46e5', 36, 320, 7);
          return true;
        }},
    ],
  },
  {
    id:'nosorog', name:'Rogo', emoji:'🦏',
    role:'💥 Nosorog — nezaustavljivi jurišnik',
    hp:720, mp:220, dmg:64,
    attrs:{ str:27, agi:15, int:11, strG:5.8, agiG:2.0, intG:1.5, primary:'str' },
    range:86, speed:166, atkCd:1.15, projSpeed:0,
    passive:{ name:'Debeli oklop', emoji:'🛡️', color:'#fde68a', pid:'tvrd',
      desc:'PASIVNO: debela koža skida dio štete sa svakog udarca',
      tip:rk => '🛡️ −' + (4 + 4*rk) + ' štete na svaki udarac' },
    abilities:[
      { key:'Q', name:'Juriš', emoji:'🏃', cd:13, mana:60, color:'#fbbf24',
        desc:'Jurni ravno naprijed — prvi neprijatelj kojeg zakačiš odleti i omami se',
        target:'point', castRange:900, line:true,
        tip:rk => '🏃 juriš do 900 • ⚔️ ' + (70 + 50*rk) + ' štete + omama ' + (1.2 + 0.3*rk).toFixed(1) + ' s',
        bot:{type:'gap', range:900},
        cast(u, aim, rk){
          startCharge(u, aim, {range:900, speed:680, dmg:70 + 50*rk, stun:1.2 + 0.3*rk});
          return true;
        }},
      { key:'W', name:'Udarac rogom', emoji:'🦏', cd:8, mana:40, color:'#f59e0b',
        desc:'Zamahni rogom — neprijatelji oko tebe odlete unatrag',
        selfAoe:180,
        tip:rk => '⚔️ ' + (60 + 40*rk) + ' štete + odbačaj ' + (150 + 20*rk),
        bot:{type:'aoe-self', range:180},
        cast(u, aim, rk){
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(dist(u, e) > 180 + e.r * 0.5) continue;
            applyDamage(e, 60 + 40*rk, u);
            knockback(e, u.x, u.y, 150 + 20*rk);
          }
          ring(u.x, u.y, 180, '#f59e0b');
          burst(u.x, u.y, '#c9b48c', 16, 220, 5);
          return true;
        }},
      { key:'E', name:'Izazov', emoji:'📢', cd:15, mana:70, color:'#f97316',
        desc:'Izazovi neprijatelje oko sebe — moraju napadati samo tebe, a ti dobiješ štit',
        selfAoe:280,
        tip:rk => '📢 moraju te napadati ' + (1.6 + 0.3*rk).toFixed(1) + ' s • 🛡️ štit 30%',
        bot:{type:'aoe-self', range:260},
        cast(u, aim, rk){
          const d = 1.6 + 0.3*rk;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || isStructure(e)) continue;
            if(dist(u, e) > 280 + e.r * 0.5) continue;
            applyTaunt(e, u, d);
          }
          applyShield(u, 0.3, d + 1);
          ring(u.x, u.y, 280, '#f97316');
          burst(u.x, u.y, '#fb923c', 20, 220, 6);
          return true;
        }},
      { key:'R', name:'Bijes', emoji:'😡', cd:70, mana:110, ult:true, color:'#ef4444',
        desc:'ULTI: Pobjesni — napadaš brže, a svaki udarac kratko omami',
        tip:rk => '😡 ' + (7 + rk) + ' s: +40% brzine napada, omama ' + (0.3 + 0.1*rk).toFixed(1) + ' s po udarcu',
        bot:{type:'ult-aoe', range:300},
        cast(u, aim, rk){
          u.status.rageT = 7 + rk; u.status.rageStun = 0.3 + 0.1*rk;
          burst(u.x, u.y, '#ef4444', 26, 260, 6);
          return true;
        }},
    ],
  },
  {
    id:'panda', name:'Bambus', emoji:'🐼',
    role:'🎋 Panda — mirni majstor',
    hp:640, mp:300, dmg:56,
    attrs:{ str:23, agi:15, int:21, strG:4.8, agiG:2.0, intG:4.2, primary:'str' },
    range:88, speed:168, atkCd:1.1, projSpeed:0,
    passive:{ name:'Bambus', emoji:'🎋', color:'#86efac', pid:'bambus',
      desc:'PASIVNO: žvakanje bambusa stalno obnavlja život i manu',
      tip:rk => '💚 +' + (1.5 + rk) + ' života/s • 💧 +' + (0.5 + 0.5*rk) + ' mane/s' },
    abilities:[
      { key:'Q', name:'Grom-pljesak', emoji:'👏', cd:10, mana:50, color:'#fde68a',
        desc:'Pljesni šapama — grom zatrese sve oko tebe i uspori ih',
        selfAoe:260,
        tip:rk => '⚔️ ' + (60 + 45*rk) + ' štete + 🐌 usporenje 35% 3 s',
        bot:{type:'aoe-self', range:260},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 260, 60 + 45*rk, {slow:{f:0.35, t:3}, color:'#fde68a'});
          burst(u.x, u.y, '#fde68a', 20, 240, 6);
          return true;
        }},
      { key:'W', name:'Vrtoglavica', emoji:'💫', cd:12, mana:55, color:'#f9a8d4',
        desc:'Zavrti neprijatelje na mjestu — vrti im se u glavi pa promašuju',
        target:'point', castRange:550, aoe:220,
        tip:rk => '⚔️ ' + (30 + 20*rk) + ' štete + 😵 promašuju ' + Math.round((0.3 + 0.1*rk) * 100) + '% 4 s',
        bot:{type:'zone', range:500},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 550);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 220 + e.r * 0.5) continue;
            applyDamage(e, 30 + 20*rk, u);
            applyBlind(e, 0.3 + 0.1*rk, 4);
          }
          ring(p.x, p.y, 220, '#f9a8d4');
          burst(p.x, p.y, '#f9a8d4', 14, 180, 5);
          return true;
        }},
      { key:'E', name:'Pijani korak', emoji:'🥴', cd:16, mana:50, color:'#86efac',
        desc:'Teturaj kao pijani majstor kung-fua — neprijateljski udarci te često promaše',
        tip:rk => '🍃 ' + (25 + 10*rk) + '% šanse da izbjegneš udarac, ' + (4 + rk) + ' s',
        bot:{type:'shield', range:400},
        cast(u, aim, rk){
          applyDodge(u, 0.25 + 0.1*rk, 4 + rk);
          addFloat(u.x, u.y - 30, '🥴 Hik!', '#bbf7d0', 15);
          burst(u.x, u.y, '#86efac', 14, 160, 5);
          return true;
        }},
      { key:'R', name:'Tri pande', emoji:'🐼', cd:85, mana:140, ult:true, color:'#f59e0b',
        desc:'ULTI: Pozovi tri male pande koje se bore uz tebe, a ti dobivaš štit',
        tip:rk => '🐼 3 pande (' + (300 + 150*rk) + ' života, ' + (25 + 15*rk) + ' štete) ' + (12 + 3*rk) + ' s • 🛡️ štit 40% 6 s',
        bot:{type:'ult-aoe', range:450},
        cast(u, aim, rk){
          const names = ['Zemlja', 'Oluja', 'Vatra'];
          for(let i = 0; i < 3; i++){
            const a = i / 3 * TAU + 0.4;
            makeSummon(u, { x:u.x + Math.cos(a) * 60, y:u.y + Math.sin(a) * 60,
              hp:300 + 150*rk, dmg:25 + 15*rk, life:12 + 3*rk, model:'hero_panda', emoji:'🐼', name:'Panda ' + names[i] });
          }
          applyShield(u, 0.4, 6);
          burst(u.x, u.y, '#f59e0b', 24, 260, 6);
          return true;
        }},
    ],
  },
  // ---- v0.15 ----
  {
    id:'jednorog', name:'Duga', emoji:'🦄',
    role:'🌈 Jednorog — čarobna pomagačica',
    hp:520, mp:400, dmg:44,
    attrs:{ str:17, agi:15, int:26, strG:3.2, agiG:2.0, intG:5.6, primary:'int' },
    range:340, speed:170, atkCd:1.1, projSpeed:640, shot:'rainbow',
    passive:{ name:'Čarobna griva', emoji:'✨', color:'#c4b5fd', pid:'griva',
      desc:'PASIVNO: svi prijatelji oko tebe brže obnavljaju manu',
      tip:rk => '💧 +' + (0.5 + 0.75*rk).toFixed(2) + ' mane/s prijateljima u krugu 450' },
    abilities:[
      { key:'Q', name:'Dugin snop', emoji:'🌈', cd:8, mana:60, color:'#f0abfc',
        desc:'Ispali dugu koja prolazi kroz sve neprijatelje na putu i uspori ih',
        target:'point', castRange:750, line:true,
        tip:rk => '⚔️ ' + (70 + 45*rk) + ' štete svima na putu + 🐌 usporenje',
        bot:{type:'shot', range:700},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:820, r:30, range:750, pierce:true,
            dmg:70 + 45*rk, color:'#f0abfc', emoji:'🌈', slow:{f:0.3, t:2}});
        }},
      { key:'W', name:'Ljekoviti rog', emoji:'💖', cd:14, mana:80, color:'#f9a8d4',
        desc:'Rog zasja i izliječi tebe i sve prijatelje oko tebe',
        selfAoe:380,
        tip:rk => '💖 +' + (90 + 55*rk) + ' života tebi i prijateljima oko tebe',
        bot:{type:'heal'},
        cast(u, aim, rk){
          for(const e of units){
            if(e.team !== u.team || e.dead || e.removeMe || isStructure(e) || dist(u, e) > 380) continue;
            if(e.kind !== 'hero' && !e.summonOf && e.kind !== 'creep') continue;
            heal(e, (90 + 55*rk) * (e.kind === 'hero' ? 1 : 0.5));
            if(e.kind === 'hero') addFloat(e.x, e.y - 20, '💖', '#f9a8d4', 18);
          }
          ring(u.x, u.y, 380, '#f9a8d4');
          burst(u.x, u.y, '#f9a8d4', 22, 220, 6);
          return true;
        }},
      { key:'E', name:'Dugin most', emoji:'🌉', cd:16, mana:60, color:'#f0abfc',
        desc:'Prošeći po dugi do novog mjesta — ti i prijatelji uz dugu dobijete brzinu',
        target:'point', castRange:550, line:true,
        tip:rk => '🌈 skok do 550 + 🏃 +' + (20 + 8*rk) + '% brzine tebi i prijateljima uz dugu 3 s',
        bot:{type:'escape', range:500},
        cast(u, aim, rk){
          const fx = u.x, fy = u.y;
          leapTo(u, aim, 550);
          for(const e of units){
            if(e.kind !== 'hero' || e.team !== u.team || e.dead) continue;
            if(e === u || distToSeg(e.x, e.y, fx, fy, u.x, u.y) <= 150) applyHaste(e, 1.2 + 0.08*rk, 3);
          }
          addLine(fx, fy, u.x, u.y, '#f0abfc', 14, 0.8);
          return true;
        }},
      { key:'R', name:'Zvjezdani galop', emoji:'🌠', cd:80, mana:150, ult:true, color:'#fde047',
        desc:'ULTI: Zvjezdani udar omami neprijatelje oko tebe, a cijeli tim ubrza i dobije štit',
        selfAoe:420,
        tip:rk => '⚔️ ' + (100 + 60*rk) + ' štete + 💫 omama ' + (1 + 0.25*rk).toFixed(2) + ' s • tim: 🏃 brzina i 🛡️ štit 5 s',
        bot:{type:'ult-aoe', range:380},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 420, 100 + 60*rk, {stun:1 + 0.25*rk, color:'#fde047'});
          for(const e of units){
            if(e.kind !== 'hero' || e.team !== u.team || e.dead) continue;
            applyHaste(e, 1.4, 5); applyShield(e, 0.35, 5);
            addFloat(e.x, e.y - 20, '🌠', '#fde047', 18);
          }
          burst(u.x, u.y, '#fde047', 30, 320, 7);
          return true;
        }},
    ],
  },
  {
    id:'morskipas', name:'Zubo', emoji:'🦈',
    role:'🦷 Morski pas — gladni lovac',
    hp:600, mp:260, dmg:60,
    attrs:{ str:20, agi:24, int:12, strG:3.8, agiG:5.8, intG:1.8, primary:'agi' },
    range:90, speed:178, atkCd:1.0, projSpeed:0,
    passive:{ name:'Miris krvi', emoji:'🩸', color:'#f87171', pid:'krv',
      desc:'PASIVNO: jače udaraš ranjene neprijatelje (ispod pola života)',
      tip:rk => '⚔️ +' + (12 + 12*rk) + '% štete po ranjenima' },
    abilities:[
      { key:'Q', name:'Ugriz', emoji:'🦷', cd:7, mana:45, color:'#ef4444',
        desc:'Snažno ugrizi neprijatelje ispred sebe — krvare još nekoliko sekundi',
        target:'point', castRange:230, aoe:140,
        tip:rk => '⚔️ ' + (70 + 45*rk) + ' štete + 🩸 ' + (15 + 10*rk) + '/s krvarenja 4 s',
        bot:{type:'zone', range:200},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 230);
          u.dir = Math.atan2(p.y - u.y, p.x - u.x);
          let n = 0;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 140 + e.r * 0.5) continue;
            applyDamage(e, 70 + 45*rk, u);
            applyPoison(e, 15 + 10*rk, 4, u, '🩸 Krvari!');
            n++;
          }
          burst(p.x, p.y, '#ef4444', 14, 160, 5);
          if(n) addFloat(p.x, p.y, '🦷 Ham!', '#fca5a5', 16);
          return true;
        }},
      { key:'W', name:'Skok iz vode', emoji:'🌊', cd:11, mana:55, color:'#38bdf8',
        desc:'Skoči kao iz valova i zapljusni sve oko mjesta gdje padneš',
        target:'point', castRange:420, aoe:170,
        tip:rk => '⚔️ ' + (50 + 35*rk) + ' štete gdje padneš + 🐌 usporenje 40% 2 s',
        bot:{type:'gap', range:420},
        cast(u, aim, rk){
          leapTo(u, aim, 420);
          damageCircle(u, u.x, u.y, 170, 50 + 35*rk, {slow:{f:0.4, t:2}, color:'#38bdf8'});
          burst(u.x, u.y, '#7dd3fc', 22, 220, 6);
          return true;
        }},
      { key:'E', name:'Krvavi vrtlog', emoji:'🌀', cd:9, mana:50, color:'#dc2626',
        desc:'Zavrti se kao vrtlog zubi — sve oko tebe krvari',
        selfAoe:220,
        tip:rk => '⚔️ ' + (45 + 30*rk) + ' štete + 🩸 ' + (10 + 8*rk) + '/s krvarenja 3 s',
        bot:{type:'aoe-self', range:220},
        cast(u, aim, rk){
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(dist(u, e) > 220 + e.r * 0.5) continue;
            applyDamage(e, 45 + 30*rk, u); applyDot(e, 10 + 8*rk, 3, u);
          }
          ring(u.x, u.y, 220, '#dc2626');
          burst(u.x, u.y, '#ef4444', 20, 220, 6);
          return true;
        }},
      { key:'R', name:'Pomama', emoji:'😤', cd:70, mana:110, ult:true, color:'#dc2626',
        desc:'ULTI: Pobjesni! Napadaš puno brže, brže trčiš i svaki ugriz te liječi',
        tip:rk => '⚡ +40% brzine napada, 🏃 brzina, 💖 ' + (20 + 10*rk) + '% štete u život • ' + (6 + 1*rk) + ' s',
        bot:{type:'ult-aoe', range:300},
        cast(u, aim, rk){
          const d = 6 + rk;
          u.status.rageT = d; u.status.rageStun = 0.05;
          u.frenzyT = d; u.frenzyF = 0.2 + 0.1*rk;
          applyHaste(u, 1.25, d);
          burst(u.x, u.y, '#dc2626', 26, 260, 6);
          return true;
        }},
    ],
  },
];

/* ---------------- DUĆAN S RECEPTIMA ---------------- */

/* ================= PREDMETI (kao u DotA) =================
   OSNOVNI predmeti se kupuju izravno; NADOGRADNJE se slažu iz dijelova + recept (cost = cijena recepta).
   stats: dmg, hp, mp, speed, hpRegen, mpRegen, str/agi/int (atributi), all (+svi atributi), primary (+glavni atribut),
          aspd (brzina napada u %), armor (oklop), lifesteal (krađa života 0–1), evasion (izbjegavanje 0–1)
   pasivno: crit {c, m}, bash {c, cr (daljinski), t, dmg}, cleave, creepDmg, corrupt {a, t}, block {c, a},
            trueStrike, proc {c, dmg}, aura {armor, aspd, ls, mpRegen, r}, burn / burnR, wand
   Svaki predmet ima i "act" / "pas" (opis za tooltip) i "lore" (kratka priča). */
const ITEMS = [
  // ======================= OSNOVNI =======================
  // ----- 🧪 potrošno -----
  { id:'tango',  emoji:'🌿', name:'Tango', cat:'cons', cost:90, charges:3, consume:true, stats:{},
    act:'Pojedi list: 16 s polako vraćaš 115 života', lore:'Svježi listovi drveća — omiljena užina svakog junaka.',
    active:{ cd:1, mana:0, use(h){ h.tangoT = 16; useCharge(h, 'tango'); burst(h.x, h.y, '#86efac', 10, 120, 4); return true; } } },
  { id:'potion', emoji:'🧪', name:'Ljekoviti melem', cat:'cons', cost:120, instant:true, heal:320, stats:{},
    act:'Odmah vrati 320 života (ne zauzima torbu)', lore:'Gorko je, ali radi!' },
  { id:'clarity', emoji:'💧', name:'Bistrina', cat:'cons', cost:60, charges:1, consume:true, stats:{},
    act:'Popij: 20 s polako vraćaš 150 mane — prekida je udarac neprijateljskog junaka', lore:'Kristalno čista voda iz planinskog izvora.',
    active:{ cd:1, mana:0, use(h){ h.clarityT = 20; useCharge(h, 'clarity'); burst(h.x, h.y, '#7dd3fc', 10, 120, 4); return true; } } },
  { id:'dust',   emoji:'🌫️', name:'Prašina otkrivanja', cat:'cons', cost:90, charges:2, consume:true, stats:{},
    act:'Otkrij nevidljive neprijatelje oko sebe (650) na 8 s', lore:'Puhni i sve se vidi!',
    active:{ cd:8, mana:0,
      use(h){
        let n = 0;
        for(const e of units){
          if(e.kind !== 'hero' || e.team === h.team || e.dead || dist(h, e) > 650) continue;
          if(e.status.invisT > 0){ addFloat(e.x, e.y, '👀 Otkriven!', '#fde047', 14); n++; }
          e.status.invisT = 0; e.noInvisT = 8;
        }
        useCharge(h, 'dust');
        ring(h.x, h.y, 650, '#e5e7eb'); burst(h.x, h.y, '#e5e7eb', 20, 240, 5);
        if(n === 0 && isHuman(h)) addFloat(h.x, h.y, '🌫️ Nikoga skrivenog…', '#e5e7eb', 13);
        return true;
      } } },
  { id:'eye',    emoji:'👁️', name:'Oko promatrač', cat:'cons', cost:150, charges:2, consume:true, stats:{},
    act:'Postavi oko koje 2 min gleda kroz maglu rata (domet 500)', lore:'Nikad ne trepće.',
    active:{ cd:2, mana:0, target:'point', castRange:500,
      use(h, aim){
        const p = clampRange(h, aim, 500);
        wards.push({ x:p.x, y:p.y, r:400, team:h.team, t:120, owner:h });
        useCharge(h, 'eye');
        ring(p.x, p.y, 400, '#c4b5fd');
        return true;
      } } },
  { id:'bottle', emoji:'🍼', name:'Boca', cat:'cons', cost:340, charges:3, stats:{},
    act:'Gutljaj: +130 života i +70 mane (3 gutljaja, puni se kod fontane)', lore:'Nikad je ne zaboravi napuniti!',
    active:{ cd:3, mana:0,
      use(h){
        if(itemCharges(h, 'bottle') <= 0){ if(isHuman(h)) addFloat(h.x, h.y, '🍼 Boca je prazna — napuni je kod fontane!', '#e5e7eb', 13); return false; }
        useCharge(h, 'bottle'); heal(h, 130); h.mp = Math.min(h.maxmp, h.mp + 70);
        return true;
      } } },
  { id:'cheese', emoji:'🧀', name:'Zmajev sir', cat:'cons', cost:500, noShop:true, charges:1, consume:true, stats:{},
    act:'Odmah +1500 života i +800 mane', lore:'Dar Velikog Zmaja.',
    active:{ cd:1, mana:0, use(h){ heal(h, 1500); h.mp = Math.min(h.maxmp, h.mp + 800); useCharge(h, 'cheese'); burst(h.x, h.y, '#fde047', 26, 240, 6); return true; } } },
  // ----- 💪 atributi -----
  { id:'branch',    emoji:'🌱', name:'Grančica',          cat:'attr', cost:25,  stats:{all:1}, lore:'Mala, ali korisna. Svaki junak kupi par na početku.' },
  { id:'gauntlets', emoji:'🧤', name:'Rukavice snage',    cat:'attr', cost:70,  stats:{str:3}, lore:'Teške kožne rukavice za jake šape.' },
  { id:'slippers',  emoji:'🥿', name:'Papuče okretnosti', cat:'attr', cost:70,  stats:{agi:3}, lore:'U njima se trči na prstima.' },
  { id:'mantle',    emoji:'🧣', name:'Šal mudrosti',      cat:'attr', cost:70,  stats:{int:3}, lore:'Grije glavu dok razmišljaš.' },
  { id:'circlet',   emoji:'📿', name:'Ogrlica',           cat:'attr', cost:80,  stats:{all:2}, lore:'Sitne perle, mala čarolija.' },
  { id:'belt',      emoji:'🎗️', name:'Pojas snage',       cat:'attr', cost:225, stats:{str:6}, lore:'Steže trbuh i jača mišiće.' },
  { id:'band',      emoji:'🎀', name:'Vilinska vrpca',    cat:'attr', cost:225, stats:{agi:6}, lore:'Vile je pletu od paukove svile.' },
  { id:'robe',      emoji:'👘', name:'Halja čarobnjaka',  cat:'attr', cost:225, stats:{int:6}, lore:'Puna zvjezdica i tajnih džepova.' },
  { id:'ogre',      emoji:'👹', name:'Divovska sjekira',  cat:'attr', cost:500, stats:{str:10}, lore:'Div ju je zaboravio pod mostom.' },
  { id:'alacrity',  emoji:'🍃', name:'Oštrica hitrine',   cat:'attr', cost:500, stats:{agi:10}, lore:'Laka kao list na vjetru.' },
  { id:'wizstaff',  emoji:'🔮', name:'Štap čarobnjaka',   cat:'attr', cost:500, stats:{int:10}, lore:'Kugla na vrhu šapuće čarolije.' },
  // ----- ⚔️ oprema -----
  { id:'quelling',  emoji:'⛏️', name:'Sjekirica',         cat:'equip', cost:50,  stats:{}, creepDmg:12, pas:'+12 štete protiv vojnika i čudovišta', lore:'Za drva — i za vojnike.' },
  { id:'sword',     emoji:'⚔️', name:'Oštrice napada',    cat:'equip', cost:225, stats:{dmg:9},  lore:'Par malih, oštrih noževa.' },
  { id:'broadsword',emoji:'🗡️', name:'Široki mač',        cat:'equip', cost:500, stats:{dmg:15}, lore:'Vitezov vjerni drug.' },
  { id:'claymore',  emoji:'🔪', name:'Dvoručni mač',      cat:'equip', cost:675, stats:{dmg:20}, lore:'Treba ga držati objema rukama.' },
  { id:'mithril',   emoji:'⚒️', name:'Mitrilni čekić',    cat:'equip', cost:800, stats:{dmg:24}, lore:'Patuljci ga kuju tisuću godina.' },
  { id:'demonedge', emoji:'😈', name:'Demonska oštrica',  cat:'equip', cost:1100, stats:{dmg:40}, lore:'Reže i sjene.' },
  { id:'gloves',    emoji:'🥊', name:'Rukavice brzine',   cat:'equip', cost:225, stats:{aspd:20}, lore:'Udaraš brže nego što trepćeš.' },
  { id:'ringprot',  emoji:'🔘', name:'Prsten zaštite',    cat:'equip', cost:90,  stats:{armor:2}, lore:'Mali štit za prst.' },
  { id:'chainmail', emoji:'⛓️', name:'Verižnjača',        cat:'equip', cost:275, stats:{armor:4}, lore:'Zvecka pri svakom koraku.' },
  { id:'platemail', emoji:'🛡️', name:'Oklop od ploča',    cat:'equip', cost:700, stats:{armor:10}, lore:'Težak, ali ništa ne prolazi.' },
  { id:'morbid',    emoji:'👺', name:'Vampirska maska',   cat:'equip', cost:450, stats:{lifesteal:0.10}, lore:'Svaki udarac te malo izliječi.' },
  { id:'hyperstone',emoji:'💎', name:'Hiperkamen',        cat:'equip', cost:1000, stats:{aspd:60}, lore:'Kamen koji ne može mirovati.' },
  // ----- 🎒 razno -----
  { id:'boots',     emoji:'👟', name:'Brze čizme',        cat:'misc', cost:250, stats:{speed:45}, tag:'boots', lore:'Prve čizme svakog junaka.' },
  { id:'ringregen', emoji:'💚', name:'Prsten obnove',     cat:'misc', cost:90,  stats:{hpRegen:2}, lore:'Rane zacjeljuju same.' },
  { id:'sage',      emoji:'🍵', name:'Mudračev čaj',      cat:'misc', cost:90,  stats:{mpRegen:1}, lore:'Gutljaj čaja, i mana se vraća.' },
  { id:'heart',     emoji:'❤️', name:'Kamen života',      cat:'misc', cost:500, stats:{hp:250}, lore:'Kuca kao pravo srce.' },
  { id:'orb',       emoji:'🔋', name:'Kamen energije',    cat:'misc', cost:400, stats:{mp:250}, lore:'Pun čarobne struje.' },
  { id:'pointbooster', emoji:'✨', name:'Zvjezdani kristal', cat:'misc', cost:600, stats:{hp:175, mp:175}, lore:'Pola život, pola mana.' },
  { id:'blink',     emoji:'⚡', name:'Bodež treptaja',    cat:'misc', cost:1125, stats:{},
    act:'Treptaj: skoči do 1000 daleko • ne radi 3 s nakon udarca neprijateljskog junaka', lore:'Trepneš — i već si tamo.',
    active:{ cd:13, mana:0, target:'point', castRange:1000,
      use(h, aim){
        if(gameTime - (h.lastHitT || -99) < 3){ if(isHuman(h)) addFloat(h.x, h.y, '⚡ Bodež je zaključan — netko te udara!', '#fca5a5', 13); return false; }
        leapTo(h, aim, 1000); burst(h.x, h.y, '#bae6fd', 16, 200, 5); return true;
      } } },
  // ----- 🔆 rijetko (kao tajna trgovina) -----
  { id:'reaver',    emoji:'☠️', name:'Kosac',             cat:'secret', cost:1400, stats:{str:25}, lore:'Golema kosa iz Tajne trgovine.' },
  { id:'eaglesong', emoji:'🦅', name:'Orlova pjesma',     cat:'secret', cost:1400, stats:{agi:25}, lore:'Pjesma koju samo orlovi znaju.' },
  { id:'mystic',    emoji:'🌟', name:'Mistični štap',     cat:'secret', cost:1400, stats:{int:25}, lore:'U njemu spava cijela galaksija.' },
  { id:'relic',     emoji:'🔆', name:'Sveta relikvija',   cat:'secret', cost:1700, stats:{dmg:60}, lore:'Drevno blago čuvara hrama.' },

  // ======================= NADOGRADNJE =======================
  // ----- 🎒 pribor -----
  { id:'wand', emoji:'🎇', name:'Čarobni štapić', cat:'acc', cost:175, components:['branch', 'branch'], stats:{all:3}, wand:true,
    pas:'Skuplja naboj (do 20) kad neprijateljski junak u blizini baci magiju',
    act:'Isprazni: +15 života i +15 mane po naboju', lore:'Svaka tuđa čarolija ga napuni.',
    active:{ cd:13, mana:0,
      use(h){
        const n = itemCharges(h, 'wand');
        if(n <= 0){ if(isHuman(h)) addFloat(h.x, h.y, '🎇 Štapić je prazan', '#e5e7eb', 13); return false; }
        heal(h, 15 * n); h.mp = Math.min(h.maxmp, h.mp + 15 * n); h.itemCharges.wand = 0;
        burst(h.x, h.y, '#c4b5fd', 14, 160, 5); return true;
      } } },
  { id:'bracer',  emoji:'💪', name:'Narukvica snage',  cat:'acc', cost:105, components:['circlet', 'gauntlets'], stats:{str:5, agi:2, int:2, dmg:3, hpRegen:1}, lore:'Za junake koji vole biti naprijed.' },
  { id:'wraith',  emoji:'👻', name:'Sablasna vrpca',   cat:'acc', cost:105, components:['circlet', 'slippers'],  stats:{agi:5, str:2, int:2, armor:1.5, aspd:5}, lore:'Lagana kao duh.' },
  { id:'nulltal', emoji:'🔵', name:'Talisman mudrosti',cat:'acc', cost:105, components:['circlet', 'mantle'],    stats:{int:5, str:2, agi:2, mpRegen:1}, lore:'Plavi kamen pun mira.' },
  { id:'phase',   emoji:'🥾', name:'Fazne čizme', cat:'acc', cost:0, components:['boots', 'chainmail', 'sword'], tag:'boots', stats:{speed:45, armor:4, dmg:12},
    act:'Faza: +25% brzine kretanja na 3 s', lore:'Kroz neprijatelje kao kroz maglu.',
    active:{ cd:8, mana:0, use(h){ applyHaste(h, 1.25, 3); burst(h.x, h.y, '#93c5fd', 10, 140, 4); return true; } } },
  { id:'treads',  emoji:'👢', name:'Čizme moći', cat:'acc', cost:0, components:['boots', 'gloves', 'belt'], tag:'boots', stats:{speed:45, aspd:25, primary:10},
    pas:'+10 glavnom atributu junaka', lore:'Svaki korak te čini jačim.' },
  { id:'arcane',  emoji:'💠', name:'Tajanstvene čizme', cat:'acc', cost:0, components:['boots', 'orb'], tag:'boots', stats:{speed:45, mp:250},
    act:'Val mane: ti i saveznici u krugu 1200 dobivate 160 mane', lore:'Mana teče iz potplata.',
    active:{ cd:55, mana:0,
      use(h){
        for(const e of units) if(e.kind === 'hero' && e.team === h.team && !e.dead && dist(h, e) <= 1200){ e.mp = Math.min(e.maxmp, e.mp + 160); addFloat(e.x, e.y, '+160 💧', '#7dd3fc', 13); }
        ring(h.x, h.y, 1200, '#7dd3fc'); burst(h.x, h.y, '#7dd3fc', 20, 220, 5); return true;
      } } },
  { id:'midas',   emoji:'✋', name:'Midasova ruka', cat:'acc', cost:875, components:['gloves'], stats:{aspd:40},
    act:'Zlatni dodir: pretvori vojnika ili čudovište (ne zmaja) u zlato — +90 zlata i puno iskustva (domet 600)', lore:'Sve što dotakne postane zlato.',
    active:{ cd:90, mana:0, target:'point', castRange:600,
      use(h, aim){
        let best = null, bd = 220;
        for(const e of units){
          if(e.dead || e.removeMe || e.team === h.team || e.boss || (e.kind !== 'creep' && e.kind !== 'neutral') || dist(h, e) > 650) continue;
          const d = distXY(aim.x, aim.y, e.x, e.y); if(d < bd){ bd = d; best = e; }
        }
        if(!best){ if(isHuman(h)) addFloat(h.x, h.y, '✋ Nema vojnika za zlatni dodir', '#e5e7eb', 13); return false; }
        const xp = (best.xpValue || CFG.creepXp) * 1.5;
        burst(best.x, best.y, '#fde047', 24, 200, 6);
        kill(best, h);
        h.gold += 90; giveXp(h, xp);
        if(isHuman(h)) addFloat(best.x, best.y, '✋ +90 💰', '#fde047', 16);
        return true;
      } } },
  { id:'soulring',emoji:'💍', name:'Prsten duše', cat:'acc', cost:125, components:['ringregen', 'gauntlets', 'gauntlets'], stats:{str:6, hpRegen:2},
    act:'Žrtva: daj 170 života i dobij 150 mane', lore:'Malo boli, ali mana je tu!',
    active:{ cd:25, mana:0,
      use(h){ h.hp = Math.max(1, h.hp - 170); h.mp = Math.min(h.maxmp, h.mp + 150); addFloat(h.x, h.y, '💍 +150 💧', '#c4b5fd', 14); burst(h.x, h.y, '#a855f7', 12, 140, 4); return true; } } },
  { id:'mom',     emoji:'🎭', name:'Maska ludila', cat:'acc', cost:0, components:['morbid', 'gloves'], stats:{dmg:10, aspd:20, lifesteal:0.15},
    act:'Bijes: 6 s +100% brzine napada i +20% kretanja, ali primaš +25% štete', lore:'Kad je staviš, ne možeš prestati udarati.',
    active:{ cd:16, mana:25,
      use(h){ applyAtkSpeed(h, 1.0, 6); applyHaste(h, 1.2, 6); applyCurse(h, 0.25, 6); burst(h.x, h.y, '#ef4444', 14, 160, 5); addFloat(h.x, h.y, '🎭 Bijes!', '#fca5a5', 15); return true; } } },
  // ----- 🤝 podrška -----
  { id:'mek',  emoji:'🏅', name:'Ljekoviti medaljon', cat:'sup', cost:450, components:['ringregen', 'chainmail'], stats:{armor:4, hpRegen:3},
    act:'Izliječi sebe i saveznike u krugu 1200 za 275 života', lore:'Zlatni medaljon starog iscjelitelja.',
    active:{ cd:50, mana:100,
      use(h){
        for(const e of units) if(e.team === h.team && !e.dead && !e.removeMe && (e.kind === 'hero' || e.kind === 'creep') && dist(h, e) <= 1200) heal(e, 275);
        ring(h.x, h.y, 1200, '#4ade80'); burst(h.x, h.y, '#4ade80', 24, 240, 6); return true;
      } } },
  { id:'drum', emoji:'🥁', name:'Bubanj izdržljivosti', cat:'sup', cost:325, components:['circlet', 'belt'], stats:{str:8, agi:2, int:2, speed:10},
    act:'Ratni bubanj: ti i saveznici u krugu 1200 dobivate +25% brzine kretanja i +30% brzine napada na 6 s', lore:'Bum! Bum! Svi trče brže!',
    active:{ cd:30, mana:0,
      use(h){
        for(const e of units) if(e.kind === 'hero' && e.team === h.team && !e.dead && dist(h, e) <= 1200){ applyHaste(e, 1.25, 6); applyAtkSpeed(e, 0.3, 6); }
        ring(h.x, h.y, 1200, '#fb923c'); burst(h.x, h.y, '#fb923c', 18, 220, 5); return true;
      } } },
  { id:'vlad', emoji:'🩸', name:'Vladimirov dar', cat:'sup', cost:175, components:['morbid', 'ringprot', 'sage'], stats:{armor:2, mpRegen:1},
    aura:{ ls:0.15, armor:3, mpRegen:1, r:900 }, pas:'Aura (900): saveznički junaci kradu 15% života udarcima, +3 oklopa, +1 obnova mane', lore:'Stari knez dijeli snagu sa svojom vojskom.' },
  // ----- 🔮 čarolije -----
  { id:'force', emoji:'🌬️', name:'Štap sile', cat:'magic', cost:450, components:['wizstaff', 'ringregen'], stats:{int:10, hpRegen:2.5},
    act:'Silovit vjetar: odgurne te 600 u smjeru klika', lore:'Vjetar u leđa — doslovno.',
    active:{ cd:19, mana:50, target:'point', castRange:600,
      use(h, aim){
        const a = Math.atan2(aim.y - h.y, aim.x - h.x);
        leapTo(h, { x: h.x + Math.cos(a) * 600, y: h.y + Math.sin(a) * 600 }, 600);
        burst(h.x, h.y, '#bae6fd', 14, 180, 5); return true;
      } } },
  { id:'euls', emoji:'🌪️', name:'Vjetrovita palica', cat:'magic', cost:375, components:['wizstaff', 'sage'], stats:{int:10, mpRegen:2.5, speed:20},
    act:'Vihor: podigne neprijatelja u zrak na 2.5 s (ne može ništa, ali ni primati štetu) • klik na sebe = očisti usporenja i otrove (domet 575)', lore:'Mali tornado u boci.',
    active:{ cd:23, mana:75, target:'point', castRange:575,
      use(h, aim){
        if(distXY(aim.x, aim.y, h.x, h.y) < 90){   // na sebe: očisti loše stanje
          const st = h.status; st.slowT = 0; st.poisonT = 0; st.curseT = 0; st.blindT = 0; st.silenceT = 0; st.rootT = 0;
          h.cycloneT = 2.5; h.status.stun = Math.max(h.status.stun, 2.5);
          burst(h.x, h.y, '#e0f2fe', 16, 180, 5); return true;
        }
        let best = null, bd = 220;
        for(const e of units){
          if(e.dead || e.removeMe || e.team === h.team || !isSpellTarget(e) || e.status.immuneT > 0 || dist(h, e) > 640) continue;
          const d = distXY(aim.x, aim.y, e.x, e.y); if(d < bd){ bd = d; best = e; }
        }
        if(!best) return false;
        best.cycloneT = 2.5; applyStun(best, 2.5);
        if(best.kind === 'hero') addFloat(best.x, best.y, '🌪️ U zraku!', '#e0f2fe', 15);
        burst(best.x, best.y, '#e0f2fe', 16, 180, 5); return true;
      } } },
  { id:'dagon', emoji:'🔱', name:'Dagon', cat:'magic', cost:625, components:['wizstaff', 'nulltal'], stats:{int:15, str:2, agi:2, mpRegen:1},
    act:'Energetski udar: 400 štete neprijatelju kod klika (domet 700)', lore:'Zraka čiste energije — ZAP!',
    active:{ cd:35, mana:120, target:'point', castRange:700,
      use(h, aim){
        let best = null, bd = 240;
        for(const e of units){
          if(e.dead || e.removeMe || e.team === h.team || e.invuln || !isSpellTarget(e) || dist(h, e) > 760) continue;
          const d = distXY(aim.x, aim.y, e.x, e.y); if(d < bd){ bd = d; best = e; }
        }
        if(!best) return false;
        addLine(h.x, h.y, best.x, best.y, '#f87171', 7, 0.35);
        applyDamage(best, 400, h, true);
        burst(best.x, best.y, '#f87171', 16, 180, 6); sfxAt('zap', h.x, h.y); return true;
      } } },
  { id:'refresher', emoji:'🔄', name:'Kugla osvježenja', cat:'magic', cost:900, components:['pointbooster', 'ringregen', 'sage'], stats:{hp:175, mp:175, hpRegen:5, mpRegen:3},
    act:'Osvježi: sve tvoje moći su odmah spremne', lore:'Kao da počinješ ispočetka!',
    active:{ cd:180, mana:250,
      use(h){ for(const ab of h.abilities) ab.cd = 0; burst(h.x, h.y, '#a5f3fc', 24, 220, 6); addFloat(h.x, h.y, '🔄 Moći spremne!', '#a5f3fc', 15); return true; } } },
  { id:'shiva', emoji:'❄️', name:'Ledeni štit', cat:'magic', cost:325, components:['platemail', 'mystic'], stats:{armor:15, int:25},
    act:'Ledeni val (700): 200 štete i 40% usporenja na 4 s svim neprijateljima', lore:'Hladnoća sjevernih planina.',
    active:{ cd:30, mana:100,
      use(h){
        for(const e of units){
          if(e.team === h.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e) || dist(h, e) > 700) continue;
          applyDamage(e, 200, h, true); applySlow(e, 0.4, 4);
        }
        ring(h.x, h.y, 700, '#bae6fd'); burst(h.x, h.y, '#e0f2fe', 30, 320, 6); return true;
      } } },
  // ----- 🛡️ oklop -----
  { id:'vanguard', emoji:'🔰', name:'Avangarda', cat:'armor', cost:250, components:['heart', 'ringregen'], stats:{hp:250, hpRegen:5},
    block:{ c:0.6, a:40 }, pas:'60% šanse da blokira 40 štete od udarca', lore:'Prvi u boj, zadnji iz boja.' },
  { id:'bkb', emoji:'👑', name:'Kraljevski oklop', cat:'armor', cost:700, components:['ogre', 'mithril'], stats:{str:10, dmg:24},
    act:'Nepokolebljiv: 5 s ništa te ne može omamiti, usporiti ni ušutkati', lore:'Kralj ne pada na koljena.',
    active:{ cd:70, mana:0, use(h){ applyImmune(h, 5); burst(h.x, h.y, '#fde047', 20, 220, 6); return true; } } },
  { id:'assault', emoji:'🪖', name:'Napadački oklop', cat:'armor', cost:650, components:['platemail', 'hyperstone', 'chainmail'], stats:{armor:15, aspd:30},
    aura:{ armor:4, aspd:20, r:900 }, pas:'Aura (900): saveznici +4 oklopa i +20% brzine napada', lore:'Oklop generala koji vodi vojsku.' },
  { id:'titanheart', emoji:'🧡', name:'Srce titana', cat:'armor', cost:650, components:['reaver', 'heart'], stats:{str:45, hp:250, hpRegen:12},
    lore:'Kuca kao bubanj divova.' },
  // ----- ⚔️ oružje -----
  { id:'crystalys', emoji:'💥', name:'Kristalni nož', cat:'weapon', cost:250, components:['broadsword', 'sword'], stats:{dmg:32},
    crit:{ c:0.3, m:1.6 }, pas:'30% šanse za kritični udarac (160% štete)', lore:'Oštar kao led.' },
  { id:'daedalus', emoji:'🎯', name:'Dedalova oštrica', cat:'weapon', cost:500, components:['crystalys', 'demonedge'], stats:{dmg:88},
    crit:{ c:0.3, m:2.25 }, pas:'30% šanse za kritični udarac (225% štete)', lore:'Ne promašuje slabe točke.' },
  { id:'bfury', emoji:'🪓', name:'Bojna sjekira', cat:'weapon', cost:600, components:['broadsword', 'claymore', 'quelling', 'ringregen', 'sage'], stats:{dmg:50, hpRegen:5, mpRegen:2.5},
    cleave:0.5, creepDmg:15, pas:'Zamah (samo izbliza): 50% štete svima oko mete • +15 štete protiv vojnika', lore:'Jedan zamah — cijela skupina.' },
  { id:'deso', emoji:'🌘', name:'Oštrica pustoši', cat:'weapon', cost:150, components:['mithril', 'mithril'], stats:{dmg:50},
    corrupt:{ a:6, t:7 }, pas:'Udarac skida 6 oklopa meti na 7 s', lore:'Gdje udari, ostaje pustoš.' },
  { id:'basher', emoji:'🔨', name:'Lubanjolomac', cat:'weapon', cost:450, components:['mithril', 'belt'], stats:{dmg:25, str:6},
    bash:{ c:0.25, cr:0.1, t:1.4, dmg:80 }, pas:'Tresak: 25% šanse (daljinski 10%) da omami metu 1.4 s i doda 80 štete', lore:'BUM! Zvijezde oko glave.' },
  { id:'abyssal', emoji:'🌀', name:'Ponorna oštrica', cat:'weapon', cost:800, components:['basher', 'vanguard'], stats:{dmg:25, str:10, hp:250, hpRegen:6},
    bash:{ c:0.25, cr:0.1, t:1.4, dmg:80 }, block:{ c:0.6, a:50 },
    pas:'Tresak kao Lubanjolomac + 60% šanse da blokira 50 štete',
    act:'Ponor: omami neprijatelja ispred sebe na 2 s (domet 200)', lore:'Iz ponora nema bijega.',
    active:{ cd:35, mana:75, target:'point', castRange:200,
      use(h, aim){
        let best = null, bd = 260;
        for(const e of units){
          if(e.dead || e.removeMe || e.team === h.team || !isSpellTarget(e) || dist(h, e) > 260) continue;
          const d = distXY(aim.x, aim.y, e.x, e.y); if(d < bd){ bd = d; best = e; }
        }
        if(!best) return false;
        applyStun(best, 2); applyDamage(best, 100, h, true);
        burst(best.x, best.y, '#a78bfa', 16, 160, 6); return true;
      } } },
  { id:'mkb', emoji:'🐒', name:'Majmunova šipka', cat:'weapon', cost:325, components:['demonedge', 'gloves'], stats:{dmg:40, aspd:45},
    trueStrike:true, proc:{ c:0.7, dmg:70 }, pas:'Udarci nikad ne promašuju • 70% šanse za +70 čarobne štete', lore:'Majmun kralj nikad ne promaši.' },
  // ----- 💎 artefakti -----
  { id:'butterfly', emoji:'🦋', name:'Leptir', cat:'art', cost:450, components:['eaglesong', 'gloves'], stats:{agi:35, dmg:25, aspd:30, evasion:0.35},
    pas:'35% šanse da izbjegneš udarac', lore:'Lepršaš — i nitko te ne može pogoditi.' },
  { id:'shadowblade', emoji:'🌒', name:'Sjenovita oštrica', cat:'art', cost:400, components:['broadsword', 'gloves'], stats:{dmg:25, aspd:30},
    act:'Sjena: 14 s nevidljiv i brži 20%; prvi udarac iz sjene +175 štete', lore:'Sjena koja reže.',
    active:{ cd:28, mana:75,
      use(h){ h.status.invisT = Math.max(h.status.invisT, 14); h.sbBonus = 175; applyHaste(h, 1.2, 14); burst(h.x, h.y, '#6b7280', 16, 160, 5); return true; } } },
  { id:'satanic', emoji:'🦇', name:'Vampirski mač', cat:'art', cost:0, components:['morbid', 'claymore', 'reaver'], stats:{str:25, dmg:38, lifesteal:0.25},
    act:'Žeđ: 6 s udarci kradu još 150% života', lore:'Žedan je — uvijek.',
    active:{ cd:35, mana:0, use(h){ h.lsBoostT = 6; burst(h.x, h.y, '#dc2626', 18, 180, 5); addFloat(h.x, h.y, '🦇 Žeđ!', '#fca5a5', 15); return true; } } },
  { id:'sun', emoji:'☀️', name:'Sunčev kamen', cat:'art', cost:650, components:['relic'], stats:{dmg:65},
    burn:40, burnR:320, pas:'Žar: sve neprijatelje u krugu 320 peče 40 štete/s', lore:'Mali komadić Sunca.' },
];
const ITEM_BY_ID = {};
for(const it of ITEMS) ITEM_BY_ID[it.id] = it;

/* 🌰 NEUTRALNI PREDMETI — ponekad ispadnu iz čudovišta u džungli (posebno, okruglo mjesto u torbi).
   Što je igra dulja, to su bolji (3 razine); svaki tim može naći najviše 3 po razini. */
const NEUTRAL_ITEMS = [
  { id:'n_clover',  emoji:'🍀', name:'Djetelina sreće',   ntier:1, desc:'+8 štete, +8 brzine',              stats:{dmg:8, speed:8} },
  { id:'n_feather', emoji:'🪶', name:'Lako pero',         ntier:1, desc:'+25 brzine',                       stats:{speed:25} },
  { id:'n_amulet',  emoji:'🧿', name:'Plavi amulet',      ntier:1, desc:'+160 života, +1 obnova',           stats:{hp:160, hpRegen:1} },
  { id:'n_shell',   emoji:'🐚', name:'Morska školjka',    ntier:2, desc:'+250 života, +3 obnova',           stats:{hp:250, hpRegen:3} },
  { id:'n_fang',    emoji:'🦴', name:'Kost pradavnog vuka', ntier:2, desc:'+22 štete',                      stats:{dmg:22} },
  { id:'n_crystal', emoji:'🔷', name:'Kristal mudrosti',  ntier:2, desc:'+200 mane, +2.5 obnova mane',      stats:{mp:200, mpRegen:2.5} },
  { id:'n_star',    emoji:'🌟', name:'Zvjezdani prah',    ntier:3, desc:'+32 štete, +30 brzine',            stats:{dmg:32, speed:30} },
  { id:'n_dheart',  emoji:'💎', name:'Dijamantno srce',   ntier:3, desc:'+550 života, +5 obnova',           stats:{hp:550, hpRegen:5} },
  { id:'n_moon',    emoji:'🌙', name:'Mjesečev kamen',    ntier:3, desc:'+400 mane, +5 obnova mane, +12 štete', stats:{mp:400, mpRegen:5, dmg:12} },
];
for(const it of NEUTRAL_ITEMS){ it.neutral = true; it.noShop = true; it.cost = 0; it.q = 'neutral'; it.lore = it.desc; ITEM_BY_ID[it.id] = it; }
/* dućan kao u DotA: dvije kartice (OSNOVNI / NADOGRADNJE), u svakoj stupci po kategorijama */
const SHOP_TABS = [
  { id:'basic', label:'Osnovni', cats:['cons', 'attr', 'equip', 'misc', 'secret'] },
  { id:'up',    label:'Nadogradnje', cats:['acc', 'sup', 'magic', 'armor', 'weapon', 'art'] },
];
/* kategorija → naslov stupca i "kvaliteta" (boja okvira i pozadine ikone, kao u DotA) */
const ITEM_CAT_INFO = {
  cons:   { label:'Potrošno',  q:'cons' },
  attr:   { label:'Atributi',  q:'comp' },
  equip:  { label:'Oprema',    q:'comp' },
  misc:   { label:'Razno',     q:'comp' },
  secret: { label:'Rijetko',   q:'secret' },
  acc:    { label:'Pribor',    q:'common' },
  sup:    { label:'Podrška',   q:'common' },
  magic:  { label:'Čarolije',  q:'rare' },
  armor:  { label:'Oklop',     q:'rare' },
  weapon: { label:'Oružje',    q:'epic' },
  art:    { label:'Artefakti', q:'art' },
};
const ITEM_QUALITY = {   // [rub, svjetlija pozadina, tamnija pozadina]
  cons:   ['#cbb68a', '#5c513b', '#1d1a13'],
  comp:   ['#9aa4b1', '#3e4753', '#14181d'],
  secret: ['#5ee7f0', '#1d5560', '#0a1c21'],
  common: ['#3fcf6b', '#1f5232', '#0b1c11'],
  rare:   ['#4f8cff', '#21386e', '#0b1426'],
  epic:   ['#b86bff', '#45246b', '#170c26'],
  art:    ['#ff9b2f', '#6b3a12', '#241306'],
  neutral:['#7fd36b', '#2b4a22', '#0f1a0b'],
};
for(const it of ITEMS){
  it.q = ITEM_CAT_INFO[it.cat] ? ITEM_CAT_INFO[it.cat].q : 'comp';
  it.tab = it.components ? 'up' : 'basic';
}
/* u što se predmet ugrađuje (za "Ulazi u" u dućanu) */
for(const it of ITEMS) it.buildsInto = ITEMS.filter(o => o.components && o.components.includes(it.id)).map(o => o.id);

/* preporučeni predmeti po junaku (redoslijed kupnje, kao vodič u DotA) — koriste ih i botovi */
const BUILD_TANK    = ['bracer', 'phase', 'vanguard', 'bkb', 'assault', 'titanheart'];
const BUILD_MELEE   = ['wraith', 'treads', 'bfury', 'bkb', 'basher', 'daedalus'];
const BUILD_RANGED  = ['wraith', 'treads', 'crystalys', 'mkb', 'butterfly', 'daedalus'];
const BUILD_MAGE    = ['nulltal', 'arcane', 'euls', 'dagon', 'shiva', 'refresher'];
const BUILD_SUPPORT = ['wand', 'arcane', 'mek', 'force', 'shiva', 'refresher'];
const BOT_BUILD = BUILD_MELEE;
const HERO_BUILDS = {
  vitez: BUILD_TANK, jez: BUILD_TANK, slon: BUILD_TANK, nosorog: BUILD_TANK, panda: BUILD_TANK,
  hobotnica: ['bracer', 'arcane', 'blink', 'bkb', 'shiva', 'titanheart'],
  zarko: BUILD_MAGE, ledena: BUILD_MAGE, sova: BUILD_MAGE, gavran: BUILD_MAGE, pcela: ['nulltal', 'arcane', 'euls', 'sun', 'shiva', 'refresher'],
  listko: BUILD_SUPPORT, jednorog: BUILD_SUPPORT,
  strijela: BUILD_RANGED, orlina: BUILD_RANGED, luna: ['wraith', 'treads', 'deso', 'mkb', 'butterfly', 'satanic'],
  munja: BUILD_MELEE, majmun: ['wraith', 'phase', 'bfury', 'deso', 'basher', 'butterfly'],
  vuk: ['bracer', 'phase', 'mom', 'basher', 'bkb', 'satanic'],
  tragac: ['wraith', 'phase', 'shadowblade', 'deso', 'daedalus', 'butterfly'],
  skokica: ['bracer', 'phase', 'blink', 'bkb', 'abyssal', 'satanic'],
  morskipas: ['wraith', 'phase', 'mom', 'bfury', 'abyssal', 'satanic'],
};
for(const h of HEROES) h.build = HERO_BUILDS[h.id] || BOT_BUILD;
/* početni predmeti (prvih 650 zlata) */
const START_ITEMS = ['tango', 'branch', 'branch', 'potion', 'clarity'];


/* ---------------- DŽUNGLA: NEUTRALNI KAMPOVI ---------------- */

const CAMP_TYPES = {
  boars:  { n:3, emoji:'🐗', name:'Veprić',      hp:340,  dmg:24, range:60, atkCd:1.2, speed:120, r:15, gold:34,  xp:40 },
  wolves: { n:2, emoji:'🐺', name:'Vuk',         hp:540,  dmg:34, range:65, atkCd:1.1, speed:135, r:17, gold:55,  xp:60 },
  bear:   { n:1, emoji:'🐻', name:'Medo Brundo', hp:1000, dmg:52, range:75, atkCd:1.2, speed:115, r:22, gold:130, xp:130 },
  boss:   { n:1, emoji:'🐲', name:'Veliki Zmaj', hp:2600, dmg:78, range:95, atkCd:1.3, speed:110, r:34, gold:260, xp:300, boss:true, hpRegen:4 },
  golem:  { n:1, emoji:'🗿', name:'Kameni Golem', hp:1500, dmg:62, range:85, atkCd:1.4, speed:100, r:27, gold:170, xp:170, stunHit:true, hpRegen:2 },
};
const CAMP_SPOTS = [
  { x:850,  y:1300, type:'boars'  },
  { x:1300, y:850,  type:'wolves' },
  { x:2120, y:1700, type:'boars'  },
  { x:1700, y:2120, type:'wolves' },
  { x:2100, y:2100, type:'bear'   },
  { x:800,  y:800,  type:'boss'   },
  { x:500,  y:1800, type:'golem'  },
  { x:2500, y:1200, type:'golem'  },
];

/* ---------------- RUNE ZLATA I MUDROSTI (u džungli) ---------------- */
const BOUNTY_SPOTS = [{ x:700, y:1500 }, { x:1500, y:2300 }, { x:1500, y:700 }, { x:2300, y:1500 }];
const WISDOM_SPOTS = [{ x:420, y:1250 }, { x:1250, y:420 }];

/* ---------------- BRZE PORUKE (G pa 1–6) ---------------- */
const CHAT_LINES = ['👍 Bravo!', '🆘 Pomoć!', '⚔️ Napadamo!', '🏃 Povlačenje!', '🙏 Hvala!', '😄 Dobra igra!'];
const BOT_BRAG = ['😎 Hehe, lako!', '💪 Jesam ga!', '🎉 Juhu!', '⭐ Super smo!'];

/* ---------------- SVETIŠTA (liječe tim, kao u DotA 7) ---------------- */
const SHRINE_SPOTS = [{ x:1150, y:2250, team:0 }, { x:1850, y:750, team:1 }];

/* ---------------- TALENTI (level 10 i 15: biraš jedno od dva) ---------------- */
const TALENTS = [
  { lvl:10, a:{ id:'dmg', emoji:'⚔️', txt:'+30 štete' },        b:{ id:'hp',  emoji:'❤️', txt:'+300 života' } },
  { lvl:15, a:{ id:'spd', emoji:'🏃', txt:'+15% brzine' },      b:{ id:'cdr', emoji:'⏱️', txt:'−20% hlađenja moći' } },
  { lvl:20, a:{ id:'dmg2', emoji:'🗡️', txt:'+60 štete' },        b:{ id:'hp2', emoji:'💖', txt:'+650 života' } },
  { lvl:25, a:{ id:'aspd', emoji:'⚡', txt:'+35% brzine napada' }, b:{ id:'cdr2', emoji:'⌛', txt:'−15% hlađenja više' } },
];

/* ---------------- RUNE NA RIJECI ---------------- */

const RUNE_SPOTS = [{ x:1150, y:1150 }, { x:1850, y:1850 }];
// sva mjesta na mapi zadana su za staru mapu 3000×3000 — ovdje se skaliraju na veću
for(const arr of [CAMP_SPOTS, BOUNTY_SPOTS, WISDOM_SPOTS, SHRINE_SPOTS, RUNE_SPOTS])
  for(const p of arr){ p.x = Math.round(p.x * MAP_S); p.y = Math.round(p.y * MAP_S); }
const RUNE_TYPES = [
  { id:'haste',  emoji:'💨', name:'Runa brzine',
    apply(h){ applyHaste(h, 1.8, 15); } },
  { id:'regen',  emoji:'💚', name:'Runa obnove',
    apply(h){ h.runeRegenT = 10; } },
  { id:'double', emoji:'⚔️', name:'Runa dvostruke štete',
    apply(h){ h.status.dmgMulT = 20; h.status.dmgMulF = 2; } },
  { id:'shield', emoji:'🛡️', name:'Runa štita',
    apply(h){ applyShield(h, 0.5, 15); } },
];
