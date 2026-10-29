# 王冠の騎士の部品。座標は骨格を組み直した後の T ポーズ（Blender：Z が上、-Y が正面、+X が騎士の左）。
# 板金は1枚ずつ1本の骨に固定（本物の鎧と同じく、板どうしの重なりで関節の隙間を隠す）。
# 鎧の下の鎖かたびら・布だけは、骨までの距離で配分して、関節でなめらかに曲がるようにする。
import math
import random
from mathutils import Vector
from geo import (Geo, ring, frame_for, lerp, smooth, rigid, envelope, X, Y, Z, FRONT,
                 IRON, GOLD, LEATHER, CHAIN, STEEL, CLOTH)

N_LIMB = 14


def m(cls, trim=0.0, etch=0.0, dark=1.0):
    return (trim, cls, etch, dark)


def trims(count, cls, etch=1.0, ends=(0, -1)):
    """断面ごとの印：両端の断面だけ縁飾り（金の線）"""
    last = count - 1
    marks = {e % count for e in ends}
    return [m(cls, 1.0 if i in marks or (i == 1 and 0 in marks) or (i == last - 1 and last in marks) else 0.0, etch)
            for i in range(count)]


def path_point(points, z):
    """骨の並び（上から下）に沿って、高さ z の中心を求める"""
    for a, b in zip(points, points[1:]):
        if a.z >= z >= b.z or a.z <= z <= b.z:
            t = (z - a.z) / (b.z - a.z) if b.z != a.z else 0
            return a.lerp(b, t)
    return points[0] if abs(z - points[0].z) < abs(z - points[-1].z) else points[-1]


# ───────────── 胴 ─────────────

TORSO = [  # z, 横の半径, 前の半径, 後ろの半径
    (0.86, 0.150, 0.100, 0.110), (0.95, 0.165, 0.110, 0.120), (1.05, 0.150, 0.105, 0.110),
    (1.15, 0.150, 0.110, 0.110), (1.27, 0.162, 0.122, 0.112), (1.38, 0.170, 0.122, 0.108),
    (1.45, 0.162, 0.108, 0.098), (1.50, 0.130, 0.085, 0.085), (1.54, 0.062, 0.058, 0.058),
    (1.62, 0.052, 0.052, 0.052),
]


