import * as THREE from 'three';

const DUST_RADIUS = 3;
const DUST_HEIGHT = 2;
const LIGHT_RADIUS = 20;
const TWO_PI = Math.PI * 2;

// Create soft circular particles without textures.
// Dust also uses a per-particle opacity attribute.
function makeRound(material, withFade) {
  material.onBeforeCompile = (shader) => {
    if (withFade) {
      shader.vertexShader = `
        attribute float aFade;
        varying float vParticleFade;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n vParticleFade = aFade;'
      );

      shader.fragmentShader =
        'varying float vParticleFade;\n' +
        shader.fragmentShader;
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_particle_fragment>',
      `
        #include <map_particle_fragment>

        vec2 centeredPoint = gl_PointCoord - vec2(0.5);
        float distanceSquared =
          dot(centeredPoint, centeredPoint);

        float softCircle =
          1.0 - smoothstep(0.16, 0.25, distanceSquared);

        diffuseColor.a *= softCircle${
          withFade ? ' * vParticleFade' : ''
        };
      `
    );
  };

  // Keep dust and light shader programs separate.
  material.customProgramCacheKey = () =>
    withFade
      ? 'obl-dust-round-fade-v1'
      : 'obl-light-round-v1';

  return material;
}

function makePositionAttribute(array) {
  return new THREE.BufferAttribute(
    array,
    3
  ).setUsage(THREE.DynamicDrawUsage);
}

// --------------------------------------------------
// Dust particles
// --------------------------------------------------

function makeDust(count, beastPos) {
  const positions = new Float32Array(count * 3);
  const fades = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TWO_PI;
    const radius =
      DUST_RADIUS * Math.sqrt(Math.random());

    const height = Math.random() * DUST_HEIGHT;
    const offset = i * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = height;
    positions[offset + 2] = Math.sin(angle) * radius;

    speeds[i] = 0.3 + Math.random() * 0.4;

    fades[i] =
      (1 - height / DUST_HEIGHT) ** 1.5;
  }

  const geometry = new THREE.BufferGeometry();

  const positionAttribute =
    makePositionAttribute(positions);

  const fadeAttribute = new THREE.BufferAttribute(
    fades,
    1
  ).setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute(
    'position',
    positionAttribute
  );

  geometry.setAttribute(
    'aFade',
    fadeAttribute
  );

  const material = makeRound(
    new THREE.PointsMaterial({
      color: '#c8a477',
      size: 0.25,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    true
  );

  const points = new THREE.Points(
    geometry,
    material
  );

  points.name = 'effects-dust';

  points.position.set(
    beastPos.x,
    0,
    beastPos.z
  );

  // Avoid stale geometry bounds during animation.
  points.frustumCulled = false;

  function update(dt) {
    // Follow the beast if beastPos is modified.
    points.position.x = beastPos.x;
    points.position.z = beastPos.z;

    if (dt <= 0) return;

    for (let i = 0; i < count; i++) {
      const yIndex = i * 3 + 1;

      // Rise from 0 to 2m and restart from below.
      const height = (
        positions[yIndex] + speeds[i] * dt
      ) % DUST_HEIGHT;

      positions[yIndex] = height;

      // Fade out as each particle rises.
      fades[i] =
        (1 - height / DUST_HEIGHT) ** 1.5;
    }

    positionAttribute.needsUpdate = true;
    fadeAttribute.needsUpdate = true;
  }

  return { points, update };
}

// --------------------------------------------------
// Floating light particles
// --------------------------------------------------

function makeLight(count) {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TWO_PI;

    const radius =
      LIGHT_RADIUS * Math.sqrt(Math.random());

    const offset = i * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = 0.5 + Math.random() * 3.5;
    positions[offset + 2] = Math.sin(angle) * radius;

    phases[i] = Math.random() * TWO_PI;
    speeds[i] = 0.3 + Math.random() * 0.4;
  }

  const geometry = new THREE.BufferGeometry();

  const positionAttribute =
    makePositionAttribute(positions);

  geometry.setAttribute(
    'position',
    positionAttribute
  );

  const material = makeRound(
    new THREE.PointsMaterial({
      color: '#ffe2a8',
      size: 0.18,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    false
  );

  const points = new THREE.Points(
    geometry,
    material
  );

  points.name = 'effects-light';
  points.frustumCulled = false;

  let initialized = false;

  function update(dt, time, center) {
    const centerX = center.x;
    const centerZ = center.z;

    // Place the initial particle distribution around
    // the first center supplied by the game.
    if (!initialized) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += centerX;
        positions[i + 2] += centerZ;
      }

      initialized = true;
    }

    for (let i = 0; i < count; i++) {
      const offset = i * 3;
      const phase = phases[i];

      // Gentle horizontal drifting.
      positions[offset] +=
        Math.sin(time * 0.55 + phase) *
        dt *
        0.12;

      positions[offset + 2] +=
        Math.cos(time * 0.45 + phase) *
        dt *
        0.12;

      // Vertical oscillation between 0.5m and 4m.
      positions[offset + 1] =
        2.25 +
        1.75 *
        Math.sin(time * speeds[i] + phase);

      const dx = positions[offset] - centerX;
      const dz = positions[offset + 2] - centerZ;

      const distanceSquared =
        dx * dx + dz * dz;

      // Wrap particles that leave the 20m radius.
      if (
        distanceSquared >
        LIGHT_RADIUS * LIGHT_RADIUS
      ) {
        const distance = Math.sqrt(distanceSquared);

        // Re-enter near the opposite edge.
        const insideRadius = LIGHT_RADIUS - 0.1;

        positions[offset] =
          centerX -
          (dx / distance) * insideRadius;

        positions[offset + 2] =
          centerZ -
          (dz / distance) * insideRadius;
      }
    }

    positionAttribute.needsUpdate = true;
  }

  return { points, update };
}

// --------------------------------------------------
// Public API
// --------------------------------------------------

/**
 * Add dust and floating light particles to the scene.
 *
 * @param {THREE.Scene} scene
 * @param {{ bloom?: boolean }} preset
 * @param {{ x: number, z: number }} beastPos
 * @returns {{
 *   update: (
 *     dt: number,
 *     time: number,
 *     center: THREE.Vector3 | {x:number,y:number,z:number}
 *   ) => void
 * }}
 */
export function createEffects(scene, preset, beastPos) {
  const lowQuality = preset?.bloom === false;

  const dust = makeDust(
    lowQuality ? 30 : 60,
    beastPos
  );

  const light = makeLight(
    lowQuality ? 75 : 150
  );

  scene.add(
    dust.points,
    light.points
  );

  return {
    update(dt, time, center) {
      const step = Number.isFinite(dt)
        ? Math.max(0, dt)
        : 0;

      const seconds = Number.isFinite(time)
        ? time
        : 0;

      dust.update(step);
      light.update(step, seconds, center);
    },
  };
}
