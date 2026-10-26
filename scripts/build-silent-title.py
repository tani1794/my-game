# タイトル画面「THE SILENT CROWN」の素材を作る。
#   - 焼き込まれた題字を消し、地面を穴埋めAI（LaMa）で埋めた絵   public/textures/silent-art.webp
#   - 元の意匠のまま切り出した透過の題字                         public/textures/silent-title.webp
#   - 奥行きの地図（R=奥行き）                                   public/textures/silent-depth.png
#   - 動かす場所の地図（R=枝葉、G=マント、B=空）                 public/textures/silent-masks.png
# 使い方: python build-silent-title.py <元の絵.png> <Depth Anything V2 Small の model.onnx> <LaMa の lama_fp32.onnx> <確認用の出力フォルダ>
# 必要: onnxruntime, numpy, scipy, pillow（ゲーム本体には入れない。作業用の環境で）
import sys
import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage as nd

SOURCE, DEPTH_MODEL, LAMA_MODEL, PREVIEW = sys.argv[1:5]
OUT = 'public/textures'

im = np.asarray(Image.open(SOURCE).convert('RGB'), dtype=np.float32) / 255
H, W, _ = im.shape
lum = im @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
mx, mn = im.max(-1), im.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)


def box(y0, y1, x0, x1):
    m = np.zeros((H, W), bool)
    m[y0:y1, x0:x1] = True
    return m


# ── 題字：明るい銀色で、彩度が低い。文字・線・ひし形の範囲に限る ──
area = box(666, 714, 755, 912) | box(714, 840, 400, 1276) | box(815, 872, 812, 862)
lines = box(682, 697, 420, 1262) | box(834, 852, 420, 1262)
letters = (area & (lum > 0.34) & (sat < 0.34)) | (lines & (lum > 0.26) & (sat < 0.38))
# 「C」の上に入りこむ明るい岩は文字ではない
letters &= ~box(708, 727, 880, 965)
# 上の線の右端の上にある明るい岩も除く
letters &= ~box(660, 683, 1130, 1262)
lab, n = nd.label(letters)
sizes = nd.sum(letters, lab, range(1, n + 1))
letters = np.isin(lab, 1 + np.flatnonzero(sizes > 40))
letters = nd.binary_closing(letters, iterations=2) | letters
ring = nd.binary_dilation(letters, iterations=4) & ~letters

alpha = np.zeros((H, W), np.float32)
alpha[letters] = 1
alpha = np.maximum(alpha, ring * 0.7)
alpha = nd.gaussian_filter(alpha, 0.6)
alpha[~nd.binary_dilation(letters, iterations=5)] = 0
ys, xs = np.nonzero(alpha > 0.02)
y0, y1, x0, x1 = ys.min() - 3, ys.max() + 4, xs.min() - 3, xs.max() + 4
Image.fromarray((np.dstack([im, alpha])[y0:y1, x0:x1] * 255).astype(np.uint8)).save(f'{OUT}/silent-title.webp', 'WEBP', quality=90, method=6)
print('title box', x0, y0, x1, y1, '-> left %.4f top %.4f width %.4f height %.4f' % (x0 / W, y0 / H, (x1 - x0) / W, (y1 - y0) / H))

# ── 題字を消す：LaMa で 512×512 ずつ埋める（2枚目は1枚目の結果を使う） ──
hole = nd.binary_dilation(letters, iterations=10)
lama = ort.InferenceSession(LAMA_MODEL)
art = im.copy()
for cx0 in [380, 780]:
    cy0 = H - 512
    crop = art[cy0:cy0 + 512, cx0:cx0 + 512]
    m = hole[cy0:cy0 + 512, cx0:cx0 + 512].astype(np.float32)
    out = lama.run(None, {'image': crop.transpose(2, 0, 1)[None].astype(np.float32), 'mask': m[None, None]})[0][0].transpose(1, 2, 0)
    if out.max() > 2:
        out = out / 255
    soft = nd.gaussian_filter(m, 1.5)[..., None]
    art[cy0:cy0 + 512, cx0:cx0 + 512] = crop * (1 - soft) + np.clip(out, 0, 1) * soft
