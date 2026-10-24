# 素材の入手元とライセンス

ゲームに含めるすべての素材を1行ずつ記録する。CC0（またはフォントの OFL）であることを確認できない素材は使わない。

| 素材 | 入手元URL | ライセンス | 使用ファイル |
|---|---|---|---|
| Cinzel（英字フォント） | https://fonts.google.com/specimen/Cinzel （npm: @fontsource/cinzel） | SIL Open Font License 1.1 | `node_modules/@fontsource/cinzel`（ビルド時に同梱） |
| 顔アイコン | 自作のコンセプト画像 `assets-src/concept/echo-hunt-concept.png` から切り出し | 自作 | `public/textures/portrait.png`、`public/apple-touch-icon.png` |
| 結晶獣（3Dモデル） | Artlist / Hyper3D Rodin v2.5 Fast（image-to-3D、無料枠）で生成。入力は自作コンセプト画像の切り出し `assets-src/concept/beast-crop.png` | 自作素材からのAI生成（Artlist の利用規約に従う） | `public/models/beast.glb`（元データ `assets-src/packs/beast/beast-raw.glb` はリポジトリ外） |
| 遠景（山並みと夕焼けのパノラマ） | Artlist / Nano Banana 2（text-to-image、8:1、無料枠）で生成 | AI生成（Artlist の利用規約に従う） | `public/textures/backdrop.webp`（4096×492 に縮小。元データ `assets-src/packs/backdrop/backdrop-raw.png` はリポジトリ外） |
| 針葉樹・石・花（Kenney Nature Kit 2.1） | https://kenney.nl/assets/nature-kit | CC0 1.0（同梱の License.txt で確認） | `public/models/nature/*.glb`（pine_tall / pine_default / pine_round / stone_a / stone_c / stone_e / flower_purple） |
| 主人公（KayKit Adventurers の Knight） | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0（同梱の LICENSE.txt で確認） | `public/models/knight.glb`（Idle・Walking_A・Running_A のみ残し、盾と予備の武器を除去） |
| 地面のテクスチャ（草・土・小石・苔） | Artlist / Nano Banana 2（text-to-image、1:1、無料枠の最後の1回）で生成 | AI生成（Artlist の利用規約に従う） | `public/textures/ground.webp`（1024px。元データ `assets-src/packs/ground/ground-raw.png` はリポジトリ外） |
