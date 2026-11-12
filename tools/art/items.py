# v0.56 — promptovi za naslikane ikone predmeta (GPT Image 2.5 preko Fish Audija): 11 listova po 12 ikona (mreža 4 × 3)
#   python3 tools/art/items.py   →  tools/art/item_prompts.json  (items_en.json = id, sličica, englesko ime, vrsta — iz data.js)
#   listovi se nakon generiranja upišu u tools/art/urls.json kao "items/<n>", a tools/art/dl_items.py ih izreže u assets/item/<id>.jpg
import json, os
D = os.path.dirname(os.path.abspath(__file__))
HINT = {   # što se vidi na ikoni (jedan predmet, bez lika)
 'tango': 'a bundle of fresh green leaves tied with string', 'potion': 'a round glass bottle of glowing green herbal potion with a cork',
 'clarity': 'a single big glowing blue water drop', 'dust': 'a small open pouch spilling sparkling silver powder', 'eye': 'a magic floating eyeball on a short wooden stick',
 'bottle': 'a glass flask with a swirl of sparkling spring water and a cork', 'cheese': 'a wedge of golden cheese with holes, glowing', 'fairy': 'a tiny glowing fairy light with wings',
 'mango': 'a ripe orange-yellow mango with a leaf', 'smoke': 'a grey glass ball full of swirling fog',
 'branch': 'a small green sprout with two leaves in a clump of soil', 'gauntlets': 'a pair of furry brown bear-paw mittens', 'slippers': 'a pair of soft blue slippers with cat ears',
 'mantle': 'a red knitted scarf with an owl pattern', 'circlet': 'a necklace of colourful beads', 'belt': 'a wide golden champion wrestler belt', 'band': 'a pink ribbon bow fluttering in the wind',
 'robe': 'a folded dark blue robe covered with golden stars', 'ogre': 'a heavy wooden club with iron studs', 'alacrity': 'a slim curved orange blade shaped like a fox tail',
 'wizstaff': 'a wooden elf staff with a glowing purple crystal on top',
 'quelling': 'a small woodcutter hatchet stuck in a tree stump', 'hunter': 'a hunting knife with a bone handle and a paw print on the blade', 'sword': 'two crossed short daggers',
 'broadsword': 'a classic straight knight sword with a blue grip', 'claymore': 'a big two-handed sword with a tartan-wrapped handle', 'mithril': 'a sturdy silver dwarf hammer with runes',
 'demonedge': 'a jagged dark red blade shaped like a fang, glowing', 'gloves': 'a pair of red boxing gloves', 'ringprot': 'a green ring shaped like a turtle shell',
 'chainmail': 'a shirt of steel chain links', 'platemail': 'a shiny steel breastplate', 'morbid': 'a dark mask shaped like a bat with red eyes', 'hyperstone': 'a faceted cyan gem with speed streaks',
 'staff': 'a wooden shepherd crook', 'cloak': 'a thick blue wool cloak with a clasp', 'venom': 'a curved snake fang dripping a green drop', 'blight': 'a red toadstool with white spots, faintly glowing',
 'helm': 'a round iron helmet with a nose guard',
 'boots': 'a pair of blue running sneakers with white laces', 'ringregen': 'a ring woven of green herbs with a tiny leaf', 'sage': 'a steaming cup of green tea', 'heart': 'a heart-shaped red ruby',
 'orb': 'a round deep blue sapphire', 'pointbooster': 'a star-shaped golden crystal', 'windlace': 'a white seagull feather on a string', 'ringhealth': 'a pink ring with a tiny unicorn horn spiral',
 'voidstone': 'a dark purple stone with stars inside', 'blink': 'a golden amulet with a lightning bolt', 'raindrop': 'three shiny blue raindrops',
 'reaver': 'a massive stone axe with a skull-shaped rock head', 'eaglesong': 'a large brown-and-white eagle feather with a golden quill', 'mystic': 'a tall golden staff topped with a shining star',
 'relic': 'a glowing shard of the sun, orange-gold', 'javelin': 'a hunting spear with feathers tied below the tip', 'talisman': 'a glass wind chime with a paper strip', 'ultorb': 'a glass orb with a rainbow swirling inside',
 'wand': 'a short wand throwing colourful sparks', 'bracer': 'a leather bracelet with a bear tooth and a red gem', 'wraith': 'an orange silk ribbon with a fox-tail tip', 'nulltal': 'a blue owl-shaped charm on a chain',
 'phase': 'sturdy brown leather warrior boots with steel toe caps', 'treads': 'heavy boots striped red, green and blue', 'arcane': 'elegant blue wizard boots with curled toes and stars',
 'midas': 'a shining golden glove', 'soulring': 'a silver ring with a crescent moon', 'mom': 'an angry red theatre mask', 'machete': 'a broad hunter machete with a leather grip',
 'tranquil': 'a pair of simple green sandals with a leaf', 'travel': 'red boots with little rocket engines and flames', 'perseverance': 'a double ring twisted into an infinity sign, green and blue',
 'mek': 'a golden medallion with a green cross', 'drum': 'a war drum with red tassels and two drumsticks', 'vlad': 'a red banner with a wolf head emblem', 'buckler': 'a small round wooden shield with a metal boss',
 'glimmer': 'a shimmering cloak covered in tiny glowing fireflies', 'pipe': 'a curved guardian horn with gold rings', 'greaves': 'white knitted socks with a green healing cross',
 'medallion': 'a bronze medal with a lion on a ribbon', 'lotus': 'a pink lotus blossom with a mirror in its centre', 'crimson': 'a tall red tower shield with a castle emblem',
 'force': 'a staff with a spiral of wind at the tip', 'euls': 'a glass bottle with a tiny tornado inside', 'dagon': 'a golden trident shooting a red beam', 'refresher': 'a green orb with two circling arrows',
 'shiva': 'a round shield made of blue ice', 'kaya': 'an open blue spellbook with glowing pages', 'octarine': 'a glowing purple core with orbiting rings like an atom', 'orchid': 'a purple orchid flower with a finger-on-lips hush glow',
 'atos': 'a rod wrapped in glowing chains', 'veil': 'a thin purple veil like a spider web', 'hex': 'a wooden staff with a green frog sitting on top', 'bloodthorn': 'a red rose with one long sharp thorn',
 'vanguard': 'a thick oak wooden shield with iron bands', 'bkb': 'golden royal armor with a crown emblem', 'assault': 'a dark green general\'s chest armor with medals and gold epaulettes',
 'titanheart': 'a huge glowing orange stone heart', 'hood': 'a blue cap with a crossed-out spell rune', 'halberd': 'a long halberd with a golden fleur-de-lis blade', 'mageslayer': 'a witch broom sweeping away blue sparks',
 'crystalys': 'a knife with a blade of clear crystal', 'daedalus': 'a golden blade with a red bullseye target on the guard', 'bfury': 'a big double axe crackling with storm clouds',
 'deso': 'a dark curved sword with a crescent moon glow', 'basher': 'a heavy stone mallet', 'abyssal': 'a blue sword wrapped in a water whirlpool', 'mkb': 'a golden staff with a monkey face cap',
 'maelstrom': 'a hammer with a storm cloud and rain', 'mjollnir': 'a mighty hammer with lightning bolts', 'diffusal': 'a purple blade draining blue mana wisps',
 'sange': 'a heavy red saber with a bear head pommel', 'yasha': 'a light green saber with wind streaks', 'sny': 'two crossed sabers, one red and one green', 'lance': 'a long spear with a green dragon head tip',
 'moonshard': 'a pale glowing crystal shaped like a full moon',
 'butterfly': 'a pair of shimmering butterfly wings, orange and blue', 'shadowblade': 'a dagger half fading into shadow', 'satanic': 'a dark red sword with bat-wing crossguard', 'sun': 'a round golden stone blazing like a small sun',
 'skadi': 'a heart-shaped block of blue ice', 'scepter': 'a wizard scepter with a blue orb and a tiny wizard hat on top', 'rapier': 'a sword with a blade of bright flame',
 'n_clover': 'a four-leaf clover', 'n_feather': 'a light white swan feather floating', 'n_amulet': 'a round blue eye amulet', 'n_shell': 'a spiral seashell with pearl shine',
 'n_fang': 'an ancient wolf bone with carved runes', 'n_crystal': 'a blue diamond-shaped crystal with a tiny book glow', 'n_star': 'a pinch of glittering stardust with a shooting star',
 'n_dheart': 'a heart cut from sparkling diamond, pink', 'n_moon': 'a glowing crescent moonstone',
 '_recipe': 'a rolled parchment scroll with a red wax seal',
}
BG = {   # boja pozadine pločice po vrsti predmeta (kao rub ikone u igri)
 'cons': 'warm sandy brown', 'attr': 'cool steel grey', 'equip': 'cool steel grey', 'misc': 'cool steel grey', 'secret': 'teal cyan', 'acc': 'forest green', 'sup': 'forest green',
 'magic': 'royal blue', 'armor': 'royal blue', 'weapon': 'deep purple', 'art': 'burnt orange', 'neutral': 'leafy green', 'recipe': 'warm sandy brown',
}
POS = ['top row, 1st', 'top row, 2nd', 'top row, 3rd', 'top row, 4th', 'middle row, 1st', 'middle row, 2nd', 'middle row, 3rd', 'middle row, 4th',
       'bottom row, 1st', 'bottom row, 2nd', 'bottom row, 3rd', 'bottom row, 4th']
