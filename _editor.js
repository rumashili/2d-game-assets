// _editor.js
import { virtualStorage } from "./_scripts.js";

export const editorBackend = {
  /**
   * 仮想ストレージ内のすべてのJSファイルを1つに連結して Blob URL に変換する
   */
  buildProject() {
    let combinedUserCode = "";

    // 仮想ストレージ内にあるすべてのファイルをループでチェック
    for (const path in virtualStorage.files) {
      // script/ フォルダの中身（JSファイル）だけを抽出して結合するよ
      if (path.startsWith("script/")) {
        combinedUserCode += `\n/* --- Start of ${path} --- */\n`;
        combinedUserCode += virtualStorage.files[path];
        combinedUserCode += `\n/* --- End of ${path} --- */\n`;
      }
    }

    // windowグローバル方式なので、合体させたユーザーコードをそのままBlob（仮想ファイル）にする
    const blob = new Blob([combinedUserCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  },

  /**
   * プロジェクトをZIPでダウンロード（モック）
   */
  exportAsZip() {
    console.log("Saving project to ZIP...");
    alert("ここにZIP展開処理が入ります。仮想環境のデータを本物のフォルダ構成に展開します。");
  }
};