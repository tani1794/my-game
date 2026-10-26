import * as THREE from 'three';

const LOOK_HEIGHT = 1.3;
const DISTANCE = 5.5;
// 注視点を画面の右へずらし、主人公を中央やや左に映す（肩越しの構図）
const SHOULDER = 1.1;

// 主人公の位置から、カメラの位置と注視点を決める
export function cameraPose(target, yaw, pitch, distance, shoulder) {
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const lookAt = new THREE.Vector3(target.x, target.y + LOOK_HEIGHT, target.z).addScaledVector(right, shoulder);

  const position = new THREE.Vector3(
    lookAt.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    lookAt.y + Math.sin(pitch) * distance,
    lookAt.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );

  return { position, lookAt };
}

const DRAG_YAW = 0.006;
const DRAG_PITCH = 0.004;
const PITCH_MIN = 0.05;
const PITCH_MAX = 0.9;
const LOCK_TURN_SPEED = Math.PI; // 1秒に180度
const LOOK_AROUND = Math.PI / 6; // ロック中の見回しは左右30度まで
const LOOK_RETURN_SPEED = LOOK_AROUND / 0.5; // 指を離すと0.5秒で戻る
const LAG_TIME = 0.07; // 回避中の遅れ（約0.2秒で追いつく）
const SHAKE_TIME = 0.2;
const SHAKE_AMOUNT = 0.15;
// 壁で寄ったあと、元の距離へ戻る速さ（1秒に何 m）
const ZOOM_RETURN_SPEED = 3;
const GROUND_CLEARANCE = 0.4;
// 壁際では、壁の手前まで寄れるように小さく（近すぎるときは、物語側で主人公を隠す）
const MIN_DISTANCE = 0.35;

// 主人公の後ろから結晶獣を見る yaw（カメラは主人公から見て結晶獣の反対側）
export function lockYaw(player, beast) {
  return Math.atan2(player.x - beast.x, player.z - beast.z);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// 画面や指に依存しないカメラの動き：自由視点、ロックオン、見回し、揺れ、遅れ
export function createCameraRig() {
  let yaw = 0;
  let pitch = 0.14;
  let lookOffset = 0;
  let dragging = false;
  let lock = null;
  let lag = false;
  let shakeLeft = 0;
  let shakeStrength = 0;
  let shakeTime = 0;
  const follow = new THREE.Vector3();
  let hasFollow = false;
  let distance = DISTANCE;

  function drag(dx, dy) {
    dragging = true;
    if (lock) lookOffset = THREE.MathUtils.clamp(lookOffset - dx * DRAG_YAW, -LOOK_AROUND, LOOK_AROUND);
    else yaw -= dx * DRAG_YAW;
    pitch = THREE.MathUtils.clamp(pitch + dy * DRAG_PITCH, PITCH_MIN, PITCH_MAX);
  }

  function release() {
    dragging = false;
  }

  // ロックする相手（{x, z}）か null。解除したときは、その時点の向きのまま
  function setLock(target) {
    if (!target && lock) {
      yaw = wrap(yaw + lookOffset);
      lookOffset = 0;
    }
    lock = target ? { x: target.x, z: target.z } : null;
  }

  function shake(strength = 1) {
    shakeLeft = SHAKE_TIME;
    shakeStrength = strength;
  }

  // options.limit(lookAt, position) → 注視点からカメラまでで、遮る物の手前までの距離（なければ Infinity）
  // options.ground(x, z) → その場所の地面の高さ。カメラは地面より上に置く
  function update(target, dt, options = {}) {
    // 回避中は、少し遅れて主人公を追う
    if (!hasFollow || !lag) follow.copy(target);
    else follow.lerp(target, 1 - Math.exp(-dt / LAG_TIME));
    hasFollow = true;

    if (lock) {
      const desired = lockYaw(target, lock);
      const diff = wrap(desired - yaw);
      yaw = wrap(yaw + Math.sign(diff) * Math.min(Math.abs(diff), LOCK_TURN_SPEED * dt));
      if (!dragging) {
        const back = Math.min(Math.abs(lookOffset), LOOK_RETURN_SPEED * dt);
        lookOffset -= Math.sign(lookOffset) * back;
      }
    }

    const viewYaw = wrap(yaw + lookOffset);
    let pose = cameraPose(follow, viewYaw, pitch, DISTANCE, SHOULDER);
    // 壁や幹があれば、すぐにその手前まで寄る。なくなったら、ゆっくり戻る
    const allowed = options.limit ? Math.max(MIN_DISTANCE, Math.min(DISTANCE, options.limit(pose.lookAt, pose.position))) : DISTANCE;
    distance = allowed < distance ? allowed : Math.min(allowed, distance + ZOOM_RETURN_SPEED * dt);
    if (distance < DISTANCE) pose = cameraPose(follow, viewYaw, pitch, distance, SHOULDER * (distance / DISTANCE));
    if (options.ground) {
      const floor = options.ground(pose.position.x, pose.position.z) + GROUND_CLEARANCE;
      if (pose.position.y < floor) pose.position.y = floor;
    }

    // 揺れ：0.2 秒で弱まって消える
    if (shakeLeft > 0) {
      shakeLeft = Math.max(0, shakeLeft - dt);
      shakeTime += dt;
      const amount = SHAKE_AMOUNT * shakeStrength * (shakeLeft / SHAKE_TIME);
      pose.position.x += Math.sin(shakeTime * 91) * amount;
      pose.position.y += Math.sin(shakeTime * 73 + 1) * amount;
      pose.position.z += Math.sin(shakeTime * 57 + 2) * amount * 0.5;
    }

    return { ...pose, yaw: viewYaw, pitch };
  }

  return {
    drag,
    release,
    setLock,
    shake,
    setLag: (value) => { lag = value; },
    update,
    yaw: () => wrap(yaw + lookOffset),
    setYaw: (value) => { yaw = wrap(value); lookOffset = 0; },
    setPitch: (value) => { pitch = THREE.MathUtils.clamp(value, PITCH_MIN, PITCH_MAX); },
    locked: () => lock !== null,
  };
}

// ── カメラ：ボタン以外の画面をドラッグして回す ──
export function createFollowCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );

  const rig = createCameraRig();
  let drag = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (drag !== null) return;
    canvas.setPointerCapture(event.pointerId);
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;

    rig.drag(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });

  function release(event) {
    if (drag?.id === event.pointerId) {
      drag = null;
      rig.release();
    }
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  function update(target, dt = 0, options = {}) {
    const pose = rig.update(target, dt, options);
    camera.position.copy(pose.position);
    camera.lookAt(pose.lookAt);
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function clear() {
    drag = null;
    rig.release();
  }

  return {
    camera,
    yaw: rig.yaw,
    setYaw: rig.setYaw,
    setPitch: rig.setPitch,
    update,
    resize,
    clear,
    setLock: rig.setLock,
    locked: rig.locked,
    shake: rig.shake,
    setLag: rig.setLag,
  };
}
