/* 🗣️ Glasovi junaka (Fish Audio, engleski) — replike i glas svakog junaka
   Datoteke: assets/voice/<id junaka>/<ključ>.mp3
   Ključevi: pick (odabir), move1/move2 (hodanje), attack (napad na junaka), ult (ulti),
             kill (pobjeda nad junakom), death (pogibija), respawn (povratak u igru),
             taunt (ples — tipka J)
   [Upute u zagradama] govore glumcu (model drama-3) kako da izgovori repliku; imena su
   napisana kako se izgovaraju na engleskom (Zharko, Munya, Zooya…). */
const VOICE_KEYS = ['pick', 'move1', 'move2', 'attack', 'ult', 'kill', 'death', 'respawn', 'taunt'];
const VOICES = {
  vitez: { voice: '536d3a5e000945adb7038665781a4aca',   // Ethan (Fish Official) — plemenit, junački
    pick: '[proud and heroic] Lavko the brave, ready for battle!', move1: '[confident] Onward!', move2: '[rallying] Forward, heroes!',
    attack: '[battle cry] For the kingdom!', ult: "[mighty roar] Hear the king's roar!", kill: '[triumphant] Justice wins!',
    death: '[weak, fading] Even lions fall...', respawn: '[strong and proud] The lion returns, stronger than ever!',
    taunt: '[playful and proud] Ha! Even my mane can dance!' },
  zarko: { voice: '802e3bc2b27e49c2995d23ef70e6ac89',   // Energetic Male (Fish Audio) — mlad, vatren
    pick: "[cocky and fiery] Zharko's here! Who ordered fire?", move1: "[playful] Watch out, it's hot!", move2: '[excited] Flying in!',
    attack: "[cocky] You're toast!", ult: "[shouting] Dragon's breath! Feel the heat!", kill: '[laughing] A little overcooked!',
    death: '[sad, fizzling] Aww... my flame went out...', respawn: "[pumped] The fire's back!",
    taunt: '[cocky] Too hot to handle!' },
  ledena: { voice: 'b347db033a6549378b48d00acb0d06cd',  // Selene (Fish Official) — mirna, hladna
    pick: "[cool and calm] Ledena. Chill out, I'm here.", move1: '[light] Sliding!', move2: '[amused] Brrr, lovely weather!',
    attack: '[icy] Freeze!', ult: '[powerful] The Ice Age begins!', kill: "[smug] You're an ice cube now.",
    death: "[sad] I'm melting...", respawn: '[cool] Cool and ready!',
    taunt: "[cool and teasing] Chill out. I've got this." },
  strijela: { voice: '9a9cf47702da476aa4629e2506d4a857', // Hannah (Fish Official) — lukava, samouvjerena
    pick: '[sly and playful] The slyest fox in the forest!', move1: '[sneaky] Quiet as a fox.', move2: '[cheerful] On my way!',
    attack: '[focused] Got you in my sights!', ult: "[intense] Falcon's eye! I see you!", kill: '[proud] Bullseye!',
    death: '[embarrassed] Oops... I missed.', respawn: '[happy] The fox is back!',
    taunt: '[teasing] Missed me? Everybody does.' },
  listko: { voice: '291a58aa51a94326aed08115c06f0e09',  // Old Wizard — spor, topao djed
    pick: '[slow and kind] Slow and steady... Listko is here.', move1: '[slow] Step by step.', move2: '[gentle] Going, slowly.',
    attack: '[firm] The forest fights back!', ult: '[warm and powerful] Heart of the forest, heal us!', kill: '[calm] Nature always wins.',
    death: '[sleepy sigh] Time for a little nap...', respawn: '[cheerful] Spring is here! Growing again.',
    taunt: '[slow, chuckling] Slow and steady... still winning. Heh heh.' },
  munja: { voice: 'b5f4515fd395410b9ed3aef6fa51d9a0',   // Alex — brz i poletan
    pick: '[fast and excited] Munya! Faster than thunder!', move1: '[thrilled] Woohoo, speed!', move2: '[quick] Already there!',
    attack: '[fierce] Flash and boom!', ult: "[shouting] Storm's fury! Thunder!", kill: '[teasing] Too fast for you!',
    death: '[tired] Aww, out of power...', respawn: "[energized] Fully charged! Let's go!",
    taunt: "[fast and excited] Zoom zoom! Can't catch me!" },
  skokica: { voice: '091cad5003ed4e90826a92e1fadde278', // Gigi — razigrana žabica
    pick: '[bubbly] Ribbit! Skokitsa hops into action!', move1: '[bouncy] Hop, hop!', move2: '[giggly] Boing, boing!',
    attack: '[playful] My tongue will catch you!', ult: '[excited shout] Giant wave! Everybody in the water!', kill: '[giggling] Ribbit! Gotcha!',
    death: '[sad croak] Riiibbit... oh no...', respawn: '[cheerful] Back from the pond!',
    taunt: '[giggly] Ribbit! Wanna see me hop?' },
  orlina: { voice: 'e9b134e4c0b547a3894793be502314f1',  // Jasphina — ponosna, glasna
    pick: '[proud] Orlina! I see everything from up high.', move1: '[soaring] Wings to the wind!', move2: '[confident] Soaring above!',
    attack: '[sharp] Prey spotted!', ult: '[commanding] King of the sky! Falcons, attack!', kill: '[proud] No one escapes the eagle eye.',
    death: '[falling, sad] I fell from the sky...', respawn: '[joyful] Back in the air!',
    taunt: '[proud] Look up! The sky is mine!' },
  luna: { voice: '933563129e564b19a115bedd57b7406a',    // Sarah (Fish Official) — tiha, tajanstvena
    pick: '[soft and mysterious] Meow... Luna shines in the night.', move1: '[whisper] Silent as a shadow.', move2: '[dreamy] The moon guides me.',
    attack: '[sharp] Moon blade!', ult: "[mystical] Hide in the moon's shadow!", kill: '[purring] Meow! Good night.',
    death: '[soft sigh] Meow... I still have eight lives left.', respawn: '[playful] New life, same cat!',
    taunt: '[soft, purring] Purrr... pet me later.' },
  tragac: { voice: 'c5f56a6cc2ec4fa8920cb4c5889a3fb7',  // Slax — miran i lukav
    pick: '[sly and smooth] The Tracker. For a handful of gold, I find anyone.', move1: '<whisper>Shhh... quiet.</whisper>', move2: '[low] Following the trail.',
    attack: "[cold] You're my target!", ult: '[satisfied] Bounty! The reward is mine!', kill: '[chuckling] The gold is mine!',
    death: '[surprised, weak] Someone... found me...', respawn: '[quiet] Back to the shadows.',
    taunt: '<whisper>Shhh... nobody saw that dance.</whisper>' },
  jez: { voice: 'f8dfe9c83081432386f143e2fe9767ef',     // BOOK RECORD REGULAR — hrapav gunđalo
    pick: "[grumpy] Bodlyo! Don't touch, I'm prickly!", move1: "[grumbling] Fine, fine, I'm going.", move2: '[grumpy] Rolling!',
    attack: '[annoyed] Have some spikes!', ult: '[angry shout] Spike charge! Out of my way!', kill: '[smug] I told you I was prickly!',
    death: '[groaning] Ouch, my spikes...', respawn: '[gruff] Spikes are sharp again!',
    taunt: "[grumpy] Hmph. No hugs. I'm spiky." },
  slon: { voice: 'bf322df2096a46f18c579d0baa36f41d',    // Adrian (Fish Official) — dubok, polagan
    pick: '[slow, deep and rumbling] Tootnyo... big and strong... I protect my friends.', move1: '[slow and heavy] Boom... boom... boom...', move2: '[deep] Rumbling forward.',
    attack: '[mighty] Trunk swing!', ult: '[thunderous shout] Stampede! The ground shakes!', kill: '[calm and deep] An elephant never forgets.',
    death: '[slow groan] Oooh... down like a mountain.', respawn: '[deep and strong] The ground rumbles again!',
    taunt: '[deep and amused] Toot toot! Big dance, big earthquake!' },
  pcela: { voice: '15742afadec44b82bf52f7bb62b83f83',   // Twinko — visok, zujav
    pick: '[high-pitched, buzzy and hyper] Zooya is here! Bzzz!', move1: '[buzzy] Bzz-bzz, flying!', move2: '[humming] Bzzz, bzzz!',
    attack: '[cheeky] Bzzz, sting!', ult: '[excited shout] The hive! Sisters, attack!', kill: '[giggly] Honey for me, a sting for you!',
    death: '[sleepy] Bzzz... so sleepy...', respawn: '[cheerful] Zooya flies again!',
    taunt: '[buzzy and hyper] Bzzz! Honey dance time!' },
  sova: { voice: 'e3cd384158934cc9a01029cd7d278634',    // Laura (Fish Official) — mudra i topla
    pick: '[wise and mysterious] Hoo-hoo... Mudra knows all the secrets of the night.', move1: '[soft] Flying silent through the night.', move2: '[gentle] Hoo-hoo.',
    attack: '[ominous] The night is watching you!', ult: '[commanding] Eternal night! Let darkness fall!', kill: '[calm] Wisdom always wins.',
    death: '[sleepy] Hoo... time to sleep.', respawn: '[warm] The night returns, and so do I.',
    taunt: '[wise and amused] Hoo hoo! Wisdom says... dance!' },
  majmun: { voice: '711cf3ed00ab441a8f54a45058047b7a',  // Verity — vragolan
    pick: '[cheeky giggle] Hee-hee-hee! Skakach, king of the trees!', move1: '[playful] Up the branch!', move2: "[giggling] Hee-hee, let's go!",
    attack: '[excited] Staff smash!', ult: '[shouting] Monkey army! Follow me!', kill: '[laughing] Watch out for banana peels!',
    death: '[whiny] Oops, fell off the branch...', respawn: "[cheerful] Who wants bananas? I'm back!",
    taunt: '[mischievous] Ooh ooh, ah ah! Banana break!' },
  vuk: { voice: '80d671cd611e4bf2813816b68810b052',     // Monster — dubok, režeći
    pick: '[growling] Sivko leads the pack! Awooo!', move1: '[commanding] Pack, follow me!', move2: '[sniffing, low] I smell a trail.',
    attack: '[snarling] Grrr... attack!', ult: '[howling] Wolf form! Awoooo!', kill: '[proud growl] The pack is stronger!',
    death: '[whimpering] Ow... my tail droops...', respawn: '[fierce] The wolf returns to the pack!',
    taunt: '[growly but playful] Awooo! The pack loves to dance!' },
  gavran: { voice: '98544e744e754814a6aa22229f63f475',  // horror voice narrator 2 — mračan, dramatičan
    pick: '[dark and dramatic] Caw! Darkness has come... and so have I.', move1: '[low] Caw, caw.', move2: '[mysterious] The shadows carry me.',
    attack: '[sinister] A curse upon you!', ult: '[dramatic shout] Flock of ravens! Darken the sky!', kill: '[evil laugh] Caw-ha-ha-ha!',
    death: '[whiny] Caaaw... not fair...', respawn: '[ominous whisper] From the darkness... again.',
    taunt: '[dark and dramatic] Caw! Behold my... spooky moves.' },
  hobotnica: { voice: '4d78f878f023424cb77975a6dea180a6', // Pirate — gusarski kapetan dubina
    pick: '[boisterous] Pipko, ruler of the deep! Eight arms, zero problems!', move1: '[goofy] Bloop, bloop!', move2: '[jolly] Sliding on slime!',
    attack: '[gruff] Ink blast!', ult: '[booming] Whirlpool of the deep! Everyone in!', kill: '[hearty laugh] No one escapes my tentacle hug!',
    death: '[gurgling] Blub... blub...', respawn: '[jolly] Back from the deep!',
    taunt: '[jolly pirate] Arr! Eight arms, eight times the dancing!' },
  nosorog: { voice: '4c6a6762e4ac4bdebdb4fa8525d054a2', // ATOMIC — glasan jurišnik
    pick: '[loud and tough] Rogo! Nobody can stop me!', move1: '[gruff] Out of my way!', move2: '[pumped] Charging!',
    attack: '[battle shout] Charge!', ult: "[furious] Rage! Now I'm really mad!", kill: '[triumphant] The horn wins!',
    death: '[dazed] Oof... someone stopped me...', respawn: '[loud] Nothing can stop me!',
    taunt: '[loud and cheerful] Make way! Dance charge!' },
  panda: { voice: '0b74ead073f2474a904f69033535b98e',   // CALM- NORMAL — mirni majstor
    pick: '[calm and relaxed] Bambus. Peace, bamboo, and a little kung fu.', move1: '[relaxed] Easy, easy.', move2: '[content, munching] Nom, nom, bamboo.',
    attack: '[focused] Thunder clap!', ult: '[calm, then powerful] Three pandas! First peace... then boom!', kill: '[serene] Peace is always better.',
    death: '[sleepy] Mmm... just a little nap...', respawn: '[refreshed] Well rested and ready.',
    taunt: '[calm and sleepy] First a dance... then a nap.' },
  jednorog: { voice: 'b545c585f631496c914815291da4e893', // Friendly Women (Fish Audio) — vesela, čarobna
    pick: '[sparkly and sweet] Duga! Colorful and magical!', move1: '[cheerful] Galloping!', move2: '[singsong] Tra-la-la!',
    attack: '[bright] Rainbow beam!', ult: "[excited] Star gallop! Let's run together!", kill: '[happy] Rainbow flash!',
    death: "[sad] Oh no, I'm fading...", respawn: '[joyful] The rainbow is back in the sky!',
    taunt: '[sparkly] Sparkle sparkle! Rainbows for everyone!' },
  morskipas: { voice: 'b0f79e4bac084142a2ca8266bd959ae5', // Grandpa — gladan i hrapav
    pick: "[hungry and menacing] Zoobo! I'm hungry!", move1: '[sniffing] I smell something tasty!', move2: '[playful] Swimming, swimming!',
    attack: '[growling] Big bite!', ult: '[frenzied] Frenzy! Now I bite everything!', kill: '[satisfied] Yum! Delicious!',
    death: '[groaning] Ow... my teeth gave up...', respawn: '[hungry] Still hungry!',
    taunt: "[chuckling] Heh heh! Smile! I've got a hundred teeth!" },
};
// 📣 najavljivač (kao u DotA/LoL): assets/voice/ann/<ključ>.mp3; "ours"/"enemy" ovisi o tvom timu
const ANNOUNCER = { voice: '92e3ee13d7524fee904324e350a532a0',   // Epic Game Announcer — dubok, gromki
  welcome: '[epic booming announcer] Welcome to Dota Kids!', battle: '[epic booming announcer, rousing] Let the battle begin!',
  first_blood: '[epic booming arena announcer, hyped] First blood!',
  double_kill: '[hyped] Double kill!', triple_kill: '[very hyped] Triple kill!', ultra_kill: '[shouting, thrilled] Ultra kill!',
  rampage: '[shouting with huge excitement] Rampage!',
  killing_spree: '[excited shout] Killing spree!', dominating: '[excited] Dominating!', mega_kill: '[shouting, hyped] Mega kill!',
  unstoppable: '[hyped] Unstoppable!', incredible: '[amazed and hyped] Incredible!', monster_kill: '[shouting, hyped] Monster kill!',
  godlike: '[shouting, hyped] Godlike!', beyond_godlike: '[roaring, ecstatic] Beyond godlike!',
  shutdown: '[dramatic shout] Shut down!', ace: '[triumphant shout] Ace!',
  tower_enemy: '[triumphant] Enemy tower destroyed!', tower_ours: '[urgent warning] Our tower has fallen!', tower_denied: '[smug] Tower denied!',
  barracks_enemy: '[triumphant] Enemy barracks destroyed!', barracks_ours: '[urgent warning] Our barracks has been destroyed!',
  throne_enemy: '[excited] The enemy throne is open! Attack!', throne_ours: '[urgent alarm] Our throne is in danger! Defend it!',
  dragon_ours: '[triumphant] Our team has slain the Great Dragon!', dragon_enemy: '[alarmed] The enemy has slain the Great Dragon!',
  drake_ours: '[pleased] Our team has slain a drake!', drake_enemy: '[concerned] The enemy has slain a drake!',
  night: '[mysterious, low] Night falls...', day: '[warm, uplifting] The sun rises!',
  victory: '[triumphant, booming] Victory!', defeat: '[solemn] Defeat...',
};
const ANN_KEYS = Object.keys(ANNOUNCER).filter(k => k !== 'voice');
/* @remote — Fish Audio linkovi (tools/voice/gen.py iz urls.json); redom kao VOICE_KEYS (datum/id).
   Kad su datoteke preuzete u assets/voice/ (tools/voice/dl.py), VOICE_LOCAL = true. */
