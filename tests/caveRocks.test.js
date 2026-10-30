import { test, expect } from 'vitest';
import { CAVE } from '../src/areas/cave/layout.js';
import { caveRocks } from '../src/areas/cave/rocks.js';
import { rockIntrusions } from '../src/areas/rocks.js';

const opened = { lightOpen: true, planksSet: true };
const brief = (list) => list.slice(0, 6).map((h) => `${h.floor} ${h.at.map((v) => v.toFixed(1))} ← rock ${[h.rock.x, h.rock.y, h.rock.z].join(',')}`);

test('洞穴：歩ける床の上で、主人公の体が壁の岩の中に入らない（階段・岸・広間・登り）', () => {
  const hits = rockIntrusions(caveRocks(), CAVE.level.floors, { state: opened });
  expect(brief(hits)).toEqual([]);
});

test('岩の判定：床の真上に置いた岩は見つかり、離れた岩は見つからない', () => {
  const floors = [{ id: 'f', type: 'rect', x0: -2, x1: 2, z0: -2, z1: 2, y: 0 }];
  expect(rockIntrusions([{ x: 0, y: 1, z: 0, s: 1.5, sy: 1 }], floors)).not.toHaveLength(0);
  expect(rockIntrusions([{ x: 8, y: 1, z: 0, s: 1.5, sy: 1 }], floors)).toHaveLength(0);
  // 床より高い所に浮かぶ岩（天井の上）は、体に届かない
  expect(rockIntrusions([{ x: 0, y: 6, z: 0, s: 1.5, sy: 1 }], floors)).toHaveLength(0);
});

// ── 岩を床から離す（clearRocks）：見た目どおり（外接球）で床にかかる岩は、床から離れる向きへずらす ──
import { clearRocks } from '../src/areas/rocks.js';

test('床にかかる岩は、床から離れる向きへずらし、かからない岩はそのまま', () => {
  const floors = [{ id: 'road', type: 'rect', x0: -2, x1: 2, z0: -10, z1: 10, y: 0 }];
  // 道の東の縁に半分かかる岩と、遠くの岩
  const [moved, far] = clearRocks([{ x: 3, y: 1, z: 0, s: 2, sy: 1 }, { x: 20, y: 1, z: 0, s: 2, sy: 1 }], floors);
  expect(rockIntrusions([moved], floors)).toHaveLength(0);
  expect(moved.x).toBeGreaterThan(3);
  expect(Math.abs(moved.z)).toBeLessThan(0.5);
  expect(far).toEqual({ x: 20, y: 1, z: 0, s: 2, sy: 1 });
});

test('両側を床に挟まれて動かせない岩は、かからない大きさまで小さくする', () => {
  const floors = [
    { id: 'west', type: 'rect', x0: -6, x1: -1.5, z0: -10, z1: 10, y: 0 },
    { id: 'east', type: 'rect', x0: 1.5, x1: 6, z0: -10, z1: 10, y: 0 },
  ];
  const [rock] = clearRocks([{ x: 0, y: 1, z: 0, s: 2.5, sy: 1 }], floors, { maxPush: 0 });
  expect(rockIntrusions([rock], floors)).toHaveLength(0);
  expect(rock.s).toBeLessThan(2.5);
});

// ── 岩の見た目（props.js の rockMesh）：判定（横は半径 s、縦は s × sy）と同じ範囲に収まる ──
// 縦に伸ばしてから回すと、伸びた向きが傾いて横へはみ出す（rocks.js の判定より大きく見え、道にかかる）
import * as THREE from 'three';
import { rockMesh } from '../src/areas/props.js';

test('どの向きに回した岩も、横は半径 s、縦は s × sy の中に収まる', () => {
  const random = (() => { let n = 7; return () => { n = (n * 16807) % 2147483647; return n / 2147483647; }; })();
  for (let i = 0; i < 40; i++) {
    const rotation = [random() * 3, random() * 3, random() * 3];
    const mesh = rockMesh(new THREE.MeshBasicMaterial(), 2, 1.6, rotation);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(2 + 1e-6);
    expect(Math.max(-box.min.y, box.max.y)).toBeLessThanOrEqual(2 * 1.6 + 1e-6);
  }
});
