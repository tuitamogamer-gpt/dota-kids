# 🏰 DOTA Kids 3D ⚔️

> 🇬🇧 **English:** a kids' DOTA-style MOBA in 3D that runs in the browser — 27 heroes, 5 vs 5 against bots or with a friend online, talking heroes, achievements, works on tablets. **The whole game is available in English** (and in Croatian/Bosnian and Serbian, Latin and Cyrillic) — pick the language on the start screen (or open the game with `?lang=en`). Play: [dota-kids-brown.vercel.app](https://dota-kids-brown.vercel.app/?lang=en)

Dječji DOTA All-Stars klon u 3D — kompletan mini-MOBA koji radi u pregledniku, bez instalacije. **v0.56: 🌲 uloga DŽUNGLA od levela 1 (🦎 mali kampovi, 🐾 Lovački nož, 🌩️ Kazna), 🏰 baze kao u DotA 2 (T1 i T2 na stazi, T3 pred vojarnom), 🪙 jasan okvir zlata, A + klik = zadnji udarac i S = stani, 🛒 25 novih predmeta i 🎲 botovi s različitim predmetima svaku igru.** v0.55: 🦛🐆🦂 tri nova junaka s moćima iz DotA 2 — 🦛 Pecko (udica kao Pudge), 🐆 Inja (ledena strijelkinja kao Drow Ranger) i 🦂 Škorpo (kralj pijeska kao Sand King) — s 3D modelima, glasovima i talentima, i 🎨 novi portreti i ikone moći svih 27 junaka iz GPT Image 2.5.** v0.54: 💰 sporije zlato i predmeti u normalnoj igri (trećina manje zlata, za ubojstvo ~60 % manje) i 🎯 bogata meta — nitko više ne pobjegne prerano (manje snowballa).** v0.53: ✏️ junaci imaju obris kao u crtanom filmu, 👀 izražajnija lica (oči svjetlucaju, zaobljene obrve, sovin disk lica, majmunova maska), 🪶 krila od pravih pera i 🖼️ krupniji portreti (glava i ramena).** v0.52: 👕 svaki junak nosi svoju odjeću kao na portretu (prsluci, kaputi, halje, kapuljače, šeširi) — više nisu svi u istoj plavoj uniformi.** v0.51: 🧠 botovi procjenjuju kad u gank, u džunglu, po runu, u pomoć i na Velikog Zmaja — više ne po satu.** v0.50: 🛣️ biraš stazu (gore, sredina, dolje) kao ulogu u LoL-u — prava faza na stazama.** v0.49: 🪖 izdržljiviji vojnici (kao u DotA 2) koji jačaju kroz cijelu igru i 🤖 botovi koji se više ne zalijeću jedan po jedan na jakog junaka.** v0.48: ⭐ leveli kao u DotA 2 — level 2 dolazi brzo, a svaki sljedeći traži sve više iskustva (level 25 tek u dugoj igri).** v0.47: 🌙 ljepša noć (mjesečina umjesto mraka) i dan, 🏮 fenjeri i svjetla koja noću obasjaju tlo, 🌫️ nova magla rata, 🐲 čudovišta i zmajevi jačaju s vremenom, 🗼 kampovi daleko od kula i 🗺️ 20 % veća mapa.** v0.46: 🐗 džungla kao u DotA 2 (čudovišta su mirna dok ih ne udariš, kamp se može povući do vojnika i pod kulu), 🐻 6 novih kampova, 🐢 sporiji junaci i 🗡️ kasniji gankovi botova.** v0.45: ⚡ brza igra (~10 min), 🎁 nagrade za postignuća (trag i kruna/ljubimac), 🎶 glazba, 📊 statistika po junaku i ⚖️ ujednačeniji junaci.** v0.44: 🎯 zadaci za početnike sa zlatom, 📈 graf „Tko je vodio” na kraju igre i 🌐 poruke na svom jeziku u igri s prijateljem.** v0.43: 🌍 cijela igra i na srpskom (latinica i ćirilica) i engleskom — biraš na početku — i 🎬 novi početni ekran.** v0.42: 🏆 postignuća i profil — 15 postignuća, pobjede sa svakim junakom i 🎖️ „Novo postignuće!” na kraju igre.** v0.41: 🔊 novi zvuk — bogatiji efekti, prostorni zvuk (lijevo/desno, tiše izdaleka) i 🌲 zvukovi prirode.** v0.40: 🪙 pomoć za zadnji udarac, 💡 savjeti za početnike, 🏅 medalje na kraju igre, 🗺️ portreti na minimapi i 🔥 junaci „u vatri”.** v0.39: čišći ekran (brojevi štete samo kad si ti uključen, manje poruka), 💨 brže putovanje izvan borbe i 🪙 zlatnici koji polete do tebe kad pobijediš junaka.** v0.38: veliko poliranje — ⛶ cijeli zaslon, 🐿️ Nišan i 🐂 Bikoš, 🎓 svaki junak ima svoje talente, 💥 kritični udarci, 🛒 jasniji dućan, 🗺️ veća mapa, 🗼 aggro kao u Doti, 🌫️ prava magla rata, 🌿 tango jede drvo i 🤖 pametniji botovi (gankovi, guranje, obrana).** (v0.37: 👥 pravih 5 na 5, v0.36: peglanje za mobitel i opisi gumba, v0.35: u mrežnoj igri svatko vidi svoje, v0.34: 📣 najavljivač, 🤖 težina botova, 💀 pregled pogibije, 💃 ples)

![DOTA Kids 3D u igri](docs/igra.jpg)

