"""Train the car-brand classifier (transfer learning on EfficientNetV2-B0).

Stage 1  freeze the ImageNet backbone, fit a softmax head on its features
         (a fast "linear probe" baseline).
Stage 2  unfreeze the upper blocks and fine-tune end to end with augmentation.

    python src/train.py --epochs 10
"""
import argparse
import json
import time

import keras
import numpy as np

from common import (MODELS, REPORTS, brands, build_model, class_sample_weights,
                    load_split, score)

keras.utils.set_random_seed(42)


def probe_stage(model, backbone, data, w_train, epochs=60):
    """Stage 1: train only the head on frozen backbone features."""
    Xtr, ytr, Xva, yva, Xte, yte = data
    t0 = time.time()
    feats = {k: backbone.predict(X, batch_size=64, verbose=0)
             for k, X in (("train", Xtr), ("val", Xva), ("test", Xte))}
    print(f"features extracted in {time.time() - t0:.0f}s", flush=True)

    head = keras.Sequential([keras.layers.Input((feats["train"].shape[1],)),
                             keras.layers.Dropout(0.3),
                             keras.layers.Dense(len(brands()), activation="softmax")])
    head.compile(keras.optimizers.Adam(1e-3), keras.losses.SparseCategoricalCrossentropy(),
                 metrics=["accuracy"])
    head.fit(feats["train"], ytr, sample_weight=w_train, epochs=epochs, batch_size=128,
             validation_data=(feats["val"], yva), verbose=0,
             callbacks=[keras.callbacks.EarlyStopping("val_accuracy", patience=10,
                                                      restore_best_weights=True)])
    model.get_layer("brand").set_weights(head.layers[-1].get_weights())
    result = {k: score(y, head.predict(feats[k], verbose=0))
              for k, y in (("val", yva), ("test", yte))}
    print("linear probe:", json.dumps(result), flush=True)
    return result


def make_train_model(core):
    aug = keras.Sequential([
        keras.layers.RandomFlip("horizontal"),
        keras.layers.RandomRotation(0.04, fill_mode="reflect"),
        keras.layers.RandomTranslation(0.08, 0.08, fill_mode="reflect"),
        keras.layers.RandomZoom((-0.25, 0.1), fill_mode="reflect"),
        keras.layers.RandomBrightness(0.15, value_range=(0, 255)),
        keras.layers.RandomContrast(0.2, value_range=(0, 255)),
    ], name="augment")
    return keras.Sequential([keras.layers.Input(core.input_shape[1:]), aug, core], name="train")


def unfreeze_from(backbone, first_trainable: str):
    """Train every layer from `first_trainable` on; keep BatchNorm frozen (small batches)."""
    on = False
    for layer in backbone.layers:
        on = on or layer.name.startswith(first_trainable)
        layer.trainable = on and not isinstance(layer, keras.layers.BatchNormalization)
    return sum(l.trainable for l in backbone.layers)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=10)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--limit", type=int, default=0, help="use only N images per split (smoke test)")
    ap.add_argument("--unfreeze", default="block4a", help="first backbone layer-name prefix to train")
    args = ap.parse_args()
    MODELS.mkdir(exist_ok=True), REPORTS.mkdir(exist_ok=True)

    Xtr, ytr = load_split("train"); Xva, yva = load_split("val"); Xte, yte = load_split("test")
    if args.limit:
        Xtr, ytr, Xva, yva, Xte, yte = (a[:args.limit] for a in (Xtr, ytr, Xva, yva, Xte, yte))
    Xtr, Xva = np.asarray(Xtr), np.asarray(Xva)
    n = len(brands())
    w_train = class_sample_weights(ytr)
    print(f"train {Xtr.shape} val {Xva.shape} test {Xte.shape} | {n} brands", flush=True)

    core, backbone = build_model(n)
    results = {"linear_probe": probe_stage(core, backbone, (Xtr, ytr, Xva, yva, Xte, yte), w_train)}

    # ---- stage 2: fine-tune -------------------------------------------------
    n_train = unfreeze_from(backbone, args.unfreeze)
    print(f"fine-tuning {n_train} backbone layers + head", flush=True)
    train_model = make_train_model(core)
    steps = args.epochs * int(np.ceil(len(Xtr) / args.batch))
    lr = keras.optimizers.schedules.CosineDecay(
        0.0, steps - steps // args.epochs, warmup_target=args.lr, warmup_steps=steps // args.epochs)
    train_model.compile(
        keras.optimizers.AdamW(lr, weight_decay=1e-4),
        keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=[keras.metrics.CategoricalAccuracy(name="accuracy"),
                 keras.metrics.TopKCategoricalAccuracy(3, name="top3")])
    ckpt = MODELS / "best.weights.h5"
    hist = train_model.fit(
        Xtr, keras.utils.to_categorical(ytr, n), sample_weight=w_train,
        validation_data=(Xva, keras.utils.to_categorical(yva, n)),
        epochs=args.epochs, batch_size=args.batch, verbose=2,
        callbacks=[keras.callbacks.ModelCheckpoint(ckpt, "val_accuracy", save_best_only=True,
                                                   save_weights_only=True)])
    train_model.load_weights(ckpt)
    core.save(MODELS / "car_brand.keras")

    results["finetune"] = {"val": score(yva, core.predict(Xva, batch_size=64, verbose=0)),
                           "epochs": args.epochs, "history": hist.history}
    (REPORTS / "training.json").write_text(json.dumps(results, indent=1))
    print("fine-tuned val:", results["finetune"]["val"], flush=True)


if __name__ == "__main__":
    main()
