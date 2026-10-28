// Builds slides/Car_Brand_Recognition.pptx from the real results in reports/.
//   NODE_PATH=<dir with node_modules/pptxgenjs> node slides/build_deck.js
// Optional env: AUTHOR="Your Name"  COURSE="Deep Learning"
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..");
const R = (...p) => path.join(ROOT, "reports", ...p);
const metrics = JSON.parse(fs.readFileSync(R("metrics.json")));
const training = JSON.parse(fs.readFileSync(R("training.json")));
const links = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "links.json")));
const labels = fs.readFileSync(path.join(ROOT, "data", "labels.csv"), "utf8").trim().split("\n");
const header = labels[0].split(",");
const col = (n) => header.indexOf(n);
const rows = labels.slice(1).map((l) => l.split(","));
const nSplit = (s) => rows.filter((r) => r[col("split")] === s).length;
const brandCount = {};
rows.forEach((r) => (brandCount[r[col("brand")]] = (brandCount[r[col("brand")]] || 0) + 1));

const perBrand = fs.readFileSync(R("per_brand.csv"), "utf8").trim().split("\n").slice(1)
  .map((l) => l.split(",")).filter((r) => !r[0].includes("avg"))
  .map((r) => ({ brand: r[0], precision: +r[1], recall: +r[2], f1: +r[3], n: +r[4] }))
  .sort((a, b) => b.f1 - a.f1);
const confusions = fs.readFileSync(R("top_confusions.csv"), "utf8").trim().split("\n").slice(1)
  .map((l) => l.split(",")).slice(0, 5);

const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
const T = metrics.test, P = metrics.linear_probe_test;
const epochs = training.finetune.epochs;
const hist = training.finetune.history;
const best = perBrand.slice(0, 5), worst = perBrand.slice(-5).reverse();

// ---- theme --------------------------------------------------------------
const INK = "0E1A2B", BLUE = "2A78D6", PALE = "EAF1FB", GREY = "5B6573", LINE = "D9DEE6", WHITE = "FFFFFF", ORANGE = "E8742C";
const FONT = "Calibri", HEAD = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "Car Brand Recognition with Deep Learning";

function slideBase(title, notes) {
  const s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText(title, { x: 0.5, y: 0.35, w: 9, h: 0.7, fontFace: HEAD, fontSize: 32, bold: true, color: INK, margin: 0, isTextBox: true, valign: "top" });
  if (notes) s.addNotes(notes);
  return s;
}
const card = (s, x, y, w, h, fill = PALE) =>
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });
function stat(s, x, y, w, big, small, fill = PALE, bigColor = BLUE) {
  card(s, x, y, w, 1.25, fill);
  s.addText(big, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.65, fontFace: HEAD, fontSize: 38, bold: true, color: bigColor, margin: 0, isTextBox: true, valign: "middle" });
  s.addText(small, { x: x + 0.2, y: y + 0.75, w: w - 0.4, h: 0.4, fontFace: FONT, fontSize: 13, color: GREY, margin: 0, isTextBox: true, valign: "top" });
}
function bullets(s, items, opt) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 8 } })),
    { fontFace: FONT, fontSize: 16, color: INK, valign: "top", margin: 0, isTextBox: true, ...opt });
}
function image(s, file, x, y, maxW, maxH, alt) {
  const [w, h] = require("child_process").execSync(`python3 -c "from PIL import Image;import sys;print(*Image.open(sys.argv[1]).size)" "${file}"`).toString().trim().split(" ").map(Number);
  const k = Math.min(maxW / w, maxH / h);
  s.addImage({ path: file, x: x + (maxW - w * k) / 2, y: y + (maxH - h * k) / 2, w: w * k, h: h * k, altText: alt });
}

// ---- 1. title -----------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addText("Car Brand Recognition", { x: 0.7, y: 1.5, w: 8.6, h: 1.0, fontFace: HEAD, fontSize: 48, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Naming the make of a car from a single photo with deep learning", { x: 0.7, y: 2.55, w: 7.4, h: 0.9, fontFace: FONT, fontSize: 22, color: "BBD2F0", margin: 0, isTextBox: true, valign: "top" });
  const who = [process.env.COURSE || "Deep Learning semester project", process.env.AUTHOR].filter(Boolean).join("  |  ");
  s.addText(who, { x: 0.7, y: 4.5, w: 8.6, h: 0.4, fontFace: FONT, fontSize: 16, color: "8FA7C7", margin: 0, isTextBox: true });
  s.addNotes(`Hello everyone. This project is a car brand recognition system: you give it a photo of a car and it tells you which of ${Object.keys(brandCount).length} brands made it, for example Audi, BMW, Ferrari or Toyota. I will walk through the data, the model, the results, and the website where you can try it yourself.`);
}

