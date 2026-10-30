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

const MAP_S = 2.22;                        // mjerilo mape (1 = stara mapa 3000×3000); v0.38: 1.45 → 1.85 (5 na 5 treba više prostora); v0.47: → 2.22 (+20%)
const WORLD = Math.round(3000 * MAP_S);
const TEAM_BLUE = 0, TEAM_RED = 1, TEAM_NEUTRAL = 2;
const TEAM_COLOR = ['#3b82f6', '#ef4444', '#f59e0b'];
const TEAM_LIGHT = ['#93c5fd', '#fca5a5', '#fcd34d'];
const TEAM_DARK  = ['#1e3a8a', '#7f1d1d', '#92400e'];
const TEAM_NAME  = [L('Plavi', 'Blue'), L('Crveni', 'Red'), L('Neutralni', 'Neutral')];

const CFG = {
  teamSize: 5,         // 👥 5 na 5 (kao u DotA i LoL): ti + 4 bota protiv 5 botova
  waveEvery: 28,
  prepTime: 30,        // ⏳ priprema na početku: 30 s za kupovinu (sat kreće od -0:30, vojnici kreću u 0:00)
  firstWave: 0,        // prvi val vojnika: koliko sekundi nakon 0:00
  meleePerWave: 3,
  rangedPerWave: 1,
  siegeEveryNthWave: 3,
  creepXp: 46,
  xpRadius: 720,
  // 💰 v0.54: sporija ekonomija u normalnoj igri. Predmeti ovdje koštaju otprilike pola cijene iz DotA 2, a vojnici su davali
  //   puno DotA zlato i ubojstvo junaka i više od DotA — predmeti su stizali ~2× brže, a tko bi rano pobijedio par puta brzo bi
  //   pobjegao svima. Sada ~30% manje zlata (ubojstva ~55% manje, više ide pomagačima); brza igra zadržava staro (TURBO_GOLD u game.js)
  heroKillGold: 90,         // bilo 200 + 12 po levelu žrtve
  heroKillGoldPerLvl: 5,
  heroKillXp: 150,
  assistRange: 1000,        // 🤝 suigrači u ovom krugu oko ubijenog junaka dobivaju asistenciju
  assistGold: 45,           // bilo 50
  comebackPct: 0.06,        // 🔄 bonus zlata za ubojstvo kad tvoj tim zaostaje (6% razlike u neto vrijednosti)
  comebackMax: 400,
  comebackFrom: 350,        //   bonus kreće kad tim zaostaje više od 350 po junaku (bilo 500); v0.54: dijeli se ubojici i pomagačima
  richFrom: 1200, richPct: 0.15, richMax: 500,   // 🎯 v0.54 bogata meta: 15% neto vrijednosti iznad prosjeka + 1200 (najviše 500) ide timu koji ga sruši
  towerGoldTeam: 80,        // svakom junaku tima (bilo 120)
  towerXp: 90,
  passiveGold: 0.75,        // zlato u sekundi (bilo 0.9)
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
  drakeRespawn: 150,   // 🐉 novi zmajčić (novog elementa) nakon 2,5 min
  runeEvery: 120,
  dayCycle: 240,
  uphillMissChance: 0.25,
  barracksHp: 2200,
  barracksRespawn: 240,     // 🏚️ srušena vojarna se obnovi nakon 4 min (kao inhibitor u LoL-u)
  towerHp: 2600,
  ancientHp: 5000,
  heroVsStructure: 0.5,     // junaci udaraju građevine slabije (utvrđeni oklop kao u Allstarsu)
  lateSiege: 0.6,           // 🏰 v0.54: od 25. do 40. min junaci sve jače udaraju građevine (do ×1.6) — izjednačena igra ne zapne pred bazom
  siegeVsStructure: 1.25,   // opsadni vojnici jače
  towerArmor: 8,            // 🛡️ oklop građevina (smanjuje štetu udaraca; Oštrica pustoši ga skida)
  barracksArmor: 6,
  barracksGoldTeam: 100,    // bilo 150
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
  shutdownGold: 80,         // prekid niza ubojstava: +80 zlata po ubojstvu u nizu (od 3.; bilo 60)
  neutralDrop: 0.12,        // 🌰 šansa da čudovište iz džungle ispusti neutralni predmet
  neutralT2: 600,           //   od 10. minute bolji predmeti (razina 2)
  neutralT3: 1200,          //   od 20. minute najbolji (razina 3)
  neutralMax: 3,            //   najviše 3 po razini za svaki tim
  bountyEvery: 180,         // 💰 rune zlata u džungli svake 3 min
  bountyGold: 25, bountyGoldMin: 1.5,   // 💰 runa zlata: svakom junaku u timu 25 + 1.5 po minuti igre (bilo 40 + 3)
  bossGoldTeam: 150,        // 🐲 Veliki Zmaj: zlato svakom junaku tima (bilo 200)
  wisdomEvery: 420,         // 📘 rune mudrosti svakih 7 min
  courierSpeed: 520,        // 🫏 kurir leti brže od junaka
  courierBaseR: 900,        // kupljeno dalje od ovoga od fontane čeka kurira
  creepScaleEvery: 450,     // svakih 7.5 min najava "Vojnici su ojačali!" i +2 zlata po vojniku (kao u DotA)
  // 🪖 v0.49: vojnici kao u DotA 2 — izdržljiviji od početka (melee 550 života i 2 oklopa, daljinski 300, opsadni 935;
  //   prije 330 / 230 / 850, pa su na početku padali u 5–6 udaraca) i rastu glatko sa satom igre:
  //   +4% života i +3% štete svake minute (10. min ×1.4 / ×1.3, 20. min ×1.8 / ×1.6, 30. min ×2.2 / ×1.9)
  creepHpGrow: 0.04,
  creepDmgGrow: 0.03,
  timeScale: 1,             // ⏱️ brza igra: 0.6 — botovi ranije guraju, kule ranije gube bonus protiv junaka
  meleeResist: 0.08,        // ⚖️ v0.45: junaci izbliza primaju 8% manje štete
  intSpellAmp: 0.0025,      // ⚖️ v0.45: svaki bod inteligencije +0.25% štete moćima (čarobnjaci jačaju s levelima)
  agiAtkSpd: 0.004,        // ⚖️ v0.45: brzina napada po bodu okretnosti (bilo 0.006 — nosači su bili prejaki)
  agiArmorDiv: 12,          // ⚖️ v0.45: oklop = okretnost / 12 (bilo / 10)
  agiSpeed: 0.22,           // ⚖️ v0.45: brzina kretanja po bodu okretnosti (bilo 0.3)
  strHp: 21,                // ⚖️ v0.45: život po bodu snage (bilo 18) — snažni junaci izbliza bili su preslabi
  creepGoldMul: 0.68, creepXpMul: 1,   // 💰 zlato od vojnika i čudovišta: v0.54 ×0.68 (vojnik izbliza 26 umjesto 38); brza igra ×2
  shrineCd: 240,            // svetište: liječi 5 s, puni se 4 min
  shrineDur: 5,
  shrineR: 320,
  // DotA aggro pravila (creep aggro)
  creepAggroRange: 500,     // napad (i naredba napada) na heroja povlači creepove u ovom radijusu
  creepAggroChase: 2.3,     // koliko dugo ganjaju
  creepAggroCd: 3,          // pa se smire
  creepHeroAcq: 500,        // bez neprijateljskih vojnika i građevina u blizini vojnici napadaju junake do 500 (kao u DotA)
  // 🗼 v0.38: kule rano jako udaraju junake — ×2 do 10. minute, pa pada do ×1.3 u 20. minuti;
  //   svaki sljedeći hitac u ISTOG junaka jači je +25% (do +100%, kao "zagrijavanje" kule u LoL-u)
  towerHeroMul: [2.0, 1.3],
  towerHeat: 0.25,
  travelSpeed: 1.15,        // 💨 izvan borbe (6 s bez udaraca u junake/građevine)
  travelCalm: 6,
  homeGuardSpeed: 1.4,      // 💨 "vjetar doma": od fontane dok ne uđeš u borbu (najviše 10 s nakon izlaska iz baze) — v0.46: samo na početku igre
  homeGuardT: 10,
  // 🐢 v0.46: junaci su 22% sporiji (i čizme, okretnost, bonusi) — kao u DotA 2 junak je otprilike brz kao vojnik,
  //   pa se mapa ne pretrči za pola minute i gank s druge strane mape traje
  heroMoveMul: 0.78,
  // 🐗 v0.46: čudovišta kao u DotA 2 — mirna dok ih ne udariš, pa ganjaju do povodca; vojnici i kule napadaju razljućena čudovišta
  campLeash: 800,           //   koliko daleko od kampa ganjaju (dosta da ih "povučeš" do vojnika na stazi)
  campGiveUp: 5,            //   bez ijednog udarca (danog ili primljenog) toliko sekundi — odustanu i vrate se
  // 🧠 v0.51: u gank, džunglu i po runu botovi idu kad PROCIJENE da se isplati (prije: gank tek od 4. minute) —
  //   u gank tek s levelom 3+ (ne odmah na početku)
  gankLvl: 3,
  laningPhase: 600,         // 🛣️ v0.50: prvih 10 min (sat igre) botovi ne mijenjaju staze — prava faza na stazama (i opreznije procjene)
  pushLead: 1.2,            // 🏰 od 14. min tim gura zajedno kad ima toliko puta veću neto vrijednost (i nije u manjini)
  // 🐲 v0.47: čudovišta iz džungle i zmajevi JAČAJU kako igra teče (po satu igre — u brzoj igri brže): svake 2 minute
  //   +1 level = +18% života, +12% štete, +4% zlata i +6% iskustva; Veliki Zmaj i zmajčići +24% života i +16% štete
  //   (junaci u 20. minuti imaju ~7× veću štetu nego na početku — prije su čudovišta tada padala u sekundi)
  neutralLvlEvery: 120,
  neutralLvlHp: 0.18, neutralLvlDmg: 0.12, neutralLvlGold: 0.04, neutralLvlXp: 0.06,
  bossLvlHp: 0.24, bossLvlDmg: 0.16,
  // 🗼 v0.47: čudovišta nikad ne ulaze u domet kule — kad meta ili oni dođu do ruba dometa, odustanu i vrate se
  campTowerPad: 70,
  towerHeatMax: 1.0,
};

// staze junaka u timu (prvi je igrač / čovjek): sredina sama, na bočnim stazama po dvoje (kao u DotA)
const LANE_PLAN = ['mid', 'top', 'bot', 'top', 'bot'];
/* 🛣️ v0.50: stazu biraš na ekranu junaka (kao ulogu u LoL-u) — tvoja ide prva, a botovi popune ostatak rasporeda
   (1 sredina, 2 gore, 2 dolje): na sredini si sam (1 na 1), gore i dolje ideš s botom suigračem (2 na 2) */
const LANES = ['top', 'mid', 'bot'];
/* 🌲 v0.56: uloga DŽUNGLA — kad je netko odabere, oba tima igraju s junakom u džungli: gore i na sredini 1 na 1,
   dolje 2 na 2, a peti od 0:00 čisti kampove (mali kampovi s guštarima su za level 1) i ganka staze */
const JUNGLE_PLAN = ['jungle', 'mid', 'top', 'bot', 'bot'];
const LANE_CHOICES = ['top', 'mid', 'bot', 'jungle'];
const JUNGLE_HOME_LANE = 'top';   // džungla nije staza: kad nema kampova (ili mu tim da zadatak) junak pomaže gornjoj stazi
function lanesFor(first, jungle){
  const rest = (jungle || first === 'jungle' ? JUNGLE_PLAN : LANE_PLAN).slice();
  return rest.splice(rest.indexOf(LANE_CHOICES.includes(first) ? first : 'mid'), 1).concat(rest);
}
/* ⭐ v0.48: iskustvo po levelu kao u DotA 2 — level 2 dolazi brzo (140, tri vojnika), a svaki sljedeći traži sve
   više: 400, 520, 600 … 3000 za level 25 (Dotina tablica, samo je prvi level jeftiniji; ukupno 34 300 — prije 19 320
   uz ravnomjeran rast +60). U simulaciji je prije najbolji junak bio level 25 već u 20. minuti; sada je prosječni
   junak u 10. min ~level 7, u 20. min ~level 12–13, a level 25 stiže tek u dugoj igri */
const XP_TABLE = [140, 400, 520, 600, 680, 760, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200, 2400, 2600, 2800, 3000];
function xpNeed(level){ return XP_TABLE[Math.max(1, Math.min(XP_TABLE.length, level)) - 1]; }

/* ---------------- JUNACI ---------------- */

