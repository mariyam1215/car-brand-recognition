"""Predict the car brand for one or more images (no TensorFlow needed).

    python src/predict.py samples/ford.jpg samples/bmw.jpg --topk 3
    python src/predict.py samples/            # every image in a folder

Prints one JSON object per image. Needs: onnxruntime, numpy, pillow.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
IMG_SIZE = 224
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def load_session(model_path=ROOT / "models" / "car_brand.onnx"):
    return ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])


def preprocess(path) -> np.ndarray:
    """Same preprocessing as training: RGB, squash to 224x224, raw 0-255 floats (NHWC)."""
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return np.asarray(img.resize((IMG_SIZE, IMG_SIZE), Image.BICUBIC), dtype="float32")


def predict(session, labels, paths, topk=3):
    x = np.stack([preprocess(p) for p in paths])
    probs = session.run(None, {"image": x})[0]
    for path, p in zip(paths, probs):
        top = np.argsort(-p)[:topk]
        yield {"image": str(path), "brand": labels[top[0]], "confidence": round(float(p[top[0]]), 4),
               "top": [{"brand": labels[i], "confidence": round(float(p[i]), 4)} for i in top]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+", type=Path, help="image files or folders")
    ap.add_argument("--topk", type=int, default=3)
    ap.add_argument("--model", type=Path, default=ROOT / "models" / "car_brand.onnx")
    args = ap.parse_args()

    paths = []
    for p in args.images:
        paths += sorted(f for f in p.iterdir() if f.suffix.lower() in EXTS) if p.is_dir() else [p]
    labels = json.loads((ROOT / "models" / "labels.json").read_text())
    session = load_session(args.model)
    for i in range(0, len(paths), 32):
        for result in predict(session, labels, paths[i:i + 32], args.topk):
            print(json.dumps(result))


if __name__ == "__main__":
    main()
