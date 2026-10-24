import * as THREE from 'three';

// ── カメラ：ボタン以外の画面をドラッグして回す ──
export function createFollowCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );

  let yaw = 0;
  let pitch = 0.4;
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

  const lookAt = new THREE.Vector3();
  const distance = 6;

  function update(target) {
    lookAt.copy(target);
    lookAt.y += 1.1;

    camera.position.set(
      lookAt.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      lookAt.y + Math.sin(pitch) * distance,
      lookAt.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(lookAt);
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
