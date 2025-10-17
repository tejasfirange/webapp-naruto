import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import NarutoMapApp from "./pages/LandingPageMap";

function App() {
  return (
    <Router>
      <nav style={{ display: "flex", gap: "20px", padding: "10px", background: "#1b2a36" }}>
        <Link to="/" style={{ color: "#fff", textDecoration: "none" }}>🏠 Home</Link>
        <Link to="/map" style={{ color: "#fff", textDecoration: "none" }}>🗺️ Naruto Map</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<NarutoMapApp />} />
      </Routes>
    </Router>
  );
}

export default App;