def torso_at(z):
    for a, b in zip(TORSO, TORSO[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return tuple(lerp(x, y, t) for x, y in zip(a, b))[1:]
    return (TORSO[0] if z < TORSO[0][0] else TORSO[-1])[1:]


def torso_ring(z, grow, n, power=2.0, power_back=None, front_extra=0.0):
    rx, rf, rb = torso_at(z)
    return ring(Vector((0, 0, z)), X, FRONT, rx + grow, rf + grow + front_extra, n,
                power=power, ry_neg=rb + grow, power_neg=power_back)


def torso(armor, cloth, segs):
    g = Geo()
    g.loft([torso_ring(z, 0, 20) for z, *_ in TORSO], masks=[m(CHAIN)] * len(TORSO), cap0=True)
    armor.add(g, envelope(['hips', 'spine', 'chest', 'head'], segs))

    # 胸当て：前を少し尖らせ（鎬）、後ろは丸く
    zs = [1.17, 1.22, 1.30, 1.38, 1.44, 1.475]
    zs = [zs[0], zs[0] + 0.008] + zs[1:-1] + [zs[-1] - 0.008, zs[-1]]
    g = Geo()
    grows = [0.028, 0.03, 0.034, 0.036, 0.034, 0.03, 0.03, 0.028]
    g.loft([torso_ring(z, gr, 28, power=1.65, power_back=2.3, front_extra=0.012) for z, gr in zip(zs, grows)],
           masks=trims(len(zs), IRON))
    armor.add(g, rigid('chest'), solidify=0.008)

    # 腹の板（3枚が上から重なる）と、腰の板
    for k, bone in enumerate(['spine', 'spine', 'hips']):
        top = 1.185 - k * 0.055
        bottom = top - 0.072
        zs = [top, top - 0.007, (top + bottom) / 2, bottom + 0.007, bottom]
        g = Geo()
        g.loft([torso_ring(z, 0.026 + 0.012 * (top - z) / 0.072 + 0.004 * k, 28, power=1.8, power_back=2.3)
                for z in zs], masks=trims(len(zs), IRON))
        armor.add(g, rigid(bone), solidify=0.007)

    # ベルト（革）と金の留め金
    zs = [1.005, 0.995, 0.965, 0.955]
    g = Geo()
    g.loft([torso_ring(z, 0.052, 32, power=2.2) for z in zs], masks=[m(LEATHER)] * 4)
    armor.add(g, rigid('hips'), solidify=0.006)
    rx, rf, rb = torso_at(0.98)
    c = Vector((0, -(rf + 0.06), 0.98))
    g = Geo()
    g.loft([ring(c + FRONT * d, X, Z, w, h, 16, power=4) for d, w, h in
            ((-0.004, 0.034, 0.03), (0.0, 0.036, 0.032), (0.006, 0.03, 0.026), (0.008, 0.02, 0.016))],
           masks=[m(GOLD, 0, 1)] * 4, cap1=True)
    armor.add(g, rigid('hips'))

    # 腰の下の板（2枚、外へ開く）
    for k in range(2):
        top = 0.962 - k * 0.05
        bottom = top - 0.065
        zs = [top, top - 0.007, bottom + 0.007, bottom]
        g = Geo()
        g.loft([torso_ring(z, 0.05 + 0.02 * k + 0.04 * (top - z) / 0.065, 30, power=2.0) for z in zs],
               masks=trims(4, IRON))
        armor.add(g, rigid('hips'), solidify=0.007)

    tassets(armor, segs)
    skirt(cloth, segs)
    gorget(armor)


def tassets(armor, segs):
    """草摺：葉の形の小札を3段、屋根瓦のように重ねる（参考画像の腰回り）"""
    rows = 3
    for r in range(rows):
        top = 0.875 - r * 0.075
        h = 0.125
        count = 15
        for i in range(count):
            a = math.radians(-150 + 300 * (i + 0.5 * (r % 2)) / (count - 1 + 0.5))
            if abs(a) > math.radians(152):
                continue
            w = 0.044
            ts = [0.0, 0.08, 0.35, 0.65, 0.88, 1.0]
            widths = [0.92, 0.96, 1.0, 0.78, 0.38, 0.0]
            g = Geo()
            grid_rows = []
            masks = []
            for t, wf in zip(ts, widths):
                z = top - t * h
                rx, rf, rb = torso_at(0.93)
                base = math.hypot(rx * math.sin(a), (rf if math.cos(a) > 0 else rb) * math.cos(a))
                R = base + 0.075 + 0.35 * (0.875 - z) + 0.012 * r
                row = []
                for j in range(5):
                    xw = (j - 2) / 2
                    ang = a + xw * w * wf / R
                    bulge = 0.007 * (1 - xw * xw)
                    row.append(Vector((math.sin(ang) * (R + bulge), -math.cos(ang) * (R + bulge), z)))
                grid_rows.append(row)
                masks.append(m(IRON, 1.0 if t < 0.05 else 0.0, 1.0))
            g.grid(grid_rows, masks=masks)
            # 縁（左右の列）にも金の線
            for row_i in range(len(grid_rows)):
                for j in (0, 4):
                    idx = row_i * 5 + j
                    g.mask[idx] = (1.0, IRON, 1.0, 1.0)

            side = math.sin(a)
            leg = 'upperleg.l' if side > 0 else 'upperleg.r'
            center = abs(side) < 0.2 and math.cos(a) > 0
            pull = 0.8 * min(1.0, abs(side) * 1.6 + 0.25) * (0.5 if abs(a) > math.radians(115) else 1.0)

            def weight(p, leg=leg, center=center, pull=pull):
                lf = smooth((0.92 - p.z) / 0.32)
                if center:
                    s = 0.38 * lf
                    return {'hips': 1 - 2 * s, 'upperleg.l': s, 'upperleg.r': s}
                s = lf * pull
                return {'hips': 1 - s, leg: s}

            armor.add(g, weight, solidify=0.005)


def skirt(cloth, segs):
    """鎧の下の布（破れた裾）。前後左右を脚に引っ張らせる"""
    rng = random.Random(7)
    cols = 40
    rows = 7
    hem = [0.47 + rng.uniform(-0.04, 0.05) + 0.04 * (j % 2) for j in range(cols + 1)]
    hem[-1] = hem[0]
    grid_rows = []
    masks = []
    for i in range(rows + 1):
        v = i / rows
        row = []
        for j in range(cols + 1):
            a = 2 * math.pi * j / cols
            z = lerp(0.94, hem[j], v)
            rx, rf, rb = torso_at(0.93)
            r = 0.0 + 0.2 * (0.94 - z) + 0.012 * math.sin(a * 9 + 1.3) * v
            row.append(Vector((math.sin(a) * (rx + 0.03 + r), -math.cos(a) * ((rf if math.cos(a) > 0 else rb) + 0.03 + r), z)))
        grid_rows.append(row)
        masks.append(m(CLOTH, smooth((v - 0.75) / 0.25), 1.0))
    g = Geo()
    g.grid(grid_rows, masks=masks, keep=lambda i, j: not (i >= rows - 2 and rng.random() < 0.12))

    def weight(p):
        t = smooth((0.92 - p.z) / 0.42)
        wl = t * 0.85 * smooth((p.x + 0.04) / 0.10)
        wr = t * 0.85 * smooth((-p.x + 0.04) / 0.10)
        return {'hips': max(0.0, 1 - wl - wr), 'upperleg.l': wl, 'upperleg.r': wr}

    cloth.add(g, weight)


def gorget(armor):
    for k, (bottom, top, grow) in enumerate(((1.462, 1.515, 0.036), (1.505, 1.552, 0.024), (1.542, 1.585, 0.016))):
        zs = [bottom, bottom + 0.008, top - 0.008, top]
        g = Geo()
        rings = []
        for z in zs:
            rx, rf, rb = torso_at(min(z, 1.6))
            flare = 0.03 * (top - z) / (top - bottom)
            rings.append(ring(Vector((0, 0.005, z)), X, FRONT, rx + grow + flare, rf + grow + flare, 28, ry_neg=rb + grow + flare))
        g.loft(rings, masks=trims(4, IRON))
        armor.add(g, rigid('chest'), solidify=0.006)


# ───────────── 腕と手 ─────────────

def arm(armor, segs, side):
    sx = 1 if side == 'l' else -1
    S = segs[f'upperarm.{side}'][0]
    E = segs[f'lowerarm.{side}'][0]
    W = segs[f'wrist.{side}'][0]
    H = segs[f'hand.{side}'][0]
    G = segs[f'handslot.{side}'][0]
    out = X * sx

    def along(a, b, t):
        return a.lerp(b, t)

    # 下地（鎖かたびら）
    pts = [(S + out * -0.055, 0.062), (S, 0.062), (along(S, E, 0.5), 0.056), (E, 0.05), (along(E, W, 0.5), 0.046), (W + out * 0.01, 0.036)]
    g = Geo()
    g.loft([ring(p, Z, FRONT, r, r, N_LIMB) for p, r in pts], masks=[m(CHAIN)] * len(pts))
    armor.add(g, envelope(['chest', f'upperarm.{side}', f'lowerarm.{side}', f'wrist.{side}'], segs))

    # 上腕の筒
    a0, a1 = along(S, E, 0.3), along(S, E, 0.9)
    tube(armor, a0, a1, [0.068, 0.067, 0.064, 0.06, 0.059], rigid(f'upperarm.{side}'))

    # 肘当て：肘の後ろの丸い椀と、外へ張り出す扇
    cup(armor, E + Y * 0.032, Y, 0.058, 0.055, rigid(f'lowerarm.{side}'), wing=out, wing_r=0.085)

    # 前腕の筒と、籠手の広がった袖口
    tube(armor, along(E, W, 0.18), along(E, W, 0.82), [0.056, 0.055, 0.052, 0.048, 0.046], rigid(f'lowerarm.{side}'))
    tube(armor, W - out * 0.085, W + out * 0.03, [0.066, 0.064, 0.056, 0.05, 0.048], rigid(f'wrist.{side}'), power=2.2)

    fist(armor, H, G, segs[f'handslot.{side}'], out, side)
    pauldron(armor, S, out, side)


def tube(acc, a, b, radii, weight, power=2.0, n=N_LIMB, cls=IRON, solid=0.006):
    axis = b - a
    u, v = frame_for(axis)
    count = len(radii)
    ts = [i / (count - 1) for i in range(count)]
    # 両端に細い帯を足して、縁飾りを細く
    ts = [0.0, 0.04] + ts[1:-1] + [0.96, 1.0]
    rs = [radii[0], radii[0]] + radii[1:-1] + [radii[-1], radii[-1]]
    g = Geo()
    g.loft([ring(a + axis * t, u, v, r, r, n, power=power) for t, r in zip(ts, rs)], masks=trims(len(ts), cls))
    acc.add(g, weight, solidify=solid)


def cup(acc, center, axis, ru, rv, weight, wing=None, wing_r=None, depth=0.03, n=20):
    """椀形の板（肘・膝）。axis が椀の頂点の向き。wing の側だけ外へ尖らせる"""
    u, v = frame_for(axis)
    if wing is not None and abs(u.dot(wing)) < abs(v.dot(wing)):
        u, v = v, u
    flip = wing is not None and u.dot(wing) < 0
    rings = []
    steps = [(1.0, 0.0), (0.92, 0.35), (0.78, 0.62), (0.55, 0.85), (0.3, 0.96), (0.08, 1.0)]
    for k, (sc, h) in enumerate(steps[::-1]):
        def shape(t, x, y, sc=sc):
            if wing is not None and ((x > 0) != flip):
                # 扇：外側を尖らせて長く
                x *= 1 + (wing_r / ru - 1) * (abs(math.cos(t)) ** 3) * sc
            return x, y
        rings.append(ring(center + axis * (depth * h), u, v, ru * sc, rv * sc, n, shape=shape))
    g = Geo()
    masks = [m(IRON, 0, 1)] * (len(rings) - 2) + [m(IRON, 1, 1)] * 2
    g.loft(rings, masks=masks, cap0=True)
    acc.add(g, weight, solidify=0.006)


def fist(armor, H, G, slot, out, side):
    """握り拳（指の骨が無いので、握った形で作る）。右手は剣の柄を握る位置 G を中心に指を巻く"""
    grip_axis = (slot[1] - slot[0]).normalized()  # 刃の向き（T ポーズでは正面）
    bone = f'hand.{side}'
    w = rigid(bone)

    # 手の甲（手首から指の付け根まで）
    knuckle_x = (G - H).dot(out) + 0.005
    rings = []
    count = 6
    for i in range(count):
        t = i / (count - 1)
        p = H + out * (knuckle_x * t - 0.008) + Z * lerp(0.0, (G.z - H.z) + 0.016, t)
        rings.append(ring(p, grip_axis, Z, lerp(0.04, 0.046, t), lerp(0.024, 0.02, t), 16, power=2.6))
    g = Geo()
    g.loft(rings, masks=[m(IRON, 1 if i in (0, count - 1) else 0, 1) for i in range(count)], cap0=True, cap1=True)
    armor.add(g, w, solidify=0.0)

    # 指4本：柄のまわりを巻く。人差し指が刃の側
    for k, (off, r) in enumerate(((-0.031, 0.0115), (-0.010, 0.012), (0.011, 0.0115), (0.03, 0.0102))):
        center = G + grip_axis * off
        R = 0.028
        rings = []
        masks = []
        angles = [95, 60, 25, -15, -60, -105, -150, -185]
        for i, deg in enumerate(angles):
            a = math.radians(deg)
            p = center + Z * (R * math.sin(a)) + out * (R * math.cos(a))
            tangent = Z * math.cos(a) - out * math.sin(a)
            u, v = frame_for(tangent)
            rings.append(ring(p, u, v, r, r * 0.95, 10))
            masks.append(m(IRON, 1.0 if i in (2, 5) else 0.0, 0))
        g = Geo()
        g.loft(rings, masks=masks, cap0=True, cap1=True)
        armor.add(g, w)

    # 親指：手のひらの内側から、人差し指の上へかぶせる
    p0 = G - out * 0.04 + Z * -0.02 + grip_axis * -0.03
    p1 = G - out * 0.03 + Z * 0.03 + grip_axis * -0.05
    p2 = G + out * 0.008 + Z * 0.03 + grip_axis * -0.042
    rings = []
    for i in range(6):
        t = i / 5
        p = p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t
        tangent = (p1 - p0) * 2 * (1 - t) + (p2 - p1) * 2 * t
        u, v = frame_for(tangent)
        r = lerp(0.014, 0.0105, t)
        rings.append(ring(p, u, v, r, r, 10))
    g = Geo()
    g.loft(rings, masks=[m(IRON, 1 if i == 3 else 0, 0) for i in range(6)], cap0=True, cap1=True)
    armor.add(g, w)


def pauldron(armor, S, out, side):
    """肩当て：肩を包む丸い椀の下に、腕へ向かって細くなる板を3枚重ねる。各板は下の縁が外へ開く"""
    bone = f'upperarm.{side}'
    center = S + Z * -0.008
    # 椀：首の側は小さく、肩の先で最も大きく丸く
    dome = [(-0.085, 0.045), (-0.07, 0.078), (-0.045, 0.104), (-0.015, 0.119), (0.02, 0.126), (0.055, 0.127), (0.066, 0.132)]
    lames = [dome,
             [(0.045, 0.112), (0.07, 0.116), (0.095, 0.122), (0.102, 0.126)],
             [(0.085, 0.102), (0.11, 0.106), (0.135, 0.112), (0.142, 0.116)],
             [(0.125, 0.092), (0.15, 0.096), (0.172, 0.101), (0.178, 0.105)]]
    for k, prof in enumerate(lames):
        sag = Z * (-0.01 * k)
        cover = math.radians(122 - 8 * k)
        rings = []
        masks = []
        for i, (p, r) in enumerate(prof):
            rings.append(ring(center + out * p + sag, Z, Y, r, r * 1.06, 20, a0=-cover, a1=cover, closed=False))
            masks.append(m(IRON, 1.0 if i >= len(prof) - 2 else 0.0, 1.0))
        g = Geo()
        g.loft(rings, closed=False, masks=masks)
        for i in range(len(prof)):
            for j in (0, 20):
                g.mask[i * 21 + j] = (1.0, IRON, 1.0, 1.0)
        armor.add(g, rigid(bone), solidify=0.007)


# ───────────── 脚 ─────────────

def leg(armor, segs, side):
    sx = 1 if side == 'l' else -1
    hip = segs[f'upperleg.{side}'][0]
    knee = segs[f'lowerleg.{side}'][0]
    ankle = segs[f'foot.{side}'][0]
    ball = segs[f'toes.{side}'][0]
    tip = segs[f'toes.{side}'][1]
    line = [hip + Z * 0.05, hip, knee, ankle]
    out = X * sx

    # 下地
    prof = [(0.99, 0.085), (0.93, 0.088), (0.80, 0.078), (0.62, 0.064), (0.50, 0.056), (0.40, 0.058), (0.26, 0.046), (0.10, 0.04)]
    g = Geo()
    g.loft([ring(path_point(line, z), X, FRONT, r, r, N_LIMB) for z, r in prof], masks=[m(CHAIN)] * len(prof))
    armor.add(g, envelope(['hips', f'upperleg.{side}', f'lowerleg.{side}', f'foot.{side}'], segs))

    # 腿当て：前と横を覆い、後ろは開いている
    zs = [0.875, 0.862, 0.80, 0.72, 0.62, 0.57, 0.558]
    radii = {0.875: 0.098, 0.862: 0.099, 0.80: 0.094, 0.72: 0.086, 0.62: 0.078, 0.57: 0.075, 0.558: 0.074}
    g = Geo()
    a0, a1 = math.radians(-50), math.radians(230)
    rings = [ring(path_point(line, z), X * sx, FRONT, radii[z], radii[z] * 1.05, 22, a0=a0 if sx > 0 else math.pi - a1,
                  a1=a1 if sx > 0 else math.pi - a0, closed=False) for z in zs]
    g.loft(rings, closed=False, masks=trims(len(zs), IRON))
    for i in range(len(zs)):
        for j in (0, 22):
            g.mask[i * 23 + j] = (1.0, IRON, 1.0, 1.0)
    armor.add(g, rigid(f'upperleg.{side}'), solidify=0.006)

    # 膝当て（外側に扇）
    cup(armor, knee + FRONT * 0.05 + Z * 0.01, FRONT, 0.06, 0.07, rigid(f'lowerleg.{side}'), wing=out, wing_r=0.09, depth=0.028)

    # 脛当て：ふくらはぎの膨らみ、前に鎬
    prof = [(0.47, 0.060, 0.064, 0.068), (0.455, 0.061, 0.064, 0.07), (0.42, 0.063, 0.064, 0.08), (0.35, 0.061, 0.060, 0.083),
            (0.27, 0.055, 0.055, 0.07), (0.19, 0.047, 0.05, 0.056), (0.14, 0.046, 0.05, 0.052), (0.115, 0.05, 0.056, 0.056), (0.105, 0.051, 0.057, 0.057)]
    g = Geo()
    g.loft([ring(path_point(line, z), X, FRONT, rx, rf, 22, power=1.7, ry_neg=rb, power_neg=2.1) for z, rx, rf, rb in prof],
           masks=trims(len(prof), IRON))
    armor.add(g, rigid(f'lowerleg.{side}'), solidify=0.006)

    sabaton(armor, ankle, ball, tip, side)


def sabaton(armor, ankle, ball, tip, side):
    """鉄靴：甲は板を重ね、つま先は細く尖らせる。底は革"""
    heel_y = ankle.y + 0.075
    # 甲（踵から指の付け根まで）
    samples = [(heel_y, 0.040, 0.075), (heel_y - 0.02, 0.046, 0.095), (ankle.y, 0.05, 0.10), (lerp(ankle.y, ball.y, 0.5), 0.05, 0.075), (ball.y, 0.048, 0.05)]
    g = Geo()
    rings = []
    for y, wdt, hgt in samples:
        c = Vector((ankle.x, y, hgt / 2))
        rings.append(ring(c, X, Z, wdt, hgt / 2, 18, power=2.2, power_neg=7))
    g.loft(rings, masks=[m(IRON, 1 if i in (2, 3) else 0, 1) for i in range(len(rings))], cap0=True)
    armor.add(g, rigid(f'foot.{side}'), solidify=0.0)

    # つま先
    g = Geo()
    rings = []
    steps = 5
    for i in range(steps):
        t = i / (steps - 1)
        y = lerp(ball.y + 0.012, tip.y - 0.01, t)
        wdt = lerp(0.047, 0.012, t ** 1.4)
        hgt = lerp(0.052, 0.016, t)
        rings.append(ring(Vector((ankle.x, y, hgt / 2)), X, Z, wdt, hgt / 2, 18, power=2.2, power_neg=7))
    g.loft(rings, masks=[m(IRON, 1 if i in (0, 2) else 0, 1) for i in range(steps)], cap1=True)
    armor.add(g, rigid(f'toes.{side}'))


# ───────────── 頭：兜と王冠 ─────────────

HELM = [  # z, 横, 前, 後ろ
    (1.555, 0.098, 0.105, 0.108), (1.565, 0.102, 0.112, 0.112), (1.60, 0.108, 0.122, 0.114), (1.66, 0.113, 0.128, 0.118),
    (1.705, 0.114, 0.129, 0.119), (1.714, 0.114, 0.129, 0.119), (1.733, 0.114, 0.128, 0.119), (1.78, 0.109, 0.121, 0.116),
    (1.82, 0.097, 0.106, 0.103), (1.845, 0.078, 0.082, 0.08), (1.858, 0.05, 0.052, 0.05), (1.862, 0.02, 0.02, 0.02),
]
HELM_N = 28


def helm_ring(z, grow=0.0, n=HELM_N):
    for a, b in zip(HELM, HELM[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            _, rx, rf, rb = (lerp(x, y, t) for x, y in zip(a, b))
            break
    else:
        _, rx, rf, rb = HELM[0] if z < HELM[0][0] else HELM[-1]
    return ring(Vector((0, 0.0, z)), X, FRONT, rx + grow, rf + grow, n, power=1.75, ry_neg=rb + grow, power_neg=2.2)


def helmet(armor, segs):
    w = rigid('head')
    zs = [row[0] for row in HELM]
    slit_band = zs.index(1.714)
    g = Geo()
    masks = [m(IRON, 1.0 if i in (0, 1) else 0.0, 1.0) for i in range(len(zs))]

    def keep(i, j):
        # 目の切れ込み：正面 ±62° の帯だけ穴にする（ring の t=90° が正面）
        if i != slit_band:
            return True
        t = 360 * (j + 0.5) / HELM_N
        return abs(t - 90) > 62

    idx = [g.add(helm_ring(z), masks[i]) for i, z in enumerate(zs)]
    for i in range(len(idx) - 1):
        for j in range(HELM_N):
            if keep(i, j):
                a, b = idx[i], idx[i + 1]
                k = (j + 1) % HELM_N
                g.f.append((a[j], a[k], b[k], b[j]))
    armor.add(g, w, solidify=0.007)

    # 内側の暗い裏地（切れ込みの奥を暗く見せる）
    g = Geo()
    g.loft([helm_ring(z, -0.03, 24) for z in (1.69, 1.72, 1.75)], masks=[m(LEATHER, 0, 0, 0.04)] * 3)
    armor.add(g, w)

    # 額の帯（金）と、顔の中心の縦の筋
    g = Geo()
    g.loft([helm_ring(z, gr) for z, gr in ((1.745, 0.0), (1.748, 0.004), (1.762, 0.004), (1.765, 0.0))], masks=[m(GOLD, 1, 1)] * 4)
    armor.add(g, w)
    g = Geo()
    rows = []
    for z in (1.58, 1.62, 1.68, 1.705):
        c = helm_ring(z, 0.002, HELM_N)[HELM_N // 4]
        rows.append([c + X * -0.006, c + X * 0.0 + FRONT * 0.004, c + X * 0.006])
    g.grid(rows, masks=[m(IRON, 0, 0)] * 4)
    armor.add(g, w, solidify=0.004)

    crown(armor)


# 王冠の尖塔：正面がいちばん高い。高さ（m）と、左右の小さな棘の有無
SPIRES = [(0.165, True), (0.085, False), (0.13, True), (0.07, False), (0.115, True), (0.075, False),
          (0.105, False), (0.075, False), (0.115, True), (0.07, False), (0.13, True), (0.085, False)]


def crown(armor):
    w = rigid('head')
    rng = random.Random(3)
    band = [(1.792, 0.0), (1.797, 0.004), (1.832, 0.006), (1.838, 0.008)]
    base_r = (0.111, 0.119, 0.114)  # 横・前・後ろ

    def ellipse(z, grow, n=40):
        rx, rf, rb = (r + grow for r in base_r)
        return ring(Vector((0, 0.0, z)), X, FRONT, rx, rf, n, ry_neg=rb)

    g = Geo()
    g.loft([ellipse(z, gr) for z, gr in band], masks=[m(GOLD, 0, 1)] * len(band))
    armor.add(g, w, solidify=0.005)

    # 上下の縁の玉縁
    for z, gr in ((1.794, 0.006), (1.836, 0.011)):
        path = ellipse(z, gr, 40)
        rings = []
        for i, p in enumerate(path + path[:1]):
            nxt = path[(i + 1) % len(path)]
            u, v = frame_for(nxt - p)
            rings.append(ring(p, u, v, 0.0045, 0.0045, 6))
        g = Geo()
        g.loft(rings, masks=[m(GOLD, 1, 0)] * len(rings))
        armor.add(g, w)

    # 尖塔
    n = len(SPIRES)
    for i, (height, thorns) in enumerate(SPIRES):
        a = 2 * math.pi * i / n
        outward = Vector((math.sin(a), -math.cos(a), 0))
        base = ellipse(1.836, 0.009, n * 4)[(i * 4 + n) % (n * 4)]
        # ring の t=0 は +X なので、正面（t=90°）から並ぶよう位置を取り直す
        rx, rf, rb = (r + 0.009 for r in base_r)
        base = Vector((math.sin(a) * rx, -math.cos(a) * (rf if math.cos(a) > 0 else rb), 1.834))
        lean = Z + outward * 0.1 + Vector((rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), 0))
        tangent = Z.cross(outward).normalized()
        steps = [(0.0, 1.0), (0.12, 0.92), (0.3, 0.72), (0.52, 0.5), (0.72, 0.3), (0.88, 0.14), (1.0, 0.0)]
        rings = []
        for t, s in steps:
            c = base + lean.normalized() * (height * t) + outward * (0.004 * math.sin(t * 3.1) * rng.uniform(0.5, 1.5))
            rings.append(ring(c, tangent, outward, 0.012 * s, 0.006 * s, 4, power=1.1))
        g = Geo()
        g.loft(rings, masks=[m(GOLD, 0, 0)] * len(rings), cap0=True)
        armor.add(g, w)
        if thorns:
            for sgn in (-1, 1):
                p0 = base + lean.normalized() * height * 0.38 + tangent * sgn * 0.006
                d = (tangent * sgn + Z * 0.9 + outward * 0.2).normalized()
                rings = []
                for t, s in ((0.0, 1.0), (0.5, 0.55), (1.0, 0.0)):
                    u, v = frame_for(d)
                    rings.append(ring(p0 + d * 0.03 * t, u, v, 0.004 * s, 0.004 * s, 4))
                g = Geo()
                g.loft(rings, masks=[m(GOLD)] * 3, cap0=True)
                armor.add(g, w)
        # 尖塔の間の小さな突起
        a2 = a + math.pi / n
        out2 = Vector((math.sin(a2), -math.cos(a2), 0))
        b2 = Vector((math.sin(a2) * rx, -math.cos(a2) * (rf if math.cos(a2) > 0 else rb), 1.834))
        t2 = Z.cross(out2).normalized()
        rings = [ring(b2 + Z * h, t2, out2, 0.01 * s, 0.005 * s, 4, power=1.1) for h, s in ((0, 1), (0.016, 0.5), (0.03, 0))]
        g = Geo()
        g.loft(rings, masks=[m(GOLD)] * 3, cap0=True)
        armor.add(g, w)


# ───────────── マント ─────────────

CAPE_COLS = 30
CAPE_ROWS = 24
CAPE_CHAINS = {'r': -0.55, 'c': 0.0, 'l': 0.55}
CAPE_JOINTS = [0.1, 0.38, 0.68, 1.0]


def cape_point(u, v, hem_z, folds=True):
    z_top = 1.50 - 0.05 * u * u
    z = lerp(z_top, hem_z, v)
    phimax = math.radians(lerp(118, 64, smooth(v / 0.16)))
    phi = u * phimax
    t = smooth(v / 0.16)
    rx = lerp(0.17, 0.26, t) + 0.13 * max(0.0, v - 0.16)
    ry = lerp(0.12, 0.20, t) + 0.13 * max(0.0, v - 0.16)
    cy = lerp(0.0, 0.035, t) + 0.09 * max(0.0, v - 0.16)
    r_off = 0.0
    if folds:
        amp = lerp(0.003, 0.032, smooth(v / 0.8))
        r_off = amp * math.sin(phi * 9 + 0.7) + amp * 0.5 * math.sin(phi * 4 + 2.1)
    return Vector((math.sin(phi) * (rx + r_off), cy + math.cos(phi) * (ry + r_off), z))


def cape(cloth, segs):
    rng = random.Random(11)
    hem = []
    for j in range(CAPE_COLS + 1):
        u = -1 + 2 * j / CAPE_COLS
        hem.append(0.13 + 0.07 * abs(u) + rng.uniform(-0.03, 0.05) + (0.05 if j % 2 else 0.0) + (0.08 if rng.random() < 0.18 else 0))
    rows = []
    masks = []
    for i in range(CAPE_ROWS + 1):
        v = (i / CAPE_ROWS) ** 1.15
        rows.append([cape_point(-1 + 2 * j / CAPE_COLS, v, hem[j]) for j in range(CAPE_COLS + 1)])
        masks.append(m(CLOTH, smooth((v - 0.8) / 0.2), 1.0))
    g = Geo()
    g.grid(rows, masks=masks, keep=lambda i, j: not (i > CAPE_ROWS * 0.72 and rng.random() < 0.1))
    # 前の端（肩から下がる縁）も擦り切れて暗く
    for i in range(CAPE_ROWS + 1):
        for j in (0, CAPE_COLS):
            r, c, e, d = g.mask[i * (CAPE_COLS + 1) + j]
            g.mask[i * (CAPE_COLS + 1) + j] = (max(r, 0.6), c, e, d)

    def v_of(p):
        return max(0.0, min(1.0, (1.5 - p.z) / (1.5 - 0.17)))

    def u_of(p):
        cy = 0.06
        return max(-1.0, min(1.0, math.atan2(p.x, p.y - cy + 0.2) / math.radians(70)))

    cloth.add(g, lambda p: cape_weight(u_of(p), v_of(p)))

    # 首の後ろにたまった頭巾（布のふくらみ）
    g = Geo()
    path_n = 26
    rings = []
    for i in range(path_n + 1):
        t = -1 + 2 * i / path_n
        phi = t * math.radians(125)
        sag = 0.045 * (1 - t * t)
        c = Vector((math.sin(phi) * 0.15, 0.015 + math.cos(phi) * 0.125, 1.515 - sag))
        nxt_phi = phi + 0.01
        tangent = Vector((math.cos(nxt_phi), -math.sin(nxt_phi), 0))
        u, v = frame_for(tangent)
        r = lerp(0.022, 0.05, 1 - abs(t) ** 1.5) * (1 + 0.12 * math.sin(i * 1.9))
        rings.append(ring(c, u, v, r, r * 0.85, 10))
    g.loft(rings, masks=[m(CLOTH, 0, 1)] * len(rings), cap0=True, cap1=True)
    cloth.add(g, rigid('chest'))


def cape_weight(u, v):
    """縦：胸 → マントの骨3節。横：右・中・左の3列。隣り合う2つずつで配分"""
    centers = [CAPE_JOINTS[0] / 2] + [(a + b) / 2 for a, b in zip(CAPE_JOINTS, CAPE_JOINTS[1:])]
    names = ['chest', 1, 2, 3]
    vert = {}
    if v <= centers[0]:
        vert = {'chest': 1.0}
    elif v >= centers[-1]:
        vert = {3: 1.0}
    else:
        for k in range(len(centers) - 1):
            if centers[k] <= v <= centers[k + 1]:
                t = (v - centers[k]) / (centers[k + 1] - centers[k])
                vert = {names[k]: 1 - t, names[k + 1]: t}
                break
    cols = sorted(CAPE_CHAINS.items(), key=lambda kv: kv[1])
    horiz = {}
    if u <= cols[0][1]:
        horiz = {cols[0][0]: 1.0}
    elif u >= cols[-1][1]:
        horiz = {cols[-1][0]: 1.0}
    else:
        for (na, ua), (nb, ub) in zip(cols, cols[1:]):
            if ua <= u <= ub:
                t = (u - ua) / (ub - ua)
                horiz = {na: 1 - t, nb: t}
                break
    out = {}
    for key, wv in vert.items():
        if key == 'chest':
            out['chest'] = out.get('chest', 0) + wv
            continue
        for chain, wh in horiz.items():
            name = f'cape_{chain}_{key}'
            out[name] = out.get(name, 0) + wv * wh
    return out


def add_cape_bones(arm):
    """マントの骨：右・中・左に3節ずつ。動きはゲームのコードが速さに合わせて付ける"""
    import bpy
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    chest = eb['chest']
    for chain, u in CAPE_CHAINS.items():
        parent = chest
        for k in range(3):
            v0, v1 = CAPE_JOINTS[k], CAPE_JOINTS[k + 1]
            b = eb.new(f'cape_{chain}_{k + 1}')
            b.head = cape_point(u, v0, 0.2, folds=False)
            b.tail = cape_point(u, v1, 0.2, folds=False)
            b.roll = 0
            b.parent = parent
            b.use_connect = k > 0
            b.use_deform = True
            parent = b
    bpy.ops.object.mode_set(mode='OBJECT')


# ───────────── 剣 ─────────────

def sword(armor, segs):
    """長剣：刃 0.88m（鎬と樋のある菱形の断面）、十字の鍔、革巻きの柄、円盤の柄頭。右手の握りの骨に固定"""
    G, tail = segs['handslot.r']
    d = (tail - G).normalized()  # 刃の向き
    wdir = X  # 刃の幅の向き（元の剣と同じ）
    tdir = d.cross(wdir).normalized()
    w = rigid('handslot.r')

    def blade_section(s, half_w, thick):
        pts = [(1.0, 0.0), (0.55, 1.0), (-0.55, 1.0), (-1.0, 0.0), (-0.55, -1.0), (0.55, -1.0)]
        return [G + d * s + wdir * (x * half_w) + tdir * (y * thick) for x, y in pts]

    g = Geo()
    blade = [(0.118, 0.022, 0.0065), (0.13, 0.026, 0.0065), (0.3, 0.025, 0.006), (0.55, 0.023, 0.0055), (0.8, 0.0205, 0.005),
             (0.93, 0.016, 0.0045), (0.98, 0.008, 0.003), (1.005, 0.0005, 0.0005)]
    g.loft([blade_section(s, hw, th) for s, hw, th in blade], masks=[m(STEEL, 0, 0)] * len(blade), cap0=True)
    armor.add(g, w)

    # 鍔：横に伸び、両端が刃の側へ少し反って広がる
    g = Geo()
    rings = []
    for i in range(11):
        t = -1 + 2 * i / 10
        curve = 0.018 * t * t
        flare = 1 + 0.6 * max(0.0, abs(t) - 0.75) / 0.25
        c = G + d * (0.108 + curve) + wdir * (0.115 * t)
        rings.append(ring(c, d, tdir, 0.008 * flare, 0.009 * (1.4 if abs(t) < 0.15 else 1.0), 8, power=2.6))
    g.loft(rings, masks=[m(IRON, 1 if i in (0, 10) else 0, 1) for i in range(11)], cap0=True, cap1=True)
    armor.add(g, w)

    # 柄（革巻きの段）
    g = Geo()
    rings = []
    masks = []
    u, v = wdir, tdir
    for i in range(13):
        s = lerp(0.098, -0.098, i / 12)
        r = 0.0155 + (0.0018 if i % 2 else 0.0) - 0.002 * abs(s) / 0.1
        rings.append(ring(G + d * s, u, v, r, r * 0.85, 10))
        masks.append(m(LEATHER))
    g.loft(rings, masks=masks)
    armor.add(g, w)

    # 柄頭
    g = Geo()
    prof = [(-0.098, 0.012), (-0.104, 0.022), (-0.112, 0.029), (-0.122, 0.03), (-0.131, 0.024), (-0.137, 0.012), (-0.139, 0.002)]
    g.loft([ring(G + d * s, u, v, r, r * 0.6, 12) for s, r in prof], masks=[m(GOLD, 0, 1)] * len(prof), cap1=True)
    armor.add(g, w)


def build(armor, cloth, segs):
    torso(armor, cloth, segs)
    for side in ('l', 'r'):
        arm(armor, segs, side)
        leg(armor, segs, side)
    helmet(armor, segs)
    cape(cloth, segs)
    sword(armor, segs)
