"""Render web/index.html (static, crawlable) from the metrics, reports and web/links.json.

    python src/build_site.py --raw /path/to/stanford-cars   # first time: also picks demo photos
    python src/build_site.py                                # after editing web/links.json

Edit web/links.json (GitHub, report, slides, YouTube, LinkedIn), re-run, then deploy `web/`.
"""
import argparse
import html
import json
import re
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

from common import REPORTS, ROOT
from update_links import apply as apply_links

WEB = ROOT / "web"
SAMPLE_BRANDS = ["Audi", "BMW", "Mercedes-Benz", "Toyota", "Ford", "Ferrari", "Lamborghini",
                 "Honda", "Tesla", "Porsche", "Bentley", "Jeep"]
pct = lambda v: f"{v * 100:.1f}%"
esc = html.escape


def make_samples(raw):
    """One random test photo for each showcase brand (fixed seed; not filtered by correctness)."""
    meta = pd.read_csv(ROOT / "data" / "labels.csv")
    test = meta[meta.split == "test"]
    rng = np.random.default_rng(7)
    out = WEB / "samples"
    out.mkdir(exist_ok=True)
    for brand in SAMPLE_BRANDS:
        row = test[test.brand == brand].sample(1, random_state=int(rng.integers(1e6))).iloc[0]
        img = Image.open(raw / row.file).convert("RGB")
        img.thumbnail((640, 640))
        img.save(out / f"{brand.lower().replace(' ', '-')}.jpg", quality=85)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, help="Stanford Cars folder, to pick demo photos")
    args = ap.parse_args()
    if args.raw:
        make_samples(args.raw)

    links = json.loads((WEB / "links.json").read_text())
    metrics = json.loads((REPORTS / "metrics.json").read_text())
    train = json.loads((REPORTS / "training.json").read_text())
    per = pd.read_csv(REPORTS / "per_brand.csv", index_col=0)
    labels = pd.read_csv(ROOT / "data" / "labels.csv")
    train_counts = labels[labels.split.isin(["train", "val"])].groupby("brand").size()
    all_counts = labels.groupby("brand").size()
    brands = json.loads((ROOT / "data" / "brands.json").read_text())

    for fig in ("training_curves", "sample_predictions", "per_brand_f1", "confusion_matrix"):
        shutil.copy(REPORTS / f"{fig}.png", WEB / "img" / f"{fig}.png")

    p = per.loc[brands].sort_values("f1-score", ascending=False)
    names = lambda df: ", ".join(df.index)
    brand_rows = "\n".join(
        f'<tr><td>{esc(b)}</td><td class="n">{train_counts[b]}</td><td class="n">{int(r["support"])}</td>'
        f'<td class="n">{r["precision"]:.2f}</td><td class="n">{r["recall"]:.2f}</td><td class="n">{r["f1-score"]:.2f}</td></tr>'
        for b, r in p.iterrows())
    conf_rows = "\n".join(
        f'<tr><td>{esc(r.true_brand)}</td><td>{esc(r.predicted_as)}</td><td class="n">{r.images}</td></tr>'
        for r in pd.read_csv(REPORTS / "top_confusions.csv").head(10).itertuples())
    samples = sorted((WEB / "samples").glob("*.jpg"))
    sample_buttons = "".join(
        f'<button type="button" data-sample="samples/{s.name}" aria-label="Example photo {i + 1}">'
        f'<img src="samples/{s.name}" alt="" loading="lazy"></button>' for i, s in enumerate(samples))
    chips = "".join(f'<span class="chip">{esc(b)} <small>{all_counts[b]}</small></span>'
                    for b in sorted(brands, key=lambda b: -all_counts[b]))

    fill = {
        "TOP1": pct(metrics["test"]["top1_accuracy"]), "TOP3": pct(metrics["test"]["top3_accuracy"]),
        "F1": f'{metrics["test"]["macro_f1"]:.2f}', "PROBE_TOP1": pct(metrics["linear_probe_test"]["top1_accuracy"]),
        "N_IMAGES": f"{len(labels):,}", "N_TRAIN": f'{(labels.split == "train").sum():,}',
        "N_VAL": f'{(labels.split == "val").sum():,}', "N_TEST": f'{(labels.split == "test").sum():,}',
        "N_BRANDS": len(brands), "EPOCHS": train["finetune"]["epochs"], "TRAINABLE": "189",
        "ONNX_MB": f'{(WEB / "model" / "car_brand.onnx").stat().st_size / 1e6:.0f}',
        "BRAND_CHIPS": chips, "SAMPLE_BUTTONS": sample_buttons, "BRAND_TABLE": brand_rows,
        "CONFUSION_ROWS": conf_rows, "LINKS": "",
        "BEST_BRANDS": names(p.head(3)), "WORST_BRANDS": names(p.tail(3)),
        "GITHUB_URL": "#links",
    }
    page = (ROOT / "src" / "site_template.html").read_text()
    for k, v in fill.items():
        page = page.replace("{{" + k + "}}", str(v))
    page = apply_links(re.sub(r"\{\{GH:([^}]+)\}\}", "#links", page), links)
    (WEB / "index.html").write_text(page)
    print("wrote web/index.html")


if __name__ == "__main__":
    main()
