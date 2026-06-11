'use strict';
/* ============================================================
   DOTA Kids — podaci: timovi, konfiguracija, junaci, predmeti
   ============================================================ */

const WORLD = 3000;                       // velicina svijeta (px)
const TEAM_BLUE = 0, TEAM_RED = 1;
const TEAM_COLOR = ['#3b82f6', '#ef4444'];
const TEAM_LIGHT = ['#93c5fd', '#fca5a5'];
const TEAM_DARK  = ['#1e3a8a', '#7f1d1d'];
const TEAM_NAME  = ['Plavi', 'Crveni'];

const CFG = {
  waveEvery: 28,          // sekundi izmedu valova vojnika
  firstWave: 10,          // prvi val
  meleePerWave: 3,
  rangedPerWave: 1,
  creepXp: 46,
  xpRadius: 720,
  heroKillGold: 200,
  heroKillGoldPerLvl: 12,
  heroKillXp: 150,
  towerGoldTeam: 120,
  towerXp: 90,
  passiveGold: 0.9,       // zlato po sekundi
  startGold: 650,
  respawnBase: 4,
  respawnPerLvl: 1.3,
  fountainRadius: 330,
  fountainHeal: 0.07,     // % max zivota po sekundi
  maxLevel: 12,
};

function xpNeed(level){ return 55 + level * 60; }

/* ---------------- JUNACI ----------------
   Svaki junak: osnovne osobine + 3 moci (Q W E).
   cast(u, aim) vraca false ako nema mete (ne trosi manu/cd).
   "bot" je uputa botovima kako koristiti moc.            */

