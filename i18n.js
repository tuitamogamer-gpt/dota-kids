/* 🌐 Jezik igre (v0.43): hrvatski/bosanski, srpski (latinica ili ćirilica) ili engleski — bira se na
   početnom ekranu, pamti u pregledniku. Svaki tekst u igri piše se kao L('hrvatski', 'English').
   Srpski se dobiva iz hrvatskog teksta: rječnik ijekavica → ekavica i srpske riječi (sr.js), a ćirilica
   iz srpske latinice. Promjena jezika ponovno učita stranicu (podaci junaka, predmeta i opisa grade se
   jednom, pri učitavanju). ?lang=hr / sr / cy (ćirilica) / en u adresi također radi.
   Dok igrač ne odabere, jezik se pogađa po pregledniku. */
const LANGS = ['hr', 'sr', 'cy', 'en'];
function normLang(l){
  l = String(l || '').toLowerCase();
  if(l === 'hr' || l === 'en' || l === 'sr' || l === 'cy') return l;
  if(l === 'sr-latn' || l === 'srl') return 'sr';
  if(l === 'sr-cyrl' || l === 'cyr' || l === 'ср') return 'cy';
  return null;
}
const LANG_CHOSEN = (() => {
  try {
    const q = typeof location !== 'undefined' && location.search ? normLang(new URLSearchParams(location.search).get('lang')) : null;
    if(q){ localStorage.setItem('dk_lang', q); return q; }
    return normLang(localStorage.getItem('dk_lang'));
  } catch(e){}
  return null;
})();
const LANG = LANG_CHOSEN || (() => {
  const nl = typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage) || '';
  if(/^sr\b.*cyrl/i.test(nl)) return 'cy';
  if(/^sr\b/i.test(nl)) return 'sr';
  return /^(hr|bs|sh|me|cnr)\b/i.test(nl) || !nl ? 'hr' : 'en';
})();
const EN = LANG === 'en';
const SR = LANG === 'sr' || LANG === 'cy';   // srpski (oba pisma)
const CYR = LANG === 'cy';                   // ćirilica
function L(hr, en){ return EN && en != null ? en : (SR ? toSr(hr) : hr); }
/* samo hrvatski tekst → odabrana varijanta (gdje je L lokalna varijabla: EN ? 'English' : LS('hrvatski')) */
function LS(hr){ return SR ? toSr(hr) : hr; }
function setLang(l){
  l = normLang(l) || 'hr';
  try { localStorage.setItem('dk_lang', l); } catch(e){}
  if(l === LANG) return;
  const u = new URL(location.href); u.searchParams.delete('lang');
  location.replace(u.toString());
}

