import React, { useEffect, useRef, useState } from "react";
import { createNoise2D } from "simplex-noise";

// Naruto MMORPG-style procedural world generator
export default function NarutoMapApp() {
  const canvasRef = useRef(null);
  const WORLD_SIZE = 1000; // 1000x1000 tiles
  const TILE_SIZE = 12;
  const [zoom, setZoom] = useState(1);
  const [player, setPlayer] = useState({ x: 500, y: 500 });
  const noise2D = createNoise2D();

  const regions = [
    { name: "Land of Fire", color: "#4ca64c", biome: "grass" },
    { name: "Land of Wind", color: "#e0c77d", biome: "sand" },
    { name: "Land of Water", color: "#5aa3e7", biome: "water" },
    { name: "Land of Earth", color: "#8b7a63", biome: "mountain" },
    { name: "Land of Lightning", color: "#c9d8f0", biome: "snow" },
  ];

  // Get biome from Perlin noise
  const getBiome = (x, y) => {
    const nx = x / WORLD_SIZE - 0.5;
    const ny = y / WORLD_SIZE - 0.5;
    const e = noise2D(nx * 2, ny * 2); // elevation
    const m = noise2D(nx * 4, ny * 4); // moisture
    if (e < -0.3) return "water";
    if (e < -0.05) return "sand";
    if (e > 0.5) return "mountain";
    if (e > 0.8) return "snow";
    if (m > 0.3) return "forest";
    return "grass";
  };

  // Draw frame
  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = window.innerWidth;
    const height = window.innerHeight;
    const tile = TILE_SIZE * zoom;

    canvas.width = width;
    canvas.height = height;

    const startX = player.x - Math.floor(width / tile / 2);
    const startY = player.y - Math.floor(height / tile / 2);

    for (let y = 0; y < height / tile + 2; y++) {
      for (let x = 0; x < width / tile + 2; x++) {
        const worldX = startX + x;
        const worldY = startY + y;
        const biome = getBiome(worldX, worldY);
        ctx.fillStyle = biomeColors(biome);
        ctx.fillRect(x * tile, y * tile, tile + 1, tile + 1);
      }
    }

    // Draw player centered
    const px = width / 2;
    const py = height / 2;
    ctx.beginPath();
    ctx.arc(px, py, tile / 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff4444";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  };

  // Colors for each biome
  const biomeColors = (biome) => {
    switch (biome) {
      case "water": return "#3b83cc";
      case "sand": return "#e7d29e";
      case "grass": return "#63b36c";
      case "forest": return "#2f6630";
      case "mountain": return "#8b7a63";
      case "snow": return "#e6eef5";
      default: return "#000";
    }
  };

  // Movement + zoom
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) setPlayer((p) => ({ ...p, y: p.y - 2 }));
      if (["arrowdown", "s"].includes(k)) setPlayer((p) => ({ ...p, y: p.y + 2 }));
      if (["arrowleft", "a"].includes(k)) setPlayer((p) => ({ ...p, x: p.x - 2 }));
      if (["arrowright", "d"].includes(k)) setPlayer((p) => ({ ...p, x: p.x + 2 }));
      if (k === "+") setZoom((z) => Math.min(4, z + 0.1));
      if (k === "-") setZoom((z) => Math.max(0.5, z - 0.1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    draw();
  }, [player, zoom]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100vw",
        height: "100vh",
        display: "block",
        background: "#0a0a0a",
      }}
    />
  );
}
