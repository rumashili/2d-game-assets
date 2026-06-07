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
const codeInput = document.getElementById('code-input');
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

let isDragging = false;
let animationFrameId = null;

// 現在エディタで開いているファイルのパス（初期値は最初からある game.js）
let currentFilePath = "script/game.js";


// ==========================================
// 2. ドラッグバーによる画面幅の可変（リサイズ）処理
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
// 3. 複数ファイルの新規作成 ＆ 切り替えロジック
// ==========================================

// エディタに文字を入力するたびに、現在開いているファイルの中身を仮想ストレージにリアルタイム保存
codeInput.addEventListener('input', () => {
  virtualStorage.saveFile(currentFilePath, codeInput.value);
});

// 新しいJSファイルをツリー上に作成する処理
addScriptBtn.addEventListener('click', () => {
  const filename = prompt("新しいスクリプトの名前を入力してね (例: player.js)");
  if (!filename) return;

  // 拡張子の自動補正（付いてなければ .js をつける）
  const fullFilename = filename.endsWith('.js') ? filename : `${filename}.js`;
  const path = `script/${fullFilename}`;

  if (virtualStorage.files[path]) {
    alert("そのファイル名は既に存在しているよ！");
    return;
  }

  // 1. 仮想ストレージに空の新規ファイルを作成
  virtualStorage.saveFile(path, `// ${fullFilename} のコードをここに書くよ\n`);

  // 2. 左側のツリーUIに新しい要素を追加
  const li = document.createElement('li');
  li.className = 'file-item';
  li.textContent = `📜 ${fullFilename}`;
  li.setAttribute('data-filepath', path);
  scriptList.appendChild(li);

  // 3. 作成したファイルを自動的にエディタで開く
  switchFile(path, li);
});

// ファイルを切り替える内部関数
function switchFile(path, element) {
  // 現在開いているファイルの最新状態をしっかり保存
  virtualStorage.saveFile(currentFilePath, codeInput.value);

  // ツリー上のすべての「アクティブ（青文字）状態」を解除して、今選んだものだけを青くする
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  // 開く対象を切り替えて、エディタの中身をそのファイルの文字に書き換える
  currentFilePath = path;
  codeInput.value = virtualStorage.files[path] || "";
  
  // エディタのヘッダーの文字も更新
  document.querySelector('.panel-header').textContent = `📝 editor / ${path}`;
}

// ツリー内のJSファイルをクリックした時に切り替えるイベント（イベント委譲）
scriptList.addEventListener('click', (e) => {
  const item = e.target.closest('.file-item');
  if (!item) return;
  const path = item.getAttribute('data-filepath');
  if (path) {
    switchFile(path, item);
  }
});


// ==========================================
// 4. ゲームの実行・停止（バックエンドコア）
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

  // 1. 実行する瞬間に、現在開いているエディタの文字を確実に保存
  virtualStorage.saveFile(currentFilePath, codeInput.value);

  // 2. システムを window グローバル環境に登録
  window.api = api;
  window.onStart = callBack.start.bind(callBack);
  window.onTick = callBack.tick.bind(callBack);

  const ctx = canvas.getContext('2d');
  api._setContext(ctx);

  // 3. _editor.js で全JSファイルを結合した Blob URL を取得
  const blobURL = editorBackend.buildProject();

  try {
    // 4. 動的インポート（キャッシュ回避のタイムスタンプ付き）
    await import(`${blobURL}?t=${Date.now()}`);

    // 5. 初期化（onStart）を1回だけ実行
    if (callBack._onStartCallback) callBack._onStartCallback();

    // 6. メインのループを開始
    console.log("🟢 Game Started");
    function loop() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 結合されたすべてのファイルから登録された「onTick」を実行！
      if (callBack._onTickCallback) callBack._onTickCallback();

      animationFrameId = requestAnimationFrame(loop);
    }
    animationFrameId = requestAnimationFrame(loop);

  } catch (error) {
    console.error("ユーザーコードの実行エラー:", error);
    alert("コードにエラーがあるみたいだよ！デベロッパーツールのコンソールを見てみてね。");
  }
}

runBtn.addEventListener('click', runGame);
stopBtn.addEventListener('click', stopGame);
exportBtn.addEventListener('click', () => editorBackend.exportAsZip());


// ==========================================
// 5. アセット（画像・音）の仮想インポート処理
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
        console.log(`🎨 コスチュームを仮想インポートしました: ${assetName}`);
      } else if (type === 'sound') {
        virtualStorage.addSound(assetName, dataUrl);
        const audio = new Audio(dataUrl);
        api.soundList[assetName] = audio;
        console.log(`🎵 サウンドを仮想インポートしました: ${assetName}`);
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
  li.textContent = `${type === 'costume' ? '🎨' : '🔊'} ${fullName}`;
  li.setAttribute('data-name', assetName);
  
  listElement.appendChild(li);
}

addCostumeBtn.addEventListener('click', () => importAsset('costume', 'image/*'));
addSoundBtn.addEventListener('click', () => importAsset('sound', 'audio/*'));

// 初回起動時に初期コードを読み込む
document.addEventListener('DOMContentLoaded', () => {
  codeInput.value = virtualStorage.files["script/game.js"];
});