// Builds START_HERE_Beginner_Guide.docx (beginner guide: run, present, submit).
//   node slides/build_guide.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Footer, AlignmentType,
  LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const metrics = JSON.parse(fs.readFileSync(path.join(ROOT, "reports", "metrics.json")));
const pct = (v) => (v * 100).toFixed(1) + "%";
const T = metrics.test, P = metrics.linear_probe_test;

const BLUE = "1F64B8", INK = "14141A", GREY = "5A5A63", PALE = "EAF1FB", WARN = "FFF4DE", LINE = "D9DEE6", CODE = "F1F3F6";
const W = 9638; // content width in DXA (A4, 2 cm margins)
const FONT = "Calibri";

// ---- building blocks --------------------------------------------------------
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, ...o });
// inline markup: **bold** and `code`
function runs(text, base = {}) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((s) =>
    s.startsWith("**") ? run(s.slice(2, -2), { ...base, bold: true })
      : s.startsWith("`") ? new TextRun({ text: s.slice(1, -1), font: "Consolas", size: 20, ...base, color: "9A2A00" })
        : run(s, base));
}
const p = (text, o = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, ...o, children: runs(text, o.run) });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 140 }, children: [run(t, { bold: true, size: 34, color: BLUE })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [run(t, { bold: true, size: 26, color: INK })] });
const gap = () => new Paragraph({ spacing: { after: 60 }, children: [] });

let listId = 0;
const numberings = [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }];
const bullets = (items) => items.map((t) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 80, line: 290 }, children: runs(t) }));
function steps(items) { // a fresh numbered list each call, so numbering restarts at 1
  const ref = "num" + listId++;
  numberings.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } }, run: { bold: true, color: BLUE } } }] });
  return items.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 100, line: 290 }, children: runs(t) }));
}

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (text, w, o = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA }, borders, margins: { top: 70, bottom: 70, left: 110, right: 110 },
  shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
  children: (Array.isArray(text) ? text : [text]).map((t) => new Paragraph({ spacing: { after: 40, line: 270 }, children: runs(t, { size: 21, ...(o.run || {}) }) })),
});
function table(widths, header, rows) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(`**${h}**`, widths[i], { fill: PALE })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i])) })),
    ],
  });
}
function callout(title, lines, fill = PALE) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA }, borders, shading: { fill, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 110, bottom: 90, left: 180, right: 180 },
      children: [new Paragraph({ spacing: { after: 60 }, children: [run(title, { bold: true, size: 22 })] }),
        ...lines.map((l) => new Paragraph({ spacing: { after: 60, line: 280 }, children: runs(l, { size: 21 }) }))],
    })] })],
  });
}
const code = (lines) => lines.map((l, i) => new Paragraph({
  spacing: { after: i === lines.length - 1 ? 140 : 0 }, indent: { left: 200 },
  shading: { fill: CODE, type: ShadingType.CLEAR, color: "auto" },
  children: [new TextRun({ text: l || " ", font: "Consolas", size: 20 })],
}));
const image = (file, wPx, hPx) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 },
  children: [new ImageRun({ type: "png", data: fs.readFileSync(file), transformation: { width: wPx, height: hPx }, altText: { title: "Screenshot", description: "Screenshot of the website demo", name: "screenshot" } })] });
const check = (t) => new Paragraph({ spacing: { after: 90 }, indent: { left: 360, hanging: 360 }, children: [run("☐  ", { size: 24 }), ...runs(t)] });

// ---- content ----------------------------------------------------------------
const c = [];

c.push(new Paragraph({ spacing: { before: 600, after: 80 }, children: [run("Car Brand Recognition", { bold: true, size: 56, color: INK })] }));
c.push(new Paragraph({ spacing: { after: 240 }, children: [run("Beginner's guide: run it, present it, submit it", { size: 32, color: GREY })] }));
c.push(callout("How to use this guide", [
  "You do **not** need to know deep learning or programming to use this project. Everything is already trained and ready.",
  "Read **Part 2** to run the website on your computer (5 minutes), **Part 5** to practise your presentation, and **Part 6** for the Q&A your teacher may ask. **Part 4** explains how to publish it for the assignment.",
]));

