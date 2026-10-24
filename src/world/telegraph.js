import * as THREE from 'three';

const MAX_TELEGRAPHS = 5;
const HEIGHT_OFFSET = 0.04;
const EDGE_WIDTH = 0.12;
const EDGE_COLOR = '#ffb347';
const ENRAGED_EDGE_COLOR = '#ff5a3c';
const FILL_COLOR = '#ff8a2b';
const EDGE_OPACITY = 0.9;
const FILL_OPACITY = 0.35;
const IMPACT_OPACITY = 0.6;
const CIRCLE_SEGMENTS = 64;
const SECTOR_SEGMENTS = 48;
const TWO_PI = Math.PI * 2;

const SUPPORTED_TYPES = new Set([
  'circle',
  'sector',
  'band',
]);

function createMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
}

function addPoint(positions, x, z) {
  const index = positions.length / 3;
  positions.push(x, 0, z);
  return index;
}

function addQuad(
  positions,
  indices,
  a,
  b,
  c,
  d,
) {
  const start = positions.length / 3;

  for (const [x, z] of [a, b, c, d]) {
    positions.push(x, 0, z);
  }

  indices.push(
    start,
    start + 1,
    start + 2,
    start,
    start + 2,
    start + 3,
  );
}

function addSegmentQuad(
  positions,
  indices,
  x1,
  z1,
  x2,
  z2,
  width,
) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);

  if (length === 0) return;

  const halfWidth = width / 2;
  const px = (dz / length) * halfWidth;
  const pz = (-dx / length) * halfWidth;

  addQuad(
    positions,
    indices,
    [x1 - px, z1 - pz],
    [x2 - px, z2 - pz],
    [x2 + px, z2 + pz],
    [x1 + px, z1 + pz],
  );
}

function createDisc(radius, segments, startAngle, endAngle) {
  const positions = [];
  const indices = [];
  const center = addPoint(positions, 0, 0);

  for (let i = 0; i <= segments; i++) {
    const ratio = i / segments;
    const angle =
      startAngle + (endAngle - startAngle) * ratio;

    addPoint(
      positions,
      Math.sin(angle) * radius,
      Math.cos(angle) * radius,
    );
  }

  for (let i = 0; i < segments; i++) {
    indices.push(
      center,
      center + i + 1,
      center + i + 2,
    );
  }

  return { positions, indices };
}

function addArcStrip(
  positions,
  indices,
  radius,
  startAngle,
  endAngle,
  segments,
) {
  const outerRadius = radius + EDGE_WIDTH / 2;
  const innerRadius = Math.max(
    0,
    radius - EDGE_WIDTH / 2,
  );
  const start = positions.length / 3;

  for (let i = 0; i <= segments; i++) {
    const ratio = i / segments;
    const angle =
      startAngle + (endAngle - startAngle) * ratio;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    addPoint(
      positions,
      sin * outerRadius,
      cos * outerRadius,
    );
    addPoint(
      positions,
      sin * innerRadius,
      cos * innerRadius,
    );
  }

  for (let i = 0; i < segments; i++) {
    const outer = start + i * 2;
    const inner = outer + 1;
    const nextOuter = outer + 2;
    const nextInner = outer + 3;

    indices.push(
      outer,
      inner,
      nextOuter,
      inner,
      nextInner,
      nextOuter,
    );
  }
}

function createCircleGeometryData(radius) {
  const fill = createDisc(
    radius,
    CIRCLE_SEGMENTS,
    0,
    TWO_PI,
  );
  const edge = {
    positions: [],
    indices: [],
  };

  addArcStrip(
    edge.positions,
    edge.indices,
    radius,
    0,
    TWO_PI,
    CIRCLE_SEGMENTS,
  );

  return { fill, edge };
}

function createSectorGeometryData(radius, spread) {
  const startAngle = -spread / 2;
  const endAngle = spread / 2;
  const fill = createDisc(
    radius,
    SECTOR_SEGMENTS,
    startAngle,
    endAngle,
  );
  const edge = {
    positions: [],
    indices: [],
  };

  addArcStrip(
    edge.positions,
    edge.indices,
    radius,
    startAngle,
    endAngle,
    SECTOR_SEGMENTS,
  );

  for (const angle of [startAngle, endAngle]) {
    addSegmentQuad(
      edge.positions,
      edge.indices,
      0,
      0,
      Math.sin(angle) * radius,
      Math.cos(angle) * radius,
      EDGE_WIDTH,
    );
  }

  return { fill, edge };
}

function createBandGeometryData(width, length) {
  const halfWidth = width / 2;
  const fill = {
    positions: [],
    indices: [],
  };
  const edge = {
    positions: [],
    indices: [],
  };

  addQuad(
    fill.positions,
    fill.indices,
    [-halfWidth, 0],
    [-halfWidth, length],
    [halfWidth, length],
    [halfWidth, 0],
  );

  addSegmentQuad(
    edge.positions,
    edge.indices,
    -halfWidth,
    0,
    -halfWidth,
    length,
    EDGE_WIDTH,
  );
  addSegmentQuad(
    edge.positions,
    edge.indices,
    halfWidth,
    length,
    halfWidth,
    0,
    EDGE_WIDTH,
  );
  addSegmentQuad(
    edge.positions,
    edge.indices,
    halfWidth,
    0,
    -halfWidth,
    0,
    EDGE_WIDTH,
  );
  addSegmentQuad(
    edge.positions,
    edge.indices,
    -halfWidth,
    length,
    halfWidth,
    length,
    EDGE_WIDTH,
  );

  return { fill, edge };
}

