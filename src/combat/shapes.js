const EPSILON = 1e-9;
const TAU = Math.PI * 2;

export function angleTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function angleDiff(a, b) {
  let difference = (b - a) % TAU;

  if (difference > Math.PI) difference -= TAU;
  if (difference < -Math.PI) difference += TAU;

  return difference;
}

function angleIsInsideSector(sector, angle) {
  if (sector.spread >= TAU - EPSILON) return true;

  return (
    Math.abs(angleDiff(sector.angle, angle)) <=
    sector.spread / 2 + EPSILON
  );
}

function sectorContainsPoint(sector, point) {
  const dx = point.x - sector.x;
  const dz = point.z - sector.z;
  const distance = Math.hypot(dx, dz);

  if (distance > sector.radius + EPSILON) return false;

  // 扇の頂点は、向きにかかわらず常に含まれる。
  if (distance <= EPSILON) return true;

  return angleIsInsideSector(sector, Math.atan2(dx, dz));
}

export function shapeContains(shape, point) {
  const dx = point.x - shape.x;
  const dz = point.z - shape.z;

  switch (shape.type) {
    case 'circle':
      return Math.hypot(dx, dz) <= shape.radius + EPSILON;

    case 'sector':
      return sectorContainsPoint(shape, point);

    case 'band': {
      const sin = Math.sin(shape.angle);
      const cos = Math.cos(shape.angle);

      // angle の向き (sin, cos) に沿った距離。
      const forward = dx * sin + dz * cos;

      // 進行方向に直交する方向 (cos, -sin) に沿った距離。
      const sideways = dx * cos - dz * sin;

      return (
        forward >= -EPSILON &&
        forward <= shape.length + EPSILON &&
        Math.abs(sideways) <= shape.width / 2 + EPSILON
      );
    }

    default:
      return false;
  }
}

function distanceToSegment(point, start, end) {
  const vx = end.x - start.x;
  const vz = end.z - start.z;
  const wx = point.x - start.x;
  const wz = point.z - start.z;

  const lengthSquared = vx * vx + vz * vz;

  if (lengthSquared === 0) {
    return Math.hypot(wx, wz);
  }

  const projection = (wx * vx + wz * vz) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));

  const closestX = start.x + vx * t;
  const closestZ = start.z + vz * t;

  return Math.hypot(point.x - closestX, point.z - closestZ);
}

export function sectorHitsCircle(sector, circle) {
  // 円の中心が扇の中にある。
  if (sectorContainsPoint(sector, circle)) return true;

  const dx = circle.x - sector.x;
  const dz = circle.z - sector.z;
  const centerDistance = Math.hypot(dx, dz);

  // 円が扇の頂点に届く。
  if (centerDistance <= circle.radius + EPSILON) return true;

  const halfSpread = Math.min(sector.spread / 2, Math.PI);
  const start = { x: sector.x, z: sector.z };

  // 扇の左右の辺は、頂点から外周までの有限線分。
  for (const edgeAngle of [
    sector.angle - halfSpread,
    sector.angle + halfSpread,
  ]) {
    const end = {
      x: sector.x + Math.sin(edgeAngle) * sector.radius,
      z: sector.z + Math.cos(edgeAngle) * sector.radius,
    };

    if (distanceToSegment(circle, start, end) <= circle.radius + EPSILON) {
      return true;
    }
  }

  // 円の中心方向が扇の角度内なら、外周の弧との最短距離は
  // 中心からの距離と扇の半径との差になる。
  const circleAngle = Math.atan2(dx, dz);

  return (
    angleIsInsideSector(sector, circleAngle) &&
    Math.abs(centerDistance - sector.radius) <= circle.radius + EPSILON
  );
}
