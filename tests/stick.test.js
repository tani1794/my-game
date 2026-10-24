import { test, expect, vi } from 'vitest';

import {
  stickVector,
  createStick,
} from '../src/ui/stick.js';

// --------------------------------------------------
// Required tests
// --------------------------------------------------

test('上いっぱいで z=1、半分で 0.5、外へ引っ張っても 1', () => {
  expect(stickVector(0, -50, 50)).toEqual({ x: 0, z: 1 });

  expect(stickVector(25, 0, 50).x).toBeCloseTo(0.5);

  expect(
    Math.hypot(...Object.values(stickVector(80, -80, 50)))
  ).toBeCloseTo(1);
});

test('デッドゾーン内は0', () => {
  expect(stickVector(5, 0, 50)).toEqual({ x: 0, z: 0 });
});

// --------------------------------------------------
// Additional vector tests
// --------------------------------------------------

test('上下左右の方向が正しい', () => {
  expect(stickVector(50, 0, 50)).toEqual({ x: 1, z: 0 });
  expect(stickVector(-50, 0, 50)).toEqual({ x: -1, z: 0 });
  expect(stickVector(0, -50, 50)).toEqual({ x: 0, z: 1 });
  expect(stickVector(0, 50, 50)).toEqual({ x: 0, z: -1 });
});

test('デッドゾーンを超えても値を引き直さない', () => {
  expect(stickVector(10, 0, 50)).toEqual({
    x: 0.2,
    z: 0,
  });

  expect(stickVector(25, 0, 50, 0.4)).toEqual({
    x: 0.5,
    z: 0,
  });
});

test('デッドゾーンの境界は0', () => {
  expect(stickVector(6, 0, 50)).toEqual({
    x: 0,
    z: 0,
  });
});

test('斜め入力でも長さは1を超えない', () => {
  const vector = stickVector(100, -100, 50);

  expect(Math.hypot(vector.x, vector.z)).toBeCloseTo(1);
  expect(vector.x).toBeGreaterThan(0);
  expect(vector.z).toBeGreaterThan(0);
});

test('半径0の場合は安全に0を返す', () => {
  expect(stickVector(100, -100, 0)).toEqual({
    x: 0,
    z: 0,
  });
});

test('-0を返さない', () => {
  const vector = stickVector(0, -50, 50);

  expect(vector).toEqual({ x: 0, z: 1 });
  expect(Object.is(vector.x, -0)).toBe(false);

  const horizontal = stickVector(50, 0, 50);

  expect(Object.is(horizontal.z, -0)).toBe(false);
});

// --------------------------------------------------
// Minimal DOM mock (no jsdom dependency)
// --------------------------------------------------

function createMockContainer() {
  const listeners = new Map();
  const capturedPointers = new Set();

  function createElement(tagName) {
    return {
      tagName,
      style: {},
      textContent: '',
      children: [],

      appendChild(child) {
        this.children.push(child);
        return child;
      },
    };
  }

  const container = createElement('div');

  container.ownerDocument = {
    createElement,
  };

  container.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 150,
    height: 150,
  });

  container.addEventListener = (type, handler) => {
    if (!listeners.has(type)) {
      listeners.set(type, []);
    }

    listeners.get(type).push(handler);
  };

  container.setPointerCapture = vi.fn((pointerId) => {
    capturedPointers.add(pointerId);
  });

  container.hasPointerCapture = (pointerId) => {
    return capturedPointers.has(pointerId);
  };

  container.releasePointerCapture = vi.fn((pointerId) => {
    capturedPointers.delete(pointerId);
  });

  container.fire = (type, properties = {}) => {
    const event = {
      pointerId: 1,
      clientX: 75,
      clientY: 75,
      preventDefault: vi.fn(),
      ...properties,
    };

    for (const handler of listeners.get(type) || []) {
      handler(event);
    }

    return event;
  };

  return container;
}

// --------------------------------------------------
// createStick tests
// --------------------------------------------------

test('スティックの見た目とタッチ設定を生成する', () => {
  const container = createMockContainer();

  createStick(container, vi.fn());

  expect(container.style.touchAction).toBe('none');
  expect(container.style.userSelect).toBe('none');
  expect(container.style.webkitTouchCallout).toBe('none');

  expect(container.children).toHaveLength(1);

  const root = container.children[0];

  // Base + four arrows + knob
  expect(root.children).toHaveLength(6);

  const base = root.children[0];
  const knob = root.children[5];

  expect(base.style.borderRadius).toBe('50%');
  expect(knob.style.width).toBe('60px');
  expect(knob.style.height).toBe('60px');

  expect(knob.style.transform).toBe(
    'translate(0px, 0px)'
  );

  const symbols = root.children
    .slice(1, 5)
    .map((element) => element.textContent);

  expect(symbols).toEqual(['▲', '▼', '◀', '▶']);
});

