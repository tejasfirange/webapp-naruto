import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import NarutoWorldMap from "./pages/NarutoWorldMap";

function App() {
  return (
    <Router>
      {/* Simple top navigation bar */}
      <nav style={{
        display: "flex",
        gap: "20px",
        padding: "10px 20px",
        background: "#1b2a36",
        color: "#fff",
      }}>
        <Link to="/" style={{ color: "#fff", textDecoration: "none" }}>🏠 Home</Link>
        <Link to="/map" style={{ color: "#fff", textDecoration: "none" }}>🗺️ Naruto Map</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<NarutoWorldMap />} />
      </Routes>
    </Router>
  );
}

export default App;
