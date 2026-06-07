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
   * 💥 回転対応版（OBB対応）の汎用当たり判定関数
   */
  isHit(obj1, obj2) {
    const t1 = obj1.hitBox.type;
    const t2 = obj2.hitBox.type;

    // ----------------------------------------------------
    // ① Circle vs Circle (円同士は回転しても形が変わらないよ)
    // ----------------------------------------------------
    if (t1 === "circle" && t2 === "circle") {
      const r1 = obj1.hitBox.size.range * obj1.size;
      const r2 = obj2.hitBox.size.range * obj2.size;
      const dx = obj1.pos[0] - obj2.pos[0];
      const dy = obj1.pos[1] - obj2.pos[1];
      const dz = obj1.pos[2] - obj2.pos[2]; // Z軸の距離も考慮
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return dist < (r1 + r2);
    }

    // ----------------------------------------------------
    // ② Circle vs Rect (円 vs 回転する矩形)
    // ----------------------------------------------------
    if ((t1 === "circle" && t2 === "rect") || (t1 === "rect" && t2 === "circle")) {
      const cObj = t1 === "circle" ? obj1 : obj2;
      const rObj = t1 === "rect" ? obj1 : obj2;

      // Z軸のレイヤーチェック
      if (Math.abs(cObj.pos[2] - rObj.pos[2]) > 1) return false;

      const cRad = cObj.hitBox.size.range * cObj.size;
      const rW = (rObj.hitBox.size.width * rObj.size) / 2;
      const rH = (rObj.hitBox.size.height * rObj.size) / 2;

      // ★ 魔法の処理：円の中心座標を「矩形から見たローカル座標」に変換する
      // 矩形の中心を原点(0,0)とした相対座標にし、矩形の回転角度の逆方向（マイナス）に回転させる！
      const dx = cObj.pos[0] - rObj.pos[0];
      const dy = cObj.pos[1] - rObj.pos[1];
      const rad = (-rObj.rotate * Math.PI) / 180; // 逆回転
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // まっすぐな世界にワープした円の中心座標
      const localCx = Math.abs(dx * cos - dy * sin);
      const localCy = Math.abs(dx * sin + dy * cos);

      // ここからは「まっすぐな矩形 vs 円」のアルゴリズムがそのまま使えるよ！
      if (localCx > rW + cRad) return false;
      if (localCy > rH + cRad) return false;

      if (localCx <= rW) return true;
      if (localCy <= rH) return true;

      // 角との衝突判定
      const cornerDx = localCx - rW;
      const cornerDy = localCy - rH;
      return cornerDx * cornerDx + cornerDy * cornerDy < cRad * cRad;
    }

    // ----------------------------------------------------
    // ③ Rect vs Rect (回転する矩形同士の判定)
    // 分離軸定理（SAT）の考え方を、扱いやすく片方のローカルに絞って判定するよ！
    // ----------------------------------------------------
    if (t1 === "rect" && t2 === "rect") {
      if (Math.abs(obj1.pos[2] - obj2.pos[2]) > 1) return false;

      // 互いのローカル座標系で「重なり」をチェックするヘルパー
      const checkOneSidedOBB = (rectA, rectB) => {
        const wA = (rectA.hitBox.size.width * rectA.size) / 2;
        const hA = (rectA.hitBox.size.height * rectA.size) / 2;
        const wB = (rectB.hitBox.size.width * rectB.size) / 2;
        const hB = (rectB.hitBox.size.height * rectB.size) / 2;

        // rectB の 4つの角のワールド座標を計算する
        const bRad = (rectB.rotate * Math.PI) / 180;
        const bCos = Math.cos(bRad);
        const bSin = Math.sin(bRad);

        const corners = [
          [-wB, -hB], [wB, -hB], [wB, hB], [-wB, hB]
        ].map(([kx, ky]) => {
          // ワールド座標に変換
          return [
            rectB.pos[0] + (kx * bCos - ky * bSin),
            rectB.pos[1] + (kx * bSin + ky * bCos)
          ];
        });

        // rectB の角を、すべて「rectA から見たローカル座標」に逆回転させて移す
        const aRad = (-rectA.rotate * Math.PI) / 180;
        const aCos = Math.cos(aRad);
        const aSin = Math.sin(aRad);

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        corners.forEach(([wx, wy]) => {
          const dx = wx - rectA.pos[0];
          const dy = wy - rectA.pos[1];
          const lx = dx * aCos - dy * aSin;
          const ly = dx * aSin + dy * aCos;

          minX = Math.min(minX, lx);
          maxX = Math.max(maxX, lx);
          minY = Math.min(minY, ly);
          maxY = Math.max(maxY, ly);
        });

        // rectAの範囲（[-wA, wA], [-hA, hA]）と、rectBの包絡矩形が重なっているかチェック
        return !(maxX < -wA || minX > wA || maxY < -rH || minY > hA);
      };

      // 矩形同士の場合、両方の矩形の軸から見て「どちらから見ても重なっている」ときだけ衝突となるよ！
      return checkOneSidedOBB(obj1, obj2) && checkOneSidedOBB(obj2, obj1);
    }

    return false;
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
  },

  /**
   * 📺 純粋な図形・テキスト描画系API (Zクリップ＆回転対応版)
   */
  display: {
    // スタイル指定が空のときのデフォルト値
    _defaultStyle(style) {
      return {
        fillColor: style.fillColor ?? "transparent",
        border: {
          size: style.border?.size ?? 0,
          color: style.border?.color ?? "transparent"
        }
      };
    },

    // 共通の描画セットアップ（色と線をパスに適用する内部関数）
    _renderPath(ctx, s) {
      if (s.fillColor !== "transparent") {
        ctx.fillStyle = s.fillColor;
        ctx.fill();
      }
      if (s.border.size > 0 && s.border.color !== "transparent") {
        ctx.lineWidth = s.border.size;
        ctx.strokeStyle = s.border.color;
        ctx.stroke();
      }
    },

    // 3次元座標 [x, y, z] を、設定に応じて Canvas上の [x, y] とスケールに変換する関数
    _getRenderCoord(pos, isApplyCamera) {
      if (isApplyCamera) {
        // Z軸の奥行きを計算 (親の api.camera.pos を参照)
        const z = (pos[2] ?? 0) - parentApi.camera.pos[2];
        
        // ★ Zクリップ: カメラより手前、またはカメラと全く同じ位置にある場合は無効（scale: -1）とする
        if (z <= 0) return { x: 0, y: 0, scale: -1 };

        // Z軸奥行きを持ったオブジェクトとしてカメラ投影を通す
        return parentApi._transPos({
          pos: [pos[0], pos[1], pos[2] ?? 0],
          rotate: 0,
          size: 1
        });
      } else {
        // カメラを無視する場合（画面固定UIなど）：zは無視して等倍として扱う
        const halfW = ctx.canvas.width / 2;
        const halfH = ctx.canvas.height / 2;
        return {
          x: halfW + pos[0],
          y: halfH - pos[1],
          scale: 1
        };
      }
    },

    /**
     * 🟦 1. 矩形 (rectangle) - 🔄 回転対応！
     * 中心座標 pos[x, y, z]、サイズ [width, height]、回転角度 rotate
     */
    rectangle(pos, size, rotate = 0, style = {}, isApplyCamera = true) {
      if (!ctx) return;
      const r = this._getRenderCoord(pos, isApplyCamera);
      if (r.scale <= 0) return; // Zクリップまたは画面外ならスキップ

      const s = this._defaultStyle(style);
      const w = size[0] * r.scale;
      const h = size[1] * r.scale;

      ctx.save();
      ctx.translate(r.x, r.y);
      
      // カメラ適用時は「矩形自身の回転 - カメラの回転」、非適用時は矩形自身の回転のみ
      const finalRotate = isApplyCamera ? (rotate - parentApi.camera.rotate) : rotate;
      ctx.rotate((finalRotate * Math.PI) / 180);

      ctx.beginPath();
      // 中心が pos になるように、原点から半分ずらして矩形を作成
      ctx.rect(-w / 2, -h / 2, w, h);
      this._renderPath(ctx, s);
      ctx.restore();
    },

    /**
     * 🔺 2. 三角形 (triangle) - 🛡️ Zクリップ対応！
     * 3つの3次元座標 pos1, pos2, pos3
     */
    triangle(pos1, pos2, pos3, style = {}, isApplyCamera = true) {
      if (!ctx) return;
      const r1 = this._getRenderCoord(pos1, isApplyCamera);
      const r2 = this._getRenderCoord(pos2, isApplyCamera);
      const r3 = this._getRenderCoord(pos3, isApplyCamera);

      // ★ Zクリップ: 3つの頂点のうち、1つでもカメラより手前にあったら描画を完全スキップ
      if (r1.scale < 0 || r2.scale < 0 || r3.scale < 0) return;

      const s = this._defaultStyle(style);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(r1.x, r1.y);
      ctx.lineTo(r2.x, r2.y);
      ctx.lineTo(r3.x, r3.y);
      ctx.closePath();
      this._renderPath(ctx, s);
      ctx.restore();
    },

    /**
     * ⬡ 3. 多角形 (polygon) - 🛡️ Zクリップ対応！
     * 3次元座標の配列 [[x,y,z], [x,y,z], ...]
     */
    polygon(points, style = {}, isApplyCamera = true) {
      if (!ctx || points.length < 3) return;
      const s = this._defaultStyle(style);

      // 一旦すべての描画用座標を計算する
      const renders = [];
      for (let i = 0; i < points.length; i++) {
        const r = this._getRenderCoord(points[i], isApplyCamera);
        // ★ Zクリップ: 1つでもカメラより手前（裏側）の頂点があれば、おかしくなる前に全スキップ！
        if (r.scale < 0) return;
        renders.push(r);
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(renders[0].x, renders[0].y);
      for (let i = 1; i < renders.length; i++) {
        ctx.lineTo(renders[i].x, renders[i].y);
      }
      ctx.closePath();
      this._renderPath(ctx, s);
      ctx.restore();
    },

    /**
     * ➖ 4. 線 (line) - 🛡️ Zクリップ対応！
     * 始点 pos1[x, y, z]、終点 pos2[x, y, z]
     */
    line(pos1, pos2, style = {}, isApplyCamera = true) {
      if (!ctx) return;
      const r1 = this._getRenderCoord(pos1, isApplyCamera);
      const r2 = this._getRenderCoord(pos2, isApplyCamera);
      
      // ★ Zクリップ: どちらかの端点がカメラの裏にいったらスキップ
      if (r1.scale < 0 || r2.scale < 0) return;

      const size = style.border?.size ?? 1;
      const color = style.border?.color ?? "white";

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(r1.x, r1.y);
      ctx.lineTo(r2.x, r2.y);
      ctx.lineWidth = size * r1.scale; // 始点側のスケールを基準にする
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    },

    /**
     * 🟡 5. 円 (circle)
     * 中心座標 pos[x, y, z]、半径 radius
     */
    circle(pos, radius, style = {}, isApplyCamera = true) {
      if (!ctx) return;
      const r = this._getRenderCoord(pos, isApplyCamera);
      if (r.scale <= 0) return; // Zクリップ含む

      const s = this._defaultStyle(style);
      const finalRadius = radius * r.scale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x, r.y, finalRadius, 0, Math.PI * 2);
      this._renderPath(ctx, s);
      ctx.restore();
    },

    /**
     * 🔤 6. テキスト (text) - 🔄 回転対応！
     * 位置 pos[x, y, z]、文字列 text、サイズ fontSize、回転角度 rotate
     */
    text(pos, text, fontSize = 20, rotate = 0, style = {}, isApplyCamera = true) {
      if (!ctx) return;
      const r = this._getRenderCoord(pos, isApplyCamera);
      if (r.scale <= 0) return; // Zクリップ含む

      const fillColor = style.fillColor ?? "white";
      const finalSize = fontSize * r.scale;

      ctx.save();
      ctx.translate(r.x, r.y);
      
      // カメラ適用時はカメラの回転を相殺、非適用時はそのまま回転
      const finalRotate = isApplyCamera ? (rotate - parentApi.camera.rotate) : rotate;
      ctx.rotate((finalRotate * Math.PI) / 180);

      ctx.font = `${finalSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = fillColor;
      
      // 回転の中心が文字の中心になるように (0, 0) に描画
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  },
};
