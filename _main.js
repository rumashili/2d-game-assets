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

let isDragging = false;
let animationFrameId = null;
let currentFilePath = "script/game.js";

// ★ Monaco Editorのインスタンスを保持する変数
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
    if (editor) editor.layout(); // エディタの幅が変わったことをMonacoに通知
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
// 3. 👑 Monaco Editor の初期化 ＆ 自作APIの型定義登録
// ==========================================
require(['vs/editor/editor.main'], function() {
  // ① ユーザーのコードに「自作APIのヒント情報（型定義）」をペロッと覚えさせる
  monaco.languages.typescript.javascriptDefaults.addExtraLib(`
    /** ゲームを制御するためのメインAPI */
    declare const api: {
      /** カメラの位置や視野角を設定します。直接書き換えてもOK！ */
      camera: { pos: [number, number, number], rotate: number, size: number, FOV: number },
      /** カメラの位置や設定をまとめて安全に変更します */
      setCamera(x: number, y: number, z?: number, rotate?: number, size?: number): void;
      /** 安全な初期値を持ったゲームオブジェクト（位置、向き、サイズ、ヒットボックス情報など）を生成します */
      makeObject(arg?: {
        pos?: [number, number, number],
        rotate?: number,
        size?: number,
        hitBox?: { type?: 'circle' | 'rect', size?: { range?: number, width?: number, height?: number } },
        meta?: any
      }): any;
      /** 2つのオブジェクトのヒットボックスが衝突しているかを検証します（回転対応） */
      isHit(obj1: any, obj2: any): boolean;
      /** 指定したコスチューム画像を使って、オブジェクトを画面（カメラ空間）にスタンプ描画します */
      stamp(costumeName: string, object: any): void;
      /** インポート済みのサウンドを最初から再生します */
      playSound(soundName: string): void;
      
      /** 画面への純粋な図形・テキストの描画命令シリーズ */
      display: {
        /** 指定した位置に回転可能な矩形（四角形）を描画します */
        rectangle(pos: [number, number, number], size: [number, number], rotate?: number, style?: any, isApplyCamera?: boolean): void;
        /** 3つの座標を結ぶ三角形を描画します（Zクリップ安全ガード付き） */
        triangle(pos1: [number, number, number], pos2: [number, number, number], pos3: [number, number, number], style?: any, isApplyCamera?: boolean): void;
        /** 複数の座標を結ぶ多角形を描画します（Zクリップ安全ガード付き） */
        polygon(points: [number, number, number][], style?: any, isApplyCamera?: boolean): void;
        /** 2点間に線を引きます */
        line(pos1: [number, number, number], pos2: [number, number, number], style?: any, isApplyCamera?: boolean): void;
        /** 円を描画します */
        circle(pos: [number, number, number], radius: number, style?: any, isApplyCamera?: boolean): void;
        /** 指定した位置に回転可能なテキスト（文字）を描画します */
        text(pos: [number, number, number], text: string, fontSize?: number, rotate?: number, style?: any, isApplyCamera?: boolean): void;
      }
    };

    /** ゲームが起動した瞬間に1回だけ実行される初期化イベントを登録します */
    declare function onStart(fn: () => void): void;
    /** 1秒間に約60回、画面更新ごとに繰り返し実行されるメインループイベントを登録します */
    declare function onTick(fn: () => void): void;
  `, 'filename/facts.d.ts');

  // ② エディタをHTML上に生成する
  editor = monaco.editor.create(document.getElementById('code-input'), {
    value: virtualStorage.files[currentFilePath],
    language: 'javascript',
    theme: 'vs-dark',            // カッコいい黒テーマ
    automaticLayout: true,       // 画面幅の変化に自動追従
    fontSize: 14,                // 文字サイズ
    tabSize: 2,                  // タブのスペース
    minimap: { enabled: false }  // 右側のちっちゃいマップは不要なのでオフ
  });

  // ③ 文字が入力されるたびに仮想ストレージに自動保存する
  editor.onDidChangeModelContent(() => {
    virtualStorage.saveFile(currentFilePath, editor.getValue());
  });
});


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
  li.textContent = `📜 ${fullFilename}`;
  li.setAttribute('data-filepath', path);
  scriptList.appendChild(li);

  switchFile(path, li);
});

function switchFile(path, element) {
  if (!editor) return;
  // 現在の文字を保存
  virtualStorage.saveFile(currentFilePath, editor.getValue());

  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  currentFilePath = path;
  // Monacoエディタの文字を書き換える
  editor.setValue(virtualStorage.files[path] || "");
  
  document.querySelector('.panel-header').textContent = `📝 editor / ${path}`;
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

  // 実行直前の最新状態を保存
  virtualStorage.saveFile(currentFilePath, editor.getValue());

  window.api = api;
  window.onStart = callBack.start.bind(callBack);
  window.onTick = callBack.tick.bind(callBack);
  // 他のモジュールから見やすいように仮想ストレージをグローバルに露出
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
  li.textContent = `${type === 'costume' ? '🎨' : '🔊'} ${fullName}`;
  li.setAttribute('data-name', assetName);
  listElement.appendChild(li);
}

addCostumeBtn.addEventListener('click', () => importAsset('costume', 'image/*'));
addSoundBtn.addEventListener('click', () => importAsset('sound', 'audio/*'));