// ---- 2. problem ---------------------------------------------------------
{
  const s = slideBase("The problem: which brand is this car?",
    "Recognising a car brand sounds easy for people, but cars from the same brand look very different across models and years, and cars from different brands can look alike. Applications include smart parking, traffic analysis, used-car listings and insurance. Our goal: build a classifier that takes any car photo and outputs the brand, and deploy it as a web app anyone can use.");
  bullets(s, [
    "Input: one photo of a car, any angle",
    "Output: the brand, from 49 makes, with a confidence score",
    "Hard because a brand spans many shapes, colours and years, while different brands can look alike",
    "Use cases: parking and tolls, listings, insurance, fleet analytics",
  ], { x: 0.5, y: 1.35, w: 5.2, h: 3.4 });
  stat(s, 6.2, 1.35, 3.3, String(Object.keys(brandCount).length), "brands to tell apart");
  stat(s, 6.2, 2.85, 3.3, rows.length.toLocaleString("en-US"), "labelled photos in the dataset", PALE, INK);
}

// ---- 3. dataset ---------------------------------------------------------
{
  const s = slideBase("Dataset: Stanford Cars",
    `We used the public Stanford Cars dataset, a secondary dataset. It has ${rows.length} photos, each labelled with make, model and year, 196 classes in total. We kept only the make, which gives ${Object.keys(brandCount).length} brands. We use the official test split of ${nSplit("test")} photos only for the final evaluation, and hold out ten percent of each brand's training photos for validation. The chart shows the imbalance: Chevrolet has over 1,700 photos while some brands have under 100, so we report macro F1 as well as accuracy and use mild class weights.`);
  stat(s, 0.5, 1.3, 2.8, nSplit("train").toLocaleString("en-US"), "train photos");
  stat(s, 0.5, 2.7, 2.8, nSplit("val").toLocaleString("en-US"), "validation photos");
  stat(s, 0.5, 4.1, 2.8, nSplit("test").toLocaleString("en-US"), "test photos (official split)", PALE, INK);
  const top = Object.entries(brandCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
  s.addChart(pres.charts.BAR, [{ name: "Photos", labels: top.map((t) => t[0]), values: top.map((t) => t[1]) }], {
    x: 3.6, y: 1.25, w: 6, h: 4.05, barDir: "bar", chartColors: [BLUE], catAxisOrientation: "maxMin",
    showTitle: true, title: "12 largest brands, photos per brand", titleFontSize: 14, titleColor: INK, titleFontFace: FONT,
    showValue: true, dataLabelFontSize: 11, dataLabelColor: GREY, dataLabelPosition: "outEnd",
    catAxisLabelFontSize: 11, catAxisLabelColor: INK, catAxisLabelFontFace: FONT, valAxisHidden: true,
    valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
  });
}

// ---- 4. pipeline --------------------------------------------------------
{
  const s = slideBase("The pipeline, end to end",
    "Here is the whole workflow. We download the dataset and turn the make-model-year labels into brand labels. We resize every photo to 224 by 224 pixels. A pre-trained EfficientNetV2 network is trained in two stages. We evaluate on the held-out test photos, export the model to the ONNX format, and the website runs that ONNX file directly in the browser.");
  const steps = [["Data", "Stanford Cars, make extracted as label"], ["Preprocess", "224 x 224 RGB, train / val / test"], ["Train", "transfer learning + fine-tuning"], ["Evaluate", "accuracy, F1, confusion matrix"], ["Export", "Keras to ONNX, 24 MB"], ["Deploy", "Vercel site, runs in the browser"]];
  steps.forEach((st, i) => {
    const x = 0.5 + (i % 3) * 3.05, y = 1.4 + Math.floor(i / 3) * 1.9;
    card(s, x, y, 2.85, 1.6);
    s.addText(String(i + 1), { x: x + 0.2, y: y + 0.15, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 24, bold: true, color: BLUE, margin: 0, isTextBox: true });
    s.addText(st[0], { x: x + 0.2, y: y + 0.6, w: 2.45, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true });
    s.addText(st[1], { x: x + 0.2, y: y + 1.0, w: 2.45, h: 0.5, fontFace: FONT, fontSize: 14, color: GREY, margin: 0, isTextBox: true, valign: "top" });
  });
}

// ---- 5. model -----------------------------------------------------------
{
  const s = slideBase("Model: transfer learning with EfficientNetV2-B0",
    "Training a deep network from scratch needs millions of images. Instead we start from EfficientNetV2-B0, already trained on ImageNet, so it knows edges, shapes and textures. On top we add a dropout layer and a dense softmax layer with one output per brand. Stage one freezes the backbone and trains only the new layer, which is a quick baseline. Stage two unfreezes the upper blocks and fine-tunes everything with data augmentation. The network has about six million parameters, so it is small enough to run in a web browser.");
  const parts = [["Photo", "224 x 224 x 3"], ["EfficientNetV2-B0", "ImageNet weights, 5.9M params"], ["Average pool", "1280 features"], ["Dropout + Dense", "softmax, 49 brands"]];
  parts.forEach((p, i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.4, 2.1, 1.35, i === 1 ? BLUE : PALE);
    s.addText(p[0], { x: x + 0.15, y: 1.5, w: 1.8, h: 0.6, fontFace: HEAD, fontSize: 16, bold: true, color: i === 1 ? WHITE : INK, margin: 0, isTextBox: true, valign: "middle" });
    s.addText(p[1], { x: x + 0.15, y: 2.1, w: 1.8, h: 0.55, fontFace: FONT, fontSize: 12, color: i === 1 ? "DCE9FA" : GREY, margin: 0, isTextBox: true, valign: "top" });
  });
  card(s, 0.5, 3.15, 4.4, 1.55);
  s.addText("Stage 1: linear probe", { x: 0.7, y: 3.25, w: 4, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addText(`Backbone frozen, only the final layer is trained. Test accuracy ${pct(P.top1_accuracy)}.`, { x: 0.7, y: 3.7, w: 4, h: 0.9, fontFace: FONT, fontSize: 15, color: GREY, margin: 0, isTextBox: true, valign: "top" });
  card(s, 5.1, 3.15, 4.4, 1.55);
  s.addText("Stage 2: fine-tuning", { x: 5.3, y: 3.25, w: 4, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addText(`Upper blocks unfrozen and trained for ${epochs} epochs with augmentation. Test accuracy ${pct(T.top1_accuracy)}.`, { x: 5.3, y: 3.7, w: 4, h: 0.9, fontFace: FONT, fontSize: 15, color: GREY, margin: 0, isTextBox: true, valign: "top" });
}

// ---- 6. training setup --------------------------------------------------
{
  const s = slideBase("Training setup",
    "These are the training details. We use the AdamW optimiser with a cosine learning-rate schedule and one warm-up epoch. Label smoothing of point one keeps the model from becoming over-confident. Because brands have very different numbers of photos, we weight samples by the inverse square root of their class frequency. Augmentation - flips, small rotations, shifts, zoom, brightness and contrast - helps the model generalise. Everything trained on a CPU, no GPU needed, and the best epoch was picked using the validation set, never the test set.");
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: INK }, fontFace: FONT, fontSize: 14 } });
  const cell = (t, b) => ({ text: t, options: { bold: !!b, color: b ? INK : GREY, fontFace: FONT, fontSize: 14 } });
  s.addTable([
    [hdr("Setting"), hdr("Value")],
    [cell("Backbone", 1), cell("EfficientNetV2-B0, ImageNet weights")],
    [cell("Optimiser", 1), cell("AdamW, weight decay 1e-4, peak LR 2e-4, cosine decay")],
    [cell("Loss", 1), cell("Cross-entropy, label smoothing 0.1, class weights")],
    [cell("Batch / epochs", 1), cell(`32 / ${epochs}`)],
    [cell("Augmentation", 1), cell("flip, rotation, shift, zoom, brightness, contrast")],
    [cell("Model selection", 1), cell("best validation accuracy")],
    [cell("Hardware", 1), cell("CPU only (4 cores)")],
  ], { x: 0.5, y: 1.3, w: 9, colW: [2.4, 6.6], border: { type: "solid", pt: 0.5, color: LINE }, rowH: 0.45, valign: "middle" });
}

