/* v0.55 — engleski nazivi junaka, urođenih pasiva i moći iz data.js → tools/art/heroes.json (ulaz za prompts.py)
     node tools/art/heroes.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const ctx = { console, Math, JSON, Object, Array, String, Number,
  localStorage: { getItem: k => (k === 'dk_lang' ? 'en' : null), setItem(){} },
  navigator: { language: 'en' }, location: { search: '?lang=en' },
  document: { documentElement: {}, querySelectorAll: () => [], addEventListener(){} }, addEventListener(){} };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(['i18n.js', 'sr.js', 'data.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\n;this.__H = HEROES;', ctx);
const out = ctx.__H.map(h => ({ id: h.id, name: h.name, emoji: h.emoji, role: h.role, ranged: h.projSpeed > 0,
  P: { name: h.passive.name, emoji: h.passive.emoji, desc: h.passive.desc, color: h.passive.color },
  ab: h.abilities.map(a => ({ key: a.key, name: a.name, emoji: a.emoji, desc: a.desc, color: a.color, ult: !!a.ult })) }));
fs.writeFileSync(path.join(__dirname, 'heroes.json'), JSON.stringify(out, null, 1) + '\n');
console.log(out.length + ' junaka → tools/art/heroes.json');
