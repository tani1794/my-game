# 第一章の質感（タイル状に並べられる画像）を、乱数と計算で描いて public/textures/chapter/ に書き出す。
#   stone.webp / stone-normal.webp   切り石の壁（目地・雨染み・苔）。1枚で 2m 四方
#   ground.webp                       森の湿った地面（土・落ち葉・苔）。1枚で 4m 四方
#   slate.webp                        屋根の石板
#   wood.webp                         古い木材（長椅子・門の板）
#   mural.webp                        祭壇脇の壁画（王冠を持つ人物、色あせた漆喰）
# 使い方: python3 scripts/build-chapter-textures.py
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

OUT = 'public/textures/chapter'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def tile_noise(size, scale, octaves=4, seed=0):
    # 端がつながるノイズ（周期的な格子の値を補間）
    r = np.random.default_rng(seed)
    total = np.zeros((size, size))
    amp = 1.0
    norm = 0.0
    for o in range(octaves):
        cells = max(2, int(scale * 2 ** o))
        grid = r.random((cells, cells))
        grid = np.pad(grid, ((0, 1), (0, 1)), mode='wrap')
        img = Image.fromarray((grid * 255).astype(np.uint8)).resize((size + size // cells, size + size // cells), Image.BICUBIC)
        arr = np.asarray(img, dtype=np.float64)[:size, :size] / 255
        total += arr * amp
        norm += amp
        amp *= 0.5
    return total / norm


def save(name, rgb):
    Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8)).save(f'{OUT}/{name}.webp', 'WEBP', quality=85, method=6)


