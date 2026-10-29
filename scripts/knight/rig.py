# 骨格：KayKit の騎士（約2頭身）の骨を、成人の比率（約7.5頭身）へ組み直す。
# 骨の向きと回転の軸はそのまま、長さと付け根の位置だけを変えるので、12本の動きは回転をそのまま使える。
# 座標は Blender（Z が上、-Y が正面、+X が騎士の左手側）。単位はメートル。
import math
from mathutils import Vector
from bpy_extras import anim_utils
import bpy

# IK の補助骨。メッシュを動かさないので消す（動きのデータも軽くなる）
IK_BONES = [
    'kneeIK.l', 'control-toe-roll.l', 'control-heel-roll.l', 'control-foot-roll.l', 'heelIK.l', 'IK-foot.l', 'IK-toe.l',
    'kneeIK.r', 'control-toe-roll.r', 'control-heel-roll.r', 'control-foot-roll.r', 'heelIK.r', 'IK-foot.r', 'IK-toe.r',
    'elbowIK.l', 'handIK.l', 'elbowIK.r', 'handIK.r',
]

# 腰の上下の揺れなど、骨の移動量の倍率（脚の長さの比 ≒ 1.9）
LEG_RATIO = 1.9

# 新しい比率。頭の付け根 1.555m、兜の頂点 1.86m、王冠の先 2.0m
HIPS_Z = 0.97
SPINE = 0.12  # 腰の骨の長さ（背骨の付け根まで）
LOWER_BACK = 0.20
CHEST = 0.22
HEAD_Z = 1.555
HEAD_LEN = 0.25
SHOULDER = Vector((0.195, 0.0, 1.445))
UPPER_ARM = 0.29
FOREARM = 0.26
WRIST = 0.055
HAND = 0.095
GRIP_SCALE = 0.7  # 手の骨から握りの位置まで（元の比）
HIP_JOINT = Vector((0.095, 0.0, 0.93))
KNEE_Z = 0.50
ANKLE_Z = 0.085
BALL_Z = 0.025
TOES = 0.13


def channelbag(action):
    return anim_utils.action_get_channelbag_for_slot(action, action.slots[0])


def armature():
    return next(o for o in bpy.data.objects if o.type == 'ARMATURE')


def _set(eb, head, direction, length):
    eb.use_connect = False
    eb.head = head
    eb.tail = head + direction.normalized() * length


def _length_to_z(head, direction, z):
    d = direction.normalized()
    return (head.z - z) / -d.z


