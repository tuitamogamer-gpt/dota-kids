# v0.55 — promptovi za GPT Image 2.5 (Fish Audio): portret svakog junaka + list od 6 ikona (urođena pasiva, Q, W, E, R, talenti)
#   python3 tools/art/prompts.py  →  tools/art/prompts.json  (heroes.json = engleski nazivi i opisi moći iz data.js)
import json, os
D = os.path.dirname(os.path.abspath(__file__))
LOOK = {   # izgled kao na 3D modelu (v0.52 kostimi) i starim naslikanim portretima
 'vitez': ('golden lion knight', 'a golden lion with a big orange-brown mane, a small gold crown, shiny silver chest armor with a gold sun emblem, a red royal cape and a sword', 'warm golden'),
 'zarko': ('little fire dragon', 'a small red-orange baby dragon with cream horns, orange wings, a yellow belly, a purple vest with gold trim and a high collar, a little flame dancing in his palm', 'fiery orange'),
 'ledena': ('penguin snow witch', 'a cute penguin snow witch with a big blue wizard hat covered in snowflakes, a light-blue coat with a white fur collar and an ice-crystal staff', 'icy pale blue with falling snowflakes'),
 'strijela': ('sly fox archer', 'a sly orange fox archer in a green hood with the ears poking out, a green vest, a leather quiver full of arrows and a wooden bow', 'soft forest green'),
 'listko': ('turtle forest healer', 'a kind green turtle forest healer with a mossy shell, a leaf headband with a pink flower and a wooden staff topped with a glowing leaf crystal', 'leafy spring green'),
 'munja': ('lightning tiger', 'an orange tiger assassin with dark stripes, a yellow lightning-bolt mark on the forehead, dark leather armor with a glowing lightning emblem and yellow energy claws', 'stormy purple with sparks'),
 'skokica': ('frog warrior', 'a big-eyed green frog warrior with a yellow belly and dark spots, leather shoulder straps, a lily-pad shield and a wooden club', 'bubblegum pink with soap bubbles'),
 'orlina': ('eagle sky sniper', 'a brown eagle with a white head and a golden beak, aviator goggles on the forehead, a red pilot scarf and a leather vest', 'bright sky blue with clouds'),
 'luna': ('moon cat archer', 'a lavender moon cat archer with a silver crescent mark on the forehead, a purple cape with little stars, a dark blue vest and a silver bow', 'starry night indigo'),
 'tragac': ('raccoon bounty hunter', 'a gray raccoon bounty hunter with a dark mask around the eyes, a black hood, a brown vest and a throwing star', 'dark teal with mist'),
 'jez': ('spiky hedgehog', 'a brown hedgehog with big dark quills with cream tips, a leather vest with buttons and a determined grin', 'olive green'),
 'slon': ('elephant defender', 'a gray elephant with big ears and small tusks, a teal royal vest with a gold collar and a big war hammer', 'slate blue'),
 'pcela': ('bee poison witch', 'a yellow-and-black striped bee witch with see-through blue wings, curly antennae, a tiny stinger and a glowing orange honey orb', 'golden honey with drips'),
 'sova': ('owl queen of the night', 'a brown owl with huge amber eyes, a heart-shaped light face disc, ear tufts and a long dark blue robe with gold trim, magic glowing around her', 'deep purple night'),
 'majmun': ('monkey staff fighter', 'a brown monkey with a light face mask, a golden circlet headband, a red vest and a long golden staff', 'warm sunset brown'),
 'vuk': ('wolf pack leader', 'a gray wolf pack leader with yellow eyes, small fangs, fluffy pale neck fur, a dark gray leather vest and glowing claws', 'night blue with a full moon'),
 'gavran': ('raven dark wizard', 'a black raven dark wizard with glowing purple eyes, an orange beak, a tall pointed purple hat and a long purple robe with silver trim', 'dark indigo with purple wisps'),
 'hobotnica': ('octopus of the deep', 'a purple octopus with big friendly white eyes, curling tentacles and a navy sailor vest with a white collar', 'ocean blue with bubbles'),
 'nosorog': ('rhino charger', 'a gray rhino with a big ivory nose horn, silver chest armor with a gold emblem and a fierce happy expression', 'gray green'),
 'panda': ('panda kung-fu master', 'a calm panda kung-fu master with a green kung-fu vest with gold buttons and a bamboo staff', 'bamboo green'),
 'jednorog': ('unicorn helper', 'a white unicorn with a rainbow mane, a golden spiral horn, a pink cape with stars and a glowing pink orb', 'soft violet with sparkles'),
 'morskipas': ('shark hunter', 'a gray shark with a white belly, a big toothy grin and a red pirate coat with gold buttons', 'sea teal with bubbles'),
 'nisan': ('squirrel sniper', 'an orange squirrel sniper with a huge bushy tail, a ranger hat, a green hunting vest and a long rifle with a brass scope', 'amber autumn'),
 'bikos': ('bull warrior', 'a red-brown bull warrior with white war-paint stripes on the cheeks, ivory horns, a gold nose ring, a spiked steel shoulder pad, crossed leather straps and a huge double axe', 'dark red'),
 'nilski': ('hippo fisherman', 'a big friendly lavender-gray hippo fisherman with a huge pink muzzle and two little tusk teeth, an olive bucket hat with a fishing lure, a yellow rain vest with blue buttons, a round belly and a big steel fishing hook on a chain', 'soft purple'),
 'irbis': ('snow leopard frost archer', 'a white snow leopard archer with dark rosette spots and icy blue eyes, a teal-blue hood and scarf, a navy vest with light-blue trim and an icy crystal bow', 'cool blue with snowflakes'),
 'skorpion': ('scorpion king of the sands', 'a sandy-golden scorpion king with orange chitin shell plates, a gold crown, big red-orange pincers, a dark red cape and a segmented tail with a glowing green stinger curling up behind his head', 'warm desert amber with drifting sand'),
}
STYLE = ('Cute chibi anthropomorphic animal hero for a kids\' fantasy MOBA game, stylized 3D animated-movie look: soft lighting, rounded shapes, '
         'big expressive sparkling eyes, friendly confident smile, rich colors, fine fur and fabric detail.')