items = json.load(open(os.path.join(D, 'items_en.json'), encoding='utf-8')) + [['_recipe', '📜', 'Recipe Scroll', 'recipe']]
missing = [i[0] for i in items if i[0] not in HINT]
assert not missing, missing
out = {}
for n in range(0, len(items), 12):
    part = items[n:n + 12]
    tiles = ' '.join('Tile %d (%s), "%s": %s, on a dark %s background.' % (k + 1, POS[k], name, HINT[iid], BG[cat]) for k, (iid, em, name, cat) in enumerate(part))
    out['items/%d' % (n // 12 + 1)] = {
        'ids': [i[0] for i in part],
        'prompt': ('A sprite sheet of twelve item icons for a kids\' fantasy MOBA game (Dota-style shop item icons), arranged in an exact grid of 4 columns and 3 rows of '
                   'equal rectangular tiles that fill the whole image edge to edge, with no gaps, no gutters and no outer margin. Every tile is its own complete icon: '
                   'painterly digital illustration of ONE single object, large and centered, filling most of the tile, bold readable silhouette, vibrant saturated colors, '
                   'a soft bright glow behind the object, dark vignette toward the tile edges, cute and kid-friendly. No characters, no hands. ' + tiles +
                   ' No text, no letters, no numbers, no UI frame, no borders.'),
    }
json.dump(out, open(os.path.join(D, 'item_prompts.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(out), 'listova,', len(items), 'ikona')
