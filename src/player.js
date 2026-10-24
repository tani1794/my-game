import * as THREE from 'three';

const WALK_SPEED = 3;
const RUN_SPEED = 6;
const PLAYER_RADIUS = 0.4;

// スティックの向き（moveZ が正なら前進）を、カメラの向き yaw を基準にワールドの向きへ変換
export function moveToWorld(moveX, moveZ, yaw) {
  return {
    x: moveX * Math.cos(yaw) - moveZ * Math.sin(yaw),
    z: -moveX * Math.sin(yaw) - moveZ * Math.cos(yaw),
  };
}

export function speedFor({ moveX, moveZ, run }) {
  if (run) return RUN_SPEED;
  return WALK_SPEED * Math.min(1, Math.hypot(moveX, moveZ));
}

function canMove(x, z, colliders, bound) {
  if (Math.abs(x) > bound || Math.abs(z) > bound) return false;

  return colliders.every((collider) => {
    return Math.hypot(x - collider.x, z - collider.z) > collider.radius + PLAYER_RADIUS;
  });
}

// x と z を別々に判定して、ぶつかった方向だけ止める（壁沿いに滑る）
export function stepPosition(pos, dir, distance, colliders, bound = 28) {
  let { x, z } = pos;

  const nextX = x + dir.x * distance;
  if (canMove(nextX, z, colliders, bound)) x = nextX;

  const nextZ = z + dir.z * distance;
  if (canMove(x, nextZ, colliders, bound)) z = nextZ;

  return { x, z };
}

// ── 仮プレイヤー：青い胴体＋頭＋正面の目印 ──
export function createPlayer(scene) {
  const object = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.65, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#37a5d5' }),
  );
  body.position.y = 0.85;
  object.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 8),
    new THREE.MeshStandardMaterial({ color: '#e3c1a1' }),
  );
  head.position.y = 1.6;
  object.add(head);

  const front = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.18),
    new THREE.MeshStandardMaterial({ color: '#f7d67c' }),
  );
  front.position.set(0, 1.6, 0.25);
  object.add(front);

  scene.add(object);

  function update(dt, input, yaw, colliders, heightAt) {
    const direction = moveToWorld(input.moveX, input.moveZ, yaw);
    const length = Math.hypot(direction.x, direction.z);

    if (length > 0) {
      direction.x /= length;
      direction.z /= length;

      const next = stepPosition(
        object.position,
        direction,
        speedFor(input) * dt,
        colliders,
      );
      object.position.x = next.x;
      object.position.z = next.z;
      object.rotation.y = Math.atan2(direction.x, direction.z);
    }

    object.position.y = heightAt(object.position.x, object.position.z);
  }

  return { object, update };
}
