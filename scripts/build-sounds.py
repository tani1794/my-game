# 効果音を作って public/sounds/*.m4a に書き出す。
# - Kenney の CC0 素材（scripts/decode-ogg.mjs で WAV にしたもの）を重ねる
# - 素材に無い音（風切り・地響き・うなり・合図・風）は、ここで合成する
# 使い方：python3 scripts/build-sounds.py
import os
import subprocess
import tempfile
import wave

import numpy as np

RATE = 44100
SOURCE = 'assets-src/packs/sounds/wav'
OUT = 'public/sounds'
rng = np.random.default_rng(7)


def load(name):
    with wave.open(f'{SOURCE}/{name}.wav') as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768


def seconds(t):
    return int(t * RATE)


def envelope(n, attack, release):
    """立ち上がり attack 秒、終わりの release 秒をなめらかにする"""
    env = np.ones(n)
    a = min(seconds(attack), n)
    r = min(seconds(release), n)
    if a:
        env[:a] = np.linspace(0, 1, a) ** 2
    if r:
        env[-r:] *= np.linspace(1, 0, r) ** 2
    return env


def bandpass_sweep(noise, f_start, f_end, q=2.5):
    """白色雑音を、中心周波数を f_start→f_end へ動かす帯域通過フィルタに通す（風切り）"""
    out = np.zeros_like(noise)
    centers = np.geomspace(f_start, f_end, len(noise))
    y1 = y2 = x1 = x2 = 0.0
    for i, x in enumerate(noise):
        w0 = 2 * np.pi * centers[i] / RATE
        alpha = np.sin(w0) / (2 * q)
        b0, b2 = alpha, -alpha
        a0, a1, a2 = 1 + alpha, -2 * np.cos(w0), 1 - alpha
        y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x, y1, y
        out[i] = y
    return out


def lowpass(x, cutoff):
    alpha = 1 - np.exp(-2 * np.pi * cutoff / RATE)
    out = np.zeros_like(x)
    y = 0.0
    for i, v in enumerate(x):
        y += alpha * (v - y)
        out[i] = y
    return out


def whoosh(duration, f_start, f_end, attack=0.04):
    n = seconds(duration)
    sound = bandpass_sweep(rng.standard_normal(n), f_start, f_end)
    # 振りの中ほどが一番強い
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return sound * shape * envelope(n, attack, duration * 0.4)


def thump(duration=0.5, f_start=70, f_end=32):
    n = seconds(duration)
    t = np.arange(n) / RATE
    freq = np.geomspace(f_start, f_end, n)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    return np.sin(phase) * np.exp(-t * 7) * envelope(n, 0.003, 0.05)


def rumble(duration=1.0):
    n = seconds(duration)
    low = lowpass(lowpass(rng.standard_normal(n), 160), 160)
    t = np.arange(n) / RATE
    wobble = 0.7 + 0.3 * np.sin(2 * np.pi * 9 * t)
    return low * wobble * envelope(n, 0.12, 0.35) + 0.5 * thump(duration, 55, 40)


def growl(duration=1.3):
    n = seconds(duration)
    t = np.arange(n) / RATE
    freq = 62 + 6 * np.sin(2 * np.pi * 1.5 * t)
    phase = np.cumsum(freq) / RATE
    saw = 2 * (phase % 1) - 1
    tremolo = 0.6 + 0.4 * np.sin(2 * np.pi * 11 * t)
    body = lowpass(lowpass(saw * tremolo, 420), 420)
    breath = lowpass(rng.standard_normal(n), 900) * 0.25
    return (body + breath) * envelope(n, 0.15, 0.5)


def warn():
    """低い2つの合図（予告）"""
    def pulse():
        n = seconds(0.16)
        t = np.arange(n) / RATE
        return (np.sin(2 * np.pi * 98 * t) + 0.4 * np.sin(2 * np.pi * 196 * t)) * envelope(n, 0.005, 0.1)
    gap = np.zeros(seconds(0.06))
    return np.concatenate([pulse(), gap, pulse() * 0.8])


