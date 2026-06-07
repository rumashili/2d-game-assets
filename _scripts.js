// _scripts.js
export const virtualStorage = {
  files: {
    "script/game.js": `let playerX = 0;

onStart(() => {
  api.setCamera(0, 0);
});

onTick(() => {
  playerX += 2;
  // バッククォートを使っても絶対にバグりません！
  api.stamp(\`cat\`, playerX, 0);
});`
  },
  costumes: {},
  sounds: {},

  saveFile(path, content) {
    this.files[path] = content;
  }
};