def retarget(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    old = {b.name: (b.head.copy(), b.tail.copy(), (b.tail - b.head)) for b in eb}

    for name in IK_BONES:
        if name in eb:
            eb.remove(eb[name])

    def chain(name, head, length):
        _set(eb[name], head, old[name][2], length)
        return eb[name].tail.copy()

    up = chain('hips', Vector((0, 0, HIPS_Z)), SPINE)
    up = chain('spine', up, LOWER_BACK)
    chain('chest', up, CHEST)
    chain('head', Vector((0, 0, HEAD_Z)), HEAD_LEN)

    for side, sx in (('l', 1), ('r', -1)):
        p = chain(f'upperarm.{side}', Vector((sx * SHOULDER.x, SHOULDER.y, SHOULDER.z)), UPPER_ARM)
        p = chain(f'lowerarm.{side}', p, FOREARM)
        p = chain(f'wrist.{side}', p, WRIST)
        hand_head = p
        chain(f'hand.{side}', p, HAND)
        # 握りの位置：元の手の骨からのずれを、手の大きさに合わせて縮める
        o_hand = old[f'hand.{side}'][0]
        o_slot_head, o_slot_tail, o_slot_dir = old[f'handslot.{side}']
        _set(eb[f'handslot.{side}'], hand_head + (o_slot_head - o_hand) * GRIP_SCALE, o_slot_dir, o_slot_dir.length * GRIP_SCALE)

        hip = Vector((sx * HIP_JOINT.x, HIP_JOINT.y, HIP_JOINT.z))
        d = old[f'upperleg.{side}'][2]
        p = chain(f'upperleg.{side}', hip, _length_to_z(hip, d, KNEE_Z))
        d = old[f'lowerleg.{side}'][2]
        p = chain(f'lowerleg.{side}', p, _length_to_z(p, d, ANKLE_Z))
        d = old[f'foot.{side}'][2]
        p = chain(f'foot.{side}', p, _length_to_z(p, d, BALL_Z))
        chain(f'toes.{side}', p, TOES)

    bpy.ops.object.mode_set(mode='OBJECT')


# 骨の移動量を新しい長さに合わせ、地面を進む動き（ルートモーション）を消す。
# 移動はゲームのコードが受け持つので、クリップの中で体が前後左右へずれると二重に動いてしまう
def rescale_actions():
    for action in bpy.data.actions:
        bag = channelbag(action)
        dodge = action.name.startswith('Dodge_')
        for fc in list(bag.fcurves):
            bone = fc.data_path.split('"')[1] if '"' in fc.data_path else ''
            if bone in IK_BONES or (bone == 'root' and fc.data_path.endswith('location')):
                bag.fcurves.remove(fc)
                continue
            if not fc.data_path.endswith('location'):
                continue
            # 腰の骨の局所軸：Y が上、X が左右、Z が前後。回避は前後左右のずれを消す（上下は残す）
            if dodge and bone == 'hips' and fc.array_index in (0, 2):
                bag.fcurves.remove(fc)
                continue
            for k in fc.keyframe_points:
                k.co[1] *= LEG_RATIO
                k.handle_left[1] *= LEG_RATIO
                k.handle_right[1] *= LEG_RATIO


def add_rotation(arm, action, bone_name, axis_world, angle_of):
    """骨を、Blender の座標の軸まわりに回し足す。angle_of(クリップ内の位置 0〜1) が角度（ラジアン）"""
    from mathutils import Quaternion
    bone = arm.data.bones[bone_name]
    axis = (bone.matrix_local.to_3x3().inverted() @ axis_world).normalized()
    path = f'pose.bones["{bone_name}"].rotation_quaternion'
    bag = channelbag(action)
    curves = [bag.fcurves.find(path, index=i) for i in range(4)]
    if None in curves:
        return
    f0, f1 = action.frame_range
    frames = sorted({k.co[0] for fc in curves for k in fc.keyframe_points} | set(frames_of(action)))
    values = [Quaternion([fc.evaluate(f) for fc in curves]) for f in frames]
    for fc in curves:
        fc.keyframe_points.clear()
        fc.keyframe_points.add(len(frames))
    for n, (f, q) in enumerate(zip(frames, values)):
        q2 = Quaternion(axis, angle_of((f - f0) / max(f1 - f0, 1e-6))) @ q
        for i, fc in enumerate(curves):
            k = fc.keyframe_points[n]
            k.co = (f, q2[i])
            k.interpolation = 'LINEAR'
    for fc in curves:
        fc.update()


# 元のモデルは胴が太いので、腕を大きく開いて構えている。人の体格では脇を締めた方が自然なので、
# 上腕を体の側へ一律に寄せる（攻撃の振りの形はそのまま、全体が少し内側になる）
ARM_TUCK = math.radians(14)
# 元の倒れ方は、大きな頭が地面に当たって背中が浮いた姿勢で止まる。頭が小さいと背中が宙に浮くので、後半で背中を寝かせる
DEATH_LIE_DOWN = math.radians(-16)


def fix_poses(arm):
    for action in bpy.data.actions:
        for side, sign in (('l', 1), ('r', -1)):
            add_rotation(arm, action, f'upperarm.{side}', Vector((0, 1, 0)), lambda t, a=sign * ARM_TUCK: a)
    death = bpy.data.actions.get('Death_A')
    if death:
        def lie(t):
            t = max(0.0, min(1.0, (t - 0.3) / 0.55))
            return DEATH_LIE_DOWN * t * t * (3 - 2 * t)
        add_rotation(arm, death, 'spine', Vector((1, 0, 0)), lie)


def bone_segments(arm):
    return {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones}


def frames_of(action):
    f0, f1 = action.frame_range
    frames = list(range(int(math.floor(f0)), int(math.floor(f1)) + 1))
    if f1 - frames[-1] > 1e-3:
        frames.append(f1)
    return frames


def use_action(arm, action):
    ad = arm.animation_data
    for t in ad.nla_tracks:
        t.mute = True
    ad.action = action
    ad.action_slot = action.slots[0]


# 各コマで、体（マントと剣を除く）のいちばん低い点の高さを測る
def lowest_points(arm, objects):
    scene = bpy.context.scene
    result = {}
    for action in bpy.data.actions:
        use_action(arm, action)
        lows = []
        for f in frames_of(action):
            scene.frame_set(int(f), subframe=f - int(f))
            dg = bpy.context.evaluated_depsgraph_get()
            low = math.inf
            for obj in objects:
                ev = obj.evaluated_get(dg)
                mesh = ev.to_mesh()
                mw = ev.matrix_world
                for v in mesh.vertices:
                    low = min(low, (mw @ v.co).z)
                ev.to_mesh_clear()
            lows.append(low)
        result[action.name] = lows
    return result


# 足が地面に埋まったり浮いたりしないよう、腰の高さをコマごとに足し引きする。
# 元のモデルで接地していたコマ（いちばん低い点が0）は新しいモデルでも0に、跳んでいるコマは脚の比で高くする
def fix_ground(arm, old_lows, new_lows):
    for action in bpy.data.actions:
        bag = channelbag(action)
        fc = bag.fcurves.find('pose.bones["hips"].location', index=1)
        frames = frames_of(action)
        values = [fc.evaluate(f) if fc else 0.0 for f in frames]
        if fc is None:
            fc = bag.fcurves.new('pose.bones["hips"].location', index=1)
        fc.keyframe_points.clear()
        fc.keyframe_points.add(len(frames))
        for k, f, value, old, new in zip(fc.keyframe_points, frames, values, old_lows[action.name], new_lows[action.name]):
            target = max(0.0, old) * LEG_RATIO
            k.co = (f, value + (target - new))
            k.interpolation = 'LINEAR'
        fc.update()
