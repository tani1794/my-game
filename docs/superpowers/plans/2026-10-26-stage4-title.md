# OBLIVION ARENA 第4段階：タイトル・遊び方・一時停止・最速記録 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイトル → 戦い → 結果 → タイトルの流れと、遊び方の説明・一時停止・最速記録を加える。

**Architecture:** 状態の切り替えは純粋な関数（`src/game/flow.js`）、保存は差し替えられる storage を受け取る小さな係（`src/game/records.js`）、画面は状態を持たない部品（タイトル・一時停止・説明）。`main.js` が状態を1つ持ち、毎 frame その状態で「戦いを進めるか」「描くか」を決める。

**Tech Stack:** 素の JavaScript、Vitest 5 + happy-dom、Pillow（画像の変換）

**Spec:** `docs/superpowers/specs/2026-10-26-stage4-title-design.md`

## Global Constraints
- 新しいライブラリは使わない。戦いのルール（`src/combat/`）は変更しない
- `localStorage` の読み書きはすべて try/catch。キーは `oa-best`、`oa-plays`
- 画面の文は日本語。タイトルの画像は `public/textures/title.webp`（`asset('textures/title.webp')` で参照）
- 説明を出すのは遊んだ回数（戦いに入った回数、今回を含む）が 3 以下のとき

## Review Focus
1. **一時停止中に dt が溜まる**：再開した瞬間に大きな dt で戦いが飛ばない → Task 7（`lastTime` は毎 frame 更新）
2. **裏から戻ったとき**：戦いの途中なら一時停止のまま、音も止めたまま → Task 7
3. **結果画面から「タイトルへ」→ もう一度開始**：前の戦いの予告・ダメージ数字・ロックオン・結果画面が残らない → Task 7（共通の `resetFight`）
4. **保存できない環境・壊れた値**：記録なし・回数0で動く → Task 2 のテスト
5. **タイトル画面が出ている間のキー入力**（J・K など）：戦いの入力として溜まらない → Task 7（開始時に `input.clear()`）

---

### Task 1: 画面の流れ（Claude）
**Files:** Create `src/game/flow.js`, Test `tests/flow.test.js`
**Produces:** `nextState(state, action) -> state | null`。state：`'title' | 'playing' | 'paused' | 'result'`、action：`'start' | 'pause' | 'resume' | 'retry' | 'finish' | 'title'`。許されない組み合わせは `null`
- 許される切り替え：title+start→playing、playing+pause→paused、playing+finish→result、paused+resume→playing、paused+retry→playing、paused+title→title、result+retry→playing、result+title→title
- [ ] テスト：上の8つと、許されない例（title+pause、result+pause、paused+finish、playing+start）が `null`
- [ ] 失敗を確認 → 実装 → 通過 → commit

### Task 2: 記録と回数（Claude）
**Files:** Create `src/game/records.js`, Test `tests/records.test.js`
**Produces:** `createRecords(storage = localStorage か null)` → `{ best(): number|null, submit(seconds): { best, isNew }, plays(): number, countPlay(): number }`
- `submit` は今の記録より速いとき（または記録なし）だけ保存し `isNew: true`。`countPlay` は回数を1増やして新しい回数を返す
- [ ] テスト：記録なし→submit(100) で isNew、submit(120) で best 100 のまま isNew false、submit(90) で更新／`countPlay` が 1,2,3／壊れた値（`'abc'`、`'-5'`、`'0'`）は記録なし／getItem・setItem が投げても動き、回数はその起動の間は数える
- [ ] 失敗を確認 → 実装 → 通過 → commit

### Task 3〜5: タイトル・一時停止・説明（ChatGPT）
依頼文：`docs/handoff/task-s4-03-title.md`、`task-s4-04-pause.md`、`task-s4-05-tutorial.md`（共通：`_common-stage4.md`）。返ってきたコードを置き、依頼文のテストを通し、判断の部分（説明）は変異（わざと壊す）でテストが落ちることを確かめてから commit

### Task 6: 結果画面の追加（Claude）
**Files:** Modify `src/ui/combatHud.js`・`.css`, Test `tests/combatHud.test.js`
**Produces:** `showResult(kind, timeSeconds, { best, isNew } = {})`、`onTitle(callback)`
- 勝ち：`.result-best` に「最速 m:ss」、isNew なら `.result-new`「新記録」を表示。負け：両方隠す。`button.result-title-button`「タイトルへ」を「もう一度」の隣に
- [ ] テスト → 失敗確認 → 実装 → 通過 → commit

### Task 7: 組み込み（Claude）
**Files:** Modify `src/main.js`, `ASSETS.md`; Add `public/textures/title.webp`
- 状態 `state` を1つ持つ。切り替えは必ず `nextState` を通す
- `resetFight()`：今の「もう一度」の処理をまとめたもの（予告・画面・ロックオン・入力・音・乱数の種）
- `beginFight()`：`resetFight` → `records.countPlay()` → `tutorial.start(plays <= 3)` → `autoDowngrade.reset()`
- 毎 frame：title・paused は戦いも描画も止める（`lastTime` は更新）。playing・result は今までどおり。説明は playing のときだけ `update`
- 勝ったら `records.submit(time)` の結果を `showResult` に渡す
- 一時停止：`sound.suspend()`、続けるで `sound.resume()`。裏に回ったら playing なら一時停止にする。戻ったとき paused なら音を止めたまま
- 画質を選んだら `autoDowngrade = null`、`applyQuality`
- 音の有効化を `pointerup`・`touchend` でも試す
- `animate` の中に紛れ込んだ Service Worker の登録（毎 frame 呼ばれている）を取り除く
- [ ] `npm test`、`npm run build`、ヘッドレス Chrome で 844×390 と 844×340 の画面を撮って、タイトル（ロゴが切れない）・一時停止・結果を確認 → commit
