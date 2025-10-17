import React, { useEffect, useRef, useState } from "react";

// Naruto-style Tile Map — single-file React app
// Default export: NarutoMapApp
// How it works (brief):
// - Procedurally draws tiles on an HTMLCanvasElement without external assets
// - Tile types: water, sand, grass, forest, mountain, snow
// - Player stays centered in viewport (500x500) and moves tile-by-tile with WASD / Arrow keys
// - Zoom controls (+ / - and wheel)
// - Shows current region name, tile type, and coordinates
// - Map data is generated with region "blobs" (simple seeded noise-like algorithm)

export default function NarutoMapApp() {
  const CANVAS_SIZE = 500; // viewport size
  const BASE_TILE_PX = 16; // base tile size in pixels at zoom=1

  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [tileSize, setTileSize] = useState(BASE_TILE_PX);
  const [mapW] = useState(80);
  const [mapH] = useState(60);
  const [player, setPlayer] = useState({ x: Math.floor(mapW / 2), y: Math.floor(mapH / 2) });
  const [mapData] = useState(() => generateMap(mapW, mapH));
  const [regionName, setRegionName] = useState(lookupRegionName(mapData, player.x, player.y));
  const [tileInfo, setTileInfo] = useState(mapData[player.y][player.x]);

  // update tile size when zoom changes
  useEffect(() => {
    setTileSize(Math.max(4, Math.round(BASE_TILE_PX * zoom)));
    draw();
  }, [zoom]);

  // draw on mount and when player/move change
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, tileSize]);

  // keyboard controls
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey) return;
      const k = e.key;
      if (["ArrowUp", "w", "W"].includes(k)) move(0, -1);
      if (["ArrowDown", "s", "S"].includes(k)) move(0, 1);
      if (["ArrowLeft", "a", "A"].includes(k)) move(-1, 0);
      if (["ArrowRight", "d", "D"].includes(k)) move(1, 0);
      if (k === "+" || k === "=") setZoom((z) => Math.min(3, z + 0.1));
      if (k === "-") setZoom((z) => Math.max(0.4, z - 0.1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // wheel zoom
  useEffect(() => {
    function onWheel(e) {
      if (e.ctrlKey) return; // let browser handle
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setZoom((z) => Math.max(0.4, Math.min(3, z + delta)));
    }
    const cv = canvasRef.current;
    cv?.addEventListener("wheel", onWheel, { passive: false });
    return () => cv?.removeEventListener("wheel", onWheel);
  }, []);

  function move(dx, dy) {
    const nx = clamp(player.x + dx, 0, mapW - 1);
    const ny = clamp(player.y + dy, 0, mapH - 1);
    setPlayer({ x: nx, y: ny });
    setRegionName(lookupRegionName(mapData, nx, ny));
    setTileInfo(mapData[ny][nx]);
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // pixel-ratio aware
    const DPR = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * DPR;
    canvas.height = CANVAS_SIZE * DPR;
    canvas.style.width = CANVAS_SIZE + "px";
    canvas.style.height = CANVAS_SIZE + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const tilePx = tileSize;
    const tilesPerViewportX = Math.ceil(CANVAS_SIZE / tilePx);
    const tilesPerViewportY = Math.ceil(CANVAS_SIZE / tilePx);

    // center player in viewport
    const offsetTilesX = Math.floor(tilesPerViewportX / 2);
    const offsetTilesY = Math.floor(tilesPerViewportY / 2);

    const startX = clamp(player.x - offsetTilesX, 0, Math.max(0, mapW - tilesPerViewportX));
    const startY = clamp(player.y - offsetTilesY, 0, Math.max(0, mapH - tilesPerViewportY));

    // adjust when near edges so player visually centered when possible
    const viewWidthPx = tilesPerViewportX * tilePx;
    const viewHeightPx = tilesPerViewportY * tilePx;
    const extraX = (CANVAS_SIZE - viewWidthPx) / 2;
    const extraY = (CANVAS_SIZE - viewHeightPx) / 2;

    for (let y = 0; y < tilesPerViewportY; y++) {
      for (let x = 0; x < tilesPerViewportX; x++) {
        const mapX = startX + x;
        const mapY = startY + y;
        const tx = x * tilePx + extraX;
        const ty = y * tilePx + extraY;
        const tile = mapData[mapY] && mapData[mapY][mapX] ? mapData[mapY][mapX] : { type: "void" };
        drawTile(ctx, tx, ty, tilePx, tile);
      }
    }

    // draw grid subtle
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.strokeStyle = "#000";
    for (let i = 0; i <= tilesPerViewportX; i++) {
      const x = i * tilePx + extraX + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, extraY);
      ctx.lineTo(x, extraY + tilesPerViewportY * tilePx);
      ctx.stroke();
    }
    for (let i = 0; i <= tilesPerViewportY; i++) {
      const y = i * tilePx + extraY + 0.5;
      ctx.beginPath();
      ctx.moveTo(extraX, y);
      ctx.lineTo(extraX + tilesPerViewportX * tilePx, y);
      ctx.stroke();
    }
    ctx.restore();

    // draw player at center cell
    const playerScreenX = Math.floor(CANVAS_SIZE / 2 - tilePx / 2);
    const playerScreenY = Math.floor(CANVAS_SIZE / 2 - tilePx / 2);
    drawPlayer(ctx, playerScreenX, playerScreenY, tilePx);

    // draw overlay compass / coords
    ctx.save();
    ctx.font = "13px Inter, Arial";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(`x:${player.x} y:${player.y}`, 10, CANVAS_SIZE - 10);
    ctx.restore();
  }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', display: 'flex', gap: 12 }}>
      <div>
        <div style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, border: '2px solid #111', borderRadius: 10, overflow: 'hidden', background: '#8fb2c8' }}>
          <canvas ref={canvasRef} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <button onClick={() => move(0, -1)}>↑</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => move(-1, 0)}>←</button>
              <button onClick={() => move(1, 0)}>→</button>
            </div>
            <button onClick={() => move(0, 1)}>↓</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>-</button>
            <div>Zoom {Math.round(zoom * 100) / 100}</div>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>+</button>
          </div>

          <div style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
            <div style={{ fontWeight: 700 }}>{regionName}</div>
            <div style={{ fontSize: 13 }}>{tileInfo.type}</div>
            <div style={{ fontSize: 12, color: '#444' }}>x:{player.x} y:{player.y}</div>
          </div>
        </div>
      </div>

      <div style={{ width: 280 }}>
        <h3 style={{ marginTop: 0 }}>Map Legend</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {legendItems.map((l) => (
            <div key={l.type} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 36, height: 22, borderRadius: 4, border: '1px solid #ccc', overflow: 'hidden' }}>
                <TilePreview type={l.type} />
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{l.label}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{l.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Helper UI Pieces -----------------
function TilePreview({ type }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    drawTile(ctx, 0, 0, 36, { type });
  }, [type]);
  return <canvas ref={ref} width={36} height={22} style={{ width: '36px', height: '22px', display: 'block' }} />;
}

