// Tile type constants
const TILE = {
  WALL: 0,
  FLOOR: 1,
  ORE: 2,
  STORE: 3
};

// Generate a simple cave-like room with walls & some ore patches
function createMap(width, height) {
  const map = [];

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      // Border walls
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push(TILE.WALL);
      } else {
        // Inside area is mainly floor
        row.push(TILE.FLOOR);
      }
    }
    map.push(row);
  }

  // Add some random ore spots inside the cave
  const orePatches = 25; // number of tiles with ore
  for (let i = 0; i < orePatches; i++) {
    const x = 2 + Math.floor(Math.random() * (width - 4));
    const y = 2 + Math.floor(Math.random() * (height - 4));
    map[y][x] = TILE.ORE;
  }

  // Place a store near a wall
  placeStore(map);

  return map;
}

// Place the store somewhere near a wall (one tile in from the edge)
function placeStore(map) {
  const height = map.length;
  const width = map[0].length;

  const side = Math.floor(Math.random() * 4);
  let x, y;

  if (side === 0) {
    x = 1;
    y = 1 + Math.floor(Math.random() * (height - 2));
  } else if (side === 1) {
    x = width - 2;
    y = 1 + Math.floor(Math.random() * (height - 2));
  } else if (side === 2) {
    x = 1 + Math.floor(Math.random() * (width - 2));
    y = 1;
  } else {
    x = 1 + Math.floor(Math.random() * (width - 2));
    y = height - 2;
  }

  map[y][x] = TILE.STORE;
}

const MAP_WIDTH = 30;
const MAP_HEIGHT = 18;
const TILE_SIZE = 32;

// Helper: create empty rail grid
function createRailsGrid(width, height) {
  const rails = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) row.push(false);
    rails.push(row);
  }
  return rails;
}

const gameState = {
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  tileSize: TILE_SIZE,

  map: createMap(MAP_WIDTH, MAP_HEIGHT),

  // Player in tile coordinates
  player: {
    x: Math.floor(MAP_WIDTH / 2),
    y: Math.floor(MAP_HEIGHT / 2),

    // Mining / manual state
    isMining: false,
    miningElapsed: 0,        // seconds
    miningDuration: 10,      // seconds to complete manual mining (space)

    // Backpack
    backpack: 0,
    backpackCapacity: 3
  },

  // Progression
  level: 1,
  xp: 0,
  xpToNext: 20,

  // Money
  money: 0,

  // Automation stuff
  buildings: [],       // Drill Rigs, etc.
  rails: createRailsGrid(MAP_WIDTH, MAP_HEIGHT),
  carts: [],

  // Build mode / placement
  buildMode: {
    active: false,
    itemType: null,    // 'DRILL_RIG', 'RAIL', 'CART'
    cursorX: 1,
    cursorY: 1
  }
};
