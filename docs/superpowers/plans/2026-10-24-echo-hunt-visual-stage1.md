# ECHO HUNT 第1段階：ビジュアル再現 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コンセプト画像の構図と雰囲気を、iPhone 14 の Safari で歩き回れる 3D シーンとして再現する（戦闘なし）。

**Architecture:** 既存の `src/main.js`（移動テスト）を役割ごとのモジュールに分割し、そこへ地形・廃墟・植生・結晶獣・遠景・演出・UI を順に足していく。計算だけの部分は three.js や DOM に依存しない純粋関数として切り出し、Vitest でテストする。見た目はブラウザと iPhone 14 の実機で確認する。

**Tech Stack:** Vite 8.3、three.js 0.186（GLTFLoader、meshopt デコーダー、EffectComposer、UnrealBloomPass）、Vitest 5、@gltf-transform/cli 4、@fontsource/cinzel、Artlist（結晶獣の 3D 生成と遠景の画像生成）

**Spec:** `docs/superpowers/specs/2026-10-24-echo-hunt-visual-stage1-design.md`

## Global Constraints

- 対象：iPhone 14（無印）の Safari、横向き専用。性能目標は画質「中」で 60fps、最低 30fps
- 予算 0 円。Artlist は無料トライアルのみ。結晶獣の生成（無料枠1回）を遠景より優先する。**Artlist へアップロードや生成をする前に、必ずユーザーに確認する**
- 素材は CC0 のみ（フォントは OFL の Cinzel）。入手元とライセンスを `ASSETS.md` に1行ずつ記録する。CC0 であることを確認できない素材は使わない
- 結晶獣：三角形 2〜3万枚。画像は最大 2048px、主人公と小物は 1024px。圧縮は meshopt と WebP。ダウンロード量は合計 15MB 以内
- 速さ：歩き 3 m/s（スティックの倒し量 0〜1 を掛ける）、走り 6 m/s
- 移動範囲：既存の `|x| ≤ 28`、`|z| ≤ 28`。当たり判定は「円と点の距離」方式で、プレイヤー半径は 0.4
- UI の文言は日本語。「ビジュアル案｜未実装」は表示しない
- 戦闘・HP の増減・クエストの進行・滝・舞う葉は作らない

## Review Focus

1. **素材の読み込み失敗**（404、通信切れ、壊れた GLB）：画面が真っ黒にならず、代わりの見た目（カプセルの主人公、コードで作る獣、グラデーションの空）で起動する → Task 1 の `withFallback` のテスト
2. **アプリの切り替えやタブが裏に回った後の復帰**：押しっぱなしの入力が残らない。裏にいた間の長いフレームで画質が下がらない → Task 2 と Task 3 のテスト
3. **複数の指での同時操作**（スティック、走る、カメラのドラッグ）：指を要素の外で離しても、入力が残らない → Task 3 のテスト
4. **画面の回転やアドレスバーの出入りによるサイズ変更**：描画とUIが新しいサイズに追従する → Task 14 の実機チェック項目
5. **iOS で WebGL のコンテキストが失われたとき**（メモリ不足）：固まらず「再読み込みしてください」と表示する → Task 2 の実機チェック項目

---

## ファイル構成

| ファイル | 役割 | 作成するタスク |
|---|---|---|
| `src/main.js` | 起動、ゲームループ、各モジュールの接続 | 1（以降で追記） |
| `src/assets.js` | `loadGLTF`、`withFallback` | 1 |
| `src/input.js` | キーボード・スティック・ボタンの入力を統合 | 1、3 |
| `src/player.js` | 移動の計算（純粋関数）と主人公の表示 | 1、10 |
| `src/camera.js` | 追従カメラとドラッグ操作 | 1 |
| `src/quality.js` | 画質の決定と自動での段階下げ | 2 |
| `src/world/terrain.js` | 地面、石畳、崖、`heightAt`、当たり判定 | 1、7 |
| `src/world/lighting.js` | 光、霧、トーンマッピング、影 | 1、6 |
| `src/world/post.js` | ブルーム | 6 |
| `src/world/ruins.js` | アーチと旗 | 8 |
| `src/world/vegetation.js` | 木、岩、草 | 9 |
| `src/world/beast.js` | 結晶獣 | 11 |
| `src/world/backdrop.js` | 遠景 | 12 |
| `src/world/effects.js` | 土ぼこり、光の粒 | 13 |
| `src/world/random.js` | 再現性のある乱数 `mulberry32(seed)` | 7 |
| `src/ui/hud.js`、`src/ui/hud.css` | HUD、ボタン、fps表示、縦向き時の案内 | 4 |
| `src/ui/stick.js` | アナログスティック | 3 |
| `src/ui/minimap.js` | ミニマップ | 5 |
| `scripts/optimize-assets.mjs`、`assets-src/manifest.json` | 素材の軽量化 | 9 |
| `ASSETS.md` | 素材の入手元とライセンス | 4 |
| `tests/*.test.js` | 単体テスト | 各タスク |