const legendItems = [
  { type: 'water', label: 'Water', description: 'Ocean / sea tiles' },
  { type: 'sand', label: 'Sand', description: 'Beaches & deserts' },
  { type: 'grass', label: 'Grassland', description: 'Plains and fields' },
  { type: 'forest', label: 'Forest', description: 'Dense trees' },
  { type: 'mountain', label: 'Mountain', description: 'Rocky highlands' },
  { type: 'snow', label: 'Snow/Ice', description: 'Glacial peaks' }
];

// ---------------- Drawing primitives -----------------
function drawTile(ctx, x, y, s, tile) {
  // tile: { type, elevation (0-1), moisture (0-1), region }
  const t = tile.type;
  ctx.save();
  ctx.translate(x, y);
  // base
  if (t === 'water') {
    // layered blue waves
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#7ec6f2');
    g.addColorStop(1, '#2b7fb2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // waves
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = Math.max(1, s * 0.06);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, s * (0.25 + i * 0.2));
      ctx.quadraticCurveTo(s * 0.5, s * (0.1 + i * 0.2), s, s * (0.25 + i * 0.2));
      ctx.stroke();
    }
  } else if (t === 'sand') {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#f6e7b4');
    g.addColorStop(1, '#e0c57a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // small grains
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for (let i = 0; i < Math.max(6, s); i++) {
      const rx = Math.random() * s;
      const ry = Math.random() * s;
      ctx.fillRect(rx, ry, 1, 1);
    }
  } else if (t === 'grass') {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#9bd77e');
    g.addColorStop(1, '#3b8a2f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // small blades
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * Math.random(), s * Math.random());
      ctx.lineTo(s * Math.random(), s * Math.random());
      ctx.stroke();
    }
  } else if (t === 'forest') {
    // base grass
    ctx.fillStyle = '#3a7a30';
    ctx.fillRect(0, 0, s, s);
    // draw tree circles
    const treeCount = Math.max(1, Math.floor(s / 8));
    for (let i = 0; i < treeCount; i++) {
      const rx = s * (0.15 + Math.random() * 0.7);
      const ry = s * (0.15 + Math.random() * 0.7);
      const r = Math.max(2, s * 0.14);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(10,40,10,0.9)';
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (t === 'mountain') {
    // rocky gradient
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#cfcfcf');
    g.addColorStop(1, '#7a6f61');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // peaks
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(s * 0.1, s * 0.9);
    ctx.lineTo(s * 0.5, s * 0.2);
    ctx.lineTo(s * 0.9, s * 0.9);
    ctx.closePath();
    ctx.fill();
  } else if (t === 'snow') {
    ctx.fillStyle = '#eaf6ff';
    ctx.fillRect(0, 0, s, s);
    // rocky hints
    ctx.fillStyle = '#d0e4ef';
    ctx.fillRect(s * 0.1, s * 0.5, s * 0.8, s * 0.3);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);
  }

  // small region marker label
  if (tile.region) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.font = `${Math.max(8, s * 0.12)}px sans-serif`;
    ctx.fillText(tile.region.substr(0, 2), 4, Math.min(s - 4, 12));
  }

  ctx.restore();
}

