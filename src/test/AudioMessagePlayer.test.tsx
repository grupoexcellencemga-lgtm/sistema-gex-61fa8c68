import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioMessagePlayer } from "@/components/funil/AudioMessagePlayer";

describe("áudio da conversa", () => {
  it("mostra duração, tempo decorrido e permite avançar pela barra", () => {
    const { container } = render(<AudioMessagePlayer src="/audio.ogg" />);
    const audio = container.querySelector("audio")!;
    Object.defineProperty(audio, "duration", { configurable: true, value: 90 });
    fireEvent.loadedMetadata(audio);
    expect(screen.getByText("0:00 / 1:30")).toBeInTheDocument();
    audio.currentTime = 15;
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole("slider", { name: "Posição do áudio" })).toHaveValue("15");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "45" } });
    expect(audio.currentTime).toBe(45);
    expect(screen.getByText("0:45 / 1:30")).toBeInTheDocument();
  });
  it("atualiza reproduzir e pausar conforme os eventos reais do áudio", () => {
    const { container } = render(<AudioMessagePlayer src="/audio.ogg" />);
    const audio = container.querySelector("audio")!;
    const play = vi.spyOn(audio, "play").mockResolvedValue();
    const pause = vi.spyOn(audio, "pause").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir áudio" }));
    expect(play).toHaveBeenCalledOnce();
    fireEvent.play(audio);
    fireEvent.click(screen.getByRole("button", { name: "Pausar áudio" }));
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.ended(audio);
    expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeInTheDocument();
  });
  it("informa quando não consegue reproduzir", async () => {
    const { container } = render(<AudioMessagePlayer src="/audio.ogg" />);
    vi.spyOn(container.querySelector("audio")!, "play").mockRejectedValue(new Error("erro"));
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir áudio" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Não foi possível reproduzir"));
  });
});
