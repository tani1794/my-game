// 廃れた礼拝堂（第一章の終わり）：外を一周でき、正面の鐘塔から身廊へ入り、祭壇まで歩ける。
// 寸法は layout.js の CHAPEL と当たり判定に合わせる。窓は壁に開けた本物の穴なので、外と中で位置がそろう。
import * as THREE from 'three';
import { mulberry32 } from '../world/random.js';
import { worldUV } from './materials.js';
import { CHAPEL, INTERACTABLES, heightAt } from './layout.js';

const WALL_HEIGHT = 9;
const ROOF_RISE = 5.5;

// 尖頭アーチの穴（窓・入口）：幅 w、下端 y0、まっすぐな部分の高さ straight、尖りの高さ peak
function lancet(cx, y0, w, straight, peak) {
  const path = new THREE.Path();
  path.moveTo(cx - w / 2, y0);
  path.lineTo(cx - w / 2, y0 + straight);
  path.quadraticCurveTo(cx - w / 2, y0 + straight + peak * 0.75, cx, y0 + straight + peak);
  path.quadraticCurveTo(cx + w / 2, y0 + straight + peak * 0.75, cx + w / 2, y0 + straight);
  path.lineTo(cx + w / 2, y0);
  path.lineTo(cx - w / 2, y0);
  return path;
}

// 長さ length・高さ height の壁を、穴つきで厚み t に押し出す（ローカルの x が壁の向き、z が厚み）
function wallWithHoles(material, length, height, t, holes, top = null) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  if (top) top(shape, length, height);
  else {
    shape.lineTo(length, height);
    shape.lineTo(0, height);
  }
  shape.lineTo(0, 0);
  shape.holes.push(...holes);
  const geometry = worldUV(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 6 }), 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(material, w, h, d, x, y, z, uvSize = 2) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), uvSize), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 窓の光：割れた窓から斜めに差す、淡い光の板（加算）
function shaftMaterial(color, opacity) {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 128);
  const side = ctx.createLinearGradient(0, 0, 32, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 32, 128);
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

