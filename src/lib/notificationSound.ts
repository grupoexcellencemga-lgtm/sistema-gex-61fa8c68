// Som de notificação gerado via Web Audio API — sem arquivo de áudio, funciona
// offline (PWA). Toca um "ding-dong" curto e suave. Respeita a preferência do
// usuário salva em localStorage ("notif_som" = "off" desliga).

let audioCtx: AudioContext | null = null;

export function somNotificacaoLigado(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("notif_som") !== "off";
}

export function definirSomNotificacao(ligado: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("notif_som", ligado ? "on" : "off");
}

export function playNotificationSound() {
  if (!somNotificacaoLigado()) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    // Navegadores suspendem o áudio até a 1ª interação; retoma quando possível.
    if (audioCtx.state === "suspended") audioCtx.resume();

    const inicio = audioCtx.currentTime;
    const tom = (freq: number, offset: number, dur: number) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = inicio + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };

    tom(880, 0, 0.18); // A5
    tom(1174.7, 0.12, 0.24); // D6
  } catch {
    // autoplay bloqueado ou sem suporte — ignora silenciosamente
  }
}
