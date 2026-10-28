// 閉ざされた城（入れない）：城の高台の上に、擁壁と基礎 → 城壁（胸壁・控え壁）→ 門楼（尖頭アーチの門と落とし格子）
// → 四隅の円塔（1つは崩れている）→ 主塔（尖塔と小塔）・副塔 → 大広間（切妻屋根・尖頭窓・薔薇窓）、
// 東の城壁の崩れと足もとの瓦礫。窓と門は階の高さに合わせて並べる。
import * as THREE from 'three';
import { wall, roundTower, squareTower, archOpening, rubble, pointedArchPoints } from './architecture.js';

const BASE = -1.06; // 城の高台の上面（terrain.js の castleMesa）

// 白薔薇の紋章の旗
function bannerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c2433';
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = '#d9d6cc';
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, 108, 200);
  ctx.fillStyle = '#e8e4da';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(64 + Math.sin(a) * 14, 100 + Math.cos(a) * 14, 14, 10, -a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1c2433';
  ctx.beginPath(); ctx.arc(64, 100, 7, 0, Math.PI * 2); ctx.fill();
  // 下は燕尾
  ctx.clearRect(0, 216, 128, 40);
  ctx.fillStyle = '#1c2433';
  ctx.beginPath(); ctx.moveTo(0, 210); ctx.lineTo(128, 210); ctx.lineTo(128, 256); ctx.lineTo(64, 222); ctx.lineTo(0, 256); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildCastle(batch, root, { stone, roof, dark, iron }, { groundAt, random }) {
  const owned = [];
  // ── 擁壁と基礎：高台の南の縁（崖の上）と、城壁の下の広い台座 ──
  wall(batch, stone, [-44, -47.5], [-6, -47.5], { base: BASE - 6, height: 6.2, thickness: 2, buttress: 7 });
  wall(batch, stone, [6, -47.5], [44, -47.5], { base: BASE - 6, height: 6.2, thickness: 2, buttress: 7 });
  // 橋から門へ：前庭へ上がる階段
  for (let i = 0; i < 4; i++) batch.box(stone, 10 - i * 0.6, 0.3, 1.2, [0, BASE + 0.15 + i * 0.3, -50 - i * 1.2]);
  batch.box(stone, 92, 1.4, 4, [0, BASE + 0.7, -56]);
  batch.box(stone, 4, 1.4, 56, [-42, BASE + 0.7, -82]);
  batch.box(stone, 4, 1.4, 56, [42, BASE + 0.7, -82]);
  batch.box(stone, 92, 1.4, 4, [0, BASE + 0.7, -108]);

  // ── 城壁（胸壁・控え壁）。東の壁は途中が崩れている ──
  const H = 11;
  const T = 2.2;
  const lift = BASE + 1.4;
  wall(batch, stone, [-40, -56], [-6.2, -56], { base: lift, height: H, thickness: T, crenels: true, buttress: 7 });
  wall(batch, stone, [6.2, -56], [40, -56], { base: lift, height: H, thickness: T, crenels: true, buttress: 7 });
  wall(batch, stone, [-40, -108], [-40, -56], { base: lift, height: H, thickness: T, crenels: true, buttress: 8 });
  wall(batch, stone, [40, -56], [40, -78], { base: lift, height: H, thickness: T, crenels: true, buttress: 8 });
  // 崩れ：途中で折れた壁（断面が見える低い残り）と瓦礫
  wall(batch, stone, [40, -78], [40, -82], { base: lift, height: H * 0.55, thickness: T, coping: false });
  wall(batch, stone, [40, -88], [40, -92], { base: lift, height: H * 0.4, thickness: T, coping: false });
  wall(batch, stone, [40, -92], [40, -108], { base: lift, height: H, thickness: T, crenels: true, buttress: 8 });
  rubble(batch, stone, { x: 43, z: -85, radius: 5, count: 26, groundAt, random });
  rubble(batch, stone, { x: 37, z: -85, radius: 3, count: 10, groundAt: () => lift, random });
  wall(batch, stone, [-40, -108], [40, -108], { base: lift, height: H, thickness: T, crenels: true });

  // ── 門楼：左右の角塔と、尖頭アーチの門（開口は本物。落とし格子で閉じている） ──
  squareTower(batch, stone, roof, { x: -9, z: -56, base: lift, width: 6, height: 17 });
  squareTower(batch, stone, roof, { x: 9, z: -56, base: lift, width: 6, height: 17 });
  const gateOuter = new THREE.Shape();
  gateOuter.moveTo(-6.2, 0); gateOuter.lineTo(6.2, 0); gateOuter.lineTo(6.2, 13); gateOuter.lineTo(-6.2, 13); gateOuter.lineTo(-6.2, 0);
  const gateHole = new THREE.Path();
  const archPts = pointedArchPoints(4.4, 7.6);
  gateHole.moveTo(archPts[0][0], archPts[0][1]);
  for (const [x, y] of archPts.slice(1)) gateHole.lineTo(x, y);
  gateOuter.holes.push(gateHole);
  const gateGeometry = new THREE.ExtrudeGeometry(gateOuter, { depth: T + 0.6, bevelEnabled: false });
  gateGeometry.translate(0, 0, -(T + 0.6) / 2);
  batch.add(gateGeometry, stone, [0, lift, -56]);
  // 門の奥は暗い通路（入れない）、手前に鉄の落とし格子
  batch.box(dark, 4.4, 7.6, 0.2, [0, lift + 3.8, -57.8]);
  for (let i = -4; i <= 4; i++) batch.box(iron, 0.12, 6.4, 0.12, [i * 0.5, lift + 3.2, -55.2]);
  for (let j = 1; j <= 5; j++) batch.box(iron, 4.2, 0.1, 0.12, [0, lift + j * 1.2, -55.2]);
  // 門の上の窓
  archOpening(batch, stone, dark, { w: 1.2, h: 2.2 }, [0, lift + 9.2, -54.85], 0);

  // ── 四隅の円塔（北東は崩れている） ──
  roundTower(batch, stone, roof, { x: -40, z: -56, base: lift, radius: 4, height: 17 });
  roundTower(batch, stone, roof, { x: 40, z: -56, base: lift, radius: 4, height: 17 });
  roundTower(batch, stone, roof, { x: -40, z: -108, base: lift, radius: 3.5, height: 14 });
  roundTower(batch, stone, roof, { x: 40, z: -108, base: lift, radius: 3.5, height: 9, broken: true });
  rubble(batch, stone, { x: 45, z: -110, radius: 4, count: 16, groundAt, random });
  for (const [x, z, facing] of [[-40, -51.8, 0], [40, -51.8, 0]]) {
    archOpening(batch, stone, dark, { w: 0.9, h: 1.8 }, [x, lift + 7, z], facing);
    archOpening(batch, stone, dark, { w: 0.9, h: 1.8 }, [x, lift + 12, z], facing);
  }

  // ── 主塔：四角い胴に、階ごとの尖頭窓、上の小塔と中央の尖塔 ──
  const keepH = 28;
  squareTower(batch, stone, roof, { x: 0, z: -84, base: lift, width: 14, height: keepH, roof: 'spire' });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    roundTower(batch, stone, roof, { x: sx * 7, z: -84 + sz * 7, base: lift + keepH - 2, radius: 1.3, height: 5 });
  }
  for (const level of [8, 15, 22]) {
    for (const x of [-3.5, 3.5]) archOpening(batch, stone, dark, { w: 1.4, h: 3 }, [x, lift + level, -76.95], 0);
    for (const z of [-87.5, -80.5]) {
      archOpening(batch, stone, dark, { w: 1.4, h: 3 }, [7.05, lift + level, z], Math.PI / 2);
      archOpening(batch, stone, dark, { w: 1.4, h: 3 }, [-7.05, lift + level, z], -Math.PI / 2);
    }
  }

  // ── 副塔：西の角塔、東の円塔 ──
  squareTower(batch, stone, roof, { x: -24, z: -96, base: lift, width: 8, height: 21 });
  roundTower(batch, stone, roof, { x: 22, z: -68, base: lift, radius: 3.4, height: 23 });
  for (const level of [9, 16]) archOpening(batch, stone, dark, { w: 1.2, h: 2.4 }, [-24, lift + level, -91.95], 0);

  // ── 大広間：切妻屋根、控え壁、長い尖頭窓、正面の薔薇窓 ──
  const hall = { x: -18, z: -72, w: 22, d: 11, h: 13 };
  batch.box(stone, hall.w, hall.h, hall.d, [hall.x, lift + hall.h / 2, hall.z]);
  const gable = new THREE.Shape();
  gable.moveTo(-hall.d / 2 - 0.6, 0); gable.lineTo(0, 7); gable.lineTo(hall.d / 2 + 0.6, 0); gable.lineTo(-hall.d / 2 - 0.6, 0);
  const roofGeometry = new THREE.ExtrudeGeometry(gable, { depth: hall.w + 1, bevelEnabled: false });
  roofGeometry.translate(0, 0, -(hall.w + 1) / 2);
  batch.add(roofGeometry, roof, [hall.x, lift + hall.h, hall.z], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 5; i++) {
    const x = hall.x - hall.w / 2 + 2.2 + i * 4.4;
    archOpening(batch, stone, dark, { w: 1.6, h: 6 }, [x, lift + 4, hall.z + hall.d / 2 + 0.05], 0);
    batch.box(stone, 1.2, hall.h * 0.8, 1.6, [x + 2.2, lift + hall.h * 0.4, hall.z + hall.d / 2 + 0.8]);
  }
  // 薔薇窓（東の妻面の丸窓）
  const roseFrame = new THREE.TorusGeometry(2.2, 0.35, 8, 24);
  batch.add(roseFrame, stone, [hall.x + hall.w / 2 + 0.2, lift + hall.h + 1.2, hall.z], [0, Math.PI / 2, 0]);
  batch.add(new THREE.CircleGeometry(2.0, 24), dark, [hall.x + hall.w / 2 + 0.05, lift + hall.h + 1.2, hall.z], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    batch.box(stone, 0.18, 4, 0.2, [hall.x + hall.w / 2 + 0.25, lift + hall.h + 1.2, hall.z], [a, Math.PI / 2, 0], 'YXZ');
  }
  // 東の妻面の三角（屋根の下を塞ぐ）
  const end = new THREE.ShapeGeometry(gable);
  batch.add(end, stone, [hall.x + hall.w / 2 + 0.01, lift + hall.h, hall.z], [0, Math.PI / 2, 0]);

  // ── 旗：門楼に白薔薇の紋章の旗 ──
  const texture = bannerTexture();
  const bannerMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, roughness: 1 });
  owned.push(texture, bannerMaterial);
  for (const x of [-9, 9]) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), bannerMaterial);
    banner.position.set(x, lift + 10, -52.9);
    root.add(banner);
  }
  return { dispose: () => owned.forEach((o) => o.dispose()) };
}
