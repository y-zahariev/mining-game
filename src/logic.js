// --- Economy constants ---

const MONEY_PER_ORE = 2;  // slower progress
const XP_PER_ORE = 1;

const ECONOMY = {
  rigBase: 50,
  rigStep: 3,
  rigInc: 25,

  railBase: 3,
  railStep: 10,
  railInc: 2,

  cartBase: 30,
  cartStep: 3,
  cartInc: 15
};

// --- Input state ---

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  a: false,
  s: false,
  d: false
};

// --- Helpers for coordinates & collision ---

function isInsideMap(x, y) {
  return x >= 0 && y >= 0 && x < gameState.mapWidth && y < gameState.mapHeight;
}

function tileIsBlockedForBuilding(x, y) {
  if (!isInsideMap(x, y)) return true;

  const tile = gameState.map[y][x];

  // Walls, ores, store are blocking
  if (tile === TILE.WALL || tile === TILE.ORE || tile === TILE.STORE) return true;

  // Existing buildings (Drill Rigs)
  for (const b of gameState.buildings) {
    if (
      x >= b.x &&
      y >= b.y &&
      x < b.x + b.width &&
      y < b.y + b.height
    ) {
      return true;
    }
  }

  return false;
}

// --- Counting owned items ---

function getRigCount() {
  let c = 0;
  for (const b of gameState.buildings) {
    if (b.type === "DRILL_RIG") c++;
  }
  return c;
}

function getRailCount() {
  let c = 0;
  for (let y = 0; y < gameState.mapHeight; y++) {
    for (let x = 0; x < gameState.mapWidth; x++) {
      if (gameState.rails[y][x]) c++;
    }
  }
  return c;
}

function getCartCount() {
  return gameState.carts.length;
}

// --- Price helpers ---

function getTieredPrice(base, step, inc, index) {
  const tier = Math.floor(index / step);
  return base + tier * inc;
}

function getDrillRigPrice(index) {
  return getTieredPrice(ECONOMY.rigBase, ECONOMY.rigStep, ECONOMY.rigInc, index);
}

function getRailPrice(index) {
  return getTieredPrice(ECONOMY.railBase, ECONOMY.railStep, ECONOMY.railInc, index);
}

function getCartPrice(index) {
  return getTieredPrice(ECONOMY.cartBase, ECONOMY.cartStep, ECONOMY.cartInc, index);
}

// --- Drill Rig placement: only orthogonal ore adjacency ---

// Check if we can place a Drill Rig at (x, y) (top-left of 2x2)
function canPlaceDrillRig(x, y) {
  // 2x2 footprint inside map and not blocked
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!isInsideMap(tx, ty)) return false;
      if (tileIsBlockedForBuilding(tx, ty)) return false;
    }
  }

  // Must have at least one orthogonally adjacent ore touching the 2x2 footprint
  let hasOreNeighbor = false;

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const cellX = x + dx;
      const cellY = y + dy;

      const neighbors = [
        { nx: cellX + 1, ny: cellY },
        { nx: cellX - 1, ny: cellY },
        { nx: cellX, ny: cellY + 1 },
        { nx: cellX, ny: cellY - 1 }
      ];

      for (const { nx, ny } of neighbors) {
        if (!isInsideMap(nx, ny)) continue;
        if (gameState.map[ny][nx] === TILE.ORE) {
          hasOreNeighbor = true;
          break;
        }
      }

      if (hasOreNeighbor) break;
    }
    if (hasOreNeighbor) break;
  }

  return hasOreNeighbor;
}

// --- Rail & cart placement ---

function canPlaceRail(x, y) {
  if (!isInsideMap(x, y)) return false;
  if (gameState.rails[y][x]) return false;

  const tile = gameState.map[y][x];
  if (tile === TILE.WALL || tile === TILE.ORE || tile === TILE.STORE) return false;

  // Not inside a building footprint
  for (const b of gameState.buildings) {
    if (x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height) {
      return false;
    }
  }

  return true;
}

function canPlaceCart(x, y) {
  if (!isInsideMap(x, y)) return false;
  return !!gameState.rails[y][x];
}

// Rail neighbors for graph/pathfinding
function getRailNeighbors(x, y) {
  const res = [];
  if (isInsideMap(x - 1, y) && gameState.rails[y][x - 1]) {
    res.push({ x: x - 1, y });
  }
  if (isInsideMap(x + 1, y) && gameState.rails[y][x + 1]) {
    res.push({ x: x + 1, y });
  }
  if (isInsideMap(x, y - 1) && gameState.rails[y - 1][x]) {
    res.push({ x, y: y - 1 });
  }
  if (isInsideMap(x, y + 1) && gameState.rails[y + 1][x]) {
    res.push({ x, y: y + 1 });
  }
  return res;
}

