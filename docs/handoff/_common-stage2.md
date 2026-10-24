## 前提（共通）
- スマホ（iPhone 14 の Safari、横向き）向けの3Dアクションゲーム「OBLIVION ARENA」の第2段階（戦闘）です
- 技術：Vite 8、three.js 0.186（`import * as THREE from 'three'`）、素の JavaScript（ES modules）。TypeScript は使いません
- テスト：Vitest 5（`import { test, expect, vi } from 'vitest'`）。DOM が必要なテストは先頭に `// @vitest-environment happy-dom`
- **新しいライブラリは追加しないでください**
- 向きの決まり：角度 `a` の向きは `(sin a, cos a)`（three.js の `rotation.y` と同じ）。地面は x-z 平面、y が上、1単位 = 1m
- 設計書：`docs/superpowers/specs/2026-10-25-stage2-combat-design.md`、計画：`docs/superpowers/plans/2026-10-25-stage2-combat.md`（読み取り専用で読めます）
- あなたは読み取り専用でこのリポジトリを見られます。ファイルは書き込めないので、返答の中にファイルの全文を入れてください

## 返答の形式
- 作るファイルの**全文**を、それぞれファイル名を書いたコードブロックで返してください
- 下の「必ず通るテスト」は、そのまま（または追加して）テストファイルに入れてください
- ほかのファイルの変更の提案は不要です。説明は短く、迷って決めたところがあれば最後に箇条書きで