**座標の取り決め**（全タスク共通）：地面は y=0 付近。カメラの初期 `yaw = 0` で、カメラは +z 側から −z 方向を見る。北は −z。主人公の初期位置は `(0, 6)`、結晶獣は `(0, -6)`、アーチ2つは `(-5, -14)` と `(5, -14)`、旗は `(-9, 4)` と `(-7, 6)`。太陽は左奥 `(-30, 25, -40)` から原点を照らす。

---

### Task 1: テスト環境と、main.js のモジュール分割（見た目と動きは変えない）

**Files:**
- Modify: `package.json`（`"test": "vitest run"` を追加。devDependencies に `vitest@^5.0.5`）
- Modify: `src/main.js`（各モジュールの呼び出しだけにする）
- Create: `src/assets.js`、`src/input.js`、`src/player.js`、`src/camera.js`、`src/world/terrain.js`、`src/world/lighting.js`
- Test: `tests/player.test.js`、`tests/assets.test.js`

**Interfaces:**
- Produces:
  - `type Collider = { x: number, z: number, radius: number }`
  - `player.js`：`moveToWorld(moveX: number, moveZ: number, yaw: number) -> { x, z }`（既存の式。moveZ が正なら前進）
  - `player.js`：`speedFor({ moveX, moveZ, run }) -> number`（走りは 6、それ以外は 3 × min(1, 倒し量)）
  - `player.js`：`stepPosition(pos: {x,z}, dir: {x,z}, distance: number, colliders: Collider[], bound = 28) -> {x,z}`（x と z を別々に判定して、壁沿いに滑る既存の挙動）
  - `player.js`：`createPlayer(scene) -> { object: THREE.Group, update(dt, input, yaw, colliders, heightAt) }`
  - `camera.js`：`createFollowCamera(canvas) -> { camera, yaw(): number, update(target: THREE.Vector3), resize(w, h), clear() }`
  - `input.js`：`createInput() -> { read(): { moveX, moveZ, run }, bindButton(el, action), clear() }`（この時点では既存の十字ボタンとキーボード）
  - `terrain.js`：`createTerrain(scene) -> { colliders: Collider[], heightAt(x, z): number }`（この時点では平らで、既存の岩18個）
  - `lighting.js`：`createLighting(scene, renderer) -> { update(playerPos), setQuality(preset) }`（この時点では既存の2つの光）
  - `assets.js`：`withFallback(promise, fallback: () => T) -> Promise<T>`（失敗したら `console.warn` を出し、`fallback()` の結果を返す）
  - `assets.js`：`loadGLTF(url) -> Promise<GLTF>`（GLTFLoader に `MeshoptDecoder` を設定）

- [ ] **Step 1:** `npm i -D vitest@^5.0.5` を実行し、`package.json` に `"test": "vitest run"` を追加する
- [ ] **Step 2: 失敗するテストを書く**

```js
// tests/player.test.js
import { moveToWorld, speedFor, stepPosition } from '../src/player.js';
test('yaw 0 で前進すると -z へ進む', () => {
  const d = moveToWorld(0, 1, 0);
  expect(d.x).toBeCloseTo(0); expect(d.z).toBeCloseTo(-1);
});
test('速さ：走りは6、スティック半分は1.5、倒し量は1で頭打ち', () => {
  expect(speedFor({ moveX: 0, moveZ: 1, run: true })).toBe(6);
  expect(speedFor({ moveX: 0, moveZ: 0.5, run: false })).toBeCloseTo(1.5);
  expect(speedFor({ moveX: 1, moveZ: 1, run: false })).toBeCloseTo(3);
});
test('岩に正面からぶつかると止まり、斜めなら壁沿いに滑る', () => {
  const rock = [{ x: 0, z: -1, radius: 0.5 }];
  expect(stepPosition({ x: 0, z: 0 }, { x: 0, z: -1 }, 0.2, rock)).toEqual({ x: 0, z: 0 });
  const slid = stepPosition({ x: 0, z: 0 }, { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, 0.2, rock);
  expect(slid.x).toBeGreaterThan(0); expect(slid.z).toBe(0);
});
test('移動範囲 28 の外には出ない', () => {
  expect(stepPosition({ x: 27.9, z: 0 }, { x: 1, z: 0 }, 1, []).x).toBe(27.9);
});
```

```js
// tests/assets.test.js
import { withFallback } from '../src/assets.js';
test('読み込みに失敗したら代わりを返す', async () => {
  await expect(withFallback(Promise.reject(new Error('404')), () => 'fb')).resolves.toBe('fb');
});
test('成功したらそのまま返す', async () => {
  await expect(withFallback(Promise.resolve('ok'), () => 'fb')).resolves.toBe('ok');
});
```

