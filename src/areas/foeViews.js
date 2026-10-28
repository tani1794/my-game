// エリアの敵の見た目。頭脳は src/story/enemy.js（frame を受け取って形と動きに写す）。
// 人型（槍・盾・祈り手）は KayKit Skeleton_Warrior（CC0）に持ち物と色を変えて使う。
// 晶牙ハウンド・硝子羽の蝙蝠・結晶甲虫・晶糸の蜘蛛は、関節ごとに分けてコードで作った体（src/areas/creatures.js）。
// ほかの獣・巨兵は、手元に合う立体素材がないため、コードで組み立てた仮の形（輪郭・大きさ・動きで見分ける）。
// 予兆は足もとの橙の印（今までの結晶獣と同じ描き方）、詠唱は紫の輪、強化は金の輪、蜘蛛の糸は地面の網。
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLTF, measureModel, withFallback } from '../assets.js';
import { asset } from '../paths.js';
import { createTelegraphs } from '../world/telegraph.js';
import { createCreature } from './creatures.js';

const FADE = 0.15;
const HUMAN_HEIGHT = 1.9;
// 専用の模型を持つ人型（骨格と動作は skeleton_warrior と同じ。持ち物も模型に入っている。原寸のまま使う）
const MODELS = { spear: 'models/revenant-spear-v2.glb' };

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
}
const crystal = (color = '#8fe9ff', glow = '#2bb7ff', intensity = 0.9) => mat(color, { emissive: glow, emissiveIntensity: intensity, roughness: 0.25, transparent: true, opacity: 0.92 });