const HEROES = [
  {
    id:'vitez', name:'Lavko', emoji:'🦁',
    role:'🛡️ Vitez — hrabri tenk izbliza',
    hp:680, hpG:102, mp:240, mpG:24, dmg:60, dmgG:7,
    range:78, speed:168, atkCd:1.1, projSpeed:0,
    abilities:[
      { key:'Q', name:'Vrtlog', emoji:'🌪️', cd:7, mana:40,
        desc:'Zavrti mač i udari sve oko sebe',
        bot:{type:'aoe-self', range:175},
        cast(u, aim){
          damageCircle(u, u.x, u.y, 175, 75 + 25*u.level, {color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 16, 220, 5);
          return true;
        }},
      { key:'W', name:'Zlatni štit', emoji:'🛡️', cd:13, mana:45,
        desc:'Štit upija pola štete 4 sekunde i malo te izliječi',
        bot:{type:'shield', range:340},
        cast(u, aim){
          applyShield(u, 0.5, 4);
          heal(u, 50 + 14*u.level);
          burst(u.x, u.y, '#fde047', 14, 120, 5);
          return true;
        }},
      { key:'E', name:'Junački skok', emoji:'💥', cd:16, mana:70,
        desc:'Skoči na mjesto, udari i omami neprijatelje',
        bot:{type:'gap', range:360},
        cast(u, aim){
          leapTo(u, aim, 360);
          damageCircle(u, u.x, u.y, 160, 85 + 24*u.level, {stun:1.0, color:'#f97316'});
          burst(u.x, u.y, '#f97316', 22, 260, 6);
          return true;
        }},
    ],
  },
  {
    id:'zarko', name:'Žarko', emoji:'🐉',
    role:'🔥 Vatreni zmaj — čarobnjak na daljinu',
    hp:530, hpG:76, mp:300, mpG:32, dmg:52, dmgG:6,
    range:330, speed:165, atkCd:1.15, projSpeed:600,
    abilities:[
      { key:'Q', name:'Vatrena kugla', emoji:'🔥', cd:6, mana:45,
        desc:'Ispali vatrenu kuglu prema mišu',
        bot:{type:'shot', range:680},
        cast(u, aim){
          return spawnSkillshot(u, aim, {speed:560, r:24, range:760,
            dmg:100 + 27*u.level, color:'#fb923c', emoji:'🔥'});
        }},
      { key:'W', name:'Plameni krug', emoji:'💍', cd:10, mana:55,
        desc:'Plamen oprži sve oko tebe i malo ih uspori',
        bot:{type:'aoe-self', range:215},
        cast(u, aim){
          damageCircle(u, u.x, u.y, 215, 65 + 19*u.level,
            {slow:{f:0.25, t:1.5}, color:'#f97316'});
          burst(u.x, u.y, '#fb923c', 20, 240, 6);
          return true;
        }},
      { key:'E', name:'Meteor', emoji:'☄️', cd:20, mana:100,
        desc:'Pozovi meteor — velika šteta i kratka omama',
        bot:{type:'zone', range:560},
        cast(u, aim){
          return spawnZone(u, aim, {r:185, delay:0.9, ticks:1, interval:0.5,
            dmg:185 + 42*u.level, stun:0.5, castRange:620,
            color:'#f97316', emoji:'☄️'});
        }},
    ],
  },
  {
    id:'ledena', name:'Ledena', emoji:'🐧',
    role:'❄️ Snježna čarobnica — usporava neprijatelje',
    hp:530, hpG:76, mp:310, mpG:33, dmg:50, dmgG:6,
    range:330, speed:165, atkCd:1.15, projSpeed:600,
    abilities:[
      { key:'Q', name:'Ledena strijela', emoji:'🧊', cd:6, mana:40,
        desc:'Ledena strijela ranjava i jako usporava',
        bot:{type:'shot', range:660},
        cast(u, aim){
          return spawnSkillshot(u, aim, {speed:520, r:22, range:740,
            dmg:85 + 22*u.level, slow:{f:0.45, t:2.5},
            color:'#38bdf8', emoji:'🧊'});
        }},
      { key:'W', name:'Smrznuti val', emoji:'❄️', cd:11, mana:60,
        desc:'Ledeni val oko tebe — šteta i veliko usporenje',
        bot:{type:'aoe-self', range:230},
        cast(u, aim){
          damageCircle(u, u.x, u.y, 230, 55 + 17*u.level,
            {slow:{f:0.5, t:3}, color:'#7dd3fc'});
          burst(u.x, u.y, '#bae6fd', 20, 240, 6);
          return true;
        }},
      { key:'E', name:'Snježna oluja', emoji:'🌨️', cd:20, mana:100,
        desc:'Mećava na mjestu — pada 4 puta i usporava',
        bot:{type:'zone', range:540},
        cast(u, aim){
          return spawnZone(u, aim, {r:205, delay:0.5, ticks:4, interval:0.8,
            dmg:50 + 13*u.level, slow:{f:0.4, t:1}, castRange:600,
            color:'#7dd3fc', emoji:'❄️'});
        }},
    ],
  },
  {
    id:'strijela', name:'Strijela', emoji:'🦊',
    role:'🏹 Lukava lisica — strijelac velike štete',
    hp:550, hpG:82, mp:250, mpG:26, dmg:58, dmgG:8,
    range:360, speed:170, atkCd:1.0, projSpeed:680,
    abilities:[
      { key:'Q', name:'Probojna strijela', emoji:'🎯', cd:7, mana:40,
        desc:'Strijela koja probija sve na svom putu',
        bot:{type:'shot', range:760},
        cast(u, aim){
          return spawnSkillshot(u, aim, {speed:680, r:18, range:860,
            dmg:92 + 24*u.level, pierce:true, color:'#fbbf24', emoji:'🎯'});
        }},
      { key:'W', name:'Brzina vjetra', emoji:'💨', cd:12, mana:45,
        desc:'Trči i pucaj 50% brže 4 sekunde',
        bot:{type:'haste', range:520},
        cast(u, aim){
          applyHaste(u, 1.55, 4);
          burst(u.x, u.y, '#e0f2fe', 14, 180, 4);
          return true;
        }},
      { key:'E', name:'Kiša strijela', emoji:'🌧️', cd:18, mana:90,
        desc:'Strijele padaju 3 puta na odabrano mjesto',
        bot:{type:'zone', range:540},
        cast(u, aim){
          return spawnZone(u, aim, {r:200, delay:0.6, ticks:3, interval:0.6,
            dmg:65 + 16*u.level, castRange:600,
            color:'#f59e0b', emoji:'🏹'});
        }},
    ],
  },
  {
    id:'listko', name:'Listko', emoji:'🐢',
    role:'🌿 Šumski iscjelitelj — liječi prijatelje',
    hp:600, hpG:88, mp:300, mpG:32, dmg:52, dmgG:6,
    range:300, speed:163, atkCd:1.15, projSpeed:560,
    abilities:[
      { key:'Q', name:'Trnova kugla', emoji:'🌰', cd:6, mana:40,
        desc:'Baci bodljikavu kuglu koja usporava',
        bot:{type:'shot', range:640},
        cast(u, aim){
          return spawnSkillshot(u, aim, {speed:540, r:22, range:720,
            dmg:88 + 22*u.level, slow:{f:0.25, t:1.5},
            color:'#84cc16', emoji:'🌰'});
        }},
      { key:'W', name:'Iscjeljenje', emoji:'💚', cd:11, mana:65,
        desc:'Izliječi sebe i prijatelje oko sebe',
        bot:{type:'heal', range:270},
        cast(u, aim){
          healCircle(u, 270, 100 + 30*u.level);
          return true;
        }},
      { key:'E', name:'Korijenje', emoji:'🌱', cd:17, mana:90,
        desc:'Korijenje zaustavi neprijatelje na mjestu',
        bot:{type:'zone', range:520},
        cast(u, aim){
          return spawnZone(u, aim, {r:215, delay:0.4, ticks:1, interval:0.5,
            dmg:65 + 18*u.level, root:1.8, castRange:560,
            color:'#22c55e', emoji:'🌱'});
        }},
    ],
  },
  {
    id:'munja', name:'Munja', emoji:'🐯',
    role:'⚡ Brzi tigar — munjeviti ubojica',
    hp:580, hpG:88, mp:260, mpG:27, dmg:62, dmgG:8,
    range:95, speed:188, atkCd:1.0, projSpeed:0,
    abilities:[
      { key:'Q', name:'Munjeviti udar', emoji:'⚡', cd:6, mana:45,
        desc:'Munja skače s neprijatelja na neprijatelja (do 3)',
        bot:{type:'chain', range:470},
        cast(u, aim){
          return chainLightning(u, {range:480, jump:330, max:3, dmg:85 + 23*u.level});
        }},
      { key:'W', name:'Bljesak', emoji:'🌀', cd:9, mana:40,
        desc:'Munjevito juriš prema mišu i ošteti sve na putu',
        bot:{type:'gap', range:330},
        cast(u, aim){
          const fx = u.x, fy = u.y;
          leapTo(u, aim, 330);
          lineDamage(u, fx, fy, u.x, u.y, 80, 45 + 10*u.level);
          addLine(fx, fy, u.x, u.y, '#fde047', 6, 0.3);
          return true;
        }},
      { key:'E', name:'Oluja gromova', emoji:'⛈️', cd:18, mana:95,
        desc:'Gromovi udaraju oko tebe 4 puta',
        bot:{type:'aoe-self', range:230},
        cast(u, aim){
          return spawnZone(u, {x:u.x, y:u.y}, {r:240, delay:0.3, ticks:4, interval:0.7,
            dmg:48 + 13*u.level, castRange:1,
            color:'#a78bfa', emoji:'⛈️'});
        }},
    ],
  },
];

/* ---------------- DUĆAN ---------------- */

const ITEMS = [
  { id:'sword',    emoji:'⚔️', name:'Mač',           cost:400,  desc:'+14 štete',        stats:{dmg:14} },
  { id:'bigsword', emoji:'🗡️', name:'Junački mač',   cost:1050, desc:'+34 štete',        stats:{dmg:34} },
  { id:'heart',    emoji:'❤️', name:'Srce',           cost:450,  desc:'+230 života',      stats:{hp:230} },
  { id:'bigheart', emoji:'💖', name:'Veliko srce',    cost:1150, desc:'+560 života',      stats:{hp:560} },
  { id:'boots',    emoji:'👟', name:'Brze čizme',     cost:350,  desc:'+38 brzine',       stats:{speed:38}, unique:true },
  { id:'orb',      emoji:'🔮', name:'Čarobna kugla',  cost:430,  desc:'+160 mane',        stats:{mp:160, mpRegen:1.2} },
  { id:'potion',   emoji:'🧪', name:'Napitak',        cost:120,  desc:'Odmah vrati 320 života', instant:true, heal:320 },
];

// redoslijed kupovine za botove
const BOT_BUILD = ['boots','sword','heart','orb','bigsword','heart','bigheart','sword','bigsword'];
