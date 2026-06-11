'use strict';
/* ============================================================
   DOTA Kids 3D — podaci (DotA All-Stars mehanike)
   - 8 junaka; moći imaju RANGOVE (Q/W/E max 4, ULTI max 2).
   - Ciljanje: target:'point' moći otvaraju prikaz dometa
     (castRange = domet, aoe = krug područja, line = projektil).
   - Predmeti s receptima; neutralni kampovi; rune; dan/noć.
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
  maxLevel: 12,
  ultLevels: [6, 10],
  inventorySlots: 6,
  campRespawn: 60,
  bossRespawn: 180,
  runeEvery: 120,
  dayCycle: 240,
  uphillMissChance: 0.25,   // promašaj kad pucaš uzbrdo (klasika!)
};

function xpNeed(level){ return 55 + level * 60; }

/* ---------------- JUNACI ----------------
   cast(u, aim, rk) — rk je rang moći. Vraća false ako nema mete.
   target:'point' → igrač prvo vidi domet pa klikom bira cilj.   */

const HEROES = [
  {
    id:'vitez', name:'Lavko', emoji:'🦁',
    role:'🛡️ Vitez — hrabri tenk',
    hp:680, hpG:102, mp:240, mpG:24, dmg:60, dmgG:7,
    range:78, speed:168, atkCd:1.1, projSpeed:0,
    abilities:[
      { key:'Q', name:'Vrtlog', emoji:'🌪️', cd:7, mana:40, color:'#fbbf24',
        desc:'Zavrti mač i udari sve oko sebe',
        bot:{type:'aoe-self', range:175},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 175, 60 + 45*rk, {color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 16, 220, 5);
          return true;
        }},
      { key:'W', name:'Lavlja koža', emoji:'🦺', cd:0, mana:0, color:'#fde047',
        passive:true, pid:'koza',
        desc:'PASIVNO: tvrda lavlja koža trajno smanjuje SVU primljenu štetu (6/9/12/15%)' },
      { key:'E', name:'Junački skok', emoji:'💥', cd:15, mana:70, color:'#f97316',
        desc:'Skoči na mjesto, udari i omami neprijatelje',
        target:'point', castRange:360, aoe:160,
        bot:{type:'gap', range:360},
        cast(u, aim, rk){
          leapTo(u, aim, 360);
          damageCircle(u, u.x, u.y, 160, 60 + 35*rk, {stun:0.7 + 0.1*rk, color:'#f97316'});
          burst(u.x, u.y, '#f97316', 22, 260, 6);
          return true;
        }},
      { key:'R', name:'Kraljev urlik', emoji:'🦁', cd:70, mana:120, ult:true, color:'#fde047',
        desc:'ULTI: Moćan urlik — velika šteta i omama oko tebe, a ti dobivaš štit',
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
    hp:530, hpG:76, mp:300, mpG:32, dmg:52, dmgG:6,
    range:330, speed:165, atkCd:1.15, projSpeed:600,
    abilities:[
      { key:'Q', name:'Vatrena kugla', emoji:'🔥', cd:6, mana:45, color:'#fb923c',
        desc:'Ispali vatrenu kuglu prema cilju',
        target:'point', castRange:760, line:true,
        bot:{type:'shot', range:680},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:560, r:24, range:760,
            dmg:70 + 45*rk, color:'#fb923c', emoji:'🔥'});
        }},
      { key:'W', name:'Plameni krug', emoji:'💍', cd:10, mana:55, color:'#f97316',
        desc:'Plamen oprži sve oko tebe i malo ih uspori',
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
        bot:{type:'zone', range:560},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:185, delay:0.9, ticks:1, interval:0.5,
            dmg:130 + 70*rk, stun:0.5, castRange:620,
            color:'#f97316', emoji:'☄️'});
        }},
      { key:'R', name:'Zmajev dah', emoji:'🐲', cd:70, mana:130, ult:true, color:'#ef4444',
        desc:'ULTI: Ogromna vatrena lopta koja probija sve na svom putu',
        target:'point', castRange:950, line:true,
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
    hp:530, hpG:76, mp:310, mpG:33, dmg:50, dmgG:6,
    range:330, speed:165, atkCd:1.15, projSpeed:600,
    abilities:[
      { key:'Q', name:'Ledena strijela', emoji:'🧊', cd:6, mana:40, color:'#38bdf8',
        desc:'Ledena strijela ranjava i jako usporava',
        target:'point', castRange:740, line:true,
        bot:{type:'shot', range:660},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:520, r:22, range:740,
            dmg:58 + 40*rk, slow:{f:0.3 + 0.05*rk, t:2.5},
            color:'#38bdf8', emoji:'🧊'});
        }},
      { key:'W', name:'Ledeni dodir', emoji:'❄️', cd:0, mana:0, color:'#7dd3fc',
        passive:true, pid:'dodir',
        desc:'PASIVNO: svaki tvoj napad usporava neprijatelja (15/20/25/30%)' },
      { key:'E', name:'Snježna oluja', emoji:'🌨️', cd:20, mana:100, color:'#7dd3fc',
        desc:'Mećava na mjestu — pada 4 puta i usporava',
        target:'point', castRange:600, aoe:205,
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:205, delay:0.5, ticks:4, interval:0.8,
            dmg:28 + 20*rk, slow:{f:0.4, t:1}, castRange:600,
            color:'#7dd3fc', emoji:'❄️'});
        }},
      { key:'R', name:'Ledeno doba', emoji:'🥶', cd:75, mana:140, ult:true, color:'#bae6fd',
        desc:'ULTI: Zamrzni veliko područje — neprijatelji su omamljeni',
        target:'point', castRange:600, aoe:300,
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
    hp:550, hpG:82, mp:250, mpG:26, dmg:58, dmgG:8,
    range:360, speed:170, atkCd:1.0, projSpeed:680,
    abilities:[
      { key:'Q', name:'Probojna strijela', emoji:'🎯', cd:7, mana:40, color:'#fbbf24',
        desc:'Strijela koja probija sve na svom putu',
        target:'point', castRange:860, line:true,
        bot:{type:'shot', range:760},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:680, r:18, range:860,
            dmg:62 + 42*rk, pierce:true, color:'#fbbf24', emoji:'🎯'});
        }},
      { key:'W', name:'Oštro oko', emoji:'👁️', cd:0, mana:0, color:'#fb923c',
        passive:true, pid:'oko',
        desc:'PASIVNO: 15% šanse za KRITIČNI pogodak (×1.5/1.75/2/2.25 štete)' },
      { key:'E', name:'Kiša strijela', emoji:'🌧️', cd:18, mana:90, color:'#f59e0b',
        desc:'Strijele padaju 3 puta na odabrano mjesto',
        target:'point', castRange:600, aoe:200,
        bot:{type:'zone', range:540},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:200, delay:0.6, ticks:3, interval:0.6,
            dmg:40 + 25*rk, castRange:600,
            color:'#f59e0b', emoji:'🏹'});
        }},
      { key:'R', name:'Sokolovo oko', emoji:'🌠', cd:65, mana:110, ult:true, color:'#fde047',
        desc:'ULTI: Čarobna strijela sama pronađe najslabijeg neprijateljskog junaka!',
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
    hp:600, hpG:88, mp:300, mpG:32, dmg:52, dmgG:6,
    range:300, speed:163, atkCd:1.15, projSpeed:560,
    abilities:[
      { key:'Q', name:'Trnova kugla', emoji:'🌰', cd:6, mana:40, color:'#84cc16',
        desc:'Baci bodljikavu kuglu koja usporava',
        target:'point', castRange:720, line:true,
        bot:{type:'shot', range:640},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:540, r:22, range:720,
            dmg:60 + 40*rk, slow:{f:0.25, t:1.5},
            color:'#84cc16', emoji:'🌰'});
        }},
      { key:'W', name:'Iscjeljenje', emoji:'💚', cd:11, mana:65, color:'#4ade80',
        desc:'Izliječi sebe i prijatelje oko sebe',
        bot:{type:'heal', range:270},
        cast(u, aim, rk){
          healCircle(u, 270, 55 + 45*rk);
          return true;
        }},
      { key:'E', name:'Korijenje', emoji:'🌱', cd:17, mana:90, color:'#22c55e',
        desc:'Korijenje zaustavi neprijatelje na mjestu',
        target:'point', castRange:560, aoe:215,
        bot:{type:'zone', range:520},
        cast(u, aim, rk){
          return spawnZone(u, aim, {r:215, delay:0.4, ticks:1, interval:0.5,
            dmg:35 + 28*rk, root:1.1 + 0.2*rk, castRange:560,
            color:'#22c55e', emoji:'🌱'});
        }},
      { key:'R', name:'Šumsko srce', emoji:'🌳', cd:70, mana:130, ult:true, color:'#22c55e',
        desc:'ULTI: Velika šuma — izliječi i ubrza prijatelje, a neprijatelje veže korijenjem',
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
    hp:580, hpG:88, mp:260, mpG:27, dmg:62, dmgG:8,
    range:95, speed:188, atkCd:1.0, projSpeed:0,
    abilities:[
      { key:'Q', name:'Munjeviti udar', emoji:'⚡', cd:6, mana:45, color:'#fde047',
        desc:'Munja skače s neprijatelja na neprijatelja (do 3)',
        bot:{type:'chain', range:470},
        cast(u, aim, rk){
          return chainLightning(u, {range:480, jump:330, max:3, dmg:55 + 38*rk});
        }},
      { key:'W', name:'Bljesak', emoji:'🌀', cd:9, mana:40, color:'#fde047',
        desc:'Munjevito juriš prema cilju i ošteti sve na putu',
        target:'point', castRange:330, line:true,
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
        desc:'PASIVNO: tvoji napadi imaju šansu (20/25/30/35%) okinuti dodatnu munju' },
      { key:'R', name:'Gnjev oluje', emoji:'🌩️', cd:65, mana:120, ult:true, color:'#a78bfa',
        desc:'ULTI: Divovska munja skače na čak 6 neprijatelja, a tebe ubrza',
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
    hp:640, hpG:95, mp:260, mpG:26, dmg:58, dmgG:7,
    range:85, speed:172, atkCd:1.05, projSpeed:0,
    abilities:[
      { key:'Q', name:'Jezičina', emoji:'👅', cd:9, mana:50, color:'#f472b6',
        desc:'Izbaci jezik — prvog pogođenog povuče k sebi i kratko omami!',
        target:'point', castRange:560, line:true,
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
        bot:{type:'gap', range:340},
        cast(u, aim, rk){
          leapTo(u, aim, 340);
          damageCircle(u, u.x, u.y, 150, 40 + 25*rk, {slow:{f:0.3, t:2}, color:'#86efac'});
          burst(u.x, u.y, '#86efac', 18, 220, 5);
          return true;
        }},
      { key:'E', name:'Mjehur', emoji:'🫧', cd:14, mana:60, color:'#a5f3fc',
        desc:'Mjehurići štite tebe i prijatelje (upijaju trećinu štete)',
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
    hp:520, hpG:74, mp:270, mpG:28, dmg:60, dmgG:8,
    range:380, speed:175, atkCd:1.0, projSpeed:700,
    abilities:[
      { key:'Q', name:'Pero-oštrica', emoji:'🪶', cd:6, mana:40, color:'#e2e8f0',
        desc:'Munjevito brzo pero — pogađa izdaleka',
        target:'point', castRange:900, line:true,
        bot:{type:'shot', range:800},
        cast(u, aim, rk){
          return spawnSkillshot(u, aim, {speed:820, r:16, range:900,
            dmg:66 + 44*rk, color:'#e2e8f0', emoji:'🪶'});
        }},
      { key:'W', name:'Uzlet', emoji:'🌬️', cd:12, mana:50, color:'#bae6fd',
        desc:'Vjetar pod krilima — ubrzanje i skida sva usporenja s tebe',
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
        bot:{type:'gap', range:380},
        cast(u, aim, rk){
          leapTo(u, aim, 380);
          damageCircle(u, u.x, u.y, 150, 55 + 35*rk, {slow:{f:0.35, t:2}, color:'#fbbf24'});
          burst(u.x, u.y, '#fbbf24', 20, 240, 6);
          return true;
        }},
      { key:'R', name:'Kralj neba', emoji:'🌪️', cd:70, mana:125, ult:true, color:'#fde047',
        desc:'ULTI: Pošalji sokole na SVE neprijateljske junake u blizini!',
        bot:{type:'chain', range:900},
        cast(u, aim, rk){
          let n = 0;
          for(const e of units){
            if(e.kind !== 'hero' || e.team === u.team || e.dead || e.removeMe) continue;
            if(dist(u, e) > 1400) continue;
            if(!isVisibleTo(u.team, e)) continue;   // magla rata: ne vidiš — ne gađaš
            if(e.status.invisT > 0) continue;       // nevidljive ne možeš naciljati
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
    hp:540, hpG:80, mp:280, mpG:30, dmg:56, dmgG:7,
    range:340, speed:172, atkCd:1.05, projSpeed:650,
    abilities:[
      { key:'Q', name:'Sveta strijela', emoji:'🌠', cd:9, mana:50, color:'#e9d5ff',
        desc:'Mjesečeva strijela leti JAKO daleko — što dulje leti, jače omami i ranjava!',
        target:'point', castRange:1100, line:true,
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
        bot:{type:'aoe-self', range:250},
        cast(u, aim, rk){
          damageCircle(u, u.x, u.y, 250, 40 + 32*rk, {color:'#e9d5ff'});
          burst(u.x, u.y, '#fde047', 14, 200, 5, '⭐');
          burst(u.x, u.y, '#e9d5ff', 14, 240, 5);
          return true;
        }},
      { key:'E', name:'Mjesečev skok', emoji:'🌜', cd:12, mana:50, color:'#bae6fd',
        desc:'Skoči naprijed i potrči brže 2 sekunde',
        target:'point', castRange:400, line:true,
        bot:{type:'gap', range:400},
        cast(u, aim, rk){
          leapTo(u, aim, 400);
          applyHaste(u, 1.2 + 0.05*rk, 2);
          burst(u.x, u.y, '#bae6fd', 16, 200, 5);
          return true;
        }},
      { key:'R', name:'Mjesečeva sjena', emoji:'👻', cd:80, mana:140, ult:true, color:'#c4b5fd',
        desc:'ULTI: CIJELI tvoj tim postaje NEVIDLJIV! Napad prekida nevidljivost',
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
];

/* ---------------- DUĆAN S RECEPTIMA ---------------- */

const ITEMS = [
  // ----- TIR 1: osnovni predmeti -----
  { id:'sword',  emoji:'⚔️', name:'Mač',           tier:1, cost:400, desc:'+14 štete',                stats:{dmg:14},            basic:true },
  { id:'heart',  emoji:'❤️', name:'Srce',           tier:1, cost:450, desc:'+220 života',              stats:{hp:220},            basic:true },
  { id:'orb',    emoji:'🔮', name:'Čarobna kugla',  tier:1, cost:430, desc:'+150 mane, +1 obnova mane', stats:{mp:150, mpRegen:1}, basic:true },
  { id:'boots',  emoji:'👟', name:'Brze čizme',     tier:1, cost:350, desc:'+38 brzine',               stats:{speed:38},          basic:true, tag:'boots' },
  { id:'potion', emoji:'🧪', name:'Napitak',        tier:1, cost:120, desc:'Odmah vrati 320 života (ne zauzima torbu)', instant:true, heal:320, basic:true },
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
  // ----- TIR 4: legendarni -----
  { id:'crown',       emoji:'👑', name:'Kruna kraljeva',  tier:4, cost:600, desc:'+55 štete, +450 života',
    stats:{dmg:55, hp:450}, components:['bigsword','bigheart'] },
  { id:'dragonblade', emoji:'🐲', name:'Zmajska oštrica', tier:4, cost:800, desc:'+85 štete, +650 života, +3 obnova',
    stats:{dmg:85, hp:650, hpRegen:3}, components:['kingsword','titanheart'] },
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

/* ---------------- DŽUNGLA: NEUTRALNI KAMPOVI ---------------- */

const CAMP_TYPES = {
  boars:  { n:3, emoji:'🐗', name:'Veprić',      hp:340,  dmg:24, range:60, atkCd:1.2, speed:120, r:15, gold:34,  xp:40 },
  wolves: { n:2, emoji:'🐺', name:'Vuk',         hp:540,  dmg:34, range:65, atkCd:1.1, speed:135, r:17, gold:55,  xp:60 },
  bear:   { n:1, emoji:'🐻', name:'Medo Brundo', hp:1000, dmg:52, range:75, atkCd:1.2, speed:115, r:22, gold:130, xp:130 },
  boss:   { n:1, emoji:'🐲', name:'Veliki Zmaj', hp:2600, dmg:78, range:95, atkCd:1.3, speed:110, r:34, gold:260, xp:300, boss:true, hpRegen:4 },
};
const CAMP_SPOTS = [
  { x:850,  y:1300, type:'boars'  },
  { x:1300, y:850,  type:'wolves' },
  { x:2120, y:1700, type:'boars'  },
  { x:1700, y:2120, type:'wolves' },
  { x:2100, y:2100, type:'bear'   },
  { x:800,  y:800,  type:'boss'   },
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
