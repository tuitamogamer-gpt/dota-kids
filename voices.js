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
/* @remote — Fish Audio linkovi (tools/voice/gen.py iz urls.json); redom kao VOICE_KEYS.
   Kad su datoteke preuzete u assets/voice/ (tools/voice/dl.py), VOICE_LOCAL = true. */
const VOICE_LOCAL = false;
const VOICE_REMOTE_BASE = 'https://platform.r2.fish.audio/tasks/2026-10-25/';
const VOICE_REMOTE = {
  vitez: 'aef79d2dada044a4a895fd248698760c 9342737bc3f74975be6fda7841af6164 ca6748fc69fa47f2ab5e82807a4ec1ab fd1cd3df1a7a4657896e0397150dcaa3 d9d1638b0c9d4aa3b3c77cdba35d3e7a 89a13e25645c4e38bfbb25c9734fde18 31eedcc2aca34d8296efc6883df51f51 2d0cd9ff5e4e47bb9957006c0ed217a1',
  zarko: '9d6bcf6744764d0eb8b5278bb9efad94 56a0326c405b48dfbd9514a72303fcd2 017ec55ddc3c4d848ebe5a23fc182973 eabcbdc3544f40f59da7665e57d4cd2a ca663921cb304ea1bd48c5efb448cc0e b087cdd8d89640f58086c8c38155f654 81b03ef94f9445c7bfa47be1a87a4385 f872d311c2d54d36b96f989e2a4f6163',
  ledena: '204789c3942c471ab7b45efb2ba5abe9 5bc4523f34504cbf949de167fd167b0f 89049e7cc0c44ef48ffb7a04508abeec b3d34c0628bc43f0bd1d83a460513590 6114508f1ecb44cd967f340e824df59c 977f4af4c6694bbc8609a7795c088a6e 50b6b86bce614196b433e32bb1358d55 0a43ca7926d74c35928da84a8a97313a',
  strijela: '3f0ec6710c7d4495a1ebf366731e175c 5e06de314f624d3683b1b32bc80db0f6 0bd839a8791b433996a940ed126a758e 7a8b7e55f7bc4986aba35352b1d51b6d ae374d75d02b45a5919d36c004a8af5c f041cde942b44749b508f9d20b00a6f2 bbdb691030fe4a4984059d6f374dda56 d7478d7a63254f71a974c70c2d9f1fa3',
  listko: 'f096c96a311c4da5ac5da82af583a91d 9b061242630e4485965263915c5146db 6430115b56a645889cc0c7cdf4da54f7 0ffb6364325a4fd1a03c763a1f5a1f83 cd68ce45c7c747c39359f08b8b215077 65fbad5945d143a2a089a6672cca6f7d 36cfc777e1e44e20aa090a6f03cc911b c013a92e1fec4f79b4bbf9abc8b299e1',
  munja: '3702a07ba8954674ad5c2ab8e4f41b5a a84b0dff683f4b7da9e0006efe14e6cc 06944f48c27141e8a65bd6ef821a2b69 16346e2c5a79439bbe4f3a52c512de85 1c75b33e2923442a8dfb5a282cf18d01 bbabb346aaea4e28a55f6cf3e90aacc5 a6ad2b44f43e4f5cb7499a794adf8da4 b435a37f16404c9ba974b0e13c02eacc',
  skokica: 'f248eaff5f7c4eab95b064a4343720ff c98813ddeadb4cbfb3f8efe92456c37b 6475315218c84f80a51e20f1c98cf574 1b08d093ab444f50b74569020c522ff9 565bd82cafa840d88c1c1231d77519e0 3a61651e30704cdd853f24abbacbb113 65b8d803a55740a5a7c77d30a9f588e9 1aa07ace10cd44febd64d9a5256140e5',
  orlina: '73bd2af427e3491893dda225671316b8 acaf428feafe4125a5f9b614c4cac838 f98048ed18de45e7b41052bd9f5b9375 07341d5ada264fdb96f1f22495907b5e a453a2b479654da2affa9b0573918672 82901876ee45468ca31d53b4ea04459d 86ccc8bee04948ecaecb9777fe9d4c24 0284e6cc0f6d4be3ba657a2ef61bcdb7',
  luna: '799d64921a334de5bd4fc9bd1bdb4fa8 f85654583f444a189075c2b20101bc8b 9e7e1a8ddce94c95916e67ab9047822a 7c11da61d4624a8aab2267fdbec6bc09 96e2a387af2d4b4e9cac34d52ac17ac3 7acf19e3e94f44deb4119c049d29b594 82dc32198c67454682b61f9bef88d1c9 7104b8cad2374e9aa10f281d8c4dad17',
  tragac: 'cd2e566649994422b7be6fab91853e48 f31dfbbaa93342fbba8bddb9c60f3655 2f1fe2bfca044916a7e9c2401270fd56 73eb7464d1f44135b3d9f4556fc14f18 d17d5e9d3e9341a1a09eeaa6db365c45 42e1823c30394e29bd3195cc5b0d3ef7 7119fa8ac3804eee88c4117d180da3bb 7d1b316f096a4bc98899a3593fd594a7',
  jez: '9f8f4d8fbb6847418494742b12a50581 bb55103489f84ee695cc49472abcaddd f9e17b1cfb6c4d39afd13cfeb719f14b b7fe399e32e546d2a721133ac3a253b0 7d6a59b08ef248a4a31233b64520fd6d a4a1e6535f58448a96c9898374c433c3 39a28073f5654afdb88ac9902b3302a6 95cab2f0df1f4e7facf0f638471a293a',
  slon: '0cc749e2c0a446bb8907dbefc867840f 408aab3223934fce95e554171d72af27 39c890345f45409d975df72c1d5a2077 bb8d2b29145f42d0bf1f1cf040b11f12 9df6f79f543f482cbbbc452e73115bd9 a75435d46ca14e8ba5cc6de79a382047 0c825836c4674c09a045a59c166a4a3c bf71ad7c533c451c9279dea8a57390c7',
  pcela: 'd86d290014fd43e6bdf58c3809a58c3a 0725e2d22bec453aa55e846fa186b1c6 538e033f86e24c1791ee6db95bd73e8a 63a377dfcd7c44daa56b364c22677be0 15e0da66132c4e549d9250af785078a6 398c90f8923f4e51b5c8207322484496 577a336ce560436db11f3d327a8ccb14 16077768bddc412bab40412254991c4e',
  sova: 'fe75579c23954be2a43a5db57d9202f8 e4e48ba8e77d4b6ebd68ce1deca368d6 ab8d0fc17d14404180bdd6591a6d6639 02a1f82eb3644a4da51b71741f61aecb fa0a93c7c796446daa09a2d6065dade5 e4c43655b79749dbb7a1166b4f09e208 0b1d25eca23e41b3b92fde810d8f0b82 af85a10d5b9c4f82b9b352ae8e0b0679',
  majmun: 'a8b74c9e57b54ced85d68e8d72927d62 421e3d706e1f4ca2891b5d904da6b22e 76bd374f08254fa48d93ecc8bb5f65a4 22b1597ca0b84bbba8ae7c5861d8f460 e34f83de83e34074ba12d6e6c1fe5c6d 53c7146821d34d5aa2d66a1628785e5f 7bb71214f628469abe8113760e3587ba 257a2ae92db54ea891a1c3d8acee274c',
  vuk: 'f3047bb0e86f422794c111f3f95ccde3 1ebce2fa152d4147a1fc9af4780f86ef ed8b2b495ea843d1808ca4438ca9b99b f6d4ee53132f47d49b20776f87dd6d21 14f828f28f0348969594ff76d25c712c 5b232893d3574ce7bec1cd4fdd49da42 7da37a65d6764d499d2aea700cac0782 6b1128bf09194daba503da9647696e87',
  gavran: 'c18f20468fe14cba83c83b2b3058b68b 0b6627715fc04f3ca9ef1c601ce723de c8996184e7564bf5b3aa1f805c78ca42 70ca46f1c77c48bd9d2cf07c6625005e cf416feba0d54121a464685f901bfc66 7ea678ab2f3e436792d3a1801afdd59c d7645d555724416f859be6d7f4fc022d 48921461d40847fb89965759d612b6cd',
  hobotnica: '3295e038a3e34c0394d7bb6a9c0f8369 38378ef68d2f4489b95256a3680fa34f b6aea535aff442e28b557775fe4612c6 767a6a39be874818be40ff2c5883a448 f825040427424df6882ae5131b636e7f 64d846e5f5e8432cb213a1cf5867c1b9 457bf93e38574b9990a8918fe36366fd b11425bca6c24d4d8bd71ef8583a62a0',
  nosorog: 'c8cc45913fae497c9a1cab37c0c5fc84 906dec58c53a493689cb321b20c09ff2 79c261c3fb9c4d949532fe45f93b4d15 70f50e96fc164fe8a89de5580c53afd5 41e6e3774ae2499daf89b8b9e66d0f43 ac6e84139d594e1a9b67963cb2c25ce2 7bad7aa9fbe243a18a7e4b2c4fbbe20c d1c9f2ba57824a1eb84c8c5089f73911',
  panda: '894b7f3c4a73444dbef13fa4584f1b9d eb7fe996222547b2b94f5dc5850876cb 2c0041cb396c40009b649105953fd0d4 88b7e00c3538456fabe44cbc8ba600e4 9619fd7fa29c4cfbbdbf9c350c7026d7 8d733c7478cc4822b33e714ebc3e6420 41a6fdd2380645d5ae043a9a6f8bfe8f cdddf8fed241426c9e7f7212b21c1e91',
  jednorog: '78ef5801a9c14a46b59fb70f91f662bd b0b9c4cbd2ec49c9b46e04038c4f0d11 1009fd68d242486e9c5f7d95022a1282 9dfeb9c3a3f844fabd1a81b70078b6e3 4b3d32dde5f341f8a39dc6fefc70180e 0c494eb3f1e3468cabec9ce9e788003f 1ec38a39afb04471b61f7413cbf0899f be8a3bc5a15b45d4951631b627d66a49',
  morskipas: 'b91e197df31847bb93611cbda8895482 f904a38cee404dd3b4703892d050e2c4 2cc38608b61a43488dc10146f50988f6 98d4149c66e642d39b80b58a39b36e83 50405450e7474170b2c7c20c52ad5eb8 0ca38cfe5da84a2992e532baaafdc5b3 6165ce23856a4bb1a81275ed96fffe1d 17dffc03f68242ba83f4132a0de22d21',
};
