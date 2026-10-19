(function (global) {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  function showError(message) {
    const output = $("status");
    if (output) {
      output.textContent = message;
    } else {
      console.error(message);
    }
  }

  function initialize() {
    const required = [
      "qrInput",
      "qrFile",
      "generateButton",
      "status"
    ];

    const missing = required.filter(function (id) {
      return !$(id);
    });

    if (missing.length) {
      showError(
        "画面の要素が見つかりません: " + missing.join(", ")
      );
      return;
    }

    $("generateButton").addEventListener("click", function () {
      if (!global.RPG3QRCore) {
        showError("rpg3-core.js が読み込まれていません。");
        return;
      }

      if (!global.RPG3QRGenerator) {
        showError("qr-generator-local.js が読み込まれていません。");
        return;
      }

      showError(
        "必要なライブラリを確認しました。QR解析・編集処理の実装が必要です。"
      );
    });

    showError("画面を初期化しました。");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})(window);