**🎮 Igraj odmah: [dota-kids-brown.vercel.app](https://dota-kids-brown.vercel.app)**

Ili lokalno: preuzmi repo i otvori `index.html` dvoklikom (radi offline — Three.js je uključen; za multiplayer treba internet).

## 🌐 Multiplayer (ti protiv prijatelja, 5 na 5)

1. Igrač 1 klikne **📡 Napravi sobu** i dobije kod od 4 znaka
2. Igrač 2 upiše kod i klikne **🔌 Uđi**
3. Oba odaberu junake i stisnu **✅ SPREMAN!**
4. Domaćin je 🔵 plavi mid, gost 🔴 crveni mid — svaki sa 4 bota saveznika, pravi 5v5!

P2P preko WebRTC-a (PeerJS), bez servera. Magla rata vrijedi za svakoga iz perspektive njegovog tima, a ako igrač izleti — bot preuzima njegovog junaka.

## Što je u igri

- 🌲 **Uloga DŽUNGLA — junak u džungli je pravi od levela 1** (v0.56) — na ekranu junaka uz ⬆️ Gore / ↗️ Sredina / ➡️ Dolje sada je i **🌲 Džungla**:
  - kad je netko odabere (ti ili prijatelj u mrežnoj igri), **oba tima** igraju s junakom u džungli: gore i na sredini 1 na 1, dolje 2 na 2, a peti od 0:00 čisti kampove (`JUNGLE_PLAN` u `data.js`); bez odabira džungle raspored je kao prije (1 sredina, 2 gore, 2 dolje)
  - 🦎 **4 nova mala kampa s gušterima** (po 2 za svaki tim, bliže bazi, između staza — daleko od staza i kula): 3 guštera po 190 života i 11 štete, novi 3D model iz Blendera (`mob_lizard`: niske noge, dugi rep, šarena krijesta); s Lovačkim nožem dva mala kampa = level 2 za ~1 min
  - 🐾 **Lovački nož** (200 zlata): protiv čudovišta +22 štete, svaki udarac te liječi 9 života i +3 zlata za svako čudovište; nadogradi se u 🍖 **Lovačku mačetu** (+45 štete, 16 života po udarcu, +5 zlata) — vodič u dućanu (⭐ Za tebe) za junaka u džungli pokazuje nož na početku i mačetu odmah nakon prvog predmeta
  - 🌩️ **Kazna** se sama stavi na F kad odabereš džunglu (i junak u džungli ju uvijek nosi); botovi je čuvaju za velika čudovišta i zmajeve
  - 🤖 **bot u džungli**: od 0:00 ide od kampa do kampa (prvo mali, pa veći kad ojača — procjena smije li sam), pričeka kamp koji se uskoro obnovi, gankove i obranu dobiva od tima kao i ostali; suigrači na stazama ne diraju njegove male kampove u fazi na stazama
  - 🧪 simulacija s džunglom (`node tools/sim/sim.js 4 --lane=jungle`): junak u džungli je level 2 u 1. minuti, level 3 u 1:30, bez pogibije u prvih 10 min, a u 10. minuti ~level 9 (kao junak na sredini)
- 🏰 **Baze kao u DotA 2** (v0.56) — na svakoj stazi **T1** (vanjska, na 36 % puta) i **T2** (25 %), **T3** na ulazu u bazu (13,5 %; na sredini 15,5 %) s **vojarnom odmah iza** nje, i dvije **T4** uz prijestol:
  - 🔒 unutarnja kula je neranjiva dok ne padne prethodna na istoj stazi; vojarna te staze i obje T4 postaju ranjive kad padne T3 (poruka u igri i 🔒 na kuli; klik na zaključanu kulu kaže zašto)
  - unutarnje kule su izdržljivije (T2 ×1,15 i +2 oklopa, T3 ×1,2 i +3 oklopa, T4 ×1,3 i +4 oklopa); na kulama piše T1–T4
  - botovi brane i guraju po redu kula (vojarna je iza T3); u mrežnoj igri gost vidi iste brave i oznake
  - 🧪 simulacija (`node tools/sim/sim.js 4 --max=3000`, i s `--lane=jungle`): svih 8 normalnih igara završi s pobjednikom, prosječno za 28–29 min; jungleri u 15 igara s džunglom: K/D/A 8,2/7,3/18,3 i ~16 % više zlata od prosjeka tima (2. po zlatu u timu)
- 🪙 **Jasan okvir zlata** (v0.56) — iznad ploče junaka veliki okvir s 🪙 i brojem zlata koji glatko broji gore/dolje, **+N** kad nešto zaradiš, crveno bljesne kad potrošiš, i koliko zlata dobivaš u minuti; klik na okvir otvara dućan
- 🪙 **A i S za zadnji udarac** (v0.56) — **A pa klik na vojnika** (ili čudovište) = junak udari **samo jednom** i stane, pa ne gura stazu dok čekaš zlatnik; **S** = stani: prekine kretanje, napad i **zamah udarca** (udarac se ne potroši) i junak stoji dok ne dobije novu naredbu — ne napada sam vojnike oko sebe
- 🛒 **25 novih predmeta** (v0.56) — sada ih je 99, s novim učincima:
  - potrošno: 🧚 Vilinska iskra (+85 života odmah), 🥭 Sunčani mango (+100 mane), 💨 Maglena kugla (tim u krugu 900 nevidljiv 12 s)
  - osnovno: 🦯 Pastirski štap, 🧥 Vuneni ogrtač (**otpor magiji** 15 %), 🪶 Galebovo pero, 💗 Prsten jednoroga, 🌌 Noćni kamen, 🏹 Lovačko koplje (25 % šanse za +40 čarobne štete), 🐾 Lovački nož
  - nadogradnje: 🍖 Lovačka mačeta • 🥏 Okrugli štitić (aura oklopa) • 💫 Plašt krijesnica (saveznik nevidljiv 5 s + štit) • 🎺 Truba zaštite (štit cijelom timu, otpor magiji 30 %) • 🧦 Iscjeliteljske čarape (aura, liječi tim, skida usporenja) • 📘 Knjiga čarolija (**+10 % jačine magija**) • ⚛️ Čarobna jezgra (**−25 % hlađenja moći**) • 🌺 Cvijet tišine (**tišina** 4 s) • 🔗 Štap okova (**okovi** 2 s, domet 1100) • 🧢 Kapa protiv čarolija (štit 350) • ⚜️ Gardijska helebarda (**razoružaj** 3 s — meta ne može udarati) • ⛈️ Olujni čekić i 🌩️ Gromovnik (**munja u lancu** na 4/8 neprijatelja; Gromovnik i statički štit) • 🪀 Oštrica ispijanja (udarac **pali manu**, usporenje 60 %) • 🧊 Ledeno srce (+22 svim atributima, **udarci usporavaju** 35 %)
  - nova polja predmeta: `stats.mres` (otpor magiji, množi se), `stats.cdr` (ne zbraja se, s talentima najviše 50 %), `stats.amp`, `chain`, `cold`, `mburn`, `hunt`; status `disarmT`; u opisu u dućanu nove crte (otpor magiji, hlađenje, jačina magija)
  - 🎲 **raznolikost**: svaki bot svaku igru odabere jednu od tri inačice gradnje za svoju vrstu (tenk, borac, strijelac, čarobnjak, podrška — `BUILD_ALTS`), a junaci s vlastitom gradnjom u 40 % igara zamijene zadnji predmet novim legendarnim (`LATE_ALTS`); botovi znaju koristiti sve nove aktivne predmete

- 🏹 **Napadi, kretanje i animacije junaka** (v0.56):
  - **strijele, čarolije i metci izlijeću iz oružja**, ne iz trbuha: svaki junak na daljinu u modelu ima nevidljivu oznaku vrha oružja (`<junak>_tip` — sredina luka, kugla na štapu, čarobna kugla u ruci, usta cijevi puške, vrh krila), koja prati animaciju napada; projektil krene odande i u prvoj trećini leta glatko prijeđe na svoju putanju; i sjaj punjenja napada svijetli na vrhu oružja
  - **trčanje**: nova animacija `run` (dug korak, nagib naprijed, ruke rade, ptice raširenih krila) kad junak ide brže (izvan borbe, ubrzanje); u borbi hoda — brzina koraka prati stvarnu brzinu po tlu, pa noge puno manje kližu (prije je brzina animacije bila stalna)
  - **hodanje**: dulji korak, noga koja prolazi naprijed se podigne, tijelo prebacuje težinu s noge na nogu, glava se njiše
  - **nagib**: junak se nagne naprijed kad trči i u zavoj kad skreće (samo izgled — kretanje i pogađanje se ne mijenjaju)
  - **omamljenost**: nova animacija `stun` — tetura, glava kruži, ruke mlitavo vise (prije je samo usporio mirovanje)
  - **prašina pod stopalom** točno kad stopalo stane na tlo (dva oblačića po ciklusu koraka, više kad trči), ne više u stalnom razmaku
  - **glatki položaj**: kad se junaci guraju jedan uz drugoga ili uz drveće, model se više ne trza (skok, odbačaj i teleport ostaju trenutni)
- 🧸 **Junaci s identitetom: svoja glava i teksture** (v0.56) — prije je skoro svaki junak imao istu okruglu glavu s istom „medvjeđom” njuškom, a ptice tanak kljun poput štapa. Sada svaka vrsta ima svoje lice (`tools/blender/build_models.py`, `snout=`):
  - 🦁🐯🐱🐆 **mačke** (Lavko, Munja, Luna, Inja): jastučići s brkovima, trokutasti nosić, bradica i usta u obliku slova w; Luna ima bademaste oči s uskom zjenicom
  - 🦊🐺🦝 **pseće njuške** (Strijela, Sivko, Tragač): izdužena njuška koja se sužava do crnog nosa, svijetla donja čeljust i usna; lisica ima bijele obraze, rakun kratku svijetlu njušku uz masku
  - 🦔 jež dugi šiljati nos • 🐿️ vjeverica napuhane obraze i dva zuba • 🐵 majmun plosnato lice i uši sa strane glave • 🐢 kornjača rožnati kljun i široki osmijeh • 🦏 nosorog veliku njušku s naborima i cjevaste uši • 🦄 jednorog dugu konjsku njušku s nosnicama gore
  - 🦅 orao debeli kukasti kljun • 🦉 sova kratki kukasti kljun u disku lica i velike okrugle oči • 🐦‍⬛ gavran dugi tamni kljun s čekinjama • 🐧 pingvin dugi uski kljun • 🐝 pčela svijetlu pločicu lica i mala klješta • 🦂 škorpion crvenu oklopnu kacigu od ploča s grebenom i očima na čelu • 🐙 hobotnica veliki plašt iznad glave i okrugla usta
  - 🎨 **teksture** (boje vrhova, bez slika): svako krzno ima pramenove i blage mrlje, a vrste svoj uzorak — 🐯 pruge (ševroni na licu, okomite na tijelu), 🐆 rozete, 🐉🐢 ljuske, 🦅🦉🐦‍⬛🐧 redovi perja, 🐙 svijetle pjege, 🐸 pjegava tamnija leđa, 🦂 oklopni prstenovi, 🦈 tamnija leđa i svijetao trbuh, 🦏🐘🦛 nabori kože, 🐺 tamnije krzno po leđima, 🦄 iskrice; odjeća dobije blagi šum tkanine. Glave i tijela s uzorkom imaju gušću mrežu da se uzorak vidi
- 🔤 **Novi font i jasnije ikone predmeta** (v0.56):
  - umjesto „Comic Sans MS” (a na iPadu i Androidu, gdje ga nema, preglednik je uzimao rukopisni `cursive` font — „pisana slova”) igra koristi **Nunito**: zaobljen i čitljiv, s našim slovima i ćirilicom (varijabilni font, ~125 KB u `assets/fonts/`, licenca SIL OFL); bez interneta ili s `file://` ostaje sistemski font bez rukopisnih slova; HUD (platno) ga učita odmah pri pokretanju
  - ikone predmeta u dućanu, torbi i opisima crtaju se u dvostrukoj razlučivosti (oštre na mobitelu i retina zaslonu), bijeli odsjaj više ne prekriva emoji (prije je izgledao blijedo), a predmeti koje još ne možeš platiti više nisu posivljeni (piše „fali X”); 🌺 Orhideja i ⚛️ Čarobna jezgra dobile su prave ikone
- 🌠 **Lunina Sveta strijela kao Miranina** (v0.56) — Q leti **2000** (preko pola mape) brzinom 950 i zabije se u **prvoga koga pogodi** — i vojnik na putu je zaustavi, u tome je vještina (indikator pokaže koga će pogoditi): što dulje leti, dulje omami (**0,6 → do 4 s** na rangu 4, najjače nakon 1500 puta) i jače rani (do 320); **čudovište iz džungle pada odmah** (osim Velikog Zmaja i zmajčića). Iza sebe vuče mjesečev trag, a pri pogotku junaka iz daljine piše „🌙 Dalekometni pogodak!”. Botovska Luna gađa i ranjene junake izvan blizine, ali ne puca kad joj vojnik stoji na putu (u simulaciji pogodi junaka u ~70 % bacanja)
- 🎯 **Bolje ciljanje** (v0.56):
  - **pomoć pri ciljanju**: strijela, kugla ili udica (17 moći s `shotSpeed`) uperena u neprijatelja ili **blizu neprijateljskog junaka** pogodi njega — i gađa **malo ispred ako hoda** (kao botovi, `assistAim` / `leadAim`); vrijedi za tipku, klik i dodir
  - dok ciljaš, **krug u boji moći** pokaže koga će hitac pogoditi (prvi neprijatelj na putu — i vojnik koji smeta — ili meta pomoći)
  - klik na **ime ili traku života** junaka gađa junaka, neprijateljski junak je malo „deblji” za klik i ima veću prednost pred vojnicima u gužvi
  - pod metom koju napadaš **pulsira crveni krug** (vidiš koga tučeš)
  - botovi strijelama također gađaju ispred mete koja hoda
- 💫 **Jače omame** (v0.56): kad omama počne — zlatni udarni val, bljesak i iskre iz glave, zvuk „bonk + ptičice”, a junak kojeg vodiš zadrma kameru; iznad junaka **5 zvjezdica i zlatni kolut** koji se ljulja (ostali 3 zvjezdice), pred kraj se smanje; **zlatna traka omame** ispod trake života (i kod vojnika i čudovišta) prazni se do kraja, uz junake piše koliko je još sekundi (💫1.4), iznad omamljenog junaka iskoči „💫 2.4 s”; dok si omamljen ili ušutkan, gumbi moći potamne s 💫 / 🤐
- 🎨 **Naslikani talenti i najave** (v0.56) — talenti i velike najave više nisu samo emoji i nacrtani okviri:
  - ploča za izbor talenta (level 10 / 15 / 20 / 25) i stablo talenata na ekranu junaka uz svaki izbor pokazuju **sliku**: talent koji jača moć ili urođenu pasivu ima ikonu te moći, a opći bonus (šteta, život, oklop, brzina, hlađenje, mana, domet, izbjegavanje…) jednu od **16 novih naslikanih ikona** (GPT Image 2.5, `assets/talent/`, `talentIconSrc` u `data.js`); tekst izbora ide u dva retka
  - velike najave (Prva krv, BUM!, ubojstva zaredom, Zmaj, noć, talent, pobjeda…) stoje na **naslikanoj traci** (`assets/ui/banner_*.webp`): 🟡 **zlatna** za dobru vijest za tvoj tim, 🔴 **crvena** za lošu (pala ti je kula, „Ne brini!”, poraz), 🔵 **plava** za obične vijesti; traka „iskoči”, sama se proširi za dug tekst, a u mrežnoj igri gost vidi boju iz svoje perspektive
  - `python3 tools/art/ui.py` izreže ikone iz dva lista 4 × 2 i makne magenta pozadinu s traka (originali su u `tools/art/src/`, nisu u gitu)
- 🌐 **Provjereni prijevodi** (v0.56) — automatska provjera svih tekstova na engleskom, srpskom i ćirilici: podaci (junaci, moći, talenti, predmeti, čudovišta, zmajevi, rune, čarolije, postignuća), ekran junaka, dućan i opisi predmeta, HUD, poruke i najave iz 25 min simulirane igre te statični HTML (pomoć, postavke) u pregledniku:
  - ćirilica: „s” (sekunde) u opisima i HUD-u, „LEVEL”, „ACE”, „k” (tisuće) i strane **Sentinel / Scourge** (Сентинел / Скурџ) bile su latinicom
  - srpski: ekavica za *pobijeđen*, *strijeli*, *odjeća* i nove riječi iz v0.56; engleska pomoć je spominjala junake hrvatskim imenima (Žarko → Zharko, Munja → Munya, Zubo → Zoobo); 🦊 Strijela je na engleskom **Arrow** (kao Tragač → Tracker; ostali zadržavaju svoja imena jer ih engleski glasovi izgovaraju)
  - 🌐 **mrežna igra**: gost je u porukama domaćina vidio imena junaka, moći, predmeta i čudovišta na jeziku domaćina („Žarko defeated…”) — sada ih zamijeni svojim (`fixNames` u `i18n.js`; imena se pamte dok se učitava `data.js`)
- 🦛🐆🦂 **Tri nova junaka s moćima iz DotA 2** (v0.55) — sada ih je 27. Svaki ima urođenu pasivu, 4 moći, talente, 3D model iz Blendera (s animacijama i obrisom), glas (Fish Audio, 9 replika) i botove koji ga znaju igrati:
  - 🦛 **Pecko** — nilski konj ribar, tenk sa snagom (kao **Pudge**): ✨ **Gozba** — kad neprijateljski junak padne blizu njega, pojede lubenicu i zauvijek dobije snagu (+1,5–3 po junaku), a debela koža smanjuje štetu od magija • **Q 🪝 Udica** — kuka na lancu (domet 1000) dovuče prvog pogođenog neprijatelja skroz do njega; u 3D-u se vidi lanac od Pecka do udice i dok vuče metu • **W 🤢 Smrdljivi oblak** — zeleni oblak 6 s ide s njim, ranjava i usporava sve oko njega (malo smrdi i njemu, ali ga ne može srušiti) • **E 🛟 Pojas za spas** — 5 s prima puno manje štete i odmah se malo izliječi • **R 😋 Veliki zalogaj** — kanalizira 3 s: neprijatelj je omamljen uz njega i gubi život, a Pecko se liječi za pola štete
  - 🐆 **Inja** — snježni leopard, ledena strijelkinja s okretnošću (kao **Drow Ranger**): ✨ **Aura preciznosti** — ona i prijatelji koji napadaju izdaleka (u krugu 900) udaraju jače • **Q ❄️ Ledene strijele** — 8 s svaka strijela jače udara i usporava do 38 % (i leti kao ledeni projektil) • **W 🌬️ Snježni nalet** — široki val koji odgura i ušutka (do 3,5 s) • **E 🏹 Lepeza strijela** — tri vala po 5 strijela, svaki val pogodi svakoga samo jednom • **R 🎖️ Majstorica luka** — pasivni ulti: +10/16/22 okretnosti, a kad nijedan neprijateljski junak nije bliže od 400, strijele ponekad (25–35 %) probiju oklop (+55–105 štete)
  - 🦂 **Škorpo** — škorpion, kralj pijeska (kao **Sand King**): ✨ **Otrovni prasak** — napadi i moći ubrizgaju otrov; padne li meta dok je otrovana, rasprsne se po svima oko sebe (lančano!), a preživi li 4 s, malo prasne • **Q 🕳️ Podzemni juriš** — zaroni pod pijesak i izleti do 600 dalje, sve na putu izbaci uvis i omami • **W ⏳ Pješčana oluja** — 5 s oluja ide s njim, ranjava sve u krugu 280, a on je nevidljiv dok ne napadne (oluju vidi i protivnik, kao u Doti) • **E 🦂 Žalac** — ubod repom izdaleka: šteta, usporenje 40 % i otrov • **R 🌋 Epicentar** — 1 s zamaha, pa 7–9 udarnih valova sve većeg kruga (250 → 450) koji ranjavaju i usporavaju
  - nova mehanika u igri: **vuča** (meta ne može ništa dok je lanac vuče), **oblak oko junaka** (Pecko, Škorpo), **kanaliziranje s otkucajima** (Veliki zalogaj, Lepeza strijela, zamah Epicentra — prekida ga omama, tišina ili nova naredba), **pasivni ulti** koji dodaje atribute kad ga naučiš, i nova bot pravila (`hook` — udica samo kad se tim bori ili je meta ranjena, s gađanjem ispred mete koja hoda; `grab` — zalogaj uz sebe; `burrow` — Podzemni juriš u borbu, a ranjen bot njime pobjegne prema fontani)
  - 🧸 Blender: nova njuška nilskog konja, ribarski šešir s mamcem, udica na lancu i ribica za pojasom • rozete leoparda, tirkizna kapuljača, ledeni kristali na luku • oklopna kaciga, šest nožica, kliješta, kruna i rep sa svjetlećim žalcem iznad glave • novi projektili `proj_hook` (udica) i `proj_gust` (ledeni polumjesec); `--dev-v55` brzo prikaže samo njih. Model je nakon Draco sažimanja 6,7 MB (prije 6,1 MB)
  - u mrežnoj igri gost vidi oblak, lanac udice, valove Epicentra, ledene strijele i otrov; 🇷🇸 svi novi tekstovi i na srpskom (snežni, strele, pesak…)
  - 🧪 simulacija (`node tools/sim/sim.js --vs=nilski,irbis,skorpion --check`; sva tri u crvenom timu, botovi vode oba tima): botovi bacaju sve moći novih junaka (Škorpo npr. Q 18–27, W 34–59, E 44–63, R 8–12 puta po igri). ⚖️ Ravnoteža u 4 kruga po 6–8 igara (ubojstva/pogibije zbrojeno):
    - 1. krug: 🦂 Škorpo 40/69 (ginuo je skoro dvaput češće) → više života i snage (750 života, 23 + 5,1 snage po levelu) i bot Podzemnim jurišem pobjegne kad je ranjen → 2. krug 60/40
    - 🐆 Inja je tada bila najjača (101/29, pa nakon prvog smanjenja 90/31): domet 380, Majstorica luka rjeđe i slabije (20–30 % šanse, +55–105), ledene strijele slabije (+14–32 štete, do 38 % usporenja), aura +5–11 % i pasivni ulti +10/16/22 okretnosti (prvo +18/26/34)
    - zadnji krug (8 igara): crveni tim s novim junacima 3 pobjede, 2 poraza, 3 igre bez pobjednika nakon 30 min • 🦂 Škorpo 79/52 • 🐆 Inja 51/62 • 🦛 Pecko 31/53 uz 13–27 asistencija po igri (tenk koji udicom dovlači mete suigračima)

- 🎨 **Portreti i ikone moći iz GPT Image 2.5** (v0.55) — svih 27 junaka dobilo je novi naslikani portret (1024 px, kvaliteta *medium*) i list od 6 ikona (urođena pasiva, Q, W, E, R i talenti; mreža 3 × 2, 1152 × 768) — ukupno 27 portreta i 162 ikone, generirano preko Fish Audio (`gpt-image-2.5-sunburst`):
  - promptovi su u [`tools/art/prompts.json`](tools/art/prompts.json) (pravi ih [`tools/art/prompts.py`](tools/art/prompts.py) iz engleskih naziva i opisa moći iz `data.js` i opisa izgleda svakog junaka — isti kostimi kao na 3D modelu), a linkovi gotovih slika u [`tools/art/urls.json`](tools/art/urls.json)
  - `python3 tools/art/dl.py` preuzme slike, smanji portrete u `assets/hero_<junak>.jpg` (512 px), na svakom listu pronađe granice pločica (najjači rub oko svake trećine/polovice — GPT ponekad pomakne crtu ili nacrta tanki razmak), izreže 6 kvadratnih ikona u `assets/ab/<junak>_<P|Q|W|E|R|T>.jpg` (128 px) i upiše junake u `SPELL_ICONS` u `data.js`
  - igra tada crta naslikane ikone na gumbima moći (s tamnim prijelazom dolje da se vide točkice ranga), u znački urođene pasive, na ekranu junaka (i pločica 🎓 talenata) i u opisima moći; dok ikone nisu preuzete, crta emoji kao prije
  - ✅ slike su u igri: svih 27 portreta (`assets/hero_<junak>.jpg`) i 162 ikone (`assets/ab/`) — `SPELL_ICONS` sadrži svih 27 junaka. Na 7 listova (gavran, nisan, orlina, pcela, sova, tragac, zarko) pločice nemaju vidljiv razmak pa je traženje ruba pomaknulo crtu reza; `dl.py` zato zanemari pronađeni rub koji je više od 1 % od točne trećine/polovice i reže po pravilnoj mreži (orlina s `--inset` 0,05), pa ponovno pokretanje daje iste, čiste ikone

- 💰 **Sporije zlato i predmeti, manje „snowballa”** (v0.54) — u normalnoj igri zlato je stizalo prebrzo. Veliki predmeti ovdje koštaju otprilike pola cijene iz DotA 2 (Amulet skoka 1125, Kraljevski oklop 2000), a vojnici su davali puno DotA zlato, ubojstvo junaka i više od DotA (200 + 12 po levelu žrtve), a runa zlata 40 + 3 po minuti svakom junaku u timu — predmeti su se skupljali otprilike dvostruko brže nego u Doti. Tko bi rano pobijedio par puta, brzo bi pobjegao svima ostalima: najbogatiji junak zarađivao je dvostruko više od ostalih, od ubojstava čak 3,6× više.
  - **manje zlata** (samo normalna igra): vojnici i čudovišta ×0,68 (vojnik izbliza 26 umjesto 38), pasivno 0,75 u sekundi (bilo 0,9), ubojstvo junaka 90 + 5 po levelu žrtve (bilo 200 + 12), asistencija 45 (bilo 50), kula 80 svakom junaku tima (bilo 120), vojarna 100 (bilo 150), runa zlata 25 + 1,5 po minuti (bilo 40 + 3), Veliki Zmaj 150 (bilo 200); prekid niza ubojstava vrijedi više — 80 po ubojstvu u nizu (bilo 60)
  - 🎯 **bogata meta** (novo, kao ucjena u LoL-u): junak čija je neto vrijednost više od 1200 iznad prosjeka svih junaka nosi nagradu — 15 % viška (najviše 500), a iznos se vidi pored njegove trake života (🎯500, i gostu u igri s prijateljem). Kad ga sruše, pola dobiva ubojica, a drugu polovicu dijele suigrači koji su pomogli
  - 🔄 **bonus za povratak** (tim koji zaostaje dobiva više za ubojstvo) sada se dijeli jednako ubojici i pomagačima — prije ga je dobivao samo ubojica, pa je najbogatiji junak tima koji zaostaje postajao još bogatiji; kreće već kad tim zaostaje 1750 (bilo 2500)
  - 🏰 **igra ne zapne pred bazom**: ujednačeniji timovi znače i ujednačenije igre, pa od 25. do 40. minute junaci sve jače udaraju građevine (do ×1,6). Prije je otprilike svaka dvanaesta igra stajala i nakon 45 minuta, a u probi bez ovoga igre su postale dulje (prosječno 29 min, četiri od 12 dulje od 35 min)
  - ⚡ brza igra zadržava svoje brzo zlato (zapisano je zasebno, u `TURBO_GOLD` u `game.js`); bogata meta i dijeljenje bonusa vrijede i u njoj, a traje i dalje oko 15–18 minuta
  - 🧪 simulacija — novi alat [`tools/sim/econ.js`](tools/sim/econ.js) za svaki zlatnik zapiše izvor (botovi vode oba tima; 12 igara prije i 12 poslije, uz 4 isprobane međuvarijante):
    - zlato po junaku u minuti: 268 → 186 (prvih 10 min), 495 → 305 (10.–20.), 633 → 433 (nakon 20.) — ukupno 445 → 298 (−33 %); od ubojstava 92 → 38
    - prvi predmet od 1000+ zlata (npr. Zlatna rukavica, Amulet skoka): medijan u 11. → 15. minuti; od 2000+ (Kraljevski oklop, Oštrica pogotka…): 15. → 20. minuta (u 15. minuti imala ga je polovica junaka, sada 15 %)
    - najbogatiji junak prema ostalima: 1,99× → 1,59× zlata u minuti (od ubojstava 3,6× → 2,8×); u 15. minuti 1,63× → 1,37× prosječne neto vrijednosti
    - igra traje prosječno 27,5 min (prije 26), najdulja 36 min (prije 45 bez pobjednika); natpis na ekranu junaka sada kaže „~25–30 min”

- ✏️ **Ljepši junaci izbliza** (v0.53) — krug poliranja 3D modela junaka:
  - **obris kao u crtanom filmu**: svaki junak u igri i u 3D pregledu na ekranu odabira ima tanak tamni rub, pa se jasnije odvaja od trave, drveća i čarolija. Three.js za svaki dio modela (glava, tijelo, ruke…) spoji njegove komade u jednu geometriju i iscrta je još jednom, samo stražnje plohe pomaknute duž normala u prostoru zaslona — debljina je u pikselima (1,6 px × gustoća zaslona), pa je rub jednak izbliza i izdaleka i prati animacije. Svjetleći dijelovi nemaju obris, nevidljiv junak nema ni obris (ne odaje se), a na niskoj kvaliteti grafike obris se gasi
  - 👀 **izražajnija lica**: oči imaju svjetliji polumjesec pri dnu šarenice (svjetlucaju kao na naslikanim portretima), obrve su zaobljeni lukovi koji prianjaju uz čelo i stanjuju se prema van (prije ravne kockice), a oko i bjeloočnica uvijek malo vire iz glave (🐙 Pipko je imao utonule oči, a 🦉 Mudri je bjeloočnica bila zakopana u glavi). Blaži pogled imaju 🐢 Listko, 🐝 Zuja, 🐵 Skakač, 🌙 Luna i 🦄 Duga, a odlučniji 🐂 Bikoš, 🦏 Rogo i 🦅 Orlina
  - 🦉 **Mudra** ima pravi srcoliki disk lica s tamnijim rubom (prije je disk bio zakopan u glavi pa se vidjela samo mrlja s jedne strane), a 🐵 **Skakač** svijetlu masku oko očiju — više ne izgleda kao medo. Nova pomoćna funkcija `face_cap` stavlja takve mrlje uz zakrivljenu glavu: spljošteni elipsoid iz kojeg viri samo vrh, pa se rub glatko utapa u glavu
  - 🪶 **krila od pravih pera**: 🦉 Mudra, 🐦‍⬛ Mrak i 🦅 Orlina imaju krila od sedam preklopljenih letnih pera s tamnijim vrhovima i pet svjetlijih pokrovnih pera (prije ravna ploha s prugama koja je izgledala kao karton); pera su okrenuta napola prema naprijed, a napola u stranu, pa je krilo puno i na portretu i odozgo u igri • 🐝 **Zuja** ima zaobljena prozirno-plava krilca sa žilicama (prije šišmišja krila) • 🐉 **Žarko** ima zmajevu opnu s lukovima između prstiju i kandžicu na pregibu krila
  - 🖼️ **novi portreti**: 14 portreta napravljenih iz 3D modela sada je u kadru **glava i ramena** (kao naslikani portreti ostalih junaka) umjesto cijelog tijela, lice u 3/4 profilu, s rubnim svjetlom iza junaka, mekanom pozadinom u boji junaka koja svijetli iza glave i bez šuma (Cycles + OpenImageDenoise) — lice se sada vidi i u malom krugu na minimapi, u HUD-u i na tablici rezultata
  - model je nakon Draco sažimanja 6,1 MB (prije 5,8 MB)

- 👕 **Junaci u svojoj odjeći** (v0.52) — prije su svi nosili istu suknju i šal, kapuljaču ili plašt u boji tima, a gornji dio tijela bio je golo krzno, pa su plavi junaci izgledali kao „plava uniforma”. Sada svaki ima svoj kostim u svojim bojama, kao na portretu:
  - novi dijelovi odjeće u Blender skripti: **prsluk, kaput sa skutima i duga halja** (s podstavom, otvorom sprijeda, zlatnim ili kožnim obrubom, gumbima i ovratnikom), **rukavi** (uski ili široki čarobnjački), **čarobnjački šešir** sa svinutim vrhom, a šal, plašt, kapuljača, traka oko glave i tobolac mogu biti u boji junaka
  - portreti kao uzor: ❄️ Ledena — plavi čarobnjački šešir s pahuljicama i svijetloplavi kaput s krznenim ovratnikom • 🦊 Strijela — zelena kapuljača (uši proviruju), zeleni prsluk i kožni tobolac • 🐉 Žarko — ljubičasti prsluk sa zlatnim obrubom i visokim ovratnikom • 🐯 Munja — tamni oklop sa svjetlećom munjom • 🦅 Orlina — crveni pilotski šal i kožni prsluk • 🌙 Luna — ljubičasti plašt sa zvjezdicama • 🦝 Tragač — crna kapuljača • 🦁 Lavko — crveni kraljevski plašt • 🐸 Skokica — kožni naramenjaci
  - i ostali: 🦉 Mudra i 🐦‍⬛ Mrak — duge halje (plava i ljubičasta) • 🦈 Zubo — crveni gusarski kaput sa zlatnim gumbima • 🐒 Skakač — zlatni obruč i crveni prsluk • 🐘 Tutnjo — tirkizni kraljevski prsluk sa zlatnim ovratnikom • 🐼 Bambus — zeleni kung-fu prsluk • 🐙 Pipko — mornarski prsluk • 🐿️ Nišan — zeleni lovački prsluk • 🦔 Bodljo i 🐺 Sivko — kožni prsluci • 🦄 Duga — ružičasti plašt sa zvjezdicama
  - **boja tima ostaje** na suknji s pregačom, dragulju na pojasu i krugu ispod junaka (u igri) — crveni i plavi se i dalje lako razlikuju
  - 14 portreta napravljenih iz 3D modela ponovo je renderirano s novom odjećom; model je nakon Draco sažimanja 5,8 MB (prije 5,6 MB)

- 🧠 **Botovi procjenjuju kad u gank, u džunglu, po runu i u pomoć** (v0.51) — faza na stazama ostaje, ali botovi više ne rade „po satu”, nego kad se isplati:
  - 🗡️ **gank**: prije je prvi gank svakog tima kretao skoro uvijek točno u 4:00 (čim se „otvorilo”), na bilo koga tko je bio sam. Sada bot traži **ranjivu metu** — ima malo života, nema nikoga uz sebe ili je otišla predaleko od svoje kule — a idu oni kojima se **isplati otići**: na svojoj stazi trenutno nemaju posla (ili su na stazi u dvoje pa farmu drži suigrač), imaju runu ili spreman ulti, i **ne ostavljaju suigrača samog protiv dvojice**. Kreću samo kad su jasno jači i kad metu zajedno mogu srušiti (procjena udaraca i spremnih moći); u fazi na stazama najviše dvojica i uz strožu procjenu. Izdaleka prilaze malo iza mete (prema njenoj kuli) da joj presijeku bijeg. Poruka kaže i zašto: „🗡️ 🐉 Žarko i 🦉 Mudra idu u gank na 🐯 Munja — ima malo života, nema nikoga uz sebe!”
  - 🌲 **džungla**: kad na stazi nema posla (oba vala su mrtva ili je naš val stigao pod neprijateljsku kulu) ili su na stazi jači, bot ode do kampa na svojoj strani koji **sam može očistiti** — procijeni koliko će trajati i koliko će ga boljeti — pa se vrati po sljedeći val (ako val stigne prije nego što počne, vrati se odmah). Kamp odmah uz sebe uzme usput, kad u blizini nema vojnika, a čudovištu koje ga već napada uzvrati samo ako taj kamp može pobijediti; moći po području troši i na kamp. Prije je bot napadao svaki kamp pored kojeg je prošao (i Velikog Zmaja sam, od levela 8)
  - 🤝 **pomoć**: suigrač (i ti!) se bori s jačima — dolazi bot koji **stigne na vrijeme** (pješice ~10 s, a poslije faze na stazama i teleportom do kule uz borbu) i kojemu se isplati otići, i samo ako će zajedno biti jači
  - ✨ **čarobna runa**: bot kojemu je najbliža (obično onaj sa sredine) ode po nju kad je sigurno; s runom brzine ili dvostruke štete odmah traži gank
  - 🐲 **Veliki Zmaj**: kad barem trojica botova (level 9+) u blizini mogu zajedno brzo srušiti zmaja (procjena: manje od ~16 s i manje od 40 % zajedničkog života), a protivnici ga ne mogu oteti (onih blizu ili u magli ima manje); i dalje i kad protivnici leže mrtvi
  - 🛡️ **obrana**: u fazi na stazama prvu kulu (dok ima više od pola života) brane junaci te staze — botovi s drugih staza dolaze samo kad je napadaju i junaci, a njima se isplati, i nitko se ne teleportira. Val vojnika bez junaka na kuli brani jedan bot, a ostali nastavljaju guranje ili gank (prije je takav val zaustavljao planove cijelog tima). Bot koji gura stazu ili brani kulu ne odlazi usput u džunglu ni po runu
  - 🧪 simulacija (botovi vode oba tima; v0.50: 24–36 igara, v0.51: 24 igre):
    - prvi gank svakog tima: prije uvijek tek od 4:00 (skoro trećina timova točno u 4:00–4:02); sada 1:46–12:23, kad se ukaže prilika (medijan ~4:30)
    - 5.–10. minuta: gankova ~4–5 po igri (prije ~10); ubojstvom ih završi ~23 % (prije 12–25 %), a gankeri poginu upola rjeđe (5 % gankova, prije ~11 %)
    - u prvih 5 minuta junaci su 68 % vremena na svojoj stazi (prije 62 %); džungla se farma nešto manje nego prije (0,6–0,8 prema 0,7–0,9 čudovišta po junaku u minuti od 5. do 20. minute), ali samo kad se isplati — i nijedan bot nije poginuo dok je čistio kamp
    - Veliki Zmaj pada ~1,7 puta po igri, prvi put oko 15.–16. minute (prije 1,4 puta, oko 16. minute)
    - normalna igra traje ~25 min (prije ~27), brza ~10–11 min (medijan, kao i prije)

- 🛣️ **Biraš stazu kao ulogu u LoL-u** (v0.50) — za pravu fazu na stazama u normalnoj igri:
  - na ekranu junaka novi red **🛣️ Staza: ⬆️ Gore / ↗️ Sredina / ➡️ Dolje** (izbor se pamti); prije si uvijek igrao sredinu
  - raspored ostaje kao u Doti (1 sredina, 2 gore, 2 dolje): tvoja staza ide prva, a botovi suigrači popune ostatak — na sredini si sam (1 na 1), gore i dolje ideš s botom suigračem (2 na 2); protivnici na svakoj stazi imaju isto toliko junaka
  - na početku i kad zasvira rog (0:00) poruka „🛣️ Tvoja staza: GORE — s tobom je 🐉 Žarko (2 na 2)” i oznaka na tvojoj prvoj kuli te staze (vidi se i na minimapi)
  - **faza na stazama**: prvih 10 minuta (sat igre) botovi ne mijenjaju staze — prije je zapovjednik tima mogao prebaciti bota na drugu stazu već nakon 45 sekundi; gankovi i dalje kreću od 4. minute (od v0.51 kad botovi procijene da se isplati)
  - 👥 i u igri s prijateljem svaki igrač bira svoju stazu (gost je pošalje domaćinu kad stisne SPREMAN)
  - provjereno simulacijom za sve tri staze: ispravan raspored oba tima, poruka i oznaka, a prva promjena staze tek nakon 10. minute

- 🪖🤖 **Izdržljiviji vojnici i pametniji botovi** (v0.49):
  - 🪖 **vojnici su kao u DotA 2**: izbliza 550 života i 2 oklopa (prije 330), daljinski 300 (prije 230), opsadni 935 (prije 850) — na početku prosječni junak treba ~8–9 udaraca za vojnika izbliza (prije ~5; u Doti ~10), pa valovi dulje žive, a borba na stazi traje
  - 📈 **rastu kroz cijelu igru**, glatko po satu igre: +4 % života i +3 % štete svake minute (10. min ×1,4 / ×1,3, 20. min ×1,8 / ×1,6, 30. min ×2,2 / ×1,9; u brzoj igri brže). Prije su rasli +8 života po valu i skokom svakih 7,5 min, a šteta im je do 30. minute narasla ~4×. Najava „💪 Vojnici su ojačali!” (svakih 7,5 min) sada piše koliko točno
  - simulacija: za vojnika izbliza junak treba 8,6 udaraca na početku (prije 4,8), 5,2 u 10. min (prije 3,4) i 4,6 u 20. min (prije 3,7)
  - 🤖 **botovi se ne zalijeću jedan po jedan na jakog junaka**: procjena borbe zbraja snagu (level + vrijednost predmeta, puta preostali život) naših junaka uz bota i protivničkih uz metu. Bot napada samo kad je njegova strana barem jednako jaka (prije i kad je bila slabija — na „Normalno” već na 80 %, na „Teško” na 65 %), a ranjenu metu dokrajčuje samo ako pada od nekoliko udaraca i nismo puno slabiji
  - kad je slabiji, bot se povuče do najbližeg suigrača ili iza svoje kule i 4 s pamti jakog junaka (ne vraća se sam pred njega i ne farma uz njega)
  - 🗡️ gank: ide onoliko botova (najviše 3) koliko treba da budu jasno jači od mete i onih uz nju, a prvi koji stigne pričeka suigrače (najviše 6 s) umjesto da uskoči sam
  - 🛡️ obrana kule: dolazi dovoljno branitelja po snazi (ne samo po broju), a uz jakog protivnika čekaju jedni druge; guranje staze i Veliki Zmaj se prekidaju kad protivnik stigne
  - skokovi i juriši (npr. Junački skok, Bikovski skok), Zamjena i Treptaj samo kad se bot odlučio boriti
  - test s „nahranjenim” junakom (od 2:30 puno jači, 9 igara po 12 min): botovi koji poginu sami — 3,6 po igri (prije 9,1), a jaki junak ih pobijedi ~4 puta po igri (prije ~9)
  - igra i dalje traje ~23 min (8 igara), brza ~15 min (8 igara)

- ⭐ **Sporiji leveli kao u DotA 2** (v0.48):
  - prije je svaki level tražio samo 60 iskustva više od prethodnog (115, 175, 235 … 1495; do levela 25 ukupno 19 320), pa je u simulaciji najbolji junak bio **level 25 već u 20. minuti**, a prosječni junak level 17,5
  - sada je tablica kao u Doti 2: **level 2 dolazi brzo** (140 iskustva — tri vojnika), a onda svaki level traži sve više: 400, 520, 600, 680, 760, 800, 900, 1000 … 2000 za level 20 i 2200–3000 za levele 21–25 (ukupno 34 300). Dota traži 240 za level 2 i 34 400 do levela 25 — prvi level je kod nas jeftiniji da dođe odmah
  - zanimljivo: junaci kroz igru skupe skoro isto iskustva kao u Doti (npr. ~3600 u 10. minuti — za Dotin level 7–8), pa je Dotina tablica pogodila i naš tempo
  - simulacija (8 igara, botovi vode oba tima): prosječni junak je u 10. minuti **level ~7** (prije 10,7), u 20. minuti **~12** (prije 17,5), u 30. minuti ~16; najbolji junak je u 20. minuti level ~18 (prije 25). Ulti (level 6) stiže oko 8. minute, a talenti na 20 i 25 tek u dugim igrama
  - igra i dalje traje ~23 minute (8 igara)
  - u brzoj igri (dvostruko iskustvo od vojnika) leveli i dalje rastu brže: u 10. minuti prosječno level ~13, a najbolji junak dođe do 25 oko 20. minute; brza igra traje prosječno ~16 min (12 igara, 9–28 min)
  - postignuće 🎓 Legenda (level 25) sada je stvarno teško — treba duga ili brza igra

- 🌙🗺️ **Ljepša grafika, magla rata, jača čudovišta i veća mapa** (v0.47):
  - 🌙 **noć je mjesečina** — prije je noću sunce padalo na 15 %, nebo na četvrtinu, a magla rata se miješala s gotovo crnom bojom, pa je slika bila skoro crna; sada plavkasto svjetlo mjeseca (~55 % dana), svjetlije nebo, malo jača ekspozicija, blijeđe boje i plave sjene — sve se vidi, a vatre i lampe ostaju tople
  - 🏮 **noćna svjetla**: novi Blender model **fenjera** uz sve tri staze (svakih ~600, lampa visi na kraku iznad puta), plamen baklji i logorskih vatri, lampe i kristali svijetle sami (ne ovise o suncu), a noću bacaju toplu svjetlost na tlo — fontana i svetišta u boji tima; u magli rata ta se svjetla ugase. Sav sjaj je jedan `Points` objekt, a svjetla na tlu jedan instancirani mesh (2 draw calla za sve)
  - 🍄 **svjetleće gljive** (novi Blender modeli) uz stabla u džungli — plave kod Sentinela, ljubičaste kod Scourgea; noću svjetlucaju
  - 🌫️ **nova magla rata** — umjesto miješanja s gotovo crnom bojom boje se ugase u sivo-plavo i potamne (kao u Doti), teren se i dalje raspoznaje, a preko magle polako plove pramenovi; noću je magla tamnija i plavlja. Mreža vida raste s mapom (154 × 154 polja, ~43 jedinice po polju kao prije)
  - ☀️ **dan**: trava manje „neonska” (malo manje zasićena, s velikim sunčanim livadama i tamnijim udolinama), krošnje se na suncu manje „isperu”, sjaj (bloom) samo na vatri, magiji i kristalima (prije i na travi i vodi), toplo sunce na svijetlim plohama; izmaglica nad rijekom noću više nije bijela mrlja, a pjena na vodi ne bliješti; kristal kule noću svijetli malo jače
  - 🐲 **čudovišta i zmajevi jačaju s vremenom** (po satu igre — u brzoj igri brže): svake 2 minute +1 level — +18 % života, +12 % štete, +4 % zlata i +6 % iskustva; Veliki Zmaj i zmajčići +24 % života i +16 % štete. Level piše uz traku života, a svakih 6 minuta stiže poruka. Prije su čudovišta cijelu igru imala iste brojeve, a junaci u 20. minuti imaju ~7× veću štetu (simulacija) — sad npr. vepar ima 340 → 952 života u 20. min, Veliki Zmaj 2600 → ~7000 u 15. min
  - 🗼 **kampovi su daleko od kula** — novi raspored (svi kampovi najmanje ~630 izvan dometa kule; prije je Plavi golem bio samo 41 od dometa), a čudovišta se okrenu i vrate čim bi ušla u domet bilo koje kule ili kad im meta pobjegne pod kulu: kamp se više ne može navući pod kulu (u simulaciji 0 od 546 879 provjera). Uz svaku bočnu stazu jedan se kamp i dalje može povući do vojnika
  - 🗺️ **mapa je 20 % veća** (mjerilo 2,22 umjesto 1,85 — 6660 × 6660): staze, baze, kule, rune i kampovi skaliraju se zajedno, a mreža visina i vida raste s mapom. U simulaciji igra traje ~24 min (7 igara), junaci su prosječno ~1925 od najbližeg protivnika (prije ~1606) i u borbi su 18 % vremena (prije 22 %) — više se koristi prostor
  - 🧸 svi modeli ponovno su izvezeni iz **Blendera 5.2** (bpy) iz iste skripte (provjereno: istih 135 modela i 402 animacije) + 3 nova modela (`lantern0`, `mushglow0`, `mushglow1`; `--dev-v47` brzo prikaže samo njih)
  - 🌐 gost u mrežnoj igri vidi level čudovišta; sitni popravak: zastavica čuvarske kule u snimci se više ne gubi dok radi zaštita od backdoora

- 🐗🐢 **Džungla kao u Doti, sporiji junaci i kasniji gankovi** (v0.46) — da igra ne ide „brzo, brzo” i da se više koristi prostor mape:
  - 🐗 **čudovišta su mirna dok ih ne udariš** (kao u DotA 2) — prije su napadala svakoga tko prođe kraj kampa (i vojnike i junake); sad cijeli kamp napadne tek onoga tko udari jednoga od njih
  - 🧲 **povlačenje kampa (pull)**: udari kamp i odvedi ga do vojnika na stazi — vojnici (tvoji i protivnički) napadaju razljućena čudovišta, a čudovišta se okreću na onoga tko ih udara; dovedeš li ih pod kulu, **kula puca na njih**. Čudovišta ganjaju do 800 od kampa, a kad 5 s nitko nikoga ne udari (pobjegao si im), odustanu, vrate se i brzo se izliječe. Veliki Zmaj i zmajčić ne izlaze iz svojih jazbina (na njih vojnici i kule ne pucaju)
  - 🐻 **6 novih kampova** — sada 8 po strani (uz Velikog Zmaja i zmajčića): uz svaku bočnu stazu jedan kamp za povlačenje (🐗 vepri uz gornju stazu plavih, 🐺 vukovi uz donju; crveni zrcalno) i 🐻 **medvjedi**, novi veliki kamp u dubini džungle (2 medvjeda, 920 života, 92 zlata svaki) s Blender modelom i portretom
  - 🐢 **junaci su 22% sporiji** (zajedno s čizmama, okretnošću i bonusima) — kao u DotA 2, gdje je junak otprilike brz kao vojnik (prije je bio ~29% brži od vojnika, sad jednako brz); preko cijele mape sad treba ~36–42 s umjesto ~28–33 s (u Doti ~50 s), pa gank s druge strane mape traje, a ima vremena za povlačenje kampa i povratak
  - 💨 **vjetar doma** (+40% od fontane) puše samo na početku igre — poslije oživljavanja i povratka kući više ne; 💨 Putnik (+15% izvan borbe) ostaje
  - 🗡️ **botovi idu u timski gank tek od 4. minute** (u brzoj igri po bržem satu) i tek s levelom 4 — prije su kretali već oko 1.–2. minute s levelom 3
  - 🧪 simulacija (`tools/sim/sim.js`, 12 igara prije i 12 poslije, botovi vode oba tima): igra i dalje traje ~22 min (prije ~23), junaci su prosječno dalje od najbližeg protivnika (1606 umjesto 1556), u borbi su rjeđe (22% vremena umjesto 24%), ubojstava je ~13% manje u minuti, a prvi gank je prosječno u **4:27** (prije 2:13, najranije 1:16); `AI` statistika u simulaciji sada piše i kada je bio prvi gank (`g1`)
  - ⚡ brza igra je zbog sporijih junaka malo dulja: prosječno ~15 min (14 igara; prije ~13 min u istom testu) — natpis na ekranu junaka sada kaže „~15 min”. Probali smo je skratiti slabijim kulama (50% umjesto 60% života), ali to nije ništa promijenilo (14,8 min u 12 igara), pa je ostalo kako je bilo
  - ⚡ brže traženje meta (prvo jeftina provjera vrste, pa magla rata) — logika igre je i s 14 novih čudovišta malo brža nego prije (1,41 umjesto 1,44 ms po koraku)

- ⚡🎁🎶 **Brza igra, nagrade, glazba i ravnoteža** (v0.45):
  - ⚡ **brza igra** (ekran junaka: ⏱️ Igra: 🏰 Normalna / ⚡ Brza) — kao Turbo u DotA: ×1.8 zlata i iskustva od vojnika, dvostruko pasivno zlato, više zlata za junake i kule, brže oživljavanje, kule s 80% života, priprema 15 s, vojnici jačaju češće; igra traje oko 12 minuta (samo protiv botova)
  - 🎁 **nagrade za postignuća** — na ploči 🏆 Postignuća biraš izgled svog junaka:
    - ✨ **trag dok hodaš**: ⭐ zvjezdice, 💖 srca (prva pobjeda), 🎵 note (timski igrač), 🪙 zlatnici (zlatar), 🔥 plamen (u vatri), ❄️ pahulje (neuništiv), 🌈 duga (svestran)
    - 🎩 **iznad glave**: 🐥 pile (3 igre), 🎩 cilindar (lovac), 🦋 leptir (proždrljivac), 🐲 zmajić (zmajoubojica), 👑 kruna (najbolji igrač), 🌟 zvijezda (legenda), 🏆 pehar (prvak) — ljubimci lete u krug oko junaka
    - novo postignuće na kraju igre javlja i 🎁 novu nagradu
  - 🎶 **glazba** stvorena u pregledniku (bez datoteka): mirna melodija na izborniku, živahnija u bitci, bubanj svira kad si u borbi; isključuje se u ⚙️ postavkama
  - 📊 **statistika s junakom** na ekranu odabira: broj igara i pobjeda, prosječni K/D/A i rekord
  - ⚖️ **ravnoteža junaka** — 9 krugova po 40–100 simuliranih igara 5 na 5 (oko 850 igara) (botovi vode oba tima; `tools/sim/sim.js --json`, procjena snage junaka iz sastava timova):
    - na početku su daljinski nosači s okretnošću pobjeđivali ~69% igara (Nišan 81%), a čarobnjaci s inteligencijom ~41%
    - 🧠 **inteligencija jača moći** (+0.25% štete moći po bodu) • 🤸 okretnost daje manje brzine napada (0.4% po bodu), kretanja (0.22 po bodu) i oklopa (1 po 12 bodova) • 💪 snaga daje 21 život po bodu • ⚔️ **junaci izbliza primaju 8% manje štete**
    - slabiji ulti Nišana, Strijele, Orline i Gavrana, slabiji Skakač; jači Skokica, Bambus, Sivko, Pipko, Pčela, Žarko, Mudra (i noć koja timu daje jače udarce), Rogo, Duga, Munja, Listko, Ledena, Lavko
    - Sivko: jača pasiva Čopor (+12% brzine napada po rangu, 2 + 2 života/s) i botovi mu kupuju Sjekiru oluje — prije je u svakom krugu pobjeđivao ~33% jer je zaostajao u zlatu
    - Sivko je zaostajao jer mu botovi nisu kupovali predmet za farmu — sa Sjekirom oluje više nije najslabiji
    - nakon zadnjeg kruga (100 igara) grupe junaka po atributu pobjeđuju 46–54% igara, blizina 48% / daljina 52% (na početku 41–69%); razlike među pojedinim junacima (35–65%) sad su otprilike veličine šuma simulacije
    - botovi: Bikoš sad koristi ulti i na ranjenom junaku, Mudra baca noć i u timskoj borbi
    - ⚡ u brzoj igri i odluke botova (kada guraju, Veliki Zmaj) i jačina kula idu po bržem satu — igra traje ~12 min (prije ~17)
  - 🐛 postavke „zadaci za početnike” (i nove: glazba, brza igra) sada se pamte i nakon ponovnog učitavanja

- 🎯 **Zadaci, graf i jezik u mrežnoj igri** (v0.44):
  - 🎯 **zadaci za početnike** — kartica iznad minimape vodi kroz igru korak po korak: kupi predmet → nauči moć → 5 zadnjih udaraca → baci moć 3 puta → pobijedi junaka (ili pomozi) → otključaj ulti → budi blizu kad tim sruši kulu; svaki riješen zadatak daje 40–150 🪙 uz zvuk i zlatnike (samo protiv botova; isključuje se u ⚙️ postavkama)
  - 📈 **„Tko je vodio”** na završnom ekranu — graf razlike u zlatu (plavo gore, crveno dolje) i iskustvu kroz cijelu igru, s oznakama srušenih kula 🗼, vojarni 🏚️ i Velikog Zmaja 🐲
  - 🌐 **u igri s prijateljem svatko vidi poruke na svom jeziku** — domaćin šalje par (hrvatski, engleski), a gost ga prikaže na svom jeziku (i srpski / ćirilica)
  - 📱 manje preklapanja: savjet ne zaklanja gumb za otkup na mobitelu, kartica zadatka i savjet se skrivaju dok je otvorena tablica ili brze poruke, natpis „Ne brini!” bez dvostrukog odbrojavanja, gumb „Kreni odmah” širi se prema tekstu

- 🌍 **Četiri jezika i novi početni ekran** (v0.43):
  - 🇭🇷🇧🇦 **hrvatski / bosanski**, 🇷🇸 **srpski latinica**, 🇷🇸 **српски ћирилица** i 🇬🇧 **engleski** — cijela igra: junaci, moći, predmeti, dućan, savjeti, poruke, pomoć i postavke
  - srpski nastaje iz hrvatskog teksta: rječnik ijekavica → ekavica (pobjeda → pobeda, strijela → strela) i srpske riječi (dućan → prodavnica, tko → ko, postavke → podešavanja); ćirilica se dobiva iz latinice (tipke Q W E R i kratice HP, OK ostaju latinicom)
  - pri prvom pokretanju igra pita **„🌍 Jezik · Језик · Language”**; kasnije se jezik mijenja gumbom gore desno na početnom ekranu ili u ⚙️ postavkama (🌍 Jezik); izbor se pamti
  - link s `?lang=hr`, `?lang=sr`, `?lang=cy` (ćirilica) ili `?lang=en` odmah otvara igru na tom jeziku
  - 🎬 **novi početni ekran**: veliki logo, ▶️ ZAIGRAJ, gumbi 👥 S prijateljem / ❓ Kako se igra / 🏆 Postignuća / ⚙️ Postavke, traka sa svim junacima (klik na junaka = odmah ga odabereš), kratki profil (pobjede, igre, postignuća) i kartice što sve igra ima; radi i na mobitelu
  - 🏠 gumb gore lijevo na ekranu odabira vraća na početni ekran; „Igraj ponovo” ide ravno na odabir junaka

- 🏆 **Postignuća i profil** (v0.42) — igra pamti (u pregledniku) tvoje igre i pobjede:
  - 🎖️ **15 postignuća**: 🎉 Prva pobjeda, 🩸 Prva krv, ⚔️ Lovac (10 pobjeda nad junacima u igri), 🪙 Zlatar (100 zadnjih udaraca), 🔥 U vatri (5 zaredom bez pada), 🛡️ Neuništiv (pobjeda bez ijednog pada), 🤝 Timski igrač (15 asistencija), 🏰 Rušitelj (zadnji udarac na 3 kule), 🐲 Zmajoubojica, 🌿 Proždrljivac (4 drveta tangom), 👑 Najbolji, 🎓 Legenda (level 25), 🦸 Junak (pobjeda na „Teško”), 🌈 Svestran (pobjede s 5 junaka) i 🏆 Prvak (10 pobjeda)
  - na kraju igre nova postignuća iskoče odmah ispod „POBJEDA!” (uz zvono), a ispod tablice piše tvoj profil (pobjede, igre, postignuća)
  - 🏆 gumb **Postignuća** na ekranu odabira: sva postignuća (otključana i 🔒 zaključana s opisom što treba napraviti), broj igara i pobjeda i junaci s kojima najčešće pobjeđuješ
  - 🏆 na kartici junaka piše koliko si puta pobijedio s njim

- 🔊 **Novi zvuk** (v0.41):
  - 🎚️ svi zvučni efekti idu kroz zajednički „mikser” (kompresor + malo jeke): kad je puno toga odjednom, zvuk više ne pucketa i ne preglasi se, a bojište zvuči kao prostor
  - 🎧 **prostorni zvuk**: udarci, strijele, moći i rušenja u svijetu čuju se tiše što su dalje od sredine ekrana i s lijeve ili desne strane — po zvuku znaš gdje se nešto događa
  - 💥 bogatiji efekti umjesto „bip” tonova: tup udarac mača, fijuk strijele, svjetlucanje magije, gromki ulti, prasak eksplozije, rušenje kule, kritični rez, zvona za level i zlato, fijuk skoka
  - 🪙 **zvuk zlatnika** kad dobiješ zlato za vojnika i kad zlatnici polete do tebe nakon pobjede nad junakom
  - 🤫 tuče vojnika su puno tiše od udaraca junaka (prije je stalno lupalo)
  - 🌲 **zvukovi prirode** (⚙️ postavka, uključeno): blagi vjetar, danju ptice, noću cvrčci, a kad je kamera kraj rijeke — žubor vode

- 🏅 **Za početnike i za zabavu** (v0.40):
  - 🪙 **pomoć za zadnji udarac**: iznad neprijateljskog vojnika kojeg tvoj SLJEDEĆI udarac pobjeđuje pojavi se zlatnik (i zlatni okvir trake života) — udari ga baš tada i dobiješ zlato; tvoj vojnik kojeg možeš uskratiti dobije ❗. Djeca tako lako nauče farmati (isključuje se u ⚙️ postavkama)
  - 💡 **savjeti za početnike** — kratka poruka iznad ploče junaka u pravom trenutku: malo života („teleport kući”), imaš zlata za sljedeći predmet, pojedi drvo tangom, otključaj ulti na levelu 6, kula gađa tebe, kupuj dok čekaš oživljavanje, teleport do kule… Svaki savjet najviše 2 puta (pamti se), jedan po jedan; isključuju se u ⚙️ postavkama, a ponovno uključivanje vrati sve savjete
  - ⬆️ **vještine se mogu učiti same** (⚙️ postavka, isključena): poen koji ne potrošiš za 2–3 s potroši se sam — prvo ulti, pa ravnomjerno
  - 🏅 **medalje na kraju igre**: 🥇 Lovac (najviše pobjeda), 🤝 Pomagač (asistencije), 🪙 Zlatar (zadnji udarci), 💥 Razbijač (šteta junacima), 🏰 Rušitelj (šteta kulama), 🛡️ Neuništiv (najmanje padova) — prikazuju se uz imena, a ispod tablice piše koje si ti osvojio
  - 🗺️ **minimapa s portretima**: junaci su okrugli portreti u boji tima (ti u zlatnom prstenu), iznad magle — odmah vidiš tko je gdje
  - 🔥 **junak „u vatri”**: tko pobijedi 3+ junaka zaredom, dobije plamičke nad glavom i 🔥 uz ime — zaustavi ga i dobiješ puno zlata
  - 🟢🟡🔴 **težina junaka** na ekranu odabira (zelena točkica = lako za početnike: Lavko, Žarko, Strijela, Listko, Tutnjo, Rogo, Bambus, Duga, Bikoš)
  - ❤️ crveni rub kad imaš malo života više ne pulsira u bazi (tamo si siguran)

- 🧹 **Čišće i zabavnije** (v0.39):
  - 🔢 **brojevi štete samo kad si TI uključen** — tvoji udarci, tvoji prizvani pomoćnici i udarci u tebe (crveni); u tučnjavi 5 na 5 ekran više nije zatrpan brojevima, a brzi udarci (otrov, glad, plamen) spoje se u jedan broj. Isto vrijedi za „Promašaj!” i kritične brojeve (crveni rez preko mete i dalje vide svi)
  - 🤫 **manje poruka**: botovi se rjeđe hvale i zovu pomoć, timske poruke (gank, obrana, guranje) najviše jednom u 12–30 s, „Stigli su veliki vojnici!” samo prvi put, a ista poruka se ne ponavlja odmah (u probnoj partiji prije je bilo 173 poruke u 15 minuta)
  - 💨 **brže putovanje**: kad 6 s nisi u borbi (ne udaraš junake ni građevine i oni ne udaraju tebe), junak je 15 % brži, a kad izađeš iz fontane, 10 s puše „vjetar doma” (+40 %) — dok ne uđeš u borbu; vidi se po vjetru za petama i znački 💨 među bonusima. Na većoj mapi puno manje dosadnog hodanja
  - 🪙 **pobjeda nad junakom**: zlatnici iskoče iz pobijeđenog i polete do pobjednika; kad pobijediš TI, ekran zlatno bljesne, kamera se trgne i malo približi, a igra na tren uspori (samo protiv botova)
  - 🛡️🔭🍖 traka bonusa pokazuje i Bojni zov, Durbin i Ratnu glad

- ✨ **Veliko poliranje** (v0.38):
  - ⛶ **cijeli zaslon** — gumb ⛶ gore desno (i na ekranu odabira), a igra se sama otvori preko cijelog ekrana kad klikneš ▶️ ZAIGRAJ. U cijelom zaslonu **miš ne može pobjeći iz igre** (ni na drugi monitor): igra „zaključa” miš i crta svoj pokazivač (⚔️ mač nad neprijateljem, 🎯 nišan pri ciljanju), pa pomicanje kamere uz rub uvijek radi. Kad otvoriš dućan, postavke ili pomoć, miš se sam otpusti; klik na igru ga opet zaključa, **Esc** ga pusti. Oboje se može isključiti u ⚙️ postavkama (🖥️ Cijeli zaslon, 🔒 Miš ostaje u igri)
  - 🐿️ **Nišan — novi junak kao Sniper u Doti**: vjeverica snajperist s dugom puškom i durbinom, gađa s 430 (najdalje u igri). Pasiva 🎯 *Pogodak u glavu* (dodatna šteta, kratka omama, odbačaj) • Q 🌰 *Kiša žirova* (dugo pada na daleko mjesto, usporava) • W 💣 *Šišarka-bomba* (odbaci neprijatelje — i tebe ako si blizu, za bijeg!) • E 🔭 *Durbin* (6 s gađaš puno dalje i brže) • R 🔫 *Savršen hitac* (nišani protivničkog junaka do 2000 daleko: crveni laser i nišan nad metom, pa hitac koji uvijek pogodi)
  - 🐂 **Bikoš — novi junak kao Axe u Doti**: crveni bik s golemom dvostrukom sjekirom. Pasiva 🌀 *Bikovski vrtlog* (kad ga udare, ponekad se zavrti i rani sve oko sebe) • Q 🗯️ *Bojni zov* (neprijatelji oko njega moraju napadati samo njega, a on dobiva jaki oklop) • W 🍖 *Ratna glad* (meta gubi život dok nekoga ne pobijedi) • E 🐂 *Bikovski skok* • R 🪓 *Smrtni udarac* (ranjenog junaka odmah pobijedi — tim potrči brže, a ulti je opet spreman)
  - 🎙️ oba nova junaka imaju **svoj glas i 9 replika** (na engleskom, kao ostali), 3D model iz Blendera s animacijama (Nišan nišani i trza se od pucnja) i portret
  - 🎓 **svaki junak ima SVOJE talente** (24 × 4 razine × 2 izbora): umjesto istih bonusa za sve, talenti jačaju baš njegove moći — npr. Žarkova Vatrena kugla probija sve, Strijelino Sokolovo oko gađa dva junaka, Pipkov Zagrljaj pipaka dulje drži, Skakačeva Majmunska vojska ima 4 majmuna. Stablo talenata vidiš na ekranu odabira (🎓 pločica), a odabrani talent se vidi i u opisu moći
  - 💥 **kritični udarci**: veliki narančasti broj koji iskoči i zatrese se, crveni rez u obliku X preko mete, bljesak oružja prije zamaha, jači crveni trag zamaha, crveni projektil kod daljinskih junaka i poseban zvuk
  - 🪄 **animacije magija i napada**: vještine vuku svijetlu vrpcu (trag), ulti skupi energiju u junaka uz bljesak ekrana, skokovi ostavljaju trag iskrica, crveni rub ekrana kad te jako udare i kad ti je malo života, efekti za sve nove moći (kiša žirova, šišarka-bomba, laser nišana, zamah sjekirom, vrtlog)
  - 🛒 **jasniji dućan**: lijevo kategorije s razumljivim imenima (⭐ Za tebe, 💰 Mogu kupiti, 🧪 Napitci, 💪 Atributi, 🗡️ Oprema… ⚔️ Oružje, 👑 Legendarno) sa zelenom značkom koliko toga možeš kupiti; predmeti su **kartice s imenom, onim što daju i cijenom** (crveno „fali 150” kad nemaš dovoljno); gore veliki gumb **„⭐ Kupi sljedeće”**; dolje recept („složi od: A + B + 📜 = predmet”), veliki gumb „🛒 Kupi za X” ili „🔒 Fali još X” i tvoja torba s porukom stiže li predmet odmah ili ga nosi 🫏 kurir
  - 🗺️ **veća mapa za 5 na 5** — testirano simulacijom: mapa je 28 % veća u svakom smjeru (1,45 → 1,85), protivnici su prosječno ~1550 umjesto ~1240 daleko, ima više mjesta za džunglu (4 nova kampa: vukovi i 🪨 kameni golemi koji omamljuju) i više drveća; igra traje prosječno ~18–23 minute
  - 🗼 **aggro kao u Doti 2**: napadneš li junaka blizu protivničke kule ili vojnika, kula i njegovi vojnici navale na TEBE (vojnici te ganjaju ~2 s); klikneš li svog vojnika, protivnički vojnici te puste. Vojnici bez druge mete napadaju junake do 500 udaljenosti
  - 🗡️ **kule su opasne na početku**: prvih 10 minuta junacima rade **dvostruku štetu** (do 20. minute polako pada na ×1,3), a svaki sljedeći pogodak u istog junaka jači je za 25 % (do ×2) — nema više ronjenja pod kulu na levelu 3
  - 🌫️ **prava magla rata**: vid ide u zrakama — **drveće zaklanja pogled**, a s nizine se ne vidi na viši plato (kao u Doti); kule i fontana vide u krugu, oči 👁️ i noć rade kao prije; neprijatelje u magli ne možeš ciljati, a zaključani cilj se izgubi kad nestane u magli. Magla se crta glatko, i na tlu, zgradama, drveću i vodi
  - 🌿 **Šumska grickalica jede drvo**: klikni je pa **klikni drvo** (zeleni krug pokaže najbliže) — junak dođe do njega, pojede ga i 16 s liječi; drvo nestane i izraste za 3 minute (vidi i gost u mrežnoj igri). 🪓 Drvosječina sjekirica sada siječe drveće (otvori prolaz!)
  - 🤖 **pametniji botovi — timska taktika**: svaki tim ima „zapovjednika” koji botovima daje naredbe: **🗡️ gank** (2 bota odu na usamljenog ili ranjenog protivnika na drugoj stazi), **🛡️ obrana** (kad ruše našu kulu, najbliži dođu — i teleportom), **🏰 guranje** (kad je tim jači, zajedno guraju stazu), **🔄 promjena staze** i **🐲 Veliki Zmaj** kad protivnici leže. Botovi javljaju u timske poruke što rade („🗡️ Sivko i Zubo idu u gank na Lavka!”, „🛡️ Rogo brani kulu!”), a odgovaraju na tvoje pingove i „⚔️ Napadamo!”
  - 🌀 **teleport na kulu**: T pa klik na svoju kulu ili vojarnu (i na minimapi) — 3,5 s i stižeš; T dvaput = kući. Na odredištu raste stup svjetla koji vide i protivnici
  - 🎨 **ljepši 3D modeli**: svi modeli dobili su bolje „oslikano” sjenčanje (plohe prema nebu toplije i svjetlije, odozdo hladnija sjena) pa iz kamere odozgo izgledaju obliji; novi modeli metka, puške i sjekire
  - 🧪 `tools/sim/sim.js` — simulacija cijelih partija bez preglednika (`node tools/sim/sim.js 4 --max=2700`) za provjeru ravnoteže, veličine mape i ponašanja botova
  - 💰 `tools/sim/econ.js` (v0.54) — ista simulacija, ali mjeri ekonomiju: odakle dolazi zlato (po izvoru i fazi igre), neto vrijednost, kad se kupuju veliki predmeti i koliko je najbogatiji junak ispred ostalih (`node tools/sim/econ.js 4`, `--set=creepGoldMul=0.6` za probu drugih vrijednosti, `--turbo` za brzu igru)

- 👥 **5 na 5** (v0.37) — timovi su sada veliki kao u DotA-i i LoL-u:
  - 🤖 sam igraš: **ti + 4 bota 🔵 protiv 5 botova 🔴**; s prijateljem: domaćin i gost vode sredinu, a svaki ima **po 4 bota**
  - 🛣️ raspored po stazama kao u DotA-i: **sredina sama** (tu si ti), na gornjoj i donjoj stazi **po dvoje**
  - ⚖️ igra je provjerena simulacijom (botovi vode oba tima): partija traje prosječno **18,5 minuta** (3 na 3: 14,7), a pomoć timu koji zaostaje kreće tek kad zaostaje 2500 zlata (prije 1500) jer veći timovi skupe više zlata
  - 🏆 završni ekran i 📋 tablica pokazuju svih **10 junaka** — i na mobitelu (zaglavlje stupaca samo jednom, manji redovi; na najmanjim ekranima se pomiče, a gumb „Igraj ponovo!” je uvijek vidljiv)
  - ⚡ i dalje brzo: logika igre +12 %, crtanje +5 % poziva, mrežna snimka za gosta najviše ~10 KB
  - ⚔️ početna najava u mrežnoj igri: „5 NA 5!”

- 🧽 **Peglanje 2** (v0.36):
  - 📱 **mobitel položen** (nizak ekran): ⚙️ postavke se mogu pomicati pa je gumb „Nastavi” uvijek dostupan; 📋 tablica stisne redove da stanu svih 6 junaka i crta se preko minimape; 🏆 završni ekran je zbijeniji i pokazuje oba tima; 🛒 dućan koristi cijelu visinu umjesto da se prelije preko ploče junaka; 💀 pregled pogibije stane između minimape i moći; ubojstva/smrti na ploči junaka više se ne preklapaju sa zlatom
  - 💬 **opisi gumba gore desno** (💃 ples, 🎯 kamera, 📋 tablica, ⚙️ postavke, 🔊 zvuk, ❓ pomoć) — prijeđi mišem i vidiš što rade i koja je tipka
  - 🌐 gost u mrežnoj igri: njegove vlastite poruke („🔒 Treba ti poen vještine!”, „Nema mane!”…) više ne nestanu za tren (snimka domaćina ih je brisala)
  - 📰 poruke koje vidi samo drugi tim više ne guraju tvoje poruke s popisa
  - 🤖 u izborniku „S prijateljem” težina botova je zasivljena (u mrežnoj igri botovi su uvijek normalni)
  - ✅ cijela igra od 12 minuta s glasovima i crtanjem (bot vodi tvog junaka, „Teško”) prošla je bez ijedne greške

- 🌐 **Mrežna igra: svatko vidi svoje** (v0.35) — popravci za igru 1 na 1 preko interneta:
  - 🎉 **osobne najave** idu samo onome kome pripadaju: tko ubije junaka vidi „Bravo!”, a tko padne „Ne brini!” (prije je gost vidio domaćinove najave, npr. „Bravo! Pobijedio si Rogo!” kad je upravo on poginuo); i gost sada dobiva „🌟 ULTI dostupan!” i „🎓 Talent!”, a otkup mu makne „Ne brini!”
  - 🏆 na kraju igre svatko zadrži **svoju** najavu („POBJEDA!” ili „PORAZ…”) — prije bi je kod gosta za tren prepisala domaćinova
  - 💰 **osobne poruke iznad junaka** (zlato za ubojstvo, asistenciju, kulu, „Nema mane!”, „Teleport prekinut!”…) vidi samo njihov vlasnik — i gost sada vidi svoje zlato, a domaćin više ne vidi tuđe
  - 🔵🔴 poruka o buffu iz džungle stiže samo timu koji ga ima
  - 🔊 gost čuje zvuk kad pobijedi junaka i kad dobije level (kao domaćin)

- 📣 **Najavljivač, težina botova, pregled pogibije i ples** (v0.34):
  - 📣 **najavljivač kao u DotA-i** — dubok, gromki glas (na engleskom) najavljuje važne trenutke: „Welcome to Dota Kids!”, „Let the battle begin!”, **„First blood!”**, višestruka ubojstva (**„Double kill!”, „Triple kill!”, „Ultra kill!”, „Rampage!”**), nizove (**„Killing spree!”, „Dominating!”, „Mega kill!”, „Unstoppable!”, „Incredible!”, „Monster kill!”, „Godlike!”, „Beyond godlike!”**), „Shut down!”, „Ace!”, srušene kule i vojarne, ranjiv prijestol, Velikog Zmaja i zmajčiće, noć i dan, te **„Victory!” / „Defeat…”**
  - 👂 svatko čuje iz **perspektive svog tima**: „Enemy tower destroyed!” kad padne protivnička kula, a „Our tower has fallen!” kad padne naša — radi i za gosta u mrežnoj igri
  - 🔇 junaci i najavljivač **ne pričaju u isto vrijeme**: puno važnija replika prekida trenutnu, a ostale pričekaju na red (npr. prvo „First blood!”, pa tvoj junak „Justice wins!”); najavljivača isključiš u ⚙️ postavkama (📣 Najavljivač)
  - 🤖 **težina botova** na ekranu odabira: **🐣 Lako** (protivnički botovi sporije reagiraju, rjeđe bacaju moći i koriste predmete, oprezniji su, ne otkupljuju se i zarađuju 25% manje zlata), **⚔️ Normalno** (kao prije) i **🔥 Teško** (brži, hrabriji, 25% više zlata); saveznici su uvijek normalni, igra pamti izbor, a završni ekran pokazuje težinu. U simulacijama (4 igre po težini, i tvog junaka vodi bot) tvoj tim na „Lako” pobijedi svaku igru, a protivnici skupe tek ~6,6 tisuća neto vrijednosti (na „Normalno” ~15 tisuća i 2 od 4 pobjede)
  - 💀 **pregled pogibije kao u LoL-u**: kad pogineš, vidiš tko te ubio i tko ti je u zadnjih 15 sekundi nanio koliko štete — s portretom junaka, trakom i čime (npr. „🔥 Vatrena kugla 230 · ⚔️ Napadi 190”), uključujući kule, vojnike i čudovišta; i gost u mrežnoj igri dobiva svoj pregled
  - 💃 **ples na tipku J** (ili gumb 💃 gore desno): junak zapleše pobjednički ples, iznad glave mu zasviraju 🎶 i kaže **šaljivu repliku** — svih 22 ima svoju („Ha! Even my mane can dance!”, „Bzzz! Honey dance time!”, „Arr! Eight arms, eight times the dancing!”…); prestaje čim kreneš, napadneš ili baciš moć, a vide (i čuju) ga i drugi, i u mrežnoj igri
  - 🦁 Lavko ima novi, plemeniti glas (njegov stari epski glas sada je najavljivač)

- 🗣️ **Glasovi junaka** (v0.32, na engleskom od v0.33) — kao u LoL-u i DotA, svaki junak ima **svoj glas i 8 replika na engleskom** (176 replika, napravljeno s [Fish Audio](https://fish.audio)):
  - 🇬🇧 **engleski kao u pravim igrama** — djeca usput uče engleski, a imena junaka ostaju naša (Lavko, Žarko, Zuja, Zubo…) i izgovaraju se kako treba
  - 🎙️ **22 različita glasa** po karakteru: hrabri Lavko, vatreni Žarko, hladna Ledena, lukava Strijela, spori djed Listko, munjeviti Munja, razigrana Skokica, ponosna Orlina, tajanstvena Luna, šaptač Tragač, gunđalo Bodljo, duboki Tutnjo, zujava Zuja, mudra Mudra, vragolan Skakač, režeći Sivko, dramatični Mrak, gusar Pipko, glasni Rogo, mirni Bambus, čarobna Duga i gladni Zubo
  - 👆 **odabir** — klikneš junaka na početnom ekranu i on se predstavi („Lavko the brave, ready for battle!”)
  - 🌟 **ulti** — svaki junak vikne svoj ulti („Dragon's breath! Feel the heat!”, „Stampede! The ground shakes!”), a **ulti protivnika i suigrača u blizini** isto čuješ
  - 🏆 **pobjeda nad junakom**, 💀 **pogibija** („Meow... I still have eight lives left.”) i ⏳ **povratak u igru**
  - 🚶 **ponekad dok hodaš ili napadaš** — kratka replika, ali ne na svaki klik (hodanje najviše svakih 12 s, napad svakih 7 s); držanje miša ne priča
  - 🔇 govori **samo jedan glas u isto vrijeme** — važnija replika (ulti, pobjeda, pogibija) prekida manje važnu, a manje važna ne prekida važniju; prati 🔊 glasnoću i 🎵 zvuk, a u ⚙️ postavkama ih možeš **isključiti** (🗣️ Glasovi junaka)
  - 📱 radi i na iPadu/iPhoneu (zvuk se „otključa” prvim dodirom) i u mrežnoj igri (gost čuje svog junaka)
  - ⚡ učitana replika krene istog trena, pa se ne preskoči ni kad igra na tren zastane (npr. prvi ulti na slabijem tabletu) (v0.33)
  - 📝 replike i odabrani glasovi su u [`voices.js`](voices.js); igra učitava samo replike tvog junaka i ulti ostalih junaka u meču

- 🎯 **Ciljanje mišem, indikatori i priprema** (v0.31) — popravci po prijavama testera:
  - ⏳ **30 sekundi pripreme na početku** (kao u DotA prije roga): sat kreće od **-0:30**, dućan se sam otvori da kupiš predmete, a vojnici, čudovišta u džungli, rune i pasivno zlato kreću tek u **0:00** uz zvuk roga; zadnjih 5 sekundi otkucava; u igri protiv botova gumb **▶️ Kreni odmah** preskače čekanje
  - 🖱️ **klik na junaka pogađa bilo gdje na tijelu** (glava, trbuh, noge): jedinica pod mišem bira se po svom tijelu na ekranu, a ne po točki na tlu iza nje — prije je klik na glavu protivnika promašio i junak je samo otišao iza njega
  - ⭕ **jedinica pod mišem zasvijetli**: crveni krug pod neprijateljem (zeleni pod prijateljem, žuti pod čudovištem), okvir oko njegove trake života, a pokazivač postaje ⚔️ mač; pri ciljanju moći pokazivač je 🎯 nišan
  - 🏹 **strijela projektila pokazuje PRAVI domet i širinu** — vatrena kugla leti 760 i strijela je toliko duga (prije je išla samo do miša, pa je izgledala kratko); skokovi i juriši pokazuju točno mjesto slijetanja i širinu udarca
  - ⛰️ **indikatori leže na terenu**: krug djelovanja, prsten dometa i strijela prate brežuljke, nasipe i rijeku (prije su bili ravni diskovi koji su se skrivali pod tlom); isto i **zone moći** (gdje pada meteor, kiša strijela, korijenje…), pa se vidi kamo ne smiješ stati
  - 🎯 **moć ide točno na junaka pod mišem**: klikneš li junaka dok ciljaš (ili pustiš tipku kod brzog bacanja), krug ili strijela se prilijepe za njega
  - 🐞 **nišan više ne zaostaje**: točka na tlu ispod miša računa se u svakoj sličici, pa indikator prati miš i dok kamera prati junaka (prije je moć znala odletjeti na staro mjesto); **držanje tipke Q** više ne baca moć samo od sebe (preglednik ponavlja pritisak tipke)
  - ⚔️ **A pa klik — napad u hodu**: junak ide onamo i usput napada neprijatelje (junake, vojnike, čudovišta, građevine); crveni krug pokazuje domet napada
  - 🖱️ **drži tipku miša** na tlu i junak stalno ide za mišem; **desni klik dok ciljaš** odustaje i odmah daje običnu naredbu
  - ⚡ **brzo bacanje** (Postavke): drži tipku moći = vidiš domet i krug, pusti = baci prema mišu (za iskusnije igrače; uobičajeno je pritisni pa klikni)
  - ✅ Ucjena (Tragač) sada traži metu samo unutar prstena dometa koji pokazuje (prije je hvatala junaka bilo gdje uz miš), a Zamjena (Mrak) pokazuje pravi krug hvatanja

- 🦸 **Potpisni detalji svakog junaka** (v0.30) — kao kod LoL junaka, svatko ima svoj prepoznatljiv rekvizit koji priča njegovu priču i moći (smješten tako da se vidi i odozgo, iz kamere u igri):
  - 🦁 **Lavko**: kraljevski plašt sa zlatnim rubom i velikim zlatnim lavljim suncem s rubinom na leđima
  - 🔥 **Žarko**: rogovi koji gore na vrhovima, žar duž repa, zlatna narukvica s vatrenim draguljem
  - ❄️ **Ledena**: ledeni naramenjaci od svjetlećih kristala i ledeni kristali oko kićanke kape
  - 🏹 **Strijela**: smotana lovačka mreža na boku (njena moć) i ogrlica od očnjaka
  - 🍄 **Listko**: crvene gljive s bijelim točkama, lišće i ružičasti cvijet na oklopu, vitica s listićima oko štapa
  - ⚡ **Munja**: velika svjetleća munja-cik-cak na čelu (vidi se i odozgo), svjetleći vrh repa s iskrama i munje na nadlakticama
  - 👑 **Skokica**: mala zlatna kruna s rubinom (žablji princ)
  - 🧣 **Orlina**: pilotski šal u boji tima čiji dugi krajevi vijore iza leđa
  - 🌙 **Luna**: svjetleći polumjeseci na vrhovima luka i srebrne naušnice; polumjesec na čelu sada prati zaobljeno čelo (prije je stršao u zraku i odostraga se vidio kao "S" iznad glave)
  - 💣 **Tragač**: dvije dimne bombe sa svjetlećim fitiljem (njena moć) i bacački noževi za remenom
  - 🧪 **Bodljo**: bočica zelene sluzi na boku i narukvice s bodljama
  - 🐘 **Tutnjo**: zlatni ukras na čelu s rubinom, zlatni prstenovi na kljovama, crvene rese na ušima
  - 🍯 **Zuja**: svjetleći vrhovi ticala i lončić meda s kapljicom
  - 👓 **Mudra**: okrugle zlatne naočale i broš s polumjesecom
  - 🍌 **Skakač**: banana za pojasom i crvene vrpce na vrhu zlatnog štapa
  - 🐺 **Sivko**: plave ratničke pruge na licu, ogrlica od zuba i srebrni pun mjesec
  - ⭐ **Mrak**: zvijezde i polumjesec na čarobnjačkom šeširu, ovratnik od perja, ljubičasti broš
  - 🪸 **Pipko**: kruna od koralja i biserna ogrlica
  - 🦏 **Rogo**: čelični obruč na rogu, šiljci na naramenjacima, crvene ratničke pruge
  - 🎋 **Bambus**: slamnati šešir na leđima i tikvica s crvenom vrpcom
  - 🌈 **Duga**: narukvice u bojama duge i svjetlucave zvjezdice oko roga
  - 🏴‍☠️ **Zubo**: gusarski povez preko oka, zlatni zub i veliko zlatno sidro na pregači
  - 🖼️ novi portreti 12 junaka iz Blendera s novim detaljima
  - ⚙️ bez troška u igri: +2 poziva crtanja i +0,4 % trokuta u ispitnoj sceni (7 junaka + 12 vojnika), modeli 5,1 MB (+0,1 MB)

- ⚔️ **3D modeli bliže League of Legendsu** (v0.29):
  - 🎨 **"ručno oslikani" izgled svih modela** (kao teksture u LoL-u): uz pečenu okluziju svaki model dobiva prijelaz od tamnijeg podnožja prema svjetlijem vrhu, hladnije i zasićenije sjene, toplije svjetlo i blagi šum poteza kistom — sve u bojama vrhova, bez troška u igri
  - ✨ **pravi metal**: zlato i čelik na junacima i zgradama (oklopi, naramenjaci, mačevi, štitovi, krune, zlatni lukovi kula) imaju vlastiti materijal sa sjajem i odsjajem okoline; noću odsijavaju slabije
  - 🧥 **sekundarni detalji kao kod LoL junaka**: pregača (tabard) sprijeda i straga u tamnijoj boji tima sa zlatnim rubom i znakom, zlatne zakovice uz rub tunike, šavovi i dragulj u boji tima na pojasu, kožni remen preko prsa s okruglom zlatnom kopčom (pješaci, strijelci, borci s kandžama), zlatne ogrlice s draguljem za čarobnjake
  - 🛡️ **oklopi i oružje**: slojeviti naramenjaci sa zakovicama, zlatni amblem-sunce na oklopu, čelične kapice i zlatni rubovi čizama, širi mač sa svjetlećom runom i većim križem, zakovice i zlatna zvijezda na štitu, dragulj na luku, čelične narukvice uz kandže, željezni obruč na batini, još jedna kost u krilima
  - 🦁 **Lavkova griva** od šiljatih pramenova u dva prstena oko cijelog lica (prije mjehurići samo s jedne strane); čuperci krzna/perja na tjemenu Strijele, Munje, Majmuna, Vuka, Pande, Lune i Orline
  - 💎 likovi imaju blagi sjaj (oslikani odsjaj), a kameni golem ostaje bez zlatnih ukrasa
  - 🖼️ **novi portreti** 12 junaka iz Blendera na ekranu odabira (s novim detaljima)

- 🌳 **Džungla, svjetlo i vojnici** (v0.28):
  - 🌲 **živa džungla**: drveće, grmlje i kamenje su mat (bez plastičnog odsjaja koji je krošnje činio bijelima), zelene boje su bogatije, krošnje malo veće, a uz stabla raste grmlje — šume izgledaju gušće; ispod stabala je tamnije šumsko tlo pa se šume odvajaju od svijetlih livada
  - 🪨 manje kamenja i sivo umjesto bijelog (prije je džungla izgledala kao da je posuta konfetima); na Scourge strani svjetliji tamni borovi i mrtvo drveće s jarkim crvenim i ljubičastim lišćem
  - ☀️ **mekše svjetlo**: slabije plavkasto nebo i umjerenija ekspozicija — vrhovi krošnji, kamen i junaci se više ne "isperu" u bijelo, boje su dublje
  - ☠️ **Scourge vojnici** imaju svoj izgled (kao Dire u DotA): kostur-vitezovi s rogatim kacigama, nazubljenim mačem i štitom s lubanjom, tamni čarobnjaci s kapuljačom i lubanjom na štapu, koštana opsadna kola s lubanjom na ovnu
  - 🔥 **pravi Vatreni vuk** (crveni buff): tamnocrveno krzno, plamena griva i leđa, svjetleće oči; svetište tamnijeg kamena
  - 🏰 **zgrade bez "ispranog" bijelog**: kule, prijestoli, vojarne, fontane i svetišta imaju vlastiti materijal sa slabijim odsjajem, pa se vidi pravi topli kamen; **zidine oko baza su kamene** (samo vrhovi stupova u boji tima, prije su bile cijele plave kao plastika), šatori isto; svetište u mirovanju ima mali sjaj samo oko kugle; Scourge fontana opet ljubičasta

- 🎨 **Dizajn i 3D modeli** (v0.27):
  - 🐉 **četiri prava zmajčića** iz Blendera umjesto prebojanog Velikog Zmaja: 🔥 vatreni (plamen na leđima, žar na obrazima), 💧 vodeni (leđna peraja, peraje na glavi, mjehurići), ⚡ olujni (krijesta od munja, svjetleći rogovi), 🌿 šumski (lišće, cvjetići i mahovina); oko svakog lete čestice njegovog elementa
  - 🏰 **nove kule**: topli tamniji kamen (više se ne "ispere" u bijelo), stepenasto postolje s potpornjima, zastave tima sprijeda, zupci na konzolama i **veliki lebdeći kristal** u zlatnoj kruni umjesto krova (kod Scourgea u koštanim kandžama, s ljubičastim runama); kule su malo veće
  - 🌳 **Sentinelov prijestol "Drvo života"**: kameni podij sa zlatnim rubom i stubama, stupovi sa zlatnim kapitelima, deblo s korijenjem i tri grane koje drže kristal, krošnje sa svjetlećim plodovima
  - 🛡️ **štit prijestola** dok čuvarske kule stoje: svijetli samo rub kupole (prije je bijela izmaglica skrivala prijestol)
  - 🏛️ **popločani trg** oko prijestola i fontane (svijetli kamen i zlatni ukrasi za Sentinel, tamne ploče i ljubičaste rune za Scourge) umjesto ravnih prozirnih krugova; rub trga se gubi u travi
  - 🗺️ **rub mape bez šava**: tlo izvan mape uzima boju terena i polako prelazi u šumu i stijene (prije oštra crta i taman pojas)
  - ⛲ fontane opet pokazuju vodu (prsten u boji tima više ne prekriva bazen), podij prijestola bez ružičastog/plavog diska, mekše podloge kampova
  - 🦁 junaci su malo veći (lakše ih je vidjeti na tabletu)

- 🐉 **Zmajčići, tablet i postavke** (v0.26):
  - 🐉 **zmajčići na rijeci** (dolje desno, umjesto Mede Brunde): 🔥 *Vatreni* (+6% štete), 💧 *Vodeni* (+3 obnove života i +1,5 mane), ⚡ *Olujni* (+5% brzine), 🌿 *Šumski* (+3 oklopa) — tim koji ubije zmajčića dobiva **trajni bonus za sve junake** i bonusi se zbrajaju; novi zmajčić (drugog elementa) dolazi nakon 2,5 min. Vide se na minimapi u boji elementa, u traci buffova (×2, ×3…) i u tablici; botovi ih love u paru od 5. minute
  - 👆 **igranje na tabletu**: dodir = hodaj / napadni / gumb, povlačenje prstom = kamera, dva prsta = zum; gumbi 📋 tablica i 🎯 kamera na junaka; držiš prst na predmetu = opis, a 1 s = prodaja (uz potvrdu)
  - ⚙️ **postavke** (gumb gore desno ili **Esc**): glasnoća, zvuk, kvaliteta slike (niska / srednja / visoka — niska je brža na slabijim tabletima), efekti, kamera uz rub ekrana, brojevi štete; igra pamti izbor, a protiv botova stoji dok su postavke otvorene
  - 🖱️ **kamera uz rub ekrana** kao u DotA i LoL-u: miš uz sam rub pomiče kameru
  - 🐞 popravci: klik na ploču HUD-a više ne šalje junaka tamo ispod nje; gost u multiplayeru sada vidi Vatrenog vuka (a ne vepra)

- ⚡ **Detalji iz League of Legends** (v0.25):
  - ✨ **čarolije prizivača** na tipkama **D** i **F**: ⚡ *Bljesak*, 💚 *Iscjeljenje*, 🔥 *Zapaljenje* (gori i slabije se liječi), 👻 *Duh*, 🫧 *Barijera* (štit), 🐌 *Iscrpljenost*, 🌩️ *Kazna* (za džunglu i zmaja) — biraš ih na ekranu junaka (igra pamti izbor), okrugli gumbi u petom stupcu naredbene kartice; botovi ih biraju po ulozi i koriste
  - 🔵🔴 **buffovi džungle**: *Plavi golem* daje plavi buff (mana i 15% kraće hlađenje), *Vatreni vuk* crveni buff (udarci pale i usporavaju) — 90 s, a pogineš li, buff preuzima tvoj ubojica; čudovišta s buffom svijetle i vide se na minimapi
  - 📊 **traka buffova** iznad ploče junaka: sve što ti pomaže (zeleno) ili šteti (crveno) s preostalim sekundama i opisom
  - 🏚️ **vojarne se obnavljaju** 4 minute nakon rušenja (kao inhibitori) — super vojnici tada nestaju, pa tim koji gubi može se vratiti
  - 💀 **ACE!** kad padne cijeli protivnički tim
  - ❤️ **trake života kao u LoL-u**: crtice svakih 100 života, svjetliji trag izgubljenog života, bijeli štit, kućica s levelom; 🎯 **strelica ciljanja** za magije koje lete ravno i svijetli rub kruga djelovanja
  - ⌨️ glif je sada na tipki **Y** (F je čarolija prizivača)
  - 🤖 **botovi procjenjuju borbu**: napadaju kad im strana nije slabija (level, predmeti, život, saveznici u blizini), inače se povuku k svojoj kuli — manje "hranjenja" i ujednačenije igre (u simulacijama 9–23 min)

- 🧽 **Peglanje** (v0.24):
  - 🏆 **završni ekran kao u DotA**: oba tima s portretima, K / D / A, zadnjim udarcima, **neto vrijednošću** i slikama predmeta (uz neutralni), 👑 najbolji igrač; **tablica na Tab** u istom stilu
  - 🤝 **asistencije**: suigrači koji su udarili metu ili su bili blizu (1000) dobivaju asistenciju i +50 zlata
  - 🏰 **utvrđene građevine (kao u Allstarsu)**: junaci rade 50% štete građevinama, opsadni vojnici 125%; kule imaju oklop, a dublje kule više života i oklopa (1. kula 2600, 2. kula 3250, čuvari 3575), prijestol 5000 života — igre opet traju dulje, a ne završe za 8 minuta
  - 🔄 **zlato za povratak u igru**: kad tim koji zaostaje ubije junaka tima koji vodi, ubojica dobiva dodatno zlato (do +400) — manje jednostranih igara
  - 🧪 **pametniji botovi**: kupe tango na početku i ljekoviti melem kad su ranjeni, umjesto da stalno pješače do fontane
  - 💬 **jedinstveni opisi**: moći, urođena pasiva, atributi, glif, teleport i dućan imaju isti opis kao predmeti (s brojkama za trenutni i sljedeći rang)
  - 🐞 popravci: ikone predmeta se stvaraju trenutno (dućan kod gosta u multiplayeru se više ne zamrzava), opis predmeta i dućan se zatvaraju na kraju igre, nova igra počinje bez stare brze kupnje

- 🛒 **Predmeti kao u DotA** (v0.23):
  - 🗡️ **74 predmeta**: *Osnovni* (potrošno, atributi, oprema, razno, rijetko) i *Nadogradnje* (pribor, podrška, čarolije, oklop, oružje, artefakti) — Mladica, Medvjeđa narukvica, Ratničke čizme, Trostruke čizme, Iskričavi štapić, Ljekoviti medaljon, Štap vjetra, Tornado u boci, Zraka trozuba, Kraljevski oklop, Generalov oklop, Srce titana, Sjekira oluje, Oštrica pogotka, Mač sumraka, Kameni malj, Vrtložni mač, Plesna krila, Nevidljivi bodež, Vampirski mač, Sunčev kamen…
  - ⚙️ **prave DotA statistike**: atributi (snaga / okretnost / inteligencija), brzina napada, **oklop** (smanjuje štetu udaraca; kule i vojarne imaju svoj), krađa života, izbjegavanje, kritični udarci, tresak (omama), zamah po skupini, blok štete, skidanje oklopa, aure za saveznike i ~25 aktivnih predmeta (vihor, ledeni val, zlatni dodir, treptaj, osvježenje moći…); botovi kupuju po vodiču i koriste aktivne predmete
  - 🖼️ **prikaz kao u DotA**: pravokutne slike predmeta u boji kvalitete (sivo, zeleno, plavo, ljubičasto, narančasto), dućan sa stupcima po kategorijama, tražilicom, **⭐ vodičem** za tvog junaka, receptom ("Sastojci" / "Ulazi u") i **desnim klikom za kupnju**; opis predmeta kao u DotA (statistike, PASIVNO / AKTIVNO s manom i hlađenjem, priča)
  - 🎒 **torba 3×2 + ruksak 3**: povuci predmet mišem na drugo mjesto, u ruksaku ne djeluje; hlađenje se prikazuje kao sat koji se otvara, punjenja dolje desno, tipke 1–6 gore lijevo; 📌 **brza kupnja** iznad naredbene kartice pokazuje što još fali za prikvačeni predmet

- ⚔️ **Animacije udaraca i magija** (v0.22):
  - 🎯 **trenutak udarca kao u DotA**: junak, vojnik i čudovište prvo zamahnu, a šteta (ili strijela / vatrena kugla) dolazi točno u kadru kad oružje pogodi; brži napad = brži zamah; omama prekida zamah, a magija ga prekida bez gubitka udarca (kule pucaju odmah)
  - 🗡️ **jači zamasi**: Blender animacije napada imaju napinjanje, iskorak i zamah koji prođe kroz udarac; strijelci se trznu kad puste tetivu, čarobnjaci "gurnu" kuglu; **kritični udarac, kombo i udarac iz sjene** imaju poseban, jači zamah i svjetliji trag oružja
  - 🏹 **daljinski napadi** polijeću iz ruke ispred junaka (ne iz trbuha), a u ruci se skupi svjetlo dok junak napinje
  - 💥 **pogodak**: meta se trzne unatrag od napadača, iskra sjevne na strani s koje je došao udarac
  - ✋ **magije**: ruke "bace" čaroliju baš kad se efekt pojavi, uz bljesak svjetla u rukama i iskre u smjeru bacanja; skokovi imaju odraz i doskok s udarnim valom
  - 🆕 **novi efekti na mjestu cilja**: 💨 *Dimna bomba* (gust sivi dim), 🐙 *Zagrljaj pipaka* (ljubičasti pipci iz tla), 👁️ *Sovino oko* (stup svjetla i runski krug), 💰 *Ucjena* (zlatni stup i zlatnici nad metom) — vide se i kod gosta u multiplayeru

- 🗺️ **3D dorada, 3. dio** (v0.21):
  - 🖥️ **HUD kao u Warcraftu 3**: minimapa dolje lijevo, u sredini ploča junaka (portret, život/mana/iskustvo, atributi) s **torbom 2×3** odmah uz portret i okruglim mjestom za neutralni predmet, a dolje desno **kartica naredbi** — moći Q W E R u prvom redu, ispod atributi, 🌀 teleport, 🛡️ glif i 🛒 dućan; zvuk i pomoć su gore desno
  - ☁️ **sjene oblaka** polako klize preko cijele mape (danju jače, noću se gotovo ne vide), a nad **rijekom lebdi izmaglica** — mekani pramenovi koji plove niz vodu (noću gušći)
  - 🚩 **živahne zgrade**: zastave na kulama i vojarnama vijore se na vjetru (Scourge kule imaju poderani barjak na koštanom koplju s lubanjom), iz dimnjaka Sentinel vojarni izlazi siv dim, iz Scourge kripti ljubičasti pramenovi, a **kristal kule pulsira** i brže se vrti dok kula puca

- ⛰️ **3D dorada, 2. dio** (v0.20):
  - ⛰️ **litice oko baza**: plato svake baze završava strmom liticom od slojevitog kamena (Sentinel: siva stijena s travom na vrhu, Scourge: tamni kamen s pepelom i ljubičastim kristalima), a gdje staze ulaze u bazu teren se spušta blagom **rampom** — kao u Allstarsu; visine terena računaju se jednom u mrežu (brže)
  - 🪨 **kameni rubnici** duž sve tri staze
  - 💥 **udarci**: zvjezdasta iskra na svakom pogotku (veća za jake udarce); kad padne kula ili vojarna, razlete se kamene krhotine koje odskakuju po tlu, digne se oblak prašine, kristal se rasprsne i bljesne svjetlo
  - 🏛️ **HUD u stilu Allstarsa**: tamne ploče s dvostrukim rubom i zakovicama (Sentinel: tamno drvo i zlato, Scourge: tamni kamen, kost i ljubičasto), gumbi moći oštrijih kutova s unutarnjim rubom, minimapa prikazuje pravi teren

- 🏔️ **3D dorada, 1. dio** (v0.19):
  - 🗺️ **mapa je 45% veća** (4350×4350): baze, staze, kule, kampovi, rune i svetišta raspoređeni po istom planu, ali je svijet veći u odnosu na junake (kao u DotA); džungla je gušća (oko 270 stabala)
  - ☠️ **Sentinel i Scourge**: crveni tim ima vlastite Blender zgrade — šiljati tamni tornjevi s koštanim rebrima i kandžama oko kristala, prijestol okružen golemim koštanim šiljcima i lubanjama, fontana s ljubičastom tekućinom, kripte umjesto kućica i zidine sa šiljcima; na njegovoj strani mape zemlja potamni i izgubi boju, šuma je mrtva (uvijena stabla s tamnocrvenim lišćem, pepeljasti borovi), umjesto cvijeća leže kosti, a zrakom lebde ljubičaste iskrice
  - 🏞️ **rub svijeta**: izvan mape teren se diže u šumovita brda i stjenovite planine sa snijegom na vrhovima, s velikim stijenama i šumom koja stoji na brdima
  - ✨ **post-processing**: HDR render s MSAA, sjaj (bloom) na magijama, kristalima, bakljama i prozorima, malo jače boje i kontrast, vinjeta i hladniji ton noću; tipka **K** pali/gasi, a na sporim uređajima se samo isključi
  - ⚡ ukrasi se crtaju po komadima mape — samo ono što kamera vidi (manje trokuta na većoj mapi)

- 🧭 **Jasniji izbor junaka** (v0.18): kratak naslov i jedna rečenica o igri; kartice samo sa slikom, imenom i ikonom ⚔️/🏹; filtri *Svi / Blizina / Daljina*; desno 3D model, uloga i 5 pločica (✨ urođena pasiva + Q W E R) — prijeđi ili klikni pločicu za opis; prvi junak je odmah odabran pa je dovoljno pritisnuti **ZAIGRAJ**; multiplayer se otvara gumbom 👥; na mobitelu su gumbi uvijek pri dnu ekrana

- ⚔️ **Patch sposobnosti** (v0.17):
  - ✨ **Urođene pasive odvojene od moći**: svaki junak ima jednu pasivu (okrugla značka gore desno na portretu, opis kad prijeđeš mišem) koja uvijek radi i sama jača na levelima 7 / 13 / 19 — više ne troši poene ni mjesto među moćima. Nove pasive: 🔥 *Vatrena krv* (Žarko — napadi pale), 🌱 *Korijeni* (Listko — liječi se kad stoji), 💧 *Vodozemac* (Skokica — brža i liječi se u rijeci), 🔭 *Orlovski vid* (Orlina — veći domet), 🌙 *Mjesečeva oštrica* (Luna — napad odskoči na drugog neprijatelja)
  - 🆕 **Svaki junak ima 4 aktivne moći** — 17 novih: 📯 *Bojni poklič* (Lavko), 🛷 *Trbušno klizanje* (Ledena), 🕸️ *Lovačka mreža* (Strijela), 💨 *Dimna bomba* (Tragač), 🐾 *Tigrove kandže* (Munja), 🌰 *Klupko* (Bodljo), 💦 *Tuš iz surle* (Tutnjo), 🌬️ *Zuj-bijeg* (Zuja), 🌫️ *Tihi let* (Mudra), 🍌 *Banana* (Skakač), 💢 *Divlje kandže* (Sivko), 🪶 *Pernata oluja* (Mrak), 🫂 *Zagrljaj pipaka* (Pipko), 📢 *Izazov* (Rogo — neprijatelji moraju napadati njega), 🥴 *Pijani korak* (Bambus — izbjegava udarce), 🌉 *Dugin most* (Duga), 🌀 *Krvavi vrtlog* (Zubo); svaka ima svoj 3D efekt, a banana i mreža nove Blender modele
  - ⬆️ **Najviši level je 25**: Q/W/E imaju 4 ranga (rang 2/3/4 od levela 3/5/7), ulti 3 (leveli 6/12/18), višak poena ide u atribute (do 10 puta); 🎓 talenti na levelima 10, 15, 20 i 25
  - 🤖 botovi znaju nove moći (i bježe kad su ranjeni: Zuja, Mudra, Duga)

- ✨ **Glatki modeli** (v0.16): svi Blender modeli (junaci, vojnici, čudovišta, kule, drveće, kamenje, ukrasi, efekti) dobili su glatko sjenčanje, zaobljene rubove kocki, više segmenata na velikim oblinama i meke izbočine na krošnjama i kamenju; AO sjene se peku po vrhu pa su prijelazi mekani. Geometrija se sažima Dracom pa je `models.glb` ~4× manji nego prije (brže učitavanje, posebno na mobitelu)

- 🦄 **Novi junaci i DotA sitnice** (v0.15):
  - 🦄 **Duga** (jednorog, čarobnica podrške): 🌈 *Dugin snop* prolazi kroz sve neprijatelje i usporava ih, 💖 *Ljekoviti rog* liječi nju i prijatelje oko nje, ✨ *Čarobna griva* (pasivno) brže puni manu prijateljima u blizini, 🌠 ULTI *Zvjezdani galop* omami neprijatelje oko nje uz kišu zvijezda, a cijeli tim ubrza i dobije štit
  - 🦈 **Zubo** (morski pas, lovac): 🦷 *Ugriz* (rana krvari), 🌊 *Skok iz vode* (skok s valom gdje padne), 🩸 *Miris krvi* (pasivno: jače udara ranjene), 😤 ULTI *Pomama* (puno brži napadi, brže trčanje, svaki ugriz liječi)
  - 🧸 novi Blender modeli: jednorog sa spiralnim zlatnim rogom, grivom i repom u bojama duge; morski pas s leđnom i bočnim perajama, repom-polumjesecom, škrgama i osmijehom punim zubića; 3D projektil duge; portreti iz Blendera
  - 🌰 **Neutralni predmeti**: čudovišta u džungli ponekad ispuste predmet (3 razine — od 10. i 20. minute bolji), koji ide u novo okruglo mjesto pokraj torbe; najviše 3 po razini za svaki tim. U 3D-u iz čudovišta iskoči zelena škrinjica sa žirom i odleti do junaka
  - 💰 **Rune zlata** na 4 mjesta u džungli (od početka, svake 3 min) — zlato cijelom timu; 📘 **Rune mudrosti** u kutovima džungle (svakih 7 min) — puno iskustva. Novi 3D modeli (vrećica zlatnika, čarobna knjiga), prikaz na minimapi; botovi ih skupljaju kad su blizu
  - 💬 **Brze poruke** (G pa 1–6) i 📍 **ping** (V) — suigrači vide stup svjetla s pribadačom i krugove na minimapi; botovi zovu pomoć kad su ranjeni i malo se pohvale nakon ubojstva; radi i u multiplayeru

- 🫏 **Kurir i 3D magije** (v0.14):
  - 🫏 **Kurir**: predmet kupljen daleko od baze (dalje od 900 od fontane) čeka u škrinji — u torbi je blijed s magarčićem i još ne radi. **Leteći magarac** tvog tima poleti s fontane, donese ga junaku i vrati se kući. Vratiš li se sam u bazu, predmete uzmeš odmah. Recepti rade i s dijelovima koji čekaju kurira. Na minimapi je 🫏, protivnički kurir se vidi samo kad nije u magli
  - 🧸 **novi Blender model kurira**: sivi magarčić s pernatim krilima (puna ploha + tri reda pera s plavkastim vrhovima), sedlom u boji tima sa zlatnim rubom, drvenim sandukom s okovima i draguljem tima, zastavicom, pilotskim naočalama, dugim ušima koje mrdaju i čupavim repom; animacije mirovanja (lagano mahanje) i leta (snažni zamasi, podvučene noge); sanduk zasja dok nosi predmete, iza krila ostaje trag iskri
  - 🌪️ **Vrtlog** (Lavko): oko junaka se digne zlatni prozirni **tornado** od spiralnih traka vjetra s lišćem i kamenčićima
  - 🔥 **Plameni krug** (Žarko): iz tla izbije **prsten plamenih jezika** koji treperi i ostavi nagoreno tlo
  - 🌩️ **Gnjev oluje** (Munja): nad Munjom se skupi **olujni oblak** i iz njega u nizu udaraju izlomljene **munje** s ograncima — ravno u pogođene protivnike
  - Zuja i Pipko više nemaju krzno na obrazima

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
  - 🌿 **Šumska grickalica** (3 lista, polako vraća život), 💧 **Plava kap** (mana, prekida je udarac junaka), 🧀 **Zmajeva poslastica** od drugog ubojstva Zmaja (+1500 života, +800 mane)
  - ✨ **3D**: svijetli **trag zamaha** pri svakom udarcu blizinskog junaka (drugi smjer kod drugog zamaha), **zlatnici** (Blender model) iskaču iz vojnika na last-hit, plavi štit iskri na kuli pod backdoor zaštitom

- 🌳 **Živa okolina i više složenosti** (v0.11):
  - 🌲 **novi Blender modeli okoline**: breze, panjevi, cvjetne krpice i busenje trave po cijeloj mapi, trska na obali i lopoči na rijeci, **kameni gazovi** gdje staze prelaze rijeku, **baklje** uz staze kod baza (noću svijetle), **šatori** u boji tima, bačve, sanduci i ograde u bazama, logorske vatre i svjetleći kristali uz kampove, veliko kamenje oko Zmajeve jazbine, putokazi — sve instancirano (jedan draw call po vrsti)
  - 🎓 **Talenti**: na levelima 10, 15, 20 i 25 biraš jedan od dva bonusa (+30 štete / +300 života, +15% brzine / −20% hlađenja, +60 štete / +650 života, +35% brzine napada / −15% hlađenja) — botovi biraju sami
  - 🕊️ **Svetišta** (DotA 7): po jedno u džungli svakog tima — ranjen junak stane uz njega i ono 5 s liječi cijeli tim u krugu, puni se 4 min
  - 🗿 **Kameni Golem**: novi neutralni kamp (po jedan na svakoj strani), svaki treći udarac omamljuje
  - 💪 **vojnici jačaju** svakih 7.5 min (+12% života i štete), kao u DotA
  - 🎯 auto-napad besposlenog junaka i dućan s kategorijama i preporukama (v0.10.1)

- 🐺 **Još junaka i DotA detalja** (v0.10):
  - 🐺 **5 novih junaka** (ukupno 20): **Sivko** 🐺 vuk (zavijanje koje jača tim, ugriz s krvarenjem, čopor, **Vučji oblik** — model naraste i zažari se), **Mrak** 🐦‍⬛ gavran (kletva — ukleti primaju više štete, **zamjena mjesta** s neprijateljem, krađa mane, jato gavranova koje ušutkava), **Pipko** 🐙 hobotnica (tinta — pogođeni promašuje, **pipci koji vuku** neprijatelje, sluzava koža, vrtlog dubina), **Rogo** 🦏 nosorog (**juriš** ravno kroz mapu dok ne zakači prvog, udarac rogom s odbačajem, debeli oklop, bijes), **Bambus** 🐼 panda (grom-pljesak, vrtoglavica, bambus, tri male pande)
  - 🛡️ **Glif utvrde** (tipka F): sve kule i vojarne tima 5 s neranjive, puni se 5 min — botovski tim ga sam koristi kad mu kula pada
  - 🍼 **Izvorska čutura** (3 gutljaja, puni se kod fontane), 🌫️ **Prah otkrića** (otkriva nevidljive, potroši se), 👁️ **Čarobno oko** (postavi oko u maglu rata), ☀️ **Sunčev kamen** (aura koja žari sve oko tebe)
  - 🌀 nove mehanike: kletva (više primljene štete), 😵 sljepoća (promašaji), 🏃 juriš, 💥 odbačaj i povlačenje (modeli odlete lukom), 🔁 zamjena mjesta, 😡 bijes (omama svakim udarcem), krađa mane
  - 🎬 **drugi zamah napada**: svaki treći udarac je drukčija animacija (mač, kandže, krila, čarolija); novi modeli vuka, gavrana (čarobnjački šešir), hobotnice (8 pipaka), nosoroga (rog i oklop), pande (bambus) te mlaza tinte i gavrana koji kruže nad zonom

- 🏚️ **DotA mehanike** (v0.9):
  - 🦔 **5 novih junaka** (ukupno 15): **Bodljo** 🦔 jež-tenk (kiša bodlji koja se slaže, ljepljiva sluz, bodlje natrag napadaču, juriš), **Tutnjo** 🐘 slon (topot koji omamljuje, surla-zamah, debela koža, timski stampedo), **Zuja** 🐝 pčela (otrovni ubod, roj, med koji liječi tim, golema košnica), **Mudra** 🦉 sova (huk koji ušutkava, Sovino oko kroz maglu rata, noćna ptica, **Vječna noć** usred dana), **Skakač** 🐵 majmun (rastezljivi štap, skok, kombo svaki 3. udarac, **Majmunska vojska** — 3 poziva koji se bore uz tebe)
  - 🤢 **otrov**, 🤐 **ušutkavanje** (ne možeš bacati moći) i 👑 **imunost na čarolije** kao novi statusi; 🤝 **asistencije** se broje (udarac u zadnjih 10 s prije ubojstva)
  - 🏚️ **Vojarne** iza 2. kule na svakoj stazi — neranjive dok kula stoji; kad padnu, protivnički vojnici na toj stazi postaju **💪 SUPER vojnici** (veći, jači, s aurom); baze su ograđene **zidinama**
  - 💸 **Otkup** (tipka O ili gumb na ekranu smrti): plati zlatom i vrati se odmah — botovi ga koriste kad je prijestol u opasnosti; 🛡️ **Zmajev štit** — tko ubije Zmaja dobiva jedno besplatno oživljavanje na licu mjesta (5 min)
  - 🪽 **Aktivni predmeti**: Skokne čizme (skok 600) i Kraljevski oklop (imunost 5 s) — tipke **1–6** ili lijevi klik na torbu; prodaja sada desnim klikom
  - 📋 **Tablica rezultata** (drži Tab): ubojstva / smrti / asistencije / level / zlato i predmeti svih 10 junaka; 👁️ Sovino oko se vidi na minimapi
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
- 🤖 **5 protiv 5** (od v0.37; prije 3 protiv 3): ti + 4 bota protiv 5 botova — sredina sama, na bočnim stazama po dvoje; botovi farmaju, koriste moći i ultije, uče vještine, slažu recepte, idu u džunglu, bježe teleportom
- 🦁 **27 junaka-životinja**: svaki ima ✨ **urođenu pasivu**, 4 aktivne moći (Q/W/E/R) i 🎓 **svoje talente**; ULTI se otključava na levelu 6
  - Lavko 🦁, Žarko 🐉, Ledena 🐧, Strijela 🦊, Listko 🐢, Munja 🐯, Skokica 🐸 (kuka jezikom!), Orlina 🦅, Luna 🐱 (Mirana-stil: Sveta strijela preko pola mape s omamom do 4 s + timska nevidljivost), Tragač 🦝 (Gondar-stil: sjena, podmukli udarci i Ucjena s bonus zlatom), Bodljo 🦔, Tutnjo 🐘, Zuja 🐝, Mudra 🦉, Skakač 🐵, Sivko 🐺, Mrak 🐦‍⬛, Pipko 🐙, Rogo 🦏, Bambus 🐼, Duga 🦄, Zubo 🦈, Nišan 🐿️ (Sniper-stil: dalekometna puška i Savršen hitac), Bikoš 🐂 (Axe-stil: Bojni zov i Smrtni udarac), Pecko 🦛 (Pudge-stil: Udica, Smrdljivi oblak i Veliki zalogaj), Inja 🐆 (Drow Ranger-stil: Ledene strijele i pasivni ulti), Škorpo 🦂 (Sand King-stil: Podzemni juriš, Pješčana oluja i Epicentar)
- 🐺 **DotA creep aggro**: creepovi se biju s creepovima, siege vojnici ruše građevine, a napadneš li junaka — njegovi creepovi (i kula!) okreću se na tebe na 2.3 s
- 🎯 **Indikatori moći**: lebdenje nad gumbom pokazuje domet i krug djelovanja, tooltipi pokazuju štetu za tvoj rang
- ⬆️ **Poeni vještina**: svaki level (do 18!) = 1 poen — Q/W/E po 3 ranga, ulti 3 ranga (leveli 6/11/16), plus 6 poena za 📊 atribute
- 💪🤸🧠 **Atributi kao u DotA**: Snaga (život), Okretnost (brzina + brzina napada), Inteligencija (mana) — glavni atribut daje štetu i raste svaki level
- 🛒 **Dućan s receptima**: kategorije kao u DotA (potrošno, napad, obrana, magija, čizme, legendarno) i **⭐ Preporučeno** — build za tvog junaka s oznakom 🎯 što kupiti sljedeće; torba sa 6 mjesta, aktivni predmeti, prodaja desnim klikom
- ⚔️ **Auto-napad kao u DotA**: junak koji stoji sam napada neprijatelje u dometu (junaci prvo, pa vojnici) — strijelci više ne čekaju klik
- 🎯 **DotA ciljanje**: prsten dometa + krug područja prije bacanja moći
- 🌫️ **Magla rata** — vid po jedinicama u zrakama (drveće i plato zaklanjaju pogled), noću kraći; gankovi rade u oba smjera
- 🌀 **Teleport** (T) — na svoju kulu/vojarnu (3,5 s) ili kući (T dvaput, 3 s); prekida se kretanjem/omamom
- 🐻 **Džungla**: 10 neutralnih kampova (veprići, vatreni vukovi, vukovi, 🗿 golemi, 🪨 kameni golemi) + 🐉 zmajčići + 🐲 **Veliki Zmaj** (boss — timski plijen, blagoslov i Zmajev štit)
- ✨ **Rune na rijeci** svake 2 minute • 🌙 **dan/noć ciklus** • 💪 veliki vojnik svaki 3. val
- 🗼 **Aggro kula**: napadneš li junaka ispod kule — kula gađa tebe! Na početku igre kule junacima rade dvostruku štetu
- 👑 Pobjeda rušenjem neprijateljskog prijestola (čuvarske kule prvo!)

## Kontrole

| Tipka | Radnja |
|---|---|
| 🖱️ klik | kreći se / napadni |
| Q W E R | moći (s prikazom dometa) |
| T | teleport (pa klik na svoju kulu; T dvaput = kući) |
| B | dućan |
| 1–6 | aktivni predmet iz torbe |
| O | otkup (kad si mrtav) |
| D / F | čarolije prizivača |
| Y | Glif utvrde (kule 5 s neranjive) |
| Tab | tablica rezultata |
| J | 💃 ples (i šaljiva replika) |
| A pa klik | napad u hodu; **A + klik na vojnika = samo jedan udarac** (zadnji udarac, v0.56) |
| S | stani (prekida i zamah udarca; junak ne napada sam dok ne dobije naredbu) |
| razmaknica | kamera prati junaka |
| strelice / miš uz rub / kotačić | kamera / zum |
| Esc | postavke |
| ⛶ gumb | cijeli zaslon (miš ostaje u igri; Esc ga otpusti) |
| P / M / H | pauza / zvuk / pomoć |

**👆 Na tabletu:** dodir = kreći se / napadni / gumb • povuci prstom = kamera • dva prsta = zum • 📋 tablica • 🎯 kamera na junaka • drži prst na predmetu = opis (1 s = prodaja).

## Tehnologija

Čisti JavaScript + [Three.js](https://threejs.org/) (r149, vendoran u `lib/` zajedno s GLTFLoaderom i RoomEnvironmentom) — bez build koraka.
`i18n.js` (jezik: `L('hrvatski', 'English')`, `data-en` atributi u HTML-u, pretvorba u srpski i ćirilicu) • `sr.js` (rječnik hrvatski → srpski) • `data.js` (junaci, predmeti, konfiguracija) • `voices.js` (glasovi junaka) • `game.js` (logika, AI, HUD) • `scene3d.js` (3D prikaz, modeli, animacije, čestice) • `net.js` (multiplayer) • `shop.js` (dućan, opisi) • `landing.js` (početni ekran) • `2d-verzija/` (originalna 2D verzija).

### 🗣️ Glasovi junaka (Fish Audio)

Replike su u [`voices.js`](voices.js) (svaki junak: Fish Audio glas + 9 replika na engleskom, uključujući `taunt` za ples; najavljivač `ANNOUNCER` s 32 najave; upute poput `[proud and heroic]` ili `<whisper>…</whisper>` govore glumcu kako da izgovori, a imena su napisana kako se izgovaraju na engleskom, npr. Zharko, Zooya). Zvuk je napravljen glumačkim modelom **drama-3** (čist i izražajan; s2.1-pro je na engleskom dodavao jeku). Linkovi generiranih datoteka su u [`tools/voice/urls.json`](tools/voice/urls.json) (stari hrvatski glasovi iz v0.32 ostaju u [`tools/voice/urls_hr.json`](tools/voice/urls_hr.json)), `python3 tools/voice/rec.py junak ključ=task_id …` dodaje nove, a `python3 tools/voice/gen.py` ih upisuje u `voices.js`. Igra ih zasad pušta izravno s Fish Audio poslužitelja (trajni linkovi); kad je pristup `*.fish.audio` dopušten, `python3 tools/voice/dl.py` preuzme sve u `assets/voice/<junak>/<replika>.mp3`, skrati tišinu, izjednači glasnoću i prebaci igru na lokalne datoteke (`VOICE_LOCAL = true`).

### 🧸 3D modeli (Blender)

![Sva 24 junaka iz Blendera — svaki u svojoj odjeći, s novim licima i krilima od perja (v0.53)](tools/blender/preview.jpg)

Svi modeli nastaju iz jedne skripte (`--dev-v55` brzo prikaže Pecka, Inju, Škorpa, udicu i nalet, `--dev-v52 --only=ledena,zarko` brzo prikaže odabrane junake bez izvoza, `--dev-v53 --only=sova,gavran --out=mapa` rendera njihove portrete izbliza, `--portraits-all` rendera svih 14 portreta iz modela): [`tools/blender/build_models.py`](tools/blender/build_models.py). Ona u Blenderu slaže modele od jednostavnih oblika (kugle, valjci, stošci, kocke s obrubom), boji ih bojama vrhova, slaže dijelove u hijerarhiju (noge, tijelo, glava, ruke, rep, krila) i animira ih (`idle`, `walk`, `attack`, `cast`), pa sve izveze u **`assets/models.glb`**. Uz jedinice i građevine tu su i projektili (`proj_*`), efekti moći (`fx_*`: meteor, korijenje, led, val, zvijezda, srce, duh, nadgrobni kamen) i rune (`rune_*`). Prije izvoza skripta **ispeče ambijentalnu okluziju** (Cycles, 24 uzorka, ~12 s za 157 objekata) izravno u boje vrhova, pa modeli imaju sjene u udubinama bez tekstura. Three.js ga učita, klonira model za svaku jedinicu i pušta animacije preko `AnimationMixer`-a (`idle`, `idle2`, `walk`, `attack`, `cast`, `channel`, `jump`, `hit`, `die`, `victory`); efekti koji se pojavljuju u velikom broju (kiša strijela, korijenje, srca, roj pčela, zidine) idu kao `InstancedMesh` — jedan draw call za sve primjerke. Ista skripta s `--portraits` rendera portrete novih junaka za ekran odabira.

```bash
# Blender 4.2+ / 5.x
blender -b -P tools/blender/build_models.py
# ili Blender kao Python modul (Python 3.13):  pip install bpy==5.2.2
python tools/blender/build_models.py            # --preview za render svih modela, --no-ao za brže iteracije
# zatim sažmi geometriju (Draco) — GLB ~4× manji, igra ga dekodira s lib/draco/
cd tools/compress && npm install && node compress.mjs
```

Svi oblici su **glatki**: sjenčanje je glatko svugdje, a oštro ostaje samo gdje se plohe lome jače od 40° (poklopci valjaka, rubovi krila, brušeni kristali). Kocke imaju zaobljene rubove, veće kugle i valjci više segmenata, krošnje i kamenje glatke izbočine, a ambijentalna okluzija se peče po vrhu pa su prijelazi mekani. Kompresija (`tools/compress/compress.mjs`, gltf-transform + Draco) napravi i `assets/models.js` (GLB i Draco dekoder kao base64) da igra radi i kad otvoriš `index.html` dvoklikom (`file://`). Ako se modeli ne učitaju, igra se vraća na jednostavne oblike i AI portrete.

Sajt se objavljuje automatski: Vercel je povezan s ovim repozitorijem i svaki push na `main` postaje nova produkcijska verzija.

UI je na hrvatskom/bosanskom. Napravljeno uz [Claude Code](https://claude.com/claude-code). 🤖
