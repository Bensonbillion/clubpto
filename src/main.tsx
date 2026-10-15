import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { killStaleCaches } from "./lib/killStaleCaches";
import "./index.css";
import "./styles/rally.css";

// Purge any service worker or cache left by an earlier deploy. Runs first,
// before anything can await it: a client reaching this line has already
// loaded a fresh index.html, so this is the moment the ghost dies.
killStaleCaches();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);