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

const WORLD = 3000;
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
  towerGoldTeam: 120,
  towerXp: 90,
  passiveGold: 0.9,
  startGold: 650,
  respawnBase: 4,
  respawnPerLvl: 1.3,
  fountainRadius: 330,
  fountainHeal: 0.07,
  maxLevel: 18,
  ultLevels: [6, 11, 16],
  statMaxRanks: 6,
  statPerPoint: 2,
  inventorySlots: 6,
  campRespawn: 60,
  bossRespawn: 180,
  runeEvery: 120,
  dayCycle: 240,
  uphillMissChance: 0.25,
  barracksHp: 1500,
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
      { key:'W', name:'Lavlja koža', emoji:'🦺', cd:0, mana:0, color:'#fde047',
        passive:true, pid:'koza',
        desc:'PASIVNO: tvrda lavlja koža trajno smanjuje SVU primljenu štetu',
        tip:rk => '🛡️ primaš ' + Math.round((0.03 + 0.03*rk) * 100) + '% manje štete' },
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
      { key:'W', name:'Ledeni dodir', emoji:'❄️', cd:0, mana:0, color:'#7dd3fc',
        passive:true, pid:'dodir',
        desc:'PASIVNO: svaki tvoj napad usporava neprijatelja',
        tip:rk => '❄️ napadi usporavaju ' + Math.round((0.1 + 0.05*rk) * 100) + '% na 1.5 s' },
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
      { key:'W', name:'Oštro oko', emoji:'👁️', cd:0, mana:0, color:'#fb923c',
        passive:true, pid:'oko',
        desc:'PASIVNO: šansa za KRITIČNI pogodak',
        tip:rk => '💥 15% šanse za ×' + (1.25 + 0.25*rk).toFixed(2) + ' štete' },
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
      { key:'E', name:'Statički naboj', emoji:'🔋', cd:0, mana:0, color:'#fde047',
        passive:true, pid:'naboj',
        desc:'PASIVNO: tvoji napadi imaju šansu okinuti dodatnu munju',
        tip:rk => '⚡ ' + Math.round((0.15 + 0.05*rk) * 100) + '% šanse za +' + (30 + 25*rk) + ' štete' },
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
      { key:'W', name:'Lukavi udarac', emoji:'💢', cd:0, mana:0, color:'#fb923c',
        passive:true, pid:'jinada',
        desc:'PASIVNO: šansa da udarac bude podmukao — dodatna šteta i usporenje',
        tip:rk => '💢 ' + Math.round((0.15 + 0.05*rk) * 100) + '% šanse za +' + (25 + 25*rk) + ' štete i usporenje' },
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
      { key:'E', name:'Oklop od bodlji', emoji:'🦔', cd:0, mana:0, color:'#a3e635',
        passive:true, pid:'oklop',
        desc:'PASIVNO: tko te udari, može dobiti bodlje natrag!',
        tip:rk => '🌵 ' + Math.round((0.2 + 0.05*rk) * 100) + '% šanse da napadaču poleti ' + (3) + ' bodlje po ' + (18 + 10*rk) + ' štete' },
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
      { key:'E', name:'Debela koža', emoji:'🛡️', cd:0, mana:0, color:'#c7d2fe',
        passive:true, pid:'debela',
        desc:'PASIVNO: tko te udari izbliza, i sam se ozlijedi',
        tip:rk => '🛡️ napadač izbliza prima ' + (14 + 10*rk) + ' štete natrag' },
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
      { key:'E', name:'Med', emoji:'🧈', cd:0, mana:0, color:'#fde68a',
        passive:true, pid:'med',
        desc:'PASIVNO: slatki med polako liječi tebe i prijatelje oko tebe',
        tip:rk => '💚 +' + (1 + rk) + ' života/s tebi i prijateljima u krugu 300' },
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
      { key:'E', name:'Noćna ptica', emoji:'🌙', cd:0, mana:0, color:'#a78bfa',
        passive:true, pid:'noc',
        desc:'PASIVNO: noću si brža i jača!',
        tip:rk => '🌙 noću +' + Math.round((0.15 + 0.08*rk) * 100) + '% brzine i +' + (12 + 10*rk) + ' štete' },
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
      { key:'E', name:'Kombo', emoji:'👊', cd:0, mana:0, color:'#fde047',
        passive:true, pid:'kombo',
        desc:'PASIVNO: svaki treći udarac je jači i malo te izliječi',
        tip:rk => '👊 svaki 3. napad +' + (30 + 25*rk) + ' štete i 💚 ' + (15 + 10*rk) + ' liječenja' },
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
      { key:'E', name:'Čopor', emoji:'🐾', cd:0, mana:0, color:'#cbd5e1',
        passive:true, pid:'copor',
        desc:'PASIVNO: brže napadaš i rane ti brže zacjeljuju',
        tip:rk => '⚡ +' + (10*rk) + '% brzine napada • 💚 +' + (1 + rk) + ' života/s' },
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
      { key:'E', name:'Gavranovo pero', emoji:'🪶', cd:0, mana:0, color:'#ddd6fe',
        passive:true, pid:'pero',
        desc:'PASIVNO: pokoji napad ukrade neprijatelju manu i da je tebi',
        tip:rk => '🪶 25% šanse: 💧 ' + (20 + 15*rk) + ' mane ukradeno + ' + (15 + 10*rk) + ' štete' },
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
      { key:'E', name:'Sluzava koža', emoji:'💧', cd:0, mana:0, color:'#a5b4fc',
        passive:true, pid:'sluz',
        desc:'PASIVNO: tko te udari, oklizne se po sluzi i uspori',
        tip:rk => '🐌 napadač usporen ' + Math.round((0.15 + 0.05*rk) * 100) + '% na 1.5 s' },
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
      { key:'E', name:'Debeli oklop', emoji:'🛡️', cd:0, mana:0, color:'#fde68a',
        passive:true, pid:'tvrd',
        desc:'PASIVNO: debela koža skida dio štete sa svakog udarca',
        tip:rk => '🛡️ −' + (4 + 4*rk) + ' štete na svaki udarac' },
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
      { key:'E', name:'Bambus', emoji:'🎋', cd:0, mana:0, color:'#86efac',
        passive:true, pid:'bambus',
        desc:'PASIVNO: žvakanje bambusa stalno obnavlja život i manu',
        tip:rk => '💚 +' + (1.5 + rk) + ' života/s • 💧 +' + (0.5 + 0.5*rk) + ' mane/s' },
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
];

