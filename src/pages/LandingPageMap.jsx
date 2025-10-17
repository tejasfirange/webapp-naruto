import React, { useEffect, useState } from "react";
import "./LandingPageMap.css";

export default function NarutoMapApp() {
  const MAP_SIZE = 50; // 50x50 tiles (expand later)
  const [player, setPlayer] = useState({ x: 25, y: 25 });

  // Generate biome map (region-based pattern)
  const generateMap = () => {
    const biomes = ["grass", "forest", "sand", "water", "mountain", "snow"];
    const map = Array.from({ length: MAP_SIZE }, (_, y) =>
      Array.from({ length: MAP_SIZE }, (_, x) => {
        const noise = Math.sin(x * 0.15) + Math.cos(y * 0.1);
        if (noise > 1) return "snow";
        if (noise > 0.5) return "mountain";
        if (noise > 0.1) return "forest";
        if (noise > -0.3) return "grass";
        if (noise > -0.8) return "sand";
        return "water";
      })
    );
    return map;
  };

  const [mapData] = useState(generateMap);

  const movePlayer = (dx, dy) => {
    setPlayer((p) => {
      const nx = Math.max(0, Math.min(MAP_SIZE - 1, p.x + dx));
      const ny = Math.max(0, Math.min(MAP_SIZE - 1, p.y + dy));
      return { x: nx, y: ny };
    });
  };

  // Key movement
  useEffect(() => {
    const handleKey = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) movePlayer(0, -1);
      if (["arrowdown", "s"].includes(k)) movePlayer(0, 1);
      if (["arrowleft", "a"].includes(k)) movePlayer(-1, 0);
      if (["arrowright", "d"].includes(k)) movePlayer(1, 0);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="map-container">
      <div
        className="map"
        style={{
          transform: `translate(calc(50vw - ${player.x * 32 + 16}px), calc(50vh - ${player.y * 32 + 16}px))`,
        }}
      >
        {mapData.map((row, y) =>
          row.map((tile, x) => (
            <div
              key={`${x}-${y}`}
              className={`tile ${tile} ${player.x === x && player.y === y ? "player" : ""}`}
              style={{ left: x * 32, top: y * 32 }}
            />
          ))
        )}
      </div>

      <div className="controls">
        <button onClick={() => movePlayer(0, -1)}>↑</button>
        <div>
          <button onClick={() => movePlayer(-1, 0)}>←</button>
          <button onClick={() => movePlayer(1, 0)}>→</button>
        </div>
        <button onClick={() => movePlayer(0, 1)}>↓</button>
      </div>
    </div>
  );
}
