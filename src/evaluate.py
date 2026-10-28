"""Evaluate the exported ONNX model on the official Stanford Cars test split.

    python src/evaluate.py

Writes metrics and figures to reports/.
"""
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import onnxruntime as ort
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from sklearn.metrics import classification_report, confusion_matrix

from common import CACHE, MODELS, REPORTS, brands, load_split, score

BLUE = "#2a78d6"
INK, MUTED, GRID = "#0b0b0b", "#52514e", "#e5e4e0"
plt.rcParams.update({"font.family": "DejaVu Sans", "axes.edgecolor": GRID, "axes.labelcolor": MUTED,
                     "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK,
                     "axes.spines.top": False, "axes.spines.right": False})


def predict_probs(X, batch=64):
    sess = ort.InferenceSession(str(MODELS / "car_brand.onnx"), providers=["CPUExecutionProvider"])
    return np.concatenate([sess.run(None, {"image": np.asarray(X[i:i + batch], dtype="float32")})[0]
                           for i in range(0, len(X), batch)])


def plot_confusion(cm, names, path):
    cmn = cm / cm.sum(1, keepdims=True)
    fig, ax = plt.subplots(figsize=(13, 11.5))
    im = ax.imshow(cmn, cmap=LinearSegmentedColormap.from_list("blue", ["#ffffff", BLUE, "#0d2f5c"]),
                   vmin=0, vmax=1)
    ax.set_xticks(range(len(names)), names, rotation=90, fontsize=8)
    ax.set_yticks(range(len(names)), names, fontsize=8)
    ax.set_xlabel("Predicted brand"); ax.set_ylabel("True brand")
    ax.set_title("Confusion matrix on the test set (row-normalised)", loc="left", fontsize=13)
    fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02, label="share of true-brand images")
    fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def plot_per_brand(report, path):
    df = pd.DataFrame(report).T.loc[brands()].sort_values("f1-score")
    fig, ax = plt.subplots(figsize=(8, 10))
    ax.barh(df.index, df["f1-score"], color=BLUE, height=0.65)
    ax.set_xlim(0, 1); ax.set_xlabel("F1 score on the test set")
    ax.set_title("F1 score per brand", loc="left", fontsize=13)
    ax.xaxis.grid(True, color=GRID); ax.set_axisbelow(True)
    for y, (v, n) in enumerate(zip(df["f1-score"], df["support"])):
        ax.text(min(v + 0.01, 0.93), y, f"{v:.2f}", va="center", fontsize=8, color=MUTED)
    ax.tick_params(axis="y", labelsize=8)
    fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def plot_curves(hist, path):
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.6))
    ep = np.arange(1, len(hist["loss"]) + 1)
    for ax, key, title in zip(axes, ("loss", "accuracy"), ("Loss", "Accuracy")):
        ax.plot(ep, hist[key], color=BLUE, lw=2, label="training")
        ax.plot(ep, hist["val_" + key], color=BLUE, lw=2, ls="--", label="validation")
        ax.set_title(title, loc="left"); ax.set_xlabel("epoch"); ax.legend(frameon=False)
        ax.yaxis.grid(True, color=GRID); ax.set_axisbelow(True)
    fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def plot_samples(meta, X, probs, y, names, path, n=12, seed=3):
    idx = np.random.default_rng(seed).choice(len(y), n, replace=False)
    fig, axes = plt.subplots(3, 4, figsize=(11, 8.2))
    for ax, i in zip(axes.ravel(), idx):
        pred = probs[i].argmax()
        ok = pred == y[i]
        ax.imshow(np.asarray(X[i])); ax.axis("off")
        ax.set_title(f"{names[pred]}  {probs[i, pred]:.0%}\n(true: {names[y[i]]})", fontsize=9,
                     color=INK if ok else "#b3261e")
    fig.suptitle("Random test images: prediction, confidence and true brand (red = wrong)", x=0.02,
                 ha="left", fontsize=12)
    fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def main():
    REPORTS.mkdir(exist_ok=True)
    names = brands()
    X, y = load_split("test")
    probs = predict_probs(X)
    pred = probs.argmax(1)

    cm = confusion_matrix(y, pred, labels=range(len(names)))
    report = classification_report(y, pred, labels=range(len(names)), target_names=names,
                                   output_dict=True, zero_division=0)
    pd.DataFrame(report).T.loc[names + ["macro avg", "weighted avg"]].round(4).to_csv(REPORTS / "per_brand.csv")

    pairs = [(names[i], names[j], int(cm[i, j])) for i in range(len(names)) for j in range(len(names))
             if i != j and cm[i, j]]
    pd.DataFrame(sorted(pairs, key=lambda t: -t[2])[:15],
                 columns=["true_brand", "predicted_as", "images"]).to_csv(REPORTS / "top_confusions.csv", index=False)

    train = json.loads((REPORTS / "training.json").read_text())
    metrics = {"test": score(y, probs), "validation": train["finetune"]["val"],
               "linear_probe_test": train["linear_probe"]["test"], "classes": len(names)}
    (REPORTS / "metrics.json").write_text(json.dumps(metrics, indent=1))
    print(json.dumps(metrics, indent=1))

    plot_confusion(cm, names, REPORTS / "confusion_matrix.png")
    plot_per_brand(report, REPORTS / "per_brand_f1.png")
    plot_curves(train["finetune"]["history"], REPORTS / "training_curves.png")
    plot_samples(pd.read_csv(CACHE / "meta_test.csv"), X, probs, y, names, REPORTS / "sample_predictions.png")


if __name__ == "__main__":
    main()
