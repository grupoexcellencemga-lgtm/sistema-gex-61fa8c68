import { useState, useEffect } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

const DISMISS_KEY = "gex-ios-install-dismissed";

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOSSafari() || isStandalone()) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Delay showing to avoid being intrusive
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9998] mx-auto max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-lg border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="text-xs font-bold text-primary-foreground">GE</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Instalar Sistema GEx</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toque em{" "}
              <Share className="inline h-3.5 w-3.5 -mt-0.5 text-primary" />{" "}
              e depois em <strong>"Adicionar à Tela de Início"</strong>
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 w-8 p-0 shrink-0 -mt-1 -mr-1">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
