import React, { useEffect, useState } from "react";
import "./LandingPageMap.css";

export default function NarutoMapApp() {
  const MAP_W = 200;
  const MAP_H = 200;
  const [player, setPlayer] = useState({ x: 100, y: 100 });

  // Define Naruto world layout (rough manual placement)
  const regions = [
    { name: "Land of Fire", x: 80, y: 100, w: 60, h: 60, biome: "grass" },
    { name: "Land of Wind", x: 20, y: 120, w: 60, h: 60, biome: "sand" },
    { name: "Land of Water", x: 150, y: 110, w: 40, h: 50, biome: "water" },
    { name: "Land of Lightning", x: 130, y: 40, w: 50, h: 50, biome: "snow" },
    { name: "Land of Earth", x: 40, y: 60, w: 60, h: 50, biome: "mountain" },
  ];

  const getBiome = (x, y) => {
    for (let r of regions) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.biome;
    }
    // blend edges: water around land
    return "water";
  };

  const move = (dx, dy) =>
    setPlayer((p) => ({
      x: Math.max(0, Math.min(MAP_W - 1, p.x + dx)),
      y: Math.max(0, Math.min(MAP_H - 1, p.y + dy)),
    }));

  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) move(0, -1);
      if (["arrowdown", "s"].includes(k)) move(0, 1);
      if (["arrowleft", "a"].includes(k)) move(-1, 0);
      if (["arrowright", "d"].includes(k)) move(1, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tiles = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const biome = getBiome(x, y);
      const isPlayer = player.x === x && player.y === y;
      tiles.push(
        <div
          key={`${x}-${y}`}
          className={`tile ${biome} ${isPlayer ? "player" : ""}`}
          style={{ left: x * 32, top: y * 32 }}
        />
      );
    }
  }

  return (
    <div className="map-container">
      <div
        className="map"
        style={{
          transform: `translate(calc(50vw - ${player.x * 32 + 16}px),
                                 calc(50vh - ${player.y * 32 + 16}px))`,
        }}
      >
        {tiles}
      </div>

      <div className="controls">
        <button onClick={() => move(0, -1)}>↑</button>
        <div>
          <button onClick={() => move(-1, 0)}>←</button>
          <button onClick={() => move(1, 0)}>→</button>
        </div>
        <button onClick={() => move(0, 1)}>↓</button>
      </div>
    </div>
  );
}
