import { test, expect, vi } from 'vitest';

import {
  worldToMinimap,
  headingToMinimapAngle,
  createMinimap,
} from '../src/ui/minimap.js';

// --------------------------------------------------
// Required tests
// --------------------------------------------------

test('座標の変換', () => {
  expect(worldToMinimap(0, 0, 160)).toEqual({
    u: 80,
    v: 80,
  });

  expect(worldToMinimap(0, -28, 160)).toEqual({
    u: 80,
    v: 0,
  });

  expect(worldToMinimap(28, 0, 160)).toEqual({
    u: 160,
    v: 80,
  });
});

test('向き：-z を向いていれば上(0)、+x なら右(π/2)', () => {
  expect(
    headingToMinimapAngle(Math.PI)
  ).toBeCloseTo(0);

  expect(
    headingToMinimapAngle(Math.PI / 2)
  ).toBeCloseTo(Math.PI / 2);
});

// --------------------------------------------------
// Additional coordinate tests
// --------------------------------------------------

test('南と西の座標変換が正しい', () => {
  expect(worldToMinimap(0, 28, 160)).toEqual({
    u: 80,
    v: 160,
  });

  expect(worldToMinimap(-28, 0, 160)).toEqual({
    u: 0,
    v: 80,
  });
});

test('worldRadiusを変更できる', () => {
  expect(worldToMinimap(10, -10, 100, 20)).toEqual({
    u: 75,
    v: 25,
  });
});

test('ワールド座標の原点は常に中心', () => {
  expect(worldToMinimap(0, 0, 200)).toEqual({
    u: 100,
    v: 100,
  });
});

// --------------------------------------------------
// Heading tests
// --------------------------------------------------

test('南を向いているときはπ', () => {
  expect(
    headingToMinimapAngle(0)
  ).toBeCloseTo(Math.PI);
});

test('西を向いているときは3π/2', () => {
  expect(
    headingToMinimapAngle(-Math.PI / 2)
  ).toBeCloseTo(3 * Math.PI / 2);
});

test('回転角は0以上2π未満に正規化される', () => {
  const angles = [
    0,
    Math.PI,
    -Math.PI,
    Math.PI * 3,
    -Math.PI * 3,
    Math.PI / 2,
    -Math.PI / 2,
  ];

  for (const rotation of angles) {
    const angle = headingToMinimapAngle(rotation);

    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  }
});

test('北向きで-0を返さない', () => {
  const angle = headingToMinimapAngle(Math.PI);

  expect(Object.is(angle, -0)).toBe(false);
});

// --------------------------------------------------
// Minimal canvas mock
// No jsdom or additional libraries required.
// --------------------------------------------------

function createMockCanvas(width = 160, height = 160) {
  const methods = [
    'save',
    'restore',
    'setTransform',
    'clearRect',
    'beginPath',
    'arc',
    'clip',
    'fill',
    'stroke',
    'fillText',
    'moveTo',
    'lineTo',
    'closePath',
    'translate',
    'rotate',
  ];

  const ctx = {};

  for (const method of methods) {
    ctx[method] = vi.fn();
  }

  const canvas = {
    width: 300,
    height: 150,

    getContext: vi.fn(() => ctx),

    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
    })),
  };

  return { canvas, ctx };
}

const PLAYER = {
  x: 0,
  z: 0,
  rotationY: Math.PI,
};

const BEAST = {
  x: 10,
  z: -10,
};

// --------------------------------------------------
// Renderer tests
// --------------------------------------------------

test('2D canvas contextを取得する', () => {
  const { canvas } = createMockCanvas();

  const minimap = createMinimap(canvas);

  expect(canvas.getContext).toHaveBeenCalledWith('2d');
  expect(typeof minimap.draw).toBe('function');
});

test('2D contextがなければエラーを出す', () => {
  const { canvas } = createMockCanvas();

  canvas.getContext = vi.fn(() => null);

  expect(() => createMinimap(canvas)).toThrow(
    'Minimap: 2D canvas is unavailable.'
  );
});

test('Retina DPR=2で320x320の描画領域を作る', () => {
  vi.stubGlobal('devicePixelRatio', 2);

  try {
    const { canvas, ctx } = createMockCanvas(160, 160);

    const minimap = createMinimap(canvas);

    minimap.draw(PLAYER, BEAST);

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(320);

    expect(ctx.setTransform).toHaveBeenCalledWith(
      2, 0, 0, 2, 0, 0
    );
  } finally {
    vi.unstubAllGlobals();
  }
});

