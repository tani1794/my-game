// 第一章の材質。質感の画像（scripts/build-chapter-textures.py が作る）を、世界の大きさに合わせて繰り返し貼る。
// 画像が読めないときも、色だけの材質で続ける。
import * as THREE from 'three';
import { asset } from '../paths.js';

const loader = new THREE.TextureLoader();

function texture(file, { color = true } = {}) {
  const map = loader.load(asset(`textures/chapter/${file}`), undefined, undefined, () => {
    console.warn(`質感の画像を読み込めませんでした: ${file}`);
  });
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// 物の大きさに関係なく、1枚が size(m) になるよう、頂点の位置から uv を作り直す（箱・押し出しの形用）
export function worldUV(geometry, size) {
  geometry.computeVertexNormals();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    // 向いている面ごとに、いちばん平らに見える2軸を使う
    if (ny >= nx && ny >= nz) { uv[i * 2] = x / size; uv[i * 2 + 1] = z / size; }
    else if (nx >= nz) { uv[i * 2] = z / size; uv[i * 2 + 1] = y / size; }
    else { uv[i * 2] = x / size; uv[i * 2 + 1] = y / size; }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export function createMaterials() {
  const stoneMap = texture('stone.webp');
  const stoneNormal = texture('stone-normal.webp', { color: false });
  const stone = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, normalScale: new THREE.Vector2(0.9, 0.9), color: '#b9b6ae', roughness: 0.95 });
  // 礼拝堂の石は、森の石より冷たく白っぽい
  const chapelStone = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, normalScale: new THREE.Vector2(0.9, 0.9), color: '#cfd0d0', roughness: 0.92 });
  const groundMap = texture('ground.webp');
  const ground = new THREE.MeshStandardMaterial({ map: groundMap, vertexColors: true, roughness: 1 });
  const slate = new THREE.MeshStandardMaterial({ map: texture('slate.webp'), color: '#9aa0a8', roughness: 0.8, side: THREE.DoubleSide });
  const wood = new THREE.MeshStandardMaterial({ map: texture('wood.webp'), color: '#a08a76', roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2a29', roughness: 0.6, metalness: 0.7 });
  const mural = new THREE.MeshStandardMaterial({ map: texture('mural.webp'), roughness: 1 });
  const glass = new THREE.MeshStandardMaterial({ color: '#4b5e6e', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const water = new THREE.MeshStandardMaterial({ color: '#1d2a2a', roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.85 });
  const moss = new THREE.MeshStandardMaterial({ color: '#2f4a24', roughness: 1 });
  const rubble = new THREE.MeshStandardMaterial({ color: '#77736a', roughness: 1, flatShading: true });
  return { stone, chapelStone, ground, slate, wood, iron, mural, glass, water, moss, rubble };
}
