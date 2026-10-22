# 🏰 DOTA Kids 3D ⚔️

Dječji DOTA All-Stars klon u 3D — kompletan mini-MOBA koji radi u pregledniku, bez instalacije. **v0.13: detaljniji 3D modeli (oči, prsti, tabani, tunike, oružje, vojnici), rubno svjetlo i spektakularne magije — runski krugovi, udarni valovi, svijetleće munje i svjetla koja bljesnu!** ✨⚡

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

- ✨ **Detalji i magije** (v0.13):
  - 🧸 **detaljniji modeli** svih junaka: oči sa šarenicom, zjenicom, dva odsjaja, tuš-linijom i trepavicama; krzno na obrazima i prsima; prsti, palac i jastučić na šakama; potplati i prstići na stopalima; tunika sa zlatnim rubom, naborima, torbicom na pojasu i ovratnikom
  - ⚔️ **detaljnije oružje**: mač s draguljem u križnici i omotanom drškom, štapovi sa zlatnim prstenovima, luk s kožnim omotačem, čekić sa svjetlećim runama, kugla s čarobnim prstenom, batina s čavlima
  - 🛡️ **vojnici**: metalni umbo i zakovice na štitu, naramenice, vizir i veća perjanica; čarobnjaci sa zlatnim kandžama oko kugle, rubovima rukava i zvjezdicama na šeširu
  - 🌗 **rubno svjetlo** (fresnel) na svim modelima — obrisi se ističu, noću jače (mjesečina); AO se peče s više uzoraka
  - 🔮 **magije**: pod junakom se pri svakom bacanju zavrti **runski krug** u boji moći (kod ultija tri kruga i stup svjetla), AoE oko junaka šalje **udarni val**, a **točkasta svjetla** stvarno osvijetle teren pri bacanju, udaru projektila, otkucaju zone i padu meteora
  - ⚡ **munje i zrake** su sada debele svijetleće cijevi (izlomljene kod munja) s bijelom jezgrom umjesto tankih linija
  - 🎬 nova animacija **cast2**: magije s ciljem junak "baci" ispruženom rukom prema cilju; magije oko sebe i ulti — obje ruke uvis

- ⚔️ **DotA borba** (v0.12):
  - ❗ **Uskraćivanje (deny)**: klikom napadaš vlastitog vojnika ispod 50% života (ili kulu ispod 10%) — protivnik ne dobiva zlato i dobiva samo pola iskustva; botovi to rade i sami. U tablici (Tab) su sada **LH/DN** (last-hitovi i uskraćivanja)
  - 🛡️ **Zaštita od backdoora**: kula, vojarna i prijestol bez neprijateljskih vojnika u blizini primaju pola štete i sami se liječe — guranje ide s vojnicima, kao u DotA
  - 📣 **Najavljivač**: dvostruko / trostruko / ULTRA ubojstvo / POKOLJ i nizovi (dominira, mega, nezaustavljiv, čudovište, božanski…); 🛑 **prekinut niz** donosi dodatno zlato
  - 🌿 **Tango** (3 lista, polako vraća život), 💧 **Bistrina** (mana, prekida je udarac junaka), 🧀 **Zmajev sir** od drugog ubojstva Zmaja (+1500 života, +800 mane)
  - ✨ **3D**: svijetli **trag zamaha** pri svakom udarcu blizinskog junaka (drugi smjer kod drugog zamaha), **zlatnici** (Blender model) iskaču iz vojnika na last-hit, plavi štit iskri na kuli pod backdoor zaštitom

