import { Route, Routes } from "react-router";
import LandingPage from "./pages/LandingPage";
import RegisterPage from "./pages/RegisterPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Temporary fallback until other pages are created */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default App;