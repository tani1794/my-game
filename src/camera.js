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

// ── カメラ：ボタン以外の画面をドラッグして回す ──
export function createFollowCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );

  let yaw = 0;
  let pitch = 0.14;
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

    yaw -= (event.clientX - drag.x) * 0.006;
    pitch = THREE.MathUtils.clamp(
      pitch + (event.clientY - drag.y) * 0.004,
      0.15,
      0.9,
    );

    drag.x = event.clientX;
    drag.y = event.clientY;
  });

  function release(event) {
    if (drag?.id === event.pointerId) drag = null;
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  function update(target) {
    const pose = cameraPose(target, yaw, pitch, DISTANCE, SHOULDER);
    camera.position.copy(pose.position);
    camera.lookAt(pose.lookAt);
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function clear() {
    drag = null;
  }

  return { camera, yaw: () => yaw, update, resize, clear };
}
