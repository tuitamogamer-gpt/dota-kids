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
  const g = c.getContext('2d');
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
  all: n => '+' + n + ' svim atributima', str: n => '+' + n + ' snage', agi: n => '+' + n + ' okretnosti', int: n => '+' + n + ' inteligencije',
  primary: n => '+' + n + ' glavnom atributu', dmg: n => '+' + n + ' štete', aspd: n => '+' + n + ' brzine napada',
  armor: n => '+' + n + ' oklopa', hp: n => '+' + n + ' života', mp: n => '+' + n + ' mane',
  hpRegen: n => '+' + n + ' obnove života', mpRegen: n => '+' + n + ' obnove mane', speed: n => '+' + n + ' brzine kretanja',
  lifesteal: n => Math.round(n * 100) + '% krađe života', evasion: n => Math.round(n * 100) + '% izbjegavanja',
};
const STAT_ORDER = ['all', 'str', 'agi', 'int', 'primary', 'dmg', 'aspd', 'armor', 'hp', 'mp', 'hpRegen', 'mpRegen', 'speed', 'lifesteal', 'evasion'];
function statLines(it){
  const s = it.stats || {}, out = [];
  if(it.instant) out.push('+' + it.heal + ' života odmah');
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
  h += it.neutral ? `<span class="tipSub">🌰 Neutralni predmet · razina ${it.ntier}</span>` : `<span class="tipCost">🪙 ${full}</span>`;
  h += '</div></div>';
  const st = statLines(it);
  if(st.length) h += '<div class="tipStats">' + st.map(x => `<div>${escHtml(x)}</div>`).join('') + '</div>';
  if(it.pas) h += `<div class="tipBox tipPas"><span class="tipLbl">PASIVNO</span>${escHtml(it.pas)}</div>`;
  if(it.act){
    const a = it.active || ITEM_BY_ID[it.id].active || {};
    h += `<div class="tipBox tipAct"><div class="tipActH"><span class="tipLbl">AKTIVNO</span><span class="tipCd">${a.mana ? '💧 ' + a.mana + ' &nbsp;' : ''}⏱️ ${a.cd || 0} s</span></div>${escHtml(it.act)}</div>`;
  }
  if(it.charges && !it.instant) h += `<div class="tipNote">🔢 Punjenja: ${it.charges}${it.consume ? ' (potroši se)' : ''}</div>`;
  if(it.lore && !it.neutral && !opts.compact) h += `<div class="tipLore">${escHtml(it.lore)}</div>`;
  if(it.components && !opts.compact){
    h += '<div class="tipComps"><span>Sastojci:</span>' + it.components.map(c => iconImg(ITEM_BY_ID[c], 'tipMini')).join('') +
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
  else { x = rect.x + rect.w / 2 - w / 2; y = rect.y - hh - 10; }
  el.style.left = Math.round(clamp(x, 6, innerWidth - w - 6)) + 'px';
  el.style.top = Math.round(clamp(y, 6, innerHeight - hh - 6)) + 'px';
}
function hideItemTip(){
  const el = document.getElementById('itemTip');
  if(el) el.classList.add('hidden');
  hudTipKey = null;
}
/* opis predmeta iz torbe (HUD) — poziva game.js kad se promijeni hoverUi */
let hudTipKey = null;
function updateHudItemTip(){
  if(!player || !hoverUi || (hoverUi.type !== 'inv' && hoverUi.type !== 'neut' && hoverUi.type !== 'qb')){ if(hudTipKey) hideItemTip(); return; }
  let it = null, rect = null, foot = '';
  if(hoverUi.type === 'inv'){
    it = invItemAt(player, hoverUi.i); rect = uiRects.inv[hoverUi.i];
    if(it){
      const bp = hoverUi.i >= CFG.inventorySlots;
      foot = (it.pending ? '🫏 Kurir ga nosi (ili se vrati u bazu)<br>' : '') +
        (bp ? '🎒 U ruksaku ne djeluje — klik ga vraća u torbu<br>' : (it.active ? '🖱️ Klik ili tipka ' + (hoverUi.i + 1) + ' = koristi<br>' : '')) +
        '↔️ Povuci na drugo mjesto · desni klik = prodaj za <b>' + Math.floor(itemFullCost(it) / 2) + ' 🪙</b>';
    }
  } else if(hoverUi.type === 'neut'){
    it = player.neutral; rect = uiRects.neutral;
    if(!it){ showItemTip('<div class="tipLore">🌰 Neutralni predmet: ponekad ispadne iz čudovišta u džungli (bolji što je igra dulja)</div>', rect); hudTipKey = 'neut0'; return; }
  } else if(hoverUi.type === 'qb'){
    const q = uiRects.qb && uiRects.qb[hoverUi.i];
    if(q){ it = ITEM_BY_ID[q.id]; rect = q; foot = '🖱️ Klik = kupi · desni klik = makni brzu kupnju'; }
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
  if(id && player) addFloat(player.x, player.y, '📌 Brza kupnja: ' + ITEM_BY_ID[id].name, '#fde68a', 14);
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

/* ---------- 🛒 dućan ---------- */
let shopTab = 'guide', shopSel = null, shopQuery = '';
/* ima li junak predmet — ili ga je već ugradio u veći recept */
function ownsOrUsed(h, id){
  const has = (it) => it.id === id || (it.components || []).some(c => has(ITEM_BY_ID[c]));
  return h.items.concat(h.backpack || []).some(has);
}
function toggleShop(){
  shopOpen = !shopOpen;
  document.getElementById('shop').classList.toggle('hidden', !shopOpen);
  if(!shopOpen){ hideItemTip(); document.getElementById('shopSearch').blur(); }
  else renderShopBody();
}
function normTxt(t){ return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
function shopCell(it, extra){
  return `<div class="sit q-${it.q}${extra ? ' ' + extra : ''}" data-id="${it.id}">${iconImg(it, 'sitImg')}<span class="sitCost" id="sc-${it.id}-${extra ? 'g' : 'c'}"></span><span class="sitOwn">✓</span></div>`;
}
function renderShopBody(){
  const body = document.getElementById('shopBody');
  if(!body) return;
  document.querySelectorAll('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab && !shopQuery));
  let html = '';
  if(shopQuery){
    const q = normTxt(shopQuery);
    const hits = ITEMS.filter(it => !it.noShop && (normTxt(it.name).includes(q) || it.emoji === shopQuery.trim() ||
      statLines(it).some(l => normTxt(l).includes(q))));
    html = `<div class="sres"><div class="scolH">🔍 Pronađeno: ${hits.length}</div><div class="sgrid wide">${hits.map(it => shopCell(it)).join('') || '<span class="sempty">Ništa — probaj drugu riječ 🙂</span>'}</div></div>`;
  } else if(shopTab === 'guide'){
    const b = (player && player.hero.build) || BOT_BUILD;
    const rows = [['🌅 Početak', START_ITEMS], ['🌱 Rano', b.slice(0, 2)], ['⚔️ Sredina igre', b.slice(2, 4)], ['🏆 Kasno', b.slice(4)]];
    html = `<div class="sguide"><div class="sgInfo">⭐ Vodič za <b>${player ? escHtml(player.name) : ''}</b> — kupuj redom, zeleni 🎯 je sljedeći. Klik na predmet = recept, desni klik = kupi.</div>` +
      rows.map(([lbl, ids]) => `<div class="sgRow"><div class="sgLbl">${lbl}</div><div class="sgrid">${ids.map(id => shopCell(ITEM_BY_ID[id], 'g')).join('')}</div></div>`).join('') + '</div>';
  } else {
    const tab = SHOP_TABS.find(t => t.id === shopTab);
    html = '<div class="scols t-' + tab.id + '">' + tab.cats.map(cat => `<div class="scol"><div class="scolH">${ITEM_CAT_INFO[cat].label}</div><div class="sgrid">` +
      ITEMS.filter(it => it.cat === cat && !it.noShop).map(it => shopCell(it)).join('') + '</div></div>').join('') + '</div>';
  }
  body.innerHTML = html;
  body.querySelectorAll('.sit').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', () => { selectShopItem(id); sfx('click'); });
    el.addEventListener('dblclick', () => buyItemId(id));
    el.addEventListener('contextmenu', e => { e.preventDefault(); buyItemId(id); });
    el.addEventListener('mouseenter', () => {
      const r = el.getBoundingClientRect();
      showItemTip(itemTipHtml(ITEM_BY_ID[id], { foot: 'Klik = recept · desni klik = kupi' }), { x: document.getElementById('shop').getBoundingClientRect().x, y: r.y, w: r.width, h: r.height }, 'left');
    });
    el.addEventListener('mouseleave', hideItemTip);
  });
  refreshShop();
}
function selectShopItem(id){
  shopSel = id;
  renderShopDetail();
}
function renderShopDetail(){
  const box = document.getElementById('shopDetail');
  if(!box) return;
  const it = shopSel && ITEM_BY_ID[shopSel];
  if(!it || !player){ box.innerHTML = '<div class="sdEmpty">👆 Klikni predmet za opis i recept • desni klik ili dvoklik = odmah kupi</div>'; return; }
  const plan = it.instant ? { cost: it.cost, ok: true, tagOk: true, slotsOk: true } : planPurchase(player, it);
  const inv = player.items.concat(player.backpack || []).map(x => x.id);
  let comps = '';
  if(it.components){
    comps = '<div class="sdRow"><span class="sdLbl">Sastojci</span>' + it.components.map(cid => {
      const k = inv.indexOf(cid), have = k >= 0; if(have) inv.splice(k, 1);
      const c = ITEM_BY_ID[cid];
      return `<span class="sdc${have ? ' have' : ''}" data-id="${cid}" title="${escHtml(c.name)}">${iconImg(c, 'sdIcon')}<i>${have ? '✓' : itemFullCost(c)}</i></span>`;
    }).join('<b class="sdPlus">+</b>') + (it.cost > 0 ? `<b class="sdPlus">+</b><span class="sdc recipe">${iconImg(RECIPE_ICON, 'sdIcon')}<i>${it.cost}</i></span>` : '') + '</div>';
  }
  const into = (it.buildsInto || []).length ? '<div class="sdRow"><span class="sdLbl">Ulazi u</span>' +
    it.buildsInto.map(id => `<span class="sdc" data-id="${id}" title="${escHtml(ITEM_BY_ID[id].name)}">${iconImg(ITEM_BY_ID[id], 'sdIcon')}</span>`).join('') + '</div>' : '';
  let btnTxt = 'Kupi · 🪙 ' + Math.ceil(plan.cost), dis = player.gold < plan.cost;
  if(!plan.tagOk){ btnTxt = 'Već imaš čizme'; dis = true; }
  else if(!plan.slotsOk){ btnTxt = 'Torba je puna 🎒'; dis = true; }
  box.innerHTML = `<div class="sdMain">${itemTipHtml(it, { compact: true })}</div><div class="sdSide">${comps}${into}
    <div class="sdBtns"><button id="sdBuy" ${dis ? 'disabled' : ''} class="${dis ? '' : 'afford'}">${btnTxt}</button>
    ${it.instant ? '' : `<button id="sdPin" class="${quickBuy === it.id ? 'on' : ''}">📌 ${quickBuy === it.id ? 'Prikvačeno' : 'Brza kupnja'}</button>`}</div></div>`;
  box.querySelectorAll('.sdc[data-id]').forEach(el => el.addEventListener('click', () => { selectShopItem(el.dataset.id); sfx('click'); }));
  document.getElementById('sdBuy').addEventListener('click', () => buyItemId(it.id));
  const pin = document.getElementById('sdPin');
  if(pin) pin.addEventListener('click', () => { setQuickBuy(quickBuy === it.id ? null : it.id); sfx('click'); });
}
function refreshShop(){
  if(!player) return;
  const gEl = document.getElementById('shopGold');
  if(!gEl) return;
  gEl.textContent = '🪙 ' + Math.floor(player.gold);
  if(!shopOpen) return;
  const build = (player.hero && player.hero.build) || BOT_BUILD;
  const nextId = build.find(id => !ownsOrUsed(player, id)) || null;
  document.querySelectorAll('#shopBody .sit').forEach(el => {
    const it = ITEM_BY_ID[el.dataset.id];
    const plan = it.instant ? { cost: it.cost, ok: true } : planPurchase(player, it);
    const cost = Math.ceil(plan.cost);
    const own = !it.instant && ownsOrUsed(player, it.id);
    el.classList.toggle('afford', player.gold >= cost && plan.ok);
    el.classList.toggle('poor', player.gold < cost);
    el.classList.toggle('owned', own);
    el.classList.toggle('next', it.id === nextId && el.classList.contains('g'));
    el.classList.toggle('pinned', it.id === quickBuy);
    const ce = el.querySelector('.sitCost');
    if(ce) ce.textContent = cost;
  });
  renderShopDetail();
}
function buildShopDom(){
  const tabs = document.getElementById('shopTabs');
  tabs.innerHTML = [['guide', '⭐ Vodič']].concat(SHOP_TABS.map(t => [t.id, t.label])).map(([id, l]) =>
    `<button data-tab="${id}">${l}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    shopTab = b.dataset.tab; shopQuery = ''; document.getElementById('shopSearch').value = '';
    renderShopBody(); sfx('click');
  }));
  const se = document.getElementById('shopSearch');
  se.addEventListener('input', () => { shopQuery = se.value.trim(); renderShopBody(); });
  document.getElementById('shopClose').addEventListener('click', toggleShop);
  // predgeneriraj ikone (prvo otvaranje dućana bez trzanja)
  for(const it of ITEMS) itemIconCanvas(it);
  for(const it of NEUTRAL_ITEMS) itemIconCanvas(it);
  renderShopBody();
  renderShopDetail();
}
