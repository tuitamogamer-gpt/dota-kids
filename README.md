# 🏰 DOTA Kids 3D ⚔️

Dječji DOTA All-Stars klon u 3D — kompletan mini-MOBA koji radi u pregledniku, bez instalacije.

**🎮 Igraj odmah: [dota-kids-brown.vercel.app](https://dota-kids-brown.vercel.app)**

Ili lokalno: preuzmi repo i otvori `index.html` dvoklikom (radi offline — Three.js je uključen).

## Što je u igri (v0.1)

- 🗺️ **Kompletna mapa**: 3 staze, rijeka u udolini, baze na platoima (high/low ground — pucanje uzbrdo promaši 25%!), šuma, kule, fontane
- 🤖 **3 protiv 3**: ti + 2 bota protiv 3 bota — botovi farmaju, koriste moći i ultije, uče vještine, slažu recepte, idu u džunglu, bježe teleportom
- 🦁 **10 junaka-životinja** s po 4 moći (Q/W/E/R) — napadačke, obrambene i ✨ **pasivne**; ULTI se otključava na levelu 6
  - Lavko 🦁, Žarko 🐉, Ledena 🐧, Strijela 🦊, Listko 🐢, Munja 🐯, Skokica 🐸 (kuka jezikom!), Orlina 🦅, Luna 🐱 (Mirana-stil: Sveta strijela + timska nevidljivost), Tragač 🦝 (Gondar-stil: sjena, podmukli udarci i Ucjena s bonus zlatom)
- 🐺 **DotA creep aggro**: creepovi se biju s creepovima, siege vojnici ruše građevine, a napadneš li junaka — njegovi creepovi (i kula!) okreću se na tebe na 2.3 s
- 🎯 **Indikatori moći**: lebdenje nad gumbom pokazuje domet i krug djelovanja, tooltipi pokazuju štetu za tvoj rang
- ⬆️ **Poeni vještina**: svaki level (do 18!) = 1 poen — Q/W/E po 3 ranga, ulti 3 ranga (leveli 6/11/16), plus 6 poena za 📊 atribute
- 💪🤸🧠 **Atributi kao u DotA**: Snaga (život), Okretnost (brzina + brzina napada), Inteligencija (mana) — glavni atribut daje štetu i raste svaki level
- 🛒 **Dućan s receptima** u 4 tira (osnovno → legendarno), torba sa 6 mjesta, prodaja klikom
- 🎯 **DotA ciljanje**: prsten dometa + krug područja prije bacanja moći
- 🌫️ **Magla rata** — vid po jedinicama, noću kraći; gankovi rade u oba smjera
- 🏠 **Teleport kući** (T) — kanaliziranje 3 s, prekida se kretanjem/omamom
- 🐻 **Džungla**: 5 neutralnih kampova + 🐲 **Veliki Zmaj** (boss — timski plijen i blagoslov)
- ✨ **Rune na rijeci** svake 2 minute • 🌙 **dan/noć ciklus** • 💪 veliki vojnik svaki 3. val
- 🗼 **Aggro kula**: napadneš li junaka ispod kule — kula gađa tebe!
- 👑 Pobjeda rušenjem neprijateljskog prijestola (čuvarske kule prvo!)

## Kontrole

| Tipka | Radnja |
|---|---|
| 🖱️ klik | kreći se / napadni |
| Q W E R | moći (s prikazom dometa) |
| T | teleport kući |
| B | dućan |
| S | stani |
| razmaknica | kamera prati junaka |
| strelice / kotačić | kamera / zum |
| P / M / H | pauza / zvuk / pomoć |

## Tehnologija

Čisti JavaScript + [Three.js](https://threejs.org/) (r149, vendoran u repo) — bez build koraka.
`data.js` (junaci, predmeti, konfiguracija) • `game.js` (logika, AI, HUD) • `scene3d.js` (3D prikaz) • `2d-verzija/` (originalna 2D verzija).

UI je na hrvatskom/bosanskom. Napravljeno uz [Claude Code](https://claude.com/claude-code). 🤖
