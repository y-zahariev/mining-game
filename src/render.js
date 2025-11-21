function updateUI() {
  const levelEl = document.getElementById("levelText");
  const xpFillEl = document.getElementById("xpBarFill");
  const backpackEl = document.getElementById("backpackText");
  const moneyEl = document.getElementById("moneyText");

  if (!levelEl || !xpFillEl || !backpackEl || !moneyEl) return;

  const lvl = gameState.level;
  const xp = gameState.xp;
  const xpToNext = gameState.xpToNext;
  const ratio = xpToNext > 0 ? (xp / xpToNext) : 0;

  levelEl.textContent = `Level ${lvl}`;
  xpFillEl.style.width = `${Math.min(100, ratio * 100)}%`;

  const p = gameState.player;
  backpackEl.textContent = `Backpack: ${p.backpack} / ${p.backpackCapacity}`;
  moneyEl.textContent = `Money: ${gameState.money}`;

  updateShopPriceUI();
}

function updateShopPriceUI() {
  const rigSpan = document.getElementById("rigPriceText");
  const railSpan = document.getElementById("railPriceText");
  const cartSpan = document.getElementById("cartPriceText");

  if (!rigSpan || !railSpan || !cartSpan) return;

  // These functions come from logic.js and are global
  const rigPrice = getDrillRigPrice(getRigCount());
  const railPrice = getRailPrice(getRailCount());
  const cartPrice = getCartPrice(getCartCount());

  rigSpan.textContent = rigPrice;
  railSpan.textContent = railPrice;
  cartSpan.textContent = cartPrice;
}


function renderRails(ctx) {
  const ts = gameState.tileSize;

  for (let y = 0; y < gameState.mapHeight; y++) {
    for (let x = 0; x < gameState.mapWidth; x++) {
      if (!gameState.rails[y][x]) continue;
      const px = x * ts;
      const py = y * ts;

      // Determine neighbors for connection look
      const up = y > 0 && gameState.rails[y - 1][x];
      const down = y < gameState.mapHeight - 1 && gameState.rails[y + 1][x];
      const left = x > 0 && gameState.rails[y][x - 1];
      const right = x < gameState.mapWidth - 1 && gameState.rails[y][x + 1];

      const cx = px + ts / 2;
      const cy = py + ts / 2;

      ctx.strokeStyle = "#888";
      ctx.lineWidth = 3;

      ctx.beginPath();

      // Draw from center out to each connected direction
      if (left) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, cy);
      }
      if (right) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(px + ts, cy);
      }
      if (up) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, py);
      }
      if (down) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, py + ts);
      }

      // If isolated tile (no neighbors), draw a small stub
      if (!up && !down && !left && !right) {
        ctx.moveTo(cx - ts * 0.3, cy);
        ctx.lineTo(cx + ts * 0.3, cy);
      }

      ctx.stroke();

      // If this tile is a junction/crossing (3 or 4 neighbors), mark center
      const count =
        (up ? 1 : 0) +
        (down ? 1 : 0) +
        (left ? 1 : 0) +
        (right ? 1 : 0);

      if (count >= 3) {
        ctx.fillStyle = "#bbbbbb";
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}


