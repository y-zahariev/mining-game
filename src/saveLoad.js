const SAVE_KEY = "miningSaveV1"; // keep same key, we handle version inside the data

// Convert current gameState into a plain JSON-able object
function getSerializableState() {
  return {
    version: 2, // bump internal version

    mapWidth: gameState.mapWidth,
    mapHeight: gameState.mapHeight,
    map: gameState.map, // 2D array of tile types

    player: {
      x: gameState.player.x,
      y: gameState.player.y,
      isMining: gameState.player.isMining,
      miningElapsed: gameState.player.miningElapsed,
      miningDuration: gameState.player.miningDuration,
      backpack: gameState.player.backpack,
      backpackCapacity: gameState.player.backpackCapacity
    },

    level: gameState.level,
    xp: gameState.xp,
    xpToNext: gameState.xpToNext,
    money: gameState.money,

    // NEW: automation data
    buildings: gameState.buildings,        // array of objects
    rails: gameState.rails,                // 2D array of booleans

    // For carts we store enough to reconstruct behavior cleanly
    carts: gameState.carts.map(c => ({
      x: c.x,
      y: c.y,
      fx: c.fx,
      fy: c.fy,
      dir: c.dir,
      cargo: c.cargo,
      capacity: c.capacity,
      speed: c.speed,
      state: c.state,
      actionTimer: c.actionTimer
      // pathAxis, minIndex, maxIndex will be recomputed on load
    }))
  };
}

// Apply loaded data back into gameState
function applySerializableState(data) {
  if (!data || typeof data !== "object") return;

  const version = data.version || 1;

  // --- Map ---
  if (
    Array.isArray(data.map) &&
    typeof data.mapWidth === "number" &&
    typeof data.mapHeight === "number"
  ) {
    gameState.mapWidth = data.mapWidth;
    gameState.mapHeight = data.mapHeight;
    gameState.map = data.map;
  }

  // --- Player ---
  if (data.player) {
    gameState.player.x = data.player.x ?? gameState.player.x;
    gameState.player.y = data.player.y ?? gameState.player.y;
    gameState.player.isMining = data.player.isMining ?? false;
    gameState.player.miningElapsed = data.player.miningElapsed ?? 0;
    gameState.player.miningDuration =
      data.player.miningDuration ?? gameState.player.miningDuration;
    gameState.player.backpack = data.player.backpack ?? 0;
    gameState.player.backpackCapacity =
      data.player.backpackCapacity ?? gameState.player.backpackCapacity;
  }

  // --- Progress ---
  if (typeof data.level === "number") gameState.level = data.level;
  if (typeof data.xp === "number") gameState.xp = data.xp;
  if (typeof data.xpToNext === "number") gameState.xpToNext = data.xpToNext;
  if (typeof data.money === "number") gameState.money = data.money;

  // --- Automation (only present from version >= 2) ---
  if (version >= 2) {
    // Buildings
    if (Array.isArray(data.buildings)) {
      gameState.buildings = data.buildings;
    } else {
      gameState.buildings = [];
    }

    // Rails
    if (Array.isArray(data.rails)) {
      gameState.rails = data.rails;
    }

    // Carts
    gameState.carts = [];
    if (Array.isArray(data.carts)) {
      for (const saved of data.carts) {
        const x = saved.x ?? 0;
        const y = saved.y ?? 0;

        const cart = {
          x,
          y,
          fx: saved.fx ?? x + 0.5,
          fy: saved.fy ?? y + 0.5,
          cargo: saved.cargo ?? 0,
          capacity: saved.capacity ?? 3,
          speed: saved.speed ?? 1.2,
          state: "MOVING",
          actionTimer: saved.actionTimer ?? 0,
          path: null,
          pathPos: 0,
          targetType: null
        };

        // Recompute cart path based on current rails and its cargo
        if (typeof recomputeCartPath === "function") {
          const targetType = cart.cargo > 0 ? "STORE" : "RIG";
          recomputeCartPath(cart, targetType);
        }

        gameState.carts.push(cart);
      }
    }

  } else {
    // Old saves (version 1) had no automation; ensure we don't keep stale stuff
    gameState.buildings = [];
    // leave rails/carts as initialized in gameState.js
  }

  // Always reset build mode on load
  gameState.buildMode.active = false;
  gameState.buildMode.itemType = null;
}

// --- Local auto-save / auto-load ---

function saveToLocal() {
  try {
    const data = getSerializableState();
    const json = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, json);
  } catch (e) {
    console.error("Failed to save game:", e);
  }
}

function loadFromLocal() {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return false;
    const data = JSON.parse(json);
    applySerializableState(data);
    return true;
  } catch (e) {
    console.error("Failed to load game:", e);
    return false;
  }
}

// --- Export / import save key (cross-device) ---

// Export current state as a base64 "save key"
function getSaveKey() {
  try {
    const data = getSerializableState();
    const json = JSON.stringify(data);
    const base64 = btoa(json);
    return base64;
  } catch (e) {
    console.error("Failed to create save key:", e);
    return "";
  }
}

// Load state from a base64 "save key"
function loadFromKey(saveKey) {
  try {
    const json = atob(saveKey);
    const data = JSON.parse(json);
    applySerializableState(data);
    saveToLocal(); // also store it locally
    return true;
  } catch (e) {
    console.error("Failed to load from save key:", e);
    return false;
  }
}

// --- Optional UI wiring for Export/Import buttons ---

window.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const key = getSaveKey();
      if (!key) return;
      prompt("Your save key (copy this somewhere safe):", key);
    });
  }

  if (importBtn) {
    importBtn.addEventListener("click", () => {
      const key = prompt("Paste your save key:");
      if (!key) return;
      if (loadFromKey(key.trim())) {
        alert("Save loaded!");
      } else {
        alert("Invalid save key.");
      }
    });
  }
});
