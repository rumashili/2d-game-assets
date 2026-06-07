// _main.js
import { virtualStorage } from "./_scripts.js";
import { editorBackend } from "./_editor.js";
import { api } from "./_api.js";
import { callBack } from "./_callBack.js";

// ==========================================
// 1. DOM要素の取得
// ==========================================
const resizer = document.getElementById('drag-bar');
const gamePanel = document.getElementById('game-panel');
const canvas = document.getElementById('game-canvas');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
const exportBtn = document.getElementById('export-btn');

const addScriptBtn = document.getElementById('add-script-btn');
const scriptList = document.getElementById('script-list');
const addCostumeBtn = document.getElementById('add-costume-btn');
const addSoundBtn = document.getElementById('add-sound-btn');
const costumeList = document.getElementById('costume-list');
const soundList = document.getElementById('sound-list');
const currentPathText = document.getElementById('current-path-text');

// Monacoに代わる軽量textareaエディタの取得
const codeInput = document.getElementById('code-input');

// APIドキュメント関連要素
const toggleDocBtn = document.getElementById('toggle-doc-btn');
const closeDocBtn = document.getElementById('close-doc-btn');
const docPanel = document.getElementById('doc-panel');
const docResizer = document.getElementById('doc-drag-bar');

let isDragging = false;
let isDocDragging = false;
let animationFrameId = null;
let currentFilePath = "script/game.js";

// ==========================================
// 2. メインのドラッグバーによる画面幅リサイズ
// ==========================================
resizer.addEventListener('mousedown', () => {
  isDragging = true;
  document.body.style.cursor = 'col-resize';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth > 200 && newWidth < window.innerWidth * 0.8) {
    gamePanel.style.width = `${newWidth}px`;
    resizeCanvas();
  }
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = 'default';
  }
});

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const size = Math.min(wrapper.clientWidth - 20, (wrapper.clientHeight - 20) * (4 / 3));
  canvas.width = size;
  canvas.height = size * (3 / 4);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


// ==========================================
// 3. ✍️ エディタの初期化と自動保存ロジック
// ==========================================
// 最初、仮想ストレージからコードを取り出して反映
if (virtualStorage.files[currentFilePath]) {
  codeInput.value = virtualStorage.files[currentFilePath];
} else {
  codeInput.value = "// 起動コードをここに記述してね\n";
  virtualStorage.saveFile(currentFilePath, codeInput.value);
}

// 文字が打ち込まれるたびに仮想ストレージへ同期保存
codeInput.addEventListener('input', () => {
  virtualStorage.saveFile(currentFilePath, codeInput.value);
});


// ==========================================
// 4. 📘 APIドキュメントの開閉 ＆ ドラッグリサイズ
// ==========================================
function toggleDoc(show) {
  const displayMode = show ? 'flex' : 'none';
  docPanel.style.display = displayMode;
  docResizer.style.display = displayMode;
}

toggleDocBtn.addEventListener('click', () => {
  const isHidden = docPanel.style.display === 'none' || docPanel.style.display === '';
  toggleDoc(isHidden);
});

closeDocBtn.addEventListener('click', () => toggleDoc(false));

docResizer.addEventListener('mousedown', () => {
  isDocDragging = true;
  document.body.style.cursor = 'col-resize';
});

window.addEventListener('mousemove', (e) => {
  if (!isDocDragging) return;
  
  const editorRect = document.getElementById('editor-panel').getBoundingClientRect();
  const newWidth = editorRect.right - e.clientX;
  
  // エディタのサイズを圧迫しすぎない範囲でリサイズ
  if (newWidth > 150 && newWidth < editorRect.width * 0.7) {
    docPanel.style.width = `${newWidth}px`;
  }
});

window.addEventListener('mouseup', () => {
  if (isDocDragging) {
    isDocDragging = false;
    document.body.style.cursor = 'default';
  }
});


