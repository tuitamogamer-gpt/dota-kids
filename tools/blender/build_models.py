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

SLOT = {'vc': 0, 'team': 1, 'glow': 2, 'teamglow': 3}
MATS = []

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
        before = set(self.bm.faces)
        bmesh.ops.create_uvsphere(self.bm, u_segments=seg[0], v_segments=seg[1],
                                  radius=1.0, matrix=self.M(c, rot, r))
        self._paint(before, color, mat, smooth)
        return self

    def ico(self, c, r, color, mat='vc', rot=(0, 0, 0), sub=1, smooth=False, jitter=0.0, seed=1):
        if isinstance(r, (int, float)):
            r = (r, r, r)
        before = set(self.bm.faces)
        ret = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0,
                                         matrix=self.M(c, rot, r))
        if jitter:
            rnd = random.Random(seed)
            ctr = Vector(c) - self.pivot
            for v in ret['verts']:
                d = v.co - ctr
                v.co = ctr + d * (1 + rnd.uniform(-jitter, jitter))
        self._paint(before, color, mat, smooth)
        return self

    def box(self, c, size, color, mat='vc', rot=(0, 0, 0), bevel=0.0, smooth=False):
        before = set(self.bm.faces)
        ret = bmesh.ops.create_cube(self.bm, size=1.0, matrix=self.M(c, rot, size))
        if bevel:
            edges = list({e for v in ret['verts'] for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=1,
                            affect='EDGES', profile=0.5)
        self._paint(before, color, mat, smooth)
        return self

    def cyl(self, p1, p2, r1, r2, color, mat='vc', seg=10, smooth=False, caps=True):
        """valjak/stožac od točke p1 (polumjer r1) do p2 (polumjer r2)"""
        p1, p2 = Vector(p1), Vector(p2)
        d = p2 - p1
        L = d.length
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        m = (Matrix.Translation((p1 + p2) / 2 - self.pivot) @ q.to_matrix().to_4x4())
        before = set(self.bm.faces)
        bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg,
                              radius1=r1, radius2=r2, depth=L, matrix=m)
        self._paint(before, color, mat, smooth)
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
    # ---- ATTACK (14 kadrova ≈ 0.58 s; udarac u ~7. kadru)
    if kind == 'melee':
        atk = {
            'armR': [(0, Z), (4, (8, -165, 0)), (7, (-6, -35, 0)), (10, (0, -25, 0)), (14, Z)],
            'armL': [(0, Z), (4, (0, -30, 0)), (7, (0, 15, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -6, 10), Z), (7, (0, 14, -14), (0.06, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (4, (0, 4, 0)), (7, (0, -6, 0)), (14, Z)],
        }
    elif kind == 'claws':
        atk = {
            'armR': [(0, Z), (3, (30, -120, 0)), (6, (-20, -70, 0)), (14, Z)],
            'armL': [(0, Z), (5, (-30, -120, 0)), (9, (20, -70, 0)), (14, Z)],
            'body': [(0, Z, Z), (6, (0, 12, -10), (0.08, 0, 0)), (9, (0, 12, 10), (0.08, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (6, (0, -6, 0)), (14, Z)],
        }
    elif kind == 'bow':
        atk = {
            'armL': [(0, Z), (4, (0, -88, 0)), (9, (0, -88, 0)), (14, Z)],
            'armR': [(0, Z), (4, (0, -80, 0)), (7, (0, -60, 0), (-0.12, 0, 0)), (9, (0, -85, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -4, 18), Z), (8, (0, -6, 18), (-0.03, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (4, (0, 0, -12)), (14, Z)],
        }
    elif kind == 'wing':
        atk = {
            'armR': [(0, Z), (4, (60, -40, 0)), (7, (-10, -100, 0)), (14, Z)],
            'armL': [(0, Z), (4, (-60, -40, 0)), (7, (10, -100, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -8, 0), (0, 0, 0.06)), (7, (0, 12, 0), (0.05, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (7, (0, 8, 0)), (14, Z)],
        }
    else:  # mage
        atk = {
            'armR': [(0, Z), (4, (0, -150, 0)), (7, (0, -95, 0)), (10, (0, -90, 0)), (14, Z)],
            'armL': [(0, Z), (4, (-10, -20, 0)), (14, Z)],
            'body': [(0, Z, Z), (4, (0, -6, 0), Z), (7, (0, 10, 0), (0.04, 0, 0)), (14, Z, Z)],
            'head': [(0, Z), (7, (0, 6, 0)), (14, Z)],
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
        'armR': [(0, Z), (6, (14, -170, 0)), (10, (0, -80, 0)), (18, Z)],
        'armL': [(0, Z), (6, (-14, -170, 0)), (10, (0, -80, 0)), (18, Z)],
        'body': [(0, Z, Z), (6, (0, -8, 0), (0, 0, 0.12)), (10, (0, 10, 0), (0.04, 0, 0)), (18, Z, Z)],
        'head': [(0, Z), (6, (0, -12, 0)), (10, (0, 8, 0)), (18, Z)],
        'legL': [(0, Z), (6, (0, -18, 0)), (10, (0, 8, 0)), (18, Z)],
        'legR': [(0, Z), (6, (0, 14, 0)), (10, (0, -6, 0)), (18, Z)],
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


def brows(p, x, y, z, color, angle=12, spread=0.15):
    for s in (1, -1):
        p.box((x, s * spread, z), (0.03, 0.11, 0.025), color, rot=(s * angle, 0, 0), bevel=0.008)


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
    if opts.get('chest'):
        b.sphere(V(0.08, 0, 0.80), (0.22 * S, 0.27 * S, 0.17 * S), opts['chest'], seg=(14, 8))
    if opts.get('scarf'):
        b.cyl(V(0, 0, 0.93), V(0, 0, 1.01), 0.25 * S, 0.22 * S, '#ffffff', mat='team', seg=14, smooth=True)
        b.box(V(-0.21, 0.07, 0.84), (0.05 * S, 0.09 * S, 0.2 * S), '#d8d8d8', mat='team', rot=(0, -15, 10), bevel=0.012)
    if opts.get('cape'):
        b.poly([V(-0.17, 0.25, 1.0), V(-0.17, -0.25, 1.0), V(-0.34, -0.33, 0.42), V(-0.36, 0, 0.36), V(-0.34, 0.33, 0.42)],
               '#c8c8c8', mat='team', thick=0.02)
        b.cyl(V(-0.02, 0, 0.98), V(-0.02, 0, 1.02), 0.24 * S, 0.22 * S, '#ffffff', mat='team', seg=12)
    if opts.get('stripesBody'):
        for zz in (0.62, 0.76, 0.9):
            for s in (1, -1):
                b.box(V(-0.04, s * 0.27, zz), (0.16 * S, 0.03 * S, 0.035 * S), dark, rot=(s * -18, 0, 0))
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
    # krila na leđima
    if opts.get('wings'):
        wc = opts['wings']
        ws = opts.get('wingScale', 1.0)
        for side, nm in ((1, 'wingL'), (-1, 'wingR')):
            P = lambda x, y, z: V(-0.2 + (x + 0.2) * ws, side * (0.12 + (y - 0.12) * ws), 0.92 + (z - 0.92) * ws)
            w = m.part(nm, V(-0.2, side * 0.12, 0.92), 'body')
            w.cyl(P(-0.2, 0.12, 0.92), P(-0.36, 0.5, 1.22), 0.03 * S, 0.02 * S, dark, seg=6)
            w.cyl(P(-0.36, 0.5, 1.22), P(-0.42, 0.78, 1.0), 0.02 * S, 0.012 * S, dark, seg=6)
            w.cyl(P(-0.36, 0.5, 1.22), P(-0.36, 0.62, 0.86), 0.014 * S, 0.008 * S, dark, seg=4)
            w.poly([P(-0.2, 0.12, 0.92), P(-0.36, 0.5, 1.22), P(-0.42, 0.78, 1.0),
                    P(-0.36, 0.62, 0.86), P(-0.3, 0.42, 0.76)], wc, thick=0.012)
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
        if ey.get('white'):
            ws_ = ey.get('size', 1)
            for s in (1, -1):
                h.sphere(V(0.3, s * 0.15, 1.36), (0.06 * S, 0.095 * S * ws_, 0.11 * S * ws_), '#ffffff', seg=(10, 7))
        eyes(h, 0.335 * S, 0, 1.36 * S, r=0.078 * S * ey.get('size', 1), color=ey.get('color', '#1b1b2a'),
             spread=0.15 * S)
        bc = opts.get('brows', dark)
        if bc:
            brows(h, 0.355 * S, 0, 1.47 * S, bc, angle=opts.get('browAngle', 12), spread=0.15 * S)
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
    # posebni dodaci glave
    if opts.get('mane'):
        mc = opts['mane']
        for i in range(14):
            a = RAD(-100 + i * (200 / 13))
            y = math.cos(a) * 0.4
            z = 1.3 + math.sin(a) * 0.42
            h.sphere(V(-0.1, y, z), (0.16 * S, 0.15 * S, 0.15 * S), mc if i % 2 else mix(mc, '#000000', 0.15), seg=(10, 7))
        h.sphere(V(-0.2, 0, 1.3), (0.2 * S, 0.42 * S, 0.44 * S), mc)
        for i in range(8):
            a = RAD(-110 + i * (220 / 7))
            h.sphere(V(-0.26, math.cos(a) * 0.5, 1.3 + math.sin(a) * 0.5), (0.14 * S, 0.15 * S, 0.15 * S),
                     mix(mc, '#000000', 0.22), seg=(9, 6))
    if opts.get('horns'):
        hc = opts['horns']
        for s in (1, -1):
            h.cyl(V(-0.05, s * 0.18, 1.58), V(-0.25, s * 0.26, 1.86), 0.065 * S, 0.0, hc, seg=8)
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
    if opts.get('crescent'):
        h.arc(V(0.33, 0, 1.6), 0.08 * S, 40, 320, 8, 0.016 * S, '#fff3b0', plane='yz', mat='glow')
    if opts.get('hat') == 'beanie':
        h.sphere(V(-0.02, 0, 1.5), (0.37 * S, 0.39 * S, 0.24 * S), '#ffffff', mat='team', seg=(16, 8))
        h.cyl(V(-0.0, 0, 1.47), V(0, 0, 1.53), 0.4 * S, 0.4 * S, '#e8e8e8', seg=16, smooth=True)
        h.sphere(V(-0.06, 0, 1.78), 0.09 * S, '#ffffff')
    if opts.get('headband'):
        h.cyl(V(0, 0, 1.36), V(0, 0, 1.46), 0.415 * S, 0.395 * S, '#ffffff', mat='team', seg=18, caps=False)
        h.box(V(-0.42, 0.06, 1.36), (0.04 * S, 0.06 * S, 0.2 * S), '#dcdcdc', mat='team', rot=(20, 0, 0))
        h.box(V(-0.42, -0.06, 1.36), (0.04 * S, 0.06 * S, 0.2 * S), '#dcdcdc', mat='team', rot=(-20, 0, 0))
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
        # kapuljača: kalota preko tjemena i zatiljka, lice ostaje slobodno
        h.sphere(V(-0.13, 0, 1.39), (0.4 * S, 0.45 * S, 0.38 * S), '#ffffff', mat='team', seg=(16, 10))
        h.cyl(V(-0.32, 0, 1.12), V(-0.46, 0, 0.92), 0.1 * S, 0.0, '#d0d0d0', mat='team', seg=6)

    # potpisni detalji junaka
    if opts.get('shoulders'):
        for s in (1, -1):
            b.sphere(V(0.0, s * 0.3, 0.93), (0.1 * S, 0.11 * S, 0.08 * S), opts['shoulders'], seg=(10, 7))
            b.sphere(V(0.0, s * 0.3, 0.97), 0.03 * S, '#f6c945', seg=(6, 4))
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
    if opts.get('boltMark'):
        h.box(V(0.34, 0.015, 1.5), (0.02 * S, 0.035 * S, 0.09 * S), '#fde047', mat='glow', rot=(28, 0, 0))
        h.box(V(0.375, -0.02, 1.425), (0.02 * S, 0.035 * S, 0.09 * S), '#fde047', mat='glow', rot=(28, 0, 0))
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
    if opts.get('faceDisc'):   # sova: svijetli disk oko očiju
        for s_ in (1, -1):
            h.sphere(V(0.27, s_ * 0.15, 1.36), (0.07 * S, 0.17 * S, 0.18 * S), opts['faceDisc'], seg=(10, 8))
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
        for k in range(10):   # nabori tunike
            deg = k * 36 + 18
            ca, sa = math.cos(RAD(deg)), math.sin(RAD(deg))
            b.box(V(ca * 0.318, sa * 0.318, 0.52), (0.02 * S, 0.03 * S, 0.15 * S), '#c8c8c8', mat='team', rot=(0, -6, deg))
        # torbica na pojasu
        b.box(V(-0.08, 0.27, 0.6), (0.1 * S, 0.06 * S, 0.1 * S), '#7a4b25', bevel=0.01, rot=(0, 0, 20))
        b.box(V(-0.07, 0.29, 0.635), (0.1 * S, 0.04 * S, 0.04 * S), '#5b3a1e', bevel=0.006, rot=(0, 0, 20))
        b.sphere(V(-0.05, 0.31, 0.62), 0.012 * S, '#f6c945', seg=(5, 4))
        if not (opts.get('scarf') or opts.get('cape') or opts.get('chest') or opts.get('neckFur') or opts.get('armWings')):
            b.cyl(V(0, 0, 0.9), V(0, 0, 0.955), 0.22 * S, 0.2 * S, '#ffffff', mat='team', seg=16, smooth=True)
            b.cyl(V(0, 0, 0.95), V(0, 0, 0.962), 0.2 * S, 0.198 * S, '#f6c945', seg=16, caps=False)

    # ruke
    arm_wings = opts.get('armWings')
    for side, nm in ((1, 'armL'), (-1, 'armR')):
        a = m.part(nm, V(0, side * 0.3, 0.86), 'body')
        if arm_wings:
            wc = arm_wings
            a.sphere(V(-0.02, side * 0.34, 0.78), (0.1 * S, 0.08 * S, 0.14 * S), fur)
            a.poly([V(0.02, side * 0.3, 0.9), V(-0.12, side * 0.62, 0.86), V(-0.2, side * 0.72, 0.6),
                    V(-0.1, side * 0.55, 0.45), V(0.0, side * 0.38, 0.55)], wc, thick=0.04)
            for i in range(4):
                tz = 0.84 - i * 0.1
                a.cyl(V(-0.06, side * (0.5 + i * 0.05), tz), V(-0.2 - i * 0.02, side * (0.62 + i * 0.04), tz - 0.24),
                      0.04 * S, 0.01 * S, mix(wc, '#000000', 0.15 * (i % 2)), seg=4)
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
        R.box(hR + d * 0.1 * S, (0.06 * S, 0.24 * S, 0.04 * S), '#f6c945', rot=(0, -20, 0), bevel=0.01)
        bl = hR + d * 0.48 * S
        R.box(bl, (0.68 * S, 0.075 * S, 0.022 * S), '#dfe6ee', rot=(90, -20, 0), bevel=0.008)
        R.box(bl + d * 0.02, (0.6 * S, 0.02 * S, 0.026 * S), '#9fb0c0', rot=(90, -20, 0))
        R.sphere(hR - d * 0.13 * S, 0.035 * S, '#f6c945')
        # v0.13: dragulj u križnici, krajevi križnice, omotač drške, vrh oštrice
        R.sphere(hR + d * 0.1 * S + Vector((0.02 * S, 0, 0)), 0.026 * S, '#ef4444', mat='glow', seg=(8, 6))
        for s_ in (1, -1):
            R.sphere(hR + d * 0.1 * S + Vector((0, s_ * 0.13 * S, 0)), 0.026 * S, '#f6c945', seg=(7, 5))
        for k in range(3):
            R.cyl(hR - d * (0.07 - k * 0.05) * S, hR - d * (0.05 - k * 0.05) * S, 0.034 * S, 0.034 * S, '#3b2414', seg=6, caps=False)
        R.cyl(bl + d * 0.33 * S, bl + d * 0.42 * S, 0.034 * S, 0.0, '#dfe6ee', seg=4)
    if opts.get('shield'):
        n = Vector((0.55, 0.83, 0)).normalized()
        cc = hL + Vector((0.06, 0.06, 0.04))
        L.cyl(cc - n * 0.03 * S, cc + n * 0.03 * S, 0.24 * S, 0.24 * S, '#f6c945', seg=16)
        L.cyl(cc + n * 0.025 * S, cc + n * 0.05 * S, 0.21 * S, 0.21 * S, '#ffffff', mat='team', seg=16)
        L.sphere(cc + n * 0.06 * S, 0.06 * S, '#f6c945')
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
        for k in range(4):   # v0.13: kožni omotač i vrhovi luka
            zz = -0.045 + k * 0.03
            L.cyl(ctr + Vector((0.12 * S, 0, zz * S)), ctr + Vector((0.12 * S, 0, (zz + 0.015) * S)), 0.038 * S, 0.038 * S, '#5b3a1e', seg=6, caps=False)
        for pt in (pts[0], pts[-1]):
            L.sphere(pt, 0.03 * S, '#f6c945', seg=(6, 4))
        # tobolac sa strijelama
        b.cyl(V(-0.26, 0.1, 0.62), V(-0.36, -0.06, 1.08), 0.07 * S, 0.08 * S, '#ffffff', mat='team', seg=8)
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
        for k in range(5):   # v0.13: čavli na batini
            a = RAD(k * 72)
            base_ = hR + Vector((0.3 * S, math.cos(a) * 0.06 * S, 0.19 * S + math.sin(a) * 0.06 * S))
            R.cyl(base_, base_ + Vector((0.02 * S, math.cos(a) * 0.05 * S, math.sin(a) * 0.05 * S)), 0.015 * S, 0.0, '#9aa3ad', seg=4)
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
    biped_anims(m, kind=opts.get('atk', 'melee'), wings=bool(opts.get('wings')), tail=bool(opts.get('tail')),
                arm_wings=bool(arm_wings))
    return m.finish()


HEROES = {
    'vitez': (dict(fur='#e9a93b', belly='#f9e3ad', muzzle='#fbe8bb', nose='#4a2a1a', dark='#9c5a1c'),
              dict(ears='round', mane='#b5541e', tail='thin', tuft='#b5541e', weapon='sword', shield=True,
                   crown=True, brows='#7a3b12', chest='#cfd8e3', shoulders='#cfd8e3', boots='#5b3a1e', atk='melee')),
    'zarko': (dict(fur='#e4572e', belly='#ffcf56', dark='#8f2414', inner='#ffcf56'),
              dict(snout='dragon', horns='#fff1c9', wings='#ff8a4c', wingScale=1.25, tail='long', tailFlame=True,
                   weapon='orb', orb='#ffb020', crest='#ffcf56', scarf=True, bellyPlates=True, atk='mage')),
    'ledena': (dict(fur='#26324f', belly='#f4f8ff', muzzle='#f4f8ff', beak='#f59e0b', feet='#f59e0b', limb='#26324f',
                    hand='#ef4444'),
               dict(snout='flatbeak', hat='beanie', weapon='staff', orb='#9ae6ff', orbShape='crystal',
                    staffWood='#cbd5e1', flippers=True, tunic=None, scarf=True, scarfStripes=True, beanieStar=True,
                    atk='mage', blush=True, brows='#0f172a', browAngle=16, headR=(0.4, 0.4, 0.4))),
    'strijela': (dict(fur='#f07c2b', belly='#fff3e3', muzzle='#fff3e3', dark='#8a3a0e', eartip='#3b2414',
                      limb='#3b2414', hand='#3b2414'),
                 dict(ears='bigpointy', snout='long', tail='bushy', tuft='#ffffff', weapon='bow', atk='bow',
                      sleeve=False, headFeather='#ef4444', bracers='#5b3a1e')),
    'listko': (dict(fur='#80c96d', belly='#f4e6a1', muzzle='#a7dc8f', dark='#3f7a2d'),
               dict(shell=('#5e8a35', '#7aa846', '#3e5f22'), headband=True, weapon='staff', orb='#86efac',
                    orbShape='leaf', staffWood='#7a4b25', tail='stub', atk='mage', tunic='team', flowerHat=True)),
    'munja': (dict(fur='#f39a2b', belly='#fff6e8', muzzle='#fff6e8', dark='#2b1a10'),
              dict(ears='round', stripesHead=True, stripesBody=True, tail='ringed', weapon='claws',
                   clawColor='#fde047', atk='claws', brows='#2b1a10', browAngle=-6, boltMark=True, fangs=True)),
    'skokica': (dict(fur='#5cc04f', belly='#f4f19b', dark='#2f7a2a', feet='#4aa63f'),
                dict(snout='frog', bandana=True, weapon='club', lilypad=True, atk='melee', blush=False,
                     headR=(0.42, 0.46, 0.33), spots=True, brows=None)),
    'orlina': (dict(fur='#7a4a2a', belly='#efe7d6', muzzle='#ffffff', beak='#f5b324', feet='#f5b324', limb='#f5b324'),
               dict(snout='beak', armWings='#6b3f22', tail=None, atk='wing', eyes={'color': '#3b1d08'},
                    brows='#3b2414', browAngle=-14, headR=(0.38, 0.38, 0.38), whiteHead=True, goggles=True,
                    tailFeathers=True)),
    'luna': (dict(fur='#d7cdf0', belly='#ffffff', muzzle='#ffffff', dark='#6d5aa8', inner='#f9b4d0',
                  limb='#d7cdf0'),
             dict(ears='pointy', snout='muzzle', tail='catlong', tuft='#6d5aa8', weapon='bow', atk='bow',
                  bowColor='#e5e7eb', crescent=True, cape=True, capeStars=True, eyes={'color': '#4c1d95'},
                  brows='#6d5aa8')),
    'jez': (dict(fur='#b48a5c', belly='#f1e3c8', muzzle='#f1e3c8', dark='#4a3728', nose='#1f1a17'),
            dict(ears='round', earScale=0.8, snout='long', tail='stub', quills=('#4a3728', '#e8d5b5'),
                 atk='melee', brows='#4a3728', browAngle=-6)),
    'slon': (dict(fur='#9aa4b5', belly='#c9d1dc', muzzle='#9aa4b5', dark='#5b6474', inner='#e9b8c4'),
             dict(ears='big', snout='none', trunk=True, tusks=True, tail='thin', tuft='#5b6474', weapon='hammer',
                  atk='melee', scale=1.08, brows='#5b6474', browAngle=-4, headR=(0.42, 0.44, 0.38))),
    'pcela': (dict(fur='#f5c518', belly='#fde68a', muzzle='#fde68a', dark='#1f1a17', nose='#1f1a17'),
              dict(ears=None, snout='muzzle', bands='#1f1a17', wings='#dff6ff', wingScale=1.15, antennae=True,
                   stinger=True, weapon='orb', orb='#f59e0b', atk='mage', tunic='team', eyes={'size': 1.1}, cheekFluff=False)),
    'sova': (dict(fur='#8a6a4a', belly='#e9dcc3', muzzle='#e9dcc3', beak='#f5b324', feet='#f5b324', limb='#f5b324',
                  dark='#4a3222'),
             dict(snout='beak', armWings='#6b4f35', tail=None, atk='wing', eyes={'white': True, 'color': '#f59e0b', 'size': 1.2},
                  earTufts=True, faceDisc='#f3e9d2', brows='#4a3222', browAngle=-16, headR=(0.4, 0.42, 0.4),
                  blush=False)),
    'majmun': (dict(fur='#8b5a2b', belly='#f1d8b5', muzzle='#f1d8b5', dark='#4a2a14', inner='#f1d8b5', nose='#2b1d1a'),
               dict(ears='round', earScale=1.4, snout='muzzle', tail='catlong', tuft='#8b5a2b', weapon='staff',
                    orbShape='none', staffWood='#f6c945', headband=True, atk='melee', brows='#4a2a14')),
    'tragac': (dict(fur='#8e93a0', belly='#e7e9ee', muzzle='#eef0f4', dark='#2d2f36', nose='#111111'),
               dict(ears='round', snout='muzzle', mask='#2a2c33', tail='ringed', weapon='shuriken', atk='claws',
                    hood='#ffffff', eyes={'white': True}, beltStar=True, scarf=True, brows='#111111', browAngle=-8)),
    # ---- v0.10 ----
    'vuk': (dict(fur='#8a8f98', belly='#e5e7eb', muzzle='#e5e7eb', dark='#3b3f47', nose='#1f1a17', inner='#d1d5db'),
            dict(ears='pointy', snout='long', tail='bushy', tuft='#e5e7eb', weapon='claws', clawColor='#e5e7eb',
                 atk='claws', fangs=True, neckFur='#d1d5db', brows='#3b3f47', browAngle=-12, eyes={'color': '#fbbf24'})),
    'gavran': (dict(fur='#2b2f3a', belly='#3f4452', muzzle='#3f4452', beak='#f59e0b', feet='#f59e0b', limb='#f59e0b',
                    dark='#14161c'),
               dict(snout='beak', armWings='#1f2430', tail=None, atk='wing', eyes={'white': True, 'color': '#a78bfa', 'size': 1.1},
                    hat='cone', hatColor='#312e81', tailFeatherColors=('#1f2430', '#3f4452'), brows='#14161c', browAngle=-10,
                    blush=False, headR=(0.38, 0.38, 0.38))),
    'hobotnica': (dict(fur='#8b5cf6', belly='#c4b5fd', muzzle='#c4b5fd', dark='#5b21b6', limb='#8b5cf6'),
                  dict(ears=None, snout='muzzle', tail=None, tentacles='#7c3aed', atk='melee', tunic='team',
                       eyes={'white': True, 'size': 1.25}, brows='#5b21b6', browAngle=-4, headR=(0.44, 0.46, 0.42),
                       blush=True, cheekFluff=False)),
    'nosorog': (dict(fur='#7d8a96', belly='#b8c2cc', muzzle='#9aa6b2', dark='#4a5560', inner='#d8c0c8', nose='#3b4450'),
                dict(ears='round', earScale=0.7, snout='long', tail='thin', tuft='#4a5560', atk='melee', scale=1.1,
                     noseHorn='#f1e9d6', chest='#9aa3ad', shoulders='#9aa3ad', brows='#4a5560', browAngle=-16,
                     headR=(0.42, 0.44, 0.38))),
    'panda': (dict(fur='#f3f4f6', belly='#ffffff', muzzle='#ffffff', dark='#1f2328', nose='#1f2328', limb='#1f2328',
                   inner='#1f2328'),
              dict(ears=None, earColor='#1f2328', eyePatches='#1f2328', snout='muzzle', tail='stub', atk='melee',
                   weapon='bamboo', tunic='team', brows=None, blush=True, headR=(0.42, 0.44, 0.4))),
}


def build_heroes():
    for hid, (c, o) in HEROES.items():
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
    m.anim('attack', 14, {'ram': [(0, Z, Z), (5, Z, (-0.25, 0, 0)), (8, Z, (0.28, 0, 0)), (14, Z, Z)],
                          'body': [(0, Z, Z), (8, (0, 3, 0), (0.04, 0, 0)), (14, Z, Z)]})
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
    quad('mob_wolves', dict(fur='#8f96a3', belly='#d9dde3', dark='#4b5160', tip='#ffffff'),
         dict(len=1.25, legH=0.34, wid=0.26, bodyR=0.25, snout='wolf', ears='pointy', tail='bushy',
              headR=0.2, legR=0.065, eyeColor='#f6c945', glowEyes=False, fangs=True, ruff=True))
    quad('mob_bear', dict(fur='#7b4a2a', belly='#a8774f', dark='#3d2414', snoutC='#d6b48c'),
         dict(len=1.25, legH=0.32, wid=0.42, bodyR=0.4, snout='bear', ears='round', tail='stub', hump=True,
              headR=0.27, legR=0.12, heavy=1.6, claws=True))
    quad('mob_boss', dict(fur='#5b8c3a', belly='#e9d27a', dark='#2f4f1f', paw='#2f4f1f'),
         dict(len=1.5, legH=0.42, wid=0.45, bodyR=0.42, snout='dragon', ears='horns', hornC='#fff1c9',
              tail='dragon', spikes='#c2410c', wings='#6b9e34', wingScale=1.3, neck=True, neckUp=0.2, headR=0.26,
              legR=0.12, glowEyes=True, eyeColor='#fde047', heavy=2.0, bellyPlates=True))


# ------------------------------------------------------------------ GRAĐEVINE
# prozori kule: strana -Y u Blenderu gleda prema kameri u igri (three.js +Z)
WINDOWS = {3: (-35, -90, -145), 5: (-60, -120)}


def build_tower():
    m = Model('tower')
    b = m.part('base', (0, 0, 0))
    stones = ['#d8d0bf', '#cbc2ae', '#e2dbcc']
    b.cyl((0, 0, 0), (0, 0, 0.3), 0.98, 0.92, '#a39a88', seg=10)
    for i in range(6):
        z0 = 0.3 + i * 0.42
        r0 = 0.8 - i * 0.035
        b.cyl((0, 0, z0), (0, 0, z0 + 0.4), r0, r0 - 0.03, stones[i % 3], seg=10)
        b.cyl((0, 0, z0 + 0.38), (0, 0, z0 + 0.44), r0 + 0.02, r0 + 0.01, '#b5ab97', seg=10)
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
    # platforma + zupci
    b.cyl((0, 0, 2.8), (0, 0, 3.0), 0.95, 0.95, '#bdb3a0', seg=12)
    for i in range(10):
        a = RAD(i * 36)
        b.box((math.cos(a) * 0.86, math.sin(a) * 0.86, 3.12), (0.22, 0.2, 0.26), stones[i % 3], rot=(0, 0, i * 36), bevel=0.02)
    # krov i zastavice
    b.cyl((0, 0, 3.0), (0, 0, 3.15), 0.55, 0.55, '#a39a88', seg=10)
    for a in (0, 90, 180, 270):
        x, y = math.cos(RAD(a)) * 0.45, math.sin(RAD(a)) * 0.45
        b.cyl((x, y, 3.1), (x, y, 3.7), 0.05, 0.05, '#7a4b25', seg=6)
    b.cyl((0, 0, 3.65), (0, 0, 4.3), 0.75, 0.0, '#ffffff', mat='team', seg=10)
    b.cyl((0, 0, 3.6), (0, 0, 3.7), 0.78, 0.78, '#8a8a8a', mat='team', seg=10)
    b.cyl((0, 0, 4.25), (0, 0, 4.9), 0.025, 0.025, '#5b3a1e', seg=6)
    b.poly([(0, 0.01, 4.9), (0, 0.01, 4.62), (0.42, 0.01, 4.78)], '#ffffff', mat='team')
    for side in (1, -1):
        b.poly([(0.7 * 0.98, side * 0.16, 2.75), (0.7 * 0.98, side * 0.16 - side * 0.0, 2.75),
                (0.79, side * 0.3, 2.0), (0.82, side * 0.14, 1.85)], '#ffffff', mat='team')
    # kristal (vrti se u igri)
    cr = m.part('crystal', (0, 0, 3.3))
    cr.ico((0, 0, 3.3), (0.2, 0.2, 0.32), '#ffffff', mat='teamglow', sub=0)
    m.finish()

    # prijestol (Ancient)
    m = Model('ancient')
    b = m.part('base', (0, 0, 0))
    b.cyl((0, 0, 0), (0, 0, 0.3), 1.9, 1.8, '#9aa3ad', seg=12)
    b.cyl((0, 0, 0.3), (0, 0, 0.55), 1.55, 1.48, '#b7bec6', seg=12)
    b.cyl((0, 0, 0.55), (0, 0, 0.8), 1.2, 1.15, '#cfd5db', seg=12)
    b.cyl((0, 0, 0.78), (0, 0, 0.86), 1.22, 1.22, '#ffffff', mat='team', seg=12)
    for i in range(6):
        a = RAD(i * 60 + 30)
        x, y = math.cos(a) * 1.35, math.sin(a) * 1.35
        b.cyl((x, y, 0.55), (x, y, 2.4), 0.13, 0.11, '#e5e7eb', seg=8)
        b.box((x, y, 2.45), (0.32, 0.32, 0.14), '#cfd5db', rot=(0, 0, i * 60), bevel=0.02)
        b.ico((x, y, 2.66), 0.12, '#ffffff', mat='teamglow', sub=0)
    for i in range(3):
        a = RAD(i * 120 + 90)
        x, y = math.cos(a) * 1.0, math.sin(a) * 1.0
        b.cyl((x, y, 0.8), (x * 0.7, y * 0.7, 1.7), 0.08, 0.03, '#f6c945', seg=6)
    b.cyl((0, 0, 0.8), (0, 0, 1.1), 0.55, 0.45, '#9aa3ad', seg=10)
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
    b.cyl((0, 0, 0.3), (0, 0, 0.42), 3.08, 3.08, '#ffffff', mat='team', seg=24)
    b.cyl((0, 0, 0.3), (0, 0, 0.34), 2.75, 2.75, '#2f9bd8', seg=24)
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
    m = Model('barracks')
    b = m.part('base', (0, 0, 0))
    b.box((0, 0, 0.5), (1.7, 1.3, 1.0), '#d8d0bf', bevel=0.04)
    b.box((0, 0, 0.08), (1.9, 1.5, 0.16), '#a39a88', bevel=0.03)
    for k in range(6):   # drvene grede
        b.box((-0.75 + k * 0.3, 0.66, 0.5), (0.08, 0.04, 0.95), '#7a4b25')
        b.box((-0.75 + k * 0.3, -0.66, 0.5), (0.08, 0.04, 0.95), '#7a4b25')
    # dvostrešni krov: dvije kose ploče (team boja) + zabati + sljemenska greda
    rz, ez, ov, hx = 1.78, 1.0, 0.88, 1.0
    b.poly([(-hx, 0, rz), (hx, 0, rz), (hx, ov, ez), (-hx, ov, ez)], '#ffffff', mat='team', thick=0.09)
    b.poly([(hx, 0, rz), (-hx, 0, rz), (-hx, -ov, ez), (hx, -ov, ez)], '#ffffff', mat='team', thick=0.09)
    b.poly([(0.85, -0.65, ez), (0.85, 0.65, ez), (0.85, 0, rz - 0.02)], '#d8d0bf', thick=0.12)
    b.poly([(-0.85, 0.65, ez), (-0.85, -0.65, ez), (-0.85, 0, rz - 0.02)], '#d8d0bf', thick=0.12)
    b.cyl((-hx - 0.04, 0, rz + 0.02), (hx + 0.04, 0, rz + 0.02), 0.06, 0.06, '#5b3a1e', seg=8)
    b.box((0, 0, 1.0), (1.95, 1.55, 0.06), '#5b3a1e')
    b.box((0.86, 0, 0.42), (0.1, 0.42, 0.7), '#5b3a1e', bevel=0.03)   # vrata
    b.cyl((0.86, 0, 0.75), (0.92, 0, 0.75), 0.21, 0.21, '#5b3a1e', seg=10)
    for yy in (0.4, -0.4):   # prozori
        b.box((0.84, yy, 0.62), (0.08, 0.22, 0.26), '#4a3a2a', bevel=0.02)
        b.box((0.88, yy, 0.62), (0.06, 0.16, 0.2), '#ffd166', mat='glow')
    b.box((-0.5, -0.45, 1.62), (0.26, 0.26, 0.6), '#9aa3ad', bevel=0.02)   # dimnjak
    b.cyl((0.6, 0.55, 1.2), (0.6, 0.55, 2.4), 0.03, 0.03, '#5b3a1e', seg=6)   # zastava
    b.poly([(0.6, 0.55, 2.4), (0.6, 0.55, 2.1), (1.05, 0.55, 2.25)], '#ffffff', mat='team')
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
    w.box((0, 0, 0.4), (1.0, 0.3, 0.8), '#cbc2ae', bevel=0.02)
    w.box((0, 0, 0.12), (1.04, 0.36, 0.24), '#a39a88', bevel=0.02)
    for k in range(3):
        w.box((-0.33 + k * 0.33, 0, 0.9), (0.2, 0.3, 0.2), ['#d8d0bf', '#e2dbcc'][k % 2], bevel=0.02)
    w.cyl((0.5, 0, 0), (0.5, 0, 1.15), 0.2, 0.17, '#b5ab97', seg=8)
    w.cyl((0.5, 0, 1.1), (0.5, 0, 1.3), 0.22, 0.0, '#ffffff', mat='team', seg=8)
    m.finish()


# ------------------------------------------------------------------ PORTRETI (render glave za ekran odabira)
def render_portraits(ids, size=512):
    sc = bpy.context.scene
    roots = {o.name: o for o in sc.objects if o.parent is None and o.type == 'EMPTY'}
    for o in roots.values():
        o.location = (0, 0, -200)
    cam = bpy.data.objects.new('pcam', bpy.data.cameras.new('pcam'))
    sc.collection.objects.link(cam)
    cam.data.lens = 70
    cam.location = (3.0, -2.4, 2.1)
    cam.rotation_euler = (Vector((0.08, 0, 1.12)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sun = bpy.data.objects.new('psun', bpy.data.lights.new('psun', 'SUN'))
    sun.data.energy = 3.0
    sun.rotation_euler = (RAD(45), RAD(15), RAD(40))
    sc.collection.objects.link(sun)
    fill = bpy.data.objects.new('pfill', bpy.data.lights.new('pfill', 'AREA'))
    fill.data.energy = 300
    fill.data.size = 4
    fill.location = (2.5, -3.5, 2.5)
    fill.rotation_euler = (RAD(60), 0, RAD(35))
    sc.collection.objects.link(fill)
    world = bpy.data.worlds.new('pw')
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes['Background']
    # pozadina: ploha iza junaka u boji njegove teme
    back = bpy.data.objects.new('pback', bpy.data.meshes.new('pback'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
    bm.to_mesh(back.data)
    bm.free()
    sc.collection.objects.link(back)
    back.rotation_euler = (RAD(90), 0, RAD(50))
    back.location = (-3.0, 3.0, 2)
    bmat = bpy.data.materials.new('pbm')
    try:
        bmat.use_nodes = True
    except Exception:
        pass
    back.data.materials.append(bmat)
    ground = bpy.data.objects.new('pground', bpy.data.meshes.new('pground'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
    bm.to_mesh(ground.data)
    bm.free()
    sc.collection.objects.link(ground)
    gmat = bpy.data.materials.new('pgm')
    try:
        gmat.use_nodes = True
    except Exception:
        pass
    ground.data.materials.append(gmat)
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = False
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    for hid, bgcol in ids:
        r = roots.get('hero_' + hid)
        if not r:
            continue
        r.location = (0, 0, 0)
        r.rotation_euler = (0, 0, RAD(-25))
        c = col(bgcol)
        bg.inputs['Color'].default_value = (c[0], c[1], c[2], 1)
        bg.inputs['Strength'].default_value = 1.0
        # pozadina i tlo: dio boje kroz emisiju, da nikad nisu crni (tlo je u sjeni kulise)
        for mat, kd, ke in ((bmat, 0.5, 0.45), (gmat, 0.35, 0.3)):
            bsdf = mat.node_tree.nodes['Principled BSDF']
            bsdf.inputs['Base Color'].default_value = (c[0] * kd, c[1] * kd, c[2] * kd, 1)
            for nm in ('Emission Color', 'Emission'):
                if nm in bsdf.inputs:
                    bsdf.inputs[nm].default_value = (c[0] * ke, c[1] * ke, c[2] * ke, 1)
                    break
            if 'Emission Strength' in bsdf.inputs:
                bsdf.inputs['Emission Strength'].default_value = 1.0
        sc.render.filepath = os.path.join(ASSETS, 'hero_%s.png' % hid)
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
                  ['#2e7d4f', '#358f5a', '#276b43'][(i + v) % 3], seg=8)
            if v == 2:
                p.cyl((0, 0, z0 + 0.02), (0, 0, z0 + 0.12), r0 * 0.92, r0 * 0.85, '#f1f5f9', seg=8)
        m.finish()
    for v in range(3):
        m = Model('rock%d' % v)
        p = m.part('mesh')
        p.ico((0, 0, 0.18), (0.55, 0.45, 0.38), ['#9ca3af', '#a8a29e', '#94a3b8'][v], sub=1, jitter=0.18, seed=40 + v)
        p.ico((0.35, 0.25, 0.1), (0.25, 0.22, 0.2), '#8b939f', sub=1, jitter=0.2, seed=50 + v)
        if v == 1:
            p.ico((-0.3, -0.2, 0.08), (0.2, 0.18, 0.15), '#9ca3af', sub=1, jitter=0.2, seed=60)
        p.ico((0.05, -0.1, 0.42), (0.3, 0.25, 0.08), '#6aa84f', sub=1, jitter=0.2, seed=70 + v)  # mahovina
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
            p.ico(c0, (r, r, r * 0.9), ['#a3e635', '#bef264', '#84cc16'][i % 3], sub=1, jitter=0.14, seed=120 + v * 10 + i)
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
    p.cyl((0, 0, 0), (0, 0, 0.14), 0.7, 0.66, '#a39a88', seg=12)
    p.cyl((0, 0, 0.14), (0, 0, 0.26), 0.5, 0.46, '#cbc2ae', seg=12)
    for k in range(4):
        a = RAD(k * 90 + 45)
        p.cyl((math.cos(a) * 0.45, math.sin(a) * 0.45, 0.26), (math.cos(a) * 0.45, math.sin(a) * 0.45, 0.9), 0.06, 0.05, '#d8d0bf', seg=7)
        p.sphere((math.cos(a) * 0.45, math.sin(a) * 0.45, 0.94), 0.07, '#ffffff', mat='team', seg=(7, 5))
    p.cyl((0, 0, 0.26), (0, 0, 0.55), 0.14, 0.1, '#d8d0bf', seg=8)
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
               headR=(0.4, 0.42, 0.34), shoulders='#4b5563', chest='#6b7380', spots=True))


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


# ------------------------------------------------------------------ AMBIJENTALNA OKLUZIJA
def bake_ao(samples=32):
    """Ispeče ambijentalnu okluziju (Cycles) u boje vrhova: udubine, spojevi i
    unutrašnjost krošnje postanu tamniji — modeli dobiju dubinu bez ikakvog
    troška u igri. Svijetleći dijelovi (glow) se preskaču."""
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
        ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = ao
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        try:
            bpy.ops.object.bake(type='AO')
        except RuntimeError as e:
            print('AO nije uspio za', ob.name, e)
            me.color_attributes.remove(ao)
            continue
        col = me.color_attributes['Col']
        for poly in me.polygons:
            if poly.material_index in (SLOT['glow'], SLOT['teamglow']):
                continue
            for li in poly.loop_indices:
                a = ao.data[li].color[0]
                k = 0.5 + 0.5 * min(1.0, a * 1.15)
                c = col.data[li].color
                col.data[li].color = (c[0] * k, c[1] * k, c[2] * k, c[3])
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
    print('AO: %d objekata, %.0f s' % (n, time.time() - t0))


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
    build_nature()
    build_env()
    build_golem()
    build_courier()
    build_projectiles()
    build_fx()
    build_runes()
    if '--no-ao' not in argv:
        bake_ao()
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
        render_portraits([('vuk', '#5a6270'), ('gavran', '#2e2a5c'), ('hobotnica', '#4a3a8a'), ('nosorog', '#6a7a6a'), ('panda', '#4a8a5a')])
    if '--portraits-all' in argv:
        render_portraits([('jez', '#8a9a4a'), ('slon', '#5a6a8a'), ('pcela', '#b8860b'), ('sova', '#3b2f5c'), ('majmun', '#7a5a2a'),
                          ('vuk', '#5a6270'), ('gavran', '#2e2a5c'), ('hobotnica', '#4a3a8a'), ('nosorog', '#6a7a6a'), ('panda', '#4a8a5a')])


main()