def portrait(h, look):
    who, desc, bg = look
    return (f'Character portrait of {h["name"]}, {desc}. {STYLE} Head and shoulders, three-quarter view, the face fills the upper middle of the '
            f'square frame, soft rim light, smooth blurred {bg} background with a gentle glow behind the head. '
            'No text, no letters, no logo, no frame, no border.')
def sheet(h, look):
    who, desc, bg = look
    tiles = [('top-left', 'innate passive "' + h['P']['name'] + '"', h['P']['desc'].replace('PASSIVE: ', ''), h['P']['emoji'])]
    pos = ['top-middle', 'top-right', 'bottom-left', 'bottom-middle']
    for p, a in zip(pos, h['ab']):
        tiles.append((p, ('ultimate ' if a['ult'] else '') + 'ability "' + a['name'] + '"', a['desc'].replace('ULT: ', '').replace('ULT (PASSIVE): ', ''), a['emoji']))
    tiles.append(('bottom-right', '"Talents"', 'a glowing golden skill tree with branching paths, decorated with a small ' + who + ' emblem', '🌳'))
    t = ' '.join(f'Tile {i + 1} ({p}), {n}: {d} (theme {e}).' for i, (p, n, d, e) in enumerate(tiles))
    return ('A sprite sheet of six square ability icons for a kids\' fantasy MOBA game (Dota-style spell icons), arranged in an exact grid of '
            '3 columns and 2 rows of equal square tiles that fill the whole image edge to edge, with no gaps, no gutters and no outer margin. '
            'Every tile is its own complete icon: painterly digital illustration, one bold readable subject in the center, vibrant saturated '
            f'colors, dramatic magical lighting, darker vignette toward the tile edges, cute and kid-friendly, made for {h["name"]} — {desc}. '
            'Show the spell effect, not a portrait (the hero may appear small or as a paw/hand only). '
            + t + ' The ultimate tile is the most epic one. No text, no letters, no numbers, no UI frame, no borders.')
H = json.load(open(os.path.join(D, 'heroes.json'), encoding='utf-8'))
out = {h['id']: {'portrait': portrait(h, LOOK[h['id']]), 'icons': sheet(h, LOOK[h['id']])} for h in H}
json.dump(out, open(os.path.join(D, 'prompts.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(out), 'heroes; longest prompt', max(len(v['icons']) for v in out.values()), 'chars')