c.push(h1("Part 1. What this project is"));
c.push(p("This project is an **AI that looks at a photo of a car and tells you which brand made it**, for example Audi, BMW, Ferrari, Toyota or Tesla. It knows 49 brands."));
c.push(p("It was built with **deep learning**: a neural network that was first taught to recognise everyday things (a public model called EfficientNetV2), and then trained further on about 8,000 labelled car photos from a public dataset called **Stanford Cars**. This is called **transfer learning**."));
c.push(callout("Say it in one sentence", [
  `“We trained a deep-learning model that names the brand of a car from a single photo, with ${pct(T.top1_accuracy)} accuracy on photos it had never seen, and we put it on a website where anyone can try it.”`,
]));
c.push(gap());
c.push(p("**Technical word:** the task is called image **classification** (the model chooses one brand out of 49). Your teacher may say “detection”; that is fine, but strictly, detection would also draw a box around the car. See the Q&A in Part 6."));

c.push(h1("Part 2. Run the project on your computer"));
c.push(p("The project already contains the trained model. You only need **Python** to start a tiny local web server. No training, no downloads of data."));
c.push(h2("Step 1. Install Python (one time)"));
c.push(...steps([
  "Go to **python.org/downloads** and download Python (the big yellow button).",
  "Open the installer. **On the first screen, tick “Add python.exe to PATH”**, then click Install Now. (This is the step beginners forget.)",
  "To check: open Command Prompt (Windows) or Terminal (Mac) and type `python --version` (on Mac you may need `python3 --version`). You should see a version number such as 3.12.",
]));
c.push(h2("Step 2. Unzip the project"));
c.push(...steps([
  "Right-click the zip file and choose **Extract All** (Windows) or double-click it (Mac).",
  "Open the new folder called `car-brand-recognition`. Do not run anything from inside the zip file; it must be extracted first.",
]));
c.push(h2("Step 3. Start the website"));
c.push(table([2000, 7638], ["Your computer", "What to do"], [
  ["**Windows**", "Double-click **`run_demo.bat`**. A black window opens and your browser opens by itself. If Windows shows “Windows protected your PC”, click **More info** then **Run anyway**."],
  ["**Mac**", "Double-click **`run_demo.command`**. If Mac refuses (“unidentified developer”), right-click the file, choose **Open**, then **Open** again."],
  ["**Linux**", "Open a terminal in the folder and type `sh run_demo.sh`."],
]));
c.push(gap());
c.push(p("If the browser does not open automatically, open Chrome or Edge yourself and type **localhost:8000** in the address bar."));
c.push(h2("Step 4. Use it"));
c.push(...steps([
  "Click one of the small example photos, or click **Choose a photo** and pick a car picture from your computer.",
  "After a fraction of a second you see the predicted brand, the confidence, and the top 5 guesses.",
  "Try a few different photos. When you are done, **close the black window** to stop the website.",
]));
c.push(image(path.join(ROOT, "slides", "site_screenshot.png"), 560, 287));
c.push(p("What you should see after clicking an example. The photo is analysed inside your browser, it is not uploaded anywhere.", { run: { color: GREY, size: 20 } }));
c.push(h2("If something goes wrong"));
c.push(table([3300, 6338], ["Problem", "Fix"], [
  ["Black window closes immediately, or says Python is not installed", "Install Python (Step 1) and tick **Add to PATH**. On Windows, if a Microsoft Store window opens instead, install Python from python.org and try again."],
  ["Browser says “this site can’t be reached”", "The black window must stay open. Start `run_demo` again and wait 3 seconds before refreshing the page."],
  ["Message about port 8000 already in use", "A previous copy is still running. Close the old black window (or restart the computer) and try again."],
  ["The page opens but says “Model failed to load”", "You opened `index.html` by double-clicking it. Always start the site with `run_demo`, never by opening the file directly."],
  ["Wrong prediction on my photo", "This is normal for some photos, see “Limitations” in Part 6. Try a clear side or front view of a single car."],
]));