- [ ] **Step 3:** `npm test` を実行し、モジュールが見つからずに FAIL することを確認する
- [ ] **Step 4:** 上の Interfaces どおりにファイルを分ける。中身は今の `main.js` から移すだけで、挙動は変えない。HTML と CSS は Task 4 まで `main.js` に残す
- [ ] **Step 5:** `npm test` を実行し、全テストが PASS することを確認する
- [ ] **Step 6:** `npm run dev` を実行し、ブラウザで今までどおり歩けて、カメラを回せて、岩に当たることを確認する
- [ ] **Step 7: コミット** `git commit -m "refactor: split movement test into modules"`

### Task 2: 画質の3段階と自動での段階下げ

**Files:**
- Create: `src/quality.js`
- Modify: `src/main.js`
- Test: `tests/quality.test.js`

**Interfaces:**
- Produces:
  - `QUALITY_PRESETS`：

    | 段階 | pixelRatio | grass | shadows | shadowMapSize | bloom |
    |---|---|---|---|---|---|
    | `high` | 2 | 6000 | true | 2048 | true |
    | `mid` | 1.5 | 3000 | true | 1024 | true |
    | `low` | 1 | 800 | false | 0 | false |

  - `resolveQuality(search: string) -> { tier: 'high'|'mid'|'low', locked: boolean, debug: boolean }`：`?q=` が正しい値なら `locked: true`。それ以外は `mid` で `locked: false`。`?debug` があれば `debug: true`
  - `createAutoDowngrade(tier, { warmup = 1, window = 3, minFps = 45 }) -> { update(dt): tier | null, reset() }`：最初の `warmup` 秒は計測しない。続く `window` 秒の平均 fps が `minFps` 未満なら、一段下げた tier を返して計測をやり直す。`low` より下には下げない。`dt > 0.25` のフレームは無視する。`reset()` は計測を最初からやり直す
  - `main.js`：`applyQuality(preset)` でレンダラーの pixelRatio（`min(devicePixelRatio, preset.pixelRatio)`）を変え、`lighting.setQuality`、後のタスクの `post.setQuality` と `vegetation.setGrassCount` に伝える。`visibilitychange` で `reset()` を呼ぶ。`locked` のときは自動での段階下げを使わない

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/quality.test.js
import { resolveQuality, createAutoDowngrade } from '../src/quality.js';
const run = (ad, fps, seconds) => { let r = null; for (let t = 0; t < seconds; t += 1 / fps) r = ad.update(1 / fps) ?? r; return r; };
test('URL指定', () => {
  expect(resolveQuality('?q=high')).toEqual({ tier: 'high', locked: true, debug: false });
  expect(resolveQuality('?q=ultra&debug')).toEqual({ tier: 'mid', locked: false, debug: true });
  expect(resolveQuality('')).toEqual({ tier: 'mid', locked: false, debug: false });
});
test('30fpsが続けば mid→low、60fpsなら下げない', () => {
  expect(run(createAutoDowngrade('mid'), 30, 5)).toBe('low');
  expect(run(createAutoDowngrade('mid'), 60, 5)).toBeNull();
});
test('low より下には下げない', () => {
  expect(run(createAutoDowngrade('low'), 20, 10)).toBeNull();
});
test('裏に回った後の長いフレームは無視する', () => {
  const ad = createAutoDowngrade('mid');
  run(ad, 60, 2); ad.update(5); ad.update(3);
  expect(run(ad, 60, 3)).toBeNull();
});
```

- [ ] **Step 2:** `npm test` を実行し、FAIL することを確認する
- [ ] **Step 3:** `src/quality.js` を実装し、`main.js` に組み込む。`debug` のときは左下に小さく fps を表示する。表示は仮の要素でよく、Task 4 で HUD に移す。WebGL のコンテキストが失われたとき（`webglcontextlost`）は、画面中央に「再読み込みしてください」と表示する
- [ ] **Step 4:** `npm test` を実行し、PASS することを確認する
- [ ] **Step 5:** `?debug` を付けて開き、fps が表示されることを確認する。`?q=low` を付けると画面が粗くなることも確認する
- [ ] **Step 6: コミット** `git commit -m "feat: add quality tiers with auto downgrade"`

### Task 3: アナログスティックと入力の統合

**Files:**
- Create: `src/ui/stick.js`
- Modify: `src/input.js`、`src/main.js`（十字ボタンを削除し、スティックを置く）
- Test: `tests/stick.test.js`、`tests/input.test.js`

**Interfaces:**
- Produces:
  - `stick.js`：`stickVector(dx, dy, radius, deadZone = 0.12) -> { x, z }`（dx は右が正、dy は画面の下が正。z は上に倒すと正。長さは1で頭打ち。デッドゾーン以下なら `{0, 0}`。デッドゾーンを超えた値は引き直さず、そのまま `dx / radius` などを使う）
  - `stick.js`：`createStick(container: HTMLElement, onChange: ({x, z}) => void) -> { reset() }`（最初に触れた1本の指だけを追う。pointerup、pointercancel、lostpointercapture で `{0, 0}` を通知する）
  - `input.js`：`combineMove(keyboard: {x,z}, stick: {x,z}) -> { x, z }`（足して長さを1で頭打ち）
  - `input.js`：`createInput()` に `setStick({x, z})` を追加する。`read()` は `{ moveX, moveZ, run }` を返す。`clear()` はスティックの入力も0にする

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/stick.test.js
import { stickVector } from '../src/ui/stick.js';
test('上いっぱいで z=1、半分で 0.5、外へ引っ張っても 1', () => {
  expect(stickVector(0, -50, 50)).toEqual({ x: 0, z: 1 });
  expect(stickVector(25, 0, 50).x).toBeCloseTo(0.5);
  expect(Math.hypot(...Object.values(stickVector(80, -80, 50)))).toBeCloseTo(1);
});
test('デッドゾーン内は0', () => {
  expect(stickVector(5, 0, 50)).toEqual({ x: 0, z: 0 });
});
```

