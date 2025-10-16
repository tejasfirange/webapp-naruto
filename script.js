const tg = window.Telegram.WebApp;
tg.expand();

const map = document.getElementById("map");
const regionText = document.getElementById("region");
const chunkText = document.getElementById("chunk");
const sendBtn = document.getElementById("sendBtn");

const regions = [
  { name: "Land of Fire", color: "#e25822", startX: 0, endX: 7 },
  { name: "Land of Water", color: "#1e88e5", startX: 8, endX: 15 },
  { name: "Land of Wind", color: "#fdd835", startX: 16, endX: 23 }
];

const width = 24, height = 12;
let playerPos = { x: 3, y: 5 };

function createMap() {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      const region = regions.find(r => x >= r.startX && x <= r.endX);
      tile.style.backgroundColor = region.color + "33";
      tile.dataset.region = region.name;
      tile.dataset.x = x;
      tile.dataset.y = y;
      tile.onclick = () => movePlayer(x, y, region);
      map.appendChild(tile);
    }
  }
  renderPlayer();
}

function renderPlayer() {
  document.querySelectorAll(".tile").forEach(tile => tile.innerHTML = "");
  const current = document.querySelector(`.tile[data-x='${playerPos.x}'][data-y='${playerPos.y}']`);
  if (current) {
    const marker = document.createElement("div");
    marker.className = "player";
    current.appendChild(marker);
  }
}

function movePlayer(x, y, region) {
  playerPos = { x, y };
  const chunk = `C-${x}-${y}`;
  regionText.innerHTML = `Region: ${region.name}`;
  chunkText.innerHTML = `Chunk: ${chunk}`;
  renderPlayer();
  sendBtn.onclick = () => {
    tg.sendData(JSON.stringify({
      region: region.name,
      chunk: chunk,
      coords: playerPos
    }));
    tg.close();
  };
}

createMap();
