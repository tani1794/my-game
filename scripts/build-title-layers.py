# タイトル絵から、ロゴを消した絵・ロゴだけの画像・奥行きの地図（R=奥行き、G=結晶の光）を作る。
# 使い方: python build-title-layers.py <絵.png> <title-depth.py の出力> public/textures <確認用の出力フォルダ>
# 必要: numpy, scipy, pillow
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
src, depth_src, out_dir, preview_dir = sys.argv[1:5]
im = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32) / 255
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
hue = np.zeros_like(mx)
d = np.maximum(mx - mn, 1e-6)
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60

# ロゴの帯（文字がある範囲）
band = np.zeros((H, W), bool)
band[752:872, 300:1395] = True
# 背の高い文字（O と2つの A）だけ上まで。ほかの上は水面の反射なので除く
band[732:752, 300:445] = True
for x0, x1 in [(962, 1022), (1302, 1358)]:
    band[714:752, x0:x1] = True
warm = (hue > 12) & (hue < 60)
gold = band & (hue > 8) & (hue < 70) & (((sat > 0.35) & (mx > 0.2)) | ((sat > 0.1) & (mx > 0.45)))
# 文字の白っぽい光（剣のある左上は除く）
pale = band & (mx > 0.68) & ~((hue > 160) & (hue < 230) & (sat > 0.2))
pale[:780, 800:1010] = False
gold = gold | pale
gold = nd.binary_opening(gold, iterations=1)
# 文字の塊だけ残す（水面の小さな反射を除く）
lab, n = nd.label(gold)
sizes = nd.sum(gold, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.flatnonzero(sizes > 400))
letters = nd.binary_closing(keep, iterations=6) | keep
# 文字の縁取り（暗い影）と、文字の近くの青い光
ring = nd.binary_dilation(letters, iterations=5) & ~letters
cyan = band & (hue > 170) & (hue < 210) & (sat > 0.35) & (mx > 0.55)
near = nd.binary_dilation(letters, iterations=40)
spark = cyan & near
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

# ロゴを消す：周りの色を、細かい段階から粗い段階へ押し広げて埋める
hole = nd.binary_dilation(letters | spark, iterations=12)
def fill(img, hole):
    out = img.copy()
    valid = (~hole).astype(np.float32)
    for sigma in [2, 4, 8, 16, 32, 64]:
        w = nd.gaussian_filter(valid, sigma)
        fills = [nd.gaussian_filter(out[..., c] * valid, sigma) / np.maximum(w, 1e-6) for c in range(out.shape[-1])]
        f = np.stack(fills, -1)
        take = hole & (w > 0.15) & (valid == 0)
        out[take] = f[take]
        valid = np.maximum(valid, take.astype(np.float32))
        if valid.min() > 0: break
    return out
art = fill(im, hole)
rng = np.random.default_rng(3)
noise = nd.gaussian_filter(rng.normal(0, 1, (H, W)), 1.0)[..., None] * 0.03
soft = nd.gaussian_filter(hole.astype(np.float32), 2)[..., None]
art = np.clip(im * (1 - soft) + (art + noise) * soft, 0, 1)
Image.fromarray((art * 255).astype(np.uint8)).save(f'{out_dir}/title-art.webp', 'WEBP', quality=82, method=6)

# ロゴ（透明つき）。文字のある範囲だけ切り出す
ys, xs = np.nonzero(alpha > 0.02)
y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
rgba = np.dstack([im, alpha])[y0:y1, x0:x1]
Image.fromarray((rgba * 255).astype(np.uint8)).save(f'{out_dir}/title-logo.webp', 'WEBP', quality=88, method=6)
print('logo box', x0, y0, x1, y1, 'size', x1 - x0, y1 - y0)

# 奥行き：ロゴの所を周りで埋め、中間を広げる（結晶獣と城が分かれるように）
dep = np.asarray(Image.open(depth_src).convert('L'), dtype=np.float32) / 255
dep = fill(dep[..., None], hole)[..., 0]
dep = np.clip(dep, 0, 1) ** 0.5
# 結晶の光の場所（ロゴの青い光は除く）
glow = (hue > 170) & (hue < 205) & (sat > 0.35) & (mx > 0.5) & ~nd.binary_dilation(hole, iterations=3)
# 光らせるのは結晶獣の結晶だけ（主人公の髪や鎧の青い照り返しは除く）
beast_area = np.zeros((H, W), bool)
beast_area[:640, 640:] = True
glow &= beast_area
glow = nd.gaussian_filter(glow.astype(np.float32), 1.5)
glow = np.clip(glow * 1.6, 0, 1)
dmap = np.dstack([dep, glow, np.zeros_like(dep)])
small = Image.fromarray((dmap * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR)
small.save(f'{out_dir}/title-depth.png', optimize=True)
Image.fromarray((dep * 255).astype(np.uint8)).save(f'{preview_dir}/depth-final.png')
Image.fromarray((glow * 255).astype(np.uint8)).save(f'{preview_dir}/glow.png')
Image.fromarray((art * 255).astype(np.uint8)).crop((250, 650, 1450, 941)).save(f'{preview_dir}/art-logo-area.png')

over = im.copy(); over[letters] = [1, 0, 1]
Image.fromarray((over * 255).astype(np.uint8)).crop((290, 700, 1400, 900)).save(f'{preview_dir}/mask-preview.png')
