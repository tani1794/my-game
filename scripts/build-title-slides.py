# タイトルのスライド用の素材を作る。
# 4枚の絵（calm・glow・surge・clash）それぞれについて、
#   - ロゴを消した絵            public/textures/title-<名前>.webp
#   - 奥行きの地図（R=奥行き、G=結晶の光る場所） public/textures/title-<名前>-depth.png
# を作り、calm の絵からロゴだけを切り出す（public/textures/title-logo.webp）。
#
# 使い方: python build-title-slides.py <絵のフォルダ> <Depth Anything V2 Small の model.onnx> <確認用の出力フォルダ>
#   絵のフォルダには calm.png・glow.png・surge.png・clash.png（どれも 1672×941）を置く
# 必要: onnxruntime, numpy, scipy, pillow（ゲーム本体には入れない。作業用の環境で）
import sys
import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage as nd

SOURCE, MODEL, PREVIEW = sys.argv[1:4]
OUT = 'public/textures'
# ロゴ入りの3枚は構図が同じ。clash だけ構図が違い、ロゴもない
SLIDES = [('calm', True), ('glow', True), ('surge', True), ('clash', False)]
# 結晶を光らせる範囲（主人公の髪や鎧の青い照り返しは光らせない）
GLOW_AREA = {'calm': (0, 640, 640, None), 'glow': (0, 640, 640, None), 'surge': (0, 640, 640, None),
             'clash': (0, 800, 700, None)}


def hsv(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return hue, sat, mx


def estimate_depth(session, im):
    # Depth Anything V2：近いほど大きい値。中間を広げて、結晶獣と城が分かれるようにする
    W, H = 924, 518
    x = np.asarray(Image.fromarray((im * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    d = session.run(None, {session.get_inputs()[0].name: x})[0].squeeze()
    d = (d - d.min()) / (d.max() - d.min())
    d = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).resize((im.shape[1], im.shape[0]), Image.BICUBIC), dtype=np.float32) / 255
    return d


def letter_mask(im):
    # ロゴの金色の文字を色で見分ける
    H, W, _ = im.shape
    hue, sat, mx = hsv(im)
    band = np.zeros((H, W), bool)
    band[752:872, 300:1395] = True
    # 背の高い文字（O と2つの A）だけ上まで。ほかの上は水面の反射なので除く
    band[732:752, 300:445] = True
    for x0, x1 in [(962, 1022), (1302, 1358)]:
        band[714:752, x0:x1] = True
    gold = band & (hue > 8) & (hue < 70) & (((sat > 0.35) & (mx > 0.2)) | ((sat > 0.1) & (mx > 0.45)))
    # 文字の白っぽい光（剣のある左上は除く）
    pale = band & (mx > 0.68) & ~((hue > 160) & (hue < 230) & (sat > 0.2))
    pale[:780, 800:1010] = False
    gold = nd.binary_opening(gold | pale, iterations=1)
    lab, n = nd.label(gold)
    sizes = nd.sum(gold, lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.flatnonzero(sizes > 400))
    letters = nd.binary_closing(keep, iterations=6) | keep
    cyan = band & (hue > 170) & (hue < 210) & (sat > 0.35) & (mx > 0.55)
    spark = cyan & nd.binary_dilation(letters, iterations=40)
    return letters, spark


def fill(img, hole):
    # 穴の周りの色を、細かい段階から粗い段階へ押し広げて埋める
    out = img.copy()
    valid = (~hole).astype(np.float32)
    for sigma in [2, 4, 8, 16, 32, 64]:
        w = nd.gaussian_filter(valid, sigma)
        f = np.stack([nd.gaussian_filter(out[..., c] * valid, sigma) / np.maximum(w, 1e-6) for c in range(out.shape[-1])], -1)
        take = hole & (w > 0.15) & (valid == 0)
        out[take] = f[take]
        valid = np.maximum(valid, take.astype(np.float32))
        if valid.min() > 0:
            break
    return out


def save_logo(im, letters, spark):
    H, W, _ = im.shape
    ring = nd.binary_dilation(letters, iterations=5) & ~letters
    alpha = np.zeros((H, W), np.float32)
    alpha[letters] = 1
    alpha = np.maximum(alpha, ring * 0.85)
    alpha = np.maximum(alpha, spark * 0.9)
    # 文字の上に付いた水面の反射を消す（A の頂点の近くだけ残す）
    top = np.zeros((H, W), bool)
    top[:724, :] = True
    for x0, x1 in [(975, 1010), (1316, 1346)]:
        top[716:724, x0:x1] = False
    top[:770, 1375:] = True
    alpha[top] = 0
    alpha = nd.gaussian_filter(alpha, 0.7)
    alpha[~nd.binary_dilation(letters | spark, iterations=6)] = 0
    ys, xs = np.nonzero(alpha > 0.02)
    y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
    rgba = np.dstack([im, alpha])[y0:y1, x0:x1]
    Image.fromarray((rgba * 255).astype(np.uint8)).save(f'{OUT}/title-logo.webp', 'WEBP', quality=88, method=6)


session = ort.InferenceSession(MODEL)
images = {name: np.asarray(Image.open(f'{SOURCE}/{name}.png').convert('RGB'), dtype=np.float32) / 255 for name, _ in SLIDES}
masks = {name: letter_mask(images[name]) for name, has_logo in SLIDES if has_logo}
# ロゴの場所は3枚で同じなので、3枚の文字の場所を合わせた穴を、どの絵からも消す
logo_hole = np.zeros(images['calm'].shape[:2], bool)
for letters, spark in masks.values():
    logo_hole |= nd.binary_dilation(letters | spark, iterations=12)
save_logo(images['calm'], *masks['calm'])

rng = np.random.default_rng(3)
for name, has_logo in SLIDES:
    im = images[name]
    H, W, _ = im.shape
    hole = logo_hole if has_logo else np.zeros((H, W), bool)
    art = im
    if has_logo:
        filled = fill(im, hole)
        noise = nd.gaussian_filter(rng.normal(0, 1, (H, W)), 1.0)[..., None] * 0.03
        soft = nd.gaussian_filter(hole.astype(np.float32), 2)[..., None]
        art = np.clip(im * (1 - soft) + (filled + noise) * soft, 0, 1)
    Image.fromarray((art * 255).astype(np.uint8)).save(f'{OUT}/title-{name}.webp', 'WEBP', quality=82, method=6)

    depth = estimate_depth(session, im)
    if has_logo:
        depth = fill(depth[..., None], hole)[..., 0]
    depth = np.clip(depth, 0, 1) ** 0.5

    hue, sat, mx = hsv(im)
    glow = (hue > 170) & (hue < 205) & (sat > 0.35) & (mx > 0.5) & ~nd.binary_dilation(hole, iterations=3)
    y0, y1, x0, x1 = GLOW_AREA[name]
    area = np.zeros((H, W), bool)
    area[y0:y1, x0:x1] = True
    glow = np.clip(nd.gaussian_filter((glow & area).astype(np.float32), 1.5) * 1.6, 0, 1)

    dmap = np.dstack([depth, glow, np.zeros_like(depth)])
    Image.fromarray((dmap * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR).save(f'{OUT}/title-{name}-depth.png', optimize=True)
    Image.fromarray((depth * 255).astype(np.uint8)).save(f'{PREVIEW}/{name}-depth.png')
    Image.fromarray((glow * 255).astype(np.uint8)).save(f'{PREVIEW}/{name}-glow.png')
    Image.fromarray((art * 255).astype(np.uint8)).crop((250, 650, 1450, 941)).save(f'{PREVIEW}/{name}-logo-area.png')
    print('wrote', name)
