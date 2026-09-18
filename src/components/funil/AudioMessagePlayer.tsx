import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function timeLabel(seconds: number) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function AudioMessagePlayer({ src, outgoing = false }: { src: string; outgoing?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState(false);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); return; }
    setError(false);
    if (audio.ended) audio.currentTime = 0;
    try { await audio.play(); } catch { setPlaying(false); setError(true); }
  }

  function updateDuration() {
    const value = audioRef.current?.duration ?? 0;
    if (Number.isFinite(value) && value > 0) setDuration(value);
  }

  return (
    <div className="w-[260px] max-w-full mb-1">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden"
        onLoadedMetadata={updateDuration} onDurationChange={updateDuration}
        onTimeUpdate={() => setPosition(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError(true); }} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={togglePlayback} aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current", outgoing ? "bg-white/15 hover:bg-white/25 text-white" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300")}>
          {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
        </button>
        <div className="min-w-0 flex-1">
          <input type="range" min={0} max={duration || 1} step="0.1" value={Math.min(position, duration || 0)}
            disabled={!duration} aria-label="Posição do áudio" aria-valuetext={`${timeLabel(position)} de ${timeLabel(duration)}`}
            onChange={event => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setPosition(value); }}
            className={cn("block w-full h-5 cursor-pointer disabled:cursor-wait", outgoing ? "accent-white" : "accent-emerald-600 dark:accent-emerald-400")} />
          <p className={cn("text-[11px] tabular-nums mt-0.5", outgoing ? "text-white/80" : "text-muted-foreground")}>{timeLabel(position)} / {timeLabel(duration)}</p>
        </div>
      </div>
      {error && <p role="status" className="text-xs mt-1">Não foi possível reproduzir este áudio. Tente novamente.</p>}
    </div>
  );
}
