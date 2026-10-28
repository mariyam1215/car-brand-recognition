"""Convert the trained Keras model to ONNX (used by the website and predict.py).

    python src/export_onnx.py
"""
import json
import shutil

import keras
import numpy as np
import onnx
import onnxruntime as ort

from common import IMG_SIZE, MODELS, ROOT, brands, load_split

WEB_MODEL = ROOT / "web" / "model"


def export(model, path):
    model.predict(np.zeros((1, IMG_SIZE, IMG_SIZE, 3), "float32"), verbose=0)  # build the graph
    model.export(str(path), format="onnx")
    # The exporter leaves two folded-away constants behind as unused graph inputs;
    # drop them so the model has the single input `image`, then name the batch axis.
    m = onnx.load(path)
    used = {i for node in m.graph.node for i in node.input}
    for inp in [i for i in m.graph.input if i.name != "image" and i.name not in used]:
        m.graph.input.remove(inp)
    m.graph.input[0].type.tensor_type.shape.dim[0].dim_param = "batch"
    onnx.checker.check_model(m)
    onnx.save(m, path)


def main():
    model = keras.saving.load_model(MODELS / "car_brand.keras")
    onnx_path = MODELS / "car_brand.onnx"
    export(model, onnx_path)

    # parity check against Keras on real test images
    X, _ = load_split("test")
    x = np.asarray(X[:64], dtype="float32")
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    out = sess.run(None, {"image": x})[0]
    diff = float(np.abs(out - model.predict(x, verbose=0)).max())
    print(f"ONNX vs Keras max |diff| = {diff:.2e} | {onnx_path.stat().st_size / 1e6:.1f} MB")
    assert diff < 1e-3, "ONNX output does not match Keras"

    WEB_MODEL.mkdir(parents=True, exist_ok=True)
    shutil.copy(onnx_path, WEB_MODEL / "car_brand.onnx")
    (WEB_MODEL / "labels.json").write_text(json.dumps(brands()))
    (MODELS / "labels.json").write_text(json.dumps(brands()))


if __name__ == "__main__":
    main()