```js
// tests/input.test.js
import { combineMove, createInput } from '../src/input.js';
test('キーボードとスティックを足すと、長さは1で頭打ち', () => {
  const m = combineMove({ x: 1, z: 0 }, { x: 0, z: 1 });
  expect(Math.hypot(m.x, m.z)).toBeCloseTo(1);
});
test('clear() でスティックの入力も消える', () => {
  const input = createInput();
  input.setStick({ x: 0, z: 1 }); input.clear();
  expect(input.read()).toMatchObject({ moveX: 0, moveZ: 0, run: false });
});
```

（`createInput` が `window` に触れるため、`tests/input.test.js` の先頭に `// @vitest-environment happy-dom` を書く。`npm i -D happy-dom` を実行する）

- [ ] **Step 2:** `npm test` を実行し、FAIL することを確認する
- [ ] **Step 3:** 実装する。スティックの見た目は、直径 150px の円の中に、直径 60px のつまみを置く。左下の安全領域の内側に配置する
- [ ] **Step 4:** `npm test` を実行し、PASS することを確認する
- [ ] **Step 5:** iPhone で、スティックを少しだけ倒すとゆっくり歩くことを確認する。スティック・走る・カメラのドラッグを同時に操作できること、スティックを触った指を外で離すと止まることも確認する
- [ ] **Step 6: コミット** `git commit -m "feat: replace d-pad with analog stick"`

### Task 4: HUD、縦向きの案内、ホーム画面への追加

**Files:**
- Create: `src/ui/hud.js`、`src/ui/hud.css`、`public/manifest.webmanifest`、`public/textures/portrait.png`、`public/apple-touch-icon.png`、`ASSETS.md`
- Modify: `index.html`、`src/main.js`（HTML と CSS の文字列を削除して `createHud` を使う。左上の操作説明の枠 `#info` は作り直さない）、`package.json`（`@fontsource/cinzel` を追加）

**Interfaces:**
- Consumes: `input.bindButton(el, 'run')`（Task 1）、`createStick`（Task 3）
- Produces: `createHud(root) -> { stickArea: HTMLElement, runButton, actionButtons: { attack, dodge, lock }, minimapCanvas: HTMLCanvasElement, setFps(fps: number | null) }`

- [ ] **Step 1:** 素材を作る
  - 顔アイコン：`assets-src/concept/echo-hunt-concept.png` から、x 25〜140、y 20〜135 を切り出し、256×256 の `public/textures/portrait.png` にする
  - ホーム画面のアイコン：同じ画像を 180×180 にした `public/apple-touch-icon.png`
  - フォント：`npm i @fontsource/cinzel` を実行し、`hud.js` で `@fontsource/cinzel/600.css` を読み込む
- [ ] **Step 2:** 配置は設計書7章の表どおりにする。見た目の値は次のとおり

  | 項目 | 値 |
  |---|---|
  | 板の背景 | `#1b2530cc` |
  | 縁取り | `1px #c9a96a` |
  | 角の切り落とし | `clip-path` で 8px |
  | HP バー | `#4caf50` |
  | スタミナバー | `#e0b23a` |
  | 攻撃ボタン | 直径 110px |
  | 回避・ロックボタン | 直径 84px |
  | 走るボタン | 直径 72px |

  アイコンは SVG を直接書く。押したときは `.active` で少し縮めて明るくする。英字は Cinzel、日本語は `system-ui`。すべての要素の位置に `env(safe-area-inset-*)` を足す