// ==========================================
// 5. 複数ファイルの切り替えロジック
// ==========================================
addScriptBtn.addEventListener('click', () => {
  const filename = prompt("新しいスクリプトの名前を入力してね (例: player.js)");
  if (!filename) return;

  const fullFilename = filename.endsWith('.js') ? filename : `${filename}.js`;
  const path = `script/${fullFilename}`;

  if (virtualStorage.files[path]) {
    alert("そのファイル名は既に存在しているよ！");
    return;
  }

  virtualStorage.saveFile(path, `// ${fullFilename} のコードをここに書くよ\n`);

  const li = document.createElement('li');
  li.className = 'file-item';
  li.innerHTML = `<i class="fas fa-file-code" style="color: #cbd5e1;"></i> ${fullFilename}`;
  li.setAttribute('data-filepath', path);
  scriptList.appendChild(li);

  switchFile(path, li);
});

function switchFile(path, element) {
  // 現在の入力内容をしっかりセーブ
  virtualStorage.saveFile(currentFilePath, codeInput.value);

  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  currentFilePath = path;
  // textareaの中身を切り替え
  codeInput.value = virtualStorage.files[path] || "";
  currentPathText.textContent = `editor / ${path}`;
}

scriptList.addEventListener('click', (e) => {
  const item = e.target.closest('.file-item');
  if (!item) return;
  const path = item.getAttribute('data-filepath');
  if (path) switchFile(path, item);
});


// ==========================================
// 6. ゲームの実行・停止
// ==========================================
function stopGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  callBack.reset();
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  console.log("🔴 Game Stopped");
}

async function runGame() {
  stopGame();

  // 実行直前にtextareaの内容を同期セーブ
  virtualStorage.saveFile(currentFilePath, codeInput.value);

  window.api = api;
  window.onStart = callBack.start.bind(callBack);
  window.onTick = callBack.tick.bind(callBack);
  window.virtualStorage = virtualStorage; 

  const ctx = canvas.getContext('2d');
  api._setContext(ctx);

  // _editor.jsで書き換えた、新しいインポート用URLを取得
  const blobURL = editorBackend.buildProject();

  try {
    await import(`${blobURL}?t=${Date.now()}`);

    if (callBack._onStartCallback) callBack._onStartCallback();

    console.log("🟢 Game Started");
    function loop() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (callBack._onTickCallback) callBack._onTickCallback();
      animationFrameId = requestAnimationFrame(loop);
    }
    animationFrameId = requestAnimationFrame(loop);

  } catch (error) {
    console.error("ユーザーコードの実行エラー:", error);
    alert("コードにエラーがあるみたいだよ！コンソールが使えない場合はコードを確認してみてね。");
  }
}

runBtn.addEventListener('click', runGame);
stopBtn.addEventListener('click', stopGame);
exportBtn.addEventListener('click', () => editorBackend.exportAsZip());


// ==========================================
// 7. アセットの仮想インポート処理
// ==========================================
function importAsset(type, accept) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = accept;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const assetName = file.name.substring(0, file.name.lastIndexOf('.'));
    const reader = new FileReader();
    
    reader.onload = () => {
      const dataUrl = reader.result;

      if (type === 'costume') {
        virtualStorage.addCostume(assetName, dataUrl);
        const img = new Image();
        img.src = dataUrl;
        api.costumeList[assetName] = { img: img, loaded: true };
      } else if (type === 'sound') {
        virtualStorage.addSound(assetName, dataUrl);
        const audio = new Audio(dataUrl);
        api.soundList[assetName] = audio;
      }
      updateTreeUI(type, assetName, file.name);
    };
    reader.readAsDataURL(file);
  });
  fileInput.click();
}

function updateTreeUI(type, assetName, fullName) {
  const listElement = type === 'costume' ? costumeList : soundList;
  const emptyMsg = listElement.querySelector('.empty-msg');
  if (emptyMsg) emptyMsg.remove();

  const li = document.createElement('li');
  li.className = 'file-item';
  
  if (type === 'costume') {
    li.innerHTML = `<i class="fas fa-image" style="color: #ffb703;"></i> ${fullName}`;
  } else {
    li.innerHTML = `<i class="fas fa-volume-high" style="color: #2196f3;"></i> ${fullName}`;
  }
  
  li.setAttribute('data-name', assetName);
  listElement.appendChild(li);
}

addCostumeBtn.addEventListener('click', () => importAsset('costume', 'image/*'));
addSoundBtn.addEventListener('click', () => importAsset('sound', 'audio/*'));