function add(parent, geometry, material, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// ── コードで組み立てる体 ──
// 返り値：{ body（揺らす部分）, legs, wings, parts（弱点）, animate? }
const BUILDERS = {
  // 晶角の突貫獣（精鋭）：大きな四つ足、前へ突き出した巨大な結晶の角、肩の結晶の鎧
  charger() {
    const body = new THREE.Group();
    const hide = mat('#3a3433');
    add(body, new THREE.SphereGeometry(1, 14, 10), hide, [0, 1.55, 0], [0, 0, 0], [1.1, 0.9, 1.7]);
    add(body, new THREE.SphereGeometry(0.6, 12, 10), hide, [0, 1.45, 1.75], [0, 0, 0], [1, 0.9, 1.1]);
    const glass = crystal('#9eeaff', '#2bb7ff', 1.1);
    add(body, new THREE.ConeGeometry(0.32, 1.9, 6), glass, [0, 1.65, 2.6], [Math.PI / 2 - 0.15, 0, 0]);
    for (const [x, z, s] of [[0.6, 0.6, 0.7], [-0.6, 0.6, 0.7], [0.4, -0.2, 0.55], [-0.45, -0.3, 0.6], [0, 0.2, 0.8]]) {
      add(body, new THREE.OctahedronGeometry(0.4 * s, 0), glass, [x, 2.4, z], [0.3, x, 0.2], [0.7, 1.6, 0.7]);
    }
    const legs = [[0.65, 1.0], [-0.65, 1.0], [0.65, -1.0], [-0.65, -1.0]].map(([x, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.2, z);
      add(pivot, new THREE.BoxGeometry(0.38, 1.2, 0.38), hide, [0, -0.6, 0]);
      body.add(pivot);
      return pivot;
    });
    return { body, legs };
  },
  // 砕晶の巨兵（精鋭）：岩の巨人。前腕に大きな結晶（弱点）。叩きつけで腕を振り上げる
  giant() {
    const body = new THREE.Group();
    const rock = mat('#4b4f55', { flatShading: true, roughness: 1 });
    add(body, new THREE.DodecahedronGeometry(0.9, 0), rock, [0, 2.6, 0], [0.2, 0.3, 0], [1.25, 1.15, 0.9]);
    add(body, new THREE.DodecahedronGeometry(0.45, 0), rock, [0, 3.75, 0.15]);
    add(body, new THREE.SphereGeometry(0.08, 6, 4), mat('#9fe7ff', { emissive: '#9fe7ff', emissiveIntensity: 2.5 }), [0, 3.8, 0.55]);
    const legs = [0.5, -0.5].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.7, 0);
      add(pivot, new THREE.BoxGeometry(0.6, 1.7, 0.6), rock, [0, -0.85, 0]);
      body.add(pivot);
      return pivot;
    });
    const glass = crystal('#9eeaff', '#2bb7ff', 0.8);
    const parts = [];
    const arms = [1.25, -1.25].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 3.1, 0);
      add(pivot, new THREE.BoxGeometry(0.55, 1.2, 0.55), rock, [0, -0.6, 0]);
      add(pivot, new THREE.BoxGeometry(0.75, 1.0, 0.75), rock, [0, -1.6, 0.1]);
      const cluster = new THREE.Group();
      cluster.position.set(0, -1.6, 0.1);
      for (const [cx, cy, cz] of [[0.35, 0.2, 0.2], [-0.3, 0, 0.35], [0, -0.3, -0.35], [0.3, -0.25, -0.1]]) {
        add(cluster, new THREE.OctahedronGeometry(0.32, 0), glass.clone(), [cx, cy, cz], [cx, cy, cz], [0.7, 1.5, 0.7]);
      }
      pivot.add(cluster);
      parts.push(cluster);
      body.add(pivot);
      return pivot;
    });
    return { body, legs, arms, parts };
  },
  // ── 霜葬峡谷 ──
  // 霜牙狼：細身の白い四つ足、首まわりの霜の毛、長い尾
  wolf() {
    const body = new THREE.Group();
    const fur = mat('#c9d3da');
    add(body, new THREE.SphereGeometry(0.45, 10, 8), fur, [0, 0.8, 0], [0, 0, 0], [0.7, 0.62, 1.5]);
    add(body, new THREE.SphereGeometry(0.28, 10, 8), fur, [0, 1.0, 0.78], [0, 0, 0], [0.85, 0.85, 1.4]);
    add(body, new THREE.ConeGeometry(0.06, 0.2, 4), fur, [0.12, 1.25, 0.72]);
    add(body, new THREE.ConeGeometry(0.06, 0.2, 4), fur, [-0.12, 1.25, 0.72]);
    add(body, new THREE.SphereGeometry(0.36, 8, 6), mat('#eef4f8'), [0, 0.95, 0.45], [0, 0, 0], [1, 0.9, 0.8]);
    add(body, new THREE.ConeGeometry(0.1, 0.8, 6), fur, [0, 0.9, -0.85], [-2.1, 0, 0]);
    for (const x of [0.1, -0.1]) add(body, new THREE.SphereGeometry(0.04, 6, 4), mat('#bfe8ff', { emissive: '#9fe7ff', emissiveIntensity: 2 }), [x, 1.08, 1.12]);
    const legs = [[0.22, 0.45], [-0.22, 0.45], [0.22, -0.45], [-0.22, -0.45]].map(([x, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.68, z);
      add(pivot, new THREE.BoxGeometry(0.11, 0.68, 0.11), fur, [0, -0.34, 0]);
      body.add(pivot);
      return pivot;
    });
    return { body, legs };
  },
  // 氷羽の梟：丸い体、大きな目、氷の羽
  owl() {
    const body = new THREE.Group();
    const down = mat('#d8dee4');
    add(body, new THREE.SphereGeometry(0.42, 12, 10), down, [0, 0, 0], [0, 0, 0], [0.9, 1.1, 0.9]);
    for (const x of [0.15, -0.15]) {
      add(body, new THREE.SphereGeometry(0.11, 10, 8), mat('#f6e7a8', { emissive: '#ffd36a', emissiveIntensity: 1.2 }), [x, 0.18, 0.34]);
      add(body, new THREE.ConeGeometry(0.06, 0.2, 4), down, [x * 1.4, 0.48, 0.05]);
    }
    add(body, new THREE.ConeGeometry(0.05, 0.14, 4), mat('#5a5048'), [0, 0.04, 0.42], [Math.PI / 2, 0, 0]);
    const ice = crystal('#d8f6ff', '#7fd6ff', 0.5);
    ice.side = THREE.DoubleSide;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.2, 0.1);
    wingShape.lineTo(1.0, -0.3);
    wingShape.lineTo(0.6, -0.45);
    wingShape.lineTo(0.2, -0.35);
    wingShape.lineTo(0, -0.2);
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    wingGeometry.rotateX(-Math.PI / 2);
    const wings = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.3 * side, 0.1, 0);
      const wing = add(pivot, wingGeometry, ice);
      wing.scale.x = side;
      body.add(pivot);
      return { pivot, side };
    });
    return { body, wings };
  },
  // 雪潜り：雪の下から出る、平たい頭と大きな顎の生き物
  burrower() {
    const body = new THREE.Group();
    const hide = mat('#9aa6ad');
    add(body, new THREE.SphereGeometry(0.7, 12, 8), hide, [0, 0.6, 0], [0, 0, 0], [1.1, 0.6, 1.4]);
    add(body, new THREE.BoxGeometry(1.1, 0.25, 0.7), mat('#6f7a80'), [0, 0.45, 0.95], [-0.2, 0, 0]);
    add(body, new THREE.BoxGeometry(1.1, 0.25, 0.7), mat('#6f7a80'), [0, 0.8, 0.95], [0.3, 0, 0]);
    for (let i = 0; i < 5; i++) add(body, new THREE.ConeGeometry(0.06, 0.25, 4), mat('#f2f6f8'), [-0.4 + i * 0.2, 0.62, 1.2], [Math.PI, 0, 0]);
    const legs = [[0.55, 0.3], [-0.55, 0.3], [0.55, -0.4], [-0.55, -0.4]].map(([x, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.4, z);
      add(pivot, new THREE.BoxGeometry(0.22, 0.4, 0.3), hide, [0, -0.2, 0]);
      body.add(pivot);
      return pivot;
    });
    return { body, legs };
  },
  // 氷鎌の蟷螂：細長い体、高く掲げた2本の氷の鎌
  mantis() {
    const body = new THREE.Group();
    const shell = mat('#7fa3a8', { roughness: 0.5 });
    add(body, new THREE.CapsuleGeometry(0.2, 0.9, 4, 8), shell, [0, 1.0, -0.2], [1.2, 0, 0]);
    add(body, new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), shell, [0, 1.45, 0.35], [0.3, 0, 0]);
    add(body, new THREE.ConeGeometry(0.2, 0.35, 3), shell, [0, 1.9, 0.5], [1.3, 0, 0]);
    const ice = crystal('#dff8ff', '#7fd6ff', 0.8);
    const arms = [0.25, -0.25].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.55, 0.5);
      add(pivot, new THREE.BoxGeometry(0.08, 0.6, 0.08), shell, [0, 0.2, 0.1], [-0.6, 0, 0]);
      add(pivot, new THREE.ConeGeometry(0.08, 1.0, 3), ice, [0, 0.4, 0.55], [1.9, 0, 0]);
      body.add(pivot);
      return pivot;
    });
    const legs = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < 2; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(0.15 * side, 0.9, -0.1 - i * 0.4);
        add(pivot, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4), shell, [0.3 * side, -0.4, 0], [0, 0, -0.6 * side]);
        body.add(pivot);
        legs.push(pivot);
      }
    }
    return { body, legs, arms };
  },
  // 雪崩の巨人（精鋭）：雪をまとった毛深い巨人、肩に積もった雪の塊
  yeti() {
    const body = new THREE.Group();
    const fur = mat('#e4ebef', { roughness: 1 });
    add(body, new THREE.SphereGeometry(1.1, 12, 10), fur, [0, 2.4, 0], [0, 0, 0], [1.2, 1.15, 0.95]);
    add(body, new THREE.SphereGeometry(0.5, 12, 10), fur, [0, 3.6, 0.25]);
    add(body, new THREE.BoxGeometry(0.6, 0.25, 0.2), mat('#3a4248'), [0, 3.5, 0.68]);
    for (const x of [0.18, -0.18]) add(body, new THREE.SphereGeometry(0.06, 6, 4), mat('#9fe7ff', { emissive: '#9fe7ff', emissiveIntensity: 2 }), [x, 3.68, 0.7]);
    for (const x of [0.9, -0.9]) add(body, new THREE.DodecahedronGeometry(0.55, 0), mat('#f6fafc'), [x, 3.25, -0.1]);
    const legs = [0.5, -0.5].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.5, 0);
      add(pivot, new THREE.BoxGeometry(0.7, 1.5, 0.7), fur, [0, -0.75, 0]);
      body.add(pivot);
      return pivot;
    });
    const arms = [1.4, -1.4].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 3.0, 0);
      add(pivot, new THREE.BoxGeometry(0.6, 1.4, 0.6), fur, [0, -0.7, 0]);
      add(pivot, new THREE.SphereGeometry(0.5, 10, 8), fur, [0, -1.6, 0.1]);
      body.add(pivot);
      return pivot;
    });
    return { body, legs, arms };
  },
  // 霜葬の白角王イスヴァル（ボス）：巨大な白い鹿。氷の枝角が王冠のように広がる
  stag() {
    const body = new THREE.Group();
    const fur = mat('#eef3f6', { roughness: 0.9 });
    add(body, new THREE.SphereGeometry(1.3, 14, 12), fur, [0, 3.0, 0], [0, 0, 0], [1.0, 0.95, 2.0]);
    add(body, new THREE.CylinderGeometry(0.5, 0.7, 2.0, 10), fur, [0, 4.0, 2.2], [-0.7, 0, 0]);
    add(body, new THREE.SphereGeometry(0.6, 12, 10), fur, [0, 4.9, 3.0], [0, 0, 0], [0.8, 0.8, 1.3]);
    for (const x of [0.28, -0.28]) add(body, new THREE.SphereGeometry(0.09, 8, 6), mat('#bfe8ff', { emissive: '#7fd6ff', emissiveIntensity: 2.5 }), [x, 5.05, 3.6]);
    const ice = crystal('#e8fbff', '#7fd6ff', 1.0);
    // 枝角：左右に3段ずつ枝分かれ
    for (const side of [1, -1]) {
      const antler = new THREE.Group();
      antler.position.set(0.35 * side, 5.3, 2.8);
      add(antler, new THREE.CylinderGeometry(0.08, 0.12, 1.6, 6), ice, [0.4 * side, 0.7, -0.2], [0, 0, -0.55 * side]);
      for (let i = 0; i < 3; i++) {
        add(antler, new THREE.CylinderGeometry(0.05, 0.08, 1.1 - i * 0.2, 5), ice, [(0.5 + i * 0.35) * side, 0.9 + i * 0.35, -0.1 + i * 0.2], [0.4, 0, (-0.1 - i * 0.25) * side]);
        add(antler, new THREE.ConeGeometry(0.07, 0.6, 5), ice, [(0.8 + i * 0.4) * side, 1.5 + i * 0.3, -0.3], [-0.3, 0, -0.3 * side]);
      }
      body.add(antler);
    }
    for (let i = 0; i < 5; i++) add(body, new THREE.OctahedronGeometry(0.3, 0), ice, [0, 4.1, 1.2 - i * 0.6], [0.3, i, 0.2], [0.6, 1.5, 0.6]);
    const legs = [[0.7, 1.6], [-0.7, 1.6], [0.7, -1.6], [-0.7, -1.6]].map(([x, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 2.4, z);
      add(pivot, new THREE.CylinderGeometry(0.18, 0.12, 2.4, 8), fur, [0, -1.2, 0]);
      body.add(pivot);
      return pivot;
    });
    return { body, legs };
  },
};