const VOICE_LOCAL = false;
const VOICE_REMOTE_BASE = 'https://platform.r2.fish.audio/tasks/';
const VOICE_REMOTE = {
  vitez: '2026-10-25/0c852e8374f3443bbe1a9a6b36276d31 2026-10-25/a17272087220481b9d83f7eb46deca44 2026-10-25/6b58b1071b104d4baaa4d19dbdec6bd0 2026-10-25/12bf3ec1b7464a32bf3c7076e875ae5d 2026-10-25/93cf77f7e88a4aae9a8af0caaf2bc31f 2026-10-25/d63f35ea40ff4a8d8597d48bdf876d6c 2026-10-25/fe86de5c103c4afea23efe449551199b 2026-10-25/9f9d01a5b28b4cd6b946afaefa304152 2026-10-25/1025f17312704bfca1f6b097fa1e1781',
  zarko: '2026-10-25/5489f081067648bab9d54e33a9b4af9f 2026-10-25/69464b410c0d43d69587d5fd1510d729 2026-10-25/d816abd5da1d4825b264eff0b1715c6a 2026-10-25/ec09226042e44035b95261d063ed47fd 2026-10-25/7c43870549914a52916288f544d29c08 2026-10-25/bbf0c966cfda4f67b0ead1a96119bab8 2026-10-25/f2de0de2dab54675978d5237c1e82879 2026-10-25/2acbc0227127479b9c3f07e50eb64adf 2026-10-25/5b552f2a92ad459dbbeb36be0564892e',
  ledena: '2026-10-25/4bc3d7d43910425c88b7c0fb0375270c 2026-10-25/b796717d2a0245cf811b6ac8a9a83123 2026-10-25/41bbdfec4634462384e671963196034e 2026-10-25/e2f60c3dd8da4699bf8f123e42fe4f65 2026-10-25/b9f8183ff1e54dcaa7a4fb066e579117 2026-10-25/4a39937672384873b4fe31c61e38375e 2026-10-25/01671b35271c4a609b67a7c417b423ed 2026-10-25/8260a666ad604f968e72c48b08f79eb0 2026-10-25/bdcbf7465ca14ddda18d2fed19d67002',
  strijela: '2026-10-25/f5a631defffd480ead01c617c321a6c7 2026-10-25/1124693bd4804395b7716149c146f966 2026-10-25/26e527bb130d4b05870f85e41825d695 2026-10-25/d24565a3be3c49059546368b7039878e 2026-10-25/9a14e597cc164332abb184e443bffb34 2026-10-25/d2f2844c6c9744689bbded6448f6e62f 2026-10-25/c0324319a5ac41e6b208597eb01ee276 2026-10-25/1e9c615b64424ae59d4ad62d2e7f94e5 2026-10-25/f32d6b0520ae49cdb8f11e1335194d29',
  listko: '2026-10-25/8f8b2ac2a9e143d497ea23478896d0df 2026-10-25/a7cd4791e1b548388a04e683cbfcc66c 2026-10-25/d3b84af9ff1f4d949f50415ec96f81a5 2026-10-25/8744ccf645824c74a68f87ced8ee816b 2026-10-25/7471ea1902a04aa093cf5eb283031034 2026-10-25/15e258e5022c4c0594ac072504a3d93c 2026-10-25/8c56de2871144b848be524d9a2e43d02 2026-10-25/d0461af6984945e2b0a3e395343663af 2026-10-25/67f61d52c32243199854b42ccd882dad',
  munja: '2026-10-25/26239758058e4d52804ea928b22ba877 2026-10-25/43eaf679767546b49a4742ee95cd267d 2026-10-25/6966944a0119461594ebb87099bb3999 2026-10-25/a85be4cad48e4f56a9aa4b7fe75c5031 2026-10-25/90521999ef1c489cad99fdc63015e2df 2026-10-25/afa81d8d613840ae84e67d90ede8f574 2026-10-25/9b3bc1a6d2ec47af8daf44b371df8936 2026-10-25/60a89a735f70494a8ba81922ebd256e9 2026-10-25/d33f50439d8b4569a0622c5fcd226c64',
  skokica: '2026-10-25/3a968b7fb6564e7b844828f01d0be044 2026-10-25/87637790bfd140c78f00a741142c1648 2026-10-25/4471e37862854a80af7aa3f1964e943a 2026-10-25/8f16c5b3cc0f4cf788731a6b85dc3d19 2026-10-25/634168490d27460ba2afe90eb0753574 2026-10-25/c28f7aecce3041f0988e112ed5c7dc2a 2026-10-25/eb64917f009a43da97173daf4cd7b763 2026-10-25/c00de39075e242b2ae499bcd08f14cae 2026-10-25/04fd704faf03465e96ff5711b330aaaf',
  orlina: '2026-10-25/6d68124570c149bd9e8948135543613a 2026-10-25/af36fcd6801f4fd0b8a45ff2a33318f6 2026-10-25/38c0e3ddbbd04dd59eaca0a5032ac7bb 2026-10-25/ce9070460778408ca06ada06531cc8f6 2026-10-25/228f6ee64d8a40b897ec40a2f5f7a130 2026-10-25/58edda1ec16b40308c164e0991fd193f 2026-10-25/6f8b8b342f9749409a0e516f2ca3eb4b 2026-10-25/7708abc065e0469ba76a4929aa46c2e4 2026-10-25/b55c9d8023154b2293fd940ffe789637',
  luna: '2026-10-25/bf7dc8ff6c254f89bddc928d80acb58a 2026-10-25/9d51fbc5bfc3448a931464e39d7449e2 2026-10-25/86ecbe284d9c455b87a92a056d67b9cb 2026-10-25/ffaa0c0220f248f7af6c697b7d22bc4e 2026-10-25/66b7777c6e784a83a6a5a07ee8d7d27e 2026-10-25/257efaa0e5994fbf9986a3e1be803e39 2026-10-25/884ad53b555a4b5b866daf2dc33b7cec 2026-10-25/209b03409a1940b0a6c096b133c53376 2026-10-25/d6299e831e1f4585806b41bfa9cd711e',
  tragac: '2026-10-25/25d8d016c7fa43a7b1ca1ade6ce9820f 2026-10-25/f953d79d77d5468ba552412233ad3cf9 2026-10-25/dd524ae6aed944568142938c0fd0fac8 2026-10-25/acd7d18317a34052a8cd2bc5f899b577 2026-10-25/73f0b75491e04926adf6f3b59e1df0fa 2026-10-25/3d92fe6490a042ac87c0328121ab9b56 2026-10-25/d463cf0d8e38498ab9b452216a73c08f 2026-10-25/6c9f88a8719d4fdba94e19a0707f0623 2026-10-25/c2d5f3712f9746649c5ad758d6c4cd3e',
  jez: '2026-10-25/1cccbf80a4ff45068474c92506cd6d2e 2026-10-25/d3e73c52f448458aa0abc1672feb9e43 2026-10-25/386e8045aa0a436b8cc12096c15f27a5 2026-10-25/02937517366e4e9a8676170023a70f42 2026-10-25/9b3885d011304c00ba83442b96d1f273 2026-10-25/efdc987aa42546feaeeebf581d333b73 2026-10-25/943df7c50bcd4caa9d4e95d0d3bf3412 2026-10-25/7d95827838384ba0a58de1ff22e10830 2026-10-25/5d42df20b9fd4db6be624672c99bdbb7',
  slon: '2026-10-25/bbbbf97ebe0a4a3e9bf4cb8855e23d4d 2026-10-25/9760de2fa4e64e2bb01c34897b3d8b22 2026-10-25/3c63f065b5064241ab3ad40024b550c5 2026-10-25/8e8f58eb254c4ca18b3780a992b4e3db 2026-10-25/75a7bc5d032540e397658305fd6ece32 2026-10-25/8f149e5bef1549eabbdf3ca9c66f88d1 2026-10-25/0e27e6a7f1f142f1990f25610f874e30 2026-10-25/0a90924780ec4a0b8353b1d028595dfb 2026-10-25/5737ac38c3264767b691a833b48489e5',
  pcela: '2026-10-25/2c38030849a34385b54474a6f47f01cb 2026-10-25/e9e248d8380349b2b55d819268a1fe6e 2026-10-25/90e3f40f2d8244a18e5bbf60acc3ef48 2026-10-25/ae7a18d9db4c474db293cea026d2b17b 2026-10-25/0c900a525ba144cfa2ec00a7f1f21f14 2026-10-25/5da9f991c4d043e0a96ceade5ae1a68b 2026-10-25/af9e67ce8a994fafb0cb6cb2d8f94906 2026-10-25/66c303a3596e4293b90870b8e6485e3e 2026-10-25/e0b35a9a519b429895b6fd054870cd87',
  sova: '2026-10-25/232491eee1e74ccf9187354e41053af2 2026-10-25/44421f4308024a7ea6153cd4ffa38982 2026-10-25/aa24def846d54a1dad24a3e8e9073afe 2026-10-25/54d7ac0261f6456cab27070eb633dbb4 2026-10-25/655b22632f4e460982bad4c9517ec49d 2026-10-25/d5a2f022cafa4066a52e13c7981da211 2026-10-25/94ec09b9345d4773b6404a063b4abd03 2026-10-25/6dc4ad6c400f421eba52881363a6cb44 2026-10-25/2f6622760a6c4a5a869072da43a632cb',
  majmun: '2026-10-25/a095d333a11e4c03a7bab15e755ac1f7 2026-10-25/38b352fc20b1453f956295132e74c29b 2026-10-25/f86c596c544a40a2a245227165392e52 2026-10-25/354d787d4fe1451993ea1b873a62d681 2026-10-25/91d2633c4445439ea95970bbb988008c 2026-10-25/202b1732676843dcbdcb01dc8edc99a4 2026-10-25/1552f49593f8484193a07268a9a7e2c1 2026-10-25/fc6913f7dd194cda99ba3ccc97099adf 2026-10-25/185ab02d9e304844a5e1a6e41d1973e1',
  vuk: '2026-10-25/4846b5057c8848b890cc2de24f0e3a5a 2026-10-25/58fd3a7a9e0143d4986bd24904d79a3e 2026-10-25/73475fe09ea14de7b82c81245a8e82d2 2026-10-25/736f3f8bd64e43288a8d245848f371f6 2026-10-25/23688624a3dc41deb5e6aeac6269bd01 2026-10-25/678a673b2d514553bad60497265be860 2026-10-25/1c4f301a95544b42ae5e66e584ce6928 2026-10-25/073e7f16114047fd959b69f5c5feb56a 2026-10-25/fc3f80bd09604454bb3f89460f761af5',
  gavran: '2026-10-25/d15cc45caf1e44eebf5aa8f937e974eb 2026-10-25/cb79ddb8bd3c47ab9adc0e9e3b4e0016 2026-10-25/931d4ee700a34528a4c66fd126d0ae28 2026-10-25/f2e13b09ce354404ae981b7422d0421b 2026-10-25/f8bae7e8ba964cdba234fd6bd0f2c590 2026-10-25/c6150382b5d5464091b05d641d3244ed 2026-10-25/ea9aca53893144029e0f61a5dfa18717 2026-10-25/350849b7cbba4a78bfb34a2c08e440d1 2026-10-25/eb1760c399c2483582424d9d5ede0889',
  hobotnica: '2026-10-25/18a7c664482c4a47a17da5d79bb87e1c 2026-10-25/6a800e67f6544ae9ad71e570b3396fdd 2026-10-25/54b41d700f3f43fa843f3236c964f203 2026-10-25/1ddd3bbe029a4f4ba3f265eaf1de2bc4 2026-10-25/85799223e8ce403c94bf61215e063c17 2026-10-25/a822fbd9fc6047f3b001873c6bd99b20 2026-10-25/4fe1bf22f8cd45158773b528d2defa95 2026-10-25/2828233558024c28ac088f31977bef52 2026-10-25/baaee9865ae1404683a6903fd1c6a367',
  nosorog: '2026-10-25/882e647656054fe79332d39f1fc11a6d 2026-10-25/e5f12f31dde14bc79c93f827ee4e21d1 2026-10-25/bdcf853293664a6297eba74303470ef7 2026-10-25/4b7f9b8514e44b95872fb25a366cea7c 2026-10-25/cba1a0524a89404dbeec4b135442db93 2026-10-25/35d0d434604e4ade87e11e1d991fec44 2026-10-25/7166b760477f44dcbfe3d30eafd25cf2 2026-10-25/622e50eeec4e4dfaa5152de526f12961 2026-10-25/fa64162e9e8546939a21531b0f3a7cdb',
  panda: '2026-10-25/0e3e705bc2c44a97855f5708db47e502 2026-10-25/651ac0db169d4799900e9753029adf26 2026-10-25/d7b53ecabdf6466aa92cfef99f220d7e 2026-10-25/9c03f68a74144925870c554d71f11d39 2026-10-25/e261bc8917e94d40b44aa6d32b7dd07c 2026-10-25/f46b4632c8f14b809801f4f1a23f30a6 2026-10-25/7353d21dea694c7c83597e9dde206355 2026-10-25/7bdd01ca91274ec7bddcb437db40065b 2026-10-25/7a2d8261ca294a5a887a1b891d62065b',
  jednorog: '2026-10-25/adea971db423444fad9e85d524b356b3 2026-10-25/c7ba1f6adc9040c5877047f89e8c7efb 2026-10-25/a30e3e56300f49baa8a122d2f1a2311a 2026-10-25/78a82fbcd0004426ad84ff4834df7213 2026-10-25/d586224fa0574061b669ca11e23f3fbd 2026-10-25/e03070f672d24450a7f5e469d4047e03 2026-10-25/841694e5b03443858620c5c07859e919 2026-10-25/2f05ab6e9e9441e6a9cf97755a6b0914 2026-10-25/2d73e84ac78c4d17a76e2cd8372b4970',
  morskipas: '2026-10-25/3f6811067db64bddb7d61e14cae18e49 2026-10-25/0fd120c5fd3b44b48d30325035411238 2026-10-25/fb9f80ba450146eda6e6dab8c9bb560b 2026-10-25/cd09b796d32b433b856339ad8ccf0550 2026-10-25/2ed5dc661a284f6faaab17371c22b707 2026-10-25/fc8dbcdb9e444f07b47813d3ab97d8db 2026-10-25/b93a99ce06514e539af0db6a59015f3d 2026-10-25/b689a9eb8aa74063a94feb112f283390 2026-10-25/660e8f54d6b24d47a71aa6abf7b10084',
};
const ANN_REMOTE = {
  welcome: '2026-10-25/299b95be31fb43229ae2751293bbf5ac',
  battle: '2026-10-25/930cffa42d704e9c8e3f8dbd3cd8849f',
  first_blood: '2026-10-25/13c61ded63d24d2eaf7ebb346645f107',
  double_kill: '2026-10-25/c33a7588db9b4c7382d22c677ead75b0',
  triple_kill: '2026-10-25/94fc17228da34fb5972cd8d95508db21',
  ultra_kill: '2026-10-25/ba8ce62dc294475f9e726839efcfe9bf',
  rampage: '2026-10-25/57995b1ca85a4615a639014b94124175',
  killing_spree: '2026-10-25/255b56cb2ebf49ec8190d975a7dc56e3',
  dominating: '2026-10-25/85ba6cc24794420690951564873eef23',
  mega_kill: '2026-10-25/24a4c166d0b948cf8b92d724d156d8a2',
  unstoppable: '2026-10-25/94e90dca31bf417c8d64f8a035d857cb',
  incredible: '2026-10-25/dbdecc9b691d48e88c9792ab54ec5a4a',
  monster_kill: '2026-10-25/6d92c21c4e5c4ccb8636ff7724dc1527',
  godlike: '2026-10-25/ed9b706ab974492387a4fed6ee9eac43',
  beyond_godlike: '2026-10-25/16513118ffea4e64ac5a02e0990c4a13',
  shutdown: '2026-10-25/cc57e57437b341829b6d84256a252274',
  ace: '2026-10-25/b72315b6b100404090a1f9610006206d',
  tower_enemy: '2026-10-25/1bb8cb0e9e0c444b9385c4e1e91c298e',
  tower_ours: '2026-10-25/7088f15b0fad4885b3fc994f9bdd86eb',
  tower_denied: '2026-10-25/0575c40a74a1498d8c4f4225417bdf39',
  barracks_enemy: '2026-10-25/0b19646d2a8d4a33b89b7b069825f266',
  barracks_ours: '2026-10-25/8fce3e67f92845848e3bb84cd3e43c82',
  throne_enemy: '2026-10-25/84fa8e79b563426687298716b767abac',
  throne_ours: '2026-10-25/f1f8e39295644f2b84d315e6ae83cda0',
  dragon_ours: '2026-10-25/3082e7bf6f684d4399f6b31decd3d63a',
  dragon_enemy: '2026-10-25/d08674d00b6044c4874c6c201c40eaca',
  drake_ours: '2026-10-25/d6c47d09997f49ffaa15fbdcd1b8f5c4',
  drake_enemy: '2026-10-25/4dd2201e5b7c4214b7d743e36f5c6be6',
  night: '2026-10-25/81eb336c49074c54bf49b663a5179454',
  day: '2026-10-25/efdb3658047843d7af7a77962119f29b',
  victory: '2026-10-25/b3578954d7cf441bac5e808d656f94c3',
  defeat: '2026-10-25/c9de7feff35243f09bb49825d42646eb',
};
