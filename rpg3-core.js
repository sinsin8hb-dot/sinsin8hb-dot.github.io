(function (global) {
  "use strict";

  function toBytes(data) {
    if (data instanceof Uint8Array) {
      return new Uint8Array(data);
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data.slice(0));
    }
    throw new Error("対応していないQRデータ形式です");
  }

  function inspect(data) {
    const bytes = toBytes(data);

    return {
      encrypted: bytes,
      length: bytes.length,
      supported: false,
      message: "QR形式の解析処理が未実装です"
    };
  }

  function editStats(data, stats, mode) {
    throw new Error(
      "QR形式と暗号化処理が未実装のため、ステータス変更は実行できません"
    );
  }

  function combine(data, stats) {
    throw new Error(
      "QR形式と暗号化処理が未実装のため、QRの合成は実行できません"
    );
  }

  global.RPG3QRCore = {
    inspect: inspect,
    editStats: editStats,
    combine: combine
  };
})(window);