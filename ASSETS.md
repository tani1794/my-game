# 素材の入手元とライセンス

ゲームに含めるすべての素材を1行ずつ記録する。CC0（またはフォントの OFL）であることを確認できない素材は使わない。

| 素材 | 入手元URL | ライセンス | 使用ファイル |
|---|---|---|---|
| Cinzel（英字フォント） | https://fonts.google.com/specimen/Cinzel （npm: @fontsource/cinzel） | SIL Open Font License 1.1 | `node_modules/@fontsource/cinzel`（ビルド時に同梱） |
| 顔アイコン | 自作のコンセプト画像 `assets-src/concept/echo-hunt-concept.png` から切り出し | 自作 | `public/textures/portrait.png`、`public/apple-touch-icon.png` |
| 結晶獣（3Dモデル） | Artlist / Hyper3D Rodin v2.5 Fast（image-to-3D、無料枠）で生成。入力は自作コンセプト画像の切り出し `assets-src/concept/beast-crop.png` | 自作素材からのAI生成（Artlist の利用規約に従う） | `public/models/beast.glb`（元データ `assets-src/packs/beast/beast-raw.glb` はリポジトリ外） |
