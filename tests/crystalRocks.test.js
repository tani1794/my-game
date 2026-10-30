import { test, expect } from 'vitest';
import { CRYSTAL, CRYSTAL_HEIGHTS } from '../src/areas/crystal/layout.js';
import { valleyRocks, mineRocks, MINE_CEILINGS, mineCeilingRocks } from '../src/areas/crystal/rocks.js';
import { rockIntrusions } from '../src/areas/rocks.js';
import { floorHeight } from '../src/areas/kit.js';
import { mulberry32 } from '../src/world/random.js';

// すべての仕掛けが動いたあとの床（光の橋・籠・門・倒れた支柱）
const opened = { bridgeOn: true, liftUp: true, crownGateOpen: true, timberDown: true, webCut1: true, webCut2: true, bossDown: true, vergrasDefeated: true };
const brief = (list) => list.slice(0, 6).map((h) => `${h.floor} ${h.at.map((v) => v.toFixed(1))} ← rock ${[h.rock.x, h.rock.y, h.rock.z].map((v) => v.toFixed(1))}`);

test('峡谷：歩ける床の上で、主人公の体が崖・岩棚の岩の中に入らない', () => {
  // build.js と同じ乱数（種 331）を、同じ順で使う
  const hits = rockIntrusions(valleyRocks(mulberry32(331)), CRYSTAL.level.floors, { state: opened });
  expect(brief(hits)).toEqual([]);
});

test('峡谷の崖の並びは、同じ乱数なら毎回同じ（見た目が変わらない）', () => {
  expect(valleyRocks(mulberry32(331))).toEqual(valleyRocks(mulberry32(331)));
});

test('旧坑道：部屋・抜け道・坂の上で、主人公の体が壁の岩の中に入らない', () => {
  const hits = rockIntrusions(mineRocks(), CRYSTAL.level.floors, { state: opened });
  expect(brief(hits)).toEqual([]);
});

test('旧坑道：天井の上に載せた岩（丘に見せる岩）が、下の坂や道にかからない', () => {
  const hits = rockIntrusions(mineCeilingRocks(), CRYSTAL.level.floors, { state: opened });
  expect(brief(hits)).toEqual([]);
});

test('旧坑道の天井は、下の床（坂を含む）から 2.4m 以上の高さにある（坂の途中で天井が体を横切らない）', () => {
  const { MINE } = CRYSTAL_HEIGHTS;
  const low = [];
  for (const [cx, cz, w, d] of MINE_CEILINGS) {
    for (let x = cx - w / 2; x <= cx + w / 2; x += 0.5) {
      for (let z = cz - d / 2; z <= cz + d / 2; z += 0.5) {
        for (const floor of CRYSTAL.level.floors) {
          const y = floorHeight(floor, x, z);
          if (y !== null && y < MINE + 4.6 && MINE + 4.6 - y < 2.4) low.push(`${floor.id} ${x},${z} y ${y.toFixed(2)}`);
        }
      }
    }
  }
  expect(low.slice(0, 6)).toEqual([]);
});
