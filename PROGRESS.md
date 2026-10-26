# 作業の記録（第一章「霧の向こうの声」）

## 今回の完成目標
タイトルから結晶獣戦へ直接行かず、「目覚め → 霧の森の探索（白い花の寄り道・旧門衛所・門の開放・衛兵との戦い）→ 廃れた礼拝堂（壁画の記憶・巡礼路の案内）」を遊べる第一章を作り、章の終わりから既存の結晶獣戦へつなぐ。設計：`docs/superpowers/specs/2026-10-27-chapter1-design.md`

## 作業用ブランチ
`chapter1`（main から分岐）

## 完了した項目
- 地図（歩ける範囲・高さ・当たり判定・出来事の場所）`src/chapter/layout.js`
- 進行と保存（版つき、壊れていればはじめから）`src/story/progress.js`
- 台本と進行役（会話・目的・門の仕掛け・記憶・章の終わり）`src/story/script.js`・`director.js`
- 衛兵の頭脳 `src/story/guard.js`、見た目 `src/chapter/guards.js`（KayKit Skeleton_Warrior）
- 森・門衛所・東の門・橋・西の沢 `src/chapter/forest.js`、礼拝堂 `src/chapter/chapel.js`、質感 `scripts/build-chapter-textures.py`
- まとめ役 `src/chapter/runner.js`、画面 `src/ui/storyHud.js`（ChatGPT 作）、タイトルから物語・物語から結晶獣戦への流れ `src/main.js`・`src/game/flow.js`
- 壁の箱の当たり判定・歩ける範囲の関数 `src/player.js`、カメラの埋まり防止・地面より下へ行かない `src/camera.js`

## 変更した主なファイル
- （作業中）

## 実施した検証と結果
- `npm test`：356 件すべて成功（2026-10-27）
- 画面のない Chrome で通しの確認（`?debug&fast`、場所の移動はデバッグ用の瞬間移動）：目覚め（タップ送り）→ 最初の衛兵を倒す（会話あり）→ 門を調べる → 巻き上げ機 → レバー（門が開き、復帰地点が門に）→ 橋の先で倒れて門の復帰地点へ戻る（門は開いたまま）→ 衛兵2体を倒す → 礼拝堂到着（復帰地点）→ 身廊 → 壁画の記憶（スキップ）→ 祭壇（章の終わり）→ 巡礼路 → 結晶獣戦が始まる。エラーなし
- 見つけて直した不具合：危険の知らせがタップ待ちの場面に割り込むと進めなくなる／調べた反応が会話の後ろに並ぶ／古い場面が目的を上書きする／記憶のあとも動けない

## 既知の不具合と不足素材
- 参考画像の写実的な森・礼拝堂は再現できない。Kenney Nature Kit（低ポリゴン）とコードで作る石造りで代用

## 次に実行する具体的な作業
1. 目覚め・記憶の場面の見え方の確認と調整
2. タイトルに「はじめから」（保存があるとき）
3. ChatGPT による全体の見直しと修正、PROGRESS の更新

## 再開に必要なコマンド
```
cd /Users/user/my-game
git checkout chapter1
npm test                 # テスト
npx vite --host          # 開発サーバー（http://localhost:5173/?debug）
npm run build && npx vite preview --host --port 4173   # 公開版と同じもの
```