def normal_from_height(height, strength):
    gx = np.roll(height, -1, 1) - np.roll(height, 1, 1)
    gy = np.roll(height, -1, 0) - np.roll(height, 1, 0)
    n = np.dstack([-gx * strength, gy * strength, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


# ── 切り石の壁：横長の石を互い違いに積む（4段 × 8段で 2m） ──
S = 512
rows = 8
row_h = S // rows
height = np.ones((S, S))
albedo = np.zeros((S, S, 3))
yy, xx = np.mgrid[0:S, 0:S]
for r in range(rows):
    y0 = r * row_h
    offset = (r % 2) * 64 + int(rng.integers(-12, 12))
    x = -offset
    while x < S:
        w = int(rng.integers(96, 170))
        tone = 0.5 + rng.normal(0, 0.05)
        warm = rng.normal(0, 0.015)
        for dx in range(w):
            col = (x + dx) % S
            albedo[y0:y0 + row_h, col] = [tone + warm, tone, tone - warm * 0.5]
        # 目地（縦）
        for dx in range(-2, 3):
            height[y0:y0 + row_h, (x + dx) % S] = np.minimum(height[y0:y0 + row_h, (x + dx) % S], 0.15 + abs(dx) * 0.2)
        x += w
    # 目地（横）
    for dy in range(-2, 3):
        height[(y0 + dy) % S, :] = np.minimum(height[(y0 + dy) % S, :], 0.15 + abs(dy) * 0.2)
grain = tile_noise(S, 6, 5, seed=1)
chips = tile_noise(S, 24, 3, seed=2)
height = height * (0.85 + 0.15 * grain) - 0.08 * (chips > 0.72)
mortar = height < 0.5
albedo[mortar] = albedo[mortar] * 0.55
albedo *= (0.82 + 0.3 * grain)[..., None]
# 雨染み：上から下へ流れる暗い筋
streaks = nd.gaussian_filter(rng.random((1, S)), (0, 3)).repeat(S, 0)
streaks = (streaks - streaks.min()) / (streaks.max() - streaks.min())
rain = np.clip((streaks - 0.55) * 2.5, 0, 1) * (0.4 + 0.6 * tile_noise(S, 3, 2, seed=3))
albedo *= (1 - 0.35 * rain)[..., None]
# 苔：下の方の目地の近くに緑
moss = np.clip((tile_noise(S, 5, 4, seed=4) - 0.58) * 4, 0, 1)
moss = np.maximum(moss, mortar * np.clip((tile_noise(S, 10, 3, seed=5) - 0.45) * 3, 0, 1))
albedo = albedo * (1 - moss[..., None] * 0.7) + np.array([0.2, 0.27, 0.12]) * moss[..., None] * 0.7
save('stone', albedo)
save('stone-normal', normal_from_height(nd.gaussian_filter(height, 1.2), 3.5))

# ── 森の地面：湿った土に落ち葉と苔 ──
G = 512
soil = tile_noise(G, 4, 5, seed=10)
ground = np.dstack([0.16 + 0.1 * soil, 0.13 + 0.08 * soil, 0.09 + 0.05 * soil])
moss_g = np.clip((tile_noise(G, 3, 4, seed=11) - 0.45) * 3, 0, 1)
ground = ground * (1 - moss_g[..., None]) + np.dstack([0.12 + 0.08 * soil, 0.2 + 0.1 * soil, 0.08 + 0.04 * soil]) * moss_g[..., None]
img = Image.fromarray(np.clip(ground * 255, 0, 255).astype(np.uint8))
draw = ImageDraw.Draw(img)
for _ in range(900):
    cx, cy = rng.integers(0, G, 2)
    r = int(rng.integers(3, 8))
    hue = rng.choice([(92, 58, 30), (70, 48, 26), (110, 80, 40), (55, 45, 30)])
    shade = rng.uniform(0.6, 1.05)
    color = tuple(int(c * shade) for c in hue)
    angle = rng.uniform(0, np.pi)
    pts = [(cx + r * np.cos(angle + a) * (1 if i % 2 == 0 else 0.45), cy + r * np.sin(angle + a) * (1 if i % 2 == 0 else 0.45)) for i, a in enumerate(np.linspace(0, 2 * np.pi, 7)[:-1])]
    for ox in (-G, 0, G):
        for oy in (-G, 0, G):
            draw.polygon([(px + ox, py + oy) for px, py in pts], fill=color)
img = img.filter(ImageFilter.GaussianBlur(0.6))
save('ground', np.asarray(img, dtype=np.float64) / 255 * (0.85 + 0.25 * tile_noise(G, 8, 3, seed=12))[..., None])

# ── 屋根の石板 ──
R = 256
slate = np.zeros((R, R, 3))
for r in range(8):
    y0 = r * 32
    off = (r % 2) * 16
    for c in range(-1, 9):
        x0 = c * 32 + off
        tone = 0.24 + rng.normal(0, 0.03)
        for y in range(y0, y0 + 32):
            fade = 1 - 0.35 * (y - y0) / 32
            for x in range(x0 + 1, x0 + 31):
                slate[y % R, x % R] = [tone * fade, tone * fade * 1.03, tone * fade * 1.1]
slate *= (0.85 + 0.3 * tile_noise(R, 6, 3, seed=20))[..., None]
save('slate', slate)

# ── 古い木材 ──
W = 256
grain_w = tile_noise(W, 2, 3, seed=30)
lines = 0.5 + 0.5 * np.sin((np.arange(W)[None, :] / W * 2 * np.pi * 18) + grain_w * 9)
wood = np.dstack([0.24 + 0.08 * lines, 0.17 + 0.05 * lines, 0.11 + 0.03 * lines]) * (0.8 + 0.3 * tile_noise(W, 10, 3, seed=31))[..., None]
save('wood', wood)

# ── 壁画：色あせた漆喰に、王冠を持つ人物（左右が逆さまにならないよう、正面から見た図） ──
M = 512
plaster = tile_noise(M, 5, 5, seed=40)
mural = Image.fromarray(np.clip(np.dstack([0.62 + 0.12 * plaster, 0.55 + 0.1 * plaster, 0.42 + 0.08 * plaster]) * 255, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(mural)
# 尖頭アーチの枠
d.polygon([(64, 500), (64, 170), (256, 24), (448, 170), (448, 500)], outline=(70, 52, 38), width=10)
# 背景の青（剥げている）
d.polygon([(80, 492), (80, 176), (256, 44), (432, 176), (432, 492)], fill=(64, 86, 112))
# 光輪
d.ellipse((196, 108, 316, 228), fill=(196, 168, 92))
# 人物：長い衣、両手で王冠を掲げる
d.polygon([(256, 150), (300, 205), (330, 470), (182, 470), (212, 205)], fill=(118, 40, 36))
d.ellipse((224, 128, 288, 196), fill=(206, 172, 138))
d.polygon([(214, 230), (180, 150), (196, 144), (232, 222)], fill=(118, 40, 36))
d.polygon([(298, 230), (332, 150), (316, 144), (280, 222)], fill=(118, 40, 36))
# 掲げた王冠
d.polygon([(204, 112), (214, 80), (232, 104), (256, 70), (280, 104), (298, 80), (308, 112)], fill=(214, 176, 72), outline=(120, 90, 40))
# 足元の白い花
for fx in (150, 200, 312, 362):
    for k in range(5):
        a = k / 5 * 2 * np.pi
        d.ellipse((fx + 9 * np.cos(a) - 6, 452 + 9 * np.sin(a) - 6, fx + 9 * np.cos(a) + 6, 452 + 9 * np.sin(a) + 6), fill=(232, 228, 214))
    d.ellipse((fx - 4, 448, fx + 4, 456), fill=(200, 170, 60))
arr = np.asarray(mural, dtype=np.float64) / 255
# 色あせ・剥落・ひび
flake = tile_noise(M, 9, 4, seed=41) > 0.68
arr[flake] = arr[flake] * 0.35 + np.array([0.62, 0.56, 0.44]) * 0.65
arr = arr * 0.8 + np.array([0.6, 0.55, 0.45]) * 0.2
crack = np.zeros((M, M))
for _ in range(14):
    x, y = rng.integers(0, M, 2).astype(float)
    a = rng.uniform(0, 2 * np.pi)
    for _ in range(int(rng.integers(40, 140))):
        a += rng.normal(0, 0.35)
        x = (x + np.cos(a)) % M
        y = (y + np.sin(a)) % M
        crack[int(y), int(x)] = 1
crack = nd.binary_dilation(crack > 0, iterations=1)
arr[crack] *= 0.45
arr *= (0.85 + 0.2 * plaster)[..., None]
save('mural', arr)
print('wrote', sorted(os.listdir(OUT)))