const HEROES = [
  {
    id:'vitez', name:LS('Lavko'), emoji:'🦁',
    role:L('🛡️ Vitez — hrabri tenk', '🛡️ Knight — brave tank'),
    hp:680, mp:240, dmg:58,
    attrs:{ str:25, agi:16, int:13, strG:5.6, agiG:2.2, intG:2.0, primary:'str' },
    range:78, speed:168, atkCd:1.1, projSpeed:0,
    passive:{ name:L('Lavlja koža', 'Lion Hide'), emoji:'🦺', color:'#fde047', pid:'koza',
      desc:L('PASIVNO: tvrda lavlja koža trajno smanjuje SVU primljenu štetu', 'PASSIVE: tough lion hide always reduces ALL damage you take'),
      tip:rk => L('🛡️ primaš ' + Math.round((0.03 + 0.03*rk) * 100) + '% manje štete', '🛡️ you take ' + Math.round((0.03 + 0.03*rk) * 100) + '% less damage') },
    abilities:[
      { key:'Q', name:L('Vrtlog', 'Whirlwind'), emoji:'🌪️', cd:7, mana:40, color:'#fbbf24',
        desc:L('Zavrti mač i udari sve oko sebe', 'Spin your sword and hit everyone around you'),
        selfAoe:175,
        tip:rk => L('⚔️ ' + (60 + 45*rk) + ' štete svima oko tebe', '⚔️ ' + (60 + 45*rk) + ' damage to everyone around you'),
        bot:{type:'aoe-self', range:175},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 175, 60 + 45*rk, {color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 16, 220, 5);
          return true;
        }},
      { key:'W', name:L('Bojni poklič', 'Battle Cry'), emoji:'📯', cd:16, mana:60, color:'#f59e0b',
        desc:L('Rikni da ohrabriš tim — ti i prijatelji oko tebe udarate jače i brže trčite', 'Roar to cheer your team — you and nearby friends hit harder and run faster'),
        selfAoe:500,
        tip:rk => L('⚔️ +' + (15 + 7*rk) + '% štete i 🏃 +10% brzine timu u krugu 500 na 6 s', '⚔️ +' + (15 + 7*rk) + '% damage and 🏃 +10% speed for the team within 500 for 6 s'),
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
      { key:'E', name:L('Junački skok', 'Hero Leap'), emoji:'💥', cd:15, mana:70, color:'#f97316',
        desc:L('Skoči na mjesto, udari i omami neprijatelje', 'Leap to a spot, hit and stun enemies'),
        target:'point', castRange:360, aoe:160,
        tip:rk => L('⚔️ ' + (60 + 35*rk) + ' štete + omama ' + (0.7 + 0.1*rk).toFixed(1) + ' s', '⚔️ ' + (60 + 35*rk) + ' damage + stun ' + (0.7 + 0.1*rk).toFixed(1) + ' s'),
        bot:{type:'gap', range:360},
        cast(u, aim, rk){
          leapTo(u, aim, 360);
          damageCircle(u, u.x, u.y, 160, 60 + 35*rk, {stun:0.7 + 0.1*rk, color:'#f97316'});
          burst(u.x, u.y, '#f97316', 22, 260, 6);
          return true;
        }},
      { key:'R', name:L('Kraljev urlik', 'King\'s Roar'), emoji:'🦁', cd:70, mana:120, ult:true, color:'#fde047',
        desc:L('ULTI: Moćan urlik — velika šteta i omama oko tebe, a ti dobivaš štit', 'ULT: A mighty roar — big damage and stun around you, and you get a shield'),
        selfAoe:320,
        tip:rk => L('⚔️ ' + (150 + 100*rk) + ' štete + omama ' + (1.2 + 0.3*rk).toFixed(1) + ' s + štit', '⚔️ ' + (150 + 100*rk) + ' damage + stun ' + (1.2 + 0.3*rk).toFixed(1) + ' s + shield'),
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
    id:'zarko', name:L('Žarko', 'Zharko'), emoji:'🐉',
    role:L('🔥 Vatreni zmaj — čarobnjak', '🔥 Fire dragon — mage'),
    hp:620, mp:300, dmg:54,
    attrs:{ str:18, agi:16, int:24, strG:3.6, agiG:2.4, intG:5.4, primary:'int' },
    range:330, speed:165, atkCd:1.15, projSpeed:600, shot:'fire',
    passive:{ name:L('Vatrena krv', 'Fire Blood'), emoji:'🔥', color:'#fb923c', pid:'zar',
      desc:L('PASIVNO: napadi pale neprijatelje — gore još 2 sekunde', 'PASSIVE: attacks set enemies on fire — they burn for 2 more seconds'),
      tip:rk => L('🔥 +' + (6 + 6*rk) + ' štete/s gorenja 2 s nakon napada', '🔥 +' + (6 + 6*rk) + ' burn damage/s for 2 s after an attack') },
    abilities:[
      { key:'Q', name:L('Vatrena kugla', 'Fireball'), emoji:'🔥', cd:6, mana:45, color:'#fb923c',
        desc:L('Ispali vatrenu kuglu prema cilju', 'Shoot a fireball at the target'),
        target:'point', castRange:760, line:true, lineFull:true, lineW:68,
        tip:rk => L('⚔️ ' + (78 + 50*rk) + ' štete prvom pogođenom', '⚔️ ' + (78 + 50*rk) + ' damage to the first one hit'),
        bot:{type:'shot', range:680},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:560, r:24, range:760, pierce:hasTal(u, 'zarko_q_pierce'),
            dmg:78 + 50*rk, color:'#fb923c', emoji:'🔥'});
        }},
      { key:'W', name:L('Plameni krug', 'Flame Ring'), emoji:'💍', cd:10, mana:55, color:'#f97316',
        desc:L('Plamen oprži sve oko tebe i malo ih uspori', 'Flames scorch everyone around you and slow them a bit'),
        selfAoe:215,
        tip:rk => L('⚔️ ' + (45 + 32*rk) + ' štete oko tebe + usporenje', '⚔️ ' + (45 + 32*rk) + ' damage around you + slow'),
        bot:{type:'aoe-self', range:215},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 215, 45 + 32*rk,
            {slow:{f:0.25, t:1.5}, color:'#f97316'});
          burst(u.x, u.y, '#fb923c', 20, 240, 6);
          return true;
        }},
      { key:'E', name:LS('Meteor'), emoji:'☄️', cd:20, mana:100, color:'#f97316',
        desc:L('Pozovi meteor — velika šteta i kratka omama', 'Call a meteor — big damage and a short stun'),
        target:'point', castRange:620, aoe:185,
        tip:rk => L('⚔️ ' + (130 + 70*rk) + ' štete + omama 0.5 s', '⚔️ ' + (130 + 70*rk) + ' damage + 0.5 s stun'),
        bot:{type:'zone', range:560},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:185, delay:0.9, ticks:1, interval:0.5,
            dmg:130 + 70*rk, stun:0.5, castRange:620,
            color:'#f97316', emoji:'☄️'});
        }},
      { key:'R', name:L('Zmajev dah', 'Dragon\'s Breath'), emoji:'🐲', cd:70, mana:130, ult:true, color:'#ef4444',
        desc:L('ULTI: Ogromna vatrena lopta koja probija sve na svom putu', 'ULT: A huge fireball that pierces everything in its path'),
        target:'point', castRange:950, line:true, lineFull:true, lineW:132,
        tip:rk => L('⚔️ ' + (170 + 90*rk) + ' štete SVIMA na putu + usporenje', '⚔️ ' + (170 + 90*rk) + ' damage to ALL in its path + slow'),
        bot:{type:'shot', range:820},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:620, r:56, range:950,
            dmg:170 + 90*rk, pierce:true, slow:{f:0.3, t:2},
            color:'#ef4444', emoji:'🔥'});
        }},
    ],
  },
  {
    id:'ledena', name:LS('Ledena'), emoji:'🐧',
    role:L('❄️ Snježna čarobnica', '❄️ Snow witch'),
    hp:640, mp:310, dmg:56,
    attrs:{ str:18, agi:16, int:24, strG:3.6, agiG:2.4, intG:5.2, primary:'int' },
    range:330, speed:165, atkCd:1.15, projSpeed:600, shot:'ice',
    passive:{ name:L('Ledeni dodir', 'Icy Touch'), emoji:'❄️', color:'#7dd3fc', pid:'dodir',
      desc:L('PASIVNO: svaki tvoj napad usporava neprijatelja', 'PASSIVE: every attack you make slows the enemy'),
      tip:rk => L('❄️ napadi usporavaju ' + Math.round((0.1 + 0.05*rk) * 100) + '% na 1.5 s', '❄️ attacks slow by ' + Math.round((0.1 + 0.05*rk) * 100) + '% for 1.5 s') },
    abilities:[
      { key:'Q', name:L('Ledena strijela', 'Ice Arrow'), emoji:'🧊', cd:6, mana:40, color:'#38bdf8',
        desc:L('Ledena strijela ranjava i jako usporava', 'An icy arrow that hurts and slows a lot'),
        target:'point', castRange:740, line:true, lineFull:true, lineW:64,
        tip:rk => L('⚔️ ' + (58 + 40*rk) + ' štete + usporenje ' + Math.round((0.3 + 0.05*rk) * 100) + '%', '⚔️ ' + (58 + 40*rk) + ' damage + ' + Math.round((0.3 + 0.05*rk) * 100) + '% slow'),
        bot:{type:'shot', range:660},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:520, r:22, range:740,
            dmg:58 + 40*rk, slow:{f:0.3 + 0.05*rk, t:2.5},
            color:'#38bdf8', emoji:'🧊'});
        }},
      { key:'W', name:L('Trbušno klizanje', 'Belly Slide'), emoji:'🛷', cd:11, mana:50, color:'#7dd3fc',
        desc:L('Klizni na trbuhu po ledu — oštetiš i usporiš sve preko kojih prijeđeš', 'Slide on your belly over the ice — hurt and slow everyone you slide over'),
        target:'point', castRange:480, line:true, lineW:140,
        tip:rk => L('⚔️ ' + (40 + 30*rk) + ' štete + 🐌 usporenje 40% 2 s svima na putu', '⚔️ ' + (40 + 30*rk) + ' damage + 🐌 40% slow for 2 s to all in the path'),
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
      { key:'E', name:L('Snježna oluja', 'Snowstorm'), emoji:'🌨️', cd:20, mana:100, color:'#7dd3fc',
        desc:L('Mećava na mjestu — pada 4 puta i usporava', 'A blizzard on the spot — hits 4 times and slows'),
        target:'point', castRange:600, aoe:205,
        tip:rk => L('⚔️ 4 × ' + (28 + 20*rk) + ' štete + usporenje', '⚔️ 4 × ' + (28 + 20*rk) + ' damage + slow'),
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:205, delay:0.5, ticks:4, interval:0.8,
            dmg:28 + 20*rk, slow:{f:0.4, t:1}, castRange:600,
            color:'#7dd3fc', emoji:'❄️'});
        }},
      { key:'R', name:L('Ledeno doba', 'Ice Age'), emoji:'🥶', cd:75, mana:140, ult:true, color:'#bae6fd',
        desc:L('ULTI: Zamrzni veliko područje — neprijatelji su omamljeni', 'ULT: Freeze a big area — enemies are stunned'),
        target:'point', castRange:600, aoe:300,
        tip:rk => L('⚔️ ' + (140 + 80*rk) + ' štete + omama ' + (1.4 + 0.3*rk).toFixed(1) + ' s', '⚔️ ' + (140 + 80*rk) + ' damage + stun ' + (1.4 + 0.3*rk).toFixed(1) + ' s'),
        bot:{type:'zone', range:560},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:300, delay:0.7, ticks:1, interval:0.5,
            dmg:140 + 80*rk, stun:1.4 + 0.3*rk, castRange:600,
            color:'#bae6fd', emoji:'🥶'});
        }},
    ],
  },
  {
    id:'strijela', name:LS('Strijela'), emoji:'🦊',
    role:L('🏹 Lukava lisica — strijelac', '🏹 Sly fox — archer'),
    hp:550, mp:250, dmg:50,
    attrs:{ str:18, agi:24, int:15, strG:3.4, agiG:5.5, intG:2.2, primary:'agi' },
    range:360, speed:170, atkCd:1.0, projSpeed:680, shot:'arrow',
    passive:{ name:L('Oštro oko', 'Sharp Eye'), emoji:'👁️', color:'#fb923c', pid:'oko',
      desc:L('PASIVNO: šansa za KRITIČNI pogodak', 'PASSIVE: chance for a CRITICAL hit'),
      tip:rk => L('💥 15% šanse za ×' + (1.25 + 0.25*rk).toFixed(2) + ' štete', '💥 15% chance for ×' + (1.25 + 0.25*rk).toFixed(2) + ' damage') },
    abilities:[
      { key:'Q', name:L('Probojna strijela', 'Piercing Arrow'), emoji:'🎯', cd:8, mana:40, color:'#fbbf24',
        desc:L('Strijela koja probija sve na svom putu', 'An arrow that pierces everything in its path'),
        target:'point', castRange:860, line:true, lineFull:true, lineW:56,
        tip:rk => L('⚔️ ' + (62 + 42*rk) + ' štete SVIMA na putu', '⚔️ ' + (62 + 42*rk) + ' damage to ALL in its path'),
        bot:{type:'shot', range:760},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:680, r:18, range:860,
            dmg:62 + 42*rk, pierce:true, color:'#fbbf24', emoji:'🎯'});
        }},
      { key:'W', name:L('Lovačka mreža', 'Hunter\'s Net'), emoji:'🕸️', cd:12, mana:55, color:'#a3e635',
        desc:L('Baci mrežu — prvi neprijatelj kojeg pogodi ostane zarobljen na mjestu', 'Throw a net — the first enemy it hits gets stuck in place'),
        target:'point', castRange:700, line:true, lineFull:true, lineW:72,
        tip:rk => L('⚔️ ' + (40 + 30*rk) + ' štete + 🕸️ ne može se micati ' + (1.2 + 0.3*rk).toFixed(1) + ' s', '⚔️ ' + (40 + 30*rk) + ' damage + 🕸️ can\'t move for ' + (1.2 + 0.3*rk).toFixed(1) + ' s'),
        bot:{type:'shot', range:650},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:900, r:26, range:700, dmg:40 + 30*rk, color:'#a3e635', emoji:'🕸️',
            onHit:e => { applyRoot(e, 1.2 + 0.3*rk); addFloat(e.x, e.y, L('🕸️ Uhvaćen!', '🕸️ Caught!'), '#d9f99d', 15); }});
        }},
      { key:'E', name:L('Kiša strijela', 'Arrow Rain'), emoji:'🌧️', cd:18, mana:90, color:'#f59e0b',
        desc:L('Strijele padaju 3 puta na odabrano mjesto', 'Arrows fall 3 times on the chosen spot'),
        target:'point', castRange:600, aoe:200,
        tip:rk => L('⚔️ 3 × ' + (40 + 25*rk) + ' štete', '⚔️ 3 × ' + (40 + 25*rk) + ' damage'),
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:200, delay:0.6, ticks:3, interval:0.6,
            dmg:40 + 25*rk, castRange:600,
            color:'#f59e0b', emoji:'🏹'});
        }},
      { key:'R', name:L('Sokolovo oko', 'Falcon\'s Eye'), emoji:'🌠', cd:65, mana:110, ult:true, color:'#fde047',
        desc:L('ULTI: Čarobna strijela sama pronađe najslabijeg neprijateljskog junaka!', 'ULT: A magic arrow finds the weakest enemy hero by itself!'),
        tip:rk => L('⚔️ ' + (150 + 92*rk) + ' štete najslabijem junaku (ne može promašiti)', '⚔️ ' + (150 + 92*rk) + ' damage to the weakest hero (can\'t miss)'),
        bot:{type:'snipe', range:2000},
        cast(u, aim, rk){
          const t = weakestEnemyHero(u, 2200);
          if(!t) return false;
          spawnHoming(u, t, {speed:950, dmg:150 + 92*rk, r:12,
            color:'#fde047', emoji:'🌠',
            onHit(e){ burst(e.x, e.y, '#fde047', 26, 300, 7); }});
          if(hasTal(u, 'strijela_r2')){   // 🎓 talent: druga strijela u drugog najslabijeg junaka
            let t2 = null, bh = 1e9;
            for(const e of units) if(e !== t && e.kind === 'hero' && e.team !== u.team && !e.dead && dist(u, e) < 2200 && isVisibleTo(u.team, e) && e.hp < bh){ bh = e.hp; t2 = e; }
            if(t2) spawnHoming(u, t2, {speed:950, dmg:150 + 92*rk, r:12, color:'#fde047', emoji:'🌠', onHit(e){ burst(e.x, e.y, '#fde047', 26, 300, 7); }});
          }
          return true;
        }},
    ],
  },
  {
    id:'listko', name:LS('Listko'), emoji:'🐢',
    role:L('🌿 Šumski iscjelitelj', '🌿 Forest healer'),
    hp:690, mp:300, dmg:54,
    attrs:{ str:23, agi:14, int:20, strG:4.8, agiG:2.0, intG:3.4, primary:'str' },
    range:300, speed:163, atkCd:1.15, projSpeed:560, shot:'leaf',
    passive:{ name:L('Korijeni', 'Roots'), emoji:'🌱', color:'#4ade80', pid:'korijen',
      desc:L('PASIVNO: kad stojiš na mjestu, puštaš korijenje i brzo se liječiš', 'PASSIVE: when you stand still, you grow roots and heal fast'),
      tip:rk => L('💚 +' + (3 + 2*rk) + ' života/s i 💧 +' + (1 + rk) + ' mane/s kad stojiš', '💚 +' + (3 + 2*rk) + ' HP/s and 💧 +' + (1 + rk) + ' mana/s while standing still') },
    abilities:[
      { key:'Q', name:L('Trnova kugla', 'Thorn Ball'), emoji:'🌰', cd:6, mana:40, color:'#84cc16',
        desc:L('Baci bodljikavu kuglu koja usporava', 'Throw a spiky ball that slows'),
        target:'point', castRange:720, line:true, lineFull:true, lineW:64,
        tip:rk => L('⚔️ ' + (60 + 40*rk) + ' štete + usporenje 25%', '⚔️ ' + (60 + 40*rk) + ' damage + 25% slow'),
        bot:{type:'shot', range:640},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:540, r:22, range:720,
            dmg:60 + 40*rk, slow:{f:0.25, t:1.5},
            color:'#84cc16', emoji:'🌰'});
        }},
      { key:'W', name:L('Iscjeljenje', 'Healing'), emoji:'💚', cd:11, mana:65, color:'#4ade80',
        desc:L('Izliječi sebe i prijatelje oko sebe', 'Heal yourself and nearby friends'),
        selfAoe:270,
        tip:rk => L('💚 ' + (55 + 45*rk) + ' liječenja tebi i prijateljima', '💚 ' + (55 + 45*rk) + ' healing for you and your friends'),
        bot:{type:'heal', range:270},
        cast(u, aim, rk){
          healCircle(u, 270, 55 + 45*rk);
          return true;
        }},
      { key:'E', name:L('Korijenje', 'Entangle'), emoji:'🌱', cd:17, mana:90, color:'#22c55e',
        desc:L('Korijenje zaustavi neprijatelje na mjestu', 'Roots hold enemies in place'),
        target:'point', castRange:560, aoe:215,
        tip:rk => L('⚔️ ' + (35 + 28*rk) + ' štete + korijen ' + (1.1 + 0.2*rk).toFixed(1) + ' s', '⚔️ ' + (35 + 28*rk) + ' damage + root ' + (1.1 + 0.2*rk).toFixed(1) + ' s'),
        bot:{type:'zone', range:520},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:215, delay:0.4, ticks:1, interval:0.5,
            dmg:35 + 28*rk, root:1.1 + 0.2*rk, castRange:560,
            color:'#22c55e', emoji:'🌱'});
        }},
      { key:'R', name:L('Šumsko srce', 'Forest Heart'), emoji:'🌳', cd:70, mana:130, ult:true, color:'#22c55e',
        desc:L('ULTI: Velika šuma — izliječi i ubrza prijatelje, a neprijatelje veže korijenjem', 'ULT: A great forest — heals and speeds up friends, and roots enemies'),
        selfAoe:340,
        tip:rk => L('💚 ' + (110 + 70*rk) + ' liječenja + ⚔️ ' + (50 + 30*rk) + ' i korijen neprijateljima', '💚 ' + (110 + 70*rk) + ' healing + ⚔️ ' + (50 + 30*rk) + ' and root to enemies'),
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
    id:'munja', name:L('Munja', 'Munya'), emoji:'🐯',
    role:L('⚡ Brzi tigar — ubojica', '⚡ Fast tiger — assassin'),
    hp:660, mp:260, dmg:65,
    attrs:{ str:19, agi:25, int:14, strG:4.6, agiG:6.2, intG:2.2, primary:'agi' },
    range:95, speed:188, atkCd:1.0, projSpeed:0,
    passive:{ name:L('Statički naboj', 'Static Charge'), emoji:'🔋', color:'#fde047', pid:'naboj',
      desc:L('PASIVNO: tvoji napadi imaju šansu okinuti dodatnu munju', 'PASSIVE: your attacks have a chance to fire an extra lightning bolt'),
      tip:rk => L('⚡ ' + Math.round((0.15 + 0.05*rk) * 100) + '% šanse za +' + (30 + 25*rk) + ' štete', '⚡ ' + Math.round((0.15 + 0.05*rk) * 100) + '% chance for +' + (30 + 25*rk) + ' damage') },
    abilities:[
      { key:'Q', name:L('Munjeviti udar', 'Lightning Strike'), emoji:'⚡', cd:6, mana:45, color:'#fde047',
        desc:L('Munja skače s neprijatelja na neprijatelja (do 3)', 'Lightning jumps from enemy to enemy (up to 3)'),
        selfAoe:480,
        tip:rk => L('⚔️ ' + (55 + 38*rk) + ' štete, skače na 3 mete', '⚔️ ' + (55 + 38*rk) + ' damage, jumps to 3 targets'),
        bot:{type:'chain', range:470},
        cast(u, aim, rk){
          return chainLightning(u, {range:480, jump:330, max:3 + (hasTal(u, 'munja_q_jumps') ? 2 : 0), dmg:55 + 38*rk});
        }},
      { key:'W', name:L('Bljesak', 'Flash'), emoji:'🌀', cd:9, mana:40, color:'#fde047',
        desc:L('Munjevito juriš prema cilju i ošteti sve na putu', 'Dash like lightning to the target and hurt everything on the way'),
        target:'point', castRange:330, line:true, lineW:160,
        tip:rk => L('⚔️ ' + (25 + 18*rk) + ' štete na putu juriša', '⚔️ ' + (25 + 18*rk) + ' damage along the dash'),
        bot:{type:'gap', range:330},
        cast(u, aim, rk){
          const fx = u.x, fy = u.y;
          leapTo(u, aim, 330);
          lineDamage(u, fx, fy, u.x, u.y, 80, 25 + 18*rk);
          addLine(fx, fy, u.x, u.y, '#fde047', 6, 0.3);
          return true;
        }},
      { key:'E', name:L('Tigrove kandže', 'Tiger Claws'), emoji:'🐾', cd:14, mana:50, color:'#facc15',
        desc:L('Munjevito zamahuj kandžama — napadaš puno brže nekoliko sekundi', 'Swipe your claws super fast — you attack much faster for a few seconds'),
        tip:rk => L('⚡ +' + (30 + 15*rk) + '% brzine napada i 🏃 +12% brzine na 5 s', '⚡ +' + (30 + 15*rk) + '% attack speed and 🏃 +12% speed for 5 s'),
        bot:{type:'haste', range:350},
        cast(u, aim, rk){
          applyAtkSpeed(u, 0.3 + 0.15*rk, 5); applyHaste(u, 1.12, 5);
          addFloat(u.x, u.y - 30, L('🐾 Brže!', '🐾 Faster!'), '#fde047', 15);
          burst(u.x, u.y, '#facc15', 18, 200, 5);
          return true;
        }},
      { key:'R', name:L('Gnjev oluje', 'Storm\'s Wrath'), emoji:'🌩️', cd:65, mana:120, ult:true, color:'#a78bfa',
        desc:L('ULTI: Divovska munja skače na čak 6 neprijatelja, a tebe ubrza', 'ULT: Giant lightning jumps to as many as 6 enemies and speeds you up'),
        selfAoe:600,
        tip:rk => L('⚔️ ' + (100 + 60*rk) + ' štete, skače na 6 meta + ubrzanje', '⚔️ ' + (100 + 60*rk) + ' damage, jumps to 6 targets + speed boost'),
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
    id:'skokica', name:L('Skokica', 'Skokitsa'), emoji:'🐸',
    role:L('👅 Žabac — vuče neprijatelje k sebi', '👅 Frog — pulls enemies in'),
    hp:740, mp:260, dmg:63,
    attrs:{ str:24, agi:18, int:14, strG:5.2, agiG:3.0, intG:2.2, primary:'str' },
    range:85, speed:172, atkCd:1.05, projSpeed:0,
    passive:{ name:L('Vodozemac', 'Amphibian'), emoji:'💧', color:'#38bdf8', pid:'voda',
      desc:L('PASIVNO: u rijeci si brža i liječiš se', 'PASSIVE: in the river you are faster and you heal'),
      tip:rk => L('🏃 +' + (15 + 10*rk) + '% brzine i 💚 +' + (2 + 2*rk) + ' života/s u rijeci', '🏃 +' + (15 + 10*rk) + '% speed and 💚 +' + (2 + 2*rk) + ' HP/s in the river') },
    abilities:[
      { key:'Q', name:L('Jezičina', 'Big Tongue'), emoji:'👅', cd:9, mana:50, color:'#f472b6',
        desc:L('Izbaci jezik — prvog pogođenog povuče k sebi i kratko omami!', 'Shoot out your tongue — pull the first one hit to you and stun them briefly!'),
        target:'point', castRange:560, line:true, lineFull:true, lineW:56,
        tip:rk => L('⚔️ ' + (65 + 40*rk) + ' štete + povlačenje + omama ' + (0.6 + 0.1*rk).toFixed(1) + ' s', '⚔️ ' + (65 + 40*rk) + ' damage + pull + stun ' + (0.6 + 0.1*rk).toFixed(1) + ' s'),
        bot:{type:'shot', range:540},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:720, r:18, range:560,
            dmg:65 + 40*rk, color:'#f472b6', emoji:'👅',
            onHit(e){
              const p = stepToward(u, e, 70);
              e.x = p.x; e.y = p.y;
              applyStun(e, 0.6 + 0.1*rk);
              addLine(u.x, u.y, e.x, e.y, '#f472b6', 5, 0.25);
              burst(e.x, e.y, '#f472b6', 10, 160, 5);
            }});
        }},
      { key:'W', name:L('Žablji skok', 'Frog Leap'), emoji:'🦵', cd:11, mana:55, color:'#86efac',
        desc:L('Skoči na mjesto i uspori sve oko sebe', 'Leap to a spot and slow everyone around you'),
        target:'point', castRange:340, aoe:150,
        tip:rk => L('⚔️ ' + (40 + 25*rk) + ' štete + usporenje 30%', '⚔️ ' + (40 + 25*rk) + ' damage + 30% slow'),
        bot:{type:'gap', range:340},
        cast(u, aim, rk){
          leapTo(u, aim, 340);
          damageCircle(u, u.x, u.y, 150, 40 + 25*rk, {slow:{f:0.3, t:2}, color:'#86efac'});
          burst(u.x, u.y, '#86efac', 18, 220, 5);
          return true;
        }},
      { key:'E', name:L('Mjehur', 'Bubble'), emoji:'🫧', cd:14, mana:60, color:'#a5f3fc',
        desc:L('Mjehurići štite tebe i prijatelje (upijaju trećinu štete)', 'Bubbles protect you and your friends (they soak up a third of the damage)'),
        selfAoe:260,
        tip:rk => L('🛡️ štit 35% na 3 s + 💚 ' + (30 + 25*rk) + ' liječenja', '🛡️ 35% shield for 3 s + 💚 ' + (30 + 25*rk) + ' healing'),
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
      { key:'R', name:L('Veliki val', 'Big Wave'), emoji:'🌊', cd:70, mana:130, ult:true, color:'#38bdf8',
        desc:L('ULTI: Pozovi golemi val — velika šteta i jako usporenje', 'ULT: Call a giant wave — big damage and a strong slow'),
        target:'point', castRange:560, aoe:300,
        tip:rk => L('⚔️ ' + (185 + 100*rk) + ' štete + usporenje 50%', '⚔️ ' + (185 + 100*rk) + ' damage + 50% slow'),
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:300, delay:0.6, ticks:1, interval:0.5,
            dmg:185 + 100*rk, slow:{f:0.5, t:3}, castRange:560,
            color:'#38bdf8', emoji:'🌊'});
        }},
    ],
  },
  {
    id:'orlina', name:LS('Orlina'), emoji:'🦅',
    role:L('🪶 Orao — zračni snajper', '🪶 Eagle — sky sniper'),
    hp:520, mp:270, dmg:54,
    attrs:{ str:16, agi:25, int:16, strG:3.0, agiG:5.8, intG:2.4, primary:'agi' },
    range:380, speed:175, atkCd:1.0, projSpeed:700, shot:'feather',
    passive:{ name:L('Orlovski vid', 'Eagle Sight'), emoji:'🔭', color:'#fbbf24', pid:'vid',
      desc:L('PASIVNO: orlovske oči — gađaš s veće daljine', 'PASSIVE: eagle eyes — you shoot from farther away'),
      tip:rk => L('🏹 +' + (30*rk) + ' dometa napada', '🏹 +' + (30*rk) + ' attack range') },
    abilities:[
      { key:'Q', name:L('Pero-oštrica', 'Blade Feather'), emoji:'🪶', cd:6, mana:40, color:'#e2e8f0',
        desc:L('Munjevito brzo pero — pogađa izdaleka', 'A lightning-fast feather — hits from far away'),
        target:'point', castRange:900, line:true, lineFull:true, lineW:52,
        tip:rk => L('⚔️ ' + (66 + 44*rk) + ' štete izdaleka', '⚔️ ' + (66 + 44*rk) + ' damage from afar'),
        bot:{type:'shot', range:800},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:820, r:16, range:900,
            dmg:66 + 44*rk, color:'#e2e8f0', emoji:'🪶'});
        }},
      { key:'W', name:L('Uzlet', 'Updraft'), emoji:'🌬️', cd:12, mana:50, color:'#bae6fd',
        desc:L('Vjetar pod krilima — ubrzanje i skida sva usporenja s tebe', 'Wind under your wings — speeds you up and removes all slows'),
        tip:rk => L('🌬️ +' + Math.round((0.4 + 0.05*rk) * 100) + '% brzine 3 s + čisti usporenja', '🌬️ +' + Math.round((0.4 + 0.05*rk) * 100) + '% speed for 3 s + removes slows'),
        bot:{type:'haste', range:520},
        cast(u, aim, rk){
          applyHaste(u, 1.4 + 0.05*rk, 3);
          u.status.slowT = 0;
          u.status.rootT = 0;
          burst(u.x, u.y, '#bae6fd', 16, 200, 5);
          return true;
        }},
      { key:'E', name:L('Obrušavanje', 'Dive'), emoji:'🦅', cd:13, mana:65, color:'#fbbf24',
        desc:L('Obruši se na mjesto — šteta i usporenje', 'Dive onto a spot — damage and slow'),
        target:'point', castRange:380, aoe:150,
        tip:rk => L('⚔️ ' + (55 + 35*rk) + ' štete + usporenje 35%', '⚔️ ' + (55 + 35*rk) + ' damage + 35% slow'),
        bot:{type:'gap', range:380},
        cast(u, aim, rk){
          leapTo(u, aim, 380);
          damageCircle(u, u.x, u.y, 150, 55 + 35*rk, {slow:{f:0.35, t:2}, color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 20, 240, 6);
          return true;
        }},
      { key:'R', name:L('Kralj neba', 'Sky King'), emoji:'🌪️', cd:70, mana:125, ult:true, color:'#fde047',
        desc:L('ULTI: Pošalji sokole na SVE neprijateljske junake u blizini!', 'ULT: Send falcons at ALL nearby enemy heroes!'),
        selfAoe:1400,
        tip:rk => L('⚔️ ' + (110 + 60*rk) + ' štete SVAKOM vidljivom neprijateljskom junaku', '⚔️ ' + (110 + 60*rk) + ' damage to EVERY visible enemy hero'),
        bot:{type:'chain', range:900},
        cast(u, aim, rk){
          let n = 0;
          for(const e of units){
            if(e.kind !== 'hero' || e.team === u.team || e.dead || e.removeMe) continue;
            if(dist(u, e) > 1400) continue;
            if(!isVisibleTo(u.team, e)) continue;
            if(e.status.invisT > 0 && e.status.trackT <= 0) continue;
            spawnHoming(u, e, {speed:800, dmg:110 + 60*rk, r:10,
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
    id:'luna', name:LS('Luna'), emoji:'🐱',
    role:L('🌙 Mjesečeva mačka — strijela iz sjene', '🌙 Moon cat — arrows from the shadows'),
    hp:540, mp:280, dmg:53,
    attrs:{ str:17, agi:24, int:18, strG:3.2, agiG:5.8, intG:2.8, primary:'agi' },
    range:340, speed:172, atkCd:1.05, projSpeed:650, shot:'arrow',
    passive:{ name:L('Mjesečeva oštrica', 'Moon Blade'), emoji:'🌙', color:'#c4b5fd', pid:'mjesec',
      desc:L('PASIVNO: svaki napad odskoči na još jednog neprijatelja u blizini', 'PASSIVE: every attack bounces to one more nearby enemy'),
      tip:rk => L('🌙 odskok: ' + (25 + 10*rk) + '% štete drugom neprijatelju', '🌙 bounce: ' + (25 + 10*rk) + '% damage to a second enemy') },
    abilities:[
      { key:'Q', name:L('Sveta strijela', 'Sacred Arrow'), emoji:'🌠', cd:9, mana:50, color:'#e9d5ff',
        desc:L('Mjesečeva strijela leti JAKO daleko — što dulje leti, jače omami i ranjava!', 'A moon arrow that flies VERY far — the farther it flies, the harder it stuns and hurts!'),
        target:'point', castRange:1100, line:true, lineFull:true, lineW:60,
        tip:rk => L('⚔️ do ' + (80 + 62*rk) + ' štete, omama do ' + (1.2 + 0.3*rk).toFixed(1) + ' s (raste s daljinom)', '⚔️ up to ' + (80 + 62*rk) + ' damage, stun up to ' + (1.2 + 0.3*rk).toFixed(1) + ' s (grows with distance)'),
        bot:{type:'shot', range:900},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:620, r:20, range:1100,
            dmg:50 + 30*rk, color:'#e9d5ff', emoji:'🌠',
            onHit(e, p){
              const far = Math.min(1, (p ? p.traveled : 0) / 1100);
              applyStun(e, 0.5 + far * (0.7 + 0.3*rk));
              applyDamage(e, Math.round(far * (30 + 32*rk)), u);
              if(far > 0.7) addFloat(e.x, e.y, L('🌙 Dalekometni pogodak!', '🌙 Long shot!'), '#e9d5ff', 15);
              burst(e.x, e.y, '#e9d5ff', 14, 200, 5);
            }});
        }},
      { key:'W', name:L('Zvjezdana kiša', 'Star Shower'), emoji:'⭐', cd:11, mana:60, color:'#e9d5ff',
        desc:L('Zvijezde padaju na sve neprijatelje oko tebe', 'Stars fall on all enemies around you'),
        selfAoe:250,
        tip:rk => L('⚔️ ' + (36 + 28*rk) + ' štete svima oko tebe', '⚔️ ' + (36 + 28*rk) + ' damage to everyone around you'),
        bot:{type:'aoe-self', range:250},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 250, 36 + 28*rk, {color:'#e9d5ff'});
          burst(u.x, u.y, '#fde047', 14, 200, 5);
          burst(u.x, u.y, '#e9d5ff', 14, 240, 5);
          return true;
        }},
      { key:'E', name:L('Mjesečev skok', 'Moon Leap'), emoji:'🌜', cd:12, mana:50, color:'#bae6fd',
        desc:L('Skoči naprijed i potrči brže 2 sekunde', 'Leap forward and run faster for 2 seconds'),
        target:'point', castRange:400, line:true, lineW:50,
        tip:rk => L('🌜 skok ' + 400 + ' + ubrzanje ' + Math.round((0.2 + 0.05*rk) * 100) + '%', '🌜 leap ' + 400 + ' + speed boost ' + Math.round((0.2 + 0.05*rk) * 100) + '%'),
        bot:{type:'gap', range:400},
        cast(u, aim, rk){
          leapTo(u, aim, 400);
          applyHaste(u, 1.2 + 0.05*rk, 2);
          burst(u.x, u.y, '#bae6fd', 16, 200, 5);
          return true;
        }},
      { key:'R', name:L('Mjesečeva sjena', 'Moon Shadow'), emoji:'👻', cd:80, mana:140, ult:true, color:'#c4b5fd',
        desc:L('ULTI: CIJELI tvoj tim postaje NEVIDLJIV! Napad prekida nevidljivost', 'ULT: Your WHOLE team turns INVISIBLE! Attacking breaks invisibility'),
        tip:rk => L('👻 svi tvoji junaci nevidljivi ' + (5 + 3*rk) + ' s', '👻 all your heroes invisible for ' + (5 + 3*rk) + ' s'),
        bot:{type:'ult-aoe', range:500},
        cast(u, aim, rk){
          for(const e of units){
            if(e.kind !== 'hero' || e.team !== u.team || e.dead) continue;
            e.status.invisT = 5 + 3*rk;
            if(hasTal(u, 'luna_r_haste')) applyHaste(e, 1.3, 5 + 3*rk);
            addFloat(e.x, e.y, L('👻 Nevidljiv!', '👻 Invisible!'), '#c4b5fd', 15);
            burst(e.x, e.y, '#c4b5fd', 12, 160, 5);
          }
          return true;
        }},
    ],
  },
  {
    id:'tragac', name:L('Tragač', 'Tracker'), emoji:'🦝',
    role:L('💰 Lovac na glave — nevidljivi plaćenik', '💰 Bounty hunter — invisible mercenary'),
    hp:620, mp:250, dmg:63,
    attrs:{ str:19, agi:25, int:16, strG:3.8, agiG:6.2, intG:2.4, primary:'agi' },
    range:95, speed:175, atkCd:1.0, projSpeed:0,
    passive:{ name:L('Lukavi udarac', 'Sneaky Strike'), emoji:'💢', color:'#fb923c', pid:'jinada',
      desc:L('PASIVNO: šansa da udarac bude podmukao — dodatna šteta i usporenje', 'PASSIVE: a chance for a sneaky hit — extra damage and slow'),
      tip:rk => L('💢 ' + Math.round((0.15 + 0.05*rk) * 100) + '% šanse za +' + (25 + 25*rk) + ' štete i usporenje', '💢 ' + Math.round((0.15 + 0.05*rk) * 100) + '% chance for +' + (25 + 25*rk) + ' damage and slow') },
    abilities:[
      { key:'Q', name:L('Leteća zvijezda', 'Throwing Star'), emoji:'💫', cd:8, mana:45, color:'#fbbf24',
        desc:L('Baci oštru zvijezdu koja ranjava i kratko omami', 'Throw a sharp star that hurts and stuns briefly'),
        target:'point', castRange:600, line:true, lineFull:true, lineW:52,
        tip:rk => L('⚔️ ' + (70 + 50*rk) + ' štete + omama 0.4 s', '⚔️ ' + (70 + 50*rk) + ' damage + 0.4 s stun'),
        bot:{type:'shot', range:560},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:750, r:16, range:600,
            dmg:70 + 50*rk, color:'#fbbf24', emoji:'💫',
            onHit(e){ applyStun(e, 0.4); }});
        }},
      { key:'W', name:L('Dimna bomba', 'Smoke Bomb'), emoji:'💨', cd:14, mana:60, color:'#94a3b8',
        desc:L('Baci dimnu bombu — neprijatelji u dimu ne mogu čarati i promašuju udarce', 'Throw a smoke bomb — enemies in the smoke can\'t cast spells and miss their attacks'),
        target:'point', castRange:550, aoe:240,
        tip:rk => L('🤐 tišina ' + (1.5 + 0.5*rk).toFixed(1) + ' s + 😵 promašuju 40% 4 s + ⚔️ ' + (30 + 20*rk), '🤐 silence ' + (1.5 + 0.5*rk).toFixed(1) + ' s + 😵 40% miss for 4 s + ⚔️ ' + (30 + 20*rk)),
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
      { key:'E', name:L('Sjena', 'Shadow'), emoji:'👤', cd:16, mana:60, color:'#c4b5fd',
        pid:'sjena',
        desc:L('Nestani u sjenu — nevidljiv si, a napad iz sjene jako boli!', 'Vanish into the shadows — you are invisible, and an attack from the shadows really hurts!'),
        tip:rk => L('👤 nevidljiv ' + (6 + 2*rk) + ' s; napad iz sjene +' + (40 + 30*rk) + ' štete', '👤 invisible for ' + (6 + 2*rk) + ' s; shadow attack +' + (40 + 30*rk) + ' damage'),
        bot:{type:'shield', range:380},
        cast(u, aim, rk){
          u.status.invisT = 6 + 2*rk;
          applyHaste(u, 1.12, 2);
          addFloat(u.x, u.y, L('👤 U sjeni!', '👤 In the shadows!'), '#c4b5fd', 15);
          burst(u.x, u.y, '#c4b5fd', 14, 180, 5);
          return true;
        }},
      { key:'R', name:L('Ucjena', 'Bounty'), emoji:'💰', cd:22, mana:60, ult:true, color:'#fde047',
        desc:L('ULTI: Označi neprijateljskog junaka — svi ga vide (i nevidljivog!), a njegova smrt donosi DODATNO zlato', 'ULT: Mark an enemy hero — everyone can see them (even if invisible!), and taking them down gives EXTRA gold'),
        target:'point', castRange:700, aoe:260,
        tip:rk => L('💰 meta otkrivena 25 s; pogiba li, ti i ubojica dobivate +' + (80 + 40*rk) + ' zlata', '💰 target revealed for 25 s; if it falls, you and the killer get +' + (80 + 40*rk) + ' gold'),
        bot:{type:'track', range:650},
        cast(u, aim, rk){
          let best = null, bd = 260;
          const p = clampRange(u, aim, 700);   // v0.31: isti domet kao indikator
          for(const e of units){
            if(e.kind !== 'hero' || e.team === u.team || e.dead || e.removeMe) continue;
            const d = distXY(p.x, p.y, e.x, e.y);
            if(d < bd){ bd = d; best = e; }
          }
          if(!best) return false;
          best.status.trackT = 25;
          best.trackedBy = u;
          best.trackBonus = 80 + 40*rk + (hasTal(u, 'tragac_r_gold') ? 150 : 0);
          addFloat(best.x, best.y, L('💰 Ucijenjen!', '💰 Marked!'), '#fde047', 16);
          addLine(u.x, u.y, best.x, best.y, '#fde047', 4, 0.35);
          burst(best.x, best.y, '#fde047', 14, 200, 5);
          return true;
        }},
    ],
  },
  /* ---------------- NOVI JUNACI (v0.9) ---------------- */
  {
    id:'jez', name:L('Bodljo', 'Bodlyo'), emoji:'🦔',
    role:L('🌵 Jež — bodljikavi tenk', '🌵 Hedgehog — spiky tank'),
    hp:660, mp:230, dmg:58,
    attrs:{ str:24, agi:17, int:13, strG:5.4, agiG:2.4, intG:1.8, primary:'str' },
    range:80, speed:170, atkCd:1.1, projSpeed:0,
    passive:{ name:L('Oklop od bodlji', 'Quill Armor'), emoji:'🦔', color:'#a3e635', pid:'oklop',
      desc:L('PASIVNO: tko te udari, može dobiti bodlje natrag!', 'PASSIVE: whoever hits you might get quills back!'),
      tip:rk => L('🌵 ' + Math.round((0.2 + 0.05*rk) * 100) + '% šanse da napadaču poleti ' + (3) + ' bodlje po ' + (18 + 10*rk) + ' štete', '🌵 ' + Math.round((0.2 + 0.05*rk) * 100) + '% chance to shoot ' + (3) + ' quills at the attacker, ' + (18 + 10*rk) + ' damage each') },
    abilities:[
      { key:'Q', name:L('Kiša bodlji', 'Quill Spray'), emoji:'🌵', cd:6, mana:35, color:'#a3e635',
        desc:L('Ispali bodlje na sve oko sebe; svaka bodlja u neprijatelju boli sve više!', 'Shoot quills at everyone around you; every quill stuck in an enemy makes it hurt more!'),
        selfAoe:230,
        tip:rk => L('⚔️ ' + (45 + 35*rk) + ' štete svima oko tebe, +8 po svakoj bodlji u meti', '⚔️ ' + (45 + 35*rk) + ' damage to everyone around you, +8 for each quill in the target'),
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
      { key:'W', name:L('Ljepljiva sluz', 'Sticky Goo'), emoji:'🟢', cd:8, mana:45, color:'#84cc16',
        desc:L('Baci ljepljivu grudu — prvi pogođeni se zalijepi i uspori', 'Throw a sticky blob — the first one hit gets stuck and slowed'),
        target:'point', castRange:650, line:true, lineFull:true, lineW:64,
        tip:rk => L('⚔️ ' + (40 + 30*rk) + ' štete + usporenje ' + Math.round((0.3 + 0.05*rk) * 100) + '% na 3 s', '⚔️ ' + (40 + 30*rk) + ' damage + ' + Math.round((0.3 + 0.05*rk) * 100) + '% slow for 3 s'),
        bot:{type:'shot', range:600},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:600, r:22, range:650,
            dmg:40 + 30*rk, slow:{f:0.3 + 0.05*rk, t:3}, color:'#84cc16', emoji:'🟢'});
        }},
      { key:'E', name:L('Klupko', 'Rolling Ball'), emoji:'🌰', cd:12, mana:55, color:'#a16207',
        desc:L('Smotaj se u bodljikavo klupko i otkotrljaj se — prvi neprijatelj na putu bude omamljen', 'Curl into a spiky ball and roll — the first enemy in your path is stunned'),
        target:'point', castRange:520, line:true, lineW:68,
        tip:rk => L('⚔️ ' + (50 + 35*rk) + ' štete + 💫 omama ' + (0.6 + 0.15*rk).toFixed(2) + ' s', '⚔️ ' + (50 + 35*rk) + ' damage + 💫 stun ' + (0.6 + 0.15*rk).toFixed(2) + ' s'),
        bot:{type:'gap', range:500},
        cast(u, aim, rk){
          startCharge(u, aim, {range:520, speed:950, dmg:50 + 35*rk, stun:0.6 + 0.15*rk});
          return true;
        }},
      { key:'R', name:L('Juriš bodlji', 'Quill Rush'), emoji:'🏃', cd:60, mana:100, ult:true, color:'#bef264',
        desc:L('ULTI: Zalet! Puno brži i jači 8 sekundi, a život ti se obnavlja', 'ULT: Charge! Much faster and stronger for 8 seconds, and your health comes back'),
        tip:rk => L('🏃 +' + Math.round((0.25 + 0.1*rk) * 100) + '% brzine, ×' + (1.2 + 0.1*rk).toFixed(1) + ' štete 8 s + 💚 ' + (60 + 40*rk) + ' liječenja', '🏃 +' + Math.round((0.25 + 0.1*rk) * 100) + '% speed, ×' + (1.2 + 0.1*rk).toFixed(1) + ' damage for 8 s + 💚 ' + (60 + 40*rk) + ' healing'),
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
    id:'slon', name:L('Tutnjo', 'Tootnyo'), emoji:'🐘',
    role:L('🐘 Slon — golemi branič', '🐘 Elephant — giant defender'),
    hp:700, mp:220, dmg:62,
    attrs:{ str:27, agi:13, int:12, strG:5.4, agiG:1.8, intG:1.8, primary:'str' },
    range:88, speed:160, atkCd:1.15, projSpeed:0,
    passive:{ name:L('Debela koža', 'Thick Skin'), emoji:'🛡️', color:'#c7d2fe', pid:'debela',
      desc:L('PASIVNO: tko te udari izbliza, i sam se ozlijedi', 'PASSIVE: whoever hits you up close gets hurt too'),
      tip:rk => L('🛡️ napadač izbliza prima ' + (14 + 10*rk) + ' štete natrag', '🛡️ melee attackers take ' + (14 + 10*rk) + ' damage back') },
    abilities:[
      { key:'Q', name:L('Topot', 'Stomp'), emoji:'🦶', cd:12, mana:60, color:'#c4b5fd',
        desc:L('Lupi nogom — zemlja se zatrese, svi oko tebe su omamljeni', 'Stomp your foot — the ground shakes and everyone around you is stunned'),
        selfAoe:210,
        tip:rk => L('⚔️ ' + (60 + 45*rk) + ' štete + omama ' + (1.0 + 0.3*rk).toFixed(1) + ' s', '⚔️ ' + (60 + 45*rk) + ' damage + stun ' + (1.0 + 0.3*rk).toFixed(1) + ' s'),
        bot:{type:'aoe-self', range:210},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 210, 60 + 45*rk, {stun:1.0 + 0.3*rk, color:'#c4b5fd'});
          burst(u.x, u.y, '#c9b48c', 22, 240, 6);
          return true;
        }},
      { key:'W', name:L('Surla-zamah', 'Trunk Swing'), emoji:'🌀', cd:7, mana:40, color:'#a5b4fc',
        desc:L('Zamahni surlom ispred sebe — velika šteta u pravcu', 'Swing your trunk in front of you — big damage in a line'),
        target:'point', castRange:320, line:true, lineW:180,
        tip:rk => L('⚔️ ' + (80 + 55*rk) + ' štete svima u pravcu zamaha', '⚔️ ' + (80 + 55*rk) + ' damage to everyone in the swing'),
        bot:{type:'shot', range:300},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 320);
          u.dir = Math.atan2(p.y - u.y, p.x - u.x);
          lineDamage(u, u.x, u.y, p.x, p.y, 90, 80 + 55*rk);
          addLine(u.x, u.y, p.x, p.y, '#a5b4fc', 8, 0.25);
          burst(p.x, p.y, '#a5b4fc', 12, 200, 5);
          return true;
        }},
      { key:'E', name:L('Tuš iz surle', 'Trunk Shower'), emoji:'💦', cd:15, mana:70, color:'#38bdf8',
        desc:L('Poprskaj prijatelje vodom iz surle — izliječi ih i daj im mali štit', 'Spray friends with water from your trunk — heal them and give them a small shield'),
        selfAoe:320,
        tip:rk => L('💚 +' + (60 + 40*rk) + ' života i 🛡️ štit 20% 3 s tebi i prijateljima u krugu 320', '💚 +' + (60 + 40*rk) + ' HP and 🛡️ 20% shield for 3 s for you and friends within 320'),
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
      { key:'R', name:L('Stampedo', 'Stampede'), emoji:'🐘', cd:80, mana:130, ult:true, color:'#818cf8',
        desc:L('ULTI: Cijeli tvoj tim juri kao stampedo! Neprijatelji oko tebe su pregaženi i omamljeni', 'ULT: Your whole team charges like a stampede! Enemies around you get trampled and stunned'),
        selfAoe:320,
        tip:rk => L('🏃 tim +50% brzine 4 s • ⚔️ ' + (110 + 80*rk) + ' štete + omama 1.5 s oko tebe', '🏃 team +50% speed for 4 s • ⚔️ ' + (110 + 80*rk) + ' damage + 1.5 s stun around you'),
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
    id:'pcela', name:L('Zuja', 'Zooya'), emoji:'🐝',
    role:L('🍯 Pčela — otrovna čarobnica', '🍯 Bee — poison witch'),
    hp:550, mp:320, dmg:50,
    attrs:{ str:17, agi:18, int:25, strG:3.4, agiG:2.6, intG:5.6, primary:'int' },
    range:340, speed:168, atkCd:1.1, projSpeed:650, shot:'bolt',
    passive:{ name:L('Med', 'Honey'), emoji:'🧈', color:'#fde68a', pid:'med',
      desc:L('PASIVNO: slatki med polako liječi tebe i prijatelje oko tebe', 'PASSIVE: sweet honey slowly heals you and nearby friends'),
      tip:rk => L('💚 +' + (1 + rk) + ' života/s tebi i prijateljima u krugu 300', '💚 +' + (1 + rk) + ' HP/s for you and friends within 300') },
    abilities:[
      { key:'Q', name:L('Otrovni ubod', 'Poison Sting'), emoji:'🐝', cd:7, mana:45, color:'#facc15',
        desc:L('Pošalji pčelu — ubod otruje neprijatelja koji gubi život nekoliko sekundi', 'Send a bee — its sting poisons the enemy, who loses health for a few seconds'),
        target:'point', castRange:700, line:true, lineFull:true, lineW:60,
        tip:rk => L('⚔️ ' + (35 + 25*rk) + ' štete + 🤢 otrov ' + (10 + 7*rk) + '/s na 4 s', '⚔️ ' + (35 + 25*rk) + ' damage + 🤢 poison ' + (10 + 7*rk) + '/s for 4 s'),
        bot:{type:'shot', range:640},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:640, r:20, range:700,
            dmg:35 + 25*rk, color:'#facc15', emoji:'🐝',
            onHit(e){ applyPoison(e, 10 + 7*rk, 4, u); }});
        }},
      { key:'W', name:L('Roj', 'Swarm'), emoji:'🍯', cd:14, mana:70, color:'#fbbf24',
        desc:L('Pozovi roj pčela na mjesto — bodu i usporavaju sve u krugu', 'Call a bee swarm to a spot — they sting and slow everyone in the circle'),
        target:'point', castRange:600, aoe:200,
        tip:rk => L('⚔️ 5 × ' + (22 + 17*rk) + ' štete + usporenje', '⚔️ 5 × ' + (22 + 17*rk) + ' damage + slow'),
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:200, delay:0.4, ticks:5, interval:0.8,
            dmg:22 + 17*rk, slow:{f:0.3, t:1}, castRange:600,
            color:'#fbbf24', emoji:'🍯'});
        }},
      { key:'E', name:L('Zuj-bijeg', 'Buzz Off'), emoji:'🌬️', cd:13, mana:45, color:'#fde047',
        desc:L('Zuj! Naglo odleti na drugo mjesto i kratko ubrzaj', 'Bzzz! Zip away to another spot and get a short speed boost'),
        target:'point', castRange:420,
        tip:rk => L('🐝 skok do 420 + 🏃 +' + (20 + 10*rk) + '% brzine ' + (1.5 + 0.5*rk) + ' s', '🐝 leap up to 420 + 🏃 +' + (20 + 10*rk) + '% speed for ' + (1.5 + 0.5*rk) + ' s'),
        bot:{type:'escape', range:450},
        cast(u, aim, rk){
          leapTo(u, aim, 420);
          applyHaste(u, 1.2 + 0.1*rk, 1.5 + 0.5*rk);
          burst(u.x, u.y, '#fde047', 14, 180, 5);
          return true;
        }},
      { key:'R', name:L('Košnica', 'Beehive'), emoji:'🏺', cd:75, mana:140, ult:true, color:'#f59e0b',
        desc:L('ULTI: Golema košnica — otrovni oblak koji dugo traje i truje sve u njemu', 'ULT: A giant beehive — a long-lasting cloud that poisons everyone inside'),
        target:'point', castRange:650, aoe:320,
        tip:rk => L('⚔️ 6 × ' + (40 + 28*rk) + ' štete + 🤢 otrov svima u krugu', '⚔️ 6 × ' + (40 + 28*rk) + ' damage + 🤢 poison to everyone in the circle'),
        bot:{type:'zone', range:600},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:320, delay:0.6, ticks:6, interval:1.0,
            dmg:40 + 28*rk, poison:{dps:8 + 4*rk, t:3}, castRange:650,
            color:'#f59e0b', emoji:'🏺'});
        }},
    ],
  },
  {
    id:'sova', name:LS('Mudra'), emoji:'🦉',
    role:L('🌙 Sova — gospodarica noći', '🌙 Owl — queen of the night'),
    hp:660, mp:300, dmg:62,
    attrs:{ str:18, agi:19, int:23, strG:3.6, agiG:3.2, intG:5.6, primary:'int' },
    range:350, speed:170, atkCd:1.1, projSpeed:650, shot:'feather',
    passive:{ name:L('Noćna ptica', 'Night Bird'), emoji:'🌙', color:'#a78bfa', pid:'noc',
      desc:L('PASIVNO: noću si brža i jača!', 'PASSIVE: at night you are faster and stronger!'),
      tip:rk => L('🌙 noću +' + Math.round((0.15 + 0.08*rk) * 100) + '% brzine i +' + (12 + 10*rk) + ' štete', '🌙 at night +' + Math.round((0.15 + 0.08*rk) * 100) + '% speed and +' + (12 + 10*rk) + ' damage') },
    abilities:[
      { key:'Q', name:L('Huk', 'Hoot'), emoji:'📣', cd:9, mana:55, color:'#e9d5ff',
        desc:L('Glasni huk — neprijatelji oko tebe su ušutkani i ne mogu bacati moći', 'A loud hoot — enemies around you are silenced and can\'t use abilities'),
        selfAoe:300,
        tip:rk => L('⚔️ ' + (70 + 50*rk) + ' štete + 🤐 ušutkani ' + (2 + 0.5*rk).toFixed(1) + ' s', '⚔️ ' + (70 + 50*rk) + ' damage + 🤐 silenced ' + (2 + 0.5*rk).toFixed(1) + ' s'),
        bot:{type:'aoe-self', range:300},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 300, 70 + 50*rk, {silence:2 + 0.5*rk, color:'#e9d5ff'});
          ring(u.x, u.y, 180, '#e9d5ff'); ring(u.x, u.y, 300, '#e9d5ff');
          return true;
        }},
      { key:'W', name:L('Sovino oko', 'Owl Eye'), emoji:'👁️', cd:18, mana:50, color:'#c4b5fd',
        desc:L('Pogledaj daleko — vidiš odabrano mjesto 10 sekundi (i kroz maglu rata!)', 'Look far away — see the chosen spot for 10 seconds (even through the fog of war!)'),
        target:'point', castRange:1400, aoe:420,
        tip:rk => L('👁️ vid u krugu 420 na ' + (8 + 3*rk) + ' s', '👁️ vision in a 420 circle for ' + (8 + 3*rk) + ' s'),
        bot:{type:'ward', range:1200},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 1400);
          wards.push({ x:p.x, y:p.y, r:420, team:u.team, t:8 + 3*rk, owner:u });
          ring(p.x, p.y, 420, '#c4b5fd');
          burst(p.x, p.y, '#c4b5fd', 10, 150, 5);
          return true;
        }},
      { key:'E', name:L('Tihi let', 'Silent Flight'), emoji:'🌫️', cd:18, mana:70, color:'#a78bfa',
        desc:L('Sova leti potpuno tiho — postaneš nevidljiva i brža (napad te otkrije)', 'The owl flies totally silently — you turn invisible and faster (attacking reveals you)'),
        tip:rk => L('👻 nevidljivost ' + (3 + rk) + ' s + 🏃 +20% brzine', '👻 invisible for ' + (3 + rk) + ' s + 🏃 +20% speed'),
        bot:{type:'escape', range:500},
        cast(u, aim, rk){
          u.status.invisT = 3 + rk;
          applyHaste(u, 1.2, 3 + rk);
          burst(u.x, u.y, '#c4b5fd', 16, 160, 5);
          return true;
        }},
      { key:'R', name:L('Vječna noć', 'Endless Night'), emoji:'🌑', cd:90, mana:120, ult:true, color:'#6d28d9',
        desc:L('ULTI: Pozovi noć usred dana! Neprijatelji vide kraće, a tvoj tim je brži i jače udara', 'ULT: Call the night in the middle of the day! Enemies see less, and your team is faster and hits harder'),
        tip:rk => L('🌑 noć ' + (18 + 6*rk) + ' s • tim +20% brzine i ⚔️ +' + (15 + 5*rk) + '% štete 8 s', '🌑 night for ' + (18 + 6*rk) + ' s • team +20% speed and ⚔️ +' + (15 + 5*rk) + '% damage for 8 s'),
        bot:{type:'night', range:700},
        cast(u, aim, rk){
          nightForceT = Math.max(nightForceT, 18 + 6*rk);
          for(const e of units){
            if(e.kind === 'hero' && e.team === u.team && !e.dead){
              applyHaste(e, 1.2, 6);
              e.status.dmgMulF = Math.max(e.status.dmgMulT > 0 ? e.status.dmgMulF : 1, 1.15 + 0.05*rk); e.status.dmgMulT = Math.max(e.status.dmgMulT, 8);   // ⚔️ noćni lov
            }
          }
          announce(L('🌑 Vječna noć!', '🌑 Endless Night!'), L(u.emoji + ' ' + u.name + ' je pozvala noć!', u.emoji + ' ' + u.name + ' called the night!'));
          burst(u.x, u.y, '#6d28d9', 30, 300, 7);
          return true;
        }},
    ],
  },
  {
    id:'majmun', name:L('Skakač', 'Skakach'), emoji:'🐵',
    role:L('🥢 Majmun — brzi borac sa štapom', '🥢 Monkey — fast fighter with a staff'),
    hp:580, mp:260, dmg:52,
    attrs:{ str:19, agi:26, int:15, strG:4.0, agiG:5.2, intG:2.2, primary:'agi' },
    range:90, speed:180, atkCd:1.0, projSpeed:0,
    passive:{ name:L('Kombo', 'Combo'), emoji:'👊', color:'#fde047', pid:'kombo',
      desc:L('PASIVNO: svaki treći udarac je jači i malo te izliječi', 'PASSIVE: every third hit is stronger and heals you a little'),
      tip:rk => L('👊 svaki 3. napad +' + (30 + 25*rk) + ' štete i 💚 ' + (15 + 10*rk) + ' liječenja', '👊 every 3rd attack +' + (30 + 25*rk) + ' damage and 💚 ' + (15 + 10*rk) + ' healing') },
    abilities:[
      { key:'Q', name:L('Štap-udarac', 'Staff Strike'), emoji:'🥢', cd:9, mana:50, color:'#fbbf24',
        desc:L('Štap se produži i udari sve u pravcu — kratka omama', 'Your staff grows long and hits everything in a line — short stun'),
        target:'point', castRange:420, line:true, lineW:140,
        tip:rk => L('⚔️ ' + (65 + 45*rk) + ' štete + omama ' + (0.5 + 0.2*rk).toFixed(1) + ' s svima u pravcu', '⚔️ ' + (65 + 45*rk) + ' damage + stun ' + (0.5 + 0.2*rk).toFixed(1) + ' s to everyone in a line'),
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
      { key:'W', name:L('Majmunski skok', 'Monkey Leap'), emoji:'🐵', cd:10, mana:45, color:'#86efac',
        desc:L('Skoči na mjesto i kratko potrči brže', 'Leap to a spot and run faster for a bit'),
        target:'point', castRange:450, line:true, lineW:50,
        tip:rk => L('🐵 skok 450 + ubrzanje ' + Math.round((0.15 + 0.05*rk) * 100) + '% na 2 s', '🐵 leap 450 + ' + Math.round((0.15 + 0.05*rk) * 100) + '% speed for 2 s'),
        bot:{type:'gap', range:450},
        cast(u, aim, rk){
          leapTo(u, aim, 450);
          applyHaste(u, 1.15 + 0.05*rk, 2);
          burst(u.x, u.y, '#c9b48c', 14, 200, 5);
          return true;
        }},
      { key:'E', name:LS('Banana'), emoji:'🍌', cd:10, mana:45, color:'#fde047',
        desc:L('Baci koru od banane — tko je pogodi, oklizne se i padne', 'Throw a banana peel — whoever it hits slips and falls'),
        target:'point', castRange:650, line:true, lineFull:true, lineW:68,
        tip:rk => L('⚔️ ' + (35 + 25*rk) + ' štete + 💫 omama ' + (0.8 + 0.2*rk).toFixed(1) + ' s', '⚔️ ' + (35 + 25*rk) + ' damage + 💫 stun ' + (0.8 + 0.2*rk).toFixed(1) + ' s'),
        bot:{type:'shot', range:600},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:720, r:24, range:650, dmg:35 + 25*rk, color:'#fde047', emoji:'🍌',
            onHit:e => { applyStun(e, 0.8 + 0.2*rk); addFloat(e.x, e.y, L('🍌 Oklizn!', '🍌 Slip!'), '#fde047', 15); }});
        }},
      { key:'R', name:L('Majmunska vojska', 'Monkey Army'), emoji:'🐒', cd:80, mana:130, ult:true, color:'#f59e0b',
        desc:L('ULTI: Pozovi 3 majmuna koji se bore uz tebe!', 'ULT: Call 3 monkeys to fight by your side!'),
        tip:rk => L('🐒 3 majmuna (' + (260 + 140*rk) + ' života, ' + (22 + 14*rk) + ' štete) na ' + (12 + 3*rk) + ' s', '🐒 3 monkeys (' + (260 + 140*rk) + ' HP, ' + (22 + 14*rk) + ' damage) for ' + (12 + 3*rk) + ' s'),
        bot:{type:'ult-aoe', range:500},
        cast(u, aim, rk){
          const nM = hasTal(u, 'majmun_r4') ? 4 : 3;
          for(let i = 0; i < nM; i++){
            const a = i / nM * TAU + 0.7;
            makeSummon(u, { x:u.x + Math.cos(a) * 60, y:u.y + Math.sin(a) * 60,
              hp:260 + 140*rk, dmg:22 + 14*rk, life:12 + 3*rk, model:'hero_majmun', emoji:'🐒', name:L('Majmunčić', 'Little Monkey') });
          }
          burst(u.x, u.y, '#f59e0b', 24, 260, 6);
          return true;
        }},
    ],
  },
  /* ---------------- NOVI JUNACI (v0.10) ---------------- */
  {
    id:'vuk', name:LS('Sivko'), emoji:'🐺',
    role:L('🌕 Vuk — vođa čopora', '🌕 Wolf — pack leader'),
    hp:730, mp:230, dmg:70,
    attrs:{ str:24, agi:20, int:12, strG:5.4, agiG:3.2, intG:1.6, primary:'str' },
    range:82, speed:176, atkCd:1.05, projSpeed:0,
    passive:{ name:L('Čopor', 'Pack'), emoji:'🐾', color:'#cbd5e1', pid:'copor',
      desc:L('PASIVNO: brže napadaš i rane ti brže zacjeljuju', 'PASSIVE: you attack faster and your wounds heal faster'),
      tip:rk => L('⚡ +' + (12*rk) + '% brzine napada • 💚 +' + (2 + 2*rk) + ' života/s', '⚡ +' + (12*rk) + '% attack speed • 💚 +' + (2 + 2*rk) + ' HP/s') },
    abilities:[
      { key:'Q', name:L('Zavijanje', 'Howl'), emoji:'🌕', cd:11, mana:45, color:'#e2e8f0',
        desc:L('Zavij na mjesec — tvoj tim udara jače, a neprijatelji se od straha usporavaju', 'Howl at the moon — your team hits harder, and scared enemies slow down'),
        selfAoe:420,
        tip:rk => L('⚔️ tim +' + (20 + 12*rk) + ' štete 6 s • 🐌 neprijatelji usporeni 20% 3 s', '⚔️ team +' + (20 + 12*rk) + ' damage for 6 s • 🐌 enemies slowed 20% for 3 s'),
        bot:{type:'aoe-self', range:420},
        cast(u, aim, rk){
          for(const e of units){
            if(e.dead || e.removeMe || dist(u, e) > 420) continue;
            if(e.kind === 'hero' && e.team === u.team){ e.howlT = 6; e.howlDmg = 20 + 12*rk; }
            else if(e.team !== u.team && isSpellTarget(e)) applySlow(e, 0.2, 3);
          }
          ring(u.x, u.y, 420, '#e2e8f0');
          burst(u.x, u.y, '#e2e8f0', 16, 220, 5);
          return true;
        }},
      { key:'W', name:L('Ugriz', 'Bite'), emoji:'🦷', cd:8, mana:40, color:'#fca5a5',
        desc:L('Skoči na neprijatelja i ugrizi ga — rana krvari još 3 sekunde', 'Jump on an enemy and bite — the wound bleeds for 3 more seconds'),
        target:'point', castRange:300, line:true, lineW:50, aoe:110,
        tip:rk => L('⚔️ ' + (60 + 45*rk) + ' štete + 🩸 ' + (10 + 8*rk) + '/s na 3 s', '⚔️ ' + (60 + 45*rk) + ' damage + 🩸 ' + (10 + 8*rk) + '/s for 3 s'),
        bot:{type:'gap', range:300},
        cast(u, aim, rk){
          leapTo(u, aim, 300);
          const e = nearestEnemyOf(u, 110, x => isSpellTarget(x));
          if(e){ applyDamage(e, 60 + 45*rk, u); applyPoison(e, 10 + 8*rk, 3, u); addFloat(e.x, e.y, '🦷', '#fca5a5', 16); }
          burst(u.x, u.y, '#fca5a5', 12, 200, 5);
          return true;
        }},
      { key:'E', name:L('Divlje kandže', 'Wild Claws'), emoji:'💢', cd:12, mana:40, color:'#ef4444',
        desc:L('Naoštri kandže — sljedeća 3 napada jače udaraju i usporavaju', 'Sharpen your claws — your next 3 attacks hit harder and slow'),
        tip:rk => L('⚔️ sljedeća 3 napada +' + (30 + 25*rk) + ' štete i 🐌 usporenje 30%', '⚔️ next 3 attacks +' + (30 + 25*rk) + ' damage and 🐌 30% slow'),
        bot:{type:'haste', range:300},
        cast(u, aim, rk){
          u.clawHits = 3; u.clawDmg = 30 + 25*rk;
          addFloat(u.x, u.y - 30, L('💢 Kandže!', '💢 Claws!'), '#fca5a5', 15);
          burst(u.x, u.y, '#ef4444', 14, 160, 5);
          return true;
        }},
      { key:'R', name:L('Vučji oblik', 'Wolf Form'), emoji:'🐺', cd:75, mana:120, ult:true, color:'#94a3b8',
        desc:L('ULTI: Pretvori se u golemog vuka — puno brži i jači, a rane se zacijele', 'ULT: Turn into a giant wolf — much faster and stronger, and your wounds heal'),
        tip:rk => L('🐺 ' + (10 + 2*rk) + ' s: +35% brzine, ×' + (1.3 + 0.12*rk).toFixed(2) + ' štete • 💚 ' + (100 + 50*rk), '🐺 ' + (10 + 2*rk) + ' s: +35% speed, ×' + (1.3 + 0.12*rk).toFixed(2) + ' damage • 💚 ' + (100 + 50*rk)),
        bot:{type:'ult-aoe', range:500},
        cast(u, aim, rk){
          const d = 10 + 2*rk;
          u.status.formT = d;
          applyHaste(u, 1.35, d);
          u.status.dmgMulT = d; u.status.dmgMulF = 1.3 + 0.12*rk;
          heal(u, 100 + 50*rk);
          burst(u.x, u.y, '#94a3b8', 30, 300, 7);
          announce(L('🐺 Vučji oblik!', '🐺 Wolf Form!'), L(u.name + ' je postao golemi vuk!', u.name + ' became a giant wolf!'));
          return true;
        }},
    ],
  },
  {
    id:'gavran', name:LS('Mrak'), emoji:'🐦‍⬛',
    role:L('🌑 Gavran — mračni čarobnjak', '🌑 Raven — dark wizard'),
    hp:520, mp:340, dmg:50,
    attrs:{ str:17, agi:17, int:26, strG:3.2, agiG:2.4, intG:5.8, primary:'int' },
    range:360, speed:166, atkCd:1.1, projSpeed:640, shot:'feather',
    passive:{ name:L('Gavranovo pero', 'Raven Feather'), emoji:'🪶', color:'#ddd6fe', pid:'pero',
      desc:L('PASIVNO: pokoji napad ukrade neprijatelju manu i da je tebi', 'PASSIVE: some attacks steal mana from the enemy and give it to you'),
      tip:rk => L('🪶 25% šanse: 💧 ' + (20 + 15*rk) + ' mane ukradeno + ' + (15 + 10*rk) + ' štete', '🪶 25% chance: 💧 ' + (20 + 15*rk) + ' mana stolen + ' + (15 + 10*rk) + ' damage') },
    abilities:[
      { key:'Q', name:L('Kletva', 'Curse'), emoji:'🌀', cd:9, mana:55, color:'#a78bfa',
        desc:L('Baci kletvu na mjesto — ukleti primaju više štete od svega 5 sekundi', 'Cast a curse on a spot — cursed enemies take more damage from everything for 5 seconds'),
        target:'point', castRange:600, aoe:180,
        tip:rk => L('⚔️ ' + (45 + 36*rk) + ' štete + 🌀 +' + Math.round((0.15 + 0.05*rk) * 100) + '% primljene štete 5 s', '⚔️ ' + (45 + 36*rk) + ' damage + 🌀 +' + Math.round((0.15 + 0.05*rk) * 100) + '% damage taken for 5 s'),
        bot:{type:'zone', range:550},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 600);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 180 + e.r * 0.5) continue;
            applyCurse(e, 0.15 + 0.05*rk, 5);
            applyDamage(e, 45 + 36*rk, u);
          }
          ring(p.x, p.y, 180, '#a78bfa');
          burst(p.x, p.y, '#6d28d9', 16, 200, 5);
          return true;
        }},
      { key:'W', name:L('Zamjena', 'Swap'), emoji:'🔁', cd:14, mana:60, color:'#c4b5fd',
        desc:L('Zamijeni mjesto s neprijateljskim junakom — povuci ga k svojima!', 'Swap places with an enemy hero — pull them over to your team!'),
        target:'point', castRange:520, aoe:150,
        tip:rk => L('🔁 zamjena mjesta + ⚔️ ' + (40 + 30*rk) + ' štete + 🐌 usporenje 2 s', '🔁 swap places + ⚔️ ' + (40 + 30*rk) + ' damage + 🐌 slow for 2 s'),
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
      { key:'E', name:L('Pernata oluja', 'Feather Storm'), emoji:'🪶', cd:13, mana:70, color:'#6366f1',
        desc:L('Vihor oštrog perja kruži nad mjestom — ranjava i usporava sve u njemu', 'A whirl of sharp feathers spins over a spot — hurts and slows everyone in it'),
        target:'point', castRange:600, aoe:230,
        tip:rk => L('⚔️ 4 × ' + (25 + 18*rk) + ' štete + 🐌 usporenje 30%', '⚔️ 4 × ' + (25 + 18*rk) + ' damage + 🐌 30% slow'),
        bot:{type:'zone', range:550},
        cast(u, aim, rk){
          return spawnZone(u, aim, {castRange:600, r:230, delay:0.3, ticks:4, interval:0.6,
            dmg:25 + 18*rk, slow:{f:0.3, t:1}, color:'#6366f1', emoji:'🪶'});
        }},
      { key:'R', name:L('Jato gavranova', 'Raven Flock'), emoji:'🐦‍⬛', cd:80, mana:140, ult:true, color:'#4c1d95',
        desc:L('ULTI: Pozovi jato gavranova — kljucaju i ušutkavaju sve u krugu', 'ULT: Call a flock of ravens — they peck and silence everyone in the circle'),
        target:'point', castRange:650, aoe:300,
        tip:rk => L('⚔️ 6 × ' + (27 + 20*rk) + ' štete + 🤐 ušutkani', '⚔️ 6 × ' + (27 + 20*rk) + ' damage + 🤐 silenced'),
        bot:{type:'zone', range:600},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:300, delay:0.3, ticks:6, interval:0.7,
            dmg:27 + 20*rk, silence:1.0, castRange:650,
            color:'#4c1d95', emoji:'🐦‍⬛'});
        }},
    ],
  },
  {
    id:'hobotnica', name:LS('Pipko'), emoji:'🐙',
    role:L('🌊 Hobotnica — vladar dubina', '🌊 Octopus — ruler of the deep'),
    hp:740, mp:250, dmg:62,
    attrs:{ str:26, agi:14, int:14, strG:5.6, agiG:1.8, intG:2.0, primary:'str' },
    range:92, speed:160, atkCd:1.15, projSpeed:0,
    passive:{ name:L('Sluzava koža', 'Slimy Skin'), emoji:'💧', color:'#a5b4fc', pid:'sluz',
      desc:L('PASIVNO: tko te udari, oklizne se po sluzi i uspori', 'PASSIVE: whoever hits you slips on slime and slows down'),
      tip:rk => L('🐌 napadač usporen ' + Math.round((0.15 + 0.05*rk) * 100) + '% na 1.5 s', '🐌 attacker slowed ' + Math.round((0.15 + 0.05*rk) * 100) + '% for 1.5 s') },
    abilities:[
      { key:'Q', name:L('Mlaz tinte', 'Ink Jet'), emoji:'🖤', cd:8, mana:45, color:'#312e81',
        desc:L('Ispljuni tintu — pogođeni ne vidi dobro i promašuje napade', 'Spit ink — whoever is hit can\'t see well and misses attacks'),
        target:'point', castRange:650, line:true, lineFull:true, lineW:68,
        tip:rk => L('⚔️ ' + (45 + 35*rk) + ' štete + 😵 promašuje ' + Math.round((0.4 + 0.1*rk) * 100) + '% 3 s', '⚔️ ' + (45 + 35*rk) + ' damage + 😵 misses ' + Math.round((0.4 + 0.1*rk) * 100) + '% for 3 s'),
        bot:{type:'shot', range:600},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:620, r:24, range:650,
            dmg:45 + 35*rk, color:'#312e81', emoji:'🖤',
            onHit(e){ applyBlind(e, 0.4 + 0.1*rk, 3); }});
        }},
      { key:'W', name:L('Pipci', 'Tentacles'), emoji:'🐙', cd:10, mana:50, color:'#818cf8',
        desc:L('Ispruži pipke u pravcu — zgrabi neprijatelje i povuci ih k sebi', 'Stretch your tentacles in a line — grab enemies and pull them to you'),
        target:'point', castRange:380, line:true, lineW:160,
        tip:rk => L('⚔️ ' + (55 + 35*rk) + ' štete + povlačenje ' + (140 + 20*rk) + ' + 🐌 usporenje', '⚔️ ' + (55 + 35*rk) + ' damage + pull ' + (140 + 20*rk) + ' + 🐌 slow'),
        bot:{type:'shot', range:350},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 380);
          u.dir = Math.atan2(p.y - u.y, p.x - u.x);
          let n = 0;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distToSeg(e.x, e.y, u.x, u.y, p.x, p.y) <= 80 + e.r){
              applyDamage(e, 55 + 35*rk, u);
              pullToward(e, u.x, u.y, 140 + 20*rk);
              applySlow(e, 0.3, 2);
              n++;
            }
          }
          addLine(u.x, u.y, p.x, p.y, '#818cf8', 9, 0.3);
          burst(p.x, p.y, '#818cf8', 10, 160, 5);
          return true;
        }},
      { key:'E', name:L('Zagrljaj pipaka', 'Tentacle Hug'), emoji:'🫂', cd:13, mana:60, color:'#8b5cf6',
        desc:L('Pipcima zgrabi neprijatelje ispred sebe — ne mogu se micati i polako gube život', 'Grab enemies in front of you with your tentacles — they can\'t move and slowly lose health'),
        target:'point', castRange:320, aoe:140,
        tip:rk => L('🐙 drži ' + (1.4 + 0.3*rk).toFixed(1) + ' s + ⚔️ ' + (32 + 18*rk) + ' štete/s', '🐙 holds for ' + (1.4 + 0.3*rk).toFixed(1) + ' s + ⚔️ ' + (32 + 18*rk) + ' damage/s'),
        bot:{type:'zone', range:300},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 320), d = 1.4 + 0.3*rk;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 140 + e.r * 0.5) continue;
            pullToward(e, p.x, p.y, 40);
            applyRoot(e, d); applyDot(e, 32 + 18*rk, d, u);
            if(e.kind === 'hero') addFloat(e.x, e.y, '🐙', '#c4b5fd', 18);
          }
          ring(p.x, p.y, 140, '#8b5cf6');
          burst(p.x, p.y, '#a78bfa', 16, 160, 5);
          return true;
        }},
      { key:'R', name:L('Vrtlog dubina', 'Deep Whirlpool'), emoji:'🌀', cd:85, mana:140, ult:true, color:'#4f46e5',
        desc:L('ULTI: Golemi vrtlog povuče sve neprijatelje k tebi i omami ih', 'ULT: A giant whirlpool pulls all enemies to you and stuns them'),
        selfAoe:380,
        tip:rk => L('🌀 povlačenje + ⚔️ ' + (160 + 110*rk) + ' štete + omama ' + (1.2 + 0.3*rk).toFixed(1) + ' s', '🌀 pull + ⚔️ ' + (160 + 110*rk) + ' damage + stun ' + (1.2 + 0.3*rk).toFixed(1) + ' s'),
        bot:{type:'ult-aoe', range:350},
        cast(u, aim, rk){
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(dist(u, e) > 380 + e.r * 0.5) continue;
            pullToward(e, u.x, u.y, 170);
            applyDamage(e, 160 + 110*rk, u);
            applyStun(e, 1.2 + 0.3*rk);
          }
          ring(u.x, u.y, 380, '#4f46e5'); ring(u.x, u.y, 200, '#818cf8');
          burst(u.x, u.y, '#4f46e5', 36, 320, 7);
          return true;
        }},
    ],
  },
  {
    id:'nosorog', name:LS('Rogo'), emoji:'🦏',
    role:L('💥 Nosorog — nezaustavljivi jurišnik', '💥 Rhino — unstoppable charger'),
    hp:760, mp:220, dmg:72,
    attrs:{ str:27, agi:15, int:11, strG:6.4, agiG:2.0, intG:1.5, primary:'str' },
    range:86, speed:172, atkCd:1.15, projSpeed:0,
    passive:{ name:L('Debeli oklop', 'Thick Armor'), emoji:'🛡️', color:'#fde68a', pid:'tvrd',
      desc:L('PASIVNO: debela koža skida dio štete sa svakog udarca', 'PASSIVE: thick skin blocks some damage from every hit'),
      tip:rk => L('🛡️ −' + (4 + 4*rk) + ' štete na svaki udarac', '🛡️ −' + (4 + 4*rk) + ' damage from every hit') },
    abilities:[
      { key:'Q', name:L('Juriš', 'Charge'), emoji:'🏃', cd:13, mana:60, color:'#fbbf24',
        desc:L('Jurni ravno naprijed — prvi neprijatelj kojeg zakačiš odleti i omami se', 'Charge straight ahead — the first enemy you hit goes flying and gets stunned'),
        target:'point', castRange:900, line:true, lineW:68,
        tip:rk => L('🏃 juriš do 900 • ⚔️ ' + (70 + 50*rk) + ' štete + omama ' + (1.2 + 0.3*rk).toFixed(1) + ' s', '🏃 charge up to 900 • ⚔️ ' + (70 + 50*rk) + ' damage + stun ' + (1.2 + 0.3*rk).toFixed(1) + ' s'),
        bot:{type:'gap', range:900},
        cast(u, aim, rk){
          startCharge(u, aim, {range:900, speed:680, dmg:70 + 50*rk, stun:1.2 + 0.3*rk});
          return true;
        }},
      { key:'W', name:L('Udarac rogom', 'Horn Hit'), emoji:'🦏', cd:8, mana:40, color:'#f59e0b',
        desc:L('Zamahni rogom — neprijatelji oko tebe odlete unatrag', 'Swing your horn — enemies around you fly back'),
        selfAoe:180,
        tip:rk => L('⚔️ ' + (60 + 40*rk) + ' štete + odbačaj ' + (150 + 20*rk), '⚔️ ' + (60 + 40*rk) + ' damage + knockback ' + (150 + 20*rk)),
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
      { key:'E', name:L('Izazov', 'Challenge'), emoji:'📢', cd:15, mana:70, color:'#f97316',
        desc:L('Izazovi neprijatelje oko sebe — moraju napadati samo tebe, a ti dobiješ štit', 'Challenge nearby enemies — they must attack only you, and you get a shield'),
        selfAoe:280,
        tip:rk => L('📢 moraju te napadati ' + (1.6 + 0.3*rk).toFixed(1) + ' s • 🛡️ štit 30%', '📢 they must attack you for ' + (1.6 + 0.3*rk).toFixed(1) + ' s • 🛡️ 30% shield'),
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
      { key:'R', name:L('Bijes', 'Rage'), emoji:'😡', cd:70, mana:110, ult:true, color:'#ef4444',
        desc:L('ULTI: Pobjesni — napadaš brže, a svaki udarac kratko omami', 'ULT: Go wild — you attack faster, and every hit stuns briefly'),
        tip:rk => L('😡 ' + (7 + rk) + ' s: +40% brzine napada, omama ' + (0.3 + 0.1*rk).toFixed(1) + ' s po udarcu', '😡 ' + (7 + rk) + ' s: +40% attack speed, stun ' + (0.3 + 0.1*rk).toFixed(1) + ' s per hit'),
        bot:{type:'ult-aoe', range:300},
        cast(u, aim, rk){
          u.status.rageT = 7 + rk; u.status.rageStun = 0.3 + 0.1*rk;
          burst(u.x, u.y, '#ef4444', 26, 260, 6);
          return true;
        }},
    ],
  },
  {
    id:'panda', name:LS('Bambus'), emoji:'🐼',
    role:L('🎋 Panda — mirni majstor', '🎋 Panda — calm master'),
    hp:660, mp:300, dmg:65,
    attrs:{ str:23, agi:15, int:21, strG:5.2, agiG:2.0, intG:4.2, primary:'str' },
    range:88, speed:168, atkCd:1.1, projSpeed:0,
    passive:{ name:L('Bambus', 'Bamboo'), emoji:'🎋', color:'#86efac', pid:'bambus',
      desc:L('PASIVNO: žvakanje bambusa stalno obnavlja život i manu', 'PASSIVE: chewing bamboo keeps restoring health and mana'),
      tip:rk => L('💚 +' + (1.5 + rk) + ' života/s • 💧 +' + (0.5 + 0.5*rk) + ' mane/s', '💚 +' + (1.5 + rk) + ' HP/s • 💧 +' + (0.5 + 0.5*rk) + ' mana/s') },
    abilities:[
      { key:'Q', name:L('Grom-pljesak', 'Thunder Clap'), emoji:'👏', cd:10, mana:50, color:'#fde68a',
        desc:L('Pljesni šapama — grom zatrese sve oko tebe i uspori ih', 'Clap your paws — thunder shakes everyone around you and slows them'),
        selfAoe:260,
        tip:rk => L('⚔️ ' + (60 + 45*rk) + ' štete + 🐌 usporenje 35% 3 s', '⚔️ ' + (60 + 45*rk) + ' damage + 🐌 35% slow for 3 s'),
        bot:{type:'aoe-self', range:260},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 260, 60 + 45*rk, {slow:{f:0.35, t:3}, color:'#fde68a'});
          burst(u.x, u.y, '#fde68a', 20, 240, 6);
          return true;
        }},
      { key:'W', name:L('Vrtoglavica', 'Dizzy Spin'), emoji:'💫', cd:12, mana:55, color:'#f9a8d4',
        desc:L('Zavrti neprijatelje na mjestu — vrti im se u glavi pa promašuju', 'Spin enemies around — they get dizzy and miss'),
        target:'point', castRange:550, aoe:220,
        tip:rk => L('⚔️ ' + (30 + 20*rk) + ' štete + 😵 promašuju ' + Math.round((0.3 + 0.1*rk) * 100) + '% 4 s', '⚔️ ' + (30 + 20*rk) + ' damage + 😵 ' + Math.round((0.3 + 0.1*rk) * 100) + '% miss for 4 s'),
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
      { key:'E', name:L('Pijani korak', 'Wobbly Step'), emoji:'🥴', cd:16, mana:50, color:'#86efac',
        desc:L('Teturaj kao pijani majstor kung-fua — neprijateljski udarci te često promaše', 'Wobble like a kung-fu master — enemy hits often miss you'),
        tip:rk => L('🍃 ' + (25 + 10*rk) + '% šanse da izbjegneš udarac, ' + (4 + rk) + ' s', '🍃 ' + (25 + 10*rk) + '% chance to dodge a hit, ' + (4 + rk) + ' s'),
        bot:{type:'shield', range:400},
        cast(u, aim, rk){
          applyDodge(u, 0.25 + 0.1*rk, 4 + rk);
          addFloat(u.x, u.y - 30, L('🥴 Hik!', '🥴 Hic!'), '#bbf7d0', 15);
          burst(u.x, u.y, '#86efac', 14, 160, 5);
          return true;
        }},
      { key:'R', name:L('Tri pande', 'Three Pandas'), emoji:'🐼', cd:85, mana:140, ult:true, color:'#f59e0b',
        desc:L('ULTI: Pozovi tri male pande koje se bore uz tebe, a ti dobivaš štit', 'ULT: Call three little pandas to fight by your side, and you get a shield'),
        tip:rk => L('🐼 3 pande (' + (360 + 170*rk) + ' života, ' + (30 + 18*rk) + ' štete) ' + (12 + 3*rk) + ' s • 🛡️ štit 40% 6 s', '🐼 3 pandas (' + (360 + 170*rk) + ' HP, ' + (30 + 18*rk) + ' damage) for ' + (12 + 3*rk) + ' s • 🛡️ 40% shield for 6 s'),
        bot:{type:'ult-aoe', range:450},
        cast(u, aim, rk){
          const names = [L('Zemlja', 'Earth'), L('Oluja', 'Storm'), L('Vatra', 'Fire'), L('Bambus', 'Bamboo')];
          const nP = hasTal(u, 'panda_r4') ? 4 : 3;
          for(let i = 0; i < nP; i++){
            const a = i / nP * TAU + 0.4;
            makeSummon(u, { x:u.x + Math.cos(a) * 60, y:u.y + Math.sin(a) * 60,
              hp:360 + 170*rk, dmg:30 + 18*rk, life:12 + 3*rk, model:'hero_panda', emoji:'🐼', name:L('Panda ' + names[i], names[i] + ' Panda') });
          }
          applyShield(u, 0.4, 6);
          burst(u.x, u.y, '#f59e0b', 24, 260, 6);
          return true;
        }},
    ],
  },
  // ---- v0.15 ----
  {
    id:'jednorog', name:LS('Duga'), emoji:'🦄',
    role:L('🌈 Jednorog — čarobna pomagačica', '🌈 Unicorn — magical helper'),
    hp:575, mp:400, dmg:52,
    attrs:{ str:17, agi:15, int:26, strG:3.8, agiG:2.0, intG:5.6, primary:'int' },
    range:340, speed:170, atkCd:1.1, projSpeed:640, shot:'rainbow',
    passive:{ name:L('Čarobna griva', 'Magic Mane'), emoji:'✨', color:'#c4b5fd', pid:'griva',
      desc:L('PASIVNO: svi prijatelji oko tebe brže obnavljaju manu', 'PASSIVE: all friends around you regain mana faster'),
      tip:rk => L('💧 +' + (0.5 + 0.75*rk).toFixed(2) + ' mane/s prijateljima u krugu 450', '💧 +' + (0.5 + 0.75*rk).toFixed(2) + ' mana/s for friends within 450') },
    abilities:[
      { key:'Q', name:L('Dugin snop', 'Rainbow Beam'), emoji:'🌈', cd:8, mana:60, color:'#f0abfc',
        desc:L('Ispali dugu koja prolazi kroz sve neprijatelje na putu i uspori ih', 'Shoot a rainbow that goes through all enemies in its path and slows them'),
        target:'point', castRange:750, line:true, lineFull:true, lineW:80,
        tip:rk => L('⚔️ ' + (70 + 45*rk) + ' štete svima na putu + 🐌 usporenje', '⚔️ ' + (70 + 45*rk) + ' damage to all in its path + 🐌 slow'),
        bot:{type:'shot', range:700},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:820, r:30, range:750, pierce:true,
            dmg:70 + 45*rk, color:'#f0abfc', emoji:'🌈', slow:{f:0.3, t:2}});
        }},
      { key:'W', name:L('Ljekoviti rog', 'Healing Horn'), emoji:'💖', cd:14, mana:80, color:'#f9a8d4',
        desc:L('Rog zasja i izliječi tebe i sve prijatelje oko tebe', 'Your horn shines and heals you and all friends around you'),
        selfAoe:380,
        tip:rk => L('💖 +' + (90 + 55*rk) + ' života tebi i prijateljima oko tebe', '💖 +' + (90 + 55*rk) + ' HP for you and friends around you'),
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
      { key:'E', name:L('Dugin most', 'Rainbow Bridge'), emoji:'🌉', cd:16, mana:60, color:'#f0abfc',
        desc:L('Prošeći po dugi do novog mjesta — ti i prijatelji uz dugu dobijete brzinu', 'Walk along a rainbow to a new spot — you and friends along the rainbow get speed'),
        target:'point', castRange:550, line:true, lineW:60,
        tip:rk => L('🌈 skok do 550 + 🏃 +' + (20 + 8*rk) + '% brzine tebi i prijateljima uz dugu 3 s', '🌈 leap up to 550 + 🏃 +' + (20 + 8*rk) + '% speed for you and friends along the rainbow for 3 s'),
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
      { key:'R', name:L('Zvjezdani galop', 'Star Gallop'), emoji:'🌠', cd:80, mana:150, ult:true, color:'#fde047',
        desc:L('ULTI: Zvjezdani udar omami neprijatelje oko tebe, a cijeli tim ubrza i dobije štit', 'ULT: A star blast stuns enemies around you, and your whole team gets speed and a shield'),
        selfAoe:420,
        tip:rk => L('⚔️ ' + (100 + 60*rk) + ' štete + 💫 omama ' + (1 + 0.25*rk).toFixed(2) + ' s • tim: 🏃 brzina i 🛡️ štit 5 s', '⚔️ ' + (100 + 60*rk) + ' damage + 💫 stun ' + (1 + 0.25*rk).toFixed(2) + ' s • team: 🏃 speed and 🛡️ shield for 5 s'),
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
    id:'morskipas', name:L('Zubo', 'Zoobo'), emoji:'🦈',
    role:L('🦷 Morski pas — gladni lovac', '🦷 Shark — hungry hunter'),
    hp:600, mp:260, dmg:54,
    attrs:{ str:20, agi:24, int:12, strG:3.8, agiG:5.8, intG:1.8, primary:'agi' },
    range:90, speed:178, atkCd:1.0, projSpeed:0,
    passive:{ name:L('Miris krvi', 'Scent of Blood'), emoji:'🩸', color:'#f87171', pid:'krv',
      desc:L('PASIVNO: jače udaraš ranjene neprijatelje (ispod pola života)', 'PASSIVE: you hit hurt enemies harder (below half health)'),
      tip:rk => L('⚔️ +' + (12 + 12*rk) + '% štete po ranjenima', '⚔️ +' + (12 + 12*rk) + '% damage to hurt enemies') },
    abilities:[
      { key:'Q', name:L('Ugriz', 'Bite'), emoji:'🦷', cd:7, mana:45, color:'#ef4444',
        desc:L('Snažno ugrizi neprijatelje ispred sebe — krvare još nekoliko sekundi', 'Bite the enemies in front of you hard — they bleed for a few more seconds'),
        target:'point', castRange:230, aoe:140,
        tip:rk => L('⚔️ ' + (62 + 40*rk) + ' štete + 🩸 ' + (15 + 10*rk) + '/s krvarenja 4 s', '⚔️ ' + (62 + 40*rk) + ' damage + 🩸 ' + (15 + 10*rk) + '/s bleeding for 4 s'),
        bot:{type:'zone', range:200},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 230);
          u.dir = Math.atan2(p.y - u.y, p.x - u.x);
          let n = 0;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 140 + e.r * 0.5) continue;
            applyDamage(e, 62 + 40*rk, u);
            applyPoison(e, 15 + 10*rk, 4, u, L('🩸 Krvari!', '🩸 Bleeding!'));
            n++;
          }
          burst(p.x, p.y, '#ef4444', 14, 160, 5);
          if(n) addFloat(p.x, p.y, L('🦷 Ham!', '🦷 Chomp!'), '#fca5a5', 16);
          return true;
        }},
      { key:'W', name:L('Skok iz vode', 'Water Leap'), emoji:'🌊', cd:11, mana:55, color:'#38bdf8',
        desc:L('Skoči kao iz valova i zapljusni sve oko mjesta gdje padneš', 'Leap out like from the waves and splash everyone where you land'),
        target:'point', castRange:420, aoe:170,
        tip:rk => L('⚔️ ' + (50 + 35*rk) + ' štete gdje padneš + 🐌 usporenje 40% 2 s', '⚔️ ' + (50 + 35*rk) + ' damage where you land + 🐌 40% slow for 2 s'),
        bot:{type:'gap', range:420},
        cast(u, aim, rk){
          leapTo(u, aim, 420);
          damageCircle(u, u.x, u.y, 170, 50 + 35*rk, {slow:{f:0.4, t:2}, color:'#38bdf8'});
          burst(u.x, u.y, '#7dd3fc', 22, 220, 6);
          return true;
        }},
      { key:'E', name:L('Krvavi vrtlog', 'Blood Whirl'), emoji:'🌀', cd:9, mana:50, color:'#dc2626',
        desc:L('Zavrti se kao vrtlog zubi — sve oko tebe krvari', 'Spin like a whirl of teeth — everything around you bleeds'),
        selfAoe:220,
        tip:rk => L('⚔️ ' + (45 + 30*rk) + ' štete + 🩸 ' + (10 + 8*rk) + '/s krvarenja 3 s', '⚔️ ' + (45 + 30*rk) + ' damage + 🩸 ' + (10 + 8*rk) + '/s bleeding for 3 s'),
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
      { key:'R', name:L('Pomama', 'Frenzy'), emoji:'😤', cd:70, mana:110, ult:true, color:'#dc2626',
        desc:L('ULTI: Pobjesni! Napadaš puno brže, brže trčiš i svaki ugriz te liječi', 'ULT: Go wild! You attack much faster, run faster, and every bite heals you'),
        tip:rk => L('⚡ +40% brzine napada, 🏃 brzina, 💖 ' + (20 + 10*rk) + '% štete u život • ' + (6 + 1*rk) + ' s', '⚡ +40% attack speed, 🏃 speed, 💖 ' + (20 + 10*rk) + '% of damage as health • ' + (6 + 1*rk) + ' s'),
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
  // ---- v0.38: novi junaci ----
  {
    id:'nisan', name:L('Nišan', 'Nishan'), emoji:'🐿️',
    role:L('🎯 Vjeverica — snajperist (gađa izdaleka)', '🎯 Squirrel — sniper (shoots from far away)'),
    hp:500, mp:260, dmg:42,
    attrs:{ str:16, agi:24, int:15, strG:2.2, agiG:5.3, intG:2.4, primary:'agi' },
    range:410, speed:166, atkCd:1.15, projSpeed:1100, shot:'pellet',
    passive:{ name:L('Pogodak u glavu', 'Headshot'), emoji:'🎯', color:'#fbbf24', pid:'headshot',
      desc:L('PASIVNO: hitac ponekad pogodi "u glavu" — dodatna šteta, kratka omama i meta odleti malo unatrag', 'PASSIVE: a shot sometimes lands a "headshot" — extra damage, a short stun, and the target gets knocked back a bit'),
      tip:rk => L('🎯 ' + (20 + 4*rk) + '% šanse: +' + (16 + 16*rk) + ' štete, omama 0.15 s i odbačaj', '🎯 ' + (20 + 4*rk) + '% chance: +' + (16 + 16*rk) + ' damage, 0.15 s stun and knockback') },
    abilities:[
      { key:'Q', name:L('Kiša žirova', 'Acorn Rain'), emoji:'🌰', cd:14, mana:50, color:'#d97706',
        desc:L('Ispali kišu žirova na daleko mjesto — dugo pada, ranjava i usporava sve u krugu', 'Fire a rain of acorns at a faraway spot — it falls for a long time, hurting and slowing everyone in the circle'),
        target:'point', castRange:1400, aoe:300,
        tip:rk => L('⚔️ 8 × ' + (14 + 10*rk) + ' štete + 🐌 usporenje ' + (12 + 6*rk) + '% u krugu 300 (domet 1400)', '⚔️ 8 × ' + (14 + 10*rk) + ' damage + 🐌 ' + (12 + 6*rk) + '% slow in a 300 circle (range 1400)'),
        bot:{type:'zone', range:1150},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:300, delay:0.8, ticks:8, interval:1.0, castRange:1400,
            dmg:14 + 10*rk, slow:{f:0.12 + 0.06*rk, t:1.2}, color:'#d97706', emoji:'🌰'});
        }},
      { key:'W', name:L('Šišarka-bomba', 'Pinecone Bomb'), emoji:'💣', cd:13, mana:60, color:'#f97316',
        desc:L('Baci šišarku koja prasne — odbaci neprijatelje i uspori ih; stojiš li blizu, i tebe odbaci (bijeg!)', 'Throw a pinecone that pops — it knocks enemies back and slows them; if you stand close, it knocks you back too (escape!)'),
        target:'point', castRange:520, aoe:200,
        tip:rk => L('⚔️ ' + (50 + 30*rk) + ' štete + 💥 odbačaj + 🐌 usporenje 40% 2 s (i ti odletiš ako si blizu)', '⚔️ ' + (50 + 30*rk) + ' damage + 💥 knockback + 🐌 40% slow for 2 s (you fly too if you are close)'),
        bot:{type:'zone', range:450},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 520);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 200 + e.r * 0.5) continue;
            applyDamage(e, 50 + 30*rk, u); applySlow(e, 0.4, 2); knockback(e, p.x, p.y, 180);
          }
          if(distXY(p.x, p.y, u.x, u.y) < 230){ knockback(u, p.x, p.y, 260); addFloat(u.x, u.y - 20, L('💨 Juhu!', '💨 Wheee!'), '#fdba74', 15); }
          ring(p.x, p.y, 200, '#f97316');
          burst(p.x, p.y, '#fb923c', 26, 260, 7);
          return true;
        }},
      { key:'E', name:L('Durbin', 'Spyglass'), emoji:'🔭', cd:18, mana:40, color:'#7dd3fc',
        desc:L('Pogledaj kroz durbin — 6 sekundi gađaš puno dalje i brže', 'Look through your spyglass — for 6 seconds you shoot much farther and faster'),
        tip:rk => L('🔭 6 s: +' + (100 + 45*rk) + ' dometa napada i ⚡ +20% brzine napada', '🔭 6 s: +' + (100 + 45*rk) + ' attack range and ⚡ +20% attack speed'),
        bot:{type:'haste', range:820},
        cast(u, aim, rk){
          u.scopeT = 6; u.scopeR = 100 + 45*rk;
          applyAtkSpeed(u, 0.2, 6);
          addFloat(u.x, u.y - 30, L('🔭 Vidim te!', '🔭 I see you!'), '#bae6fd', 15);
          burst(u.x, u.y, '#7dd3fc', 14, 160, 5);
          return true;
        }},
      { key:'R', name:L('Savršen hitac', 'Perfect Shot'), emoji:'🔫', cd:60, mana:150, ult:true, color:'#ef4444',
        desc:L('ULTI: Nanišani neprijateljskog junaka izdaleka — nakon kratkog nišanjenja hitac ga uvijek pogodi', 'ULT: Aim at an enemy hero from far away — after a short aim, the shot always hits'),
        target:'point', castRange:2000, aoe:170,
        tip:rk => L('🎯 nišani 1.6 s, pa ⚔️ ' + (260 + 120*rk) + ' štete + omama 0.4 s (domet 2000)', '🎯 aims for 1.6 s, then ⚔️ ' + (260 + 120*rk) + ' damage + 0.4 s stun (range 2000)'),
        bot:{type:'snipe', range:1900},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 2000);
          let best = null, bd = 260;
          for(const e of units){
            if(e.kind !== 'hero' || e.team === u.team || e.dead || e.removeMe || !isVisibleTo(u.team, e)) continue;
            if(e.status.invisT > 0 && e.status.trackT <= 0) continue;
            const d = distXY(p.x, p.y, e.x, e.y); if(d < bd){ bd = d; best = e; }
          }
          if(!best) return false;
          const dmg = 260 + 120*rk + abBonus(u, 'R', 'dmg');
          startChannel(u, hasTal(u, 'nisan_r_fast') ? 0.8 : 1.6, best, t => {
            spawnHoming(u, t, { speed:2600, dmg, r:10, color:'#fde047', shot:'pellet', big:true,
              onHit(e){ applyStun(e, 0.4); burst(e.x, e.y, '#fde047', 30, 320, 8); addFloat(e.x, e.y, L('🎯 POGODAK!', '🎯 BULLSEYE!'), '#fde047', 20); } });
            sfxAt('pew', u.x, u.y);
          });
          addFloat(best.x, best.y, L('🎯 Nišani te!', '🎯 Aiming at you!'), '#fca5a5', 16);
          return true;
        }},
    ],
  },
  {
    id:'bikos', name:L('Bikoš', 'Bikosh'), emoji:'🐂',
    role:L('🪓 Bik ratnik — izaziva i sasiječe', '🪓 Bull warrior — taunts and chops'),
    hp:760, mp:210, dmg:62,
    attrs:{ str:26, agi:15, int:12, strG:5.8, agiG:1.8, intG:1.6, primary:'str' },
    range:90, speed:172, atkCd:1.15, projSpeed:0,
    passive:{ name:L('Bikovski vrtlog', 'Bull Spin'), emoji:'🌀', color:'#ef4444', pid:'helix',
      desc:L('PASIVNO: kad te netko udari, ponekad se zavrtiš sa sjekirom i raniš SVE oko sebe', 'PASSIVE: when someone hits you, sometimes you spin with your axe and hurt EVERYONE around you'),
      tip:rk => L('🌀 ' + (16 + 3*rk) + '% šanse kad te udare: ' + (60 + 35*rk) + ' štete svima u krugu 230', '🌀 ' + (16 + 3*rk) + '% chance when hit: ' + (60 + 35*rk) + ' damage to everyone within 230') },
    abilities:[
      { key:'Q', name:L('Bojni zov', 'Battle Call'), emoji:'🗯️', cd:13, mana:70, color:'#ef4444',
        desc:L('Zaurlaj na neprijatelje oko sebe — moraju napadati samo tebe, a ti dobiješ jaki oklop', 'Roar at nearby enemies — they must attack only you, and you get strong armor'),
        selfAoe:300,
        tip:rk => L('🗯️ moraju te napadati ' + (1.8 + 0.3*rk).toFixed(1) + ' s • 🛡️ +' + (12 + 4*rk) + ' oklopa', '🗯️ they must attack you for ' + (1.8 + 0.3*rk).toFixed(1) + ' s • 🛡️ +' + (12 + 4*rk) + ' armor'),
        bot:{type:'aoe-self', range:280},
        cast(u, aim, rk){
          const d = 1.8 + 0.3*rk;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || isStructure(e) || !isSpellTarget(e)) continue;
            if(dist(u, e) > 300 + e.r * 0.5) continue;
            applyTaunt(e, u, d);
          }
          u.armorBuffT = d; u.armorBuff = 12 + 4*rk;
          ring(u.x, u.y, 300, '#ef4444');
          burst(u.x, u.y, '#f87171', 22, 240, 6);
          return true;
        }},
      { key:'W', name:L('Ratna glad', 'Battle Hunger'), emoji:'🍖', cd:10, mana:60, color:'#f97316',
        desc:L('Probudi glad u neprijatelju — gubi život i sporiji je dok nekoga ne pobijedi; ti trčiš brže', 'Make an enemy hungry — they lose health and are slower until they defeat someone; you run faster'),
        target:'point', castRange:650, aoe:120,
        tip:rk => L('🍖 ' + (14 + 9*rk) + ' štete/s na 10 s + 🐌 12% • ti 🏃 +10% (prestaje kad on nekog pobijedi)', '🍖 ' + (14 + 9*rk) + ' damage/s for 10 s + 🐌 12% • you 🏃 +10% (ends when they defeat someone)'),
        bot:{type:'shot', range:620},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 650);
          let best = null, bd = 240;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e) || !isVisibleTo(u.team, e)) continue;
            const d = distXY(p.x, p.y, e.x, e.y) - (e.kind === 'hero' ? 80 : 0);
            if(d < bd){ bd = d; best = e; }
          }
          if(!best) return false;
          best.hungerT = 10; best.hungerDps = 14 + 9*rk + (hasTal(u, 'bikos_w_plus') ? 15 : 0); best.hungerSrc = u;
          applySlow(best, 0.12, 10);
          addFloat(best.x, best.y, L('🍖 Gladan!', '🍖 Hungry!'), '#fdba74', 15);
          addLine(u.x, u.y, best.x, best.y, '#f97316', 4, 0.3);
          return true;
        }},
      { key:'E', name:L('Bikovski skok', 'Bull Leap'), emoji:'🐂', cd:13, mana:55, color:'#fbbf24',
        desc:L('Skoči sa sjekirom na mjesto — udari i uspori sve gdje padneš', 'Leap with your axe to a spot — hit and slow everyone where you land'),
        target:'point', castRange:420, aoe:150,
        tip:rk => L('⚔️ ' + (55 + 35*rk) + ' štete + 🐌 usporenje 30% 1.5 s gdje padneš', '⚔️ ' + (55 + 35*rk) + ' damage + 🐌 30% slow for 1.5 s where you land'),
        bot:{type:'gap', range:420},
        cast(u, aim, rk){
          leapTo(u, aim, 420);
          damageCircle(u, u.x, u.y, 150, 55 + 35*rk, {slow:{f:0.3, t:1.5}, color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 20, 240, 6);
          return true;
        }},
      { key:'R', name:L('Smrtni udarac', 'Final Blow'), emoji:'🪓', cd:75, mana:120, ult:true, color:'#dc2626',
        desc:L('ULTI: Golemi zamah sjekirom — ranjenog neprijatelja odmah pobijedi! Uspije li, tvoj tim potrči brže, a ulti je opet spreman', 'ULT: A giant axe swing — instantly defeats a hurt enemy! If it works, your team runs faster and your ult is ready again'),
        target:'point', castRange:200, aoe:120,
        tip:rk => L('🪓 pobijedi junaka ispod ' + (250 + 75*rk) + ' života (inače ' + (150 + 100*rk) + ' štete) • tim 🏃 +30% 6 s', '🪓 defeats a hero below ' + (250 + 75*rk) + ' HP (otherwise ' + (150 + 100*rk) + ' damage) • team 🏃 +30% for 6 s'),
        bot:{type:'execute', range:220},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 260);
          let best = null, bd = 300;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e) || dist(u, e) > 200 + e.r + u.r + 40) continue;
            const d = distXY(p.x, p.y, e.x, e.y) - (e.kind === 'hero' ? 120 : 0);
            if(d < bd){ bd = d; best = e; }
          }
          if(!best) return false;
          u.dir = Math.atan2(best.y - u.y, best.x - u.x);
          const thr = 250 + 75*rk + (hasTal(u, 'bikos_r_plus') ? 150 : 0);
          if(best.hp <= thr && best.status.immuneT <= 0){
            addFloat(best.x, best.y - 20, L('🪓 SASJEČEN!', '🪓 CHOPPED!'), '#fca5a5', 22);
            burst(best.x, best.y, '#dc2626', 40, 360, 9);
            const wasHero = best.kind === 'hero';
            kill(best, u);
            if(wasHero){
              for(const e of units) if(e.kind === 'hero' && e.team === u.team && !e.dead && dist(u, e) < 900) applyHaste(e, 1.3, 6);
              u.cullRefresh = true;
              announce(L('🪓 SASJEČEN!', '🪓 CHOPPED!'), L(u.emoji + ' ' + u.name + ' je pobijedio jednim udarcem!', u.emoji + ' ' + u.name + ' took them down in one blow!'));
            }
          } else applyDamage(best, 150 + 100*rk, u);
          return true;
        }},
    ],
  },
  // ---- v0.55: novi junaci (Pudge, Drow Ranger i Sand King iz DotA) ----
  {
    id:'nilski', name:L('Pecko', 'Petsko'), emoji:'🦛',
    role:L('🪝 Nilski konj — udicom dovlači neprijatelje', '🪝 Hippo — reels enemies in with a hook'),
    hp:760, mp:230, dmg:60,
    attrs:{ str:25, agi:12, int:15, strG:5.4, agiG:1.6, intG:1.9, primary:'str' },
    range:85, speed:166, atkCd:1.15, projSpeed:0,
    passive:{ name:L('Gozba', 'Feast'), emoji:'🍉', color:'#f87171', pid:'gozba',
      desc:L('PASIVNO: kad neprijateljski junak padne blizu tebe, pojedeš lubenicu i zauvijek si jači (+snaga); debela koža smanjuje štetu od magija', 'PASSIVE: when an enemy hero falls near you, you eat a watermelon and get stronger forever (+strength); thick skin reduces magic damage'),
      tip:rk => L('🍉 +' + (1 + 0.5*rk).toFixed(1) + ' snage za svakog pobijeđenog junaka u blizini • ✨ −' + (4 + 3*rk) + '% štete od magija', '🍉 +' + (1 + 0.5*rk).toFixed(1) + ' strength for every enemy hero defeated near you • ✨ −' + (4 + 3*rk) + '% magic damage') },
    abilities:[
      { key:'Q', name:L('Udica', 'Hook'), emoji:'🪝', cd:14, mana:100, color:'#cbd5e1',
        desc:L('Baci udicu na lancu — prvog pogođenog neprijatelja dovuče skroz do tebe!', 'Throw a hook on a chain — the first enemy it hits gets reeled all the way to you!'),
        target:'point', castRange:1000, line:true, lineFull:true, lineW:56,
        tip:rk => L('⚔️ ' + (90 + 60*rk) + ' štete + 🪝 dovlačenje do tebe (domet 1000)', '⚔️ ' + (90 + 60*rk) + ' damage + 🪝 pulled all the way to you (range 1000)'),
        bot:{type:'hook', range:950},
        cast(u, aim, rk){
          const R = 1000 + (hasTal(u, 'nilski_q_far') ? 250 : 0);
          return spawnSkillshot(u, aim, {speed:1300, r:22, range:R, dmg:90 + 60*rk, color:'#cbd5e1', emoji:'🪝',
            onHit(e){
              dragTo(e, u, 1500);
              addFloat(e.x, e.y, L('🪝 Upecan!', '🪝 Hooked!'), '#e2e8f0', 16);
            }});
        }},
      { key:'W', name:L('Smrdljivi oblak', 'Stinky Cloud'), emoji:'🤢', cd:10, mana:35, color:'#84cc16',
        desc:L('Oko tebe se digne smrdljivi zeleni oblak — neprijatelji u njemu gube život i sporiji su (i tebi malo smrdi!)', 'A stinky green cloud rises around you — enemies in it lose health and slow down (it stinks a little for you too!)'),
        selfAoe:250,
        tip:rk => L('⚔️ ' + (18 + 12*rk) + ' štete/s + 🐌 ' + (20 + 5*rk) + '% usporenje u krugu 250 na 6 s • ti gubiš ' + (4 + rk) + '/s', '⚔️ ' + (18 + 12*rk) + ' damage/s + 🐌 ' + (20 + 5*rk) + '% slow within 250 for 6 s • you lose ' + (4 + rk) + '/s'),
        bot:{type:'aoe-self', range:250},
        cast(u, aim, rk){
          startCloud(u, { kind:'rot', t:6, r:250, dps:18 + 12*rk, slow:0.2 + 0.05*rk, self:4 + rk, color:'#84cc16' });
          burst(u.x, u.y, '#a3e635', 18, 200, 6);
          addFloat(u.x, u.y - 30, L('🤢 Fuj!', '🤢 Phew!'), '#bef264', 15);
          return true;
        }},
      { key:'E', name:L('Pojas za spas', 'Life Ring'), emoji:'🛟', cd:16, mana:60, color:'#fb923c',
        desc:L('Navuci pojas za spašavanje — 5 s primaš puno manje štete, a odmah se malo izliječiš', 'Put on your life ring — for 5 s you take much less damage, and you heal a bit right away'),
        tip:rk => L('🛡️ −' + (20 + 6*rk) + '% štete na 5 s + 💚 ' + (40 + 30*rk) + ' liječenja', '🛡️ −' + (20 + 6*rk) + '% damage for 5 s + 💚 ' + (40 + 30*rk) + ' healing'),
        bot:{type:'shield', range:450},
        cast(u, aim, rk){
          applyShield(u, 0.2 + 0.06*rk, 5);
          heal(u, 40 + 30*rk);
          ring(u.x, u.y, 120, '#fb923c');
          burst(u.x, u.y, '#fdba74', 14, 160, 5);
          return true;
        }},
      { key:'R', name:L('Veliki zalogaj', 'Big Gulp'), emoji:'😋', cd:70, mana:120, ult:true, color:'#f43f5e',
        desc:L('ULTI: Zgrabi neprijatelja uz sebe i "žvači" ga 3 sekunde — ne može se micati, gubi puno života, a ti se liječiš', 'ULT: Grab an enemy next to you and "chew" them for 3 seconds — they can\'t move, lose lots of health, and you heal'),
        target:'point', castRange:220, aoe:120,
        tip:rk => L('😋 ' + (60 + 35*rk) + ' štete/s na 3 s (ukupno ' + 3*(60 + 35*rk) + ') + omama • 💚 liječiš se pola štete', '😋 ' + (60 + 35*rk) + ' damage/s for 3 s (' + 3*(60 + 35*rk) + ' total) + stun • 💚 you heal for half the damage'),
        bot:{type:'grab', range:230},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 260);
          let best = null, bd = 300;
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e) || isStructure(e) || dist(u, e) > 220 + e.r + u.r) continue;
            if(e.kind === 'hero' && e.status.invisT > 0 && e.status.trackT <= 0) continue;
            const d = distXY(p.x, p.y, e.x, e.y) - (e.kind === 'hero' ? 120 : 0);
            if(d < bd){ bd = d; best = e; }
          }
          if(!best) return false;
          const dps = 60 + 35*rk, dur = 3 + (hasTal(u, 'nilski_r_long') ? 1 : 0);
          let acc = 0;
          startChannel(u, dur, best, null, { kind:'channel', msg:L('😋 Zalogaj prekinut!', '😋 Gulp interrupted!'),
            tick(t, dt){
              applyStun(t, 0.2);
              if(dist(u, t) > u.r + t.r + 30){ const q = stepToward(u, t, u.r + t.r + 20); t.x = q.x; t.y = q.y; }
              acc += dt;
              while(acc >= 0.5 && !t.dead){
                acc -= 0.5;
                const hp0 = t.hp;
                applyDamage(t, dps * 0.5, u);
                heal(u, Math.max(0, hp0 - t.hp) * 0.5);
                burst(t.x, t.y, '#fb7185', 6, 120, 4);
              }
            }});
          addFloat(best.x, best.y, L('😋 Njam!', '😋 Nom nom!'), '#fda4af', 18);
          return true;
        }},
    ],
  },
  {
    id:'irbis', name:L('Inja', 'Inya'), emoji:'🐆',
    role:L('❄️ Snježni leopard — ledena strijelkinja', '❄️ Snow leopard — frost archer'),
    hp:520, mp:250, dmg:46,
    attrs:{ str:16, agi:24, int:15, strG:2.0, agiG:5.4, intG:1.9, primary:'agi' },
    range:380, speed:168, atkCd:1.1, projSpeed:1000, shot:'arrow',   // ⚖️ simulacija: u 6 igara 101/29 — malo slabija
    passive:{ name:L('Aura preciznosti', 'Precision Aura'), emoji:'🎯', color:'#bae6fd', pid:'precizna',
      desc:L('PASIVNO: ti i prijatelji koji napadaju izdaleka (u krugu 900) udarate jače', 'PASSIVE: you and nearby friends who attack from range (within 900) hit harder'),
      tip:rk => L('🎯 +' + (3 + 2*rk) + '% štete napada tebi i prijateljima koji gađaju izdaleka', '🎯 +' + (3 + 2*rk) + '% attack damage for you and friends who attack from range') },
    abilities:[
      { key:'Q', name:L('Ledene strijele', 'Frost Arrows'), emoji:'❄️', cd:12, mana:45, color:'#7dd3fc',
        desc:L('Začaraj tobolac — 8 s svaka tvoja strijela je ledena: jače udara i jako usporava', 'Enchant your quiver — for 8 s every arrow is icy: it hits harder and slows a lot'),
        tip:rk => L('❄️ 8 s: +' + (8 + 6*rk) + ' štete i 🐌 ' + (18 + 5*rk) + '% usporenje po strijeli', '❄️ 8 s: +' + (8 + 6*rk) + ' damage and 🐌 ' + (18 + 5*rk) + '% slow per arrow'),
        bot:{type:'haste', range:520},
        cast(u, aim, rk){
          u.frostT = 8; u.frostDmg = 8 + 6*rk + (hasTal(u, 'irbis_q_plus') ? 15 : 0); u.frostSlow = 0.18 + 0.05*rk;
          addFloat(u.x, u.y - 30, L('❄️ Ledene strijele!', '❄️ Frost Arrows!'), '#bae6fd', 15);
          burst(u.x, u.y, '#bae6fd', 14, 160, 5);
          return true;
        }},
      { key:'W', name:L('Snježni nalet', 'Snow Gust'), emoji:'🌬️', cd:15, mana:75, color:'#e0f2fe',
        desc:L('Pošalji ledeni nalet vjetra — odgura neprijatelje i ušutka ih (ne mogu bacati moći)', 'Send an icy gust of wind — it pushes enemies back and silences them (they can\'t cast spells)'),
        target:'point', castRange:750, line:true, lineFull:true, lineW:180,
        tip:rk => L('⚔️ ' + (30 + 20*rk) + ' štete + 🤐 tišina ' + (1.5 + 0.5*rk).toFixed(1) + ' s + 💨 odbačaj', '⚔️ ' + (30 + 20*rk) + ' damage + 🤐 ' + (1.5 + 0.5*rk).toFixed(1) + ' s silence + 💨 knockback'),
        bot:{type:'shot', range:650},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:950, r:90, range:750, pierce:true, dmg:30 + 20*rk, color:'#e0f2fe', emoji:'🌬️',
            onHit(e, p){
              applySilence(e, 1.5 + 0.5*rk);
              knockback(e, e.x - p.vx, e.y - p.vy, 150);
              addFloat(e.x, e.y, '🤐', '#e0f2fe', 16);
            }});
        }},
      { key:'E', name:L('Lepeza strijela', 'Arrow Fan'), emoji:'🏹', cd:14, mana:70, color:'#93c5fd',
        desc:L('Ispali tri lepeze ledenih strijela ispred sebe — svaka pogođena meta je usporena', 'Fire three fans of icy arrows in front of you — everyone hit is slowed'),
        target:'point', castRange:650, line:true, lineW:300,
        tip:rk => L('⚔️ 3 vala × ' + (28 + 16*rk) + ' štete + 🐌 25% usporenje (po 5 strijela u valu)', '⚔️ 3 waves × ' + (28 + 16*rk) + ' damage + 🐌 25% slow (5 arrows per wave)'),
        bot:{type:'zone', range:600},
        cast(u, aim, rk){
          const dir = Math.atan2(aim.y - u.y, aim.x - u.x) || u.dir || 0;
          const waves = 3 + (hasTal(u, 'irbis_e_wave') ? 1 : 0), dmg = 28 + 16*rk;
          let el = 0, n = 0;
          const volley = () => {
            const hitIds = {};
            for(let k = -2; k <= 2; k++){
              const a = dir + k * 0.2;
              spawnSkillshot(u, { x: u.x + Math.cos(a) * 300, y: u.y + Math.sin(a) * 300 }, {speed:1050, r:16, range:650,
                dmg, slow:{f:0.25, t:1.5}, color:'#bae6fd', emoji:'🎯', hitIds});
            }
            n++;
          };
          volley();
          startChannel(u, 0.35 * (waves - 1) + 0.05, u, null, { kind:'channel', dir,
            tick(t, dt){ el += dt; while(n < waves && el >= 0.35 * n) volley(); }});
          return true;
        }},
      { key:'R', name:L('Majstorica luka', 'Master Archer'), emoji:'🎖️', cd:0, mana:0, ult:true, passive:true, color:'#38bdf8',
        desc:L('ULTI (PASIVNO): više okretnosti, a kad nijedan neprijateljski junak nije blizu (400), strijele ponekad probiju oklop i jako udare', 'ULT (PASSIVE): more agility, and when no enemy hero is close (400), arrows sometimes pierce armor and hit hard'),
        tip:rk => L('🤸 +' + (4 + 6*rk) + ' okretnosti • 🎯 ' + (20 + 5*rk) + '% šanse: +' + (30 + 25*rk) + ' štete (kad neprijatelj nije blizu)', '🤸 +' + (4 + 6*rk) + ' agility • 🎯 ' + (20 + 5*rk) + '% chance: +' + (30 + 25*rk) + ' damage (when no enemy is close)'),
        onLearn(u, rk){ u.agi += rk === 1 ? 10 : 6; recomputeAttrStats(u); },   // ⚖️ v0.55 simulacija: +10/16/22 (prvo +18/26/34 — Inja je bila najjača)
        cast(){ return false; }},
    ],
  },
  {
    id:'skorpion', name:L('Škorpo', 'Skorpo'), emoji:'🦂',
    role:L('🏜️ Škorpion — kralj pijeska', '🏜️ Scorpion — king of the sands'),
    hp:750, mp:270, dmg:57,
    attrs:{ str:23, agi:18, int:17, strG:5.1, agiG:2.0, intG:2.6, primary:'str' },   // ⚖️ simulacija: prvo je poginuo 2× češće nego što je pobijedio
    range:90, speed:168, atkCd:1.1, projSpeed:0,
    passive:{ name:L('Otrovni prasak', 'Venom Burst'), emoji:'🧪', color:'#a3e635', pid:'zalac',
      desc:L('PASIVNO: napadi i moći ubrizgaju otrov — padne li meta dok je otrovana, rasprsne se i rani sve oko sebe (a preživi li 4 s, malo prasne)', 'PASSIVE: attacks and spells inject venom — if the target falls while poisoned, it bursts and hurts everyone around it (if it survives 4 s, it pops a little)'),
      tip:rk => L('🧪 prasak ' + (30 + 30*rk) + ' štete u krugu 220 (pola ako meta preživi 4 s)', '🧪 burst ' + (30 + 30*rk) + ' damage within 220 (half if the target survives 4 s)') },
    abilities:[
      { key:'Q', name:L('Podzemni juriš', 'Burrow Strike'), emoji:'🕳️', cd:13, mana:100, color:'#d6a35c',
        desc:L('Zaroni pod pijesak i izleti dalje — sve neprijatelje na putu izbaci uvis i omami', 'Dive under the sand and pop out further on — every enemy in the way gets tossed up and stunned'),
        target:'point', castRange:600, line:true, lineW:180,
        tip:rk => L('⚔️ ' + (80 + 45*rk) + ' štete + omama ' + (0.9 + 0.15*rk).toFixed(2) + ' s svima na putu', '⚔️ ' + (80 + 45*rk) + ' damage + ' + (0.9 + 0.15*rk).toFixed(2) + ' s stun to everyone in the way'),
        bot:{type:'burrow', range:600},
        cast(u, aim, rk){
          const fx = u.x, fy = u.y;
          leapTo(u, aim, 600);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distToSeg(e.x, e.y, fx, fy, u.x, u.y) > 90 + e.r) continue;
            applyDamage(e, 80 + 45*rk, u); applyStun(e, 0.9 + 0.15*rk); applyCaustic(e, u);
            e.knockN = (e.knockN || 0) + 1;
          }
          addLine(fx, fy, u.x, u.y, '#d6a35c', 14, 0.6);
          burst(u.x, u.y, '#e7c27d', 22, 240, 6);
          return true;
        }},
      { key:'W', name:L('Pješčana oluja', 'Sandstorm'), emoji:'⏳', cd:18, mana:80, color:'#e2b86b',
        desc:L('Digni pješčanu oluju oko sebe — neprijatelji u njoj gube život, a tebe nitko ne vidi (dok ne napadneš)', 'Whip up a sandstorm around you — enemies inside lose health, and nobody can see you (until you attack)'),
        selfAoe:280,
        tip:rk => L('⚔️ ' + (25 + 15*rk) + ' štete/s u krugu 280 na 5 s + 👻 nevidljiv', '⚔️ ' + (25 + 15*rk) + ' damage/s within 280 for 5 s + 👻 invisible'),
        bot:{type:'aoe-self', range:280},
        cast(u, aim, rk){
          startCloud(u, { kind:'sand', t:5, r:280, dps:25 + 15*rk, slow:0.1, self:0, color:'#e2b86b' });
          u.status.invisT = Math.max(u.status.invisT, 5);
          burst(u.x, u.y, '#e7c27d', 24, 240, 7);
          return true;
        }},
      { key:'E', name:L('Žalac', 'Stinger'), emoji:'🦂', cd:9, mana:70, color:'#a3e635',
        desc:L('Ubodi repom izdaleka — rani, jako uspori i otruje sve u krugu', 'Sting with your tail from afar — it hurts, slows a lot and poisons everyone in the circle'),
        target:'point', castRange:700, aoe:170,
        tip:rk => L('⚔️ ' + (65 + 40*rk) + ' štete + 🐌 40% usporenje 2.5 s + 🧪 otrov', '⚔️ ' + (65 + 40*rk) + ' damage + 🐌 40% slow for 2.5 s + 🧪 venom'),
        bot:{type:'zone', range:650},
        cast(u, aim, rk){
          const p = clampRange(u, aim, 700);
          for(const e of units){
            if(e.team === u.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e)) continue;
            if(distXY(p.x, p.y, e.x, e.y) > 170 + e.r * 0.5) continue;
            applyDamage(e, 65 + 40*rk, u); applySlow(e, 0.4, 2.5); applyCaustic(e, u);
          }
          ring(p.x, p.y, 170, '#a3e635');
          burst(p.x, p.y, '#bef264', 18, 200, 6);
          return true;
        }},
      { key:'R', name:L('Epicentar', 'Epicenter'), emoji:'🌋', cd:80, mana:150, ult:true, color:'#f59e0b',
        desc:L('ULTI: Nakon kratkog zamaha zemlja se zatrese — sve veći udarni valovi oko tebe ranjavaju i usporavaju neprijatelje', 'ULT: After a short wind-up the ground shakes — ever bigger shockwaves around you hurt and slow enemies'),
        selfAoe:450,
        tip:rk => L('⏳ 1 s zamaha, pa ' + (6 + rk) + ' udara po ' + (35 + 20*rk) + ' štete + 🐌 30% (krug raste 250 → 450)', '⏳ 1 s wind-up, then ' + (6 + rk) + ' pulses of ' + (35 + 20*rk) + ' damage + 🐌 30% (circle grows 250 → 450)'),
        bot:{type:'ult-aoe', range:320},
        cast(u, aim, rk){
          const n = 6 + rk + (hasTal(u, 'skorpion_r_more') ? 3 : 0), dmg = 35 + 20*rk;
          startChannel(u, 1, u, () => {
            u.epi = { n, i: 0, t: 0, dmg };
            addFloat(u.x, u.y - 30, L('🌋 Epicentar!', '🌋 Epicenter!'), '#fcd34d', 18);
          }, { kind:'channel', msg:L('🌋 Epicentar prekinut!', '🌋 Epicenter interrupted!') });
          return true;
        }},
    ],
  },
];

