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
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("PNGまたはJPEGの画像ファイルを選んでください。");
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error("画像が大きすぎます。15MB以下の画像を使ってください。");
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = url;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(
        new Error("画像を開けませんでした。PNGまたはJPEGのスクリーンショットを試してください。")
      );
      img.src = url;
    });

    const maxSide = 2200;
    const scale = Math.min(
      1,
      maxSide / Math.max(img.naturalWidth, img.naturalHeight)
    );

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
    const candidates = [];

    candidates.push({
      sx: 0, sy: 0, sw: w, sh: h, mode: "original"
    });

    candidates.push({
      sx: Math.round(w * 0.08),
      sy: Math.round(h * 0.08),
      sw: Math.round(w * 0.84),
      sh: Math.round(h * 0.84),
      mode: "center"
    });

    for (let col = 0; col < 3; col++) {
      candidates.push({
        sx: Math.round(w * col / 3),
        sy: 0,
        sw: Math.round(w / 3),
        sh: h,
        mode: `col${col}`
      });
    }

    candidates.push({
      sx: 0, sy: 0, sw: Math.round(w * 0.55), sh: h, mode: "left-half"
    });

    candidates.push({
      sx: Math.round(w * 0.45),
      sy: 0,
      sw: Math.round(w * 0.55),
      sh: h,
      mode: "right-half"
    });

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const sx = Math.round(w * col / 3);
        const sy = Math.round(h * row / 3);
        const ex = Math.round(w * (col + 1) / 3);
        const ey = Math.round(h * (row + 1) / 3);

        candidates.push({
          sx,
          sy,
          sw: ex - sx,
          sh: ey - sy,
          mode: `tile-${row}-${col}`
        });
      }
    }

    for (const crop of candidates) {
      const cw = Math.max(1, crop.sw);
      const ch = Math.max(1, crop.sh);
      const scale2 = Math.min(2, 1800 / Math.max(cw, ch));

      scanCanvas.width = Math.max(1, Math.round(cw * scale2));
      scanCanvas.height = Math.max(1, Math.round(ch * scale2));

      scanCtx.clearRect(0, 0, scanCanvas.width, scanCanvas.height);
      scanCtx.imageSmoothingEnabled = false;

      scanCtx.drawImage(
        canvas,
        crop.sx,
        crop.sy,
        cw,
        ch,
        0,
        0,
        scanCanvas.width,
        scanCanvas.height
      );

      const data = scanCtx.getImageData(
        0, 0, scanCanvas.width, scanCanvas.height
      );

      const result = jsQR(
        data.data,
        scanCanvas.width,
        scanCanvas.height,
        { inversionAttempts: "attemptBoth" }
      );

      if (result && result.binaryData && result.binaryData.length) {
        return Uint8Array.from(result.binaryData);
      }

      const px = data.data;

      for (let i = 0; i < px.length; i += 4) {
        const gray = Math.round(
          0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
        );

        const v = gray < 150 ? 0 : 255;
        px[i] = px[i + 1] = px[i + 2] = v;
      }

      scanCtx.putImageData(data, 0, 0);

      const retry = scanCtx.getImageData(
        0, 0, scanCanvas.width, scanCanvas.height
      );

      const result2 = jsQR(
        retry.data,
        scanCanvas.width,
        scanCanvas.height,
        { inversionAttempts: "attemptBoth" }
      );

      if (result2 && result2.binaryData && result2.binaryData.length) {
        return Uint8Array.from(result2.binaryData);
      }
    }

    throw new Error(
      "QRコードを検出できませんでした。QRが小さい画像・複数QRが並んだ画像では、QRを1つだけ大きく切り抜いて保存してから選んでください。"
    );
  }

  async function parseFile(file) {
    if (!window.jsQR || !window.RPG3QRCore) {
      throw new Error(
        "解析ライブラリを読み込めませんでした。インターネット接続を確認してページを再読み込みしてください。"
      );
    }

    const encrypted = await decodeImage(file);
    return RPG3QRCore.inspect(encrypted);
  }

  async function onFile(file) {
    loaded = null;
    generated = null;

    $("editor-panel").classList.add("hidden");
    $("output-panel").classList.add("hidden");
    $("download-button").disabled = true;

    if (!file) return;

    try {
      showStatus(
        `QR画像を読み取り中…（${(file.size / 1024).toFixed(0)} KB / ${file.type || "形式不明"}）`,
        "info"
      );

      loaded = await parseFile(file);

      $("character-name").textContent =
        `ベースキャラクター：${loaded.name}`;

      renderFields(loaded.stats);
      $("editor-panel").classList.remove("hidden");

      showStatus(
        `読み込み成功：${loaded.length}バイト／「${loaded.name}」`,
        "success"
      );

      $("editor-panel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      loaded = null;

      const libraryState =
        `診断：jsQR=${typeof window.jsQR === "function" ? "読込済み" : "未読込"} / RPG3QRCore=${window.RPG3QRCore ? "読込済み" : "未読込"}`;

      showStatus(
        `${error && error.message ? error.message : "読み取りに失敗しました。"}\n${libraryState}`,
        "error"
      );
    }
  }

  async function onDonorFile(file) {
    donor = null;
    generated = null;

    $("output-panel").classList.add("hidden");
    $("download-button").disabled = true;

    if (!file) {
      $("donor-status").textContent = "コピー元QRは未選択です。";
      return;
    }

    try {
      $("donor-status").className = "alert info";
      $("donor-status").textContent = "コピー元を読み取り中…";

      donor = await parseFile(file);

      $("donor-status").className = "alert success";
      $("donor-status").textContent =
        `読み込み成功：${donor.length}バイト／「${donor.name}」`;
    } catch (error) {
      donor = null;
      $("donor-status").className = "alert error";
      $("donor-status").textContent =
        `${error && error.message ? error.message : "コピー元を読み取れませんでした。"}`;
    }
  }

  async function generate() {
    if (!loaded) {
      return showStatus("先にベースQR画像を読み込んでください。", "warn");
    }

    $("output-panel").classList.remove("hidden");
    showOutputStatus("入力を確認しています…", "info");

    try {
      const statsSource =
        document.querySelector('input[name="stats-source"]:checked').value;

      const equipmentMode =
        document.querySelector('input[name="equipment-mode"]:checked').value;

      if (
        (statsSource === "donor" || equipmentMode === "donor") &&
        !donor
      ) {
        throw new Error(
          "選んだ項目を移すには、コピー元QR画像も読み込んでください。"
        );
      }

      if (statsSource === "base" && equipmentMode === "base") {
        const values = labels.map((_, i) => {
          const input = $(`stat-${i}`);
          const value = input.value.trim();

          if (value === "") {
            throw new Error(`${labels[i]}を入力してください。`);
          }

          const number = Number(value);

          if (
            !Number.isInteger(number) ||
            number < 0 ||
            number > 65535
          ) {
            throw new Error(
              `${labels[i]}は0〜65535の整数で入力してください。`
            );
          }

          return number;
        });

        generated = RPG3QRCore.editStats(loaded, values, "keep");
      } else {
        generated = RPG3QRCore.combine(
          loaded,
          donor,
          statsSource,
          equipmentMode
        );

        if (statsSource === "base") {
          const values = labels.map((_, i) => {
            const input = $(`stat-${i}`);
            const value = input.value.trim();

            if (value === "") {
              throw new Error(`${labels[i]}を入力してください。`);
            }

            const number = Number(value);

            if (
              !Number.isInteger(number) ||
              number < 0 ||
              number > 65535
            ) {
              throw new Error(
                `${labels[i]}は0〜65535の整数で入力してください。`
              );
            }

            return number;
          });

          generated = RPG3QRCore.editStats(
            generated,
            values,
            equipmentMode === "none" ? "none" : "keep"
          );
        }
      }

      if (!window.QRCode || typeof QRCode.toCanvas !== "function") {
        throw new Error(
          "QR生成ライブラリを読み込めませんでした。インターネット接続を確認してください。"
        );
      }

      const canvas = $("output-qr");
      $("output-panel").classList.remove("hidden");
      $("download-button").disabled = true;

      showOutputStatus(
        "新しいQRを生成し、読み戻し検証をしています…",
        "info"
      );

      await new Promise((resolve, reject) =>
        QRCode.toCanvas(
          canvas,
          [
            {
              data: new Uint8ClampedArray(generated.encrypted),
              mode: "byte"
            }
          ],
          {
            errorCorrectionLevel: "L",
            version: 8,
            margin: 4,
            width: 700,
            color: {
              dark: "#000000",
              light: "#ffffff"
            }
          },
          err => err ? reject(err) : resolve()
        )
      );

      const qrCtx = canvas.getContext("2d", {
        willReadFrequently: true
      });

      const pixels = qrCtx.getImageData(
        0, 0, canvas.width, canvas.height
      );

      const reread = jsQR(
        pixels.data,
        canvas.width,
        canvas.height,
        { inversionAttempts: "attemptBoth" }
      );

      if (
        !reread ||
        !bytesEqual(
          Uint8Array.from(reread.binaryData),
          generated.encrypted
        )
      ) {
        generated = null;

        throw new Error(
          "生成後のQRを読み戻したところ、元データと一致しませんでした。保存を中止しました。"
        );
      }

      const statsLabel = statsSource === "donor"
        ? `ステータス：${donor.name}からコピー`
        : "ステータス：ベースQR";

      const equipLabel = equipmentMode === "donor"
        ? `装備：${donor.name}からコピー`
        : equipmentMode === "base"
          ? "装備：ベースQRを維持"
          : "装備：なし（実験）";

      $("output-description").textContent =
        `名前・見た目：${loaded.name}を維持 · ${statsLabel} · ${equipLabel} · HP ${generated.stats[0]} / AP ${generated.stats[1]} / 攻撃 ${generated.stats[2]} / 防御 ${generated.stats[3]} / 素早さ ${generated.stats[4]}`;

      $("download-button").disabled = false;

      showOutputStatus(
        "生成QRを内部で読み戻し、データ一致を確認しました。実機での最終確認は別途必要です。",
        "success"
      );

      $("output-panel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      generated = null;
      $("download-button").disabled = true;

      showOutputStatus(
        error && error.message
          ? error.message
          : "QRを生成できませんでした。",
        "error"
      );

      $("output-panel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  // iPhoneの画像選択後に、ファイルが受け取れているか診断する処理
  $("qr-file").addEventListener("change", event => {
    const input = event.currentTarget;
    const file = input.files && input.files[0];

    if (!file) {
      showStatus(
        "診断：画像選択イベントは動きましたが、ファイルを受け取れていません。",
        "error"
      );
      return;
    }

    showStatus(
      `診断：画像を受信しました\n` +
      `ファイル名：${file.name}\n` +
      `形式：${file.type || "不明"}\n` +
      `サイズ：約${Math.round(file.size / 1024)} KB\n` +
      "QRを読み取り中…",
      "info"
    );

    onFile(file);
  });

  $("donor-file").addEventListener("change", event =>
    onDonorFile(event.target.files && event.target.files[0])
  );

  $("generate-button").addEventListener("click", generate);

  $("download-button").addEventListener("click", () => {
    if (!generated) return;

    const a = document.createElement("a");

    a.download =
      `RPG3_QR_${generated.name.replace(/[^\p{L}\p{N}_-]/gu, "_") || "edited"}.png`;

    a.href = $("output-qr").toDataURL("image/png");
    a.click();
  });

  $("reset-button").addEventListener("click", () => {
    loaded = null;
    donor = null;
    generated = null;

    $("qr-file").value = "";
    $("donor-file").value = "";

    $("donor-status").className = "alert info";
    $("donor-status").textContent = "コピー元QRは未選択です。";

    $("editor-panel").classList.add("hidden");
    $("output-panel").classList.add("hidden");
    $("download-button").disabled = true;

    showStatus("まだQR画像は読み込まれていません。", "info");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
})();