- 🌳 **Živa okolina i više složenosti** (v0.11):
  - 🌲 **novi Blender modeli okoline**: breze, panjevi, cvjetne krpice i busenje trave po cijeloj mapi, trska na obali i lopoči na rijeci, **kameni gazovi** gdje staze prelaze rijeku, **baklje** uz staze kod baza (noću svijetle), **šatori** u boji tima, bačve, sanduci i ograde u bazama, logorske vatre i svjetleći kristali uz kampove, veliko kamenje oko Zmajeve jazbine, putokazi — sve instancirano (jedan draw call po vrsti)
  - 🎓 **Talenti**: na levelu 10 i 15 biraš jedan od dva bonusa (+30 štete / +300 života, +15% brzine / −20% hlađenja moći) — botovi biraju sami
  - 🕊️ **Svetišta** (DotA 7): po jedno u džungli svakog tima — ranjen junak stane uz njega i ono 5 s liječi cijeli tim u krugu, puni se 4 min
  - 🗿 **Kameni Golem**: novi neutralni kamp (po jedan na svakoj strani), svaki treći udarac omamljuje
  - 💪 **vojnici jačaju** svakih 7.5 min (+12% života i štete), kao u DotA
  - 🎯 auto-napad besposlenog junaka i dućan s kategorijama i preporukama (v0.10.1)

- 🐺 **Još junaka i DotA detalja** (v0.10):
  - 🐺 **5 novih junaka** (ukupno 20): **Sivko** 🐺 vuk (zavijanje koje jača tim, ugriz s krvarenjem, čopor, **Vučji oblik** — model naraste i zažari se), **Mrak** 🐦‍⬛ gavran (kletva — ukleti primaju više štete, **zamjena mjesta** s neprijateljem, krađa mane, jato gavranova koje ušutkava), **Pipko** 🐙 hobotnica (tinta — pogođeni promašuje, **pipci koji vuku** neprijatelje, sluzava koža, vrtlog dubina), **Rogo** 🦏 nosorog (**juriš** ravno kroz mapu dok ne zakači prvog, udarac rogom s odbačajem, debeli oklop, bijes), **Bambus** 🐼 panda (grom-pljesak, vrtoglavica, bambus, tri male pande)
  - 🛡️ **Glif utvrde** (tipka F): sve kule i vojarne tima 5 s neranjive, puni se 5 min — botovski tim ga sam koristi kad mu kula pada
  - 🍼 **Boca** (3 gutljaja, puni se kod fontane), 🌫️ **Prašina** (otkriva nevidljive, potroši se), 👁️ **Oko** (postavi oko u maglu rata), ☀️ **Sunčev kamen** (aura koja žari sve oko tebe — Radiance)
  - 🌀 nove mehanike: kletva (više primljene štete), 😵 sljepoća (promašaji), 🏃 juriš, 💥 odbačaj i povlačenje (modeli odlete lukom), 🔁 zamjena mjesta, 😡 bijes (omama svakim udarcem), krađa mane
  - 🎬 **drugi zamah napada**: svaki treći udarac je drukčija animacija (mač, kandže, krila, čarolija); novi modeli vuka, gavrana (čarobnjački šešir), hobotnice (8 pipaka), nosoroga (rog i oklop), pande (bambus) te mlaza tinte i gavrana koji kruže nad zonom