// BFS path on rails
function findRailPath(startX, startY, goalFn) {
  if (!isInsideMap(startX, startY) || !gameState.rails[startY][startX]) return null;

  const key = (x, y) => `${x},${y}`;
  const queue = [{ x: startX, y: startY }];
  const visited = new Set([key(startX, startY)]);
  const parent = new Map();

  while (queue.length > 0) {
    const cur = queue.shift();
    const ck = key(cur.x, cur.y);

    if (goalFn(cur.x, cur.y)) {
      // Reconstruct path from cur back to start
      const path = [];
      let node = cur;
      let nk = ck;
      while (true) {
        path.push({ x: node.x, y: node.y });
        const prev = parent.get(nk);
        if (!prev) break;
        node = prev;
        nk = key(node.x, node.y);
      }
      path.reverse();
      return path;
    }

    const neighbors = getRailNeighbors(cur.x, cur.y);
    for (const n of neighbors) {
      const nk = key(n.x, n.y);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, cur);
      queue.push({ x: n.x, y: n.y });
    }
  }

  return null; // no path found
}

// Forward decl for store/riga helpers (functions are hoisted but this keeps it readable)
function getStoreLocation() {}
function isRailTileAdjacentToStore() {}
function findDrillRigAtRailTile() {}

function findRailPathToStore(startX, startY) {
  const store = getStoreLocation();
  if (!store) return null;
  return findRailPath(startX, startY, (x, y) => isRailTileAdjacentToStore(x, y, store));
}

function findRailPathToRig(startX, startY) {
  return findRailPath(startX, startY, (x, y) => {
    const rig = findDrillRigAtRailTile(x, y);
    return rig && rig.storage > 0;
  });
}

// Validate placement for current buildMode
function canPlaceCurrentBuildItem() {
  const bm = gameState.buildMode;
  const x = bm.cursorX;
  const y = bm.cursorY;

  if (bm.itemType === "DRILL_RIG") {
    return canPlaceDrillRig(x, y);
  } else if (bm.itemType === "RAIL") {
    return canPlaceRail(x, y);
  } else if (bm.itemType === "CART") {
    return canPlaceCart(x, y);
  }
  return false;
}

// Apply placement (with cost)
function placeCurrentBuildItem() {
  const bm = gameState.buildMode;
  const x = bm.cursorX;
  const y = bm.cursorY;

  if (!canPlaceCurrentBuildItem()) return;

  if (bm.itemType === "DRILL_RIG") {
    const currentCount = getRigCount();
    const cost = getDrillRigPrice(currentCount);
    if (gameState.money < cost) return; // not enough money
    gameState.money -= cost;

    gameState.buildings.push({
      type: "DRILL_RIG",
      x,
      y,
      width: 2,
      height: 2,
      storage: 0,
      storageCapacity: 5,
      miningTimer: 0,
      miningInterval: 3 // seconds per ore
    });

  } else if (bm.itemType === "RAIL") {
    const currentCount = getRailCount();
    const cost = getRailPrice(currentCount);
    if (gameState.money < cost) return;
    gameState.money -= cost;

    gameState.rails[y][x] = true;

    // Rail topology changed – carts might need to re-path
    for (const cart of gameState.carts) {
      const targetType = cart.cargo > 0 ? "STORE" : "RIG";
      recomputeCartPath(cart, targetType);
    }

  } else if (bm.itemType === "CART") {
    const currentCount = getCartCount();
    const cost = getCartPrice(currentCount);
    if (gameState.money < cost) return;
    gameState.money -= cost;

    const cart = {
      x,
      y,
      fx: x + 0.5,
      fy: y + 0.5,
      cargo: 0,
      capacity: 3,
      speed: 1.2,
      state: "MOVING",   // MOVING, LOADING, UNLOADING, IDLE
      actionTimer: 0,
      path: null,
      pathPos: 0,
      targetType: "RIG"  // start by seeking rigs
    };

    recomputeCartPath(cart, "RIG");
    gameState.carts.push(cart);
  }
}

// --- Player movement (disabled in build mode / mining) ---

function tryMove(dx, dy) {
  const p = gameState.player;

  if (p.isMining || gameState.buildMode.active) return;

  const newX = p.x + dx;
  const newY = p.y + dy;

  if (!isInsideMap(newX, newY)) return;

  const tile = gameState.map[newY][newX];
  if (tile === TILE.WALL) return;

  p.x = newX;
  p.y = newY;

  if (tile === TILE.STORE) {
    sellBackpackAtStore();
  }
}

