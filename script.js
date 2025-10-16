const tg = window.Telegram.WebApp;
tg.expand();

const map = document.getElementById('map');
const regionEl = document.getElementById('region');
const chunkEl = document.getElementById('chunk');

let position = { x: 0, y: 0 };
const regionColors = ['fire', 'water', 'wind', 'earth', 'lightning'];

function getRegion(x, y) {
  const seed = (x * 92821 + y * 1237) % 5;
  return regionColors[Math.abs(seed)];
}

function move(dx, dy) {
  position.x += dx;
  position.y += dy;

  // Scroll map visually (simulate movement)
  map.style.transform = `translate(${position.x * -80}px, ${position.y * -80}px)`;

  const region = getRegion(position.x, position.y);
  regionEl.innerHTML = `Region: ${region.toUpperCase()}`;
  chunkEl.innerHTML = `Chunk: ${position.x}, ${position.y}`;
}

document.getElementById('up').onclick = () => move(0, -1);
document.getElementById('down').onclick = () => move(0, 1);
document.getElementById('left').onclick = () => move(-1, 0);
document.getElementById('right').onclick = () => move(1, 0);
