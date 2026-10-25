# OBLIVION ARENA 第3段階：効果音と環境音 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 戦闘のきっかけごとに効果音を鳴らし、風の環境音を流す。iPhone の制約（最初のタッチで有効化、マナーモード）に従い、消音ボタンを付ける。

**Architecture:** 戦いの frame の差分から「鳴らす音の一覧」を作る純粋な関数（`soundCues.js`）と、Web Audio で鳴らす小さな音の係（`sound.js`）に分ける。main は毎 frame、一覧を音の係に渡すだけ。

**Tech Stack:** Web Audio API、Vitest（音の係は AudioContext の偽物を差し込んでテスト）、macOS の `afconvert`（m4a への変換）

**Spec:** `docs/superpowers/specs/2026-10-25-stage3-sound-design.md`

## Global Constraints
- 新しいライブラリは使わない。音の素材は CC0 のみ、合計 1MB 以内、モノラル AAC（`.m4a`）
- 素材が読めない音は鳴らさずに続ける（ゲームは止めない）
- `localStorage` は try/catch で包み、使えなくても動く
- 戦いのルール（`src/combat/`）は変更しない

## Review Focus
1. **最初のタッチより前に鳴らそうとする**：エラーにならず、黙って無視する → Task 3 のテスト
2. **裏に回っている間に戦いの出来事が起きる**：戻ったときに溜まった音がまとめて鳴らない → Task 3 のテスト
3. **同じ frame に同じ音が何度も要求される**（結晶の雨が重なる等）：1回だけ鳴る → Task 2・3 のテスト
4. **やり直しの直後**：前の戦いの差分から音が鳴らない（勝ち・負けの音が二度鳴らない） → Task 2 のテスト
5. **消音を保存できない環境**（プライベートブラウズ）：エラーにならず、毎回音ありで始まる → Task 3 のテスト

---

### Task 1: 音の素材
**Files:** `assets-src/packs/sounds/`（リポジトリ外）、`public/sounds/*.m4a`、`scripts/convert-sounds.sh`、`ASSETS.md`
- [ ] **Step 1:** Kenney の CC0 音素材パック（Impact Sounds、RPG Audio、Interface Sounds など）を kenney.nl から入手し、各パックの License.txt で CC0 を確認する
- [ ] **Step 2:** 第4章の音ごとに素材を選ぶ（複数を重ねる場合は変換時に合成）。足りない音（低いうなり、風）は CC0 の別素材か、合成で作る
- [ ] **Step 3:** `scripts/convert-sounds.sh` で、選んだ素材をモノラル・44.1kHz・AAC 96kbps の `.m4a` にして `public/sounds/` に書き出す（`afconvert -f m4af -d aac -b 96000 -c 1`）。風は20秒程度の継ぎ目のないループにする
- [ ] **Step 4:** `du -ch public/sounds/*.m4a` が 1MB 以内であることを確認し、`ASSETS.md` に1行ずつ記録してコミットする

### Task 2: 鳴らす音の一覧（ChatGPT）
**Files:** `src/audio/soundCues.js`、`tests/soundCues.test.js`
**Interfaces:**
- Produces: `createSoundCues()` → `{ update(dt, prev, next, playerPos) -> Cue[], reset() }`
  - `prev`・`next` は `battle.update` の戻り値（`prev` は前の frame、最初は null）
  - `Cue = { name: string, group: 'player' | 'beast' | 'ui', distance?: number }`（結晶獣の音には主人公との距離を付ける）
  - きっかけ：攻撃の振り始め（`next.player.animation.name` が攻撃に変わった瞬間、段ごとに swing1〜3）、回避の始まり、`events` の beastHit・playerHit・stagger・enraged・won・lost、予告の始まり（`beast.phase` が telegraph になった瞬間に warn。charge・spin はさらに予告の終わり＝`strikeKind` が出た瞬間に charge／spin）、`strikeKind` が slam のとき slam、rain のとき strikes 1つにつき crystal（同じ frame の重複は1つにまとめる）、結晶獣の phase が dead になった瞬間に shatter
  - 足音：mode が free で `move.speed > 0` の間、歩き（≤3m/秒）は 0.5 秒、走りは 0.32 秒おきに step
  - `reset()` で足音の時計と前回の状態を忘れる（やり直し直後に勝ち負けの音が二度鳴らない）
- [ ] **Step 1:** 依頼文 `docs/handoff/task-s3-02-soundcues.md` を書き、Codex で送る（上の Interfaces と、きっかけごとのテストを入れる）
- [ ] **Step 2:** 返事を置いてテストを通し、わざと壊して失敗することを確かめ、コミットする

### Task 3: 音の係
**Files:** `src/audio/sound.js`、`tests/sound.test.js`
**Interfaces:**
- Produces: `createSound({ context = () => new AudioContext(), fetch = window.fetch, storage = window.localStorage })` → `{ unlock(), load(names: string[]) -> Promise, play(cue: Cue), startAmbient(name), setMuted(bool), muted(), suspend(), resume() }`
  - 音量：全体 0.8 × 群（player 0.7、beast 0.9、ui 0.4、ambient 0.25）× 距離（6m 以内 1、25m で 0.4、間は直線、それ以上は 0.4）
  - 高さ：`playbackRate` を 0.94〜1.06 の乱数（種つき）
  - 同時に鳴る数は最大16（超えたら最も古い音を止める）。同じ名前は 0.04 秒以内に重ねない
  - `unlock()` より前の `play` は無視する。`suspend()` 中の `play` も無視する（溜めない）
  - 消音は `storage` に `'oa-muted'` で保存。読み書きの失敗は無視（音ありで始まる）
  - 読み込めなかった音は、その名前の `play` を無視する
- [ ] **Step 1:** 偽の AudioContext（`createBufferSource`・`createGain`・`decodeAudioData`・`currentTime`・`resume`・`suspend` を持つ）でテストを書く：unlock 前は鳴らない、音量の掛け算、距離、上限16、0.04秒、消音の保存と失敗時、suspend 中は鳴らない、読めない音は無視
- [ ] **Step 2:** FAIL → 実装 → PASS → コミット

### Task 4: 組み込みと消音ボタン
**Files:** `src/main.js`、`src/ui/hud.js`、`src/ui/hud.css`、`tests/hud.test.js`
- [ ] **Step 1:** hud に `muteButton` と `setMutedIcon(muted)` を追加（スピーカーの SVG、消音時は斜線）。テスト：`setMutedIcon(true)` で `muted` クラスが付く
- [ ] **Step 2:** main：最初の `pointerdown`/`keydown` で `sound.unlock()` と `startAmbient('wind')`。`visibilitychange` で suspend／resume。毎 frame `soundCues.update` の結果を `sound.play` に渡す。やり直しで `soundCues.reset()`。もう一度・消音ボタンで `click`
- [ ] **Step 3:** ブラウザでエラーがないこと、音が読み込まれること（`?debug` で読み込み数を出す）を確かめる。ビルドの合計が 15MB 以内
- [ ] **Step 4:** ChatGPT に全体のレビューを依頼し、重要な指摘を直す。iPhone での確認項目をユーザーに渡す