// --- Manual mining (Space) ---

function startMining() {
  const p = gameState.player;

  if (p.isMining || p.backpack >= p.backpackCapacity) return;

  const tile = gameState.map[p.y][p.x];
  if (tile !== TILE.ORE) return;

  p.isMining = true;
  p.miningElapsed = 0;
}

// --- Selling at store (manual, backpack) ---

function sellBackpackAtStore() {
  const p = gameState.player;
  const count = p.backpack;
  if (count <= 0) return;

  gameState.money += count * MONEY_PER_ORE;
  gameState.xp += count * XP_PER_ORE;

  p.backpack = 0;
  handleLevelUps();
}

function handleLevelUps() {
  while (gameState.xp >= gameState.xpToNext) {
    gameState.xp -= gameState.xpToNext;
    gameState.level += 1;
    gameState.xpToNext = Math.floor(gameState.xpToNext * 1.5);
  }
}

// --- Selling placed items with Delete ---

function sellAtPlayerTile() {
  const p = gameState.player;
  const x = p.x;
  const y = p.y;

  // 1) Try cart first
  for (let i = 0; i < gameState.carts.length; i++) {
    const cart = gameState.carts[i];
    const cx = Math.round(cart.fx - 0.5);
    const cy = Math.round(cart.fy - 0.5);
    if (cx === x && cy === y) {
      const count = getCartCount();
      if (count <= 0) return;
      const refund = getCartPrice(count - 1);
      gameState.money += refund;
      // cart cargo is lost when selling
      gameState.carts.splice(i, 1);
      return;
    }
  }

  // 2) Try Drill Rig (any tile in its 2x2 footprint)
  for (let i = 0; i < gameState.buildings.length; i++) {
    const b = gameState.buildings[i];
    if (b.type !== "DRILL_RIG") continue;

    if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
      const count = getRigCount();
      if (count <= 0) return;
      const refund = getDrillRigPrice(count - 1);
      gameState.money += refund;
      // Stored ore in the rig is lost
      gameState.buildings.splice(i, 1);
      return;
    }
  }

  // 3) Try Rail
  if (isInsideMap(x, y) && gameState.rails[y][x]) {
    const count = getRailCount();
    if (count <= 0) return;
    const refund = getRailPrice(count - 1);
    gameState.money += refund;
    gameState.rails[y][x] = false;

    // Recompute paths for all carts since topology changed
    for (const cart of gameState.carts) {
      const targetType = cart.cargo > 0 ? "STORE" : "RIG";
      recomputeCartPath(cart, targetType);
    }

    return;
  }
}

// --- Shop & build mode events ---

function toggleShop() {
  const shop = document.getElementById("shopWindow");
  if (!shop) return;
  shop.classList.toggle("hidden");
}

window.addEventListener("DOMContentLoaded", () => {
  const shop = document.getElementById("shopWindow");
  const closeShop = document.getElementById("closeShop");
  const itemButtons = shop ? shop.querySelectorAll(".shop-items button") : [];

  if (closeShop) {
    closeShop.addEventListener("click", () => {
      shop.classList.add("hidden");
    });
  }

  itemButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-item");
      startBuildMode(type);
      shop.classList.add("hidden");
    });
  });
});

function startBuildMode(type) {
  const bm = gameState.buildMode;
  bm.active = true;
  bm.itemType = type;
  bm.cursorX = gameState.player.x;
  bm.cursorY = gameState.player.y;
}

// --- Keyboard handling ---

