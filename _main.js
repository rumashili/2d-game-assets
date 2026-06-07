// _main.js
import { virtualStorage } from "./_scripts.js";
import { editorBackend } from "./_editor.js";
import { api } from "./_api.js";
import { callBack } from "./_callBack.js";

const resizer = document.getElementById('drag-bar');
const gamePanel = document.getElementById('game-panel');
const codeInput = document.getElementById('code-input');
const canvas = document.getElementById('game-canvas');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
const exportBtn = document.getElementById('export-btn');

let isDragging = false;
let animationFrameId = null;

// --- ① ドラッグバーによる可変境界処理 ---
resizer.addEventListener('mousedown', () => { isDragging = true; document.body.style.cursor = 'col-resize'; });
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth > 200 && newWidth < window.innerWidth * 0.8) {
    gamePanel.style.width = `${newWidth}px`;
    resizeCanvas();
  }
});
window.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; document.body.style.cursor = 'default'; } });

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const size = Math.min(wrapper.clientWidth - 20, (wrapper.clientHeight - 20) * (4/3));
  canvas.width = size;
  canvas.height = size * (3/4);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- ② 🟢実行・🔴停止処理 (windowへのインジェクション) ---

function stopGame() {
  if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
  callBack.reset(); // コールバックを綺麗にクリア
  
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  console.log("🔴 Game Stopped");
}

async function runGame() {
  stopGame();

  // エディタの文字を仮想ストレージに保存
  virtualStorage.saveFile("script/game.js", codeInput.value);

  // 1. ★ゲーム実行前に、必要なAPIや登録関数をwindow（グローバル環境）に生やす！
  window.api = api;
  window.onStart = callBack.start.bind(callBack);
  window.onTick = callBack.tick.bind(callBack);

  // CanvasのコンテキストをAPIに預ける
  const ctx = canvas.getContext('2d');
  api._setContext(ctx);

  // 2. _editor.jsで作った安全な Blob URL をインポート
  const blobURL = editorBackend.buildProject();

  try {
    // これが実行された瞬間に、window.onStart や window.onTick が裏で叩かれて、callBackの中にユーザーの処理が登録されるよ！
    await import(`${blobURL}?t=${Date.now()}`);

    // 3. 初期化処理（onStart）を1回実行
    if (callBack._onStartCallback) callBack._onStartCallback();

    // 4. ゲームループの開始
    console.log("🟢 Game Started");
    function loop() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 毎フレーム、ユーザーの登録した「onTick」をループ内で実行！
      if (callBack._onTickCallback) callBack._onTickCallback();

      animationFrameId = requestAnimationFrame(loop);
    }
    animationFrameId = requestAnimationFrame(loop);

  } catch (error) {
    console.error("エラーが発生したよ:", error);
    alert("コードにエラーがあるみたい！コンソールを確認してみてね。");
  }
}

runBtn.addEventListener('click', runGame);
stopBtn.addEventListener('click', stopGame);
exportBtn.addEventListener('click', () => editorBackend.exportAsZip());