- 🏚️ **DotA mehanike** (v0.9):
  - 🦔 **5 novih junaka** (ukupno 15): **Bodljo** 🦔 jež-tenk (kiša bodlji koja se slaže, ljepljiva sluz, bodlje natrag napadaču, juriš), **Tutnjo** 🐘 slon (topot koji omamljuje, surla-zamah, debela koža, timski stampedo), **Zuja** 🐝 pčela (otrovni ubod, roj, med koji liječi tim, golema košnica), **Mudra** 🦉 sova (huk koji ušutkava, Sovino oko kroz maglu rata, noćna ptica, **Vječna noć** usred dana), **Skakač** 🐵 majmun (rastezljivi štap, skok, kombo svaki 3. udarac, **Majmunska vojska** — 3 poziva koji se bore uz tebe)
  - 🤢 **otrov**, 🤐 **ušutkavanje** (ne možeš bacati moći) i 👑 **imunost na čarolije** kao novi statusi; 🤝 **asistencije** se broje (udarac u zadnjih 10 s prije ubojstva)
  - 🏚️ **Vojarne** iza 2. kule na svakoj stazi — neranjive dok kula stoji; kad padnu, protivnički vojnici na toj stazi postaju **💪 SUPER vojnici** (veći, jači, s aurom); baze su ograđene **zidinama**
  - 💸 **Otkup** (tipka O ili gumb na ekranu smrti): plati zlatom i vrati se odmah — botovi ga koriste kad je prijestol u opasnosti; 🛡️ **Aegis** — tko ubije Zmaja dobiva jedno besplatno oživljavanje na licu mjesta (5 min)
  - 🪽 **Aktivni predmeti**: Skokne čizme (skok 600) i Kraljevski oklop (imunost 5 s) — tipke **1–6** ili lijevi klik na torbu; prodaja sada desnim klikom
  - 📋 **Tablica rezultata** (drži Tab): ubojstva / smrti / asistencije / level / zlato i predmeti svih 6 junaka; 👁️ Sovino oko se vidi na minimapi
  - 🎲 **Nasumičan junak** i traka učitavanja modela na ekranu odabira
  - 🎬 **Nove animacije**: **skok** (Skakač, Skokne čizme, Tragač, Skokica — stvarni luk kroz zrak), **kanaliziranje** (teleport kući), **pobjednički ples** svih junaka pobjedničkog tima na kraju i **drugi idle** (protezanje) kad junak dugo stoji
  - 🧸 novi Blender modeli: 5 junaka (bodlje, surla i kljove, krila i žalac, pernati disk i čuperci, traka na glavi i štap), vojarna s krovom u boji tima, zidine s barjakom, pčela, sluz i bodlja kao projektili; roj pčela kruži instancirano
  - 🌙 noć se sada **mekano prelijeva** (i kad je Mudra prizove), ljeti lete krijesnice po noći i latice po danu

- 🦁 **Ljepši modeli** (v0.8): svi junaci imaju lica s osmijehom, obrvama i velikim očima; svaki ima svoj potpis — Lavko ramene štitnike i veću grivu, Žarko veća krila, plamen na repu i trbušne ploče, Ledena pahuljicu na kapi i rukavice, Strijela pero u kosi, Listko cvijet na glavi, Munja munju na čelu i očnjake, Skokica pjege, Orlina naočale za nišanjenje i repna pera, Luna zvjezdani plašt, Tragač šuriken na remenu; vuk ima očnjake i krzneni ovratnik, medo kandže, Zmaj veća krila
  - 🌗 **Ambijentalna okluzija ispečena u Blenderu** (Cycles → boje vrhova): udubine, spojevi i krošnje su tamniji, pa svi modeli dobivaju dubinu bez ikakvog troška u igri; uz to i mekano studijsko osvjetljenje u three.js-u
  - 🎬 nove animacije: **trzaj** kad primiš udarac i **pogibija** (dvonošci padnu na leđa, četveronošci na bok) umjesto starog prevrtanja
  - 🏰 kule imaju istaknute cigle i prozore koji svijetle (noću izgledaju upaljeno)

- 🔥 **Čarolije u 3D-u** (v0.7): strijele, vatrene kugle, ledene strijele, pera, šurikeni, žirevi, mjesečeve strijele i sokoli su Blender modeli koji lete, vrte se i ostavljaju trag; žablji jezik se stvarno rasteže do mete
  - ☄️ **Meteor** pada s neba i ostavlja krater, 🌱 **korijenje** i 🧊 **ledeni kristali** izbijaju iz tla, 🏹 **kiša strijela** stvarno pada, 🌊 **val** se širi s pjenom, ⭐ zvijezde padaju, 💚 srca lebde pri liječenju
  - ⭐ zvjezdice kruže oko omamljenih, usporeni poplave, ukorijenjene drži korijenje, ubrzani ostavljaju trag
  - 👻 kad junak pogine, duh odleti, a ostane nadgrobni kamen do oživljavanja; ⬆️ stup svjetla pri levelu i oživljavanju
  - 📳 kamera se trese kod ultija, rušenja kula i udara meteora; 👑 kad prijestol padne, kristal se rasprsne u krhotine i kamera doleti na filmski završetak
  - 🌲 rub šume oko cijele mape, prašina pod nogama, iskre pri svakom pogotku, kule bljesnu kad pucaju

  ![Čarolije u 3D-u](docs/carolije.jpg)

