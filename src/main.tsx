import "core-js/stable";
import ResizeObserverPolyfill from "resize-observer-polyfill";
import { createRoot } from "react-dom/client";
import "./index.css";

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

async function bootstrap() {
  const isDemo = window.location.pathname.startsWith("/demo");
  const RootComponent = isDemo
    ? (await import("./demo/DemoRoot")).default
    : (await import("./App")).default;

  let rootEl = document.getElementById("root");
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "root";
    document.body.appendChild(rootEl);
  }

  createRoot(rootEl).render(<RootComponent />);
}

void bootstrap();
