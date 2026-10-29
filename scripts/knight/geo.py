# 形を作る道具：断面（楕円・角の丸い四角）を並べてつなぐ「ロフト」と、骨への割り当て（ウェイト）。
# 部品はそれぞれ Blender のオブジェクトとして作り、厚み（Solidify）などをかけてから、材質ごとに1つへまとめる。
import math
import bmesh
import bpy
from mathutils import Vector

# 頂点の印（mask 属性）。R=縁の飾り、G=素材の種類、B=彫金を入れてよい面
IRON, GOLD, LEATHER, CHAIN, STEEL = 0.0, 0.25, 0.5, 0.75, 1.0
CLOTH, CLOTH_DARK = 0.0, 0.5

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
FRONT = Vector((0, -1, 0))


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


def ring(center, u, v, ru, rv, n, power=2.0, ru_neg=None, ry_neg=None, power_neg=None,
         a0=0.0, a1=2 * math.pi, closed=True, shape=None):
    """u・v 方向の半径で断面の点を並べる。power が 2 で楕円、大きいほど四角く、小さいほど尖る。
    *_neg は反対側（-u, -v）の半径と尖り。shape(t, x, y) で点を後から曲げられる。"""
    pts = []
    count = n if closed else n + 1
    for i in range(count):
        t = a0 + (a1 - a0) * i / n
        c, s = math.cos(t), math.sin(t)
        p = power if s >= 0 or power_neg is None else power_neg
        e = 2.0 / p
        x = spow(c, e) * (ru if c >= 0 or ru_neg is None else ru_neg)
        y = spow(s, e) * (rv if s >= 0 or ry_neg is None else ry_neg)
        if shape:
            x, y = shape(t, x, y)
        pts.append(center + u * x + v * y)
    return pts


def frame_for(axis):
    """軸に垂直な2方向。なるべく上（Z）と正面に沿わせる"""
    axis = axis.normalized()
    ref = Z if abs(axis.dot(Z)) < 0.9 else FRONT
    u = (ref - axis * ref.dot(axis)).normalized()
    v = axis.cross(u).normalized()
    return u, v


class Geo:
    def __init__(self):
        self.v = []
        self.f = []
        self.mask = []

    def add(self, pts, mask=(0, 0, 0, 1)):
        start = len(self.v)
        self.v.extend(pts)
        self.mask.extend([mask] * len(pts))
        return list(range(start, start + len(pts)))

    def loft(self, rings, closed=True, cap0=False, cap1=False, masks=None):
        """masks は断面ごとの印（なければ (0,0,0,1)）"""
        idx = [self.add(r, masks[i] if masks else (0, 0, 0, 1)) for i, r in enumerate(rings)]
        m = len(rings[0])
        for a, b in zip(idx, idx[1:]):
            for i in range(m if closed else m - 1):
                j = (i + 1) % m
                self.f.append((a[i], a[j], b[j], b[i]))
        for cap, ids, flip in ((cap0, idx[0], True), (cap1, idx[-1], False)):
            if not cap:
                continue
            center = sum((self.v[i] for i in ids), Vector()) / len(ids)
            c = self.add([center], masks[0] if masks else (0, 0, 0, 1))[0]
            for i in range(m if closed else m - 1):
                j = (i + 1) % m
                self.f.append((ids[j], ids[i], c) if flip else (ids[i], ids[j], c))
        return idx

    def grid(self, rows, keep=None, masks=None):
        """開いた面。rows[i][j]。keep(i, j) が False の四角は作らない（マントの破れ）"""
        idx = [self.add(r, masks[i] if masks else (0, 0, 0, 1)) for i, r in enumerate(rows)]
        for i in range(len(idx) - 1):
            for j in range(len(idx[i]) - 1):
                if keep and not keep(i, j):
                    continue
                a, b = idx[i], idx[i + 1]
                self.f.append((a[j], a[j + 1], b[j + 1], b[j]))
        return idx

    def merge(self, other):
        off = len(self.v)
        self.v.extend(other.v)
        self.mask.extend(other.mask)
        self.f.extend(tuple(i + off for i in face) for face in other.f)
        return self


def to_object(name, geo, solidify=0.0, subdiv=0, recalc=True, offset=-1.0):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in geo.v], [], geo.f)
    attr = mesh.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT')
    for i, m in enumerate(geo.mask):
        attr.data[i].color = m
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.faces.ensure_lookup_table()
    if recalc and bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if subdiv:
        mod = obj.modifiers.new('sub', 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
    if solidify:
        mod = obj.modifiers.new('solid', 'SOLIDIFY')
        mod.thickness = solidify
        mod.offset = offset
        mod.use_even_offset = True
    return obj


# ── ウェイト ──

def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


def rigid(bone):
    return lambda p: {bone: 1.0}


def envelope(bones, segs, sharp=6.0):
    """骨までの距離で配分（近い骨ほど強い）。鎧の下の服など、つながった面に使う"""
    def fn(p):
        ws = {b: 1.0 / (seg_dist(p, *segs[b]) + 0.01) ** sharp for b in bones}
        total = sum(ws.values())
        return {b: w / total for b, w in ws.items()}
    return fn


def blend(fn_a, fn_b, t_of_p):
    def fn(p):
        t = t_of_p(p)
        out = {}
        for b, w in fn_a(p).items():
            out[b] = out.get(b, 0) + w * (1 - t)
        for b, w in fn_b(p).items():
            out[b] = out.get(b, 0) + w * t
        return out
    return fn


def top4(ws):
    items = sorted(((w, b) for b, w in ws.items() if w > 1e-4), reverse=True)[:4]
    total = sum(w for w, _ in items)
    return {b: w / total for w, b in items}


class Acc:
    """材質ごとにまとめる入れ物"""

    def __init__(self, name):
        self.name = name
        self.v, self.f, self.w, self.mask = [], [], [], []

    def harvest(self, obj, weight_fn):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = obj.evaluated_get(dg)
        mesh = ev.to_mesh()
        mw = ev.matrix_world
        off = len(self.v)
        attr = mesh.color_attributes.get('mask')
        for i, vert in enumerate(mesh.vertices):
            p = mw @ vert.co
            self.v.append(p)
            self.w.append(top4(weight_fn(p)))
            self.mask.append(tuple(attr.data[i].color) if attr else (0, 0, 0, 1))
        for poly in mesh.polygons:
            self.f.append(tuple(off + i for i in poly.vertices))
        ev.to_mesh_clear()
        bpy.data.objects.remove(obj, do_unlink=True)

    def add(self, geo, weight_fn, **kw):
        self.harvest(to_object(self.name + '_part', geo, **kw), weight_fn)

    def build(self, arm, material, sharp_angle=40):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata([tuple(v) for v in self.v], [], self.f)
        attr = mesh.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT')
        for i, m in enumerate(self.mask):
            attr.data[i].color = m
        mesh.shade_smooth()
        mesh.set_sharp_from_angle(angle=math.radians(sharp_angle))
        mesh.materials.append(material)
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        groups = {}
        for i, ws in enumerate(self.w):
            for b, w in ws.items():
                if b not in groups:
                    groups[b] = obj.vertex_groups.new(name=b)
                groups[b].add([i], w, 'REPLACE')
        obj.parent = arm
        mod = obj.modifiers.new('armature', 'ARMATURE')
        mod.object = arm
        return obj
