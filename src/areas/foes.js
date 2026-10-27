// エリアの敵の群れ（three.js も DOM も使わない）。頭脳は src/story/enemy.js、種類の定義はエリアごと。
// 主人公への当たり（同じ攻撃は一度だけ）、剣で斬る、詠唱で仲間を強める、蜘蛛の糸（遅くなる・斬ると消える）を扱う。
import { createEnemy } from '../story/enemy.js';
import { shapeContains, sectorHitsCircle } from '../combat/shapes.js';

const SAME_LEVEL = 2;
const WEB_SLOW = 0.45;
const FAR = { x: 1e4, z: 1e4 };

export function createFoes(posts, defs) {
  const enemies = posts.map((post) => ({ post, enemy: createEnemy(defs[post.type], post) }));
  let webs = [];
  let webCount = 0;
  let defeated = [];
  const struck = new Set();

  const sameLevel = (a, b) => Math.abs(a - b) < SAME_LEVEL;

  // ctx = { player: {x, z, y}, canSee(ax, az, bx, bz), stepFor(y) → step, hitPlayer(damage) → 当たったか }
  function update(dt, { player, canSee, stepFor, hitPlayer }) {
    const allies = enemies.map(({ enemy }) => ({ id: enemy.id, ...enemy.position(), alive: enemy.alive() }));
    const frames = [];
    const noticed = [];
    for (const { post, enemy } of enemies) {
      const near = sameLevel(post.y ?? 0, player.y);
      const frame = enemy.update(dt, { player: near ? player : FAR, canSee, step: stepFor(post.y ?? 0), allies });
      frame.y = post.y ?? 0;
      frames.push(frame);
      for (const event of frame.events) if (event.type === 'noticed') noticed.push(event.id);
      for (const buff of frame.buffs) enemies.find((e) => e.enemy.id === buff.id)?.enemy.buff(buff.seconds);
      for (const spawn of frame.spawns) {
        if (spawn.type === 'web') webs.push({ id: `web-${webCount++}`, x: spawn.x, z: spawn.z, y: post.y ?? 0, radius: spawn.radius, life: spawn.life ?? 12 });
      }
      if (!near) continue;
      for (const strike of frame.strikes) {
        if (struck.has(strike.key) || !shapeContains(strike.shape, player)) continue;
        // 同じ攻撃は一度だけ（回避で外れたときも、その攻撃は終わり）
        struck.add(strike.key);
        hitPlayer(strike.damage, frame);
      }
    }
    webs = webs.filter((web) => (web.life -= dt) > 0);
    return { frames, noticed };
  }

  // 剣の扇で斬る。斬った敵・糸の結果を返す
  function swordHit(sword, { attack, power, critical, y }) {
    const results = [];
    for (const { post, enemy } of enemies) {
      if (!enemy.alive() || enemy.hidden() || !sameLevel(post.y ?? 0, y)) continue;
      const p = enemy.position();
      if (!sectorHitsCircle(sword, { x: p.x, z: p.z, radius: enemy.radius })) continue;
      const result = enemy.hit({ attack, power, critical, from: { x: sword.x, z: sword.z } });
      if (result.dead) defeated.push(enemy.id);
      results.push({ id: enemy.id, x: p.x, z: p.z, y: post.y ?? 0, ...result });
    }
    const cut = webs.filter((web) => sameLevel(web.y, y) && sectorHitsCircle(sword, web));
    for (const web of cut) results.push({ id: web.id, web: true, x: web.x, z: web.z, y: web.y, damage: 0 });
    webs = webs.filter((web) => !cut.includes(web));
    return results;
  }

  // 糸の中では遅くなる
  function slowAt(x, z, y) {
    return webs.some((web) => sameLevel(web.y, y) && Math.hypot(x - web.x, z - web.z) < web.radius) ? WEB_SLOW : 1;
  }

  // 休む・倒れて戻る：通常の敵は持ち場に戻り、倒した記録のある精鋭は倒れたまま
  function reset(isDefeated) {
    webs = [];
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

  return {
    update, swordHit, slowAt, reset, takeDefeated, colliders, nearest,
    webs: () => webs,
    list: () => enemies.map(({ enemy }) => enemy),
    postOf: (id) => posts.find((p) => p.id === id),
  };
}
