(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const labels = ["最大HP強化", "最大AP強化", "攻撃力強化", "防御力強化", "素早さ強化"];
  let loaded = null;
  let donor = null;
  let generated = null;
  let fileUrl = null;

  function showStatus(message, tone = "info") {
    const box = $("status");
    box.className = `alert ${tone}`;
    box.textContent = message;
  }
  function showOutputStatus(message, tone = "info") {
    const box = $("output-status");
    box.className = `alert ${tone}`;
    box.textContent = message;
  }
  function bytesEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  function renderFields(stats) {
    const container = $("field-grid");
    container.replaceChildren();
    labels.forEach((label, index) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const id = `stat-${index}`;
      const lab = document.createElement("label");
      lab.htmlFor = id;
      lab.textContent = label;
      const input = document.createElement("input");
      input.id = id;
      input.type = "number";
      input.min = "0";
      input.max = "65535";
      input.step = "1";
      input.inputMode = "numeric";
      input.required = true;
      input.value = String(stats[index]);
      wrap.append(lab, input);
      container.append(wrap);
    });
  }
  async function decodeImage(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("画像ファイルを選んでください。");
    if (file.size > 15 * 1024 * 1024) throw new Error("画像は15MB以下にしてください。");
    const img = new Image();
    const url = URL.createObjectURL(file);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("画像を開けませんでした。"));
      img.src = url;
    });
    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = $("scan-canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const scanCanvas = document.createElement("canvas");
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
    const candidates = [
      { sx: 0, sy: 0, sw: w, sh: h },
      { sx: Math.round(w * .08), sy: Math.round(h * .08), sw: Math.round(w * .84), sh: Math.round(h * .84) }
    ];
    for (let col = 0; col < 3; col++) {
      candidates.push({ sx: Math.round(w * col / 3), sy: 0, sw: Math.round(w / 3), sh: h });
    }
    candidates.push({ sx: 0, sy: 0, sw: Math.round(w * .55), sh: h });
    candidates.push({ sx: Math.round(w * .45), sy: 0, sw: Math.round(w * .55), sh: h });

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const sx = Math.round(w * col / 3), sy = Math.round(h * row / 3);
        const ex = Math.round(w * (col + 1) / 3), ey = Math.round(h * (row + 1) / 3);
        candidates.push({ sx, sy, sw: ex - sx, sh: ey - sy });
      }
    }

    for (const crop of candidates) {
      const cw = Math.max(1, crop.sw), ch = Math.max(1, crop.sh);
      const scale2 = Math.min(2, 1800 / Math.max(cw, ch));
      scanCanvas.width = Math.max(1, Math.round(cw * scale2));
      scanCanvas.height = Math.max(1, Math.round(ch * scale2));
      scanCtx.clearRect(0, 0, scanCanvas.width, scanCanvas.height);
      scanCtx.imageSmoothingEnabled = false;
      scanCtx.drawImage(canvas, crop.sx, crop.sy, cw, ch, 0, 0, scanCanvas.width, scanCanvas.height);
      const data = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
      const result = jsQR(data.data, scanCanvas.width, scanCanvas.height, { inversionAttempts: "attemptBoth" });
      if (result && result.binaryData && result.binaryData.length) return Uint8Array.from(result.binaryData);

      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const gray = Math.round(.299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]);
        const v = gray < 150 ? 0 : 255;
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      scanCtx.putImageData(data, 0, 0);
      const retry = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
      const result2 = jsQR(retry.data, scanCanvas.width, scanCanvas.height, { inversionAttempts: "attemptBoth" });
      if (result2 && result2.binaryData && result2.binaryData.length) return Uint8Array.from(result2.binaryData);
    }
    throw new Error("QRコードを検出できません。QRを1つだけ大きく切り抜いて試してください。");
  }

  async function parseFile(file) {
    if (!window.jsQR || !window.RPG3QRCore) throw new Error("解析ライブラリを読み込めません。ネット接続を確認して再読み込みしてください。");
    return RPG3QRCore.inspect(await decodeImage(file));
  }

  async function onFile(file) {
    loaded =