/* =====================================================================
   🛒 DUĆAN, IKONE I OPISI PREDMETA (kao u DotA)
   - ikone: pravokutne "slike" predmeta nacrtane na platnu (boja = kvaliteta predmeta)
   - dućan: kartice ⭐ Vodič / Osnovni / Nadogradnje, stupci po kategorijama,
     tražilica, detalji s receptom (sastojci i "ulazi u"), desni klik = kupi
   - 📌 brza kupnja: prikvači predmet, HUD pokazuje što još fali
   - jedan zajednički opis (tooltip) za dućan i torbu
   ===================================================================== */

/* ---------- ikone predmeta ---------- */
const ITEM_ICON = {}, ITEM_ICON_URL = {};
const ICON_W = 88, ICON_H = 64;
function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}
function itemIconCanvas(it){
  if(ITEM_ICON[it.id]) return ITEM_ICON[it.id];
  const c = document.createElement('canvas'); c.width = ICON_W; c.height = ICON_H;
  // softversko platno: toDataURL() je tada trenutan (ne čeka grafičku karticu koja crta 3D scenu)
  const g = c.getContext('2d', { willReadFrequently: true });
  const q = ITEM_QUALITY[it.q] || ITEM_QUALITY.comp;
  // pozadina: tamni gradijent u boji kvalitete
  const bg = g.createRadialGradient(ICON_W * 0.5, ICON_H * 0.36, 4, ICON_W * 0.5, ICON_H * 0.5, ICON_W * 0.66);
  bg.addColorStop(0, q[1]); bg.addColorStop(1, q[2]);
  g.fillStyle = bg; g.fillRect(0, 0, ICON_W, ICON_H);
  // tihe zrake iza predmeta
  g.save(); g.translate(ICON_W / 2, ICON_H * 0.48); g.globalAlpha = 0.09; g.fillStyle = q[0];
  for(let i = 0; i < 12; i++){ g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(-6, -70); g.lineTo(6, -70); g.closePath(); g.fill(); }
  g.restore();
  // sjaj iza emojija
  const gl = g.createRadialGradient(ICON_W / 2, ICON_H / 2, 2, ICON_W / 2, ICON_H / 2, 30);
  gl.addColorStop(0, hexA(q[0], 0.5)); gl.addColorStop(1, hexA(q[0], 0));
  g.fillStyle = gl; g.fillRect(0, 0, ICON_W, ICON_H);
  // sam predmet
  g.font = fontEmoji(38); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 7; g.shadowOffsetY = 3;
  g.fillText(it.emoji, ICON_W / 2, ICON_H / 2 + 2);
  g.shadowColor = 'transparent';
  // odsjaj gore + tamni rubovi
  const gg = g.createLinearGradient(0, 0, 0, ICON_H * 0.55);
  gg.addColorStop(0, 'rgba(255,255,255,0.17)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gg; g.fillRect(0, 0, ICON_W, ICON_H * 0.55);
  const vg = g.createRadialGradient(ICON_W / 2, ICON_H / 2, ICON_H * 0.42, ICON_W / 2, ICON_H / 2, ICON_W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg; g.fillRect(0, 0, ICON_W, ICON_H);
  g.strokeStyle = hexA(q[0], 0.9); g.lineWidth = 2; g.strokeRect(1, 1, ICON_W - 2, ICON_H - 2);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.strokeRect(3.5, 3.5, ICON_W - 7, ICON_H - 7);
  ITEM_ICON[it.id] = c;
  return c;
}
function itemIconUrl(it){
  if(!ITEM_ICON_URL[it.id]) ITEM_ICON_URL[it.id] = itemIconCanvas(it).toDataURL();
  return ITEM_ICON_URL[it.id];
}
/* svitak recepta (dio cijene nadogradnje) */
const RECIPE_ICON = { id: '_recipe', emoji: '📜', q: 'cons' };

/* ---------- opis (tooltip) predmeta ---------- */
const STAT_LABEL = {
  all: n => L('+' + n + ' svim atributima', '+' + n + ' all attributes'), str: n => L('+' + n + ' snage', '+' + n + ' strength'), agi: n => L('+' + n + ' okretnosti', '+' + n + ' agility'), int: n => L('+' + n + ' inteligencije', '+' + n + ' intelligence'),
  primary: n => L('+' + n + ' glavnom atributu', '+' + n + ' main attribute'), dmg: n => L('+' + n + ' štete', '+' + n + ' damage'), aspd: n => L('+' + n + ' brzine napada', '+' + n + ' attack speed'),
  armor: n => L('+' + n + ' oklopa', '+' + n + ' armor'), hp: n => L('+' + n + ' života', '+' + n + ' HP'), mp: n => L('+' + n + ' mane', '+' + n + ' mana'),
  hpRegen: n => L('+' + n + ' obnove života', '+' + n + ' HP regen'), mpRegen: n => L('+' + n + ' obnove mane', '+' + n + ' mana regen'), speed: n => L('+' + n + ' brzine kretanja', '+' + n + ' move speed'),
  lifesteal: n => L(Math.round(n * 100) + '% krađe života', Math.round(n * 100) + '% lifesteal'), evasion: n => L(Math.round(n * 100) + '% izbjegavanja', Math.round(n * 100) + '% evasion'),
};
const STAT_ORDER = ['all', 'str', 'agi', 'int', 'primary', 'dmg', 'aspd', 'armor', 'hp', 'mp', 'hpRegen', 'mpRegen', 'speed', 'lifesteal', 'evasion'];
function statLines(it){
  const s = it.stats || {}, out = [];
  if(it.instant) out.push(L('+' + it.heal + ' života odmah', '+' + it.heal + ' HP instantly'));
  for(const k of STAT_ORDER) if(s[k]) out.push(STAT_LABEL[k](s[k]));
  return out;
}
function escHtml(t){ return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function iconImg(it, cls){ return `<img class="${cls || ''}" src="${itemIconUrl(it)}" alt="${it.emoji}" draggable="false">`; }
function itemTipHtml(it, opts){
  opts = opts || {};
  const full = it.neutral ? 0 : itemFullCost(it);
  const qcls = 'q-' + (it.q || 'comp');
  let h = `<div class="tipHead ${qcls}">${iconImg(it, 'tipIcon')}<div class="tipT"><b>${escHtml(it.name)}</b>`;
  h += it.neutral ? `<span class="tipSub">${L('🌰 Neutralni predmet · razina', '🌰 Neutral item · tier')} ${it.ntier}</span>` : `<span class="tipCost">🪙 ${full}</span>`;
  h += '</div></div>';
  const st = statLines(it);
  if(st.length) h += '<div class="tipStats">' + st.map(x => `<div>${escHtml(x)}</div>`).join('') + '</div>';
  if(it.pas) h += `<div class="tipBox tipPas"><span class="tipLbl">${L('PASIVNO', 'PASSIVE')}</span>${escHtml(it.pas)}</div>`;
  if(it.act){
    const a = it.active || ITEM_BY_ID[it.id].active || {};
    h += `<div class="tipBox tipAct"><div class="tipActH"><span class="tipLbl">${L('AKTIVNO', 'ACTIVE')}</span><span class="tipCd">${a.mana ? '💧 ' + a.mana + ' &nbsp;' : ''}⏱️ ${a.cd || 0} s</span></div>${escHtml(it.act)}</div>`;
  }
  if(it.charges && !it.instant) h += `<div class="tipNote">${L('🔢 Punjenja', '🔢 Charges')}: ${it.charges}${it.consume ? L(' (potroši se)', ' (used up)') : ''}</div>`;
  if(it.lore && !it.neutral && !opts.compact) h += `<div class="tipLore">${escHtml(it.lore)}</div>`;
  if(it.components && !opts.compact){
    h += '<div class="tipComps"><span>' + L('Sastojci:', 'Components:') + '</span>' + it.components.map(c => iconImg(ITEM_BY_ID[c], 'tipMini')).join('') +
      (it.cost > 0 ? `<span class="tipRecipe">📜 ${it.cost}</span>` : '') + '</div>';
  }
  if(opts.foot) h += `<div class="tipFoot">${opts.foot}</div>`;
  return h;
}
function showItemTip(html, rect, side){
  const el = document.getElementById('itemTip');
  if(!el) return;
  el.innerHTML = html;
  el.classList.remove('hidden');
  const w = el.offsetWidth, hh = el.offsetHeight;
  let x, y;
  if(side === 'left'){ x = rect.x - w - 10; y = rect.y + rect.h / 2 - hh / 2; }
  else if(side === 'below'){ x = rect.x + rect.w / 2 - w / 2; y = rect.y + rect.h + 8; }   // gumbi gore desno
  else { x = rect.x + rect.w / 2 - w / 2; y = rect.y - hh - 10; }
  el.style.left = Math.round(clamp(x, 6, innerWidth - w - 6)) + 'px';
  el.style.top = Math.round(clamp(y, 6, innerHeight - hh - 6)) + 'px';
}
function hideItemTip(){
  const el = document.getElementById('itemTip');
  if(el) el.classList.add('hidden');
  hudTipKey = null;
}
/* opis moći (kao u DotA): ime, rang, opis, brojke za trenutni i sljedeći rang, mana i hlađenje */
function abilityTipHtml(h, i){
  const ab = h.abilities[i], d = ab.def, max = abilityMaxRank(ab), rk = Math.max(1, ab.rank);
  const keyL = ['Q', 'W', 'E', 'R'][i] || '';
  let html = `<div class="tipHead q-abil"><span class="tipAbIcon" style="background:linear-gradient(160deg, ${d.color || '#64748b'}, #10141b)">${d.emoji}</span>` +
    `<div class="tipT"><b>${escHtml(d.name)}${d.ult ? ' 🌟' : ''}</b><span class="tipSub">${keyL} · ${L('rang', 'rank')} ${ab.rank}/${max}${d.ult ? L(' · ULTI', ' · ULTIMATE') : ''}</span>` +
    `<span class="tipDots">${Array.from({ length: max }, (_, k) => `<i class="${k < ab.rank ? 'on' : ''}"></i>`).join('')}</span></div></div>`;
  html += `<div class="tipDesc">${escHtml(d.desc.replace(/^(ULTI|ULTIMATE|ULT):\s*/, ''))}</div>`;
  if(d.tip){
    html += `<div class="tipBox tipAct"><div class="tipActH"><span class="tipLbl">${ab.rank ? L('RANG ', 'RANK ') + ab.rank : L('NA RANGU 1', 'AT RANK 1')}</span>` +
      (d.passive ? '' : `<span class="tipCd">💧 ${d.mana} &nbsp;⏱️ ${d.cd} s</span>`) + `</div>${escHtml(d.tip(rk))}</div>`;
    if(ab.rank > 0 && ab.rank < max) html += `<div class="tipNote">⬆️ ${L('Rang', 'Rank')} ${ab.rank + 1}: ${escHtml(d.tip(ab.rank + 1))}</div>`;
  }
  {   // 🎓 odabrani talenti koji jačaju ovu moć
    const tb = (h.talAb && h.talAb[keyL]) || {}, parts = [];
    if(tb.dmg) parts.push(L('+' + tb.dmg + ' štete', '+' + tb.dmg + ' damage'));
    if(tb.heal) parts.push(L('+' + tb.heal + ' liječenja', '+' + tb.heal + ' healing'));
    if(tb.dur) parts.push(L('+' + tb.dur + ' s trajanja', '+' + tb.dur + ' s duration'));
    if(tb.cd) parts.push(L('−' + Math.abs(tb.cd) + ' s hlađenja', '−' + Math.abs(tb.cd) + ' s cooldown'));
    if(tb.mana) parts.push(L('−' + Math.abs(tb.mana) + ' mane', '−' + Math.abs(tb.mana) + ' mana'));
    const fl = Object.keys(h.talFlags || {}).filter(f => f.startsWith(h.hero.id + '_' + keyL.toLowerCase()));
    if(parts.length || fl.length) html += `<div class="tipNote" style="color:#fde68a">🎓 Talent: ${escHtml(parts.join(', ') || L('posebno pojačanje', 'special boost'))}</div>`;
  }
  html += `<div class="tipFoot">${d.passive ? L('✨ Pasivno — uvijek radi', '✨ Passive — always on') : (d.ult ? L('🔓 Ulti na levelima ', '🔓 Ult at levels ') + CFG.ultLevels.join(' / ') : L('🔓 Rangovi na levelima 1 / 3 / 5 / 7', '🔓 Ranks at levels 1 / 3 / 5 / 7')) +
    (ab.rank > 0 && !d.passive ? L(' · tipka ', ' · key ') + keyL : '')}</div>`;
  return html;
}
function innateTipHtml(h){
  const pv = h.hero.passive, ir = innateRank(h);
  return `<div class="tipHead q-common"><span class="tipAbIcon" style="background:linear-gradient(160deg, ${pv.color || '#34d399'}, #10141b)">${pv.emoji}</span>` +
    `<div class="tipT"><b>${escHtml(pv.name)}</b><span class="tipSub">${L('✨ Urođeno · rang', '✨ Innate · rank')} ${ir}/${Math.max(4, ir)}</span>` +
    `<span class="tipDots">${Array.from({ length: Math.max(4, ir) }, (_, k) => `<i class="${k < ir ? 'on' : ''}"></i>`).join('')}</span></div></div>` +
    `<div class="tipDesc">${escHtml(pv.desc.replace(/^(PASIVNO|PASSIVE|INNATE):\s*/, ''))}</div>` +
    (pv.tip ? `<div class="tipBox tipPas"><span class="tipLbl">${L('PASIVNO', 'PASSIVE')}</span>${escHtml(pv.tip(ir))}</div>` : '') +
    '<div class="tipFoot">' + L('✨ Uvijek radi · jača sama na levelima 7 / 13 / 19', '✨ Always on · gets stronger at levels 7 / 13 / 19') + '</div>';
}
/* opis čarolije prizivača (D / F) */
function summonerTipHtml(h, k){
  const sp = SUMMONER_BY_ID[h.summoners[k]], cd = (h.sumCd || [0, 0])[k];
  return `<div class="tipHead"><span class="tipAbIcon" style="border-radius:50%;background:linear-gradient(160deg, ${sp.color}, #10141b)">${sp.emoji}</span>` +
    `<div class="tipT"><b>${escHtml(sp.name)}</b><span class="tipSub">${L('Čarolija prizivača · tipka', 'Summoner spell · key')} ${k ? 'F' : 'D'}</span></div></div>` +
    `<div class="tipDesc">${escHtml(sp.desc)}</div>` +
    `<div class="tipBox tipAct"><div class="tipActH"><span class="tipLbl">LEVEL ${h.level}</span><span class="tipCd">⏱️ ${sp.cd} s</span></div>${escHtml(sp.tip(h.level))}</div>` +
    `<div class="tipFoot">${cd > 0 ? L('⏳ Spremno za ' + Math.ceil(cd) + ' s', '⏳ Ready in ' + Math.ceil(cd) + ' s') : L('✅ Spremno!', '✅ Ready!')}${sp.target ? L(' · klik na cilj', ' · click a target') : ''}</div>`;
}
function simpleTipHtml(title, text, foot){
  return `<div class="tipHead"><div class="tipT"><b>${title}</b></div></div><div class="tipDesc">${text}</div>` + (foot ? `<div class="tipFoot">${foot}</div>` : '');
}
/* opisi na HUD-u (torba, moći, pasiva, gumbi) — poziva game.js kad se promijeni hoverUi */
let hudTipKey = null;
/* gumbi gore desno: što rade i koja je tipka */
const TOP_TIPS = {
  dance: [L('💃 Ples', '💃 Dance'), L('Tvoj junak zapleše i kaže nešto smiješno — vide ga i drugi!', 'Your hero dances and says something funny — everyone can see it!'), L('Tipka J', 'Key J')],
  center: [L('🎯 Kamera', '🎯 Camera'), L('Kamera se vrati na tvog junaka i prati ga.', 'The camera goes back to your hero and follows it.'), L('Razmaknica', 'Spacebar')],
  score: [L('📋 Tablica', '📋 Scoreboard'), L('Ubojstva, smrti, asistencije, zlato i predmeti svih junaka.', 'Kills, deaths, assists, gold and items of all heroes.'), L('Tab (ili ovaj gumb)', 'Tab (or this button)')],
  opts: [L('⚙️ Postavke', '⚙️ Settings'), L('Glasnoća, glasovi junaka, najavljivač, kvaliteta slike, kamera…', 'Volume, hero voices, announcer, graphics quality, camera…'), L('Tipka Esc', 'Key Esc')],
  fs: [L('⛶ Cijeli zaslon', '⛶ Fullscreen'), L('Igra preko cijelog ekrana — miš ne može pobjeći iz igre, a kamera se lakše pomiče uz rub.', 'The game fills the whole screen — the mouse stays inside the game, and the camera moves more easily at the edge.'), L('Tipka F11 (ili ovaj gumb)', 'Key F11 (or this button)')],
  mute: [L('🔊 Zvuk', '🔊 Sound'), L('Uključi ili isključi sav zvuk i glasove.', 'Turn all sound and voices on or off.'), L('Tipka M', 'Key M')],
  help: [L('❓ Pomoć', '❓ Help'), L('Sve tipke i kako se igra.', 'All keys and how to play.'), L('Tipka H', 'Key H')],
};
function updateHudTip(){
  if(!player || !hoverUi){ if(hudTipKey) hideItemTip(); return; }
  const t = hoverUi.type;
  if(TOP_TIPS[t]){
    const rect = uiRects[t];
    if(!rect) return hideItemTip();
    if(hudTipKey === 'top' + t) return;
    hudTipKey = 'top' + t;
    showItemTip(simpleTipHtml(...TOP_TIPS[t]), rect, 'below');
    return;
  }
  if(t === 'buff'){
    const r = uiRects.buff && uiRects.buff[hoverUi.i];
    if(!r) return hideItemTip();
    const key = 'buff' + r.b.name + Math.ceil(r.b.t);
    if(key === hudTipKey) return;
    hudTipKey = key;
    showItemTip(simpleTipHtml(r.b.e + ' ' + escHtml(r.b.name), escHtml(r.b.desc), (r.b.good ? L('✅ Pomaže ti', '✅ Helps you') : L('⚠️ Šteti ti', '⚠️ Hurts you')) + (r.b.perm ? L(' · ♾️ trajno, cijelom timu', ' · ♾️ forever, whole team') : (r.b.t < 600 ? L(' · još ' + Math.ceil(r.b.t) + ' s', ' · ' + Math.ceil(r.b.t) + ' s left') : ''))), r);
    return;
  }
  if(t === 'abil' || t === 'learn' || t === 'pas' || t === 'stat' || t === 'glyph' || t === 'tp' || t === 'shop' || t === 'sum'){
    let rect = null, html = '', key = t + (hoverUi.i != null ? hoverUi.i : '');
    if(t === 'abil' || t === 'learn'){
      const ab = player.abilities[hoverUi.i]; if(!ab) return hideItemTip();
      rect = t === 'abil' ? uiRects.abil[hoverUi.i] : uiRects.learn.find(r => r.i === hoverUi.i);
      html = abilityTipHtml(player, hoverUi.i); key += ab.rank;
    } else if(t === 'sum'){
      rect = uiRects.sum[hoverUi.i]; html = summonerTipHtml(player, hoverUi.i); key += Math.ceil((player.sumCd || [0, 0])[hoverUi.i]);
    } else if(t === 'pas'){
      rect = uiRects.passive; html = innateTipHtml(player); key += innateRank(player);
    } else if(t === 'stat'){
      rect = uiRects.statBtn; key += player.statRanks;
      html = simpleTipHtml(L('📊 Atributi+  (', '📊 Attributes+  (') + player.statRanks + '/' + CFG.statMaxRanks + ')', L('+2 💪 snage, +2 🤸 okretnosti, +2 🧠 inteligencije', '+2 💪 strength, +2 🤸 agility, +2 🧠 intelligence'),
        L('💪 = život · 🤸 = brzina napada i oklop · 🧠 = mana · troši poen vještine', '💪 = HP · 🤸 = attack speed and armor · 🧠 = mana · costs a skill point'));
    } else if(t === 'glyph'){
      const gl = glyph[player.team]; rect = uiRects.glyph; key += Math.ceil(gl.cd);
      html = simpleTipHtml(L('🛡️ Glif utvrde', '🛡️ Glyph'), L('Sve kule i vojarne tvog tima 5 s ne primaju štetu.', 'All your towers and barracks take no damage for 5 s.'), L('Tipka Y · ', 'Key Y · ') + (gl.cd > 0 ? L('puni se još ' + Math.ceil(gl.cd) + ' s', 'recharging, ' + Math.ceil(gl.cd) + ' s') : L('spreman!', 'ready!')));
    } else if(t === 'tp'){
      rect = uiRects.tp; key += Math.ceil(player.tpCd);
      html = simpleTipHtml('🌀 Teleport', L('Klikni svoju kulu ili vojarnu (i na minimapi) — za 3.5 s si kod nje. T dvaput = kući (3 s). Omama ga prekida.', 'Click your tower or barracks (also on the minimap) — you get there in 3.5 s. T twice = home (3 s). A stun stops it.'), L('Tipka T · ', 'Key T · ') + (player.tpCd > 0 ? L('puni se još ' + Math.ceil(player.tpCd) + ' s', 'recharging, ' + Math.ceil(player.tpCd) + ' s') : L('spreman!', 'ready!')));
    } else if(t === 'shop'){
      rect = uiRects.shop; html = simpleTipHtml(L('🛒 Dućan', '🛒 Shop'), L('Kupuj bilo gdje — daleko od baze predmet donosi 🫏 kurir.', 'Buy anywhere — far from base, the 🫏 courier brings your item.'), L('Tipka B', 'Key B'));
    }
    if(!rect) return hideItemTip();
    if(key === hudTipKey) return;
    hudTipKey = key;
    showItemTip(html, rect);
    return;
  }
  if(t === 'opts' || t === 'score' || t === 'center'){
    const rect = uiRects[t];
    if(!rect) return hideItemTip();
    if(hudTipKey === t) return;
    hudTipKey = t;
    showItemTip(t === 'opts' ? simpleTipHtml(L('⚙️ Postavke', '⚙️ Settings'), L('Glasnoća, kvaliteta slike, efekti, kamera, brojevi štete.', 'Volume, graphics quality, effects, camera, damage numbers.'), L('Tipka Esc', 'Key Esc'))
      : t === 'score' ? simpleTipHtml(L('📋 Tablica', '📋 Scoreboard'), L('Ubojstva, smrti, asistencije, zlato i predmeti svih junaka.', 'Kills, deaths, assists, gold and items of all heroes.'), L('Tipka Tab', 'Key Tab'))
      : simpleTipHtml(L('🎯 Kamera na junaka', '🎯 Camera on hero'), L('Kamera opet prati tvog junaka.', 'The camera follows your hero again.'), L('Razmaknica', 'Spacebar')), rect, 'left');
    return;
  }
  if(t !== 'inv' && t !== 'neut' && t !== 'qb'){ if(hudTipKey) hideItemTip(); return; }
  let it = null, rect = null, foot = '';
  if(hoverUi.type === 'inv'){
    it = invItemAt(player, hoverUi.i); rect = uiRects.inv[hoverUi.i];
    if(it){
      const bp = hoverUi.i >= CFG.inventorySlots;
      foot = (it.pending ? L('🫏 Kurir ga nosi (ili se vrati u bazu)<br>', '🫏 The courier is bringing it (or go back to base)<br>') : '') +
        (bp ? L('🎒 U ruksaku ne djeluje — klik ga vraća u torbu<br>', '🎒 Does not work in the backpack — click to move it back<br>') : (it.active ? (touchMode ? L('👆 Dodir = koristi<br>', '👆 Tap = use<br>') : L('🖱️ Klik ili tipka ' + (hoverUi.i + 1) + ' = koristi<br>', '🖱️ Click or key ' + (hoverUi.i + 1) + ' = use<br>')) : '')) +
        L('↔️ Povuci na drugo mjesto · ', '↔️ Drag to another slot · ') + (touchMode ? L('drži prst 1 s', 'hold 1 s') : L('desni klik', 'right-click')) + L(' = prodaj za <b>', ' = sell for <b>') + Math.floor(itemFullCost(it) / 2) + ' 🪙</b>';
    }
  } else if(hoverUi.type === 'neut'){
    it = player.neutral; rect = uiRects.neutral;
    if(!it){ showItemTip('<div class="tipLore">' + L('🌰 Neutralni predmet: ponekad ispadne iz čudovišta u džungli (bolji što je igra dulja)', '🌰 Neutral item: jungle monsters sometimes drop one (better the longer the game goes)') + '</div>', rect); hudTipKey = 'neut0'; return; }
  } else if(hoverUi.type === 'qb'){
    const q = uiRects.qb && uiRects.qb[hoverUi.i];
    if(q){ it = ITEM_BY_ID[q.id]; rect = q; foot = L('🖱️ Klik = kupi · desni klik = makni brzu kupnju', '🖱️ Click = buy · right-click = unpin'); }
  }
  if(!it || !rect){ if(hudTipKey) hideItemTip(); return; }
  const key = hoverUi.type + hoverUi.i + it.id + (it.pending ? 'p' : '') + Math.floor(player.gold / 50);
  if(key === hudTipKey) return;
  hudTipKey = key;
  showItemTip(itemTipHtml(it, { foot }), rect);
}
/* predmet na mjestu 0–8 (0–5 torba, 6–8 ruksak) */
function invItemAt(h, i){ return i < CFG.inventorySlots ? h.items[i] : (h.backpack || [])[i - CFG.inventorySlots]; }

/* ---------- 📌 brza kupnja ---------- */
let quickBuy = null;
function setQuickBuy(id){
  quickBuy = id;
  if(id && player) addFloat(player.x, player.y, L('📌 Brza kupnja: ', '📌 Quick buy: ') + ITEM_BY_ID[id].name, '#fde68a', 14);
  refreshShop();
}
/* što još treba kupiti za cilj: dijelovi koje nemaš (redom), na kraju sam predmet (recept) */
function quickBuyList(h, id){
  const target = ITEM_BY_ID[id];
  if(!target) return [];
  const inv = h.items.concat(h.backpack || []).map(it => it.id);
  const need = [];
  // dijelovi koji fale; podrecept (npr. Kristalni nož za Dedalovu oštricu) tek kad su mu svi dijelovi tu
  function walk(it){
    const k = inv.indexOf(it.id);
    if(k >= 0){ inv.splice(k, 1); return; }
    if(!it.components){ need.push(it); return; }
    const before = need.length;
    for(const c of it.components) walk(ITEM_BY_ID[c]);
    if(need.length === before) need.push(it);
  }
  for(const c of target.components || []) walk(ITEM_BY_ID[c]);
  need.push(target);   // na kraju sam predmet (kupi sve što još fali odjednom)
  return need;
}
function quickBuyNext(h){
  if(!quickBuy) return null;
  if(ownsOrUsed(h, quickBuy) && !ITEM_BY_ID[quickBuy].charges){ quickBuy = null; return null; }
  return quickBuyList(h, quickBuy);
}
function buyItemId(id){
  const it = ITEM_BY_ID[id];
  if(!it || !player) return;
  if(net.mode === 'guest') netBuy(id);
  else tryBuy(player, it);
}

/* ---------- 🛒 dućan ----------
   v0.38: jasniji dućan za djecu — lijevo kategorije s razumljivim imenima, desno kartice predmeta
   (slika, ime, što daje, cijena, "fali još X"), gore "⭐ Kupi sljedeće", dolje recept i tvoja torba. */
let shopTab = 'guide', shopSel = null, shopQuery = '';
const SHOP_CATS = [
  { id:'guide',  label:L('⭐ Za tebe', '⭐ For you'),           tip:L('Što kupiti, redom — za tvog junaka', 'What to buy, in order — for your hero') },
  { id:'afford', label:L('💰 Mogu kupiti', '💰 Can buy'),       tip:L('Sve što možeš kupiti odmah', 'Everything you can buy right now') },
  { hdr:L('🧱 OSNOVNO', '🧱 BASIC') },
  { id:'cons',   label:L('🧪 Napitci', '🧪 Potions'),           tip:L('Liječenje, mana, štapići vida — potroše se', 'Healing, mana, wards — they get used up') },
  { id:'attr',   label:L('💪 Atributi', '💪 Attributes'),       tip:L('Snaga, okretnost, inteligencija', 'Strength, agility, intelligence') },
  { id:'equip',  label:L('🗡️ Oprema', '🗡️ Gear'),              tip:L('Oružje, oklop i čizme za početak', 'Weapons, armor and boots to start') },
  { id:'misc',   label:L('🎒 Razno', '🎒 Misc'),                tip:L('Obnova, brzina i korisne sitnice', 'Regen, speed and handy little things') },
  { id:'secret', label:L('💎 Rijetko', '💎 Rare'),              tip:L('Skupi dijelovi za najjače predmete', 'Pricey parts for the strongest items') },
  { hdr:L('🏆 VELIKI PREDMETI', '🏆 BIG ITEMS') },
  { id:'acc',    label:L('👢 Pribor', '👢 Accessories'),        tip:L('Čizme, narukvice i mali recepti', 'Boots, bracers and small recipes') },
  { id:'sup',    label:L('🤝 Za tim', '🤝 Team'),               tip:L('Pomažu cijelom timu', 'Help your whole team') },
  { id:'magic',  label:L('✨ Čarolije', '✨ Magic'),             tip:L('Mana, magije i aktivne moći', 'Mana, spells and active abilities') },
  { id:'armor',  label:L('🛡️ Obrana', '🛡️ Defense'),           tip:L('Život, oklop i zaštita', 'HP, armor and protection') },
  { id:'weapon', label:L('⚔️ Oružje', '⚔️ Weapons'),            tip:L('Šteta, kritični udarci, brzina napada', 'Damage, critical hits, attack speed') },
  { id:'art',    label:L('👑 Legendarno', '👑 Legendary'),      tip:L('Najjači predmeti u igri', 'The strongest items in the game') },
];
/* ima li junak predmet — ili ga je već ugradio u veći recept */
function ownsOrUsed(h, id){
  const has = (it) => it.id === id || (it.components || []).some(c => has(ITEM_BY_ID[c]));
  return h.items.concat(h.backpack || []).some(has);
}
function toggleShop(){
  shopOpen = !shopOpen;
  document.getElementById('shop').classList.toggle('hidden', !shopOpen);
  if(!shopOpen){ hideItemTip(); document.getElementById('shopSearch').blur(); }
  else { renderShopTabs(); renderShopBody(); }
}
function normTxt(t){ return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
function itemPlan(it){ return it.instant ? { cost: it.cost, ok: true, tagOk: true, slotsOk: true } : planPurchase(player, it); }
/* kartica predmeta: slika, ime, prvo svojstvo, cijena (ili "fali još") */
function shopCell(it, extra){
  const st = statLines(it)[0] || (it.act ? '⚡ ' + it.act : (it.pas || ''));
  return `<div class="sit q-${it.q}${extra ? ' ' + extra : ''}" data-id="${it.id}">${iconImg(it, 'sitImg')}` +
    `<div class="sitInfo"><b class="sitName">${escHtml(it.name)}</b><span class="sitStat">${escHtml(st)}</span></div>` +
    `<span class="sitCost"></span><span class="sitOwn">✓</span></div>`;
}
function renderShopTabs(){
  const tabs = document.getElementById('shopTabs');
  if(!tabs) return;
  tabs.innerHTML = SHOP_CATS.map(c => c.hdr ? `<div class="stHdr">${c.hdr}</div>` :
    `<button data-tab="${c.id}" title="${escHtml(c.tip)}"><span>${c.label}</span><i class="stN"></i></button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    shopTab = b.dataset.tab; shopQuery = ''; document.getElementById('shopSearch').value = '';
    renderShopBody(); sfx('click');
  }));
}
let shopAffordKey = '';
function affordableItems(){
  return ITEMS.filter(it => !it.noShop && !(it.tag === 'boots' && ownsOrUsed(player, it.id)) && (() => { const p = itemPlan(it); return p.ok && player.gold >= p.cost; })())
    .sort((a, b) => itemFullCost(b) - itemFullCost(a));
}
function renderShopBody(){
  const body = document.getElementById('shopBody');
  if(!body || !player) return;
  document.querySelectorAll('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab && !shopQuery));
  let html = '';
  const cat = SHOP_CATS.find(c => c.id === shopTab) || SHOP_CATS[0];
  if(shopQuery){
    const q = normTxt(shopQuery);
    const hits = ITEMS.filter(it => !it.noShop && (normTxt(it.name).includes(q) || it.emoji === shopQuery.trim() ||
      statLines(it).some(l => normTxt(l).includes(q)) || normTxt(it.pas || '').includes(q) || normTxt(it.act || '').includes(q)));
    html = `<div class="sbHead">${L('🔍 Pronađeno', '🔍 Found')}: ${hits.length}</div><div class="scards">${hits.map(it => shopCell(it)).join('') || '<span class="sempty">' + L('Ništa — probaj drugu riječ 🙂', 'Nothing — try another word 🙂') + '</span>'}</div>`;
  } else if(shopTab === 'guide'){
    const b = (player && player.hero.build) || BOT_BUILD;
    const rows = [[L('🌅 Za početak', '🌅 Starting items'), START_ITEMS], [L('🌱 Rano', '🌱 Early game'), b.slice(0, 2)], [L('⚔️ Sredina igre', '⚔️ Mid game'), b.slice(2, 4)], [L('🏆 Kraj igre', '🏆 Late game'), b.slice(4)]];
    html = '<div id="sgNext"></div>' +
      rows.map(([lbl, ids]) => `<div class="sbHead">${lbl}</div><div class="scards">${ids.map(id => shopCell(ITEM_BY_ID[id], 'g')).join('')}</div>`).join('');
  } else if(shopTab === 'afford'){
    const list = affordableItems();
    shopAffordKey = list.map(it => it.id).join(',');
    html = `<div class="sbHead">${L(`💰 Za ${Math.floor(player.gold)} 🪙 možeš kupiti (${list.length}):`, `💰 With ${Math.floor(player.gold)} 🪙 you can buy (${list.length}):`)}</div><div class="scards">` +
      (list.map(it => shopCell(it)).join('') || '<span class="sempty">' + L('Još nemaš dovoljno zlata — skupljaj ga pobjeđujući vojnike 🪙', 'Not enough gold yet — get more by defeating creeps 🪙') + '</span>') + '</div>';
  } else {
    html = `<div class="sbHead">${cat.label} <small>${escHtml(cat.tip)}</small></div><div class="scards">` +
      ITEMS.filter(it => it.cat === shopTab && !it.noShop).sort((a, b) => itemFullCost(a) - itemFullCost(b)).map(it => shopCell(it)).join('') + '</div>';
  }
  body.innerHTML = html;
  body.scrollTop = 0;
  body.querySelectorAll('.sit').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', () => { selectShopItem(id); sfx('click'); });
    el.addEventListener('dblclick', () => buyItemId(id));
    el.addEventListener('contextmenu', e => { e.preventDefault(); buyItemId(id); });
    el.addEventListener('mouseenter', () => {
      const r = el.getBoundingClientRect();
      showItemTip(itemTipHtml(ITEM_BY_ID[id], { foot: L('🖱️ Klik = recept i opis · desni klik = kupi', '🖱️ Click = recipe and info · right-click = buy') }), { x: document.getElementById('shop').getBoundingClientRect().x, y: r.y, w: r.width, h: r.height }, 'left');
    });
    el.addEventListener('mouseleave', hideItemTip);
  });
  refreshShop();
}
function selectShopItem(id){
  shopSel = id;
  renderShopDetail();
}
/* gumb kupnje: "Kupi za X" ili "Fali još X" */
function buyBtnState(it){
  const plan = itemPlan(it), cost = Math.ceil(plan.cost);
  if(!plan.tagOk) return { txt: L('👢 Već imaš čizme', '👢 You have boots already'), dis: true, cost };
  if(!plan.slotsOk) return { txt: L('🎒 Torba je puna', '🎒 Inventory is full'), dis: true, cost };
  if(player.gold < cost) return { txt: L('🔒 Fali još ' + Math.ceil(cost - player.gold) + ' 🪙', '🔒 Need ' + Math.ceil(cost - player.gold) + ' more 🪙'), dis: true, cost, poor: true };
  return { txt: L('🛒 Kupi za ' + cost + ' 🪙', '🛒 Buy for ' + cost + ' 🪙'), dis: false, cost };
}
function renderShopDetail(){
  const box = document.getElementById('shopDetail');
  if(!box) return;
  const it = shopSel && ITEM_BY_ID[shopSel];
  if(!it || !player){ box.innerHTML = '<div class="sdEmpty">' + L('👆 Klikni predmet — vidjet ćeš što radi i od čega se slaže<br>🖱️ Desni klik ili dvoklik = kupi odmah', '👆 Click an item — see what it does and what it is made of<br>🖱️ Right-click or double-click = buy now') + '</div>'; return; }
  const inv = player.items.concat(player.backpack || []).map(x => x.id);
  let comps = '';
  if(it.components){
    comps = '<div class="sdRow"><span class="sdLbl">' + L('🧩 Recept — složi od:', '🧩 Recipe — made from:') + '</span>' + it.components.map(cid => {
      const k = inv.indexOf(cid), have = k >= 0; if(have) inv.splice(k, 1);
      const c = ITEM_BY_ID[cid];
      return `<span class="sdc${have ? ' have' : ''}" data-id="${cid}" title="${escHtml(c.name)}">${iconImg(c, 'sdIcon')}<i>${have ? L('✓ imaš', '✓ have it') : itemFullCost(c) + ' 🪙'}</i></span>`;
    }).join('<b class="sdPlus">+</b>') + (it.cost > 0 ? `<b class="sdPlus">+</b><span class="sdc recipe" title="${L('Recept (svitak)', 'Recipe (scroll)')}">${iconImg(RECIPE_ICON, 'sdIcon')}<i>${it.cost} 🪙</i></span>` : '') +
      `<b class="sdPlus">=</b><span class="sdc res">${iconImg(it, 'sdIcon')}<i>${escHtml(it.name)}</i></span></div>`;
  }
  const into = (it.buildsInto || []).length ? '<div class="sdRow"><span class="sdLbl">' + L('⬆️ Ulazi u:', '⬆️ Builds into:') + '</span>' +
    it.buildsInto.map(id => `<span class="sdc" data-id="${id}" title="${escHtml(ITEM_BY_ID[id].name)}">${iconImg(ITEM_BY_ID[id], 'sdIcon')}</span>`).join('') + '</div>' : '';
  const bs = buyBtnState(it);
  box.innerHTML = `<div class="sdMain">${itemTipHtml(it, { compact: true })}</div><div class="sdSide">${comps}${into}
    <div class="sdBtns"><button id="sdBuy" ${bs.dis ? 'disabled' : ''} class="${bs.dis ? (bs.poor ? 'poor' : '') : 'afford'}">${bs.txt}</button>
    ${it.instant ? '' : `<button id="sdPin" class="${quickBuy === it.id ? 'on' : ''}" title="${L('Prikvači: HUD pokazuje što još fali, klik ga kupi', 'Pin: the HUD shows what is still missing, click to buy it')}">📌 ${quickBuy === it.id ? L('Prikvačeno', 'Pinned') : L('Prikvači', 'Pin')}</button>`}</div></div>`;
  box.querySelectorAll('.sdc[data-id]').forEach(el => el.addEventListener('click', () => { selectShopItem(el.dataset.id); sfx('click'); }));
  document.getElementById('sdBuy').addEventListener('click', () => buyItemId(it.id));
  const pin = document.getElementById('sdPin');
  if(pin) pin.addEventListener('click', () => { setQuickBuy(quickBuy === it.id ? null : it.id); sfx('click'); });
}
/* ⭐ "Kupi sljedeće": najbliži korak prema sljedećem predmetu iz vodiča (najprije dio koji fali) */
function renderGuideNext(nextId){
  const el = document.getElementById('sgNext');
  if(!el) return;
  if(!nextId){ el.innerHTML = '<div class="sgN done">' + L('🏆 Imaš sve iz vodiča! Kupi što želiš ili prodaj staro za bolje.', '🏆 You have everything from the guide! Buy what you like, or sell old items for better ones.') + '</div>'; return; }
  const goal = ITEM_BY_ID[nextId];
  const step = quickBuyList(player, nextId).find(x => player.gold >= itemPlan(x).cost) || quickBuyList(player, nextId)[0] || goal;
  const bs = buyBtnState(step);
  const key = nextId + step.id + bs.txt;
  if(el.dataset.k === key) return;
  el.dataset.k = key;
  el.innerHTML = `<div class="sgN">${iconImg(step, 'sgnImg')}<div class="sgnT"><small>${L('⭐ Kupi sljedeće', '⭐ Buy next')}${step !== goal ? L(' (dio za ' + escHtml(goal.name) + ')', ' (part of ' + escHtml(goal.name) + ')') : ''}</small>` +
    `<b>${escHtml(step.name)}</b><span>${escHtml(statLines(step).slice(0, 2).join(' · '))}</span></div>` +
    `<button id="sgnBuy" ${bs.dis ? 'disabled' : ''} class="${bs.dis ? (bs.poor ? 'poor' : '') : 'afford'}">${bs.txt}</button></div>`;
  el.querySelector('#sgnBuy').addEventListener('click', () => buyItemId(step.id));
  el.querySelector('.sgnImg').addEventListener('click', () => { selectShopItem(step.id); sfx('click'); });
}
/* 🎒 torba na dnu dućana + gdje stiže predmet */
function renderShopInv(){
  const el = document.getElementById('shopInv');
  if(!el) return;
  const slots = [];
  for(let i = 0; i < CFG.inventorySlots; i++) slots.push(player.items[i]);
  const bp = player.backpack || [];
  const near = typeof nearBase === 'function' && nearBase(player);
  const key = slots.map(x => x ? x.id + (x.pending ? 'p' : '') : '-').join(',') + '|' + bp.map(x => x.id).join(',') + '|' + near;
  if(el.dataset.k === key) return;
  el.dataset.k = key;
  const cell = (x, cls) => x ? `<span class="siSlot ${cls || ''}${x.pending ? ' pend' : ''}" title="${escHtml(x.name)}${x.pending ? L(' — kurir ga nosi', ' — the courier is bringing it') : ''}">${iconImg(x, 'siImg')}</span>`
    : `<span class="siSlot empty ${cls || ''}"></span>`;
  el.innerHTML = `<span class="siLbl">${L('🎒 Torba', '🎒 Inventory')}</span>${slots.map(x => cell(x)).join('')}` +
    (player.backpack ? `<span class="siLbl small">${L('ruksak', 'backpack')}</span>${[0, 1, 2].map(i => cell(bp[i], 'bp')).join('')}` : '') +
    `<span class="siNote">${near ? L('🏠 U bazi si — predmet dobiješ odmah', '🏠 You are at base — you get items right away') : L('🫏 Daleko si od baze — kurir donosi predmet', '🫏 Far from base — the courier brings your item')}</span>`;
}
function refreshShop(){
  if(!player) return;
  const gEl = document.getElementById('shopGold');
  if(!gEl) return;
  gEl.textContent = '🪙 ' + Math.floor(player.gold);
  if(!shopOpen) return;
  if(shopTab === 'afford' && !shopQuery && affordableItems().map(it => it.id).join(',') !== shopAffordKey){ renderShopBody(); return; }
  const build = (player.hero && player.hero.build) || BOT_BUILD;
  const nextId = build.find(id => !ownsOrUsed(player, id)) || null;
  document.querySelectorAll('#shopBody .sit').forEach(el => {
    const it = ITEM_BY_ID[el.dataset.id];
    const plan = itemPlan(it);
    const cost = Math.ceil(plan.cost);
    const own = !it.instant && ownsOrUsed(player, it.id);
    const can = player.gold >= cost && plan.ok;
    el.classList.toggle('afford', can);
    el.classList.toggle('poor', player.gold < cost);
    el.classList.toggle('owned', own);
    el.classList.toggle('next', it.id === nextId && el.classList.contains('g'));
    el.classList.toggle('pinned', it.id === quickBuy);
    const ce = el.querySelector('.sitCost');
    if(ce) ce.innerHTML = player.gold < cost ? `${cost} 🪙<em>${L('fali', 'need')} ${cost - Math.floor(player.gold)}</em>` : `${cost} 🪙`;
  });
  // broj predmeta koje možeš kupiti po kategoriji (zelena značka)
  const n = {};
  for(const it of ITEMS){
    if(it.noShop) continue;
    const p = itemPlan(it);
    if(p.ok && player.gold >= p.cost && !(it.tag && ownsOrUsed(player, it.id))) n[it.cat] = (n[it.cat] || 0) + 1;
  }
  n.afford = Object.values(n).reduce((a, b) => a + b, 0);
  document.querySelectorAll('#shopTabs button').forEach(b => {
    const i = b.querySelector('.stN');
    if(i) i.textContent = b.dataset.tab !== 'guide' && n[b.dataset.tab] ? n[b.dataset.tab] : '';
  });
  if(shopTab === 'guide' && !shopQuery) renderGuideNext(nextId);
  renderShopInv();
  renderShopDetail();
}
function buildShopDom(){
  renderShopTabs();
  const se = document.getElementById('shopSearch');
  se.addEventListener('input', () => { shopQuery = se.value.trim(); renderShopBody(); });
  document.getElementById('shopClose').addEventListener('click', toggleShop);
  // predgeneriraj ikone (prvo otvaranje dućana bez trzanja)
  for(const it of ITEMS) itemIconCanvas(it);
  for(const it of NEUTRAL_ITEMS) itemIconCanvas(it);
  renderShopBody();
  renderShopDetail();
}
