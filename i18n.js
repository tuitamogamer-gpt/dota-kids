/* 🌐 Jezik igre (v0.43): hrvatski ili engleski — bira se na početnom ekranu, pamti u pregledniku.
   Svaki tekst u igri piše se kao L('hrvatski', 'English'). Promjena jezika ponovno učita stranicu
   (podaci junaka, predmeta i opisa grade se jednom, pri učitavanju). ?lang=en / ?lang=hr u adresi također radi.
   Dok igrač ne odabere, jezik se pogađa po pregledniku (hr/bs/sr → hrvatski, inače engleski). */
const LANG_CHOSEN = (() => {
  try {
    const q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('lang') : null;
    if(q === 'en' || q === 'hr'){ localStorage.setItem('dk_lang', q); return q; }
    const s = localStorage.getItem('dk_lang');
    if(s === 'en' || s === 'hr') return s;
  } catch(e){}
  return null;
})();
const LANG = LANG_CHOSEN || (() => {
  const nl = typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage) || '';
  return /^(hr|bs|sr|sh|me)\b/i.test(nl) || !nl ? 'hr' : 'en';
})();
const EN = LANG === 'en';
function L(hr, en){ return EN && en != null ? en : hr; }
function setLang(l){
  try { localStorage.setItem('dk_lang', l); } catch(e){}
  if(l === LANG) return;
  const u = new URL(location.href); u.searchParams.delete('lang');
  location.replace(u.toString());
}
/* statični HTML: elementi s data-en (innerHTML), data-en-title, data-en-ph (placeholder);
   blokovi s data-lang="hr|en" ostaju samo za odabrani jezik */
function applyLangDom(){
  if(typeof document === 'undefined') return;
  document.documentElement.lang = LANG;
  for(const el of document.querySelectorAll('[data-lang]')) if(el.dataset.lang !== LANG) el.remove();
  if(!EN) return;
  for(const el of document.querySelectorAll('[data-en]')) el.innerHTML = el.dataset.en;
  for(const el of document.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
  for(const el of document.querySelectorAll('[data-en-ph]')) el.placeholder = el.dataset.enPh;
  document.title = '🏰 DOTA Kids 3D ⚔️ — a MOBA for kids';
}
if(typeof document !== 'undefined' && document.body) applyLangDom();
