# 戦闘曲（CC0、OpenGameArt）を、ゲーム用の m4a に書き出す。
#   music-d：Boss Battle #2（nene）前奏＋繰り返し部分を1つのファイルに（繰り返しは前奏のあとから）
#   music-c：Heavy Battle Music（Davieplier）
#   music-a：Determined Pursuit（Emma_MA）
# 3曲の音量（RMS）をそろえる。繰り返しの位置は src/audio/music.js の MUSIC_TRACKS に書く。
# 使い方: python3 scripts/build-music.py  （素材は assets-src/packs/music/。macOS の afconvert を使う）
import os, subprocess, tempfile, wave
import numpy as np

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


# 配布ファイルは名前が入れ替わっている（"loop" が前奏、"opening" が繰り返し部分）
intro = read(f'{SRC}/metal/x/boss_battle_#2_metal_loop.wav')
loop = read(f'{SRC}/metal/x/boss_battle_#2_metal_opening.wav')
print(f'music-d intro: {len(intro)} samples = {len(intro) / SR:.4f} s')
write('music-d', np.concatenate([intro, loop]))
write('music-c', read(f'{SRC}/heavy/battle1.mp3'))
write('music-a', read(f'{SRC}/pursuit/determined_pursuit_loop.wav'))