test('pointerdownで捕捉し、入力を通知する', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  createStick(container, onChange);

  const event = container.fire('pointerdown', {
    pointerId: 10,
    clientX: 75,
    clientY: 0,
  });

  expect(event.preventDefault).toHaveBeenCalled();

  expect(container.setPointerCapture).toHaveBeenCalledWith(10);

  expect(onChange).toHaveBeenLastCalledWith({
    x: 0,
    z: 1,
  });
});

test('最初の指だけを追跡し、2本目を無視する', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  createStick(container, onChange);

  container.fire('pointerdown', {
    pointerId: 1,
    clientX: 75,
    clientY: 0,
  });

  const secondTouch = container.fire('pointerdown', {
    pointerId: 2,
    clientX: 150,
    clientY: 75,
  });

  expect(secondTouch.preventDefault).not.toHaveBeenCalled();

  expect(container.setPointerCapture).toHaveBeenCalledTimes(1);

  container.fire('pointermove', {
    pointerId: 2,
    clientX: 0,
    clientY: 75,
  });

  expect(onChange).toHaveBeenCalledTimes(1);

  container.fire('pointermove', {
    pointerId: 1,
    clientX: 150,
    clientY: 75,
  });

  expect(onChange).toHaveBeenLastCalledWith({
    x: 1,
    z: 0,
  });
});

test('つまみはベース半径より遠くに移動しない', () => {
  const container = createMockContainer();

  createStick(container, vi.fn());

  container.fire('pointerdown', {
    pointerId: 1,
    clientX: 75,
    clientY: 75,
  });

  container.fire('pointermove', {
    pointerId: 1,
    clientX: 300,
    clientY: 75,
  });

  const root = container.children[0];
  const knob = root.children[5];

  // Base radius = 150 / 2 = 75
  expect(knob.style.transform).toBe(
    'translate(75px, 0px)'
  );
});

test('pointerupで中央に戻り、ゼロを通知する', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  createStick(container, onChange);

  container.fire('pointerdown', {
    pointerId: 1,
    clientX: 150,
    clientY: 75,
  });

  container.fire('pointerup', {
    pointerId: 1,
  });

  const knob = container.children[0].children[5];

  expect(knob.style.transform).toBe(
    'translate(0px, 0px)'
  );

  expect(onChange).toHaveBeenLastCalledWith({
    x: 0,
    z: 0,
  });

  expect(container.releasePointerCapture).toHaveBeenCalledWith(1);
});

test('pointercancelで入力がリセットされる', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  createStick(container, onChange);

  container.fire('pointerdown', {
    pointerId: 3,
    clientX: 150,
    clientY: 75,
  });

  container.fire('pointercancel', {
    pointerId: 3,
  });

  expect(onChange).toHaveBeenLastCalledWith({
    x: 0,
    z: 0,
  });
});

test('lostpointercaptureで入力がリセットされる', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  createStick(container, onChange);

  container.fire('pointerdown', {
    pointerId: 5,
    clientX: 75,
    clientY: 0,
  });

  container.fire('lostpointercapture', {
    pointerId: 5,
  });

  expect(onChange).toHaveBeenLastCalledWith({
    x: 0,
    z: 0,
  });
});

test('reset()は中央に戻し、ゼロを通知する', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  const stick = createStick(container, onChange);

  container.fire('pointerdown', {
    pointerId: 7,
    clientX: 150,
    clientY: 75,
  });

  stick.reset();

  const knob = container.children[0].children[5];

  expect(knob.style.transform).toBe(
    'translate(0px, 0px)'
  );

  expect(onChange).toHaveBeenLastCalledWith({
    x: 0,
    z: 0,
  });

  expect(container.releasePointerCapture).toHaveBeenCalledWith(7);
});

test('reset後は新しい指を受け付ける', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  const stick = createStick(container, onChange);

  container.fire('pointerdown', {
    pointerId: 1,
  });

  stick.reset();

  container.fire('pointerdown', {
    pointerId: 2,
    clientX: 150,
    clientY: 75,
  });

  expect(container.setPointerCapture).toHaveBeenCalledTimes(2);

  expect(onChange).toHaveBeenLastCalledWith({
    x: 1,
    z: 0,
  });
});

test('リセット後の古いpointerイベントを無視する', () => {
  const container = createMockContainer();
  const onChange = vi.fn();

  const stick = createStick(container, onChange);

  container.fire('pointerdown', {
    pointerId: 1,
  });

  stick.reset();

  onChange.mockClear();

  container.fire('pointermove', {
    pointerId: 1,
    clientX: 150,
    clientY: 75,
  });

  container.fire('lostpointercapture', {
    pointerId: 1,
  });

  expect(onChange).not.toHaveBeenCalled();
});

test('contextmenuを防止する', () => {
  const container = createMockContainer();

  createStick(container, vi.fn());

  const event = container.fire('contextmenu');

  expect(event.preventDefault).toHaveBeenCalled();
});
