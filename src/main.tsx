import "core-js/stable";
import ResizeObserverPolyfill from "resize-observer-polyfill";

// Synchronously patch ResizeObserver BEFORE anything else runs
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root");

if (rootEl) {
  createRoot(rootEl).render(<App />);
} else {
  document.body.innerHTML = '<div id="root"></div>';
  createRoot(document.getElementById("root")!).render(<App />);
}