// ---- 7. curves ----------------------------------------------------------
{
  const s = slideBase("Training curves",
    `The left plot shows loss and the right shows accuracy for each epoch. Solid lines are the training set, dashed lines are validation. The best validation accuracy was ${pct(Math.max(...hist.val_accuracy))}. Validation accuracy keeps improving while training accuracy stays close, so we are not badly over-fitting.`);
  image(s, R("training_curves.png"), 0.5, 1.2, 9, 3.2, "Training and validation loss and accuracy per epoch");
  s.addText(`Best validation accuracy: ${pct(Math.max(...hist.val_accuracy))} (${nSplit("val")} photos, used only to choose the epoch).`,
    { x: 0.5, y: 4.6, w: 9, h: 0.5, fontFace: FONT, fontSize: 15, color: GREY, margin: 0, isTextBox: true });
}

// ---- 8. headline results ------------------------------------------------
{
  const s = slideBase("Results on unseen test photos",
    `On the ${nSplit("test")} official test photos, which the model never saw, fine-tuning reaches ${pct(T.top1_accuracy)} top-1 accuracy and ${pct(T.top3_accuracy)} top-3 accuracy. Macro F1 is ${T.macro_f1.toFixed(2)}, meaning every brand counts equally regardless of size. Compared with only training the final layer, which gives ${pct(P.top1_accuracy)}, fine-tuning adds ${((T.top1_accuracy - P.top1_accuracy) * 100).toFixed(1)} percentage points.`);
  stat(s, 0.5, 1.3, 2.9, pct(T.top1_accuracy), "top-1 accuracy");
  stat(s, 0.5, 2.75, 2.9, pct(T.top3_accuracy), "top-3 accuracy", PALE, INK);
  stat(s, 0.5, 4.2, 2.9, T.macro_f1.toFixed(2), "macro F1", PALE, INK);
  s.addChart(pres.charts.BAR, [{ name: "Top-1 accuracy", labels: ["Linear probe", "Fine-tuned"], values: [+(P.top1_accuracy * 100).toFixed(1), +(T.top1_accuracy * 100).toFixed(1)] }], {
    x: 3.8, y: 1.25, w: 5.7, h: 4.0, barDir: "col", chartColors: [BLUE], barGapWidthPct: 60,
    showTitle: true, title: "Top-1 test accuracy (%)", titleFontSize: 14, titleColor: INK, titleFontFace: FONT,
    showValue: true, dataLabelFontSize: 16, dataLabelColor: INK, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0",
    catAxisLabelFontSize: 14, catAxisLabelColor: INK, catAxisLabelFontFace: FONT,
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelFontSize: 11, valAxisLabelColor: GREY,
    valGridLine: { color: LINE, size: 0.5 }, catGridLine: { style: "none" }, showLegend: false,
  });
}

