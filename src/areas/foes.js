// エリアの敵の群れ（three.js も DOM も使わない）。頭脳は src/story/enemy.js、種類の定義はエリアごと。
// 主人公への当たり（同じ攻撃は一度だけ）、剣で斬る、詠唱で仲間を強める、
// 敵が戦いの中で生む物（蜘蛛の糸・吹雪：中で遅くなる／氷の壁：しばらく道を塞ぐ／分身：一太刀で消える）を扱う。
import { createEnemy } from '../story/enemy.js';
import { shapeContains, sectorHitsCircle } from '../combat/shapes.js';

const SAME_LEVEL = 2;
const SLOW = { web: 0.45, blizzard: 0.75 };
const WALL_THICKNESS = 1.2;
const CLONE_RING = 2.5;
const FAR = { x: 1e4, z: 1e4 };

export function createFoes(posts, defs) {
  let enemies = posts.map((post) => ({ post, enemy: createEnemy(defs[post.type], post) }));
  let hazards = [];   // { id, kind: 'web' | 'blizzard', x, z, y, radius, life }
  let walls = [];     // { id, x, z, y, angle, length, life }
  let spawnCount = 0;
  let defeated = [];
  const struck = new Set();

  const sameLevel = (a, b) => Math.abs(a - b) < SAME_LEVEL;

  // ctx = { player: {x, z, y}, canSee(ax, az, bx, bz), stepFor(y) → step, hitPlayer(damage) → 当たったか }
  function update(dt, { player, canSee, stepFor, hitPlayer }) {
    const allies = enemies.map(({ enemy }) => ({ id: enemy.id, ...enemy.position(), alive: enemy.alive() }));
    const frames = [];
    const noticed = [];
    for (const entry of [...enemies]) {
      const { post, enemy } = entry;
      const near = sameLevel(post.y ?? 0, player.y);
      const frame = enemy.update(dt, { player: near ? player : FAR, canSee, step: stepFor(post.y ?? 0), allies });
      frame.y = post.y ?? 0;
      if (post.cloneOf) frame.cloneOf = post.cloneOf;
      frames.push(frame);
      for (const event of frame.events) if (event.type === 'noticed') noticed.push(event.id);
      for (const buff of frame.buffs) enemies.find((e) => e.enemy.id === buff.id)?.enemy.buff(buff.seconds);
      for (const spawn of frame.spawns) addSpawn(spawn, entry);
      if (!near) continue;
      for (const strike of frame.strikes) {
        if (struck.has(strike.key) || !shapeContains(strike.shape, player)) continue;
        // 同じ攻撃は一度だけ（回避で外れたときも、その攻撃は終わり）
        struck.add(strike.key);
        hitPlayer(strike.damage, frame);
      }
    }
    hazards = hazards.filter((h) => (h.life -= dt) > 0);
    walls = walls.filter((w) => (w.life -= dt) > 0);
    // 分身は時間がたつか、斬られると消える
    enemies = enemies.filter(({ post, enemy }) => !post.cloneOf || (enemy.alive() && (post.life -= dt) > 0));
    return { frames, noticed };
  }

  function addSpawn(spawn, { post, enemy }) {
    const y = post.y ?? 0;
    const id = `${spawn.type}-${spawnCount++}`;
    if (spawn.type === 'web' || spawn.type === 'blizzard') {
      hazards.push({ id, kind: spawn.type, x: spawn.x, z: spawn.z, y, radius: spawn.radius, life: spawn.life ?? 12 });
    } else if (spawn.type === 'wall') {
      // 狙った場所に、敵から見て横向きに立つ
      const from = enemy.position();
      walls.push({ id, x: spawn.x, z: spawn.z, y, angle: Math.atan2(spawn.x - from.x, spawn.z - from.z), length: spawn.length, life: spawn.life ?? 8 });
    } else if (spawn.type === 'clone') {
      const from = enemy.position();
      const def = defs[post.type].clone;
      for (let i = 0; i < spawn.count; i += 1) {
        const a = (i / spawn.count) * Math.PI * 2 + spawnCount;
        const clonePost = { id: `${post.id}-clone${spawnCount++}`, type: post.type, x: from.x + Math.sin(a) * CLONE_RING, z: from.z + Math.cos(a) * CLONE_RING, y, cloneOf: post.id, life: spawn.life ?? 10 };
        const clone = createEnemy(def, clonePost);
        clone.wake();
        enemies.push({ post: clonePost, enemy: clone });
      }
    }
  }

  // 剣の扇で斬る。斬った敵・糸の結果を返す
  function swordHit(sword, { attack, power, critical, y }) {
    const results = [];
    for (const { post, enemy } of enemies) {
      if (!enemy.alive() || enemy.hidden() || !sameLevel(post.y ?? 0, y)) continue;
      const p = enemy.position();
      if (!sectorHitsCircle(sword, { x: p.x, z: p.z, radius: enemy.radius })) continue;
      const result = enemy.hit({ attack, power, critical, from: { x: sword.x, z: sword.z } });
      if (result.dead && !post.cloneOf) defeated.push(enemy.id);
      results.push({ id: enemy.id, x: p.x, z: p.z, y: post.y ?? 0, ...result });
    }
    // 糸は斬れば切れる（吹雪は斬れない）
    const cut = hazards.filter((h) => h.kind === 'web' && sameLevel(h.y, y) && sectorHitsCircle(sword, h));
    for (const web of cut) results.push({ id: web.id, web: true, x: web.x, z: web.z, y: web.y, damage: 0 });
    hazards = hazards.filter((h) => !cut.includes(h));
    return results;
  }

  // 糸・吹雪の中では遅くなる（重なっていれば、いちばん遅いもの）
  function slowAt(x, z, y) {
    let slow = 1;
    for (const h of hazards) {
      if (sameLevel(h.y, y) && Math.hypot(x - h.x, z - h.z) < h.radius) slow = Math.min(slow, SLOW[h.kind]);
    }
    return slow;
  }

  // 氷の壁の当たり判定（主人公と敵の両方を止める）
  function wallColliders(y) {
    return walls.filter((w) => sameLevel(w.y, y)).map((w) => ({ type: 'box', x: w.x, z: w.z, hx: w.length / 2, hz: WALL_THICKNESS / 2, angle: w.angle }));
  }

  // 休む・倒れて戻る：通常の敵は持ち場に戻り、倒した記録のある精鋭は倒れたまま
  function reset(isDefeated) {
    hazards = [];
    walls = [];
    enemies = enemies.filter(({ post }) => !post.cloneOf);
    struck.clear();
    defeated = [];
    for (const { post, enemy } of enemies) {
      enemy.reset();
      if (post.elite && isDefeated(enemy.id)) enemy.kill();
    }
  }

  function takeDefeated() {
    const list = defeated;
    defeated = [];
    return list;
  }

  function colliders(y) {
    return enemies
      .filter(({ post, enemy }) => enemy.alive() && !enemy.hidden() && sameLevel(post.y ?? 0, y))
      .map(({ enemy }) => ({ ...enemy.position(), radius: enemy.radius }));
  }

  // 近い敵（向き直り・ロックオン用）
  function nearest(p, range) {
    let best = null;
    for (const { post, enemy } of enemies) {
      if (!enemy.alive() || enemy.hidden() || !sameLevel(post.y ?? 0, p.y)) continue;
      const e = enemy.position();
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d <= range && (!best || d < best.d)) best = { enemy, d, y: post.y ?? 0 };
    }
    return best;
  }

  function wake(id) {
    enemies.find(({ enemy }) => enemy.id === id)?.enemy.wake();
  }

  return {
    update, swordHit, slowAt, reset, takeDefeated, colliders, nearest, wallColliders, wake,
    hazards: () => hazards,
    webs: () => hazards.filter((h) => h.kind === 'web'),
    walls: () => walls,
    list: () => enemies.map(({ enemy }) => enemy),
    postOf: (id) => enemies.find(({ enemy }) => enemy.id === id)?.post ?? posts.find((p) => p.id === id),
  };
}