/* 🎨 v0.55: ikone moći iz GPT Image 2.5 — assets/ab/<junak>_<P|Q|W|E|R|T>.jpg (P = urođena pasiva, T = talenti).
   Popis junaka koji ih imaju piše tools/art/dl.py kad preuzme i izreže slike; bez ikone igra crta emoji kao prije. */
const SPELL_ICONS = ['bikos', 'gavran', 'hobotnica', 'irbis', 'jednorog', 'jez', 'ledena', 'listko', 'luna', 'majmun', 'morskipas', 'munja', 'nilski', 'nisan', 'nosorog', 'orlina', 'panda', 'pcela', 'skokica', 'skorpion', 'slon', 'sova', 'strijela', 'tragac', 'vitez', 'vuk', 'zarko'];
function spellIconSrc(heroId, slot){ return SPELL_ICONS.includes(heroId) ? 'assets/ab/' + heroId + '_' + slot + '.jpg' : null; }

/* ---------------- DUĆAN S RECEPTIMA ---------------- */

/* ================= PREDMETI (kao u DotA) =================
   OSNOVNI predmeti se kupuju izravno; NADOGRADNJE se slažu iz dijelova + recept (cost = cijena recepta).
   stats: dmg, hp, mp, speed, hpRegen, mpRegen, str/agi/int (atributi), all (+svi atributi), primary (+glavni atribut),
          aspd (brzina napada u %), armor (oklop), lifesteal (krađa života 0–1), evasion (izbjegavanje 0–1)
   pasivno: crit {c, m}, bash {c, cr (daljinski), t, dmg}, cleave, creepDmg, hunt {dmg, heal, gold} (čudovišta), corrupt {a, t}, block {c, a},
            trueStrike, proc {c, dmg}, aura {armor, aspd, ls, mpRegen, r}, burn / burnR, wand
   v0.56: stats mres (otpor magiji 0–1), cdr (kraće hlađenje moći, ne zbraja se), amp (jačina magija);
          chain {c, dmg, n, r} (munja u lancu), cold {f, t} (ledeni udarci usporavaju), mburn {mp, f} (udarac pali manu),
          aktivno: razoružanje (disarmT), korijenje, tišina, nevidljivost, barijera
   Svaki predmet ima i "act" / "pas" (opis za tooltip) i "lore" (kratka priča). */
