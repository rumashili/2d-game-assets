// _editor.js
import { virtualStorage } from "./_scripts.js";

export const editorBackend = {
  /**
   * 仮想スクリプトを1つに連結して、そのまま Blob URL に変換する
   */
  buildProject() {
    // 将来的に複数ファイルになったら、ここでオブジェクト内をループして全部連結すればOK！
    const userCode = virtualStorage.files["script/game.js"] || "";

    // ユーザーの生のコードをそのまま Blob 化（文字列操作をしないので安全！）
    const blob = new Blob([userCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  },

  /**
   * プロジェクトをZIPでダウンロード（モック）
   */
  exportAsZip() {
    console.log("Saving project to ZIP...");
    alert("ここにZIP展開処理が入ります。");
  }
};