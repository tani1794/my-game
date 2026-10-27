// 地図の部品（kit.js）の床と壁を、立体にする。床は厚みのある石の台、坂は傾いた台、道は区間ごとの台、壁は箱。
// 見た目と当たり判定を同じデータから作るので、ずれない。
import * as THREE from 'three';
import { worldUV } from '../chapter/materials.js';
import { floorHeight } from './kit.js';

function slab(material, w, h, d, uvSize = 2) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), uvSize), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 床1つ分の立体。depth は台の厚み（下へ伸ばす量）
export function floorMesh(floor, material, depth = 1.2) {
  const group = new THREE.Group();
  group.name = `floor-${floor.id ?? floor.type}`;
  if (floor.type === 'rect') {
    const w = floor.x1 - floor.x0;
    const d = floor.z1 - floor.z0;
    if (floor.toY === undefined) {
      const mesh = slab(material, w, depth, d);
      mesh.position.set((floor.x0 + floor.x1) / 2, floor.y - depth / 2, (floor.z0 + floor.z1) / 2);
      group.add(mesh);
    } else {
      // 坂：傾けた台
      const along = floor.axis === 'x' ? w : d;
      const rise = floor.toY - floor.y;
      const length = Math.hypot(along, rise);
      const mesh = slab(material, floor.axis === 'x' ? length : w, depth, floor.axis === 'x' ? d : length);
      mesh.position.set((floor.x0 + floor.x1) / 2, (floor.y + floor.toY) / 2 - depth / 2, (floor.z0 + floor.z1) / 2);
      if (floor.axis === 'x') mesh.rotation.z = Math.atan2(rise, along);
      else mesh.rotation.x = -Math.atan2(rise, along);
      group.add(mesh);
    }
  } else if (floor.type === 'circle') {
    const mesh = new THREE.Mesh(worldUV(new THREE.CylinderGeometry(floor.radius, floor.radius * 0.96, depth, 28), 2), material);
    mesh.position.set(floor.x, floor.y - depth / 2, floor.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  } else {
    // 道：区間ごとに、傾いた台をつなぐ（つなぎ目には丸い台を置いて隙間をふさぐ）
    for (let i = 0; i < floor.points.length - 1; i++) {
      const [ax, az, ay] = floor.points[i];
      const [bx, bz, by] = floor.points[i + 1];
      const flat = Math.hypot(bx - ax, bz - az);
      const length = Math.hypot(flat, by - ay);
      const mesh = slab(material, floor.width, depth, length);
      mesh.position.set((ax + bx) / 2, (ay + by) / 2 - depth / 2, (az + bz) / 2);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = Math.atan2(bx - ax, bz - az);
      mesh.rotation.x = -Math.atan2(by - ay, flat);
      group.add(mesh);
      if (i > 0) {
        const joint = new THREE.Mesh(new THREE.CylinderGeometry(floor.width / 2, floor.width / 2, depth, 16), material);
        joint.position.set(ax, ay - depth / 2 - 0.01, az);
        joint.receiveShadow = true;
        group.add(joint);
      }
    }
  }
  return group;
}

export function wallMesh(box, material, uvSize = 2) {
  const height = box.y1 - box.y0;
  const mesh = slab(material, box.hx * 2, height, box.hz * 2, uvSize);
  mesh.position.set(box.x, box.y0 + height / 2, box.z);
  mesh.rotation.y = box.angle;
  return mesh;
}

// 床の上の点（高さつき）。物を床に置くときに使う
export function onFloor(level, x, z, y, state = {}) {
  return new THREE.Vector3(x, level.heightAt(x, z, y, state), z);
}

export { floorHeight };
