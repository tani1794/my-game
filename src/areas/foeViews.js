// エリアの敵の見た目。頭脳は src/story/enemy.js（frame を受け取って形と動きに写す）。
// 人型（槍・盾・祈り手）は KayKit Skeleton_Warrior（CC0）に持ち物と色を変えて使う。
// 獣・虫・蝙蝠・蜘蛛・巨兵は、手元に合う立体素材がないため、コードで組み立てた仮の形（輪郭・大きさ・動きで見分ける）。
// 予兆は足もとの橙の印（今までの結晶獣と同じ描き方）、詠唱は紫の輪、強化は金の輪、蜘蛛の糸は地面の網。
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLTF, measureModel, withFallback } from '../assets.js';
import { asset } from '../paths.js';
import { createTelegraphs } from '../world/telegraph.js';

const FADE = 0.15;
const HUMAN_HEIGHT = 1.9;

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
  // 晶牙ハウンド：低く長い四つ足、背中と牙に結晶
  hound() {
    const body = new THREE.Group();
    const fur = mat('#38414a');
    add(body, new THREE.SphereGeometry(0.5, 10, 8), fur, [0, 0.75, 0], [0, 0, 0], [0.75, 0.62, 1.55]);
    add(body, new THREE.SphereGeometry(0.32, 10, 8), fur, [0, 0.95, 0.85], [0, 0, 0], [0.9, 0.85, 1.25]);
    const glass = crystal();
    for (let i = 0; i < 4; i++) add(body, new THREE.ConeGeometry(0.1, 0.45, 5), glass, [0, 1.12, 0.35 - i * 0.3], [-0.4, 0, 0]);
    add(body, new THREE.ConeGeometry(0.05, 0.22, 4), glass, [0.1, 0.78, 1.2], [Math.PI * 0.9, 0, 0]);
    add(body, new THREE.ConeGeometry(0.05, 0.22, 4), glass, [-0.1, 0.78, 1.2], [Math.PI * 0.9, 0, 0]);
    add(body, new THREE.SphereGeometry(0.045, 6, 4), mat('#9fe7ff', { emissive: '#9fe7ff', emissiveIntensity: 2 }), [0.12, 1.02, 1.2]);
    add(body, new THREE.SphereGeometry(0.045, 6, 4), mat('#9fe7ff', { emissive: '#9fe7ff', emissiveIntensity: 2 }), [-0.12, 1.02, 1.2]);
    const legs = [[0.25, 0.5], [-0.25, 0.5], [0.25, -0.5], [-0.25, -0.5]].map(([x, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.62, z);
      add(pivot, new THREE.BoxGeometry(0.13, 0.62, 0.13), fur, [0, -0.31, 0]);
      body.add(pivot);
      return pivot;
    });
    return { body, legs };
  },
  // 硝子羽の蝙蝠：小さな体に、透ける硝子の大きな翼
  bat() {
    const body = new THREE.Group();
    const skin = mat('#2d2a35');
    add(body, new THREE.SphereGeometry(0.28, 10, 8), skin, [0, 0, 0], [0, 0, 0], [0.9, 1, 1.2]);
    add(body, new THREE.ConeGeometry(0.07, 0.22, 4), skin, [0.12, 0.28, 0.12]);
    add(body, new THREE.ConeGeometry(0.07, 0.22, 4), skin, [-0.12, 0.28, 0.12]);
    const glass = crystal('#c9f6ff', '#4fd2ff', 0.6);
    glass.side = THREE.DoubleSide;
    glass.opacity = 0.7;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.1, 0.25);
    wingShape.lineTo(0.95, -0.15);
    wingShape.lineTo(0.7, -0.05);
    wingShape.lineTo(0.5, -0.3);
    wingShape.lineTo(0.25, -0.1);
    wingShape.lineTo(0, -0.25);
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    wingGeometry.rotateX(-Math.PI / 2);
    const wings = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.15 * side, 0.05, 0);
      const wing = add(pivot, wingGeometry, glass);
      wing.scale.x = side;
      body.add(pivot);
      return { pivot, side };
    });
    return { body, wings };
  },
  // 結晶甲虫：丸い殻、正面に硬い結晶の板と角、背中の継ぎ目が淡く光る（弱点）
  beetle() {
    const body = new THREE.Group();
    const shell = mat('#2b3a46', { roughness: 0.45, metalness: 0.2 });
    add(body, new THREE.SphereGeometry(0.75, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell, [0, 0.35, -0.1], [0, 0, 0], [1, 0.8, 1.3]);
    add(body, new THREE.BoxGeometry(1.25, 0.75, 0.22), crystal('#a6ecff', '#2bb7ff', 0.5), [0, 0.6, 0.85], [-0.25, 0, 0]);
    add(body, new THREE.ConeGeometry(0.16, 0.8, 5), crystal(), [0, 0.95, 1.1], [1.1, 0, 0]);
    const seam = add(body, new THREE.BoxGeometry(0.08, 0.05, 1.0), mat('#ffb37a', { emissive: '#ff8a3b', emissiveIntensity: 1.2 }), [0, 0.96, -0.25]);
    const legs = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(0.6 * side, 0.35, 0.4 - i * 0.45);
        add(pivot, new THREE.BoxGeometry(0.5, 0.07, 0.07), shell, [0.25 * side, -0.15, 0], [0, 0, -0.6 * side]);
        body.add(pivot);
        legs.push(pivot);
      }
    }
    return { body, legs, parts: [seam] };
  },
  // 晶糸の蜘蛛：結晶の腹、細く長い8本の脚
  spider() {
    const body = new THREE.Group();
    const dark = mat('#252a30');
    add(body, new THREE.SphereGeometry(0.35, 10, 8), dark, [0, 0.7, 0.35]);
    add(body, new THREE.SphereGeometry(0.55, 12, 10), crystal('#bdf3ff', '#3cc8ff', 0.7), [0, 0.85, -0.45], [0, 0, 0], [1, 0.85, 1.2]);
    const legs = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(0.25 * side, 0.75, 0.55 - i * 0.28);
        pivot.rotation.y = side * (0.5 - i * 0.35) + (side > 0 ? 0 : Math.PI);
        add(pivot, new THREE.CylinderGeometry(0.035, 0.035, 0.75, 4), dark, [0.32, 0.18, 0], [0, 0, -1.0]);
        add(pivot, new THREE.CylinderGeometry(0.03, 0.02, 0.95, 4), dark, [0.82, -0.25, 0], [0, 0, 0.55]);
        body.add(pivot);
        legs.push(pivot);
      }
    }
    return { body, legs };
  },
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

  const views = new Map();
  for (const post of posts) {
    const def = defs[post.type];
    const object = new THREE.Group();
    object.name = post.id;
    const view = { post, def, object, mixer: null, actions: {}, current: null, rig: null, flash: 0, deadTime: 0, materials: [], eyes: [] };
    if (GEAR[def.look]) {
      if (warrior) {
        const body = cloneSkinned(warrior.scene);
        const { box, size } = measureModel(body);
        body.scale.setScalar(HUMAN_HEIGHT / size.y);
        body.position.y = -box.min.y * body.scale.y;
        const tint = { spear: '#9fb8c8', shield: '#b7aa98', caster: '#b8a6c8' }[def.look];
        body.traverse((part) => {
          if (!part.isMesh) return;
          part.castShadow = true;
          part.material = part.material.clone();
          if (part.name.includes('Eyes')) {
            part.material.emissive = new THREE.Color(def.look === 'caster' ? '#d4b4ff' : '#9fe7ff');
            part.material.emissiveIntensity = 1.6;
            view.eyes.push(part);
          } else {
            part.material.color.multiply(new THREE.Color(tint));
          }
          // 祈り手は兜を外し、頭巾をかぶせる
          if (def.look === 'caster' && part.name.includes('Helmet')) part.visible = false;
        });
        const hand = body.getObjectByName('handslot.r');
        const leftHand = body.getObjectByName('handslot.l');
        if (hand) view.gear = GEAR[def.look](hand, leftHand);
        object.add(body);
        view.mixer = new THREE.AnimationMixer(body);
        view.actions = Object.fromEntries(warrior.animations.map((clip) => [clip.name, view.mixer.clipAction(clip)]));
      } else {
        add(object, new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), mat('#8a8f86'), [0, 0.95, 0]);
      }
      if (def.look === 'caster') {
        add(object, new THREE.ConeGeometry(0.42, 1.25, 10, 1, true), mat('#3b3046', { side: THREE.DoubleSide }), [0, 0.62, 0]);
        add(object, new THREE.ConeGeometry(0.24, 0.5, 10), mat('#3b3046'), [0, 2.02, -0.02]);
      }
      if (def.look === 'shield') object.scale.setScalar(1.12);
    } else {
      view.rig = BUILDERS[def.look]();
      object.add(view.rig.body);
    }
    object.traverse((part) => {
      if (part.isMesh && part.material && !view.eyes.includes(part)) {
        if (!part.userData.ownMaterial) {
          part.material = part.material.clone();
          part.userData.ownMaterial = true;
        }
        view.materials.push(part.material);
      }
    });
    view.baseEmissive = view.materials.map((m) => [m.emissive?.clone(), m.emissiveIntensity]);
    // 弱点の材質は、光り方を animateRig が決める（白い光の後に戻さない）
    view.partMaterials = new Set();
    for (const part of view.rig?.parts ?? []) part.traverse((m) => { if (m.isMesh) view.partMaterials.add(m.material); });
    view.telegraphs = createTelegraphs(scene, (x, z) => heightAt(x, z, post.y ?? 0));
    view.chant = ringMesh(9, '#c9a6ff');
    view.aura = ringMesh(def.radius + 0.35, '#ffd27a');
    scene.add(view.chant, view.aura, object);
    views.set(post.id, view);
  }

  const webs = new Map();
  const tmpColor = new THREE.Color();

  function play(view, { name, loop }, timeScale = 1) {
    const action = view.actions[name];
    if (!action) return;
    action.timeScale = timeScale;
    if (view.current === name) return;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    view.actions[view.current]?.fadeOut(FADE);
    action.reset().fadeIn(FADE).play();
    view.current = name;
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

  function update(dt, frames, time, webList = []) {
    for (const frame of frames) {
      const view = views.get(frame.id);
      if (!view) continue;
      const ground = heightAt(frame.x, frame.z, view.post.y ?? 0);
      view.object.position.set(frame.x, ground, frame.z);
      view.object.rotation.y = frame.facing;
      if (view.mixer) {
        const attack = view.def.attacks.find((a) => a.name === frame.attackName);
        const scale = frame.phase === 'windup' && attack ? 0.8 / attack.windup : 1;
        play(view, humanoidAnimation(frame), scale);
        view.mixer.update(dt);
      } else {
        animateRig(view, frame, dt, time);
      }

      // 倒れたら 1.5 秒後から沈んで消える
      if (frame.phase === 'dead') {
        view.deadTime += dt;
        if (view.rig) view.rig.body.rotation.z = Math.min(1.4, view.deadTime * 3);
        if (view.deadTime > 1.5) view.object.position.y = ground - (view.deadTime - 1.5) * 0.9;
        view.object.visible = view.deadTime < 3.5;
      } else {
        view.deadTime = 0;
        view.object.visible = frame.phase !== 'hidden';
        if (view.rig) view.rig.body.rotation.z = 0;
      }

      // 予兆：攻撃の形を足もとに、溜まるほど広がる
      const attack = view.def.attacks.find((a) => a.name === frame.attackName);
      if (frame.phase === 'windup' && frame.telegraph.length && attack) {
        view.telegraphs.sync({ shapes: frame.telegraph, progress: frame.timer / attack.windup }, frame.buffed);
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

    // 蜘蛛の糸
    const alive = new Set();
    for (const web of webList) {
      alive.add(web.id);
      let mesh = webs.get(web.id);
      if (!mesh) {
        mesh = webMesh(web.radius);
        scene.add(mesh);
        webs.set(web.id, mesh);
      }
      mesh.position.set(web.x, heightAt(web.x, web.z, web.y) + 0.05, web.z);
      mesh.material.opacity = Math.min(0.85, web.life * 0.6);
    }
    for (const [id, mesh] of webs) {
      if (alive.has(id)) continue;
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      webs.delete(id);
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

  function dispose() {
    for (const view of views.values()) {
      view.telegraphs.dispose();
      scene.remove(view.object, view.chant, view.aura);
      view.mixer?.stopAllAction();
      // 体の材質は view ごとに複製してあるので、ここで捨ててよい（骨格の形は読み込んだ模型と共有）
      view.object.traverse((part) => { if (!part.isSkinnedMesh) part.geometry?.dispose(); });
      for (const material of view.materials) material.dispose();
      for (const ring of [view.chant, view.aura]) { ring.geometry.dispose(); ring.material.dispose(); }
    }
    views.clear();
    for (const mesh of webs.values()) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    webs.clear();
  }

  return { update, hitFlash, hide, dispose, object: (id) => views.get(id)?.object, lite };
}