c.push(h2("Optional: predict from the command line"));
c.push(p("In a terminal inside the project folder (one-time install, then as many predictions as you like):"));
c.push(...code(["pip install -r requirements-inference.txt", "python src/predict.py web/samples/ferrari.jpg --topk 3"]));
c.push(p("You can also give it a whole folder of images: `python src/predict.py my_photos/`. This is the same model, with no website."));

c.push(h1("Part 3. What is in the folder"));
c.push(p("You only need to touch the first three items. The rest is for reference."));
c.push(table([2700, 4538, 2400], ["Name", "What it is", "Do I touch it?"], [
  ["`run_demo.bat` / `.command` / `.sh`", "One-click start for the website.", "Double-click"],
  ["`web/links.json`", "The five links (GitHub, report, slides, YouTube, LinkedIn) that appear on the site.", "Yes, once you have the links"],
  ["`slides/Car_Brand_Recognition.pptx`", "The presentation (14 slides). The speaker notes contain a script for each slide.", "Yes, add your name on slide 1"],
  ["`web/`", "The complete website. This is the folder that Vercel publishes.", "No"],
  ["`models/`", "The trained model (the “weights”). `car_brand.onnx` is what the website uses.", "No"],
  ["`reports/`", "Charts and result tables (accuracy, confusion matrix, per-brand scores).", "Use in your report"],
  ["`src/`", "The Python code: prepare data, train, evaluate, export, predict.", "No (for GitHub readers)"],
  ["`data/`", "Label files. The 16,185 photos themselves are not included (they are large), only a link to them.", "No"],
  ["`README.md`", "Technical instructions, shown on the front page of GitHub.", "No"],
]));

c.push(h1("Part 4. Publish it for the assignment"));
c.push(p("Your teacher’s automatic checker will open your Vercel website and your GitHub repository, so both must be public and working. Do this in order."));
c.push(h2("4.1 Create a GitHub repository and upload the project"));
c.push(p("Easiest for beginners: **GitHub Desktop** (desktop.github.com). Uploading through the GitHub website is not recommended because it limits file size, and this project has model files of about 24 MB."));
c.push(...steps([
  "Create a free account at **github.com** and install **GitHub Desktop**; sign in.",
  "In GitHub Desktop choose **File → Add local repository**, select the `car-brand-recognition` folder, and when it says it is not a repository click **create a repository**. Name it `car-brand-recognition`.",
  "Write a short summary such as “Car brand recognition project” and click **Commit to main**.",
  "Click **Publish repository**. **Untick “Keep this code private”** so it is public. Click Publish.",
  "Open github.com/your-username/car-brand-recognition in the browser and check that you can see the folders `src`, `web`, `models`.",
]));
c.push(p("Prefer typing commands? From inside the folder (after creating an empty public repo on github.com):"));
c.push(...code(["git init", "git add .", "git commit -m \"Car brand recognition project\"", "git branch -M main", "git remote add origin https://github.com/YOUR-USERNAME/car-brand-recognition.git", "git push -u origin main"]));
c.push(h2("4.2 Put the website on Vercel"));
c.push(...steps([
  "Go to **vercel.com** and sign up with **Continue with GitHub**.",
  "Click **Add New → Project**, find `car-brand-recognition` and click **Import**.",
  "Do **not** change any settings (the project already tells Vercel what to do). Click **Deploy**.",
  "After about a minute you get a link like `car-brand-recognition-xxxx.vercel.app`. Open it, click an example photo and confirm a prediction appears. **That link is your Vercel URL.**",
]));
c.push(h2("4.3 Add your other links to the website"));
c.push(p("The website has a “Project links” section. Until you fill in your links it shows “link coming soon”. When you have your report, YouTube video and LinkedIn post:"));
c.push(...steps([
  "Open `web/links.json` with Notepad and paste each link between the quotes. Keep the commas and quotation marks exactly as they are. Links must start with `https://`.",
  "In a terminal inside the project folder run `python src/update_links.py`. It prints “Done. Links on the website: …”.",
  "In GitHub Desktop write a summary (“Add links”), click **Commit to main**, then **Push origin**. Vercel redeploys by itself in about a minute.",
]));
c.push(callout("Check before you submit", [
  "Open your Vercel link in a **private/incognito window** (so you see what the teacher sees), click an example, and click every link in “Project links”.",
  "Open your GitHub link while logged out: you must see the code and the `models/` folder.",
], WARN));

