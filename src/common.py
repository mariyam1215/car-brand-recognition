"""Helpers shared by the training, evaluation and export scripts."""
import json
import os
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
from sklearn.metrics import accuracy_score, f1_score

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"
IMG_SIZE = 224


def brands() -> list:
    return json.loads((ROOT / "data" / "brands.json").read_text())


def load_split(split: str, cache: Path = CACHE):
    return np.load(cache / f"X_{split}.npy", mmap_mode="r"), np.load(cache / f"y_{split}.npy")


def build_model(num_classes: int, dropout: float = 0.3):
    """Image (0-255 RGB, 224x224) -> EfficientNetV2-B0 -> softmax over brands.

    The EfficientNetV2 backbone rescales raw pixels itself, so the exported
    model takes plain 0-255 values and needs no external preprocessing.
    """
    import keras
    backbone = keras.applications.EfficientNetV2B0(
        include_top=False, weights="imagenet", input_shape=(IMG_SIZE, IMG_SIZE, 3), pooling="avg")
    inp = keras.Input((IMG_SIZE, IMG_SIZE, 3), name="image")
    x = backbone(inp, training=False)
    x = keras.layers.Dropout(dropout)(x)
    out = keras.layers.Dense(num_classes, activation="softmax", name="brand")(x)
    return keras.Model(inp, out, name="car_brand_classifier"), backbone


def class_sample_weights(y: np.ndarray, power: float = 0.5) -> np.ndarray:
    """Per-sample weights ~ (median_count / count)^power, to soften class imbalance."""
    counts = np.maximum(np.bincount(y), 1)
    w = (np.median(counts) / counts) ** power
    return w[y].astype("float32")


def score(y_true: np.ndarray, probs: np.ndarray) -> dict:
    pred = probs.argmax(1)
    top3 = np.argsort(-probs, axis=1)[:, :3]
    return dict(
        top1_accuracy=float(accuracy_score(y_true, pred)),
        top3_accuracy=float(np.mean([t in row for t, row in zip(y_true, top3)])),
        macro_f1=float(f1_score(y_true, pred, average="macro")),
        n=int(len(y_true)),
    )
