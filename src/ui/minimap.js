/**
 * THE SILENT CROWN - Minimap
 * Dependencies: none
 *
 * World coordinates:
 *   +x = east
 *   -z = north
 *
 * Canvas coordinates:
 *   +u = right
 *   +v = down
 */

const TWO_PI = Math.PI * 2;
const WORLD_RADIUS = 28;
const WALKABLE_RADIUS = 24;
const DRAW_INTERVAL = 100; // 10 FPS

/**
 * Convert world coordinates to minimap coordinates.
 *
 * @param {number} x
 * @param {number} z
 * @param {number} size - Canvas size in CSS pixels
 * @param {number} worldRadius
 * @returns {{ u: number, v: number }}
 */
export function worldToMinimap(
  x,
  z,
  size,
  worldRadius = 28
) {
  const center = size / 2;
  const scale = center / worldRadius;

  return {
    u: center + x * scale,
    v: center + z * scale,
  };
}

/**
 * Convert world rotationY to a clockwise canvas angle.
 *
 * North (-z) = 0
 * East  (+x) = PI / 2
 * South (+z) = PI
 * West  (-x) = 3 * PI / 2
 *
 * @param {number} rotationY
 * @returns {number}
 */
export function headingToMinimapAngle(rotationY) {
  let angle = (Math.PI - rotationY) % TWO_PI;

  if (angle < 0) {
    angle += TWO_PI;
  }

  return angle === 0 ? 0 : angle;
}

/**
 * Create a circular minimap renderer.
 *
 * Drawing is throttled to at most 10 FPS.
 * All drawing coordinates use CSS pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ draw: Function }}
 */
export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Minimap: 2D canvas is unavailable.');
  }

  let lastDrawTime = -Infinity;

  /**
   * Synchronize backing resolution with CSS size and DPR.
   */
  function prepareCanvas() {
    const rect = canvas.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    if (width <= 0 || height <= 0) {
      return null;
    }

    const rawDpr = globalThis.devicePixelRatio || 1;
    const dpr = Number.isFinite(rawDpr) && rawDpr > 0
      ? rawDpr
      : 1;

    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    // Assigning width/height resets the canvas state.
    // Only resize when the backing resolution changes.
    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }

    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }

    return {
      width,
      height,
      size: Math.min(width, height),
      scaleX: canvas.width / width,
      scaleY: canvas.height / height,
    };
  }

  /**
   * Render the minimap.
   *
   * @param {{ x: number, z: number, rotationY: number }} player
   * @param {{ x: number, z: number }} beast
   */
  function draw(player, beast) {
    const now = (
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    )
      ? performance.now()
      : Date.now();

    // Never render more frequently than every 100 ms.
    if (now >= lastDrawTime && now - lastDrawTime < DRAW_INTERVAL) {
      return;
    }

    const dimensions = prepareCanvas();

    if (!dimensions) {
      return;
    }

    lastDrawTime = now;

    const {
      width,
      height,
      size,
      scaleX,
      scaleY,
    } = dimensions;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = size / 2;

    const offsetX = centerX - radius;
    const offsetY = centerY - radius;

    ctx.save();

    // Draw using CSS pixels, independent of physical DPR.
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    ctx.clearRect(0, 0, width, height);

    // --------------------------------------------------
    // Circular clipping
    // --------------------------------------------------

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TWO_PI);
    ctx.clip();

    // --------------------------------------------------
    // 1. Background
    // --------------------------------------------------

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TWO_PI);

    ctx.fillStyle = 'rgba(27, 37, 48, 0.8)';
    ctx.fill();

    // --------------------------------------------------
    // 2. Outer border
    // --------------------------------------------------

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      Math.max(0, radius - 0.75),
      0,
      TWO_PI
    );

    ctx.strokeStyle = '#c9a96a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --------------------------------------------------
    // 3. Walkable area boundary
    // --------------------------------------------------

    const walkablePixelRadius =
      (WALKABLE_RADIUS / WORLD_RADIUS) * radius;

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      walkablePixelRadius,
      0,
      TWO_PI
    );

    ctx.strokeStyle = 'rgba(138, 148, 158, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --------------------------------------------------
    // 4. North indicator
    // --------------------------------------------------

    ctx.fillStyle = '#e8e2d0';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(
      'N',
      centerX,
      centerY - radius + 15
    );

    // --------------------------------------------------
    // 5. Crystal beast marker
    // --------------------------------------------------

    const beastPosition = worldToMinimap(
      beast.x,
      beast.z,
      size,
      WORLD_RADIUS
    );

    const beastU = offsetX + beastPosition.u;
    const beastV = offsetY + beastPosition.v;

    ctx.save();
    ctx.translate(beastU, beastV);

    // Two short horns
    ctx.beginPath();

    ctx.moveTo(-3, -3);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-2, -7);

    ctx.moveTo(3, -3);
    ctx.lineTo(6, -9);
    ctx.lineTo(2, -7);

    ctx.strokeStyle = '#e5484d';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Beast body
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TWO_PI);

    ctx.fillStyle = '#e5484d';
    ctx.fill();

    ctx.restore();

    // --------------------------------------------------
    // 6. Player directional arrow
    // --------------------------------------------------

    const playerPosition = worldToMinimap(
      player.x,
      player.z,
      size,
      WORLD_RADIUS
    );

    const playerU = offsetX + playerPosition.u;
    const playerV = offsetY + playerPosition.v;

    const heading = headingToMinimapAngle(
      player.rotationY
    );

    ctx.save();

    ctx.translate(playerU, playerV);
    ctx.rotate(heading);

    // Triangle length: 12px, pointing upward by default.
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-6, 4);
    ctx.lineTo(6, 4);
    ctx.closePath();

    ctx.fillStyle = '#f5efe0';
    ctx.fill();

    ctx.restore();

    // Restore the original unclipped canvas state.
    ctx.restore();
  }

  return { draw };
}
