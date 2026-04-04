import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const shouldDisableServiceWorker = () => {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;

  return hostname.endsWith("lovable.app") || hostname.endsWith("lovableproject.com");
};

function PWAUpdatePromptInner() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
    },
    onRegisterError(error) {
      console.error("[SW] Registration error:", error);
    },
  });

  useEffect(() => {
    const checkForUpdates = () => {
      if (document.visibilityState !== "visible") return;
      registrationRef.current?.update();
    };

    checkForUpdates();

    const intervalId = window.setInterval(checkForUpdates, 60 * 1000);
    window.addEventListener("focus", checkForUpdates);
    window.addEventListener("online", checkForUpdates);
    window.addEventListener("pageshow", checkForUpdates);
    document.addEventListener("visibilitychange", checkForUpdates);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForUpdates);
      window.removeEventListener("online", checkForUpdates);
      window.removeEventListener("pageshow", checkForUpdates);
      document.removeEventListener("visibilitychange", checkForUpdates);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-lg">
        <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Nova versão disponível</p>
          <p className="text-xs text-muted-foreground">Atualize para a versão mais recente.</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => updateServiceWorker(true)} className="h-8">
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PWAUpdatePrompt() {
  useEffect(() => {
    if (!shouldDisableServiceWorker() || typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      if (registrations.length === 0) return;

      await Promise.all(registrations.map((registration) => registration.unregister()));

      if (!sessionStorage.getItem("preview-sw-cleared")) {
        sessionStorage.setItem("preview-sw-cleared", "true");
        window.location.reload();
      }
    }).catch(() => {
      // noop
    });
  }, []);

  if (shouldDisableServiceWorker()) return null;

  return <PWAUpdatePromptInner />;
}
