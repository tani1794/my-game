# 作業の記録（第一章「霧の向こうの声」）

## 今回の完成目標
タイトルから結晶獣戦へ直接行かず、「目覚め → 霧の森の探索（白い花の寄り道・旧門衛所・門の開放・衛兵との戦い）→ 廃れた礼拝堂（壁画の記憶・巡礼路の案内）」を遊べる第一章を作り、章の終わりから既存の結晶獣戦へつなぐ。設計：`docs/superpowers/specs/2026-10-27-chapter1-design.md`

## 作業用ブランチ
`chapter1`（main から分岐）

## 完了した項目
- （作業中）

## 変更した主なファイル
- （作業中）

## 実施した検証と結果
- （作業中）

## 既知の不具合と不足素材
- 参考画像の写実的な森・礼拝堂は再現できない。Kenney Nature Kit（低ポリゴン）とコードで作る石造りで代用

## 次に実行する具体的な作業
1. `src/chapter/layout.js`（地図・歩ける範囲・当たり判定・場所）とテスト
2. `src/story/progress.js`（進行と保存）・`src/story/director.js`（会話と出来事）とテスト
3. `src/story/guard.js`（衛兵の頭脳）とテスト

## 再開に必要なコマンド
```
cd /Users/user/my-game
git checkout chapter1
npm test                 # テスト
npx vite --host          # 開発サーバー（http://localhost:5173/?debug）
npm run build && npx vite preview --host --port 4173   # 公開版と同じもの
```
