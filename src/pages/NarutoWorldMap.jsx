import React, { useEffect, useRef, useState } from "react";
import "./NarutoWorldMap.css";

/**
 * NarutoWorldMap.jsx — improved:
 * - GRID_SIZE = 500
 * - chunk overlay world-aligned
 * - polygonal regions for detection (point-in-polygon)
 * - background edge fill sampled from image edges (prevents black bars)
 * - hold-to-move keyboard + touch (100ms)
 */

export default function NarutoWorldMap() {
  const IMAGE_PATH = "/village_map.jpg";
  const GRID_SIZE = 500;
  const BASE_TILE_PX = 6;
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 4;
  const HOLD_INTERVAL_MS = 100;
  const CHUNK_SIZE = 16;

  const canvasRef = useRef(null);
  const miniRef = useRef(null);
  const imgRef = useRef(null);
  const offscreenRef = useRef(null);

  const [loaded, setLoaded] = useState(false);
  const [player, setPlayer] = useState({ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) });
  const [zoom, setZoom] = useState(1);
  const [chunkOverlay, setChunkOverlay] = useState(true);
  const [regionName, setRegionName] = useState("");
  const regionTimerRef = useRef(null);

  // hold-to-move control
  const holdRef = useRef({ dir: null, timer: null });

  // --- polygonal region definitions (tile coordinates 0..499)
  // These are approximate polygons matching areas on the map. You can tweak vertices.
  const REGIONS = [
    {
      id: "land_fire",
      name: "Land of Fire",
      color: "rgba(230,130,90,0.06)",
      poly: [
        [170, 240], [260, 260], [320, 300], [300, 380], [220, 380], [180, 330], [160, 280]
      ],
    },
    {
      id: "land_wind",
      name: "Land of Wind",
      color: "rgba(220,170,70,0.06)",
      poly: [
        [10, 320], [110, 320], [120, 400], [20, 440]
      ],
    },
    {
      id: "land_water",
      name: "Land of Water",
      color: "rgba(80,150,200,0.05)",
      poly: [
        [330, 40], [420, 40], [480, 100], [480, 220], [380, 260], [340, 180]
      ],
    },
    {
      id: "land_earth",
      name: "Land of Earth",
      color: "rgba(200,160,110,0.05)",
      poly: [
        [90, 40], [170, 40], [200, 110], [140, 180], [100, 140]
      ],
    },
    {
      id: "land_lightning",
      name: "Land of Lightning",
      color: "rgba(220,230,255,0.05)",
      poly: [
        [370, 10], [460, 10], [490, 70], [420, 120], [370, 80]
      ],
    },
    {
      id: "land_snow",
      name: "Land of Snow",
      color: "rgba(245,245,255,0.06)",
      poly: [
        [320, 0], [380, 0], [400, 30], [340, 50]
      ],
    },
  ];

  // --- utility: point-in-polygon (ray-casting)
  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // --- load image & prepare offscreen sampling
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = IMAGE_PATH + "?_=" + Date.now();
    img.onload = () => {
      imgRef.current = img;
      // create small offscreen canvas for edge sampling
      const oc = document.createElement("canvas");
      oc.width = img.width;
      oc.height = img.height;
      const octx = oc.getContext("2d");
      octx.drawImage(img, 0, 0);
      offscreenRef.current = { canvas: oc, ctx: octx };
      setLoaded(true);
      drawAll(img, player, zoom, chunkOverlay);
      drawMinimap(img, player, zoom);
      updateRegionName(player);
    };
    img.onerror = (e) => console.error("image load failed", e);
  }, []); // one-time

  // --- keyboard hold-to-move
  useEffect(() => {
    const keyToDir = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
    };

    function performMove(dir) {
      if (!dir) return;
      doMove(dir[0], dir[1]);
    }

    function startHold(dir) {
      performMove(dir);
      if (holdRef.current.timer) clearInterval(holdRef.current.timer);
      holdRef.current.dir = dir;
      holdRef.current.timer = setInterval(() => performMove(dir), HOLD_INTERVAL_MS);
    }
    function stopHold() {
      if (holdRef.current.timer) { clearInterval(holdRef.current.timer); holdRef.current.timer = null; }
      holdRef.current.dir = null;
    }

    const onDown = (e) => {
      const key = e.key;
      if (key === "+" || key === "=") { setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2))); return; }
      if (key === "-") { setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2))); return; }
      const dir = keyToDir[key] || keyToDir[key?.toLowerCase()];
      if (dir && !holdRef.current.dir) startHold(dir);
    };
    const onUp = (e) => {
      const key = e.key;
      if (keyToDir[key] || keyToDir[key?.toLowerCase()]) stopHold();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); stopHold(); };
  }, []);

  // wheel zoom on canvas
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(3))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // redraw when state changes
  useEffect(() => {
    if (!loaded) return;
    drawAll(imgRef.current, player, zoom, chunkOverlay);
    drawMinimap(imgRef.current, player, zoom);
    updateRegionName(player);
  }, [player, zoom, chunkOverlay, loaded]);

  // move with clamping & camera logic (player always moves; camera center computed per draw)
  function doMove(dx, dy) {
    setPlayer((p) => {
      const nx = Math.max(0, Math.min(GRID_SIZE - 1, p.x + dx));
      const ny = Math.max(0, Math.min(GRID_SIZE - 1, p.y + dy));
      if (nx === p.x && ny === p.y) return p;
      const np = { x: nx, y: ny };
      // immediate visual update
      if (loaded) { drawAll(imgRef.current, np, zoom, chunkOverlay); drawMinimap(imgRef.current, np, zoom); updateRegionName(np); }
      return np;
    });
  }

  // pointer/touch hold handlers for on-screen arrows
  function startPointerHold(dx, dy) {
    doMove(dx, dy);
    if (holdRef.current.timer) clearInterval(holdRef.current.timer);
    holdRef.current.dir = [dx, dy];
    holdRef.current.timer = setInterval(() => doMove(dx, dy), HOLD_INTERVAL_MS);
  }
  function stopPointerHold() {
    if (holdRef.current.timer) { clearInterval(holdRef.current.timer); holdRef.current.timer = null; }
    holdRef.current.dir = null;
  }

  // region lookup and HUD
  function findRegionAt(tileX, tileY) {
    for (let r of REGIONS) if (pointInPoly(tileX, tileY, r.poly)) return r;
    return null;
  }
  function updateRegionName(p) {
    const r = findRegionAt(p.x, p.y);
    if (r) {
      setRegionName(r.name);
      if (regionTimerRef.current) clearTimeout(regionTimerRef.current);
      regionTimerRef.current = setTimeout(() => setRegionName(""), 2500);
    } else {
      setRegionName("");
    }
  }

  // sample edge color average to avoid black bars (samples left/ right/ top/ bottom centers and averages)
  function sampleEdgeFillColor(img, srcX, srcY, srcW, srcH) {
    const off = offscreenRef.current;
    if (!off) return "#071018";
    const ctx = off.ctx;
    const w = img.width, h = img.height;
    // get a few sample points (clamped)
    const sx = Math.max(0, Math.min(w - 1, Math.round(Math.max(0, Math.min(w - 1, srcX + srcW / 2)))));
    const sy = Math.max(0, Math.min(h - 1, Math.round(Math.max(0, Math.min(h - 1, srcY + srcH / 2)))));
    const px = Math.max(0, Math.min(w - 1, Math.round(srcX + 1)));
    const py = Math.max(0, Math.min(h - 1, Math.round(srcY + 1)));
    // sample four edge points
    const pts = [
      [Math.round(Math.max(0, Math.min(w - 1, srcX + 2))), Math.round(h / 2)],
      [Math.round(Math.max(0, Math.min(w - 1, srcX + srcW - 2))), Math.round(h / 2)],
      [Math.round(w / 2), Math.round(Math.max(0, Math.min(h - 1, srcY + 2)))],
      [Math.round(w / 2), Math.round(Math.max(0, Math.min(h - 1, srcY + srcH - 2)))],
      [sx, sy]
    ];
    let r = 0, g = 0, b = 0, c = 0;
    try {
      for (let [x, y] of pts) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        r += d[0]; g += d[1]; b += d[2]; c++;
      }
      r = Math.round(r / c); g = Math.round(g / c); b = Math.round(b / c);
      return `rgb(${r},${g},${b})`;
    } catch (e) {
      return "#071018";
    }
  }

  // draw everything
  function drawAll(img, p, z, showChunks) {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;

    // viewport
    const vw = Math.max(320, Math.min(window.innerWidth * 0.78, 1200));
    const vh = Math.max(240, Math.min(window.innerHeight * 0.86, 800));
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.clearRect(0, 0, vw, vh);

    const displayTilePx = BASE_TILE_PX * z;
    const tilesAcross = vw / displayTilePx;
    const tilesDown = vh / displayTilePx;

    const pxPerTileX = img.width / GRID_SIZE;
    const pxPerTileY = img.height / GRID_SIZE;

    const srcW = tilesAcross * pxPerTileX;
    const srcH = tilesDown * pxPerTileY;
    const centerImgX = (p.x + 0.5) * pxPerTileX;
    const centerImgY = (p.y + 0.5) * pxPerTileY;

    let srcX = Math.round(centerImgX - srcW / 2);
    let srcY = Math.round(centerImgY - srcH / 2);

    if (srcX < 0) srcX = 0;
    if (srcY < 0) srcY = 0;
    if (srcX + srcW > img.width) srcX = Math.max(0, img.width - srcW);
    if (srcY + srcH > img.height) srcY = Math.max(0, img.height - srcH);

    // fill background using sampled edge color to avoid black bars when clamped
    const bg = sampleEdgeFillColor(img, srcX, srcY, srcW, srcH);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, vw, vh);

    // draw image slice
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, vw, vh);

    // compute fractional tile index of top-left
    const topLeftTileXFloat = srcX / pxPerTileX;
    const topLeftTileYFloat = srcY / pxPerTileY;

    const offsetX = -(topLeftTileXFloat - Math.floor(topLeftTileXFloat)) * displayTilePx;
    const offsetY = -(topLeftTileYFloat - Math.floor(topLeftTileYFloat)) * displayTilePx;

    // thin grid overlay
    ctx.save();
    ctx.lineWidth = Math.max(1, Math.round(displayTilePx * 0.06));
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    const cols = Math.ceil(vw / displayTilePx) + 2;
    const rows = Math.ceil(vh / displayTilePx) + 2;
    for (let i = 0; i <= cols; i++) {
      const x = offsetX + i * displayTilePx + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, vh); ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = offsetY + j * displayTilePx + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(vw, y); ctx.stroke();
    }
    ctx.restore();

    // chunk overlay: WORLD-ALIGNED lines at multiples of CHUNK_SIZE
    if (showChunks) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,165,0,0.55)";
      ctx.lineWidth = Math.max(1, Math.round(displayTilePx * 0.08));
      // compute pixel position of world tile 0,0 relative to top-left viewport
      // worldTile0 at screen: (0 - topLeftTileXFloat) * displayTilePx + offsetX
      const worldToScreenX = (tileIndex) => offsetX + (tileIndex - Math.floor(topLeftTileXFloat)) * displayTilePx;
      const worldToScreenY = (tileIndex) => offsetY + (tileIndex - Math.floor(topLeftTileYFloat)) * displayTilePx;
      // draw vertical chunk lines at tile indices: 0, CHUNK_SIZE, 2*CHUNK_SIZE, ...
      const firstChunkIndex = Math.floor(Math.max(0, Math.floor(topLeftTileXFloat) / CHUNK_SIZE) - 2);
      const lastChunkIndex = Math.ceil(Math.min(GRID_SIZE, Math.ceil((Math.floor(topLeftTileXFloat) + cols) / CHUNK_SIZE)) + 2);
      for (let cx = Math.max(0, firstChunkIndex); cx <= lastChunkIndex; cx++) {
        const tileX = cx * CHUNK_SIZE;
        const sx = worldToScreenX(tileX) + 0.5;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, vh); ctx.stroke();
      }
      const firstChunkY = Math.floor(Math.max(0, Math.floor(topLeftTileYFloat) / CHUNK_SIZE) - 2);
      const lastChunkY = Math.ceil(Math.min(GRID_SIZE, Math.ceil((Math.floor(topLeftTileYFloat) + rows) / CHUNK_SIZE)) + 2);
      for (let cy = Math.max(0, firstChunkY); cy <= lastChunkY; cy++) {
        const tileY = cy * CHUNK_SIZE;
        const sy = worldToScreenY(tileY) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(vw, sy); ctx.stroke();
      }
      ctx.restore();
    }

    // draw region shading (subtle) behind top-left HUD if currently inside polygon(s)
    const currentRegions = REGIONS.filter(r => pointInPoly(p.x, p.y, r.poly));
    if (currentRegions.length) {
      ctx.save();
      for (const r of currentRegions) {
        // draw polygon in screen coordinates
        ctx.fillStyle = r.color;
        ctx.beginPath();
        for (let i = 0; i < r.poly.length; i++) {
          const tx = (r.poly[i][0] - topLeftTileXFloat + 0.5) * displayTilePx;
          const ty = (r.poly[i][1] - topLeftTileYFloat + 0.5) * displayTilePx;
          if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // compute player screen coords
    const playerScreenX = Math.round((p.x - topLeftTileXFloat + 0.5) * displayTilePx);
    const playerScreenY = Math.round((p.y - topLeftTileYFloat + 0.5) * displayTilePx);

    // draw player
    ctx.beginPath();
    ctx.fillStyle = "#ff4b4b";
    const r = Math.max(4, Math.round(displayTilePx * 0.35));
    ctx.arc(playerScreenX, playerScreenY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();

    // HUD: region name top-left small badge
    if (regionName) {
      ctx.save();
      ctx.font = "16px Inter, Arial";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(10, 10, 220, 36);
      ctx.fillStyle = "#fff";
      ctx.fillText(regionName, 18, 34);
      ctx.restore();
    }

    // coords bottom-left
    ctx.font = "13px Inter, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`x:${p.x} y:${p.y}  zoom:${Math.round(z * 100) / 100}`, 8, vh - 10);
  }

  // draw minimap as before
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

    const canvasStyleW = parseFloat(canvasRef.current.style.width) || Math.min(window.innerWidth * 0.78, 1200);
    const canvasStyleH = parseFloat(canvasRef.current.style.height) || Math.min(window.innerHeight * 0.86, 800);
    const displayTilePx = BASE_TILE_PX * z;
    const tilesAcross = canvasStyleW / displayTilePx;
    const tilesDown = canvasStyleH / displayTilePx;
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

  return (
    <div className="naruto-map-root">
      <div className="naruto-map-left">
        <div className="viewport-wrap">
          <canvas ref={canvasRef} className="main-canvas" />

          <div className="top-right-ui">
            <button className="chunk-btn" onClick={() => setChunkOverlay(s => !s)}>
              {chunkOverlay ? "Hide Chunks" : "Show Chunks"}
            </button>
          </div>

          <div className="controls-bottom-centered" onPointerUp={stopPointerHold} onPointerCancel={stopPointerHold}>
            <div className="arrow-grid">
              <button className="arrow" onPointerDown={() => startPointerHold(0, -1)} onPointerUp={stopPointerHold}>▲</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="arrow" onPointerDown={() => startPointerHold(-1, 0)} onPointerUp={stopPointerHold}>◀</button>
                <button className="arrow" onPointerDown={() => startPointerHold(1, 0)} onPointerUp={stopPointerHold}>▶</button>
              </div>
              <button className="arrow" onPointerDown={() => startPointerHold(0, 1)} onPointerUp={stopPointerHold}>▼</button>
            </div>
          </div>
        </div>

        <div className="mini-zoom-row">
          <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}>-</button>
          <div className="zoom-label">Zoom {Math.round(zoom * 100) / 100}</div>
          <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}>+</button>
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
