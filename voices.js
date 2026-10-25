/* 🗣️ Glasovi junaka (Fish Audio) — replike i glas svakog junaka
   Datoteke: assets/voice/<id junaka>/<ključ>.mp3
   Ključevi: pick (odabir), move1/move2 (hodanje), attack (napad na junaka), ult (ulti),
             kill (pobjeda nad junakom), death (pogibija), respawn (povratak u igru)
   Oznake u [zagradama] su upute za glumu (Fish Audio) — u oblačiću se ne prikazuju. */
const VOICE_KEYS = ['pick', 'move1', 'move2', 'attack', 'ult', 'kill', 'death', 'respawn'];
const VOICES = {
  vitez: { voice: 'aabfa168f35645af9aaa3cdaa442a66c',   // Hrvatski Muški Glas — dubok, samouvjeren
    pick: 'Lavko, hrabri vitez, spreman za boj!', move1: 'Naprijed, hrabro!', move2: 'Idemo, junaci!',
    attack: 'Za kraljevstvo!', ult: '[angry] Čujte kraljev urlik!', kill: 'Pravda pobjeđuje!',
    death: '[sighing] I lavovi ponekad padnu...', respawn: 'Lav se vraća, jači nego prije!' },
  zarko: { voice: 'f69639af4278450c88c7637ff9bd8a87',   // Živahan Bosanski Glas — brz, vatren
    pick: 'Žarko je tu! Tko je naručio vatru?', move1: 'Pazite, vruće je!', move2: 'Letim, letim!',
    attack: 'Ispeći ću te kao kokice!', ult: '[excited] Zmajev dah! Sve u plamen!', kill: '[laughing] Malo prepečeno!',
    death: 'Ajoj... ugasio sam se...', respawn: 'Plamen opet gori!' },
  ledena: { voice: 'e87d1b2fc7ed40d2940e69068b0ca726',  // Jasna Ženski Glas — mirna, hladna
    pick: 'Ledena. Ohladi se, stigla sam.', move1: 'Klizim!', move2: 'Brrr, baš lijep dan!',
    attack: 'Smrzni se!', ult: 'Ledeno doba počinje!', kill: 'Sad si ledena kocka.',
    death: '[sad] Topim se...', respawn: 'Hladna i spremna!' },
  strijela: { voice: '3aa01f629872471e8c8f2e41ffef16de', // Mlada Vlogerica — vesela, lukava
    pick: 'Strijela, najlukavija lisica u šumi!', move1: 'Tiho, kao lisica.', move2: 'Na putu sam!',
    attack: 'Na nišanu si!', ult: 'Sokolovo oko! Vidim te!', kill: 'Ravno u metu!',
    death: 'Ups... promašila sam.', respawn: 'Lisica se vratila!' },
  listko: { voice: 'af29d14bf4114c258e335370877ef67b',  // Mirni Muški Glas — spor i blag
    pick: 'Polako, ali sigurno. Listko je tu.', move1: 'Korak po korak.', move2: 'Idem ja, polako.',
    attack: 'Šuma se brani!', ult: 'Šumsko srce, izliječi nas!', kill: 'Priroda uvijek pobijedi.',
    death: '[sighing] Vrijeme je za drijemež...', respawn: 'Proljeće je! Opet rastem.' },
  munja: { voice: 'c1b35842f122421cae4e606236599f1c',   // Brzi muški glas — mlad, munjevit
    pick: 'Munja! Brži od groma!', move1: 'Juhu, brzina!', move2: 'Već sam tamo!',
    attack: 'Bljesak i bum!', ult: '[excited] Gnjev oluje! Grmi!', kill: 'Prebrzo za tebe!',
    death: 'Ajme, nestalo mi je struje...', respawn: 'Napunjen sam! Idemo!' },
  skokica: { voice: '9a67ac6a4d1a4be7925305b938b6c175', // Mladi Razigrani Glas — razigrana žabica
    pick: 'Kva-kva! Skokica skače u akciju!', move1: 'Hop, hop!', move2: 'Skok, skok, skok!',
    attack: 'Uhvatit ću te jezikom!', ult: 'Veliki val! Svi u vodu!', kill: '[laughing] Kva-ha-ha! Ulovljen!',
    death: 'Kvaaa... ajoj...', respawn: 'Iz lokve ravno u boj!' },
  orlina: { voice: 'b677d20c98ed4581bfd8fa46952cfa8c',  // Energična Radio Voditeljica — ponosna, glasna
    pick: 'Orlina! S visine vidim sve.', move1: 'Krila u vjetar!', move2: 'Letim iznad svih.',
    attack: 'Vidim plijen!', ult: 'Kralj neba! Sokoli, naprijed!', kill: 'Orlovom oku nitko ne pobjegne.',
    death: 'Pala sam s neba...', respawn: 'Opet sam u zraku!' },
  luna: { voice: '98ca6cee75754dc7939e0701d01f669f',    // Iwaly — tiha, tajanstvena
    pick: 'Mijau... Luna sja u noći.', move1: 'Tiho, kao sjena.', move2: 'Mjesec me vodi.',
    attack: 'Mjesečeva oštrica!', ult: 'Sakrijte se u mjesečevu sjenu!', kill: 'Mijau! Laku noć.',
    death: 'Mijau... još mi je ostalo osam života.', respawn: 'Novi život, ista mačka!' },
  tragac: { voice: '19468ccce84c4969b21ba097e849f228',  // Srpski muški glas — miran, lukav
    pick: 'Tragač. Za šaku zlatnika nađem svakoga.', move1: '[whispering] Pssst... tiho.', move2: 'Pratim trag.',
    attack: 'Ti si moja meta!', ult: 'Ucjena! Nagrada je moja!', kill: '[chuckling] Zlatnici su moji!',
    death: 'Netko me... pronašao...', respawn: 'Natrag u sjenu.' },
  jez: { voice: '1849186a8a824dc892c6b38348d8141b',     // Hakala — hrapav, gunđalo
    pick: 'Bodljo! Ne diraj, bode!', move1: 'Dobro, dobro, idem.', move2: 'Kotrljam se!',
    attack: 'Evo ti bodlji!', ult: '[angry] Juriš bodlji! S puta!', kill: 'Rekao sam ti da bode!',
    death: 'Joj, moje bodlje...', respawn: 'Bodlje su opet oštre!' },
  slon: { voice: 'd7dc6b903e89473b9000d06a872ca70c',    // Stariji Muški Glas — dubok, polagan
    pick: 'Tutnjo... velik i jak... čuvam prijatelje.', move1: 'Bum... bum... bum...', move2: 'Tutnjim naprijed.',
    attack: 'Surla-zamah!', ult: '[angry] Stampedo! Zemlja se trese!', kill: 'Slon nikad ne zaboravlja.',
    death: 'Uuuh... pao sam kao planina.', respawn: 'Zemlja opet tutnji!' },
  pcela: { voice: '372916154fc34a1ab32440a8a21efed4',   // Veseli Ton — visok, zujav
    pick: 'Zuja je tu! Bzzz!', move1: 'Zuj-zuj, letim!', move2: 'Bzzz, bzzz!',
    attack: 'Bzzz, ubod!', ult: 'Košnica! Sestrice, u napad!', kill: 'Med za mene, ubod za tebe!',
    death: 'Bzzz... umorna sam...', respawn: 'Zuja opet leti!' },
  sova: { voice: '1c4e7186b4434469a6d0662e5d087bd5',    // Iskusni Hrvatski Glas — mudra bakica
    pick: 'Hu-hu... Mudra zna sve tajne noći.', move1: 'Tiho letim kroz noć.', move2: 'Hu-hu.',
    attack: 'Noć te gleda!', ult: 'Vječna noć! Neka padne mrak!', kill: 'Mudrost uvijek pobijedi.',
    death: 'Hu... vrijeme je za spavanje.', respawn: 'Noć se vraća, a s njom i ja.' },
  majmun: { voice: 'eba55f2395364f1b99e3d0a6c51d2897',  // Razigrani Mladi Gnom — vragolan
    pick: 'Hi-hi-hi! Skakač, kralj grana!', move1: 'Hop na granu!', move2: 'Hi-hi, idemo!',
    attack: 'Štap-udarac!', ult: 'Majmunska vojska! Svi za mnom!', kill: '[laughing] Pazi na koru od banane!',
    death: 'Ajoj, pao sam s grane...', respawn: 'Tko je za banane? Vratio sam se!' },
  vuk: { voice: '1b0fc5ff0d784c8fa1c1c97f56f1e216',     // Duboki Hrvatski Glas — hrapav vođa čopora
    pick: 'Sivko vodi čopor! Auuu!', move1: 'Čopore, za mnom!', move2: 'Njušim trag.',
    attack: 'Grrr... napad!', ult: 'Vučji oblik! Auuuu!', kill: 'Čopor je jači!',
    death: 'Joj... rep mi se spustio...', respawn: 'Vuk se vraća čoporu!' },
  gavran: { voice: '7f141a660d4e4ee3aeaa2b562d9384bc',  // Bosanski Autoritet — dubok, dramatičan
    pick: 'Kra! Pao je mrak... i ja s njim.', move1: 'Kra, kra.', move2: 'Sjene me nose.',
    attack: 'Kletva na tebe!', ult: 'Jato gavranova! Zamračite nebo!', kill: 'Kra-ha-ha-ha!',
    death: 'Kraaa... nije fer...', respawn: 'Iz tame... ponovno.' },
  hobotnica: { voice: '91526c9cbb5841858a34cb87ae739e89', // Profesionalni Muški Glas — svečani najavljivač
    pick: 'Pipko, vladar dubina! Osam ruku, nula problema!', move1: 'Plup, plup!', move2: 'Klizim po sluzi!',
    attack: 'Mlaz tinte!', ult: 'Vrtlog dubina! Svi u vrtlog!', kill: 'Zagrljaj pipaka nitko ne izbjegne!',
    death: 'Blub... blub...', respawn: 'Vratio sam se iz dubina!' },
  nosorog: { voice: 'b07db1ba849245a4b22aa40919b1ed2c', // Dubok Autoritativan Glas — glasan, jurišnik
    pick: 'Rogo! Nitko me ne može zaustaviti!', move1: 'Makni se s puta!', move2: 'Jurim!',
    attack: 'Juriš!', ult: '[angry] Bijes! Sad sam stvarno ljut!', kill: 'Rog je pobijedio!',
    death: 'Uff... netko me zaustavio...', respawn: 'Ništa me ne zaustavlja!' },
  panda: { voice: 'a5dcf9251b26443c920c96064e9b0e2b',   // Smiren muški glas — mirni majstor
    pick: 'Bambus. Mir, bambus i malo kung-fua.', move1: 'Polako, polako.', move2: 'Njam, njam, bambus.',
    attack: 'Grom-pljesak!', ult: 'Tri pande! Prvo mir... pa bum!', kill: 'Mir je uvijek bolji.',
    death: 'Mmm... samo malo drijemam...', respawn: 'Naspavan i spreman.' },
  jednorog: { voice: '259d659111b14a00b56d88dba425abd7', // Fll — vesela, čarobna
    pick: 'Duga! Šarena i čarobna!', move1: 'Galopiram!', move2: 'Tra-la-la!',
    attack: 'Dugin snop!', ult: '[excited] Zvjezdani galop! Jurimo zajedno!', kill: 'Bljesak duge!',
    death: 'Ajoj, izblijedjela sam...', respawn: 'Duga je opet na nebu!' },
  morskipas: { voice: '304e7996831044b5af4f189370cc60b3', // Dubok Muški Glas — gladan i hrapav
    pick: 'Zubo! Gladan sam!', move1: 'Njušim nešto fino!', move2: 'Plivam, plivam!',
    attack: 'Velik zalogaj!', ult: 'Pomama! Sad grizem sve!', kill: 'Njam! Fino!',
    death: 'Ajoj... zubići su me izdali...', respawn: 'Još sam gladan!' },
};