/* v0.56: neprijatelj najbliži kliku (u dometu predmeta) — za aktivne predmete s metom; heroOnly = samo junaci */
function itemTarget(h, aim, range, heroOnly){
  let best = null, bd = 260;
  for(const e of units){
    if(e.dead || e.removeMe || e.team === h.team || e.invuln || !isSpellTarget(e) || (heroOnly && e.kind !== 'hero') || dist(h, e) > range + 60) continue;
    if(e.kind === 'hero' && !isVisibleTo(h.team, e)) continue;
    const d = distXY(aim.x, aim.y, e.x, e.y); if(d < bd){ bd = d; best = e; }
  }
  return best;
}
const ITEMS = [
  // ======================= OSNOVNI =======================
  // ----- 🧪 potrošno -----
  { id:'tango',  emoji:'🌿', name:LS('Tango'), cat:'cons', cost:90, charges:3, consume:true, stats:{},
    act:L('Klikni na DRVO i pojedi ga: 16 s polako vraćaš 115 života (drvo nestane, izraste za 3 min)', 'Click a TREE and eat it: slowly restore 115 HP over 16 s (the tree disappears and grows back in 3 min)'), lore:L('Svježi listovi drveća — omiljena užina svakog junaka.', 'Fresh tree leaves — every hero\'s favorite snack.'),
    active:{ cd:1, mana:0, target:'tree', castRange:165,
      use(h, aim){
        const t = treeForUse(h, aim, 165, '🌿');
        if(!t) return false;
        cutTree(t, h);
        h.treesEaten = (h.treesEaten || 0) + 1;   // 🏆 postignuće Proždrljivac
        h.tangoT = 16; useCharge(h, 'tango');
        h.castAim = { x: t.x, y: t.y };
        if(isHuman(h)) addFloat(h.x, h.y - 20, L('🌿 Njam, njam!', '🌿 Yum, yum!'), '#86efac', 15, h.team);
        burst(h.x, h.y, '#86efac', 10, 120, 4);
        return true;
      } } },
  { id:'potion', emoji:'🧪', name:L('Ljekoviti melem', 'Healing Salve'), cat:'cons', cost:120, instant:true, heal:320, stats:{},
    act:L('Odmah vrati 320 života (ne zauzima torbu)', 'Instantly restores 320 HP (takes no inventory slot)'), lore:L('Gorko je, ali radi!', 'It\'s bitter, but it works!') },
  { id:'clarity', emoji:'💧', name:L('Bistrina', 'Clarity'), cat:'cons', cost:60, charges:1, consume:true, stats:{},
    act:L('Popij: 20 s polako vraćaš 150 mane — prekida je udarac neprijateljskog junaka', 'Drink: slowly restore 150 mana over 20 s — a hit from an enemy hero stops it'), lore:L('Kristalno čista voda iz planinskog izvora.', 'Crystal-clear water from a mountain spring.'),
    active:{ cd:1, mana:0, use(h){ h.clarityT = 20; useCharge(h, 'clarity'); burst(h.x, h.y, '#7dd3fc', 10, 120, 4); return true; } } },
  { id:'dust',   emoji:'🌫️', name:L('Prašina otkrivanja', 'Dust of Appearance'), cat:'cons', cost:90, charges:2, consume:true, stats:{},
    act:L('Otkrij nevidljive neprijatelje oko sebe (650) na 8 s', 'Reveal invisible enemies around you (650) for 8 s'), lore:L('Puhni i sve se vidi!', 'Blow it and everything shows up!'),
    active:{ cd:8, mana:0,
      use(h){
        let n = 0;
        for(const e of units){
          if(e.kind !== 'hero' || e.team === h.team || e.dead || dist(h, e) > 650) continue;
          if(e.status.invisT > 0){ addFloat(e.x, e.y, L('👀 Otkriven!', '👀 Revealed!'), '#fde047', 14); n++; }
          e.status.invisT = 0; e.noInvisT = 8;
        }
        useCharge(h, 'dust');
        ring(h.x, h.y, 650, '#e5e7eb'); burst(h.x, h.y, '#e5e7eb', 20, 240, 5);
        if(n === 0 && isHuman(h)) addFloat(h.x, h.y, L('🌫️ Nikoga skrivenog…', '🌫️ Nobody hiding…'), '#e5e7eb', 13);
        return true;
      } } },
  { id:'eye',    emoji:'👁️', name:L('Oko promatrač', 'Watcher Ward'), cat:'cons', cost:150, charges:2, consume:true, stats:{},
    act:L('Postavi oko koje 2 min gleda kroz maglu rata (domet 500)', 'Place a ward that sees through the fog of war for 2 min (range 500)'), lore:L('Nikad ne trepće.', 'It never blinks.'),
    active:{ cd:2, mana:0, target:'point', castRange:500,
      use(h, aim){
        const p = clampRange(h, aim, 500);
        wards.push({ x:p.x, y:p.y, r:400, team:h.team, t:120, owner:h });
        useCharge(h, 'eye');
        ring(p.x, p.y, 400, '#c4b5fd');
        return true;
      } } },
  { id:'bottle', emoji:'🍼', name:L('Boca', 'Bottle'), cat:'cons', cost:340, charges:3, stats:{},
    act:L('Gutljaj: +130 života i +70 mane (3 gutljaja, puni se kod fontane)', 'Sip: +130 HP and +70 mana (3 sips, refills at the fountain)'), lore:L('Nikad je ne zaboravi napuniti!', 'Never forget to refill it!'),
    active:{ cd:3, mana:0,
      use(h){
        if(itemCharges(h, 'bottle') <= 0){ if(isHuman(h)) addFloat(h.x, h.y, L('🍼 Boca je prazna — napuni je kod fontane!', '🍼 The bottle is empty — refill it at the fountain!'), '#e5e7eb', 13); return false; }
        useCharge(h, 'bottle'); heal(h, 130); h.mp = Math.min(h.maxmp, h.mp + 70);
        return true;
      } } },
  { id:'cheese', emoji:'🧀', name:L('Zmajev sir', 'Dragon\'s Cheese'), cat:'cons', cost:500, noShop:true, charges:1, consume:true, stats:{},
    act:L('Odmah +1500 života i +800 mane', 'Instantly +1500 HP and +800 mana'), lore:L('Dar Velikog Zmaja.', 'A gift from the Great Dragon.'),
    active:{ cd:1, mana:0, use(h){ heal(h, 1500); h.mp = Math.min(h.maxmp, h.mp + 800); useCharge(h, 'cheese'); burst(h.x, h.y, '#fde047', 26, 240, 6); return true; } } },
  // v0.56 ----- novo potrošno -----
  { id:'fairy',  emoji:'🧚', name:L('Vilinska vatra', 'Faerie Fire'), cat:'cons', cost:70, charges:1, consume:true, stats:{dmg:2},
    act:L('Odmah vrati 85 života (dok je u torbi: +2 štete)', 'Instantly restores 85 HP (while in your bag: +2 damage)'), lore:L('Mala vila koja te spasi u zadnji tren.', 'A tiny fairy that saves you at the last second.'),
    active:{ cd:1, mana:0, use(h){ heal(h, 85); useCharge(h, 'fairy'); burst(h.x, h.y, '#f9a8d4', 14, 150, 4); return true; } } },
  { id:'mango',  emoji:'🥭', name:L('Čarobni mango', 'Enchanted Mango'), cat:'cons', cost:65, charges:1, consume:true, stats:{hpRegen:0.6},
    act:L('Pojedi: odmah +100 mane', 'Eat it: instantly +100 mana'), lore:L('Sočan i pun čarolije.', 'Juicy and full of magic.'),
    active:{ cd:1, mana:0, use(h){ h.mp = Math.min(h.maxmp, h.mp + 100); useCharge(h, 'mango'); burst(h.x, h.y, '#fbbf24', 12, 140, 4); return true; } } },
  { id:'smoke',  emoji:'💨', name:L('Dimna bomba', 'Smoke Bomb'), cat:'cons', cost:50, charges:1, consume:true, stats:{},
    act:L('Ti i saveznički junaci u krugu 900 postanete nevidljivi na 12 s (+10% brzine) — za iznenadni napad; napad otkriva', 'You and allied heroes within 900 turn invisible for 12 s (+10% speed) — for a surprise attack; attacking reveals you'),
    lore:L('Puf! I nikoga nema.', 'Poof! And nobody is there.'),
    active:{ cd:1, mana:0,
      use(h){
        for(const e of units) if(e.kind === 'hero' && e.team === h.team && !e.dead && dist(h, e) <= 900){ e.status.invisT = Math.max(e.status.invisT, 12); applyHaste(e, 1.1, 12); }
        useCharge(h, 'smoke'); ring(h.x, h.y, 900, '#a1a1aa'); burst(h.x, h.y, '#d4d4d8', 30, 260, 8); return true;
      } } },
  // ----- 💪 atributi -----
  { id:'branch',    emoji:'🌱', name:L('Grančica', 'Branch'),          cat:'attr', cost:25,  stats:{all:1}, lore:L('Mala, ali korisna. Svaki junak kupi par na početku.', 'Small but useful. Every hero buys a couple at the start.') },
  { id:'gauntlets', emoji:'🧤', name:L('Rukavice snage', 'Gauntlets of Strength'),    cat:'attr', cost:70,  stats:{str:3}, lore:L('Teške kožne rukavice za jake šape.', 'Heavy leather gloves for strong paws.') },
  { id:'slippers',  emoji:'🥿', name:L('Papuče okretnosti', 'Slippers of Agility'), cat:'attr', cost:70,  stats:{agi:3}, lore:L('U njima se trči na prstima.', 'You run on tiptoe in them.') },
  { id:'mantle',    emoji:'🧣', name:L('Šal mudrosti', 'Scarf of Wisdom'),      cat:'attr', cost:70,  stats:{int:3}, lore:L('Grije glavu dok razmišljaš.', 'Keeps your head warm while you think.') },
  { id:'circlet',   emoji:'📿', name:L('Ogrlica', 'Necklace'),           cat:'attr', cost:80,  stats:{all:2}, lore:L('Sitne perle, mala čarolija.', 'Tiny beads, a little magic.') },
  { id:'belt',      emoji:'🎗️', name:L('Pojas snage', 'Belt of Strength'),       cat:'attr', cost:225, stats:{str:6}, lore:L('Steže trbuh i jača mišiće.', 'Hugs your tummy and builds muscles.') },
  { id:'band',      emoji:'🎀', name:L('Vilinska vrpca', 'Fairy Band'),    cat:'attr', cost:225, stats:{agi:6}, lore:L('Vile je pletu od paukove svile.', 'Fairies weave it from spider silk.') },
  { id:'robe',      emoji:'👘', name:L('Halja čarobnjaka', 'Wizard Robe'),  cat:'attr', cost:225, stats:{int:6}, lore:L('Puna zvjezdica i tajnih džepova.', 'Full of little stars and secret pockets.') },
  { id:'ogre',      emoji:'👹', name:L('Divovska sjekira', 'Giant Axe'),  cat:'attr', cost:500, stats:{str:10}, lore:L('Div ju je zaboravio pod mostom.', 'A giant forgot it under a bridge.') },
  { id:'alacrity',  emoji:'🍃', name:L('Oštrica hitrine', 'Blade of Alacrity'),   cat:'attr', cost:500, stats:{agi:10}, lore:L('Laka kao list na vjetru.', 'Light as a leaf in the wind.') },
  { id:'wizstaff',  emoji:'🔮', name:L('Štap čarobnjaka', 'Wizard\'s Staff'),   cat:'attr', cost:500, stats:{int:10}, lore:L('Kugla na vrhu šapuće čarolije.', 'The orb on top whispers spells.') },
  // ----- ⚔️ oprema -----
  { id:'quelling',  emoji:'⛏️', name:L('Sjekirica', 'Hatchet'),         cat:'equip', cost:50,  stats:{}, creepDmg:12, pas:L('+12 štete protiv vojnika i čudovišta', '+12 damage against creeps and monsters'), lore:L('Za drva — i za vojnike.', 'For wood — and for creeps.'),
    act:L('Posijeci drvo (domet 350) — otvori prolaz i pogled', 'Chop down a tree (range 350) — opens a path and a view'), active:{ cd:4, mana:0, target:'tree', castRange:350,
      use(h, aim){ const t = treeForUse(h, aim, 350, '⛏️'); if(!t) return false; cutTree(t, h); h.castAim = { x: t.x, y: t.y }; return true; } } },
  // 🐾 v0.56: prvi predmet junaka u džungli — jači protiv čudovišta, svaki udarac po čudovištu liječi, više zlata iz kampova
  { id:'hunter',    emoji:'🐾', name:L('Lovački nož', 'Hunter\'s Knife'),  cat:'equip', cost:200, stats:{hpRegen:1}, hunt:{ dmg:22, heal:9, gold:3 },
    pas:L('Protiv čudovišta iz džungle: +22 štete, svaki udarac te liječi 9 života i +3 zlata za svako ubijeno čudovište', 'Against jungle monsters: +22 damage, every hit heals you 9 HP and +3 gold for each monster killed'),
    lore:L('Prvi predmet junaka u džungli — s njim i Kaznom gušteri padaju već na levelu 1.', 'The jungler\'s first item — with it and Smite, lizards fall at level 1.') },
  { id:'sword',     emoji:'⚔️', name:L('Oštrice napada', 'Blades of Attack'),    cat:'equip', cost:225, stats:{dmg:9},  lore:L('Par malih, oštrih noževa.', 'A pair of small, sharp knives.') },
  { id:'broadsword',emoji:'🗡️', name:L('Široki mač', 'Broadsword'),        cat:'equip', cost:500, stats:{dmg:15}, lore:L('Vitezov vjerni drug.', 'A knight\'s loyal friend.') },
  { id:'claymore',  emoji:'🔪', name:L('Dvoručni mač', 'Claymore'),      cat:'equip', cost:675, stats:{dmg:20}, lore:L('Treba ga držati objema rukama.', 'You need both hands to hold it.') },
  { id:'mithril',   emoji:'⚒️', name:L('Mitrilni čekić', 'Mithril Hammer'),    cat:'equip', cost:800, stats:{dmg:24}, lore:L('Patuljci ga kuju tisuću godina.', 'Dwarves have been forging it for a thousand years.') },
  { id:'demonedge', emoji:'😈', name:L('Demonska oštrica', 'Demon Edge'),  cat:'equip', cost:1100, stats:{dmg:40}, lore:L('Reže i sjene.', 'It even cuts shadows.') },
  { id:'gloves',    emoji:'🥊', name:L('Rukavice brzine', 'Gloves of Haste'),   cat:'equip', cost:225, stats:{aspd:20}, lore:L('Udaraš brže nego što trepćeš.', 'You hit faster than you blink.') },
  { id:'ringprot',  emoji:'🔘', name:L('Prsten zaštite', 'Ring of Protection'),    cat:'equip', cost:90,  stats:{armor:2}, lore:L('Mali štit za prst.', 'A tiny shield for your finger.') },
  { id:'chainmail', emoji:'⛓️', name:L('Verižnjača', 'Chainmail'),        cat:'equip', cost:275, stats:{armor:4}, lore:L('Zvecka pri svakom koraku.', 'It jingles with every step.') },
  { id:'platemail', emoji:'🛡️', name:L('Oklop od ploča', 'Platemail'),    cat:'equip', cost:700, stats:{armor:10}, lore:L('Težak, ali ništa ne prolazi.', 'Heavy, but nothing gets through.') },
  { id:'morbid',    emoji:'👺', name:L('Vampirska maska', 'Vampire Mask'),   cat:'equip', cost:450, stats:{lifesteal:0.10}, lore:L('Svaki udarac te malo izliječi.', 'Every hit heals you a little.') },
  { id:'hyperstone',emoji:'💎', name:L('Hiperkamen', 'Hyperstone'),        cat:'equip', cost:1000, stats:{aspd:60}, lore:L('Kamen koji ne može mirovati.', 'A stone that can\'t sit still.') },
  { id:'staff',     emoji:'🦯', name:L('Borbeni štap', 'Quarterstaff'),   cat:'equip', cost:350, stats:{dmg:10, aspd:10}, lore:L('Lagan štap za brze udarce.', 'A light staff for quick hits.') },   // v0.56
  { id:'cloak',     emoji:'🧥', name:L('Ogrtač', 'Cloak'),                 cat:'equip', cost:400, stats:{mres:0.15}, lore:L('Debela tkanina koju magija teško probije.', 'Thick cloth that magic barely gets through.') },   // v0.56
  // ----- 🎒 razno -----
  { id:'boots',     emoji:'👟', name:L('Brze čizme', 'Speed Boots'),        cat:'misc', cost:250, stats:{speed:45}, tag:'boots', lore:L('Prve čizme svakog junaka.', 'Every hero\'s first boots.') },
  { id:'ringregen', emoji:'💚', name:L('Prsten obnove', 'Ring of Regen'),     cat:'misc', cost:90,  stats:{hpRegen:2}, lore:L('Rane zacjeljuju same.', 'Wounds heal by themselves.') },
  { id:'sage',      emoji:'🍵', name:L('Mudračev čaj', 'Sage\'s Tea'),      cat:'misc', cost:90,  stats:{mpRegen:1}, lore:L('Gutljaj čaja, i mana se vraća.', 'A sip of tea, and your mana comes back.') },
  { id:'heart',     emoji:'❤️', name:L('Kamen života', 'Vitality Stone'),      cat:'misc', cost:500, stats:{hp:250}, lore:L('Kuca kao pravo srce.', 'It beats like a real heart.') },
  { id:'orb',       emoji:'🔋', name:L('Kamen energije', 'Energy Stone'),    cat:'misc', cost:400, stats:{mp:250}, lore:L('Pun čarobne struje.', 'Full of magic power.') },
  { id:'pointbooster', emoji:'✨', name:L('Zvjezdani kristal', 'Star Crystal'), cat:'misc', cost:600, stats:{hp:175, mp:175}, lore:L('Pola život, pola mana.', 'Half health, half mana.') },
  { id:'windlace',   emoji:'🪶', name:L('Pero vjetra', 'Wind Lace'),      cat:'misc', cost:250, stats:{speed:20}, lore:L('Vjetar ti gura leđa.', 'The wind pushes your back.') },   // v0.56
  { id:'ringhealth', emoji:'💗', name:L('Prsten zdravlja', 'Ring of Health'), cat:'misc', cost:300, stats:{hpRegen:5}, lore:L('Rane zacijele dok trepneš.', 'Wounds heal in the blink of an eye.') },   // v0.56
  { id:'voidstone',  emoji:'🌌', name:L('Kamen praznine', 'Void Stone'),   cat:'misc', cost:300, stats:{mpRegen:2.5}, lore:L('Iz praznine stalno dotječe mana.', 'Mana keeps trickling in from the void.') },   // v0.56
  { id:'blink',     emoji:'⚡', name:L('Bodež treptaja', 'Blink Dagger'),    cat:'misc', cost:1125, stats:{},
    act:L('Treptaj: skoči do 1000 daleko • ne radi 3 s nakon udarca neprijateljskog junaka', 'Blink: jump up to 1000 away • doesn\'t work for 3 s after an enemy hero hits you'), lore:L('Trepneš — i već si tamo.', 'Blink — and you\'re already there.'),
    active:{ cd:13, mana:0, target:'point', castRange:1000,
      use(h, aim){
        if(gameTime - (h.lastHitT || -99) < 3){ if(isHuman(h)) addFloat(h.x, h.y, L('⚡ Bodež je zaključan — netko te udara!', '⚡ The dagger is locked — someone is hitting you!'), '#fca5a5', 13); return false; }
        leapTo(h, aim, 1000); burst(h.x, h.y, '#bae6fd', 16, 200, 5); return true;
      } } },
  // ----- 🔆 rijetko (kao tajna trgovina) -----
  { id:'reaver',    emoji:'☠️', name:L('Kosac', 'Reaver'),             cat:'secret', cost:1400, stats:{str:25}, lore:L('Golema kosa iz Tajne trgovine.', 'A huge scythe from the Secret Shop.') },
  { id:'eaglesong', emoji:'🦅', name:L('Orlova pjesma', 'Eaglesong'),     cat:'secret', cost:1400, stats:{agi:25}, lore:L('Pjesma koju samo orlovi znaju.', 'A song only eagles know.') },
  { id:'mystic',    emoji:'🌟', name:L('Mistični štap', 'Mystic Staff'),     cat:'secret', cost:1400, stats:{int:25}, lore:L('U njemu spava cijela galaksija.', 'A whole galaxy sleeps inside it.') },
  { id:'relic',     emoji:'🔆', name:L('Sveta relikvija', 'Sacred Relic'),   cat:'secret', cost:1700, stats:{dmg:60}, lore:L('Drevno blago čuvara hrama.', 'Ancient treasure of the temple guards.') },

  { id:'javelin',   emoji:'🏹', name:L('Koplje', 'Javelin'), cat:'secret', cost:700, stats:{dmg:20}, proc:{ c:0.25, dmg:40 },   // v0.56
    pas:L('25% šanse da udarac napravi još 40 čarobne štete', '25% chance for an attack to deal 40 extra magic damage'), lore:L('Uvijek pogodi tamo gdje boli.', 'Always hits where it hurts.') },
  // ======================= NADOGRADNJE =======================
  // ----- 🎒 pribor -----
  { id:'wand', emoji:'🎇', name:L('Čarobni štapić', 'Magic Wand'), cat:'acc', cost:175, components:['branch', 'branch'], stats:{all:3}, wand:true,
    pas:L('Skuplja naboj (do 20) kad neprijateljski junak u blizini baci magiju', 'Gains a charge (up to 20) when a nearby enemy hero casts a spell'),
    act:L('Isprazni: +15 života i +15 mane po naboju', 'Release: +15 HP and +15 mana per charge'), lore:L('Svaka tuđa čarolija ga napuni.', 'Other heroes\' spells fill it up.'),
    active:{ cd:13, mana:0,
      use(h){
        const n = itemCharges(h, 'wand');
        if(n <= 0){ if(isHuman(h)) addFloat(h.x, h.y, L('🎇 Štapić je prazan', '🎇 The wand is empty'), '#e5e7eb', 13); return false; }
        heal(h, 15 * n); h.mp = Math.min(h.maxmp, h.mp + 15 * n); h.itemCharges.wand = 0;
        burst(h.x, h.y, '#c4b5fd', 14, 160, 5); return true;
      } } },
  { id:'bracer',  emoji:'💪', name:L('Narukvica snage', 'Bracer'),  cat:'acc', cost:105, components:['circlet', 'gauntlets'], stats:{str:5, agi:2, int:2, dmg:3, hpRegen:1}, lore:L('Za junake koji vole biti naprijed.', 'For heroes who like to be in front.') },
  { id:'wraith',  emoji:'👻', name:L('Sablasna vrpca', 'Wraith Band'),   cat:'acc', cost:105, components:['circlet', 'slippers'],  stats:{agi:5, str:2, int:2, armor:1.5, aspd:5}, lore:L('Lagana kao duh.', 'Light as a ghost.') },
  { id:'nulltal', emoji:'🔵', name:L('Talisman mudrosti', 'Talisman of Wisdom'),cat:'acc', cost:105, components:['circlet', 'mantle'],    stats:{int:5, str:2, agi:2, mpRegen:1}, lore:L('Plavi kamen pun mira.', 'A blue stone full of calm.') },
  { id:'phase',   emoji:'🥾', name:L('Fazne čizme', 'Phase Boots'), cat:'acc', cost:0, components:['boots', 'chainmail', 'sword'], tag:'boots', stats:{speed:45, armor:4, dmg:12},
    act:L('Faza: +25% brzine kretanja na 3 s', 'Phase: +25% move speed for 3 s'), lore:L('Kroz neprijatelje kao kroz maglu.', 'Through enemies like through fog.'),
    active:{ cd:8, mana:0, use(h){ applyHaste(h, 1.25, 3); burst(h.x, h.y, '#93c5fd', 10, 140, 4); return true; } } },
  { id:'treads',  emoji:'👢', name:L('Čizme moći', 'Power Treads'), cat:'acc', cost:0, components:['boots', 'gloves', 'belt'], tag:'boots', stats:{speed:45, aspd:25, primary:10},
    pas:L('+10 glavnom atributu junaka', '+10 to the hero\'s main attribute'), lore:L('Svaki korak te čini jačim.', 'Every step makes you stronger.') },
  { id:'arcane',  emoji:'💠', name:L('Tajanstvene čizme', 'Arcane Boots'), cat:'acc', cost:0, components:['boots', 'orb'], tag:'boots', stats:{speed:45, mp:250},
    act:L('Val mane: ti i saveznici u krugu 1200 dobivate 160 mane', 'Mana wave: you and allies within 1200 get 160 mana'), lore:L('Mana teče iz potplata.', 'Mana flows from the soles.'),
    active:{ cd:55, mana:0,
      use(h){
        for(const e of units) if(e.kind === 'hero' && e.team === h.team && !e.dead && dist(h, e) <= 1200){ e.mp = Math.min(e.maxmp, e.mp + 160); addFloat(e.x, e.y, '+160 💧', '#7dd3fc', 13); }
        ring(h.x, h.y, 1200, '#7dd3fc'); burst(h.x, h.y, '#7dd3fc', 20, 220, 5); return true;
      } } },
  { id:'midas',   emoji:'✋', name:L('Midasova ruka', 'Hand of Midas'), cat:'acc', cost:875, components:['gloves'], stats:{aspd:40},
    act:L('Zlatni dodir: pretvori vojnika ili čudovište (ne zmaja) u zlato — +90 zlata i puno iskustva (domet 600)', 'Golden touch: turn a creep or monster (not a dragon) into gold — +90 gold and lots of XP (range 600)'), lore:L('Sve što dotakne postane zlato.', 'Everything it touches turns to gold.'),
    active:{ cd:90, mana:0, target:'point', castRange:600,
      use(h, aim){
        let best = null, bd = 220;
        for(const e of units){
          if(e.dead || e.removeMe || e.team === h.team || e.boss || (e.kind !== 'creep' && e.kind !== 'neutral') || dist(h, e) > 650) continue;
          const d = distXY(aim.x, aim.y, e.x, e.y); if(d < bd){ bd = d; best = e; }
        }
        if(!best){ if(isHuman(h)) addFloat(h.x, h.y, L('✋ Nema vojnika za zlatni dodir', '✋ No creep for the golden touch'), '#e5e7eb', 13); return false; }
        const xp = (best.xpValue || CFG.creepXp) * 1.5;
        burst(best.x, best.y, '#fde047', 24, 200, 6);
        kill(best, h);
        h.gold += 90; giveXp(h, xp);
        if(isHuman(h)) addFloat(best.x, best.y, '✋ +90 💰', '#fde047', 16);
        return true;
      } } },
  { id:'soulring',emoji:'💍', name:L('Prsten duše', 'Soul Ring'), cat:'acc', cost:125, components:['ringregen', 'gauntlets', 'gauntlets'], stats:{str:6, hpRegen:2},
    act:L('Žrtva: daj 170 života i dobij 150 mane', 'Sacrifice: give 170 HP and get 150 mana'), lore:L('Malo boli, ali mana je tu!', 'It hurts a little, but here comes the mana!'),
    active:{ cd:25, mana:0,
      use(h){ h.hp = Math.max(1, h.hp - 170); h.mp = Math.min(h.maxmp, h.mp + 150); addFloat(h.x, h.y, '💍 +150 💧', '#c4b5fd', 14); burst(h.x, h.y, '#a855f7', 12, 140, 4); return true; } } },
  { id:'mom',     emoji:'🎭', name:L('Maska ludila', 'Mask of Madness'), cat:'acc', cost:0, components:['morbid', 'gloves'], stats:{dmg:10, aspd:20, lifesteal:0.15},
    act:L('Bijes: 6 s +100% brzine napada i +20% kretanja, ali primaš +25% štete', 'Rage: +100% attack speed and +20% move speed for 6 s, but you take +25% damage'), lore:L('Kad je staviš, ne možeš prestati udarati.', 'Once you put it on, you can\'t stop hitting.'),
    active:{ cd:16, mana:25,
      use(h){ applyAtkSpeed(h, 1.0, 6); applyHaste(h, 1.2, 6); applyCurse(h, 0.25, 6); burst(h.x, h.y, '#ef4444', 14, 160, 5); addFloat(h.x, h.y, L('🎭 Bijes!', '🎭 Rage!'), '#fca5a5', 15); return true; } } },
  { id:'machete', emoji:'🍖', name:L('Lovačka mačeta', 'Hunter\'s Machete'), cat:'acc', cost:200, components:['hunter', 'broadsword'], stats:{dmg:18, hpRegen:3},   // v0.56
    hunt:{ dmg:45, heal:16, gold:5 },
    pas:L('Protiv čudovišta iz džungle: +45 štete, svaki udarac liječi 16 života i +5 zlata za svako ubijeno čudovište', 'Against jungle monsters: +45 damage, every hit heals 16 HP and +5 gold for each monster killed'),
    lore:L('Lovački nož je narastao — sad i veliki kampovi padaju brzo.', 'The Hunter\'s Knife grew up — now big camps fall fast too.') },
  // ----- 🤝 podrška -----
  { id:'mek',  emoji:'🏅', name:L('Ljekoviti medaljon', 'Healing Medallion'), cat:'sup', cost:450, components:['ringregen', 'chainmail'], stats:{armor:4, hpRegen:3},
    act:L('Izliječi sebe i saveznike u krugu 1200 za 275 života', 'Heal yourself and allies within 1200 for 275 HP'), lore:L('Zlatni medaljon starog iscjelitelja.', 'The golden medallion of an old healer.'),
    active:{ cd:50, mana:100,
      use(h){
        for(const e of units) if(e.team === h.team && !e.dead && !e.removeMe && (e.kind === 'hero' || e.kind === 'creep') && dist(h, e) <= 1200) heal(e, 275);
        ring(h.x, h.y, 1200, '#4ade80'); burst(h.x, h.y, '#4ade80', 24, 240, 6); return true;
      } } },
  { id:'drum', emoji:'🥁', name:L('Bubanj izdržljivosti', 'Drum of Endurance'), cat:'sup', cost:325, components:['circlet', 'belt'], stats:{str:8, agi:2, int:2, speed:10},
    act:L('Ratni bubanj: ti i saveznici u krugu 1200 dobivate +25% brzine kretanja i +30% brzine napada na 6 s', 'War drum: you and allies within 1200 get +25% move speed and +30% attack speed for 6 s'), lore:L('Bum! Bum! Svi trče brže!', 'Boom! Boom! Everyone runs faster!'),
    active:{ cd:30, mana:0,
      use(h){
        for(const e of units) if(e.kind === 'hero' && e.team === h.team && !e.dead && dist(h, e) <= 1200){ applyHaste(e, 1.25, 6); applyAtkSpeed(e, 0.3, 6); }
        ring(h.x, h.y, 1200, '#fb923c'); burst(h.x, h.y, '#fb923c', 18, 220, 5); return true;
      } } },
  { id:'vlad', emoji:'🩸', name:L('Vladimirov dar', 'Vladmir\'s Offering'), cat:'sup', cost:175, components:['morbid', 'ringprot', 'sage'], stats:{armor:2, mpRegen:1},
    aura:{ ls:0.15, armor:3, mpRegen:1, r:900 }, pas:L('Aura (900): saveznički junaci kradu 15% života udarcima, +3 oklopa, +1 obnova mane', 'Aura (900): allied heroes get 15% lifesteal, +3 armor, +1 mana regen'), lore:L('Stari knez dijeli snagu sa svojom vojskom.', 'An old prince shares his strength with his army.') },
  { id:'buckler', emoji:'🥏', name:L('Štitić', 'Buckler'), cat:'sup', cost:150, components:['ringprot', 'branch', 'branch'], stats:{armor:3, all:2},   // v0.56
    aura:{ armor:2, r:900 }, pas:L('Aura: saveznici u krugu 900 dobivaju +2 oklopa', 'Aura: allies within 900 get +2 armor'), lore:L('Mali štit, velika pomoć.', 'Small shield, big help.') },
  { id:'glimmer', emoji:'💫', name:L('Svjetlucavi plašt', 'Glimmer Cape'), cat:'sup', cost:250, components:['cloak', 'gloves'], stats:{mres:0.15, aspd:20},   // v0.56
    act:L('Klikni saveznika (ili sebe): 5 s je nevidljiv i ima štit od 250 štete', 'Click an ally (or yourself): invisible for 5 s and a shield that absorbs 250 damage'), lore:L('Svjetluca — i nestaneš.', 'It glimmers — and you vanish.'),
    active:{ cd:16, mana:90, target:'point', castRange:600,
      use(h, aim){
        let t = h, bd = 200;
        for(const e of units){
          if(e.kind !== 'hero' || e.team !== h.team || e.dead || dist(h, e) > 660) continue;
          const d = distXY(aim.x, aim.y, e.x, e.y); if(d < bd){ bd = d; t = e; }
        }
        t.status.invisT = Math.max(t.status.invisT, 5); t.barrierHp = Math.max(t.barrierHp || 0, 250); t.barrierT = 5;
        addFloat(t.x, t.y, L('✨ Svjetlucanje!', '✨ Glimmer!'), '#c4b5fd', 15); burst(t.x, t.y, '#ddd6fe', 18, 180, 5); return true;
      } } },
  { id:'pipe', emoji:'🎺', name:L('Lula uvida', 'Pipe of Insight'), cat:'sup', cost:350, components:['hood', 'sage', 'ringprot'], stats:{hpRegen:9, mpRegen:1, armor:2, mres:0.3},   // v0.56
    act:L('Ti i saveznički junaci u krugu 1200 dobivate štit od 300 štete na 10 s', 'You and allied heroes within 1200 get a shield that absorbs 300 damage for 10 s'), lore:L('Jedna pjesma — i cijeli tim je zaštićen.', 'One tune — and the whole team is protected.'),
    active:{ cd:60, mana:100,
      use(h){
        for(const e of units) if(e.kind === 'hero' && e.team === h.team && !e.dead && dist(h, e) <= 1200){ e.barrierHp = Math.max(e.barrierHp || 0, 300); e.barrierT = 10; }
        ring(h.x, h.y, 1200, '#93c5fd'); burst(h.x, h.y, '#bfdbfe', 24, 240, 6); return true;
      } } },
  { id:'greaves', emoji:'🧦', name:L('Čuvarske čizme', 'Guardian Greaves'), cat:'sup', cost:450, components:['arcane', 'mek'], stats:{speed:50, mp:250, armor:4, hpRegen:3},   // v0.56
    aura:{ armor:3, mpRegen:1.5, r:900 }, pas:L('Aura: saveznici u krugu 900 dobivaju +3 oklopa i +1.5 obnove mane', 'Aura: allies within 900 get +3 armor and +1.5 mana regen'),
    act:L('Izliječi sebe i saveznike u krugu 1200 za 300 života i 150 mane i skini im usporenja', 'Heal yourself and allies within 1200 for 300 HP and 150 mana and remove their slows'), lore:L('Čizme koje čuvaju cijeli tim.', 'Boots that guard the whole team.'),
    active:{ cd:45, mana:0,
      use(h){
        for(const e of units) if(e.team === h.team && !e.dead && !e.removeMe && (e.kind === 'hero' || e.kind === 'creep') && dist(h, e) <= 1200){
          heal(e, 300); if(e.maxmp) e.mp = Math.min(e.maxmp, e.mp + 150); if(e.kind === 'hero'){ e.status.slowT = 0; e.status.poisonT = 0; }
        }
        ring(h.x, h.y, 1200, '#86efac'); burst(h.x, h.y, '#bbf7d0', 26, 260, 6); return true;
      } } },
  // ----- 🔮 čarolije -----
  { id:'force', emoji:'🌬️', name:L('Štap sile', 'Force Staff'), cat:'magic', cost:450, components:['wizstaff', 'ringregen'], stats:{int:10, hpRegen:2.5},
    act:L('Silovit vjetar: odgurne te 600 u smjeru klika', 'Mighty wind: pushes you 600 toward where you click'), lore:L('Vjetar u leđa — doslovno.', 'Wind at your back — for real.'),
    active:{ cd:19, mana:50, target:'point', castRange:600,
      use(h, aim){
        const a = Math.atan2(aim.y - h.y, aim.x - h.x);
        leapTo(h, { x: h.x + Math.cos(a) * 600, y: h.y + Math.sin(a) * 600 }, 600);
        burst(h.x, h.y, '#bae6fd', 14, 180, 5); return true;
      } } },
  { id:'euls', emoji:'🌪️', name:L('Vjetrovita palica', 'Wind Scepter'), cat:'magic', cost:375, components:['wizstaff', 'sage'], stats:{int:10, mpRegen:2.5, speed:20},
    act:L('Vihor: podigne neprijatelja u zrak na 2.5 s (ne može ništa, ali ni primati štetu) • klik na sebe = očisti usporenja i otrove (domet 575)', 'Cyclone: lifts an enemy into the air for 2.5 s (can\'t do anything, but can\'t take damage either) • click yourself = clear slows and poisons (range 575)'), lore:L('Mali tornado u boci.', 'A little tornado in a bottle.'),
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
        if(best.kind === 'hero') addFloat(best.x, best.y, L('🌪️ U zraku!', '🌪️ In the air!'), '#e0f2fe', 15);
        burst(best.x, best.y, '#e0f2fe', 16, 180, 5); return true;
      } } },
  { id:'dagon', emoji:'🔱', name:LS('Dagon'), cat:'magic', cost:625, components:['wizstaff', 'nulltal'], stats:{int:15, str:2, agi:2, mpRegen:1},
    act:L('Energetski udar: 400 štete neprijatelju kod klika (domet 700)', 'Energy burst: 400 damage to the enemy you click (range 700)'), lore:L('Zraka čiste energije — ZAP!', 'A beam of pure energy — ZAP!'),
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
  { id:'refresher', emoji:'🔄', name:L('Kugla osvježenja', 'Refresher Orb'), cat:'magic', cost:900, components:['pointbooster', 'ringregen', 'sage'], stats:{hp:175, mp:175, hpRegen:5, mpRegen:3},
    act:L('Osvježi: sve tvoje moći su odmah spremne', 'Refresh: all your abilities are ready right away'), lore:L('Kao da počinješ ispočetka!', 'It\'s like starting over!'),
    active:{ cd:180, mana:250,
      use(h){ for(const ab of h.abilities) ab.cd = 0; burst(h.x, h.y, '#a5f3fc', 24, 220, 6); addFloat(h.x, h.y, L('🔄 Moći spremne!', '🔄 Abilities ready!'), '#a5f3fc', 15); return true; } } },
  { id:'shiva', emoji:'❄️', name:L('Ledeni štit', 'Ice Shield'), cat:'magic', cost:325, components:['platemail', 'mystic'], stats:{armor:15, int:25},
    act:L('Ledeni val (700): 200 štete i 40% usporenja na 4 s svim neprijateljima', 'Ice wave (700): 200 damage and 40% slow for 4 s to all enemies'), lore:L('Hladnoća sjevernih planina.', 'The cold of the northern mountains.'),
    active:{ cd:30, mana:100,
      use(h){
        for(const e of units){
          if(e.team === h.team || e.dead || e.removeMe || e.invuln || !isSpellTarget(e) || dist(h, e) > 700) continue;
          applyDamage(e, 200, h, true); applySlow(e, 0.4, 4);
        }
        ring(h.x, h.y, 700, '#bae6fd'); burst(h.x, h.y, '#e0f2fe', 30, 320, 6); return true;
      } } },
  { id:'kaya', emoji:'📘', name:L('Kaja', 'Kaya'), cat:'magic', cost:300, components:['wizstaff', 'robe'], stats:{int:16, mpRegen:1, amp:0.1},   // v0.56
    lore:L('Knjiga koja pojačava svaku čaroliju.', 'A book that makes every spell stronger.') },
  { id:'octarine', emoji:'🟣', name:L('Oktarinska jezgra', 'Octarine Core'), cat:'magic', cost:500, components:['mystic', 'pointbooster'], stats:{int:25, hp:175, mp:175, cdr:0.25},   // v0.56
    lore:L('Srce čarobnjaka: moći se brže vraćaju.', 'A wizard\'s heart: abilities come back faster.') },
  { id:'orchid', emoji:'🟪', name:L('Orhideja zloće', 'Orchid Malevolence'), cat:'magic', cost:425, components:['wizstaff', 'gloves', 'voidstone'], stats:{int:12, aspd:30, mpRegen:3, dmg:10},   // v0.56
    act:L('Tišina: neprijateljski junak 4 s ne može bacati moći (domet 900)', 'Silence: an enemy hero can\'t cast abilities for 4 s (range 900)'), lore:L('Lijep cvijet — opasan miris.', 'A pretty flower — a dangerous scent.'),
    active:{ cd:18, mana:100, target:'point', castRange:900,
      use(h, aim){
        const t = itemTarget(h, aim, 900, true);
        if(!t) return false;
        applySilence(t, 4); applyDamage(t, 60, h, true);
        addFloat(t.x, t.y, L('🤐 Tišina!', '🤐 Silenced!'), '#d8b4fe', 15); burst(t.x, t.y, '#c084fc', 16, 170, 5); return true;
      } } },
  { id:'atos', emoji:'🔗', name:L('Atosov štap', 'Rod of Atos'), cat:'magic', cost:300, components:['wizstaff', 'heart'], stats:{int:12, hp:250},   // v0.56
    act:L('Lanci: neprijatelj je 2 s ukorijenjen (ne može hodati) — domet 1100', 'Chains: an enemy is rooted for 2 s (can\'t move) — range 1100'), lore:L('Lanci iz zemlje drže bjegunca.', 'Chains from the ground hold the runaway.'),
    active:{ cd:18, mana:50, target:'point', castRange:1100,
      use(h, aim){
        const t = itemTarget(h, aim, 1100);
        if(!t) return false;
        applyRoot(t, 2); addLine(h.x, h.y, t.x, t.y, '#a3a3a3', 4, 0.3);
        if(t.kind === 'hero') addFloat(t.x, t.y, L('🔗 Okovan!', '🔗 Rooted!'), '#d4d4d4', 15);
        burst(t.x, t.y, '#d4d4d4', 14, 150, 5); return true;
      } } },
  // ----- 🛡️ oklop -----
  { id:'vanguard', emoji:'🔰', name:L('Avangarda', 'Vanguard'), cat:'armor', cost:250, components:['heart', 'ringregen'], stats:{hp:250, hpRegen:5},
    block:{ c:0.6, a:40 }, pas:L('60% šanse da blokira 40 štete od udarca', '60% chance to block 40 damage from a hit'), lore:L('Prvi u boj, zadnji iz boja.', 'First into battle, last out of it.') },
  { id:'bkb', emoji:'👑', name:L('Kraljevski oklop', 'Royal Armor'), cat:'armor', cost:700, components:['ogre', 'mithril'], stats:{str:10, dmg:24},
    act:L('Nepokolebljiv: 5 s ništa te ne može omamiti, usporiti ni ušutkati', 'Unstoppable: for 5 s nothing can stun, slow or silence you'), lore:L('Kralj ne pada na koljena.', 'A king never kneels.'),
    active:{ cd:70, mana:0, use(h){ applyImmune(h, 5); burst(h.x, h.y, '#fde047', 20, 220, 6); return true; } } },
  { id:'assault', emoji:'🪖', name:L('Napadački oklop', 'Assault Cuirass'), cat:'armor', cost:650, components:['platemail', 'hyperstone', 'chainmail'], stats:{armor:15, aspd:30},
    aura:{ armor:4, aspd:20, r:900 }, pas:L('Aura (900): saveznici +4 oklopa i +20% brzine napada', 'Aura (900): allies get +4 armor and +20% attack speed'), lore:L('Oklop generala koji vodi vojsku.', 'The armor of a general who leads the army.') },
  { id:'titanheart', emoji:'🧡', name:L('Srce titana', 'Titan Heart'), cat:'armor', cost:650, components:['reaver', 'heart'], stats:{str:45, hp:250, hpRegen:12},
    lore:L('Kuca kao bubanj divova.', 'It beats like a giant\'s drum.') },
  { id:'hood', emoji:'🧢', name:L('Kapuljača prkosa', 'Hood of Defiance'), cat:'armor', cost:200, components:['cloak', 'ringhealth', 'ringregen'], stats:{hpRegen:8, mres:0.25},   // v0.56
    act:L('Štit protiv magije: upije 350 štete na 12 s', 'Spell shield: absorbs 350 damage for 12 s'), lore:L('Magije se odbijaju od nje.', 'Spells bounce off it.'),
    active:{ cd:60, mana:0, use(h){ h.barrierHp = Math.max(h.barrierHp || 0, 350); h.barrierT = 12; burst(h.x, h.y, '#93c5fd', 16, 170, 5); return true; } } },
  { id:'halberd', emoji:'⚜️', name:L('Nebeska helebarda', 'Heaven\'s Halberd'), cat:'armor', cost:300, components:['ogre', 'staff', 'ringhealth'], stats:{str:16, dmg:10, hpRegen:5, evasion:0.2},   // v0.56
    act:L('Razoružaj: neprijatelj 3 s ne može udarati (domet 600)', 'Disarm: an enemy can\'t attack for 3 s (range 600)'), lore:L('Jedan zamah — i oružje padne iz ruke.', 'One swing — and the weapon drops from their hand.'),
    active:{ cd:18, mana:100, target:'point', castRange:600,
      use(h, aim){
        const t = itemTarget(h, aim, 600, true);
        if(!t || t.status.immuneT > 0) return false;
        t.status.disarmT = Math.max(t.status.disarmT || 0, 3);
        addFloat(t.x, t.y, L('🔱 Razoružan!', '🔱 Disarmed!'), '#fde68a', 15); burst(t.x, t.y, '#fde68a', 14, 150, 5); return true;
      } } },
  // ----- ⚔️ oružje -----
  { id:'crystalys', emoji:'💥', name:L('Kristalni nož', 'Crystal Knife'), cat:'weapon', cost:250, components:['broadsword', 'sword'], stats:{dmg:32},
    crit:{ c:0.3, m:1.6 }, pas:L('30% šanse za kritični udarac (160% štete)', '30% chance for a critical hit (160% damage)'), lore:L('Oštar kao led.', 'Sharp as ice.') },
  { id:'daedalus', emoji:'🎯', name:L('Dedalova oštrica', 'Daedalus'), cat:'weapon', cost:500, components:['crystalys', 'demonedge'], stats:{dmg:88},
    crit:{ c:0.3, m:2.25 }, pas:L('30% šanse za kritični udarac (225% štete)', '30% chance for a critical hit (225% damage)'), lore:L('Ne promašuje slabe točke.', 'It never misses a weak spot.') },
  { id:'bfury', emoji:'🪓', name:L('Bojna sjekira', 'Battle Fury'), cat:'weapon', cost:600, components:['broadsword', 'claymore', 'quelling', 'ringregen', 'sage'], stats:{dmg:50, hpRegen:5, mpRegen:2.5},
    cleave:0.5, creepDmg:15, pas:L('Zamah (samo izbliza): 50% štete svima oko mete • +15 štete protiv vojnika', 'Cleave (melee only): 50% damage to everyone around the target • +15 damage against creeps'), lore:L('Jedan zamah — cijela skupina.', 'One swing — the whole group.') },
  { id:'deso', emoji:'🌘', name:L('Oštrica pustoši', 'Desolator'), cat:'weapon', cost:150, components:['mithril', 'mithril'], stats:{dmg:50},
    corrupt:{ a:6, t:7 }, pas:L('Udarac skida 6 oklopa meti na 7 s', 'Hits remove 6 armor from the target for 7 s'), lore:L('Gdje udari, ostaje pustoš.', 'Where it strikes, nothing is left.') },
  { id:'basher', emoji:'🔨', name:L('Lubanjolomac', 'Skull Basher'), cat:'weapon', cost:450, components:['mithril', 'belt'], stats:{dmg:25, str:6},
    bash:{ c:0.25, cr:0.1, t:1.4, dmg:80 }, pas:L('Tresak: 25% šanse (daljinski 10%) da omami metu 1.4 s i doda 80 štete', 'Bash: 25% chance (ranged 10%) to stun the target for 1.4 s and add 80 damage'), lore:L('BUM! Zvijezde oko glave.', 'BOOM! Stars around your head.') },
  { id:'abyssal', emoji:'🌀', name:L('Ponorna oštrica', 'Abyssal Blade'), cat:'weapon', cost:800, components:['basher', 'vanguard'], stats:{dmg:25, str:10, hp:250, hpRegen:6},
    bash:{ c:0.25, cr:0.1, t:1.4, dmg:80 }, block:{ c:0.6, a:50 },
    pas:L('Tresak kao Lubanjolomac + 60% šanse da blokira 50 štete', 'Bash like Skull Basher + 60% chance to block 50 damage'),
    act:L('Ponor: omami neprijatelja ispred sebe na 2 s (domet 200)', 'Abyss: stun the enemy in front of you for 2 s (range 200)'), lore:L('Iz ponora nema bijega.', 'There is no escape from the abyss.'),
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
  { id:'mkb', emoji:'🐒', name:L('Majmunova šipka', 'Monkey King Bar'), cat:'weapon', cost:325, components:['demonedge', 'gloves'], stats:{dmg:40, aspd:45},
    trueStrike:true, proc:{ c:0.7, dmg:70 }, pas:L('Udarci nikad ne promašuju • 70% šanse za +70 čarobne štete', 'Hits never miss • 70% chance for +70 magic damage'), lore:L('Majmun kralj nikad ne promaši.', 'The Monkey King never misses.') },
  { id:'maelstrom', emoji:'⛈️', name:L('Vrtlog munja', 'Maelstrom'), cat:'weapon', cost:300, components:['javelin', 'mithril'], stats:{dmg:44},   // v0.56
    chain:{ c:0.25, dmg:120, n:4, r:500 }, pas:L('25% šanse da udarac pusti munju koja skače na 4 neprijatelja (120 štete)', '25% chance for an attack to release lightning that jumps to 4 enemies (120 damage)'),
    lore:L('Oluja u čekiću.', 'A storm in a hammer.') },
  { id:'mjollnir', emoji:'🌩️', name:L('Gromovnik', 'Mjollnir'), cat:'weapon', cost:600, components:['maelstrom', 'hyperstone'], stats:{dmg:44, aspd:70},   // v0.56
    chain:{ c:0.3, dmg:170, n:8, r:600 }, pas:L('30% šanse da udarac pusti munju koja skače na 8 neprijatelja (170 štete)', '30% chance for an attack to release lightning that jumps to 8 enemies (170 damage)'),
    act:L('Statički štit (15 s): tko te udari, 20% šanse da ga pogodi munja (200 štete)', 'Static shield (15 s): whoever hits you has a 20% chance to get struck by lightning (200 damage)'), lore:L('Gromovi slušaju samo njega.', 'Thunder obeys only him.'),
    active:{ cd:35, mana:50, use(h){ h.staticT = 15; burst(h.x, h.y, '#fde047', 18, 180, 5); addFloat(h.x, h.y, L('🌩️ Statički štit!', '🌩️ Static shield!'), '#fde047', 15); return true; } } },
  { id:'diffusal', emoji:'🪀', name:L('Raspršna oštrica', 'Diffusal Blade'), cat:'weapon', cost:350, components:['band', 'band', 'robe'], stats:{agi:20, int:8},   // v0.56
    mburn:{ mp:35, f:0.8 }, pas:L('Svaki udarac sagori 35 mane neprijatelju i napravi 80% toga kao štetu', 'Every attack burns 35 enemy mana and deals 80% of it as damage'),
    act:L('Raspršivanje: neprijatelj je 4 s usporen 60% (domet 600)', 'Diffuse: an enemy is slowed by 60% for 4 s (range 600)'), lore:L('Oštrica koja ispija čaroliju.', 'A blade that drinks magic.'),
    active:{ cd:15, mana:0, target:'point', castRange:600,
      use(h, aim){
        const t = itemTarget(h, aim, 600);
        if(!t) return false;
        applySlow(t, 0.6, 4); burst(t.x, t.y, '#a78bfa', 14, 150, 5); return true;
      } } },
  // ----- 💎 artefakti -----
  { id:'butterfly', emoji:'🦋', name:L('Leptir', 'Butterfly'), cat:'art', cost:450, components:['eaglesong', 'gloves'], stats:{agi:35, dmg:25, aspd:30, evasion:0.35},
    pas:L('35% šanse da izbjegneš udarac', '35% chance to dodge a hit'), lore:L('Lepršaš — i nitko te ne može pogoditi.', 'You flutter — and nobody can hit you.') },
  { id:'shadowblade', emoji:'🌒', name:L('Sjenovita oštrica', 'Shadow Blade'), cat:'art', cost:400, components:['broadsword', 'gloves'], stats:{dmg:25, aspd:30},
    act:L('Sjena: 14 s nevidljiv i brži 20%; prvi udarac iz sjene +175 štete', 'Shadow: invisible and 20% faster for 14 s; first hit from the shadows +175 damage'), lore:L('Sjena koja reže.', 'A shadow that cuts.'),
    active:{ cd:28, mana:75,
      use(h){ h.status.invisT = Math.max(h.status.invisT, 14); h.sbBonus = 175; applyHaste(h, 1.2, 14); burst(h.x, h.y, '#6b7280', 16, 160, 5); return true; } } },
  { id:'satanic', emoji:'🦇', name:L('Vampirski mač', 'Vampire Sword'), cat:'art', cost:0, components:['morbid', 'claymore', 'reaver'], stats:{str:25, dmg:38, lifesteal:0.25},
    act:L('Žeđ: 6 s udarci kradu još 150% života', 'Thirst: for 6 s your hits steal 150% more health'), lore:L('Žedan je — uvijek.', 'It\'s thirsty — always.'),
    active:{ cd:35, mana:0, use(h){ h.lsBoostT = 6; burst(h.x, h.y, '#dc2626', 18, 180, 5); addFloat(h.x, h.y, L('🦇 Žeđ!', '🦇 Thirst!'), '#fca5a5', 15); return true; } } },
  { id:'sun', emoji:'☀️', name:L('Sunčev kamen', 'Sun Stone'), cat:'art', cost:650, components:['relic'], stats:{dmg:65},
    burn:40, burnR:320, pas:L('Žar: sve neprijatelje u krugu 320 peče 40 štete/s', 'Blaze: burns all enemies within 320 for 40 damage/s'), lore:L('Mali komadić Sunca.', 'A tiny piece of the Sun.') },
  { id:'skadi', emoji:'🧊', name:L('Oko mraza', 'Eye of Skadi'), cat:'art', cost:300, components:['ogre', 'alacrity', 'wizstaff', 'pointbooster'], stats:{all:22, hp:225, mp:225},   // v0.56
    cold:{ f:0.35, t:2.5 }, pas:L('Udarci usporavaju neprijatelja 35% na 2.5 s', 'Attacks slow the enemy by 35% for 2.5 s'), lore:L('Ledeno oko koje sve vidi i sve smrzne.', 'An icy eye that sees everything and freezes everything.') },
];
const ITEM_BY_ID = {};
for(const it of ITEMS) ITEM_BY_ID[it.id] = it;

/* 🌰 NEUTRALNI PREDMETI — ponekad ispadnu iz čudovišta u džungli (posebno, okruglo mjesto u torbi).
   Što je igra dulja, to su bolji (3 razine); svaki tim može naći najviše 3 po razini. */
const NEUTRAL_ITEMS = [
  { id:'n_clover',  emoji:'🍀', name:L('Djetelina sreće', 'Lucky Clover'),   ntier:1, desc:L('+8 štete, +8 brzine', '+8 damage, +8 speed'),              stats:{dmg:8, speed:8} },
  { id:'n_feather', emoji:'🪶', name:L('Lako pero', 'Light Feather'),         ntier:1, desc:L('+25 brzine', '+25 speed'),                       stats:{speed:25} },
  { id:'n_amulet',  emoji:'🧿', name:L('Plavi amulet', 'Blue Amulet'),      ntier:1, desc:L('+160 života, +1 obnova', '+160 HP, +1 regen'),           stats:{hp:160, hpRegen:1} },
  { id:'n_shell',   emoji:'🐚', name:L('Morska školjka', 'Seashell'),    ntier:2, desc:L('+250 života, +3 obnova', '+250 HP, +3 regen'),           stats:{hp:250, hpRegen:3} },
  { id:'n_fang',    emoji:'🦴', name:L('Kost pradavnog vuka', 'Ancient Wolf Bone'), ntier:2, desc:L('+22 štete', '+22 damage'),                      stats:{dmg:22} },
  { id:'n_crystal', emoji:'🔷', name:L('Kristal mudrosti', 'Crystal of Wisdom'),  ntier:2, desc:L('+200 mane, +2.5 obnova mane', '+200 mana, +2.5 mana regen'),      stats:{mp:200, mpRegen:2.5} },
  { id:'n_star',    emoji:'🌟', name:L('Zvjezdani prah', 'Stardust'),    ntier:3, desc:L('+32 štete, +30 brzine', '+32 damage, +30 speed'),            stats:{dmg:32, speed:30} },
  { id:'n_dheart',  emoji:'💎', name:L('Dijamantno srce', 'Diamond Heart'),   ntier:3, desc:L('+550 života, +5 obnova', '+550 HP, +5 regen'),           stats:{hp:550, hpRegen:5} },
  { id:'n_moon',    emoji:'🌙', name:L('Mjesečev kamen', 'Moonstone'),    ntier:3, desc:L('+400 mane, +5 obnova mane, +12 štete', '+400 mana, +5 mana regen, +12 damage'), stats:{mp:400, mpRegen:5, dmg:12} },
];
for(const it of NEUTRAL_ITEMS){ it.neutral = true; it.noShop = true; it.cost = 0; it.q = 'neutral'; it.lore = it.desc; ITEM_BY_ID[it.id] = it; }
/* dućan kao u DotA: dvije kartice (OSNOVNI / NADOGRADNJE), u svakoj stupci po kategorijama */
const SHOP_TABS = [
  { id:'basic', label:L('Osnovni', 'Basic'), cats:['cons', 'attr', 'equip', 'misc', 'secret'] },
  { id:'up',    label:L('Nadogradnje', 'Upgrades'), cats:['acc', 'sup', 'magic', 'armor', 'weapon', 'art'] },
];
/* kategorija → naslov stupca i "kvaliteta" (boja okvira i pozadine ikone, kao u DotA) */
const ITEM_CAT_INFO = {
  cons:   { label:L('Potrošno', 'Consumables'),  q:'cons' },
  attr:   { label:L('Atributi', 'Attributes'),  q:'comp' },
  equip:  { label:L('Oprema', 'Equipment'),    q:'comp' },
  misc:   { label:L('Razno', 'Misc'),     q:'comp' },
  secret: { label:L('Rijetko', 'Rare'),   q:'secret' },
  acc:    { label:L('Pribor', 'Accessories'),    q:'common' },
  sup:    { label:L('Podrška', 'Support'),   q:'common' },
  magic:  { label:L('Čarolije', 'Magic'),  q:'rare' },
  armor:  { label:L('Oklop', 'Armor'),     q:'rare' },
  weapon: { label:L('Oružje', 'Weapons'),    q:'epic' },
  art:    { label:L('Artefakti', 'Artifacts'), q:'art' },
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
  vuk: ['bracer', 'phase', 'bfury', 'mom', 'basher', 'satanic'],   // ⚖️ v0.45: Bojna sjekira — brže skuplja zlato (prije je zaostajao)
  tragac: ['wraith', 'phase', 'shadowblade', 'deso', 'daedalus', 'butterfly'],
  skokica: ['bracer', 'phase', 'blink', 'bkb', 'abyssal', 'satanic'],
  morskipas: ['wraith', 'phase', 'mom', 'bfury', 'abyssal', 'satanic'],
  nisan: ['wraith', 'treads', 'crystalys', 'mkb', 'daedalus', 'butterfly'],   // v0.38
  bikos: ['bracer', 'vanguard', 'blink', 'bkb', 'assault', 'titanheart'],
  nilski: ['bracer', 'phase', 'blink', 'vanguard', 'bkb', 'titanheart'],   // v0.55
  irbis: ['wraith', 'treads', 'mom', 'crystalys', 'butterfly', 'daedalus'],
  skorpion: ['bracer', 'arcane', 'blink', 'bkb', 'shiva', 'refresher'],
};
for(const h of HEROES) h.build = HERO_BUILDS[h.id] || BOT_BUILD;
/* 🎲 v0.56 raznolikost: bot svaku igru odabere jednu od inačica gradnje (prva je ona iz vodiča u dućanu);
   junaci s vlastitom gradnjom ponekad zamijene zadnji predmet novim legendarnim. Junak u džungli odmah nadogradi Lovački nož. */
const BUILD_ALTS = new Map([
  [BUILD_TANK,    [['bracer', 'phase', 'hood', 'halberd', 'assault', 'titanheart'], ['buckler', 'phase', 'vanguard', 'pipe', 'bkb', 'assault']]],
  [BUILD_MELEE,   [['wraith', 'phase', 'maelstrom', 'bkb', 'skadi', 'mjollnir'], ['wraith', 'treads', 'diffusal', 'basher', 'skadi', 'butterfly']]],
  [BUILD_RANGED,  [['wraith', 'treads', 'maelstrom', 'skadi', 'mjollnir', 'butterfly'], ['wraith', 'treads', 'diffusal', 'mkb', 'skadi', 'daedalus']]],
  [BUILD_MAGE,    [['nulltal', 'arcane', 'kaya', 'orchid', 'octarine', 'shiva'], ['nulltal', 'arcane', 'atos', 'kaya', 'dagon', 'octarine']]],
  [BUILD_SUPPORT, [['wand', 'arcane', 'glimmer', 'mek', 'greaves', 'pipe'], ['wand', 'buckler', 'arcane', 'glimmer', 'force', 'greaves']]],
]);
/* vodič u dućanu za igrača (🌲 u džungli: Lovačka mačeta odmah nakon prvog predmeta) */
function guideNextId(h){   // sljedeći predmet iz vodiča (🌲 u džungli prvo Lovački nož)
  if(h.jungler && !ownsOrUsed(h, 'hunter')) return 'hunter';
  return guideBuild(h).find(id => !ownsOrUsed(h, id)) || null;
}
function guideBuild(h){ const b = (h && h.hero && h.hero.build) || BOT_BUILD; return h && h.jungler ? [b[0], 'machete'].concat(b.slice(1, 5)) : b; }
const LATE_ALTS = { str: ['halberd', 'pipe', 'assault'], agi: ['skadi', 'mjollnir', 'butterfly'], int: ['octarine', 'shiva', 'orchid'] };
function botBuildFor(def, jungler){
  let b = def.build || BOT_BUILD;
  const alts = BUILD_ALTS.get(b);
  if(alts){ const k = Math.floor(Math.random() * (alts.length + 1)); if(k > 0) b = alts[k - 1]; }
  else if(Math.random() < 0.4){
    const late = LATE_ALTS[def.attrs.primary].filter(id => !b.includes(id));
    if(late.length) b = b.slice(0, -1).concat(late[Math.floor(Math.random() * late.length)]);
  }
  return jungler ? [b[0], 'machete'].concat(b.slice(1, 5)) : b.slice();
}
/* ✨ ČAROLIJE PRIZIVAČA (kao u League of Legends): svaki junak nosi dvije (tipke D i F), bira ih na početku */
const SUMMONERS = [
  { id:'flash',   emoji:'⚡', name:L('Bljesak', 'Flash'),      cd:120, target:'point', range:420, color:'#fde047',
    desc:L('Trenutno se prebaci do 420 u smjeru miša — kroz zidove i drveće', 'Instantly teleport up to 420 toward your mouse — through walls and trees'), tip:() => L('skok 420', 'jump 420') },
  { id:'heal',    emoji:'💚', name:L('Iscjeljenje', 'Heal'),  cd:120, color:'#4ade80',
    desc:L('Izliječi sebe i najranjenijeg suigrača u blizini (700) i kratko ubrzaj oboje', 'Heal yourself and the most hurt nearby teammate (700) and briefly speed up both of you'), tip:lv => L('+' + (90 + 20 * lv) + ' života, +30% brzine 1 s', '+' + (90 + 20 * lv) + ' HP, +30% speed for 1 s') },
  { id:'ignite',  emoji:'🔥', name:L('Zapaljenje', 'Ignite'),   cd:120, target:'unit', range:600, color:'#fb923c',
    desc:L('Zapali neprijateljskog junaka: gori 5 s i slabije se liječi', 'Set an enemy hero on fire: burns for 5 s and heals less'), tip:lv => L((70 + 20 * lv) + ' štete kroz 5 s, −40% liječenja', (70 + 20 * lv) + ' damage over 5 s, −40% healing') },
  { id:'ghost',   emoji:'👻', name:L('Duh', 'Ghost'),          cd:110, color:'#c4b5fd',
    desc:L('Postaneš brz kao duh na 10 s', 'Become fast as a ghost for 10 s'), tip:() => L('+35% brzine kretanja 10 s', '+35% move speed for 10 s') },
  { id:'barrier', emoji:'🫧', name:L('Barijera', 'Barrier'),     cd:100, color:'#93c5fd',
    desc:L('Štit koji upije štetu na 2.5 s', 'A shield that soaks up damage for 2.5 s'), tip:lv => L('štit od ' + (110 + 25 * lv) + ' štete', (110 + 25 * lv) + ' damage shield') },
  { id:'exhaust', emoji:'🐌', name:L('Iscrpljenost', 'Exhaust'), cd:110, target:'unit', range:650, color:'#a3a3a3',
    desc:L('Neprijateljski junak je 3 s spor i slabo udara', 'An enemy hero is slow and hits weakly for 3 s'), tip:() => L('−30% brzine i −40% štete udaraca 3 s', '−30% speed and −40% attack damage for 3 s') },
  { id:'smite',   emoji:'🌩️', name:L('Kazna', 'Smite'),        cd:60,  target:'unit', range:500, color:'#fcd34d',
    desc:L('Munja s neba udari čudovište ili vojnika (ne junaka) — za džunglu i zmaja', 'Lightning from the sky strikes a monster or creep (not a hero) — for the jungle and the dragon'), tip:lv => L((450 + 20 * lv) + ' štete', (450 + 20 * lv) + ' damage') },
];
const SUMMONER_BY_ID = {};
for(const s of SUMMONERS) SUMMONER_BY_ID[s.id] = s;
const DEFAULT_SUMMONERS = ['flash', 'heal'];

/* 🔵🔴 BUFFOVI DŽUNGLE (kao u League of Legends): Plavi golem i Vatreni vuk daju ubojici buff na 90 s;
   pogine li junak s buffom, buff prelazi na neprijateljskog junaka koji ga je ubio */
const JUNGLE_BUFFS = {
  blue: { emoji:'🔵', name:L('Plavi buff', 'Blue Buff'), color:'#60a5fa', dur:90, desc:L('+4 obnove mane i 15% kraće hlađenje moći', '+4 mana regen and 15% shorter ability cooldowns') },
  red:  { emoji:'🔴', name:L('Crveni buff', 'Red Buff'), color:'#f87171', dur:90, desc:L('udarci pale (8 + level štete/s, 3 s) i usporavaju 15% • +3 obnove života', 'hits burn (8 + level damage/s, 3 s) and slow 15% • +3 HP regen') },
};
/* 🐉 ZMAJČIĆI (kao zmajevi u League of Legends): na rijeci dolje desno živi zmajčić jednog elementa.
   Tim koji ga ubije dobiva TRAJNI bonus za sve svoje junake — bonusi se zbrajaju! Novi dolazi nakon 2,5 min. */
const DRAKES = {
  fire:   { emoji:'🔥', name:L('Vatreni zmajčić', 'Fire Drake'), acc:L('vatrenog zmajčića', 'the Fire Drake'), color:'#fb923c', look:'r', desc:L('+6% štete junaka (udarci i moći)', '+6% hero damage (attacks and abilities)') },
  water:  { emoji:'💧', name:L('Vodeni zmajčić', 'Water Drake'),  acc:L('vodenog zmajčića', 'the Water Drake'),  color:'#38bdf8', look:'c', desc:L('+3 obnove života i +1,5 obnove mane', '+3 HP regen and +1.5 mana regen') },
  storm:  { emoji:'⚡', name:L('Olujni zmajčić', 'Storm Drake'),  acc:L('olujnog zmajčića', 'the Storm Drake'),  color:'#c084fc', look:'k', desc:L('+5% brzine kretanja', '+5% move speed') },
  forest: { emoji:'🌿', name:L('Šumski zmajčić', 'Forest Drake'),  acc:L('šumskog zmajčića', 'the Forest Drake'),  color:'#4ade80', look:'p', desc:L('+3 oklopa', '+3 armor') },
};
const DRAKE_KEYS = ['fire', 'water', 'storm', 'forest'];
/* botovi: po vrsti junaka */
function botSummoners(def){
  if(def.build === BUILD_TANK) return ['flash', 'exhaust'];
  if(def.build === BUILD_SUPPORT) return ['flash', 'heal'];
  if(def.build === BUILD_MAGE) return ['flash', 'ignite'];
  return def.projSpeed > 0 ? ['flash', 'heal'] : ['flash', 'ignite'];
}

/* početni predmeti (prvih 650 zlata) */
const START_ITEMS = ['tango', 'branch', 'branch', 'potion', 'clarity'];
const START_JUNGLE = ['hunter', 'tango', 'potion', 'branch'];   // 🌲 v0.56: junak u džungli
/* 🌲 junak u džungli uvijek nosi Kaznu (F) — njome dokrajči čudovište i od zmaja/zmajčića otme plijen */
function jungleSummoners(sm){ return sm.includes('smite') ? sm.slice() : [sm[0] === 'smite' ? 'flash' : sm[0], 'smite']; }


/* ---------------- DŽUNGLA: NEUTRALNI KAMPOVI ---------------- */

const CAMP_TYPES = {
  boars:  { n:3, emoji:'🐗', name:L('Veprić', 'Boar'),      hp:340,  dmg:24, range:60, atkCd:1.2, speed:120, r:15, gold:34,  xp:40 },
  wolves: { n:2, emoji:'🐺', name:L('Vuk', 'Wolf'),         hp:540,  dmg:34, range:65, atkCd:1.1, speed:135, r:17, gold:55,  xp:60 },
  drake:  { n:1, emoji:'🐉', name:L('Zmajčić', 'Drake'),     hp:1900, dmg:58, range:90, atkCd:1.3, speed:110, r:25, gold:150, xp:200, hpRegen:3, drake:true, model:'boss' },
  boss:   { n:1, emoji:'🐲', name:L('Veliki Zmaj', 'Great Dragon'), hp:2600, dmg:78, range:95, atkCd:1.3, speed:110, r:34, gold:260, xp:300, boss:true, hpRegen:4 },
  golem:  { n:1, emoji:'🗿', name:L('Plavi golem', 'Blue Golem'), hp:1500, dmg:62, range:85, atkCd:1.4, speed:100, r:27, gold:170, xp:170, stunHit:true, hpRegen:2, buff:'blue', look:'c' },
  redbuff:{ n:1, emoji:'🐺', name:L('Vatreni vuk', 'Fire Wolf'), hp:1150, dmg:52, range:70, atkCd:1.15, speed:130, r:25, gold:120, xp:130, hpRegen:2, buff:'red', model:'redwolf', fallback:'wolves', fallbackLook:'r' },
  stones: { n:2, emoji:'🪨', name:L('Kameni golem', 'Stone Golem'), hp:880, dmg:40, range:80, atkCd:1.35, speed:100, r:21, gold:78, xp:82, stunHit:true, hpRegen:1, model:'golem' },   // v0.38
  bears:  { n:2, emoji:'🐻', name:L('Medvjed', 'Bear'), hp:920, dmg:46, range:72, atkCd:1.3, speed:115, r:23, gold:92, xp:100, hpRegen:1.5, model:'bear' },   // v0.46: veliki kamp
  // 🦎 v0.56: mali kamp — junak u džungli ga čisti već na levelu 1 (najbolje s Lovačkim nožem i Kaznom)
  lizards:{ n:3, emoji:'🦎', name:L('Gušter', 'Lizard'), hp:190, dmg:11, range:55, atkCd:1.4, speed:115, r:17, gold:26, xp:36, hpRegen:0.5, model:'lizard', fallback:'boars', small:true },
};
const CAMP_SPOTS = [
  { x:800,  y:800,  type:'boss'   },
  { x:2100, y:2100, type:'drake'  },
  // v0.47: kampovi su DALEKO od kula (najmanje ~630 izvan dometa kule na mapi 2.22), da se čudovišta ne mogu navući
  //   pod kulu; po jedan kamp uz svaku bočnu stazu (P) i dalje se može povući do vojnika. Crveni = 180° okret plavih.
  { x:525,  y:1375, type:'boars'  },   // plavi, uz gornju stazu (P)
  { x:825,  y:1350, type:'wolves' },
  { x:700,  y:1075, type:'stones' },
  { x:750,  y:1700, type:'golem'  },   // 🔵 plavi buff
  { x:1675, y:2450, type:'wolves' },   // plavi, uz donju stazu (P)
  { x:1300, y:2250, type:'bears'  },
  { x:1550, y:2100, type:'redbuff' },  // 🔴 crveni buff
  { x:1900, y:2275, type:'boars'  },
  { x:2475, y:1625, type:'boars'  },   // crveni, uz donju stazu (P)
  { x:2175, y:1650, type:'wolves' },
  { x:2300, y:1925, type:'stones' },
  { x:2250, y:1300, type:'golem'  },
  { x:1325, y:550,  type:'wolves' },   // crveni, uz gornju stazu (P)
  { x:1700, y:750,  type:'bears'  },
  { x:1450, y:900,  type:'redbuff' },
  { x:1100, y:725,  type:'boars'  },
  // 🦎 v0.56: mali kampovi bliže bazi (prvi kampovi junaka u džungli), po dva za svaki tim
  { x:600,  y:1950, type:'lizards' },   // plavi, između gornje staze i sredine
  { x:1050, y:2400, type:'lizards' },   // plavi, između sredine i donje staze
  { x:2400, y:1050, type:'lizards' },   // crveni
  { x:1950, y:600,  type:'lizards' },
];

/* ---------------- RUNE ZLATA I MUDROSTI (u džungli) ---------------- */
const BOUNTY_SPOTS = [{ x:700, y:1500 }, { x:1500, y:2300 }, { x:1500, y:700 }, { x:2300, y:1500 }];
const WISDOM_SPOTS = [{ x:420, y:1250 }, { x:1250, y:420 }];

/* ---------------- BRZE PORUKE (G pa 1–6) ---------------- */
const CHAT_LINES = [L('👍 Bravo!', '👍 Well done!'), L('🆘 Pomoć!', '🆘 Help!'), L('⚔️ Napadamo!', '⚔️ Attack!'), L('🏃 Povlačenje!', '🏃 Retreat!'), L('🙏 Hvala!', '🙏 Thanks!'), L('😄 Dobra igra!', '😄 Good game!')];
const BOT_BRAG = [L('😎 Hehe, lako!', '😎 Hehe, easy!'), L('💪 Jesam ga!', '💪 Got \'em!'), L('🎉 Juhu!', '🎉 Woohoo!'), L('⭐ Super smo!', '⭐ We\'re awesome!')];

/* ---------------- SVETIŠTA (liječe tim, kao u DotA 7) ---------------- */
const SHRINE_SPOTS = [{ x:1150, y:2250, team:0 }, { x:1850, y:750, team:1 }];

/* ---------------- 🎓 TALENTI (kao u DotA 2): na levelima 10, 15, 20 i 25 biraš jedan od dva ----------------
   v0.38: svaki junak ima SVOJE talente — vezane uz njegove moći (jača moć, kraće hlađenje, dulja omama…) i
   pasivu (+1 rang), uz pokoji opći bonus. Učinci (e):
     dmg, hp, mp, armor, aspd (udio), spd (brzina), cdr (udio), ls (krađa života), hpRegen, mpRegen, range (domet),
     spellAmp (jačina magija), evasion, pas (+rang urođene pasive), gold (zlato/s),
     ab:{ Q:{ dmg (šteta po pogotku), cd (s), dur (omama/korijen/tišina/izazov +s), heal, mana } }, flag (posebno) */
const TALENT_LVLS = [10, 15, 20, 25];
const TAL = (emoji, txt, e) => ({ emoji, txt, e });
const DEFAULT_TALENTS = [
  [TAL('⚔️', L('+30 štete', '+30 damage'), { dmg:30 }), TAL('❤️', L('+300 života', '+300 HP'), { hp:300 })],
  [TAL('🏃', L('+25 brzine', '+25 speed'), { spd:25 }), TAL('⏱️', L('−15% hlađenja moći', '−15% ability cooldowns'), { cdr:0.15 })],
  [TAL('🗡️', L('+60 štete', '+60 damage'), { dmg:60 }), TAL('💖', L('+600 života', '+600 HP'), { hp:600 })],
  [TAL('⚡', L('+35% brzine napada', '+35% attack speed'), { aspd:0.35 }), TAL('⌛', L('−15% hlađenja više', '−15% cooldowns again'), { cdr:0.15 })],
];
const HERO_TALENTS = {
  vitez: [
    [TAL('🌪️', L('Vrtlog +60 štete', 'Whirlwind +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('🛡️', L('+4 oklopa', '+4 armor'), { armor:4 })],
    [TAL('💥', L('Junački skok −4 s hlađenja', 'Hero Leap −4 s cooldown'), { ab:{ E:{ cd:-4 } } }), TAL('❤️', L('+300 života', '+300 HP'), { hp:300 })],
    [TAL('💥', L('Junački skok +0.6 s omame', 'Hero Leap +0.6 s stun'), { ab:{ E:{ dur:0.6 } } }), TAL('⚔️', L('+45 štete', '+45 damage'), { dmg:45 })],
    [TAL('🦁', L('Kraljev urlik +1 s omame', 'King\'s Roar +1 s stun'), { ab:{ R:{ dur:1 } } }), TAL('🦺', L('Lavlja koža +1 rang', 'Lion Hide +1 rank'), { pas:1 })],
  ],
  zarko: [
    [TAL('🔥', L('Vatrena kugla +60 štete', 'Fireball +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('💧', L('+2 obnove mane', '+2 mana regen'), { mpRegen:2 })],
    [TAL('☄️', L('Meteor −5 s hlađenja', 'Meteor −5 s cooldown'), { ab:{ E:{ cd:-5 } } }), TAL('✨', L('+10% jačine magija', '+10% spell power'), { spellAmp:0.1 })],
    [TAL('🔥', L('Vatrena kugla probija SVE', 'Fireball pierces EVERYTHING'), { flag:'zarko_q_pierce' }), TAL('❤️', L('+350 života', '+350 HP'), { hp:350 })],
    [TAL('🐲', L('Zmajev dah +200 štete', 'Dragon\'s Breath +200 damage'), { ab:{ R:{ dmg:200 } } }), TAL('⏱️', L('−20% hlađenja moći', '−20% ability cooldowns'), { cdr:0.2 })],
  ],
  ledena: [
    [TAL('🧊', L('Ledena strijela +55 štete', 'Ice Arrow +55 damage'), { ab:{ Q:{ dmg:55 } } }), TAL('🏃', L('+20 brzine', '+20 speed'), { spd:20 })],
    [TAL('🌨️', L('Snježna oluja +25 štete po udaru', 'Snowstorm +25 damage per hit'), { ab:{ E:{ dmg:25 } } }), TAL('💧', L('+200 mane', '+200 mana'), { mp:200 })],
    [TAL('🛷', L('Trbušno klizanje −4 s hlađenja', 'Belly Slide −4 s cooldown'), { ab:{ W:{ cd:-4 } } }), TAL('✨', L('+12% jačine magija', '+12% spell power'), { spellAmp:0.12 })],
    [TAL('🥶', L('Ledeno doba +1 s omame', 'Ice Age +1 s stun'), { ab:{ R:{ dur:1 } } }), TAL('❤️', L('+500 života', '+500 HP'), { hp:500 })],
  ],
  strijela: [
    [TAL('🎯', L('Probojna strijela +60 štete', 'Piercing Arrow +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('⚡', L('+20% brzine napada', '+20% attack speed'), { aspd:0.2 })],
    [TAL('🕸️', L('Mreža drži +0.8 s', 'Net holds +0.8 s'), { ab:{ W:{ dur:0.8 } } }), TAL('🏹', L('+75 dometa napada', '+75 attack range'), { range:75 })],
    [TAL('👁️', L('Oštro oko +1 rang', 'Sharp Eye +1 rank'), { pas:1 }), TAL('⚔️', L('+40 štete', '+40 damage'), { dmg:40 })],
    [TAL('🌠', L('Sokolovo oko gađa DVA junaka', 'Falcon\'s Eye hits TWO heroes'), { flag:'strijela_r2' }), TAL('🦇', L('+15% krađe života', '+15% lifesteal'), { ls:0.15 })],
  ],
  listko: [
    [TAL('💚', L('Iscjeljenje +60 liječenja', 'Healing +60 healing'), { ab:{ W:{ heal:60 } } }), TAL('🛡️', L('+4 oklopa', '+4 armor'), { armor:4 })],
    [TAL('🌱', L('Korijenje drži +0.6 s', 'Entangle holds +0.6 s'), { ab:{ E:{ dur:0.6 } } }), TAL('❤️', L('+300 života', '+300 HP'), { hp:300 })],
    [TAL('🌰', L('Trnova kugla +80 štete', 'Thorn Ball +80 damage'), { ab:{ Q:{ dmg:80 } } }), TAL('💧', L('+3 obnove mane', '+3 mana regen'), { mpRegen:3 })],
    [TAL('🌳', L('Šumsko srce +150 liječenja', 'Forest Heart +150 healing'), { ab:{ R:{ heal:150 } } }), TAL('🌱', L('Korijeni +1 rang', 'Roots +1 rank'), { pas:1 })],
  ],
  munja: [
    [TAL('⚡', L('Munjeviti udar +50 štete', 'Lightning Strike +50 damage'), { ab:{ Q:{ dmg:50 } } }), TAL('🏃', L('+20 brzine', '+20 speed'), { spd:20 })],
    [TAL('🌀', L('Bljesak −4 s hlađenja', 'Flash −4 s cooldown'), { ab:{ W:{ cd:-4 } } }), TAL('⚔️', L('+35 štete', '+35 damage'), { dmg:35 })],
    [TAL('⚡', L('Munjeviti udar skače na još 2', 'Lightning Strike jumps to 2 more'), { flag:'munja_q_jumps' }), TAL('🔋', L('Statički naboj +1 rang', 'Static Charge +1 rank'), { pas:1 })],
    [TAL('🌩️', L('Gnjev oluje +150 štete', 'Storm\'s Wrath +150 damage'), { ab:{ R:{ dmg:150 } } }), TAL('⚡', L('+40% brzine napada', '+40% attack speed'), { aspd:0.4 })],
  ],
  skokica: [
    [TAL('👅', L('Jezičina +60 štete', 'Big Tongue +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('❤️', L('+250 života', '+250 HP'), { hp:250 })],
    [TAL('👅', L('Jezičina −3 s hlađenja', 'Big Tongue −3 s cooldown'), { ab:{ Q:{ cd:-3 } } }), TAL('🛡️', L('+5 oklopa', '+5 armor'), { armor:5 })],
    [TAL('🫧', L('Mjehur liječi +80', 'Bubble heals +80'), { ab:{ E:{ heal:80 } } }), TAL('⚔️', L('+40 štete', '+40 damage'), { dmg:40 })],
    [TAL('🌊', L('Veliki val +180 štete', 'Big Wave +180 damage'), { ab:{ R:{ dmg:180 } } }), TAL('💧', L('Vodozemac +1 rang', 'Amphibian +1 rank'), { pas:1 })],
  ],
  orlina: [
    [TAL('🪶', L('Pero-oštrica +60 štete', 'Blade Feather +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('⚡', L('+20% brzine napada', '+20% attack speed'), { aspd:0.2 })],
    [TAL('🦅', L('Obrušavanje −4 s hlađenja', 'Dive −4 s cooldown'), { ab:{ E:{ cd:-4 } } }), TAL('🏃', L('+25 brzine', '+25 speed'), { spd:25 })],
    [TAL('🔭', L('Orlovski vid +1 rang', 'Eagle Sight +1 rank'), { pas:1 }), TAL('⚔️', L('+45 štete', '+45 damage'), { dmg:45 })],
    [TAL('🌪️', L('Kralj neba +150 štete', 'Sky King +150 damage'), { ab:{ R:{ dmg:150 } } }), TAL('🦋', L('+20% izbjegavanja', '+20% evasion'), { evasion:0.2 })],
  ],
  luna: [
    [TAL('⭐', L('Zvjezdana kiša +50 štete', 'Star Shower +50 damage'), { ab:{ W:{ dmg:50 } } }), TAL('⚡', L('+20% brzine napada', '+20% attack speed'), { aspd:0.2 })],
    [TAL('🌠', L('Sveta strijela +0.7 s omame', 'Sacred Arrow +0.7 s stun'), { ab:{ Q:{ dur:0.7 } } }), TAL('❤️', L('+275 života', '+275 HP'), { hp:275 })],
    [TAL('🌙', L('Mjesečeva oštrica +1 rang', 'Moon Blade +1 rank'), { pas:1 }), TAL('⚔️', L('+40 štete', '+40 damage'), { dmg:40 })],
    [TAL('👻', L('Mjesečeva sjena: tim i +30% brzine', 'Moon Shadow: team also gets +30% speed'), { flag:'luna_r_haste' }), TAL('🦇', L('+18% krađe života', '+18% lifesteal'), { ls:0.18 })],
  ],
  tragac: [
    [TAL('💫', L('Leteća zvijezda +60 štete', 'Throwing Star +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('🏃', L('+20 brzine', '+20 speed'), { spd:20 })],
    [TAL('💨', L('Dimna bomba +1 s tišine', 'Smoke Bomb +1 s silence'), { ab:{ W:{ dur:1 } } }), TAL('⚔️', L('+35 štete', '+35 damage'), { dmg:35 })],
    [TAL('💢', L('Lukavi udarac +1 rang', 'Sneaky Strike +1 rank'), { pas:1 }), TAL('🦋', L('+15% izbjegavanja', '+15% evasion'), { evasion:0.15 })],
    [TAL('💰', L('Ucjena +150 zlata', 'Bounty +150 gold'), { flag:'tragac_r_gold' }), TAL('⚡', L('+40% brzine napada', '+40% attack speed'), { aspd:0.4 })],
  ],
  jez: [
    [TAL('🌵', L('Kiša bodlji +40 štete', 'Quill Spray +40 damage'), { ab:{ Q:{ dmg:40 } } }), TAL('❤️', L('+275 života', '+275 HP'), { hp:275 })],
    [TAL('🌰', L('Klupko +0.5 s omame', 'Rolling Ball +0.5 s stun'), { ab:{ E:{ dur:0.5 } } }), TAL('🛡️', L('+5 oklopa', '+5 armor'), { armor:5 })],
    [TAL('🌵', L('Kiša bodlji −2 s hlađenja', 'Quill Spray −2 s cooldown'), { ab:{ Q:{ cd:-2 } } }), TAL('🦔', L('Oklop od bodlji +1 rang', 'Quill Armor +1 rank'), { pas:1 })],
    [TAL('🏃', L('Juriš bodlji −25 s hlađenja', 'Quill Rush −25 s cooldown'), { ab:{ R:{ cd:-25 } } }), TAL('❤️', L('+700 života', '+700 HP'), { hp:700 })],
  ],
  slon: [
    [TAL('🦶', L('Topot +60 štete', 'Stomp +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('🛡️', L('+4 oklopa', '+4 armor'), { armor:4 })],
    [TAL('💦', L('Tuš iz surle +70 liječenja', 'Trunk Shower +70 healing'), { ab:{ E:{ heal:70 } } }), TAL('❤️', L('+300 života', '+300 HP'), { hp:300 })],
    [TAL('🦶', L('Topot +0.6 s omame', 'Stomp +0.6 s stun'), { ab:{ Q:{ dur:0.6 } } }), TAL('⚔️', L('+50 štete', '+50 damage'), { dmg:50 })],
    [TAL('🐘', L('Stampedo −30 s hlađenja', 'Stampede −30 s cooldown'), { ab:{ R:{ cd:-30 } } }), TAL('🛡️', L('Debela koža +1 rang', 'Thick Skin +1 rank'), { pas:1 })],
  ],
  pcela: [
    [TAL('🐝', L('Otrovni ubod +50 štete', 'Poison Sting +50 damage'), { ab:{ Q:{ dmg:50 } } }), TAL('💧', L('+2 obnove mane', '+2 mana regen'), { mpRegen:2 })],
    [TAL('🍯', L('Roj +15 štete po ubodu', 'Swarm +15 damage per sting'), { ab:{ W:{ dmg:15 } } }), TAL('🏃', L('+25 brzine', '+25 speed'), { spd:25 })],
    [TAL('🧈', L('Med +1 rang', 'Honey +1 rank'), { pas:1 }), TAL('✨', L('+12% jačine magija', '+12% spell power'), { spellAmp:0.12 })],
    [TAL('🏺', L('Košnica +40 štete po udaru', 'Beehive +40 damage per hit'), { ab:{ R:{ dmg:40 } } }), TAL('⏱️', L('−20% hlađenja moći', '−20% ability cooldowns'), { cdr:0.2 })],
  ],
  sova: [
    [TAL('📣', L('Huk +55 štete', 'Hoot +55 damage'), { ab:{ Q:{ dmg:55 } } }), TAL('🏃', L('+20 brzine', '+20 speed'), { spd:20 })],
    [TAL('📣', L('Huk +1 s tišine', 'Hoot +1 s silence'), { ab:{ Q:{ dur:1 } } }), TAL('💧', L('+250 mane', '+250 mana'), { mp:250 })],
    [TAL('🌙', L('Noćna ptica +1 rang', 'Night Bird +1 rank'), { pas:1 }), TAL('✨', L('+12% jačine magija', '+12% spell power'), { spellAmp:0.12 })],
    [TAL('🌑', L('Vječna noć −30 s hlađenja', 'Endless Night −30 s cooldown'), { ab:{ R:{ cd:-30 } } }), TAL('❤️', L('+500 života', '+500 HP'), { hp:500 })],
  ],
  majmun: [
    [TAL('🥢', L('Štap-udarac +60 štete', 'Staff Strike +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('🏃', L('+20 brzine', '+20 speed'), { spd:20 })],
    [TAL('🍌', L('Banana +0.6 s omame', 'Banana +0.6 s stun'), { ab:{ E:{ dur:0.6 } } }), TAL('⚔️', L('+35 štete', '+35 damage'), { dmg:35 })],
    [TAL('👊', L('Kombo +1 rang', 'Combo +1 rank'), { pas:1 }), TAL('🦋', L('+15% izbjegavanja', '+15% evasion'), { evasion:0.15 })],
    [TAL('🐒', L('Majmunska vojska: 4 majmuna', 'Monkey Army: 4 monkeys'), { flag:'majmun_r4' }), TAL('🦇', L('+18% krađe života', '+18% lifesteal'), { ls:0.18 })],
  ],
  vuk: [
    [TAL('🦷', L('Ugriz +60 štete', 'Bite +60 damage'), { ab:{ W:{ dmg:60 } } }), TAL('❤️', L('+250 života', '+250 HP'), { hp:250 })],
    [TAL('🌕', L('Zavijanje −4 s hlađenja', 'Howl −4 s cooldown'), { ab:{ Q:{ cd:-4 } } }), TAL('⚡', L('+25% brzine napada', '+25% attack speed'), { aspd:0.25 })],
    [TAL('🐾', L('Čopor +1 rang', 'Pack +1 rank'), { pas:1 }), TAL('⚔️', L('+45 štete', '+45 damage'), { dmg:45 })],
    [TAL('🐺', L('Vučji oblik −25 s hlađenja', 'Wolf Form −25 s cooldown'), { ab:{ R:{ cd:-25 } } }), TAL('🦇', L('+20% krađe života', '+20% lifesteal'), { ls:0.2 })],
  ],
  gavran: [
    [TAL('🌀', L('Kletva +60 štete', 'Curse +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('💧', L('+2 obnove mane', '+2 mana regen'), { mpRegen:2 })],
    [TAL('🔁', L('Zamjena −4 s hlađenja', 'Swap −4 s cooldown'), { ab:{ W:{ cd:-4 } } }), TAL('❤️', L('+275 života', '+275 HP'), { hp:275 })],
    [TAL('🪶', L('Pernata oluja +20 štete po udaru', 'Feather Storm +20 damage per hit'), { ab:{ E:{ dmg:20 } } }), TAL('✨', L('+12% jačine magija', '+12% spell power'), { spellAmp:0.12 })],
    [TAL('🐦‍⬛', L('Jato gavranova +30 štete po udaru', 'Raven Flock +30 damage per hit'), { ab:{ R:{ dmg:30 } } }), TAL('🪶', L('Gavranovo pero +1 rang', 'Raven Feather +1 rank'), { pas:1 })],
  ],
  hobotnica: [
    [TAL('🖤', L('Mlaz tinte +60 štete', 'Ink Jet +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('🛡️', L('+4 oklopa', '+4 armor'), { armor:4 })],
    [TAL('🫂', L('Zagrljaj pipaka +0.6 s', 'Tentacle Hug +0.6 s'), { ab:{ E:{ dur:0.6 } } }), TAL('❤️', L('+300 života', '+300 HP'), { hp:300 })],
    [TAL('🐙', L('Pipci −3 s hlađenja', 'Tentacles −3 s cooldown'), { ab:{ W:{ cd:-3 } } }), TAL('💧', L('Sluzava koža +1 rang', 'Slimy Skin +1 rank'), { pas:1 })],
    [TAL('🌀', L('Vrtlog dubina +1 s omame', 'Deep Whirlpool +1 s stun'), { ab:{ R:{ dur:1 } } }), TAL('❤️', L('+700 života', '+700 HP'), { hp:700 })],
  ],
  nosorog: [
    [TAL('🏃', L('Juriš +70 štete', 'Charge +70 damage'), { ab:{ Q:{ dmg:70 } } }), TAL('❤️', L('+275 života', '+275 HP'), { hp:275 })],
    [TAL('📢', L('Izazov +0.6 s', 'Challenge +0.6 s'), { ab:{ E:{ dur:0.6 } } }), TAL('🛡️', L('+5 oklopa', '+5 armor'), { armor:5 })],
    [TAL('🏃', L('Juriš −4 s hlađenja', 'Charge −4 s cooldown'), { ab:{ Q:{ cd:-4 } } }), TAL('⚔️', L('+45 štete', '+45 damage'), { dmg:45 })],
    [TAL('😡', L('Bijes −25 s hlađenja', 'Rage −25 s cooldown'), { ab:{ R:{ cd:-25 } } }), TAL('🛡️', L('Debeli oklop +1 rang', 'Thick Armor +1 rank'), { pas:1 })],
  ],
  panda: [
    [TAL('👏', L('Grom-pljesak +60 štete', 'Thunder Clap +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('❤️', L('+250 života', '+250 HP'), { hp:250 })],
    [TAL('💫', L('Vrtoglavica −4 s hlađenja', 'Dizzy Spin −4 s cooldown'), { ab:{ W:{ cd:-4 } } }), TAL('🛡️', L('+5 oklopa', '+5 armor'), { armor:5 })],
    [TAL('🎋', L('Bambus +1 rang', 'Bamboo +1 rank'), { pas:1 }), TAL('⚔️', L('+45 štete', '+45 damage'), { dmg:45 })],
    [TAL('🐼', L('Tri pande: 4 pande', 'Three Pandas: 4 pandas'), { flag:'panda_r4' }), TAL('❤️', L('+700 života', '+700 HP'), { hp:700 })],
  ],
  jednorog: [
    [TAL('💖', L('Ljekoviti rog +70 liječenja', 'Healing Horn +70 healing'), { ab:{ W:{ heal:70 } } }), TAL('💧', L('+2 obnove mane', '+2 mana regen'), { mpRegen:2 })],
    [TAL('🌈', L('Dugin snop +70 štete', 'Rainbow Beam +70 damage'), { ab:{ Q:{ dmg:70 } } }), TAL('❤️', L('+275 života', '+275 HP'), { hp:275 })],
    [TAL('✨', L('Čarobna griva +1 rang', 'Magic Mane +1 rank'), { pas:1 }), TAL('🏃', L('+30 brzine', '+30 speed'), { spd:30 })],
    [TAL('🌠', L('Zvjezdani galop +0.8 s omame', 'Star Gallop +0.8 s stun'), { ab:{ R:{ dur:0.8 } } }), TAL('⏱️', L('−20% hlađenja moći', '−20% ability cooldowns'), { cdr:0.2 })],
  ],
  morskipas: [
    [TAL('🦷', L('Ugriz +60 štete', 'Bite +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('🏃', L('+20 brzine', '+20 speed'), { spd:20 })],
    [TAL('🌀', L('Krvavi vrtlog −3 s hlađenja', 'Blood Whirl −3 s cooldown'), { ab:{ E:{ cd:-3 } } }), TAL('⚔️', L('+35 štete', '+35 damage'), { dmg:35 })],
    [TAL('🩸', L('Miris krvi +1 rang', 'Scent of Blood +1 rank'), { pas:1 }), TAL('🦋', L('+15% izbjegavanja', '+15% evasion'), { evasion:0.15 })],
    [TAL('😤', L('Pomama −25 s hlađenja', 'Frenzy −25 s cooldown'), { ab:{ R:{ cd:-25 } } }), TAL('🦇', L('+20% krađe života', '+20% lifesteal'), { ls:0.2 })],
  ],
  nisan: [
    [TAL('🌰', L('Kiša žirova +8 štete po udaru', 'Acorn Rain +8 damage per hit'), { ab:{ Q:{ dmg:8 } } }), TAL('⚡', L('+20% brzine napada', '+20% attack speed'), { aspd:0.2 })],
    [TAL('🔭', L('Durbin −6 s hlađenja', 'Spyglass −6 s cooldown'), { ab:{ E:{ cd:-6 } } }), TAL('🏃', L('+25 brzine', '+25 speed'), { spd:25 })],
    [TAL('🎯', L('Pogodak u glavu +1 rang', 'Headshot +1 rank'), { pas:1 }), TAL('🏹', L('+100 dometa napada', '+100 attack range'), { range:100 })],
    [TAL('🔫', L('Savršen hitac: nišani duplo brže', 'Perfect Shot: aims twice as fast'), { flag:'nisan_r_fast' }), TAL('🔫', L('Savršen hitac +250 štete', 'Perfect Shot +250 damage'), { ab:{ R:{ dmg:250 } } })],
  ],
  bikos: [
    [TAL('🗯️', L('Bojni zov +0.4 s', 'Battle Call +0.4 s'), { ab:{ Q:{ dur:0.4 } } }), TAL('❤️', L('+275 života', '+275 HP'), { hp:275 })],
    [TAL('🍖', L('Ratna glad +15 štete/s', 'Battle Hunger +15 damage/s'), { flag:'bikos_w_plus' }), TAL('🛡️', L('+5 oklopa', '+5 armor'), { armor:5 })],
    [TAL('🌀', L('Bikovski vrtlog +1 rang', 'Bull Spin +1 rank'), { pas:1 }), TAL('🏃', L('+30 brzine', '+30 speed'), { spd:30 })],
    [TAL('🪓', L('Smrtni udarac: prag +150', 'Final Blow: +150 HP threshold'), { flag:'bikos_r_plus' }), TAL('🗯️', L('Bojni zov −4 s hlađenja', 'Battle Call −4 s cooldown'), { ab:{ Q:{ cd:-4 } } })],
  ],
  // ---- v0.55 ----
  nilski: [
    [TAL('🪝', L('Udica +70 štete', 'Hook +70 damage'), { ab:{ Q:{ dmg:70 } } }), TAL('❤️', L('+250 života', '+250 HP'), { hp:250 })],
    [TAL('🤢', L('Smrdljivi oblak +10 štete/s', 'Stinky Cloud +10 damage/s'), { ab:{ W:{ dmg:5 } } }), TAL('🛡️', L('+5 oklopa', '+5 armor'), { armor:5 })],
    [TAL('🪝', L('Udica −4 s hlađenja', 'Hook −4 s cooldown'), { ab:{ Q:{ cd:-4 } } }), TAL('🍉', L('Gozba +1 rang', 'Feast +1 rank'), { pas:1 })],
    [TAL('😋', L('Veliki zalogaj traje 1 s dulje', 'Big Gulp lasts 1 s longer'), { flag:'nilski_r_long' }), TAL('🪝', L('Udica +250 dometa', 'Hook +250 range'), { flag:'nilski_q_far' })],
  ],
  irbis: [
    [TAL('❄️', L('Ledene strijele +15 štete', 'Frost Arrows +15 damage'), { flag:'irbis_q_plus' }), TAL('⚡', L('+20% brzine napada', '+20% attack speed'), { aspd:0.2 })],
    [TAL('🌬️', L('Snježni nalet +1 s tišine', 'Snow Gust +1 s silence'), { ab:{ W:{ dur:1 } } }), TAL('🏹', L('+75 dometa napada', '+75 attack range'), { range:75 })],
    [TAL('🏹', L('Lepeza strijela: +1 val', 'Arrow Fan: +1 wave'), { flag:'irbis_e_wave' }), TAL('🎯', L('Aura preciznosti +1 rang', 'Precision Aura +1 rank'), { pas:1 })],
    [TAL('🎖️', L('Majstorica luka radi i kad su neprijatelji blizu', 'Master Archer works even with enemies close'), { flag:'irbis_r_always' }), TAL('🦋', L('+25% izbjegavanja', '+25% evasion'), { evasion:0.25 })],
  ],
  skorpion: [
    [TAL('🕳️', L('Podzemni juriš +60 štete', 'Burrow Strike +60 damage'), { ab:{ Q:{ dmg:60 } } }), TAL('❤️', L('+250 života', '+250 HP'), { hp:250 })],
    [TAL('🦂', L('Žalac −3 s hlađenja', 'Stinger −3 s cooldown'), { ab:{ E:{ cd:-3 } } }), TAL('🛡️', L('+5 oklopa', '+5 armor'), { armor:5 })],
    [TAL('🧪', L('Otrovni prasak +1 rang', 'Venom Burst +1 rank'), { pas:1 }), TAL('⏳', L('Pješčana oluja +10 štete/s', 'Sandstorm +10 damage/s'), { ab:{ W:{ dmg:5 } } })],
    [TAL('🌋', L('Epicentar +3 udara', 'Epicenter +3 pulses'), { flag:'skorpion_r_more' }), TAL('🕳️', L('Podzemni juriš +0.6 s omame', 'Burrow Strike +0.6 s stun'), { ab:{ Q:{ dur:0.6 } } })],
  ],
};

/* ---------------- RUNE NA RIJECI ---------------- */

const RUNE_SPOTS = [{ x:1150, y:1150 }, { x:1850, y:1850 }];
// sva mjesta na mapi zadana su za staru mapu 3000×3000 — ovdje se skaliraju na veću
for(const arr of [CAMP_SPOTS, BOUNTY_SPOTS, WISDOM_SPOTS, SHRINE_SPOTS, RUNE_SPOTS])
  for(const p of arr){ p.x = Math.round(p.x * MAP_S); p.y = Math.round(p.y * MAP_S); }
const RUNE_TYPES = [
  { id:'haste',  emoji:'💨', name:L('Runa brzine', 'Haste Rune'),
    apply(h){ applyHaste(h, 1.8, 15); } },
  { id:'regen',  emoji:'💚', name:L('Runa obnove', 'Regen Rune'),
    apply(h){ h.runeRegenT = 10; } },
  { id:'double', emoji:'⚔️', name:L('Runa dvostruke štete', 'Double Damage Rune'),
    apply(h){ h.status.dmgMulT = 20; h.status.dmgMulF = 2; } },
  { id:'shield', emoji:'🛡️', name:L('Runa štita', 'Shield Rune'),
    apply(h){ applyShield(h, 0.5, 15); } },
];
