import 'core-js/actual/set-immediate';

let x;
let isLocked = false;
let unlockEffectId;

const currentVerticalNavigationLine = {
  withLock: (cb) => (...args) => {
    isLocked = true;
    const result = cb(...args);
    if (unlockEffectId !== undefined) clearImmediate(unlockEffectId);
    unlockEffectId = setImmediate(() => {
      isLocked = false;
      unlockEffectId = undefined;
    });
    return result;
  },
  getIsLocked () {
    return isLocked;
  },
  getX () {
    return x;
  },
  setX (newX) {
    x = newX;
  },
  resetX () {
    x = undefined;
  }
};

if (globalThis.document) {
  document.addEventListener('selectionchange', () => {
    if (currentVerticalNavigationLine.getIsLocked()) return;
    currentVerticalNavigationLine.resetX();
  });
}

export default currentVerticalNavigationLine;
