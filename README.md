# 🏰 DOTA Kids 3D ⚔️

Dječji DOTA All-Stars klon u 3D — kompletan mini-MOBA koji radi u pregledniku, bez instalacije. **v0.6: pravi 3D modeli napravljeni u Blenderu, s animacijama!** 🧸🎬

![DOTA Kids 3D u igri](docs/igra.jpg)

**🎮 Igraj odmah: [dota-kids-brown.vercel.app](https://dota-kids-brown.vercel.app)**

Ili lokalno: preuzmi repo i otvori `index.html` dvoklikom (radi offline — Three.js je uključen; za multiplayer treba internet).

## 🌐 Multiplayer (1 na 1)

1. Igrač 1 klikne **📡 Napravi sobu** i dobije kod od 4 znaka
2. Igrač 2 upiše kod i klikne **🔌 Uđi**
3. Oba odaberu junake i stisnu **✅ SPREMAN!**
4. Domaćin je 🔵 plavi mid, gost 🔴 crveni mid — svaki sa 2 bota saveznika, pravi 3v3!

P2P preko WebRTC-a (PeerJS), bez servera. Magla rata vrijedi za svakoga iz perspektive njegovog tima, a ako igrač izleti — bot preuzima njegovog junaka.

## Što je u igri

- 🧸 **3D modeli iz Blendera** (v0.6): svih 10 junaka-životinja, vojnici (pješak, čarobnjak, opsadna kola s ovnom), čudovišta iz džungle (veprić, vuk, medo, Veliki Zmaj s krilima), kule, prijestoli, fontane, drveće, kamenje, grmlje i gljive — sve proceduralno modelirano Python skriptom u Blenderu
  - 🎬 **Animacije**: mirovanje, hodanje (brzina prati brzinu junaka), napad (mač, luk, kandže, krila, čarolija), bacanje moći i padanje kad netko pogine
  - 🎨 Boje tima na odjeći, zastavicama i kristalima • bljesak pri pogotku • prozirnost kad si nevidljiv
  - 🔥 **3D čestice**: iskre, plamen iz zona moći, tragovi projektila, prašina kad se sruši kula
  - 🌊 Animirana rijeka, okretni 3D pregled junaka na ekranu odabira
- 🎨 **AI ilustracije** (v0.5): naslikani portreti svih 10 junaka (select ekran, HUD i 3D glave u igri), portreti čudovišta iz džungle, slikovite teksture trave/staze/rijeke i epska splash pozadina — uz automatski fallback na emoji ako se slike ne učitaju
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

Čisti JavaScript + [Three.js](https://threejs.org/) (r149, vendoran u `lib/` zajedno s GLTFLoaderom) — bez build koraka.
`data.js` (junaci, predmeti, konfiguracija) • `game.js` (logika, AI, HUD) • `scene3d.js` (3D prikaz, modeli, animacije, čestice) • `net.js` (multiplayer) • `2d-verzija/` (originalna 2D verzija).

### 🧸 3D modeli (Blender)

![Svi modeli iz Blendera](tools/blender/preview.jpg)

Svi modeli nastaju iz jedne skripte: [`tools/blender/build_models.py`](tools/blender/build_models.py). Ona u Blenderu slaže modele od jednostavnih oblika (kugle, valjci, stošci, kocke s obrubom), boji ih bojama vrhova, slaže dijelove u hijerarhiju (noge, tijelo, glava, ruke, rep, krila) i animira ih (`idle`, `walk`, `attack`, `cast`), pa sve izveze u **`assets/models.glb`**. Three.js ga učita, klonira model za svaku jedinicu i pušta animacije preko `AnimationMixer`-a.

```bash
# Blender 4.2+ / 5.x
blender -b -P tools/blender/build_models.py
# ili Blender kao Python modul (Python 3.13):  pip install bpy==5.2.2
python tools/blender/build_models.py            # dodaj --preview za render svih modela
```

Skripta napravi i `assets/models.js` (isti GLB kao base64) da igra radi i kad otvoriš `index.html` dvoklikom (`file://`). Ako se modeli ne učitaju, igra se vraća na jednostavne oblike i AI portrete.

UI je na hrvatskom/bosanskom. Napravljeno uz [Claude Code](https://claude.com/claude-code). 🤖