function renderDrillRigs(ctx) {
  const ts = gameState.tileSize;

  for (const b of gameState.buildings) {
    if (b.type !== "DRILL_RIG") continue;

    const px = b.x * ts;
    const py = b.y * ts;
    const w = b.width * ts;
    const h = b.height * ts;

    // Base body
    const isWorking = b.storage < b.storageCapacity;
    ctx.fillStyle = isWorking ? "#795548" : "#444"; // brown when working, dark when idle

    ctx.fillRect(px, py, w, h);

    // Outline
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, w, h);

    // Storage indicator (small boxes)
    const cellSize = ts * 0.3;
    for (let i = 0; i < b.storageCapacity; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const cx = px + 4 + col * (cellSize + 2);
      const cy = py + 4 + row * (cellSize + 2);

      ctx.strokeStyle = "#222";
      ctx.strokeRect(cx, cy, cellSize, cellSize);

      if (i < b.storage) {
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);
      }
    }

    // Working animation: pulsating center
    if (isWorking) {
      const t = performance.now() / 1000;
      const pulse = (Math.sin(t * 4) + 1) / 2; // 0..1
      const r = ts * 0.4 + pulse * ts * 0.1;

      ctx.fillStyle = "rgba(255, 235, 59, 0.7)";
      ctx.beginPath();
      ctx.arc(px + w / 2, py + h / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderCarts(ctx) {
  const ts = gameState.tileSize;

  for (const cart of gameState.carts) {
    const px = (cart.fx - 0.5) * ts;
    const py = (cart.fy - 0.5) * ts;

    // Cart body
    ctx.fillStyle = "#b0bec5";
    ctx.fillRect(px + ts * 0.1, py + ts * 0.2, ts * 0.8, ts * 0.6);

    // Wheels
    ctx.fillStyle = "#263238";
    ctx.beginPath();
    ctx.arc(px + ts * 0.25, py + ts * 0.85, ts * 0.12, 0, Math.PI * 2);
    ctx.arc(px + ts * 0.75, py + ts * 0.85, ts * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Cargo indicator inside cart
    const slots = cart.capacity;
    for (let i = 0; i < slots; i++) {
      const cx = px + ts * 0.15 + i * (ts * 0.2 + 2);
      const cy = py + ts * 0.3;
      const size = ts * 0.18;

      ctx.strokeStyle = "#37474f";
      ctx.strokeRect(cx, cy, size, size);

      if (i < cart.cargo) {
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(cx + 1, cy + 1, size - 2, size - 2);
      }
    }
  }
}

function renderMapAndTiles(ctx) {
  const canvas = ctx.canvas;
  canvas.width = gameState.mapWidth * gameState.tileSize;
  canvas.height = gameState.mapHeight * gameState.tileSize;

  const ts = gameState.tileSize;

  for (let y = 0; y < gameState.mapHeight; y++) {
    for (let x = 0; x < gameState.mapWidth; x++) {
      const tile = gameState.map[y][x];
      const px = x * ts;
      const py = y * ts;

      if (tile === TILE.WALL) {
        ctx.fillStyle = "#101010";
      } else if (tile === TILE.FLOOR) {
        ctx.fillStyle = "#202020";
      } else if (tile === TILE.ORE) {
        ctx.fillStyle = "#202020";
      } else if (tile === TILE.STORE) {
        ctx.fillStyle = "#202020";
      }

      ctx.fillRect(px, py, ts, ts);

      if (tile === TILE.ORE) {
        ctx.fillStyle = "#4caf50";
        const m = ts * 0.2;
        ctx.fillRect(px + m, py + m, ts - m * 2, ts - m * 2);
      }

      if (tile === TILE.STORE) {
        ctx.fillStyle = "#2196f3";
        const m = ts * 0.1;
        ctx.fillRect(px + m, py + m, ts - m * 2, ts - m * 2);

        ctx.fillStyle = "#bbdefb";
        ctx.fillRect(px + m, py + m, ts - m * 2, (ts - m * 2) * 0.4);
      }

      ctx.strokeStyle = "#151515";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, ts, ts);
    }
  }
}

function renderPlayer(ctx) {
  const ts = gameState.tileSize;
  const p = gameState.player;
  const px = p.x * ts;
  const py = p.y * ts;

  let alpha = 0.9;
  if (p.isMining) {
    const t = p.miningElapsed;
    const blink = (Math.sin(t * Math.PI * 2 * 0.5) + 1) / 2;
    alpha = 0.4 + blink * 0.6;
  }

  ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
  ctx.fillRect(px, py, ts, ts);

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, ts, ts);

  if (p.backpack > 0) {
    ctx.fillStyle = "#4caf50";
    const size = ts * 0.4;
    ctx.fillRect(px + ts - size - 4, py + 4, size, size);
    ctx.strokeStyle = "#003300";
    ctx.strokeRect(px + ts - size - 4, py + 4, size, size);
  }

  // Highlight store beneath player
  const tile = gameState.map[p.y][p.x];
  if (tile === TILE.STORE) {
    ctx.strokeStyle = "rgba(33,150,243,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);

    ctx.fillStyle = "rgba(33,150,243,0.8)";
    ctx.beginPath();
    ctx.arc(px + ts * 0.8, py + ts * 0.2, ts * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderBuildModeGhost(ctx) {
  const bm = gameState.buildMode;
  if (!bm.active || !bm.itemType) return;

  const ts = gameState.tileSize;
  const gx = bm.cursorX * ts;
  const gy = bm.cursorY * ts;

  const canPlace = canPlaceCurrentBuildItem();
  const fill = canPlace ? "rgba(76, 175, 80, 0.35)" : "rgba(244, 67, 54, 0.35)";
  const stroke = canPlace ? "#4caf50" : "#f44336";

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;

  if (bm.itemType === "DRILL_RIG") {
    // 2x2 block preview
    ctx.fillRect(gx, gy, ts * 2, ts * 2);
    ctx.strokeRect(gx, gy, ts * 2, ts * 2);

  } else if (bm.itemType === "RAIL") {
    // Thin rail line across tile (matches rails visually)
    const yMid = gy + ts * 0.45;
    const h = ts * 0.1;
    ctx.fillRect(gx, yMid, ts, h);
    ctx.strokeRect(gx, yMid, ts, h);

  } else if (bm.itemType === "CART") {
    // Cart-like box in the middle of tile
    const size = ts * 0.6;
    const offset = ts * 0.2;
    ctx.fillRect(gx + offset, gy + offset, size, size);
    ctx.strokeRect(gx + offset, gy + offset, size, size);
  }
}

function render() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  renderMapAndTiles(ctx);
  renderRails(ctx);
  renderDrillRigs(ctx);
  renderCarts(ctx);
  renderPlayer(ctx);
  renderBuildModeGhost(ctx);
  updateUI();
}
