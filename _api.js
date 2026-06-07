// _api.js
let ctx = null;

export const api = {
  camera: { pos: [0, 0], rotate: 0, size: 1 },
  costumeList: {},

  _setContext(context) {
    ctx = context;
  },

  setCamera(x, y) {
    this.camera.pos = [x, y];
  },

  _applyCamera() {
    if (!ctx) return;
    const { pos, rotate, size } = this.camera;
    const halfW = ctx.canvas.width / 2;
    const halfH = ctx.canvas.height / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(halfW, halfH);
    ctx.scale(size, -size); // Y軸を上向きにする
    ctx.rotate(-rotate * Math.PI / 180);
    ctx.translate(-pos[0], -pos[1]);
  },

  stamp(costumeName, x, y, rotate = 0, size = 1) {
    if (!ctx) return;
    this._applyCamera();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotate * Math.PI / 180);
    ctx.scale(size, size);

    // インポートされた画像データがあるか確認
    const costume = this.costumeList[costumeName];

    if (costume && costume.loaded) {
      // 本物の画像を描画（中心がx, yにくるように半分ずらす）
      const img = costume.img;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    } else {
      // まだインポートされていない時のダミー四角（デバッグ用）
      ctx.fillStyle = "magenta";
      ctx.fillRect(-15, -15, 30, 30);
    }

    ctx.restore();
  }};