export const QUALITY_PRESETS = {
  high: { pixelRatio: 2, grass: 6000, shadows: true, shadowMapSize: 2048, bloom: true },
  mid: { pixelRatio: 1.5, grass: 3000, shadows: true, shadowMapSize: 1024, bloom: true },
  low: { pixelRatio: 1, grass: 800, shadows: false, shadowMapSize: 0, bloom: false },
};

const TIERS = ['high', 'mid', 'low'];

// ?q=high|mid|low で画質を固定、?debug で fps を表示
export function resolveQuality(search) {
  const params = new URLSearchParams(search);
  const requested = params.get('q');
  const locked = TIERS.includes(requested);

  return {
    tier: locked ? requested : 'mid',
    locked,
    debug: params.has('debug'),
  };
}

// 平均 fps が minFps を下回ったら一段下げた画質を返す。それ以外は null
export function createAutoDowngrade(tier, { warmup = 1, window = 3, minFps = 45 } = {}) {
  let warmupLeft = warmup;
  let sampleTime = 0;
  let frames = 0;

  function reset() {
    warmupLeft = warmup;
    sampleTime = 0;
    frames = 0;
  }

  function update(dt) {
    // 裏に回っていた間などの長いフレームは計測しない
    if (dt > 0.25 || tier === 'low') return null;

    if (warmupLeft > 0) {
      warmupLeft -= dt;
      return null;
    }

    sampleTime += dt;
    frames += 1;
    if (sampleTime < window) return null;

    const fps = frames / sampleTime;
    reset();
    if (fps >= minFps) return null;

    tier = TIERS[TIERS.indexOf(tier) + 1];
    return tier;
  }

  return { update, reset };
}