// ---- 9. per-brand -------------------------------------------------------
{
  const s = slideBase("Easy and hard brands",
    `Per-brand F1 scores. The easiest brands are ${best.map((b) => b.brand).join(", ")}. The hardest are ${worst.map((b) => b.brand).join(", ")}. Brands that are represented by a single model, or that have few photos, tend to be harder, and brands whose models resemble each other get confused.`);
  image(s, R("per_brand_f1.png"), 5.4, 1.1, 4.2, 4.4, "F1 score per brand");
  s.addText("Best", { x: 0.5, y: 1.3, w: 4.3, h: 0.35, fontFace: HEAD, fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addText(best.map((b, i) => ({ text: `${b.brand}  ${b.f1.toFixed(2)}`, options: { breakLine: i < best.length - 1 } })),
    { x: 0.5, y: 1.7, w: 4.3, h: 1.4, fontFace: FONT, fontSize: 15, color: GREY, margin: 0, isTextBox: true, valign: "top" });
  s.addText("Hardest", { x: 0.5, y: 3.2, w: 4.3, h: 0.35, fontFace: HEAD, fontSize: 18, bold: true, color: ORANGE, margin: 0, isTextBox: true });
  s.addText(worst.map((b, i) => ({ text: `${b.brand}  ${b.f1.toFixed(2)}`, options: { breakLine: i < worst.length - 1 } })),
    { x: 0.5, y: 3.6, w: 4.3, h: 1.4, fontFace: FONT, fontSize: 15, color: GREY, margin: 0, isTextBox: true, valign: "top" });
}

// ---- 10. confusions -----------------------------------------------------
{
  const s = slideBase("What does the model mix up?",
    "The confusion matrix shows, for each true brand, which brand the model predicted. A strong diagonal means correct answers. The table lists the most frequent mistakes. These are mostly brands that share a parent company, a body style or a similar design, which is also where a human would hesitate.");
  image(s, R("confusion_matrix.png"), 0.3, 1.05, 5.3, 4.4, "Confusion matrix of true versus predicted brand");
  const hdr = (t, a) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: INK }, fontFace: FONT, fontSize: 13, align: a } });
  const c = (t, a) => ({ text: t, options: { color: INK, fontFace: FONT, fontSize: 13, align: a } });
  s.addText("Most frequent mix-ups", { x: 5.6, y: 1.2, w: 3.9, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addTable([[hdr("True"), hdr("Predicted as"), hdr("Photos", "right")],
    ...confusions.map((r) => [c(r[0]), c(r[1]), c(r[2], "right")])],
    { x: 5.6, y: 1.7, w: 3.9, colW: [1.4, 1.7, 0.8], border: { type: "solid", pt: 0.5, color: LINE }, rowH: 0.42, valign: "middle" });
}

// ---- 11. samples --------------------------------------------------------
{
  const s = slideBase("Sample predictions",
    "Here are twelve random test photos with the predicted brand, the confidence and the true brand. Wrong answers are shown in red. Note that these are random, not hand-picked.");
  image(s, R("sample_predictions.png"), 1.2, 1.1, 7.6, 4.3, "Random test photos with predicted and true brands");
}

// ---- 12. deployment -----------------------------------------------------
{
  const s = slideBase("Deployment: a website that runs the model",
    "The trained model is converted to ONNX and shipped with the website. When you upload a photo, ONNX Runtime Web runs the model inside your browser using WebAssembly. That means there is no server to maintain, it is fast, and your photo never leaves your device. The site is a static site hosted on Vercel, and it also shows the dataset, code, results, and links to the report, slides, video and GitHub.");
  bullets(s, [
    "Keras model exported to ONNX (24 MB), same predictions as the original",
    "ONNX Runtime Web runs inference in the browser, no backend",
    "The photo stays on the user's device",
    "Static site on Vercel: demo, dataset and code, results, project links",
  ], { x: 0.5, y: 1.35, w: 3.9, h: 3.8, fontSize: 15 });
  const shot = path.join(ROOT, "slides", "site_screenshot.png");
  if (fs.existsSync(shot)) image(s, shot, 4.6, 1.5, 4.9, 3.4, "Screenshot of the demo on the website");
}

// ---- 13. limitations ----------------------------------------------------
{
  const s = slideBase("Limitations and future work",
    "Honest limitations: several brands are represented by only one model in the dataset, so other models from that brand may be missed. Most photos show cars from before 2013, so brand-new designs are out of distribution. The model has no unknown class, so it always names one of the 49 brands, and low confidence is the signal to distrust it. For future work we could add a detection step to crop the car, train on a larger and more recent dataset, add an unknown class, and use a higher resolution.");
  card(s, 0.5, 1.3, 4.4, 3.0);
  s.addText("Limitations", { x: 0.7, y: 1.4, w: 4, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true });
  bullets(s, ["Some brands appear through a single model", "Mostly cars from 2000-2012", "No 'unknown' or 'not a car' class", "Small brands have few training photos"], { x: 0.7, y: 1.9, w: 4.0, h: 2.3, fontSize: 16 });
  card(s, 5.1, 1.3, 4.4, 3.0);
  s.addText("Future work", { x: 5.3, y: 1.4, w: 4, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true });
  bullets(s, ["Detect and crop the car first", "More recent, larger dataset", "Add an 'unknown' class", "Higher resolution and test-time augmentation"], { x: 5.3, y: 1.9, w: 4.0, h: 2.3, fontSize: 16 });
}

// ---- 14. conclusion -----------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addText("Conclusion", { x: 0.7, y: 0.5, w: 8.6, h: 0.8, fontFace: HEAD, fontSize: 36, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText([
    { text: `A fine-tuned EfficientNetV2-B0 recognises ${Object.keys(brandCount).length} car brands with ${pct(T.top1_accuracy)} top-1 and ${pct(T.top3_accuracy)} top-3 accuracy on unseen photos.`, options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: `Fine-tuning improved the frozen-backbone baseline from ${pct(P.top1_accuracy)} to ${pct(T.top1_accuracy)}.`, options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "The model runs in the browser, so the whole app is a static website.", options: { bullet: true } },
  ], { x: 0.7, y: 1.5, w: 8.6, h: 2.6, fontFace: FONT, fontSize: 22, color: "DCE6F5", margin: 0, isTextBox: true, valign: "top" });
  const L = [["GitHub", links.github], ["Report", links.report], ["Video", links.youtube]].filter((x) => x[1]);
  if (L.length) s.addText(L.map((l, i) => ({ text: `${l[0]}: ${l[1]}`, options: { breakLine: i < L.length - 1 } })),
    { x: 0.7, y: 3.7, w: 8.6, h: 0.8, fontFace: FONT, fontSize: 14, color: "8FA7C7", margin: 0, isTextBox: true, valign: "top" });
  s.addText("Thank you", { x: 0.7, y: 4.6, w: 4, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addNotes("To conclude: transfer learning with a small modern network gives strong brand recognition even on a CPU, and exporting to ONNX lets us deploy the whole thing as a static website. Thank you for watching, and please try the demo and check the code on GitHub.");
}

pres.writeFile({ fileName: path.join(ROOT, "slides", "Car_Brand_Recognition.pptx") }).then((f) => console.log("wrote", f));
