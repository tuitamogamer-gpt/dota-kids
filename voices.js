/* 🗣️ Glasovi junaka (Fish Audio, engleski) — replike i glas svakog junaka
   Datoteke: assets/voice/<id junaka>/<ključ>.mp3
   Ključevi: pick (odabir), move1/move2 (hodanje), attack (napad na junaka), ult (ulti),
             kill (pobjeda nad junakom), death (pogibija), respawn (povratak u igru)
   [Upute u zagradama] govore glumcu (model drama-3) kako da izgovori repliku; imena su
   napisana kako se izgovaraju na engleskom (Zharko, Munya, Zooya…). */
const VOICE_KEYS = ['pick', 'move1', 'move2', 'attack', 'ult', 'kill', 'death', 'respawn'];
const VOICES = {
  vitez: { voice: '92e3ee13d7524fee904324e350a532a0',   // Epic Game Announcer — dubok, junački
    pick: '[proud and heroic] Lavko the brave, ready for battle!', move1: '[confident] Onward!', move2: '[rallying] Forward, heroes!',
    attack: '[battle cry] For the kingdom!', ult: "[mighty roar] Hear the king's roar!", kill: '[triumphant] Justice wins!',
    death: '[weak, fading] Even lions fall...', respawn: '[strong and proud] The lion returns, stronger than ever!' },
  zarko: { voice: '802e3bc2b27e49c2995d23ef70e6ac89',   // Energetic Male (Fish Audio) — mlad, vatren
    pick: "[cocky and fiery] Zharko's here! Who ordered fire?", move1: "[playful] Watch out, it's hot!", move2: '[excited] Flying in!',
    attack: "[cocky] You're toast!", ult: "[shouting] Dragon's breath! Feel the heat!", kill: '[laughing] A little overcooked!',
    death: '[sad, fizzling] Aww... my flame went out...', respawn: "[pumped] The fire's back!" },
  ledena: { voice: 'b347db033a6549378b48d00acb0d06cd',  // Selene (Fish Official) — mirna, hladna
    pick: "[cool and calm] Ledena. Chill out, I'm here.", move1: '[light] Sliding!', move2: '[amused] Brrr, lovely weather!',
    attack: '[icy] Freeze!', ult: '[powerful] The Ice Age begins!', kill: "[smug] You're an ice cube now.",
    death: "[sad] I'm melting...", respawn: '[cool] Cool and ready!' },
  strijela: { voice: '9a9cf47702da476aa4629e2506d4a857', // Hannah (Fish Official) — lukava, samouvjerena
    pick: '[sly and playful] The slyest fox in the forest!', move1: '[sneaky] Quiet as a fox.', move2: '[cheerful] On my way!',
    attack: '[focused] Got you in my sights!', ult: "[intense] Falcon's eye! I see you!", kill: '[proud] Bullseye!',
    death: '[embarrassed] Oops... I missed.', respawn: '[happy] The fox is back!' },
  listko: { voice: '291a58aa51a94326aed08115c06f0e09',  // Old Wizard — spor, topao djed
    pick: '[slow and kind] Slow and steady... Listko is here.', move1: '[slow] Step by step.', move2: '[gentle] Going, slowly.',
    attack: '[firm] The forest fights back!', ult: '[warm and powerful] Heart of the forest, heal us!', kill: '[calm] Nature always wins.',
    death: '[sleepy sigh] Time for a little nap...', respawn: '[cheerful] Spring is here! Growing again.' },
  munja: { voice: 'b5f4515fd395410b9ed3aef6fa51d9a0',   // Alex — brz i poletan
    pick: '[fast and excited] Munya! Faster than thunder!', move1: '[thrilled] Woohoo, speed!', move2: '[quick] Already there!',
    attack: '[fierce] Flash and boom!', ult: "[shouting] Storm's fury! Thunder!", kill: '[teasing] Too fast for you!',
    death: '[tired] Aww, out of power...', respawn: "[energized] Fully charged! Let's go!" },
  skokica: { voice: '091cad5003ed4e90826a92e1fadde278', // Gigi — razigrana žabica
    pick: '[bubbly] Ribbit! Skokitsa hops into action!', move1: '[bouncy] Hop, hop!', move2: '[giggly] Boing, boing!',
    attack: '[playful] My tongue will catch you!', ult: '[excited shout] Giant wave! Everybody in the water!', kill: '[giggling] Ribbit! Gotcha!',
    death: '[sad croak] Riiibbit... oh no...', respawn: '[cheerful] Back from the pond!' },
  orlina: { voice: 'e9b134e4c0b547a3894793be502314f1',  // Jasphina — ponosna, glasna
    pick: '[proud] Orlina! I see everything from up high.', move1: '[soaring] Wings to the wind!', move2: '[confident] Soaring above!',
    attack: '[sharp] Prey spotted!', ult: '[commanding] King of the sky! Falcons, attack!', kill: '[proud] No one escapes the eagle eye.',
    death: '[falling, sad] I fell from the sky...', respawn: '[joyful] Back in the air!' },
  luna: { voice: '933563129e564b19a115bedd57b7406a',    // Sarah (Fish Official) — tiha, tajanstvena
    pick: '[soft and mysterious] Meow... Luna shines in the night.', move1: '[whisper] Silent as a shadow.', move2: '[dreamy] The moon guides me.',
    attack: '[sharp] Moon blade!', ult: "[mystical] Hide in the moon's shadow!", kill: '[purring] Meow! Good night.',
    death: '[soft sigh] Meow... I still have eight lives left.', respawn: '[playful] New life, same cat!' },
  tragac: { voice: 'c5f56a6cc2ec4fa8920cb4c5889a3fb7',  // Slax — miran i lukav
    pick: '[sly and smooth] The Tracker. For a handful of gold, I find anyone.', move1: '<whisper>Shhh... quiet.</whisper>', move2: '[low] Following the trail.',
    attack: "[cold] You're my target!", ult: '[satisfied] Bounty! The reward is mine!', kill: '[chuckling] The gold is mine!',
    death: '[surprised, weak] Someone... found me...', respawn: '[quiet] Back to the shadows.' },
  jez: { voice: 'f8dfe9c83081432386f143e2fe9767ef',     // BOOK RECORD REGULAR — hrapav gunđalo
    pick: "[grumpy] Bodlyo! Don't touch, I'm prickly!", move1: "[grumbling] Fine, fine, I'm going.", move2: '[grumpy] Rolling!',
    attack: '[annoyed] Have some spikes!', ult: '[angry shout] Spike charge! Out of my way!', kill: '[smug] I told you I was prickly!',
    death: '[groaning] Ouch, my spikes...', respawn: '[gruff] Spikes are sharp again!' },
  slon: { voice: 'bf322df2096a46f18c579d0baa36f41d',    // Adrian (Fish Official) — dubok, polagan
    pick: '[slow, deep and rumbling] Tootnyo... big and strong... I protect my friends.', move1: '[slow and heavy] Boom... boom... boom...', move2: '[deep] Rumbling forward.',
    attack: '[mighty] Trunk swing!', ult: '[thunderous shout] Stampede! The ground shakes!', kill: '[calm and deep] An elephant never forgets.',
    death: '[slow groan] Oooh... down like a mountain.', respawn: '[deep and strong] The ground rumbles again!' },
  pcela: { voice: '15742afadec44b82bf52f7bb62b83f83',   // Twinko — visok, zujav
    pick: '[high-pitched, buzzy and hyper] Zooya is here! Bzzz!', move1: '[buzzy] Bzz-bzz, flying!', move2: '[humming] Bzzz, bzzz!',
    attack: '[cheeky] Bzzz, sting!', ult: '[excited shout] The hive! Sisters, attack!', kill: '[giggly] Honey for me, a sting for you!',
    death: '[sleepy] Bzzz... so sleepy...', respawn: '[cheerful] Zooya flies again!' },
  sova: { voice: 'e3cd384158934cc9a01029cd7d278634',    // Laura (Fish Official) — mudra i topla
    pick: '[wise and mysterious] Hoo-hoo... Mudra knows all the secrets of the night.', move1: '[soft] Flying silent through the night.', move2: '[gentle] Hoo-hoo.',
    attack: '[ominous] The night is watching you!', ult: '[commanding] Eternal night! Let darkness fall!', kill: '[calm] Wisdom always wins.',
    death: '[sleepy] Hoo... time to sleep.', respawn: '[warm] The night returns, and so do I.' },
  majmun: { voice: '711cf3ed00ab441a8f54a45058047b7a',  // Verity — vragolan
    pick: '[cheeky giggle] Hee-hee-hee! Skakach, king of the trees!', move1: '[playful] Up the branch!', move2: "[giggling] Hee-hee, let's go!",
    attack: '[excited] Staff smash!', ult: '[shouting] Monkey army! Follow me!', kill: '[laughing] Watch out for banana peels!',
    death: '[whiny] Oops, fell off the branch...', respawn: "[cheerful] Who wants bananas? I'm back!" },
  vuk: { voice: '80d671cd611e4bf2813816b68810b052',     // Monster — dubok, režeći
    pick: '[growling] Sivko leads the pack! Awooo!', move1: '[commanding] Pack, follow me!', move2: '[sniffing, low] I smell a trail.',
    attack: '[snarling] Grrr... attack!', ult: '[howling] Wolf form! Awoooo!', kill: '[proud growl] The pack is stronger!',
    death: '[whimpering] Ow... my tail droops...', respawn: '[fierce] The wolf returns to the pack!' },
  gavran: { voice: '98544e744e754814a6aa22229f63f475',  // horror voice narrator 2 — mračan, dramatičan
    pick: '[dark and dramatic] Caw! Darkness has come... and so have I.', move1: '[low] Caw, caw.', move2: '[mysterious] The shadows carry me.',
    attack: '[sinister] A curse upon you!', ult: '[dramatic shout] Flock of ravens! Darken the sky!', kill: '[evil laugh] Caw-ha-ha-ha!',
    death: '[whiny] Caaaw... not fair...', respawn: '[ominous whisper] From the darkness... again.' },
  hobotnica: { voice: '4d78f878f023424cb77975a6dea180a6', // Pirate — gusarski kapetan dubina
    pick: '[boisterous] Pipko, ruler of the deep! Eight arms, zero problems!', move1: '[goofy] Bloop, bloop!', move2: '[jolly] Sliding on slime!',
    attack: '[gruff] Ink blast!', ult: '[booming] Whirlpool of the deep! Everyone in!', kill: '[hearty laugh] No one escapes my tentacle hug!',
    death: '[gurgling] Blub... blub...', respawn: '[jolly] Back from the deep!' },
  nosorog: { voice: '4c6a6762e4ac4bdebdb4fa8525d054a2', // ATOMIC — glasan jurišnik
    pick: '[loud and tough] Rogo! Nobody can stop me!', move1: '[gruff] Out of my way!', move2: '[pumped] Charging!',
    attack: '[battle shout] Charge!', ult: "[furious] Rage! Now I'm really mad!", kill: '[triumphant] The horn wins!',
    death: '[dazed] Oof... someone stopped me...', respawn: '[loud] Nothing can stop me!' },
  panda: { voice: '0b74ead073f2474a904f69033535b98e',   // CALM- NORMAL — mirni majstor
    pick: '[calm and relaxed] Bambus. Peace, bamboo, and a little kung fu.', move1: '[relaxed] Easy, easy.', move2: '[content, munching] Nom, nom, bamboo.',
    attack: '[focused] Thunder clap!', ult: '[calm, then powerful] Three pandas! First peace... then boom!', kill: '[serene] Peace is always better.',
    death: '[sleepy] Mmm... just a little nap...', respawn: '[refreshed] Well rested and ready.' },
  jednorog: { voice: 'b545c585f631496c914815291da4e893', // Friendly Women (Fish Audio) — vesela, čarobna
    pick: '[sparkly and sweet] Duga! Colorful and magical!', move1: '[cheerful] Galloping!', move2: '[singsong] Tra-la-la!',
    attack: '[bright] Rainbow beam!', ult: "[excited] Star gallop! Let's run together!", kill: '[happy] Rainbow flash!',
    death: "[sad] Oh no, I'm fading...", respawn: '[joyful] The rainbow is back in the sky!' },
  morskipas: { voice: 'b0f79e4bac084142a2ca8266bd959ae5', // Grandpa — gladan i hrapav
    pick: "[hungry and menacing] Zoobo! I'm hungry!", move1: '[sniffing] I smell something tasty!', move2: '[playful] Swimming, swimming!',
    attack: '[growling] Big bite!', ult: '[frenzied] Frenzy! Now I bite everything!', kill: '[satisfied] Yum! Delicious!',
    death: '[groaning] Ow... my teeth gave up...', respawn: '[hungry] Still hungry!' },
};
