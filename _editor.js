// _editor.js
import { virtualStorage } from "./_scripts.js";

export const editorBackend = {
  /**
   * 仮想ストレージ内のすべてのJSファイルを1つに連結して Blob URL に変換する（エディタ実行用）
   */
  buildProject() {
    let combinedUserCode = "";

    for (const path in virtualStorage.files) {
      if (path.startsWith("script/")) {
        combinedUserCode += `\n/* --- Start of ${path} --- */\n`;
        combinedUserCode += virtualStorage.files[path];
        combinedUserCode += `\n/* --- End of ${path} --- */\n`;
      }
    }

    const blob = new Blob([combinedUserCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  },

  /**
   * ★単体で完全起動するゲームパッケージ（ZIP）を自動生成してダウンロードする
   */
  async exportAsZip() {
    // 1. JSZipのインスタンスを作成（index.htmlで読み込んだライブラリを使用）
    const zip = new JSZip();

    // 2. 【システム】解凍後に単体で動くためのプレイヤー用 index.html の文字列
    const playerHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>My JS-Scratch Game</title>
    <style>
        body, html { margin:0; padding:0; width:100%; height:100%; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        canvas { background:#1a1a1a; box-shadow: 0 0 20px rgba(0,0,0,0.5); width: 100vmin; height: 75vmin; } /* 4:3比率を維持 */
    </style>
</head>
<body>
    <canvas id="game-canvas"></canvas>
    <script type="module" src="main.js"></script>
</body>
</html>`;
    zip.file("index.html", playerHtml);

    // 3. 【システム】エディタのUIを省いた、純粋な再生専用の main.js の文字列
    const playerJs = `import { api } from "./api.js";
import { callBack } from "./callBack.js";

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// 再生専用画面の基本解像度を 800x600 に固定
canvas.width = 800;
canvas.height = 600;

window.api = api;
window.onStart = callBack.start.bind(callBack);
window.onTick = callBack.tick.bind(callBack);
api._setContext(ctx);

// ユーザーが作った連結済みのコードファイルを動的読み込み
await import("./project/script/game.js");

if (callBack._onStartCallback) callBack._onStartCallback();

function loop() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (callBack._onTickCallback) callBack._onTickCallback();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);`;
    zip.file("main.js", playerJs);

    try {
      // 4. 【システム】現在サーバー上にある自分の _api.js と _callBack.js をテキストとして無傷で回収して同梱
      const apiText = await fetch("_api.js").then(res => res.text());
      const callBackText = await fetch("_callBack.js").then(res => res.text());
      zip.file("api.js", apiText);
      zip.file("callBack.js", callBackText);

      // 5. 【ユーザーファイル】全JSスクリプトを上から順番に1つに結合して書き出し
      let combinedUserCode = "";
      for (const path in virtualStorage.files) {
        if (path.startsWith("script/")) {
          combinedUserCode += `\n/* --- ${path} --- */\n` + virtualStorage.files[path] + "\n";
        }
      }
      zip.file("project/script/game.js", combinedUserCode);

      // 6. 【ユーザーファイル】仮想コスチューム（Base64）をバイナリに戻してZIPに格納
      for (const name in virtualStorage.costumes) {
        const blob = dataURLtoBlob(virtualStorage.costumes[name]);
        zip.file(`project/costume/${name}.png`, blob);
      }

      // 7. 【ユーザーファイル】仮想サウンド（Base64）をバイナリに戻してZIPに格納
      for (const name in virtualStorage.sounds) {
        const blob = dataURLtoBlob(virtualStorage.sounds[name]);
        zip.file(`project/sound/${name}.mp3`, blob);
      }

      // 8. ZIPを圧縮生成してブラウザからダウンロードさせる
      const content = await zip.generateAsync({ type: "blob" });
      const element = document.createElement("a");
      element.href = URL.createObjectURL(content);
      element.download = "js_scratch_project.zip";
      element.click();
      console.log("💾 ZIP Project Exported Successfully!");

    } catch (error) {
      console.error("ZIPエクスポート中にエラーが発生したよ:", error);
      alert("ZIPの作成に失敗しちゃったみたい。コンソールログを確認してみてね。");
    }
  }
};

/**
 * Base64のデータURL文字列を、本物のファイルデータ(Blob)に逆変換するヘルパー関数
 */
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
