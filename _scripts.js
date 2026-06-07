// _scripts.js

export const virtualStorage = {
  // 仮想ファイルシステム（初期値として game.js を入れておくよ）
  files: {
    "script/game.js": `let playerX = 0;

onStart(() => {
  api.setCamera(0, 0);
});

onTick(() => {
  playerX += 2;
  api.stamp("cat", playerX, 0);
});`
  },

  // 仮想のコスチューム（画像）データを保持する場所 ("名前": "データURL")
  costumes: {},

  // 仮想のサウンド（音声）データを保持する場所 ("名前": "データURL")
  sounds: {},

  // ファイルの上書き・新規作成
  saveFile(path, content) {
    this.files[path] = content;
  },

  // コスチュームの追加
  addCostume(name, dataUrl) {
    this.costumes[name] = dataUrl;
  },

  // サウンドの追加
  addSound(name, dataUrl) {
    this.sounds[name] = dataUrl;
  }
};