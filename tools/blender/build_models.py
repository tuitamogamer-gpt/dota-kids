"""
DOTA Kids 3D — Blender generator modela
=======================================
Proceduralno modelira i animira SVE 3D modele igre (10 junaka, vojnike,
čudovišta iz džungle, kule, prijestole, fontanu, drveće i ukrase) i izvozi
ih u jedan GLB koji igra učitava preko three.js GLTFLoadera.

Pokretanje (Blender 4.2+ / 5.x):
    blender -b -P tools/blender/build_models.py
ili s Blenderom kao Python modulom (pip install bpy):
    python tools/blender/build_models.py [--preview]

Izlaz:
    assets/models.glb   — svi modeli + animacije (idle / walk / attack / cast)
    assets/models.js    — isti GLB kao base64 (da igra radi i s file://)
    --preview           — tools/blender/preview.png (Cycles render svih modela)
    --no-ao             — preskoči pečenje ambijentalne okluzije (brže iteracije)

Konvencije (čita ih scene3d.js):
  * svaki model je korijenski Empty s imenom npr. "hero_vitez", "tower"
  * model gleda prema +X (Blender), gore je +Z  →  three.js: +X naprijed, +Y gore
  * animacije se zovu "<model>|<radnja>"
  * materijali: VC (boje vrhova), TEAM (boje vrhova × boja tima),
    GLOW (svijetli, bez sjene), TEAMGLOW (svijetli u boji tima)
"""
import bpy, bmesh, math, os, sys, base64, random, time
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ASSETS = os.path.join(ROOT, 'assets')
FPS = 24
RAD = math.radians

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
WANT_PREVIEW = '--preview' in argv


# ------------------------------------------------------------------ boje
def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def col(h):
    """'#rrggbb' → linearne RGB komponente (glTF COLOR_0 je linearan)."""
    h = h.lstrip('#')
    return tuple(srgb2lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))

def mix(a, b, t):
    ha, hb = a.lstrip('#'), b.lstrip('#')
    ca = [int(ha[i:i + 2], 16) for i in (0, 2, 4)]
    cb = [int(hb[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join('%02x' % round(x + (y - x) * t) for x, y in zip(ca, cb))


# ------------------------------------------------------------------ scena
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    return sc

SLOT = {'vc': 0, 'team': 1, 'glow': 2, 'teamglow': 3, 'metal': 4}
MATS = []
# v0.29: sjajni metal (kao u LoL-u) — dijelovi u ovim bojama dobivaju METAL materijal.
# Samo jasno metalne boje: npr. #fde68a je i trbuh pčele, a #9aa3ad kamen golema (golem nije u build_heroes).
CHAR_METAL = {'#f6c945', '#dfe6ee', '#9fb0c0', '#c9d3de', '#b8c4d0', '#9aa7b5', '#d6dde6', '#e2e8f0', '#a9a2b4',
              '#9aa3ad', '#cfd8e3'}
BLDG_METAL = {'#f6c945', '#e9bf62', '#d9a73e', '#f6d77a', '#fde68a'}
METAL_SET = set()   # trenutno uključen skup (postavlja ga graditelj modela)

def make_materials():
    MATS.clear()
    def base(name):
        m = bpy.data.materials.new(name)
        try:
            m.use_nodes = True
        except Exception:
            pass
        nt = m.node_tree
        bsdf = nt.nodes.get('Principled BSDF')
        bsdf.inputs['Roughness'].default_value = 0.8
        vc = nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        return m, nt, bsdf, vc
    # VC
    m, nt, bsdf, vc = base('VC')
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    MATS.append(m)
    # TEAM — u pregledu plava; u igri three.js množi s bojom tima
    m, nt, bsdf, vc = base('TEAM')
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    mul.inputs['B'].default_value = (0.15, 0.35, 0.95, 1)
    nt.links.new(vc.outputs['Color'], mul.inputs['A'])
    nt.links.new(mul.outputs['Result'], bsdf.inputs['Base Color'])
    MATS.append(m)
    # GLOW
    m, nt, bsdf, vc = base('GLOW')
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 2.0
    MATS.append(m)
    # TEAMGLOW
    m, nt, bsdf, vc = base('TEAMGLOW')
    bsdf.inputs['Base Color'].default_value = (0.3, 0.6, 1.0, 1)
    bsdf.inputs['Emission Color'].default_value = (0.3, 0.6, 1.0, 1)
    bsdf.inputs['Emission Strength'].default_value = 2.5
    MATS.append(m)
    # METAL — zlato i čelik (boja iz vrhova); u igri: MeshStandardMaterial s metalnošću i odsjajem okoline
    m, nt, bsdf, vc = base('METAL')
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = 0.8
    bsdf.inputs['Roughness'].default_value = 0.3
    MATS.append(m)


# ------------------------------------------------------------------ glatkoća
SHARP_ANGLE = math.radians(40)


def smooth_seg(seg, r):
    """više segmenata za okrugle oblike — veće kugle dobiju još više"""
    u, v = seg
    if r > 0.07:
        u, v = max(u, 14), max(v, 10)
    if r > 0.14:
        u, v = max(u, 18), max(v, 12)
    if r > 0.26:
        u, v = max(u, 24), max(v, 16)
    return (min(u, 28), min(v, 18))


# ------------------------------------------------------------------ dijelovi
class Part:
    """Jedan kruti dio modela (npr. lijeva noga). Geometrija se zadaje u
    koordinatama MODELA; pivot je točka oko koje se dio okreće."""

    def __init__(self, model, name, pivot, parent):
        self.model = model
        self.name = name
        self.pivot = Vector(pivot)
        self.parent = parent
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new('Col')
        self.obj = None

    def M(self, c, rot, scale):
        return (Matrix.Translation(Vector(c) - self.pivot)
                @ Euler([RAD(a) for a in rot]).to_matrix().to_4x4()
                @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1)))

    def _paint(self, before, color, mat, smooth):
        if mat == 'vc' and METAL_SET and isinstance(color, str) and color.lower() in METAL_SET:
            mat = 'metal'
        c = col(color) if isinstance(color, str) else color
        for f in self.bm.faces:
            if f in before:
                continue
            f.material_index = SLOT[mat]
            f.smooth = smooth
            for l in f.loops:
                l[self.col] = (c[0], c[1], c[2], 1.0)

    def sphere(self, c, r, color, mat='vc', rot=(0, 0, 0), seg=(12, 8), smooth=True):
        if isinstance(r, (int, float)):
            r = (r, r, r)
        seg = smooth_seg(seg, max(r))
        before = set(self.bm.faces)
        bmesh.ops.create_uvsphere(self.bm, u_segments=seg[0], v_segments=seg[1],
                                  radius=1.0, matrix=self.M(c, rot, r))
        self._paint(before, color, mat, smooth)
        return self

    def ico(self, c, r, color, mat='vc', rot=(0, 0, 0), sub=1, smooth=False, jitter=0.0, seed=1):
        if isinstance(r, (int, float)):
            r = (r, r, r)
        if sub == 1 and max(r) > 0.08:
            sub = 2
        before = set(self.bm.faces)
        ret = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0,
                                         matrix=self.M(c, rot, r))
        if jitter:
            # glatke izbočine (zbroj nekoliko sinusnih valova po smjeru) umjesto nasumičnog šuma po vrhu
            rnd = random.Random(seed)
            waves = [(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized() * rnd.uniform(1.5, 3.2),
                      rnd.uniform(0, math.tau), w) for w in (0.55, 0.3, 0.15)]
            ctr = Vector(c) - self.pivot
            for v in ret['verts']:
                d = v.co - ctr
                n = d.normalized() if d.length > 1e-9 else d
                k = sum(w * math.sin(a.dot(n) * 2.0 + ph) for a, ph, w in waves)
                v.co = ctr + d * (1 + jitter * k)
        self._paint(before, color, mat, smooth)
        return self

    def box(self, c, size, color, mat='vc', rot=(0, 0, 0), bevel=0.0, smooth=False):
        before = set(self.bm.faces)
        ret = bmesh.ops.create_cube(self.bm, size=1.0, matrix=self.M(c, rot, size))
        bevel = max(bevel, min(min(size) * 0.18, 0.03))   # nijedan rub nije oštar
        if bevel > 0.0005:
            edges = list({e for v in ret['verts'] for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges, offset=min(bevel, min(size) * 0.45), segments=3,
                            affect='EDGES', profile=0.5)
        self._paint(before, color, mat, smooth)
        return self

    def cyl(self, p1, p2, r1, r2, color, mat='vc', seg=10, smooth=False, caps=True):
        """valjak/stožac od točke p1 (polumjer r1) do p2 (polumjer r2)"""
        p1, p2 = Vector(p1), Vector(p2)
        rm = max(r1, r2)
        if rm >= 0.04:
            seg = max(seg, 10 if rm < 0.12 else (14 if rm < 0.25 else 18))
        d = p2 - p1
        L = d.length
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        m = (Matrix.Translation((p1 + p2) / 2 - self.pivot) @ q.to_matrix().to_4x4())
        before = set(self.bm.faces)
        bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg,
                              radius1=r1, radius2=r2, depth=L, matrix=m)
        self._paint(before, color, mat, smooth)
        return self

    def _shell_done(self, before, pred, inner):
        new = [f for f in self.bm.faces if f not in before]
        if pred:
            rm = [f for f in new if pred(*(f.calc_center_median() + self.pivot))]
            bmesh.ops.delete(self.bm, geom=rm, context='FACES')
            new = [f for f in new if f.is_valid]
        if inner:
            bmesh.ops.reverse_faces(self.bm, faces=new)

    def shell(self, c, r, color, lining, pred=None, thick=0.012, mat='vc', seg=(24, 16)):
        """v0.52 odjeća: elipsoidna ljuska s podstavom (unutarnja strana druge boje, okrenuta prema unutra);
        plohe za koje pred(x, y, z) (središte plohe u koordinatama modela) vrati True se izrežu (otvor sprijeda)"""
        for k, (cc, rr) in enumerate(((color, r), (lining, tuple(x - thick for x in r)))):
            before = set(self.bm.faces)
            bmesh.ops.create_uvsphere(self.bm, u_segments=seg[0], v_segments=seg[1], radius=1.0, matrix=self.M(c, (0, 0, 0), rr))
            self._shell_done(before, pred, k == 1)
            self._paint(before, cc, mat, True)
        return self

    def shell_cone(self, p1, p2, r1, r2, color, lining, pred=None, thick=0.012, mat='vc', seg=24):
        """v0.52 odjeća: plašt stošca (bez poklopaca) s podstavom — duge halje; pred kao kod shell()"""
        p1, p2 = Vector(p1), Vector(p2)
        d = p2 - p1
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        m = Matrix.Translation((p1 + p2) / 2 - self.pivot) @ q.to_matrix().to_4x4()
        for k, (cc, a, b_) in enumerate(((color, r1, r2), (lining, r1 - thick, r2 - thick))):
            before = set(self.bm.faces)
            bmesh.ops.create_cone(self.bm, cap_ends=False, cap_tris=False, segments=seg, radius1=a, radius2=b_, depth=d.length, matrix=m)
            self._shell_done(before, pred, k == 1)
            self._paint(before, cc, mat, True)
        return self

    def poly(self, pts, color, mat='vc', thick=0.0):
        """ravni poligon (krila, peraja); zadaj točke redom"""
        before = set(self.bm.faces)
        vs = [self.bm.verts.new(Vector(p) - self.pivot) for p in pts]
        self.bm.faces.new(vs)
        if thick:
            n = (Vector(pts[1]) - Vector(pts[0])).cross(Vector(pts[2]) - Vector(pts[0])).normalized()
            vs2 = [self.bm.verts.new(Vector(p) - self.pivot - n * thick) for p in pts]
            self.bm.faces.new(list(reversed(vs2)))
            k = len(pts)
            for i in range(k):
                self.bm.faces.new([vs[i], vs2[i], vs2[(i + 1) % k], vs[(i + 1) % k]])
        self._paint(before, color, mat, False)
        return self

    def arc(self, center, radius, a0, a1, n, thick, color, plane='xz', mat='vc', seg=6):
        """luk od malih valjaka (lukovi, polumjeseci)"""
        pts = []
        for i in range(n + 1):
            a = RAD(a0 + (a1 - a0) * i / n)
            if plane == 'xz':
                pts.append(Vector(center) + Vector((math.cos(a) * radius, 0, math.sin(a) * radius)))
            elif plane == 'yz':
                pts.append(Vector(center) + Vector((0, math.cos(a) * radius, math.sin(a) * radius)))
            else:
                pts.append(Vector(center) + Vector((math.cos(a) * radius, math.sin(a) * radius, 0)))
        for i in range(n):
            self.cyl(pts[i], pts[i + 1], thick, thick, color, mat=mat, seg=seg)
        return pts

    def build(self, coll):
        me = bpy.data.meshes.new(self.model.name + '_' + self.name)
        for m in MATS:
            me.materials.append(m)
        # glatko sjenčanje svugdje; samo pravi lomovi (poklopci valjaka, rubovi krila, kristali) ostaju oštri
        for f in self.bm.faces:
            f.smooth = True
        for e in self.bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > SHARP_ANGLE:
                e.smooth = False
        self.bm.to_mesh(me)
        self.bm.free()
        ca = me.color_attributes.get('Col')
        if ca:
            me.color_attributes.active_color = ca
            me.color_attributes.render_color_index = me.color_attributes.find('Col')
        ob = bpy.data.objects.new(self.model.name + '_' + self.name, me)
        coll.objects.link(ob)
        if self.parent is None:
            ob.parent = self.model.root
            ob.location = self.pivot
        else:
            ob.parent = self.parent.obj
            ob.location = self.pivot - self.parent.pivot
        self.obj = ob
        self.rest = ob.location.copy()
        return ob


class Model:
    def __init__(self, name):
        self.name = name
        self.parts = {}
        self.order = []
        self.anims = []
        self.root = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(self.root)

    def part(self, name, pivot=(0, 0, 0), parent=None):
        if isinstance(parent, str):
            parent = self.parts[parent]
        p = Part(self, name, pivot, parent)
        self.parts[name] = p
        self.order.append(p)
        return p

    def __getitem__(self, k):
        return self.parts[k]

    def anim(self, action, length, tracks, linear=()):
        """tracks: {dio: [(frame, (rx,ry,rz) u stupnjevima, (lx,ly,lz) pomak)]}"""
        self.anims.append((action, length, tracks, set(linear)))

    def finish(self):
        coll = bpy.context.scene.collection
        for p in self.order:
            p.build(coll)
        prefs = bpy.context.preferences.edit
        old_interp = prefs.keyframe_new_interpolation_type
        for action, length, tracks, linear in self.anims:
            for pname, keys in tracks.items():
                if pname not in self.parts or not keys:
                    continue
                ob = self.parts[pname].obj
                rest = self.parts[pname].rest
                prefs.keyframe_new_interpolation_type = 'LINEAR' if pname in linear else 'BEZIER'
                ad = ob.animation_data or ob.animation_data_create()
                act = bpy.data.actions.new('%s|%s|%s' % (self.name, action, pname))
                ad.action = act
                for k in keys:
                    f, rot = k[0], k[1]
                    loc = k[2] if len(k) > 2 else (0, 0, 0)
                    ob.rotation_euler = Euler([RAD(a) for a in rot])
                    ob.location = rest + Vector(loc)
                    ob.keyframe_insert('rotation_euler', frame=f)
                    ob.keyframe_insert('location', frame=f)
                ad.action = None
                tr = ad.nla_tracks.new()
                tr.name = '%s|%s' % (self.name, action)
                tr.strips.new(tr.name, 0, act)
                ob.rotation_euler = (0, 0, 0)
                ob.location = rest
        prefs.keyframe_new_interpolation_type = old_interp
        return self


# ------------------------------------------------------------------ pomoćne animacije
def biped_anims(m, kind='melee', wings=False, tail=True, arm_wings=False):
    Z = (0, 0, 0)
    # ---- IDLE (2 s)
    idle = {
        'body': [(0, Z, Z), (24, (0, 2, 0), (0, 0, -0.018)), (48, Z, Z)],
        'head': [(0, Z), (16, (4, -2, 6)), (32, (-3, 1, -5)), (48, Z)],
        'armL': [(0, (-4, 0, 0)), (24, (-9, -6, 0)), (48, (-4, 0, 0))],
        'armR': [(0, (4, 0, 0)), (24, (9, -6, 0)), (48, (4, 0, 0))],
    }
    if tail:
        idle['tail'] = [(0, (0, 0, -14)), (24, (0, 6, 14)), (48, (0, 0, -14))]
    if wings:
        idle['wingL'] = [(0, (0, 0, 0)), (24, (14, 0, -8)), (48, (0, 0, 0))]
        idle['wingR'] = [(0, (0, 0, 0)), (24, (-14, 0, 8)), (48, (0, 0, 0))]
    m.anim('idle', 48, idle)
    # ---- WALK (20 kadrova; igra skalira brzinu prema brzini junaka)
    sw = 34
    aw = 28 if not arm_wings else 12
    walk = {
        'legL': [(0, (0, sw, 0)), (10, (0, -sw, 0)), (20, (0, sw, 0))],
        'legR': [(0, (0, -sw, 0)), (10, (0, sw, 0)), (20, (0, -sw, 0))],
        'body': [(0, (0, 4, 4), Z), (5, (0, 5, 0), (0, 0, 0.05)), (10, (0, 4, -4), Z),
                 (15, (0, 5, 0), (0, 0, 0.05)), (20, (0, 4, 4), Z)],
        'head': [(0, (0, -3, -4)), (10, (0, -3, 4)), (20, (0, -3, -4))],
        'armL': [(0, (-6, -aw, 0)), (10, (-6, aw, 0)), (20, (-6, -aw, 0))],
        'armR': [(0, (6, aw * 0.6, 0)), (10, (6, -aw * 0.6, 0)), (20, (6, aw * 0.6, 0))],
    }
    if arm_wings:
        walk['armL'] = [(0, (-20, 0, 0)), (10, (-34, -10, 0)), (20, (-20, 0, 0))]
        walk['armR'] = [(0, (20, 0, 0)), (10, (34, -10, 0)), (20, (20, 0, 0))]
    if tail:
        walk['tail'] = [(0, (0, 0, -18)), (10, (0, 0, 18)), (20, (0, 0, -18))]
    if wings:
        walk['wingL'] = [(0, (0, 0, 0)), (10, (22, 0, -10)), (20, (0, 0, 0))]
        walk['wingR'] = [(0, (0, 0, 0)), (10, (-22, 0, 10)), (20, (0, 0, 0))]
    m.anim('walk', 20, walk)
    # ---- ATTACK (14 kadrova ≈ 0.58 s; udarac TOČNO u 7. kadru — game.js ATK_POINT tada nanosi štetu)
    #      napinjanje (3–5) → brz udarac (7) → zamah prolazi dalje (9) → smiri se (14)
    if kind == 'melee':
        atk = {
            'armR': [(0, Z), (3, (10, -160, 0)), (5, (12, -172, 0)), (7, (-6, -30, 0)), (9, (-4, -8, 0)), (11, (0, -18, 0)), (14, Z)],
            'armL': [(0, Z), (3, (0, -35, 0)), (5, (0, -40, 0)), (7, (0, 20, 0)), (10, (0, 10, 0)), (14, Z)],
            'body': [(0, Z, Z), (3, (0, -8, 12), (-0.03, 0, 0)), (5, (0, -9, 14), (-0.04, 0, 0)), (7, (0, 16, -16), (0.09, 0, 0)),
                     (9, (0, 12, -12), (0.08, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (3, (0, 5, 0)), (5, (0, 6, 0)), (7, (0, -8, 0)), (14, Z)],
            'legL': [(0, Z), (5, (0, 10, 0)), (7, (0, -20, 0)), (10, (0, -16, 0)), (14, Z)],   # iskorak naprijed
            'legR': [(0, Z), (5, (0, -6, 0)), (7, (0, 14, 0)), (10, (0, 10, 0)), (14, Z)],
        }
    elif kind == 'claws':
        atk = {   # desna šapa udara u 7. kadru, lijeva dovrši u 10.
            'armR': [(0, Z), (3, (30, -125, 0)), (5, (32, -135, 0)), (7, (-20, -65, 0)), (9, (-24, -50, 0)), (14, Z)],
            'armL': [(0, Z), (5, (-20, -60, 0)), (8, (-30, -125, 0)), (10, (20, -65, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -6, 8), (-0.03, 0, 0)), (7, (0, 14, -12), (0.09, 0, 0)), (10, (0, 12, 10), (0.08, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (4, (0, 6, 0)), (7, (0, -8, 0)), (14, Z)],
            'legL': [(0, Z), (7, (0, -16, 0)), (14, Z)],
            'legR': [(0, Z), (7, (0, 10, 0)), (14, Z)],
        }
    elif kind == 'bow':
        atk = {   # napni (4–6), pusti u 7. kadru, ruka s tetivom odleti unatrag, tijelo se trzne
            'armL': [(0, Z), (4, (0, -88, 0)), (9, (0, -88, 0)), (14, Z)],
            'armR': [(0, Z), (4, (0, -80, 0)), (6, (0, -68, 0), (-0.12, 0, 0)), (7, (0, -66, 0), (-0.13, 0, 0)), (8, (0, -58, 0), (-0.19, 0, 0)),
                     (10, (0, -80, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -4, 18), Z), (7, (0, -6, 18), (-0.02, 0, 0)), (8, (0, -11, 18), (-0.05, 0, 0)), (10, (0, -4, 12), Z), (14, Z, Z)],
            'head': [(0, Z), (4, (0, 0, -12)), (8, (0, -4, -12)), (14, Z)],
        }
    elif kind == 'wing':
        atk = {
            'armR': [(0, Z), (4, (60, -40, 0)), (7, (-10, -100, 0)), (14, Z)],
            'armL': [(0, Z), (4, (-60, -40, 0)), (7, (10, -100, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -8, 0), (0, 0, 0.06)), (7, (0, 12, 0), (0.05, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (7, (0, 8, 0)), (14, Z)],
        }
    elif kind == 'rifle':
        atk = {   # v0.38 puška: nanišani (2–6), hitac u 7. kadru — puška se trzne uvis, tijelo unatrag
            'armR': [(0, Z), (3, (0, -31, 0)), (6, (0, -30, 0)), (7, (0, -49, 0), (-0.06, 0, 0.02)), (9, (0, -41, 0), (-0.03, 0, 0.01)), (14, Z)],
            'armL': [(0, Z), (3, (-18, -66, 0)), (6, (-18, -65, 0)), (7, (-18, -80, 0)), (9, (-18, -74, 0)), (14, Z)],
            'body': [(0, Z, Z), (3, (0, 5, 8), Z), (6, (0, 5, 8), Z), (7, (0, -8, 8), (-0.06, 0, 0)), (9, (0, -4, 6), (-0.03, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (3, (0, 6, -12)), (6, (0, 6, -12)), (7, (0, -3, -12)), (14, Z)],
            'legL': [(0, Z), (3, (0, -14, 0)), (9, (0, -14, 0)), (14, Z)],
            'legR': [(0, Z), (3, (0, 10, 0)), (9, (0, 10, 0)), (14, Z)],
            'tail': [(0, Z), (7, (0, 14, 10)), (14, Z)],
        }
    else:  # mage: ruka se digne, pa u 7. kadru "gurne" kuglu prema meti
        atk = {
            'armR': [(0, Z), (4, (0, -150, 0)), (5, (0, -155, 0)), (7, (0, -92, 0), (0.06, 0, 0)), (9, (0, -86, 0), (0.04, 0, 0)), (14, Z)],
            'armL': [(0, Z), (4, (-10, -25, 0)), (7, (-6, 10, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -7, 0), (-0.02, 0, 0)), (7, (0, 12, 0), (0.06, 0, 0)), (9, (0, 9, 0), (0.05, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (4, (0, -4, 0)), (7, (0, 6, 0)), (14, Z)],
            'legL': [(0, Z), (7, (0, -12, 0)), (14, Z)],
        }
    m.anim('attack', 14, atk)
    # ---- ATTACK2 (14 kadrova): drugi zamah — s druge strane / s obje ruke
    if kind in ('melee', 'claws'):
        atk2 = {
            'armR': [(0, Z), (4, (-40, -150, 0)), (7, (30, -40, 0)), (10, (10, -20, 0)), (14, Z)],
            'armL': [(0, Z), (4, (40, -120, 0)), (7, (-20, -60, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -8, -14), Z), (7, (0, 12, 16), (0.07, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (4, (0, 2, -8)), (7, (0, -6, 8)), (14, Z)],
            'legL': [(0, Z), (7, (0, -10, 0)), (14, Z)],
            'legR': [(0, Z), (7, (0, 10, 0)), (14, Z)],
        }
    elif kind == 'rifle':
        atk2 = {   # nanišanjeni hitac: dulje nišanjenje, jači trzaj (krit / Savršen hitac)
            'armR': [(0, Z), (3, (0, -32, 0)), (6, (0, -32, 0)), (7, (0, -63, 0), (-0.1, 0, 0.04)), (10, (0, -45, 0), (-0.05, 0, 0.02)), (14, Z)],
            'armL': [(0, Z), (3, (-18, -67, 0)), (6, (-18, -67, 0)), (7, (-18, -92, 0)), (10, (-18, -78, 0)), (14, Z)],
            'body': [(0, Z, Z), (3, (0, 8, 10), (0, 0, -0.03)), (6, (0, 8, 10), (0, 0, -0.03)), (7, (0, -12, 10), (-0.1, 0, 0)), (10, (0, -6, 6), (-0.05, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (3, (0, 8, -14)), (7, (0, -6, -14)), (14, Z)],
            'legL': [(0, Z), (3, (0, -20, 0)), (10, (0, -20, 0)), (14, Z)],
            'legR': [(0, Z), (3, (0, 14, 0)), (10, (0, 14, 0)), (14, Z)],
        }
    elif kind == 'wing':
        atk2 = {
            'armR': [(0, Z), (3, (80, -20, 0)), (6, (-30, -110, 0)), (9, (60, -30, 0)), (14, Z)],
            'armL': [(0, Z), (3, (-80, -20, 0)), (6, (30, -110, 0)), (9, (-60, -30, 0)), (14, Z)],
            'body': [(0, Z, Z), (6, (0, 10, 0), (0, 0, 0.1)), (14, Z, Z)],
            'head': [(0, Z), (6, (0, 10, 0)), (14, Z)],
        }
    else:
        atk2 = {
            'armR': [(0, Z), (4, (30, -120, 0)), (7, (-10, -100, 0)), (14, Z)],
            'armL': [(0, Z), (4, (-30, -120, 0)), (7, (10, -100, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -8, 0), (0, 0, 0.05)), (7, (0, 8, 0), (0.05, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (7, (0, 6, 0)), (14, Z)],
        }
    m.anim('attack2', 14, atk2)
    # ---- CAST (18 kadrova)
    cast = {
        'armR': [(0, Z), (6, (14, -170, 0)), (7, (14, -172, 0)), (10, (0, -78, 0)), (12, (-4, -62, 0)), (18, Z)],
        'armL': [(0, Z), (6, (-14, -170, 0)), (7, (-14, -172, 0)), (10, (0, -78, 0)), (12, (4, -62, 0)), (18, Z)],
        'body': [(0, Z, Z), (6, (0, -8, 0), (0, 0, 0.12)), (7, (0, -9, 0), (0, 0, 0.13)), (10, (0, 12, 0), (0.05, 0, -0.01)),
                 (12, (0, 10, 0), (0.05, 0, -0.03)), (18, Z, Z)],
        'head': [(0, Z), (6, (0, -12, 0)), (10, (0, 8, 0)), (18, Z)],
        'legL': [(0, Z), (6, (0, -18, 0)), (10, (0, 8, 0)), (12, (0, 14, 0)), (18, Z)],
        'legR': [(0, Z), (6, (0, 14, 0)), (10, (0, -6, 0)), (12, (0, -10, 0)), (18, Z)],
    }
    if wings:
        cast['wingL'] = [(0, Z), (5, (40, 0, -20)), (9, (-10, 0, 10)), (18, Z)]
        cast['wingR'] = [(0, Z), (5, (-40, 0, 20)), (9, (10, 0, -10)), (18, Z)]
    m.anim('cast', 18, cast)
    # ---- CAST2 (16 kadrova): magija s ciljem — zamah pa ispruženom rukom "baci" prema cilju
    cast2 = {
        'armR': [(0, Z), (5, (14, -150, 0)), (8, (0, -80, 0)), (12, (0, -84, 0)), (16, Z)],
        'armL': [(0, Z), (5, (-25, -40, 0)), (8, (-10, 25, 0)), (16, Z)],
        'body': [(0, Z, Z), (5, (0, -8, 14), (0, 0, 0.02)), (8, (0, 14, -10), (0.06, 0, 0)), (12, (0, 10, -6), (0.04, 0, 0)), (16, Z, Z)],
        'head': [(0, Z), (5, (0, -8, 6)), (8, (0, 8, -4)), (16, Z)],
        'legL': [(0, Z), (8, (0, -18, 0)), (16, Z)],
        'legR': [(0, Z), (8, (0, 12, 0)), (16, Z)],
    }
    if wings:
        cast2['wingL'] = [(0, Z), (5, (30, 0, -14)), (9, (-8, 0, 8)), (16, Z)]
        cast2['wingR'] = [(0, Z), (5, (-30, 0, 14)), (9, (8, 0, -8)), (16, Z)]
    m.anim('cast2', 16, cast2)
    # ---- HIT (8 kadrova): trzaj unatrag
    m.anim('hit', 8, {
        'body': [(0, Z, Z), (3, (0, -14, 0), (-0.06, 0, 0)), (8, Z, Z)],
        'head': [(0, Z), (3, (0, -18, 0)), (8, Z)],
        'armL': [(0, Z), (3, (-24, -30, 0)), (8, Z)],
        'armR': [(0, Z), (3, (24, -30, 0)), (8, Z)],
    })
    # ---- DIE (16 kadrova): padne na leđa (zadnji kadar ostaje)
    die = {
        'body': [(0, Z, Z), (4, (0, -35, 0), (0, 0, 0.06)), (9, (0, -94, 0), (0, 0, -0.15)),
                 (12, (0, -84, 0), (0, 0, -0.12)), (16, (0, -90, 0), (0, 0, -0.15))],
        'head': [(0, Z), (4, (0, -16, 0)), (9, (0, 14, 0)), (16, (0, 10, 0))],
        'armL': [(0, Z), (5, (-60, -50, 0)), (16, (-75, -20, 0))],
        'armR': [(0, Z), (5, (60, -50, 0)), (16, (75, -20, 0))],
        'legL': [(0, Z, Z), (4, (0, -20, 0), (0, 0, -0.02)), (9, (0, -78, 0), (0.02, 0, -0.2)), (16, (0, -72, 0), (0.02, 0, -0.2))],
        'legR': [(0, Z, Z), (4, (0, -12, 0), (0, 0, -0.02)), (9, (0, -66, 0), (0.02, 0, -0.2)), (16, (0, -62, 0), (0.02, 0, -0.2))],
    }
    if tail:
        die['tail'] = [(0, Z), (9, (0, 40, 20)), (16, (0, 35, 10))]
    if wings:
        die['wingL'] = [(0, Z), (9, (60, 0, -30)), (16, (50, 0, -20))]
        die['wingR'] = [(0, Z), (9, (-60, 0, 30)), (16, (-50, 0, 20))]
    m.anim('die', 16, die)
    # ---- JUMP (14 kadrova): čučanj, skok, doskok — luk putanje radi three.js
    m.anim('jump', 14, {
        'body': [(0, Z, Z), (2, (0, 12, 0), (0, 0, -0.07)), (6, (0, -12, 0), (0, 0, 0.12)), (8, Z, (0, 0, 0.14)),
                 (11, (0, 10, 0), (0, 0, -0.06)), (14, Z, Z)],
        'legL': [(0, Z), (2, (0, 25, 0)), (6, (0, -55, 0)), (8, (0, -50, 0)), (11, (0, 20, 0)), (14, Z)],
        'legR': [(0, Z), (2, (0, 20, 0)), (6, (0, -45, 0)), (8, (0, -40, 0)), (11, (0, 15, 0)), (14, Z)],
        'armL': [(0, Z), (2, (-10, 30, 0)), (6, (-30, -130, 0)), (8, (-30, -140, 0)), (11, (-10, 20, 0)), (14, Z)],
        'armR': [(0, Z), (2, (10, 30, 0)), (6, (30, -130, 0)), (8, (30, -140, 0)), (11, (10, 20, 0)), (14, Z)],
        'head': [(0, Z), (2, (0, 10, 0)), (7, (0, -12, 0)), (11, (0, 6, 0)), (14, Z)],
    })
    # ---- CHANNEL (24 kadra, petlja): kleči s rukama uvis (teleport)
    m.anim('channel', 24, {
        'body': [(0, (0, 6, 0), (0, 0, -0.1)), (12, (0, 4, 0), (0, 0, -0.08)), (24, (0, 6, 0), (0, 0, -0.1))],
        'legL': [(0, (0, -40, 0), (0, 0, -0.04)), (24, (0, -40, 0), (0, 0, -0.04))],
        'legR': [(0, (0, 30, 0), (0, 0, -0.04)), (24, (0, 30, 0), (0, 0, -0.04))],
        'armL': [(0, (-25, -150, 0)), (12, (-35, -165, 0)), (24, (-25, -150, 0))],
        'armR': [(0, (25, -150, 0)), (12, (35, -165, 0)), (24, (25, -150, 0))],
        'head': [(0, (0, -18, 0)), (12, (0, -24, 0)), (24, (0, -18, 0))],
    })
    # ---- VICTORY (24 kadra, petlja): poskakivanje s rukama uvis
    m.anim('victory', 24, {
        'body': [(0, Z, Z), (4, (0, 6, 0), (0, 0, -0.05)), (10, (0, -6, 0), (0, 0, 0.22)), (16, Z, Z), (24, Z, Z)],
        'legL': [(0, Z), (10, (0, -35, 0)), (16, Z), (24, Z)],
        'legR': [(0, Z), (10, (0, -25, 0)), (16, Z), (24, Z)],
        'armL': [(0, (-20, -150, 0)), (10, (-45, -165, 0)), (16, (-20, -150, 0)), (24, (-20, -150, 0))],
        'armR': [(0, (20, -150, 0)), (10, (45, -165, 0)), (16, (20, -150, 0)), (24, (20, -150, 0))],
        'head': [(0, (0, -8, 0)), (10, (0, -16, 10)), (16, (0, -8, -10)), (24, (0, -8, 0))],
    })
    if kind == 'rifle':   # ---- AIM (24 kadra, petlja): drži nišan (Savršen hitac), lagano diše
        m.anim('aim', 24, {
            'armR': [(0, (0, -31, 0)), (12, (0, -32, 0)), (24, (0, -31, 0))],
            'armL': [(0, (-18, -66, 0)), (12, (-18, -67, 0)), (24, (-18, -66, 0))],
            'body': [(0, (0, 8, 10), (0, 0, -0.04)), (12, (0, 9, 10), (0, 0, -0.05)), (24, (0, 8, 10), (0, 0, -0.04))],
            'head': [(0, (0, 8, -14)), (12, (0, 9, -14)), (24, (0, 8, -14))],
            'legL': [(0, (0, -24, 0), (0, 0, -0.03)), (24, (0, -24, 0), (0, 0, -0.03))],
            'legR': [(0, (0, 18, 0), (0, 0, -0.03)), (24, (0, 18, 0), (0, 0, -0.03))],
        })
    # ---- IDLE2 (72 kadra, jednom): ogleda se i protegne
    m.anim('idle2', 72, {
        'head': [(0, Z), (14, (0, -4, 28)), (30, (0, -4, 28)), (44, (0, -4, -28)), (56, (0, -4, -28)), (72, Z)],
        'body': [(0, Z, Z), (40, (0, -3, 0), Z), (56, (0, -6, 0), (0, 0, 0.02)), (72, Z, Z)],
        'armL': [(0, (-4, 0, 0)), (40, (-4, 0, 0)), (56, (-25, -155, 0)), (66, (-25, -155, 0)), (72, (-4, 0, 0))],
        'armR': [(0, (4, 0, 0)), (40, (4, 0, 0)), (56, (25, -155, 0)), (66, (25, -155, 0)), (72, (4, 0, 0))],
    })


def quad_anims(m, heavy=1.0, wings=False, bz=0.5, W=0.3, H=0.3, lr=0.08):
    Z = (0, 0, 0)
    m.anim('idle', 48, {
        'body': [(0, Z, Z), (24, (0, -1.5, 0), (0, 0, -0.02 * heavy)), (48, Z, Z)],
        'head': [(0, Z), (16, (6, 4, 8)), (32, (-4, -2, -6)), (48, Z)],
        'tail': [(0, (0, 0, -18)), (24, (0, 0, 18)), (48, (0, 0, -18))],
        **({'wingL': [(0, Z), (24, (16, 0, 0)), (48, Z)],
            'wingR': [(0, Z), (24, (-16, 0, 0)), (48, Z)]} if wings else {}),
    })
    s = 30
    m.anim('walk', 20, {
        'legFL': [(0, (0, s, 0)), (10, (0, -s, 0)), (20, (0, s, 0))],
        'legBR': [(0, (0, s, 0)), (10, (0, -s, 0)), (20, (0, s, 0))],
        'legFR': [(0, (0, -s, 0)), (10, (0, s, 0)), (20, (0, -s, 0))],
        'legBL': [(0, (0, -s, 0)), (10, (0, s, 0)), (20, (0, -s, 0))],
        'body': [(0, (3, 0, 0), Z), (5, Z, (0, 0, 0.04)), (10, (-3, 0, 0), Z), (15, Z, (0, 0, 0.04)), (20, (3, 0, 0), Z)],
        'head': [(0, (0, 4, 0)), (5, (0, -2, 0)), (10, (0, 4, 0)), (15, (0, -2, 0)), (20, (0, 4, 0))],
        'tail': [(0, (0, 0, -24)), (10, (0, 0, 24)), (20, (0, 0, -24))],
        **({'wingL': [(0, Z), (10, (26, 0, 0)), (20, Z)],
            'wingR': [(0, Z), (10, (-26, 0, 0)), (20, Z)]} if wings else {}),
    })
    m.anim('attack', 14, {
        'body': [(0, Z, Z), (4, (0, -10, 0), (-0.08, 0, 0.04)), (7, (0, 10, 0), (0.18, 0, 0)), (14, Z, Z)],
        'head': [(0, Z), (4, (0, -22, 0)), (7, (0, 22, 0)), (14, Z)],
        'legFL': [(0, Z), (4, (0, -40, 0)), (7, (0, 20, 0)), (14, Z)],
        'legFR': [(0, Z), (4, (0, -40, 0)), (7, (0, 20, 0)), (14, Z)],
        **({'wingL': [(0, Z), (4, (40, 0, 0)), (8, (-10, 0, 0)), (14, Z)],
            'wingR': [(0, Z), (4, (-40, 0, 0)), (8, (10, 0, 0)), (14, Z)]} if wings else {}),
    })
    m.anim('hit', 8, {
        'body': [(0, Z, Z), (3, (0, -8, 0), (-0.08, 0, 0)), (8, Z, Z)],
        'head': [(0, Z), (3, (0, -16, 0)), (8, Z)],
    })
    # smrt: prevrne se na bok (trbuh prema +Y), noge polegnu u istom smjeru
    oy, oz = 0.1, -(bz - W - 0.04)
    die = {
        'body': [(0, Z, Z), (4, (40, 0, 0), (0, oy * 0.4, oz * 0.3)), (9, (92, 0, 0), (0, oy, oz)),
                 (12, (86, 0, 0), (0, oy, oz + 0.03)), (16, (90, 0, 0), (0, oy, oz))],
        'head': [(0, Z), (5, (0, -14, 0)), (16, (0, 8, 0))],
        'tail': [(0, Z), (9, (0, 0, 30)), (16, (0, 0, 25))],
    }
    for nm, y in (('legFL', W * 0.62), ('legFR', -W * 0.62), ('legBL', W * 0.62), ('legBR', -W * 0.62)):
        off = (0, bz - H - 0.05 + oy - y, y + bz + oz - (H + 0.05))
        die[nm] = [(0, Z, Z), (4, (40, 0, 0), tuple(v * 0.4 for v in off)), (9, (92, 0, 0), off), (16, (90, 0, 0), off)]
    if wings:
        die['wingL'] = [(0, Z), (9, (50, 0, 0)), (16, (45, 0, 0))]
        die['wingR'] = [(0, Z), (9, (-30, 0, 0)), (16, (-25, 0, 0))]
    m.anim('die', 16, die)


# ------------------------------------------------------------------ OČI, UŠI, NJUŠKE
def eyes(p, x, y, z, r=0.07, color='#1b1b2a', glint=True, spread=0.15, big=1.0, liner='#14141f', lashes=True):
    """oko: bjeloočnica/osnova, svjetlija šarenica, zjenica, dva odsjaja, tuš-linija i trepavice"""
    iris_c = '#3a3a5c' if color == '#1b1b2a' else mix(color, '#ffffff', 0.3)
    for s in (1, -1):
        rx, ry, rz = r * 0.8 * big, r * big, r * 1.2 * big
        cy = s * spread
        p.sphere((x, cy, z), (rx, ry, rz), color, seg=(14, 10))
        p.sphere((x + rx * 0.55, cy, z - rz * 0.06), (rx * 0.5, ry * 0.72, rz * 0.72), iris_c, seg=(12, 8))     # šarenica
        p.sphere((x + rx * 0.8, cy, z - rz * 0.06), (rx * 0.32, ry * 0.42, rz * 0.46), '#07070d', seg=(10, 7))  # zjenica
        p.sphere((x + rx * 0.9, cy - s * ry * 0.04, z - rz * 0.47), (rx * 0.13, ry * 0.36, rz * 0.13), mix(iris_c, '#ffffff', 0.5),
                 seg=(10, 6))   # v0.53: svjetliji polumjesec pri dnu šarenice — oko "svjetluca"
        if glint:
            p.sphere((x + r * 0.66, cy + s * 0.03, z + r * 0.45), r * 0.34, '#ffffff', seg=(7, 5))
            p.sphere((x + r * 0.7, cy - s * 0.03, z - r * 0.35), r * 0.15, '#ffffff', seg=(5, 4))
        if liner:
            p.arc((x + rx * 0.62, cy, z + rz * 0.02), (ry + rz) * 0.5, 22, 158, 8, r * 0.1, liner, plane='yz', seg=4)
            if lashes:   # dvije trepavice na vanjskom kutu
                for k, (dy, dz) in enumerate(((0.95, 0.55), (0.8, 0.82))):
                    a0 = (x + rx * 0.55, cy + s * ry * dy, z + rz * dz)
                    p.cyl(a0, (a0[0] + r * 0.05, a0[1] + s * r * 0.32, a0[2] + r * 0.22), r * 0.08, 0.0, liner, seg=4)


def on_sphere(center, radii, th, ph, out=0.0):
    """točka na površini elipsoida (kutovi u stupnjevima) — za pjege, znakove..."""
    th, ph = RAD(th), RAD(ph)
    d = Vector((math.cos(ph) * math.cos(th), math.cos(ph) * math.sin(th), math.sin(ph)))
    return (center[0] + d.x * (radii[0] + out), center[1] + d.y * (radii[1] + out), center[2] + d.z * (radii[2] + out))


def _orient(n, t):
    """v0.53: Euler (stupnjevi) koji lokalnu os x okrene u n (normala plohe), a os z u t (smjer duljine)"""
    t = Vector(t).normalized()
    n = Vector(n)
    n = (n - t * n.dot(t)).normalized()
    return tuple(math.degrees(a) for a in Matrix((n, t.cross(n), t)).transposed().to_euler('XYZ'))


def face_cap(p, hc, rad, th, ph, size, color, out=0.008, tilt=0.0):
    """v0.53: mrlja koja prianja uz glavu (sovin disk lica, majmunova maska): spljošteni elipsoid iz kojeg viri
    samo vrh, pa se rub glatko utapa u glavu; size = (pola širine, pola visine), out = koliko viri"""
    th_, ph_ = RAD(th), RAD(ph)
    d = Vector((math.cos(ph_) * math.cos(th_), math.cos(ph_) * math.sin(th_), math.sin(ph_)))
    pt = Vector(hc) + Vector((d.x * rad[0], d.y * rad[1], d.z * rad[2]))
    n = Vector((d.x / rad[0], d.y / rad[1], d.z / rad[2])).normalized()
    up = Vector((0, 0, 1))
    t = (up - n * up.dot(n)).normalized()
    if tilt:
        t = Matrix.Rotation(RAD(tilt), 3, n) @ t
    k = 0.42 * max(size)
    p.sphere(tuple(pt + n * (out - k)), (k, size[0], size[1]), color, rot=_orient(n, t), seg=(22, 14))


def feather(p, base, d, ln, w, color, nrm, thick=0.16, mat='vc'):
    """v0.53 pero (ili krilce kukca): spljošteni elipsoid od korijena base u smjeru d, duljine ln i širine w,
    plohom okrenut prema nrm"""
    d = Vector(d).normalized()
    p.sphere(tuple(Vector(base) + d * ln * 0.5), (w * thick, w * 0.5, ln * 0.5), color, mat=mat, rot=_orient(nrm, d), seg=(12, 8))


def brows(p, x, y, z, color, angle=12, spread=0.15, head=None, width=0.065):
    """obrve; angle > 0: unutarnji krajevi niže (odlučan pogled), < 0: podignuti (blag pogled).
    v0.53: s head=(središte, polumjeri) obrva je zaobljen luk koji prianja uz čelo i stanjuje se prema van"""
    if not head:
        for s in (1, -1):
            p.box((x, s * spread, z), (0.03, 0.11, 0.025), color, rot=(s * angle, 0, 0), bevel=0.008)
        return
    (hx, hy, hz_), (rx, ry, rz) = head
    ta = math.tan(RAD(angle))
    for s in (1, -1):
        pts = []
        for t in (-1.0, -0.4, 0.25, 0.85, 1.25):          # od unutarnjeg prema vanjskom kraju
            yy = s * (spread + t * width)
            zz = z + t * width * ta + 0.02 * (1 - min(1.0, t * t))
            q = 1 - ((yy - hy) / ry) ** 2 - ((zz - hz_) / rz) ** 2
            pts.append(Vector((hx + rx * math.sqrt(max(q, 0.04)) + 0.01, yy, zz)))
        rr = (0.02, 0.022, 0.019, 0.014, 0.007)
        for i in range(len(pts) - 1):
            p.cyl(tuple(pts[i]), tuple(pts[i + 1]), rr[i], rr[i + 1], color, seg=8, smooth=True)
            p.sphere(tuple(pts[i]), rr[i], color, seg=(8, 6))


def tuft(p, base, d, length, r, color, bend=(0.0, 0.0, 0.0), mat='vc'):
    """v0.29 čuperak krzna/perja: zakrivljeni stožac od dva dijela (kao pramenovi kod jordla u LoL-u)"""
    b0, dv, bv = Vector(base), Vector(d).normalized(), Vector(bend)
    mid = b0 + dv * length * 0.55
    tip = b0 + dv * length + bv * length
    p.cyl(tuple(b0), tuple(mid), r, r * 0.62, color, mat=mat, seg=7, smooth=True)
    p.cyl(tuple(mid), tuple(tip), r * 0.62, 0.0, color, mat=mat, seg=7, smooth=True)


def strap(p, center, radii, tilt, color, r=0.022, out=0.0, n=30):
    """v0.29 kožni remen preko tijela: nagnuti prsten po elipsoidu (preko jednog ramena do suprotnog boka);
    vraća točku sprijeda (za kopču)"""
    ct, st = math.cos(RAD(tilt)), math.sin(RAD(tilt))
    pts = []
    for i in range(n + 1):
        a = i / n * math.tau
        d = Vector((math.cos(a), math.sin(a) * ct, math.sin(a) * st))
        k = 1.0 / math.sqrt((d.x / radii[0]) ** 2 + (d.y / radii[1]) ** 2 + (d.z / radii[2]) ** 2)
        pts.append(Vector(center) + d * (k + out))
    for i in range(n):
        p.cyl(tuple(pts[i]), tuple(pts[i + 1]), r, r, color, seg=6)
    return pts[0]


def rim_points(cc, n, radius, count, phase=0.0):
    """točke na kružnici polumjera radius oko središta cc, u ravnini okomitoj na n (zakovice štita…)"""
    n = Vector(n).normalized()
    u = Vector((-n.y, n.x, 0.0))
    u = u.normalized() if u.length > 1e-6 else Vector((1.0, 0.0, 0.0))
    w = n.cross(u)
    return [Vector(cc) + (u * math.cos(phase + k * math.tau / count) + w * math.sin(phase + k * math.tau / count)) * radius
            for k in range(count)], u, w


# ------------------------------------------------------------------ v0.52 KOSTIMI JUNAKA
# Prije su svi junaci nosili istu suknju i šal/kapuljaču u boji tima ("plava uniforma"), a gornji dio tijela bio je
# golo krzno. Sada svaki nosi svoju odjeću u svojim bojama (kao na portretu): prsluk, kaput ili dugu halju s
# podstavom, obrubom, ovratnikom i rukavima. Boja tima ostaje na suknji s pregačom, dragulju na pojasu i krugu ispod
# junaka. Koordinate su kao u biped() (tijelo: elipsoid oko (0, 0, 0.70), polumjeri 0.27 / 0.29 / 0.33).
OUT_C, OUT_R = (-0.01, 0.0, 0.765), (0.292, 0.31, 0.27)   # ljuska prsluka: malo veća od tijela, završava pod glavom


def outfit_torso(b, V, S, o):
    """prsluk / kaput / halja; o: style, cloth, lining, trim, open (pola otvora sprijeda, °, višekratnik 15),
    collar (boja ili 'fur'), fur (boja krznenog ruba), buttons (boja), tails (kaput: skuti straga)"""
    style = o.get('style', 'vest')
    cloth = o['cloth']
    lining = o.get('lining', mix(cloth, '#000000', 0.35))
    trim = o.get('trim', '#f6c945')
    op = o.get('open', 30)
    Cs, Rs = V(*OUT_C), tuple(r * S for r in OUT_R)

    def front(x, y, z):   # parametarski kut oko osi prsluka: izrez sprijeda
        return abs(math.degrees(math.atan2((y - Cs[1]) / Rs[1], (x - Cs[0]) / Rs[0]))) < op
    b.shell(Cs, Rs, cloth, lining, pred=front if op else None, thick=0.012 * S)

    def edge(az, z0, z1):   # točke uz rub izreza: točno po prstenovima vrhova kugle (16 prstenova)
        pts = []
        for k in range(1, 16):
            ph = math.pi * k / 16
            z = Cs[2] + Rs[2] * math.cos(ph)
            if V(0, 0, z0)[2] <= z <= V(0, 0, z1)[2]:
                rr = math.sin(ph)
                pts.append((Cs[0] + Rs[0] * rr * math.cos(RAD(az)), Cs[1] + Rs[1] * rr * math.sin(RAD(az)), z))
        return pts
    if op:
        for sd in (1, -1):   # porub uz otvor
            pts = edge(sd * op, 0.6, 1.0)
            for i in range(len(pts) - 1):
                b.cyl(pts[i], pts[i + 1], 0.017 * S, 0.017 * S, trim, seg=6)
                b.sphere(pts[i + 1], 0.017 * S, trim, seg=(6, 4))
        if o.get('buttons'):
            for pt in edge(op + 12, 0.66, 0.92)[:3]:
                b.sphere(pt, 0.022 * S, o['buttons'], seg=(8, 6))
    col_ = o.get('collar')
    if col_ == 'fur':   # krzneni ovratnik (Ledena)
        fc = o.get('fur', '#ffffff')
        for i in range(12):
            a = math.tau * i / 12
            b.sphere(V(math.cos(a) * 0.235 - 0.01, math.sin(a) * 0.255, 0.955), (0.075 * S, 0.075 * S, 0.06 * S),
                     fc if i % 2 else mix(fc, '#c7d2fe', 0.25), seg=(10, 7))
    elif col_:   # visoki ovratnik (Žarko) / mornarski (Pipko)
        b.cyl(V(-0.01, 0, 0.92), V(-0.02, 0, 1.0), 0.245 * S, 0.232 * S, col_, seg=20, smooth=True)
        b.cyl(V(-0.02, 0, 0.995), V(-0.02, 0, 1.008), 0.234 * S, 0.232 * S, trim, seg=20, caps=False)
    if style == 'coat' and o.get('tails', True):   # skuti kaputa straga (preko suknje)
        for sd in (1, -1):
            pts = [V(-0.302, sd * 0.03, 0.645), V(-0.3, sd * 0.235, 0.645), V(-0.37, sd * 0.27, 0.31), V(-0.372, sd * 0.05, 0.34)]
            b.poly(pts if sd > 0 else list(reversed(pts)), cloth, thick=0.016 * S)
            b.cyl(pts[2], pts[3], 0.014 * S, 0.014 * S, o.get('fur', trim), seg=6)
            b.cyl(pts[1], pts[2], 0.012 * S, 0.012 * S, o.get('fur', trim), seg=6)
    if style == 'robe':   # duga halja do gležnja, otvorena sprijeda (vidi se suknja u boji tima)
        rop = o.get('robeOpen', 30)

        def rfront(x, y, z):
            return abs(math.degrees(math.atan2(y, x))) < rop
        z0, z1, r0, r1 = 0.665, 0.13, 0.302, 0.43
        b.shell_cone(V(0, 0, z0), V(0, 0, z1), r0 * S, r1 * S, cloth, lining, pred=rfront, thick=0.012 * S)
        hem = [V(math.cos(RAD(a)) * (r1 + 0.008), math.sin(RAD(a)) * (r1 + 0.008), z1 + 0.012) for a in range(rop, 360 - rop + 1, 15)]
        for i in range(len(hem) - 1):   # porub halje
            b.cyl(hem[i], hem[i + 1], 0.019 * S, 0.019 * S, trim, seg=6)
        for sd in (1, -1):   # porub uz otvor
            a = RAD(sd * rop)
            p0 = V(math.cos(a) * (r0 + 0.006), math.sin(a) * (r0 + 0.006), z0)
            p1 = V(math.cos(a) * (r1 + 0.006), math.sin(a) * (r1 + 0.006), z1 + 0.012)
            b.cyl(p0, p1, 0.017 * S, 0.017 * S, trim, seg=6)


def outfit_sleeve(a, V, S, side, o):
    """rukav kostima na nadlaktici (o['sleeves']: True = uski, 'bell' = široki čarobnjački)"""
    cloth, trim = o['cloth'], o.get('trim', '#f6c945')
    if o['sleeves'] == 'bell':
        p0, p1 = V(0.0, side * 0.305, 0.905), V(0.03, side * 0.375, 0.635)
        a.cyl(p0, p1, 0.09 * S, 0.13 * S, cloth, seg=14, smooth=True)
        a.cyl(V(0.031, side * 0.377, 0.64), V(0.031, side * 0.377, 0.62), 0.133 * S, 0.133 * S, trim, seg=14, caps=False)
    else:
        a.cyl(V(0.0, side * 0.305, 0.905), V(0.011, side * 0.338, 0.735), 0.09 * S, 0.086 * S, cloth, seg=12, smooth=True)
        a.cyl(V(0.0113, side * 0.3385, 0.745), V(0.012, side * 0.34, 0.728), 0.091 * S, 0.091 * S, o.get('fur', trim), seg=12, caps=False)


# ------------------------------------------------------------------ BIPED JUNAK
def biped(name, c, opts):
    """Chibi junak-životinja. c = paleta, opts = dodaci."""
    m = Model(name)
    fur, belly = c['fur'], c.get('belly', c['fur'])
    dark = c.get('dark', mix(fur, '#000000', 0.45))
    limb = c.get('limb', fur)
    feet = c.get('feet', mix(limb, '#000000', 0.25))
    S = opts.get('scale', 1.0)

    def V(x, y, z):
        return (x * S, y * S, z * S)

    # noge
    for side, nm in ((1, 'legL'), (-1, 'legR')):
        lg = m.part(nm, V(0, side * 0.14, 0.40))
        lg.cyl(V(0, side * 0.14, 0.42), V(0.0, side * 0.15, 0.12), 0.085 * S, 0.075 * S, limb, seg=10, smooth=True)
        lg.sphere(V(0.05, side * 0.15, 0.07), (0.13 * S, 0.09 * S, 0.075 * S), feet)
        lg.sphere(V(0.05, side * 0.15, 0.022), (0.135 * S, 0.094 * S, 0.026 * S), mix(feet, '#000000', 0.35), seg=(12, 6))   # potplat
        for k in (-1, 0, 1):   # prstići
            lg.sphere(V(0.165, side * 0.15 + k * 0.042, 0.06), (0.032 * S, 0.03 * S, 0.034 * S), mix(feet, '#ffffff', 0.08), seg=(7, 5))
        if opts.get('boots'):
            lg.cyl(V(0, side * 0.15, 0.24), V(0, side * 0.15, 0.08), 0.088 * S, 0.092 * S, opts['boots'], seg=10)
            # v0.29: čelična kapica prstiju i zlatni rub čizme
            lg.sphere(V(0.12, side * 0.15, 0.075), (0.07 * S, 0.085 * S, 0.055 * S), '#cfd8e3', seg=(12, 8))
            lg.cyl(V(0, side * 0.15, 0.235), V(0, side * 0.15, 0.255), 0.096 * S, 0.096 * S, '#f6c945', seg=12, caps=False)
    # tijelo
    b = m.part('body', V(0, 0, 0.42))
    b.sphere(V(0, 0, 0.70), (0.27 * S, 0.29 * S, 0.33 * S), fur, seg=(18, 12))
    b.sphere(V(0.10, 0, 0.68), (0.19 * S, 0.22 * S, 0.25 * S), belly, seg=(16, 10))
    tun = opts.get('tunic', 'team')
    if tun:
        b.cyl(V(0, 0, 0.40), V(0, 0, 0.64), 0.335 * S, 0.29 * S, '#ffffff', mat='team', seg=14)
        b.cyl(V(0, 0, 0.395), V(0, 0, 0.43), 0.34 * S, 0.335 * S, '#7d7d7d', mat='team', seg=14)
        b.cyl(V(0, 0, 0.60), V(0, 0, 0.665), 0.30 * S, 0.295 * S, '#5b3a1e', seg=14)
        b.box(V(0.29, 0, 0.632), (0.04 * S, 0.09 * S, 0.075 * S), '#f6c945', bevel=0.01)
        b.sphere(V(0.31, 0, 0.632), (0.018 * S, 0.026 * S, 0.026 * S), '#ffffff', mat='teamglow', seg=(8, 6))   # v0.29: dragulj u boji tima
        for zz in (0.604, 0.657):   # svijetli šavovi uz rubove pojasa
            rz = 0.303 - (zz - 0.6) / 0.065 * 0.005
            b.cyl(V(0, 0, zz), V(0, 0, zz + 0.005), rz * S, rz * S, '#9a7a52', seg=16, caps=False)
    if opts.get('chest'):
        b.sphere(V(0.08, 0, 0.80), (0.22 * S, 0.27 * S, 0.17 * S), opts['chest'], seg=(14, 8))
    if opts.get('chest') and opts.get('ornate', True):
        # v0.29: oklop — zlatni amblem (sunce), rub i zakovice (samo junaci, ne kameni golem)
        ec = V(0.3, 0, 0.81)
        b.sphere(ec, (0.025 * S, 0.05 * S, 0.05 * S), '#f6c945', seg=(10, 8))
        for k in range(8):
            a = RAD(k * 45)
            b.cyl(V(0.3, math.cos(a) * 0.045, 0.81 + math.sin(a) * 0.045), V(0.292, math.cos(a) * (0.08 if k % 2 else 0.1), 0.81 + math.sin(a) * (0.08 if k % 2 else 0.1)),
                  0.014 * S, 0.0, '#f6c945', seg=4)
        b.sphere(V(0.318, 0, 0.81), 0.016 * S, '#ffffff', mat='teamglow', seg=(8, 6))
        b.cyl(V(0.06, 0, 0.66), V(0.06, 0, 0.675), 0.232 * S, 0.232 * S, '#f6c945', seg=18, caps=False)   # donji rub oklopa
        for s_ in (1, -1):
            for zz in (0.74, 0.86):
                b.sphere(on_sphere(V(0.08, 0, 0.80), (0.22 * S, 0.27 * S, 0.17 * S), s_ * 55, (zz - 0.8) * 160, 0.0), 0.014 * S, '#f6c945', seg=(6, 4))
    if opts.get('scarf'):   # v0.52: scarfColor = šal u boji junaka (inače u boji tima)
        scc = opts.get('scarfColor')
        b.cyl(V(0, 0, 0.93), V(0, 0, 1.01), 0.25 * S, 0.22 * S, scc or '#ffffff', mat='vc' if scc else 'team', seg=14, smooth=True)
        b.box(V(-0.21, 0.07, 0.84), (0.05 * S, 0.09 * S, 0.2 * S), mix(scc, '#000000', 0.12) if scc else '#d8d8d8', mat='vc' if scc else 'team',
              rot=(0, -15, 10), bevel=0.012)
    if opts.get('cape'):   # v0.52: capeColor = plašt u boji junaka (Lavko crveni, Luna ljubičasti…)
        cpc = opts.get('capeColor')
        b.poly([V(-0.17, 0.25, 1.0), V(-0.17, -0.25, 1.0), V(-0.34, -0.33, 0.42), V(-0.36, 0, 0.36), V(-0.34, 0.33, 0.42)],
               cpc or '#c8c8c8', mat='vc' if cpc else 'team', thick=0.02)
        b.cyl(V(-0.02, 0, 0.98), V(-0.02, 0, 1.02), 0.24 * S, 0.22 * S, mix(cpc, '#ffffff', 0.1) if cpc else '#ffffff', mat='vc' if cpc else 'team', seg=12)
    if opts.get('stripesBody'):
        for zz in (0.62, 0.76, 0.9):
            for s in (1, -1):
                b.box(V(-0.04, s * 0.27, zz), (0.16 * S, 0.03 * S, 0.035 * S), dark, rot=(s * -18, 0, 0))
    ofit = opts.get('outfit')   # v0.52: kostim junaka (prsluk / kaput / halja)
    if ofit:
        outfit_torso(b, V, S, ofit)
    # rep
    if opts.get('tail'):
        t = m.part('tail', V(-0.24, 0, 0.55), 'body')
        tk = opts['tail']
        if tk == 'thin':
            t.cyl(V(-0.24, 0, 0.55), V(-0.48, 0, 0.62), 0.04 * S, 0.035 * S, fur, seg=8)
            t.cyl(V(-0.48, 0, 0.62), V(-0.6, 0, 0.82), 0.035 * S, 0.03 * S, fur, seg=8)
            t.sphere(V(-0.62, 0, 0.87), 0.08 * S, opts.get('tuft', dark))
        elif tk == 'bushy':
            t.sphere(V(-0.48, 0, 0.66), (0.26 * S, 0.14 * S, 0.14 * S), fur, rot=(0, -38, 0))
            t.sphere(V(-0.68, 0, 0.86), (0.13 * S, 0.11 * S, 0.11 * S), opts.get('tuft', '#ffffff'), rot=(0, -38, 0))
        elif tk == 'long':
            t.cyl(V(-0.22, 0, 0.55), V(-0.5, 0, 0.5), 0.09 * S, 0.06 * S, fur, seg=10, smooth=True)
            t.cyl(V(-0.5, 0, 0.5), V(-0.74, 0, 0.62), 0.06 * S, 0.03 * S, fur, seg=10, smooth=True)
            if opts.get('tailFlame'):
                t.sphere(V(-0.8, 0, 0.7), 0.075 * S, '#ff7a1a', mat='glow')
                t.sphere(V(-0.86, 0, 0.8), 0.055 * S, '#ffb020', mat='glow')
                t.sphere(V(-0.9, 0, 0.88), 0.035 * S, '#ffe26b', mat='glow')
            else:
                t.cyl(V(-0.74, 0, 0.62), V(-0.84, 0, 0.72), 0.06 * S, 0.0, opts.get('tuft', dark), seg=4)
        elif tk == 'ringed':
            pts = [V(-0.24, 0, 0.55), V(-0.4, 0, 0.6), V(-0.54, 0, 0.72), V(-0.62, 0, 0.88), V(-0.64, 0, 1.0)]
            for i in range(len(pts) - 1):
                t.cyl(pts[i], pts[i + 1], 0.085 * S, 0.08 * S, dark if i % 2 else fur, seg=10, smooth=True)
            t.sphere(pts[-1], 0.08 * S, dark)
        elif tk == 'catlong':
            pts = [V(-0.24, 0, 0.52), V(-0.45, 0, 0.5), V(-0.6, 0, 0.62), V(-0.64, 0, 0.82), V(-0.58, 0, 0.98)]
            for i in range(len(pts) - 1):
                t.cyl(pts[i], pts[i + 1], 0.045 * S, 0.04 * S, fur, seg=8, smooth=True)
            t.sphere(pts[-1], 0.05 * S, opts.get('tuft', fur))
        elif tk == 'stub':
            t.sphere(V(-0.3, 0, 0.5), 0.07 * S, fur)
        elif tk == 'squirrel':   # v0.38 vjeverica: golemi čupavi rep u obliku slova S, uvijen na vrhu
            pts = [(-0.24, 0, 0.55), (-0.42, 0, 0.6), (-0.56, 0, 0.78), (-0.6, 0, 1.0), (-0.55, 0, 1.22), (-0.42, 0, 1.38), (-0.28, 0, 1.42)]
            rr = [0.09, 0.15, 0.2, 0.22, 0.21, 0.17, 0.11]
            tipc = opts.get('tuft', mix(fur, '#ffffff', 0.25))
            for i, (pt, r_) in enumerate(zip(pts, rr)):
                cc = fur if i < 5 else tipc
                t.sphere(V(*pt), (r_ * S * 1.05, r_ * S * 0.82, r_ * S * 1.05), cc, seg=(14, 10))
                if 0 < i < len(pts) - 1:   # pramenovi krzna strše van
                    prev, nxt = Vector(pts[i - 1]), Vector(pts[i + 1])
                    tg = (nxt - prev).normalized()
                    out = Vector((-tg.z, 0, tg.x))   # okomito na rep, prema van (lijevo od smjera)
                    for sd, k_ in ((1, 0.0), (-1, 0.35), (0, 0.7)):
                        dv = (out * (1 if sd >= 0 else -1) + Vector((0, sd * 0.8 if sd else 0.9, 0))).normalized()
                        tuft(t, tuple(Vector(V(*pt)) + dv * r_ * S * 0.7), tuple(dv + tg * 0.4), r_ * 0.55 * S, r_ * 0.28 * S,
                             cc if (i + k_ * 3) % 2 < 1 else mix(cc, '#ffffff', 0.15), bend=tuple(-tg * 0.2))
        elif tk == 'rainbow':   # jednorog: rep od dugih pramenova
            rc = opts.get('rainbow', ('#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'))
            for i, cc in enumerate(rc):
                dy = (i - (len(rc) - 1) / 2) * 0.035
                t.cyl(V(-0.24, dy * 0.5, 0.58), V(-0.46, dy, 0.6), 0.04 * S, 0.035 * S, cc, seg=6, smooth=True)
                t.cyl(V(-0.46, dy, 0.6), V(-0.62, dy * 1.4, 0.44 - i * 0.015), 0.035 * S, 0.012 * S, cc, seg=6, smooth=True)
                t.sphere(V(-0.46, dy, 0.6), 0.04 * S, cc, seg=(7, 5))
        elif tk == 'shark':     # morski pas: polumjesec repne peraje
            t.cyl(V(-0.22, 0, 0.52), V(-0.44, 0, 0.5), 0.1 * S, 0.06 * S, fur, seg=10, smooth=True)
            t.cyl(V(-0.44, 0, 0.5), V(-0.58, 0, 0.5), 0.06 * S, 0.035 * S, fur, seg=10, smooth=True)
            t.poly([V(-0.56, 0, 0.5), V(-0.72, 0, 0.82), V(-0.64, 0, 0.52), V(-0.7, 0, 0.3)], fur, thick=0.03)
    # leđna peraja (morski pas)
    if opts.get('dorsalFin'):
        fc = opts['dorsalFin']
        b.poly([V(-0.02, 0, 0.98), V(-0.24, 0, 1.3), V(-0.22, 0, 1.0), V(-0.18, 0, 0.86)], fc, thick=0.04)
        for side in (1, -1):   # bočne peraje
            b.poly([V(0.02, side * 0.27, 0.66), V(-0.12, side * 0.44, 0.52), V(-0.1, side * 0.3, 0.6)], fc, thick=0.025)
    # krila na leđima
    if opts.get('wings'):
        wc = opts['wings']
        ws = opts.get('wingScale', 1.0)
        for side, nm in ((1, 'wingL'), (-1, 'wingR')):
            P = lambda x, y, z: V(-0.2 + (x + 0.2) * ws, side * (0.12 + (y - 0.12) * ws), 0.92 + (z - 0.92) * ws)
            w = m.part(nm, V(-0.2, side * 0.12, 0.92), 'body')
            if opts.get('wingStyle') == 'bee':
                # v0.53 pčela: dva zaobljena prozirno-plava krilca sa žilicama (prije šišmišja krila)
                root = Vector(P(-0.22, 0.1, 0.96))
                for dv, ln, wd in (((-0.3, 0.72, 0.62), 0.46, 0.25), ((-0.42, 0.9, -0.08), 0.32, 0.17)):
                    d = Vector((dv[0], side * dv[1], dv[2])).normalized()
                    nr = Vector((1, 0, 0.25))
                    feather(w, root, d, ln * ws * S, wd * ws * S, wc, nr, thick=0.06)
                    fl = (nr - d * nr.dot(d)).normalized()
                    sd_ = d.cross(fl)
                    for k_ in (-1, 0, 1):   # žilice
                        e = root + (d * 0.8 + sd_ * 0.22 * k_).normalized() * ln * ws * S * (0.82 - 0.12 * abs(k_))
                        w.cyl(tuple(root + fl * 0.006), tuple(e + fl * 0.006), 0.006 * S, 0.003 * S, mix(wc, '#1e3a5f', 0.35), seg=4)
                        w.cyl(tuple(root - fl * 0.006), tuple(e - fl * 0.006), 0.006 * S, 0.003 * S, mix(wc, '#1e3a5f', 0.35), seg=4)
                w.sphere(tuple(root), 0.04 * S, dark, seg=(8, 6))
                continue
            wrist, root = P(-0.36, 0.5, 1.22), P(-0.2, 0.12, 0.92)
            tips = [P(-0.42, 0.78, 1.0), P(-0.36, 0.62, 0.86), P(-0.3, 0.42, 0.76)]
            w.cyl(root, wrist, 0.03 * S, 0.02 * S, dark, seg=6)
            w.cyl(wrist, tips[0], 0.02 * S, 0.012 * S, dark, seg=6)
            w.cyl(wrist, tips[1], 0.014 * S, 0.008 * S, dark, seg=4)
            w.cyl(wrist, tips[2], 0.012 * S, 0.006 * S, dark, seg=4)   # v0.29: još jedna kost krila
            w.sphere(wrist, 0.026 * S, dark, seg=(8, 6))
            w.cyl(wrist, Vector(wrist) + Vector((0.01, side * 0.02, 0.07 * S)), 0.018 * S, 0.0, '#fff1c9', seg=6)   # v0.53: kandžica
            # v0.53: opna između prstiju s lukovima na rubu (prije jedan ravni mnogokut)
            wv = Vector(wrist)
            ring = tips + [root]
            for i in range(len(ring) - 1):
                a_, b_ = Vector(ring[i]), Vector(ring[i + 1])
                sag = a_.lerp(b_, 0.5).lerp(wv, 0.24 if i < len(ring) - 2 else 0.12)
                cc = wc if i % 2 == 0 else mix(wc, '#ffffff', 0.14)
                w.poly([wrist, tuple(a_), tuple(sag)], cc, thick=0.012)
                w.poly([wrist, tuple(sag), tuple(b_)], cc, thick=0.012)
    # glava
    h = m.part('head', V(0, 0, 0.98), 'body')
    hr = opts.get('headR', (0.40, 0.42, 0.37))
    hz = 1.30
    h.sphere(V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), fur, seg=(26, 18))
    snout = opts.get('snout', 'muzzle')
    mz = c.get('muzzle', belly)
    if snout == 'muzzle':
        h.sphere(V(0.32, 0, 1.19), (0.14 * S, 0.19 * S, 0.12 * S), mz, seg=(14, 10))
        h.sphere(V(0.45, 0, 1.24), (0.05 * S, 0.065 * S, 0.045 * S), c.get('nose', '#2b1d1a'))
        h.arc(V(0.445, 0, 1.175), 0.06 * S, 205, 335, 6, 0.011 * S, '#5a2a2a', plane='yz', seg=5)   # smiješak
    elif snout == 'long':
        h.sphere(V(0.36, 0, 1.18), (0.22 * S, 0.14 * S, 0.11 * S), mz, seg=(14, 10))
        h.sphere(V(0.57, 0, 1.21), (0.05 * S, 0.06 * S, 0.045 * S), c.get('nose', '#1f1a1a'))
        h.arc(V(0.53, 0, 1.15), 0.05 * S, 205, 335, 6, 0.01 * S, '#5a2a2a', plane='yz', seg=5)
    elif snout == 'beak':
        h.cyl(V(0.30, 0, 1.24), V(0.62, 0, 1.18), 0.11 * S, 0.0, c.get('beak', '#f5b324'), seg=8)
        h.sphere(V(0.58, 0, 1.15), (0.06 * S, 0.04 * S, 0.05 * S), c.get('beak', '#f5b324'))
    elif snout == 'flatbeak':
        h.sphere(V(0.36, 0, 1.2), (0.17 * S, 0.12 * S, 0.06 * S), c.get('beak', '#f59e0b'))
    elif snout == 'dragon':
        h.sphere(V(0.36, 0, 1.18), (0.24 * S, 0.19 * S, 0.14 * S), fur, seg=(14, 10))
        h.sphere(V(0.4, 0, 1.12), (0.19 * S, 0.17 * S, 0.08 * S), belly)
        for s in (1, -1):
            h.sphere(V(0.58, s * 0.06, 1.24), 0.025 * S, dark)
            h.cyl(V(0.54, s * 0.09, 1.1), V(0.55, s * 0.095, 1.04), 0.018 * S, 0.0, '#ffffff', seg=4)   # očnjaci
        h.arc(V(0.56, 0, 1.1), 0.09 * S, 210, 330, 6, 0.011 * S, '#7a1f1f', plane='yz', seg=5)
    elif snout == 'shark':
        h.sphere(V(0.27, 0, 1.17), (0.21 * S, 0.27 * S, 0.12 * S), fur, seg=(16, 10))          # šiljata gubica
        h.sphere(V(0.27, 0, 1.06), (0.2 * S, 0.25 * S, 0.07 * S), mz, seg=(14, 8))             # svijetla donja čeljust
        h.arc(V(0.27, 0, 1.1), 0.235 * S, -75, 75, 12, 0.018 * S, '#7a1f2b', plane='xy', seg=5)  # usta (veliki osmijeh)
        for k in range(9):   # zubići
            a = RAD(-64 + k * 16)
            tx, ty = 0.27 + math.cos(a) * 0.23, math.sin(a) * 0.23
            h.cyl(V(tx, ty, 1.12), V(tx + 0.005, ty, 1.075), 0.022 * S, 0.0, '#ffffff', seg=4)
        for sd in (1, -1):   # škrge
            for k in range(3):
                h.box(V(-0.06 - k * 0.06, sd * 0.37, 1.22), (0.012 * S, 0.02 * S, 0.1 * S), mix(fur, '#000000', 0.35), rot=(sd * 12, 0, 0))
        h.sphere(V(0.47, 0, 1.23), (0.03 * S, 0.06 * S, 0.02 * S), mix(fur, '#000000', 0.3))     # nosnice
    elif snout == 'horse':   # jednorog: duga konjska njuška
        h.sphere(V(0.36, 0, 1.2), (0.24 * S, 0.2 * S, 0.15 * S), mz, seg=(16, 10))
        for sd in (1, -1):
            h.sphere(V(0.57, sd * 0.07, 1.23), (0.025 * S, 0.03 * S, 0.02 * S), mix(mz, '#000000', 0.45), seg=(8, 5))
        h.arc(V(0.53, 0, 1.12), 0.06 * S, 205, 335, 6, 0.011 * S, '#9d174d', plane='yz', seg=5)
    elif snout == 'bull':   # v0.38 bik: široka njuška, velike nosnice i zlatna alka
        h.sphere(V(0.33, 0, 1.16), (0.17 * S, 0.26 * S, 0.15 * S), mz, seg=(18, 12))
        for sd in (1, -1):
            h.sphere(V(0.47, sd * 0.09, 1.19), (0.03 * S, 0.045 * S, 0.035 * S), mix(mz, '#000000', 0.55), seg=(10, 7))
        h.arc(V(0.5, 0, 1.105), 0.05 * S, 0, 360, 12, 0.014 * S, '#f6c945', plane='yz', seg=6)   # alka u nosu
        h.arc(V(0.465, 0, 1.08), 0.08 * S, 215, 325, 6, 0.012 * S, '#5a2a2a', plane='yz', seg=5)
    elif snout == 'hippo':   # v0.55 nilski konj: golema široka njuška, nosnice na vrhu, dva zubića i veliki osmijeh
        h.sphere(V(0.3, 0, 1.15), (0.2 * S, 0.33 * S, 0.19 * S), mz, seg=(20, 14))
        h.sphere(V(0.36, 0, 1.06), (0.15 * S, 0.27 * S, 0.08 * S), mix(mz, '#000000', 0.06), seg=(16, 8))   # donja usna
        for sd in (1, -1):
            h.sphere(V(0.43, sd * 0.11, 1.29), (0.04 * S, 0.05 * S, 0.035 * S), mix(mz, '#ffffff', 0.12), seg=(10, 7))   # kvrga nosnice
            h.sphere(V(0.455, sd * 0.11, 1.305), (0.022 * S, 0.03 * S, 0.016 * S), mix(mz, '#000000', 0.6), seg=(8, 5))
            h.cyl(V(0.47, sd * 0.13, 1.07), V(0.48, sd * 0.135, 1.13), 0.022 * S, 0.012 * S, '#fffbeb', seg=6)   # zubić
            h.sphere(V(0.27, sd * 0.3, 1.15), (0.02 * S, 0.02 * S, 0.02 * S), mix(mz, '#000000', 0.3), seg=(6, 4))   # brčići
        h.arc(V(0.44, 0, 1.13), 0.2 * S, -62, 62, 10, 0.012 * S, '#7a2f3a', plane='xy', seg=5)   # široki osmijeh
    elif snout == 'frog':
        h.box(V(0.3, 0, 1.14), (0.06 * S, 0.5 * S, 0.02 * S), '#c2185b', bevel=0.008)
        h.sphere(V(0.33, 0, 1.11), (0.08 * S, 0.12 * S, 0.03 * S), '#f48fb1')
    # oči
    ey = opts.get('eyes', {})
    if snout == 'frog':
        for s in (1, -1):
            h.sphere(V(0.12, s * 0.2, 1.6), 0.15 * S, fur)
            h.sphere(V(0.22, s * 0.21, 1.63), (0.08 * S, 0.1 * S, 0.11 * S), '#ffffff')
            h.sphere(V(0.28, s * 0.22, 1.64), (0.04 * S, 0.06 * S, 0.07 * S), '#14141f')
            h.sphere(V(0.31, s * 0.21, 1.67), 0.018 * S, '#ffffff', seg=(6, 4))
    else:
        # v0.53: oko uvijek malo viri iz glave (kod velikih okruglih glava, npr. hobotnice, prije je bilo utonulo),
        # a bjeloočnica je odmah iza šarenice (kod sove je prije bila zakopana u glavi)
        esz = ey.get('size', 1)
        xs = hr[0] * math.sqrt(max(0.05, 1 - (0.15 / hr[1]) ** 2 - (0.06 / (hr[2] * 1.0)) ** 2))
        ex = max(0.335, xs - 0.0624 * esz + 0.035)
        if ey.get('white'):
            for s in (1, -1):
                h.sphere(V(ex + 0.053 * esz - 0.06, s * 0.15, 1.36), (0.06 * S, 0.095 * S * esz, 0.11 * S * esz), '#ffffff', seg=(12, 8))
        eyes(h, ex * S, 0, 1.36 * S, r=0.078 * S * esz, color=ey.get('color', '#1b1b2a'), spread=0.15 * S)
        bc = opts.get('brows', dark)
        if bc:
            brows(h, 0.355 * S, 0, 1.475 * S, bc, angle=opts.get('browAngle', 12), spread=0.15 * S,
                  head=(V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S)), width=0.065 * S)
        if opts.get('blush', True):
            for s in (1, -1):
                h.sphere(V(0.3, s * 0.27, 1.22), (0.03 * S, 0.06 * S, 0.035 * S), '#f49ab0', seg=(8, 5))
    # uši
    ears = opts.get('ears')
    inner = c.get('inner', '#f6a5b8')
    es = opts.get('earScale', 1.0)
    if ears == 'round':
        for s in (1, -1):
            h.sphere(V(-0.03, s * (0.27 + 0.05 * (es - 1)), 1.62), (0.06 * S * es, 0.12 * S * es, 0.12 * S * es), fur)
            h.sphere(V(0.0, s * (0.27 + 0.05 * (es - 1)), 1.62), (0.035 * S * es, 0.08 * S * es, 0.08 * S * es), inner)
    elif ears == 'big':   # slon
        for s in (1, -1):
            h.sphere(V(-0.08, s * 0.44, 1.38), (0.07 * S, 0.2 * S, 0.27 * S), fur, rot=(s * 10, 0, 0))
            h.sphere(V(-0.04, s * 0.45, 1.38), (0.04 * S, 0.14 * S, 0.2 * S), inner, rot=(s * 10, 0, 0))
    elif ears in ('pointy', 'bigpointy'):
        big = 1.35 if ears == 'bigpointy' else 1.0
        for s in (1, -1):
            h.cyl(V(-0.02, s * 0.22, 1.55), V(-0.05, s * (0.28 + 0.05 * big), 1.55 + 0.3 * big), 0.12 * S * big, 0.0, fur, seg=4)
            h.cyl(V(0.02, s * 0.22, 1.57), V(-0.01, s * (0.27 + 0.05 * big), 1.53 + 0.24 * big), 0.07 * S * big, 0.0, inner, seg=4)
            if c.get('eartip'):
                h.cyl(V(-0.04, s * (0.265 + 0.05 * big), 1.55 + 0.21 * big), V(-0.05, s * (0.28 + 0.05 * big), 1.55 + 0.3 * big),
                      0.045 * S * big, 0.0, c['eartip'], seg=4)
    # v0.29: čuperci krzna/perja na tjemenu
    if opts.get('tufts'):
        tcol = opts['tufts'] if isinstance(opts['tufts'], str) else fur
        hcen, rad = V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S)
        for k, (th, ph, ln, rr, bend) in enumerate(((10, 84, 0.21, 0.08, (0.35, 0.0, -0.12)),
                                                     (75, 70, 0.14, 0.064, (0.0, 0.32, -0.06)),
                                                     (-75, 70, 0.14, 0.064, (0.0, -0.32, -0.06)))):
            base = on_sphere(hcen, rad, th, ph, -0.04 * S)
            nrm = Vector(on_sphere((0, 0, 0), (1, 1, 1), th, ph))
            tuft(h, base, nrm + Vector((0, 0, 0.9)), ln * S, rr * S, tcol if k == 0 else mix(tcol, '#ffffff', 0.12), bend=bend)

    # posebni dodaci glave
    if opts.get('mane'):
        mc = opts['mane']
        h.sphere(V(-0.2, 0, 1.3), (0.2 * S, 0.42 * S, 0.44 * S), mc)
        # v0.29: griva od šiljatih pramenova u dva prstena oko cijelog lica (prije mjehurići samo na jednoj strani)
        for ring, (n_, rad_, x0, outx, ln, rr) in enumerate(((18, 0.4, -0.06, -0.3, 0.2, 0.085), (12, 0.33, -0.24, -0.85, 0.18, 0.08))):
            for i in range(n_):
                a = math.tau * (i + 0.5 * ring) / n_
                base = V(x0, math.cos(a) * rad_, 1.3 + math.sin(a) * rad_ * 1.05)
                d = Vector((outx, math.cos(a), math.sin(a)))
                cc = mc if (i + ring) % 2 else mix(mc, '#000000', 0.16)
                tuft(h, base, d, ln * S, rr * S, cc, bend=(-0.15, 0.0, -0.12 if math.sin(a) > -0.3 else 0.1))

    if opts.get('unicornHorn'):   # spiralni zlatni rog sa svjetlucavim vrhom
        b0, tip = Vector(V(0.24, 0, 1.6)), Vector(V(0.42, 0, 2.02))
        h.cyl(tuple(b0), tuple(tip), 0.075 * S, 0.0, opts['unicornHorn'], seg=10, smooth=True)
        for k in range(5):
            t0 = 0.1 + k * 0.17
            c0 = b0.lerp(tip, t0)
            h.cyl(tuple(c0 + Vector((0, -0.05 * (1 - t0), -0.02))), tuple(c0 + Vector((0.02, 0.05 * (1 - t0), 0.04))),
                  0.016 * S * (1 - t0) + 0.006, 0.016 * S * (1 - t0) + 0.006, '#fff3b0', seg=5)
        h.ico(tuple(tip), 0.04 * S, '#fffbeb', mat='glow', sub=1)
        h.sphere(tuple(b0), (0.08 * S, 0.1 * S, 0.04 * S), '#fde68a', seg=(10, 6))
    if opts.get('rainbowMane'):   # griva u bojama duge, od čela niz potiljak
        rc = opts['rainbowMane']
        for i in range(11):
            a = RAD(70 + i * 15)
            r_ = 0.43
            x, z = math.cos(a) * r_ - 0.02, 1.3 + math.sin(a) * r_
            cc = rc[i % len(rc)]
            h.sphere(V(x, 0, z), (0.09 * S, 0.1 * S, 0.12 * S), cc, rot=(0, -i * 12, 0), seg=(10, 7))
            for sd in (1, -1):
                h.sphere(V(x - 0.04, sd * 0.09, z - 0.05), (0.07 * S, 0.07 * S, 0.1 * S), rc[(i + 2) % len(rc)], seg=(8, 6))
        h.sphere(V(0.3, 0.05, 1.62), (0.08 * S, 0.06 * S, 0.1 * S), rc[0], rot=(30, 20, 0), seg=(8, 6))   # šiška
    if opts.get('horns'):
        hc = opts['horns']
        for s in (1, -1):
            h.cyl(V(-0.05, s * 0.18, 1.58), V(-0.25, s * 0.26, 1.86), 0.065 * S, 0.0, hc, seg=8)
    if opts.get('bullHorns'):   # v0.38 bik: golemi rogovi — van, pa gore i naprijed, tamni vrhovi, zlatni obruč
        hc = opts['bullHorns']
        for s_ in (1, -1):
            pts = [V(-0.02, s_ * 0.3, 1.5), V(0.0, s_ * 0.5, 1.55), V(0.05, s_ * 0.66, 1.68), V(0.12, s_ * 0.7, 1.86), V(0.2, s_ * 0.66, 1.98)]
            rr = [0.085, 0.07, 0.052, 0.034, 0.0]
            for i in range(len(pts) - 1):
                h.cyl(pts[i], pts[i + 1], rr[i] * S, rr[i + 1] * S, hc if i < 3 else '#3b2a1a', seg=12, smooth=True)
                if i < 3:
                    h.sphere(pts[i + 1], rr[i + 1] * S, hc if i < 2 else mix(hc, '#3b2a1a', 0.5), seg=(10, 7))
            h.cyl(V(-0.01, s_ * 0.37, 1.515), V(-0.005, s_ * 0.41, 1.525), 0.088 * S, 0.085 * S, '#f6c945', seg=12, caps=False)
    if opts.get('crest'):
        for i, zz in enumerate((1.68, 1.62, 1.52)):
            h.cyl(V(-0.1 - 0.12 * i, 0, zz - 0.04), V(-0.18 - 0.14 * i, 0, zz + 0.12), 0.05 * S, 0.0, opts['crest'], seg=4)
    if opts.get('mask'):
        h.sphere(V(0.22, 0, 1.36), (0.2 * S, 0.37 * S, 0.1 * S), opts['mask'], rot=(0, 10, 0))
    if opts.get('stripesHead'):
        for s in (1, -1):
            for zz, yy in ((1.5, 0.32), (1.38, 0.38)):
                h.box(V(0.05, s * yy, zz), (0.15 * S, 0.03 * S, 0.035 * S), dark, rot=(s * 30, 0, 0))
        h.box(V(0.25, 0, 1.62), (0.12 * S, 0.035 * S, 0.03 * S), dark, rot=(0, -40, 0))
    if opts.get('crescent'):   # v0.30: polumjesec prati zaobljeno čelo (prije je stršao u zraku i vidio se odostraga)
        cpts = []
        for i in range(9):
            a = RAD(40 + 280 * i / 8)
            yy, zz = math.cos(a) * 0.08, 1.56 + math.sin(a) * 0.08
            xx = hr[0] * math.sqrt(max(0.0, 1 - (yy / hr[1]) ** 2 - ((zz - hz) / hr[2]) ** 2)) + 0.012
            cpts.append(V(xx, yy, zz))
        for i in range(8):
            h.cyl(cpts[i], cpts[i + 1], 0.016 * S, 0.016 * S, '#fff3b0', mat='glow', seg=6)
    if opts.get('hat') == 'wizard':   # v0.52 Ledena: plavi čarobnjački šešir sa svinutim vrhom i krznenim obodom (kao na portretu)
        hc, hb = opts.get('hatColor', '#2563eb'), opts.get('hatBand')
        h.cyl(V(-0.03, 0, 1.545), V(-0.03, 0, 1.58), 0.5 * S, 0.47 * S, hc, seg=28)                      # obod
        for i in range(16):   # krzneni rub oboda
            a = math.tau * i / 16
            h.sphere(V(-0.03 + math.cos(a) * 0.5, math.sin(a) * 0.5, 1.56), (0.055 * S, 0.055 * S, 0.042 * S),
                     '#ffffff' if i % 2 else '#e0f2fe', seg=(8, 6))
        h.cyl(V(-0.03, 0, 1.575), V(-0.08, 0, 1.92), 0.31 * S, 0.17 * S, hc, seg=22, smooth=True)           # stožac
        h.sphere(V(-0.08, 0, 1.92), 0.17 * S, hc, seg=(16, 10))
        h.cyl(V(-0.08, 0, 1.92), V(-0.3, 0, 2.14), 0.17 * S, 0.035 * S, hc, seg=16, smooth=True)             # svinuti vrh
        h.cyl(V(-0.033, 0, 1.6), V(-0.04, 0, 1.68), 0.302 * S, 0.29 * S, hb or '#ffffff', mat='vc' if hb else 'team', seg=22, caps=False)   # vrpca
        h.ico(V(-0.32, 0, 2.16), 0.06 * S, '#e0f2fe', mat='glow', sub=1)                                   # svjetleća kićanka
    if opts.get('hat') == 'beanie':
        h.sphere(V(-0.02, 0, 1.5), (0.37 * S, 0.39 * S, 0.24 * S), '#ffffff', mat='team', seg=(16, 8))
        h.cyl(V(-0.0, 0, 1.47), V(0, 0, 1.53), 0.4 * S, 0.4 * S, '#e8e8e8', seg=16, smooth=True)
        h.sphere(V(-0.06, 0, 1.78), 0.09 * S, '#ffffff')
    if opts.get('headband'):   # v0.52: bandColor = traka u boji junaka (npr. zlatni obruč) umjesto boje tima
        bnc = opts.get('bandColor')
        h.cyl(V(0, 0, 1.36), V(0, 0, 1.46), 0.415 * S, 0.395 * S, bnc or '#ffffff', mat='vc' if bnc else 'team', seg=18, caps=False)
        if not opts.get('bandNoTails'):
            h.box(V(-0.42, 0.06, 1.36), (0.04 * S, 0.06 * S, 0.2 * S), mix(bnc, '#000000', 0.1) if bnc else '#dcdcdc', mat='vc' if bnc else 'team', rot=(20, 0, 0))
            h.box(V(-0.42, -0.06, 1.36), (0.04 * S, 0.06 * S, 0.2 * S), mix(bnc, '#000000', 0.1) if bnc else '#dcdcdc', mat='vc' if bnc else 'team', rot=(-20, 0, 0))
    if opts.get('bandana'):
        h.cyl(V(0.0, 0, 1.18), V(0, 0, 1.28), 0.37 * S, 0.395 * S, '#ffffff', mat='team', seg=18, caps=False)
    if opts.get('crown'):
        h.cyl(V(0.02, 0, 1.64), V(0.02, 0, 1.74), 0.15 * S, 0.17 * S, '#f6c945', seg=10, caps=False)
        for i in range(5):
            a = RAD(i * 72)
            h.cyl(V(0.02 + math.cos(a) * 0.16, math.sin(a) * 0.16, 1.73), V(0.02 + math.cos(a) * 0.17, math.sin(a) * 0.17, 1.82),
                  0.03 * S, 0.0, '#f6c945', seg=4)
        h.sphere(V(0.18, 0, 1.69), 0.03 * S, '#e11d48')
    if opts.get('hood'):
        # kapuljača: kalota preko tjemena i zatiljka, lice ostaje slobodno; v0.52: hoodColor = boja junaka
        hdc = opts.get('hoodColor')
        h.sphere(V(-0.13, 0, 1.39), (0.4 * S, 0.45 * S, 0.38 * S), hdc or '#ffffff', mat='vc' if hdc else 'team', seg=(20, 12))
        h.cyl(V(-0.32, 0, 1.12), V(-0.46, 0, 0.92), 0.1 * S, 0.0, mix(hdc, '#000000', 0.15) if hdc else '#d0d0d0', mat='vc' if hdc else 'team', seg=8)

    # potpisni detalji junaka
    if opts.get('shoulders'):
        for s in (1, -1):
            shc = opts['shoulders']
            b.sphere(V(0.0, s * 0.3, 0.93), (0.11 * S, 0.12 * S, 0.085 * S), shc, seg=(14, 9))
            # v0.29: slojeviti naramenjak — dvije donje ploče, zlatni rub i zakovice
            b.sphere(V(-0.005, s * 0.345, 0.875), (0.095 * S, 0.1 * S, 0.06 * S), mix(shc, '#000000', 0.1), seg=(12, 8))
            b.sphere(V(-0.01, s * 0.375, 0.83), (0.08 * S, 0.085 * S, 0.05 * S), mix(shc, '#000000', 0.18), seg=(12, 8))
            b.sphere(V(0.0, s * 0.3, 0.975), 0.03 * S, '#f6c945', seg=(8, 6))
            for k in ((-1, 0, 1) if opts.get('ornate', True) else ()):
                b.sphere(V(0.09 * math.cos(RAD(k * 40)), s * (0.3 + 0.09 * abs(math.sin(RAD(k * 40))) + 0.04), 0.9 + 0.02 * (k == 0)), 0.014 * S, '#f6c945', seg=(6, 4))
    if opts.get('bellyPlates'):
        for i in range(4):
            b.box(V(0.215 - i * 0.012, 0, 0.5 + i * 0.1), (0.05 * S, (0.24 - i * 0.03) * S, 0.045 * S), mix(belly, '#000000', 0.12), bevel=0.01)
    if opts.get('headFeather'):
        fc = opts['headFeather']
        h.cyl(V(-0.02, 0.3, 1.52), V(-0.3, 0.36, 1.9), 0.012 * S, 0.008 * S, '#fff7ed', seg=4)
        h.poly([V(-0.06, 0.31, 1.58), V(-0.2, 0.38, 1.86), V(-0.36, 0.34, 1.92), V(-0.3, 0.3, 1.72)], fc, thick=0.012)
        h.poly([V(-0.06, 0.29, 1.58), V(-0.14, 0.3, 1.8), V(-0.3, 0.33, 1.9), V(-0.26, 0.37, 1.7)], mix(fc, '#000000', 0.2), thick=0.012)
    if opts.get('flowerHat'):
        h.cyl(V(0.0, 0.1, 1.64), V(0.02, 0.12, 1.8), 0.012 * S, 0.01 * S, '#4caf50', seg=4)
        for k in range(5):
            a = RAD(k * 72)
            h.sphere(V(0.02 + math.cos(a) * 0.05, 0.12 + math.sin(a) * 0.05, 1.81), (0.035 * S, 0.035 * S, 0.02 * S), '#f9a8d4', seg=(7, 5))
        h.sphere(V(0.02, 0.12, 1.82), 0.025 * S, '#fde047', seg=(7, 5))
    if opts.get('boltMark'):   # v0.30: veća munja-cik-cak na čelu, prati zaobljenu glavu (vidi se i odozgo)
        bpts = []
        for (yy, zz) in ((0.05, 1.57), (-0.03, 1.49), (0.035, 1.47), (-0.03, 1.39)):
            xx = hr[0] * math.sqrt(max(0.0, 1 - (yy / hr[1]) ** 2 - ((zz - hz) / hr[2]) ** 2)) + 0.008
            bpts.append(V(xx, yy, zz))
        for i in range(3):
            h.cyl(bpts[i], bpts[i + 1], 0.022 * S, 0.022 * S, '#fde047', mat='glow', seg=6)
            h.sphere(bpts[i + 1], 0.022 * S, '#fde047', mat='glow', seg=(6, 4))
        h.cyl(bpts[3], (bpts[3][0] + 0.02 * S, bpts[3][1] - 0.01 * S, bpts[3][2] - 0.05 * S), 0.022 * S, 0.0, '#fde047', mat='glow', seg=6)
    if opts.get('fangs'):
        for s in (1, -1):
            h.cyl(V(0.44, s * 0.06, 1.14), V(0.45, s * 0.065, 1.08), 0.016 * S, 0.0, '#ffffff', seg=4)
    if opts.get('spots'):
        for (th, ph) in ((150, 35), (-140, 45), (180, 10), (120, 60)):
            h.sphere(on_sphere(V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), th, ph), 0.05 * S, dark, seg=(7, 5))
        for (th, ph) in ((160, 20), (-150, 0), (175, -30)):
            b.sphere(on_sphere(V(0, 0, 0.70), (0.27 * S, 0.29 * S, 0.33 * S), th, ph), 0.045 * S, dark, seg=(7, 5))
    if opts.get('goggles'):
        for s in (1, -1):
            h.arc(V(0.26, s * 0.12, 1.55), 0.075 * S, 0, 360, 10, 0.018 * S, '#5b3a1e', plane='yz', seg=5)
            h.cyl(V(0.245, s * 0.12, 1.55), V(0.275, s * 0.12, 1.55), 0.065 * S, 0.065 * S, '#9ae6ff', mat='glow', seg=10)
        h.arc(V(0, 0, 1.55), 0.3 * S, 50, 310, 12, 0.02 * S, '#5b3a1e', plane='xy', seg=5)
    if opts.get('tailFeathers'):
        for k, s in enumerate((-1, 0, 1)):
            b.poly([V(-0.26, s * 0.05, 0.6), V(-0.52, s * 0.16, 0.5), V(-0.62, s * 0.08, 0.44), V(-0.5, -s * 0.02, 0.5)],
                   '#6b3f22' if k % 2 == 0 else '#f3efe4', thick=0.02)
    if opts.get('capeStars'):
        for (x, y, z) in ((-0.3, 0.12, 0.7), (-0.33, -0.16, 0.55), (-0.28, -0.04, 0.86), (-0.35, 0.22, 0.48)):
            b.sphere(V(x, y, z), 0.025 * S, '#fff3b0', mat='glow', seg=(6, 4))
    if opts.get('beltStar'):
        sc0 = V(0.3, 0.12, 0.62)
        for k in range(4):
            a = RAD(k * 90 + 45)
            b.cyl(sc0, (sc0[0], sc0[1] + math.cos(a) * 0.07 * S, sc0[2] + math.sin(a) * 0.07 * S), 0.02 * S, 0.0, '#d6dde6', seg=4)
    if opts.get('scarfStripes'):
        for zz in (0.95, 0.99):
            b.cyl(V(0, 0, zz), V(0, 0, zz + 0.015), 0.245 * S, 0.24 * S, '#ffffff', seg=14, caps=False)
    if opts.get('quills'):   # jež: bodlje po glavi i leđima
        qc, qt = opts['quills']
        for th in range(110, 251, 20):
            for ph in (10, 35, 60):
                base = on_sphere(V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), th, ph, -0.03)
                tip = on_sphere(V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), th, ph, 0.2)
                h.cyl(base, tip, 0.035 * S, 0.0, qc, seg=4)
                h.cyl(on_sphere(V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), th, ph, 0.12), tip, 0.018 * S, 0.0, qt, seg=4)
        for th in range(130, 231, 25):
            for ph in (-10, 20, 50):
                base = on_sphere(V(0, 0, 0.70), (0.27 * S, 0.29 * S, 0.33 * S), th, ph, -0.03)
                tip = on_sphere(V(0, 0, 0.70), (0.27 * S, 0.29 * S, 0.33 * S), th, ph, 0.17)
                b.cyl(base, tip, 0.03 * S, 0.0, qc, seg=4)
    if opts.get('trunk'):   # slon: surla
        pts = [V(0.42, 0, 1.2), V(0.56, 0, 1.08), V(0.63, 0, 0.92), V(0.6, 0, 0.76), V(0.5, 0, 0.66), V(0.42, 0, 0.64)]
        rr = [0.1, 0.085, 0.075, 0.065, 0.06, 0.06]
        for i in range(len(pts) - 1):
            h.cyl(pts[i], pts[i + 1], rr[i] * S, rr[i + 1] * S, fur, seg=10, smooth=True)
            h.sphere(pts[i + 1], rr[i + 1] * S, fur, seg=(8, 6))
        h.sphere(pts[-1], 0.055 * S, mix(fur, '#000000', 0.3), seg=(8, 6))
    if opts.get('tusks'):
        for s_ in (1, -1):
            h.cyl(V(0.36, s_ * 0.15, 1.1), V(0.62, s_ * 0.19, 1.0), 0.04 * S, 0.0, '#fff7e6', seg=6)
    if opts.get('antennae'):
        for s_ in (1, -1):
            h.cyl(V(0.08, s_ * 0.12, 1.64), V(0.26, s_ * 0.22, 1.96), 0.012 * S, 0.01 * S, dark, seg=4)
            h.sphere(V(0.27, s_ * 0.23, 1.98), 0.035 * S, dark, seg=(7, 5))
    if opts.get('stinger'):
        b.cyl(V(-0.26, 0, 0.56), V(-0.48, 0, 0.46), 0.05 * S, 0.0, dark, seg=6)
    if opts.get('bands'):   # pčela: tamne pruge oko trbuha
        for zz in (0.6, 0.76):
            b.cyl(V(0, 0, zz), V(0, 0, zz + 0.06), 0.28 * S, 0.28 * S, opts['bands'], seg=16, caps=False)
    if opts.get('earTufts'):   # sova: čuperci-"uši"
        for s_ in (1, -1):
            h.cyl(V(-0.05, s_ * 0.22, 1.56), V(-0.1, s_ * 0.36, 1.88), 0.09 * S, 0.0, fur, seg=5)
            h.cyl(V(-0.05, s_ * 0.22, 1.58), V(-0.09, s_ * 0.33, 1.84), 0.05 * S, 0.0, dark, seg=5)
    if opts.get('faceDisc'):   # sova: srcoliki svijetli disk lica s tamnijim rubom (v0.53: prianja uz glavu, prije zakopan)
        hcen, rad, fd = V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), opts['faceDisc']
        for s_ in (1, -1):
            face_cap(h, hcen, rad, s_ * 22, 6, (0.185 * S, 0.2 * S), mix(fd, '#5a3a1a', 0.45), out=0.008 * S, tilt=s_ * 8)
            face_cap(h, hcen, rad, s_ * 22, 6, (0.16 * S, 0.175 * S), fd, out=0.016 * S, tilt=s_ * 8)
        face_cap(h, hcen, rad, 0, -10, (0.08 * S, 0.12 * S), fd, out=0.014 * S)   # spoj ispod kljuna
    if opts.get('faceMask'):   # v0.53 majmun: svijetla srcolika maska lica oko očiju (prije je izgledao kao medo)
        hcen, rad, fm = V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), opts['faceMask']
        for s_ in (1, -1):
            face_cap(h, hcen, rad, s_ * 20, 9, (0.15 * S, 0.165 * S), fm, out=0.012 * S, tilt=-s_ * 10)
        face_cap(h, hcen, rad, 0, -6, (0.17 * S, 0.14 * S), fm, out=0.01 * S)
    if opts.get('beanieStar'):
        for k in range(3):
            a = RAD(k * 60)
            h.cyl(V(0.3, 0.14 + math.cos(a) * 0.05, 1.62 + math.sin(a) * 0.05),
                  V(0.3, 0.14 - math.cos(a) * 0.05, 1.62 - math.sin(a) * 0.05), 0.008 * S, 0.008 * S, '#ffffff', seg=4)
    # --- v0.10 dodaci ---
    if opts.get('neckFur'):   # vuk: krzneni ovratnik
        for i in range(10):
            a = RAD(i * 36)
            b.sphere(V(math.cos(a) * 0.26 - 0.02, math.sin(a) * 0.3, 0.98), (0.1 * S, 0.1 * S, 0.08 * S), opts['neckFur'] if i % 2 else mix(opts['neckFur'], '#000000', 0.12), seg=(8, 6))
    if opts.get('hat') == 'ranger':   # v0.38 Nišan: lovački šešir sa širokim obodom, vrpcom u boji tima i perom; uši strše kroz rupe
        hc = opts.get('hatColor', '#7a5230')
        h.cyl(V(-0.03, 0, 1.53), V(-0.03, 0, 1.565), 0.58 * S, 0.56 * S, hc, seg=28)                                   # obod
        h.cyl(V(-0.03, 0, 1.528), V(-0.03, 0, 1.54), 0.585 * S, 0.585 * S, mix(hc, '#000000', 0.3), seg=28, caps=False)  # tamni rub oboda
        h.cyl(V(-0.03, 0, 1.55), V(-0.05, 0, 1.78), 0.25 * S, 0.21 * S, mix(hc, '#ffffff', 0.06), seg=22, smooth=True)   # krošnja
        h.sphere(V(-0.05, 0, 1.78), (0.21 * S, 0.21 * S, 0.05 * S), mix(hc, '#ffffff', 0.06), seg=(16, 6))
        h.cyl(V(-0.035, 0, 1.565), V(-0.04, 0, 1.62), 0.255 * S, 0.248 * S, '#ffffff', mat='team', seg=22, caps=False)  # vrpca u boji tima
        h.sphere(V(0.2, -0.08, 1.6), 0.03 * S, '#f6c945', seg=(8, 6))
        h.poly([V(-0.04, -0.22, 1.6), V(-0.2, -0.3, 1.86), V(-0.34, -0.26, 1.98), V(-0.26, -0.22, 1.78)], '#fb923c', thick=0.014)   # pero
        h.poly([V(-0.05, -0.2, 1.6), V(-0.14, -0.23, 1.8), V(-0.28, -0.24, 1.92), V(-0.22, -0.2, 1.72)], '#fde68a', thick=0.014)
    if opts.get('hat') == 'cone':   # gavran: čarobnjački šešir
        hc = opts.get('hatColor', '#312e81')
        h.cyl(V(-0.02, 0, 1.56), V(-0.02, 0, 1.6), 0.46 * S, 0.44 * S, hc, seg=18)
        h.cyl(V(-0.02, 0, 1.58), V(-0.14, 0, 2.2), 0.3 * S, 0.0, hc, seg=14, smooth=True)
        h.cyl(V(-0.02, 0, 1.62), V(-0.02, 0, 1.7), 0.31 * S, 0.3 * S, '#ffffff', mat='team', seg=14, caps=False)
        h.sphere(V(0.24, 0, 1.66), 0.04 * S, '#fde047', mat='glow', seg=(6, 4))
    if opts.get('tailFeatherColors'):
        fc = opts['tailFeatherColors']
        for k, s in enumerate((-1, 0, 1)):
            b.poly([V(-0.26, s * 0.05, 0.6), V(-0.52, s * 0.16, 0.5), V(-0.62, s * 0.08, 0.44), V(-0.5, -s * 0.02, 0.5)],
                   fc[k % len(fc)], thick=0.02)
    if opts.get('tentacles'):   # hobotnica: pipci vise ispod tijela
        tc = opts['tentacles']
        for i in range(8):
            a = RAD(i * 45 + 22)
            ca, sa = math.cos(a), math.sin(a)
            p0 = V(ca * 0.2, sa * 0.22, 0.42)
            p1 = V(ca * 0.34, sa * 0.36, 0.22)
            p2 = V(ca * 0.44, sa * 0.46, 0.06)
            p3 = V(ca * 0.56, sa * 0.58, 0.04)
            b.cyl(p0, p1, 0.07 * S, 0.055 * S, tc, seg=8, smooth=True)
            b.sphere(p1, 0.055 * S, tc, seg=(8, 6))
            b.cyl(p1, p2, 0.055 * S, 0.04 * S, tc, seg=8, smooth=True)
            b.sphere(p2, 0.04 * S, tc, seg=(8, 6))
            b.cyl(p2, p3, 0.04 * S, 0.02 * S, tc, seg=6, smooth=True)
            for q, pp in ((0.5, p1), (0.5, p2)):
                b.sphere((pp[0] * 1.02, pp[1] * 1.02, pp[2] + 0.03 * S), 0.022 * S, mix(tc, '#ffffff', 0.5), seg=(6, 4))
    if opts.get('noseHorn'):   # nosorog: rog na njušci
        hc = opts['noseHorn']
        h.cyl(V(0.5, 0, 1.24), V(0.66, 0, 1.56), 0.07 * S, 0.0, hc, seg=8)
        h.cyl(V(0.36, 0, 1.3), V(0.42, 0, 1.46), 0.045 * S, 0.0, hc, seg=8)
    if opts.get('eyePatches'):   # panda: tamne mrlje oko očiju
        for s in (1, -1):
            h.sphere(V(0.3, s * 0.16, 1.37), (0.06 * S, 0.13 * S, 0.15 * S), opts['eyePatches'], seg=(10, 7), rot=(s * 20, 0, 0))
    if opts.get('earColor'):   # obojene okrugle uši (panda)
        for s in (1, -1):
            h.sphere(V(-0.03, s * 0.3, 1.64), (0.07 * S, 0.13 * S, 0.13 * S), opts['earColor'])

    # --- v0.13 detalji: krzno na obrazima, čuperak na prsima, tunika s rubom, naborima, torbicom i ovratnikom ---
    if snout in ('muzzle', 'long') and opts.get('cheekFluff', True) and not opts.get('trunk'):
        for s_ in (1, -1):
            for k in range(3):
                pt = on_sphere(V(0, 0, hz), (hr[0] * S, hr[1] * S, hr[2] * S), s_ * (68 + k * 11), -22 + k * 9, -0.015 * S)
                h.sphere(pt, (0.05 * S, 0.06 * S, 0.055 * S), fur if k != 1 else mix(fur, '#ffffff', 0.12), seg=(8, 6))
    if belly != fur and not opts.get('chest') and not opts.get('armWings'):
        for k in (-1, 0, 1):
            b.sphere(V(0.2, k * 0.065, 0.9 - abs(k) * 0.02), (0.05 * S, 0.055 * S, 0.06 * S), belly, seg=(8, 6))
    if tun:
        b.cyl(V(0, 0, 0.43), V(0, 0, 0.447), 0.338 * S, 0.336 * S, '#f6c945', seg=18, caps=False)   # zlatni rub
        for k in range(12):   # v0.29: zlatne zakovice uz rub tunike
            deg = RAD(k * 30 + 15)
            b.sphere(V(math.cos(deg) * 0.343, math.sin(deg) * 0.343, 0.439), 0.014 * S, '#f6c945', seg=(6, 4))
        # v0.29: pregača (tabard) sprijeda i straga — tamnija boja tima, zlatni rub i znak
        back = not opts.get('cape') and not (ofit and ofit.get('style') in ('coat', 'robe'))
        for sx in ((1, -1) if back else (1,)):   # ispod plašta, kaputa i halje nema stražnje pregače (probijala bi ih)
            xt, xb, zt, zb, wt, wb = 0.312 * sx, 0.348 * sx, 0.6, 0.35, 0.085, 0.1
            b.poly([V(xt, -wt * sx, zt), V(xt, wt * sx, zt), V(xb, wb * sx, zb), V(xb, -wb * sx, zb)], '#9a9a9a', mat='team', thick=0.014)
            for yy in (-1, 1):
                b.cyl(V(xt + 0.008 * sx, yy * wt, zt), V(xb + 0.008 * sx, yy * wb, zb), 0.008 * S, 0.008 * S, '#f6c945', seg=5)
            b.cyl(V(xb + 0.008 * sx, -wb, zb), V(xb + 0.008 * sx, wb, zb), 0.008 * S, 0.008 * S, '#f6c945', seg=5)
            if sx < 0 or opts.get('tabardEmblem', True):   # v0.30: Zubo sprijeda nosi sidro umjesto romba
                b.box(V((xt + xb) / 2 + 0.012 * sx, 0, 0.47), (0.012 * S, 0.055 * S, 0.055 * S), '#f6c945', rot=(45, 0, 0), bevel=0.004)
        for k in range(10):   # nabori tunike
            deg = k * 36 + 18
            ca, sa = math.cos(RAD(deg)), math.sin(RAD(deg))
            b.box(V(ca * 0.318, sa * 0.318, 0.52), (0.02 * S, 0.03 * S, 0.15 * S), '#c8c8c8', mat='team', rot=(0, -6, deg))
        # torbica na pojasu
        b.box(V(-0.08, 0.27, 0.6), (0.1 * S, 0.06 * S, 0.1 * S), '#7a4b25', bevel=0.01, rot=(0, 0, 20))
        b.box(V(-0.07, 0.29, 0.635), (0.1 * S, 0.04 * S, 0.04 * S), '#5b3a1e', bevel=0.006, rot=(0, 0, 20))
        b.sphere(V(-0.05, 0.31, 0.62), 0.012 * S, '#f6c945', seg=(5, 4))
        if not (opts.get('scarf') or opts.get('cape') or opts.get('chest') or opts.get('neckFur') or opts.get('armWings') or ofit):
            b.cyl(V(0, 0, 0.9), V(0, 0, 0.955), 0.22 * S, 0.2 * S, '#ffffff', mat='team', seg=16, smooth=True)
            b.cyl(V(0, 0, 0.95), V(0, 0, 0.962), 0.2 * S, 0.198 * S, '#f6c945', seg=16, caps=False)

    # v0.29: čarobnjaci nose zlatnu ogrlicu s draguljem u boji tima
    if opts.get('atk') == 'mage' and not any(opts.get(k) for k in ('scarf', 'chest', 'cape', 'armWings', 'outfit')):
        b.arc(V(0.02, 0, 0.955), 0.205 * S, -75, 75, 10, 0.009 * S, '#f6c945', plane='xy', seg=5)
        b.sphere(V(0.245, 0, 0.885), (0.022 * S, 0.036 * S, 0.046 * S), '#f6c945', seg=(10, 8))
        b.sphere(V(0.262, 0, 0.885), (0.012 * S, 0.022 * S, 0.03 * S), '#ffffff', mat='teamglow', seg=(8, 6))
        b.cyl(V(0.22, 0, 0.935), V(0.24, 0, 0.91), 0.006 * S, 0.006 * S, '#f6c945', seg=4)
    # v0.29: kožni remen preko prsa s okruglom zlatnom kopčom (pustolovna oprema kao kod LoL junaka)
    strap_def = opts.get('atk', 'melee') in ('melee', 'bow', 'claws') and \
        not any(opts.get(k) for k in ('chest', 'shell', 'armWings', 'neckFur', 'cape'))
    if opts.get('strap', strap_def):
        fr = strap(b, V(0, 0, 0.70), (0.30 * S, 0.30 * S, 0.345 * S), 42, '#5b3a1e', r=0.02 * S, out=0.022 * S if ofit else 0.0)
        b.sphere(tuple(fr + Vector((0.012 * S, 0, 0))), (0.022 * S, 0.042 * S, 0.042 * S), '#f6c945', seg=(10, 8))
        b.sphere(tuple(fr + Vector((0.03 * S, 0, 0))), (0.01 * S, 0.018 * S, 0.018 * S), '#ffffff', mat='teamglow', seg=(8, 6))

    # ruke
    arm_wings = opts.get('armWings')
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        a = m.part(nm, V(0, side * 0.3, 0.86), 'body')
        if arm_wings:
            # v0.53: krilo od preklopljenih pera — duga letna pera i preko njih kraća, svjetlija pokrovna
            # (prije ravna ploha s prugama, izgledala je kao karton)
            wc = arm_wings
            a.sphere(V(-0.02, side * 0.34, 0.78), (0.1 * S, 0.08 * S, 0.14 * S), fur)
            s0, w0 = Vector(V(-0.02, side * 0.35, 0.83)), Vector(V(-0.08, side * 0.6, 0.72))
            a.cyl(tuple(s0), tuple(w0), 0.075 * S, 0.05 * S, wc, seg=10, smooth=True)     # prednji rub krila
            a.sphere(tuple(w0), 0.05 * S, wc, seg=(10, 8))
            arm = w0 - s0
            n_ = 7
            out_ = Vector((0, side, 0))

            def wnorm(d):   # ploha pera napola prema naprijed, napola u stranu: puno krilo i na portretu i odozgo u igri
                nr = arm.cross(d)
                return ((nr if nr.x > 0 else -nr).normalized() + out_).normalized()
            for i in range(n_):
                t = i / (n_ - 1)
                d = Vector((-0.25 - 0.1 * t, side * (0.1 + 0.75 * t), -1.0 + 0.45 * t))
                nr = wnorm(d)
                base = s0.lerp(w0, t) + nr * 0.005 * S * i
                cc = mix(wc, '#000000', 0.22) if i % 2 else wc
                feather(a, base, d, (0.26 + 0.17 * t) * S, 0.13 * S, cc, nr)
                feather(a, base + d.normalized() * 0.2 * S, d, (0.06 + 0.17 * t) * S, 0.08 * S, mix(wc, '#000000', 0.38), nr)  # tamniji vrh
            for i in range(5):
                t = i / 4
                d = Vector((-0.2 - 0.1 * t, side * (0.15 + 0.6 * t), -1.0 + 0.4 * t))
                nr = wnorm(d)
                cc = mix(wc, '#ffffff', 0.2 if i % 2 else 0.1)
                feather(a, s0.lerp(w0, t) + nr * 0.045 * S + Vector((0, 0, 0.02 * S)), d, (0.15 + 0.05 * t) * S, 0.11 * S, cc, nr)
            continue
        a.cyl(V(0, side * 0.31, 0.88), V(0.02, side * 0.36, 0.62), 0.072 * S, 0.066 * S, limb, seg=10, smooth=True)
        hc = c.get('hand', limb)
        a.sphere(V(0.04, side * 0.37, 0.57), 0.08 * S, hc)
        if not opts.get('flippers'):   # prsti i palac
            for k in (-1, 0, 1):
                a.sphere(V(0.1, side * 0.37 + k * 0.032, 0.53), (0.03 * S, 0.026 * S, 0.034 * S), hc, seg=(7, 5))
            a.sphere(V(0.07, side * 0.32, 0.6), (0.026 * S, 0.026 * S, 0.03 * S), hc, seg=(7, 5))
            a.sphere(V(0.0, side * 0.375, 0.6), (0.05 * S, 0.06 * S, 0.035 * S), mix(hc, '#ffffff', 0.18), seg=(7, 5))   # jastučić
        if opts.get('bracers'):
            a.cyl(V(0.01, side * 0.335, 0.73), V(0.02, side * 0.35, 0.63), 0.08 * S, 0.076 * S, opts['bracers'], seg=10)
        if opts.get('sleeve'):
            a.cyl(V(0, side * 0.31, 0.9), V(0.01, side * 0.335, 0.76), 0.085 * S, 0.08 * S, '#ffffff', mat='team', seg=10)
        if ofit and ofit.get('sleeves') and not opts.get('flippers'):   # v0.52: rukavi kostima
            outfit_sleeve(a, V, S, side, ofit)
        if opts.get('weapon') == 'claws':   # v0.29: čelična narukvica sa zlatnim rubom (kandže)
            a.cyl(V(0.0154, side * 0.3485, 0.68), V(0.02, side * 0.36, 0.62), 0.08 * S, 0.082 * S, '#9aa7b5', seg=12)
            a.cyl(V(0.0154, side * 0.3485, 0.68), V(0.015, side * 0.3475, 0.692), 0.084 * S, 0.084 * S, '#f6c945', seg=12, caps=False)
        if opts.get('flippers'):
            a.sphere(V(0.0, side * 0.36, 0.66), (0.08 * S, 0.05 * S, 0.22 * S), fur, rot=(side * 14, 0, 0))

    # oružje
    wpn = opts.get('weapon')
    R, L = m['armR'], m['armL']
    hR = Vector(V(0.04, -0.37, 0.57))
    hL = Vector(V(0.04, 0.37, 0.57))
    if wpn == 'sword':
        d = Vector((0.94, 0, 0.34))
        R.cyl(hR - d * 0.1 * S, hR + d * 0.08 * S, 0.03 * S, 0.03 * S, '#6b3e1f', seg=6)
        R.box(hR + d * 0.1 * S, (0.07 * S, 0.3 * S, 0.05 * S), '#f6c945', rot=(0, -20, 0), bevel=0.012)
        bl = hR + d * 0.48 * S
        R.box(bl, (0.7 * S, 0.095 * S, 0.024 * S), '#dfe6ee', rot=(90, -20, 0), bevel=0.008)
        R.box(bl + d * 0.02, (0.6 * S, 0.02 * S, 0.026 * S), '#9fb0c0', rot=(90, -20, 0))
        R.box(bl + d * 0.04 * S, (0.4 * S, 0.008 * S, 0.03 * S), '#7dd3fc', mat='glow', rot=(90, -20, 0))   # v0.29: svjetleća runa
        R.sphere(hR - d * 0.13 * S, 0.035 * S, '#f6c945')
        # v0.13: dragulj u križnici, krajevi križnice, omotač drške, vrh oštrice
        R.sphere(hR + d * 0.1 * S + Vector((0.02 * S, 0, 0)), 0.026 * S, '#ef4444', mat='glow', seg=(8, 6))
        for s_ in (1, -1):
            R.sphere(hR + d * 0.1 * S + Vector((0, s_ * 0.16 * S, 0)), 0.032 * S, '#f6c945', seg=(8, 6))
        for k in range(3):
            R.cyl(hR - d * (0.07 - k * 0.05) * S, hR - d * (0.05 - k * 0.05) * S, 0.034 * S, 0.034 * S, '#3b2414', seg=6, caps=False)
        R.cyl(bl + d * 0.34 * S, bl + d * 0.45 * S, 0.046 * S, 0.0, '#dfe6ee', seg=4)
    if opts.get('shield'):
        n = Vector((0.55, 0.83, 0)).normalized()
        cc = hL + Vector((0.06, 0.06, 0.04))
        L.cyl(cc - n * 0.03 * S, cc + n * 0.03 * S, 0.24 * S, 0.24 * S, '#f6c945', seg=16)
        L.cyl(cc + n * 0.025 * S, cc + n * 0.05 * S, 0.21 * S, 0.21 * S, '#ffffff', mat='team', seg=16)
        L.sphere(cc + n * 0.06 * S, 0.06 * S, '#f6c945')
        pts, u_, w_ = rim_points(cc + n * 0.05 * S, n, 0.225 * S, 8, phase=RAD(22.5))   # v0.29: zakovice i zlatna zvijezda
        for pt in pts:
            L.sphere(tuple(pt), 0.016 * S, '#dfe6ee', seg=(6, 4))
        for dv in (u_, -u_, w_, -w_):
            L.cyl(tuple(cc + n * 0.056 * S + dv * 0.05 * S), tuple(cc + n * 0.053 * S + dv * 0.17 * S), 0.022 * S, 0.004, '#f6c945', seg=4)
    if wpn == 'staff':
        top = hR + Vector((0, 0, 0.62 * S))
        R.cyl(hR + Vector((0, 0, -0.32 * S)), top, 0.028 * S, 0.032 * S, opts.get('staffWood', '#8b5a2b'), seg=7)
        orb = opts.get('orb', '#7dd3fc')
        if opts.get('orbShape') == 'none':   # zlatni štap (Skakač)
            for pt in (top, hR + Vector((0, 0, -0.32 * S))):
                R.cyl(pt - Vector((0, 0, 0.04 * S)), pt + Vector((0, 0, 0.04 * S)), 0.045 * S, 0.045 * S, '#f6c945', seg=8)
        elif opts.get('orbShape') == 'crystal':
            R.ico(top + Vector((0, 0, 0.12 * S)), (0.08 * S, 0.08 * S, 0.16 * S), orb, mat='glow', sub=0)
            for s in (1, -1):
                R.cyl(top + Vector((0, s * 0.05 * S, 0)), top + Vector((0, s * 0.08 * S, 0.12 * S)), 0.015 * S, 0.0, '#b9e6ff', seg=4)
        elif opts.get('orbShape') == 'leaf':
            R.sphere(top + Vector((0.02, 0, 0.1 * S)), (0.05 * S, 0.12 * S, 0.14 * S), orb, mat='glow', rot=(20, 0, 0))
            R.sphere(top + Vector((-0.02, 0.06, 0.06 * S)), (0.04 * S, 0.1 * S, 0.1 * S), mix(orb, '#000000', 0.2), rot=(-40, 0, 0))
        else:
            R.sphere(top + Vector((0, 0, 0.1 * S)), 0.1 * S, orb, mat='glow')
            R.cyl(top - Vector((0, 0, 0.02 * S)), top + Vector((0, 0, 0.04 * S)), 0.06 * S, 0.07 * S, '#f6c945', seg=8)
        if opts.get('orbShape') != 'none':   # v0.13: zlatni prstenovi duž štapa i omotač drške
            for zz in (0.42, 0.18, -0.2):
                R.cyl(hR + Vector((0, 0, zz * S)), hR + Vector((0, 0, (zz + 0.035) * S)), 0.04 * S, 0.04 * S, '#f6c945', seg=8)
            for k in range(3):
                R.cyl(hR + Vector((0, 0, (-0.08 + k * 0.05) * S)), hR + Vector((0, 0, (-0.06 + k * 0.05) * S)), 0.038 * S, 0.038 * S, '#5b3a1e', seg=6, caps=False)
    if wpn == 'hammer':
        d = Vector((0.9, 0, 0.42)).normalized()
        R.cyl(hR - d * 0.12 * S, hR + d * 0.5 * S, 0.035 * S, 0.035 * S, '#7a4b25', seg=7)
        R.box(hR + d * 0.55 * S, (0.16 * S, 0.3 * S, 0.16 * S), '#9aa3ad', rot=(0, -25, 0), bevel=0.02)
        R.box(hR + d * 0.55 * S, (0.12 * S, 0.34 * S, 0.12 * S), '#d6dde6', rot=(0, -25, 0), bevel=0.01)
        for s_ in (1, -1):   # v0.13: svjetleće rune na glavi čekića
            R.box(hR + d * 0.55 * S + Vector((0, s_ * 0.172 * S, 0)), (0.07 * S, 0.006, 0.07 * S), '#7dd3fc', mat='glow', rot=(0, -25, 45))
        R.cyl(hR + d * 0.47 * S, hR + d * 0.49 * S, 0.045 * S, 0.045 * S, '#f6c945', seg=8)
    if wpn == 'orb':
        oc = hR + Vector((0.1 * S, 0, 0.1 * S))
        R.sphere(oc, 0.11 * S, opts.get('orb', '#fb923c'), mat='glow')
        R.sphere(oc + Vector((0.03 * S, 0, 0.03 * S)), 0.06 * S, mix(opts.get('orb', '#fb923c'), '#ffffff', 0.6), mat='glow', seg=(8, 6))
        R.cyl(hR + Vector((0.1 * S, 0, -0.01 * S)), hR + Vector((0.1 * S, 0, 0.03 * S)), 0.07 * S, 0.09 * S, '#f6c945', seg=8)
        R.arc(tuple(oc), 0.16 * S, 0, 330, 12, 0.01 * S, mix(opts.get('orb', '#fb923c'), '#ffffff', 0.4), plane='xz', mat='glow', seg=4)   # v0.13: čarobni prsten
    if wpn == 'bow':
        bc = opts.get('bowColor', '#8b5a2b')
        ctr = hL + Vector((0.02, 0.02, 0))
        pts = L.arc(ctr + Vector((-0.28 * S, 0, 0)), 0.42 * S, -62, 62, 8, 0.028 * S, bc, plane='xz')
        L.cyl(pts[0], pts[-1], 0.006 * S, 0.006 * S, '#f5f5f5', seg=4)
        L.cyl(ctr + Vector((0.12 * S, 0, -0.06 * S)), ctr + Vector((0.12 * S, 0, 0.06 * S)), 0.035 * S, 0.035 * S, '#f6c945', seg=6)
        L.sphere(ctr + Vector((0.155 * S, 0, 0)), 0.022 * S, '#ffffff', mat='teamglow', seg=(8, 6))   # v0.29: dragulj na dršci
        for k in range(4):   # v0.13: kožni omotač i vrhovi luka
            zz = -0.045 + k * 0.03
            L.cyl(ctr + Vector((0.12 * S, 0, zz * S)), ctr + Vector((0.12 * S, 0, (zz + 0.015) * S)), 0.038 * S, 0.038 * S, '#5b3a1e', seg=6, caps=False)
        for pt in (pts[0], pts[-1]):
            L.sphere(pt, 0.03 * S, '#f6c945', seg=(6, 4))
        # tobolac sa strijelama
        qc = opts.get('quiverColor')   # v0.52: kožni tobolac u boji junaka (inače u boji tima)
        b.cyl(V(-0.26, 0.1, 0.62), V(-0.36, -0.06, 1.08), 0.07 * S, 0.08 * S, qc or '#ffffff', mat='vc' if qc else 'team', seg=10)
        if qc:   # zlatni obruči na tobolcu
            q0, q1 = Vector(V(-0.26, 0.1, 0.62)), Vector(V(-0.36, -0.06, 1.08))
            qa = (q1 - q0).normalized()
            for f_ in (0.12, 0.88):
                c0 = q0.lerp(q1, f_)
                rq = (0.07 + 0.01 * f_ + 0.006) * S
                b.cyl(tuple(c0 - qa * 0.012 * S), tuple(c0 + qa * 0.012 * S), rq, rq, '#f6c945', seg=10, caps=False)
        for i in range(3):
            b.cyl(V(-0.33 + i * 0.02, -0.02 + i * 0.03, 1.02), V(-0.4 + i * 0.02, -0.1 + i * 0.03, 1.24), 0.012 * S, 0.012 * S, '#e9e3d0', seg=4)
            b.cyl(V(-0.4 + i * 0.02, -0.1 + i * 0.03, 1.22), V(-0.41 + i * 0.02, -0.11 + i * 0.03, 1.29), 0.03 * S, 0.0, '#ef4444', seg=3)
    if wpn == 'claws':
        for arm, hh in ((R, hR), (L, hL)):
            for k in (-1, 0, 1):
                arm.cyl(hh + Vector((0.05 * S, k * 0.03 * S, 0)), hh + Vector((0.26 * S, k * 0.05 * S, 0.06 * S)),
                        0.02 * S, 0.0, opts.get('clawColor', '#fde047'), mat='glow', seg=4)
    if wpn == 'shuriken':
        sc = hR + Vector((0.12 * S, 0, 0.06 * S))
        for k in range(4):
            a = RAD(k * 90 + 45)
            R.cyl(sc, sc + Vector((math.cos(a) * 0.15 * S, 0, math.sin(a) * 0.15 * S)), 0.04 * S, 0.0, '#d6dde6', seg=4)
        R.cyl(sc - Vector((0, 0.015, 0)), sc + Vector((0, 0.015, 0)), 0.045 * S, 0.045 * S, '#f6c945', seg=8)
        # bodež u lijevoj
        L.cyl(hL, hL + Vector((0.3 * S, 0, 0.1 * S)), 0.03 * S, 0.0, '#e2e8f0', seg=4)
        L.box(hL + Vector((0.02, 0, 0.0)), (0.03 * S, 0.12 * S, 0.03 * S), '#f6c945')
    if wpn == 'club':
        R.cyl(hR - Vector((0, 0, 0.08 * S)), hR + Vector((0.32 * S, 0, 0.2 * S)), 0.03 * S, 0.075 * S, '#7a4b25', seg=8, smooth=True)
        R.sphere(hR + Vector((0.34 * S, 0, 0.21 * S)), 0.08 * S, '#8b5a2b')
        R.cyl(hR + Vector((0.2304 * S, 0, 0.1216 * S)), hR + Vector((0.2496 * S, 0, 0.1384 * S)), 0.07 * S, 0.071 * S, '#9aa7b5', seg=10)   # v0.29: željezni obruč
        for k in range(5):   # v0.13: čavli na batini
            a = RAD(k * 72)
            base_ = hR + Vector((0.3 * S, math.cos(a) * 0.06 * S, 0.19 * S + math.sin(a) * 0.06 * S))
            R.cyl(base_, base_ + Vector((0.02 * S, math.cos(a) * 0.05 * S, math.sin(a) * 0.05 * S)), 0.015 * S, 0.0, '#9aa3ad', seg=4)
    if wpn == 'rifle':   # v0.38 Nišan: duga puška s mjedenim durbinom (miruje 30° prema tlu, pri nišanjenju je vodoravna)
        d = Vector((0.866, 0, -0.5)); u = Vector((0.5, 0, 0.866))
        g = hR + Vector((0.02 * S, 0, 0))
        R.box(tuple(g - d * 0.2 * S - u * 0.03 * S), (0.36 * S, 0.075 * S, 0.13 * S), '#a0643a', rot=(0, 30, 0), bevel=0.025)   # kundak
        R.box(tuple(g - d * 0.39 * S - u * 0.035 * S), (0.04 * S, 0.08 * S, 0.15 * S), '#4a2a14', rot=(0, 30, 0), bevel=0.012)
        R.box(tuple(g - d * 0.2 * S - u * 0.03 * S + Vector((0, 0.04 * S, 0))), (0.12 * S, 0.01 * S, 0.06 * S), '#f6c945', rot=(0, 30, 0), bevel=0.004)   # zlatna pločica
        R.box(tuple(g + d * 0.07 * S), (0.24 * S, 0.085 * S, 0.1 * S), '#6b7280', rot=(0, 30, 0), bevel=0.018)            # zatvarač
        R.cyl(tuple(g + d * 0.16 * S), tuple(g + d * 0.55 * S), 0.05 * S, 0.044 * S, '#a0643a', seg=12)                      # drvena obloga
        R.cyl(tuple(g + d * 0.16 * S), tuple(g + d * 1.02 * S), 0.03 * S, 0.027 * S, '#9aa7b5', seg=12)                      # cijev
        R.cyl(tuple(g + d * 0.98 * S), tuple(g + d * 1.1 * S), 0.045 * S, 0.045 * S, '#4b5563', seg=12)                      # usta cijevi
        R.cyl(tuple(g + d * 1.1 * S), tuple(g + d * 1.112 * S), 0.03 * S, 0.03 * S, '#1f2937', seg=10)
        for t_ in (0.24, 0.5, 0.8):
            R.cyl(tuple(g + d * t_ * S), tuple(g + d * (t_ + 0.03) * S), (0.056 if t_ < 0.6 else 0.038) * S, (0.056 if t_ < 0.6 else 0.038) * S, '#f6c945', seg=12, caps=False)
        sc0, sc1 = g - d * 0.02 * S + u * 0.105 * S, g + d * 0.36 * S + u * 0.105 * S                                     # mjedeni durbin
        R.cyl(tuple(sc0), tuple(sc1), 0.04 * S, 0.04 * S, '#d4a24c', seg=14)
        R.cyl(tuple(sc1), tuple(sc1 + d * 0.07 * S), 0.05 * S, 0.054 * S, '#d4a24c', seg=14)
        R.cyl(tuple(sc1 + d * 0.07 * S), tuple(sc1 + d * 0.078 * S), 0.046 * S, 0.046 * S, '#7dd3fc', mat='glow', seg=14)    # leća
        R.cyl(tuple(sc0 - d * 0.06 * S), tuple(sc0), 0.048 * S, 0.042 * S, '#d4a24c', seg=14)
        for t_ in (0.05, 0.28):
            R.cyl(tuple(sc0 + d * t_ * S), tuple(sc0 + d * (t_ + 0.02) * S), 0.046 * S, 0.046 * S, '#4a2a14', seg=14, caps=False)
            R.box(tuple(g + d * (t_ + 0.02) * S + u * 0.06 * S), (0.035 * S, 0.035 * S, 0.06 * S), '#f6c945', rot=(0, 30, 0), bevel=0.006)
        R.cyl(tuple(g + d * 0.03 * S - u * 0.06 * S), tuple(g + d * 0.08 * S - u * 0.11 * S), 0.014 * S, 0.014 * S, '#1f2937', seg=5)   # okidač
        for k in range(8):   # remen puške: lagani luk ispod cijevi
            a0, a1 = k / 8, (k + 1) / 8
            p0 = g - d * (0.3 - 0.7 * a0) * S - u * (0.07 + 0.09 * math.sin(a0 * math.pi)) * S
            p1 = g - d * (0.3 - 0.7 * a1) * S - u * (0.07 + 0.09 * math.sin(a1 * math.pi)) * S
            R.cyl(tuple(p0), tuple(p1), 0.012 * S, 0.012 * S, '#5b3a1e', seg=5)
    if wpn == 'axe':   # v0.38 Bikoš: golema dvostruka bojna sjekira
        d = Vector((0.9, 0, 0.42)).normalized()
        pp = Vector((d.z, 0, -d.x))
        S0, S = S, S * 1.2   # sjekira je za petinu veća od ostalog oružja
        R.cyl(tuple(hR - d * 0.2 * S), tuple(hR + d * 0.78 * S), 0.036 * S, 0.034 * S, '#5b3a1e', seg=8)
        for k in range(4):   # kožni omotač drške
            R.cyl(tuple(hR - d * (0.1 - k * 0.05) * S), tuple(hR - d * (0.08 - k * 0.05) * S), 0.041 * S, 0.041 * S, '#2b1a10', seg=8, caps=False)
        R.sphere(tuple(hR - d * 0.22 * S), 0.045 * S, '#f6c945', seg=(8, 6))
        hc = hR + d * 0.64 * S
        R.cyl(tuple(hc - d * 0.09 * S), tuple(hc + d * 0.09 * S), 0.06 * S, 0.06 * S, '#4b5563', seg=10)
        for sd in (1, -1):   # dvije oštrice (simetrično — svejedno kamo zamahne)
            q = pp * sd
            pts = [hc + q * 0.05 * S + d * 0.05 * S, hc + q * 0.15 * S + d * 0.11 * S, hc + q * 0.26 * S + d * 0.25 * S,
                   hc + q * 0.335 * S + d * 0.14 * S, hc + q * 0.36 * S, hc + q * 0.335 * S - d * 0.14 * S,
                   hc + q * 0.26 * S - d * 0.25 * S, hc + q * 0.15 * S - d * 0.11 * S, hc + q * 0.05 * S - d * 0.05 * S]
            off = Vector((0, 0.022 * S, 0))
            R.poly([tuple(pt + off) for pt in pts], '#9aa7b5', thick=0.044 * S)
            for i in (2, 3, 4, 5):   # svijetli brušeni brid (polumjesec oštrice)
                R.cyl(tuple(pts[i] + q * 0.006 * S), tuple(pts[i + 1] + q * 0.006 * S), 0.014 * S, 0.014 * S, '#f1f5f9', seg=5)
                R.sphere(tuple(pts[i + 1] + q * 0.006 * S), 0.014 * S, '#f1f5f9', seg=(6, 4))
            R.box(tuple(hc + q * 0.2 * S), (0.05 * S, 0.05 * S, 0.05 * S), '#ef4444', mat='glow', rot=(0, -25, 45), bevel=0.005)   # crvena runa
        R.cyl(tuple(hR + d * 0.76 * S), tuple(hR + d * 0.92 * S), 0.034 * S, 0.0, '#c9d3de', seg=6)   # šiljak na vrhu
        S = S0
    if wpn == 'bamboo':   # panda: bambusov štap s listom
        R.cyl(hR + Vector((0, 0, -0.4 * S)), hR + Vector((0, 0, 0.62 * S)), 0.03 * S, 0.03 * S, '#7ec850', seg=7)
        for zz in (-0.25, 0.05, 0.35):
            R.cyl(hR + Vector((0, 0, zz * S)), hR + Vector((0, 0, (zz + 0.03) * S)), 0.036 * S, 0.036 * S, '#4f8a2f', seg=7)
        R.sphere(hR + Vector((0.02, 0, 0.66 * S)), (0.04 * S, 0.1 * S, 0.12 * S), '#86efac', rot=(20, 0, 0))
    if opts.get('lilypad'):
        cc = hL + Vector((0.06, 0.08, 0.02))
        n = Vector((0.5, 0.86, 0)).normalized()
        L.cyl(cc - n * 0.02 * S, cc + n * 0.02 * S, 0.22 * S, 0.22 * S, '#3f9b3a', seg=14)
        L.sphere(cc + n * 0.04, (0.06 * S, 0.06 * S, 0.06 * S), '#f9a8d4')
    if opts.get('shell'):
        sh = opts['shell']
        b.sphere(V(-0.13, 0, 0.74), (0.24 * S, 0.33 * S, 0.37 * S), sh[0], seg=(16, 10))
        for (zz, yy) in ((0.92, 0), (0.74, 0.17), (0.74, -0.17), (0.56, 0), (0.78, 0)):
            b.ico(V(-0.32 - (0.04 if yy == 0 and zz == 0.74 else 0), yy, zz), (0.06 * S, 0.11 * S, 0.1 * S), sh[1], sub=1)
        b.cyl(V(-0.08, 0, 0.42), V(-0.08, 0, 0.48), 0.36 * S, 0.35 * S, sh[2], seg=16)
    # v0.30: potpisni detalj junaka (SIGS, definirano ispod)
    sig = SIGS.get(name[5:]) if name.startswith('hero_') else None
    if sig:
        sig(dict(m=m, b=b, h=h, R=R, L=L, V=V, S=S, hz=hz, hr=hr, fur=fur, belly=belly, dark=dark, limb=limb,
                 hR=hR, hL=hL, t=m.parts.get('tail'), opts=opts))
    biped_anims(m, kind=opts.get('atk', 'melee'), wings=bool(opts.get('wings')), tail=bool(opts.get('tail')),
                arm_wings=bool(arm_wings))
    return m.finish()


# ------------------------------------------------------------------ v0.30 POTPISNI DETALJI JUNAKA
# Svaki junak dobiva svoj prepoznatljiv rekvizit (kao LoL junaci): poziva ih biped() na kraju, s
# dijelovima modela i mjerama tijela. Koordinate su u prostoru modela (V množi mjerilom S).
# Kamera u igri gleda odozgo (55°), pa detalji idu na glavu, ramena, leđa, oružje i tuniku uz pojas —
# ispod brade ih velika glava sakrije (tamo samo sitnice za portrete).
def _strap_pt(V, S, a_deg, out=0.0):
    """točka na remenu preko prsa (isti nagib i polumjeri kao strap() u biped())"""
    ct, st = math.cos(RAD(42)), math.sin(RAD(42))
    rad = (0.30 * S, 0.30 * S, 0.345 * S)
    d = Vector((math.cos(RAD(a_deg)), math.sin(RAD(a_deg)) * ct, math.sin(RAD(a_deg)) * st))
    kk = 1.0 / math.sqrt((d.x / rad[0]) ** 2 + (d.y / rad[1]) ** 2 + (d.z / rad[2]) ** 2)
    return Vector(V(0, 0, 0.70)) + d * (kk + out)


def _hip(V, az, z, out=0.0):
    """točka uz tuniku ispod pojasa (az: 0 = sprijeda, -90 = desni bok, +90 = lijevi) te smjer van i bočni smjer;
    sprijeda-sa-strane (az ±48) predmet ne skriva ni ruka ni pregača"""
    r = 0.335 - (z - 0.40) / 0.24 * 0.045 + 0.012 + out
    ca, sa = math.cos(RAD(az)), math.sin(RAD(az))
    return Vector(V(ca * r, sa * r, z)), Vector((ca, sa, 0.0)), Vector((-sa, ca, 0.0))


def _cape(V, y, z, out=0.0):
    """točka na stražnjoj strani plašta (y, z); out = odmak duž normale prema natrag (plašt je debeo 0.02)"""
    x = -0.17 + 0.2931 * (z - 1.0)
    return Vector(V(x - 0.9597 * out, y, z + 0.2813 * out))


def _ring(p, cc, n, radius, count, thick, color, mat='vc'):
    """prsten od tankih valjaka oko središta cc, okomit na n (užad, obruči)"""
    pts, _, _ = rim_points(cc, n, radius, count)
    for i in range(count):
        p.cyl(tuple(pts[i]), tuple(pts[(i + 1) % count]), thick, thick, color, mat=mat, seg=4)


def _rot_to(d):
    """Euler (stupnjevi) koji os z okrene u smjer d (kape gljiva, vrpce)"""
    d = Vector(d).normalized()
    return (0, 90 - math.degrees(math.asin(max(-1.0, min(1.0, d.z)))), math.degrees(math.atan2(d.y, d.x)))


def _frame(up):
    """dva okomita smjera na up (za točke po kapi gljive, latice cvijeta)"""
    up = Vector(up).normalized()
    u = up.cross(Vector((0, 0, 1)))
    u = u.normalized() if u.length > 1e-5 else Vector((1, 0, 0))
    return u, up.cross(u)


def sig_vitez(k):
    """Lavko: kraljevski plašt (opts cape) sa zlatnim rubom i velikim zlatnim lavljim suncem s rubinom na leđima"""
    b, V, S = k['b'], k['V'], k['S']
    bot = [_cape(V, -0.33, 0.42, 0.02), _cape(V, 0, 0.36, 0.02), _cape(V, 0.33, 0.42, 0.02)]
    for i in range(2):
        b.cyl(tuple(bot[i]), tuple(bot[i + 1]), 0.02 * S, 0.02 * S, '#f6c945', seg=6)
    for s in (1, -1):
        cb = _cape(V, s * 0.33, 0.42, 0.02)
        b.cyl(tuple(_cape(V, s * 0.2776, 0.8, 0.02)), tuple(cb), 0.017 * S, 0.017 * S, '#f6c945', seg=6)
        b.sphere(tuple(cb), 0.027 * S, '#f6c945', seg=(8, 6))
    up, side = Vector((0.2813, 0.0, 0.9597)), Vector((0.0, 1.0, 0.0))   # "gore" i "u stranu" po nagnutom plaštu
    b.sphere(tuple(_cape(V, 0, 0.64, 0.03)), (0.022 * S, 0.085 * S, 0.085 * S), '#f6c945', rot=(0, 16, 0), seg=(14, 8))
    b.sphere(tuple(_cape(V, 0, 0.64, 0.05)), (0.012 * S, 0.035 * S, 0.035 * S), '#e11d48', rot=(0, 16, 0), seg=(10, 8))
    c0 = _cape(V, 0, 0.64, 0.028)
    for i in range(12):
        dv = side * math.cos(math.tau * i / 12) + up * math.sin(math.tau * i / 12)
        b.cyl(tuple(c0 + dv * 0.07 * S), tuple(c0 + dv * (0.155 if i % 2 == 0 else 0.12) * S), 0.024 * S, 0.0, '#f6c945', seg=4)


def sig_zarko(k):
    """Žarko: rogovi koji gore na vrhovima, žar duž repa, zlatna narukvica s vatrenim draguljem"""
    h, V, S = k['h'], k['V'], k['S']
    for s in (1, -1):
        b0, tip = Vector(V(-0.05, s * 0.18, 1.58)), Vector(V(-0.25, s * 0.26, 1.86))
        fd = ((tip - b0).normalized() + Vector((0, 0, 1.0))).normalized()
        sd = Vector((0, s, 0))
        h.sphere(tuple(tip), 0.036 * S, '#ff7a1a', mat='glow', seg=(8, 6))
        h.cyl(tuple(tip), tuple(tip + fd * 0.13 * S), 0.033 * S, 0.0, '#ffb020', mat='glow', seg=8)
        h.cyl(tuple(tip + sd * 0.018 * S), tuple(tip + (fd * 0.8 + sd * 0.5).normalized() * 0.085 * S), 0.018 * S, 0.0,
              '#ffe26b', mat='glow', seg=6)
    t = k['t']
    if t:
        for (x, z, r) in ((-0.3, 0.617, 0.026), (-0.42, 0.583, 0.024), (-0.56, 0.582, 0.02)):
            t.sphere(V(x, 0, z), r * S, '#ff7a1a', mat='glow', seg=(8, 6))
    R = k['R']
    R.cyl(V(0.0081, -0.3302, 0.775), V(0.0042, -0.3206, 0.825), 0.078 * S, 0.076 * S, '#f6c945', seg=12, caps=False)
    R.sphere(V(0.006, -0.404, 0.8), 0.024 * S, '#ff5a1f', mat='glow', seg=(8, 6))


def sig_ledena(k):
    """Ledena: bijele pahuljice na čarobnjačkom šeširu (kao na portretu) i ledeni naramenjaci od svjetlećih kristala"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    for (z, az, rr) in ((1.74, 25, 0.06), (1.86, -40, 0.05), (1.7, -80, 0.045), (1.8, 90, 0.045)):   # pahuljice po stošcu
        t_ = (z - 1.575) / (1.92 - 1.575)
        r_ = 0.31 * (1 - t_) + 0.17 * t_ + 0.006
        cx = -0.03 - 0.05 * t_
        n = Vector((math.cos(RAD(az)), math.sin(RAD(az)), 0.25)).normalized()
        cc = Vector(V(cx + math.cos(RAD(az)) * r_, math.sin(RAD(az)) * r_, z))
        u, w = _frame(n)
        for i in range(3):   # šest krakova = tri prečke kroz središte
            a = math.pi * i / 3
            dv = u * math.cos(a) + w * math.sin(a)
            h.cyl(tuple(cc - dv * rr * S), tuple(cc + dv * rr * S), 0.009 * S, 0.009 * S, '#ffffff', mat='glow', seg=4)
        h.sphere(tuple(cc), 0.014 * S, '#ffffff', mat='glow', seg=(6, 4))
    for s in (1, -1):
        base = Vector(V(-0.01, s * 0.35, 0.9))
        for (dx, dy, dz), ln, rr, cc in (((0.0, 0.6, 0.8), 0.25, 0.048, '#7dd3fc'), ((0.36, 0.7, 0.5), 0.18, 0.036, '#38bdf8'),
                                         ((-0.38, 0.65, 0.55), 0.19, 0.038, '#a5f3fc')):
            d = Vector((dx, s * dy, dz)).normalized()
            b.cyl(tuple(base), tuple(base + d * ln * S), rr * S, 0.0, cc, mat='glow', seg=5)


def sig_strijela(k):
    """Strijela: ogrlica od očnjaka i smotana lovačka mreža na boku (njena moć)"""
    b, V, S = k['b'], k['V'], k['S']
    b.arc(V(0.02, 0, 0.955), 0.21 * S, -62, 62, 8, 0.007 * S, '#3b2414', plane='xy', seg=4)
    for y, z in ((-0.08, 0.93), (0.0, 0.92), (0.08, 0.93)):
        x = 0.02 + math.sqrt(0.21 ** 2 - y ** 2)
        b.cyl(V(x, y, z + 0.025), V(x + 0.012, y, z - 0.055), 0.019 * S, 0.0, '#fffaf0', seg=5)
    p, out, sd = _hip(V, -48, 0.5, 0.07)
    b.sphere(tuple(p), 0.068 * S, '#d9c7a1', seg=(12, 9))
    for n in ((1, 0, 0), (0, 1, 0), (0, 0, 1), (0.7, 0.7, 0.3), (0.7, -0.7, 0.3)):
        _ring(b, p, n, 0.07 * S, 10, 0.006 * S, '#6b4423')
    for dv in ((0.0, 0.0, 1.0), (0.58, 0.58, 0.58), (-0.58, 0.58, 0.58), (0.0, -1.0, 0.0)):
        b.sphere(tuple(p + Vector(dv) * 0.071 * S), 0.013 * S, '#6b4423', seg=(6, 4))
    b.cyl(tuple(p + Vector((0, 0, 0.065 * S))), tuple(Vector(V(0.2, -0.223, 0.61))), 0.008 * S, 0.008 * S, '#6b4423', seg=4)


def sig_listko(k):
    """Listko: crvene gljive s bijelim točkama, svijetlo lišće i ružičasti cvijet na oklopu; vitica s listićima oko štapa"""
    b, R, V, S = k['b'], k['R'], k['V'], k['S']
    sc, sr = V(-0.13, 0, 0.74), (0.24 * S, 0.33 * S, 0.37 * S)
    for i, (th, ph, sz) in enumerate(((186, 40, 1.0), (134, 22, 1.1), (236, 40, 0.95), (168, 2, 1.05))):
        p = on_sphere(sc, sr, th, ph, 0.01 * S)   # gornji dio oklopa skriva glava, pa sve ide niže na leđa
        b.sphere(p, (0.085 * sz * S, 0.05 * sz * S, 0.018 * S), ('#3f6212', '#15803d', '#f97316', '#4d7c0f')[i],
                 rot=(0, 90 - ph, th), seg=(10, 6))
    for (th, ph, sz) in ((156, 32, 1.0), (214, 26, 0.85)):
        n = Vector(on_sphere((0, 0, 0), (1, 1, 1), th, ph))
        p = Vector(on_sphere(sc, sr, th, ph, -0.01 * S))
        up = (n + Vector((0, 0, 0.6))).normalized()   # gljive rastu malo prema gore
        top = p + up * 0.075 * sz * S
        b.cyl(tuple(p), tuple(top), 0.024 * sz * S, 0.02 * sz * S, '#fff7e6', seg=8)
        cap = top + up * 0.012 * S
        cr = (0.068 * sz * S, 0.068 * sz * S, 0.042 * sz * S)
        b.sphere(tuple(cap), cr, '#ef4444', rot=_rot_to(up), seg=(12, 8))
        u, w = _frame(up)
        for kk in range(4):
            a = math.tau * kk / 4 + 0.4
            dd = (u * math.cos(a) + w * math.sin(a)) * math.cos(RAD(42))
            b.sphere(tuple(cap + dd * cr[0] + up * math.sin(RAD(42)) * cr[2]), 0.014 * sz * S, '#ffffff', seg=(6, 4))
        b.sphere(tuple(cap + up * cr[2]), 0.015 * sz * S, '#ffffff', seg=(6, 4))
    n = Vector(on_sphere((0, 0, 0), (1, 1, 1), 190, 8))
    fc = Vector(on_sphere(sc, sr, 190, 8, 0.012 * S))
    u, w = _frame(n)
    for kk in range(5):
        a = math.tau * kk / 5
        dd = u * math.cos(a) + w * math.sin(a)
        b.sphere(tuple(fc + dd * 0.035 * S), (0.032 * S, 0.032 * S, 0.012 * S), '#f9a8d4', rot=_rot_to(n), seg=(8, 5))
    b.sphere(tuple(fc + n * 0.008 * S), 0.022 * S, '#fde047', seg=(8, 6))
    hR = k['hR']
    prev = None
    for i in range(9):
        a = i * 1.25
        pt = hR + Vector((math.cos(a) * 0.036 * S, math.sin(a) * 0.036 * S, (-0.25 + i * 0.095) * S))
        if prev is not None:
            R.cyl(tuple(prev), tuple(pt), 0.008 * S, 0.008 * S, '#3f6212', seg=4)
        if i % 2 == 1:
            dv = Vector((math.cos(a), math.sin(a), 0.3)).normalized()
            R.sphere(tuple(pt + dv * 0.035 * S), (0.05 * S, 0.026 * S, 0.012 * S), '#65a30d', rot=(0, 20, math.degrees(a)), seg=(8, 5))
        prev = pt


def sig_munja(k):
    """Munja: svjetleći vrh repa s iskrama, munje na nadlakticama i (v0.52) velika svjetleća munja na tamnom oklopu"""
    t, V, S = k['t'], k['V'], k['S']
    b = k['b']
    pc, pr = (0.08, 0.0, 0.80), (0.22, 0.27, 0.17)   # oklop na prsima (opts chest u biped)

    def on_plate(y, z):
        q = 1 - (y / pr[1]) ** 2 - ((z - pc[2]) / pr[2]) ** 2
        return V(pc[0] + pr[0] * math.sqrt(max(0.0, q)) + 0.008, y, z)
    bolt = [on_plate(0.05, 0.92), on_plate(-0.035, 0.81), on_plate(0.03, 0.795), on_plate(-0.05, 0.68)]
    for i in range(3):
        b.cyl(bolt[i], bolt[i + 1], 0.02 * S, 0.02 * S, '#fde047', mat='glow', seg=6)
        b.sphere(bolt[i + 1], 0.02 * S, '#fde047', mat='glow', seg=(6, 4))
    b.cyl(bolt[3], (bolt[3][0] + 0.01 * S, bolt[3][1] - 0.012 * S, bolt[3][2] - 0.04 * S), 0.02 * S, 0.0, '#fde047', mat='glow', seg=6)
    b.cyl(V(0.06, 0, 0.655), V(0.06, 0, 0.672), 0.236 * S, 0.236 * S, '#facc15', mat='glow', seg=18, caps=False)   # svjetleći donji rub
    if t:
        t.sphere(V(-0.64, 0, 1.1), 0.07 * S, '#fde047', mat='glow', seg=(10, 8))
        for (dy, dz) in ((0.07, 0.04), (-0.06, 0.07), (0.03, -0.08), (-0.05, -0.04)):
            t.sphere(V(-0.65, dy, 1.09 + dz), 0.016 * S, '#fef9c3', mat='glow', seg=(6, 4))
    for side, arm in ((1, k['L']), (-1, k['R'])):
        arm.box(V(0.004, side * 0.4, 0.81), (0.032 * S, 0.014 * S, 0.1 * S), '#fde047', mat='glow', rot=(0, 25, 0))
        arm.box(V(0.014, side * 0.41, 0.73), (0.032 * S, 0.014 * S, 0.1 * S), '#fde047', mat='glow', rot=(0, -25, 0))


def sig_skokica(k):
    """Skokica: mala zlatna kruna s rubinom (žablji princ)"""
    h, V, S = k['h'], k['V'], k['S']
    x0 = -0.08
    h.cyl(V(x0, 0, 1.6), V(x0, 0, 1.67), 0.095 * S, 0.105 * S, '#f6c945', seg=14, caps=False)
    for i in range(5):
        a = math.tau * i / 5
        x, y = x0 + math.cos(a) * 0.1, math.sin(a) * 0.1
        h.cyl(V(x, y, 1.665), V(x, y, 1.75), 0.028 * S, 0.0, '#f6c945', seg=5)
        h.sphere(V(x, y, 1.755), 0.014 * S, '#f6c945', seg=(6, 4))
    h.sphere(V(x0 + 0.105, 0, 1.635), 0.02 * S, '#ef4444', mat='glow', seg=(8, 6))


def sig_orlina(k):
    """Orlina: pilotski šal u boji tima, dugi krajevi vijore se iza leđa"""
    b, V, S = k['b'], k['V'], k['S']
    sc = k['opts'].get('scarfColor')   # v0.52: crveni pilotski šal (kao na portretu); bez boje: u boji tima
    m_ = 'vc' if sc else 'team'
    b.cyl(V(0, 0, 0.85), V(0, 0, 0.94), 0.3 * S, 0.27 * S, sc or '#ffffff', mat=m_, seg=18, smooth=True)
    b.box(V(-0.32, 0.06, 0.82), (0.05 * S, 0.1 * S, 0.22 * S), mix(sc, '#000000', 0.1) if sc else '#d8d8d8', mat=m_, rot=(6, 38, -10), bevel=0.012)
    b.box(V(-0.469, 0.099, 0.683), (0.045 * S, 0.09 * S, 0.2 * S), mix(sc, '#000000', 0.18) if sc else '#c8c8c8', mat=m_, rot=(12, 60, -18), bevel=0.012)


def sig_luna(k):
    """Luna: svjetleći polumjeseci na vrhovima luka i srebrne naušnice"""
    L, h, V, S = k['L'], k['h'], k['V'], k['S']
    ctr = k['hL'] + Vector((0.02, 0.02, 0)) + Vector((-0.28 * S, 0, 0))
    for sg in (1, -1):
        dv = Vector((math.cos(RAD(62)), 0, sg * math.sin(RAD(62))))
        tip = ctr + dv * 0.42 * S
        L.arc(tuple(tip + dv * 0.05 * S), 0.06 * S, 50, 310, 9, 0.014 * S, '#fef9c3', plane='xz', mat='glow', seg=5)
    for s in (1, -1):
        for f in (0.35, 0.55):
            p = Vector(V(-0.02, s * 0.22, 1.55)).lerp(Vector(V(-0.05, s * 0.33, 1.85)), f)
            h.sphere(tuple(p + Vector((0, s * (0.12 * (1 - f) * S + 0.006), 0))), 0.018 * S, '#e2e8f0', seg=(6, 4))


def sig_tragac(k):
    """Tragač: dvije dimne bombe sa svjetlećim fitiljem na boku (njena moć) i tri bacačka noža za remenom"""
    b, V, S = k['b'], k['V'], k['S']
    up = Vector((0, 0, 1))
    for az, zz in ((44, 0.5), (60, 0.53)):
        p, out, sd = _hip(V, az, zz, 0.045)
        b.sphere(tuple(p), 0.048 * S, '#2d2f36', seg=(12, 8))
        b.cyl(tuple(p + up * 0.038 * S), tuple(p + up * 0.06 * S), 0.017 * S, 0.017 * S, '#9aa7b5', seg=8)
        tipf = p + up * 0.088 * S + out * 0.012 * S
        b.cyl(tuple(p + up * 0.06 * S), tuple(tipf), 0.005 * S, 0.004 * S, '#a16207', seg=4)
        b.sphere(tuple(tipf), 0.014 * S, '#ffb020', mat='glow', seg=(6, 4))
    so = 0.022 * S if k['opts'].get('outfit') else 0.0   # v0.52: remen ide preko kostima
    for a in (22, 38, 54):
        p = _strap_pt(V, S, a, 0.02 * S + so)
        b.cyl(tuple(p + up * 0.035 * S), tuple(p), 0.014 * S, 0.014 * S, '#3b2414', seg=6)
        b.sphere(tuple(p + up * 0.04 * S), 0.012 * S, '#f6c945', seg=(6, 4))
        b.cyl(tuple(p), tuple(p - up * 0.09 * S), 0.02 * S, 0.0, '#e2e8f0', seg=4)


def sig_jez(k):
    """Bodljo: bočica zelene ljepljive sluzi na boku i kožne narukvice s bodljama"""
    b, V, S = k['b'], k['V'], k['S']
    up = Vector((0, 0, 1))
    p, out, sd = _hip(V, -48, 0.5, 0.052)
    b.cyl(tuple(p - up * 0.045 * S), tuple(p + up * 0.04 * S), 0.05 * S, 0.046 * S, '#4ade80', mat='glow', seg=10)
    b.cyl(tuple(p - up * 0.052 * S), tuple(p - up * 0.042 * S), 0.053 * S, 0.053 * S, '#d1fae5', seg=10)
    b.cyl(tuple(p + up * 0.04 * S), tuple(p + up * 0.075 * S), 0.022 * S, 0.02 * S, '#d1fae5', seg=8)
    b.cyl(tuple(p + up * 0.07 * S), tuple(p + up * 0.1 * S), 0.025 * S, 0.022 * S, '#a16207', seg=8)
    b.cyl(tuple(p + up * 0.085 * S - out * 0.02 * S), tuple(Vector(V(0.2, -0.223, 0.61))), 0.006 * S, 0.006 * S, '#5b3a1e', seg=4)
    for side, arm in ((1, k['L']), (-1, k['R'])):
        arm.cyl(V(0.0154, side * 0.3485, 0.68), V(0.02, side * 0.36, 0.62), 0.08 * S, 0.082 * S, '#5b3a1e', seg=12)
        for kq in range(3):
            a = RAD(-40 + kq * 40)
            dv = Vector((math.sin(a) * 0.4, side * math.cos(a), 0)).normalized()
            base = Vector(V(0.018, side * 0.354, 0.65)) + dv * 0.075 * S
            arm.cyl(tuple(base), tuple(base + dv * 0.06 * S), 0.018 * S, 0.0, '#e8d5b5', seg=5)


def sig_slon(k):
    """Tutnjo: zlatni ukras na čelu s rubinom i resicama, zlatni prstenovi na kljovama, crvene rese na ušima"""
    h, V, S = k['h'], k['V'], k['S']
    hc, rad = V(0, 0, k['hz']), tuple(r * S for r in k['hr'])
    fp = Vector(on_sphere(hc, rad, 0, 45, 0.006 * S))
    h.sphere(tuple(fp), (0.022 * S, 0.11 * S, 0.075 * S), '#f6c945', rot=(0, -45, 0), seg=(12, 8))
    h.sphere(tuple(fp + Vector((0.018 * S, 0, 0.018 * S))), (0.016 * S, 0.038 * S, 0.038 * S), '#dc2626', mat='glow', rot=(0, -45, 0), seg=(10, 8))
    for kd in (-1, 0, 1):
        h.sphere(on_sphere(hc, rad, kd * 9, 31, 0.012 * S), 0.016 * S, '#f6c945', seg=(6, 4))
    for s_ in (1, -1):
        b0, tp = Vector(V(0.36, s_ * 0.15, 1.1)), Vector(V(0.62, s_ * 0.19, 1.0))
        d = tp - b0
        for f, rr in ((0.2, 0.042), (0.42, 0.031)):
            p0 = b0 + d * f
            h.cyl(tuple(p0), tuple(p0 + d.normalized() * 0.03 * S), rr * S, (rr - 0.002) * S, '#f6c945', seg=10)
        h.cyl(V(-0.06, s_ * 0.47, 1.14), V(-0.06, s_ * 0.475, 1.03), 0.012 * S, 0.012 * S, '#dc2626', seg=5)
        h.sphere(V(-0.06, s_ * 0.475, 1.02), 0.032 * S, '#f6c945', seg=(8, 6))
        h.cyl(V(-0.06, s_ * 0.475, 1.0), V(-0.06, s_ * 0.475, 0.92), 0.03 * S, 0.004 * S, '#dc2626', seg=6)


def sig_pcela(k):
    """Zuja: svjetleći vrhovi ticala i lončić meda (s kapljicom) na boku"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    for s in (1, -1):
        h.sphere(V(0.272, s * 0.232, 1.985), 0.052 * S, '#fbbf24', mat='glow', seg=(10, 8))
    up = Vector((0, 0, 1))
    p, out, sd = _hip(V, 48, 0.52, 0.065)
    b.sphere(tuple(p), (0.07 * S, 0.07 * S, 0.06 * S), '#c2410c', seg=(12, 8))
    b.cyl(tuple(p + up * 0.045 * S), tuple(p + up * 0.07 * S), 0.05 * S, 0.055 * S, '#9a3412', seg=12)
    b.cyl(tuple(p + up * 0.06 * S), tuple(p + up * 0.073 * S), 0.047 * S, 0.047 * S, '#fbbf24', mat='glow', seg=12)
    b.sphere(tuple(p + out * 0.058 * S + up * 0.042 * S), (0.016 * S, 0.016 * S, 0.03 * S), '#fbbf24', mat='glow', seg=(6, 5))
    b.box(tuple(p + out * 0.066 * S - up * 0.008 * S), (0.012 * S, 0.05 * S, 0.035 * S), '#fef3c7', rot=(0, 0, 48), bevel=0.004)


def sig_sova(k):
    """Mudra: okrugle zlatne naočale i broš s polumjesecom"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    for s in (1, -1):
        h.arc(V(0.425, s * 0.15, 1.36), 0.108 * S, 0, 360, 14, 0.009 * S, '#f6c945', plane='yz', seg=5)
        h.cyl(V(0.42, s * 0.258, 1.38), V(0.2, s * 0.36, 1.43), 0.008 * S, 0.008 * S, '#f6c945', seg=5)
    h.cyl(V(0.425, -0.045, 1.4), V(0.425, 0.045, 1.4), 0.008 * S, 0.008 * S, '#f6c945', seg=5)
    b.arc(V(0.215, 0, 0.92), 0.04 * S, 50, 310, 8, 0.01 * S, '#f6c945', plane='yz', seg=5)


def sig_majmun(k):
    """Skakač: banana za pojasom i crvene vrpce koje vijore s vrha zlatnog štapa"""
    b, R, V, S = k['b'], k['R'], k['V'], k['S']
    up = Vector((0, 0, 1))
    p, out, sd = _hip(V, -46, 0.5, 0.03)
    pa = p + up * 0.08 * S
    pb = p + out * 0.03 * S
    pc = p - up * 0.05 * S + sd * 0.06 * S + out * 0.02 * S
    b.cyl(tuple(pa), tuple(pb), 0.018 * S, 0.032 * S, '#facc15', seg=8, smooth=True)
    b.cyl(tuple(pb), tuple(pc), 0.032 * S, 0.012 * S, '#facc15', seg=8, smooth=True)
    b.sphere(tuple(pb), 0.032 * S, '#facc15', seg=(8, 6))
    b.cyl(tuple(pa), tuple(pa + up * 0.025 * S), 0.01 * S, 0.008 * S, '#78350f', seg=5)
    b.sphere(tuple(pc), 0.012 * S, '#78350f', seg=(6, 4))
    top = k['hR'] + Vector((0, 0, 0.62 * S))
    knot = top - Vector((0, 0, 0.06 * S))
    R.sphere(tuple(knot), 0.03 * S, '#dc2626', seg=(8, 6))
    for sg in (1, -1):
        d = Vector((-0.3, sg * 0.55, -0.78)).normalized()
        R.box(tuple(knot + d * 0.09 * S), (0.009 * S, 0.042 * S, 0.17 * S), '#ef4444', rot=_rot_to(d), bevel=0.003)


def sig_vuk(k):
    """Sivko: plave ratničke pruge na licu, ogrlica od zuba i srebrni pun mjesec"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    hc, rad = V(0, 0, k['hz']), tuple(r * S for r in k['hr'])
    for s in (1, -1):
        for ph in (10, 0, -10):
            h.box(on_sphere(hc, rad, s * 56, ph, 0.004 * S), (0.014 * S, 0.11 * S, 0.022 * S), '#2563eb',
                  rot=(s * 12, -ph, s * 56), bevel=0.005)
    h.box(on_sphere(hc, rad, 0, 42, 0.004 * S), (0.012 * S, 0.05 * S, 0.05 * S), '#2563eb', rot=(45, -42, 0), bevel=0.005)
    b.arc(V(0.02, 0, 0.885), 0.225 * S, -55, 55, 8, 0.006 * S, '#3b2414', plane='xy', seg=4)
    for y in (-0.1, 0.1):
        x = 0.02 + math.sqrt(0.225 ** 2 - y ** 2)
        b.cyl(V(x, y, 0.875), V(x + 0.008, y, 0.81), 0.016 * S, 0.0, '#fffaf0', seg=5)
    b.sphere(V(0.252, 0, 0.84), (0.012 * S, 0.05 * S, 0.05 * S), '#e2e8f0', seg=(12, 8))


def sig_gavran(k):
    """Mrak: zvijezde i polumjesec na šeširu, ovratnik od perja i ljubičasti broš"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']

    def cone_pt(z, ang):
        tt = (z - 1.58) / 0.62
        r = 0.3 * (1 - tt) + 0.006
        xc = -0.02 - 0.12 * tt
        return V(xc + math.cos(RAD(ang)) * r, math.sin(RAD(ang)) * r, z)
    for z, ang, rr in ((1.8, 30, 0.033), (1.95, -25, 0.029), (1.76, -62, 0.027), (2.05, 25, 0.022), (1.77, 66, 0.025)):
        h.ico(cone_pt(z, ang), rr * S, '#fde047', mat='glow', sub=0)
    h.arc(cone_pt(1.88, 0), 0.045 * S, 60, 300, 8, 0.011 * S, '#fef9c3', plane='yz', mat='glow', seg=4)
    for i in range(7):
        a = RAD(110 + i * (140 / 6))
        b.cyl(V(math.cos(a) * 0.2, math.sin(a) * 0.2, 0.93), V(math.cos(a) * 0.38, math.sin(a) * 0.38, 1.05),
              0.05 * S, 0.0, '#1f2430' if i % 2 else '#3f4452', seg=6)
    b.sphere(V(0.215, 0, 0.9), (0.012 * S, 0.034 * S, 0.034 * S), '#f6c945', seg=(8, 6))
    b.sphere(V(0.228, 0, 0.9), 0.022 * S, '#a78bfa', mat='glow', seg=(8, 6))


def sig_hobotnica(k):
    """Pipko: kruna od koralja i biserna ogrlica"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    hc, rad = V(0, 0, k['hz']), tuple(r * S for r in k['hr'])
    for i, th in enumerate((10, 82, 154, 226, 298)):
        base = Vector(on_sphere(hc, rad, th, 66, -0.02 * S))
        n = Vector(on_sphere((0, 0, 0), (1, 1, 1), th, 66))
        d = (n + Vector((0, 0, 1.2))).normalized()
        tip = base + d * 0.17 * S
        cc = ('#fb923c', '#f97316')[i % 2]
        h.cyl(tuple(base), tuple(tip), 0.03 * S, 0.012 * S, cc, seg=7, smooth=True)
        mid = base + d * 0.09 * S
        side = Vector((-math.sin(RAD(th)), math.cos(RAD(th)), 0))
        h.cyl(tuple(mid), tuple(mid + (side * 0.6 + d * 0.8).normalized() * 0.08 * S), 0.018 * S, 0.008 * S, cc, seg=6, smooth=True)
        h.sphere(tuple(tip), 0.016 * S, '#fdba74', seg=(6, 4))
    for i in range(9):
        a = RAD(-64 + i * 16)
        b.sphere(V(0.02 + math.cos(a) * 0.235, math.sin(a) * 0.235, 0.88), 0.019 * S, '#f8fafc', seg=(8, 6))


def sig_nosorog(k):
    """Rogo: čelični obruč na rogu, šiljci na naramenjacima i crvene ratničke pruge na čelu"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    b0, tp = Vector(V(0.5, 0, 1.24)), Vector(V(0.66, 0, 1.56))
    d = tp - b0
    p0 = b0 + d * 0.14
    h.cyl(tuple(p0), tuple(p0 + d.normalized() * 0.045 * S), 0.072 * S, 0.068 * S, '#cfd8e3', seg=12)
    for s in (1, -1):
        b.cyl(V(0.0, s * 0.37, 0.965), V(0.0, s * 0.5, 1.07), 0.036 * S, 0.0, '#cfd8e3', seg=6)
        b.cyl(V(-0.07, s * 0.355, 0.94), V(-0.12, s * 0.47, 1.02), 0.028 * S, 0.0, '#cfd8e3', seg=6)
        b.cyl(V(0.07, s * 0.355, 0.94), V(0.12, s * 0.465, 1.01), 0.026 * S, 0.0, '#cfd8e3', seg=6)
    hc, rad = V(0, 0, k['hz']), tuple(r * S for r in k['hr'])
    for az in (-15, 0, 15):
        h.box(on_sphere(hc, rad, az, 41, 0.004 * S), (0.012 * S, 0.026 * S, 0.12 * S), '#dc2626', rot=(0, -41, az), bevel=0.005)


def sig_panda(k):
    """Bambus: slamnati šešir na leđima i tikvica s crvenom vrpcom na boku"""
    b, V, S = k['b'], k['V'], k['S']
    hb, ha = Vector(V(-0.28, 0, 0.72)), Vector(V(-0.39, 0, 0.77))
    b.cyl(tuple(hb), tuple(ha), 0.27 * S, 0.0, '#d9b56a', seg=18)
    b.cyl(tuple(hb), tuple(hb.lerp(ha, 0.04)), 0.275 * S, 0.27 * S, '#a07a3a', seg=18, caps=False)
    for r_ in (0.18, 0.09):
        c0 = hb.lerp(ha, 1 - r_ / 0.27)
        b.cyl(tuple(c0), tuple(c0 + (ha - hb).normalized() * 0.006 * S), r_ * S + 0.004, r_ * S + 0.002, '#b8914a', seg=16, caps=False)
    up = Vector((0, 0, 1))
    p, out, sd = _hip(V, -48, 0.5, 0.055)
    b.sphere(tuple(p), (0.058 * S, 0.058 * S, 0.066 * S), '#b45309', seg=(10, 8))
    b.sphere(tuple(p + up * 0.085 * S), (0.037 * S, 0.037 * S, 0.042 * S), '#b45309', seg=(10, 8))
    b.cyl(tuple(p + up * 0.045 * S), tuple(p + up * 0.056 * S), 0.043 * S, 0.043 * S, '#dc2626', seg=10, caps=False)
    b.cyl(tuple(p + up * 0.12 * S), tuple(p + up * 0.145 * S), 0.015 * S, 0.013 * S, '#78350f', seg=6)
    b.cyl(tuple(p + up * 0.05 * S - out * 0.03 * S), tuple(Vector(V(0.2, -0.223, 0.61))), 0.006 * S, 0.006 * S, '#dc2626', seg=4)


def sig_jednorog(k):
    """Duga: narukvice u bojama duge na podlakticama i svjetlucave zvjezdice oko roga"""
    h, V, S = k['h'], k['V'], k['S']
    for side, arm in ((1, k['L']), (-1, k['R'])):
        for z0, cc in ((0.735, '#f472b6'), (0.71, '#fbbf24'), (0.685, '#60a5fa')):
            t0 = (0.88 - z0) / 0.26
            ax, ay = 0.02 * t0, side * (0.31 + 0.05 * t0)
            r0 = 0.072 - 0.006 * t0 + 0.009
            arm.cyl(V(ax, ay, z0), V(ax + 0.0015, ay + side * 0.0038, z0 - 0.02), r0 * S, r0 * S, cc, seg=12, caps=False)
    tip = Vector(V(0.42, 0, 2.02))
    for off, r in (((0.07, 0.08, -0.03), 0.03), ((-0.04, -0.09, 0.03), 0.026), ((0.03, 0.02, 0.1), 0.024), ((-0.06, 0.05, -0.08), 0.02)):
        h.ico(tuple(tip + Vector(off) * S), r * S, '#fff7ae', mat='glow', sub=0)


def sig_morskipas(k):
    """Zubo: gusarski povez preko oka, zlatni zub i veliko zlatno sidro na pregači"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    h.sphere(V(0.4, 0.15, 1.37), (0.03 * S, 0.105 * S, 0.11 * S), '#111827', seg=(12, 8))
    h.arc(V(0, 0, 1.45), 0.415 * S, 28, 300, 16, 0.012 * S, '#111827', plane='xy', seg=5)
    a = RAD(-64 + 5 * 16)
    tx, ty = 0.27 + math.cos(a) * 0.23, math.sin(a) * 0.23
    h.cyl(V(tx, ty, 1.122), V(tx + 0.005, ty, 1.07), 0.028 * S, 0.0, '#f6c945', seg=5)

    def xf(z):   # prednja ploha pregače (nagnuta) + malo ispred
        return 0.3446 + (0.47 - z) * 0.144 + 0.009
    g = '#f6c945'
    b.cyl(V(xf(0.53), 0, 0.53), V(xf(0.41), 0, 0.41), 0.009 * S, 0.009 * S, g, seg=6)
    b.arc(V(xf(0.548), 0, 0.548), 0.016 * S, 0, 360, 8, 0.006 * S, g, plane='yz', seg=4)
    b.cyl(V(xf(0.515), -0.042, 0.515), V(xf(0.515), 0.042, 0.515), 0.008 * S, 0.008 * S, g, seg=6)
    for s in (1, -1):
        b.sphere(V(xf(0.515), s * 0.042, 0.515), 0.011 * S, g, seg=(6, 4))
    b.arc(V(xf(0.43), 0, 0.455), 0.05 * S, 200, 340, 7, 0.009 * S, g, plane='yz', seg=6)
    for s in (1, -1):
        e = Vector(V(xf(0.438), s * 0.047, 0.438))
        b.cyl(tuple(e), tuple(e + Vector((0, s * 0.016, 0.034)) * S), 0.017 * S, 0.0, g, seg=4)


def sig_nisan(k):
    """Nišan: remen sa žirovima-mecima preko prsa, torbica sa žirovima i list na tjemenu"""
    b, h, V, S = k['b'], k['h'], k['V'], k['S']
    so = 0.022 * S if k['opts'].get('outfit') else 0.0   # v0.52: remen ide preko kostima
    for a in range(-40, 50, 14):   # žirovi-meci na remenu
        p = _strap_pt(V, S, a, 0.012 * S + so)
        b.sphere(tuple(p), (0.024 * S, 0.024 * S, 0.03 * S), '#b07a3c', seg=(8, 6))
        b.sphere(tuple(p + Vector((0, 0, 0.024 * S))), (0.026 * S, 0.026 * S, 0.014 * S), '#6b4423', seg=(8, 5))
    p, out, sd = _hip(V, -50, 0.5, 0.06)
    b.box(tuple(p), (0.09 * S, 0.06 * S, 0.1 * S), '#6b4423', bevel=0.014)
    b.box(tuple(p + Vector((0, 0, 0.045 * S)) + out * 0.004), (0.1 * S, 0.066 * S, 0.035 * S), '#4a2a14', bevel=0.008)
    b.sphere(tuple(p + out * 0.034 * S), 0.012 * S, '#f6c945', seg=(6, 4))
    hc, rad = V(0, 0, k['hz']), (k['hr'][0] * S, k['hr'][1] * S, k['hr'][2] * S)
    top = on_sphere(hc, rad, 160, 76, -0.01 * S)
    h.sphere(top, (0.1 * S, 0.05 * S, 0.02 * S), '#4caf50', rot=(0, -20, 30), seg=(10, 6))
    h.cyl(top, tuple(Vector(top) + Vector((-0.04, 0.0, 0.07)) * S), 0.008 * S, 0.004 * S, '#2e7d32', seg=4)


def sig_bikos(k):
    """Bikoš: bijele ratne pruge na obrazima, kozja bradica, naramenjak sa šiljcima i široki ratni pojas"""
    h, b, V, S = k['h'], k['b'], k['V'], k['S']
    hc, rad = V(0, 0, k['hz']), (k['hr'][0] * S, k['hr'][1] * S, k['hr'][2] * S)
    for s_ in (1, -1):
        for j, ph in enumerate((-2, 8)):
            pt = on_sphere(hc, rad, s_ * (52 + j * 6), ph, 0.003 * S)
            h.box(pt, (0.012 * S, 0.11 * S, 0.022 * S), '#f8fafc', rot=(s_ * 18, 0, s_ * (52 + j * 6)), bevel=0.004)
    for i, (x, z, r_) in enumerate(((0.33, 1.0, 0.06), (0.35, 0.93, 0.045), (0.36, 0.87, 0.03))):   # bradica
        h.sphere(V(x, 0, z), (r_ * S, r_ * S * 1.1, r_ * S * 1.3), '#3b1a10', seg=(10, 7))
    # naramenjak sa šiljcima (lijevo rame)
    sc = Vector(V(0.0, 0.31, 0.95))
    b.sphere(tuple(sc), (0.13 * S, 0.14 * S, 0.1 * S), '#6b7280', seg=(14, 9))
    b.sphere(tuple(sc + Vector((0, 0.03, -0.05)) * S), (0.12 * S, 0.12 * S, 0.06 * S), '#4b5563', seg=(12, 8))
    for dv in ((0.0, 0.3, 1.0), (-0.6, 0.4, 0.8), (0.6, 0.4, 0.8)):
        d_ = Vector(dv).normalized()
        b.cyl(tuple(sc + d_ * 0.08 * S), tuple(sc + d_ * 0.22 * S), 0.035 * S, 0.0, '#e5e7eb', seg=6)
    for tilt in (42, -42):   # prekriženi kožni remeni preko prsa sa zakovicama
        fr = strap(b, V(0, 0, 0.70), (0.30 * S, 0.30 * S, 0.345 * S), tilt, '#3b2414', r=0.024 * S)
        for a in (-30, -10, 10, 30):
            p_ = _strap_pt(V, S, a, 0.02 * S) if tilt > 0 else None
            if p_ is not None:
                b.sphere(tuple(p_), 0.016 * S, '#c9d3de', seg=(6, 4))
                b.sphere((p_[0], -p_[1], p_[2]), 0.016 * S, '#c9d3de', seg=(6, 4))
    b.sphere(V(0.3, 0, 0.78), (0.03 * S, 0.06 * S, 0.06 * S), '#c9d3de', seg=(10, 8))   # čelična ploča na križanju remena
    b.cyl(V(0, 0, 0.6), V(0, 0, 0.68), 0.31 * S, 0.305 * S, '#3b2414', seg=18)   # širok ratni pojas
    b.sphere(V(0.31, 0, 0.64), (0.03 * S, 0.075 * S, 0.06 * S), '#f6c945', seg=(12, 8))
    b.sphere(V(0.335, 0, 0.64), (0.014 * S, 0.03 * S, 0.026 * S), '#dc2626', mat='glow', seg=(8, 6))


def sig_nilski(k):
    """v0.55 Pecko (nilski konj, kao Pudge): ribarski šešir s mamcem, okrugli trbuh, udica na lancu i ribica za pojasom"""
    m, h, b, R, L, V, S = k['m'], k['h'], k['b'], k['R'], k['L'], k['V'], k['S']
    hc, rad = V(0, 0, k['hz']), (k['hr'][0] * S, k['hr'][1] * S, k['hr'][2] * S)
    # okrugli trbuh (gozba!) — strši ispod prsluka
    b.sphere(V(0.12, 0, 0.62), (0.2 * S, 0.25 * S, 0.21 * S), k['belly'], seg=(18, 12))
    b.sphere(V(0.29, 0, 0.62), (0.02 * S, 0.03 * S, 0.03 * S), mix(k['belly'], '#000000', 0.3), seg=(8, 6))   # pupak
    # ribarski šešir (maslinasti) s trakom i mamcem
    top = V(-0.02, 0, 1.6)
    h.cyl(V(-0.02, 0, 1.58), V(-0.02, 0, 1.6), 0.4 * S, 0.4 * S, '#6b7d3a', seg=24)              # obod
    h.cyl(V(-0.02, 0, 1.58), V(-0.02, 0, 1.6), 0.405 * S, 0.405 * S, '#55652c', seg=24, caps=False)
    h.cyl(V(-0.02, 0, 1.6), V(-0.02, 0, 1.78), 0.27 * S, 0.22 * S, '#7c8f43', seg=20, smooth=True)   # kruna šešira
    h.sphere(V(-0.02, 0, 1.78), (0.22 * S, 0.22 * S, 0.06 * S), '#7c8f43', seg=(16, 8))
    h.cyl(V(-0.02, 0, 1.61), V(-0.02, 0, 1.66), 0.272 * S, 0.262 * S, '#7c2d12', seg=20)            # traka
    h.cyl(V(0.2, 0.12, 1.64), V(0.24, 0.16, 1.6), 0.012 * S, 0.012 * S, '#9ca3af', seg=5)           # mamac: udičica
    h.sphere(V(0.24, 0.16, 1.62), (0.03 * S, 0.02 * S, 0.02 * S), '#f43f5e', seg=(8, 5))
    h.poly([V(0.21, 0.13, 1.66), V(0.18, 0.2, 1.73), V(0.25, 0.17, 1.68)], '#facc15', thick=0.01)  # pero mamca
    # udica na lancu u desnoj ruci: drška, savijeni zub s kukicom, lanac do pojasa
    hR = Vector(k['hR'])
    up = Vector((0.25, 0, 1.0)).normalized()
    s0, s1 = hR - up * 0.08 * S, hR + up * 0.42 * S
    R.cyl(tuple(s0), tuple(s1), 0.03 * S, 0.026 * S, '#9ca3af', seg=10)
    R.sphere(tuple(s0), 0.04 * S, '#6b7280', seg=(8, 6))
    pts = R.arc(tuple(s1 + Vector((0.12 * S, 0, 0))), 0.12 * S, 180, 360, 9, 0.026 * S, '#cbd5e1', plane='xz', seg=8)
    pts = R.arc(tuple(s1 + Vector((0.12 * S, 0, -0.0))), 0.12 * S, 0, 45, 3, 0.024 * S, '#cbd5e1', plane='xz', seg=8)
    tip = Vector(pts[-1])
    R.cyl(tuple(tip), tuple(tip + Vector((-0.07 * S, 0, 0.08 * S))), 0.024 * S, 0.0, '#e5e7eb', seg=6)   # vrh
    R.cyl(tuple(tip + Vector((-0.02 * S, 0, 0.03 * S))), tuple(tip + Vector((0.03 * S, 0, -0.01 * S))), 0.014 * S, 0.0, '#e5e7eb', seg=5)  # kukica
    for i in range(9):   # karike lanca od ruke do pojasa (visi u luku)
        t_ = i / 8
        q = hR.lerp(Vector(V(0.18, -0.28, 0.6)), t_) + Vector((0, 0, -0.12 * S * math.sin(t_ * math.pi)))
        R.arc(tuple(q), 0.024 * S, 0, 360, 6, 0.008 * S, '#9ca3af', plane='xz' if i % 2 else 'xy', seg=4)
    # ribica za pojasom (lijevi bok)
    fc = Vector(V(0.12, 0.3, 0.5))
    b.sphere(tuple(fc), (0.09 * S, 0.03 * S, 0.05 * S), '#38bdf8', seg=(10, 7))
    b.poly([tuple(fc + Vector((-0.08, 0, 0)) * S), tuple(fc + Vector((-0.15, 0, 0.05)) * S), tuple(fc + Vector((-0.15, 0, -0.05)) * S)], '#0ea5e9', thick=0.012)
    b.sphere(tuple(fc + Vector((0.06, 0.02, 0.015)) * S), 0.012 * S, '#0f172a', seg=(6, 4))
    b.cyl(tuple(fc + Vector((0.09, 0, 0.02)) * S), tuple(fc + Vector((0.12, -0.02, 0.12)) * S), 0.006 * S, 0.006 * S, '#a16207', seg=4)


def sig_irbis(k):
    """v0.55 Inja (snježni leopard, kao Drow Ranger): tamne rozete po krznu, ledeni vrhovi luka i pahuljica na kapuljači"""
    m, h, b, R, L, V, S = k['m'], k['h'], k['b'], k['R'], k['L'], k['V'], k['S']
    hc, rad = V(0, 0, k['hz']), (k['hr'][0] * S, k['hr'][1] * S, k['hr'][2] * S)
    dk = '#3f4654'
    for (th, ph) in ((66, -2), (-66, -2), (80, -18), (-80, -18)):   # rozete na obrazima (ispod kapuljače)
        face_cap(h, hc, rad, th, ph, (0.034 * S, 0.028 * S), dk, out=0.004 * S)
    for (th, ph) in ((60, 0), (-60, 0), (90, 25), (-90, 25), (120, -10), (-120, -10)):
        face_cap(b, V(0, 0, 0.70), (0.27 * S, 0.29 * S, 0.33 * S), th, ph, (0.04 * S, 0.034 * S), dk, out=0.003 * S)
    # pahuljica na kapuljači (srebrna, svijetli)
    sc = Vector(V(0.2, 0.0, 1.66))
    for kk in range(6):
        a = RAD(kk * 60)
        d = Vector((0, math.cos(a), math.sin(a)))
        h.cyl(tuple(sc), tuple(sc + d * 0.07 * S), 0.01 * S, 0.006 * S, '#e0f2fe', mat='glow', seg=5)
    h.sphere(tuple(sc), 0.02 * S, '#bae6fd', mat='glow', seg=(8, 6))
    # ledeni kristali na krajevima luka (luk je u lijevoj ruci)
    hL = Vector(k['hL'])
    for sd in (1, -1):
        tipp = hL + Vector((0.06 * S, 0.02 * S, sd * 0.5 * S))
        L.ico(tuple(tipp), 0.045 * S, '#a5f3fc', mat='glow', sub=1)
        L.cyl(tuple(tipp), tuple(tipp + Vector((0.02 * S, 0, sd * 0.09 * S))), 0.03 * S, 0.0, '#e0f2fe', mat='glow', seg=6)
    # ledeni dragulj na prsima (kopča plašta)
    b.ico(V(0.29, 0, 0.93), 0.035 * S, '#7dd3fc', mat='glow', sub=1)


def sig_skorpion(k):
    """v0.55 Škorpo (škorpion, kao Sand King): kliješta, šest nožica, oklopljene ploče i golemi rep sa žalcem iznad glave"""
    m, h, b, R, L, V, S = k['m'], k['h'], k['b'], k['R'], k['L'], k['V'], k['S']
    fur, dark = k['fur'], k['dark']
    shell, shell2 = '#c2410c', '#9a3412'
    # kliješta na obje ruke
    for arm, hh, sd in ((R, Vector(k['hR']), -1), (L, Vector(k['hL']), 1)):
        pc = hh + Vector((0.1 * S, 0, 0.04 * S))
        arm.sphere(tuple(pc), (0.14 * S, 0.1 * S, 0.11 * S), shell, seg=(14, 10))
        arm.sphere(tuple(pc + Vector((0.04, 0, 0.06)) * S), (0.08 * S, 0.06 * S, 0.04 * S), mix(shell, '#ffffff', 0.15), seg=(10, 6))
        for jz, ln, rr in ((0.06, 0.26, 0.05), (-0.05, 0.2, 0.04)):   # gornji (veći) i donji krak
            a0 = pc + Vector((0.1 * S, 0, jz * S))
            mid = a0 + Vector((0.13 * S, 0, jz * 0.6 * S))
            tipp = a0 + Vector((ln * S, 0, -jz * 0.4 * S))
            arm.cyl(tuple(a0), tuple(mid), rr * S, rr * 0.8 * S, shell, seg=8, smooth=True)
            arm.cyl(tuple(mid), tuple(tipp), rr * 0.8 * S, 0.0, shell2, seg=8, smooth=True)
            for tt in (0.35, 0.7):   # zupci
                q = Vector(mid).lerp(Vector(tipp), tt)
                arm.cyl(tuple(q), tuple(q + Vector((0, 0, -0.035 * S if jz > 0 else 0.035 * S))), 0.012 * S, 0.0, '#fde68a', seg=4)
    # šest nožica sa strane trbuha
    for sd in (1, -1):
        for i, (xx, zz) in enumerate(((0.1, 0.56), (-0.02, 0.54), (-0.14, 0.56))):
            p0 = Vector(V(xx, sd * 0.24, zz))
            knee = p0 + Vector((xx * 0.5, sd * 0.2, 0.06)) * S
            foot = p0 + Vector((xx * 0.9, sd * 0.3, -0.2)) * S
            b.cyl(tuple(p0), tuple(knee), 0.034 * S, 0.03 * S, shell, seg=8, smooth=True)
            b.sphere(tuple(knee), 0.034 * S, shell2, seg=(8, 6))
            b.cyl(tuple(knee), tuple(foot), 0.03 * S, 0.012 * S, shell2, seg=8, smooth=True)
    # oklopljene ploče na leđima
    for i in range(4):
        z_ = 0.56 + i * 0.12
        b.sphere(V(-0.1, 0, z_), (0.22 * S, (0.26 - i * 0.015) * S, 0.07 * S), shell if i % 2 else shell2, rot=(0, 20, 0), seg=(14, 8))
    # oklopna kaciga glave: tri preklopljene ploče od čela do potiljka i greben
    hc, rad = Vector(V(0, 0, k['hz'])), (k['hr'][0] * S, k['hr'][1] * S, k['hr'][2] * S)
    for i, (ox, oz, sz) in enumerate(((-0.1, 0.1, 0.96), (-0.2, 0.06, 0.9), (-0.3, 0.0, 0.8))):
        h.sphere(tuple(hc + Vector((ox, 0, oz)) * S), (rad[0] * 0.78 * sz, rad[1] * 1.03 * sz, rad[2] * 0.92 * sz), shell if i % 2 else shell2, seg=(20, 12))
    # mala usna kliješta (helicere) ispod očiju i usta
    for sd in (1, -1):
        h.cyl(V(0.33, sd * 0.09, 1.15), V(0.44, sd * 0.05, 1.1), 0.032 * S, 0.012 * S, shell2, seg=7, smooth=True)
        h.cyl(V(0.44, sd * 0.05, 1.1), V(0.46, sd * 0.015, 1.06), 0.012 * S, 0.0, '#fde68a', seg=5)
    h.arc(V(0.4, 0, 1.17), 0.06 * S, 210, 330, 6, 0.011 * S, '#5a2a12', plane='yz', seg=5)
    for sd in (1, -1):   # dva mala dodatna oka iznad velikih
        h.sphere(V(0.32, sd * 0.07, 1.5), 0.028 * S, '#111827', seg=(8, 6))
        h.sphere(V(0.335, sd * 0.065, 1.51), 0.009 * S, '#ffffff', seg=(6, 4))
    # golemi rep sa žalcem: luk od leđa do iznad glave (dio "tail" — njiše se)
    t = k['t']
    if t is not None:
        pts = [(-0.26, 0, 0.6), (-0.5, 0, 0.66), (-0.7, 0, 0.86), (-0.78, 0, 1.12), (-0.74, 0, 1.4), (-0.62, 0, 1.64), (-0.44, 0, 1.84)]
        rr = [0.12, 0.115, 0.11, 0.1, 0.09, 0.08, 0.075]
        for i, (pt, r_) in enumerate(zip(pts, rr)):
            t.sphere(V(*pt), (r_ * S, r_ * S * 0.95, r_ * S), shell if i % 2 else shell2, seg=(14, 10))
            if i:
                t.cyl(V(*pts[i - 1]), V(*pt), rr[i - 1] * 0.8 * S, r_ * 0.8 * S, mix(shell2, '#000000', 0.2), seg=10)
        bulb = Vector(V(-0.28, 0, 1.94))
        t.sphere(tuple(bulb), (0.1 * S, 0.08 * S, 0.08 * S), '#fbbf24', seg=(12, 9))
        t.cyl(tuple(bulb + Vector((0.06, 0, 0)) * S), tuple(bulb + Vector((0.2, 0, -0.1)) * S), 0.045 * S, 0.0, '#a3e635', mat='glow', seg=8)
        t.sphere(tuple(bulb + Vector((0.2, 0, -0.1)) * S), 0.02 * S, '#d9f99d', mat='glow', seg=(6, 4))


SIGS = {'nilski': sig_nilski, 'irbis': sig_irbis, 'skorpion': sig_skorpion, 'nisan': sig_nisan, 'bikos': sig_bikos, 'vitez': sig_vitez, 'zarko': sig_zarko, 'ledena': sig_ledena, 'strijela': sig_strijela, 'listko': sig_listko,
        'munja': sig_munja, 'skokica': sig_skokica, 'orlina': sig_orlina, 'luna': sig_luna, 'tragac': sig_tragac,
        'jez': sig_jez, 'slon': sig_slon, 'pcela': sig_pcela, 'sova': sig_sova, 'majmun': sig_majmun, 'vuk': sig_vuk,
        'gavran': sig_gavran, 'hobotnica': sig_hobotnica, 'nosorog': sig_nosorog, 'panda': sig_panda,
        'jednorog': sig_jednorog, 'morskipas': sig_morskipas}


HEROES = {
    # ---- v0.55 ----
    'nilski': (dict(fur='#9b8fb5', belly='#f2c6d6', muzzle='#e3b3c8', dark='#5b4f75', inner='#f9a8d4', limb='#9b8fb5',
                    hand='#8a7ea6', feet='#6e6290', nose='#3b2f4a'),
               dict(ears='round', earScale=0.62, snout='hippo', tail='stub', atk='melee', scale=1.18, brows='#4a3f63', browAngle=6,
                    headR=(0.43, 0.47, 0.38), eyes={'color': '#2b1d3a', 'size': 0.92}, blush=True, strap=False, boots='#5b3a1e',
                    outfit=dict(style='vest', cloth='#facc15', lining='#ca8a04', trim='#1e3a8a', buttons='#1e3a8a', sleeves=True))),
    'irbis': (dict(fur='#e6e8ee', belly='#ffffff', muzzle='#ffffff', dark='#4b5563', inner='#f6c1cf', limb='#e6e8ee',
                   hand='#d9dce4', feet='#b8bdc9', nose='#7a5866'),
              dict(ears='round', earScale=0.82, snout='muzzle', tail='ringed', weapon='bow', atk='bow', bowColor='#e0f2fe',
                   hood=True, hoodColor='#0f5f70', scarf=True, scarfColor='#155e75', quiverColor='#cbd5e1',
                   eyes={'color': '#0ea5e9', 'size': 1.1}, brows='#4b5563', browAngle=-6, bracers='#164e63',
                   outfit=dict(style='vest', cloth='#1e3a5f', lining='#0f172a', trim='#7dd3fc', sleeves=True))),
    'skorpion': (dict(fur='#e0a64a', belly='#f6dca6', muzzle='#f6dca6', dark='#7c4a1e', limb='#c9853a', hand='#c2410c',
                      feet='#7c4a1e', nose='#5a3412'),
                 dict(ears=None, snout='none', tail='stub', atk='claws', crown=True, bellyPlates=True, scale=1.12,
                      eyes={'white': True, 'color': '#b45309', 'size': 1.05}, brows='#7c4a1e', browAngle=12, blush=False,
                      cheekFluff=False, headR=(0.4, 0.43, 0.36), cape=True, capeColor='#7f1d1d', strap=False)),
    # ---- v0.38 ----
    'nisan': (dict(fur='#c8692e', belly='#fbe7cc', muzzle='#fbe7cc', dark='#7a3510', inner='#f6b98a', eartip='#5a2a0e',
                   limb='#b85f28', hand='#b85f28', feet='#7a3510', nose='#2b1a10'),
              dict(ears='pointy', snout='muzzle', tail='squirrel', tuft='#e8a066', weapon='rifle', atk='rifle', strap=True,
                   scarf=True, eyes={'color': '#3b1d08', 'size': 1.12}, brows='#7a3510', browAngle=-8,
                   headR=(0.4, 0.42, 0.37), hat='ranger', shoulders='#7a5230', bracers='#5b3a1e', boots='#4a2a14',
                   outfit=dict(style='vest', cloth='#4d7c0f', lining='#365314', trim='#a16207', sleeves=True))),
    'bikos': (dict(fur='#9c3a22', belly='#e7a77f', muzzle='#e9b99a', dark='#5a1f12', inner='#e9a39a', limb='#9c3a22',
                   hand='#7a2c18', feet='#3b2414', nose='#3b1a10'),
              dict(ears='round', earScale=0.75, snout='bull', bullHorns='#f1e6c8', tail='thin', tuft='#3b1a10', weapon='axe',
                   atk='melee', scale=1.12, brows='#3b1a10', browAngle=10, headR=(0.43, 0.46, 0.39), bracers='#4b5563',
                   neckFur='#4a2516', boots='#3b2414',
                   eyes={'color': '#7f1d1d', 'size': 0.95}, blush=False, strap=False)),
    # ---- v0.15 ----
    'jednorog': (dict(fur='#fdf4ff', belly='#ffffff', muzzle='#fce7f3', dark='#a78bfa', inner='#f9a8d4', limb='#fdf4ff',
                      feet='#c4b5fd'),
                 dict(ears='pointy', snout='horse', tail='rainbow', unicornHorn='#f6c945',
                      rainbowMane=('#f87171', '#fb923c', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'),
                      weapon='orb', orb='#f0abfc', atk='mage', eyes={'color': '#7c3aed', 'size': 1.15}, brows='#a78bfa',
                      browAngle=-4, cheekFluff=False, cape=True, capeColor='#f9a8d4', capeStars=True, tunic='team')),
    'morskipas': (dict(fur='#64748b', belly='#f1f5f9', muzzle='#f1f5f9', dark='#334155', limb='#64748b', feet='#475569'),
                  dict(ears=None, snout='shark', tail='shark', dorsalFin='#556274', weapon='claws', clawColor='#f1f5f9',
                       atk='claws', eyes={'white': True, 'color': '#0f172a', 'size': 1.0}, brows='#1e293b', browAngle=-16,
                       headR=(0.42, 0.44, 0.38), blush=False, cheekFluff=False, tabardEmblem=False,
                       outfit=dict(style='coat', cloth='#991b1b', lining='#7f1d1d', trim='#f6c945', buttons='#f6c945', sleeves=True))),
    'vitez': (dict(fur='#e9a93b', belly='#f9e3ad', muzzle='#fbe8bb', nose='#4a2a1a', dark='#9c5a1c'),
              dict(ears='round', mane='#b5541e', tail='thin', tuft='#b5541e', weapon='sword', shield=True,
                   crown=True, brows='#7a3b12', chest='#cfd8e3', shoulders='#cfd8e3', boots='#5b3a1e', atk='melee', cape=True,
                   capeColor='#b91c1c')),
    'zarko': (dict(fur='#e4572e', belly='#ffcf56', dark='#8f2414', inner='#ffcf56'),
              dict(snout='dragon', horns='#fff1c9', wings='#ff8a4c', wingScale=1.25, tail='long', tailFlame=True,
                   weapon='orb', orb='#ffb020', crest='#ffcf56', bellyPlates=True, atk='mage',
                   outfit=dict(style='vest', cloth='#6d28d9', lining='#4c1d95', trim='#f6c945', collar='#6d28d9'))),
    'ledena': (dict(fur='#26324f', belly='#f4f8ff', muzzle='#f4f8ff', beak='#f59e0b', feet='#f59e0b', limb='#26324f',
                    hand='#ef4444'),
               dict(snout='flatbeak', hat='wizard', hatColor='#2563eb', weapon='staff', orb='#9ae6ff', orbShape='crystal',
                    staffWood='#cbd5e1', flippers=True, atk='mage', blush=True, brows='#0f172a', browAngle=16, headR=(0.4, 0.4, 0.4),
                    outfit=dict(style='coat', cloth='#dbeafe', lining='#93c5fd', trim='#ffffff', collar='fur', fur='#ffffff'))),
    'strijela': (dict(fur='#f07c2b', belly='#fff3e3', muzzle='#fff3e3', dark='#8a3a0e', eartip='#3b2414',
                      limb='#3b2414', hand='#3b2414'),
                 dict(ears='bigpointy', snout='long', tail='bushy', tuft='#ffffff', weapon='bow', atk='bow',
                      sleeve=False, headFeather='#ef4444', bracers='#5b3a1e', tufts=True, hood=True, hoodColor='#3f7d3a',
                      quiverColor='#7a4b25', outfit=dict(style='vest', cloth='#4d7c0f', lining='#365314', trim='#a16207', sleeves=True))),
    'listko': (dict(fur='#80c96d', belly='#f4e6a1', muzzle='#a7dc8f', dark='#3f7a2d'),
               dict(shell=('#5e8a35', '#7aa846', '#3e5f22'), headband=True, weapon='staff', orb='#86efac',
                    orbShape='leaf', staffWood='#7a4b25', tail='stub', atk='mage', tunic='team', flowerHat=True, browAngle=-6)),
    'munja': (dict(fur='#f39a2b', belly='#fff6e8', muzzle='#fff6e8', dark='#2b1a10'),
              dict(ears='round', stripesHead=True, stripesBody=True, tail='ringed', weapon='claws',
                   clawColor='#fde047', atk='claws', brows='#2b1a10', browAngle=-6, boltMark=True, fangs=True, tufts=True,
                   chest='#374151', shoulders='#374151', ornate=False)),
    'skokica': (dict(fur='#5cc04f', belly='#f4f19b', dark='#2f7a2a', feet='#4aa63f'),
                dict(snout='frog', weapon='club', lilypad=True, atk='melee', blush=False,
                     headR=(0.42, 0.46, 0.33), spots=True, brows=None, shoulders='#7c4a24', ornate=False, bracers='#7c4a24')),
    'orlina': (dict(fur='#7a4a2a', belly='#efe7d6', muzzle='#ffffff', beak='#f5b324', feet='#f5b324', limb='#f5b324'),
               dict(snout='beak', armWings='#6b3f22', tail=None, atk='wing', eyes={'color': '#3b1d08'},
                    brows='#3b2414', browAngle=8, headR=(0.38, 0.38, 0.38), whiteHead=True, goggles=True,
                    tailFeathers=True, tufts=True, scarfColor='#dc2626',
                    outfit=dict(style='vest', cloth='#7c4a24', lining='#4a2a14', trim='#d6b37a'))),
    'luna': (dict(fur='#d7cdf0', belly='#ffffff', muzzle='#ffffff', dark='#6d5aa8', inner='#f9b4d0',
                  limb='#d7cdf0'),
             dict(ears='pointy', snout='muzzle', tail='catlong', tuft='#6d5aa8', weapon='bow', atk='bow',
                  bowColor='#e5e7eb', crescent=True, cape=True, capeStars=True, eyes={'color': '#4c1d95'},
                  brows='#6d5aa8', browAngle=-4, tufts=True, capeColor='#4c1d95',
                  outfit=dict(style='vest', cloth='#312e81', lining='#1e1b4b', trim='#f6c945', sleeves=True))),
    'jez': (dict(fur='#b48a5c', belly='#f1e3c8', muzzle='#f1e3c8', dark='#4a3728', nose='#1f1a17'),
            dict(ears='round', earScale=0.8, snout='long', tail='stub', quills=('#4a3728', '#e8d5b5'),
                 atk='melee', brows='#4a3728', browAngle=-6,
                 outfit=dict(style='vest', cloth='#7c4a24', lining='#4a2a14', trim='#d6b37a', buttons='#d6b37a'))),
    'slon': (dict(fur='#9aa4b5', belly='#c9d1dc', muzzle='#9aa4b5', dark='#5b6474', inner='#e9b8c4'),
             dict(ears='big', snout='none', trunk=True, tusks=True, tail='thin', tuft='#5b6474', weapon='hammer',
                  atk='melee', scale=1.08, brows='#5b6474', browAngle=-4, headR=(0.42, 0.44, 0.38),
                  outfit=dict(style='vest', cloth='#0f766e', lining='#134e4a', trim='#f6c945', collar='#f6c945'))),
    'pcela': (dict(fur='#f5c518', belly='#fde68a', muzzle='#fde68a', dark='#1f1a17', nose='#1f1a17'),
              dict(ears=None, snout='muzzle', bands='#1f1a17', wings='#dff6ff', wingScale=1.15, wingStyle='bee', browAngle=-4, antennae=True,
                   stinger=True, weapon='orb', orb='#f59e0b', atk='mage', tunic='team', eyes={'size': 1.1}, cheekFluff=False)),
    'sova': (dict(fur='#8a6a4a', belly='#e9dcc3', muzzle='#e9dcc3', beak='#f5b324', feet='#f5b324', limb='#f5b324',
                  dark='#4a3222'),
             dict(snout='beak', armWings='#6b4f35', tail=None, atk='wing', eyes={'white': True, 'color': '#f59e0b', 'size': 1.2},
                  earTufts=True, faceDisc='#f3e9d2', brows='#4a3222', browAngle=-16, headR=(0.4, 0.42, 0.4),
                  blush=False, outfit=dict(style='robe', cloth='#1e3a8a', lining='#172554', trim='#f6c945'))),
    'majmun': (dict(fur='#8b5a2b', belly='#f1d8b5', muzzle='#f1d8b5', dark='#4a2a14', inner='#f1d8b5', nose='#2b1d1a'),
               dict(ears='round', earScale=1.4, snout='muzzle', tail='catlong', tuft='#8b5a2b', weapon='staff',
                    orbShape='none', staffWood='#f6c945', headband=True, bandColor='#f6c945', bandNoTails=True, atk='melee',
                    brows='#4a2a14', browAngle=-4, tufts=True, faceMask='#f1d8b5', outfit=dict(style='vest', cloth='#b91c1c', lining='#7f1d1d', trim='#f6c945'))),
    'tragac': (dict(fur='#8e93a0', belly='#e7e9ee', muzzle='#eef0f4', dark='#2d2f36', nose='#111111'),
               dict(ears='round', snout='muzzle', mask='#2a2c33', tail='ringed', weapon='shuriken', atk='claws',
                    hood=True, hoodColor='#1f2328', eyes={'white': True}, beltStar=True, scarf=True, scarfColor='#374151',
                    brows='#111111', browAngle=-8, outfit=dict(style='vest', cloth='#5b3a1e', lining='#3b2414', trim='#9ca3af'))),
    # ---- v0.10 ----
    'vuk': (dict(fur='#8a8f98', belly='#e5e7eb', muzzle='#e5e7eb', dark='#3b3f47', nose='#1f1a17', inner='#d1d5db'),
            dict(ears='pointy', snout='long', tail='bushy', tuft='#e5e7eb', weapon='claws', clawColor='#e5e7eb',
                 atk='claws', fangs=True, neckFur='#d1d5db', brows='#3b3f47', browAngle=-12, eyes={'color': '#fbbf24'}, tufts=True,
                 outfit=dict(style='vest', cloth='#3f3f46', lining='#27272a', trim='#9ca3af'))),
    'gavran': (dict(fur='#2b2f3a', belly='#3f4452', muzzle='#3f4452', beak='#f59e0b', feet='#f59e0b', limb='#f59e0b',
                    dark='#14161c'),
               dict(snout='beak', armWings='#1f2430', tail=None, atk='wing', eyes={'white': True, 'color': '#a78bfa', 'size': 1.1},
                    hat='cone', hatColor='#312e81', tailFeatherColors=('#1f2430', '#3f4452'), brows='#14161c', browAngle=-10,
                    blush=False, headR=(0.38, 0.38, 0.38), outfit=dict(style='robe', cloth='#4c1d95', lining='#2e1065', trim='#cbd5e1'))),
    'hobotnica': (dict(fur='#8b5cf6', belly='#c4b5fd', muzzle='#c4b5fd', dark='#5b21b6', limb='#8b5cf6'),
                  dict(ears=None, snout='muzzle', tail=None, tentacles='#7c3aed', atk='melee', tunic='team',
                       eyes={'white': True, 'size': 1.25}, brows='#5b21b6', browAngle=-4, headR=(0.44, 0.46, 0.42),
                       blush=True, cheekFluff=False, outfit=dict(style='vest', cloth='#1e3a8a', lining='#172554', trim='#ffffff', collar='#f8fafc'))),
    'nosorog': (dict(fur='#7d8a96', belly='#b8c2cc', muzzle='#9aa6b2', dark='#4a5560', inner='#d8c0c8', nose='#3b4450'),
                dict(ears='round', earScale=0.7, snout='long', tail='thin', tuft='#4a5560', atk='melee', scale=1.1,
                     noseHorn='#f1e9d6', chest='#9aa3ad', shoulders='#9aa3ad', brows='#4a5560', browAngle=8,
                     headR=(0.42, 0.44, 0.38))),
    'panda': (dict(fur='#f3f4f6', belly='#ffffff', muzzle='#ffffff', dark='#1f2328', nose='#1f2328', limb='#1f2328',
                   inner='#1f2328'),
              dict(ears=None, earColor='#1f2328', eyePatches='#1f2328', snout='muzzle', tail='stub', atk='melee',
                   weapon='bamboo', tunic='team', brows=None, blush=True, headR=(0.42, 0.44, 0.4), tufts=True,
                   outfit=dict(style='vest', cloth='#15803d', lining='#14532d', trim='#f6c945', buttons='#f6c945'))),
}


def build_heroes(only=None):
    global METAL_SET
    METAL_SET = CHAR_METAL   # zlato i čelik na junacima sjaje
    try:
        _build_heroes(only)
    finally:
        METAL_SET = set()


def _build_heroes(only=None):
    for hid, (c, o) in HEROES.items():
        if only and hid not in only:
            continue
        o = dict(o)
        if o.pop('whiteHead', False):
            # orao: bijela glava, smeđe tijelo
            c = dict(c)
            fur_body = c['fur']
            c['fur'] = '#f3efe4'
            m = biped('hero_' + hid, c, o)
            # prebojaj tijelo (lakše nego posebna grana u biped): tijelo dobiva smeđu
            body = m['body']
            recolor(body.obj, col('#f3efe4'), col(fur_body))
        else:
            biped('hero_' + hid, c, o)


def recolor(ob, src, dst, tol=0.002):
    me = ob.data
    ca = me.color_attributes.get('Col')
    for d in ca.data:
        c = d.color
        if abs(c[0] - src[0]) < tol and abs(c[1] - src[1]) < tol and abs(c[2] - src[2]) < tol:
            d.color = (dst[0], dst[1], dst[2], 1)


# ------------------------------------------------------------------ VOJNICI
def build_creeps():
    # pješak: mali vitez s kacigom, mačem i štitom
    m = Model('creep_melee')
    skin = '#ffd7b0'
    for side, nm in ((1, 'legL'), (-1, 'legR')):
        lg = m.part(nm, (0, side * 0.12, 0.34))
        lg.cyl((0, side * 0.12, 0.36), (0, side * 0.12, 0.1), 0.07, 0.065, '#5a4a3a', seg=8)
        lg.sphere((0.04, side * 0.12, 0.06), (0.11, 0.075, 0.065), '#3a2c20')
    b = m.part('body', (0, 0, 0.36))
    b.cyl((0, 0, 0.34), (0, 0, 0.78), 0.26, 0.22, '#ffffff', mat='team', seg=12)
    b.cyl((0, 0, 0.52), (0, 0, 0.58), 0.255, 0.25, '#5b3a1e', seg=12)
    b.sphere((0.06, 0, 0.66), (0.18, 0.2, 0.16), '#c9d3de', seg=(12, 7))
    h = m.part('head', (0, 0, 0.8), 'body')
    h.sphere((0, 0, 1.0), (0.27, 0.28, 0.26), skin, seg=(14, 10))
    eyes(h, 0.23, 0, 1.0, r=0.05, spread=0.1)
    h.sphere((-0.02, 0, 1.08), (0.3, 0.31, 0.24), '#b8c4d0', seg=(14, 8))
    h.box((0.2, 0, 1.18), (0.06, 0.32, 0.05), '#9aa7b5', bevel=0.01)
    h.cyl((-0.02, 0, 1.3), (-0.08, 0, 1.46), 0.05, 0.02, '#ffffff', mat='team', seg=6)
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        a = m.part(nm, (0, side * 0.24, 0.7), 'body')
        a.cyl((0, side * 0.25, 0.72), (0.02, side * 0.29, 0.5), 0.055, 0.05, '#ffffff', mat='team', seg=8)
        a.sphere((0.03, side * 0.3, 0.46), 0.065, skin)
    R, L = m['armR'], m['armL']
    hR = Vector((0.03, -0.3, 0.46))
    d = Vector((0.94, 0, 0.34))
    R.box(hR + d * 0.3, (0.44, 0.06, 0.02), '#dfe6ee', rot=(90, -20, 0), bevel=0.006)
    R.box(hR + d * 0.06, (0.05, 0.18, 0.035), '#a16207', rot=(0, -20, 0))
    n = Vector((0.55, 0.83, 0)).normalized()
    cc = Vector((0.1, 0.36, 0.5))
    L.cyl(cc - n * 0.025, cc + n * 0.025, 0.18, 0.18, '#7a4b25', seg=12)
    L.cyl(cc + n * 0.02, cc + n * 0.04, 0.15, 0.15, '#ffffff', mat='team', seg=12)
    # v0.13: metalni umbo štita, zakovice, naramenice, vizir, veća perjanica, kopča pojasa
    L.sphere(cc + n * 0.05, 0.05, '#c9d3de', seg=(10, 7))
    for k in range(6):
        a = RAD(k * 60)
        off = Vector((-n.y, n.x, 0)) * math.cos(a) * 0.15 + Vector((0, 0, 1)) * math.sin(a) * 0.15
        L.sphere(cc + n * 0.045 + off, 0.015, '#9aa7b5', seg=(5, 4))
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        m[nm].sphere((0.0, side * 0.26, 0.74), (0.09, 0.08, 0.06), '#b8c4d0', seg=(10, 7))
        m[nm].sphere((0.0, side * 0.26, 0.77), (0.05, 0.05, 0.03), '#ffffff', mat='team', seg=(8, 5))
    h.box((0.255, 0, 1.06), (0.04, 0.2, 0.025), '#1f2937')
    h.cyl((-0.08, 0, 1.36), (-0.2, 0, 1.52), 0.07, 0.03, '#ffffff', mat='team', seg=8)
    h.sphere((-0.21, 0, 1.53), 0.05, '#ffffff', mat='team', seg=(8, 6))
    b.box((0.25, 0, 0.55), (0.04, 0.08, 0.06), '#f6c945', bevel=0.008)
    R.sphere(hR + d * 0.06 + Vector((0.01, 0, 0)), 0.02, '#38bdf8', mat='glow', seg=(6, 4))
    biped_anims(m, kind='melee', tail=False)
    m.finish()

    # strijelac-čarobnjak: šešir, haljina, štap s kuglom
    m = Model('creep_ranged')
    b = m.part('body', (0, 0, 0.3))
    for side, nm in ((1, 'legL'), (-1, 'legR')):
        lg = m.part(nm, (0, side * 0.11, 0.3))
        lg.sphere((0.04, side * 0.11, 0.06), (0.1, 0.07, 0.06), '#3a2c20')
        lg.cyl((0, side * 0.11, 0.3), (0, side * 0.11, 0.08), 0.06, 0.055, '#4b3a2a', seg=8)
    b.cyl((0, 0, 0.12), (0, 0, 0.78), 0.3, 0.16, '#ffffff', mat='team', seg=12)
    b.cyl((0, 0, 0.12), (0, 0, 0.18), 0.305, 0.29, '#9a9a9a', mat='team', seg=12)
    b.cyl((0, 0, 0.5), (0, 0, 0.55), 0.22, 0.21, '#f6c945', seg=12)
    h = m.part('head', (0, 0, 0.78), 'body')
    h.sphere((0, 0, 0.98), (0.24, 0.25, 0.23), '#ffd7b0', seg=(14, 10))
    eyes(h, 0.2, 0, 0.98, r=0.045, spread=0.09)
    h.sphere((0.17, 0, 0.88), (0.1, 0.15, 0.08), '#f1f5f9')  # brada
    h.cyl((0, 0, 1.1), (0, 0, 1.14), 0.34, 0.33, '#6b6b6b', mat='team', seg=14)
    h.cyl((0, 0, 1.13), (-0.12, 0, 1.6), 0.22, 0.0, '#8a8a8a', mat='team', seg=12)
    h.sphere((-0.12, 0, 1.6), 0.04, '#f6c945')
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        a = m.part(nm, (0, side * 0.2, 0.66), 'body')
        a.cyl((0, side * 0.21, 0.68), (0.03, side * 0.26, 0.46), 0.06, 0.07, '#ffffff', mat='team', seg=8)
        a.sphere((0.04, side * 0.27, 0.42), 0.055, '#ffd7b0')
    R = m['armR']
    hR = Vector((0.04, -0.27, 0.42))
    R.cyl(hR - Vector((0, 0, 0.3)), hR + Vector((0, 0, 0.5)), 0.022, 0.026, '#7a4b25', seg=6)
    R.sphere(hR + Vector((0, 0, 0.58)), 0.085, '#ffffff', mat='teamglow')
    # v0.13: kandže štapa oko kugle, zlatni rubovi rukava, pojas s kopčom, zvjezdice na šeširu
    for k in range(3):
        a = RAD(k * 120)
        R.cyl(hR + Vector((0, 0, 0.5)), hR + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.64)), 0.012, 0.006, '#f6c945', seg=4)
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        m[nm].cyl((0.03, side * 0.26, 0.47), (0.03, side * 0.262, 0.5), 0.074, 0.074, '#f6c945', seg=8, caps=False)
    b.cyl((0, 0, 0.46), (0, 0, 0.49), 0.235, 0.232, '#5b3a1e', seg=12, caps=False)
    b.box((0.23, 0, 0.475), (0.03, 0.06, 0.05), '#f6c945', bevel=0.006)
    for (zz, aa) in ((1.25, 20), (1.38, -40), (1.18, -150)):
        a = RAD(aa)
        h.sphere((-0.04 + math.cos(a) * 0.17 * (1.6 - zz) * 1.4, math.sin(a) * 0.17 * (1.6 - zz) * 1.4, zz), 0.022, '#fde047', mat='glow', seg=(5, 4))
    biped_anims(m, kind='mage', tail=False)
    m.finish()

    # opsadna kola: ovan na kotačima
    m = Model('creep_siege')
    base = m.part('body', (0, 0, 0.3))
    base.box((0, 0, 0.36), (1.2, 0.62, 0.14), '#8b5a2b', bevel=0.02)
    base.box((-0.05, 0, 0.62), (0.9, 0.56, 0.4), '#a0522d', bevel=0.03)
    base.cyl((-0.5, 0, 0.82), (0.45, 0, 0.82), 0.32, 0.32, '#ffffff', mat='team', seg=4)  # krov
    base.box((-0.05, 0, 1.06), (0.98, 0.06, 0.06), '#5b3a1e')
    for y in (0.3, -0.3):
        base.box((-0.05, y, 0.62), (0.92, 0.03, 0.08), '#5b3a1e')
    base.cyl((-0.45, 0, 1.06), (-0.45, 0, 1.5), 0.02, 0.02, '#5b3a1e', seg=6)
    base.poly([(-0.45, 0.01, 1.5), (-0.45, 0.01, 1.28), (-0.12, 0.01, 1.39)], '#ffffff', mat='team')
    ram = m.part('ram', (0.1, 0, 0.6), 'body')
    ram.cyl((-0.4, 0, 0.6), (0.82, 0, 0.6), 0.09, 0.09, '#6b3e1f', seg=10, smooth=True)
    ram.sphere((0.86, 0, 0.6), (0.14, 0.16, 0.15), '#9aa3ad')
    for s in (1, -1):
        ram.cyl((0.85, s * 0.08, 0.66), (0.78, s * 0.22, 0.78), 0.05, 0.0, '#e5e7eb', seg=6)
    for i, (x, y) in enumerate(((0.38, 0.34), (0.38, -0.34), (-0.38, 0.34), (-0.38, -0.34))):
        w = m.part('wheel%d' % i, (x, y, 0.22))
        w.cyl((x, y - 0.05, 0.22), (x, y + 0.05, 0.22), 0.22, 0.22, '#6b3e1f', seg=12)
        w.cyl((x, y - 0.06, 0.22), (x, y + 0.06, 0.22), 0.06, 0.06, '#9aa3ad', seg=8)
        w.box((x, y + 0.055 * (1 if y > 0 else -1), 0.22), (0.4, 0.02, 0.04), '#4a2a14')
        w.box((x, y + 0.055 * (1 if y > 0 else -1), 0.22), (0.04, 0.02, 0.4), '#4a2a14')
    Z = (0, 0, 0)
    wheels = ['wheel%d' % i for i in range(4)]
    m.anim('idle', 48, {'body': [(0, Z, Z), (24, Z, (0, 0, -0.01)), (48, Z, Z)],
                        'ram': [(0, Z, Z), (24, Z, (-0.02, 0, 0)), (48, Z, Z)]})
    m.anim('walk', 20, {**{w: [(0, Z), (20, (0, 360, 0))] for w in wheels},
                        'body': [(0, (2, 0, 0), Z), (10, (-2, 0, 0), (0, 0, 0.015)), (20, (2, 0, 0), Z)]},
           linear=wheels)
    m.anim('attack', 14, {'ram': [(0, Z, Z), (4, Z, (-0.27, 0, 0)), (5, Z, (-0.28, 0, 0)), (7, Z, (0.3, 0, 0)), (9, Z, (0.24, 0, 0)), (14, Z, Z)],   # udar u 7. kadru
                          'body': [(0, Z, Z), (4, (0, -2, 0), (-0.02, 0, 0)), (7, (0, 3, 0), (0.05, 0, 0)), (14, Z, Z)]})
    m.finish()
    build_creeps_scourge()


def build_creeps_scourge():
    """☠️ Scourge vojnici (kao u DotA: Dire izgleda drukčije od Radianta) — slatki, ne strašni:
    kostur-vitez s rogatom kacigom, tamni čarobnjak s lubanjom na štapu, koštana opsadna kola"""
    IRON, IRON2, DARKW = '#4a4352', '#5b5466', '#2e2a36'
    # --- pješak: kostur-vitez
    m = Model('creep_melee_d')
    for side, nm in ((1, 'legL'), (-1, 'legR')):
        lg = m.part(nm, (0, side * 0.12, 0.34))
        lg.cyl((0, side * 0.12, 0.36), (0, side * 0.12, 0.1), 0.05, 0.045, BONE2, seg=8)   # koštane noge
        lg.sphere((0, side * 0.12, 0.23), 0.06, BONE, seg=(8, 6))                         # koljeno
        lg.sphere((0.04, side * 0.12, 0.06), (0.11, 0.075, 0.065), IRON)
    b = m.part('body', (0, 0, 0.36))
    b.cyl((0, 0, 0.34), (0, 0, 0.78), 0.25, 0.21, IRON, seg=12)                           # tamni oklop
    b.cyl((0, 0, 0.6), (0, 0, 0.7), 0.235, 0.225, '#ffffff', mat='team', seg=12)         # traka tima
    for k in range(3):                                                                     # rebra ispod oklopa
        b.box((0.2, 0, 0.4 + k * 0.05), (0.04, 0.22, 0.025), BONE, bevel=0.005)
    b.sphere((0.06, 0, 0.66), (0.17, 0.19, 0.15), IRON2, seg=(12, 7))
    h = m.part('head', (0, 0, 0.8), 'body')
    h.sphere((0, 0, 1.0), (0.25, 0.26, 0.25), BONE, seg=(14, 10))                         # lubanja
    h.sphere((0.12, 0, 0.88), (0.13, 0.16, 0.08), BONE2, seg=(10, 6))                     # čeljust
    for s in (1, -1):
        h.sphere((0.21, s * 0.09, 1.0), (0.05, 0.065, 0.07), '#1a0f24', seg=(10, 7))      # očne duplje
        h.sphere((0.24, s * 0.09, 1.0), (0.025, 0.03, 0.035), VOID, mat='glow', seg=(8, 6))   # ljubičasti sjaj
        for k in range(2):
            h.box((0.22, s * (0.035 + k * 0.05), 0.86), (0.03, 0.03, 0.04), '#f8f4ea', bevel=0.004)   # zubići
    h.sphere((-0.02, 0, 1.1), (0.28, 0.29, 0.2), IRON, seg=(14, 8))                       # kaciga
    for s in (1, -1):                                                                      # koštani rogovi
        h.cyl((-0.02, s * 0.2, 1.18), (-0.1, s * 0.36, 1.42), 0.05, 0.0, BONE, seg=8)
    h.box((0.2, 0, 1.14), (0.05, 0.3, 0.05), IRON2, bevel=0.01)
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        a = m.part(nm, (0, side * 0.24, 0.7), 'body')
        a.cyl((0, side * 0.25, 0.72), (0.02, side * 0.29, 0.5), 0.045, 0.04, BONE2, seg=8)
        a.sphere((0.03, side * 0.3, 0.46), 0.06, BONE)
        a.sphere((0.0, side * 0.26, 0.74), (0.09, 0.08, 0.06), IRON2, seg=(10, 7))          # naramenica
        bone_spike(a, (0.0, side * 0.28, 0.78), (0, side * 0.5, 1.0), 0.16, 0.035, 0.0)
    R, L = m['armR'], m['armL']
    hR = Vector((0.03, -0.3, 0.46))
    d = Vector((0.94, 0, 0.34))
    R.box(hR + d * 0.3, (0.44, 0.07, 0.02), '#a9a2b4', rot=(90, -20, 0), bevel=0.006)     # tamni mač
    for k in range(3):                                                                     # nazubljena oštrica
        R.cyl(hR + d * (0.2 + k * 0.12) + Vector((0, 0, 0.03)), hR + d * (0.24 + k * 0.12) + Vector((0, 0, 0.09)), 0.02, 0.0, '#a9a2b4', seg=4)
    R.box(hR + d * 0.06, (0.05, 0.18, 0.035), BONE2, rot=(0, -20, 0))
    R.sphere(hR + d * 0.06 + Vector((0.01, 0, 0)), 0.02, VOID, mat='glow', seg=(6, 4))
    n = Vector((0.55, 0.83, 0)).normalized()
    cc = Vector((0.1, 0.36, 0.5))
    L.cyl(cc - n * 0.025, cc + n * 0.025, 0.18, 0.18, DARKW, seg=12)                      # štit
    L.cyl(cc + n * 0.02, cc + n * 0.04, 0.15, 0.15, '#ffffff', mat='team', seg=12)
    skull(L, tuple(cc + n * 0.07), 0.55, face=tuple(n))
    biped_anims(m, kind='melee', tail=False)
    m.finish()

    # --- strijelac: tamni čarobnjak s kapuljačom i lubanjom na štapu
    m = Model('creep_ranged_d')
    b = m.part('body', (0, 0, 0.3))
    for side, nm in ((1, 'legL'), (-1, 'legR')):
        lg = m.part(nm, (0, side * 0.11, 0.3))
        lg.sphere((0.04, side * 0.11, 0.06), (0.1, 0.07, 0.06), DARKW)
        lg.cyl((0, side * 0.11, 0.3), (0, side * 0.11, 0.08), 0.05, 0.045, BONE2, seg=8)
    b.cyl((0, 0, 0.12), (0, 0, 0.78), 0.3, 0.16, DSTONE[0], seg=12)                       # tamna haljina
    b.cyl((0, 0, 0.12), (0, 0, 0.2), 0.305, 0.285, '#ffffff', mat='team', seg=12, caps=False)   # rub u boji tima
    b.cyl((0, 0, 0.5), (0, 0, 0.55), 0.22, 0.21, VOID, mat='glow', seg=12, caps=False)    # svjetleći pojas
    h = m.part('head', (0, 0, 0.78), 'body')
    h.sphere((0, 0, 0.98), (0.25, 0.26, 0.25), DSTONE[1], seg=(14, 10))                   # kapuljača
    h.cyl((0, 0, 1.12), (-0.16, 0, 1.5), 0.2, 0.0, DSTONE[1], seg=12)                     # šiljati vrh kapuljače
    h.sphere((0.1, 0, 0.96), (0.17, 0.19, 0.18), '#120a1a', seg=(12, 8))                  # tama ispod kapuljače
    for s in (1, -1):
        h.sphere((0.24, s * 0.07, 0.98), (0.03, 0.04, 0.035), '#c084fc', mat='glow', seg=(8, 6))   # oči
    h.cyl((0.02, 0, 1.08), (0.02, 0, 1.12), 0.27, 0.26, '#ffffff', mat='team', seg=14, caps=False)
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        a = m.part(nm, (0, side * 0.2, 0.66), 'body')
        a.cyl((0, side * 0.21, 0.68), (0.03, side * 0.26, 0.46), 0.06, 0.07, DSTONE[0], seg=8)
        a.sphere((0.04, side * 0.27, 0.42), 0.05, BONE)
    R = m['armR']
    hR = Vector((0.04, -0.27, 0.42))
    R.cyl(hR - Vector((0, 0, 0.3)), hR + Vector((0, 0, 0.5)), 0.022, 0.026, '#3b2f2f', seg=6)
    skull(R, tuple(hR + Vector((0.02, 0, 0.56))), 0.45)
    R.sphere(hR + Vector((0, 0, 0.7)), 0.07, '#ffffff', mat='teamglow')
    for k in range(3):
        a = RAD(k * 120)
        R.cyl(hR + Vector((0, 0, 0.6)), hR + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.76)), 0.012, 0.004, BONE, seg=4)
    biped_anims(m, kind='mage', tail=False)
    m.finish()

    # --- opsadna kola: tamna drvena kola s koštanim šiljcima i lubanjom na ovnu
    m = Model('creep_siege_d')
    base = m.part('body', (0, 0, 0.3))
    base.box((0, 0, 0.36), (1.2, 0.62, 0.14), '#3b2f2f', bevel=0.02)
    base.box((-0.05, 0, 0.62), (0.9, 0.56, 0.4), '#4a3a3a', bevel=0.03)
    base.cyl((-0.5, 0, 0.82), (0.45, 0, 0.82), 0.32, 0.32, '#ffffff', mat='team', seg=4)   # krov u boji tima
    base.box((-0.05, 0, 1.06), (0.98, 0.06, 0.06), '#2e2a36')
    for y in (0.3, -0.3):
        base.box((-0.05, y, 0.62), (0.92, 0.03, 0.08), '#2e2a36')
        for k in range(3):   # koštani šiljci uz bokove
            bone_spike(base, (-0.4 + k * 0.35, y * 1.05, 0.5), (0.2, y * 2.0, 0.6), 0.22, 0.035, 0.1)
    base.cyl((-0.45, 0, 1.06), (-0.45, 0, 1.5), 0.02, 0.02, BONE2, seg=6)
    base.poly([(-0.45, 0.01, 1.5), (-0.45, 0.01, 1.28), (-0.3, 0.01, 1.33), (-0.2, 0.01, 1.3), (-0.12, 0.01, 1.42)], '#ffffff', mat='team')
    ram = m.part('ram', (0.1, 0, 0.6), 'body')
    ram.cyl((-0.4, 0, 0.6), (0.82, 0, 0.6), 0.09, 0.09, '#3b2f2f', seg=10, smooth=True)
    skull(ram, (0.86, 0, 0.62), 1.15)
    for s in (1, -1):
        ram.cyl((0.84, s * 0.1, 0.7), (0.76, s * 0.24, 0.84), 0.045, 0.0, BONE, seg=6)
    for i, (x, y) in enumerate(((0.38, 0.34), (0.38, -0.34), (-0.38, 0.34), (-0.38, -0.34))):
        w = m.part('wheel%d' % i, (x, y, 0.22))
        w.cyl((x, y - 0.05, 0.22), (x, y + 0.05, 0.22), 0.22, 0.22, '#2e2a36', seg=12)
        w.cyl((x, y - 0.06, 0.22), (x, y + 0.06, 0.22), 0.06, 0.06, BONE2, seg=8)
        w.box((x, y + 0.055 * (1 if y > 0 else -1), 0.22), (0.4, 0.02, 0.04), '#1a0f24')
        w.box((x, y + 0.055 * (1 if y > 0 else -1), 0.22), (0.04, 0.02, 0.4), '#1a0f24')
    Z = (0, 0, 0)
    wheels = ['wheel%d' % i for i in range(4)]
    m.anim('idle', 48, {'body': [(0, Z, Z), (24, Z, (0, 0, -0.01)), (48, Z, Z)],
                        'ram': [(0, Z, Z), (24, Z, (-0.02, 0, 0)), (48, Z, Z)]})
    m.anim('walk', 20, {**{w: [(0, Z), (20, (0, 360, 0))] for w in wheels},
                        'body': [(0, (2, 0, 0), Z), (10, (-2, 0, 0), (0, 0, 0.015)), (20, (2, 0, 0), Z)]},
           linear=wheels)
    m.anim('attack', 14, {'ram': [(0, Z, Z), (4, Z, (-0.27, 0, 0)), (5, Z, (-0.28, 0, 0)), (7, Z, (0.3, 0, 0)), (9, Z, (0.24, 0, 0)), (14, Z, Z)],
                          'body': [(0, Z, Z), (4, (0, -2, 0), (-0.02, 0, 0)), (7, (0, 3, 0), (0.05, 0, 0)), (14, Z, Z)]})
    m.finish()


# ------------------------------------------------------------------ ČETVERONOŠCI (džungla)
def quad(name, c, o):
    m = Model(name)
    fur, belly = c['fur'], c.get('belly', c['fur'])
    dark = c.get('dark', mix(fur, '#000000', 0.4))
    L = o.get('len', 1.0)        # dužina tijela
    H = o.get('legH', 0.32)      # visina nogu
    W = o.get('wid', 0.32)
    bz = H + o.get('bodyR', 0.3) * 0.8
    for nm, x, y in (('legFL', 0.32 * L, W * 0.62), ('legFR', 0.32 * L, -W * 0.62),
                     ('legBL', -0.32 * L, W * 0.62), ('legBR', -0.32 * L, -W * 0.62)):
        lg = m.part(nm, (x, y, H + 0.05))
        lg.cyl((x, y, H + 0.08), (x + 0.02, y, 0.06), o.get('legR', 0.08), o.get('legR', 0.08) * 0.8, fur, seg=8, smooth=True)
        lg.sphere((x + 0.04, y, 0.05), (o.get('legR', 0.08) * 1.25, o.get('legR', 0.08), 0.055), c.get('paw', dark))
    b = m.part('body', (0, 0, bz))
    br = o.get('bodyR', 0.3)
    b.sphere((0, 0, bz), (0.5 * L, W, br), fur, seg=(20, 14))
    b.sphere((0.05, 0, bz - br * 0.35), (0.42 * L, W * 0.8, br * 0.6), belly, seg=(16, 10))
    if o.get('bristle'):
        for i in range(6):
            x = 0.3 * L - i * 0.12 * L
            b.cyl((x, 0, bz + br * 0.8), (x - 0.06, 0, bz + br * 1.25), 0.07, 0.0, dark, seg=4)
    if o.get('spikes'):
        for i in range(7):
            x = 0.4 * L - i * 0.13 * L
            b.cyl((x, 0, bz + br * 0.85), (x - 0.04, 0, bz + br * 1.35), 0.09, 0.0, o['spikes'], seg=4)
    if o.get('hump'):
        b.sphere((0.22 * L, 0, bz + br * 0.55), (0.3 * L, W * 0.85, br * 0.6), fur)
    if o.get('wings'):
        ws = o.get('wingScale', 1.0)
        for side, nm in ((1, 'wingL'), (-1, 'wingR')):
            w = m.part(nm, (0.1 * L, side * W * 0.6, bz + br * 0.7), 'body')
            p0 = (0.1 * L, side * W * 0.6, bz + br * 0.7)
            P = lambda p: tuple(p0[i] + (p[i] - p0[i]) * ws for i in range(3))
            p1 = P((-0.05 * L, side * (W + 0.7), bz + br * 0.7 + 0.55))
            p2 = P((-0.35 * L, side * (W + 1.0), bz + br * 0.7 + 0.15))
            p3 = P((-0.4 * L, side * (W + 0.55), bz + br * 0.7 - 0.12))
            p4 = P((-0.25 * L, side * (W * 0.7), bz + br * 0.6))
            w.cyl(p0, p1, 0.05, 0.03, dark, seg=6)
            w.cyl(p1, p2, 0.03, 0.015, dark, seg=6)
            w.poly([p0, p1, p2, p3, p4], o['wings'], thick=0.015)
    # glava
    hx = 0.5 * L
    hz = bz + o.get('neckUp', 0.12)
    h = m.part('head', (hx - 0.05, 0, hz), 'body')
    if o.get('neck'):
        h.cyl((hx - 0.15, 0, bz), (hx + 0.2, 0, hz + 0.35), 0.17, 0.13, fur, seg=10, smooth=True)
        hx += 0.28
        hz += 0.38
    hr = o.get('headR', 0.22)
    h.sphere((hx + 0.08, 0, hz + 0.04), (hr * 1.05, hr, hr * 0.95), fur, seg=(18, 12))
    sn = o.get('snout', 'pig')
    if sn == 'pig':
        h.cyl((hx + 0.18, 0, hz - 0.02), (hx + 0.38, 0, hz - 0.03), hr * 0.55, hr * 0.5, c.get('snoutC', '#e9a3a0'), seg=10)
        for s in (1, -1):
            h.sphere((hx + 0.385, s * 0.04, hz - 0.03), 0.025, '#5a2a2a')
            h.cyl((hx + 0.3, s * 0.09, hz - 0.1), (hx + 0.4, s * 0.12, hz + 0.08), 0.03, 0.0, '#fffaf0', seg=6)
    elif sn == 'wolf':
        h.cyl((hx + 0.12, 0, hz - 0.02), (hx + 0.44, 0, hz - 0.05), hr * 0.55, hr * 0.32, c.get('snoutC', belly), seg=10, smooth=True)
        h.sphere((hx + 0.44, 0, hz - 0.02), 0.045, '#1a1a1a')
    elif sn == 'bear':
        h.sphere((hx + 0.26, 0, hz - 0.04), (hr * 0.55, hr * 0.5, hr * 0.42), c.get('snoutC', belly))
        h.sphere((hx + 0.37, 0, hz + 0.0), 0.05, '#1a1a1a')
    elif sn == 'dragon':
        h.sphere((hx + 0.3, 0, hz - 0.02), (hr * 0.85, hr * 0.62, hr * 0.5), fur)
        h.sphere((hx + 0.32, 0, hz - 0.1), (hr * 0.75, hr * 0.55, hr * 0.25), belly)
        for s in (1, -1):
            h.cyl((hx + 0.18, s * 0.05, hz - 0.15), (hx + 0.2, s * 0.05, hz - 0.24), 0.03, 0.0, '#ffffff', seg=4)
            h.cyl((hx + 0.32, s * 0.06, hz - 0.13), (hx + 0.34, s * 0.06, hz - 0.21), 0.025, 0.0, '#ffffff', seg=4)
    ec = o.get('eyeColor', '#141414')
    emat = 'glow' if o.get('glowEyes') else 'vc'
    for s in (1, -1):
        h.sphere((hx + hr * 0.75, s * hr * 0.55, hz + hr * 0.3), (0.035, 0.045, 0.05), ec, mat=emat, seg=(8, 6))
        if not o.get('glowEyes'):
            h.sphere((hx + hr * 0.85, s * hr * 0.52, hz + hr * 0.38), 0.014, '#ffffff', seg=(5, 4))
        h.box((hx + hr * 0.8, s * hr * 0.55, hz + hr * 0.6), (0.03, 0.1, 0.025), dark, rot=(s * -18, 0, 0))
    if o.get('fangs'):
        for s in (1, -1):
            h.cyl((hx + 0.38, s * 0.05, hz - 0.08), (hx + 0.39, s * 0.055, hz - 0.15), 0.02, 0.0, '#ffffff', seg=4)
    if o.get('ruff'):
        h.sphere((hx - 0.12, 0, hz - 0.02), (hr * 0.9, hr * 1.3, hr * 1.15), mix(fur, '#ffffff', 0.18), seg=(12, 8))
    if sn in ('bear', 'pig'):
        h.arc((hx + (0.3 if sn == 'bear' else 0.27), 0, hz - (0.13 if sn == 'bear' else 0.11)), 0.05, 205, 335, 6, 0.01,
              '#5a2a2a', plane='yz', seg=4)
    if o.get('claws'):
        lr = o.get('legR', 0.08)
        for nm2 in ('legFL', 'legFR', 'legBL', 'legBR'):
            lg = m[nm2]
            px, py = lg.pivot.x, lg.pivot.y
            for k in (-1, 0, 1):
                lg.cyl((px + 0.04 + lr * 1.0, py + k * lr * 0.5, 0.05), (px + 0.04 + lr * 1.6, py + k * lr * 0.55, 0.03),
                       0.022, 0.0, '#f5f5f4', seg=4)
    if o.get('bellyPlates'):
        for i in range(5):
            b.box((0.33 * L - i * 0.16 * L, 0, bz - br * 0.78), (0.1 * L, W * 0.75, 0.05), mix(belly, '#000000', 0.12), bevel=0.01)
    ears = o.get('ears', 'round')
    for s in (1, -1):
        if ears == 'round':
            h.sphere((hx, s * hr * 0.7, hz + hr * 0.8), (0.05, 0.08, 0.08), fur)
            h.sphere((hx + 0.02, s * hr * 0.7, hz + hr * 0.8), (0.025, 0.05, 0.05), '#e9a3a0')
        elif ears == 'pointy':
            h.cyl((hx - 0.02, s * hr * 0.5, hz + hr * 0.6), (hx - 0.06, s * hr * 0.7, hz + hr * 1.5), 0.08, 0.0, fur, seg=4)
        elif ears == 'floppy':
            h.sphere((hx - 0.02, s * hr * 0.9, hz + hr * 0.4), (0.06, 0.1, 0.05), dark, rot=(s * 40, 0, 0))
        elif ears == 'horns':
            h.cyl((hx - 0.05, s * hr * 0.45, hz + hr * 0.7), (hx - 0.3, s * hr * 0.75, hz + hr * 1.6), 0.07, 0.0, o.get('hornC', '#fff1c9'), seg=8)
    if o.get('extra'):   # ukrasi po vrsti (npr. plamen, peraje, munje, lišće zmajčića)
        o['extra'](m, dict(L=L, W=W, H=H, bz=bz, br=br, hx=hx, hz=hz, hr=hr, fur=fur, belly=belly, dark=dark))
    # rep
    t = m.part('tail', (-0.48 * L, 0, bz + 0.05), 'body')
    tk = o.get('tail', 'thin')
    if tk == 'thin':
        t.cyl((-0.48 * L, 0, bz + 0.05), (-0.66 * L, 0, bz + 0.12), 0.03, 0.02, fur, seg=6)
        t.sphere((-0.68 * L, 0, bz + 0.13), 0.04, dark)
    elif tk == 'bushy':
        t.sphere((-0.68 * L, 0, bz + 0.06), (0.24, 0.1, 0.1), fur, rot=(0, 20, 0))
        t.sphere((-0.86 * L, 0, bz - 0.0), (0.09, 0.08, 0.08), c.get('tip', belly))
    elif tk == 'stub':
        t.sphere((-0.52 * L, 0, bz + 0.08), 0.08, fur)
    elif tk == 'dragon':
        pts = [(-0.45 * L, 0, bz), (-0.75 * L, 0, bz - 0.08), (-1.05 * L, 0, bz - 0.05), (-1.3 * L, 0, bz + 0.1)]
        rr = [0.16, 0.11, 0.07, 0.04]
        for i in range(3):
            t.cyl(pts[i], pts[i + 1], rr[i], rr[i + 1], fur, seg=10, smooth=True)
        t.cyl(pts[-1], (-1.45 * L, 0, bz + 0.18), 0.12, 0.0, o.get('spikes', dark), seg=4)
    quad_anims(m, heavy=o.get('heavy', 1.0), wings=bool(o.get('wings')), bz=bz, W=W, H=H, lr=o.get('legR', 0.08))
    return m.finish()


def build_neutrals():
    quad('mob_boars', dict(fur='#8b5a3c', belly='#b98a63', dark='#4a2c18', snoutC='#e9a3a0'),
         dict(len=1.1, legH=0.22, wid=0.3, bodyR=0.28, snout='pig', ears='pointy', tail='thin', bristle=True,
              headR=0.22, legR=0.07))
    def lizard_crest(m, g):   # 🦎 v0.56: šarena krijesta na leđima i podbradak
        b, h = m['body'], m['head']
        for i in range(6):
            x = 0.34 * g['L'] - i * 0.13 * g['L']
            b.cyl((x, 0, g['bz'] + g['br'] * 0.8), (x - 0.04, 0, g['bz'] + g['br'] * 0.8 + 0.12 - abs(i - 2) * 0.015),
                  0.05, 0.0, '#f97316' if i % 2 else '#facc15', seg=4)
        h.sphere((g['hx'] + 0.12, 0, g['hz'] - g['hr'] * 0.75), (g['hr'] * 0.55, g['hr'] * 0.45, g['hr'] * 0.3), '#fb923c')
    quad('mob_lizard', dict(fur='#4d9a3a', belly='#d9f99d', dark='#1f4d1a', paw='#2f5f22'),
         dict(len=1.2, legH=0.12, wid=0.3, bodyR=0.19, snout='dragon', ears='none', tail='dragon',
              headR=0.19, legR=0.06, eyeColor='#fde047', claws=True, extra=lizard_crest))
    quad('mob_wolves', dict(fur='#6b7280', belly='#c5cad3', dark='#374151', tip='#e5e7eb'),
         dict(len=1.25, legH=0.34, wid=0.26, bodyR=0.25, snout='wolf', ears='pointy', tail='bushy',
              headR=0.2, legR=0.065, eyeColor='#f6c945', glowEyes=False, fangs=True, ruff=True))
    quad('mob_bear', dict(fur='#7b4a2a', belly='#a8774f', dark='#3d2414', snoutC='#d6b48c'),
         dict(len=1.25, legH=0.32, wid=0.42, bodyR=0.4, snout='bear', ears='round', tail='stub', hump=True,
              headR=0.27, legR=0.12, heavy=1.6, claws=True))
    quad('mob_boss', dict(fur='#5b8c3a', belly='#e9d27a', dark='#2f4f1f', paw='#2f4f1f'),
         dict(len=1.5, legH=0.42, wid=0.45, bodyR=0.42, snout='dragon', ears='horns', hornC='#fff1c9',
              tail='dragon', spikes='#c2410c', wings='#6b9e34', wingScale=1.3, neck=True, neckUp=0.2, headR=0.26,
              legR=0.12, glowEyes=True, eyeColor='#fde047', heavy=2.0, bellyPlates=True))
    build_drakes()

    def flame_mane(m, g):   # 🔥 plamena griva i leđa (svijetli), žar na repu
        b, h = m['body'], m['head']
        for i in range(5):
            x = 0.32 * g['L'] - i * 0.15 * g['L']
            hgt = 0.26 - i * 0.03
            b.cyl((x, 0, g['bz'] + g['br'] * 0.8), (x - 0.07, 0, g['bz'] + g['br'] * 0.8 + hgt), 0.08, 0.0, '#f97316', mat='glow', seg=6)
            b.cyl((x + 0.01, 0, g['bz'] + g['br'] * 0.8), (x - 0.04, 0, g['bz'] + g['br'] * 0.8 + hgt * 0.6), 0.05, 0.0, '#fde047', mat='glow', seg=6)
        for s in (1, -1):
            h.cyl((g['hx'] - 0.08, s * g['hr'] * 0.5, g['hz'] + 0.05), (g['hx'] - 0.26, s * g['hr'] * 0.9, g['hz'] + 0.2), 0.07, 0.0, '#fb923c', mat='glow', seg=6)
    quad('mob_redwolf', dict(fur='#9a3412', belly='#fdba74', dark='#431407', tip='#fde047', paw='#2a0d05'),
         dict(len=1.3, legH=0.36, wid=0.28, bodyR=0.27, snout='wolf', ears='pointy', tail='bushy',
              headR=0.22, legR=0.07, eyeColor='#fde047', glowEyes=True, fangs=True, ruff=True, claws=True, extra=flame_mane))


def build_drakes():
    """🐉 zmajčići četiri elementa (kao u League of Legends): manji od Velikog Zmaja, kraća krila,
    svaki sa svojim bojama i ukrasima — vatreni plamen na leđima, vodeni peraje i mjehuriće,
    olujni krijestu od munja, šumski lišće i mahovinu"""
    common = dict(len=1.2, legH=0.36, wid=0.36, bodyR=0.34, snout='dragon', ears='horns', tail='dragon',
                  neck=True, neckUp=0.16, headR=0.24, legR=0.1, glowEyes=True, heavy=1.6, bellyPlates=True,
                  wingScale=0.8, claws=True)

    def spine(g, n=5):
        """točke uzduž leđa (od vrata prema repu)"""
        return [(0.36 * g['L'] - i * 0.17 * g['L'], 0, g['bz'] + g['br'] * 0.9) for i in range(n)]

    def fire(m, g):
        b, t = m['body'], m['head']
        for i, (x, y, z) in enumerate(spine(g)):
            hgt = 0.36 - abs(i - 1.5) * 0.05
            b.cyl((x, 0, z - 0.02), (x - 0.08, 0, z + hgt), 0.11, 0.0, '#f97316', mat='glow', seg=6)   # plamen
            b.cyl((x + 0.01, 0, z), (x - 0.05, 0, z + hgt * 0.62), 0.065, 0.0, '#fde047', mat='glow', seg=6)
        for s in (1, -1):   # žar na obrazima
            t.sphere((g['hx'] + 0.2, s * g['hr'] * 0.7, g['hz'] - 0.02), 0.045, '#fb923c', mat='glow', seg=(8, 6))

    def water(m, g):
        b, t = m['body'], m['head']
        pts = spine(g, 6)
        prof = [0.12, 0.26, 0.32, 0.28, 0.2, 0.1]
        fin = [(x, 0, z - 0.04) for x, _, z in pts] + [(x - 0.05, 0, z + h) for (x, _, z), h in reversed(list(zip(pts, prof)))]
        b.poly(fin, '#67e8f9', thick=0.02)   # leđna peraja
        for s in (1, -1):   # peraje umjesto ušiju i mjehurići na bokovima
            t.poly([(g['hx'] - 0.02, s * g['hr'] * 0.6, g['hz'] + 0.08), (g['hx'] - 0.28, s * g['hr'] * 1.5, g['hz'] + 0.22),
                    (g['hx'] - 0.2, s * g['hr'] * 1.2, g['hz'] - 0.05)], '#22d3ee', thick=0.015)
            for k in range(3):
                b.sphere((0.15 - k * 0.2, s * (g['W'] + 0.02), g['bz'] + 0.05 + (k % 2) * 0.08), 0.04 + 0.01 * (k % 2), '#cffafe', mat='glow', seg=(8, 6))

    def storm(m, g):
        b, t = m['body'], m['head']
        for i, (x, y, z) in enumerate(spine(g)):   # krijesta od munja (cik-cak)
            h = 0.3 - abs(i - 1.5) * 0.04
            b.poly([(x + 0.06, 0, z - 0.02), (x - 0.02, 0, z + h * 0.55), (x + 0.05, 0, z + h * 0.5), (x - 0.06, 0, z + h),
                    (x - 0.02, 0, z + h * 0.42), (x - 0.08, 0, z + h * 0.46), (x - 0.04, 0, z - 0.02)], '#fde047', mat='glow', thick=0.02)
        for s in (1, -1):   # svjetleći vrhovi rogova
            t.sphere((g['hx'] - 0.3, s * g['hr'] * 0.75, g['hz'] + g['hr'] * 1.62), 0.05, '#fef08a', mat='glow', seg=(8, 6))

    def forest(m, g):
        b, t = m['body'], m['head']
        leaf = ['#65a30d', '#4d7c0f', '#84cc16']
        for i, (x, y, z) in enumerate(spine(g)):   # grmići lišća i cvjetovi na leđima
            b.ico((x, 0, z + 0.04), (0.16, 0.14, 0.11), leaf[i % 3], sub=1, jitter=0.2, seed=40 + i)
            if i % 2 == 0:
                b.sphere((x + 0.03, 0.06, z + 0.13), 0.035, '#fde68a', seg=(8, 6))
        for s in (1, -1):   # mahovina na bokovima
            b.ico((0.0, s * g['W'] * 0.8, g['bz'] + 0.12), (0.2, 0.08, 0.1), '#3f6212', sub=1, jitter=0.25, seed=60 + s)
        t.ico((g['hx'] - 0.02, 0, g['hz'] + g['hr'] * 0.95), (0.09, 0.08, 0.06), '#84cc16', sub=1, jitter=0.2, seed=71)

    quad('mob_drake_fire', dict(fur='#c2410c', belly='#fcd34d', dark='#7c2d12', paw='#431407'),
         dict(common, wings='#f97316', hornC='#fde68a', eyeColor='#fef08a', extra=fire))
    quad('mob_drake_water', dict(fur='#0369a1', belly='#7dd3fc', dark='#0c4a6e', paw='#082f49'),
         dict(common, wings='#22d3ee', hornC='#e0f2fe', eyeColor='#e0f2fe', extra=water))
    quad('mob_drake_storm', dict(fur='#6d28d9', belly='#ddd6fe', dark='#2e1065', paw='#1e1b4b'),
         dict(common, wings='#a78bfa', hornC='#4c1d95', eyeColor='#fde047', extra=storm))
    quad('mob_drake_forest', dict(fur='#4d7c0f', belly='#d9f99d', dark='#365314', paw='#3f2a14'),
         dict(common, wings='#65a30d', hornC='#a16207', eyeColor='#bef264', extra=forest))


# ------------------------------------------------------------------ GRAĐEVINE
# prozori kule: strana -Y u Blenderu gleda prema kameri u igri (three.js +Z)
WINDOWS = {3: (-25, -90, -155), 5: (-90,)}


TOWER_CRYSTAL_Z = 3.75   # scene3d.js: TOWER_CRYSTAL_Z (sjaj, pucanj, krhotine)


def build_tower():
    global METAL_SET
    METAL_SET = BLDG_METAL   # zlatni ukrasi građevina sjaje
    try:
        _build_tower()
    finally:
        METAL_SET = set()


def _build_tower():
    m = Model('tower')
    b = m.part('base', (0, 0, 0))
    # topli kamen s više kontrasta (svijetli kamen se pod suncem i sjajem "ispere" u bijelo)
    stones = ['#8f7f63', '#7f6f55', '#9c8c6f']
    mort = '#5e5444'
    # stepenasto osmerokutno postolje + četiri kamena potpornja
    b.cyl((0, 0, 0), (0, 0, 0.16), 1.22, 1.18, '#554c40', seg=8)
    b.cyl((0, 0, 0.16), (0, 0, 0.32), 1.04, 0.98, '#665c4e', seg=8)
    for k in range(4):
        a = k * 90 + 45
        ca, sa = math.cos(RAD(a)), math.sin(RAD(a))
        b.box((ca * 0.84, sa * 0.84, 0.72), (0.3, 0.26, 0.86), '#716552', rot=(0, 0, a), bevel=0.04)
        b.cyl((ca * 0.9, sa * 0.9, 1.12), (ca * 0.78, sa * 0.78, 1.42), 0.15, 0.05, mort, seg=4)
    for i in range(6):
        z0 = 0.3 + i * 0.42
        r0 = 0.8 - i * 0.035
        b.cyl((0, 0, z0), (0, 0, z0 + 0.4), r0, r0 - 0.03, stones[i % 3], seg=10)
        b.cyl((0, 0, z0 + 0.38), (0, 0, z0 + 0.44), r0 + 0.02, r0 + 0.01, mort, seg=10)
        # istaknute cigle (svaki red pomaknut za pola cigle)
        for k in range(8):
            deg = k * 45 + (22.5 if i % 2 else 0)
            if i == 0 and abs(((deg + 180) % 360) - 180) < 35:
                continue   # ovdje su vrata
            if i in (3, 5) and any(abs(((deg - a + 180) % 360) - 180) < 32 for a in WINDOWS[i]):
                continue   # ovdje su prozori
            b.box((math.cos(RAD(deg)) * r0, math.sin(RAD(deg)) * r0, z0 + 0.2), (0.07, 0.16, 0.12),
                  mix(stones[(i + k) % 3], '#000000', 0.06 if k % 2 else 0.0), rot=(0, 0, deg), bevel=0.01)
    # vrata i prozori (prozori svijetle — noću izgledaju upaljeno)
    b.box((0.72, 0, 0.55), (0.12, 0.34, 0.5), '#5b3a1e', bevel=0.03)
    b.cyl((0.75, 0, 0.8), (0.79, 0, 0.8), 0.17, 0.17, '#5b3a1e', seg=10)
    for i, zz, rr in ((3, 1.76, 0.69), (5, 2.6, 0.62)):
        for a in WINDOWS[i]:
            x, y = math.cos(RAD(a)) * rr, math.sin(RAD(a)) * rr
            b.box((x * 0.97, y * 0.97, zz), (0.08, 0.24, 0.42), '#4a3a2a', rot=(0, 0, a), bevel=0.02)
            b.box((x * 1.04, y * 1.04, zz), (0.06, 0.17, 0.34), '#ffd166', mat='glow', rot=(0, 0, a))
            b.box((x * 1.06, y * 1.06, zz), (0.04, 0.17, 0.03), '#6b4a2a', rot=(0, 0, a))   # prečka
    # trak u boji tima
    b.cyl((0, 0, 1.95), (0, 0, 2.15), 0.73, 0.73, '#ffffff', mat='team', seg=10)
    # dvije duge zastave tima sprijeda (vise s platforme, zlatna prečka gore)
    for a in (-58, -122):
        ca, sa = math.cos(RAD(a)), math.sin(RAD(a))
        px, py, tx, ty = ca * 0.76, sa * 0.76, -sa, ca
        b.poly([(px + tx * 0.15, py + ty * 0.15, 2.74), (px - tx * 0.15, py - ty * 0.15, 2.74), (px - tx * 0.15, py - ty * 0.15, 1.62),
                (px, py, 1.48), (px + tx * 0.15, py + ty * 0.15, 1.62)], '#ffffff', mat='team', thick=0.014)
        b.cyl((px - tx * 0.19, py - ty * 0.19, 2.76), (px + tx * 0.19, py + ty * 0.19, 2.76), 0.025, 0.025, '#e9bf62', seg=6)
        b.sphere((px, py, 2.25), (0.05, 0.05, 0.06), '#f6d77a', seg=(8, 6))   # zlatni znak na zastavi
    # platforma na konzolama + zupci
    for i in range(12):
        a = RAD(i * 30 + 15)
        b.box((math.cos(a) * 0.8, math.sin(a) * 0.8, 2.7), (0.14, 0.12, 0.2), mort, rot=(0, 0, i * 30 + 15), bevel=0.02)
    b.cyl((0, 0, 2.8), (0, 0, 3.0), 0.98, 0.98, '#716552', seg=12)
    for i in range(10):
        a = RAD(i * 36)
        b.box((math.cos(a) * 0.88, math.sin(a) * 0.88, 3.12), (0.22, 0.2, 0.26), stones[i % 3], rot=(0, 0, i * 36), bevel=0.02)
    # kruna umjesto krova: postolje, prsten tima i četiri zlatna luka koja drže lebdeći kristal
    b.cyl((0, 0, 3.0), (0, 0, 3.2), 0.5, 0.42, mort, seg=10)
    b.cyl((0, 0, 3.18), (0, 0, 3.25), 0.45, 0.45, '#ffffff', mat='team', seg=10)
    for k in range(4):
        a = RAD(k * 90 + 45)
        ca, sa = math.cos(a), math.sin(a)
        p0, p1, p2 = (ca * 0.36, sa * 0.36, 3.2), (ca * 0.56, sa * 0.56, 3.72), (ca * 0.3, sa * 0.3, 4.22)
        b.cyl(p0, p1, 0.06, 0.05, '#d9a73e', seg=6)
        b.cyl(p1, p2, 0.05, 0.015, '#e9bf62', seg=6)
        b.sphere(p1, 0.065, '#fde68a', seg=(8, 6))
    # zastava na koplju (stražnji kut, ne zaklanja kristal)
    b.cyl((-0.64, 0.64, 3.0), (-0.64, 0.64, 4.62), 0.03, 0.025, '#5b3a1e', seg=6)
    b.sphere((-0.64, 0.64, 4.64), 0.05, '#e9bf62', seg=(8, 6))
    fl = m.part('flag', (-0.64, 0.64, 4.48), 'base')   # zastava se vijori (zaseban dio)
    fl.poly([(-0.64, 0.65, 4.6), (-0.64, 0.65, 4.3), (-0.4, 0.65, 4.42), (-0.16, 0.65, 4.5)], '#ffffff', mat='team', thick=0.012)
    # kristal (vrti se i lebdi u igri)
    Z = TOWER_CRYSTAL_Z
    cr = m.part('crystal', (0, 0, Z))
    cr.ico((0, 0, Z), (0.3, 0.3, 0.48), '#ffffff', mat='teamglow', sub=0)
    for k in range(3):   # mali kristali koji kruže
        a = RAD(k * 120)
        cr.ico((math.cos(a) * 0.5, math.sin(a) * 0.5, Z - 0.1), (0.07, 0.07, 0.12), '#ffffff', mat='teamglow', sub=0)
    m.finish()

    # prijestol (Ancient) — "Drvo života": kameni podij sa zlatnim rubom, stupovi i drvo čije grane drže kristal
    m = Model('ancient')
    b = m.part('base', (0, 0, 0))
    b.cyl((0, 0, 0), (0, 0, 0.28), 1.95, 1.86, '#645a4a', seg=16)
    b.cyl((0, 0, 0.27), (0, 0, 0.32), 1.88, 1.88, '#e9bf62', seg=16)   # zlatni rub
    b.cyl((0, 0, 0.32), (0, 0, 0.56), 1.58, 1.5, '#776c5a', seg=16)
    b.cyl((0, 0, 0.56), (0, 0, 0.8), 1.24, 1.16, '#887c68', seg=16)
    b.cyl((0, 0, 0.78), (0, 0, 0.86), 1.24, 1.24, '#ffffff', mat='team', seg=16, caps=False)   # traka tima (bez poklopca — inače prekrije vrh podija)
    for k in range(2):   # stube sprijeda i straga
        a = k * 180 + 90
        ca, sa = math.cos(RAD(a)), math.sin(RAD(a))
        for j in range(3):
            r = 1.95 - j * 0.24
            b.box((ca * (r - 0.02), sa * (r - 0.02), 0.1 + j * 0.24), (0.36, 0.7 - j * 0.08, 0.2), ['#6e6453', '#7d7260', '#8b806c'][j], rot=(0, 0, a), bevel=0.02)
    for i in range(6):   # stupovi sa zlatnim kapitelima i svjetlima
        a = RAD(i * 60)
        x, y = math.cos(a) * 1.4, math.sin(a) * 1.4
        b.cyl((x, y, 0.32), (x, y, 0.5), 0.2, 0.18, '#9c917b', seg=8)
        b.cyl((x, y, 0.5), (x, y, 2.1), 0.13, 0.11, '#a3967b', seg=10)
        b.cyl((x, y, 2.1), (x, y, 2.24), 0.2, 0.22, '#e9bf62', seg=8)
        b.ico((x, y, 2.42), 0.13, '#ffffff', mat='teamglow', sub=0)
    BARK, BARK2 = '#7a5230', '#5e3d22'
    b.cyl((0, 0, 0.8), (0, 0, 1.3), 0.4, 0.28, BARK, seg=12, smooth=True)   # deblo
    for k in range(5):   # korijenje preko podija
        a = RAD(k * 72 + 10)
        ca, sa = math.cos(a), math.sin(a)
        b.cyl((ca * 0.2, sa * 0.2, 1.0), (ca * 0.7, sa * 0.7, 0.88), 0.14, 0.09, BARK2, seg=8, smooth=True)
        b.cyl((ca * 0.7, sa * 0.7, 0.88), (ca * 1.12, sa * 1.12, 0.82), 0.09, 0.03, BARK2, seg=8, smooth=True)
    leaves = ['#4d9a3a', '#5cad45', '#3f8a32']
    for k in range(3):   # tri grane u luku oko kristala, krošnje na krajevima (sredina i prednja strana ostaju otvorene)
        a = RAD(k * 120 + 90)
        ca, sa = math.cos(a), math.sin(a)
        pts = [(ca * 0.15, sa * 0.15, 1.25), (ca * 0.72, sa * 0.72, 1.7), (ca * 0.86, sa * 0.86, 2.45), (ca * 0.58, sa * 0.58, 2.95)]
        rr = [0.17, 0.12, 0.08, 0.04]
        for j in range(3):
            b.cyl(pts[j], pts[j + 1], rr[j], rr[j + 1], BARK, seg=8, smooth=True)
        b.ico((ca * 1.0, sa * 1.0, 2.62), (0.46, 0.46, 0.36), leaves[k], sub=2, jitter=0.18, seed=80 + k)
        b.ico((ca * 0.66, sa * 0.66, 3.0), (0.3, 0.3, 0.24), leaves[(k + 1) % 3], sub=2, jitter=0.18, seed=90 + k)
        for j in range(3):   # svjetleći plodovi u krošnji
            aa = a + RAD(j * 40 - 40)
            b.sphere((math.cos(aa) * 1.08, math.sin(aa) * 1.08, 2.45 + j * 0.12), 0.06, '#ffffff', mat='teamglow', seg=(8, 6))
    cr = m.part('crystal', (0, 0, 2.15))
    cr.ico((0, 0, 2.15), (0.55, 0.55, 0.85), '#ffffff', mat='teamglow', sub=0)
    cr.ico((0, 0, 2.15), (0.68, 0.68, 0.35), '#ffffff', mat='team', sub=0)
    for i in range(4):
        a = RAD(i * 90)
        cr.ico((math.cos(a) * 0.95, math.sin(a) * 0.95, 2.15), (0.12, 0.12, 0.22), '#ffffff', mat='teamglow', sub=0)
    m.finish()

    # fontana
    m = Model('fountain')
    b = m.part('base', (0, 0, 0))
    b.cyl((0, 0, 0), (0, 0, 0.35), 3.0, 3.0, '#b7bec6', seg=24)
    for i in range(16):
        a = RAD(i * 22.5)
        b.box((math.cos(a) * 2.9, math.sin(a) * 2.9, 0.18), (0.32, 0.3, 0.36), ['#aab2bb', '#c3c9d0'][i % 2], rot=(0, 0, i * 22.5), bevel=0.03)
    b.cyl((0, 0, 0.3), (0, 0, 0.42), 3.08, 3.08, '#ffffff', mat='team', seg=24, caps=False)   # prsten tima (bez poklopca — inače prekrije vodu)
    b.cyl((0, 0, 0.3), (0, 0, 0.4), 2.75, 2.75, '#2f9bd8', seg=24)
    b.cyl((0, 0, 0.3), (0, 0, 1.4), 0.32, 0.25, '#b7bec6', seg=10)
    b.cyl((0, 0, 1.3), (0, 0, 1.55), 1.2, 1.3, '#cfd5db', seg=16)
    b.cyl((0, 0, 1.5), (0, 0, 1.56), 1.15, 1.15, '#4cb5ec', seg=16)
    b.cyl((0, 0, 1.5), (0, 0, 2.4), 0.16, 0.12, '#b7bec6', seg=8)
    b.cyl((0, 0, 2.3), (0, 0, 2.48), 0.55, 0.6, '#cfd5db', seg=12)
    w = m.part('water', (0, 0, 2.5))
    w.sphere((0, 0, 2.65), (0.16, 0.16, 0.3), '#bdf0ff', mat='glow')
    for i in range(8):
        a = RAD(i * 45)
        w.cyl((math.cos(a) * 0.4, math.sin(a) * 0.4, 2.55), (math.cos(a) * 0.95, math.sin(a) * 0.95, 1.6),
              0.05, 0.08, '#a5e8ff', mat='glow', seg=5)
    m.finish()


# ------------------------------------------------------------------ VOJARNA I ZIDINE
def build_barracks():
    global METAL_SET
    METAL_SET = BLDG_METAL   # zlatni ukrasi građevina sjaje
    try:
        _build_barracks()
    finally:
        METAL_SET = set()


def _build_barracks():
    m = Model('barracks')
    b = m.part('base', (0, 0, 0))
    b.box((0, 0, 0.5), (1.7, 1.3, 1.0), '#b1a386', bevel=0.04)
    b.box((0, 0, 0.08), (1.9, 1.5, 0.16), '#6c6253', bevel=0.03)
    for k in range(6):   # drvene grede
        b.box((-0.75 + k * 0.3, 0.66, 0.5), (0.08, 0.04, 0.95), '#7a4b25')
        b.box((-0.75 + k * 0.3, -0.66, 0.5), (0.08, 0.04, 0.95), '#7a4b25')
    # dvostrešni krov: dvije kose ploče (team boja) + zabati + sljemenska greda
    rz, ez, ov, hx = 1.78, 1.0, 0.88, 1.0
    b.poly([(-hx, 0, rz), (hx, 0, rz), (hx, ov, ez), (-hx, ov, ez)], '#ffffff', mat='team', thick=0.09)
    b.poly([(hx, 0, rz), (-hx, 0, rz), (-hx, -ov, ez), (hx, -ov, ez)], '#ffffff', mat='team', thick=0.09)
    b.poly([(0.85, -0.65, ez), (0.85, 0.65, ez), (0.85, 0, rz - 0.02)], '#b1a386', thick=0.12)
    b.poly([(-0.85, 0.65, ez), (-0.85, -0.65, ez), (-0.85, 0, rz - 0.02)], '#b1a386', thick=0.12)
    b.cyl((-hx - 0.04, 0, rz + 0.02), (hx + 0.04, 0, rz + 0.02), 0.06, 0.06, '#5b3a1e', seg=8)
    b.box((0, 0, 1.0), (1.95, 1.55, 0.06), '#5b3a1e')
    b.box((0.86, 0, 0.42), (0.1, 0.42, 0.7), '#5b3a1e', bevel=0.03)   # vrata
    b.cyl((0.86, 0, 0.75), (0.92, 0, 0.75), 0.21, 0.21, '#5b3a1e', seg=10)
    for yy in (0.4, -0.4):   # prozori
        b.box((0.84, yy, 0.62), (0.08, 0.22, 0.26), '#4a3a2a', bevel=0.02)
        b.box((0.88, yy, 0.62), (0.06, 0.16, 0.2), '#ffd166', mat='glow')
    b.box((-0.5, -0.45, 1.62), (0.26, 0.26, 0.6), '#9aa3ad', bevel=0.02)   # dimnjak
    b.cyl((0.6, 0.55, 1.2), (0.6, 0.55, 2.4), 0.03, 0.03, '#5b3a1e', seg=6)   # zastava
    fl = m.part('flag', (0.6, 0.55, 2.25), 'base')
    fl.poly([(0.6, 0.55, 2.4), (0.6, 0.55, 2.1), (0.82, 0.55, 2.22), (1.08, 0.55, 2.27)], '#ffffff', mat='team', thick=0.012)
    for s_ in (1, -1):   # stalci s oružjem ispred
        b.box((1.05, s_ * 0.5, 0.2), (0.3, 0.14, 0.4), '#7a4b25')
        b.box((1.05, s_ * 0.5, 0.6), (0.06, 0.06, 0.5), '#dfe6ee', rot=(0, 10, 0))
    m.finish()

    # 👁️ Sovino oko: drveni kolac s velikim okom koje svijetli (ward)
    m = Model('ward')
    w = m.part('mesh')
    w.cyl((0, 0, 0), (0, 0, 0.95), 0.08, 0.05, '#7a4b25', seg=7)
    w.cyl((0, 0, 0.5), (0, 0, 0.64), 0.09, 0.09, '#ffffff', mat='team', seg=7)
    w.sphere((0, 0, 1.12), 0.24, '#f8fafc', seg=(12, 8))
    w.sphere((0, -0.13, 1.12), 0.15, '#a78bfa', mat='glow', seg=(10, 7))
    w.sphere((0, -0.21, 1.12), 0.08, '#1f1a17', seg=(8, 6))
    for a in (40, 90, 140):
        ca, sa = math.cos(RAD(a)), math.sin(RAD(a))
        w.poly([(0, 0, 1.3), (ca * 0.12, 0.05, 1.3 + sa * 0.4), (ca * 0.22, 0.0, 1.3 + sa * 0.3)], '#e9d5ff', thick=0.015)
    m.finish()

    m = Model('wall')
    w = m.part('mesh')
    w.box((0, 0, 0.4), (1.0, 0.3, 0.8), '#a3967d', bevel=0.02)
    w.box((0, 0, 0.12), (1.04, 0.36, 0.24), '#6c6253', bevel=0.02)
    for k in range(3):
        w.box((-0.33 + k * 0.33, 0, 0.9), (0.2, 0.3, 0.2), ['#b1a386', '#9c8f76'][k % 2], bevel=0.02)
    w.cyl((0.5, 0, 0), (0.5, 0, 1.15), 0.2, 0.17, '#8f836c', seg=8)
    w.cyl((0.5, 0, 1.1), (0.5, 0, 1.3), 0.22, 0.0, '#ffffff', mat='team', seg=8)
    m.finish()


# ------------------------------------------------------------------ SCOURGE (crveni tim): tamni kamen, kosti, ljubičasti sjaj
DSTONE = ['#4a4352', '#3f3a47', '#554d5e']
BONE, BONE2, VOID = '#ece4d0', '#d6ccb4', '#a855f7'


def bone_spike(p, base, direction, length, r, curve=0.25):
    """zakrivljeni koštani šiljak (dva stošca)"""
    b0 = Vector(base); d = Vector(direction).normalized()
    up = Vector((0, 0, 1))
    mid = b0 + d * length * 0.55 + up * length * curve * 0.5
    tip = b0 + d * length + up * length * curve
    p.cyl(tuple(b0), tuple(mid), r, r * 0.65, BONE2, seg=8)
    p.cyl(tuple(mid), tuple(tip), r * 0.65, 0.0, BONE, seg=8)


def skull(p, c, s, face=(1, 0, 0)):
    """mala lubanja okrenuta prema face (x os)"""
    x, y, z = c
    p.sphere((x, y, z + 0.02 * s), (0.16 * s, 0.17 * s, 0.15 * s), BONE, seg=(12, 9))
    p.sphere((x + 0.06 * s, y, z - 0.09 * s), (0.1 * s, 0.12 * s, 0.07 * s), BONE2, seg=(10, 6))   # čeljust
    for sd in (1, -1):
        p.sphere((x + 0.13 * s, y + sd * 0.065 * s, z + 0.02 * s), (0.03 * s, 0.045 * s, 0.045 * s), '#1a0f24', seg=(8, 6))
        p.sphere((x + 0.15 * s, y + sd * 0.065 * s, z + 0.02 * s), (0.015 * s, 0.022 * s, 0.022 * s), VOID, mat='glow', seg=(6, 4))
    p.cyl((x + 0.15 * s, y, z - 0.03 * s), (x + 0.16 * s, y, z - 0.06 * s), 0.02 * s, 0.0, '#1a0f24', seg=4)


def build_scourge():
    global METAL_SET
    METAL_SET = BLDG_METAL   # zlatni ukrasi građevina sjaje
    try:
        _build_scourge()
    finally:
        METAL_SET = set()


def _build_scourge():
    # kula: tamni zašiljeni toranj s rebrima od kostiju i kandžama oko kristala
    m = Model('tower_d')
    b = m.part('base', (0, 0, 0))
    b.cyl((0, 0, 0), (0, 0, 0.32), 1.0, 0.9, '#2e2a36', seg=12)
    for i in range(6):
        z0 = 0.3 + i * 0.42
        r0 = 0.78 - i * 0.05
        b.cyl((0, 0, z0), (0, 0, z0 + 0.42), r0, r0 - 0.05, DSTONE[i % 3], seg=8)
        b.cyl((0, 0, z0 + 0.38), (0, 0, z0 + 0.45), r0 + 0.03, r0 + 0.02, '#2e2a36', seg=8)
    for k in range(4):   # koštana rebra uz toranj
        a = RAD(k * 90 + 45)
        ca, sa = math.cos(a), math.sin(a)
        for j in range(3):
            z = 0.7 + j * 0.75
            rr = 0.8 - j * 0.12
            bone_spike(b, (ca * rr * 0.9, sa * rr * 0.9, z), (ca, sa, 0.55), 0.55 - j * 0.08, 0.07, 0.35)
    for a in (-35, -90, -145):   # ljubičasti prozori-proreci
        ca, sa = math.cos(RAD(a)), math.sin(RAD(a))
        for zz, rr in ((1.76, 0.66), (2.6, 0.57)):
            b.box((ca * rr, sa * rr, zz), (0.06, 0.12, 0.42), VOID, mat='glow', rot=(0, 0, a))
    b.box((0.72, 0, 0.55), (0.12, 0.34, 0.5), '#1a0f24', bevel=0.03)   # vrata
    skull(b, (0.8, 0, 1.15), 1.2)
    b.cyl((0, 0, 1.95), (0, 0, 2.15), 0.68, 0.66, '#ffffff', mat='team', seg=8)
    b.cyl((0, 0, 2.8), (0, 0, 2.98), 0.92, 0.8, '#2e2a36', seg=10)
    for i in range(6):   # kandže koje drže kristal
        a = RAD(i * 60)
        ca, sa = math.cos(a), math.sin(a)
        bone_spike(b, (ca * 0.75, sa * 0.75, 2.95), (ca * 0.18, sa * 0.18, 1.0), 1.0, 0.09, -0.18)
    for i in range(8):   # ljubičaste rune u prstenu ispod platforme
        a = RAD(i * 45 + 22.5)
        b.box((math.cos(a) * 0.66, math.sin(a) * 0.66, 2.45), (0.05, 0.1, 0.16), VOID, mat='glow', rot=(0, 0, i * 45 + 22.5))
    b.cyl((0, 0, 2.95), (0, 0, 3.15), 0.44, 0.36, '#3f3a47', seg=10)
    b.cyl((0, 0, 3.12), (0, 0, 3.18), 0.4, 0.4, VOID, mat='glow', seg=10)
    b.cyl((-0.62, 0.62, 2.9), (-0.62, 0.62, 4.5), 0.03, 0.015, BONE2, seg=6)   # koštano koplje (stražnji kut)
    skull(b, (-0.62, 0.62, 4.55), 0.5)
    fl = m.part('flag', (-0.62, 0.62, 4.2), 'base')   # poderani barjak
    fl.poly([(-0.62, 0.63, 4.38), (-0.62, 0.63, 3.98), (-0.4, 0.63, 4.06), (-0.3, 0.63, 4.16), (-0.2, 0.63, 4.1), (-0.16, 0.63, 4.32)],
            '#ffffff', mat='team', thick=0.012)
    Z = TOWER_CRYSTAL_Z
    cr = m.part('crystal', (0, 0, Z))
    cr.ico((0, 0, Z), (0.28, 0.28, 0.5), '#ffffff', mat='teamglow', sub=0)
    for k in range(3):
        a = RAD(k * 120 + 60)
        cr.ico((math.cos(a) * 0.48, math.sin(a) * 0.48, Z - 0.12), (0.06, 0.06, 0.13), '#ffffff', mat='teamglow', sub=0)
    m.finish()

    # prijestol (Smrznuto srce): kruna od kostiju oko tamnog šiljatog kristala
    m = Model('ancient_d')
    b = m.part('base', (0, 0, 0))
    b.cyl((0, 0, 0), (0, 0, 0.3), 1.95, 1.8, '#2e2a36', seg=14)
    b.cyl((0, 0, 0.3), (0, 0, 0.55), 1.55, 1.45, DSTONE[0], seg=14)
    b.cyl((0, 0, 0.55), (0, 0, 0.8), 1.2, 1.1, DSTONE[2], seg=14)
    b.cyl((0, 0, 0.78), (0, 0, 0.86), 1.22, 1.2, '#ffffff', mat='team', seg=14, caps=False)
    for i in range(8):   # veliki koštani šiljci u krugu
        a = RAD(i * 45 + 22.5)
        ca, sa = math.cos(a), math.sin(a)
        bone_spike(b, (ca * 1.5, sa * 1.5, 0.4), (ca * 0.35, sa * 0.35, 1.0), 1.6 + (i % 2) * 0.5, 0.14, 0.12)
    for i in range(4):
        a = RAD(i * 90)
        skull(b, (math.cos(a) * 1.25, math.sin(a) * 1.25, 0.95), 1.4)
    for i in range(6):   # ljubičasti jezičci energije
        a = RAD(i * 60)
        b.cyl((math.cos(a) * 0.6, math.sin(a) * 0.6, 0.8), (math.cos(a) * 0.3, math.sin(a) * 0.3, 1.6), 0.06, 0.0, VOID, mat='glow', seg=5)
    b.cyl((0, 0, 0.8), (0, 0, 1.15), 0.6, 0.45, '#2e2a36', seg=10)
    cr = m.part('crystal', (0, 0, 2.15))
    cr.ico((0, 0, 2.15), (0.45, 0.45, 1.0), '#ffffff', mat='teamglow', sub=0)
    cr.ico((0, 0, 2.0), (0.62, 0.62, 0.3), '#2e2a36', sub=0)
    for i in range(5):
        a = RAD(i * 72)
        cr.ico((math.cos(a) * 0.55, math.sin(a) * 0.55, 1.9), (0.1, 0.1, 0.42), '#ffffff', mat='teamglow', sub=0, rot=(math.sin(a) * 20, -math.cos(a) * 20, 0))
    m.finish()

    # fontana: tamni bazen sa sjajnom ljubičastom tekućinom i lubanjama
    m = Model('fountain_d')
    b = m.part('base', (0, 0, 0))
    b.cyl((0, 0, 0), (0, 0, 0.35), 3.0, 3.0, '#2e2a36', seg=24)
    for i in range(16):
        a = RAD(i * 22.5)
        b.box((math.cos(a) * 2.9, math.sin(a) * 2.9, 0.18), (0.32, 0.3, 0.36), DSTONE[i % 3], rot=(0, 0, i * 22.5), bevel=0.03)
        if i % 4 == 0:
            bone_spike(b, (math.cos(a) * 2.95, math.sin(a) * 2.95, 0.3), (math.cos(a) * 0.3, math.sin(a) * 0.3, 1.0), 0.9, 0.11, 0.1)
    b.cyl((0, 0, 0.3), (0, 0, 0.42), 3.08, 3.08, '#ffffff', mat='team', seg=24, caps=False)
    b.cyl((0, 0, 0.3), (0, 0, 0.4), 2.75, 2.75, '#6b21a8', mat='glow', seg=24)   # tamna ljubičasta tekućina (crvenkasta — inače je tonska krivulja pretvori u plavu)
    b.cyl((0, 0, 0.3), (0, 0, 1.4), 0.34, 0.26, DSTONE[1], seg=10)
    b.cyl((0, 0, 1.3), (0, 0, 1.55), 1.2, 1.3, DSTONE[2], seg=16)
    b.cyl((0, 0, 1.5), (0, 0, 1.56), 1.15, 1.15, '#86198f', mat='glow', seg=16)
    for i in range(4):
        a = RAD(i * 90 + 45)
        skull(b, (math.cos(a) * 1.25, math.sin(a) * 1.25, 1.42), 1.0)
    b.cyl((0, 0, 1.5), (0, 0, 2.4), 0.16, 0.12, DSTONE[0], seg=8)
    b.cyl((0, 0, 2.3), (0, 0, 2.48), 0.55, 0.6, DSTONE[2], seg=12)
    w = m.part('water', (0, 0, 2.5))
    w.sphere((0, 0, 2.65), (0.16, 0.16, 0.3), '#e9d5ff', mat='glow')
    for i in range(8):
        a = RAD(i * 45)
        w.cyl((math.cos(a) * 0.4, math.sin(a) * 0.4, 2.55), (math.cos(a) * 0.95, math.sin(a) * 0.95, 1.6),
              0.05, 0.08, '#c084fc', mat='glow', seg=5)
    m.finish()

    # vojarna: tamna kripta s oštrim krovom, koštanim lukom i lubanjom nad vratima
    m = Model('barracks_d')
    b = m.part('base', (0, 0, 0))
    b.box((0, 0, 0.5), (1.7, 1.3, 1.0), DSTONE[0], bevel=0.05)
    b.box((0, 0, 0.08), (1.9, 1.5, 0.16), '#2e2a36', bevel=0.03)
    rz, ez, ov, hx = 2.1, 1.0, 0.85, 1.0
    b.poly([(-hx, 0, rz), (hx, 0, rz), (hx, ov, ez), (-hx, ov, ez)], '#ffffff', mat='team', thick=0.09)
    b.poly([(hx, 0, rz), (-hx, 0, rz), (-hx, -ov, ez), (hx, -ov, ez)], '#ffffff', mat='team', thick=0.09)
    b.poly([(0.85, -0.65, ez), (0.85, 0.65, ez), (0.85, 0, rz - 0.02)], DSTONE[2], thick=0.12)
    b.poly([(-0.85, 0.65, ez), (-0.85, -0.65, ez), (-0.85, 0, rz - 0.02)], DSTONE[2], thick=0.12)
    for xx in (-hx, hx):   # šiljci na sljemenu
        bone_spike(b, (xx, 0, rz), (xx * 0.3, 0, 1.0), 0.5, 0.07, 0.0)
    b.box((0.86, 0, 0.42), (0.1, 0.42, 0.7), '#1a0f24', bevel=0.03)
    for sd in (1, -1):   # koštani luk oko vrata
        bone_spike(b, (0.95, sd * 0.4, 0.0), (0.0, -sd * 0.25, 1.0), 1.0, 0.07, 0.0)
    skull(b, (0.95, 0, 1.0), 1.0)
    for yy in (0.4, -0.4):
        b.box((0.84, yy, 0.62), (0.08, 0.14, 0.3), VOID, mat='glow')
    b.cyl((0.6, 0.55, 1.2), (0.6, 0.55, 2.5), 0.03, 0.03, '#2e2a36', seg=6)
    fl = m.part('flag', (0.6, 0.55, 2.32), 'base')
    fl.poly([(0.6, 0.55, 2.5), (0.6, 0.55, 2.15), (0.8, 0.55, 2.26), (0.92, 0.55, 2.2), (1.06, 0.55, 2.34)], '#ffffff', mat='team', thick=0.012)
    m.finish()

    # zidina: tamni kamen s koštanim šiljcima
    m = Model('wall_d')
    w = m.part('mesh')
    w.box((0, 0, 0.4), (1.0, 0.3, 0.8), DSTONE[0], bevel=0.02)
    w.box((0, 0, 0.12), (1.04, 0.36, 0.24), '#2e2a36', bevel=0.02)
    for k in range(3):
        bone_spike(w, (-0.33 + k * 0.33, 0, 0.78), (0.1, 0.4, 1.0), 0.45, 0.06, 0.0)
    w.cyl((0.5, 0, 0), (0.5, 0, 1.15), 0.2, 0.15, DSTONE[2], seg=8)
    w.cyl((0.5, 0, 1.1), (0.5, 0, 1.45), 0.18, 0.0, '#ffffff', mat='team', seg=8)
    m.finish()

    # mrtvo drveće: tamno uvijeno deblo, gole grane, rijetko tamnocrveno lišće
    rnd = random.Random(23)
    for v in range(3):
        m = Model('tree_dead%d' % v)
        p = m.part('mesh')
        trunk = '#5b4747' if v != 1 else '#6a5252'
        pts = [(0, 0, 0), (0.06, 0.02, 0.5), (-0.04, 0.05, 1.0), (0.05, -0.02, 1.45)]
        rr = [0.2, 0.14, 0.11, 0.07]
        for i in range(3):
            p.cyl(pts[i], pts[i + 1], rr[i], rr[i + 1], trunk, seg=8, smooth=True)
        for k in range(5 + v):
            a = rnd.uniform(0, math.tau)
            z = rnd.uniform(0.7, 1.4)
            base = (0.02, 0.02, z)
            mid = (math.cos(a) * 0.35, math.sin(a) * 0.35, z + 0.25)
            tip = (math.cos(a + 0.4) * 0.6, math.sin(a + 0.4) * 0.6, z + 0.55)
            p.cyl(base, mid, 0.05, 0.03, trunk, seg=6)
            p.cyl(mid, tip, 0.03, 0.0, trunk, seg=5)
            if k % 2 == 0:
                p.ico(tip, 0.13 + rnd.uniform(0, 0.06), ['#b91c1c', '#7e22ce', '#9d174d'][(k + v) % 3], sub=1, jitter=0.25, seed=v * 20 + k)
        for k in range(3):   # korijenje
            a = k * 2.1 + v
            p.cyl((0, 0, 0.05), (math.cos(a) * 0.35, math.sin(a) * 0.35, -0.02), 0.09, 0.03, trunk, seg=6)
        m.finish()
    for v in range(3):   # tamni borovi (pepeljasti vrhovi)
        m = Model('tree_dpine%d' % v)
        p = m.part('mesh')
        p.cyl((0, 0, 0), (0, 0, 0.7), 0.13, 0.1, '#5b4747', seg=6)
        tiers = 3 + (v % 2)
        for i in range(tiers):
            z0 = 0.45 + i * 0.55
            r0 = 0.82 - i * 0.17
            p.cyl((0, 0, z0), (0, 0, z0 + 0.95 - i * 0.08), r0, 0.0, ['#355e55', '#3d6a60', '#2f554d'][(i + v) % 3], seg=8)
            p.cyl((0, 0, z0 + 0.02), (0, 0, z0 + 0.1), r0 * 0.94, r0 * 0.88, '#8d8698', seg=8)   # pepeo
        m.finish()
    # kosti na tlu (ukras Scourge strane)
    m = Model('bones0')
    p = m.part('mesh')
    skull(p, (0, 0, 0.12), 1.3)
    for (a, L) in ((0.4, 0.5), (2.2, 0.42), (3.9, 0.36)):
        x, y = math.cos(a) * 0.35, math.sin(a) * 0.35
        p.cyl((x, y, 0.04), (x + math.cos(a + 1.4) * L, y + math.sin(a + 1.4) * L, 0.04), 0.035, 0.035, BONE2, seg=6)
        p.sphere((x, y, 0.04), 0.05, BONE, seg=(6, 4))
    m.finish()


def build_cliffs():
    """litice na rubu platoa baza: slojevite kamene ploče, vrh od trave (Sentinel) ili pepela (Scourge).
    Lice litice gleda prema +Y (u igri: prema dolje, od baze prema polju)."""
    for theme in ('', '_d'):
        stones = ['#8d8478', '#9c9386', '#7b7268'] if not theme else ['#4a4352', '#3f3a47', '#554d5e']
        cap = '#5e9c3a' if not theme else '#3b3045'
        line = '#6b6359' if not theme else '#2e2a36'
        for v in range(3):
            rnd = random.Random(300 + v * 7 + (50 if theme else 0))
            m = Model('cliff%s%d' % (theme, v))
            p = m.part('mesh')
            x = -0.62
            while x < 0.6:
                w = rnd.uniform(0.28, 0.42)
                h = rnd.uniform(0.85, 1.1)
                cx = x + w / 2
                p.box((cx, rnd.uniform(-0.04, 0.06), h / 2 - 0.05), (w, 0.55 + rnd.uniform(-0.05, 0.08), h),
                      stones[rnd.randrange(3)], rot=(rnd.uniform(-8, -3), rnd.uniform(-4, 4), rnd.uniform(-6, 6)), bevel=0.05)
                for z in (0.3, 0.62):   # slojevi stijene
                    p.box((cx, 0.29, z + rnd.uniform(-0.05, 0.05)), (w * 0.95, 0.06, 0.035), line, rot=(0, 0, rnd.uniform(-5, 5)))
                x += w * 0.92
            p.box((0, -0.02, 1.0), (1.3, 0.62, 0.1), cap, bevel=0.04)                # vrh (trava / pepeo)
            for k in range(4):   # rubni busenovi / kristali na vrhu
                kx = rnd.uniform(-0.55, 0.55)
                if not theme:
                    p.ico((kx, 0.22, 1.06), (0.12, 0.08, 0.07), '#4f8a30', sub=1, jitter=0.2, seed=k + v * 10)
                elif k % 2 == 0:
                    p.ico((kx, 0.1, 1.12), (0.05, 0.05, 0.14), '#a855f7', mat='glow', sub=0)
            for k in range(4):   # kamenje pri dnu
                p.ico((rnd.uniform(-0.6, 0.6), 0.38 + rnd.uniform(0, 0.12), 0.06), rnd.uniform(0.07, 0.13), stones[k % 3], sub=1, jitter=0.2, seed=40 + k + v)
            m.finish()


# ------------------------------------------------------------------ PORTRETI (render glave za ekran odabira)
def _look_at(obj, frm, to):
    """postavi objekt (kamera/svjetlo/ploha) u frm tako da mu -Z gleda prema to"""
    obj.location = tuple(frm)
    obj.rotation_euler = (Vector(to) - Vector(frm)).to_track_quat('-Z', 'Y').to_euler()


# junaci čiji se portret renderira iz 3D modela (ostali imaju naslikane portrete) i boja pozadine
PORTRAIT_BG = [('jez', '#8a9a4a'), ('slon', '#5a6a8a'), ('pcela', '#b8860b'), ('sova', '#3b2f5c'), ('majmun', '#7a5a2a'),
               ('vuk', '#5a6270'), ('gavran', '#2e2a5c'), ('hobotnica', '#4a3a8a'), ('nosorog', '#6a7a6a'), ('panda', '#4a8a5a'),
               ('jednorog', '#7c3aed'), ('morskipas', '#0e7490'), ('nisan', '#b45309'), ('bikos', '#7f1d1d'),
               ('nilski', '#6b5a8a'), ('irbis', '#1e5a7a'), ('skorpion', '#a16207')]


def render_portraits(ids, size=512, outdir=None, samples=128):
    """v0.53: portret u kadru glava + ramena (kao naslikani portreti ostalih junaka), lice u 3/4 profilu,
    rubno svjetlo iza junaka i mekana pozadina u boji junaka koja svijetli iza glave"""
    sc = bpy.context.scene
    roots = {o.name: o for o in sc.objects if o.parent is None and o.type == 'EMPTY'}
    for o in roots.values():
        o.location = (0, 0, -200)
    cam = bpy.data.objects.new('pcam', bpy.data.cameras.new('pcam'))
    sc.collection.objects.link(cam)
    cam.data.lens = 85
    sc.camera = cam

    def light(nm, kind, energy, size_=1.0, color=(1, 1, 1)):
        lt = bpy.data.objects.new(nm, bpy.data.lights.new(nm, kind))
        lt.data.energy = energy
        lt.data.color = color
        if kind == 'AREA':
            lt.data.size = size_
        sc.collection.objects.link(lt)
        return lt
    key = light('pkey', 'SUN', 3.2, color=(1.0, 0.96, 0.9))
    key.data.angle = RAD(8)
    fill = light('pfill', 'AREA', 140, 3.0, (0.9, 0.95, 1.0))
    rim = light('prim', 'AREA', 420, 1.6, (1.0, 0.95, 0.85))
    rim2 = light('prim2', 'AREA', 220, 1.4, (0.85, 0.92, 1.0))
    world = bpy.data.worlds.new('pw')
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes['Background']
    # pozadina: ploha okrenuta kameri, svijetli krug iza glave koji prema rubovima tamni (samo emisija — ne baca sjene)
    back = bpy.data.objects.new('pback', bpy.data.meshes.new('pback'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14)
    bm.to_mesh(back.data)
    bm.free()
    sc.collection.objects.link(back)
    bmat = bpy.data.materials.new('pbm')
    try:
        bmat.use_nodes = True
    except Exception:
        pass
    nt = bmat.node_tree
    for n_ in list(nt.nodes):
        nt.nodes.remove(n_)
    tco = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.36, 0.36, 0.36)
    gr = nt.nodes.new('ShaderNodeTexGradient')
    gr.gradient_type = 'SPHERICAL'
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tco.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], gr.inputs['Vector'])
    nt.links.new(gr.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    back.data.materials.append(bmat)
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        sc.cycles.use_denoising = False
        sc.cycles.samples = samples * 3
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    face = RAD(-22)                 # kamo junak gleda
    view = face - RAD(30)           # kamera 30° u stranu: lice u 3/4 profilu, okrenuto udesno
    for hid, bgcol in ids:
        r = roots.get('hero_' + hid)
        if not r:
            continue
        S = HEROES[hid][1].get('scale', 1.0) if hid in HEROES else 1.0
        r.location = (0, 0, 0)
        r.rotation_euler = (0, 0, face)
        tgt = Vector((0.05 * S, 0, 1.2 * S))
        d = Vector((math.cos(view) * math.cos(RAD(8)), math.sin(view) * math.cos(RAD(8)), math.sin(RAD(8))))
        dist = 0.8 * S * cam.data.lens / 18
        _look_at(cam, tgt + d * dist, tgt)
        fwd = -d
        right = fwd.cross(Vector((0, 0, 1))).normalized()
        up = right.cross(fwd)
        _look_at(key, tgt - right * 3 + up * 2.6 + d * 2.5, tgt)
        _look_at(fill, tgt + right * 3.2 + up * 0.6 + d * 2.8, tgt)
        _look_at(rim, tgt + right * 1.7 + up * 1.9 - d * 2.2, tgt + Vector((0, 0, 0.15 * S)))
        _look_at(rim2, tgt - right * 1.9 + up * 1.2 - d * 2.0, tgt)
        hb = tgt + Vector((0, 0, 0.22 * S))
        _look_at(back, hb + fwd * 4.5, hb + fwd * 9.0)    # -Z od kamere: lice plohe (+Z) gleda u kameru
        c = col(bgcol)
        dk = [v * 0.42 for v in c]
        lt = [min(1.0, v * 1.15 + 0.16) for v in c]
        ramp.color_ramp.elements[0].color = (dk[0], dk[1], dk[2], 1)
        ramp.color_ramp.elements[1].color = (lt[0], lt[1], lt[2], 1)
        ramp.color_ramp.elements[0].position = 0.15
        bg.inputs['Color'].default_value = (c[0], c[1], c[2], 1)
        bg.inputs['Strength'].default_value = 0.55
        sc.render.filepath = os.path.join(outdir or ASSETS, 'hero_%s.png' % hid)
        bpy.ops.render.render(write_still=True)
        r.location = (0, 0, -200)
        r.rotation_euler = (0, 0, 0)
        print('portret:', hid)
    for o in roots.values():
        o.location = (0, 0, 0)


# ------------------------------------------------------------------ PRIRODA
def build_nature():
    rnd = random.Random(7)
    greens = [('#4caf50', '#388e3c', '#66bb6a'), ('#5cb85c', '#3e8e41', '#7ccf6b'), ('#43a047', '#2e7d32', '#81c784')]
    for v in range(3):
        m = Model('tree_oak%d' % v)
        p = m.part('mesh')
        g = greens[v]
        p.cyl((0, 0, 0), (0, 0, 1.1), 0.17, 0.12, '#8b5a2b', seg=7)
        p.cyl((0, 0, 0.75), (0.32, 0.1, 1.2), 0.07, 0.04, '#8b5a2b', seg=5)
        p.cyl((0, 0, 0.0), (0.22, 0.05, -0.02), 0.09, 0.05, '#7a4b25', seg=5)
        p.cyl((0, 0, 0.0), (-0.15, 0.18, -0.02), 0.09, 0.05, '#7a4b25', seg=5)
        blobs = [((0, 0, 1.55), 0.72), ((0.35, 0.25, 1.35), 0.5), ((-0.38, -0.12, 1.4), 0.52),
                 ((0.05, -0.38, 1.3), 0.48), ((-0.1, 0.32, 1.85), 0.46), ((0.2, -0.1, 2.0), 0.4)]
        for i, (c0, r) in enumerate(blobs[:4 + v]):
            p.ico(c0, (r, r, r * 0.88), g[i % 3], sub=1, jitter=0.12, seed=v * 10 + i)
        # par jabuka / cvjetova
        for i in range(3 + v):
            a = rnd.uniform(0, 6.28)
            p.sphere((math.cos(a) * 0.62, math.sin(a) * 0.62, rnd.uniform(1.2, 1.8)), 0.07,
                     ['#ef4444', '#f59e0b', '#f9a8d4'][v], seg=(6, 4))
        m.finish()
    for v in range(3):
        m = Model('tree_pine%d' % v)
        p = m.part('mesh')
        p.cyl((0, 0, 0), (0, 0, 0.7), 0.13, 0.1, '#7a4b25', seg=6)
        tiers = 3 + (v % 2)
        for i in range(tiers):
            z0 = 0.45 + i * 0.55
            r0 = 0.85 - i * 0.17
            p.cyl((0, 0, z0), (0, 0, z0 + 0.95 - i * 0.08), r0, 0.0,
                  ['#3a8f5c', '#44a066', '#33804f'][(i + v) % 3], seg=8)
            if v == 2:   # svjetliji rub iglica (prije snijeg — čudno usred ljetne livade)
                p.cyl((0, 0, z0 + 0.02), (0, 0, z0 + 0.12), r0 * 0.92, r0 * 0.85, '#7fbf7a', seg=8)
        m.finish()
    for v in range(3):
        m = Model('rock%d' % v)
        p = m.part('mesh')
        p.ico((0, 0, 0.18), (0.55, 0.45, 0.38), ['#80868f', '#8a847d', '#7a8494'][v], sub=1, jitter=0.18, seed=40 + v)
        p.ico((0.35, 0.25, 0.1), (0.25, 0.22, 0.2), '#727a85', sub=1, jitter=0.2, seed=50 + v)
        if v == 1:
            p.ico((-0.3, -0.2, 0.08), (0.2, 0.18, 0.15), '#80868f', sub=1, jitter=0.2, seed=60)
        p.ico((0.05, -0.1, 0.42), (0.3, 0.25, 0.08), '#5a9a40', sub=1, jitter=0.2, seed=70 + v)  # mahovina
        m.finish()
    m = Model('bush0')
    p = m.part('mesh')
    for i, (c0, r) in enumerate((((0, 0, 0.22), 0.36), ((0.28, 0.12, 0.16), 0.26), ((-0.25, 0.1, 0.15), 0.27),
                                 ((0.05, -0.25, 0.16), 0.25))):
        p.ico(c0, r, ['#4caf50', '#43a047', '#66bb6a'][i % 3], sub=1, jitter=0.12, seed=80 + i)
    for i in range(5):
        a = i * 1.3
        p.sphere((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.32), 0.045, '#f9a8d4', seg=(6, 4))
    m.finish()
    m = Model('mushroom0')
    p = m.part('mesh')
    for (x, y, s) in ((0, 0, 1.0), (0.22, 0.12, 0.65), (-0.15, 0.18, 0.5)):
        p.cyl((x, y, 0), (x, y, 0.28 * s), 0.06 * s, 0.05 * s, '#fff7e6', seg=7)
        p.sphere((x, y, 0.3 * s), (0.2 * s, 0.2 * s, 0.12 * s), '#ef4444', seg=(10, 6))
        for k in range(3):
            a = k * 2.1
            p.sphere((x + math.cos(a) * 0.1 * s, y + math.sin(a) * 0.1 * s, 0.38 * s), 0.03 * s, '#ffffff', seg=(5, 3))
    m.finish()
    m = Model('log0')
    p = m.part('mesh')
    p.cyl((-0.6, 0, 0.18), (0.6, 0.05, 0.18), 0.18, 0.17, '#7a4b25', seg=9)
    p.cyl((0.6, 0.05, 0.18), (0.61, 0.05, 0.18), 0.15, 0.15, '#d6b48c', seg=9)
    p.cyl((-0.61, 0, 0.18), (-0.6, 0, 0.18), 0.15, 0.15, '#d6b48c', seg=9)
    p.ico((0.1, 0.0, 0.34), (0.2, 0.15, 0.06), '#6aa84f', sub=1, jitter=0.2, seed=99)
    m.finish()


# ------------------------------------------------------------------ OKOLINA (v0.11): breze, panjevi, cvijeće, trska, lopoči,
# kristali, logorska vatra, šatori, bačve, sanduci, ograde, baklje, gaz, svetište, veliko kamenje, putokaz
def build_env():
    rnd = random.Random(11)
    # breza: bijelo deblo s crnim prugama, svijetla krošnja
    for v in range(2):
        m = Model('tree_birch%d' % v)
        p = m.part('mesh')
        p.cyl((0, 0, 0), (0.05, 0, 1.5), 0.13, 0.08, '#f1f5f9', seg=7)
        for zz in (0.25, 0.6, 0.95, 1.3):
            p.cyl((0.0, 0, zz), (0.02, 0, zz + 0.06), 0.135, 0.13, '#1f2937', seg=7, caps=False)
        p.cyl((0.02, 0, 1.0), (0.3, 0.18, 1.45), 0.05, 0.03, '#e5e7eb', seg=5)
        p.cyl((0.03, 0, 1.2), (-0.28, -0.12, 1.6), 0.05, 0.03, '#e5e7eb', seg=5)
        blobs = [((0.05, 0, 1.85), 0.5), ((0.35, 0.2, 1.6), 0.36), ((-0.32, -0.15, 1.7), 0.38), ((0.0, 0.3, 2.1), 0.3)]
        for i, (c0, r) in enumerate(blobs[:3 + v]):
            p.ico(c0, (r, r, r * 0.9), ['#8bc34a', '#9ccc65', '#7cb342'][i % 3], sub=1, jitter=0.14, seed=120 + v * 10 + i)
        m.finish()
    # panj
    m = Model('stump0')
    p = m.part('mesh')
    p.cyl((0, 0, 0), (0, 0, 0.3), 0.26, 0.24, '#7a4b25', seg=9)
    p.cyl((0, 0, 0.3), (0, 0, 0.32), 0.24, 0.24, '#d6b48c', seg=9)
    for r in (0.07, 0.14, 0.2):
        p.arc((0, 0, 0.33), r, 0, 360, 10, 0.008, '#b08a62', plane='xy', seg=4)
    p.cyl((0.2, 0.1, 0.0), (0.42, 0.2, -0.02), 0.08, 0.04, '#6b3f1f', seg=5)
    p.ico((-0.18, 0.12, 0.12), (0.1, 0.08, 0.06), '#6aa84f', sub=1, jitter=0.2, seed=131)
    m.finish()
    # cvjetne krpice
    for v in range(2):
        m = Model('flowers%d' % v)
        p = m.part('mesh')
        cols_ = [('#f472b6', '#fde047'), ('#60a5fa', '#ffffff'), ('#fb923c', '#fde68a')]
        for i in range(6):
            a = rnd.uniform(0, 6.28); d = rnd.uniform(0.05, 0.4)
            x, y = math.cos(a) * d, math.sin(a) * d
            h = rnd.uniform(0.18, 0.3)
            p.cyl((x, y, 0), (x, y, h), 0.012, 0.01, '#4caf50', seg=4)
            c1, c2 = cols_[(i + v) % 3]
            for k in range(5):
                b = k * 1.2566
                p.sphere((x + math.cos(b) * 0.04, y + math.sin(b) * 0.04, h), (0.035, 0.035, 0.015), c1, seg=(6, 3))
            p.sphere((x, y, h + 0.01), 0.022, c2, seg=(5, 3))
        for i in range(4):
            a = rnd.uniform(0, 6.28); d = rnd.uniform(0.1, 0.45)
            p.cyl((math.cos(a) * d, math.sin(a) * d, 0), (math.cos(a) * d + 0.03, math.sin(a) * d, 0.14), 0.012, 0.0, '#66bb6a', seg=3)
        m.finish()
    # busen trave
    m = Model('grass0')
    p = m.part('mesh')
    for i in range(9):
        a = i * 0.7 + 0.2; d = 0.05 + (i % 3) * 0.06
        x, y = math.cos(a) * d, math.sin(a) * d
        p.cyl((x, y, 0), (x + math.cos(a) * 0.08, y + math.sin(a) * 0.08, 0.22 + (i % 2) * 0.08), 0.02, 0.0,
              ['#7ec850', '#66bb6a', '#9ccc65'][i % 3], seg=3)
    m.finish()
    # trska (rogoz) uz rijeku
    m = Model('reeds0')
    p = m.part('mesh')
    for i in range(6):
        a = i * 1.05; d = 0.05 + (i % 3) * 0.07
        x, y = math.cos(a) * d, math.sin(a) * d
        h = 0.5 + (i % 3) * 0.12
        p.cyl((x, y, 0), (x + 0.03, y, h), 0.014, 0.01, '#65a30d', seg=4)
        if i % 2 == 0:
            p.cyl((x + 0.03, y, h - 0.12), (x + 0.035, y, h + 0.02), 0.03, 0.03, '#78350f', seg=6)
        p.cyl((x - 0.02, y + 0.02, 0.05), (x - 0.08, y + 0.06, 0.4), 0.012, 0.0, '#84cc16', seg=3)
    m.finish()
    # lopoč s cvijetom
    m = Model('lilypad0')
    p = m.part('mesh')
    p.cyl((0, 0, 0), (0, 0, 0.02), 0.32, 0.32, '#4caf50', seg=14)
    p.box((0.2, 0.0, 0.0), (0.3, 0.07, 0.03), '#5ab6ee', rot=(0, 0, 20))   # urez
    for k in range(6):
        b = k * 1.047
        p.sphere((-0.08 + math.cos(b) * 0.06, 0.05 + math.sin(b) * 0.06, 0.05), (0.05, 0.05, 0.03), '#f9a8d4', seg=(6, 3))
    p.sphere((-0.08, 0.05, 0.07), 0.03, '#fde047', seg=(5, 3))
    m.finish()
    # kristal (džungla) — svijetli
    m = Model('crystal0')
    p = m.part('mesh')
    p.ico((0, 0, 0.08), (0.3, 0.26, 0.1), '#6b7280', sub=1, jitter=0.2, seed=140)
    p.ico((0, 0, 0.4), (0.12, 0.12, 0.45), '#a5f3fc', mat='glow', sub=0)
    p.ico((0.18, 0.1, 0.25), (0.08, 0.08, 0.28), '#67e8f9', mat='glow', sub=0, rot=(0, 25, 0))
    p.ico((-0.15, 0.12, 0.22), (0.07, 0.07, 0.22), '#cffafe', mat='glow', sub=0, rot=(20, -15, 0))
    m.finish()
    # logorska vatra
    m = Model('campfire0')
    p = m.part('mesh')
    for k in range(7):
        a = k * 0.9
        p.ico((math.cos(a) * 0.32, math.sin(a) * 0.32, 0.05), (0.09, 0.07, 0.06), '#9ca3af', sub=0, jitter=0.2, seed=150 + k)
    p.cyl((-0.25, -0.1, 0.06), (0.25, 0.12, 0.06), 0.045, 0.04, '#5b3a1e', seg=6)
    p.cyl((-0.15, 0.22, 0.06), (0.18, -0.2, 0.06), 0.045, 0.04, '#6b3f1f', seg=6)
    for z, r, c in ((0.12, 0.17, '#ff7a1a'), (0.3, 0.12, '#ffb020'), (0.44, 0.07, '#ffe26b')):
        p.sphere((0, 0, z), (r, r, r * 1.5), c, mat='glow', seg=(8, 6))
    m.finish()
    # šator (boja tima)
    m = Model('tent0')
    p = m.part('mesh')
    p.poly([(-0.5, -0.45, 0), (0.5, -0.45, 0), (0.5, 0, 0.55), (-0.5, 0, 0.55)], '#ffffff', mat='team', thick=0.03)
    p.poly([(0.5, 0.45, 0), (-0.5, 0.45, 0), (-0.5, 0, 0.55), (0.5, 0, 0.55)], '#ffffff', mat='team', thick=0.03)
    p.poly([(0.5, -0.45, 0), (0.5, 0.45, 0), (0.5, 0, 0.55)], '#e5e7eb', thick=0.02)
    p.poly([(-0.5, 0.45, 0), (-0.5, -0.45, 0), (-0.5, 0, 0.55)], '#e5e7eb', thick=0.02)
    p.cyl((-0.52, 0, 0.56), (0.52, 0, 0.56), 0.025, 0.025, '#5b3a1e', seg=6)
    p.cyl((0.5, 0, 0), (0.5, 0, 0.56), 0.025, 0.02, '#5b3a1e', seg=6)
    p.poly([(0.5, 0, 0.58), (0.5, 0, 0.75), (0.72, 0, 0.68)], '#ffffff', mat='team')
    m.finish()
    # bačva i sanduk
    m = Model('barrel0')
    p = m.part('mesh')
    p.cyl((0, 0, 0), (0, 0, 0.5), 0.2, 0.2, '#8b5a2b', seg=10, smooth=True)
    p.cyl((0, 0, 0.1), (0, 0, 0.14), 0.21, 0.21, '#374151', seg=10, caps=False)
    p.cyl((0, 0, 0.36), (0, 0, 0.4), 0.21, 0.21, '#374151', seg=10, caps=False)
    p.cyl((0, 0, 0.5), (0, 0, 0.51), 0.18, 0.18, '#a16207', seg=10)
    m.finish()
    m = Model('crate0')
    p = m.part('mesh')
    p.box((0, 0, 0.2), (0.4, 0.4, 0.4), '#b08a62', bevel=0.015)
    for s_ in (1, -1):
        p.box((s_ * 0.2, 0, 0.2), (0.03, 0.42, 0.06), '#7a4b25')
        p.box((0, s_ * 0.2, 0.2), (0.42, 0.03, 0.06), '#7a4b25')
    p.box((0, 0, 0.41), (0.42, 0.42, 0.02), '#7a4b25')
    m.finish()
    # drvena ograda (segment duljine 1)
    m = Model('fence0')
    p = m.part('mesh')
    for x in (-0.45, 0.45):
        p.cyl((x, 0, 0), (x, 0, 0.5), 0.04, 0.035, '#7a4b25', seg=6)
        p.cyl((x, 0, 0.5), (x, 0, 0.56), 0.04, 0.0, '#5b3a1e', seg=6)
    for z in (0.2, 0.4):
        p.box((0, 0, z), (1.0, 0.03, 0.06), '#a16207')
    m.finish()
    # baklja (stup s plamenom)
    m = Model('torch0')
    p = m.part('mesh')
    p.cyl((0, 0, 0), (0, 0, 0.1), 0.12, 0.1, '#6b7280', seg=8)
    p.cyl((0, 0, 0.1), (0, 0, 1.1), 0.035, 0.03, '#5b3a1e', seg=6)
    p.cyl((0, 0, 1.05), (0, 0, 1.22), 0.07, 0.08, '#374151', seg=8)
    p.sphere((0, 0, 1.3), (0.09, 0.09, 0.14), '#ff7a1a', mat='glow', seg=(8, 6))
    p.sphere((0, 0, 1.4), (0.05, 0.05, 0.09), '#ffe26b', mat='glow', seg=(6, 4))
    m.finish()
    # v0.47: fenjer uz staze — drveni stup s krakom i obješenom lampom koja svijetli (igra noću baca svjetlo na put)
    m = Model('lantern0')
    p = m.part('mesh')
    p.ico((0, 0, 0.05), (0.16, 0.15, 0.07), '#8b8f97', sub=1, jitter=0.15, seed=171)          # kamen u podnožju
    p.cyl((0, 0, 0.04), (0, 0, 1.45), 0.045, 0.036, '#5b3a1e', seg=8)                         # stup
    p.cyl((0, 0, 1.45), (0, 0, 1.5), 0.05, 0.0, '#4a2f17', seg=8)                             # vrh stupa
    p.cyl((-0.02, 0, 1.38), (0.34, 0, 1.38), 0.026, 0.022, '#5b3a1e', seg=6)                   # krak
    p.cyl((0.02, 0, 1.17), (0.2, 0, 1.37), 0.017, 0.017, '#4a2f17', seg=5)                    # potporanj
    p.cyl((0.3, 0, 1.38), (0.3, 0, 1.31), 0.009, 0.009, '#374151', seg=5)                     # kukica
    p.cyl((0.3, 0, 1.23), (0.3, 0, 1.31), 0.085, 0.018, '#374151', seg=8)                     # krović lampe
    p.box((0.3, 0, 1.15), (0.1, 0.1, 0.14), '#ffcf5a', mat='glow')                             # staklo (svijetli)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.cyl((0.3 + sx * 0.053, sy * 0.053, 1.07), (0.3 + sx * 0.053, sy * 0.053, 1.23), 0.009, 0.009, '#1f2937', seg=4)
    p.box((0.3, 0, 1.07), (0.13, 0.13, 0.022), '#1f2937')                                     # dno lampe
    p.sphere((0.3, 0, 1.15), 0.034, '#fff6cc', mat='glow', seg=(6, 4))                        # plamičak
    m.finish()
    # v0.47: svjetleće gljive — noću džungla svjetluca (plave na strani Sentinela, ljubičaste kod Scourgea)
    for v, (cap, dots) in enumerate((('#5eead4', '#f0fdfa'), ('#c084fc', '#fae8ff'))):
        m = Model('mushglow%d' % v)
        p = m.part('mesh')
        for (x, y, s_) in ((0, 0, 1.0), (0.2, 0.1, 0.7), (-0.14, 0.17, 0.55), (0.09, -0.19, 0.45)):
            p.cyl((x, y, 0), (x, y, 0.3 * s_), 0.05 * s_, 0.038 * s_, '#e0f2fe', seg=7)
            p.sphere((x, y, 0.32 * s_), (0.17 * s_, 0.17 * s_, 0.1 * s_), cap, mat='glow', seg=(10, 6))
            for k in range(3):
                a = k * 2.1 + v
                p.sphere((x + math.cos(a) * 0.08 * s_, y + math.sin(a) * 0.08 * s_, 0.4 * s_), 0.025 * s_, dots, mat='glow', seg=(5, 3))
        m.finish()
    # gaz: plosnato kamenje preko rijeke (redak od 5 kamena duž +X)
    m = Model('ford0')
    p = m.part('mesh')
    for k in range(5):
        x = -0.8 + k * 0.4
        p.ico((x, (k % 2) * 0.12 - 0.06, 0.05), (0.2, 0.17, 0.06), ['#9ca3af', '#a8a29e', '#94a3b8'][k % 3], sub=1, jitter=0.15, seed=160 + k)
    m.finish()
    # svetište: kameni podest s kristalnom kuglom koja svijetli (boja tima)
    m = Model('shrine0')
    p = m.part('mesh')
    p.cyl((0, 0, 0), (0, 0, 0.14), 0.7, 0.66, '#6c6253', seg=12)
    p.cyl((0, 0, 0.14), (0, 0, 0.26), 0.5, 0.46, '#91856f', seg=12)
    for k in range(4):
        a = RAD(k * 90 + 45)
        p.cyl((math.cos(a) * 0.45, math.sin(a) * 0.45, 0.26), (math.cos(a) * 0.45, math.sin(a) * 0.45, 0.9), 0.06, 0.05, '#a89a7d', seg=7)
        p.sphere((math.cos(a) * 0.45, math.sin(a) * 0.45, 0.94), 0.07, '#ffffff', mat='team', seg=(7, 5))
    p.cyl((0, 0, 0.26), (0, 0, 0.55), 0.14, 0.1, '#a89a7d', seg=8)
    p.sphere((0, 0, 0.75), 0.22, '#dff6ff', mat='teamglow', seg=(14, 10))
    p.arc((0, 0, 0.75), 0.3, 0, 360, 14, 0.02, '#fde047', plane='xy', mat='glow')
    m.finish()
    # veliko kamenje (jazbina Zmaja)
    for v in range(2):
        m = Model('rock_big%d' % v)
        p = m.part('mesh')
        p.ico((0, 0, 0.4), (0.8, 0.65, 0.75), ['#6b7280', '#78716c'][v], sub=1, jitter=0.2, seed=170 + v)
        p.ico((0.5, 0.3, 0.2), (0.35, 0.3, 0.3), '#9ca3af', sub=1, jitter=0.2, seed=172 + v)
        p.ico((-0.4, -0.3, 0.9), (0.3, 0.3, 0.25), '#4b5563', sub=1, jitter=0.25, seed=174 + v)
        p.ico((0.1, -0.2, 1.0), (0.35, 0.3, 0.1), '#6aa84f', sub=1, jitter=0.2, seed=176 + v)
        m.finish()
    # putokaz
    m = Model('signpost0')
    p = m.part('mesh')
    p.cyl((0, 0, 0), (0, 0, 1.0), 0.04, 0.035, '#7a4b25', seg=6)
    p.box((0.2, 0, 0.85), (0.5, 0.04, 0.16), '#d6b48c', bevel=0.01)
    p.cyl((0.45, 0, 0.85), (0.56, 0, 0.85), 0.08, 0.0, '#d6b48c', seg=4, caps=True)
    p.box((-0.18, 0, 0.62), (0.44, 0.04, 0.14), '#c9a06c', bevel=0.01, rot=(0, 0, 0))
    m.finish()


def build_golem():
    """Kameni Golem — neutralno čudovište (dvonožac od kamena s kristalnim očima)"""
    biped('mob_golem', dict(fur='#7d8590', belly='#9aa3ad', muzzle='#7d8590', dark='#3f4752', limb='#6b7380', feet='#4b5563',
                            inner='#9aa3ad', nose='#3f4752'),
          dict(ears=None, snout='none', tail=None, tunic=None, weapon='club', atk='melee', scale=1.45,
               eyes={'color': '#67e8f9', 'size': 1.15}, brows='#3f4752', browAngle=-18, blush=False,
               headR=(0.4, 0.42, 0.34), shoulders='#4b5563', chest='#6b7380', spots=True, ornate=False))


def build_courier():
    """🫏 Kurir: leteći magarčić s pernatim krilima, sedlom u boji tima, sandukom
    za predmete i pilotskim naočalama. Gleda prema +X (kao ostali četveronošci)."""
    m = Model('courier')
    fur, belly, muz, mane = '#9ba1aa', '#ece6da', '#f1e9dc', '#3d3838'
    dark, hoof = '#5d636c', '#3a302a'
    L, H, W, bz = 0.9, 0.3, 0.24, 0.56
    # noge (u letu se podvuku)
    for nm, x, y in (('legFL', 0.26, W * 0.6), ('legFR', 0.26, -W * 0.6), ('legBL', -0.26, W * 0.6), ('legBR', -0.26, -W * 0.6)):
        lg = m.part(nm, (x, y, H + 0.12))
        lg.cyl((x, y, H + 0.14), (x + 0.01, y, 0.17), 0.065, 0.05, fur, seg=8, smooth=True)
        lg.sphere((x + 0.005, y, 0.2), (0.055, 0.05, 0.04), fur)   # koljeno
        lg.cyl((x + 0.01, y, 0.17), (x + 0.01, y, 0.07), 0.048, 0.045, fur, seg=8, smooth=True)
        lg.cyl((x + 0.012, y, 0.08), (x + 0.015, y, 0.02), 0.055, 0.06, belly, seg=8)          # bijele "čarape"
        lg.cyl((x + 0.015, y, 0.025), (x + 0.015, y, -0.015), 0.062, 0.064, hoof, seg=10)      # kopito
    b = m.part('body', (0, 0, bz))
    b.sphere((0, 0, bz), (0.48 * L, W, 0.26), fur, seg=(22, 14))
    b.sphere((0.02, 0, bz - 0.1), (0.4 * L, W * 0.82, 0.16), belly, seg=(16, 10))
    b.sphere((0.3 * L, 0, bz + 0.05), (0.2, W * 0.92, 0.22), fur, seg=(14, 10))      # prsa
    b.sphere((-0.3 * L, 0, bz + 0.03), (0.2, W * 0.95, 0.22), fur, seg=(14, 10))     # sapi
    # tamna pruga po leđima (kao pravi magarac)
    for i in range(7):
        x = 0.28 - i * 0.09
        b.sphere((x, 0, bz + 0.245 - abs(x) * 0.12), (0.06, 0.03, 0.02), dark, seg=(8, 5))
    # sedlo u boji tima, zlatni rub, kožni remen ispod trbuha
    b.sphere((0.0, 0, bz + 0.2), (0.24, W * 1.04, 0.1), '#ffffff', mat='team', seg=(16, 10))
    b.arc((0.0, 0, bz + 0.2), 0.235, 0, 360, 20, 0.014, '#f2c14e', plane='xy', seg=5)
    for s in (1, -1):
        b.box((0.0, s * (W + 0.005), bz + 0.08), (0.16, 0.02, 0.16), '#ffffff', mat='team', bevel=0.01)
        b.arc((0.0, s * (W + 0.02), bz + 0.08), 0.07, 0, 360, 12, 0.008, '#f2c14e', plane='xz', seg=4)
    b.arc((0.08, 0, bz - 0.02), W + 0.02, 180, 360, 12, 0.016, '#7a4b25', plane='yz', seg=5)
    # sanduk za predmete (daske, metalni okovi, zakovice, dragulj tima na poklopcu)
    cz = bz + 0.42
    b.box((-0.06, 0, cz), (0.3, 0.26, 0.2), '#a46a35', bevel=0.012)
    for dz in (-0.05, 0.05):
        b.box((-0.06, 0, cz + dz), (0.305, 0.265, 0.008), '#7a4b25')
    for dx in (-0.17, 0.05):
        b.box((-0.06 + dx * 0.6, 0, cz), (0.022, 0.27, 0.205), '#9ca3af')
    b.box((-0.06, 0, cz + 0.11), (0.31, 0.27, 0.035), '#8a5a2b', bevel=0.01)
    for sx in (1, -1):
        for sy in (1, -1):
            b.sphere((-0.06 + sx * 0.14, sy * 0.13, cz + 0.08), 0.014, '#e5e7eb', seg=(6, 4))
    b.box((0.095, 0, cz - 0.005), (0.012, 0.06, 0.07), '#f2c14e')                      # brava
    b.ico((-0.06, 0, cz + 0.145), 0.04, '#ffffff', mat='teamglow', sub=1)
    # mala zastavica tima na sanduku
    b.cyl((-0.19, 0.1, cz + 0.1), (-0.19, 0.1, cz + 0.42), 0.008, 0.008, '#7a4b25', seg=5)
    b.poly([(-0.19, 0.1, cz + 0.41), (-0.36, 0.1, cz + 0.36), (-0.19, 0.1, cz + 0.3)], '#ffffff', mat='team', thick=0.01)
    b.sphere((-0.19, 0.1, cz + 0.43), 0.016, '#f2c14e', seg=(6, 4))
    # vrat + griva
    nx, nz = 0.4, bz + 0.2
    b.cyl((0.28, 0, bz + 0.05), (nx + 0.06, 0, nz + 0.16), 0.13, 0.1, fur, seg=12, smooth=True)
    for i in range(6):
        t = i / 5
        b.sphere((0.26 + t * 0.2, 0, bz + 0.2 + t * 0.2), (0.05, 0.035, 0.07), mane, rot=(0, -30, 0), seg=(8, 6))
    # glava
    hx, hz = nx + 0.12, nz + 0.24
    h = m.part('head', (nx + 0.04, 0, nz + 0.12), 'body')
    h.sphere((hx, 0, hz), (0.17, 0.15, 0.16), fur, seg=(18, 12))
    h.cyl((hx + 0.06, 0, hz - 0.03), (hx + 0.27, 0, hz - 0.08), 0.12, 0.105, muz, seg=14, smooth=True)
    h.sphere((hx + 0.27, 0, hz - 0.08), (0.075, 0.105, 0.09), muz, seg=(12, 9))
    for s in (1, -1):
        h.sphere((hx + 0.33, s * 0.045, hz - 0.06), (0.02, 0.025, 0.018), '#4a3a3a', seg=(8, 5))   # nosnice
    h.arc((hx + 0.29, 0, hz - 0.14), 0.05, 200, 340, 6, 0.008, '#4a3a3a', plane='yz', seg=4)        # osmijeh
    h.box((hx + 0.3, 0, hz - 0.16), (0.012, 0.04, 0.03), '#ffffff', bevel=0.004)                    # zubići
    eyes(h, hx + 0.1, 0, hz + 0.04, r=0.05, spread=0.09, big=1.05)
    brows(h, hx + 0.12, 0, hz + 0.11, dark, angle=10, spread=0.09)
    h.sphere((hx + 0.1, 0.12, hz - 0.03), (0.02, 0.03, 0.018), '#f6a6b2', seg=(8, 5))   # rumeni obrazi
    h.sphere((hx + 0.1, -0.12, hz - 0.03), (0.02, 0.03, 0.018), '#f6a6b2', seg=(8, 5))
    # čuperak grive na čelu
    for k, (dy, dz) in enumerate(((0, 0.15), (0.04, 0.13), (-0.04, 0.13))):
        h.sphere((hx + 0.02, dy, hz + dz), (0.05, 0.03, 0.05), mane, rot=(0, -25, 0), seg=(8, 6))
    # pilotske naočale podignute na čelo
    for s in (1, -1):
        h.cyl((hx + 0.06, s * 0.065, hz + 0.13), (hx + 0.1, s * 0.065, hz + 0.15), 0.045, 0.045, '#8a5a2b', seg=12)
        h.cyl((hx + 0.095, s * 0.065, hz + 0.148), (hx + 0.105, s * 0.065, hz + 0.152), 0.034, 0.034, '#a5f3fc', mat='glow', seg=12)
    h.arc((hx - 0.01, 0, hz + 0.1), 0.16, 0, 360, 18, 0.012, '#5a3a1e', plane='xy', seg=4)        # remen
    # duge uši (posebni dijelovi — mrdaju): široke, ružičaste iznutra, tamni vrh
    for s, nm in ((1, 'earL'), (-1, 'earR')):
        e = m.part(nm, (hx - 0.05, s * 0.08, hz + 0.12), 'head')
        e.sphere((hx - 0.08, s * 0.12, hz + 0.27), (0.045, 0.06, 0.17), fur, rot=(-s * 18, -14, 0), seg=(12, 9))
        e.sphere((hx - 0.055, s * 0.125, hz + 0.27), (0.02, 0.04, 0.13), '#f3c1c8', rot=(-s * 18, -14, 0), seg=(10, 7))
        e.sphere((hx - 0.12, s * 0.17, hz + 0.42), (0.03, 0.04, 0.045), dark, rot=(-s * 18, -14, 0), seg=(8, 6))
    # pernata krila: lepeza pera unatrag u ravnini krila (ruka krila ide van i gore)
    for s, nm in ((1, 'wingL'), (-1, 'wingR')):
        p0 = Vector((0.1, s * W * 0.75, bz + 0.2))
        w = m.part(nm, tuple(p0), 'body')
        elbow = p0 + Vector((0.06, s * 0.3, 0.2))
        tipp = p0 + Vector((-0.04, s * 0.68, 0.3))
        w.cyl(p0, elbow, 0.045, 0.035, '#f8fafc', seg=8, smooth=True)
        w.cyl(elbow, tipp, 0.035, 0.015, '#f8fafc', seg=8, smooth=True)
        w.sphere(elbow, 0.04, '#f8fafc', seg=(8, 6))
        X = Vector((1, 0, 0))
        fan = []
        for i in range(9):   # dugačka pera (letna): od ramena do vrha, sve duža prema van
            t = i / 8
            root = p0.lerp(elbow, t * 2) if t < 0.5 else elbow.lerp(tipp, (t - 0.5) * 2)
            A = ((elbow - p0) if t < 0.5 else (tipp - elbow)).normalized()
            Ln = 0.2 + 0.26 * t ** 0.8
            wd = 0.08 + 0.01 * t
            back = -X * Ln + Vector((0, 0, -0.06 - 0.06 * (1 - t)))
            tip = root + back + A * (0.05 * t)
            fan.append((root, back))
            pts = [root + A * wd * 0.6, root + back * 0.5 + A * wd, tip, root + back * 0.55 - A * wd * 0.8, root - A * wd * 0.5]
            w.poly([tuple(v) for v in pts], '#ffffff' if i % 2 == 0 else '#f1f5ff', thick=0.014)
            w.poly([tuple(v) for v in (root + back * 0.8 + A * wd * 0.7, tip, root + back * 0.82 - A * wd * 0.6)], '#bfdbfe', thick=0.018)
        for i in range(len(fan) - 1):   # puna ploha krila ispod pera (bez rupa između njih)
            (r0, b0), (r1, b1) = fan[i], fan[i + 1]
            dn = Vector((0, 0, -0.018))
            w.poly([tuple(r0 + dn), tuple(r1 + dn), tuple(r1 + b1 * 0.8 + dn), tuple(r0 + b0 * 0.8 + dn)], '#f4f7ff', thick=0.01)
        for i in range(7):   # kratka pokrovna pera preko korijena
            t = 0.05 + i / 7
            root = p0.lerp(elbow, t * 2) if t < 0.5 else elbow.lerp(tipp, (t - 0.5) * 2)
            w.sphere(tuple(root + Vector((-0.07, 0, -0.02))), (0.1, 0.03, 0.06), '#fafcff', seg=(10, 6))
    # rep s čupavim vrhom
    t = m.part('tail', (-0.42, 0, bz + 0.08), 'body')
    t.cyl((-0.42, 0, bz + 0.08), (-0.58, 0, bz - 0.12), 0.025, 0.018, fur, seg=6, smooth=True)
    t.sphere((-0.6, 0, bz - 0.17), (0.05, 0.045, 0.08), mane, seg=(8, 6))
    t.sphere((-0.61, 0, bz - 0.23), (0.035, 0.03, 0.05), mane, seg=(7, 5))

    Z = (0, 0, 0)
    # IDLE: lagano maše krilima, mrda ušima i repom, glava kima
    m.anim('idle', 48, {
        'body': [(0, Z, Z), (24, (0, -2, 0), (0, 0, 0.03)), (48, Z, Z)],
        'head': [(0, Z), (12, (0, -6, 4)), (30, (0, 4, -6)), (48, Z)],
        'earL': [(0, Z), (8, (-14, 0, 0)), (14, Z), (40, Z), (44, (-20, 0, 0)), (48, Z)],
        'earR': [(0, Z), (20, Z), (25, (16, 0, 0)), (30, Z), (48, Z)],
        'tail': [(0, (0, 0, -20)), (24, (0, 0, 20)), (48, (0, 0, -20))],
        'wingL': [(0, (-10, 0, 0)), (12, (24, 0, 0)), (24, (-10, 0, 0)), (36, (24, 0, 0)), (48, (-10, 0, 0))],
        'wingR': [(0, (10, 0, 0)), (12, (-24, 0, 0)), (24, (10, 0, 0)), (36, (-24, 0, 0)), (48, (10, 0, 0))],
        'legFL': [(0, Z), (24, (0, -8, 0)), (48, Z)],
        'legFR': [(0, Z), (24, (0, 8, 0)), (48, Z)],
        'legBL': [(0, Z), (24, (0, 6, 0)), (48, Z)],
        'legBR': [(0, Z), (24, (0, -6, 0)), (48, Z)],
    })
    # "WALK" = let: snažni zamasi, noge podvučene, uši polegnute unatrag
    m.anim('walk', 16, {
        'body': [(0, Z, (0, 0, -0.03)), (4, (0, -3, 0), (0, 0, 0.04)), (8, Z, (0, 0, -0.03)), (12, (0, -3, 0), (0, 0, 0.04)), (16, Z, (0, 0, -0.03))],
        'head': [(0, (0, 8, 0)), (8, (0, 3, 0)), (16, (0, 8, 0))],
        'earL': [(0, (-10, 40, 0)), (8, (-16, 48, 0)), (16, (-10, 40, 0))],
        'earR': [(0, (10, 40, 0)), (8, (16, 48, 0)), (16, (10, 40, 0))],
        'tail': [(0, (0, 30, -10)), (8, (0, 34, 10)), (16, (0, 30, -10))],
        'wingL': [(0, (55, 0, 0)), (8, (-40, 0, 0)), (16, (55, 0, 0))],
        'wingR': [(0, (-55, 0, 0)), (8, (40, 0, 0)), (16, (-55, 0, 0))],
        'legFL': [(0, (0, -70, 0)), (8, (0, -60, 0)), (16, (0, -70, 0))],
        'legFR': [(0, (0, -65, 0)), (8, (0, -75, 0)), (16, (0, -65, 0))],
        'legBL': [(0, (0, 60, 0)), (8, (0, 70, 0)), (16, (0, 60, 0))],
        'legBR': [(0, (0, 65, 0)), (8, (0, 55, 0)), (16, (0, 65, 0))],
    })
    m.finish()


# ------------------------------------------------------------------ PROJEKTILI (lete prema +X)
def rotx(pt, deg):
    """zarotiraj točku oko osi X (za perje strijele)"""
    a = RAD(deg)
    x, y, z = pt
    return (x, y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a))


def build_projectiles():
    # 🍌 banana (Skakač E) — zakrivljena, vrti se u letu
    m = Model('proj_banana')
    p = m.part('mesh')
    pts = [(-0.32, 0, 0.12), (-0.18, 0, -0.04), (0.0, 0, -0.1), (0.18, 0, -0.04), (0.32, 0, 0.12)]
    rr = [0.05, 0.09, 0.1, 0.09, 0.05]
    for i in range(4):
        p.cyl(pts[i], pts[i + 1], rr[i], rr[i + 1], '#facc15', seg=10, smooth=True)
        p.sphere(pts[i + 1], rr[i + 1], '#fde047', seg=(10, 7))
    p.sphere(pts[0], 0.05, '#facc15', seg=(8, 6))
    p.cyl(pts[0], (-0.4, 0, 0.2), 0.03, 0.02, '#78350f', seg=6)        # peteljka
    p.sphere((0.33, 0, 0.13), 0.035, '#78350f', seg=(6, 4))
    for i in range(3):   # smeđe pjegice
        p.sphere((-0.1 + i * 0.1, -0.09, -0.06), 0.015, '#a16207', seg=(6, 4))
    m.finish()
    # 🕸️ lovačka mreža (Strijela W) — kolut od užeta s paukovim nitima, leti plosnato
    m = Model('proj_net')
    p = m.part('mesh')
    for rad in (0.42, 0.28, 0.14):
        p.arc((0, 0, 0), rad, 0, 360, 16, 0.012, '#f5f5f4', plane='xy', seg=4)
    for k in range(8):
        a = RAD(k * 45)
        p.cyl((0, 0, 0), (math.cos(a) * 0.44, math.sin(a) * 0.44, 0), 0.01, 0.01, '#e7e5e4', seg=4)
    for k in range(6):   # utezi na rubu
        a = RAD(k * 60 + 15)
        p.sphere((math.cos(a) * 0.44, math.sin(a) * 0.44, 0), 0.04, '#78716c', seg=(8, 6))
    p.arc((0, 0, 0), 0.44, 0, 360, 18, 0.02, '#a16207', plane='xy', seg=5)
    m.finish()
    # duga (Duga: Dugin snop i auto-napadi) — luk u ravnini okomitoj na let, sjaji
    m = Model('proj_rainbow')
    p = m.part('mesh')
    for i, cc in enumerate(('#f87171', '#fb923c', '#fde047', '#4ade80', '#60a5fa', '#c084fc')):
        p.arc((0, 0, -0.1), 0.5 - i * 0.055, 0, 180, 12, 0.03, cc, plane='yz', mat='glow', seg=5)
    for sd in (1, -1):   # oblačići na krajevima
        p.sphere((0, sd * 0.42, -0.12), (0.12, 0.14, 0.09), '#ffffff', mat='glow', seg=(8, 6))
        p.sphere((-0.04, sd * 0.33, -0.14), (0.09, 0.1, 0.07), '#f1f5f9', mat='glow', seg=(8, 6))
    m.finish()
    # strijela (Strijela, Luna, auto-napadi strijelaca)
    m = Model('proj_arrow')
    p = m.part('mesh')
    p.cyl((-0.55, 0, 0), (0.42, 0, 0), 0.035, 0.035, '#a5733f', seg=6)
    p.cyl((0.42, 0, 0), (0.68, 0, 0), 0.075, 0.0, '#d6dde6', seg=6)
    for a in (0, 120, 240):
        pts = [(-0.55, 0, 0.0), (-0.36, 0, 0.0), (-0.4, 0, 0.12), (-0.58, 0, 0.14)]
        p.poly([rotx(q, a) for q in pts], '#ef4444' if a == 0 else '#f8fafc', thick=0.012)
    m.finish()
    # vatrena kugla (Žarko)
    m = Model('proj_fireball')
    p = m.part('mesh')
    p.sphere((0, 0, 0), 0.24, '#ff7a1a', mat='glow', seg=(12, 8))
    p.sphere((0.07, 0, 0.03), 0.15, '#ffe26b', mat='glow', seg=(10, 7))
    for i, (x, r, c) in enumerate(((-0.27, 0.17, '#ff5a1a'), (-0.47, 0.12, '#ff3d00'), (-0.63, 0.075, '#c62d00'))):
        p.sphere((x, 0, 0.03 * i), r, c, mat='glow', seg=(9, 6))
    m.finish()
    # ledena strijela (Ledena)
    m = Model('proj_ice')
    p = m.part('mesh')
    p.ico((0, 0, 0), (0.42, 0.15, 0.15), '#9ae6ff', mat='glow', sub=0)
    p.ico((-0.15, 0.1, 0.06), (0.16, 0.07, 0.07), '#dff6ff', mat='glow', sub=0, rot=(0, 0, 25))
    p.ico((-0.1, -0.1, -0.05), (0.14, 0.06, 0.06), '#dff6ff', mat='glow', sub=0, rot=(0, 0, -30))
    m.finish()
    # pero (Orlina)
    m = Model('proj_feather')
    p = m.part('mesh')
    p.cyl((-0.5, 0, 0), (0.45, 0, 0), 0.02, 0.012, '#f1f5f9', seg=5)
    p.poly([(-0.42, 0, 0.01), (0.1, 0, 0.01), (0.35, 0.12, 0.01), (0.0, 0.2, 0.01), (-0.3, 0.14, 0.01)], '#eceff4', thick=0.015)
    p.poly([(-0.42, 0, -0.01), (0.1, 0, -0.01), (0.35, -0.12, -0.01), (0.0, -0.2, -0.01), (-0.3, -0.14, -0.01)], '#cbd5e1', thick=0.015)
    m.finish()
    # leteća zvijezda / šuriken (Tragač) — vrti se u igri
    m = Model('proj_star')
    p = m.part('mesh')
    for k in range(4):
        a = RAD(k * 90)
        p.cyl((0, 0, 0), (math.cos(a) * 0.42, math.sin(a) * 0.42, 0), 0.1, 0.0, '#d6dde6', seg=4)
    p.cyl((0, 0, -0.03), (0, 0, 0.03), 0.13, 0.13, '#f6c945', seg=8)
    m.finish()
    # žir (Listko)
    # v0.38 Nišanov hitac: mjedeni metak sa žirom na vrhu i zlatnim sjajem
    m = Model('proj_pellet')
    p = m.part('mesh')
    p.cyl((-0.34, 0, 0), (0.1, 0, 0), 0.07, 0.07, '#d4a24c', seg=12)
    p.sphere((0.16, 0, 0), (0.14, 0.09, 0.09), '#b07a3c', seg=(12, 8))
    p.sphere((0.06, 0, 0), (0.07, 0.1, 0.1), '#6b4423', seg=(10, 7))
    p.cyl((-0.36, 0, 0), (-0.3, 0, 0), 0.08, 0.08, '#8a6a2a', seg=12)
    p.cyl((-0.36, 0, 0), (-1.0, 0, 0), 0.05, 0.0, '#fff3b0', mat='glow', seg=8)   # svjetleći trag iza metka
    m.finish()
    m = Model('proj_acorn')
    p = m.part('mesh')
    p.sphere((0.02, 0, 0), (0.3, 0.22, 0.22), '#b07a3c', seg=(10, 7))
    p.sphere((-0.1, 0, 0), (0.18, 0.24, 0.24), '#6b4423', seg=(10, 7))
    p.cyl((-0.26, 0, 0), (-0.4, 0, 0.06), 0.04, 0.02, '#4a2a14', seg=5)
    p.cyl((0.3, 0, 0), (0.38, 0, 0), 0.03, 0.0, '#4a2a14', seg=5)
    m.finish()
    # mjesečeva / zvjezdana strijela (Luna Q, Strijela ulti)
    m = Model('proj_moon')
    p = m.part('mesh')
    p.sphere((0, 0, 0), 0.16, '#fff7d6', mat='glow', seg=(10, 7))
    p.arc((0, 0, 0), 0.3, 50, 310, 10, 0.05, '#e9d5ff', plane='xy', mat='glow')
    for i, (x, r) in enumerate(((-0.4, 0.1), (-0.58, 0.07), (-0.72, 0.045))):
        p.sphere((x, 0, 0), r, '#c4b5fd', mat='glow', seg=(8, 6))
    m.finish()
    # čarobna strelica u boji tima (kule, čarobnjaci, strijelci-vojnici)
    m = Model('proj_bolt')
    p = m.part('mesh')
    p.ico((0, 0, 0), (0.4, 0.14, 0.14), '#ffffff', mat='teamglow', sub=0)
    p.sphere((0.06, 0, 0), 0.1, '#ffffff', mat='glow', seg=(8, 6))
    m.finish()
    # sokol (Orlina ulti)
    m = Model('proj_hawk')
    p = m.part('mesh')
    p.sphere((0, 0, 0), (0.3, 0.16, 0.14), '#7a4a2a', seg=(10, 7))
    p.sphere((0.28, 0, 0.06), 0.13, '#f3efe4', seg=(10, 7))
    p.cyl((0.38, 0, 0.05), (0.52, 0, 0.03), 0.05, 0.0, '#f5b324', seg=5)
    for s in (1, -1):
        p.poly([(0.05, s * 0.1, 0.05), (-0.1, s * 0.62, 0.22), (-0.3, s * 0.7, 0.12), (-0.25, s * 0.3, 0.02), (-0.2, s * 0.1, 0.0)],
               '#6b3f22', thick=0.03)
        p.sphere((0.33, s * 0.05, 0.1), 0.025, '#111111', seg=(5, 4))
    p.cyl((-0.28, 0, 0.0), (-0.5, 0, 0.04), 0.08, 0.02, '#5a3a22', seg=5)
    m.finish()
    # pčela (Zuja Q)
    m = Model('proj_bee')
    p = m.part('mesh')
    p.sphere((0, 0, 0), (0.26, 0.15, 0.15), '#f5c518', seg=(12, 8))
    for x in (-0.08, 0.06):
        p.cyl((x, 0, 0), (x + 0.05, 0, 0), 0.155, 0.155, '#1f1a17', seg=12, caps=False)
    p.sphere((0.28, 0, 0.02), 0.11, '#1f1a17', seg=(10, 7))
    p.cyl((-0.25, 0, 0), (-0.42, 0, -0.02), 0.05, 0.0, '#1f1a17', seg=5)
    for s_ in (1, -1):
        p.poly([(0.02, s_ * 0.05, 0.12), (-0.12, s_ * 0.3, 0.26), (-0.3, s_ * 0.32, 0.2), (-0.2, s_ * 0.1, 0.12)], '#dff6ff', mat='glow', thick=0.01)
        p.sphere((0.34, s_ * 0.06, 0.07), 0.03, '#ffffff', seg=(5, 4))
    m.finish()
    # ljepljiva sluz (Bodljo W)
    m = Model('proj_slime')
    p = m.part('mesh')
    p.sphere((0, 0, 0), (0.24, 0.2, 0.18), '#84cc16', seg=(12, 8))
    p.sphere((-0.14, 0.1, 0.06), 0.1, '#a3e635', seg=(8, 6))
    p.sphere((-0.1, -0.12, -0.04), 0.08, '#65a30d', seg=(8, 6))
    p.sphere((0.08, 0.05, 0.1), 0.05, '#ecfccb', seg=(6, 4))
    m.finish()
    # bodlja (Bodljo E)
    m = Model('proj_quill')
    p = m.part('mesh')
    p.cyl((-0.3, 0, 0), (0.1, 0, 0), 0.045, 0.045, '#4a3728', seg=5)
    p.cyl((0.1, 0, 0), (0.42, 0, 0), 0.045, 0.0, '#e8d5b5', seg=5)
    m.finish()
    # mlaz tinte (Pipko Q): tamna kapljica s repom
    m = Model('proj_ink')
    p = m.part('mesh')
    p.sphere((0, 0, 0), (0.26, 0.2, 0.2), '#312e81', seg=(12, 8))
    p.sphere((0.12, 0.06, 0.08), 0.07, '#4338ca', seg=(8, 6))
    p.cyl((-0.2, 0, 0), (-0.5, 0, 0.04), 0.12, 0.0, '#1e1b4b', seg=8)
    for s_ in (1, -1):
        p.sphere((-0.1, s_ * 0.2, -0.05), 0.07, '#1e1b4b', seg=(7, 5))
    m.finish()
    # gavran (Mrak R): mala crna ptica — instancirana kruži nad zonom
    m = Model('proj_crow')
    p = m.part('mesh')
    p.sphere((0, 0, 0), (0.3, 0.14, 0.14), '#1f2430', seg=(12, 8))
    p.sphere((0.26, 0, 0.06), 0.11, '#2b2f3a', seg=(10, 7))
    p.cyl((0.34, 0, 0.05), (0.5, 0, 0.03), 0.04, 0.0, '#f59e0b', seg=6)
    p.cyl((-0.26, 0, 0), (-0.46, 0, 0.03), 0.06, 0.0, '#1f2430', seg=5)
    for s_ in (1, -1):
        p.poly([(0.04, s_ * 0.06, 0.08), (-0.1, s_ * 0.38, 0.22), (-0.3, s_ * 0.42, 0.14), (-0.2, s_ * 0.1, 0.06)], '#2b2f3a', thick=0.02)
        p.sphere((0.32, s_ * 0.06, 0.1), 0.025, '#a78bfa', mat='glow', seg=(5, 4))
    m.finish()
    # 🪝 v0.55 Udica (Pecko Q) — kuka na kraju lanca (lanac rasteže three.js), leti prema +X
    m = Model('proj_hook')
    p = m.part('mesh')
    p.cyl((-0.3, 0, 0), (0.12, 0, 0), 0.045, 0.04, '#9ca3af', seg=10)
    p.sphere((-0.3, 0, 0), 0.07, '#6b7280', seg=(8, 6))
    pts = p.arc((0.12, 0, -0.16), 0.16, 90, -120, 10, 0.045, '#e5e7eb', plane='xz', seg=8)
    tp = Vector(pts[-1])
    p.cyl(tuple(tp), tuple(tp + Vector((0.12, 0, 0.1))), 0.045, 0.0, '#f8fafc', seg=8)
    p.cyl(tuple(tp + Vector((0.04, 0, 0.03))), tuple(tp + Vector((0.0, 0, 0.12))), 0.025, 0.0, '#f8fafc', seg=6)
    m.finish()
    # 🌬️ v0.55 Snježni nalet (Inja W) — široki ledeni polumjesec vjetra s pahuljicama
    m = Model('proj_gust')
    p = m.part('mesh')
    for k, (rad, col_, th) in enumerate(((0.42, '#e0f2fe', 0.05), (0.34, '#bae6fd', 0.04), (0.26, '#f0f9ff', 0.03))):
        p.arc((-0.12 - k * 0.06, 0, 0.0), rad, -70, 70, 14, th, col_, plane='xy', mat='glow', seg=6)
    for k in range(5):
        a = RAD(-56 + k * 28)
        c0 = (math.cos(a) * 0.46 - 0.1, math.sin(a) * 0.46, 0.0)
        for j in range(3):
            b_ = RAD(j * 60)
            d = Vector((math.cos(b_), 0, math.sin(b_))) * 0.05
            p.cyl(tuple(Vector(c0) - d), tuple(Vector(c0) + d), 0.012, 0.012, '#ffffff', mat='glow', seg=4)
    m.finish()
    # vrh jezika (Skokica) — tijelo jezika rasteže three.js
    m = Model('proj_tongue')
    p = m.part('mesh')
    p.sphere((0, 0, 0), (0.22, 0.17, 0.14), '#f472b6', seg=(10, 7))
    p.sphere((0.08, 0, 0.05), (0.1, 0.08, 0.05), '#fbcfe8', seg=(8, 5))
    m.finish()


# ------------------------------------------------------------------ EFEKTI MOĆI
def build_coin():
    """zlatnik (iskače pri last-hitu) — lice okrenuto duž Y, da se u igri vrti oko uspravne osi"""
    m = Model('fx_coin')
    p = m.part('mesh')
    p.cyl((0, -0.05, 0), (0, 0.05, 0), 0.32, 0.32, '#e0a800', seg=18)
    p.cyl((0, -0.06, 0), (0, 0.06, 0), 0.25, 0.25, '#ffd54a', seg=18)
    for s_ in (1, -1):   # zvjezdica na oba lica
        for k in range(5):
            a = RAD(90 + k * 72)
            p.cyl((0, s_ * 0.065, 0), (math.cos(a) * 0.16, s_ * 0.065, math.sin(a) * 0.16), 0.05, 0.0, '#fff3b0', mat='glow', seg=4)
    m.finish()


def build_fx():
    build_coin()
    # meteor (pada s neba; plamen prema +Z)
    m = Model('fx_meteor')
    p = m.part('mesh')
    p.ico((0, 0, 0), 0.5, '#4b5563', sub=1, jitter=0.18, seed=5)
    p.ico((0.2, 0.15, 0.2), 0.25, '#374151', sub=1, jitter=0.2, seed=6)
    for z, r, c in ((0.45, 0.42, '#ff7a1a'), (0.8, 0.3, '#ffb020'), (1.08, 0.18, '#ffe26b')):
        p.sphere((0, 0, z), (r, r, r * 1.3), c, mat='glow', seg=(10, 7))
    m.finish()
    # korijenje (izbija iz tla)
    m = Model('fx_root')
    p = m.part('mesh')
    for a, h, lean in ((0, 1.0, 0.35), (120, 0.8, 0.3), (240, 0.9, 0.4)):
        ca, sa = math.cos(RAD(a)), math.sin(RAD(a))
        base = (ca * 0.12, sa * 0.12, 0)
        mid = (ca * (0.12 + lean * 0.5), sa * (0.12 + lean * 0.5), h * 0.55)
        top = (ca * (0.12 + lean), sa * (0.12 + lean), h)
        p.cyl(base, mid, 0.14, 0.09, '#6b4423', seg=6)
        p.cyl(mid, top, 0.09, 0.0, '#8a5a2b', seg=6)
        p.sphere(top, (0.1, 0.06, 0.04), '#4caf50', seg=(6, 4))
    m.finish()
    # ledeni kristali (Ledeno doba)
    m = Model('fx_ice')
    p = m.part('mesh')
    for a, h, r in ((0, 1.1, 0.22), (90, 0.75, 0.17), (200, 0.9, 0.19), (290, 0.6, 0.14)):
        ca, sa = math.cos(RAD(a)), math.sin(RAD(a))
        c = (ca * 0.25, sa * 0.25, h * 0.45)
        p.ico(c, (r, r, h * 0.55), '#9ae6ff', mat='glow', sub=0, rot=(sa * 18, -ca * 18, a))
        p.ico((c[0], c[1], h * 0.85), (r * 0.4, r * 0.4, h * 0.2), '#eefaff', mat='glow', sub=0, rot=(sa * 18, -ca * 18, a))
    m.finish()
    # val (prsten vode s pjenom) — širi se u igri
    m = Model('fx_wave')
    p = m.part('mesh')
    p.arc((0, 0, 0.1), 1.0, 0, 360, 24, 0.18, '#3b9fe0', plane='xy', seg=8)
    for k in range(12):
        a = RAD(k * 30)
        p.sphere((math.cos(a) * 1.0, math.sin(a) * 1.0, 0.26), (0.14, 0.14, 0.1), '#eaf7ff', mat='glow', seg=(7, 5))
    m.finish()
    # zvijezda (omama, Zvjezdana kiša) — uspravna, gleda prema kameri
    m = Model('fx_star')
    p = m.part('mesh')
    pts = []
    for i in range(10):
        a = RAD(90 + i * 36)
        r = 0.5 if i % 2 == 0 else 0.22
        pts.append((math.cos(a) * r, 0, math.sin(a) * r))
    p.poly(pts, '#fde047', mat='glow', thick=0.08)
    m.finish()
    # srce (liječenje)
    m = Model('fx_heart')
    p = m.part('mesh')
    p.sphere((0.14, 0, 0.12), 0.2, '#f43f5e', seg=(10, 7))
    p.sphere((-0.14, 0, 0.12), 0.2, '#f43f5e', seg=(10, 7))
    p.cyl((0, 0, -0.32), (0, 0, 0.1), 0.0, 0.3, '#f43f5e', seg=8)
    p.sphere((0.1, -0.12, 0.25), 0.05, '#ffd1dc', seg=(6, 4))
    m.finish()
    # duh (diže se kad junak pogine) — lice gleda prema -Y (prema kameri u igri)
    m = Model('fx_ghost')
    p = m.part('mesh')
    p.sphere((0, 0, 0.45), (0.36, 0.33, 0.36), '#f8fafc', seg=(12, 9))
    p.cyl((0, 0, 0.45), (0, 0, 0.0), 0.36, 0.3, '#f8fafc', seg=10, smooth=True)
    for k in range(3):
        a = RAD(k * 120 + 90)
        p.sphere((math.cos(a) * 0.22, math.sin(a) * 0.22, 0.0), (0.14, 0.14, 0.16), '#f8fafc', seg=(8, 6))
    for s in (1, -1):
        p.sphere((s * 0.13, -0.3, 0.52), (0.07, 0.04, 0.09), '#1f2937', seg=(8, 6))
    p.sphere((0, -0.34, 0.36), (0.07, 0.03, 0.05), '#1f2937', seg=(8, 5))
    m.finish()
    # nadgrobni kamen s cvijetom (gdje je junak pao)
    m = Model('fx_tomb')
    p = m.part('mesh')
    p.box((0, 0, 0.32), (0.42, 0.18, 0.62), '#9ca3af', bevel=0.04)
    p.sphere((0, 0, 0.62), (0.21, 0.09, 0.2), '#9ca3af', seg=(10, 7))
    p.sphere((0, 0, 0.02), (0.5, 0.4, 0.1), '#7a4b25', seg=(10, 6))
    p.cyl((0.22, -0.12, 0.05), (0.26, -0.14, 0.3), 0.015, 0.012, '#4caf50', seg=4)
    p.sphere((0.26, -0.14, 0.32), 0.06, '#f9a8d4', seg=(7, 5))
    m.finish()
    build_spell_fx()


def build_spell_fx():
    """posebni 3D efekti magija (u igri prozirni, aditivni sjaj)"""
    rnd = random.Random(14)
    # 🌪️ tornado (Lavkov Vrtlog): lijevak od spiralnih traka vjetra, prstenova i krhotina
    m = Model('fx_tornado')
    p = m.part('mesh')
    R = lambda t: 0.1 + 0.42 * t ** 1.3
    cols = ('#fff7d6', '#fde68a', '#fbbf24')
    for k in range(4):
        prev = None
        for i in range(29):
            t = i / 28
            a = RAD(t * 760 + k * 90)
            pt = (math.cos(a) * R(t), math.sin(a) * R(t), t * 1.1)
            if prev:
                p.cyl(prev, pt, 0.018 + 0.02 * t, 0.018 + 0.02 * t, cols[k % 3], mat='glow', seg=4)
            prev = pt
    for t in (0.18, 0.4, 0.62, 0.84):
        p.arc((0.03 * math.sin(t * 9), 0.03 * math.cos(t * 9), t * 1.1), R(t) * 1.06, 0, 300, 14, 0.012, '#fffbeb', plane='xy', mat='glow', seg=4)
    for i in range(10):   # lišće i kamenčići koje vjetar nosi
        t = 0.15 + rnd.random() * 0.8
        a = rnd.random() * math.tau
        c = (math.cos(a) * R(t) * 1.15, math.sin(a) * R(t) * 1.15, t * 1.1)
        if i % 2:
            p.poly([c, (c[0] + 0.05, c[1] + 0.02, c[2] + 0.03), (c[0] + 0.08, c[1], c[2] - 0.01), (c[0] + 0.03, c[1] - 0.02, c[2] - 0.03)],
                   '#86efac', mat='glow', thick=0.008)
        else:
            p.ico(c, 0.025, '#d6c7a1', mat='glow', sub=0, jitter=0.2, seed=i)
    p.sphere((0, 0, 0.02), (0.3, 0.3, 0.03), '#fde68a', mat='glow', seg=(14, 4))   # prašina pri tlu
    m.finish()
    # 💍 plameni prsten (Žarkov Plameni krug): krug plamenih jezika oko junaka, polumjer 1
    m = Model('fx_firering')
    p = m.part('mesh')
    n = 22
    for i in range(n):
        a = RAD(i * 360 / n + rnd.uniform(-4, 4))
        ca, sa = math.cos(a), math.sin(a)
        h = 0.45 + rnd.random() * 0.35
        lean = 0.06 + rnd.random() * 0.05
        b0 = (ca, sa, 0.0)
        tip = (ca * (1 + lean), sa * (1 + lean), h)
        p.sphere((ca, sa, 0.06), (0.11, 0.11, 0.1), '#ff5a0a', mat='glow', seg=(8, 6))
        p.cyl(b0, tip, 0.11, 0.0, '#ff5a0a', mat='glow', seg=6)
        p.cyl((ca, sa, 0.0), (ca * (1 + lean * 0.6), sa * (1 + lean * 0.6), h * 0.7), 0.07, 0.0, '#ffb020', mat='glow', seg=5)
        p.cyl((ca, sa, 0.0), (ca * (1 + lean * 0.3), sa * (1 + lean * 0.3), h * 0.38), 0.04, 0.0, '#fff1a8', mat='glow', seg=4)
        if i % 3 == 0:   # iskre iznad plamena
            p.ico((ca * (1 + lean * 1.4), sa * (1 + lean * 1.4), h + 0.12 + rnd.random() * 0.1), 0.025, '#ffe26b', mat='glow', sub=0)
    p.arc((0, 0, 0.02), 1.0, 0, 360, 36, 0.05, '#ff7a1a', plane='xy', mat='glow', seg=5)
    p.arc((0, 0, 0.01), 0.9, 0, 360, 36, 0.025, '#7c2d12', plane='xy', mat='glow', seg=4)
    m.finish()
    # 🌩️ olujni oblak (Munjin Gnjev oluje): tamni kumulus s ljubičastim sjajem ispod
    m = Model('fx_cloud')
    p = m.part('mesh')
    for i in range(16):
        a = rnd.random() * math.tau
        d = rnd.random() ** 0.6 * 0.75
        c = (math.cos(a) * d, math.sin(a) * d, rnd.uniform(-0.04, 0.12) + (0.75 - d) * 0.25)
        r = 0.28 + rnd.random() * 0.2
        shade = mix('#3f3d56', '#6b6890', rnd.random())
        p.sphere(c, (r, r, r * 0.7), shade, seg=(12, 8))
    for i in range(7):   # svjetlije kupole na vrhu
        a = rnd.random() * math.tau
        d = rnd.random() * 0.5
        p.sphere((math.cos(a) * d, math.sin(a) * d, 0.28 + rnd.random() * 0.08), (0.24, 0.24, 0.18), '#8e8bb0', seg=(12, 8))
    for i in range(6):   # ljubičasti bljesak u trbuhu oblaka
        a = i / 6 * math.tau + 0.3
        p.sphere((math.cos(a) * 0.4, math.sin(a) * 0.4, -0.12), (0.16, 0.16, 0.06), '#c4b5fd', seg=(10, 6))
    p.sphere((0, 0, -0.14), (0.62, 0.62, 0.1), '#2e2b45', seg=(16, 6))
    m.finish()


# ------------------------------------------------------------------ RUNE
def build_runes():
    # 💨 brzina: zeleno-žuti vrtlog vjetra
    m = Model('rune_haste')
    p = m.part('mesh')
    p.arc((0, 0, 0.5), 0.3, 0, 300, 10, 0.06, '#bef264', plane='xy', mat='glow')
    p.arc((0, 0, 0.5), 0.16, 60, 360, 8, 0.045, '#d9f99d', plane='xy', mat='glow')
    p.ico((0, 0, 0.5), 0.12, '#fef08a', mat='glow', sub=0)
    m.finish()
    # 💚 obnova: zeleno srce
    m = Model('rune_regen')
    p = m.part('mesh')
    p.sphere((0.14, 0, 0.62), 0.2, '#4ade80', mat='glow', seg=(10, 7))
    p.sphere((-0.14, 0, 0.62), 0.2, '#4ade80', mat='glow', seg=(10, 7))
    p.cyl((0, 0, 0.18), (0, 0, 0.6), 0.0, 0.3, '#4ade80', mat='glow', seg=8)
    m.finish()
    # ⚔️ dvostruka šteta: crveni dvostruki kristal
    m = Model('rune_double')
    p = m.part('mesh')
    p.ico((0, 0, 0.5), (0.2, 0.2, 0.5), '#f87171', mat='glow', sub=0)
    p.ico((0, 0, 0.5), (0.32, 0.32, 0.18), '#fca5a5', mat='glow', sub=0, rot=(0, 0, 45))
    m.finish()
    # 🛡️ štit: plavi štit
    m = Model('rune_shield')
    p = m.part('mesh')
    p.cyl((0, -0.06, 0.5), (0, 0.06, 0.5), 0.4, 0.4, '#60a5fa', mat='glow', seg=10)
    p.cyl((0, -0.1, 0.5), (0, -0.05, 0.5), 0.3, 0.3, '#bfdbfe', mat='glow', seg=10)
    p.ico((0, -0.14, 0.5), 0.1, '#ffffff', mat='glow', sub=0)
    m.finish()


def build_runes_v15():
    # 💰 runa zlata: vrećica zlatnika vezana vrpcom, oko nje zlatnici
    m = Model('rune_bounty')
    p = m.part('mesh')
    p.sphere((0, 0, 0.42), (0.3, 0.3, 0.28), '#c08a3e', seg=(16, 10))
    p.sphere((0, 0, 0.3), (0.32, 0.32, 0.16), '#a8742f', seg=(16, 8))
    p.cyl((0, 0, 0.62), (0, 0, 0.72), 0.13, 0.1, '#a8742f', seg=12)
    p.arc((0, 0, 0.64), 0.135, 0, 360, 14, 0.02, '#dc2626', plane='xy', seg=5)
    for k in range(5):   # rub vrećice
        a = RAD(k * 72)
        p.sphere((math.cos(a) * 0.1, math.sin(a) * 0.1, 0.76), (0.06, 0.06, 0.05), '#c08a3e', seg=(8, 5))
    p.cyl((0.0, -0.29, 0.42), (0.0, -0.31, 0.42), 0.12, 0.12, '#ffd54a', mat='glow', seg=16)   # zlatni znak
    for k in range(4):
        a = RAD(30 + k * 90)
        c = (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.08 + k * 0.03)
        p.cyl((c[0], c[1], c[2] - 0.025), (c[0], c[1], c[2] + 0.025), 0.1, 0.1, '#ffd54a', seg=14)
        p.cyl((c[0], c[1], c[2] + 0.02), (c[0], c[1], c[2] + 0.03), 0.07, 0.07, '#fff3b0', mat='glow', seg=12)
    m.finish()
    # 📘 runa mudrosti: otvorena plava knjiga sa svjetlucavim stranicama
    m = Model('rune_wisdom')
    p = m.part('mesh')
    for sd in (1, -1):
        p.box((0, sd * 0.2, 0.45), (0.48, 0.38, 0.05), '#1d4ed8', rot=(sd * 14, 0, 0), bevel=0.01)          # korice
        p.box((0, sd * 0.19, 0.48), (0.44, 0.34, 0.04), '#f8fafc', rot=(sd * 14, 0, 0), bevel=0.006)        # stranice
        for k in range(3):   # retci
            p.box((-0.1 + k * 0.1, sd * 0.19, 0.505 + 0.04 * abs(sd) * 0), (0.02, 0.26, 0.004), '#93c5fd', mat='glow', rot=(sd * 14, 0, 0))
    p.cyl((0, 0, 0.4), (0, 0, 0.5), 0.03, 0.03, '#f6c945', seg=8)
    p.ico((0, 0, 0.78), 0.08, '#bfdbfe', mat='glow', sub=1)
    for k in range(5):   # iskrice iznad knjige
        a = RAD(k * 72)
        p.ico((math.cos(a) * 0.22, math.sin(a) * 0.22, 0.7 + 0.06 * (k % 2)), 0.03, '#dbeafe', mat='glow', sub=0)
    m.finish()
    # 🌰 škrinjica neutralnog predmeta (iskoči iz čudovišta)
    m = Model('fx_nchest')
    p = m.part('mesh')
    p.box((0, 0, 0.25), (0.5, 0.36, 0.3), '#4d7c0f', bevel=0.03)
    p.sphere((0, 0, 0.4), (0.26, 0.19, 0.13), '#65a30d', seg=(14, 8))
    for dx in (-0.18, 0.18):
        p.box((dx, 0, 0.3), (0.04, 0.38, 0.42), '#f6c945', bevel=0.008)
    p.sphere((0.26, 0, 0.36), (0.04, 0.07, 0.08), '#f6c945', seg=(8, 6))
    p.sphere((0, 0, 0.7), (0.1, 0.1, 0.12), '#a16207', seg=(10, 7))           # žir na poklopcu
    p.sphere((0, 0, 0.79), (0.11, 0.11, 0.05), '#713f12', seg=(10, 5))
    p.ico((0, 0, 0.55), 0.06, '#d9f99d', mat='glow', sub=1)
    m.finish()


# ------------------------------------------------------------------ AMBIJENTALNA OKLUZIJA
def smooth01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def hash3(x, y, z):
    h = math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
    return h - math.floor(h)


NATURE_PREFIX = ('tree_', 'bush', 'rock', 'grass', 'flowers', 'reeds', 'stump', 'mushroom', 'log', 'lilypad', 'cliff')   # blaži svjetliji vrh (krošnje su već osunčane)


def paint_color(c, a, t, nz, up=0.0):
    """v0.29 ručno oslikani izgled (kao teksture u LoL-u): okluzija a (0–1) s hladnijim sjenama,
    svjetliji vrh modela t (0 = dno, 1 = vrh), toplije svjetlo i blagi šum poteza kistom nz.
    v0.38: up = smjer normale prema gore (−1…1) — plohe okrenute nebu dobiju topli odsjaj,
    one okrenute tlu hladniju sjenu (oblici izgledaju "oblije" i iz kamere odozgo)"""
    k = 0.55 + 0.45 * min(1.0, a * 1.15)
    g = 0.83 + 0.26 * smooth01(t)
    s = (1.0 - k) / 0.45                 # 0 = izloženo, 1 = najdublja sjena
    lit = 0.95 + 0.09 * up               # ploha prema nebu svjetlija
    warm = max(0.0, up) * 0.035          # topli odsjaj odozgo
    cool = max(0.0, -up) * 0.05          # hladna sjena odozdo
    v = k * g * lit * (1.0 + nz)
    return (min(1.0, c[0] * v * (1.0 - 0.10 * s + 0.03 * t + warm - cool * 0.6)),
            min(1.0, c[1] * v * (1.0 - 0.03 * s + warm * 0.5)),
            min(1.0, c[2] * v * (1.0 + 0.07 * s - 0.03 * t - warm * 0.8 + cool)), c[3])


def bake_ao(samples=32, do_ao=True):
    """Ispeče ambijentalnu okluziju (Cycles) u boje vrhova: udubine, spojevi i
    unutrašnjost krošnje postanu tamniji — modeli dobiju dubinu bez ikakvog
    troška u igri. Svijetleći dijelovi (glow) se preskaču.
    v0.29: uz okluziju i "oslikani" prijelaz po visini modela, hladne sjene i šum kista
    (do_ao=False: samo oslikani prolaz, za brze provjere)."""
    sc = bpy.context.scene
    roots = [o for o in sc.objects if o.parent is None and o.type == 'EMPTY']
    for i, r in enumerate(roots):   # razmakni modele da se međusobno ne zasjenjuju
        r.location = ((i % 10) * 14.0, (i // 10) * 14.0, 0.0)
    meshes = [o for o in sc.objects if o.type == 'MESH']
    for ob in meshes:
        if ob.animation_data:
            for tr in ob.animation_data.nla_tracks:
                tr.mute = True
    bpy.context.view_layer.update()
    zr = {}   # visinski raspon svakog modela (za prijelaz od tamnijeg dna prema svjetlijem vrhu)
    for r in roots:
        zs = [(ob.matrix_world @ v.co).z for ob in r.children_recursive if ob.type == 'MESH' for v in ob.data.vertices]
        zr[r.name] = (min(zs), max(zs)) if zs else (0.0, 1.0)
    if do_ao:
        sc.render.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = samples
        sc.render.bake.target = 'VERTEX_COLORS'
        sc.render.bake.use_selected_to_active = False
    t0 = time.time()
    n = 0
    for ob in meshes:
        me = ob.data
        if not me.polygons:
            continue
        ao = None
        if do_ao:
            ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')   # po vrhu: glatki prijelazi, vrhovi se dijele
            me.color_attributes.active_color = ao
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            try:
                bpy.ops.object.bake(type='AO')
            except RuntimeError as e:
                print('AO nije uspio za', ob.name, e)
                me.color_attributes.remove(ao)
                ao = None
        root = ob
        while root.parent:
            root = root.parent
        z0, z1 = zr.get(root.name, (0.0, 1.0))
        span = max(1e-3, z1 - z0)
        nature = root.name.startswith(NATURE_PREFIX)
        mw, rl = ob.matrix_world, root.location
        wp = [mw @ v.co - rl for v in me.vertices]   # položaj u prostoru modela (bez razmaka za pečenje)
        m3 = mw.to_3x3()
        wn = [(m3 @ v.normal).normalized().z for v in me.vertices]   # v0.38: normala prema gore
        col = me.color_attributes['Col']
        for poly in me.polygons:
            if poly.material_index in (SLOT['glow'], SLOT['teamglow']):
                continue
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                a = ao.data[vi].color[0] if ao else 1.0
                p = wp[vi]
                nz = (hash3(p.x * 14.0, p.y * 14.0, p.z * 14.0) - 0.5) * 0.05
                col.data[li].color = paint_color(col.data[li].color, a, (p.z + rl.z - z0) / span * (0.6 if nature else 1.0), nz,
                                                 wn[vi] * (0.6 if nature else 1.0))
        if ao:
            me.color_attributes.remove(ao)
        col = me.color_attributes['Col']
        me.color_attributes.active_color = col
        me.color_attributes.render_color_index = me.color_attributes.find('Col')
        n += 1
    for ob in meshes:
        if ob.animation_data:
            for tr in ob.animation_data.nla_tracks:
                tr.mute = False
    for r in roots:
        r.location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    print('%s: %d objekata, %.0f s' % ('AO + oslikavanje' if do_ao else 'oslikavanje', n, time.time() - t0))


# ------------------------------------------------------------------ IZVOZ
def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_yup=True, export_apply=False,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_merge_animation='NLA_TRACK',
        export_force_sampling=True, export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_object=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True, export_materials='EXPORT', export_extras=False,
        export_cameras=False, export_lights=False)


def preview(path, only=None, cols=8, zoom=1.0):
    """Cycles render modela u mreži — samo za provjeru."""
    sc = bpy.context.scene
    roots = [o for o in sc.objects if o.parent is None and o.type == 'EMPTY']
    if only:
        for o in roots:
            if not any(o.name.startswith(k) for k in only):
                o.location = (0, 0, -100)
        roots = [o for o in roots if any(o.name.startswith(k) for k in only)]
    for i, r in enumerate(roots):
        big = r.name in ('tower', 'ancient', 'fountain')
        r.location = ((i % cols) * 2.6, -(i // cols) * 3.2, 0)
        if big:
            r.scale = (0.45, 0.45, 0.45)
    rows = (len(roots) + cols - 1) // cols
    cx, cy = (cols - 1) * 2.6 / 2, -(rows - 1) * 3.2 / 2
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    # mreža je zarotirana 45° prema kameri: pokrij dijagonalu (širina + visina mreže)
    cam.data.ortho_scale = ((cols * 2.6 + rows * 3.2) * 0.72 + 3) / zoom
    cam.location = (cx + 14, cy - 14, 14)
    cam.rotation_euler = (RAD(58), 0, RAD(45))
    # usmjeri kameru u središte
    d = Vector((cx, cy, 0.8)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (RAD(40), RAD(10), RAD(30))
    sc.collection.objects.link(sun)
    world = bpy.data.worlds.new('w')
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.7, 0.85, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    ground = bpy.data.meshes.new('g')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=60)
    bm.to_mesh(ground)
    gob = bpy.data.objects.new('ground', ground)
    sc.collection.objects.link(gob)
    gm = bpy.data.materials.new('gm')
    try:
        gm.use_nodes = True
    except Exception:
        pass
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.25, 0.45, 0.18, 1)
    ground.materials.append(gm)
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 24
    sc.cycles.use_denoising = False
    sc.render.resolution_x = 1800
    sc.render.resolution_y = 1800
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    reset_scene()
    make_materials()
    if '--dev-v20' in argv:
        build_cliffs()
        preview(os.path.join(HERE, 'preview_v20.png'), only=['cliff'], cols=3, zoom=2.2)
        return
    if '--dev-v19' in argv:   # brza provjera Scourge modela (bez izvoza)
        build_tower()
        build_barracks()
        build_scourge()
        preview(os.path.join(HERE, 'preview_v19.png'), only=['tower', 'ancient', 'fountain', 'barracks', 'wall', 'tree_dead', 'tree_dpine', 'bones'], cols=5, zoom=1.6)
        return
    if '--dev-v38' in argv:   # brza provjera novih junaka v0.38 (bez izvoza)
        global METAL_SET
        METAL_SET = CHAR_METAL
        for hid in ('nisan', 'bikos'):
            c, o = HEROES[hid]
            biped('hero_' + hid, c, dict(o))
        METAL_SET = set()
        build_projectiles()
        bake_ao(do_ao=False)
        preview(os.path.join(HERE, 'preview_v38.png'), only=['hero_'], cols=2, zoom=2.4)
        return
    if '--dev-v15' in argv:   # brza provjera novih junaka (bez izvoza)
        for hid in ('jednorog', 'morskipas'):
            c, o = HEROES[hid]
            biped('hero_' + hid, c, dict(o))
        build_projectiles()
        build_runes_v15()
        preview(os.path.join(HERE, 'preview_v15.png'), only=['hero_', 'proj_rainbow', 'rune_', 'fx_nchest'], cols=3, zoom=2.0)
        return
    if '--dev-v47' in argv:   # brza provjera fenjera i svjetlećih gljiva (bez izvoza)
        build_env()
        preview(os.path.join(HERE, 'preview_v47.png'), only=['lantern', 'mushglow', 'torch', 'campfire'], cols=5, zoom=2.4)
        return
    if '--dev-v52' in argv:   # v0.52 brza provjera junaka (bez izvoza):  --only=vitez,zarko  --cols=4  --zoom=1.5  --out=put.png
        arg = lambda k, d: next((a[len(k) + 3:] for a in argv if a.startswith('--' + k + '=')), d)
        only = arg('only', '')
        build_heroes(only.split(',') if only else None)
        bake_ao(do_ao='--ao' in argv)
        preview(arg('out', os.path.join(HERE, 'preview_v52.png')), only=['hero_'], cols=int(arg('cols', '4')), zoom=float(arg('zoom', '1.0')))
        return
    if '--dev-v53' in argv:   # v0.53 portreti/lica izbliza (bez izvoza):  --only=sova,vuk  --out=mapa  --samples=32  --ao
        arg = lambda k, d: next((a[len(k) + 3:] for a in argv if a.startswith('--' + k + '=')), d)
        only = [x for x in arg('only', '').split(',') if x]
        build_heroes(only or None)
        bake_ao(do_ao='--ao' in argv)
        pal = dict(PORTRAIT_BG)
        render_portraits([(h, pal.get(h, '#4a5a7a')) for h in (only or list(HEROES))], size=int(arg('size', '512')),
                         outdir=arg('out', HERE), samples=int(arg('samples', '32')))
        return
    if '--dev-v55' in argv:   # v0.55 novi junaci + udica i nalet (bez izvoza):  --out=put.png  --zoom=2.2
        arg = lambda k, d: next((a[len(k) + 3:] for a in argv if a.startswith('--' + k + '=')), d)
        build_heroes(['nilski', 'irbis', 'skorpion'])
        build_projectiles()
        bake_ao(do_ao='--ao' in argv)
        preview(arg('out', os.path.join(HERE, 'preview_v55.png')), only=['hero_nilski', 'hero_irbis', 'hero_skorpion', 'proj_hook', 'proj_gust'],
                cols=int(arg('cols', '5')), zoom=float(arg('zoom', '2.0')))
        return
    if '--dev-v56' in argv:   # v0.56 gušter iz malog kampa uz veprića (bez izvoza):  --out=put.png
        arg = lambda k, d: next((a[len(k) + 3:] for a in argv if a.startswith('--' + k + '=')), d)
        build_neutrals()
        bake_ao(do_ao=False)
        preview(arg('out', os.path.join(HERE, 'preview_v56.png')), only=['mob_lizard', 'mob_boars'], cols=2, zoom=2.4)
        return
    if '--dev-v14' in argv:   # brza provjera novih modela (bez izvoza)
        build_courier()
        build_spell_fx()
        preview(os.path.join(HERE, 'preview_courier.png'), cols=2, zoom=2.4)
        return
    build_heroes()
    build_creeps()
    build_neutrals()
    build_tower()
    build_barracks()
    build_scourge()
    build_cliffs()
    build_nature()
    build_env()
    build_golem()
    build_courier()
    build_projectiles()
    build_fx()
    build_runes()
    build_runes_v15()
    bake_ao(do_ao='--no-ao' not in argv)   # v0.29: oslikani prolaz radi i bez AO
    os.makedirs(ASSETS, exist_ok=True)
    glb = os.path.join(ASSETS, 'models.glb')
    export(glb)
    data = open(glb, 'rb').read()
    with open(os.path.join(ASSETS, 'models.js'), 'w') as f:
        f.write('/* generirano: tools/blender/build_models.py — ne uređuj ručno */\n')
        f.write('window.MODELS_GLB_B64 = "%s";\n' % base64.b64encode(data).decode('ascii'))
    print('GLB: %.1f KB' % (len(data) / 1024))
    if WANT_PREVIEW:
        preview(os.path.join(HERE, 'preview.png'), cols=10)
    elif '--preview-heroes' in argv:
        preview(os.path.join(HERE, 'preview_heroes.png'), only=['hero_', 'creep_'], cols=4)
    elif '--preview-fx' in argv:
        preview(os.path.join(HERE, 'preview_fx.png'), only=['proj_', 'fx_', 'rune_'], cols=6)
    elif '--preview-v14' in argv:
        preview(os.path.join(HERE, 'preview_v14.png'), only=['courier', 'fx_tornado', 'fx_firering', 'fx_cloud', 'hero_pcela', 'hero_hobotnica'], cols=3, zoom=2.2)
    elif '--preview-courier' in argv:
        preview(os.path.join(HERE, 'preview_courier.png'), only=['courier'], cols=1, zoom=3.0)
    elif '--preview-new' in argv:
        preview(os.path.join(HERE, 'preview_new.png'), only=['tree_birch', 'stump', 'flowers', 'grass0', 'reeds', 'lilypad', 'crystal', 'campfire',
                                                               'tent', 'barrel', 'crate', 'fence', 'torch', 'ford', 'shrine', 'rock_big', 'signpost', 'mob_golem'], cols=5)
    if '--portraits' in argv:
        render_portraits([pb for pb in PORTRAIT_BG if pb[0] in ('vuk', 'gavran', 'hobotnica', 'nosorog', 'panda')])
    if '--portraits-v15' in argv:
        render_portraits([pb for pb in PORTRAIT_BG if pb[0] in ('jednorog', 'morskipas')])
    if '--portraits-v38' in argv:
        render_portraits([pb for pb in PORTRAIT_BG if pb[0] in ('nisan', 'bikos')])
    if '--portraits-all' in argv:   # v0.53: svih 14 portreta iz modela
        render_portraits(PORTRAIT_BG)

main()