// 人型の持ち物（KayKit の骨格に付ける）
const GEAR = {
  spear(hand) {
    const group = new THREE.Group();
    add(group, new THREE.CylinderGeometry(0.035, 0.035, 2.8, 6), mat('#5a4a3a'), [0, 0.5, 0], [Math.PI / 2, 0, 0]);
    add(group, new THREE.ConeGeometry(0.09, 0.55, 5), crystal(), [0, 0.5, 1.6], [Math.PI / 2, 0, 0]);
    hand.add(group);
    return group;
  },
  shield(hand, leftHand) {
    const shield = new THREE.Group();
    add(shield, new THREE.BoxGeometry(0.95, 1.25, 0.14), mat('#46505a', { metalness: 0.4, roughness: 0.5 }), [0, 0, 0]);
    for (const [x, y] of [[0.2, 0.25], [-0.2, -0.2], [0.1, -0.35]]) add(shield, new THREE.OctahedronGeometry(0.16, 0), crystal(), [x, y, 0.1]);
    shield.position.set(0, 0, 0.15);
    (leftHand ?? hand).add(shield);
    return shield;
  },
  // 凍槍の亡兵：長い氷の槍
  iceSpear(hand) {
    const group = new THREE.Group();
    add(group, new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), mat('#6b7f8a'), [0, 0.5, 0], [Math.PI / 2, 0, 0]);
    add(group, new THREE.ConeGeometry(0.1, 1.0, 5), crystal('#e8fbff', '#7fd6ff', 1.0), [0, 0.5, 1.75], [Math.PI / 2, 0, 0]);
    hand.add(group);
    return group;
  },
  // 霜盾の墓守：体を隠す縦長の大盾（霜が張りついている）
  frostShield(hand, leftHand) {
    const shield = new THREE.Group();
    add(shield, new THREE.BoxGeometry(1.0, 1.8, 0.18), mat('#5d6a74', { metalness: 0.5, roughness: 0.45 }), [0, 0.2, 0]);
    add(shield, new THREE.BoxGeometry(0.9, 0.12, 0.2), mat('#e6f2f8'), [0, 1.05, 0.02]);
    add(shield, new THREE.BoxGeometry(0.12, 1.5, 0.2), mat('#e6f2f8'), [0, 0.2, 0.05]);
    shield.position.set(0, 0, 0.15);
    (leftHand ?? hand).add(shield);
    return shield;
  },
  // 白息の詠唱者：白い杖と、霜の玉
  frostCaster(hand) {
    const staff = new THREE.Group();
    add(staff, new THREE.CylinderGeometry(0.03, 0.04, 1.9, 6), mat('#d9e2e8'), [0, 0.3, 0]);
    add(staff, new THREE.IcosahedronGeometry(0.17, 0), crystal('#ffffff', '#bfe8ff', 1.4), [0, 1.35, 0]);
    hand.add(staff);
    return staff;
  },
  // 氷鏡の双剣士：両手に鏡のような細い剣
  duelist(hand, leftHand) {
    const blades = [];
    for (const slot of [hand, leftHand ?? hand]) {
      const blade = new THREE.Group();
      add(blade, new THREE.BoxGeometry(0.06, 1.1, 0.12), mat('#e9f6ff', { metalness: 0.9, roughness: 0.1, emissive: '#5fb6e8', emissiveIntensity: 0.4 }), [0, 0.6, 0]);
      add(blade, new THREE.BoxGeometry(0.3, 0.05, 0.08), mat('#8aa4b4', { metalness: 0.7 }), [0, 0.05, 0]);
      slot.add(blade);
      blades.push(blade);
    }
    return blades;
  },
  caster(hand) {
    const staff = new THREE.Group();
    add(staff, new THREE.CylinderGeometry(0.03, 0.04, 1.9, 6), mat('#4a3e33'), [0, 0.3, 0]);
    add(staff, new THREE.OctahedronGeometry(0.18, 0), crystal('#e2c8ff', '#a77bff', 1.4), [0, 1.35, 0]);
    hand.add(staff);
    return staff;
  },
};

