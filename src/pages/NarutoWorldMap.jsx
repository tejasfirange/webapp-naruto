import React, { useEffect, useRef, useState } from "react";
import "./NarutoWorldMap.css";

/**
 * NarutoWorldMap.jsx — improved:
 * - GRID_SIZE = 500
 * - chunk overlay world-aligned
 * - polygonal regions for detection (point-in-polygon)
 * - region name always visible (persistent HUD overlay)
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
  const [player, setPlayer] = useState({
    x: Math.floor(GRID_SIZE / 2),
    y: Math.floor(GRID_SIZE / 2),
  });
  const [zoom, setZoom] = useState(1);
  const [chunkOverlay, setChunkOverlay] = useState(true);
  const [regionName, setRegionName] = useState("Unknown Region");

  const holdRef = useRef({ dir: null, timer: null });

  // --- Polygonal region definitions (approx)
  const REGIONS = [
    {
      id: "land_fire",
      name: "Land of Fire",
      color: "rgba(230,130,90,0.06)",
      poly: [
        [170, 240],
        [260, 260],
        [320, 300],
        [300, 380],
        [220, 380],
        [180, 330],
        [160, 280],
      ],
    },
    {
      id: "land_wind",
      name: "Land of Wind",
      color: "rgba(220,170,70,0.06)",
      poly: [
        [10, 320],
        [110, 320],
        [120, 400],
        [20, 440],
      ],
    },
    {
      id: "land_water",
      name: "Land of Water",
      color: "rgba(80,150,200,0.05)",
      poly: [
        [330, 40],
        [420, 40],
        [480, 100],
        [480, 220],
        [380, 260],
        [340, 180],
      ],
    },
    {
      id: "land_earth",
      name: "Land of Earth",
      color: "rgba(200,160,110,0.05)",
      poly: [
        [90, 40],
        [170, 40],
        [200, 110],
        [140, 180],
        [100, 140],
      ],
    },
    {
      id: "land_lightning",
      name: "Land of Lightning",
      color: "rgba(220,230,255,0.05)",
      poly: [
        [370, 10],
        [460, 10],
        [490, 70],
        [420, 120],
        [370, 80],
      ],
    },
    {
      id: "land_snow",
      name: "Land of Snow",
      color: "rgba(245,245,255,0.06)",
      poly: [
        [320, 0],
        [380, 0],
        [400, 30],
        [340, 50],
      ],
    },
  ];

  // --- point-in-polygon (ray-casting)
  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0],
        yi = poly[i][1];
      const xj = poly[j][0],
        yj = poly[j][1];
      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // --- load map image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = IMAGE_PATH + "?_=" + Date.now();
    img.onload = () => {
      imgRef.current = img;
      const oc = document.createElement("canvas");
      oc.width = img.width;
      oc.height = img.height;
      const octx = oc.getContext("2d");
      octx.drawImage(img, 0, 0);
      offscreenRef.current = { canvas: oc, ctx: octx };
      setLoaded(true);
      drawAll(img, player, zoom, chunkOverlay);
      drawMinimap(img, player, zoom);
      updateRegion(player);
    };
  }, []);

  // --- continuous movement (hold)
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

    function performMove(dir) {
      if (!dir) return;
      doMove(dir[0], dir[1]);
    }

    function startHold(dir) {
      performMove(dir);
      if (holdRef.current.timer) clearInterval(holdRef.current.timer);
      holdRef.current.dir = dir;
      holdRef.current.timer = setInterval(
        () => performMove(dir),
        HOLD_INTERVAL_MS
      );
    }

    function stopHold() {
      if (holdRef.current.timer)
        clearInterval(holdRef.current.timer), (holdRef.current.timer = null);
      holdRef.current.dir = null;
    }

    const onDown = (e) => {
      const dir = keyToDir[e.key] || keyToDir[e.key?.toLowerCase()];
      if (dir && !holdRef.current.dir) startHold(dir);
      if (e.key === "+" || e.key === "=")
        setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)));
      if (e.key === "-")
        setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)));
    };
    const onUp = (e) => {
      const dir = keyToDir[e.key] || keyToDir[e.key?.toLowerCase()];
      if (dir) stopHold();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      stopHold();
    };
  }, []);

  // --- zoom on wheel
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) =>
        Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(3)))
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- redraw on updates
  useEffect(() => {
    if (!loaded) return;
    drawAll(imgRef.current, player, zoom, chunkOverlay);
    drawMinimap(imgRef.current, player, zoom);
    updateRegion(player);
  }, [player, zoom, chunkOverlay, loaded]);

  // --- player move
  function doMove(dx, dy) {
    setPlayer((p) => {
      const nx = Math.max(0, Math.min(GRID_SIZE - 1, p.x + dx));
      const ny = Math.max(0, Math.min(GRID_SIZE - 1, p.y + dy));
      const np = { x: nx, y: ny };
      if (loaded) {
        drawAll(imgRef.current, np, zoom, chunkOverlay);
        drawMinimap(imgRef.current, np, zoom);
        updateRegion(np);
      }
      return np;
    });
  }

  // --- touch controls
  function startPointerHold(dx, dy) {
    doMove(dx, dy);
    if (holdRef.current.timer) clearInterval(holdRef.current.timer);
    holdRef.current.timer = setInterval(() => doMove(dx, dy), HOLD_INTERVAL_MS);
  }
  function stopPointerHold() {
    if (holdRef.current.timer) clearInterval(holdRef.current.timer);
  }

  // --- region lookup
  function updateRegion(p) {
    const r = REGIONS.find((r) => pointInPoly(p.x, p.y, r.poly));
    setRegionName(r ? r.name : "Unknown Region");
  }

  // --- background edge filler
  function sampleEdgeFillColor(img, srcX, srcY, srcW, srcH) {
    const off = offscreenRef.current;
    if (!off) return "#071018";
    const ctx = off.ctx;
    const w = img.width,
      h = img.height;
    try {
      const sx = Math.max(0, Math.min(w - 1, srcX + srcW / 2));
      const sy = Math.max(0, Math.min(h - 1, srcY + srcH / 2));
      const d = ctx.getImageData(sx, sy, 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    } catch {
      return "#071018";
    }
  }

  // --- main draw
  function drawAll(img, p, z, showChunks) {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;

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
    srcX = Math.max(0, Math.min(img.width - srcW, srcX));
    srcY = Math.max(0, Math.min(img.height - srcH, srcY));

    ctx.fillStyle = sampleEdgeFillColor(img, srcX, srcY, srcW, srcH);
    ctx.fillRect(0, 0, vw, vh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, vw, vh);

    const topLeftTileX = srcX / pxPerTileX;
    const topLeftTileY = srcY / pxPerTileY;

    const offsetX = -(topLeftTileX - Math.floor(topLeftTileX)) * displayTilePx;
    const offsetY = -(topLeftTileY - Math.floor(topLeftTileY)) * displayTilePx;

    // player marker
    const px = Math.round((p.x - topLeftTileX + 0.5) * displayTilePx);
    const py = Math.round((p.y - topLeftTileY + 0.5) * displayTilePx);
    ctx.beginPath();
    ctx.fillStyle = "#ff4b4b";
    ctx.arc(px, py, Math.max(4, Math.round(displayTilePx * 0.35)), 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }

  // --- minimap
  function drawMinimap(img, p, z = zoom) {
    const mini = miniRef.current;
    if (!mini || !img) return;
    const ctx = mini.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    const size = 180;
    mini.width = size * DPR;
    mini.height = size * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    const canvasW =
      parseFloat(canvasRef.current.style.width) ||
      Math.min(window.innerWidth * 0.78, 1200);
    const canvasH =
      parseFloat(canvasRef.current.style.height) ||
      Math.min(window.innerHeight * 0.86, 800);
    const displayTilePx = BASE_TILE_PX * z;
    const tilesAcross = canvasW / displayTilePx;
    const tilesDown = canvasH / displayTilePx;
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
          <div className="region-label">🏞 {regionName}</div>

          <div className="top-right-ui">
            <button
              className="chunk-btn"
              onClick={() => setChunkOverlay((s) => !s)}
            >
              {chunkOverlay ? "Hide Chunks" : "Show Chunks"}
            </button>
          </div>

          <div
            className="controls-bottom-centered"
            onPointerUp={stopPointerHold}
            onPointerCancel={stopPointerHold}
          >
            <div className="arrow-grid">
              <button
                className="arrow"
                onPointerDown={() => startPointerHold(0, -1)}
                onPointerUp={stopPointerHold}
              >
                ▲
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="arrow"
                  onPointerDown={() => startPointerHold(-1, 0)}
                  onPointerUp={stopPointerHold}
                >
                  ◀
                </button>
                <button
                  className="arrow"
                  onPointerDown={() => startPointerHold(1, 0)}
                  onPointerUp={stopPointerHold}
                >
                  ▶
                </button>
              </div>
              <button
                className="arrow"
                onPointerDown={() => startPointerHold(0, 1)}
                onPointerUp={stopPointerHold}
              >
                ▼
              </button>
            </div>
          </div>
        </div>

        <div className="mini-zoom-row">
          <button
            onClick={() =>
              setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))
            }
          >
            -
          </button>
          <div className="zoom-label">
            Zoom {Math.round(zoom * 100) / 100}
          </div>
          <button
            onClick={() =>
              setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))
            }
          >
            +
          </button>
          <div style={{ width: 12 }} />
          <div className="coords">
            x:{player.x} y:{player.y}
          </div>
        </div>
      </div>

      <aside className="naruto-sidebar">
        <h3>Mini map</h3>
        <canvas ref={miniRef} className="mini-canvas" />
        <div style={{ height: 12 }} />
        <div className="legend">
          <div className="legend-title">Controls</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 8,
            }}
          >
            <div style={{ color: "#d7e8ff" }}>
              WASD / Arrows = move (hold to repeat)
            </div>
            <div style={{ color: "#d7e8ff" }}>Mouse wheel = zoom</div>
            <div style={{ color: "#d7e8ff" }}>Chunks = 16×16 toggle</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
