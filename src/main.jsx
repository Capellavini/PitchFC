import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PitchApp from "./PitchApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PitchApp />
  </React.StrictMode>
);