function humanoidAnimation(frame) {
  switch (frame.phase) {
    case 'dormant': return { name: 'Skeleton_Inactive_Standing_Pose', loop: true };
    case 'awaken': return { name: 'Skeletons_Awaken_Standing', loop: false };
    case 'chase': case 'return': return { name: 'Walking_A', loop: true };
    case 'windup': case 'strike': return { name: '1H_Melee_Attack_Chop', loop: false };
    case 'stun': return { name: 'Hit_A', loop: false };
    case 'dead': return { name: 'Death_A', loop: false };
    default: return { name: 'Idle_Combat', loop: true };
  }
}

// 蜘蛛の糸：地面の網
function webMesh(radius) {
  const points = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    points.push(0, 0, 0, Math.sin(a) * radius, 0, Math.cos(a) * radius);
  }
  for (const r of [0.35, 0.65, 0.95]) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = ((i + 1) / 8) * Math.PI * 2;
      points.push(Math.sin(a) * radius * r, 0, Math.cos(a) * radius * r, Math.sin(b) * radius * r, 0, Math.cos(b) * radius * r);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#d8f6ff', transparent: true, opacity: 0.85, fog: false }));
}

function ringMesh(radius, color) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.12, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  mesh.geometry.rotateX(-Math.PI / 2);
  return mesh;
}