/* ---------- 🇷🇸 hrvatski → srpski (ekavica) ---------- */
const SR_CACHE = new Map();
const SR_TOKEN = /(<[^>]*>|&#?\w+;)|([A-Za-zČĆŽŠĐčćžšđ]+)/g;
function srWord(w){
  const lw = w.toLowerCase();
  const t = typeof SR_WORDS !== 'undefined' ? SR_WORDS[lw] : undefined;
  if(t === undefined) return w;
  if(w === lw) return t;
  if(w.length > 1 && w === w.toUpperCase()) return t.toUpperCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function toSr(s){
  if(typeof s !== 'string' || !s) return s;
  let r = SR_CACHE.get(s);
  if(r !== undefined) return r;
  r = s;
  if(typeof SR_PHRASES !== 'undefined') for(const p of SR_PHRASES) if(r.indexOf(p[0]) >= 0) r = r.split(p[0]).join(p[1]);
  r = r.replace(SR_TOKEN, (m, tag, w) => tag ? srTag(tag, srText) : srWord(w));
  if(CYR) r = toCyr(r);
  if(SR_CACHE.size > 6000) SR_CACHE.clear();   // dinamični tekst (brojevi) ne smije rasti zauvijek
  SR_CACHE.set(s, r);
  return r;
}
function srText(v){ return v.replace(SR_TOKEN, (m, tag, w) => tag || srWord(w)); }
/* u HTML oznakama mijenja se samo tekst opisa (title="…"), ne klase ni putanje */
function srTag(tag, fn){ return tag.charAt(0) === '<' && tag.indexOf('title="') > 0 ? tag.replace(/title="([^"]*)"/g, (m, v) => 'title="' + fn(v) + '"') : tag; }

/* ---------- ćirilica (iz srpske latinice) ---------- */
const CYR_MAP = { a:'а', b:'б', c:'ц', č:'ч', ć:'ћ', d:'д', đ:'ђ', e:'е', f:'ф', g:'г', h:'х', i:'и', j:'ј', k:'к', l:'л',
  m:'м', n:'н', o:'о', p:'п', r:'р', s:'с', š:'ш', t:'т', u:'у', v:'в', z:'з', ž:'ж' };
/* ostaju latinicom: kratice, tipke i imena koja se tako pišu i u igri */
const CYR_KEEP = new Set(['hp', 'mp', 'xp', 'mvp', 'kda', 'ok', 'ai', 'dota', 'kids', 'esc', 'tab', 'enter', 'shift', 'ctrl', 'alt',
  'lvl', 'lh', 'dn', 'fps', 'gg', 'peerjs', 'webrtc', 'hud', 'lol', 'vs']);
function cyrWord(w){
  let o = '';
  for(let i = 0; i < w.length; i++){
    const c = w[i], lc = c.toLowerCase(), up = c !== lc, ln = (w[i + 1] || '').toLowerCase();
    let d = null;
    if(lc === 'l' && ln === 'j') d = 'љ';
    else if(lc === 'n' && ln === 'j') d = 'њ';
    else if(lc === 'd' && ln === 'ž') d = 'џ';
    if(d){ o += up ? d.toUpperCase() : d; i++; continue; }
    const m = CYR_MAP[lc];
    o += m ? (up ? m.toUpperCase() : m) : c;
  }
  return o;
}
/* ćirilica → latinica (tražilica dućana: „boca” nađe „Боца”) */
const LAT_MAP = Object.fromEntries(Object.entries(CYR_MAP).map(([l, c]) => [c, l]).concat([['љ', 'lj'], ['њ', 'nj'], ['џ', 'dž']]));
function cyrToLat(s){ return String(s).replace(/[а-шђјљњћџ]/g, c => LAT_MAP[c] || c); }
function toCyr(s){
  return s.replace(SR_TOKEN, (m, tag, w, off) => {
    if(tag) return srTag(tag, toCyr);
    if(/[qwxy]/i.test(w) || CYR_KEEP.has(w.toLowerCase())) return w;
    // jedno veliko slovo = tipka (Q, B, T…) — ostaje latinicom; „A/I/U/S/K/O” ispred riječi su prijedlozi i veznici
    if(w.length === 1 && w !== w.toLowerCase() && !('AIUSKO'.includes(w) && /^ [a-zčćžšđ]/.test(s.slice(off + 1, off + 3)))) return w;
    return cyrWord(w);
  });
}

/* statični HTML: elementi s data-en (innerHTML), data-en-title, data-en-ph (placeholder);
   blokovi s data-lang="hr|en" ostaju samo za odabrani jezik (srpski koristi hrvatski blok);
   srpski: svi tekstovi i opisi pretvore se na mjestu (osim .notr — izbornik jezika — i tipki <kbd>) */
function srDom(root){
  const skip = el => !!(el && el.closest('script,style,kbd,.notr'));
  if(!root || typeof document.createTreeWalker !== 'function') return;   // (simulator nema pravi DOM)
  const walk = document.createTreeWalker(root, 4);   // 4 = NodeFilter.SHOW_TEXT
  const nodes = [];
  while(walk.nextNode()) nodes.push(walk.currentNode);
  for(const n of nodes) if(/[A-Za-z]/.test(n.nodeValue) && !skip(n.parentElement)) n.nodeValue = toSr(n.nodeValue);
  for(const el of root.querySelectorAll('[title]')) if(!skip(el)) el.title = toSr(el.title);
  for(const el of root.querySelectorAll('[placeholder]')) if(!skip(el)) el.placeholder = toSr(el.placeholder);
}
function applyLangDom(){
  if(typeof document === 'undefined') return;
  document.documentElement.lang = { hr: 'hr', sr: 'sr-Latn', cy: 'sr-Cyrl', en: 'en' }[LANG];
  const block = EN ? 'en' : 'hr';
  for(const el of document.querySelectorAll('[data-lang]')) if(el.dataset.lang !== block) el.remove();
  if(SR){ srDom(document.body); return; }
  if(!EN) return;
  for(const el of document.querySelectorAll('[data-en]')) el.innerHTML = el.dataset.en;
  for(const el of document.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
  for(const el of document.querySelectorAll('[data-en-ph]')) el.placeholder = el.dataset.enPh;
  document.title = '🏰 DOTA Kids 3D ⚔️ — a MOBA for kids';
}
if(typeof document !== 'undefined' && document.body) applyLangDom();