c.push(h1("Part 5. Present it"));
c.push(h2("5.1 The slides, one by one"));
c.push(p("The full talk is about 12 minutes at one minute per slide. **Short version (about 6 minutes): use only slides 1, 2, 3, 5, 8, 12, 13, 14.** Do not read the slides word for word; say it in your own words. The speaker notes in the PowerPoint file contain a longer script you can read from."));
c.push(table([600, 2500, 6538], ["#", "Slide", "What to say"], [
  ["1", "Title", "Introduce yourself and the project: an AI that names a car’s brand from a photo."],
  ["2", "The problem", "Cars of one brand look very different across models, and different brands can look alike. We chose 49 brands."],
  ["3", "Dataset", "Stanford Cars, a public dataset (secondary data): 16,185 photos. Official test split of 8,041 photos is kept aside and used only at the end. Some brands have many more photos than others."],
  ["4", "Pipeline", "Six steps: data, preprocess, train, evaluate, export, deploy."],
  ["5", "Model", "Transfer learning with EfficientNetV2-B0. Stage 1 trains only the last layer (" + pct(P.top1_accuracy) + "). Stage 2 fine-tunes more of the network (" + pct(T.top1_accuracy) + ")."],
  ["6", "Training setup", "AdamW optimiser, label smoothing, augmentation (flip, rotate, zoom…), 12 epochs, trained on a CPU in about an hour."],
  ["7", "Curves", "Loss goes down and accuracy goes up. The best epoch was chosen on the validation set, not the test set."],
  ["8", "Results", `${pct(T.top1_accuracy)} top-1 accuracy, ${pct(T.top3_accuracy)} top-3 accuracy, macro F1 ${T.macro_f1.toFixed(2)}. Fine-tuning improved the baseline by about ${((T.top1_accuracy - P.top1_accuracy) * 100).toFixed(0)} points.`],
  ["9", "Easy and hard brands", "Easiest: MINI, Geo, HUMMER (very distinctive). Hardest: Mitsubishi, Porsche, Eagle (few photos or look-alikes)."],
  ["10", "Mix-ups", "The model mostly confuses brands that share designs or parent companies, for example Chevrolet and GMC."],
  ["11", "Sample predictions", "Random test photos, not hand-picked. Wrong answers are in red and usually have low confidence."],
  ["12", "Deployment", "The model runs inside the browser, so the website is just static files on Vercel. **Switch to the live demo here (see 5.2).**"],
  ["13", "Limitations", "Mostly older cars, some brands have one model only, no “unknown” class. Future work: detect the car first, newer data."],
  ["14", "Conclusion", "Repeat the three key points: it works, fine-tuning helped a lot, it is deployed as a website. Thank the audience."],
]));
c.push(h2("5.2 The live demo (about 1 minute)"));
c.push(...steps([
  "Have the website already open in a browser tab **before** you start (open it a few minutes early so the model is loaded).",
  "Click the **BMW**, **Ferrari** and **Mercedes-Benz** examples. They are predicted correctly with high confidence.",
  "Click the **Porsche** example. The model is wrong here, with low confidence. Use this to make an honest point: “When the confidence is low, the model is telling us it is not sure.”",
  "If you have a car photo of your own (for example your family’s car), upload it live. It is the most memorable moment of the talk.",
]));
c.push(callout("Backup plan", ["If the internet fails, run `run_demo` on your laptop and use `localhost:8000`. Keep a screenshot of a correct prediction in your slides as a last resort."], WARN));
c.push(h2("5.3 Record the voice-over video and upload it to YouTube"));
c.push(...steps([
  "Open the `.pptx` in PowerPoint. Go to **Slide Show → Record Slide Show** and record each slide while reading your script. (Or use any screen recorder such as the Xbox Game Bar on Windows: press **Win + G**.)",
  "Export a video: **File → Export → Create a Video**, choose Full HD, and save the `.mp4`.",
  "On **youtube.com** click **Create → Upload video**, upload the file, and set visibility to **Unlisted** (or Public). Copy the video link and paste it into `web/links.json`.",
]));
c.push(p("Tip: record in a quiet room, speak slowly, and keep it to 5 to 8 minutes. Do one slide at a time; you can re-record a single slide."));