- [ ] **Step 3:** 縦向きのときは `@media (orientation: portrait)` で全面を覆い、「横向きにしてください」と表示する
- [ ] **Step 4:** `index.html` を変更する
  - `lang="ja"`、`<title>ECHO HUNT</title>`
  - viewport に `viewport-fit=cover` を追加
  - `apple-mobile-web-app-capable` を `yes`、`apple-mobile-web-app-status-bar-style` を `black-translucent`
  - manifest と apple-touch-icon へのリンク

  manifest の内容は `name: "ECHO HUNT"`、`display: "fullscreen"`、`orientation: "landscape"`、`background_color: "#101b26"`
- [ ] **Step 5:** `ASSETS.md` を作る。表の列は「素材 | 入手元URL | ライセンス | 使用ファイル」。Cinzel（OFL）と顔アイコン（自作のコンセプト画像）を記録する
- [ ] **Step 6:** `npm test` を実行し、既存のテストが PASS することを確認する。iPhone で開き、UI がノッチやホームバーに重ならないこと、縦向きで案内が出ること、ホーム画面に追加すると全画面で起動することを確認する
- [ ] **Step 7: コミット** `git commit -m "feat: add HUD matching concept layout"`

### Task 5: ミニマップ

**Files:**
- Create: `src/ui/minimap.js`
- Modify: `src/main.js`
- Test: `tests/minimap.test.js`