test('DPR=1でCSSピクセルと描画ピクセルが一致する', () => {
  vi.stubGlobal('devicePixelRatio', 1);

  try {
    const { canvas, ctx } = createMockCanvas(160, 160);

    const minimap = createMinimap(canvas);

    minimap.draw(PLAYER, BEAST);

    expect(canvas.width).toBe(160);
    expect(canvas.height).toBe(160);

    expect(ctx.setTransform).toHaveBeenCalledWith(
      1, 0, 0, 1, 0, 0
    );
  } finally {
    vi.unstubAllGlobals();
  }
});

test('円形のクリッピングが適用される', () => {
  const { canvas, ctx } = createMockCanvas();

  const minimap = createMinimap(canvas);

  minimap.draw(PLAYER, BEAST);

  expect(ctx.arc).toHaveBeenCalledWith(
    80,
    80,
    80,
    0,
    Math.PI * 2
  );

  expect(ctx.clip).toHaveBeenCalledTimes(1);
});

test('歩ける範囲はワールド半径24に対応する', () => {
  const { canvas, ctx } = createMockCanvas();

  const minimap = createMinimap(canvas);

  minimap.draw(PLAYER, BEAST);

  const expectedRadius = 80 * (24 / 28);

  expect(ctx.arc).toHaveBeenCalledWith(
    80,
    80,
    expectedRadius,
    0,
    Math.PI * 2
  );
});

test('北を示すNが描画される', () => {
  const { canvas, ctx } = createMockCanvas();

  const minimap = createMinimap(canvas);

  minimap.draw(PLAYER, BEAST);

  expect(ctx.fillText).toHaveBeenCalledWith(
    'N',
    80,
    15
  );
});

test('結晶獣は赤い半径5pxの円で描かれる', () => {
  const { canvas, ctx } = createMockCanvas();

  const minimap = createMinimap(canvas);

  minimap.draw(PLAYER, BEAST);

  expect(ctx.arc).toHaveBeenCalledWith(
    0,
    0,
    5,
    0,
    Math.PI * 2
  );
});

test('プレイヤーの矢印は指定された向きに回転する', () => {
  const { canvas, ctx } = createMockCanvas();

  const minimap = createMinimap(canvas);

  minimap.draw(
    {
      x: 0,
      z: 0,
      rotationY: Math.PI / 2,
    },
    BEAST
  );

  expect(ctx.rotate).toHaveBeenCalledWith(
    Math.PI / 2
  );

  expect(ctx.moveTo).toHaveBeenCalledWith(0, -8);
  expect(ctx.closePath).toHaveBeenCalled();
});

test('プレイヤーと獣の座標を正しく描画する', () => {
  const { canvas, ctx } = createMockCanvas();

  const minimap = createMinimap(canvas);

  minimap.draw(
    {
      x: 14,
      z: -14,
      rotationY: Math.PI,
    },
    {
      x: -14,
      z: 14,
    }
  );

  // Beast: (-14, +14) -> (40, 120)
  expect(ctx.translate).toHaveBeenCalledWith(40, 120);

  // Player: (+14, -14) -> (120, 40)
  expect(ctx.translate).toHaveBeenCalledWith(120, 40);
});

test('100ms未満の連続描画をスキップする', () => {
  let currentTime = 0;

  vi.stubGlobal('performance', {
    now: () => currentTime,
  });

  try {
    const { canvas, ctx } = createMockCanvas();

    const minimap = createMinimap(canvas);

    // First draw: allowed
    minimap.draw(PLAYER, BEAST);

    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    // 50ms: skipped
    currentTime = 50;

    minimap.draw(PLAYER, BEAST);

    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    // 99ms: skipped
    currentTime = 99;

    minimap.draw(PLAYER, BEAST);

    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    // 100ms: allowed
    currentTime = 100;

    minimap.draw(PLAYER, BEAST);

    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    // 150ms: skipped
    currentTime = 150;

    minimap.draw(PLAYER, BEAST);

    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    // 200ms: allowed
    currentTime = 200;

    minimap.draw(PLAYER, BEAST);

    expect(ctx.clearRect).toHaveBeenCalledTimes(3);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('表示サイズが0の場合は描画しない', () => {
  const { canvas, ctx } = createMockCanvas(0, 0);

  const minimap = createMinimap(canvas);

  minimap.draw(PLAYER, BEAST);

  expect(ctx.clearRect).not.toHaveBeenCalled();
  expect(ctx.arc).not.toHaveBeenCalled();
});

test('長方形canvasでも中心を正しく配置する', () => {
  const { canvas, ctx } = createMockCanvas(200, 160);

  const minimap = createMinimap(canvas);

  minimap.draw(PLAYER, BEAST);

  // Minimap circle center = (100, 80)
  expect(ctx.arc).toHaveBeenCalledWith(
    100,
    80,
    80,
    0,
    Math.PI * 2
  );

  expect(ctx.translate).toHaveBeenCalledWith(
    100,
    80
  );
});