c.push(h1("Part 6. Questions your teacher may ask"));
c.push(table([3400, 6238], ["Question", "A simple, honest answer"], [
  ["What is transfer learning and why did you use it?", "A network already trained on millions of everyday images already understands edges, shapes and textures. We reuse it and only teach it the car brands. It needs far less data and time than training from scratch."],
  ["Why is accuracy 86.8% and not 100%?", "Some brands look alike, some have only a few photos, and photos vary a lot (angle, light, background). For 49 fine-grained classes on a CPU, 86.8% is a strong result, and the right brand is in the top 3 guesses 95.8% of the time."],
  ["What is top-3 accuracy?", "The share of photos where the correct brand is among the model’s three highest guesses."],
  ["What is macro F1?", "An average of the F1 score of every brand, so small brands count as much as big ones. It is 0.87 here, close to the accuracy, so the model is not just good at the big brands."],
  ["Did the model overfit?", "A little: training accuracy reaches about 97% while validation is about 87%. We reduced it with augmentation, dropout, label smoothing and by choosing the best epoch on the validation set. The test score matches validation, so the result is honest."],
  ["Why do you have train, validation and test sets?", "Train: the model learns from it. Validation: we choose settings and the best epoch. Test: untouched until the very end, so the final number is a fair estimate on new photos."],
  ["Did you collect the data yourself?", "No, we used a secondary dataset, Stanford Cars (Krause et al., 2013), which the assignment allows. We converted its make/model/year labels into 49 brand labels."],
  ["Is this detection or classification?", "Classification: the model decides which brand is shown. Detection would also locate the car with a box. The dataset has boxes, so adding a detection step is our main future-work idea."],
  ["What happens if I upload a photo that is not a car?", "It still names one of the 49 brands, usually with low confidence, because we did not train an “unknown” class. This is a known limitation."],
  ["How does it run in the browser without a server?", "The trained model is saved in the ONNX format (24 MB). The page downloads it and runs it with ONNX Runtime Web (WebAssembly). The photo never leaves your device, and hosting is free because the site is only static files."],
  ["Why EfficientNetV2-B0?", "It is accurate for its size (about 6 million parameters), fast on a CPU, and small enough to run in a browser."],
  ["Did you use a GPU?", "No. Training took about an hour on 4 CPU cores. On a GPU it would be much faster."],
  ["What would you improve?", "Detect and crop the car first, train on newer and larger data, add an “unknown” class, use a higher image resolution."],
]));

c.push(h1("Part 7. Key numbers on one page"));
c.push(table([4200, 5438], ["Item", "Value"], [
  ["Task", "Car brand recognition (image classification), 49 brands"],
  ["Dataset", "Stanford Cars, 16,185 photos, secondary dataset"],
  ["Split", "Train 7,331 · Validation 813 · Test 8,041 (official test split)"],
  ["Model", "EfficientNetV2-B0, ImageNet pre-trained, about 5.9 million parameters"],
  ["Input", "224 × 224 colour photo"],
  ["Training", "12 epochs, batch size 32, AdamW (peak learning rate 2e-4), label smoothing 0.1, CPU only (about 1 hour)"],
  ["Baseline (only last layer trained)", `${pct(P.top1_accuracy)} top-1, ${pct(P.top3_accuracy)} top-3, macro F1 ${P.macro_f1.toFixed(2)}`],
  ["**Final result (test set)**", `**${pct(T.top1_accuracy)} top-1, ${pct(T.top3_accuracy)} top-3, macro F1 ${T.macro_f1.toFixed(2)}**`],
  ["Best brands (F1)", "MINI 0.96, Geo 0.95, HUMMER 0.94, Isuzu 0.94, Maybach 0.93"],
  ["Hardest brands (F1)", "Mitsubishi 0.75, Porsche 0.76, Eagle 0.77, Suzuki 0.78, Ram 0.78"],
  ["Deployed model", "ONNX, 24 MB, runs in the browser in about 0.1 to 0.2 seconds"],
]));

