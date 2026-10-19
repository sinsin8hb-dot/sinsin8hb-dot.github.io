
(function (global) {
  "use strict";

  function loadQRCodeLibrary() {
    if (typeof global.QRCode === "function") {
      return global.QRCode;
    }

    throw new Error(
      "QRコード生成ライブラリが読み込まれていません。"
    );
  }

  function toCanvas(canvas, data, options) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new Error("描画先のCanvasがありません。");
    }

    if (data == null || data.length === 0) {
      throw new Error("QRコードにするデータがありません。");
    }

    const QRCode = loadQRCodeLibrary();
    const text =
      typeof data === "string"
        ? data
        : Array.from(data, function (byte) {
            return String.fromCharCode(byte);
          }).join("");

    const settings = Object.assign(
      {
        width: 256,
        height: 256,
        correctLevel: QRCode.CorrectLevel
          ? QRCode.CorrectLevel.M
          : undefined
      },
      options || {}
    );

    return new Promise(function (resolve, reject) {
      try {
        const holder = document.createElement("div");
        holder.style.position = "absolute";
        holder.style.left = "-10000px";

        const qr = new QRCode(holder, {
          text: text,
          width: settings.width,
          height: settings.height,
          correctLevel: settings.correctLevel
        });

        requestAnimationFrame(function () {
          try {
            const source = holder.querySelector("canvas");
            const image = holder.querySelector("img");

            if (source) {
              const ctx = canvas.getContext("2d");
              canvas.width = settings.width;
              canvas.height = settings.height;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(
                source,
                0,
                0,
                canvas.width,
                canvas.height
              );
              holder.remove();
              resolve(canvas);
              return;
            }

            if (image && image.src) {
              image.onload = function () {
                const ctx = canvas.getContext("2d");
                canvas.width = settings.width;
                canvas.height = settings.height;
                ctx.drawImage(
                  image,
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );
                holder.remove();
                resolve(canvas);
              };

              image.onerror = function () {
                holder.remove();
                reject(new Error("QR画像の読み込みに失敗しました。"));
              };

              if (image.complete) {
                image.onload();
              }
              return;
            }

            holder.remove();
            reject(new Error("QRコードを生成できませんでした。"));
          } catch (error) {
            holder.remove();
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  global.RPG3QRGenerator = {
    toCanvas: toCanvas
  };
})(window);