/* ---------------- DUĆAN S RECEPTIMA ---------------- */

const ITEMS = [
  // ----- TIR 1: osnovni predmeti -----
  { id:'sword',  emoji:'⚔️', name:'Mač',           tier:1, cost:400, desc:'+14 štete',                stats:{dmg:14},            basic:true },
  { id:'heart',  emoji:'❤️', name:'Srce',           tier:1, cost:450, desc:'+220 života',              stats:{hp:220},            basic:true },
  { id:'orb',    emoji:'🔮', name:'Čarobna kugla',  tier:1, cost:430, desc:'+150 mane, +1 obnova mane', stats:{mp:150, mpRegen:1}, basic:true },
  { id:'boots',  emoji:'👟', name:'Brze čizme',     tier:1, cost:350, desc:'+38 brzine',               stats:{speed:38},          basic:true, tag:'boots' },
  { id:'potion', emoji:'🧪', name:'Napitak',        tier:1, cost:120, desc:'Odmah vrati 320 života (ne zauzima torbu)', instant:true, heal:320, basic:true },
  { id:'bottle', emoji:'🍼', name:'Boca',           tier:1, cost:300, desc:'3 gutljaja: +130 života i +70 mane • puni se kod fontane', basic:true, charges:3, stats:{},
    active:{ cd:3, mana:0,
      use(h){
        if(itemCharges(h, 'bottle') <= 0){ if(isHuman(h)) addFloat(h.x, h.y, '🍼 Boca je prazna — napuni je kod fontane!', '#e5e7eb', 13); return false; }
        useCharge(h, 'bottle'); heal(h, 130); h.mp = Math.min(h.maxmp, h.mp + 70);
        return true;
      } } },
  { id:'dust',   emoji:'🌫️', name:'Prašina',        tier:1, cost:180, desc:'2 puta: otkrij nevidljive neprijatelje u blizini na 8 s (potroši se)', basic:true, charges:2, consume:true, stats:{},
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
  { id:'tango',  emoji:'🌿', name:'Tango',          tier:1, cost:90,  desc:'3 komada: pojedi list i 16 s polako vraćaš 115 života (potroši se)', basic:true, charges:3, consume:true, stats:{},
    active:{ cd:1, mana:0,
      use(h){ h.tangoT = 16; useCharge(h, 'tango'); burst(h.x, h.y, '#86efac', 10, 120, 4); return true; } } },
  { id:'clarity', emoji:'💧', name:'Bistrina',      tier:1, cost:60,  desc:'Popij: 20 s polako vraćaš 150 mane — prekida je udarac neprijateljskog junaka (potroši se)', basic:true, charges:1, consume:true, stats:{},
    active:{ cd:1, mana:0,
      use(h){ h.clarityT = 20; useCharge(h, 'clarity'); burst(h.x, h.y, '#7dd3fc', 10, 120, 4); return true; } } },
  { id:'cheese', emoji:'🧀', name:'Zmajev sir',     tier:1, cost:500, desc:'Dar Velikog Zmaja: odmah +1500 života i +800 mane (potroši se)', noShop:true, charges:1, consume:true, stats:{},
    active:{ cd:1, mana:0,
      use(h){ heal(h, 1500); h.mp = Math.min(h.maxmp, h.mp + 800); useCharge(h, 'cheese'); burst(h.x, h.y, '#fde047', 26, 240, 6); return true; } } },
  { id:'eye',    emoji:'👁️', name:'Oko',            tier:1, cost:150, desc:'2 oka: postavi oko koje gleda kroz maglu rata 2 min (potroši se)', basic:true, charges:2, consume:true, stats:{},
    active:{ cd:2, mana:0, target:'point', castRange:500,
      use(h, aim){
        const p = clampRange(h, aim, 500);
        wards.push({ x:p.x, y:p.y, r:400, team:h.team, t:120, owner:h });
        useCharge(h, 'eye');
        ring(p.x, p.y, 400, '#c4b5fd');
        return true;
      } } },
  // ----- TIR 2: recepti -----
  { id:'bigsword',  emoji:'🗡️', name:'Junački mač',     tier:2, cost:300, desc:'+40 štete',
    stats:{dmg:40}, components:['sword','sword'] },
  { id:'bigheart',  emoji:'💖', name:'Veliko srce',      tier:2, cost:350, desc:'+500 života, +2 obnova',
    stats:{hp:500, hpRegen:2}, components:['heart','heart'] },
  { id:'fastboots', emoji:'🥾', name:'Munjevite čizme',  tier:2, cost:250, desc:'+55 brzine, +14 štete',
    stats:{speed:55, dmg:14}, components:['boots','sword'], tag:'boots' },
  { id:'staff',     emoji:'🪄', name:'Čarobni štap',     tier:2, cost:300, desc:'+24 štete, +180 mane, +2 obnova mane',
    stats:{dmg:24, mp:180, mpRegen:2}, components:['orb','sword'] },
  { id:'guard',     emoji:'🛡️', name:'Štit čuvara',      tier:2, cost:300, desc:'+260 života, +160 mane, obnova',
    stats:{hp:260, mp:160, hpRegen:1.5, mpRegen:1}, components:['heart','orb'] },
  // ----- TIR 3: moćni recepti -----
  { id:'kingsword',  emoji:'⚜️', name:'Kraljevski mač',  tier:3, cost:450, desc:'+62 štete',
    stats:{dmg:62}, components:['bigsword','sword'] },
  { id:'titanheart', emoji:'🧡', name:'Titansko srce',   tier:3, cost:400, desc:'+750 života, +3 obnova',
    stats:{hp:750, hpRegen:3}, components:['bigheart','heart'] },
  { id:'archstaff',  emoji:'🌟', name:'Arhimagov štap',  tier:3, cost:400, desc:'+30 štete, +320 mane, +3 obnova mane',
    stats:{dmg:30, mp:320, mpRegen:3}, components:['staff','orb'] },
  { id:'blink',      emoji:'🪽', name:'Skokne čizme',    tier:3, cost:450, desc:'+50 brzine, +100 mane • AKTIVNO: skok do 600 daleko (klik = cilj)',
    stats:{speed:50, mp:100}, components:['boots','orb'], tag:'boots',
    active:{ cd:14, mana:40, target:'point', castRange:600,
      use(h, aim){ leapTo(h, aim, 600); burst(h.x, h.y, '#bae6fd', 16, 200, 5); return true; } } },
  { id:'bkb',        emoji:'👑', name:'Kraljevski oklop', tier:3, cost:500, desc:'+220 života, +20 štete • AKTIVNO: 5 s ništa te ne može omamiti ni usporiti',
    stats:{hp:220, dmg:20}, components:['guard','sword'],
    active:{ cd:60, mana:0,
      use(h){ applyImmune(h, 5); burst(h.x, h.y, '#fde047', 20, 220, 6); return true; } } },
  // ----- TIR 4: legendarni -----
  { id:'crown',       emoji:'🏵️', name:'Kruna kraljeva',  tier:4, cost:600, desc:'+55 štete, +450 života',
    stats:{dmg:55, hp:450}, components:['bigsword','bigheart'] },
  { id:'dragonblade', emoji:'🐲', name:'Zmajska oštrica', tier:4, cost:800, desc:'+85 štete, +650 života, +3 obnova',
    stats:{dmg:85, hp:650, hpRegen:3}, components:['kingsword','titanheart'] },
  { id:'sun',         emoji:'☀️', name:'Sunčev kamen',    tier:4, cost:700, desc:'+45 štete, +200 mane • PASIVNO: žariš sve neprijatelje oko sebe (24 štete/s)',
    stats:{dmg:45, mp:200}, components:['kingsword','orb'], burn:24, burnR:260 },
];
const ITEM_BY_ID = {};
for(const it of ITEMS) ITEM_BY_ID[it.id] = it;
const ITEM_TIERS = [
  { tier:1, label:'🥉 TIR 1 — Osnovni predmeti' },
  { tier:2, label:'🥈 TIR 2 — Recepti' },
  { tier:3, label:'🥇 TIR 3 — Moćni recepti' },
  { tier:4, label:'💎 TIR 4 — Legendarni' },
];

const BOT_BUILD = ['boots', 'bigsword', 'bigheart', 'staff', 'crown', 'dragonblade'];

/* kategorije dućana (kao u DotA: potrošno / napad / obrana / magija / čizme / legendarno) */
const ITEM_CATS = [
  { id:'rec',   label:'⭐ Preporučeno' },
  { id:'cons',  label:'🧪 Potrošno' },
  { id:'atk',   label:'⚔️ Napad' },
  { id:'def',   label:'❤️ Obrana' },
  { id:'mag',   label:'🔮 Magija' },
  { id:'boots', label:'👟 Čizme' },
  { id:'leg',   label:'💎 Legendarno' },
  { id:'all',   label:'📜 Sve' },
];
const ITEM_CAT_OF = {
  potion:'cons', bottle:'cons', dust:'cons', eye:'cons', tango:'cons', clarity:'cons', cheese:'cons',
  sword:'atk', bigsword:'atk', kingsword:'atk',
  heart:'def', bigheart:'def', titanheart:'def', guard:'def', bkb:'def',
  orb:'mag', staff:'mag', archstaff:'mag',
  boots:'boots', fastboots:'boots', blink:'boots',
  crown:'leg', dragonblade:'leg', sun:'leg',
};
for(const it of ITEMS) it.cat = ITEM_CAT_OF[it.id] || 'atk';

/* preporučeni predmeti po junaku (redoslijed kupnje) — koriste ih i botovi */
const HERO_BUILDS = {
  vitez:     ['boots', 'heart', 'guard', 'bigheart', 'bkb', 'titanheart', 'dragonblade'],
  zarko:     ['boots', 'orb', 'staff', 'archstaff', 'blink', 'sun'],
  ledena:    ['boots', 'orb', 'guard', 'staff', 'archstaff', 'sun'],
  strijela:  ['boots', 'sword', 'bigsword', 'fastboots', 'kingsword', 'crown'],
  listko:    ['boots', 'orb', 'guard', 'staff', 'bigheart', 'archstaff'],
  munja:     ['boots', 'sword', 'fastboots', 'bigsword', 'kingsword', 'dragonblade'],
  skokica:   ['boots', 'heart', 'sword', 'bigheart', 'blink', 'crown'],
  orlina:    ['boots', 'sword', 'bigsword', 'fastboots', 'kingsword', 'crown'],
  luna:      ['boots', 'sword', 'orb', 'bigsword', 'kingsword', 'crown'],
  tragac:    ['boots', 'sword', 'fastboots', 'bigsword', 'blink', 'kingsword'],
  jez:       ['boots', 'heart', 'bigheart', 'guard', 'bkb', 'titanheart'],
  slon:      ['boots', 'heart', 'guard', 'bigheart', 'bkb', 'dragonblade'],
  pcela:     ['boots', 'orb', 'staff', 'guard', 'archstaff', 'sun'],
  sova:      ['boots', 'orb', 'staff', 'archstaff', 'blink', 'sun'],
  majmun:    ['boots', 'sword', 'fastboots', 'bigsword', 'kingsword', 'crown'],
  vuk:       ['boots', 'sword', 'heart', 'bigsword', 'bkb', 'dragonblade'],
  gavran:    ['boots', 'orb', 'staff', 'archstaff', 'blink', 'sun'],
  hobotnica: ['boots', 'heart', 'guard', 'bigheart', 'bkb', 'titanheart'],
  nosorog:   ['boots', 'heart', 'bigheart', 'bkb', 'titanheart', 'dragonblade'],
  panda:     ['boots', 'heart', 'guard', 'bigheart', 'bkb', 'crown'],
};
for(const h of HEROES) h.build = HERO_BUILDS[h.id] || BOT_BUILD;

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

/* ---------------- SVETIŠTA (liječe tim, kao u DotA 7) ---------------- */
const SHRINE_SPOTS = [{ x:1150, y:2250, team:0 }, { x:1850, y:750, team:1 }];

/* ---------------- TALENTI (level 10 i 15: biraš jedno od dva) ---------------- */
const TALENTS = [
  { lvl:10, a:{ id:'dmg', emoji:'⚔️', txt:'+30 štete' },        b:{ id:'hp',  emoji:'❤️', txt:'+300 života' } },
  { lvl:15, a:{ id:'spd', emoji:'🏃', txt:'+15% brzine' },      b:{ id:'cdr', emoji:'⏱️', txt:'−20% hlađenja moći' } },
];

/* ---------------- RUNE NA RIJECI ---------------- */

const RUNE_SPOTS = [{ x:1150, y:1150 }, { x:1850, y:1850 }];
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
