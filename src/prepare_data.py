"""Build the brand-level label table and a cached 224x224 image array.

Stanford Cars labels every image with make + model + year (196 classes).
We keep only the *make*, which gives 49 car brands.

    python src/prepare_data.py --raw /path/to/stanford-cars

`--raw` must contain the `cars_train/` and `cars_test/` image folders.
"""
import argparse
import json
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.io as sio
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_SIZE = 224
MULTI_WORD_MAKES = ["AM General", "Aston Martin", "Land Rover", "Rolls-Royce", "Mercedes-Benz"]


def make_of(class_name: str) -> str:
    for make in MULTI_WORD_MAKES:
        if class_name.startswith(make):
            return make
    return class_name.split()[0]


def load_annotations(ann_dir: Path) -> pd.DataFrame:
    meta = sio.loadmat(ann_dir / "cars_meta.mat")
    class_names = [str(c[0]) for c in meta["class_names"][0]]
    rows = []
    for split, fname in (("train", "cars_train_annos.mat"), ("test", "cars_test_annos_withlabels.mat")):
        for a in sio.loadmat(ann_dir / fname)["annotations"][0]:
            cid = int(a["class"][0][0]) - 1
            rows.append(dict(
                file=f"cars_{split}/{a['fname'][0]}", split=split, class_id=cid,
                model_name=class_names[cid], brand=make_of(class_names[cid]),
                x1=int(a["bbox_x1"][0][0]), y1=int(a["bbox_y1"][0][0]),
                x2=int(a["bbox_x2"][0][0]), y2=int(a["bbox_y2"][0][0]),
            ))
    return pd.DataFrame(rows)


def add_validation_split(df: pd.DataFrame, frac: float = 0.1, seed: int = 42) -> pd.DataFrame:
    """Hold out `frac` of each brand's training images for validation."""
    rng = np.random.default_rng(seed)
    for _, idx in df[df.split == "train"].groupby("brand").groups.items():
        idx = np.array(idx)
        n_val = max(1, round(len(idx) * frac))
        df.loc[rng.choice(idx, n_val, replace=False), "split"] = "val"
    return df


def load_image(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB").resize((IMG_SIZE, IMG_SIZE), Image.BICUBIC))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, type=Path, help="folder holding cars_train/ and cars_test/")
    ap.add_argument("--cache", type=Path, default=ROOT / "data" / "cache")
    args = ap.parse_args()

    df = add_validation_split(load_annotations(ROOT / "data" / "annotations"))
    brands = sorted(df.brand.unique(), key=str.lower)
    df["brand_id"] = df.brand.map({b: i for i, b in enumerate(brands)})
    df.to_csv(ROOT / "data" / "labels.csv", index=False)
    (ROOT / "data" / "brands.json").write_text(json.dumps(brands, indent=1))
    print(f"{len(df)} images, {len(brands)} brands")
    print(df.split.value_counts().to_string())

    args.cache.mkdir(parents=True, exist_ok=True)
    with Pool() as pool:
        for split in ("train", "val", "test"):
            part = df[df.split == split].reset_index(drop=True)
            X = np.stack(pool.map(load_image, [str(args.raw / f) for f in part.file], chunksize=64))
            np.save(args.cache / f"X_{split}.npy", X)
            np.save(args.cache / f"y_{split}.npy", part.brand_id.to_numpy().astype("int32"))
            part.to_csv(args.cache / f"meta_{split}.csv", index=False)
            print(split, X.shape)


if __name__ == "__main__":
    main()
