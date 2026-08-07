import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PitchApp from "./PitchApp.jsx";
import { getThemeMode, applyThemeMode } from "./lib/themeMode.js";

// Applied before the first render (not just in a PitchApp effect) so a
// saved "light" preference never flashes dark component colors first.
applyThemeMode(getThemeMode());

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PitchApp />
  </React.StrictMode>
);