function measurementsFor(shape) {
  if (shape.type === 'circle') {
    return {
      type: shape.type,
      radius: Math.max(0, Number(shape.radius) || 0),
    };
  }

  if (shape.type === 'sector') {
    return {
      type: shape.type,
      radius: Math.max(0, Number(shape.radius) || 0),
      spread: Math.min(
        TWO_PI,
        Math.max(0, Number(shape.spread) || 0),
      ),
    };
  }

  return {
    type: shape.type,
    width: Math.max(0, Number(shape.width) || 0),
    length: Math.max(0, Number(shape.length) || 0),
  };
}

function geometryKey(measurements) {
  if (measurements.type === 'circle') {
    return `circle:${measurements.radius}`;
  }

  if (measurements.type === 'sector') {
    return (
      `sector:${measurements.radius}:` +
      measurements.spread
    );
  }

  return (
    `band:${measurements.width}:` +
    measurements.length
  );
}

function geometryDataFor(measurements) {
  if (measurements.type === 'circle') {
    return createCircleGeometryData(
      measurements.radius,
    );
  }

  if (measurements.type === 'sector') {
    return createSectorGeometryData(
      measurements.radius,
      measurements.spread,
    );
  }

  return createBandGeometryData(
    measurements.width,
    measurements.length,
  );
}

function writeGeometry(geometry, data) {
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      data.positions,
      3,
    ),
  );
  geometry.setIndex(data.indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function createSlot(scene, index) {
  const group = new THREE.Group();
  group.name = `telegraph-${index}`;
  group.visible = false;

  const fill = new THREE.Mesh(
    new THREE.BufferGeometry(),
    createMaterial(FILL_COLOR, FILL_OPACITY),
  );
  fill.name = 'fill';
  fill.renderOrder = 1;

  const edge = new THREE.Mesh(
    new THREE.BufferGeometry(),
    createMaterial(EDGE_COLOR, EDGE_OPACITY),
  );
  edge.name = 'edge';
  edge.renderOrder = 2;

  group.add(fill, edge);
  scene.add(group);

  return {
    group,
    edge,
    fill,
    type: null,
    geometryKey: null,
  };
}

function configureGeometry(slot, shape) {
  const measurements = measurementsFor(shape);
  const key = geometryKey(measurements);

  if (slot.type !== measurements.type) {
    slot.edge.geometry.dispose();
    slot.fill.geometry.dispose();

    slot.edge.geometry = new THREE.BufferGeometry();
    slot.fill.geometry = new THREE.BufferGeometry();
    slot.type = measurements.type;
    slot.geometryKey = null;
  }

  if (slot.geometryKey === key) return;

  const data = geometryDataFor(measurements);
  writeGeometry(slot.edge.geometry, data.edge);
  writeGeometry(slot.fill.geometry, data.fill);
  slot.geometryKey = key;
}

function clampProgress(progress) {
  const value = Number(progress);

  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function createTelegraphs(scene, heightAt) {
  const slots = Array.from(
    { length: MAX_TELEGRAPHS },
    (_, index) => createSlot(scene, index),
  );

  function clear() {
    for (const slot of slots) {
      slot.group.visible = false;
    }
  }

  function sync(attack, enraged) {
    if (!attack) {
      clear();
      return;
    }

    const shapes = Array.isArray(attack.shapes)
      ? attack.shapes
      : [];
    const impact = Boolean(attack.impact);
    const progress = impact
      ? 1
      : clampProgress(attack.progress);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const shape = shapes[i];

      if (
        !shape ||
        !SUPPORTED_TYPES.has(shape.type)
      ) {
        slot.group.visible = false;
        continue;
      }

      configureGeometry(slot, shape);

      const x = Number(shape.x) || 0;
      const z = Number(shape.z) || 0;
      const angle =
        shape.type === 'circle'
          ? 0
          : Number(shape.angle) || 0;

      slot.group.position.set(
        x,
        heightAt(x, z) + HEIGHT_OFFSET,
        z,
      );
      slot.group.rotation.set(0, angle, 0);

      slot.edge.material.color.set(
        enraged
          ? ENRAGED_EDGE_COLOR
          : EDGE_COLOR,
      );
      slot.edge.material.opacity = EDGE_OPACITY;

      slot.fill.material.opacity = impact
        ? IMPACT_OPACITY
        : FILL_OPACITY;
      slot.fill.scale.set(1, 1, 1);

      if (!impact) {
        if (shape.type === 'band') {
          slot.fill.scale.z = progress;
        } else {
          slot.fill.scale.x = progress;
          slot.fill.scale.z = progress;
        }
      }

      slot.edge.visible = true;
      slot.fill.visible = true;
      slot.group.visible = true;
    }
  }

  return { sync, clear };
}