export function createChapel(scene, materials) {
  const root = new THREE.Group();
  root.name = 'chapel';
  scene.add(root);
  const { x: cx, front, back, halfWidth: hw, wall: t, door, apseRadius: r, tower: tw, sacristy: s, aisle: a } = CHAPEL;
  const west = cx - hw;
  const east = cx + hw;
  const floorY = heightAt(cx, -80);
  const stone = materials.chapelStone;
  const occluders = [];
  const glassPanes = [];
  const keep = (mesh) => { root.add(mesh); occluders.push(mesh); return mesh; };
  const length = front - back;

  // ── 身廊の両側の壁：尖頭窓の穴（z = -80, -85, -90）。東の壁には祭具室への入口 ──
  const windowHoles = (startZ) => CHAPEL.windows.map((z) => lancet(startZ - z, 2.4, 1.5, 3.4, 1.4));
  const westWall = wallWithHoles(stone, length, WALL_HEIGHT, t, windowHoles(front));
  westWall.rotation.y = Math.PI / 2;
  westWall.position.set(west, floorY, front);
  keep(westWall);
  const eastWall = wallWithHoles(stone, length, WALL_HEIGHT, t, [
    ...windowHoles(front),
    lancet(front - (s.door[0] + s.door[1]) / 2, 0, s.door[1] - s.door[0], 1.8, 0.6),
  ]);
  eastWall.rotation.y = Math.PI / 2;
  eastWall.position.set(east - t, floorY, front);
  keep(eastWall);
  for (const z of CHAPEL.windows) {
    for (const x of [west + t / 2, east - t / 2]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.6), materials.glass.clone());
      pane.rotation.y = Math.PI / 2;
      pane.position.set(x, floorY + 2.4 + 2.3, z);
      root.add(pane);
      glassPanes.push(pane);
    }
  }

  // ── 正面の壁（入口と、その上の高い窓）と、切妻の三角 ──
  const gable = (shape, l, h) => {
    shape.lineTo(l, h);
    shape.lineTo(l / 2, h + ROOF_RISE);
    shape.lineTo(0, h);
  };
  const frontWall = wallWithHoles(stone, hw * 2, WALL_HEIGHT, t, [lancet(hw, 0, door * 2, 2.6, 1.3)], gable);
  frontWall.position.set(west, floorY, front - t);
  keep(frontWall);
  // 奥の壁は後陣に開いているので、上の三角だけ
  const triangle = new THREE.Shape();
  triangle.moveTo(0, WALL_HEIGHT);
  triangle.lineTo(hw * 2, WALL_HEIGHT);
  triangle.lineTo(hw, WALL_HEIGHT + ROOF_RISE);
  triangle.lineTo(0, WALL_HEIGHT);
  const backGable = new THREE.Mesh(worldUV(new THREE.ExtrudeGeometry(triangle, { depth: t, bevelEnabled: false }), 2), stone);
  backGable.position.set(west, floorY, back);
  backGable.castShadow = true;
  keep(backGable);

  // ── 鐘塔：正面の中央に立ち、下は入口の間。上に鐘楼の開口、八角の尖塔、四隅の小尖塔 ──
  const towerTop = 21;
  const towerW = tw.x1 - tw.x0;
  const towerD = tw.z1 - tw.z0;
  // 正面（南）の上部：入口の上から塔の上まで
  const towerFront = wallWithHoles(stone, towerW, towerTop - WALL_HEIGHT, t, [lancet(towerW / 2, towerTop - WALL_HEIGHT - 6, 1.4, 2.6, 1.2)]);
  towerFront.position.set(tw.x0, floorY + WALL_HEIGHT, front - t - 0.06);
  keep(towerFront);
  // 左右の壁（地面から）と、奥の壁（身廊への入口つき）
  for (const x of [tw.x0, tw.x1 - t]) {
    const side = wallWithHoles(stone, towerD, towerTop, t, [lancet(towerD / 2, towerTop - 6, 1.4, 2.6, 1.2)]);
    side.rotation.y = Math.PI / 2;
    side.position.set(x, floorY, front);
    keep(side);
  }
  const towerBack = wallWithHoles(stone, towerW, towerTop, t, [lancet(towerW / 2, 0, door * 2, 2.6, 1.3), lancet(towerW / 2, towerTop - 6, 1.4, 2.6, 1.2)]);
  towerBack.position.set(tw.x0, floorY, tw.z0);
  keep(towerBack);
  // 尖塔は森のどこからでも木々の上に見えるよう、霧のかかり方を弱くした石にする（進む方向の目印）
  const landmark = stone.clone();
  landmark.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float landmarkDepth = vFogDepth * 0.38;
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * landmarkDepth * landmarkDepth );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`);
  };
  root.add(box(landmark, towerW + 0.4, 0.5, towerD + 0.4, cx, floorY + towerTop + 0.25, (tw.z0 + tw.z1) / 2));
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 15, 8), landmark);
  spire.position.set(cx, floorY + towerTop + 0.5 + 7.5, (tw.z0 + tw.z1) / 2);
  spire.castShadow = true;
  root.add(spire);
  const cross = new THREE.Group();
  cross.add(box(materials.iron, 0.12, 1.4, 0.12, 0, 0, 0, 1), box(materials.iron, 0.7, 0.12, 0.12, 0, 0.25, 0, 1));
  cross.position.set(cx, floorY + towerTop + 16.2, (tw.z0 + tw.z1) / 2);
  root.add(cross);
  const pinnacle = (x, y, z, h, radius = 0.45) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, h, 6), stone);
    cone.position.set(x, y + h / 2, z);
    cone.castShadow = true;
    root.add(cone);
  };
  for (const x of [tw.x0 + 0.3, tw.x1 - 0.3]) for (const z of [tw.z0 + 0.3, tw.z1 - 0.3]) pinnacle(x, floorY + towerTop + 0.5, z, 3.4);

  // ── 屋根：石板の切妻。2か所が抜け落ちている ──
  const slope = Math.atan2(ROOF_RISE, hw);
  const slopeLength = Math.hypot(ROOF_RISE, hw) + 0.6;
  const panels = 6;
  const panelLength = (tw.z0 - back) / panels;
  const missing = new Set(['w-2', 'e-4']);
  for (const side of [-1, 1]) {
    for (let i = 0; i < panels; i++) {
      if (missing.has(`${side < 0 ? 'w' : 'e'}-${i}`)) continue;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(slopeLength, 0.18, panelLength + 0.02), materials.slate);
      panel.position.set(cx + side * hw / 2, floorY + WALL_HEIGHT + ROOF_RISE / 2 + 0.15, tw.z0 - panelLength * (i + 0.5));
      panel.rotation.z = -side * slope;
      panel.castShadow = true;
      root.add(panel);
      occluders.push(panel);
    }
  }
  // 塔の手前の短い屋根（正面の壁と塔の間）
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(slopeLength, 0.18, tw.z1 - tw.z0), materials.slate);
    panel.position.set(cx + side * hw / 2, floorY + WALL_HEIGHT + ROOF_RISE / 2 + 0.15, (tw.z0 + tw.z1) / 2);
    panel.rotation.z = -side * slope;
    root.add(panel);
  }

  // ── 後陣：半円の壁（7 面、それぞれに細い窓）と、半円錐の屋根 ──
  for (let i = 0; i < 7; i++) {
    const a0 = Math.PI + (i / 7) * Math.PI;
    const a1 = Math.PI + ((i + 1) / 7) * Math.PI;
    const p0 = new THREE.Vector2(cx + Math.cos(a0) * r, back + Math.sin(a0) * r);
    const p1 = new THREE.Vector2(cx + Math.cos(a1) * r, back + Math.sin(a1) * r);
    const segment = p1.distanceTo(p0);
    const holes = i === 3 || i === 1 || i === 5 ? [lancet(segment / 2, 3, 1, 3.2, 1)] : [];
    const piece = wallWithHoles(stone, segment + 0.1, WALL_HEIGHT, t, holes);
    piece.position.set(p0.x, floorY, p0.y);
    piece.rotation.y = -Math.atan2(p1.y - p0.y, p1.x - p0.x);
    // 押し出しは +z（内側か外側か）に出るので、外へずらす
    keep(piece);
  }
  const apseRoof = new THREE.Mesh(new THREE.ConeGeometry(r + 0.6, ROOF_RISE, 14, 1, true, Math.PI / 2, Math.PI), materials.slate);
  apseRoof.position.set(cx, floorY + WALL_HEIGHT + ROOF_RISE / 2, back);
  root.add(apseRoof);

  // ── 控え壁と小尖塔（東側と後陣のまわり。西は側廊がある） ──
  for (const z of [-77.5, -82.5, -87.5, -92.5]) {
    const steps = [[1.1, 6.5], [0.8, 8.2]];
    for (const [depth, height] of steps) {
      root.add(box(stone, depth, height, 0.9, east + depth / 2, floorY + height / 2, z));
    }
    pinnacle(east + 0.5, floorY + 8.2, z, 2.2, 0.32);
  }

  // ── 祭具室（東）：小さな部屋。身廊の東の壁の入口から入る ──
  const sacH = 4.6;
  keep(box(stone, t, sacH, s.z1 - s.z0, s.x1 - t / 2, floorY + sacH / 2, (s.z0 + s.z1) / 2));
  for (const z of [s.z0 + t / 2, s.z1 - t / 2]) keep(box(stone, s.x1 - s.x0, sacH, t, (s.x0 + s.x1) / 2, floorY + sacH / 2, z));
  const sacRoof = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0 + 0.6, 0.18, s.z1 - s.z0 + 0.6), materials.slate);
  sacRoof.position.set((s.x0 + s.x1) / 2, floorY + sacH + 0.5, (s.z0 + s.z1) / 2);
  sacRoof.rotation.z = -0.22;
  root.add(sacRoof);
  occluders.push(sacRoof);
  root.add(box(materials.wood, 1.6, 1.8, 0.6, s.x1 - 1.2, floorY + 0.9, s.z0 + 1, 1)); // 戸棚

  // ── 西の側廊：低い外壁は一部が崩れ、瓦礫が散らばる ──
  const aisleH = 4.2;
  const outerX = a.x0 + t / 2;
  keep(box(stone, t, aisleH, a.z1 - a.collapse[1], outerX, heightAt(a.x0, -80) + aisleH / 2, (a.z1 + a.collapse[1]) / 2));
  keep(box(stone, t, aisleH, a.collapse[0] - a.z0, outerX, heightAt(a.x0, -90) + aisleH / 2, (a.z0 + a.collapse[0]) / 2));
  keep(box(stone, t, 1.2, a.collapse[1] - a.collapse[0], outerX, heightAt(a.x0, -86) + 0.6, (a.collapse[0] + a.collapse[1]) / 2));
  for (const z of [a.z0 + t / 2, a.z1 - t / 2]) keep(box(stone, a.x1 - a.x0, aisleH, t, (a.x0 + a.x1) / 2, heightAt(27, z) + aisleH / 2, z));
  const aisleRoof = new THREE.Mesh(new THREE.BoxGeometry(a.x1 - a.x0 + 1, 0.18, (a.z1 - a.z0) * 0.55), materials.slate);
  aisleRoof.position.set((a.x0 + a.x1) / 2, heightAt(27, -80) + aisleH + 1.1, a.z1 - (a.z1 - a.z0) * 0.275);
  aisleRoof.rotation.z = 0.5;
  root.add(aisleRoof);
  const random = mulberry32(61);
  for (let i = 0; i < 16; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + random() * 0.35, 0), materials.rubble);
    const z = a.collapse[0] + random() * (a.collapse[1] - a.collapse[0]);
    const x = a.x0 - 1.5 + random() * 2.2;
    rock.position.set(x, heightAt(x, z) + 0.15, z);
    rock.rotation.set(random() * 3, random() * 3, 0);
    rock.castShadow = true;
    root.add(rock);
  }

  // ── 正面の階段 ──
  for (let i = 0; i < 3; i++) {
    const depth = 0.75;
    const zc = front + 2.2 - depth * (i + 0.5);
    root.add(box(stone, (door + 1.2) * 2, 0.2 * (i + 1), depth, cx, heightAt(cx, front + 3) + 0.1 * (i + 1), zc, 1));
  }

  // ── 内部：床、柱とアーチ、長椅子、祭壇、壁画 ──
  const floor = new THREE.Mesh(worldUV(new THREE.BoxGeometry(hw * 2, 0.2, length), 2), stone);
  floor.position.set(cx, floorY - 0.1, (front + back) / 2);
  floor.receiveShadow = true;
  root.add(floor);
  const apseFloor = new THREE.Mesh(new THREE.CircleGeometry(r, 16, Math.PI, Math.PI), stone);
  apseFloor.rotation.x = -Math.PI / 2;
  apseFloor.position.set(cx, floorY + 0.001, back);
  root.add(apseFloor);
  for (const z of CHAPEL.columns) {
    for (const x of [cx - 4.5, cx + 4.5]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 7.4, 10), stone);
      column.position.set(x, floorY + 3.7, z);
      column.castShadow = true;
      root.add(column);
      root.add(box(stone, 1.1, 0.35, 1.1, x, floorY + 7.55, z, 1));
    }
  }
  // 柱の間の尖頭アーチ（縦の列）
  for (const x of [cx - 4.5, cx + 4.5]) {
    for (let i = 0; i < CHAPEL.columns.length - 1; i++) {
      const z0 = CHAPEL.columns[i];
      const span = z0 - CHAPEL.columns[i + 1];
      const arch = wallWithHoles(stone, span, 2.2, 0.5, [lancet(span / 2, 0, span - 0.9, 0.2, 1.6)]);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(x - 0.25, floorY + 7.7, z0);
      root.add(arch);
    }
  }
  const pewRandom = mulberry32(71);
  for (let i = 0; i < 5; i++) {
    const z = -80 - i * 2;
    for (const side of [-1, 1]) {
      const pew = new THREE.Group();
      pew.add(box(materials.wood, 2.6, 0.12, 0.55, 0, 0.48, 0, 1));
      pew.add(box(materials.wood, 2.6, 0.7, 0.1, 0, 0.85, 0.28, 1));
      for (const lx of [-1.2, 1.2]) pew.add(box(materials.wood, 0.1, 0.48, 0.5, lx, 0.24, 0, 1));
      pew.position.set(cx + side * 2.5, floorY, z);
      // 傷んで傾いた長椅子もある
      if (pewRandom() < 0.3) { pew.rotation.z = (pewRandom() - 0.5) * 0.25; pew.rotation.y = (pewRandom() - 0.5) * 0.3; }
      root.add(pew);
    }
  }
  const altar = box(stone, 2.8, 1.1, 1.2, cx, floorY + 0.55, back + 1.2);
  root.add(altar);
  root.add(box(materials.wood, 2.9, 0.06, 1.3, cx, floorY + 1.13, back + 1.2, 1));
  for (const x of [cx - 1.1, cx + 1.1]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.5, 8), materials.iron);
    stick.position.set(x, floorY + 1.4, back + 1.2);
    root.add(stick);
  }
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), materials.mural);
  mural.rotation.y = Math.PI / 2;
  mural.position.set(west + t + 0.02, floorY + 2.6, INTERACTABLES.mural.z);
  root.add(mural);

  // ── 光：割れた窓から差す光（東の窓から西へ）、薄明かり、漂う埃 ──
  const shaftMat = shaftMaterial('#dfe6ee', 0.22);
  const shafts = [];
  for (const z of CHAPEL.windows) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), shaftMat);
    shaft.position.set(east - 3.2, floorY + 3.6, z);
    shaft.rotation.set(0, Math.PI / 2, 0.75);
    root.add(shaft);
    shafts.push(shaft);
  }
  const interiorLight = new THREE.PointLight('#b8c4d0', 18, 26, 1.6);
  interiorLight.position.set(cx, floorY + 6, -84);
  root.add(interiorLight);
  const altarLight = new THREE.PointLight('#d8d0c0', 6, 10, 1.8);
  altarLight.position.set(cx, floorY + 4, back + 2);
  root.add(altarLight);

  const dustCount = 120;
  const dustGeometry = new THREE.BufferGeometry();
  const dustBase = new Float32Array(dustCount * 3);
  const dustRandom = mulberry32(81);
  for (let i = 0; i < dustCount; i++) {
    dustBase[i * 3] = west + 1 + dustRandom() * (hw * 2 - 2);
    dustBase[i * 3 + 1] = floorY + 0.5 + dustRandom() * 6;
    dustBase[i * 3 + 2] = back + 1 + dustRandom() * (length - 4);
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustBase.slice(), 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#e8e4d8', size: 0.05, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(dust);

  // 記憶の場面：割れる前の窓（温かい光）に近づける。amount は 0〜1
  function setMemory(amount) {
    for (const pane of glassPanes) {
      pane.material.emissive.set('#f3d9a4');
      pane.material.emissiveIntensity = amount * 1.6;
      pane.material.opacity = 0.55 + 0.4 * amount;
    }
    shaftMat.color.set('#dfe6ee').lerp(new THREE.Color('#ffd9a0'), amount);
    shaftMat.opacity = 0.22 + 0.4 * amount;
    interiorLight.color.set('#b8c4d0').lerp(new THREE.Color('#ffd7a8'), amount);
    interiorLight.intensity = 18 + 30 * amount;
  }

  // 埃は礼拝堂の近くにいるときだけ動かす（森にいる間は、毎コマの書き換えをしない）
  function update(time, near = true) {
    dust.visible = near;
    if (!near) return;
    const position = dustGeometry.getAttribute('position');
    for (let i = 0; i < dustCount; i++) {
      position.setXYZ(
        i,
        dustBase[i * 3] + Math.sin(time * 0.21 + i) * 0.4,
        dustBase[i * 3 + 1] + Math.sin(time * 0.13 + i * 1.7) * 0.5,
        dustBase[i * 3 + 2] + Math.cos(time * 0.17 + i * 0.6) * 0.4,
      );
    }
    position.needsUpdate = true;
  }

  return { root, occluders, setMemory, update, floorY };
}
