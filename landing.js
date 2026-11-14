/* 🎬 DOTA Kids 3D — početni ekran (v0.43): izbor jezika, ZAIGRAJ, traka s junacima, profil.
   Učitava se zadnji (poslije game.js i shop.js) pa smije koristiti njihove funkcije. */
(function(){
  const $ = id => document.getElementById(id);
  const land = $('landing');
  if(!land) return;
  const click = () => { if(typeof sfx === 'function') sfx('click'); };

  // 🔄 „Igraj ponovo” preskače početni ekran (ide ravno na odabir junaka)
  let skip = false;
  try { skip = sessionStorage.getItem('dk_skipLanding') === '1'; sessionStorage.removeItem('dk_skipLanding'); } catch(e){}
  document.addEventListener('click', e => {
    if(e.target && e.target.closest && e.target.closest('#againBtn')){ try { sessionStorage.setItem('dk_skipLanding', '1'); } catch(err){} }
  }, true);

  const visible = () => !land.classList.contains('hidden');
  function hide(){
    if(!visible() || land.classList.contains('out')) return;
    land.classList.add('out');
    setTimeout(() => { land.classList.add('hidden'); land.classList.remove('out'); }, 430);
  }
  function show(){ land.classList.remove('hidden', 'out'); refreshProfile(); }
  if(skip) land.classList.add('hidden');

  /* 🌍 jezik: gumbi na početnom ekranu, u prozoru prvog pokretanja i u ⚙️ postavkama */
  const langBtns = document.querySelectorAll('#lgLang button, #optLang button, #lgPick button');
  for(const b of langBtns){
    b.classList.toggle('on', b.dataset.l === LANG);
    b.addEventListener('click', () => {
      click();
      if(b.dataset.l === LANG){   // već je taj jezik — samo zapamti izbor
        try { localStorage.setItem('dk_lang', LANG); } catch(e){}
        $('lgPick').classList.add('hidden');
        return;
      }
      if(running && !gameOver && !confirm(L('Promijeniti jezik? Ova igra će se prekinuti.', 'Change the language? This game will end.'))) return;
      setLang(b.dataset.l);
    });
  }
  if(!LANG_CHOSEN && !skip) $('lgPick').classList.remove('hidden');   // prvo pokretanje: pitaj za jezik

  /* ▶️ glavni gumbi */
  $('lgPlay').addEventListener('click', () => {
    if(typeof touchMode !== 'undefined' && touchMode && typeof fsWanted === 'function' && fsWanted() && fsSupported()) enterFullscreen();   // 📱 mobitel: odmah preko cijelog zaslona (klik smije)
    click(); hide();
  });
  $('lgFriend').addEventListener('click', () => {
    click(); hide();
    if($('mpBox').classList.contains('hidden')) $('mpToggle').click();
    setTimeout(() => $('mpBox').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 450);
  });
  $('lgHelp').addEventListener('click', () => { click(); toggleHelp(); });
  $('lgAch').addEventListener('click', () => showAchievements());
  $('lgOpt').addEventListener('click', () => toggleOptions());
  { const back = $('selBack'); if(back) back.addEventListener('click', () => { click(); show(); }); }

  /* ⛶ cijeli zaslon */
  { const fb = $('lgFs');
    if(touchMode || !(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) fb.classList.add('hidden');
    fb.addEventListener('click', () => { toggleFullscreen(); click(); });
    document.addEventListener('fullscreenchange', () => { fb.textContent = isFullscreen() ? '🗗' : '⛶'; }); }

  /* 🦁 traka s junacima: klik = odaberi tog junaka */
  const track = $('lgTrack');
  const one = dup => HEROES.map((h, i) => `<button class="lgHero ${h.projSpeed > 0 ? 'R' : 'M'}" data-i="${i}" title="${h.name} — ${h.role}"${dup ? ' aria-hidden="true" tabindex="-1"' : ''}>` +
    `<img src="assets/hero_${h.id}.jpg" alt="${h.emoji}" loading="lazy" onerror="this.outerHTML='<div class=&quot;lgEmo&quot;>${h.emoji}</div>'">` +
    `<span>${h.name}</span></button>`).join('');
  track.innerHTML = one(false) + one(true);   // dvaput — traka se vrti bez prekida
  track.addEventListener('click', e => {
    const b = e.target.closest('.lgHero'); if(!b) return;
    const i = +b.dataset.i;
    hide();
    for(const t of document.querySelectorAll('#roleTabs button')) if(t.dataset.f === 'all' && !t.classList.contains('on')) t.click();
    selectHero(i);
    voxSay(HEROES[i].id, 'pick', { force: true });
    const c = $('card-' + i); if(c) setTimeout(() => c.scrollIntoView({ block: 'nearest' }), 450);
  });
  $('lgHeroN').textContent = L(HEROES.length + ' junaka', HEROES.length + ' heroes');

  /* 🏆 kratki profil ispod gumba */
  function refreshProfile(){
    const el = $('lgProfile'); if(!el) return;
    let p = null; try { p = loadProfile(); } catch(e){}
    if(!p || !p.games){ el.textContent = ''; return; }
    const n = Object.keys(p.ach).length;
    el.textContent = L(`🏆 ${p.wins} pobjeda u ${p.games} igara · ⭐ postignuća ${n}/${ACHIEVEMENTS.length}`,
      `🏆 ${p.wins} wins in ${p.games} games · ⭐ achievements ${n}/${ACHIEVEMENTS.length}`);
  }
  refreshProfile();

  /* ⌨️ Enter = zaigraj */
  window.addEventListener('keydown', e => {
    if(!visible() || !$('lgPick').classList.contains('hidden')) return;
    if(!$('help').classList.contains('hidden') || optionsOpen()) return;
    if(e.key === 'Enter'){ e.preventDefault(); $('lgPlay').click(); }
  });
})();

/* ❓ v0.57 pomoć bez zida teksta: cilj igre na vrhu, upute kao kartice (znak + tekst) u dva stupca, a popis novosti po
   verzijama se otvara na klik. Tekst ostaje u index.html (redci odvojeni s <br>, novosti počinju s 🆕) — ovdje se samo presloži. */
(function(){
  const box = document.querySelector('#help .helpBox');
  if(!box || box.dataset.pretty) return;
  try {
    const h2 = box.querySelector('h2');
    const title = h2 ? h2.outerHTML : '';
    const lines = box.innerHTML.replace(title, '').split(/<br\s*\/?>/i).map(t => t.trim()).filter(Boolean);
    if(lines.length < 4) return;
    const split = t => {   // prvi komad bez razmaka su znakovi na početku retka (🖱️, ⚔️/🏹, 💪🤸🧠) — ako u njemu nema slova ni oznaka
      const m = /^(\S+)\s+([\s\S]+)$/.exec(t);
      return m && !/[<&0-9A-Za-z\u00C0-\u024F\u0400-\u04FF]/.test(m[1]) ? [m[1], m[2]] : ['', t];
    };
    const row = t => { const [ic, tx] = split(t); return `<div class="hRow">${ic ? `<span class="hIc">${ic}</span>` : ''}<div>${tx}</div></div>`; };
    const newsRow = t => {
      const m = /^\S+\s*<b>([^<]{2,8})<\/b>:?\s*([\s\S]+)$/.exec(t);
      return m ? `<div class="hRow"><span class="hVer">${m[1]}</span><div>${m[2]}</div></div>` : row(t);
    };
    const isNews = t => t.indexOf('🆕') === 0;
    const news = lines.filter(isNews), guide = lines.filter(t => !isNews(t));
    let goal = '';
    if(guide.length && guide[guide.length - 1].indexOf('🏆') === 0){ const [ic, tx] = split(guide.pop()); goal = `<div class="hGoal"><span class="hIc">${ic}</span><div>${tx}</div></div>`; }
    box.innerHTML = title + goal + `<div class="hGrid">${guide.map(row).join('')}</div>` +
      (news.length ? `<details class="hNews"><summary>🆕 ${L('Što je novo u igri', 'What’s new in the game')}</summary><div class="hGrid">${news.map(newsRow).join('')}</div></details>` : '');
    box.dataset.pretty = '1';
  } catch(e){}
})();
