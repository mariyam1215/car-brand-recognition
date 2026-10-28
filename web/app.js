// In-browser inference with onnxruntime-web. The photo never leaves the visitor's device.
const SIZE = 224;
const $ = (id) => document.getElementById(id);

ort.env.wasm.wasmPaths = new URL("vendor/ort/", document.baseURI).href;
ort.env.wasm.numThreads = 1; // no cross-origin isolation on static hosting -> single thread

let ready;
function load() {
  ready ??= Promise.all([
    ort.InferenceSession.create("model/car_brand.onnx", { executionProviders: ["wasm"] }),
    fetch("model/labels.json").then((r) => r.json()),
  ]);
  return ready;
}

// Resize exactly like Pillow's Image.resize(BICUBIC) (anti-aliased, separable), which is what
// training used, so the browser sees the same pixels as the Python pipeline.
function cubic(x) {
  x = Math.abs(x);
  return x < 1 ? ((1.5 * x - 2.5) * x) * x + 1 : x < 2 ? ((-0.5 * x + 2.5) * x - 4) * x + 2 : 0;
}
function coeffs(inSize, outSize) {
  const scale = inSize / outSize, fs = Math.max(scale, 1), support = 2 * fs, out = [];
  for (let i = 0; i < outSize; i++) {
    const center = (i + 0.5) * scale;
    const lo = Math.max(0, Math.floor(center - support + 0.5)), hi = Math.min(inSize, Math.floor(center + support + 0.5));
    const w = []; let sum = 0;
    for (let x = lo; x < hi; x++) { const v = cubic((x - center + 0.5) / fs); w.push(v); sum += v; }
    out.push({ lo, w: w.map((v) => v / sum) });
  }
  return out;
}
function resize(src, sw, sh, dw, dh) { // src: RGB Uint8 [sh][sw][3]
  const cx = coeffs(sw, dw), cy = coeffs(sh, dh);
  const tmp = new Uint8ClampedArray(dw * sh * 3), dst = new Uint8ClampedArray(dw * dh * 3);
  for (let y = 0; y < sh; y++) for (let x = 0; x < dw; x++) for (let c = 0; c < 3; c++) {
    const { lo, w } = cx[x]; let acc = 0;
    for (let k = 0; k < w.length; k++) acc += w[k] * src[(y * sw + lo + k) * 3 + c];
    tmp[(y * dw + x) * 3 + c] = Math.round(acc);
  }
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) for (let c = 0; c < 3; c++) {
    const { lo, w } = cy[y]; let acc = 0;
    for (let k = 0; k < w.length; k++) acc += w[k] * tmp[((lo + k) * dw + x) * 3 + c];
    dst[(y * dw + x) * 3 + c] = Math.round(acc);
  }
  return dst;
}

const MAX_SIDE = 2048; // very large phone photos are pre-shrunk by the browser to keep memory sane
function toTensor(bitmap) {
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * k), h = Math.round(bitmap.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0, w, h);
  const rgba = g.getImageData(0, 0, w, h).data, rgb = new Uint8ClampedArray(w * h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4) { rgb[j++] = rgba[i]; rgb[j++] = rgba[i + 1]; rgb[j++] = rgba[i + 2]; }
  return new ort.Tensor("float32", Float32Array.from(resize(rgb, w, h, SIZE, SIZE)), [1, SIZE, SIZE, 3]);
}

async function classify(bitmap) {
  const [session, labels] = await load();
  const out = await session.run({ image: toTensor(bitmap) });
  const probs = Array.from(out[session.outputNames[0]].data);
  return probs.map((p, i) => ({ brand: labels[i], p })).sort((a, b) => b.p - a.p);
}

function show(preview, top) {
  $("preview").src = preview;
  $("preview-wrap").hidden = false;
  const best = top[0];
  $("verdict").textContent = `${best.brand} (${(best.p * 100).toFixed(1)}%)`;
  $("hint").textContent = best.p < 0.35
    ? "Low confidence: the car may be from a brand outside the 49 the model knows, or the photo may be unclear."
    : "";
  $("bars").replaceChildren(...top.slice(0, 5).map((t) => {
    const row = document.createElement("div"); row.className = "bar-row";
    row.innerHTML = `<span class="bar-name"></span><span class="bar-track"><span class="bar-fill"></span></span><span class="bar-val"></span>`;
    row.querySelector(".bar-name").textContent = t.brand;
    row.querySelector(".bar-fill").style.width = `${Math.max(t.p * 100, 0.5)}%`;
    row.querySelector(".bar-val").textContent = `${(t.p * 100).toFixed(1)}%`;
    return row;
  }));
  $("placeholder-out").hidden = true;
  $("result").hidden = false;
}

async function run(blobOrFile, previewUrl) {
  $("status").textContent = "Analysing…";
  try {
    const bitmap = await createImageBitmap(blobOrFile, { imageOrientation: "from-image" });
    const t0 = performance.now();
    const top = await classify(bitmap);
    show(previewUrl ?? URL.createObjectURL(blobOrFile), top);
    $("status").textContent = `Done in ${Math.round(performance.now() - t0)} ms, on your device.`;
  } catch (e) {
    console.error(e);
    $("status").textContent = "Could not read that image. Please try a JPG or PNG.";
  }
}

$("file").addEventListener("change", (e) => e.target.files[0] && run(e.target.files[0]));
const drop = $("drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; f && run(f); });

document.querySelectorAll("[data-sample]").forEach((btn) => btn.addEventListener("click", async () => {
  const url = btn.dataset.sample;
  run(await (await fetch(url)).blob(), url);
}));

load().then(() => { $("status").textContent = "Model loaded. Pick or drop a photo."; })
      .catch((e) => { console.error(e); $("status").textContent = "Model failed to load."; });
