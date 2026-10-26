## 前提（共通）
- スマホ（iPhone 14 の Safari、横向き。画面はおよそ 844×390、Safari のバーありで 844×340）向けの3Dアクションゲーム「OBLIVION ARENA」の第4段階（タイトル画面・遊び方・一時停止）です
- 技術：Vite 8、素の JavaScript（ES modules）。TypeScript は使いません。three.js はこの依頼では使いません
- テスト：Vitest 5（`import { test, expect, vi } from 'vitest'`）。DOM が必要なテストは先頭に `// @vitest-environment happy-dom`
- **新しいライブラリは追加しないでください**
- 見た目は既存の画面（`src/ui/hud.css`、`src/ui/combatHud.css`）に合わせる：半透明の濃紺 `#1b2530cc`、金の縁 `#c9a96a`、文字色 `#e8e2d0`、斜めに切り落とした角（`clip-path`）、英字は `'Cinzel'`、日本語はシステムフォント（`system-ui, -apple-system, 'Hiragino Sans', sans-serif`）
- iPhone のノッチを避けるため、端に置くものは `env(safe-area-inset-*)` を足す
- 画面の高さが低いとき（`@media (max-height: 430px)`）は文字やボタンを少し小さくする
- 設計書：`docs/superpowers/specs/2026-10-26-stage4-title-design.md`（読み取り専用で読めます）
- あなたは読み取り専用でこのリポジトリを見られます。ファイルは書き込めないので、返答の中にファイルの全文を入れてください

## 返答の形式
- 作るファイルの**全文**を、それぞれファイル名を書いたコードブロックで返してください（コードブロックの直前の行に、`### src/ui/xxx.js` のようにファイルのパスを書く）
- 下の「必ず通るテスト」は、そのまま（または追加して）テストファイルに入れてください
- ほかのファイルの変更の提案は不要です。説明は短く、迷って決めたところがあれば最後に箇条書きで
