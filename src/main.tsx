import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { killStaleCaches } from "./lib/killStaleCaches";
import "./index.css";
import "./styles/rally.css";

// Supabase sign-in redirects (success tokens or errors) arrive as URL hashes
// and can land on ANY page when the auth server falls back to its Site URL.
// Only /club loads the clubhouse client that consumes them, so route every
// auth hash there before the app renders — otherwise the sign-in is silently
// dropped on the floor.
// Purge any service worker or cache left by an earlier deploy. Runs first,
// before anything can await it: a client reaching this line has already
// loaded a fresh index.html, so this is the moment the ghost dies.
killStaleCaches();

const authHash = window.location.hash;
if (
  (authHash.includes("access_token=") || authHash.includes("error_code=")) &&
  !window.location.pathname.endsWith("/club")
) {
  window.location.replace(`${import.meta.env.BASE_URL}club${authHash}`);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);