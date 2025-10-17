import React, { useEffect, useRef, useState } from "react";
import "./NarutoWorldMap.css";

/**
 * NarutoWorldMap.jsx
 * - GRID_SIZE = 500 (500x500)
 * - Loads /village_map.jpg from public/
 * - Pixel-accurate downsample (imageSmoothingEnabled = false)
 * - Player-centered viewport, 1-tile movement
 */

export default function NarutoWorldMap() {
  const IMAGE_PATH = "/village_map.jpg";
  const GRID_SIZE = 500; // 500 x 500 tiles
  const BASE_TILE_PX = 8; // base pixel size per tile (zoom=1). adjust for viewport scale
  const MIN_TILE_PX = 2;

  const mainCanvasRef = useRef(null);
  const miniCanvasRef = useRef(null);
  const tilesRef = useRef(null); // Uint32Array of packed RGB (no alpha)
  const colorMapRef = useRef(new Map()); // packed->cssColor
  const [loaded, setLoaded] = useState(false);

  const [player, setPlayer] = useState({
    x: Math.floor(GRID_SIZE / 2),
    y: Math.floor(GRID_SIZE / 2),
  });
  const [zoom, setZoom] = useState(1); // zoom multiplier (1 = BASE_TILE_PX)
  const [tilePx, setTilePx] = useState(BASE_TILE_PX);

  // --- Helpers for packing/unpacking colors ---
  const pack = (r, g, b) => (r << 16) | (g << 8) | b;
  const toHex = (p) => "#" + ((p >>> 0).toString(16).padStart(6, "0"));

  // --- Load and sample image into GRID_SIZE x GRID_SIZE ---
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = IMAGE_PATH + "?_=" + Date.now();

    img.onload = () => {
      if (cancelled) return;
      // offscreen canvas sized to GRID_SIZE to sample exact pixels
      const oc = document.createElement("canvas");
      oc.width = GRID_SIZE;
      oc.height = GRID_SIZE;
      const octx = oc.getContext("2d");
      // Turn off smoothing for pixel-perfect downsample
      octx.imageSmoothingEnabled = false;
      octx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);

      const imgd = octx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
      const data = imgd.data;

      const tiles = new Uint32Array(GRID_SIZE * GRID_SIZE);
      const colorMap = new Map();

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const i = (y * GRID_SIZE + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const packed = pack(r, g, b);
          tiles[y * GRID_SIZE + x] = packed;
          if (!colorMap.has(packed)) colorMap.set(packed, toHex(packed));
        }
      }

      tilesRef.current = tiles;
      colorMapRef.current = colorMap;
      setLoaded(true);

      // draw initial frames
      requestAnimationFrame(() => {
        drawMain();
        drawMinimap();
      });
    };

    img.onerror = (err) => {
      console.error("Failed to load map image:", err);
    };

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- adjust tile pixel size when zoom changes ---
  useEffect(() => {
    const px = Math.max(MIN_TILE_PX, Math.round(BASE_TILE_PX * zoom));
    setTilePx(px);
  }, [zoom]);

  // --- keyboard controls (1 tile per keypress) ---
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) move(0, -1);
      if (["arrowdown", "s"].includes(k)) move(0, 1);
      if (["arrowleft", "a"].includes(k)) move(-1, 0);
      if (["arrowright", "d"].includes(k)) move(1, 0);
      if (k === "+") setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)));
      if (k === "-") setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, zoom]);

  // wheel zoom (ctrl+wheel allow browser zoom, so we just use wheel)
  useEffect(() => {
    const el = mainCanvasRef.current;
    if (!el) return;
    const wheel = (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => Math.max(0.2, Math.min(4, +(z + delta).toFixed(2))));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  // Re-draw whenever player or tilePx or loaded changes
  useEffect(() => {
    if (!loaded) return;
    drawMain();
    drawMinimap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, tilePx, loaded]);

  // --- movement function (single tile) ---
  function move(dx, dy) {
    setPlayer((p) => {
      const nx = Math.max(0, Math.min(GRID_SIZE - 1, p.x + dx));
      const ny = Math.max(0, Math.min(GRID_SIZE - 1, p.y + dy));
      // only update if changed (prevents re-rendering unnecessarily)
      if (nx === p.x && ny === p.y) return p;
      return { x: nx, y: ny };
    });
  }

  // --- Draw main viewport centered on player ---
  function drawMain() {
    const canvas = mainCanvasRef.current;
    const tiles = tilesRef.current;
    const colorMap = colorMapRef.current;
    if (!canvas || !tiles) return;
    const ctx = canvas.getContext("2d");

    // viewport size uses a responsive full-window area (leaving room for UI)
    const vw = Math.max(320, Math.min(window.innerWidth * 0.86, 1000));
    const vh = Math.max(240, Math.min(window.innerHeight * 0.86, 800));
    const DPR = window.devicePixelRatio || 1;
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.clearRect(0, 0, vw, vh);
    // background
    ctx.fillStyle = "#071018";
    ctx.fillRect(0, 0, vw, vh);

    // compute visible tile extents
    const t = tilePx;
    const halfX = Math.ceil(vw / (2 * t));
    const halfY = Math.ceil(vh / (2 * t));

    const startX = clamp(player.x - halfX, 0, GRID_SIZE - 1);
    const startY = clamp(player.y - halfY, 0, GRID_SIZE - 1);
    const endX = clamp(player.x + halfX, 0, GRID_SIZE - 1);
    const endY = clamp(player.y + halfY, 0, GRID_SIZE - 1);

    const offsetX = Math.floor((vw / 2) - (player.x - startX) * t - t / 2);
    const offsetY = Math.floor((vh / 2) - (player.y - startY) * t - t / 2);

    // draw only visible tiles
    for (let yy = startY; yy <= endY; yy++) {
      const rowIndex = yy * GRID_SIZE;
      const sy = offsetY + (yy - startY) * t;
      for (let xx = startX; xx <= endX; xx++) {
        const packed = tiles[rowIndex + xx];
        const color = colorMap.get(packed) || "#6bb76d";
        const sx = offsetX + (xx - startX) * t;
        ctx.fillStyle = color;
        ctx.fillRect(sx + 0.5, sy + 0.5, t - 1, t - 1);

        // slight inner shade to avoid flat look
        if (t > 4) {
          ctx.fillStyle = "rgba(0,0,0,0.06)";
          ctx.fillRect(sx + 0.5, sy + t - Math.max(1, Math.floor(t * 0.12)), t - 1, Math.max(1, Math.floor(t * 0.12)));
        }
      }
    }

    // draw player (center)
    const cx = Math.floor(vw / 2);
    const cy = Math.floor(vh / 2);
    ctx.beginPath();
    ctx.fillStyle = "#ff3b3b";
    ctx.arc(cx, cy, Math.max(4, Math.floor(t * 0.35)), 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // draw small coordinate overlay
    ctx.font = "12px Inter, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`x:${player.x} y:${player.y}`, 8, vh - 10);
  }

  // --- Draw minimap (very small) ---
  function drawMinimap() {
    const mini = miniCanvasRef.current;
    const tiles = tilesRef.current;
    const colorMap = colorMapRef.current;
    if (!mini || !tiles) return;
    // square minimap with side 180 px (css), but use DPR for clarity
    const size = 180;
    const DPR = window.devicePixelRatio || 1;
    mini.width = Math.floor(size * DPR);
    mini.height = Math.floor(size * DPR);
    mini.style.width = `${size}px`;
    mini.style.height = `${size}px`;
    const ctx = mini.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.clearRect(0, 0, size, size);

    // sample step so we don't draw 500x500 pixels for minimap
    const step = Math.ceil(GRID_SIZE / size);
    const pixel = Math.max(1, Math.floor(size / (GRID_SIZE / step)));
    for (let y = 0; y < GRID_SIZE; y += step) {
      for (let x = 0; x < GRID_SIZE; x += step) {
        const packed = tiles[y * GRID_SIZE + x];
        const color = colorMap.get(packed) || "#6bb76d";
        const px = Math.floor((x / GRID_SIZE) * size);
        const py = Math.floor((y / GRID_SIZE) * size);
        ctx.fillStyle = color;
        ctx.fillRect(px, py, pixel + 0.5, pixel + 0.5);
      }
    }

    // draw viewport rect
    const main = mainCanvasRef.current;
    if (!main) return;
    const vw = parseFloat(main.style.width) || Math.min(window.innerWidth * 0.86, 1000);
    const vh = parseFloat(main.style.height) || Math.min(window.innerHeight * 0.86, 800);
    const t = tilePx;
    const halfX = Math.ceil(vw / (2 * t));
    const halfY = Math.ceil(vh / (2 * t));
    const startX = clamp(player.x - halfX, 0, GRID_SIZE - 1);
    const startY = clamp(player.y - halfY, 0, GRID_SIZE - 1);
    const endX = clamp(player.x + halfX, 0, GRID_SIZE - 1);
    const endY = clamp(player.y + halfY, 0, GRID_SIZE - 1);

    const sx = (startX / GRID_SIZE) * size;
    const sy = (startY / GRID_SIZE) * size;
    const sw = ((endX - startX) / GRID_SIZE) * size;
    const sh = ((endY - startY) / GRID_SIZE) * size;
    ctx.strokeStyle = "#ffeb3b";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, Math.max(2, sw), Math.max(2, sh));
  }

  // simple clamp
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // touch / UI arrow handlers (single tile)
  function handleArrow(dx, dy) {
    move(dx, dy);
  }

  // quick resize handler to update main canvas when window changes
  useEffect(() => {
    const onResize = () => {
      if (!loaded) return;
      drawMain();
      drawMinimap();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, tilePx]);

  // initial render hint
  useEffect(() => {
    if (!loaded) return;
    drawMain();
    drawMinimap();
  }, [loaded]);

  return (
    <div className="naruto-map-root">
      <div className="naruto-map-left">
        <div className="viewport-wrap">
          <canvas ref={mainCanvasRef} className="main-canvas" />
          <div className="controls-bottom-centered">
            <div className="arrow-grid">
              <button className="arrow" onClick={() => handleArrow(0, -1)}>▲</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="arrow" onClick={() => handleArrow(-1, 0)}>◀</button>
                <button className="arrow" onClick={() => handleArrow(1, 0)}>▶</button>
              </div>
              <button className="arrow" onClick={() => handleArrow(0, 1)}>▼</button>
            </div>
          </div>
        </div>

        <div className="mini-zoom-row">
          <button onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.2).toFixed(2)))}>-</button>
          <div className="zoom-label">Zoom {Math.round(zoom * 100) / 100}</div>
          <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}>+</button>

          <div style={{ width: 12 }} />

          <div className="coords">x:{player.x} y:{player.y}</div>
        </div>
      </div>

      <aside className="naruto-sidebar">
        <h3>Mini map</h3>
        <canvas ref={miniCanvasRef} className="mini-canvas" />
        <div style={{ height: 12 }} />
        <div className="legend">
          <div className="legend-title">Legend</div>
          <div className="legend-grid">
            {/* show top few palette values */}
            {[...colorMapRef.current.keys()].slice(0, 8).map((k) => {
              const hex = colorMapRef.current.get(k);
              return (
                <div key={k} className="legend-item">
                  <div className="legend-swatch" style={{ background: hex }} />
                  <div className="legend-label">{hex}</div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
