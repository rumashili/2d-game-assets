// _callBack.js
export const callBack = {
  _onStartCallback: null,
  _onTickCallback: null,

  start(fn) {
    this._onStartCallback = fn;
  },

  tick(fn) {
    this._onTickCallback = fn;
  },

  reset() {
    this._onStartCallback = null;
    this._onTickCallback = null;
  }
};