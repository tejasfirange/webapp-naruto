const tg = window.Telegram.WebApp;
tg.expand();

const map = document.getElementById("map");
const regionText = document.getElementById("region");
const chunkText = document.getElementById("chunk");

let player = { x: 7, y: 4 };
let offset = { x: 0, y: 0 };
const mapSize = { width: 15, height: 9 };

const regionColors = {
  fire: "#a33b16",
  water: "#1b6dd1",
  wind: "#d2b843",
  lightning: "#a1a1f4",
  earth: "#7c5b3f"
};

// Generate pseudo-random world pattern
function getRegion(x, y) {
  const seed = (x * 92821 + y * 1237) % 5;
  return ["fire", "water", "wind", "lightning", "earth"][Math.abs(seed)];
}

function renderMap() {
  map.innerHTML = "";
  for (let y = 0; y < mapSize.height; y++) {
    for (let x = 0; x < mapSize.width; x++) {
      const globalX = x + offset.x;
      const globalY = y + offset.y;
      const region = getRegion(globalX, globalY);
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.style.backgroundColor = regionColors[region];
      tile.style.opacity = 0.8;

      if (globalX === player.x && globalY === player.y) {
        const mark = document.createElement("div");
        mark.className = "player";
        tile.appendChild(mark);
        regionText.innerHTML = `Region: ${region.charAt(0).toUpperCase() + region.slice(1)}`;
        chunkText.innerHTML = `Chunk: ${globalX}-${globalY}`;
      }
      map.appendChild(tile);
    }
  }
}

function move(dx, dy) {
  player.x += dx;
  player.y += dy;

  // Smooth scrolling illusion (shift viewport when near edges)
  if (player.x - offset.x < 3) offset.x -= 1;
  if (player.x - offset.x > 11) offset.x += 1;
  if (player.y - offset.y < 2) offset.y -= 1;
  if (player.y - offset.y > 6) offset.y += 1;

  renderMap();
}

// Movement bindings
document.getElementById("up").onclick = () => move(0, -1);
document.getElementById("down").onclick = () => move(0, 1);
document.getElementById("left").onclick = () => move(-1, 0);
document.getElementById("right").onclick = () => move(1, 0);

renderMap();