// posts：配置、defs：種類の定義、heightAt(x, z, y)：その高さの床
export async function createFoeViews(scene, posts, defs, heightAt, { load = loadGLTF, lite = false } = {}) {
  const needsHuman = posts.some((p) => GEAR[defs[p.type].look]);
  const warrior = needsHuman
    ? await withFallback(load(asset('models/skeleton_warrior.glb')).then((gltf) => { measureModel(gltf.scene); return gltf; }), () => null)
    : null;
  // 専用の模型：読めなければ、今までの骸骨兵で代わりに表示する
  const special = {};
  for (const look of new Set(posts.map((p) => defs[p.type].look))) {
    if (MODELS[look]) special[look] = await withFallback(load(asset(MODELS[look])), () => null);
  }

  const views = new Map();
  // 敵ひとつ分の見た目を作る。分身（clone）は影を落とさず、少し透けて揺らぐ
  function createView(post, def, { clone = false } = {}) {
    const object = new THREE.Group();
    object.name = post.id;
    const view = { post, def, object, mixer: null, actions: {}, current: null, rig: null, flash: 0, deadTime: 0, materials: [], eyes: [], clone, stride: 0, lastX: post.x, lastZ: post.z };
    if (GEAR[def.look]) {
      const source = special[def.look] ?? warrior;
      if (source) {
        const body = cloneSkinned(source.scene);
        let native = null;
        body.traverse((o) => { if (o.userData?.nativeScale) native = o.userData; });
        view.speedOf = native?.animationSpeed ?? {};
        // 外套の骨（専用の模型だけ）：歩く速さで後ろへなびかせる
        view.capes = [1, 2, 3, 4].map((i) => body.getObjectByName(`cape${i}`)).filter(Boolean);
        view.capeLean = 0;
        if (!native) {
          const { box, size } = measureModel(body);
          body.scale.setScalar(HUMAN_HEIGHT / size.y);
          body.position.y = -box.min.y * body.scale.y;
        }
        const tint = { spear: '#9fb8c8', shield: '#b7aa98', caster: '#b8a6c8', iceSpear: '#c4d6e2', frostShield: '#a8b4bc', frostCaster: '#e2e8ee', duelist: '#cfe2ee' }[def.look];
        const eyeColor = { caster: '#d4b4ff', frostCaster: '#ffffff', duelist: '#bfefff' }[def.look] ?? '#9fe7ff';
        body.traverse((part) => {
          if (!part.isMesh) return;
          part.castShadow = true;
          // 専用の模型：色は模型のまま（材質の複製は、下で材質ごとに一度だけ行う）
          if (native) return;
          part.material = part.material.clone();
          if (part.name.includes('Eyes')) {
            part.material.emissive = new THREE.Color(eyeColor);
            part.material.emissiveIntensity = 1.6;
            view.eyes.push(part);
          } else {
            part.material.color.multiply(new THREE.Color(tint));
          }
          // 祈り手は兜を外し、頭巾をかぶせる
          if ((def.look === 'caster' || def.look === 'frostCaster' || def.look === 'duelist') && part.name.includes('Helmet')) part.visible = false;
        });
        const hand = body.getObjectByName('handslot.r');
        const leftHand = body.getObjectByName('handslot.l');
        if (hand && !native) view.gear = GEAR[def.look](hand, leftHand);
        object.add(body);
        view.mixer = new THREE.AnimationMixer(body);
        view.actions = Object.fromEntries(source.animations.map((clip) => [clip.name, view.mixer.clipAction(clip)]));
      } else {
        add(object, new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), mat('#8a8f86'), [0, 0.95, 0]);
      }
      if (def.look === 'caster' || def.look === 'frostCaster') {
        // 祈り手は紫の、白息の詠唱者は白い外套と頭巾
        const robe = def.look === 'caster' ? '#3b3046' : '#e8eef2';
        add(object, new THREE.ConeGeometry(0.42, 1.25, 10, 1, true), mat(robe, { side: THREE.DoubleSide }), [0, 0.62, 0]);
        add(object, new THREE.ConeGeometry(0.24, 0.5, 10), mat(robe), [0, 2.02, -0.02]);
      }
      if (def.look === 'duelist') {
        // 双剣士：仮面のような鏡の顔と、短い外套
        add(object, new THREE.BoxGeometry(0.34, 0.3, 0.05), mat('#f2fbff', { metalness: 0.95, roughness: 0.05 }), [0, 1.72, 0.2]);
        add(object, new THREE.ConeGeometry(0.5, 0.9, 10, 1, true), mat('#4d6a80', { side: THREE.DoubleSide }), [0, 1.15, -0.05]);
      }
      if (def.look === 'shield') object.scale.setScalar(1.12);
      if (def.look === 'frostShield') object.scale.setScalar(1.2);
    } else {
      view.rig = createCreature(def.look) ?? BUILDERS[def.look]();
      object.add(view.rig.body);
    }
    // 材質は敵ごとに複製する（光り方を敵ごとに変えるため）。同じ材質を使う部品は、同じ複製を使う
    const copies = new Map();
    object.traverse((part) => {
      if (part.isMesh && part.material && !view.eyes.includes(part)) {
        if (!part.userData.ownMaterial) {
          if (!copies.has(part.material)) copies.set(part.material, part.material.clone());
          part.material = copies.get(part.material);
          part.userData.ownMaterial = true;
        }
        if (!view.materials.includes(part.material)) view.materials.push(part.material);
      }
    });
    view.baseEmissive = view.materials.map((m) => [m.emissive?.clone(), m.emissiveIntensity]);
    // 弱点の材質は、光り方を animateRig が決める（白い光の後に戻さない）
    view.partMaterials = new Set();
    for (const part of view.rig?.parts ?? []) part.traverse((m) => { if (m.isMesh) view.partMaterials.add(m.material); });
    view.telegraphs = createTelegraphs(scene, (x, z) => heightAt(x, z, post.y ?? 0));
    view.chant = ringMesh(9, '#c9a6ff');
    view.aura = ringMesh(def.radius + 0.35, '#ffd27a');
    // 雪潜り：隠れている間に見える雪の盛り上がり
    if (def.startHidden && !def.boss) {
      view.mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#eef3f6', { roughness: 1 }));
      view.mound.scale.set(1.1, 0.35, 1.1);
      scene.add(view.mound);
    }
    if (clone) {
      object.traverse((part) => { if (part.isMesh) part.castShadow = false; });
      for (const material of view.materials) { material.transparent = true; material.opacity = 0.62; }
    }
    scene.add(view.chant, view.aura, object);
    views.set(post.id, view);
    return view;
  }

  for (const post of posts) createView(post, defs[post.type]);

  // ── 足跡（霜牙狼と、氷鏡の双剣士の本体だけが雪に残す）──
  const footprintMaterial = new THREE.MeshBasicMaterial({ color: '#56626b', transparent: true, opacity: 0.5, depthWrite: false });
  const footprintGeometry = new THREE.CircleGeometry(0.16, 8);
  footprintGeometry.rotateX(-Math.PI / 2);
  footprintGeometry.scale(1, 1, 1.6);
  const FOOTPRINTS = lite ? 40 : 90;
  const footprints = new THREE.InstancedMesh(footprintGeometry, footprintMaterial, FOOTPRINTS);
  footprints.frustumCulled = false;
  const footprintAge = new Float32Array(FOOTPRINTS).fill(99);
  let footprintNext = 0;
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < FOOTPRINTS; i += 1) footprints.setMatrixAt(i, hiddenMatrix);
  scene.add(footprints);
  const stepDummy = new THREE.Object3D();
  function leaveFootprint(x, y, z, facing, side) {
    stepDummy.position.set(x + Math.cos(facing) * 0.18 * side, y + 0.03, z - Math.sin(facing) * 0.18 * side);
    stepDummy.rotation.set(0, facing, 0);
    stepDummy.scale.setScalar(1);
    stepDummy.updateMatrix();
    footprints.setMatrixAt(footprintNext, stepDummy.matrix);
    footprintAge[footprintNext] = 0;
    footprintNext = (footprintNext + 1) % FOOTPRINTS;
    footprints.instanceMatrix.needsUpdate = true;
  }

  const tmpColor = new THREE.Color();

  function play(view, { name, loop }, timeScale = 1) {
    const action = view.actions[name];
    if (!action) return;
    // 脚の長い専用の模型は、歩きをゆっくり再生する（足の滑りを抑える）
    action.timeScale = timeScale * (view.speedOf?.[name] ?? 1);
    if (view.current === name) return;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    view.actions[view.current]?.fadeOut(FADE);
    action.reset().fadeIn(FADE).play();
    view.current = name;
  }

  // 外套：速さに合わせて後ろへなびき（付け根がいちばん大きく、先は少しずつ）、ゆっくり揺れる。止まると垂れる
  function moveCape(view, frame, dt, time) {
    const speed = Math.hypot(frame.x - view.lastX, frame.z - view.lastZ) / Math.max(dt, 1e-3);
    const target = frame.phase === 'dead' ? 0 : Math.min(0.6, speed * 0.12);
    view.capeLean += (target - view.capeLean) * Math.min(1, dt * 4);
    const sway = Math.sin(time * 1.7 + view.post.x) * 0.04;
    view.capes.forEach((bone, i) => {
      bone.rotation.x = i === 0 ? view.capeLean * 0.7 + sway : view.capeLean * 0.18 + sway * 0.5 * Math.sin(time * 2.3 + i);
    });
  }

  // 獣・虫の動き（歩く脚・羽ばたき・溜め・突き・よろめき）
  function animateRig(view, frame, dt, time) {
    const { rig } = view;
    const moving = frame.phase === 'chase' || frame.phase === 'return' || (frame.phase === 'strike' && view.def.attacks.find((a) => a.name === frame.attackName)?.dash);
    const speed = frame.phase === 'strike' ? 22 : 9;
    rig.legs?.forEach((leg, i) => {
      leg.rotation.x = moving ? Math.sin(time * speed + i * Math.PI * 0.5 + (i % 2) * Math.PI) * 0.6 : leg.rotation.x * 0.8;
    });
    rig.wings?.forEach(({ pivot, side }) => {
      const flap = frame.height > 0.5 ? Math.sin(time * 16) * 0.8 : 0.9;
      pivot.rotation.z = side * flap;
    });
    let lean = 0;
    let lift = 0;
    if (frame.phase === 'windup') lean = -0.25 + Math.sin(time * 40) * 0.03;
    if (frame.phase === 'strike') lean = 0.25;
    if (frame.phase === 'stun') lean = Math.sin(time * 18) * 0.15;
    if (frame.phase === 'dormant') lift = -0.1;
    rig.body.rotation.x += (lean - rig.body.rotation.x) * 0.3;
    rig.body.position.y = frame.height + lift;
    if (rig.arms) {
      // 巨兵：溜めで腕を振り上げ、攻撃で振り下ろす
      const target = frame.phase === 'windup' ? -2.6 : frame.phase === 'strike' ? 0.4 : moving ? Math.sin(time * 4) * 0.3 : 0;
      for (const arm of rig.arms) arm.rotation.x += (target - arm.rotation.x) * 0.25;
    }
    // 関節で作った体：脚・翼・あごなどは creatures.js が動かす（速さは前の位置からの移動量）
    rig.animate?.(frame, dt, time, Math.hypot(frame.x - view.lastX, frame.z - view.lastZ) / Math.max(dt, 1e-3));
    if (rig.parts) {
      // 弱点：腕の結晶は隙の間に強く光る。割れた分は消える
      rig.parts.forEach((part, i) => {
        const broken = i < (frame.partsBroken ?? 0);
        part.visible = !broken;
        part.traverse((m) => {
          if (!m.isMesh) return;
          m.material.emissive?.set(frame.exposed ? '#ff9a4a' : view.def.look === 'beetle' ? '#ff8a3b' : '#2bb7ff');
          m.material.emissiveIntensity = frame.exposed ? 2.2 + Math.sin(time * 12) * 0.6 : 0.9;
        });
      });
    }
  }

  function disposeView(view) {
    view.telegraphs.dispose();
    scene.remove(view.object, view.chant, view.aura);
    if (view.mound) { scene.remove(view.mound); view.mound.geometry.dispose(); view.mound.material.dispose(); }
    view.mixer?.stopAllAction();
    // 体の材質は view ごとに複製してあるので、ここで捨ててよい（骨格の形は読み込んだ模型と共有）
    // 関節で作った体の形は、同じ種類の敵で共有しているので捨てない（userData.shared）
    view.object.traverse((part) => { if (!part.isSkinnedMesh && !part.userData.shared) part.geometry?.dispose(); });
    for (const material of view.materials) material.dispose();
    for (const ring of [view.chant, view.aura]) { ring.geometry.dispose(); ring.material.dispose(); }
  }

  // 戦いの中で生まれ、消える物（糸・吹雪・氷の壁）。種類ごとに見た目を作って、なくなったら捨てる
  const effects = new Map();
  function effectMesh(item) {
    if (item.kind === 'web') return webMesh(item.radius);
    if (item.kind === 'blizzard') {
      const group = new THREE.Group();
      const veil = new THREE.Mesh(new THREE.SphereGeometry(item.radius, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2f7fa', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
      group.add(veil);
      const count = lite ? 60 : 140;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const a = (i * 2.399) % (Math.PI * 2);
        const r = item.radius * Math.sqrt(((i * 0.618) % 1));
        positions.set([Math.sin(a) * r, ((i * 0.37) % 1) * 3, Math.cos(a) * r], i * 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const flakes = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#ffffff', size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
      group.add(flakes);
      group.userData.flakes = flakes;
      return group;
    }
    // 氷の壁：地面から突き出す厚い氷の板
    const wall = new THREE.Group();
    const ice = crystal('#d8f4ff', '#6fc6ff', 0.5);
    ice.opacity = 0.85;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(item.length, 3.2, 1.2), ice);
    slab.position.y = 1.6;
    slab.castShadow = true;
    wall.add(slab);
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), ice);
      spike.position.set(-item.length / 2 + (i + 0.5) * (item.length / 5), 3.4, 0);
      spike.scale.set(0.6, 1.8, 0.6);
      wall.add(spike);
    }
    return wall;
  }
  function disposeEffect(mesh) {
    scene.remove(mesh);
    mesh.traverse((part) => { part.geometry?.dispose(); part.material?.dispose(); });
  }

  // frames：頭脳の frame、world：{ hazards, walls }（foes.js）
  function update(dt, frames, time, { hazards = [], walls = [] } = {}) {
    const present = new Set();
    for (const frame of frames) {
      present.add(frame.id);
      let view = views.get(frame.id);
      // 分身：はじめて出てきたら、本体と同じ姿で作る（影なし・少し透ける）
      if (!view && frame.cloneOf) {
        const origin = views.get(frame.cloneOf);
        if (!origin) continue;
        view = createView({ ...origin.post, id: frame.id }, { ...origin.def, ...origin.def.clone, look: origin.def.look }, { clone: true });
      }
      if (!view) continue;
      const ground = heightAt(frame.x, frame.z, view.post.y ?? 0);
      view.object.position.set(frame.x, ground, frame.z);
      view.object.rotation.y = frame.facing;
      if (view.mixer) {
        const attack = view.def.attacks.find((a) => a.name === frame.attackName);
        const scale = frame.phase === 'windup' && attack ? 0.8 / (frame.windupTime || attack.windup) : 1;
        play(view, humanoidAnimation(frame), scale);
        view.mixer.update(dt);
        if (view.capes?.length) moveCape(view, frame, dt, time);
      } else {
        animateRig(view, frame, dt, time);
      }

      // 倒れたら 1.5 秒後から沈んで消える（分身は、すぐ砕けて消える）
      if (frame.phase === 'dead') {
        view.deadTime += dt;
        if (view.rig) view.rig.body.rotation.z = Math.min(1.4, view.deadTime * 3);
        if (view.deadTime > 1.5) view.object.position.y = ground - (view.deadTime - 1.5) * 0.9;
        view.object.visible = view.deadTime < (view.clone ? 0.3 : 3.5);
      } else {
        view.deadTime = 0;
        // 隠れている間は見えない（ボスは登場の演出で姿を見せる）
        view.object.visible = frame.phase !== 'hidden' || view.revealed;
        if (view.rig) view.rig.body.rotation.z = 0;
      }
      if (view.mound) {
        view.mound.visible = frame.phase === 'hidden';
        view.mound.position.set(frame.x, ground, frame.z);
        view.mound.scale.y = 0.35 + 0.04 * Math.sin(time * 3 + frame.x);
      }
      if (view.clone) for (const material of view.materials) material.opacity = 0.5 + 0.15 * Math.sin(time * 9 + frame.z);

      // 足跡：歩いた道のりに合わせて、左右交互に雪へ残す（分身は残さない）
      if (view.def.footprints && frame.phase !== 'dead' && frame.phase !== 'hidden' && frame.height < 0.3) {
        view.stride += Math.hypot(frame.x - view.lastX, frame.z - view.lastZ);
        if (view.stride > 0.8) {
          view.stride = 0;
          view.side = -(view.side ?? 1);
          leaveFootprint(frame.x, ground, frame.z, frame.facing, view.side);
        }
      }
      view.lastX = frame.x;
      view.lastZ = frame.z;

      // 予兆：攻撃の形を足もとに、溜まるほど広がる
      const attack = view.def.attacks.find((a) => a.name === frame.attackName);
      if (frame.phase === 'windup' && frame.telegraph.length && attack) {
        view.telegraphs.sync({ shapes: frame.telegraph, progress: frame.timer / (frame.windupTime || attack.windup) }, frame.buffed || frame.enraged);
      } else {
        view.telegraphs.clear();
      }
      // 詠唱の輪（斬れば止まる）・強化の金の輪
      const chanting = frame.phase === 'channel';
      view.chant.position.set(frame.x, ground + 0.06, frame.z);
      view.chant.material.opacity = chanting ? 0.35 + 0.25 * Math.sin(time * 8) : 0;
      view.chant.visible = chanting;
      view.aura.position.set(frame.x, ground + 0.05, frame.z);
      view.aura.visible = frame.buffed && frame.phase !== 'dead';
      view.aura.material.opacity = 0.5 + 0.3 * Math.sin(time * 6);

      // 斬られた瞬間の白い光、盾で受けた瞬間の青い光
      if (view.flash > 0) view.flash = Math.max(0, view.flash - dt);
      view.materials.forEach((m, i) => {
        if (!m.emissive) return;
        const [base, intensity] = view.baseEmissive[i];
        if (view.flash > 0) {
          m.emissive.copy(tmpColor.set(view.flashColor ?? '#ffffff'));
          m.emissiveIntensity = view.flash * 6;
        } else if (base && !view.partMaterials.has(m)) {
          m.emissive.copy(base);
          m.emissiveIntensity = intensity;
        }
      });
    }
    // 消えた分身の見た目を捨てる
    for (const [id, view] of views) {
      if (view.clone && !present.has(id)) {
        disposeView(view);
        views.delete(id);
      }
    }

    // 足跡は6秒で薄れて消える
    for (let i = 0; i < FOOTPRINTS; i += 1) {
      if (footprintAge[i] > 6) continue;
      footprintAge[i] += dt;
      if (footprintAge[i] > 6) {
        footprints.setMatrixAt(i, hiddenMatrix);
        footprints.instanceMatrix.needsUpdate = true;
      }
    }

    // 糸・吹雪・氷の壁
    const alive = new Set();
    for (const item of [...hazards, ...walls.map((w) => ({ ...w, kind: 'wall' }))]) {
      alive.add(item.id);
      let mesh = effects.get(item.id);
      if (!mesh) {
        mesh = effectMesh(item);
        scene.add(mesh);
        effects.set(item.id, mesh);
        mesh.userData.age = 0;
      }
      mesh.userData.age += dt;
      const ground = heightAt(item.x, item.z, item.y);
      mesh.position.set(item.x, ground + (item.kind === 'web' ? 0.05 : 0), item.z);
      if (item.kind === 'web') mesh.material.opacity = Math.min(0.85, item.life * 0.6);
      if (item.kind === 'blizzard') {
        mesh.rotation.y += dt * 1.6;
        mesh.userData.flakes.position.y = -((time * 1.2) % 3) + 1.5;
      }
      if (item.kind === 'wall') {
        // 地面からせり上がり、消える前に沈む
        mesh.rotation.y = item.angle;
        const rise = Math.min(1, mesh.userData.age / 0.35) * Math.min(1, item.life / 0.5);
        mesh.position.y = ground - 3.4 * (1 - rise);
      }
    }
    for (const [id, mesh] of effects) {
      if (alive.has(id)) continue;
      disposeEffect(mesh);
      effects.delete(id);
    }
  }

  function hitFlash(id, color = '#ffffff') {
    const view = views.get(id);
    if (!view) return;
    view.flash = 0.18;
    view.flashColor = color;
  }

  function hide(id) {
    const view = views.get(id);
    if (!view) return;
    view.deadTime = 10;
    view.object.visible = false;
  }

  // ボスの登場：隠れていても姿を見せる（on）／元に戻す（off）
  function reveal(id, on = true) {
    const view = views.get(id);
    if (view) view.revealed = on;
  }

  function dispose() {
    for (const view of views.values()) disposeView(view);
    views.clear();
    for (const mesh of effects.values()) disposeEffect(mesh);
    effects.clear();
    scene.remove(footprints);
    footprintGeometry.dispose();
    footprintMaterial.dispose();
  }

  return { update, hitFlash, hide, reveal, dispose, object: (id) => views.get(id)?.object, lite };
}
