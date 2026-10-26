# タイトル絵の奥行きの地図を推定する（Depth Anything V2 Small の ONNX 版を使う）。
# 使い方: python title-depth.py <model.onnx> <絵.png> <出力.png>
# 必要: onnxruntime, numpy, pillow（ゲーム本体には入れない。作業用の環境で）
import sys, numpy as np, onnxruntime as ort
from PIL import Image
model, src, out = sys.argv[1:4]
im = Image.open(src).convert('RGB')
W, H = 924, 518
x = np.asarray(im.resize((W, H), Image.BICUBIC), dtype=np.float32) / 255
x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
x = x.transpose(2, 0, 1)[None].astype(np.float32)
sess = ort.InferenceSession(model)
name = sess.get_inputs()[0].name
print('inputs', [(i.name, i.shape) for i in sess.get_inputs()])
d = sess.run(None, {name: x})[0].squeeze()
print('out', d.shape, d.min(), d.max())
d = (d - d.min()) / (d.max() - d.min())
Image.fromarray((d * 255).astype(np.uint8)).resize(im.size, Image.BICUBIC).save(out)