function drawPlayer(ctx, x, y, tilePx) {
  ctx.save();
  ctx.translate(x, y);
  const pad = Math.max(2, tilePx * 0.1);
  const size = tilePx - pad * 2;
  // shadow
  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.ellipse(x + tilePx / 2, y + tilePx - pad, size * 0.35, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.fillStyle = '#ff4f4f';
  ctx.arc(x + tilePx / 2, y + tilePx / 2, size * 0.28, 0, Math.PI * 2);
  ctx.fill();
  // head marker
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.max(8, tilePx * 0.18)}px sans-serif`;
  ctx.fillText('⦿', x + tilePx / 2 - size * 0.16, y + tilePx / 2 + size * 0.16);
  ctx.restore();
}

// ---------------- Map generation (simple seeded blobs, deterministic)
function generateMap(w, h) {
  // seed from fixed number for deterministic layout
  const seed = 1337;
  const rng = mulberry32(seed);

  // create base elevation + moisture grids
  const elev = Array.from({ length: h }, () => Array.from({ length: w }, () => rng() * 1));
  const moist = Array.from({ length: h }, () => Array.from({ length: w }, () => rng() * 1));

  // create region centers (blobs)
  const regions = [];
  const regionNames = ['Land of Fire', 'Land of Water', 'Land of Wind', 'Land of Earth', 'Land of Lightning', 'Land of Rivers', 'Land of Snow'];
  for (let i = 0; i < 12; i++) {
    regions.push({
      x: Math.floor(rng() * w),
      y: Math.floor(rng() * h),
      name: regionNames[i % regionNames.length]
    });
  }

  // disturb grids with blobs
  for (let r of regions) {
    const radius = Math.floor(6 + rng() * 12);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = r.x + dx;
        const y = r.y + dy;
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const d = Math.sqrt(dx * dx + dy * dy) / radius;
        const fall = Math.max(0, 1 - d);
        elev[y][x] += (0.2 + rng() * 0.6) * fall;
        moist[y][x] += (0.1 + rng() * 0.8) * fall;
      }
    }
  }

  // normalize and assign tile types
  const data = [];
  for (let y = 0; y < h; y++) {
    data[y] = [];
    for (let x = 0; x < w; x++) {
      const e = clamp(elev[y][x], 0, 1);
      const m = clamp(moist[y][x], 0, 1);
      let type = 'grass';
      if (e < 0.2 && m > 0.3) type = 'water';
      else if (e < 0.25) type = 'sand';
      else if (e > 0.75) type = 'mountain';
      else if (e > 0.6 && m > 0.4) type = 'forest';
      if (e > 0.85 && y < h * 0.2) type = 'snow';

      // compute nearest region
      let best = null;
      for (let r of regions) {
        const d = Math.hypot(r.x - x, r.y - y);
        if (!best || d < best.d) best = { d, r };
      }
      const region = best.r.name + (best.d < 8 ? ' •' : '');

      data[y][x] = { type, elevation: e, moisture: m, region };
    }
  }
  return data;
}

// ---------------- Utilities -----------------
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lookupRegionName(map, x, y) {
  return (map[y] && map[y][x] && map[y][x].region) || 'Unknown Region';
}

// deterministic RNG
function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { NarutoMapApp };