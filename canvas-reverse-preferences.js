(() => {
  "use strict";

  const storageKey = "canvasflow-reverse-prompt-preferences-v1";
  const maxFrames = 30;

  function validCount(count) {
    return Number.isInteger(count) && count >= 1 && count <= maxFrames;
  }

  function normalize(value) {
    return {
      frameCount: validCount(value?.frameCount) ? value.frameCount : null,
      frameModelId: typeof value?.frameModelId === "string" ? value.frameModelId.trim() : "",
      videoModelId: typeof value?.videoModelId === "string" ? value.videoModelId.trim() : "",
    };
  }

  function read() {
    try {
      return normalize(JSON.parse(localStorage.getItem(storageKey)));
    } catch {
      return normalize(null);
    }
  }

  function save(value) {
    if (value.frameCount != null && !validCount(value.frameCount)) {
      throw new Error(`截取画面数必须是 1 到 ${maxFrames} 的整数。`);
    }
    const preferences = normalize(value);
    localStorage.setItem(storageKey, JSON.stringify(preferences));
    return preferences;
  }

  window.CanvasFlowReversePreferences = Object.freeze({ read, save, maxFrames });
})();