- 🧸 **3D modeli iz Blendera** (v0.6): svih 10 junaka-životinja, vojnici (pješak, čarobnjak, opsadna kola s ovnom), čudovišta iz džungle (veprić, vuk, medo, Veliki Zmaj s krilima), kule, prijestoli, fontane, drveće, kamenje, grmlje i gljive — sve proceduralno modelirano Python skriptom u Blenderu
  - 🎬 **Animacije**: mirovanje, hodanje (brzina prati brzinu junaka), napad (mač, luk, kandže, krila, čarolija), bacanje moći i padanje kad netko pogine
  - 🎨 Boje tima na odjeći, zastavicama i kristalima • bljesak pri pogotku • prozirnost kad si nevidljiv
  - 🔥 **3D čestice**: iskre, plamen iz zona moći, tragovi projektila, prašina kad se sruši kula
  - 🌊 Animirana rijeka, okretni 3D pregled junaka na ekranu odabira
- 🎨 **AI ilustracije** (v0.5): naslikani portreti svih 10 junaka (select ekran, HUD i 3D glave u igri), portreti čudovišta iz džungle, slikovite teksture trave/staze/rijeke i epska splash pozadina — uz automatski fallback na emoji ako se slike ne učitaju
- 🗺️ **Kompletna mapa**: 3 staze, rijeka u udolini, baze na platoima (high/low ground — pucanje uzbrdo promaši 25%!), šuma, kule, fontane
- 🤖 **3 protiv 3**: ti + 2 bota protiv 3 bota — botovi farmaju, koriste moći i ultije, uče vještine, slažu recepte, idu u džunglu, bježe teleportom
- 🦁 **20 junaka-životinja** s po 4 moći (Q/W/E/R) — napadačke, obrambene i ✨ **pasivne**; ULTI se otključava na levelu 6
  - Lavko 🦁, Žarko 🐉, Ledena 🐧, Strijela 🦊, Listko 🐢, Munja 🐯, Skokica 🐸 (kuka jezikom!), Orlina 🦅, Luna 🐱 (Mirana-stil: Sveta strijela + timska nevidljivost), Tragač 🦝 (Gondar-stil: sjena, podmukli udarci i Ucjena s bonus zlatom), Bodljo 🦔, Tutnjo 🐘, Zuja 🐝, Mudra 🦉, Skakač 🐵, Sivko 🐺, Mrak 🐦‍⬛, Pipko 🐙, Rogo 🦏, Bambus 🐼
