// _editor.js
import { virtualStorage } from "./_scripts.js";

export const editorBackend = {
  /**
   * 🚚 すべての仮想ファイルを1つの大きなBlob実行可能URLにバンドルするよ
   */
  buildProject() {
    // 実行前に、画面のtextareaの最新の文字を確実にストレージに回収する
    const textarea = document.getElementById('code-input');
    // 現在アクティブなファイルのパスをヘッダーなどから推測、またはメインのgame.jsを同期
    const activePath = document.getElementById('current-path-text').textContent.replace('editor / ', '').trim();
    if (textarea && virtualStorage.files[activePath] !== undefined) {
      virtualStorage.saveFile(activePath, textarea.value);
    }

    let combinedCode = "";

    // ① すべてのスクリプトファイルを結合する
    // game.js が最後に実行されるように並び替えて結合するよ
    const filePaths = Object.keys(virtualStorage.files);
    
    // game.js を最後にするソート処理
    filePaths.sort((a, b) => {
      if (a === "script/game.js") return 1;
      if (b === "script/game.js") return -1;
      return 0;
    });

    filePaths.forEach(path => {
      combinedCode += `\n/* --- File: ${path} --- */\n`;
      combinedCode += virtualStorage.files[path];
    });

    // ② 結合した巨大なJavaScript文字列を、ブラウザが読み込めるBlob URLに変換！
    const blob = new Blob([combinedCode], { type: "application/javascript" });
    return URL.createObjectURL(blob);
  },

  /**
   * 📦 現在開発中のすべてのファイル(コード＋アセット)をZIPに固めてダウンロードさせるよ
   */
  exportAsZip() {
    if (typeof JSZip === "undefined") {
      alert("ZIPライブラリが読み込まれていないよ。ネットの接続を確認してね！");
      return;
    }

    const zip = new JSZip();

    // 1. コードファイルをZIPに詰める
    Object.keys(virtualStorage.files).forEach(path => {
      zip.file(path, virtualStorage.files[path]);
    });

    // 2. コスチューム画像をZIPに詰める(DataURLからバイナリに変換)
    Object.keys(virtualStorage.costumes).forEach(name => {
      const dataUrl = virtualStorage.costumes[name];
      const base64Data = dataUrl.split(',')[1];
      zip.file(`costume/${name}.png`, base64Data, { base64: true });
    });

    // 3. サウンド音源をZIPに詰める
    Object.keys(virtualStorage.sounds).forEach(name => {
      const dataUrl = virtualStorage.sounds[name];
      const base64Data = dataUrl.split(',')[1];
      // 拡張子は一旦mp3として保存(環境に合わせて適切に処理してね)
      zip.file(`sound/${name}.mp3`, base64Data, { base64: true });
    });

    // 4. ZIPファイルを生成してダウンロード実行！
    zip.generateAsync({ type: "blob" }).then((content) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = "js-scratch-project.zip";
      a.click();
    }).catch(err => {
      console.error("ZIPの生成に失敗しちゃった:", err);
      alert("ZIPの書き出し中にエラーが起きちゃった。");
    });
  }
};