window.addEventListener("keydown", (e) => {
  // Space = manual mining (if not in build mode)
  if (e.code === "Space") {
    e.preventDefault();
    if (!gameState.buildMode.active) {
      startMining();
    }
    return;
  }

  // P = toggle shop
  if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    toggleShop();
    return;
  }

  // Delete = sell item under player (only if not in build mode)
  if (e.key === "Delete") {
    e.preventDefault();
    if (!gameState.buildMode.active) {
      sellAtPlayerTile();
    }
    return;
  }

  // Enter = place in build mode
  if (e.key === "Enter") {
    if (gameState.buildMode.active) {
      e.preventDefault();
      placeCurrentBuildItem();
      return;
    }
  }

  // Esc = cancel build mode
  if (e.key === "Escape") {
    if (gameState.buildMode.active) {
      e.preventDefault();
      gameState.buildMode.active = false;
      gameState.buildMode.itemType = null;
      return;
    }
  }

  if (!keys.hasOwnProperty(e.key)) return;
  e.preventDefault();

  if (keys[e.key]) return; // ignore repeat
  keys[e.key] = true;

  if (gameState.buildMode.active) {
    const bm = gameState.buildMode;
    if (e.key === "ArrowUp" || e.key === "w") {
      bm.cursorY = Math.max(0, bm.cursorY - 1);
    } else if (e.key === "ArrowDown" || e.key === "s") {
      bm.cursorY = Math.min(gameState.mapHeight - 1, bm.cursorY + 1);
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      bm.cursorX = Math.max(0, bm.cursorX - 1);
    } else if (e.key === "ArrowRight" || e.key === "d") {
      bm.cursorX = Math.min(gameState.mapWidth - 1, bm.cursorX + 1);
    }
  } else {
    if (e.key === "ArrowUp" || e.key === "w") {
      tryMove(0, -1);
    } else if (e.key === "ArrowDown" || e.key === "s") {
      tryMove(0, 1);
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      tryMove(-1, 0);
    } else if (e.key === "ArrowRight" || e.key === "d") {
      tryMove(1, 0);
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (!keys.hasOwnProperty(e.key)) return;
  keys[e.key] = false;
});

// --- Drill Rigs automation (2x2, only orthogonal ores) ---

function updateDrillRigs(dt) {
  for (const b of gameState.buildings) {
    if (b.type !== "DRILL_RIG") continue;

    if (b.storage >= b.storageCapacity) continue; // full, pause

    // Check for orthogonally adjacent ore around the 2x2 footprint
    let hasOre = false;

    for (let dy = 0; dy < b.height; dy++) {
      for (let dx = 0; dx < b.width; dx++) {
        const cellX = b.x + dx;
        const cellY = b.y + dy;

        const neighbors = [
          { nx: cellX + 1, ny: cellY },
          { nx: cellX - 1, ny: cellY },
          { nx: cellX, ny: cellY + 1 },
          { nx: cellX, ny: cellY - 1 }
        ];

        for (const { nx, ny } of neighbors) {
          if (!isInsideMap(nx, ny)) continue;
          if (gameState.map[ny][nx] === TILE.ORE) {
            hasOre = true;
            break;
          }
        }
        if (hasOre) break;
      }
      if (hasOre) break;
    }

    if (!hasOre) continue;

    b.miningTimer += dt;
    if (b.miningTimer >= b.miningInterval) {
      b.miningTimer = 0;
      b.storage = Math.min(b.storageCapacity, b.storage + 1);
      // Currently infinite ore; later we can consume tiles.
    }
  }
}

// --- Rig / store helpers for carts ---

function railTileAdjacentToRig(b, rx, ry) {
  // left side
  if (rx === b.x - 1 && ry >= b.y && ry < b.y + b.height) return true;
  // right side
  if (rx === b.x + b.width && ry >= b.y && ry < b.y + b.height) return true;
  // top side
  if (ry === b.y - 1 && rx >= b.x && rx < b.x + b.width) return true;
  // bottom side
  if (ry === b.y + b.height && rx >= b.x && rx < b.x + b.width) return true;

  return false;
}

// Find a rig that this rail tile is adjacent to (strict orthogonal adjacency)
function findDrillRigAtRailTile(rx, ry) {
  for (const b of gameState.buildings) {
    if (b.type !== "DRILL_RIG") continue;
    if (railTileAdjacentToRig(b, rx, ry)) {
      return b;
    }
  }
  return null;
}

// Find store tile coordinates (first found)
function getStoreLocation() {
  for (let y = 0; y < gameState.mapHeight; y++) {
    for (let x = 0; x < gameState.mapWidth; x++) {
      if (gameState.map[y][x] === TILE.STORE) {
        return { x, y };
      }
    }
  }
  return null;
}

// Rail tile is orthogonally adjacent to store?
function isRailTileAdjacentToStore(rx, ry, store) {
  if (!store) return false;
  const dx = Math.abs(rx - store.x);
  const dy = Math.abs(ry - store.y);
  return dx + dy === 1;
}

// Recompute path for a cart depending on target type
function recomputeCartPath(cart, targetType) {
  const startX = Math.round(cart.fx - 0.5);
  const startY = Math.round(cart.fy - 0.5);

  let path = null;
  if (targetType === "STORE") {
    path = findRailPathToStore(startX, startY);
  } else if (targetType === "RIG") {
    path = findRailPathToRig(startX, startY);
  }

  if (!path || path.length === 0) {
    // No valid path -> cart goes idle on current tile
    cart.path = [{ x: startX, y: startY }];
    cart.pathPos = 0;
    cart.targetType = null;
    cart.state = "IDLE";
  } else {
    cart.path = path;
    cart.pathPos = 0;
    cart.targetType = targetType;
    cart.state = "MOVING";
  }
}

// --- Carts automation (pathfinding) ---

function updateCarts(dt) {
  const store = getStoreLocation();

  for (const cart of gameState.carts) {
    // LOADING: take from rig over time
    if (cart.state === "LOADING") {
      cart.actionTimer += dt;

      const rx = Math.round(cart.fx - 0.5);
      const ry = Math.round(cart.fy - 0.5);
      const rig = findDrillRigAtRailTile(rx, ry);

      // If rig no longer valid or cart full, switch to STORE
      if (!rig || rig.storage <= 0 || cart.cargo >= cart.capacity) {
        cart.actionTimer = 0;
        if (cart.cargo > 0) {
          recomputeCartPath(cart, "STORE");
        } else {
          cart.state = "IDLE";
        }
        continue;
      }

      if (cart.actionTimer >= 1) { // one ore per second
        cart.actionTimer = 0;
        rig.storage -= 1;
        cart.cargo += 1;
      }
      continue;
    }

    // UNLOADING: sell to store over time
    if (cart.state === "UNLOADING") {
      cart.actionTimer += dt;

      if (!store) {
        cart.state = "IDLE";
        cart.actionTimer = 0;
        continue;
      }

      if (cart.cargo <= 0) {
        cart.actionTimer = 0;
        recomputeCartPath(cart, "RIG");
        continue;
      }

      if (cart.actionTimer >= 1) { // one ore per second
        cart.actionTimer = 0;
        cart.cargo -= 1;

        gameState.money += MONEY_PER_ORE;
        gameState.xp += XP_PER_ORE;
        handleLevelUps();
      }
      continue;
    }

    // IDLE: do nothing for now
    if (cart.state === "IDLE") {
      continue;
    }

    // MOVING along a path (can include turns)
    if (!cart.path || cart.path.length === 0) {
      // Try to find a path based on current cargo
      const targetType = cart.cargo > 0 ? "STORE" : "RIG";
      recomputeCartPath(cart, targetType);
      continue;
    }

    const path = cart.path;
    const lastIndex = path.length - 1;

    if (lastIndex <= 0) {
      // Single tile path
      cart.fx = path[0].x + 0.5;
      cart.fy = path[0].y + 0.5;
    } else {
      if (typeof cart.pathPos !== "number") cart.pathPos = 0;

      const segmentCount = lastIndex;
      let pos = cart.pathPos + cart.speed * dt;

      if (pos >= segmentCount) {
        pos = segmentCount;
      }

      cart.pathPos = pos;

      const i0 = Math.floor(pos);
      const i1 = Math.min(lastIndex, i0 + 1);
      const t = pos - i0;

      const a = path[i0];
      const b = path[i1];

      cart.fx = a.x + 0.5 + (b.x - a.x) * t;
      cart.fy = a.y + 0.5 + (b.y - a.y) * t;

      // If we've reached the end of the path, switch to LOADING / UNLOADING
      if (pos >= segmentCount - 1e-3) {
        const goalTile = path[lastIndex];
        const gx = goalTile.x;
        const gy = goalTile.y;

        if (cart.targetType === "RIG") {
          const rig = findDrillRigAtRailTile(gx, gy);
          if (rig && rig.storage > 0 && cart.cargo < cart.capacity) {
            cart.state = "LOADING";
            cart.actionTimer = 0;
          } else {
            cart.state = "IDLE";
          }
        } else if (cart.targetType === "STORE") {
          if (store && cart.cargo > 0 && isRailTileAdjacentToStore(gx, gy, store)) {
            cart.state = "UNLOADING";
            cart.actionTimer = 0;
          } else {
            cart.state = "IDLE";
          }
        }
      }
    }
  }
}

// --- Main game logic per frame ---

function updateLogic(dt) {
  const p = gameState.player;

  // Manual mining
  if (p.isMining) {
    p.miningElapsed += dt;
    if (p.miningElapsed >= p.miningDuration) {
      p.isMining = false;
      p.miningElapsed = p.miningDuration;

      if (p.backpack < p.backpackCapacity) {
        p.backpack += 1;
      }
    }
  }

  // Automation
  updateDrillRigs(dt);
  updateCarts(dt);
}
