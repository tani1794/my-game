# 材質の焼き付け：頂点の印（mask 属性）と位置から、手続き的な模様（彫金の金線、鎖かたびら、布の金の葉脈、汚れ）を作り、
# Cycles で UV の画像へ焼き付ける。出力は材質ごとに color / orm（R=陰り、G=粗さ、B=金属）/ normal の PNG。
import math
import os
import bpy
import numpy as np

SIZE = 1024


def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        if k.startswith('_'):
            setattr(n, k[1:], v)
        else:
            n.inputs[k].default_value = v
    return n


def ramp(nt, src, stops, constant=False):
    r = nt.nodes.new('ShaderNodeValToRGB')
    if constant:
        r.color_ramp.interpolation = 'CONSTANT'
    els = r.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0]
    for pos, col in stops[1:]:
        e = els.new(pos)
        e.color = col
    nt.links.new(src, r.inputs['Fac'])
    return r.outputs['Color']


def mix(nt, a, b, fac, blend='MIX'):
    n = nt.nodes.new('ShaderNodeMix')
    n.data_type = 'RGBA'
    n.blend_type = blend
    for sock, val in ((n.inputs[0], fac), (n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(val, (int, float)):
            sock.default_value = val
        elif isinstance(val, tuple):
            sock.default_value = val
        else:
            nt.links.new(val, sock)
    return n.outputs[2]


def math_node(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.use_clamp = clamp
    for sock, val in ((n.inputs[0], a), (n.inputs[1], b)):
        if val is None:
            continue
        if isinstance(val, (int, float)):
            sock.default_value = val
        else:
            nt.links.new(val, sock)
    return n.outputs[0]


def contour_lines(nt, coord, scale, width, detail=2.0, distortion=0.0, w=0.0):
    """ノイズの等高線＝曲がりくねった細い線（彫金・葉脈）"""
    noise = node(nt, 'ShaderNodeTexNoise', Scale=scale, Detail=detail, Distortion=distortion)
    noise.noise_dimensions = '4D'
    noise.inputs['W'].default_value = w
    nt.links.new(coord, noise.inputs['Vector'])
    d = math_node(nt, 'SUBTRACT', noise.outputs['Fac'], 0.5)
    d = math_node(nt, 'ABSOLUTE', d)
    return math_node(nt, 'SUBTRACT', 1.0, math_node(nt, 'DIVIDE', d, width), clamp=True)


def armor_tree(mat):
    nt = mat.node_tree
    nt.nodes.clear()
    coord = node(nt, 'ShaderNodeTexCoord').outputs['Object']
    attr = node(nt, 'ShaderNodeVertexColor', _layer_name='mask')
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(attr.outputs['Color'], sep.inputs['Color'])
    trim = ramp(nt, sep.outputs['Red'], [(0.45, (0, 0, 0, 1)), (0.6, (1, 1, 1, 1))])
    cls = sep.outputs['Green']
    etch = sep.outputs['Blue']
    dark = attr.outputs['Alpha']

    # 種類ごとの色：鉄・金・革・鎖・刃
    base = ramp(nt, cls, [(0.0, (0.042, 0.039, 0.037, 1)), (0.125, (0.36, 0.22, 0.075, 1)), (0.375, (0.055, 0.033, 0.02, 1)),
                          (0.625, (0.05, 0.048, 0.046, 1)), (0.875, (0.55, 0.55, 0.56, 1))], constant=True)
    rough = ramp(nt, cls, [(0.0, (0.48, 0.48, 0.48, 1)), (0.125, (0.36, 0.36, 0.36, 1)), (0.375, (0.72, 0.72, 0.72, 1)),
                           (0.625, (0.62, 0.62, 0.62, 1)), (0.875, (0.22, 0.22, 0.22, 1))], constant=True)
    metal = ramp(nt, cls, [(0.0, (0.85, 0.85, 0.85, 1)), (0.125, (1, 1, 1, 1)), (0.375, (0, 0, 0, 1)),
                           (0.625, (0.9, 0.9, 0.9, 1)), (0.875, (1, 1, 1, 1))], constant=True)

    # むら（煤・錆）
    grime = node(nt, 'ShaderNodeTexNoise', Scale=9.0, Detail=6.0, Roughness=0.6)
    nt.links.new(coord, grime.inputs['Vector'])
    grime_f = ramp(nt, grime.outputs['Fac'], [(0.3, (0.7, 0.7, 0.7, 1)), (0.7, (1.25, 1.2, 1.15, 1))])
    base = mix(nt, base, grime_f, 1.0, 'MULTIPLY')

    # 彫金：鉄の上の金の細い線（参考画像の金の線刻）
    # 線は細く、模様が入るのは板の一部（大きなむらで区切る）だけにして、黒鉄の地を主役にする
    lines = contour_lines(nt, coord, 11.0, 0.014, detail=1.5, distortion=0.4)
    lines2 = contour_lines(nt, coord, 23.0, 0.018, detail=1.0, w=3.0)
    lines = math_node(nt, 'MAXIMUM', lines, math_node(nt, 'MULTIPLY', lines2, 0.7))
    zone = node(nt, 'ShaderNodeTexNoise', Scale=3.2, Detail=1.0)
    zone.noise_dimensions = '4D'
    zone.inputs['W'].default_value = 7.0
    nt.links.new(coord, zone.inputs['Vector'])
    lines = math_node(nt, 'MULTIPLY', lines, ramp_bw(nt, zone.outputs['Fac'], 0.5, 0.58))
    engraved = math_node(nt, 'MULTIPLY', lines, etch)
    is_iron = ramp(nt, cls, [(0.0, (1, 1, 1, 1)), (0.1, (0, 0, 0, 1))], constant=True)
    is_iron = node_bw(nt, is_iron)
    engraved = math_node(nt, 'MULTIPLY', engraved, is_iron)
    gold = (0.30, 0.19, 0.07, 1)
    base = mix(nt, base, gold, math_node(nt, 'MULTIPLY', engraved, 0.85))
    edge = math_node(nt, 'MULTIPLY', node_bw(nt, trim), is_iron)
    base = mix(nt, base, (0.34, 0.215, 0.08, 1), edge)
    rough = mix(nt, rough, (0.33, 0.33, 0.33, 1), math_node(nt, 'MAXIMUM', engraved, edge))
    metal = mix(nt, metal, (1, 1, 1, 1), math_node(nt, 'MAXIMUM', engraved, edge))
    base = mix(nt, base, (0, 0, 0, 1), math_node(nt, 'SUBTRACT', 1.0, dark))

    # 凹凸：打ち出しのむら＋彫金の溝＋鎖の輪
    hammer = node(nt, 'ShaderNodeTexNoise', Scale=60.0, Detail=2.0)
    nt.links.new(coord, hammer.inputs['Vector'])
    chain = node(nt, 'ShaderNodeTexVoronoi', Scale=120.0)
    chain.feature = 'DISTANCE_TO_EDGE'
    nt.links.new(coord, chain.inputs['Vector'])
    is_chain = node_bw(nt, ramp(nt, cls, [(0.0, (0, 0, 0, 1)), (0.6, (1, 1, 1, 1)), (0.7, (0, 0, 0, 1))], constant=True))
    chain_h = math_node(nt, 'MULTIPLY', ramp_bw(nt, chain.outputs['Distance'], 0.0, 0.12), is_chain)
    height = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', hammer.outputs['Fac'], 0.25),
                       math_node(nt, 'SUBTRACT', math_node(nt, 'MULTIPLY', chain_h, 0.8), math_node(nt, 'MULTIPLY', engraved, 0.6)))
    bump = node(nt, 'ShaderNodeBump', Strength=1.0, Distance=0.006)
    nt.links.new(height, bump.inputs['Height'])
    return finish(nt, base, rough, metal, bump.outputs['Normal'])


def node_bw(nt, color):
    n = nt.nodes.new('ShaderNodeRGBToBW')
    nt.links.new(color, n.inputs['Color'])
    return n.outputs['Val']


def ramp_bw(nt, src, a, b):
    return node_bw(nt, ramp(nt, src, [(a, (0, 0, 0, 1)), (b, (1, 1, 1, 1))]))


def cloth_tree(mat):
    nt = mat.node_tree
    nt.nodes.clear()
    coord = node(nt, 'ShaderNodeTexCoord').outputs['Object']
    attr = node(nt, 'ShaderNodeVertexColor', _layer_name='mask')
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(attr.outputs['Color'], sep.inputs['Color'])
    fray = sep.outputs['Red']
    etch = sep.outputs['Blue']

    # くすんだ深緑。大きなむらで色を揺らす
    var = node(nt, 'ShaderNodeTexNoise', Scale=4.0, Detail=5.0)
    nt.links.new(coord, var.inputs['Vector'])
    base = ramp(nt, var.outputs['Fac'], [(0.3, (0.018, 0.022, 0.012, 1)), (0.7, (0.050, 0.058, 0.030, 1))])
    # 金糸の葉脈（参考画像のマントの金の模様）
    veins = contour_lines(nt, coord, 6.0, 0.02, detail=2.5, distortion=0.6)
    veins2 = contour_lines(nt, coord, 14.0, 0.022, detail=1.0, w=5.0)
    v = math_node(nt, 'MAXIMUM', veins, math_node(nt, 'MULTIPLY', veins2, 0.5))
    v = math_node(nt, 'MULTIPLY', v, etch)
    base = mix(nt, base, (0.2, 0.13, 0.045, 1), math_node(nt, 'MULTIPLY', v, 0.65))
    # 擦り切れた裾は暗く
    base = mix(nt, base, (0.012, 0.012, 0.008, 1), math_node(nt, 'MULTIPLY', fray, 0.7))
    rough = mix(nt, (0.86, 0.86, 0.86, 1), (0.5, 0.5, 0.5, 1), v)
    metal = mix(nt, (0, 0, 0, 1), (0.6, 0.6, 0.6, 1), v)

    weave = node(nt, 'ShaderNodeTexWave', Scale=180.0, Distortion=1.0)
    nt.links.new(coord, weave.inputs['Vector'])
    wrinkle = node(nt, 'ShaderNodeTexNoise', Scale=18.0, Detail=3.0)
    nt.links.new(coord, wrinkle.inputs['Vector'])
    height = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', weave.outputs['Fac'], 0.15), math_node(nt, 'MULTIPLY', wrinkle.outputs['Fac'], 0.6))
    height = math_node(nt, 'ADD', height, math_node(nt, 'MULTIPLY', v, 0.25))
    bump = node(nt, 'ShaderNodeBump', Strength=0.3, Distance=0.003)
    nt.links.new(height, bump.inputs['Height'])
    return finish(nt, base, rough, metal, bump.outputs['Normal'])


def finish(nt, base, rough, metal, normal):
    """焼き付け用の出口：emission で色・粗さ金属を、BSDF で法線を焼く"""
    out = node(nt, 'ShaderNodeOutputMaterial')
    emit = node(nt, 'ShaderNodeEmission', Strength=1.0)
    orm = nt.nodes.new('ShaderNodeCombineColor')
    nt.links.new(node_bw(nt, rough), orm.inputs['Green'])
    nt.links.new(node_bw(nt, metal), orm.inputs['Blue'])
    bsdf = node(nt, 'ShaderNodeBsdfPrincipled')
    nt.links.new(normal, bsdf.inputs['Normal'])
    img = nt.nodes.new('ShaderNodeTexImage')
    nt.nodes.active = img
    return {'nt': nt, 'out': out, 'emit': emit, 'base': base, 'orm': orm.outputs['Color'], 'bsdf': bsdf, 'img': img}


def unwrap(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003, area_weight=0.0, correct_aspect=True,
                             scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_pass(obj, info, kind, colorspace, size=SIZE, samples=1):
    img = bpy.data.images.new(f'{obj.name}_{kind}', size, size, alpha=False)
    img.colorspace_settings.name = colorspace
    info['img'].image = img
    info['nt'].nodes.active = info['img']
    nt = info['nt']
    for link in list(info['out'].inputs['Surface'].links):
        nt.links.remove(link)
    scene = bpy.context.scene
    scene.cycles.samples = samples
    if kind == 'color':
        nt.links.new(info['base'], info['emit'].inputs['Color'])
        nt.links.new(info['emit'].outputs[0], info['out'].inputs['Surface'])
        bpy.ops.object.bake(type='EMIT', margin=8)
    elif kind == 'rm':
        nt.links.new(info['orm'], info['emit'].inputs['Color'])
        nt.links.new(info['emit'].outputs[0], info['out'].inputs['Surface'])
        bpy.ops.object.bake(type='EMIT', margin=8)
    elif kind == 'normal':
        nt.links.new(info['bsdf'].outputs[0], info['out'].inputs['Surface'])
        bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', margin=8)
    elif kind == 'ao':
        nt.links.new(info['bsdf'].outputs[0], info['out'].inputs['Surface'])
        scene.world.light_settings.distance = 0.25
        bpy.ops.object.bake(type='AO', margin=8)
    return img


def pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def save(img, arr, path):
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()


def bake_all(objs, out_dir):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    trees = {'Knight_Armor': armor_tree, 'Knight_Cloth': cloth_tree}
    for obj in objs:
        print(f'焼き付け: {obj.name}')
        unwrap(obj)
        mat = obj.data.materials[0]
        info = trees[obj.name](mat)
        color = pixels(bake_pass(obj, info, 'color', 'sRGB'))
        rm = pixels(bake_pass(obj, info, 'rm', 'Non-Color'))
        ao = pixels(bake_pass(obj, info, 'ao', 'Non-Color', samples=48))
        normal = bake_pass(obj, info, 'normal', 'Non-Color', samples=4)

        occ = np.clip(ao[..., 0] * 1.1, 0, 1)
        # 色にも陰りを半分だけ混ぜる（太陽の光でも凹みが読めるように）
        shade = 0.55 + 0.45 * occ
        color[..., :3] *= shade[..., None]
        orm = np.stack([occ, rm[..., 1], rm[..., 2], np.ones_like(occ)], axis=-1)
        save(bpy.data.images[f'{obj.name}_color'], color, os.path.join(out_dir, f'{obj.name}_color.png'))
        save(bpy.data.images[f'{obj.name}_rm'], orm, os.path.join(out_dir, f'{obj.name}_orm.png'))
        normal.filepath_raw = os.path.join(out_dir, f'{obj.name}_normal.png')
        normal.file_format = 'PNG'
        normal.save()

        # 書き出し用の材質に戻す（画像は後で gltf-transform で付ける）
        nt = mat.node_tree
        nt.nodes.clear()
        out = node(nt, 'ShaderNodeOutputMaterial')
        bsdf = node(nt, 'ShaderNodeBsdfPrincipled')
        nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