c.push(h1("Part 8. Report and LinkedIn"));
c.push(h2("Project report (written with an AI tool)"));
c.push(p("The assignment asks for a report generated with Claude or ChatGPT. Paste this prompt, followed by the table from Part 7, and attach the pictures from the `reports/` folder (`training_curves.png`, `confusion_matrix.png`, `per_brand_f1.png`):"));
c.push(callout("Prompt", ["“Write a university project report titled ‘Car Brand Recognition with Deep Learning’. Sections: abstract, problem statement, dataset description, methodology (transfer learning with EfficientNetV2-B0, two training stages, augmentation), experimental setup, results with tables and discussion, limitations, future work, conclusion, references. Use only the facts and numbers I give you below and do not invent anything.”"], CODE));
c.push(gap());
c.push(h2("LinkedIn post (edit and add your links)"));
c.push(callout("Draft", [
  "I just finished my Deep Learning semester project: **Car Brand Recognition**. 🚗",
  `A model that names the brand of a car from a photo (49 brands). Fine-tuned EfficientNetV2-B0 on the Stanford Cars dataset: ${pct(T.top1_accuracy)} top-1 and ${pct(T.top3_accuracy)} top-3 accuracy on unseen test photos. The model runs entirely in the browser.`,
  "Live demo: [Vercel link]  ·  Code: [GitHub link]  ·  Video: [YouTube link]",
  "#DeepLearning #ComputerVision #MachineLearning #TransferLearning",
]));

c.push(h1("Part 9. Final checklist"));
[
  "I can start the website with `run_demo` and get predictions.",
  "My name is on slide 1 of the presentation.",
  "I practised the talk at least twice, and the live demo once.",
  "GitHub repository is **public** and contains `src`, `web`, `models`.",
  "Vercel website opens in a private window and the demo works.",
  "Report written and its link is in `web/links.json`.",
  "Voice-over video is on YouTube (Public or Unlisted) and the link works.",
  "LinkedIn post is published and the link works.",
  "I ran `python src/update_links.py` and pushed, so the website shows all five links.",
  "Submission form filled: Vercel URL, GitHub repository, YouTube video, LinkedIn post.",
].forEach((t) => c.push(check(t)));

c.push(h1("Glossary"));
c.push(table([2600, 7038], ["Word", "Meaning"], [
  ["Model / weights", "The trained “brain” of the project: a file of numbers that the program uses to make predictions."],
  ["Neural network", "A program made of many layers of simple calculations, loosely inspired by the brain."],
  ["Epoch", "One full pass over all training photos."],
  ["Fine-tuning", "Continuing to train a pre-trained model on your own data."],
  ["Overfitting", "Memorising the training photos instead of learning general patterns; shows as a big gap between training and validation scores."],
  ["Augmentation", "Randomly flipping, rotating or zooming training photos so the model sees more variety."],
  ["Confusion matrix", "A table showing, for each true brand, which brand the model predicted."],
  ["ONNX", "A universal file format for trained models, which lets the model run in a browser."],
  ["Vercel", "A free service that publishes a website from your GitHub repository."],
]));

// ---- document ---------------------------------------------------------------
const doc = new Document({
  creator: "Car Brand Recognition project", title: "Car Brand Recognition: Beginner's Guide",
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: INK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 34, bold: true, font: FONT, color: BLUE }, paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: FONT, color: INK }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: numberings },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Car Brand Recognition · Beginner's guide · page ", { size: 18, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: GREY })] })] }) },
    children: c,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  const out = path.join(ROOT, "START_HERE_Beginner_Guide.docx");
  fs.writeFileSync(out, buf);
  console.log("wrote", out);
});