**Interfaces:**
- Consumes: `hud.minimapCanvas`（Task 4）
- Produces:
  - `worldToMinimap(x, z, size, worldRadius = 28) -> { u, v }`（中心が原点。北の −z が上）
  - `headingToMinimapAngle(rotationY) -> number`（キャンバスの回転角。上向きが 0、時計回りが正）
  - `createMinimap(canvas) -> { draw(player: {x, z, rotationY}, beast: {x, z}) }`

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/minimap.test.js
import { worldToMinimap, headingToMinimapAngle } from '../src/ui/minimap.js';
test('座標の変換', () => {
  expect(worldToMinimap(0, 0, 160)).toEqual({ u: 80, v: 80 });
  expect(worldToMinimap(0, -28, 160)).toEqual({ u: 80, v: 0 });
  expect(worldToMinimap(28, 0, 160)).toEqual({ u: 160, v: 80 });
});
test('向き：-z を向いていれば上(0)、+x なら右(π/2)', () => {
  expect(headingToMinimapAngle(Math.PI)).toBeCloseTo(0);
  expect(headingToMinimapAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
});
```

- [ ] **Step 2:** `npm test` を実行し、FAIL することを確認する
- [ ] **Step 3:** 実装する。描くのは、暗い円形の背景、歩ける範囲の輪郭（灰色）、上端の「N」、赤い獣のマーク、白っぽい矢印。描画は毎フレームではなく 10 回/秒にする
- [ ] **Step 4:** `npm test` を実行し、PASS することを確認する。画面で歩くと矢印が動いて回ることを確認する
- [ ] **Step 5: コミット** `git commit -m "feat: add working minimap"`

### Task 6: 夕方の光、霧、影、ブルーム

**Files:**
- Modify: `src/world/lighting.js`、`src/main.js`
- Create: `src/world/post.js`

**Interfaces:**
- Consumes: `QUALITY_PRESETS`（Task 2）
- Produces: `createPost(renderer, scene, camera, preset) -> { render(), setSize(w, h), setQuality(preset) }`（bloom が false なら `renderer.render` を直接呼ぶ）

- [ ] **Step 1:** `lighting.js` に値を設定する

  | 項目 | 値 |
  |---|---|
  | トーンマッピング | `ACESFilmicToneMapping`、露出 1.0 |
  | 太陽 | `#ffc27a`、強さ 3、位置は主人公から見て `(-30, 25, -40)` の方向 |
  | 環境光 | 空 `#9cc7ff`、地面 `#5a5236`、強さ 1.2 |
  | 霧 | `FogExp2('#9fb4c8', 0.018)` |
  | カメラの far | 200 |

  影は `preset.shadows` のときだけ有効にする。影のカメラは ±15 の範囲で、`update(playerPos)` のたびに主人公を追う
- [ ] **Step 2:** `post.js` を作る。構成は `EffectComposer` → `RenderPass` → `UnrealBloomPass`（解像度は画面の半分、strength 0.6、radius 0.4、threshold 0.85）→ `OutputPass`
- [ ] **Step 3:** `npm test` を実行し、PASS することを確認する。ブラウザで、逆光で影が手前に伸びることを確認する。`?q=low` で影とブルームが消えることも確認する
- [ ] **Step 4: コミット** `git commit -m "feat: golden-hour lighting and bloom"`

### Task 7: 地面、石畳、崖

**Files:**
- Modify: `src/world/terrain.js`
- Create: `src/world/random.js`（`mulberry32(seed) -> () => number`）
- Test: `tests/terrain.test.js`

**Interfaces:**
- Produces: `heightAt(x, z) -> number` を terrain.js から export する（`createTerrain` が返すものと同じ）。主人公、木、獣はこれで足元の高さを決める

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/terrain.test.js
import { heightAt } from '../src/world/terrain.js';
test('中央の広場（半径12）と道は平ら', () => {
  expect(heightAt(0, 0)).toBe(0); expect(heightAt(0, -6)).toBe(0); expect(heightAt(0.5, 10)).toBe(0);
});
test('起伏は 0〜0.6m に収まる', () => {
  for (let x = -28; x <= 28; x += 2) for (let z = -28; z <= 28; z += 2) {
    const h = heightAt(x, z); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThanOrEqual(0.6);
  }
});
```

- [ ] **Step 2:** `npm test` を実行し、FAIL することを確認する
- [ ] **Step 3:** 実装する
  - **起伏**：中央の広場の外では、sin を重ねたなだらかな起伏にする。広場の縁から 4m かけて 0 からつなぐ
  - **道**：幅 3m、x = 0 に沿って z = 12 から −14 まで
  - **地面**：分割数 80×80。頂点色で、緑・黄緑・土色のむらをつける
  - **石畳**：道の上に、平たい石を InstancedMesh で並べる
  - **崖**：半径 24〜27 の輪に、引き伸ばした岩を並べる。左右と奥を厚くし、手前は低くする。それぞれの当たり判定の円を `colliders` に入れる
  - 既存の岩18個は削除する（Task 9 で素材の岩に置き換える）
- [ ] **Step 4:** `npm test` を実行し、PASS することを確認する。崖の外に出られないこと、道と広場が平らなことを画面で確認する
- [ ] **Step 5: コミット** `git commit -m "feat: terrain with path and cliffs"`

### Task 8: 廃墟のアーチと旗

**Files:**
- Create: `src/world/ruins.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createRuins(scene) -> { colliders: Collider[] }`

- [ ] **Step 1:** アーチを作る
  - 位置は `(-5, -14)` と `(5, -14)`。柱2本の間隔は 4m、高さ 7m
  - 柱は 1.1m 角の石ブロックを積む。上部の横木は、ブロックを `mulberry32(7)` でいくつか欠けさせる
  - 色は `#7d8288` を基準に、ブロックごとに明るさを ±10% 変える
  - 柱ごとに半径 0.8 の当たり判定を作る
- [ ] **Step 2:** 旗を作る
  - 位置は `(-9, 4)` と `(-7, 6)`。高さ 3m の木の柱に横木をつける
  - 布は `#1f3a6b` の板（縦に 8 分割）。頂点シェーダーで、下ほど大きく揺らす
  - 紋章は、金色 `#c9a96a` の簡単な角（つの）形を板で重ねる
- [ ] **Step 3:** ブラウザで、主人公の背後から見た構図に、アーチが結晶獣の位置の奥に並ぶことを確認する。柱を通り抜けられないことも確認する
- [ ] **Step 4: コミット** `git commit -m "feat: ruined arches and banners"`

### Task 9: 素材の軽量化の仕組みと、木・岩・草

**Files:**
- Create: `scripts/optimize-assets.mjs`、`assets-src/manifest.json`、`src/world/vegetation.js`
- Modify: `package.json`（devDependencies に `@gltf-transform/cli@^4.5.1`、`"optimize": "node scripts/optimize-assets.mjs"`）、`.gitignore`（`assets-src/packs/` を追加）、`ASSETS.md`、`src/main.js`

**Interfaces:**
- Consumes: `heightAt`（Task 7）、`QUALITY_PRESETS.grass`（Task 2）、`loadGLTF`、`withFallback`（Task 1）
- Produces:
  - `assets-src/manifest.json`：`[{ "src": "assets-src/packs/...glb", "out": "public/models/<name>.glb", "textureSize": 1024, "simplifyRatio": 1 }]`
  - `createVegetation(scene, preset, heightAt) -> Promise<{ update(time), setGrassCount(n), colliders: Collider[] }>`

- [ ] **Step 1:** CC0 の自然素材パックを入手する。候補は Quaternius（quaternius.com）か Kenney（kenney.nl）で、針葉樹、岩、草、小さな花を含む glTF 版。ページで CC0 と書かれていることを確認する。ダウンロードがブラウザ操作を必要とする場合は、**ユーザーに入手を頼み**、`assets-src/packs/` に置いてもらう
- [ ] **Step 2:** `optimize-assets.mjs` を書く。manifest の各行について、`gltf-transform optimize <src> <out> --compress meshopt --texture-compress webp --texture-size <textureSize>` を実行する。`simplifyRatio < 1` のときは `--simplify-ratio <simplifyRatio>` も付ける。使う素材（針葉樹 2〜3種、岩 3種、花 1種）を manifest に登録する
- [ ] **Step 3:** `npm run optimize` を実行し、`public/models/` に GLB ができることを確認する。`npx gltf-transform inspect` で、画像が 1024px 以下であることも確認する
- [ ] **Step 4:** `vegetation.js` を実装する
  - **木**：崖の内側と両脇に、`mulberry32(11)` で約 24 本置く。アーチの左右には背の高い木をまとめる。幹に半径 0.5 の当たり判定をつける
  - **岩**：約 15 個置く。道と広場の中央 6m には置かない
  - **草**：細い三角形 3 枚を 1 束にした InstancedMesh。束の数は `preset.grass`（最大数で確保し、`mesh.count` で切り替える）。`onBeforeCompile` で、高さ（uv.y）に比例して `sin(time*1.7 + x*0.3 + z*0.2) * 0.08` だけ揺らす。道の上には生やさない。花は草の 1/10 の数
  - 読み込みに失敗した素材は飛ばし、残りで起動する
- [ ] **Step 5:** `ASSETS.md` に使った素材を記録する。`npm test` を実行し、PASS することを確認する。iPhone で画質「中」が 60fps 近く出ることを `?debug` で確認する
- [ ] **Step 6: コミット** `git commit -m "feat: asset pipeline and vegetation"`（`public/models/` は含める。`assets-src/packs/` は含めない）

### Task 10: 主人公のキャラクター

**Files:**
- Modify: `src/player.js`、`assets-src/manifest.json`、`ASSETS.md`

**Interfaces:**
- Consumes: `loadGLTF`、`withFallback`（Task 1）
- Produces: `createPlayer(scene)` の戻り値に `load(url) -> Promise<void>` を追加する。失敗したら今のカプセルのままにする

- [ ] **Step 1:** CC0 の人型キャラクターを入手する。条件は glTF で、Idle と Run（なければ Walk）のアニメーションがあり、剣を持てること（剣は別素材でもよい）。Quaternius の CC0 キャラクターパックが第一候補。入手方法は Task 9 と同じ
- [ ] **Step 2:** manifest に登録し（textureSize 1024）、`npm run optimize` を実行する
- [ ] **Step 3:** `load` を実装する
  - 身長は 1.8m に合わせる
  - `AnimationMixer` で、速さ 0 なら Idle、それ以外は Run を 0.2 秒かけて切り替える。歩くときは Run の再生速度を `speed / 6` に比例させる
  - 服や外套のマテリアル名から1つ選び、`#2b4a8a` 系の青に色を替える
  - 剣は右手のボーンに付ける
  - 影を落とす
- [ ] **Step 4:** ブラウザで、止まると待機、歩くと走りのアニメになることを確認する。素材のURLをわざと間違えると、カプセルの主人公で起動することも確認する
- [ ] **Step 5: コミット** `git commit -m "feat: animated player character"`

### Task 11: 結晶獣（AI生成）

**Files:**
- Create: `src/world/beast.js`、`assets-src/concept/beast-crop.png`
- Modify: `assets-src/manifest.json`、`ASSETS.md`、`src/main.js`

**Interfaces:**
- Consumes: `loadGLTF`、`withFallback`（Task 1）、`heightAt`（Task 7）
- Produces: `createBeast(scene, url, heightAt) -> Promise<{ object, collider: Collider, update(time) }>`。collider は `{ x: 0, z: -6, radius: 2.6 }`

- [ ] **Step 1:** `assets-src/concept/echo-hunt-concept.png` から、獣の部分（x 700〜1310、y 120〜540）を切り出して `beast-crop.png` にする
- [ ] **Step 2:** Artlist で、Hyper3D Rodin v2.5 Fast の通常版と High の見積もりを取る。無料（0 クレジット）のほうを選ぶ。両方無料なら High にする。**ここでユーザーに、切り出した画像と、アップロードして生成する旨を伝え、了承を得る**
- [ ] **Step 3:** 画像をアップロードして生成し、GLB を `assets-src/packs/beast/beast-raw.glb` にダウンロードする。生成に失敗した場合は作り直さずに Step 6 へ進む
- [ ] **Step 4:** `npx gltf-transform inspect` で三角形数を確かめる。2〜3万枚になる `simplifyRatio` と `textureSize: 2048` を manifest に登録し、`npm run optimize` を実行する
- [ ] **Step 5:** `beast.js` を実装する
  - 高さを 5m に合わせ、`(0, -6)` に、主人公のほうを向けて置く
  - `onBeforeCompile` で、テクスチャの色が青緑寄りの部分（`smoothstep(0.15, 0.35, (g + b) / 2 - r)`）を発光させる。発光色は `#3fe0d0`
  - 発光の強さは `1.5 + 0.8 * sin(time * 2.2)` で明滅させる
  - 呼吸として `scale.y` を `1 + 0.015 * sin(time * 1.6)` 倍にする
  - 影を落とす
- [ ] **Step 6:** 失敗したときの代わりの獣を作る（`createFallbackBeast()`）。読み込みの失敗、Step 3 での生成の失敗、Step 4 で軽量化しても重すぎる場合のどれでも、こちらを使う
  - 本体：つぶした十二面体を胴と頭と4本の脚に配置した岩の塊（色 `#4a4744`）
  - 結晶：背中に `#3fe0d0` の発光する円錐を約 20 本、`mulberry32(3)` で生やす
- [ ] **Step 7:** `ASSETS.md` に「結晶獣：Artlist / Hyper3D Rodin v2.5 Fast で生成、入力は自作のコンセプト画像」と記録する。ブラウザで、獣の結晶がブルームで光ること、獣を通り抜けられないことを確認する
- [ ] **Step 8: コミット** `git commit -m "feat: crystal beast"`

### Task 12: 遠景の山と空

**Files:**
- Create: `src/world/backdrop.js`、`public/textures/backdrop.webp`
- Modify: `src/main.js`、`ASSETS.md`

**Interfaces:**
- Produces: `createBackdrop(scene, url) -> Promise<void>`。失敗したら `createFallbackBackdrop(scene)` を使う

- [ ] **Step 1:** Artlist の無料の画像生成が残っているか確認する。残っていれば、**ユーザーに了承を得てから**生成する
  - 内容：夕方の高い山並みのパノラマ。左上の空に低い太陽があり、手前は空けておく。人物・動物・文字は入れない
  - 横長の比率でできるだけ広く作る
  - 2048×1024 以下の WebP にして `public/textures/backdrop.webp` に置く

  残っていなければ Step 3 だけを行う
- [ ] **Step 2:** `createBackdrop` を実装する。半径 90、高さ 60 の筒の内側に貼る（`MeshBasicMaterial`、`fog: false`、`side: BackSide`、`depthWrite: false`）。画像の太陽の位置が、光の方向 `(-30, 25, -40)` と合うように筒を回す
- [ ] **Step 3:** `createFallbackBackdrop` を実装する
  - 空：上が `#5d86b8`、地平線が `#f3c58a` のグラデーションの球
  - 山：半径 70〜85 に、ローポリの山のシルエットを3重に並べる。奥ほど青く薄くする
- [ ] **Step 4:** 画面で、地面と遠景のつなぎ目が霧でなじんでいることを確認する。URL を間違えると代わりの遠景で起動することも確認する
- [ ] **Step 5: コミット** `git commit -m "feat: mountain backdrop"`

### Task 13: 土ぼこりと光の粒

**Files:**
- Create: `src/world/effects.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createEffects(scene, preset, beastPos: {x, z}) -> { update(dt, time) }`

- [ ] **Step 1:** 実装する
  - **土ぼこり**：獣の足元の半径 3m に、60 粒の `Points` を置く。ゆっくり上がりながら消え、また下から出る。色 `#c8a477`、半透明
  - **光の粒**：主人公の周り 20m に 150 粒。加算合成で、ゆらゆら漂わせる
  - 画質が `low` のときは、どちらも数を半分にする
- [ ] **Step 2:** ブラウザで目立ちすぎないことを確認する
- [ ] **Step 3: コミット** `git commit -m "feat: dust and light motes"`

### Task 14: 構図の調整と最終確認

**Files:**
- Modify: `src/main.js`、`src/camera.js`

- [ ] **Step 1:** 開始時の状態を設定する
  - 主人公は `(0, 6)` で −z 向き、カメラの `yaw` は 0
  - カメラの距離は 5.5、`pitch` の初期値は 0.25。注視点は主人公の頭上 1.3m とし、わずかに右へずらして、主人公が画面中央のやや左に来るようにする
- [ ] **Step 2:** iPhone 14 の実機で、開始直後の画面をスクリーンショットし、コンセプト画像と並べて比べる。ずれが大きいところ（光の色、霧の濃さ、獣の大きさ、木の配置）を調整する。並べた画像をユーザーに見せて、意見をもらう
- [ ] **Step 3:** 完成条件を順に確認する
  - [ ] 開始直後の構図と雰囲気がコンセプト画像に近い（ユーザーの確認）
  - [ ] 岩・崖・アーチ・結晶獣・木を通り抜けられない
  - [ ] `?debug` で、画質「中」が 60fps、獣の正面でも 30fps 以上
  - [ ] UI の配置が画像どおりで、ミニマップが動く
  - [ ] `npm run build` の後、`du -sh dist` が 15MB 以下。`ASSETS.md` にすべての素材が載っている
  - [ ] 画面を回転させたときと、アドレスバーが出入りしたときに、描画と UI が正しい大きさになる
  - [ ] ホーム画面に追加して、全画面で起動する
  - [ ] 別のアプリに切り替えて戻っても、勝手に歩き続けない
- [ ] **Step 4:** `npm test` を実行し、全テストが PASS することを確認する
- [ ] **Step 5: コミット** `git commit -m "feat: match opening composition to concept"`