Image.fromarray((art * 255).astype(np.uint8)).save(f'{OUT}/silent-art.webp', 'WEBP', quality=84, method=6)
Image.fromarray((art * 255).astype(np.uint8)).crop((380, 600, 1300, 900)).save(f'{PREVIEW}/silent-art-title-area.png')

# ── 奥行き：Depth Anything V2（近いほど大きい）。題字の場所は消したあとの絵で推定し直す ──
depth_session = ort.InferenceSession(DEPTH_MODEL)
x = np.asarray(Image.fromarray((art * 255).astype(np.uint8)).resize((924, 518), Image.BICUBIC), dtype=np.float32) / 255
x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
d = depth_session.run(None, {depth_session.get_inputs()[0].name: x})[0].squeeze()
d = (d - d.min()) / (d.max() - d.min())
depth = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float32) / 255
depth = np.clip(depth, 0, 1) ** 0.6
Image.fromarray((depth * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR).save(f'{OUT}/silent-depth.png', optimize=True)

# ── 空：奥行きがちょうど 0 の所（霧でかすんだ城や山は 0.014 以上あるので含まれない）。上の方だけ ──
alum = art @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
sky = (depth < 0.006) & (np.arange(H)[:, None] < H * 0.42)
sky = nd.binary_opening(sky, iterations=2)
lab, n = nd.label(sky)
top_labels = set(np.unique(lab[:4, :])) - {0}
sky = np.isin(lab, list(top_labels))
sky = nd.binary_fill_holes(sky)
sky_soft = nd.gaussian_filter(nd.binary_erosion(sky, iterations=2).astype(np.float32), 1.2)

# ── 枝葉：揺らすのは葉の茂る場所だけ（上の枝葉と、右の木の葉、下の草花）。太い幹・人物・地面は揺らさない ──
detail = nd.gaussian_filter(np.abs(alum - nd.gaussian_filter(alum, 2)), 2)
yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W], dtype=np.float32)[:, None, None]
leaf_zone = ((yy < 0.17) & (xx > 0.12) & (xx < 0.52)) | ((yy < 0.09) & (xx < 0.12)) | ((xx > 0.885) & (xx < 0.955) & (yy < 0.4))
leaves = leaf_zone & (depth > 0.2) & (detail > 0.03)
# 枝の先ほど大きく：上の枝葉は上へ行くほど、右の木は外側ほど
reach = np.where(xx > 0.885, np.clip((0.955 - xx) / 0.05, 0.3, 1), np.clip((0.17 - yy) / 0.12, 0.3, 1))
foliage_w = nd.gaussian_filter(leaves.astype(np.float32), 2.5) * reach
flower_zone = (yy > 0.74) & ((xx < 0.24) | (xx > 0.78))
flowers = flower_zone & (depth > 0.45) & (detail > 0.05)
foliage_w = np.maximum(foliage_w, nd.gaussian_filter(flowers.astype(np.float32), 2.5) * 0.4)
foliage_w = np.clip(foliage_w * 1.8, 0, 1)

# ── マント：肩から裾へ広がる三角の範囲で、手前（奥行き 0.45 以上）の所。肩は0、腰から下で大きく、地面に広がる裾は小さく。脚と剣は除く ──
from PIL import ImageDraw
poly = Image.new('L', (W, H), 0)
ImageDraw.Draw(poly).polygon([(440, 300), (520, 300), (505, 470), (500, 690), (130, 690), (150, 630)], fill=255)
cape_area = (np.asarray(poly) > 0) & (depth > 0.45)
cape_y = np.clip((yy - 0.36) / 0.2, 0, 1) * np.clip((0.73 - yy) / 0.08, 0, 1)
cape = nd.gaussian_filter(cape_area.astype(np.float32), 4) * cape_y

masks = np.dstack([foliage_w, cape, sky_soft])
Image.fromarray((masks * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR).save(f'{OUT}/silent-masks.png', optimize=True)
for name, m in [('foliage', foliage_w), ('cape', cape), ('sky', sky_soft), ('depth', depth)]:
    Image.fromarray((m * 255).astype(np.uint8)).resize((W // 2, H // 2)).save(f'{PREVIEW}/silent-{name}.png')
print('done')
