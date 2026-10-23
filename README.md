# 🏰 DOTA Kids 3D ⚔️

Dječji DOTA All-Stars klon u 3D — kompletan mini-MOBA koji radi u pregledniku, bez instalacije. **v0.22: sređene animacije udaraca i magija — šteta pada točno kad oružje pogodi, strijele i kugle polijeću iz ruke, magije se bacaju pokretom ruku, a meta se trzne od udarca!** ⚔️✨💥

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
  - 🌿 **Tango** (3 lista, polako vraća život), 💧 **Bistrina** (mana, prekida je udarac junaka), 🧀 **Zmajev sir** od drugog ubojstva Zmaja (+1500 života, +800 mane)
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
- 🦁 **22 junaka-životinje**: svaki ima ✨ **urođenu pasivu** i 4 aktivne moći (Q/W/E/R); ULTI se otključava na levelu 6
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
# zatim sažmi geometriju (Draco) — GLB ~4× manji, igra ga dekodira s lib/draco/
cd tools/compress && npm install && node compress.mjs
```

Svi oblici su **glatki**: sjenčanje je glatko svugdje, a oštro ostaje samo gdje se plohe lome jače od 40° (poklopci valjaka, rubovi krila, brušeni kristali). Kocke imaju zaobljene rubove, veće kugle i valjci više segmenata, krošnje i kamenje glatke izbočine, a ambijentalna okluzija se peče po vrhu pa su prijelazi mekani. Kompresija (`tools/compress/compress.mjs`, gltf-transform + Draco) napravi i `assets/models.js` (GLB i Draco dekoder kao base64) da igra radi i kad otvoriš `index.html` dvoklikom (`file://`). Ako se modeli ne učitaju, igra se vraća na jednostavne oblike i AI portrete.

Sajt se objavljuje automatski: Vercel je povezan s ovim repozitorijem i svaki push na `main` postaje nova produkcijska verzija.

UI je na hrvatskom/bosanskom. Napravljeno uz [Claude Code](https://claude.com/claude-code). 🤖
