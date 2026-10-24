/**
 * ECHO HUNT - Virtual Analog Stick
 * Dependencies: none
 */

/**
 * Convert pointer displacement to a normalized movement vector.
 *
 * dx: positive to the right
 * dy: positive downward
 * z: positive forward (upward on screen)
 */
export function stickVector(dx, dy, radius, deadZone = 0.12) {
  if (!(radius > 0)) {
    return { x: 0, z: 0 };
  }

  let x = dx / radius;
  let z = -dy / radius;

  const length = Math.hypot(x, z);

  // Do not rescale values outside the dead zone.
  if (length <= deadZone) {
    return { x: 0, z: 0 };
  }

  // Clamp magnitude to 1 while preserving direction.
  if (length > 1) {
    x /= length;
    z /= length;
  }

  // Normalize -0 to +0.
  return {
    x: x === 0 ? 0 : x,
    z: z === 0 ? 0 : z,
  };
}

/**
 * Create a virtual analog stick inside a container.
 *
 * @param {HTMLElement} container
 * @param {Function} onChange
 * @returns {{ reset: Function }}
 */
export function createStick(container, onChange) {
  const doc = container.ownerDocument;

  let activePointerId = null;

  // --------------------------------------------------
  // Container settings
  // --------------------------------------------------

  container.style.touchAction = 'none';
  container.style.userSelect = 'none';
  container.style.webkitUserSelect = 'none';
  container.style.webkitTouchCallout = 'none';

  // --------------------------------------------------
  // Root
  // --------------------------------------------------

  const root = doc.createElement('div');

  Object.assign(root.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  });

  // --------------------------------------------------
  // Base
  // --------------------------------------------------

  const base = doc.createElement('div');

  Object.assign(base.style, {
    position: 'absolute',
    inset: '0',
    boxSizing: 'border-box',
    borderRadius: '50%',
    backgroundColor: 'rgba(27, 37, 48, 0.65)',
    border: '1px solid rgba(201, 169, 106, 0.6)',
  });

  root.appendChild(base);

  // --------------------------------------------------
  // Direction arrows
  // --------------------------------------------------

  const arrows = [
    { symbol: '▲', left: '50%', top: '14%' },
    { symbol: '▼', left: '50%', top: '86%' },
    { symbol: '◀', left: '14%', top: '50%' },
    { symbol: '▶', left: '86%', top: '50%' },
  ];

  for (const arrowConfig of arrows) {
    const arrow = doc.createElement('div');

    arrow.textContent = arrowConfig.symbol;

    Object.assign(arrow.style, {
      position: 'absolute',
      left: arrowConfig.left,
      top: arrowConfig.top,
      transform: 'translate(-50%, -50%)',
      color: '#e8e2d0',
      opacity: '0.7',
      fontSize: '12px',
      lineHeight: '1',
      fontWeight: 'bold',
      pointerEvents: 'none',
      userSelect: 'none',
    });

    root.appendChild(arrow);
  }

  // --------------------------------------------------
  // Knob
  // --------------------------------------------------

  const knob = doc.createElement('div');

  Object.assign(knob.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '60px',
    height: '60px',
    marginLeft: '-30px',
    marginTop: '-30px',
    boxSizing: 'border-box',
    borderRadius: '50%',
    backgroundColor: 'rgba(232, 226, 208, 0.85)',
    border: '1px solid #c9a96a',
    transform: 'translate(0px, 0px)',
    pointerEvents: 'none',
    willChange: 'transform',
  });

  root.appendChild(knob);
  container.appendChild(root);

  // --------------------------------------------------
  // Pointer movement
  // --------------------------------------------------

  function updatePointer(event) {
    const rect = container.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const radius = Math.min(rect.width, rect.height) / 2;

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;

    // Clamp the knob's center to the base radius.
    const distance = Math.hypot(dx, dy);

    let knobX = 0;
    let knobY = 0;

    if (radius > 0 && distance > 0) {
      const scale = Math.min(1, radius / distance);

      knobX = dx * scale;
      knobY = dy * scale;
    }

    knob.style.transform =
      `translate(${knobX}px, ${knobY}px)`;

    onChange(stickVector(dx, dy, radius));
  }

  // --------------------------------------------------
  // Reset
  // --------------------------------------------------

  function reset() {
    const pointerId = activePointerId;

    // Clear ownership before releasing capture.
    // This prevents duplicate resets from lostpointercapture.
    activePointerId = null;

    knob.style.transform = 'translate(0px, 0px)';

    if (
      pointerId !== null &&
      container.hasPointerCapture(pointerId)
    ) {
      container.releasePointerCapture(pointerId);
    }

    onChange({ x: 0, z: 0 });
  }

  // --------------------------------------------------
  // Pointer events
  // --------------------------------------------------

  container.addEventListener('pointerdown', (event) => {
    // Only the first active pointer controls the stick.
    if (activePointerId !== null) {
      return;
    }

    activePointerId = event.pointerId;

    event.preventDefault();

    container.setPointerCapture(event.pointerId);

    updatePointer(event);
  });

  container.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();

    updatePointer(event);
  });

  function endPointer(event) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    reset();
  }

  container.addEventListener('pointerup', endPointer);
  container.addEventListener('pointercancel', endPointer);
  container.addEventListener('lostpointercapture', endPointer);

  // Prevent long-press context menus.
  container.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  return { reset };
}