- 🐺 **DotA creep aggro**: creepovi se biju s creepovima, siege vojnici ruše građevine, a napadneš li junaka — njegovi creepovi (i kula!) okreću se na tebe na 2.3 s
- 🎯 **Indikatori moći**: lebdenje nad gumbom pokazuje domet i krug djelovanja, tooltipi pokazuju štetu za tvoj rang
- ⬆️ **Poeni vještina**: svaki level (do 18!) = 1 poen — Q/W/E po 3 ranga, ulti 3 ranga (leveli 6/11/16), plus 6 poena za 📊 atribute
- 💪🤸🧠 **Atributi kao u DotA**: Snaga (život), Okretnost (brzina + brzina napada), Inteligencija (mana) — glavni atribut daje štetu i raste svaki level
- 🛒 **Dućan s receptima**: kategorije kao u DotA (potrošno, napad, obrana, magija, čizme, legendarno) i **⭐ Preporučeno** — build za tvog junaka s oznakom 🎯 što kupiti sljedeće; torba sa 6 mjesta, aktivni predmeti, prodaja desnim klikom
- ⚔️ **Auto-napad kao u DotA**: junak koji stoji sam napada neprijatelje u dometu (junaci prvo, pa vojnici) — strijelci više ne čekaju klik
- 🎯 **DotA ciljanje**: prsten dometa + krug područja prije bacanja moći
- 🌫️ **Magla rata** — vid po jedinicama, noću kraći; gankovi rade u oba smjera
- 🏠 **Teleport kući** (T) — kanaliziranje 3 s, prekida se kretanjem/omamom
- 🐻 **Džungla**: 7 neutralnih kampova (veprići, vukovi, medo, 🗿 golemi) + 🐲 **Veliki Zmaj** (boss — timski plijen, blagoslov i Aegis)
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
| 1–6 | aktivni predmet iz torbe |
| O | otkup (kad si mrtav) |
| F | Glif utvrde (kule 5 s neranjive) |
| Tab | tablica rezultata |
| S | stani |
| razmaknica | kamera prati junaka |
| strelice / kotačić | kamera / zum |
| P / M / H | pauza / zvuk / pomoć |

## Tehnologija

Čisti JavaScript + [Three.js](https://threejs.org/) (r149, vendoran u `lib/` zajedno s GLTFLoaderom i RoomEnvironmentom) — bez build koraka.
`data.js` (junaci, predmeti, konfiguracija) • `game.js` (logika, AI, HUD) • `scene3d.js` (3D prikaz, modeli, animacije, čestice) • `net.js` (multiplayer) • `2d-verzija/` (originalna 2D verzija).

### 🧸 3D modeli (Blender)

![Svih 15 junaka i vojnici iz Blendera](tools/blender/preview.jpg)

Svi modeli nastaju iz jedne skripte: [`tools/blender/build_models.py`](tools/blender/build_models.py). Ona u Blenderu slaže modele od jednostavnih oblika (kugle, valjci, stošci, kocke s obrubom), boji ih bojama vrhova, slaže dijelove u hijerarhiju (noge, tijelo, glava, ruke, rep, krila) i animira ih (`idle`, `walk`, `attack`, `cast`), pa sve izveze u **`assets/models.glb`**. Uz jedinice i građevine tu su i projektili (`proj_*`), efekti moći (`fx_*`: meteor, korijenje, led, val, zvijezda, srce, duh, nadgrobni kamen) i rune (`rune_*`). Prije izvoza skripta **ispeče ambijentalnu okluziju** (Cycles, 24 uzorka, ~12 s za 157 objekata) izravno u boje vrhova, pa modeli imaju sjene u udubinama bez tekstura. Three.js ga učita, klonira model za svaku jedinicu i pušta animacije preko `AnimationMixer`-a (`idle`, `idle2`, `walk`, `attack`, `cast`, `channel`, `jump`, `hit`, `die`, `victory`); efekti koji se pojavljuju u velikom broju (kiša strijela, korijenje, srca, roj pčela, zidine) idu kao `InstancedMesh` — jedan draw call za sve primjerke. Ista skripta s `--portraits` rendera portrete novih junaka za ekran odabira.

```bash
# Blender 4.2+ / 5.x
blender -b -P tools/blender/build_models.py
# ili Blender kao Python modul (Python 3.13):  pip install bpy==5.2.2
python tools/blender/build_models.py            # --preview za render svih modela, --no-ao za brže iteracije
```

Skripta napravi i `assets/models.js` (isti GLB kao base64) da igra radi i kad otvoriš `index.html` dvoklikom (`file://`). Ako se modeli ne učitaju, igra se vraća na jednostavne oblike i AI portrete.

Sajt se objavljuje automatski: Vercel je povezan s ovim repozitorijem i svaki push na `main` postaje nova produkcijska verzija.

UI je na hrvatskom/bosanskom. Napravljeno uz [Claude Code](https://claude.com/claude-code). 🤖