def wind(duration=20.0):
    """谷を渡る風：ゆっくりうねる低い雑音。最初と最後をつないで継ぎ目なく繰り返せる"""
    n = seconds(duration)
    t = np.arange(n) / RATE
    noise = lowpass(lowpass(rng.standard_normal(n), 500), 500)
    # 20 秒で割り切れる周期のうねりにして、繰り返しの継ぎ目でずれないようにする
    swell = 0.55 + 0.25 * np.sin(2 * np.pi * t / 10) + 0.2 * np.sin(2 * np.pi * t / 4 + 1)
    whistle = bandpass_sweep(rng.standard_normal(n) * 0.3, 700, 700, q=8) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 5))
    sound = noise * swell + whistle * 0.35
    fade = seconds(1.0)
    looped = sound[:n - fade].copy()
    looped[:fade] = looped[:fade] * np.linspace(0, 1, fade) + sound[n - fade:] * np.linspace(1, 0, fade)
    return looped


def mix(*parts):
    """(音, 開始秒, 音量) を重ねる"""
    length = max(seconds(start) + len(sound) for sound, start, _ in parts)
    out = np.zeros(length)
    for sound, start, gain in parts:
        s = seconds(start)
        out[s:s + len(sound)] += sound * gain
    return out


def pitch(sound, factor):
    """再生速度を変えて高さを変える（factor > 1 で高く短く）"""
    positions = np.arange(0, len(sound) - 1, factor)
    return np.interp(positions, np.arange(len(sound)), sound)


def normalize(sound, peak=0.9):
    top = np.max(np.abs(sound))
    return sound if top == 0 else sound / top * peak


def write_m4a(name, sound):
    data = (np.clip(normalize(sound), -1, 1) * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, f'{name}.wav')
        with wave.open(path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(data.tobytes())
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', '-c', '1', path, f'{OUT}/{name}.m4a'], check=True)
    print(f'{name}.m4a  {len(sound) / RATE:.2f}s')


SOUNDS = {
    'swing1': lambda: mix((whoosh(0.22, 400, 1800), 0, 1), (load('knifeSlice'), 0.03, 0.25)),
    'swing2': lambda: mix((whoosh(0.22, 600, 2300), 0, 1), (pitch(load('knifeSlice'), 1.12), 0.03, 0.25)),
    'swing3': lambda: mix((whoosh(0.32, 250, 1200), 0, 1.2), (load('chop'), 0.12, 0.35)),
    'hit': lambda: mix((load('impactMining_000'), 0, 0.9), (load('impactGlass_light_000'), 0.01, 0.6)),
    'dodge': lambda: mix((load('cloth1'), 0, 0.8), (load('impactSoft_medium_000'), 0.25, 0.5)),
    'hurt': lambda: load('impactPunch_heavy_000'),
    'step': lambda: load('footstep_grass_000'),
    'warn': warn,
    'slam': lambda: mix((thump(0.6), 0, 1.0), (load('impactWood_heavy_000'), 0, 0.8), (load('impactMining_002'), 0.02, 0.5)),
    'crystal': lambda: mix((load('impactGlass_heavy_000'), 0, 1), (thump(0.25, 90, 50), 0, 0.4)),
    'charge': lambda: rumble(1.0),
    'spin': lambda: whoosh(0.6, 200, 900, attack=0.08),
    'stagger': lambda: mix((load('impactGlass_medium_000'), 0, 1), (load('impactMining_002'), 0.05, 0.6)),
    'enrage': lambda: growl(1.3),
    'shatter': lambda: mix((load('glass_001'), 0, 0.8), (load('impactGlass_heavy_000'), 0.02, 0.8), (load('impactGlass_medium_000'), 0.12, 0.6), (thump(0.5), 0, 0.5)),
    'win': lambda: load('jingles_SAX15'),
    'lose': lambda: load('jingles_PIZZI00'),
    'click': lambda: load('click_001'),
    'wind': lambda: wind(20.0),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for sound_name, build in SOUNDS.items():
        write_m4a(sound_name, build())
