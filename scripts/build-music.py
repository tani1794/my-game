# 戦闘曲とタイトル曲（CC0、OpenGameArt）を、ゲーム用の m4a に書き出す。
#   music-d：Boss Battle #2（nene）前奏＋繰り返し部分を1つのファイルに（繰り返しは前奏のあとから）
#   music-c：Heavy Battle Music（Davieplier）
#   music-a：Determined Pursuit（Emma_MA）
#   music-title：Vampire's Piano（TAD）タイトル画面の曲（処理なし）
# 戦闘曲の3曲は、タイトル曲の暗さに寄せて「少し遅く・低く、高音を削り、残響を足す」処理をかける（2026-10-26、ユーザーが選んだ版）。
# 繰り返す部分は2周つないで処理し、2周目を使う（継ぎ目でも、前の周回からの残響が自然につながる）。
# 曲の音量（RMS）をそろえる。繰り返しの位置は src/audio/music.js の MUSIC_TRACKS に書く（下に表示するサンプル数）。
# 使い方: python3 scripts/build-music.py  （素材は assets-src/packs/music/。macOS の afconvert を使う）
import os, subprocess, tempfile, wave
import numpy as np
from scipy import signal

SRC = 'assets-src/packs/music'
OUT = 'public/sounds'
SR = 44100
TARGET_RMS = 0.16


def read(path):
    if path.endswith('.mp3'):
        tmp = tempfile.mktemp(suffix='.wav')
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEI16@{SR}', path, tmp], check=True)
        path = tmp
    w = wave.open(path)
    assert w.getframerate() == SR, path
    ch = w.getnchannels()
    data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, ch).astype(np.float32) / 32768
    return np.repeat(data, 2, 1) if ch == 1 else data


def write(name, data):
    data = np.clip(data * (TARGET_RMS / np.sqrt((data ** 2).mean())), -1, 1)
    tmp = tempfile.mktemp(suffix='.wav')
    w = wave.open(tmp, 'wb')
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((data * 32767).astype(np.int16).tobytes())
    w.close()
    out = f'{OUT}/{name}.m4a'
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', tmp, out], check=True)
    os.remove(tmp)
    print(f'{name}: {len(data)} samples = {len(data) / SR:.4f} s, {os.path.getsize(out) // 1024} KB')


# 暗くする処理：速さ 0.9 倍（音も少し低くなる）、3.8kHz より上を削り、約2.6秒の残響を足す
SLOW_UP, SLOW_DOWN = 10, 9


def darken(data):
    y = signal.resample_poly(data, SLOW_UP, SLOW_DOWN, axis=0)
    b, a = signal.butter(2, 3800 / (SR / 2), 'low')
    y = signal.lfilter(b, a, y, axis=0)
    rng = np.random.default_rng(1)
    n = int(SR * 2.6)
    ir = rng.normal(0, 1, (n, 2)) * np.exp(-np.arange(n) / (SR * 0.7))[:, None]
    b2, a2 = signal.butter(1, 2500 / (SR / 2), 'low')
    ir = signal.lfilter(b2, a2, ir, axis=0)
    ir /= np.sqrt((ir ** 2).sum(0))
    wet = np.stack([signal.fftconvolve(y[:, c], ir[:, c])[:len(y)] for c in range(2)], 1)
    return (y * 0.75 + wet * 0.45).astype(np.float32)


def slowed(samples):
    return round(samples * SLOW_UP / SLOW_DOWN)


# 前奏のあとに繰り返し部分を2周つないで処理し、前奏＋2周目を書き出す
def dark_loop(name, intro, loop):
    whole = darken(np.concatenate([intro, loop, loop]))
    start = slowed(len(intro))
    end = slowed(len(intro) + 2 * len(loop))
    second = whole[slowed(len(intro) + len(loop)):end]
    out = np.concatenate([whole[:start], second])
    print(f'{name}: loopStart {start} samples, loopEnd {len(out)} samples')
    write(name, out)


# 配布ファイルは名前が入れ替わっている（"loop" が前奏、"opening" が繰り返し部分）
intro = read(f'{SRC}/metal/x/boss_battle_#2_metal_loop.wav')
loop = read(f'{SRC}/metal/x/boss_battle_#2_metal_opening.wav')
dark_loop('music-d', intro, loop)
empty = np.zeros((0, 2), np.float32)
dark_loop('music-c', empty, read(f'{SRC}/heavy/battle1.mp3'))
dark_loop('music-a', empty, read(f'{SRC}/pursuit/determined_pursuit_loop.wav'))
write('music-title', read(f'{SRC}/title/vampire.wav'))
