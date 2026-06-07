// _api.js
let ctx = null;

export const api = {
  // 最初から持っているカメラ。直叩きで変更しても関数経由でもOK！
  camera: { pos: [0, 0, -100], rotate: 0, size: 1, FOV: 100 },
  
  // キャッシュ用のストレージ（初回ロード時にここに溜まる）
  costumeList: {},
  soundList: {},

  // システム内部でCanvasコンテキストを受け取る
  _setContext(context) {
    ctx = context;
  },

  // 安全にカメラの位置を設定する関数
  setCamera(x, y, z = null, rotate = null, size = null) {
    this.camera.pos[0] = x;
    this.camera.pos[1] = y;
    if (z !== null) this.camera.pos[2] = z;
    if (rotate !== null) this.camera.rotate = rotate;
    if (size !== null) this.camera.size = size;
  },

  /**
   * 🛠️ オブジェクト生成 (引数が安全でなくなる可能性を完全にガード)
   */
  makeObject(arg = {}) {
    const pos = arg.pos ?? [0, 0, 0];
    const rotate = arg.rotate ?? 0;
    const size = arg.size ?? 1;

    // hitBox の安全な初期化ロジック
    const hbType = arg.hitBox?.type === "rect" ? "rect" : "circle";
    let hbSize = {};

    if (hbType === "rect") {
      hbSize = {
        width: arg.hitBox?.size?.width ?? 50,
        height: arg.hitBox?.size?.height ?? 50
      };
    } else {
      hbSize = {
        range: arg.hitBox?.size?.range ?? 50
      };
    }

    return {
      pos: [...pos], // 参照を切るためにコピー
      rotate: rotate,
      size: size,
      hitBox: {
        type: hbType,
        size: hbSize
      },
      meta: arg.meta ?? {} // ユーザーが自由に持たせられるメタ領域
    };
  },

  /**
   * 🔍 3D奥行き $Z$ と $FOV$、およびカメラ位置・回転を適用した画面座標変換
   * 戻り値: {x, y, scale} (Canvas上の描画用座標)
   */
  _transPos(object) {
    if (!ctx) return { x: 0, y: 0, scale: 0 };

    // 1. Z軸の奥行きから縮小率（パース）を計算
    const z = object.pos[2] - this.camera.pos[2];
    if (z <= 0) return { x: 0, y: 0, scale: 0 }; // カメラより後ろにあるものは描画しない

    const parse = this.camera.FOV / z;

    // 2. カメラの相対座標に変換（ワールド座標 -> カメラ相対座標）
    let rx = object.pos[0] - this.camera.pos[0];
    let ry = object.pos[1] - this.camera.pos[1];

    // 3. カメラの2D回転（rotate）を適用
    if (this.camera.rotate !== 0) {
      const rad = (-this.camera.rotate * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const tx = rx * cos - ry * sin;
      const ty = rx * sin + ry * cos;
      rx = tx;
      ry = ty;
    }

    // 4. FOVによる遠近感と、カメラ自身のサイズ（ズーム）を適用
    const finalScale = parse * this.camera.size;
    const screenX = rx * finalScale;
    const screenY = ry * finalScale;

    // 5. 画面中心 (0,0) を基準としたCanvas座標（左上0,0、下方向が正）に変換
    const halfW = ctx.canvas.width / 2;
    const halfH = ctx.canvas.height / 2;

    return {
      x: halfW + screenX,
      y: halfH - screenY, // Y軸を上に正にする反転
      scale: finalScale * object.size
    };
  },

  /**
   * 💥 3つの組み合わせに対応した汎用当たり判定関数
   */
  isHit(obj1, obj2) {
    const t1 = obj1.hitBox.type;
    const t2 = obj2.hitBox.type;

    // ① Circle vs Circle
    if (t1 === "circle" && t2 === "circle") {
      const r1 = obj1.hitBox.size.range * obj1.size;
      const r2 = obj2.hitBox.size.range * obj2.size;
      const dx = obj1.pos[0] - obj2.pos[0];
      const dy = obj1.pos[1] - obj2.pos[1];
      const dz = obj1.pos[2] - obj2.pos[2]; // Z軸の距離も考慮
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return dist < (r1 + r2);
    }

    // ② Rect vs Rect
    if (t1 === "rect" && t2 === "rect") {
      // Z軸が離れすぎていたら当たらない（簡易判定：誤差1未満）
      if (Math.abs(obj1.pos[2] - obj2.pos[2]) > 1) return false;

      const w1 = (obj1.hitBox.size.width * obj1.size) / 2;
      const h1 = (obj1.hitBox.size.height * obj1.size) / 2;
      const w2 = (obj2.hitBox.size.width * obj2.size) / 2;
      const h2 = (obj2.hitBox.size.height * obj2.size) / 2;

      return (
        Math.abs(obj1.pos[0] - obj2.pos[0]) < w1 + w2 &&
        Math.abs(obj1.pos[1] - obj2.pos[1]) < h1 + h2
      );
    }

    // ③ Circle vs Rect (異種交差判定)
    const cObj = t1 === "circle" ? obj1 : obj2;
    const rObj = t1 === "rect" ? obj1 : obj2;

    if (Math.abs(cObj.pos[2] - rObj.pos[2]) > 1) return false;

    const cRad = cObj.hitBox.size.range * cObj.size;
    const rW = (rObj.hitBox.size.width * rObj.size) / 2;
    const rH = (rObj.hitBox.size.height * rObj.size) / 2;

    // 矩形の中心から見た円の中心の相対距離
    const distX = Math.abs(cObj.pos[0] - rObj.pos[0]);
    const distY = Math.abs(cObj.pos[1] - rObj.pos[1]);

    if (distX > rW + cRad) return false;
    if (distY > rH + cRad) return false;

    if (distX <= rW) return true;
    if (distY <= rH) return true;

    // 角の衝突判定
    const dx = distX - rW;
    const dy = distY - rH;
    return dx * dx + dy * dy < cRad * cRad;
  },

  /**
   * 🖼️ 初回自動ロード対応スタンプ
   */
  stamp(costumeName, object) {
    if (!ctx) return;

    // _transPosを使ってカメラ越しの座標とスケールを算出
    const render = this._transPos(object);
    if (render.scale <= 0) return;

    // 初回呼び出し時に `window.api.costumeList` に登録がなければ、仮想ストレージ等から自動生成を試みる
    if (!this.costumeList[costumeName]) {
      // 仮想ストレージ(window.virtualStorage)をのぞいてデータURLがあれば自動ロード
      const storage = window.virtualStorage;
      if (storage && storage.costumes[costumeName]) {
        const img = new Image();
        img.src = storage.costumes[costumeName];
        this.costumeList[costumeName] = { img: img, loaded: false };
        img.onload = () => { this.costumeList[costumeName].loaded = true; };
      } else {
        // 画像が完全に見つからない場合はダミーを登録
        this.costumeList[costumeName] = { img: null, loaded: false };
      }
    }

    const costume = this.costumeList[costumeName];

    ctx.save();
    ctx.translate(render.x, render.y);
    // カメラの回転分は_transPos側で座標移動してるので、描画時は「オブジェクト自身の回転 - カメラの回転」
    ctx.rotate(((object.rotate - this.camera.rotate) * Math.PI) / 180);

    if (costume && costume.loaded) {
      const img = costume.img;
      // 100等倍の基準に合わせて拡大率を調整して中央描画
      const w = img.width * render.scale;
      const h = img.height * render.scale;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // ロード中、または見つからない時のピンクのダミー四角（オブジェクトサイズを反映）
      const dSize = 30 * render.scale;
      ctx.fillStyle = "magenta";
      ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
    }
    ctx.restore();
  },

  /**
   * 🔊 初回自動ロード対応サウンド
   */
  playSound(soundName) {
    if (!this.soundList[soundName]) {
      const storage = window.virtualStorage;
      if (storage && storage.sounds[soundName]) {
        const audio = new Audio(storage.sounds[soundName]);
        this.soundList[soundName] = audio;
      } else {
        return;
      }
    }

    const audio = this.soundList[soundName];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log("再生エラー(初回クリックが必要):", e));
    }
  }
};
