import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BCjIs6LvEsQZi2txC-54aTl1YQ3OiEEFoaMlvHacA9zGBmzEGZFHTgOgWHmwnoNmzgIJE2JXwwbomrxjdHVPjIs";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushStatus = "unsupported" | "denied" | "active" | "inactive";

export function usePushNotifications() {
  const { empresa } = useEmpresa();
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("inactive");
  const [loading, setLoading] = useState(false);

  // Verifica o estado atual ao montar
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "active" : "inactive");
    }).catch(() => setStatus("inactive"));
  }, []);

  const activate = useCallback(async () => {
    if (!empresa?.id || !user?.id) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        toast.error("Permissão de notificação negada.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = sub.toJSON();
      const { error } = await (supabase as any).from("push_subscriptions").upsert({
        empresa_id: empresa.id,
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: (subJson.keys as any)?.p256dh ?? "",
        auth: (subJson.keys as any)?.auth ?? "",
      }, { onConflict: "endpoint" });

      if (error) throw error;
      setStatus("active");
      toast.success("Notificações ativadas! Você receberá avisos de novas mensagens.");
    } catch (err: any) {
      toast.error("Erro ao ativar notificações: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, user?.id]);

  const deactivate = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("inactive");
      toast.success("Notificações desativadas.");
    } catch (err: any) {
      toast.error("Erro ao desativar: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, loading, activate, deactivate };
}
