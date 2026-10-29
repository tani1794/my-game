# 王冠の騎士（public/models/knight-crown.glb の元）を Blender で組み立てる。
# 使い方は scripts/knight/build-knight.mjs から（bpy を入れた Python で実行する）:
#   python scripts/knight/build.py <骨格と動きの元 .glb> <出力フォルダ> [--no-bake]
# 元の .glb は、KayKit の騎士（public/models/knight.glb）を圧縮なしに戻したもの。骨格と12本の動きだけ使い、メッシュは捨てる。
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import geo  # noqa: E402
import parts  # noqa: E402
import rig  # noqa: E402

OLD_SKIP = {'Knight_Cape', '1H_Sword', 'Icosphere'}


def material(name, color, metal, rough, double=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    mat.use_backface_culling = not double
    return mat


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    src, out_dir = argv[0], argv[1]
    bake = '--no-bake' not in argv
    os.makedirs(out_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    arm = rig.armature()

    old_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in OLD_SKIP]
    print('元のモデルの接地を測る…')
    old_lows = rig.lowest_points(arm, old_meshes)
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)

    arm.animation_data.action = None
    arm.data.pose_position = 'REST'
    rig.retarget(arm)
    rig.rescale_actions()
    rig.fix_poses(arm)
    parts.add_cape_bones(arm)
    segs = rig.bone_segments(arm)

    armor = geo.Acc('Knight_Armor')
    cloth = geo.Acc('Knight_Cloth')
    parts.build(armor, cloth, segs)
    mat_armor = material('Knight_Armor', (0.08, 0.075, 0.07, 1), 0.7, 0.45)
    mat_cloth = material('Knight_Cloth', (0.06, 0.07, 0.04, 1), 0.0, 0.85, double=True)
    objs = [armor.build(arm, mat_armor), cloth.build(arm, mat_cloth)]
    for o in objs:
        print(f'{o.name}: 頂点 {len(o.data.vertices)}、三角形 {sum(len(p.vertices) - 2 for p in o.data.polygons)}')

    arm.data.pose_position = 'POSE'
    print('新しいモデルの接地を合わせる…')
    new_lows = rig.lowest_points(arm, [objs[0]])
    rig.fix_ground(arm, old_lows, new_lows)

    if bake:
        import bake as baker
        baker.bake_all(objs, out_dir)

    for o in objs:
        attr = o.data.color_attributes.get('mask')
        if attr:
            o.data.color_attributes.remove(attr)

    arm.animation_data.action = None
    for t in arm.animation_data.nla_tracks:
        t.mute = False
    bpy.context.scene.frame_set(0)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, 'knight-crown-raw.glb'),
        export_format='GLB',
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_frame_step=1,
        export_anim_single_armature=True,
        export_reset_pose_bones=True,
        export_vertex_color='NONE',
        export_materials='EXPORT',
        export_image_format='NONE',
        export_extras=False,
        export_def_bones=False,
    )
    print('書き出し完了')


main()
