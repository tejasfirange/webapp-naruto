import React, { useEffect, useRef, useState } from "react";
import "./NarutoWorldMap.css";

/**
 * NarutoWorldMap.jsx
 * - GRID_SIZE = 500 (500x500 tiles)
 * - Player moves by tile, holds repeat at 100ms
 * - Zoom fixed so player tile -> screen mapping stable (no drift)
 * - Chunk overlay toggle (16x16)
 *
 * Put your reference image at: public/village_map.jpg
 */

export default function NarutoWorldMap() {
  const IMAGE_PATH = "/village_map.jpg";
  const GRID_SIZE = 500;
  const BASE_TILE_PX = 6;    // base tile display size (zoom=1)
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 4;
  const HOLD_INTERVAL_MS = 100;
  const CHUNK_SIZE = 16;

  const canvasRef = useRef(null);
  const miniRef = useRef(null);
  const imgRef = useRef(null);

  // state
  const [loaded, setLoaded] = useState(false);
  const [player, setPlayer] = useState({ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) });
  const [zoom, setZoom] = useState(1);
  const [chunkOverlay, setChunkOverlay] = useState(false);

  // hold-to-move control
  const holdRef = useRef({ dir: null, timer: null });

  // load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = IMAGE_PATH + "?_=" + Date.now();
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
      drawAll(img, player, zoom, chunkOverlay);
      drawMinimap(img, player, zoom);
    };
    img.onerror = (e) => {
      console.error("Failed to load map image:", e);
    };
  }, []); // run once

  // keyboard hold-to-move
  useEffect(() => {
    const keyToDir = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      s: [0, 1],
      a: [-1, 0],
      d: [1, 0],
    };

    function performMoveFromDir(dir) {
      if (!dir) return;
      move(dir[0], dir[1]);
    }

    function startHold(dir) {
      // single step
      performMoveFromDir(dir);
      // set repeating timer
      if (holdRef.current.timer) clearInterval(holdRef.current.timer);
      holdRef.current.dir = dir;
      holdRef.current.timer = setInterval(() => performMoveFromDir(dir), HOLD_INTERVAL_MS);
    }
    function stopHold() {
      if (holdRef.current.timer) {
        clearInterval(holdRef.current.timer);
        holdRef.current.timer = null;
      }
      holdRef.current.dir = null;
    }

    const onKeyDown = (e) => {
      const key = e.key;
      if (key === "+" || key === "=") { setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2))); return; }
      if (key === "-") { setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2))); return; }
      const dir = keyToDir[key] || keyToDir[key?.toLowerCase()];
      if (dir) {
        // if key repeat (holding physical key) browser will emit multiple keydown events;
        // only start hold on first. We'll detect with holdRef.dir.
        if (!holdRef.current.dir) startHold(dir);
      }
    };
    const onKeyUp = (e) => {
      const key = e.key;
      const dir = keyToDir[key] || keyToDir[key?.toLowerCase()];
      if (dir) stopHold();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      stopHold();
    };
  }, []);

  // pointer (touch) hold for on-screen arrows - start/stop handled via onPointerDown/onPointerUp in UI

  // wheel zoom on canvas
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const wheel = (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(3))));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  // when player/zoom/chunkOverlay changes, redraw
  useEffect(() => {
    if (!loaded) return;
    drawAll(imgRef.current, player, zoom, chunkOverlay);
    drawMinimap(imgRef.current, player, zoom);
  }, [player, zoom, chunkOverlay, loaded]);

  // move helper: ensures player within bounds; draws next frame
  function move(dx, dy) {
    setPlayer((p) => {
      const nx = Math.max(0, Math.min(GRID_SIZE - 1, p.x + dx));
      const ny = Math.max(0, Math.min(GRID_SIZE - 1, p.y + dy));
      if (nx === p.x && ny === p.y) return p;
      const np = { x: nx, y: ny };
      // immediate draw to feel responsive
      if (loaded) {
        drawAll(imgRef.current, np, zoom, chunkOverlay);
        drawMinimap(imgRef.current, np, zoom);
      }
      return np;
    });
  }

  // pointer (touch) arrow handlers start/stop repeat
  const startPointerHold = (dx, dy) => {
    // single move + start interval
    move(dx, dy);
    if (holdRef.current.timer) clearInterval(holdRef.current.timer);
    holdRef.current.dir = [dx, dy];
    holdRef.current.timer = setInterval(() => move(dx, dy), HOLD_INTERVAL_MS);
  };
  const stopPointerHold = () => {
    if (holdRef.current.timer) {
      clearInterval(holdRef.current.timer);
      holdRef.current.timer = null;
    }
    holdRef.current.dir = null;
  };

  // chunk toggle button styling handled in CSS; toggles chunkOverlay
  const toggleChunks = () => setChunkOverlay((s) => !s);

  // draw everything: viewport (texture) + grid overlay + chunk overlay + player marker
  function drawAll(img, p, z, showChunks) {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;

    // viewport CSS size (leave space for sidebar)
    const vw = Math.max(320, Math.min(window.innerWidth * 0.78, 1200));
    const vh = Math.max(240, Math.min(window.innerHeight * 0.86, 800));
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.clearRect(0, 0, vw, vh);

    // determine how many tiles fit and mapping between image pixels and grid tiles
    const displayTilePx = BASE_TILE_PX * z; // how many screen pixels represent one logical tile
    const tilesAcross = vw / displayTilePx;
    const tilesDown = vh / displayTilePx;

    // image pixels per tile
    const pxPerTileX = img.width / GRID_SIZE;
    const pxPerTileY = img.height / GRID_SIZE;

    // compute source rect in image pixels centered on player's tile
    const srcW = tilesAcross * pxPerTileX;
    const srcH = tilesDown * pxPerTileY;
    const centerImgX = (p.x + 0.5) * pxPerTileX;
    const centerImgY = (p.y + 0.5) * pxPerTileY;

    let srcX = Math.round(centerImgX - srcW / 2);
    let srcY = Math.round(centerImgY - srcH / 2);

    // clamp to image bounds to avoid reading outside
    if (srcX < 0) srcX = 0;
    if (srcY < 0) srcY = 0;
    if (srcX + srcW > img.width) srcX = Math.max(0, img.width - srcW);
    if (srcY + srcH > img.height) srcY = Math.max(0, img.height - srcH);

    // draw the source rect stretched exactly to viewport
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, vw, vh);

    // compute which tile index is at viewport top-left (floating)
    const topLeftTileXFloat = srcX / pxPerTileX;
    const topLeftTileYFloat = srcY / pxPerTileY;

    // compute offset of top-left tile in screen pixels (could be fractional)
    const offsetX = -(topLeftTileXFloat - Math.floor(topLeftTileXFloat)) * displayTilePx;
    const offsetY = -(topLeftTileYFloat - Math.floor(topLeftTileYFloat)) * displayTilePx;

    // draw grid overlay (thin lines)
    ctx.save();
    ctx.lineWidth = Math.max(1, Math.round(displayTilePx * 0.06));
    ctx.strokeStyle = "rgba(0,0,0,0.35)";

    const cols = Math.ceil(vw / displayTilePx) + 2;
    for (let i = 0; i <= cols; i++) {
      const x = offsetX + i * displayTilePx + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, vh);
      ctx.stroke();
    }
    const rows = Math.ceil(vh / displayTilePx) + 2;
    for (let j = 0; j <= rows; j++) {
      const y = offsetY + j * displayTilePx + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
      ctx.stroke();
    }
    ctx.restore();

    // chunk overlay (16x16)
    if (showChunks) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,165,0,0.55)"; // orange-ish
      ctx.lineWidth = Math.max(1, Math.round(displayTilePx * 0.08));
      const chunkTilePx = displayTilePx * CHUNK_SIZE;
      // determine first chunk offset relative to top-left
      // find top-left chunk tile coordinate
      const topChunkX = Math.floor(topLeftTileXFloat / CHUNK_SIZE);
      const topChunkY = Math.floor(topLeftTileYFloat / CHUNK_SIZE);

      // draw chunk vertical lines
      const chunksAcross = Math.ceil((cols + 2) / CHUNK_SIZE) + 4;
      const chunksDown = Math.ceil((rows + 2) / CHUNK_SIZE) + 4;
      for (let cx = -2; cx < chunksAcross; cx++) {
        const x = offsetX + (cx * CHUNK_SIZE) * displayTilePx + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, vh);
        ctx.stroke();
      }
      for (let cy = -2; cy < chunksDown; cy++) {
        const y = offsetY + (cy * CHUNK_SIZE) * displayTilePx + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(vw, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // player screen coordinates: compute player's position relative to top-left tile
    const playerScreenX = Math.round((p.x - topLeftTileXFloat + 0.5) * displayTilePx);
    const playerScreenY = Math.round((p.y - topLeftTileYFloat + 0.5) * displayTilePx);

    // draw player at computed position
    ctx.beginPath();
    ctx.fillStyle = "#ff4b4b";
    const r = Math.max(4, Math.round(displayTilePx * 0.35));
    ctx.arc(playerScreenX, playerScreenY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // coords overlay
    ctx.font = "13px Inter, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(`x:${p.x} y:${p.y}  zoom:${Math.round(z * 100) / 100}`, 8, vh - 10);
  }

  // minimap rendering
  function drawMinimap(img, p, z = zoom) {
    const mini = miniRef.current;
    if (!mini || !img) return;
    const ctx = mini.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    const size = 180;
    mini.width = Math.floor(size * DPR);
    mini.height = Math.floor(size * DPR);
    mini.style.width = `${size}px`;
    mini.style.height = `${size}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, size, size);

    // compute viewport rect on minimap
    const vw = parseFloat(canvasRef.current.style.width) || Math.min(window.innerWidth * 0.78, 1200);
    const vh = parseFloat(canvasRef.current.style.height) || Math.min(window.innerHeight * 0.86, 800);
    const displayTilePx = BASE_TILE_PX * z;
    const tilesAcross = vw / displayTilePx;
    const tilesDown = vh / displayTilePx;

    const startTileX = p.x - tilesAcross / 2;
    const startTileY = p.y - tilesDown / 2;
    const sx = (startTileX / GRID_SIZE) * size;
    const sy = (startTileY / GRID_SIZE) * size;
    const sw = (tilesAcross / GRID_SIZE) * size;
    const sh = (tilesDown / GRID_SIZE) * size;

    ctx.strokeStyle = "rgba(255,235,59,0.95)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 0.5, sy + 0.5, Math.max(2, sw), Math.max(2, sh));
  }

  // UI handlers
  function onArrowDown(dx, dy) {
    startPointerHold(dx, dy);
  }
  function onArrowUp() {
    stopPointerHold();
  }

  return (
    <div className="naruto-map-root">
      <div className="naruto-map-left">
        <div className="viewport-wrap">
          <canvas ref={canvasRef} className="main-canvas" />
          <div className="top-right-ui">
            <button className="chunk-btn" onClick={toggleChunks}>
              {chunkOverlay ? "Hide Chunks" : "Show Chunks"}
            </button>
          </div>

          <div className="controls-bottom-centered" onPointerUp={onArrowUp} onPointerCancel={onArrowUp}>
            <div className="arrow-grid">
              <button className="arrow" onPointerDown={() => onArrowDown(0, -1)} onPointerUp={onArrowUp}>▲</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="arrow" onPointerDown={() => onArrowDown(-1, 0)} onPointerUp={onArrowUp}>◀</button>
                <button className="arrow" onPointerDown={() => onArrowDown(1, 0)} onPointerUp={onArrowUp}>▶</button>
              </div>
              <button className="arrow" onPointerDown={() => onArrowDown(0, 1)} onPointerUp={onArrowUp}>▼</button>
            </div>
          </div>
        </div>

        <div className="mini-zoom-row">
          <button onClick={() => { setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2))); }}>-</button>
          <div className="zoom-label">Zoom {Math.round(zoom * 100) / 100}</div>
          <button onClick={() => { setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2))); }}>+</button>
          <div style={{ width: 12 }} />
          <div className="coords">x:{player.x} y:{player.y}</div>
        </div>
      </div>

      <aside className="naruto-sidebar">
        <h3>Mini map</h3>
        <canvas ref={miniRef} className="mini-canvas" />
        <div style={{ height: 12 }} />
        <div className="legend">
          <div className="legend-title">Controls</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <div style={{ color: "#d7e8ff" }}>WASD / Arrows = move 1 tile (hold to repeat)</div>
            <div style={{ color: "#d7e8ff" }}>Mouse wheel = zoom</div>
            <div style={{ color: "#d7e8ff" }}>Chunks = 16×16 toggle</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
