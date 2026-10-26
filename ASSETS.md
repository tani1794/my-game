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
| 効果音の素材（Kenney Impact Sounds・RPG Audio・Interface Sounds・Music Jingles） | https://kenney.nl/assets/impact-sounds ほか同ページ群 | CC0 1.0（各パックの License.txt で確認） | `public/sounds/*.m4a` の素材（`scripts/build-sounds.py` で重ねて書き出し。元データ `assets-src/packs/sounds/` はリポジトリ外） |
| 合成した効果音（風切り・地響き・うなり・予告の合図・風） | `scripts/build-sounds.py` でコードから合成 | 自作 | `public/sounds/swing*.m4a`・`spin`・`charge`・`enrage`・`warn`・`wind` ほか（素材と重ねたものを含む） |
| 戦闘曲 D：Boss Battle #2 [Symphonic Metal]（nene） | https://opengameart.org/node/84428 | CC0（ページで確認） | `public/sounds/music-d.m4a`（前奏＋繰り返し部分を1つに。`scripts/build-music.py`） |
| 戦闘曲 C：Heavy Battle Music（Davieplier） | https://opengameart.org/content/heavy-battle-music | CC0（ページで確認） | `public/sounds/music-c.m4a` |
| 戦闘曲 A：Determined Pursuit（Emma_MA） | https://opengameart.org/content/determined-pursuit-epic-orchestra-loop | CC0（ページで確認） | `public/sounds/music-a.m4a` |
| タイトル曲：Vampire's Piano（TAD） | https://opengameart.org/node/115915 | CC0（ページで確認） | `public/sounds/music-title.m4a`（`scripts/build-music.py`） |
| タイトル画像「THE SILENT CROWN」（王冠の騎士・森・霧の谷・古城、題字入り） | 作者（ユーザー）が ChatGPT で用意したキービジュアル（2026-10-26 にチャットで受け取り。元の絵は `assets-src/packs/title/silent.png`、リポジトリ外） | 作者提供（作者の確認のもと公開） | `public/textures/silent-art.webp`（題字を消した絵）、`public/textures/silent-title.webp`（元の題字を色で切り出した透過画像） |
| 題字を消した跡の穴埋め | LaMa（big-lama、ONNX 版 https://huggingface.co/Carve/LaMa-ONNX ）を Mac 上で実行。`scripts/build-silent-title.py` | モデルは Apache-2.0。出力は自作素材の派生 | `public/textures/silent-art.webp` |
| タイトルの奥行きの地図と、動かす場所の地図 | 奥行きは Depth Anything V2 Small（https://huggingface.co/depth-anything/Depth-Anything-V2-Small 、ONNX版 onnx-community/depth-anything-v2-small）で推定。枝葉・マント・空の範囲は `scripts/build-silent-title.py` で作成 | モデルは Apache-2.0。出力は自作素材の派生 | `public/textures/silent-depth.png`（R=奥行き）、`public/textures/silent-masks.png`（R=枝葉、G=マント、B=空） |
| 鎖につながれたドラゴン（城の左手前の岩山） | 作者（ユーザー）が用意した参考の絵（2026-10-26 にチャットで受け取り。`assets-src/packs/title/dragon-ref.png`、リポジトリ外）から切り出して合成。`scripts/build-silent-title.py` | 作者提供（作者の確認のもと公開） | `public/textures/silent-art.webp` に描き込み |
