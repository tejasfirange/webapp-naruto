import React, { useEffect, useRef, useState } from "react";

export default function NarutoMapApp() {
  const canvasRef = useRef(null);

  // Map configuration
  const MAP_SIZE = 500; // tiles (500x500)
  const BASE_TILE = 16; // pixels per tile base
  const [zoom, setZoom] = useState(1);
  const [player, setPlayer] = useState({ x: 250, y: 250 });
  const [mapData] = useState(() => generateMap(MAP_SIZE));

  // Resize canvas to full window
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [zoom, player]);

  // Keyboard movement + zoom
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) move(0, -1);
      if (["arrowdown", "s"].includes(k)) move(0, 1);
      if (["arrowleft", "a"].includes(k)) move(-1, 0);
      if (["arrowright", "d"].includes(k)) move(1, 0);
      if (k === "+") setZoom((z) => Math.min(4, z + 0.1));
      if (k === "-") setZoom((z) => Math.max(0.5, z - 0.1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const move = (dx, dy) => {
    setPlayer((p) => ({
      x: Math.max(0, Math.min(MAP_SIZE - 1, p.x + dx)),
      y: Math.max(0, Math.min(MAP_SIZE - 1, p.y + dy)),
    }));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const tile = BASE_TILE * zoom;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const halfXTiles = Math.ceil(width / tile / 2);
    const halfYTiles = Math.ceil(height / tile / 2);

    // Start of visible region
    const startX = player.x - halfXTiles;
    const startY = player.y - halfYTiles;

    for (let y = 0; y <= halfYTiles * 2; y++) {
      for (let x = 0; x <= halfXTiles * 2; x++) {
        const mapX = Math.floor(startX + x);
        const mapY = Math.floor(startY + y);
        const screenX = x * tile;
        const screenY = y * tile;

        const tileType =
          mapData[mapY] && mapData[mapY][mapX]
            ? mapData[mapY][mapX]
            : "void";

        drawTile(ctx, screenX, screenY, tile, tileType);
      }
    }

    // Draw player at center
    drawPlayer(ctx, width / 2, height / 2, tile);
  };

  useEffect(() => {
    draw();
  }, [player, zoom]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", background: "#1a1a1a" }}
      />
    </div>
  );
}

// --- Tile textures ---
function drawTile(ctx, x, y, size, type) {
  ctx.save();
  ctx.translate(x, y);

  if (type === "water") {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#4ba3f2");
    g.addColorStop(1, "#015fa1");
    ctx.fillStyle = g;
  } else if (type === "sand") {
    ctx.fillStyle = "#e8d098";
  } else if (type === "grass") {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, "#6fd072");
    g.addColorStop(1, "#2f7a2e");
    ctx.fillStyle = g;
  } else if (type === "forest") {
    ctx.fillStyle = "#1b4d1b";
  } else if (type === "mountain") {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#ccc");
    g.addColorStop(1, "#5c4a3f");
    ctx.fillStyle = g;
  } else if (type === "snow") {
    ctx.fillStyle = "#f9f9f9";
  } else {
    ctx.fillStyle = "#000";
  }

  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawPlayer(ctx, x, y, tile) {
  const r = tile / 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ff3b3b";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

// --- Map generator ---
function generateMap(size) {
  const rng = mulberry32(12345);
  const map = [];
  for (let y = 0; y < size; y++) {
    map[y] = [];
    for (let x = 0; x < size; x++) {
      const noise = rng();
      let type = "grass";
      if (noise < 0.1) type = "water";
      else if (noise < 0.2) type = "sand";
      else if (noise < 0.4) type = "forest";
      else if (noise < 0.6) type = "mountain";
      else if (noise > 0.95) type = "snow";
      map[y][x] = type;
    }
  }
  return map;
}

function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
