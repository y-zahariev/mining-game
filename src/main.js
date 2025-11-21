let lastTime = performance.now();
let saveAccumulator = 0;

function gameLoop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Always advance the game simulation
  updateLogic(dt);

  // Only render when window/tab is visible
  const isVisible = !document.hidden;
  if (isVisible) {
    render();
  }

  // Still auto-save even when hidden
  saveAccumulator += dt;
  if (saveAccumulator >= 5) {
    saveAccumulator = 0;
    saveToLocal();
  }

  requestAnimationFrame(gameLoop);
}

// Try to load save, then start loop
if (!loadFromLocal()) {
  console.log("No save found, starting new game.");
}

requestAnimationFrame(gameLoop);
