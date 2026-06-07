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

let isDragging = false;
let animationFrameId = null;
let currentFilePath = "script/game.js";
let editor = null;

// ==========================================
// 2. ドラッグバーによる画面幅のリサイズ処理
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
    if (editor) editor.layout();
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
// 3. 👑 Monaco Editor の初期化（超安全・遅延起動版）
// ==========================================
function initMonaco() {
  try {
    if (typeof require === 'undefined' || typeof monaco === 'undefined') {
      // まだライブラリが届いていなければ、0.1秒後に再チャレンジ
      setTimeout(initMonaco, 100);
      return;
    }

    // 型定義の登録
    monaco.languages.typescript.javascriptDefaults.addExtraLib(`
      declare const api: {
        camera: { pos: [number, number, number], rotate: number, size: number, FOV: number },
        setCamera(x: number, y: number, z?: number, rotate?: number, size?: number): void;
        makeObject(arg?: { pos?: [number, number, number], rotate?: number, size?: number, hitBox?: any, meta?: any }): any;
        isHit(obj1: any, obj2: any): boolean;
        stamp(costumeName: string, object: any): void;
        playSound(soundName: string): void;
        display: {
          rectangle(pos: [number, number, number], size: [number, number], rotate?: number, style?: any, isApplyCamera?: boolean): void;
          triangle(pos1: [number, number, number], pos2: [number, number, number], pos3: [number, number, number], style?: any, isApplyCamera?: boolean): void;
          polygon(points: [number, number, number][], style?: any, isApplyCamera?: boolean): void;
          line(pos1: [number, number, number], pos2: [number, number, number], style?: any, isApplyCamera?: boolean): void;
          circle(pos: [number, number, number], radius: number, style?: any, isApplyCamera?: boolean): void;
          text(pos: [number, number, number], text: string, fontSize?: number, rotate?: number, style?: any, isApplyCamera?: boolean): void;
        }
      };
      declare function onStart(fn: () => void): void;
      declare function onTick(fn: () => void): void;
    `, 'filename/facts.d.ts');

    const editorContainer = document.getElementById('code-input');
    if (!editorContainer) return;

    // エディタ生成！
    editor = monaco.editor.create(editorContainer, {
      value: virtualStorage.files[currentFilePath] || "// コードをここに書くよ\n",
      language: 'javascript',
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize: 14,
      tabSize: 2,
      minimap: { enabled: false }
    });

    editor.onDidChangeModelContent(() => {
      virtualStorage.saveFile(currentFilePath, editor.getValue());
    });

    console.log("🟢 Monaco Editor Ready!");
  } catch (e) {
    console.error("Monacoの起動に失敗したよ:", e);
  }
}

// ボタン等のイベント登録を邪魔しないように、すべてが終わったあとにエディタを起動する
if (typeof require !== 'undefined') {
  require(['vs/editor/editor.main'], function() {
    initMonaco();
  });
} else {
  // requireがなくても、とりあえずループで待ってみる
  setTimeout(initMonaco, 500);
}


// ==========================================
// 4. 複数ファイルの切り替えロジック
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
  // ★ スクリプト用のきれいなアイコンタグを挿入！
  li.innerHTML = `<i class="fas fa-file-code" style="color: #cbd5e1;"></i> ${fullFilename}`;
  li.setAttribute('data-filepath', path);
  scriptList.appendChild(li);

  switchFile(path, li);
});

function switchFile(path, element) {
  if (!editor) return;
  virtualStorage.saveFile(currentFilePath, editor.getValue());

  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  currentFilePath = path;
  editor.setValue(virtualStorage.files[path] || "");
  
  currentPathText.textContent = `editor / ${path}`;
}

scriptList.addEventListener('click', (e) => {
  const item = e.target.closest('.file-item');
  if (!item) return;
  const path = item.getAttribute('data-filepath');
  if (path) switchFile(path, item);
});


// ==========================================
// 5. ゲームの実行・停止
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
  if (!editor) return;

  virtualStorage.saveFile(currentFilePath, editor.getValue());

  window.api = api;
  window.onStart = callBack.start.bind(callBack);
  window.onTick = callBack.tick.bind(callBack);
  window.virtualStorage = virtualStorage; 

  const ctx = canvas.getContext('2d');
  api._setContext(ctx);

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
    alert("コードにエラーがあるみたいだよ！デベロッパーツールのコンソールを見てみてね。");
  }
}

runBtn.addEventListener('click', runGame);
stopBtn.addEventListener('click', stopGame);
exportBtn.addEventListener('click', () => editorBackend.exportAsZip());


// ==========================================
// 6. アセットの仮想インポート処理
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
  
  // ★ 追加されたアセットの種類に応じて、Font Awesomeのきれいなアイコンをセット！
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
