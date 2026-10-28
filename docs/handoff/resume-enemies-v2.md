# 続きの手順：敵6体の作り直し（第2版）の残りの確認（2026-10-28 時点）

この会話を閉じても続けられるように、状態と次の作業をまとめたもの。
再開するときは Claude Code に「docs/handoff/resume-enemies-v2.md を読んで続けて」と送る。

## いまの状態
- ブランチ `chapter2`。変更はすべてコミット済み（`9c46027`「Codex導入前の状態」に第2版が入っている）。GitHub へは未送信
- 作業前のバックアップ：`/Users/user/my-game-backups/2026-10-28-1523-enemies2/`（編集した17ファイル）
- 前の版の模型は残してある：`beast-crystal.glb`、`revenant-spear.glb`（今は使っていない）

## 作ったもの
| 敵 | 見た目の出どころ | 作るコード |
|---|---|---|
| 結晶獣（ボス） | `public/models/beast-crystal-v2.glb` | `scripts/models/crystalBeast.js` → `node scripts/build-crystal-beast.mjs` |
| 晶牙ハウンド・硝子羽の蝙蝠・結晶甲虫・晶糸の蜘蛛 | 実行時にコードで作る | `src/areas/creatures.js`（道具 `creatureKit.js`） |
| 晶槍の亡兵 | `public/models/revenant-spear-v2.glb` | `scripts/models/spearRevenant.js` → `node scripts/build-spear-revenant.mjs` |

- 模型を作り直すときは開発サーバーが必要：`PORT=5174 node scripts/build-...mjs <確認画像の出力先>`（1回目に読み込みエラーが出ることがある。もう一度実行すれば通る）
- 結晶獣の叩きつけの動き：`src/world/beast.js` の `slamBody` / `slamProgress`
- 亡兵の外套の揺れ：`src/areas/foeViews.js` の `moveCape`
- 確認画像：`docs/models/*-v2-*.png`

## 確認できたこと
- テスト 532 件成功、`npm run build` 成功
- 本番ビルド（`npm run build` → ポート 4173）での通し：ボス戦（登場 → 実際に斬る → 倒れて再挑戦 → 撃破 → 霜葬峡谷へ）成功。谷の前半（ハウンド4・蝙蝠・甲虫・蜘蛛・亡兵・盾衛・祈り手・巨兵・巻き上げ機）成功。エラー 0 件

## 残っている作業（この順に）
1. **上の段の4体（蜘蛛・蝙蝠・亡兵・甲虫）を実際に斬って倒しきる確認**。Mac のメモリ不足（スワップ 5.6GB）でブラウザが落ちて未完了。
   ほかのアプリ（ChatGPT・Codex など）を閉じてから：`PORT=4173 node scripts/checks/terrace.mjs <出力先> boss`
2. 谷全体の通しをもう一度：`PORT=4173 node scripts/checks/crystal-e2e.mjs <出力先> all`（約12分）
3. ゲーム内の変更前後の比較画像（同じ場所・同じカメラ）：`scripts/checks/foes-ingame.mjs`、`spear-ingame.mjs`、`slam-shots.mjs`。
   変更前は `git worktree add --detach <一時フォルダ> 810e318` で前の状態を別に取り出し、そこで `npx vite --port 5175` を動かして撮る（`foe-sheet.mjs before` は、前の状態の `src/areas/foeViews.js` の最後に `export const __BUILDERS = BUILDERS;` を足したときだけ使える）
4. iPhone 14 の実機で見た目と動きを確かめる（fps は実機で測るまで報告しない）

## 見つけた不具合（まだ直していない）
- 主人公のマントの裾の破れがゲームで出ない：GLB への書き出しが透明の型（alphaMap）を保存しないため。亡兵と同じく、模様の画像に透明を焼き込めば直る（`scripts/models/crownedKnight.js` の cloak の材質）
- 骸骨兵の持ち物（盾・槍・氷の槍など）が一度も表示されていない：`foeViews.js` が手を `handslot.r` で探すが、読み込むと `handslotr` になる。直すなら持ち物の向きの確認と一緒に

## 守ること（ユーザーの指示）
- public・src などのフォルダ全体を消さない・置き換えない。`git reset --hard`・`git clean`・変更全体を戻す `git restore` はしない
- 作業前に `git status` を見て、未コミットの変更を守る。編集するファイルだけをプロジェクトの外の日時付きフォルダへバックアップ
- 元の GLB は残し、新しい模型は別名で出す。外部サービス・有料素材は使わない。GitHub への送信は確認してから
- 実機で測っていない fps を推測で書かない。できなかった確認を「成功」と書かない
