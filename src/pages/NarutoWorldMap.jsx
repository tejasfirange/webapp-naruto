import React, { useEffect, useRef, useState } from "react";
import "./NarutoWorldMap.css";

/**
 * NarutoWorldMap (dual-layer) - React component
 * GRID_SIZE: 1000 x 1000 logical tiles
 *
 * How it works (summary):
 * - Loads the full reference image (village_map.jpg).
 * - For each frame, calculates how many logical tiles fit in viewport given tileDisplayPx and zoom.
 * - Computes a source rectangle in the image (in image pixels) centered around the player.
 * - drawImage that source rect stretched to the viewport (so the base texture is crisp/readable).
 * - Draw a grid overlay on top (tile borders) using tileDisplayPx * zoom spacing.
 * - Player marker is always drawn centered.
 * - Minimap draws whole image scaled + a yellow viewport rect.
 */

export default function NarutoWorldMap() {
  const IMAGE_PATH = "/village_map.jpg";
  const GRID_SIZE = 1000;
  const BASE_TILE_PX = 6; // base visual size for 1 tile at zoom=1 (tweakable)
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 4;

  const canvasRef = useRef(null);
  const miniRef = useRef(null);
  const imgRef = useRef(null);
  const rafRef = useRef(null);

  const [loaded, setLoaded] = useState(false);
  const [player, setPlayer] = useState({ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) });
  const [zoom, setZoom] = useState(1);
  const [tilePx, setTilePx] = useState(BASE_TILE_PX); // displayed tile size (before zoom)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = IMAGE_PATH + "?_=" + Date.now();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.width, h: img.height });
      setLoaded(true);
      // initial draw
      requestAnimationFrame(drawFrame);
      drawMinimap(img);
    };
    img.onerror = (e) => {
      console.error("Failed to load image", e);
    };
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update tilePx when zoom changes
  useEffect(() => {
    setTilePx(Math.max(2, Math.round(BASE_TILE_PX)));
    // we use zoom to scale on-screen tile spacing; tilePx constant base
    requestAnimationFrame(drawFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // keyboard controls (single-tile moves)
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) move(0, -1);
      if (["arrowdown", "s"].includes(k)) move(0, 1);
      if (["arrowleft", "a"].includes(k)) move(-1, 0);
      if (["arrowright", "d"].includes(k)) move(1, 0);
      if (k === "-" ) setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)));
      if (k === "=" || k === "+") setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // wheel zoom on canvas
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey) return; // avoid interfering with browser zoom
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(3))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // handle resize
  useEffect(() => {
    const r = () => {
      if (!loaded) return;
      drawFrame();
      drawMinimap(imgRef.current);
    };
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [loaded, zoom, player]);

  // move function (1 tile)
  function move(dx, dy) {
    setPlayer((p) => {
      const nx = Math.max(0, Math.min(GRID_SIZE - 1, p.x + dx));
      const ny = Math.max(0, Math.min(GRID_SIZE - 1, p.y + dy));
      if (nx === p.x && ny === p.y) return p;
      const np = { x: nx, y: ny };
      // draw immediately
      requestAnimationFrame(() => {
        drawFrame(np);
        drawMinimap(imgRef.current, np);
      });
      return np;
    });
  }

  // UI arrow handlers
  function handleArrow(dx, dy) {
    move(dx, dy);
  }

  // core draw function
  function drawFrame(forPlayer) {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const p = forPlayer || player;
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;

    // choose viewport size responsive (we keep it within window but not full width to allow sidebar)
    const vw = Math.max(320, Math.min(window.innerWidth * 0.78, 1200));
    const vh = Math.max(240, Math.min(window.innerHeight * 0.86, 800));
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.clearRect(0, 0, vw, vh);

    // Determine visible tile count based on base tilePx and zoom
    const displayTilePx = tilePx * zoom; // final pixel size for a single logical tile on screen
    const tilesAcross = vw / displayTilePx;
    const tilesDown = vh / displayTilePx;

    // source width/height in image pixels (how many image pixels correspond to visible tiles)
    const pxPerTileInImageX = img.width / GRID_SIZE;
    const pxPerTileInImageY = img.height / GRID_SIZE;

    const numTilesX = tilesAcross;
    const numTilesY = tilesDown;

    const srcW = numTilesX * pxPerTileInImageX;
    const srcH = numTilesY * pxPerTileInImageY;

    // center in image pixels on player tile center
    const centerX_img = (p.x + 0.5) * pxPerTileInImageX;
    const centerY_img = (p.y + 0.5) * pxPerTileInImageY;

    let srcX = Math.round(centerX_img - srcW / 2);
    let srcY = Math.round(centerY_img - srcH / 2);

    // clamp to image bounds
    if (srcX < 0) srcX = 0;
    if (srcY < 0) srcY = 0;
    if (srcX + srcW > img.width) srcX = Math.max(0, img.width - srcW);
    if (srcY + srcH > img.height) srcY = Math.max(0, img.height - srcH);

    // draw that source rect stretched to viewport
    ctx.imageSmoothingEnabled = false; // avoid smoothing — but the visible image will still be crisp
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, vw, vh);

    // overlay: subtle dim to help UI
    // ctx.fillStyle = 'rgba(0,0,0,0.03)'; ctx.fillRect(0,0,vw,vh);

    // draw grid overlay lines for tile borders
    ctx.save();
    ctx.lineWidth = Math.max(1, Math.ceil(displayTilePx * 0.06));
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    // compute pixel offset where the first tile starts on-screen
    const startTileX = Math.floor((srcX / pxPerTileInImageX)); // which tile index is leftmost
    const startTileY = Math.floor((srcY / pxPerTileInImageY)); // topmost tile index
    // offset in pixels inside viewport for first tile
    const offsetX = -((srcX / pxPerTileInImageX) - startTileX) * displayTilePx;
    const offsetY = -((srcY / pxPerTileInImageY) - startTileY) * displayTilePx;

    // vertical lines
    const cols = Math.ceil(vw / displayTilePx) + 2;
    for (let i = 0; i <= cols; i++) {
      const x = offsetX + i * displayTilePx + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, vh);
      ctx.stroke();
    }
    // horizontal lines
    const rows = Math.ceil(vh / displayTilePx) + 2;
    for (let j = 0; j <= rows; j++) {
      const y = offsetY + j * displayTilePx + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
      ctx.stroke();
    }
    ctx.restore();

    // draw player marker centered
    const centerX = Math.round(vw / 2);
    const centerY = Math.round(vh / 2);
    ctx.beginPath();
    ctx.fillStyle = "#ff4b4b";
    ctx.arc(centerX, centerY, Math.max(4, Math.round(displayTilePx * 0.35)), 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // coordinates label bottom-left
    ctx.font = "13px Inter, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`x:${p.x} y:${p.y}  zoom:${Math.round(zoom*100)/100}`, 8, vh - 10);
  }

  // draw minimap (full image scaled to small canvas)
  function drawMinimap(img = imgRef.current, forPlayer = player) {
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

    // draw viewport rect
    const vw = parseFloat(canvasRef.current.style.width) || Math.min(window.innerWidth * 0.78, 1200);
    const vh = parseFloat(canvasRef.current.style.height) || Math.min(window.innerHeight * 0.86, 800);
    const displayTilePx = tilePx * zoom;
    const tilesAcross = vw / displayTilePx;
    const tilesDown = vh / displayTilePx;

    const startX_tile = forPlayer.x - tilesAcross/2;
    const startY_tile = forPlayer.y - tilesDown/2;
    const sx = (startX_tile / GRID_SIZE) * size;
    const sy = (startY_tile / GRID_SIZE) * size;
    const sw = (tilesAcross / GRID_SIZE) * size;
    const sh = (tilesDown / GRID_SIZE) * size;

    ctx.strokeStyle = "rgba(255,235,59,0.95)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 0.5, sy + 0.5, Math.max(2, sw), Math.max(2, sh));
  }

  // expose zoom controls quickly
  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)));
    requestAnimationFrame(() => drawFrame());
    requestAnimationFrame(() => drawMinimap());
  }
  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)));
    requestAnimationFrame(() => drawFrame());
    requestAnimationFrame(() => drawMinimap());
  }

  // request redraw when loaded/player/zoom changes
  useEffect(() => {
    if (!loaded) return;
    // cancel previous rAF
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawFrame();
      drawMinimap();
    });
    return () => {};
  }, [loaded, player, zoom]);

  // clean up RAF
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="naruto-map-root">
      <div className="naruto-map-left">
        <div className="viewport-wrap">
          <canvas ref={canvasRef} className="main-canvas" />
          <div className="controls-bottom-centered">
            <div className="arrow-grid">
              <button className="arrow" onPointerDown={() => handleArrow(0, -1)}>▲</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="arrow" onPointerDown={() => handleArrow(-1, 0)}>◀</button>
                <button className="arrow" onPointerDown={() => handleArrow(1, 0)}>▶</button>
              </div>
              <button className="arrow" onPointerDown={() => handleArrow(0, 1)}>▼</button>
            </div>
          </div>
        </div>

        <div className="mini-zoom-row">
          <button onClick={zoomOut}>-</button>
          <div className="zoom-label">Zoom {Math.round(zoom * 100) / 100}</div>
          <button onClick={zoomIn}>+</button>
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
            <div style={{ color: "#d7e8ff" }}>WASD / Arrows = move 1 tile</div>
            <div style={{ color: "#d7e8ff" }}>Mouse wheel = zoom</div>
            <div style={{ color: "#d7e8ff" }}>Use on-screen arrows for touch</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
